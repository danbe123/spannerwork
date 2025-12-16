import rateLimit, { MemoryStore, Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { env } from '../config/env.js';
import { redis, isRedisAvailable, safeHincrby, safeHset, safeHgetall } from '../config/redis.js';
import { logger } from '../config/logger.js';

// Check if we should skip rate limiting (for tests)
const isTestEnv = env.NODE_ENV === 'test';
const isDevEnv = env.NODE_ENV === 'development';
const isRateLimitDisabled = isTestEnv || process.env.DISABLE_RATE_LIMIT === 'true';

/**
 * Create a rate limit store that uses Redis in production for horizontal scaling,
 * with fallback to memory store if Redis is unavailable.
 */
function createStore(prefix: string): Store {
  // Use memory store in test environment
  if (isTestEnv) {
    return new MemoryStore();
  }

  // Try to use Redis store in production/development
  if (isRedisAvailable()) {
    try {
      return new RedisStore({
        // Use the existing ioredis client with proper typing
        sendCommand: async (...args: string[]): Promise<number> => {
          return redis.call(args[0], ...args.slice(1)) as Promise<number>;
        },
        prefix: `rl:${prefix}:`,
      });
    } catch (error) {
      logger.warn(`Failed to create Redis rate limit store for ${prefix}, using memory store:`, error);
    }
  }

  // Fallback to memory store
  logger.info(`Using memory store for rate limiting (${prefix}) - not recommended for production with multiple instances`);
  return new MemoryStore();
}

// Create stores - Redis-backed in production, memory in test
const apiStore = createStore('api');
const authStore = createStore('auth');
const uploadStore = createStore('upload');
const adminStore = createStore('admin');

// Redis key for rate limit metrics (persisted across restarts)
const RATE_LIMIT_METRICS_KEY = 'ratelimit:metrics';

// In-memory fallback metrics (used when Redis unavailable)
const fallbackMetrics: Record<string, { blocked: number; lastBlockedAt?: Date; lastBlockedIp?: string }> = {
  api: { blocked: 0 },
  auth: { blocked: 0 },
  upload: { blocked: 0 },
  admin: { blocked: 0 },
  geocoding: { blocked: 0 },
  sensitive: { blocked: 0 },
};

// Alert thresholds (number of blocked requests to trigger alert)
const ALERT_THRESHOLDS = {
  api: 100,       // Alert if 100+ requests blocked
  auth: 20,       // Alert if 20+ auth attempts blocked (potential brute force)
  upload: 50,
  admin: 10,      // Admin route abuse is more concerning
  geocoding: 50,
  sensitive: 5,   // Any sensitive operation abuse is critical
};

// Track blocked requests and check alert thresholds
// Uses Redis for persistence with in-memory fallback
async function trackBlockedRequest(limiterName: string, ip?: string): Promise<void> {
  const now = new Date().toISOString();
  
  // Try to persist to Redis
  const newCount = await safeHincrby(RATE_LIMIT_METRICS_KEY, `${limiterName}:blocked`, 1);
  await safeHset(RATE_LIMIT_METRICS_KEY, `${limiterName}:lastBlockedAt`, now);
  if (ip) {
    await safeHset(RATE_LIMIT_METRICS_KEY, `${limiterName}:lastBlockedIp`, ip);
  }
  
  // Also update in-memory fallback
  if (fallbackMetrics[limiterName]) {
    fallbackMetrics[limiterName].blocked++;
    fallbackMetrics[limiterName].lastBlockedAt = new Date();
    fallbackMetrics[limiterName].lastBlockedIp = ip;
  }

  // Check if we should alert (use Redis count if available, fallback otherwise)
  const blockedCount = newCount ?? fallbackMetrics[limiterName]?.blocked ?? 0;
  const threshold = ALERT_THRESHOLDS[limiterName as keyof typeof ALERT_THRESHOLDS];
  if (threshold && blockedCount >= threshold && blockedCount % threshold === 0) {
    // Alert every time we hit a multiple of the threshold
    logger.warn(`Rate limit alert: ${limiterName} has blocked ${blockedCount} requests`, {
      limiter: limiterName,
      blocked: blockedCount,
      lastIp: ip,
      timestamp: now,
    });
  }
}

/**
 * General rate limiter for all API endpoints
 */
export const apiLimiter = rateLimit({
  windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS),
  max: isTestEnv ? 1000 : isDevEnv ? 1000 : parseInt(env.RATE_LIMIT_MAX), // Higher limit in dev/tests
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: apiStore,
  skip: () => isRateLimitDisabled,
  handler: (req, res) => {
    // Fire-and-forget the async tracking
    void trackBlockedRequest('api', req.ip);
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many requests from this IP, please try again later',
    });
  },
});

/**
 * Strict rate limiter for authentication endpoints
 */
export const authLimiter = rateLimit({
  windowMs: parseInt(env.RATE_LIMIT_AUTH_WINDOW_MS),
  max: isTestEnv ? 1000 : isDevEnv ? 100 : parseInt(env.RATE_LIMIT_AUTH_MAX), // Higher limit in dev/tests
  message: {
    error: 'Too Many Requests',
    message: 'Too many authentication attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  store: authStore,
  skip: () => isRateLimitDisabled,
  handler: (req, res) => {
    void trackBlockedRequest('auth', req.ip);
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many authentication attempts, please try again later',
      retryAfter: Math.ceil(parseInt(env.RATE_LIMIT_AUTH_WINDOW_MS) / 1000),
    });
  },
});

/**
 * Rate limiter for file uploads
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnv ? 1000 : 20, // Higher limit in tests
  message: {
    error: 'Too Many Requests',
    message: 'Upload limit exceeded, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: uploadStore,
  skip: () => isRateLimitDisabled,
  handler: (req, res) => {
    void trackBlockedRequest('upload', req.ip);
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Upload limit exceeded, please try again later',
      retryAfter: 900, // 15 minutes
    });
  },
});

/**
 * Rate limiter for admin operations
 */
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTestEnv ? 1000 : 30, // Higher limit in tests
  message: {
    error: 'Too Many Requests',
    message: 'Too many admin requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: adminStore,
  skip: () => isRateLimitDisabled,
  handler: (req, res) => {
    void trackBlockedRequest('admin', req.ip);
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many admin requests, please try again later',
      retryAfter: 60,
    });
  },
});

// Create store for geocoding limiter
const geocodingStore = createStore('geocoding');

/**
 * Strict rate limiter for geocoding/external API calls
 * More restrictive to prevent abuse and control external API costs
 */
export const geocodingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: isTestEnv ? 1000 : 30, // 30 requests per minute per IP
  message: {
    error: 'Too Many Requests',
    message: 'Too many geocoding requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: geocodingStore,
  skip: () => isRateLimitDisabled,
  handler: (req, res) => {
    void trackBlockedRequest('geocoding', req.ip);
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many geocoding requests, please try again later',
      retryAfter: 60,
    });
  },
});

// Create store for sensitive operations (password reset, etc.)
const sensitiveStore = createStore('sensitive');

/**
 * Extra strict rate limiter for sensitive operations
 * (password reset, account deletion, etc.)
 */
export const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: isTestEnv ? 1000 : 5, // 5 requests per hour per IP
  message: {
    error: 'Too Many Requests',
    message: 'Too many sensitive operation requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: sensitiveStore,
  skip: () => isRateLimitDisabled,
  handler: (req, res) => {
    void trackBlockedRequest('sensitive', req.ip);
    logger.warn('Sensitive operation rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent'),
    });
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many sensitive operation requests, please try again later',
      retryAfter: 3600, // 1 hour
    });
  },
});

/**
 * Reset all rate limiter stores (for testing)
 * Only works with MemoryStore - Redis stores don't need manual reset
 */
export function resetRateLimiters(): void {
  // Only MemoryStore has resetAll - check before calling
  if (apiStore instanceof MemoryStore) apiStore.resetAll();
  if (authStore instanceof MemoryStore) authStore.resetAll();
  if (uploadStore instanceof MemoryStore) uploadStore.resetAll();
  if (adminStore instanceof MemoryStore) adminStore.resetAll();
  if (geocodingStore instanceof MemoryStore) geocodingStore.resetAll();
  if (sensitiveStore instanceof MemoryStore) sensitiveStore.resetAll();
}

// =============================================================================
// Rate Limiting Metrics API
// =============================================================================

interface RateLimitMetrics {
  limiterName: string;
  windowMs: number;
  maxRequests: number;
  blockedRequests: number;
  lastBlockedAt?: string;
  lastBlockedIp?: string;
}

/**
 * Get rate limiting metrics for all limiters
 * Fetches from Redis for persisted metrics, falls back to in-memory
 */
export async function getRateLimitMetrics(): Promise<RateLimitMetrics[]> {
  // Try to get from Redis first
  const redisMetrics = await safeHgetall(RATE_LIMIT_METRICS_KEY);
  const useRedis = Object.keys(redisMetrics).length > 0;

  const limiters = [
    { name: 'api', windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS), maxRequests: parseInt(env.RATE_LIMIT_MAX) },
    { name: 'auth', windowMs: parseInt(env.RATE_LIMIT_AUTH_WINDOW_MS), maxRequests: parseInt(env.RATE_LIMIT_AUTH_MAX) },
    { name: 'upload', windowMs: 15 * 60 * 1000, maxRequests: 20 },
    { name: 'admin', windowMs: 60 * 1000, maxRequests: 30 },
    { name: 'geocoding', windowMs: 60 * 1000, maxRequests: 30 },
    { name: 'sensitive', windowMs: 60 * 60 * 1000, maxRequests: 5 },
  ];

  return limiters.map(({ name, windowMs, maxRequests }) => {
    if (useRedis) {
      return {
        limiterName: name,
        windowMs,
        maxRequests,
        blockedRequests: parseInt(redisMetrics[`${name}:blocked`] || '0', 10),
        lastBlockedAt: redisMetrics[`${name}:lastBlockedAt`],
        lastBlockedIp: redisMetrics[`${name}:lastBlockedIp`],
      };
    }
    // Fallback to in-memory
    return {
      limiterName: name,
      windowMs,
      maxRequests,
      blockedRequests: fallbackMetrics[name]?.blocked ?? 0,
      lastBlockedAt: fallbackMetrics[name]?.lastBlockedAt?.toISOString(),
      lastBlockedIp: fallbackMetrics[name]?.lastBlockedIp,
    };
  });
}

/**
 * Reset rate limit metrics (for testing or periodic cleanup)
 * Clears both Redis and in-memory metrics
 */
export async function resetRateLimitMetrics(): Promise<void> {
  // Clear in-memory fallback
  Object.keys(fallbackMetrics).forEach(key => {
    fallbackMetrics[key] = { blocked: 0 };
  });
  
  // Clear Redis metrics
  if (isRedisAvailable()) {
    try {
      await redis.del(RATE_LIMIT_METRICS_KEY);
    } catch (error) {
      logger.error('Failed to reset Redis rate limit metrics:', error);
    }
  }
}

/**
 * Get total blocked requests across all limiters
 */
export async function getTotalBlockedRequests(): Promise<number> {
  const metrics = await getRateLimitMetrics();
  return metrics.reduce((sum, m) => sum + m.blockedRequests, 0);
}
