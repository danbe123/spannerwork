import Redis from 'ioredis';
import { logger } from './logger.js';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Track Redis connection status for fallback behavior
let isRedisConnected = false;

// ============================================================================
// CIRCUIT BREAKER IMPLEMENTATION
// ============================================================================
// 
// The circuit breaker prevents cascading failures when Redis is unavailable.
// States:
// - CLOSED: Normal operation, all requests go through
// - OPEN: Redis is failing, skip all Redis operations (fast fail)
// - HALF_OPEN: Testing if Redis has recovered
//
// Transitions:
// - CLOSED -> OPEN: When failure threshold is reached
// - OPEN -> HALF_OPEN: After reset timeout expires
// - HALF_OPEN -> CLOSED: On successful request
// - HALF_OPEN -> OPEN: On failed request

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening circuit
  resetTimeout: number;        // Time in ms before trying again (OPEN -> HALF_OPEN)
  halfOpenRequests: number;    // Number of successful requests needed to close
}

const circuitConfig: CircuitBreakerConfig = {
  failureThreshold: 5,         // Open circuit after 5 failures
  resetTimeout: 30000,         // Wait 30 seconds before trying again
  halfOpenRequests: 3,         // Need 3 successful requests to close circuit
};

let circuitState = CircuitState.CLOSED;
let failureCount = 0;
let successCount = 0;
let lastFailureTime: number | null = null;
let circuitOpenedAt: number | null = null;

/**
 * Record a successful Redis operation
 */
function recordSuccess(): void {
  failureCount = 0;
  
  if (circuitState === CircuitState.HALF_OPEN) {
    successCount++;
    if (successCount >= circuitConfig.halfOpenRequests) {
      circuitState = CircuitState.CLOSED;
      successCount = 0;
      logger.info('🔌 Redis circuit breaker CLOSED - Redis recovered');
    }
  }
}

/**
 * Record a failed Redis operation
 */
function recordFailure(): void {
  failureCount++;
  lastFailureTime = Date.now();
  successCount = 0;
  
  if (circuitState === CircuitState.HALF_OPEN) {
    // Failed during test, reopen circuit
    circuitState = CircuitState.OPEN;
    circuitOpenedAt = Date.now();
    logger.warn('🔌 Redis circuit breaker OPEN - still failing during recovery test');
  } else if (circuitState === CircuitState.CLOSED && failureCount >= circuitConfig.failureThreshold) {
    circuitState = CircuitState.OPEN;
    circuitOpenedAt = Date.now();
    logger.warn(`🔌 Redis circuit breaker OPEN - ${failureCount} consecutive failures`);
  }
}

/**
 * Check if we should attempt a Redis operation
 */
function shouldAttemptOperation(): boolean {
  if (circuitState === CircuitState.CLOSED) {
    return true;
  }
  
  if (circuitState === CircuitState.OPEN) {
    // Check if reset timeout has passed
    if (circuitOpenedAt && Date.now() - circuitOpenedAt >= circuitConfig.resetTimeout) {
      circuitState = CircuitState.HALF_OPEN;
      successCount = 0;
      logger.info('🔌 Redis circuit breaker HALF_OPEN - testing connection');
      return true;
    }
    return false;
  }
  
  // HALF_OPEN - allow requests through for testing
  return true;
}

/**
 * Get current circuit breaker status (for health checks/debugging)
 */
export function getCircuitBreakerStatus(): {
  state: string;
  failureCount: number;
  lastFailureTime: number | null;
  isRedisConnected: boolean;
} {
  return {
    state: circuitState,
    failureCount,
    lastFailureTime,
    isRedisConnected,
  };
}

// ============================================================================
// REDIS CLIENT
// ============================================================================

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis retry attempt ${times}, next retry in ${delay}ms`);
    // Stop retrying after 10 attempts and allow fallback behavior
    if (times > 10) {
      logger.error('Redis max retries exceeded, operating in degraded mode');
      return null; // Stop retrying
    }
    return delay;
  },
  lazyConnect: false,
  enableOfflineQueue: true,
});

redis.on('connect', () => {
  isRedisConnected = true;
  logger.info('Redis client connected');
});

redis.on('ready', () => {
  isRedisConnected = true;
  // Reset circuit breaker on successful reconnection
  if (circuitState !== CircuitState.CLOSED) {
    circuitState = CircuitState.CLOSED;
    failureCount = 0;
    successCount = 0;
    logger.info('🔌 Redis circuit breaker CLOSED - connection restored');
  }
  logger.info('Redis client ready');
});

redis.on('error', (err) => {
  isRedisConnected = false;
  logger.error('Redis error:', err.message);
});

redis.on('close', () => {
  isRedisConnected = false;
  logger.warn('Redis connection closed');
});

redis.on('reconnecting', () => {
  logger.warn('Redis client reconnecting');
});

/**
 * Check if Redis is currently connected and circuit is not open
 */
export function isRedisAvailable(): boolean {
  return isRedisConnected && redis.status === 'ready' && shouldAttemptOperation();
}

/**
 * Safe Redis get with fallback and circuit breaker
 * Returns null if Redis is unavailable instead of throwing
 */
export async function safeGet(key: string): Promise<string | null> {
  if (!isRedisAvailable()) {
    logger.debug(`Redis unavailable (circuit: ${circuitState}), skipping get for key: ${key}`);
    return null;
  }
  try {
    const result = await redis.get(key);
    recordSuccess();
    return result;
  } catch (error) {
    logger.error(`Redis get error for key ${key}:`, error);
    recordFailure();
    return null;
  }
}

/**
 * Safe Redis setex with fallback and circuit breaker
 * Silently fails if Redis is unavailable
 */
export async function safeSetex(key: string, seconds: number, value: string): Promise<boolean> {
  if (!isRedisAvailable()) {
    logger.debug(`Redis unavailable (circuit: ${circuitState}), skipping setex for key: ${key}`);
    return false;
  }
  try {
    await redis.setex(key, seconds, value);
    recordSuccess();
    return true;
  } catch (error) {
    logger.error(`Redis setex error for key ${key}:`, error);
    recordFailure();
    return false;
  }
}

/**
 * Safe Redis del with fallback and circuit breaker
 * Silently fails if Redis is unavailable
 */
export async function safeDel(key: string): Promise<boolean> {
  if (!isRedisAvailable()) {
    logger.debug(`Redis unavailable (circuit: ${circuitState}), skipping del for key: ${key}`);
    return false;
  }
  try {
    await redis.del(key);
    recordSuccess();
    return true;
  } catch (error) {
    logger.error(`Redis del error for key ${key}:`, error);
    recordFailure();
    return false;
  }
}

/**
 * Safe Redis hincrby with fallback and circuit breaker
 * Increments a hash field by the given amount
 * Returns the new value or null if unavailable
 */
export async function safeHincrby(key: string, field: string, increment: number): Promise<number | null> {
  if (!isRedisAvailable()) {
    logger.debug(`Redis unavailable (circuit: ${circuitState}), skipping hincrby for key: ${key}`);
    return null;
  }
  try {
    const result = await redis.hincrby(key, field, increment);
    recordSuccess();
    return result;
  } catch (error) {
    logger.error(`Redis hincrby error for key ${key}:`, error);
    recordFailure();
    return null;
  }
}

/**
 * Safe Redis hset with fallback and circuit breaker
 * Sets hash field(s)
 */
export async function safeHset(key: string, field: string, value: string): Promise<boolean> {
  if (!isRedisAvailable()) {
    logger.debug(`Redis unavailable (circuit: ${circuitState}), skipping hset for key: ${key}`);
    return false;
  }
  try {
    await redis.hset(key, field, value);
    recordSuccess();
    return true;
  } catch (error) {
    logger.error(`Redis hset error for key ${key}:`, error);
    recordFailure();
    return false;
  }
}

/**
 * Safe Redis hgetall with fallback and circuit breaker
 * Returns all fields of a hash or empty object if unavailable
 */
export async function safeHgetall(key: string): Promise<Record<string, string>> {
  if (!isRedisAvailable()) {
    logger.debug(`Redis unavailable (circuit: ${circuitState}), skipping hgetall for key: ${key}`);
    return {};
  }
  try {
    const result = await redis.hgetall(key);
    recordSuccess();
    return result;
  } catch (error) {
    logger.error(`Redis hgetall error for key ${key}:`, error);
    recordFailure();
    return {};
  }
}

// Graceful shutdown
async function gracefulShutdown() {
  try {
    await redis.quit();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
  }
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export default redis;
