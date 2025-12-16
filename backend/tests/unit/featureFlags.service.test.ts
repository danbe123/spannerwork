import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../src/config/redis.js', () => ({
  safeGet: vi.fn(),
  safeSetex: vi.fn(),
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { FeatureFlagsService } from '../../src/services/featureFlags.service.js';
import { safeGet, safeSetex } from '../../src/config/redis.js';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FeatureFlagsService();
    service.clearCache();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getFlag', () => {
    it('should return flag from local cache if not expired', async () => {
      // First call to populate cache
      vi.mocked(safeGet).mockResolvedValue(
        JSON.stringify({ name: 'test_flag', enabled: true, percentage: 100 })
      );

      await service.getFlag('test_flag');

      // Second call should use cache
      vi.mocked(safeGet).mockClear();
      const result = await service.getFlag('test_flag');

      expect(safeGet).not.toHaveBeenCalled();
      expect(result?.enabled).toBe(true);
    });

    it('should return flag from Redis if not in cache', async () => {
      vi.mocked(safeGet).mockResolvedValue(
        JSON.stringify({ name: 'redis_flag', enabled: true, percentage: 50 })
      );

      const result = await service.getFlag('redis_flag');

      expect(safeGet).toHaveBeenCalledWith('feature-flag:redis_flag');
      expect(result?.name).toBe('redis_flag');
      expect(result?.enabled).toBe(true);
    });

    it('should return default flag if not in Redis', async () => {
      vi.mocked(safeGet).mockResolvedValue(null);

      const result = await service.getFlag('real_time_messaging');

      expect(result?.enabled).toBe(true);
      expect(result?.percentage).toBe(100);
    });

    it('should return null for unknown flag', async () => {
      vi.mocked(safeGet).mockResolvedValue(null);

      const result = await service.getFlag('unknown_flag');

      expect(result).toBeNull();
    });
  });

  describe('isEnabled', () => {
    it('should return false for unknown flag', async () => {
      vi.mocked(safeGet).mockResolvedValue(null);

      const result = await service.isEnabled('unknown_flag');

      expect(result).toBe(false);
    });

    it('should return false for disabled flag', async () => {
      vi.mocked(safeGet).mockResolvedValue(
        JSON.stringify({ name: 'disabled_flag', enabled: false })
      );

      const result = await service.isEnabled('disabled_flag');

      expect(result).toBe(false);
    });

    it('should return true for enabled flag with 100% rollout', async () => {
      vi.mocked(safeGet).mockResolvedValue(
        JSON.stringify({ name: 'enabled_flag', enabled: true, percentage: 100 })
      );

      const result = await service.isEnabled('enabled_flag');

      expect(result).toBe(true);
    });

    it('should return false if flag not started yet', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
      vi.mocked(safeGet).mockResolvedValue(
        JSON.stringify({
          name: 'future_flag',
          enabled: true,
          percentage: 100,
          startDate: futureDate,
        })
      );

      const result = await service.isEnabled('future_flag');

      expect(result).toBe(false);
    });

    it('should return false if flag ended', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday
      vi.mocked(safeGet).mockResolvedValue(
        JSON.stringify({
          name: 'past_flag',
          enabled: true,
          percentage: 100,
          endDate: pastDate,
        })
      );

      const result = await service.isEnabled('past_flag');

      expect(result).toBe(false);
    });

    it('should return false if user is blocked', async () => {
      vi.mocked(safeGet).mockResolvedValue(
        JSON.stringify({
          name: 'blocked_flag',
          enabled: true,
          percentage: 100,
          blockedUsers: ['blocked-user'],
        })
      );

      const result = await service.isEnabled('blocked_flag', 'blocked-user');

      expect(result).toBe(false);
    });

    it('should return true if user is explicitly allowed', async () => {
      vi.mocked(safeGet).mockResolvedValue(
        JSON.stringify({
          name: 'allowed_flag',
          enabled: true,
          percentage: 0,
          allowedUsers: ['allowed-user'],
        })
      );

      const result = await service.isEnabled('allowed_flag', 'allowed-user');

      expect(result).toBe(true);
    });

    it('should use deterministic hash for percentage rollout', async () => {
      vi.mocked(safeGet).mockResolvedValue(
        JSON.stringify({
          name: 'partial_flag',
          enabled: true,
          percentage: 50,
        })
      );

      // Same user should get same result
      const result1 = await service.isEnabled('partial_flag', 'user-123');
      const result2 = await service.isEnabled('partial_flag', 'user-123');

      expect(result1).toBe(result2);
    });
  });

  describe('setFlag', () => {
    it('should save flag to Redis and update cache', async () => {
      vi.mocked(safeSetex).mockResolvedValue();

      const flag = {
        name: 'new_flag',
        enabled: true,
        percentage: 75,
        description: 'Test flag',
      };

      await service.setFlag(flag);

      expect(safeSetex).toHaveBeenCalledWith(
        'feature-flag:new_flag',
        3600,
        JSON.stringify(flag)
      );
    });
  });

  describe('enable', () => {
    it('should enable a flag for all users', async () => {
      vi.mocked(safeGet).mockResolvedValue(
        JSON.stringify({ name: 'test_flag', enabled: false, percentage: 0 })
      );
      vi.mocked(safeSetex).mockResolvedValue();

      await service.enable('test_flag');

      expect(safeSetex).toHaveBeenCalledWith(
        'feature-flag:test_flag',
        3600,
        expect.stringContaining('"enabled":true')
      );
    });

    it('should throw error for unknown flag', async () => {
      vi.mocked(safeGet).mockResolvedValue(null);

      await expect(service.enable('unknown_flag')).rejects.toThrow(
        'Feature flag unknown_flag not found'
      );
    });
  });

  describe('disable', () => {
    it('should disable a flag', async () => {
      vi.mocked(safeGet).mockResolvedValue(
        JSON.stringify({ name: 'test_flag', enabled: true, percentage: 100 })
      );
      vi.mocked(safeSetex).mockResolvedValue();

      await service.disable('test_flag');

      expect(safeSetex).toHaveBeenCalledWith(
        'feature-flag:test_flag',
        3600,
        expect.stringContaining('"enabled":false')
      );
    });
  });

  describe('setRolloutPercentage', () => {
    it('should set rollout percentage', async () => {
      vi.mocked(safeGet).mockResolvedValue(
        JSON.stringify({ name: 'test_flag', enabled: false, percentage: 0 })
      );
      vi.mocked(safeSetex).mockResolvedValue();

      await service.setRolloutPercentage('test_flag', 25);

      expect(safeSetex).toHaveBeenCalledWith(
        'feature-flag:test_flag',
        3600,
        expect.stringContaining('"percentage":25')
      );
    });

    it('should throw error for invalid percentage', async () => {
      await expect(service.setRolloutPercentage('test_flag', -10)).rejects.toThrow(
        'Percentage must be between 0 and 100'
      );

      await expect(service.setRolloutPercentage('test_flag', 150)).rejects.toThrow(
        'Percentage must be between 0 and 100'
      );
    });
  });

  describe('getAllFlags', () => {
    it('should return all default flags', async () => {
      vi.mocked(safeGet).mockResolvedValue(null);

      const flags = await service.getAllFlags();

      expect(flags.length).toBeGreaterThan(0);
      expect(flags.some((f) => f.name === 'real_time_messaging')).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear local cache', async () => {
      // Populate cache
      vi.mocked(safeGet).mockResolvedValue(
        JSON.stringify({ name: 'cached_flag', enabled: true })
      );
      await service.getFlag('cached_flag');

      service.clearCache();

      // Should fetch from Redis again
      await service.getFlag('cached_flag');

      expect(safeGet).toHaveBeenCalledTimes(2);
    });
  });
});
