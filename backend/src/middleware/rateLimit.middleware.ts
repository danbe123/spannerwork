import rateLimit, { MemoryStore, Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { env } from '../config/env.js';
import { redis, isRedisAvailable, safeHincrby, safeHset, safeHgetall, REDIS_KEY_PREFIX, prefixKey } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { securityEventService } from '../services/securityEvent.service.js';

// Check if we should skip rate limiting (only in test environment)
// Note: DISABLE_RATE_LIMIT env var removed for security - rate limiting cannot be bypassed
const isTestEnv = env.NODE_ENV === 'test';
const isDevEnv = env.NODE_ENV === 'development';
const isRateLimitDisabled = isTestEnv; // Only disabled in test environment

// Circuit breaker state for Redis failover
let consecutiveRedisFailures = 0;
const MAX_REDIS_FAILURES = 3;
const CIRCUIT_RESET_MS = 60000; // 1 minute
let circuitOpenUntil = 0;

// In-memory rate limit fallback counters
const inMemoryRateLimitCounters = new Map<string, { count: number; resetAt: number }>();

// FIX: Incremental cleanup to prevent memory leaks
// Runs every minute and cleans up expired entries in batches
let lastCleanupTime = Date.now();
const CLEANUP_INTERVAL_MS = 60000; // 1 minute
const MAX_ENTRIES_PER_CLEANUP = 1000; // Limit CPU impact per cleanup

function cleanupExpiredEntries(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of inMemoryRateLimitCounters) {
    if (now > value.resetAt) {
      inMemoryRateLimitCounters.delete(key);
      cleaned++;
      // Limit how many we clean per call to prevent CPU spikes
      if (cleaned >= MAX_ENTRIES_PER_CLEANUP) {
        break;
      }
    }
  }

  if (cleaned > 0) {
    logger.debug(`Rate limit memory cleanup: removed ${cleaned} expired entries, ${inMemoryRateLimitCounters.size} remaining`);
  }
}

// Run cleanup periodically in the background
setInterval(() => {
  cleanupExpiredEntries();
}, CLEANUP_INTERVAL_MS);

/**
 * In-memory rate limiting fallback when Redis is unavailable.
 * Uses stricter limits (50% of normal) to compensate for per-instance tracking.
 */
function inMemoryRateLimit(key: string, windowMs: number, _maxRequests: number): number {
  const now = Date.now();
  const entry = inMemoryRateLimitCounters.get(key);

  // FIX: Trigger cleanup if interval has passed (fallback if setInterval misses)
  if (now - lastCleanupTime > CLEANUP_INTERVAL_MS) {
    lastCleanupTime = now;
    // Run cleanup async to not block the request
    setImmediate(cleanupExpiredEntries);
  }

  // Emergency cleanup if map gets too large (prevents OOM)
  if (inMemoryRateLimitCounters.size > 50000) {
    logger.warn('Rate limit memory store exceeds 50k entries, triggering emergency cleanup');
    cleanupExpiredEntries();
  }

  if (!entry || now > entry.resetAt) {
    inMemoryRateLimitCounters.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }

  entry.count++;
  return entry.count;
}

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
        // Use the existing ioredis client with circuit breaker pattern
        // Falls back to in-memory rate limiting with stricter limits when Redis fails
        sendCommand: async (...args: string[]): Promise<number> => {
          const now = Date.now();

          // Circuit breaker: if open, use in-memory fallback
          if (now < circuitOpenUntil) {
            // Use in-memory fallback with half the normal limits
            const ip = args[1] || 'unknown';
            return inMemoryRateLimit(`${prefix}:${ip}`, 60000, 50);
          }

          try {
            if (!isRedisAvailable()) {
              consecutiveRedisFailures++;
              if (consecutiveRedisFailures >= MAX_REDIS_FAILURES) {
                circuitOpenUntil = now + CIRCUIT_RESET_MS;
                logger.error(`Rate limit Redis circuit breaker OPEN for ${prefix} - using in-memory fallback`);
              }
              const ip = args[1] || 'unknown';
              return inMemoryRateLimit(`${prefix}:${ip}`, 60000, 50);
            }

            const result = await redis.call(args[0], ...args.slice(1)) as number;
            consecutiveRedisFailures = 0; // Reset on success
            return result;
          } catch (error) {
            consecutiveRedisFailures++;
            if (consecutiveRedisFailures >= MAX_REDIS_FAILURES) {
              circuitOpenUntil = now + CIRCUIT_RESET_MS;
              logger.error(`Rate limit Redis circuit breaker OPEN for ${prefix} - using in-memory fallback`);
            }
            logger.warn(`Redis rate limit error for ${prefix}:`, error);
            const ip = args[1] || 'unknown';
            return inMemoryRateLimit(`${prefix}:${ip}`, 60000, 50);
          }
        },
        prefix: `${REDIS_KEY_PREFIX}rl:${prefix}:`,
        // Cloudways Redis uses allkeys-lfu eviction policy which can't be changed
        // Suppress the warning - we accept that rate limit data may be evicted under memory pressure
        // This is preferable to blocking all requests if Redis is under load
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
  referral: { blocked: 0 },
  'referral-sms': { blocked: 0 },
  'invoice-generate': { blocked: 0 },
  'invoice-export': { blocked: 0 },
};

// Alert thresholds (number of blocked requests to trigger alert)
const ALERT_THRESHOLDS = {
  api: 100,       // Alert if 100+ requests blocked
  auth: 20,       // Alert if 20+ auth attempts blocked (potential brute force)
  upload: 50,
  admin: 10,      // Admin route abuse is more concerning
  geocoding: 50,
  sensitive: 5,   // Any sensitive operation abuse is critical
  referral: 20,   // Referral spam attempts
  'referral-sms': 10, // SMS abuse is costly
  'invoice-generate': 30, // Invoice generation abuse
  'invoice-export': 50, // Export abuse
};

// Track blocked requests and check alert thresholds
// Uses Redis for persistence with in-memory fallback
async function trackBlockedRequest(limiterName: string, ip?: string, path?: string, userAgent?: string): Promise<void> {
  const now = new Date().toISOString();

  // Log to security event service (fire-and-forget)
  void securityEventService.logRateLimitExceeded(limiterName, ip || 'unknown', path || '/', userAgent);

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
    void trackBlockedRequest('api', req.ip, req.path, req.get('User-Agent'));
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
    void trackBlockedRequest('auth', req.ip, req.path, req.get('User-Agent'));
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
    void trackBlockedRequest('upload', req.ip, req.path, req.get('User-Agent'));
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
    void trackBlockedRequest('admin', req.ip, req.path, req.get('User-Agent'));
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
    void trackBlockedRequest('geocoding', req.ip, req.path, req.get('User-Agent'));
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many geocoding requests, please try again later',
      retryAfter: 60,
    });
  },
});

// Create store for sensitive operations (password reset, etc.)
const sensitiveStore = createStore('sensitive');

// Create stores for referral operations
const referralStore = createStore('referral');
const referralSmsStore = createStore('referral-sms');

// Create stores for invoice operations
const invoiceGenerateStore = createStore('invoice-generate');
const invoiceExportStore = createStore('invoice-export');

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
    void trackBlockedRequest('sensitive', req.ip, req.path, req.get('User-Agent'));
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many sensitive operation requests, please try again later',
      retryAfter: 3600, // 1 hour
    });
  },
});

/**
 * Rate limiter for referral email invitations
 * Prevents spam and abuse of referral system
 */
export const referralLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: isTestEnv ? 1000 : 10, // 10 email referrals per hour per IP
  message: {
    error: 'Too Many Requests',
    message: 'Too many referral invitations, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: referralStore,
  skip: () => isRateLimitDisabled,
  handler: (req, res) => {
    void trackBlockedRequest('referral', req.ip, req.path, req.get('User-Agent'));
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many referral invitations, please try again later',
      retryAfter: 3600, // 1 hour
    });
  },
});

/**
 * Extra strict rate limiter for SMS referrals
 * More restrictive due to SMS costs
 */
export const referralSmsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: isTestEnv ? 1000 : 5, // Only 5 SMS referrals per hour per IP
  message: {
    error: 'Too Many Requests',
    message: 'Too many SMS invitations, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: referralSmsStore,
  skip: () => isRateLimitDisabled,
  handler: (req, res) => {
    void trackBlockedRequest('referral-sms', req.ip, req.path, req.get('User-Agent'));
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many SMS invitations, please try again later',
      retryAfter: 3600, // 1 hour
    });
  },
});

/**
 * Rate limiter for invoice generation
 * Prevents abuse of PDF generation resources
 */
export const invoiceGenerateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: isTestEnv ? 1000 : 20, // 20 invoice generations per hour per IP
  message: {
    error: 'Too Many Requests',
    message: 'Too many invoice generation requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: invoiceGenerateStore,
  skip: () => isRateLimitDisabled,
  handler: (req, res) => {
    void trackBlockedRequest('invoice-generate', req.ip, req.path, req.get('User-Agent'));
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many invoice generation requests, please try again later',
      retryAfter: 3600, // 1 hour
    });
  },
});

/**
 * Rate limiter for invoice exports and downloads
 * Prevents abuse of resource-intensive export operations
 */
export const invoiceExportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute window
  max: isTestEnv ? 1000 : 30, // 30 export/download requests per 15 minutes per IP
  message: {
    error: 'Too Many Requests',
    message: 'Too many export requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: invoiceExportStore,
  skip: () => isRateLimitDisabled,
  handler: (req, res) => {
    void trackBlockedRequest('invoice-export', req.ip, req.path, req.get('User-Agent'));
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many export requests, please try again later',
      retryAfter: 900, // 15 minutes
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
  if (referralStore instanceof MemoryStore) referralStore.resetAll();
  if (referralSmsStore instanceof MemoryStore) referralSmsStore.resetAll();
  if (invoiceGenerateStore instanceof MemoryStore) invoiceGenerateStore.resetAll();
  if (invoiceExportStore instanceof MemoryStore) invoiceExportStore.resetAll();
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
    { name: 'referral', windowMs: 60 * 60 * 1000, maxRequests: 10 },
    { name: 'referral-sms', windowMs: 60 * 60 * 1000, maxRequests: 5 },
    { name: 'invoice-generate', windowMs: 60 * 60 * 1000, maxRequests: 20 },
    { name: 'invoice-export', windowMs: 15 * 60 * 1000, maxRequests: 30 },
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
      await redis.del(prefixKey(RATE_LIMIT_METRICS_KEY));
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
