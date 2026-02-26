/**
 * Redis Caching Service
 *
 * Provides caching layer for frequently accessed data like listings.
 * Uses read-through caching pattern with TTL-based invalidation.
 */

import { safeGet, safeSetex, safeDel, isRedisAvailable, redis, prefixKey } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { Tool, Space, Service, User } from '@prisma/client';
import { recordMetric, incrementCounter } from './metrics.service.js';

// Type definitions for cached entities
type CachedTool = Tool & { owner?: Partial<User> };
type CachedSpace = Space & { owner?: Partial<User> };
type CachedService = Service & { provider?: Partial<User> };
type CachedUser = Partial<User>;
type CachedStats = Record<string, number | string | Date>;
type CachedListResult<T> = { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } };

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  LISTING_SHORT: 60,           // 1 minute - for frequently changing data
  LISTING_MEDIUM: 5 * 60,      // 5 minutes - for listing details
  LISTING_LONG: 15 * 60,       // 15 minutes - for list pages
  USER_PROFILE: 5 * 60,        // 5 minutes - for user profiles
  USER_RATING: 5 * 60,         // 5 minutes - for user ratings (rarely changes)
  STATS: 60,                   // 1 minute - for statistics
  ANALYTICS: 10 * 60,          // 10 minutes - for analytics dashboards
} as const;

// Cache key prefixes
export const CACHE_KEYS = {
  TOOL: 'tool',
  TOOL_LIST: 'tool:list',
  SPACE: 'space',
  SPACE_LIST: 'space:list',
  SERVICE: 'service',
  SERVICE_LIST: 'service:list',
  REQUEST: 'request',
  REQUEST_LIST: 'request:list',
  USER: 'user',
  USER_RATING: 'user:rating',
  STATS: 'stats',
  ANALYTICS: 'analytics',
} as const;

/**
 * Generic cache get with JSON parsing and hit/miss tracking
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisAvailable()) {
    incrementCounter('cache.unavailable');
    return null;
  }

  const startTime = Date.now();
  try {
    const cached = await safeGet(key);
    const duration = Date.now() - startTime;
    recordMetric('cache.get_latency', duration, { key: key.split(':')[0] });

    if (cached) {
      incrementCounter('cache.hit', 1, { prefix: key.split(':')[0] });
      return JSON.parse(cached) as T;
    }
    incrementCounter('cache.miss', 1, { prefix: key.split(':')[0] });
    return null;
  } catch (error) {
    incrementCounter('cache.error');
    logger.error(`Cache get error for key ${key}:`, error);
    return null;
  }
}

/**
 * Generic cache set with JSON serialization
 */
export async function cacheSet<T>(key: string, value: T, ttl: number): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const serialized = JSON.stringify(value);
    return await safeSetex(key, ttl, serialized);
  } catch (error) {
    logger.error(`Cache set error for key ${key}:`, error);
    return false;
  }
}

/**
 * Delete cache entry
 */
export async function cacheDelete(key: string): Promise<boolean> {
  return safeDel(key);
}

/**
 * Delete cache entries matching a pattern using SCAN (production-safe)
 */
export async function cacheDeleteByPrefix(prefix: string): Promise<number> {
  if (!isRedisAvailable()) {
    return 0;
  }

  try {
    let cursor = '0';
    let deletedCount = 0;
    const pattern = prefixKey(`${prefix}:*`);

    do {
      // Use SCAN instead of KEYS for production safety
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== '0');

    if (deletedCount > 0) {
      logger.debug(`Cache invalidation: deleted ${deletedCount} keys for prefix: ${prefix}`);
    }
    return deletedCount;
  } catch (error) {
    logger.error(`Cache delete by prefix error for ${prefix}:`, error);
    return 0;
  }
}

/**
 * Cache decorator for tool listings
 */
export class ListingCache {
  /**
   * Get cached tool by ID
   */
  static async getTool(id: string): Promise<CachedTool | null> {
    const key = `${CACHE_KEYS.TOOL}:${id}`;
    return cacheGet<CachedTool>(key);
  }

  /**
   * Cache tool by ID
   */
  static async setTool(id: string, tool: CachedTool): Promise<void> {
    const key = `${CACHE_KEYS.TOOL}:${id}`;
    await cacheSet(key, tool, CACHE_TTL.LISTING_MEDIUM);
  }

  /**
   * Invalidate cached tool
   */
  static async invalidateTool(id: string): Promise<void> {
    const key = `${CACHE_KEYS.TOOL}:${id}`;
    await cacheDelete(key);
    // Also invalidate list caches that might contain this tool
    await cacheDeleteByPrefix(CACHE_KEYS.TOOL_LIST);
  }

  /**
   * Get cached space by ID
   */
  static async getSpace(id: string): Promise<CachedSpace | null> {
    const key = `${CACHE_KEYS.SPACE}:${id}`;
    return cacheGet<CachedSpace>(key);
  }

  /**
   * Cache space by ID
   */
  static async setSpace(id: string, space: CachedSpace): Promise<void> {
    const key = `${CACHE_KEYS.SPACE}:${id}`;
    await cacheSet(key, space, CACHE_TTL.LISTING_MEDIUM);
  }

  /**
   * Invalidate cached space
   */
  static async invalidateSpace(id: string): Promise<void> {
    const key = `${CACHE_KEYS.SPACE}:${id}`;
    await cacheDelete(key);
    await cacheDeleteByPrefix(CACHE_KEYS.SPACE_LIST);
  }

  /**
   * Get cached service by ID
   */
  static async getService(id: string): Promise<CachedService | null> {
    const key = `${CACHE_KEYS.SERVICE}:${id}`;
    return cacheGet<CachedService>(key);
  }

  /**
   * Cache service by ID
   */
  static async setService(id: string, service: CachedService): Promise<void> {
    const key = `${CACHE_KEYS.SERVICE}:${id}`;
    await cacheSet(key, service, CACHE_TTL.LISTING_MEDIUM);
  }

  /**
   * Invalidate cached service
   */
  static async invalidateService(id: string): Promise<void> {
    const key = `${CACHE_KEYS.SERVICE}:${id}`;
    await cacheDelete(key);
    await cacheDeleteByPrefix(CACHE_KEYS.SERVICE_LIST);
  }

  /**
   * Get cached list results with hash-based key
   */
  static async getList<T>(prefix: string, queryHash: string): Promise<CachedListResult<T> | null> {
    const key = `${prefix}:${queryHash}`;
    return cacheGet<CachedListResult<T>>(key);
  }

  /**
   * Cache list results
   */
  static async setList<T>(prefix: string, queryHash: string, results: CachedListResult<T>): Promise<void> {
    const key = `${prefix}:${queryHash}`;
    await cacheSet(key, results, CACHE_TTL.LISTING_LONG);
  }

  /**
   * Create hash from query parameters for cache key
   */
  static createQueryHash(params: Record<string, unknown>): string {
    const sorted = Object.keys(params)
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join('&');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < sorted.length; i++) {
      const char = sorted.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * User profile cache
 */
export class UserCache {
  static async getProfile(id: string): Promise<CachedUser | null> {
    const key = `${CACHE_KEYS.USER}:${id}`;
    return cacheGet<CachedUser>(key);
  }

  static async setProfile(id: string, profile: CachedUser): Promise<void> {
    const key = `${CACHE_KEYS.USER}:${id}`;
    await cacheSet(key, profile, CACHE_TTL.USER_PROFILE);
  }

  static async invalidateProfile(id: string): Promise<void> {
    const key = `${CACHE_KEYS.USER}:${id}`;
    await cacheDelete(key);
  }
}

/**
 * User rating cache - caches aggregate rating data
 */
export interface CachedUserRating {
  rating: number;
  reviewCount: number;
  cachedAt: number;
}

export class UserRatingCache {
  static async get(userId: string): Promise<CachedUserRating | null> {
    const key = `${CACHE_KEYS.USER_RATING}:${userId}`;
    return cacheGet<CachedUserRating>(key);
  }

  static async set(userId: string, rating: number, reviewCount: number): Promise<void> {
    const key = `${CACHE_KEYS.USER_RATING}:${userId}`;
    const data: CachedUserRating = {
      rating,
      reviewCount,
      cachedAt: Date.now(),
    };
    await cacheSet(key, data, CACHE_TTL.USER_RATING);
  }

  static async invalidate(userId: string): Promise<void> {
    const key = `${CACHE_KEYS.USER_RATING}:${userId}`;
    await cacheDelete(key);
  }
}

/**
 * Analytics cache - for expensive aggregate queries
 */
export class AnalyticsCache {
  static async get<T>(key: string): Promise<T | null> {
    const cacheKey = `${CACHE_KEYS.ANALYTICS}:${key}`;
    return cacheGet<T>(cacheKey);
  }

  static async set(key: string, data: unknown): Promise<void> {
    const cacheKey = `${CACHE_KEYS.ANALYTICS}:${key}`;
    await cacheSet(cacheKey, data, CACHE_TTL.ANALYTICS);
  }

  static async invalidate(key: string): Promise<void> {
    const cacheKey = `${CACHE_KEYS.ANALYTICS}:${key}`;
    await cacheDelete(cacheKey);
  }

  static async invalidateAll(): Promise<void> {
    await cacheDeleteByPrefix(CACHE_KEYS.ANALYTICS);
  }
}

/**
 * Stats cache
 */
export class StatsCache {
  static async get(key: string): Promise<CachedStats | null> {
    const cacheKey = `${CACHE_KEYS.STATS}:${key}`;
    return cacheGet<CachedStats>(cacheKey);
  }

  static async set(key: string, stats: CachedStats): Promise<void> {
    const cacheKey = `${CACHE_KEYS.STATS}:${key}`;
    await cacheSet(cacheKey, stats, CACHE_TTL.STATS);
  }
}

export default {
  cacheGet,
  cacheSet,
  cacheDelete,
  ListingCache,
  UserCache,
  UserRatingCache,
  AnalyticsCache,
  StatsCache,
};
