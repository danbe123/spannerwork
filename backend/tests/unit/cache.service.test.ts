import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Redis before importing cache service
vi.mock('../../src/config/redis.js', () => ({
  safeGet: vi.fn(),
  safeSetex: vi.fn(),
  safeDel: vi.fn(),
  isRedisAvailable: vi.fn(() => true),
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeleteByPrefix,
  ListingCache,
  UserCache,
  StatsCache,
  CACHE_TTL,
  CACHE_KEYS,
} from '../../src/services/cache.service.js';
import { safeGet, safeSetex, safeDel, isRedisAvailable } from '../../src/config/redis.js';
import { logger } from '../../src/config/logger.js';

describe('Cache Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isRedisAvailable).mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('CACHE_TTL constants', () => {
    it('has correct TTL values', () => {
      expect(CACHE_TTL.LISTING_SHORT).toBe(60);
      expect(CACHE_TTL.LISTING_MEDIUM).toBe(300);
      expect(CACHE_TTL.LISTING_LONG).toBe(900);
      expect(CACHE_TTL.USER_PROFILE).toBe(300);
      expect(CACHE_TTL.STATS).toBe(60);
    });
  });

  describe('CACHE_KEYS constants', () => {
    it('has correct key prefixes', () => {
      expect(CACHE_KEYS.TOOL).toBe('tool');
      expect(CACHE_KEYS.TOOL_LIST).toBe('tool:list');
      expect(CACHE_KEYS.SPACE).toBe('space');
      expect(CACHE_KEYS.SPACE_LIST).toBe('space:list');
      expect(CACHE_KEYS.SERVICE).toBe('service');
      expect(CACHE_KEYS.SERVICE_LIST).toBe('service:list');
      expect(CACHE_KEYS.REQUEST).toBe('request');
      expect(CACHE_KEYS.REQUEST_LIST).toBe('request:list');
      expect(CACHE_KEYS.USER).toBe('user');
      expect(CACHE_KEYS.STATS).toBe('stats');
    });
  });

  describe('cacheGet', () => {
    it('returns parsed JSON when value exists', async () => {
      const testData = { id: '1', name: 'Test Tool' };
      vi.mocked(safeGet).mockResolvedValue(JSON.stringify(testData));

      const result = await cacheGet<typeof testData>('test-key');

      expect(safeGet).toHaveBeenCalledWith('test-key');
      expect(result).toEqual(testData);
    });

    it('returns null when value does not exist', async () => {
      vi.mocked(safeGet).mockResolvedValue(null);

      const result = await cacheGet('test-key');

      expect(result).toBeNull();
    });

    it('returns null when Redis is not available', async () => {
      vi.mocked(isRedisAvailable).mockReturnValue(false);

      const result = await cacheGet('test-key');

      expect(result).toBeNull();
      expect(safeGet).not.toHaveBeenCalled();
    });

    it('returns null and logs error on parse error', async () => {
      vi.mocked(safeGet).mockResolvedValue('invalid json{');

      const result = await cacheGet('test-key');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('cacheSet', () => {
    it('sets JSON stringified value with TTL', async () => {
      const testData = { id: '1', name: 'Test' };
      vi.mocked(safeSetex).mockResolvedValue(true);

      const result = await cacheSet('test-key', testData, 300);

      expect(safeSetex).toHaveBeenCalledWith('test-key', 300, JSON.stringify(testData));
      expect(result).toBe(true);
    });

    it('returns false when Redis is not available', async () => {
      vi.mocked(isRedisAvailable).mockReturnValue(false);

      const result = await cacheSet('test-key', { data: 'test' }, 300);

      expect(result).toBe(false);
      expect(safeSetex).not.toHaveBeenCalled();
    });

    it('returns false and logs error on failure', async () => {
      vi.mocked(safeSetex).mockRejectedValue(new Error('Redis error'));

      const result = await cacheSet('test-key', { data: 'test' }, 300);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('cacheDelete', () => {
    it('deletes key from cache', async () => {
      vi.mocked(safeDel).mockResolvedValue(true);

      const result = await cacheDelete('test-key');

      expect(safeDel).toHaveBeenCalledWith('test-key');
      expect(result).toBe(true);
    });
  });

  describe('cacheDeleteByPrefix', () => {
    it('logs the invalidation request', async () => {
      await cacheDeleteByPrefix('tool:');

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cache invalidation requested')
      );
    });
  });

  describe('ListingCache', () => {
    describe('getTool', () => {
      it('gets tool from cache with correct key', async () => {
        const tool = { id: 'tool-1', name: 'Power Drill' };
        vi.mocked(safeGet).mockResolvedValue(JSON.stringify(tool));

        const result = await ListingCache.getTool('tool-1');

        expect(safeGet).toHaveBeenCalledWith('tool:tool-1');
        expect(result).toEqual(tool);
      });
    });

    describe('setTool', () => {
      it('sets tool in cache with LISTING_MEDIUM TTL', async () => {
        const tool = { id: 'tool-1', name: 'Power Drill' };
        vi.mocked(safeSetex).mockResolvedValue(true);

        await ListingCache.setTool('tool-1', tool);

        expect(safeSetex).toHaveBeenCalledWith(
          'tool:tool-1',
          CACHE_TTL.LISTING_MEDIUM,
          JSON.stringify(tool)
        );
      });
    });

    describe('invalidateTool', () => {
      it('deletes tool from cache', async () => {
        vi.mocked(safeDel).mockResolvedValue(true);

        await ListingCache.invalidateTool('tool-1');

        expect(safeDel).toHaveBeenCalledWith('tool:tool-1');
      });
    });

    describe('getSpace', () => {
      it('gets space from cache with correct key', async () => {
        const space = { id: 'space-1', name: 'Workshop' };
        vi.mocked(safeGet).mockResolvedValue(JSON.stringify(space));

        const result = await ListingCache.getSpace('space-1');

        expect(safeGet).toHaveBeenCalledWith('space:space-1');
        expect(result).toEqual(space);
      });
    });

    describe('setSpace', () => {
      it('sets space in cache with LISTING_MEDIUM TTL', async () => {
        const space = { id: 'space-1', name: 'Workshop' };
        vi.mocked(safeSetex).mockResolvedValue(true);

        await ListingCache.setSpace('space-1', space);

        expect(safeSetex).toHaveBeenCalledWith(
          'space:space-1',
          CACHE_TTL.LISTING_MEDIUM,
          JSON.stringify(space)
        );
      });
    });

    describe('invalidateSpace', () => {
      it('deletes space from cache', async () => {
        vi.mocked(safeDel).mockResolvedValue(true);

        await ListingCache.invalidateSpace('space-1');

        expect(safeDel).toHaveBeenCalledWith('space:space-1');
      });
    });

    describe('getService', () => {
      it('gets service from cache with correct key', async () => {
        const service = { id: 'service-1', name: 'Plumbing' };
        vi.mocked(safeGet).mockResolvedValue(JSON.stringify(service));

        const result = await ListingCache.getService('service-1');

        expect(safeGet).toHaveBeenCalledWith('service:service-1');
        expect(result).toEqual(service);
      });
    });

    describe('setService', () => {
      it('sets service in cache with LISTING_MEDIUM TTL', async () => {
        const service = { id: 'service-1', name: 'Plumbing' };
        vi.mocked(safeSetex).mockResolvedValue(true);

        await ListingCache.setService('service-1', service);

        expect(safeSetex).toHaveBeenCalledWith(
          'service:service-1',
          CACHE_TTL.LISTING_MEDIUM,
          JSON.stringify(service)
        );
      });
    });

    describe('invalidateService', () => {
      it('deletes service from cache', async () => {
        vi.mocked(safeDel).mockResolvedValue(true);

        await ListingCache.invalidateService('service-1');

        expect(safeDel).toHaveBeenCalledWith('service:service-1');
      });
    });

    describe('getList', () => {
      it('gets list from cache with prefix and hash', async () => {
        const list = [{ id: '1' }, { id: '2' }];
        vi.mocked(safeGet).mockResolvedValue(JSON.stringify(list));

        const result = await ListingCache.getList('tool:list', 'abc123');

        expect(safeGet).toHaveBeenCalledWith('tool:list:abc123');
        expect(result).toEqual(list);
      });
    });

    describe('setList', () => {
      it('sets list in cache with LISTING_LONG TTL', async () => {
        const list = [{ id: '1' }, { id: '2' }];
        vi.mocked(safeSetex).mockResolvedValue(true);

        await ListingCache.setList('tool:list', 'abc123', list);

        expect(safeSetex).toHaveBeenCalledWith(
          'tool:list:abc123',
          CACHE_TTL.LISTING_LONG,
          JSON.stringify(list)
        );
      });
    });

    describe('createQueryHash', () => {
      it('creates consistent hash for same params', () => {
        const params = { category: 'tools', page: 1 };
        
        const hash1 = ListingCache.createQueryHash(params);
        const hash2 = ListingCache.createQueryHash(params);

        expect(hash1).toBe(hash2);
      });

      it('creates same hash regardless of param order', () => {
        const params1 = { category: 'tools', page: 1 };
        const params2 = { page: 1, category: 'tools' };

        const hash1 = ListingCache.createQueryHash(params1);
        const hash2 = ListingCache.createQueryHash(params2);

        expect(hash1).toBe(hash2);
      });

      it('creates different hashes for different params', () => {
        const params1 = { category: 'tools' };
        const params2 = { category: 'spaces' };

        const hash1 = ListingCache.createQueryHash(params1);
        const hash2 = ListingCache.createQueryHash(params2);

        expect(hash1).not.toBe(hash2);
      });

      it('handles empty params', () => {
        const hash = ListingCache.createQueryHash({});
        expect(hash).toBeDefined();
        expect(typeof hash).toBe('string');
      });
    });
  });

  describe('UserCache', () => {
    describe('getProfile', () => {
      it('gets user profile from cache', async () => {
        const profile = { id: 'user-1', name: 'John Doe' };
        vi.mocked(safeGet).mockResolvedValue(JSON.stringify(profile));

        const result = await UserCache.getProfile('user-1');

        expect(safeGet).toHaveBeenCalledWith('user:user-1');
        expect(result).toEqual(profile);
      });
    });

    describe('setProfile', () => {
      it('sets user profile with USER_PROFILE TTL', async () => {
        const profile = { id: 'user-1', name: 'John Doe' };
        vi.mocked(safeSetex).mockResolvedValue(true);

        await UserCache.setProfile('user-1', profile);

        expect(safeSetex).toHaveBeenCalledWith(
          'user:user-1',
          CACHE_TTL.USER_PROFILE,
          JSON.stringify(profile)
        );
      });
    });

    describe('invalidateProfile', () => {
      it('deletes user profile from cache', async () => {
        vi.mocked(safeDel).mockResolvedValue(true);

        await UserCache.invalidateProfile('user-1');

        expect(safeDel).toHaveBeenCalledWith('user:user-1');
      });
    });
  });

  describe('StatsCache', () => {
    describe('get', () => {
      it('gets stats from cache', async () => {
        const stats = { totalUsers: 100, totalListings: 50 };
        vi.mocked(safeGet).mockResolvedValue(JSON.stringify(stats));

        const result = await StatsCache.get('global');

        expect(safeGet).toHaveBeenCalledWith('stats:global');
        expect(result).toEqual(stats);
      });
    });

    describe('set', () => {
      it('sets stats with STATS TTL', async () => {
        const stats = { totalUsers: 100, totalListings: 50 };
        vi.mocked(safeSetex).mockResolvedValue(true);

        await StatsCache.set('global', stats);

        expect(safeSetex).toHaveBeenCalledWith(
          'stats:global',
          CACHE_TTL.STATS,
          JSON.stringify(stats)
        );
      });
    });
  });
});
