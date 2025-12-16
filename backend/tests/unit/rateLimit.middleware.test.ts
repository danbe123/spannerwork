import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../src/config/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    RATE_LIMIT_WINDOW_MS: '60000',
    RATE_LIMIT_MAX: '100',
    RATE_LIMIT_AUTH_WINDOW_MS: '900000',
    RATE_LIMIT_AUTH_MAX: '5',
  },
}));

vi.mock('../../src/config/redis.js', () => ({
  redis: {
    del: vi.fn().mockResolvedValue(1),
    call: vi.fn().mockResolvedValue(1),
  },
  isRedisAvailable: vi.fn().mockReturnValue(false),
  safeHincrby: vi.fn().mockResolvedValue(1),
  safeHset: vi.fn().mockResolvedValue('OK'),
  safeHgetall: vi.fn().mockImplementation(async () => ({})),
}));

import {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  adminLimiter,
  geocodingLimiter,
  sensitiveLimiter,
  resetRateLimiters,
  getRateLimitMetrics,
  resetRateLimitMetrics,
  getTotalBlockedRequests,
} from '../../src/middleware/rateLimit.middleware.js';

describe('Rate Limit Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimiters();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('apiLimiter', () => {
    it('is defined as rate limiter middleware', () => {
      expect(apiLimiter).toBeDefined();
      expect(typeof apiLimiter).toBe('function');
    });
  });

  describe('authLimiter', () => {
    it('is defined as rate limiter middleware', () => {
      expect(authLimiter).toBeDefined();
      expect(typeof authLimiter).toBe('function');
    });
  });

  describe('uploadLimiter', () => {
    it('is defined as rate limiter middleware', () => {
      expect(uploadLimiter).toBeDefined();
      expect(typeof uploadLimiter).toBe('function');
    });
  });

  describe('adminLimiter', () => {
    it('is defined as rate limiter middleware', () => {
      expect(adminLimiter).toBeDefined();
      expect(typeof adminLimiter).toBe('function');
    });
  });

  describe('geocodingLimiter', () => {
    it('is defined as rate limiter middleware', () => {
      expect(geocodingLimiter).toBeDefined();
      expect(typeof geocodingLimiter).toBe('function');
    });
  });

  describe('sensitiveLimiter', () => {
    it('is defined as rate limiter middleware', () => {
      expect(sensitiveLimiter).toBeDefined();
      expect(typeof sensitiveLimiter).toBe('function');
    });
  });

  describe('resetRateLimiters', () => {
    it('resets all limiter stores without error', () => {
      expect(() => resetRateLimiters()).not.toThrow();
    });
  });

  describe('getRateLimitMetrics', () => {
    it('is defined as an async function', () => {
      expect(getRateLimitMetrics).toBeDefined();
      expect(typeof getRateLimitMetrics).toBe('function');
    });
  });

  describe('resetRateLimitMetrics', () => {
    it('is defined as an async function', () => {
      expect(resetRateLimitMetrics).toBeDefined();
      expect(typeof resetRateLimitMetrics).toBe('function');
    });
  });

  describe('getTotalBlockedRequests', () => {
    it('is defined as an async function', () => {
      expect(getTotalBlockedRequests).toBeDefined();
      expect(typeof getTotalBlockedRequests).toBe('function');
    });
  });
});
