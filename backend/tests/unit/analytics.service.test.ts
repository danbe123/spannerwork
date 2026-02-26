import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../src/config/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/config/redis.js', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    keys: vi.fn(),
    del: vi.fn(),
  },
  isRedisAvailable: vi.fn().mockReturnValue(false),
  safeGet: vi.fn().mockResolvedValue(null),
  safeSetex: vi.fn().mockResolvedValue('OK'),
}));

// Hoist prisma mocks
const mockPrisma = vi.hoisted(() => ({
  user: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  session: {
    count: vi.fn(),
  },
  tool: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  space: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  service: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  request: {
    findMany: vi.fn(),
  },
  transaction: {
    count: vi.fn(),
    aggregate: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
  dispute: {
    count: vi.fn(),
  },
  dailyMetric: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  $queryRaw: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: mockPrisma,
}));

import {
  parseDateRange,
  getOverviewMetrics,
  getRevenueTimeSeries,
  getUserGrowthTimeSeries,
  getListingTrends,
  getCategoryBreakdown,
  getGeographicDistribution,
  getConversionFunnel,
  getTopProviders,
  getTopEarners,
  snapshotDailyMetrics,
  clearAnalyticsCache,
} from '../../src/services/analytics.service.js';
import { logger } from '../../src/config/logger.js';
import { redis, isRedisAvailable } from '../../src/config/redis.js';

describe('Analytics Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mocks
    mockPrisma.user.count.mockResolvedValue(100);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.session.count.mockResolvedValue(50);
    mockPrisma.tool.count.mockResolvedValue(200);
    mockPrisma.tool.findMany.mockResolvedValue([]);
    mockPrisma.space.count.mockResolvedValue(50);
    mockPrisma.space.findMany.mockResolvedValue([]);
    mockPrisma.service.count.mockResolvedValue(75);
    mockPrisma.service.findMany.mockResolvedValue([]);
    mockPrisma.request.findMany.mockResolvedValue([]);
    mockPrisma.transaction.count.mockResolvedValue(500);
    mockPrisma.transaction.aggregate.mockResolvedValue({
      _sum: { totalAmount: 5000000, platformFee: 250000 },
    });
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    mockPrisma.transaction.groupBy.mockResolvedValue([]);
    mockPrisma.dispute.count.mockResolvedValue(5);
    // Mock $queryRaw for raw SQL queries
    mockPrisma.$queryRaw.mockResolvedValue([
      { date: new Date('2024-01-02'), count: BigInt(10) },
      { date: new Date('2024-01-03'), count: BigInt(5) },
    ]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('parseDateRange', () => {
    it('should return default 30-day range when no dates provided', () => {
      const result = parseDateRange();
      
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
      
      // startOfDay to endOfDay spans 30 days plus the partial day overlap
      const diffDays = Math.round(
        (result.endDate.getTime() - result.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      // Allow for 30 or 31 due to startOfDay/endOfDay boundary
      expect(diffDays).toBeGreaterThanOrEqual(30);
      expect(diffDays).toBeLessThanOrEqual(31);
    });

    it('should parse provided date strings', () => {
      const result = parseDateRange('2024-01-01', '2024-01-31');
      
      expect(result.startDate.getFullYear()).toBe(2024);
      expect(result.startDate.getMonth()).toBe(0); // January
      expect(result.startDate.getDate()).toBe(1);
    });

    it('should use custom default days', () => {
      const result = parseDateRange(undefined, undefined, 7);
      
      const diffDays = Math.round(
        (result.endDate.getTime() - result.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      // Allow for 7 or 8 due to startOfDay/endOfDay boundary
      expect(diffDays).toBeGreaterThanOrEqual(7);
      expect(diffDays).toBeLessThanOrEqual(8);
    });
  });

  describe('getOverviewMetrics', () => {
    it('should return overview metrics', async () => {
      const result = await getOverviewMetrics();

      expect(result).toHaveProperty('totalUsers');
      expect(result).toHaveProperty('totalListings');
      expect(result).toHaveProperty('totalTransactions');
      expect(result).toHaveProperty('totalGmv');
      expect(result).toHaveProperty('platformRevenue');
      expect(result).toHaveProperty('activeUsers24h');
      expect(result).toHaveProperty('newUsersToday');
      expect(result).toHaveProperty('pendingDisputes');
    });

    it('should calculate totalListings as sum of tools, spaces, services', async () => {
      mockPrisma.tool.count.mockResolvedValue(100);
      mockPrisma.space.count.mockResolvedValue(50);
      mockPrisma.service.count.mockResolvedValue(30);

      const result = await getOverviewMetrics();

      expect(result.totalListings).toBe(180);
    });

    it('should get revenue from completed transactions', async () => {
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { totalAmount: 1000000, platformFee: 50000 },
      });

      const result = await getOverviewMetrics();

      expect(result.totalGmv).toBe(1000000);
      expect(result.platformRevenue).toBe(50000);
    });

    it('should handle null aggregate results', async () => {
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { totalAmount: null, platformFee: null },
      });

      const result = await getOverviewMetrics();

      expect(result.totalGmv).toBe(0);
      expect(result.platformRevenue).toBe(0);
    });
  });

  describe('getRevenueTimeSeries', () => {
    it('should return revenue data grouped by date', async () => {
      const range = parseDateRange('2024-01-01', '2024-01-07');
      mockPrisma.transaction.findMany.mockResolvedValue([
        { completedDate: new Date('2024-01-02'), totalAmount: 10000, platformFee: 500 },
        { completedDate: new Date('2024-01-02'), totalAmount: 20000, platformFee: 1000 },
        { completedDate: new Date('2024-01-04'), totalAmount: 15000, platformFee: 750 },
      ]);

      const result = await getRevenueTimeSeries(range);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(7); // 7 days
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('gmv');
      expect(result[0]).toHaveProperty('platformFee');
      expect(result[0]).toHaveProperty('transactionCount');
    });

    it('should return zeros for days with no transactions', async () => {
      const range = parseDateRange('2024-01-01', '2024-01-03');
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      const result = await getRevenueTimeSeries(range);

      result.forEach(day => {
        expect(day.gmv).toBe(0);
        expect(day.platformFee).toBe(0);
        expect(day.transactionCount).toBe(0);
      });
    });
  });

  describe('getUserGrowthTimeSeries', () => {
    it('should return user growth data with running totals', async () => {
      const range = parseDateRange('2024-01-01', '2024-01-07');
      mockPrisma.user.findMany.mockResolvedValue([
        { createdDate: new Date('2024-01-02') },
        { createdDate: new Date('2024-01-02') },
        { createdDate: new Date('2024-01-05') },
      ]);

      const result = await getUserGrowthTimeSeries(range);

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('newUsers');
      expect(result[0]).toHaveProperty('totalUsers');
    });
  });

  describe('getListingTrends', () => {
    it('should return listing creation trends by category', async () => {
      const range = parseDateRange('2024-01-01', '2024-01-07');

      const result = await getListingTrends(range);

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('tools');
      expect(result[0]).toHaveProperty('spaces');
      expect(result[0]).toHaveProperty('services');
      expect(result[0]).toHaveProperty('requests');
    });
  });

  describe('getCategoryBreakdown', () => {
    it('should return listing and revenue breakdown by category', async () => {
      mockPrisma.tool.count.mockResolvedValue(100);
      mockPrisma.space.count.mockResolvedValue(50);
      mockPrisma.service.count.mockResolvedValue(25);
      mockPrisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { totalAmount: 500000 } })
        .mockResolvedValueOnce({ _sum: { totalAmount: 300000 } })
        .mockResolvedValueOnce({ _sum: { totalAmount: 200000 } });

      const result = await getCategoryBreakdown();

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('category');
      expect(result[0]).toHaveProperty('count');
      expect(result[0]).toHaveProperty('revenue');
    });
  });

  describe('getGeographicDistribution', () => {
    it('should return geographic data grouped by postcode area', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { postcode: 'SW1A 1AA' },
        { postcode: 'SW1A 2AA' },
        { postcode: 'M1 1AA' },
      ]);
      mockPrisma.tool.findMany.mockResolvedValue([
        { postcode: 'SW1A 1AA' },
      ]);
      mockPrisma.space.findMany.mockResolvedValue([]);
      mockPrisma.service.findMany.mockResolvedValue([]);
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      const result = await getGeographicDistribution();

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('region');
      expect(result[0]).toHaveProperty('userCount');
      expect(result[0]).toHaveProperty('listingCount');
      expect(result[0]).toHaveProperty('transactionCount');
    });

    it('should extract postcode area correctly', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { postcode: 'SW1A 1AA' }, // SW
        { postcode: 'M1 1AA' },    // M
        { postcode: 'B12 8QQ' },   // B
      ]);
      mockPrisma.tool.findMany.mockResolvedValue([]);
      mockPrisma.space.findMany.mockResolvedValue([]);
      mockPrisma.service.findMany.mockResolvedValue([]);
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      const result = await getGeographicDistribution();
      const regions = result.map(r => r.region);

      expect(regions).toContain('SW');
      expect(regions).toContain('M');
      expect(regions).toContain('B');
    });
  });

  describe('getConversionFunnel', () => {
    it('should return funnel metrics', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(1000)  // totalSignups
        .mockResolvedValueOnce(800)   // profileCompleted
        .mockResolvedValueOnce(300)   // usersWithListings
        .mockResolvedValueOnce(500)   // usersWithBookings
        .mockResolvedValueOnce(200);  // usersWithCompletedTransactions
      mockPrisma.user.findMany.mockResolvedValue([
        { _count: { transactions: 3 } },
        { _count: { transactions: 2 } },
      ]);

      const result = await getConversionFunnel();

      expect(result).toHaveProperty('totalSignups');
      expect(result).toHaveProperty('profileCompleted');
      expect(result).toHaveProperty('firstListingCreated');
      expect(result).toHaveProperty('firstBookingMade');
      expect(result).toHaveProperty('firstTransactionCompleted');
      expect(result).toHaveProperty('repeatCustomers');
    });
  });

  describe('getTopProviders', () => {
    it('should return top providers by transaction count', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u1', name: 'Provider 1', avatar: null, _count: { transactionsAsProvider: 50 } },
        { id: 'u2', name: 'Provider 2', avatar: null, _count: { transactionsAsProvider: 30 } },
      ]);

      const result = await getTopProviders(10);

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('metric');
      expect(result[0]).toHaveProperty('metricLabel');
    });

    it('should respect limit parameter', async () => {
      await getTopProviders(5);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });
  });

  describe('getTopEarners', () => {
    it('should return top earners by total earnings', async () => {
      mockPrisma.transaction.groupBy.mockResolvedValue([
        { providerId: 'u1', _sum: { rentalFee: 100000 } },
        { providerId: 'u2', _sum: { rentalFee: 75000 } },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u1', name: 'Earner 1', avatar: null },
        { id: 'u2', name: 'Earner 2', avatar: null },
      ]);

      const result = await getTopEarners(10);

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('metric');
    });
  });

  describe('snapshotDailyMetrics', () => {
    it('should create a daily metrics snapshot', async () => {
      mockPrisma.dailyMetric.findUnique.mockResolvedValue(null);
      mockPrisma.dailyMetric.create.mockResolvedValue({ id: 'dm1' });

      await snapshotDailyMetrics();

      expect(mockPrisma.dailyMetric.create).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Daily metrics snapshot created');
    });

    it('should skip if snapshot already exists for today', async () => {
      mockPrisma.dailyMetric.findUnique.mockResolvedValue({ id: 'existing' });

      await snapshotDailyMetrics();

      expect(mockPrisma.dailyMetric.create).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Daily metrics snapshot already exists for today');
    });
  });

  describe('clearAnalyticsCache', () => {
    it('should clear all analytics cache keys when redis available', async () => {
      vi.mocked(isRedisAvailable).mockReturnValue(true);
      vi.mocked(redis.keys).mockResolvedValue(['analytics:key1', 'analytics:key2']);
      vi.mocked(redis.del).mockResolvedValue(2);

      await clearAnalyticsCache();

      expect(redis.keys).toHaveBeenCalledWith('analytics:*');
      expect(redis.del).toHaveBeenCalledWith('analytics:key1', 'analytics:key2');
      expect(logger.info).toHaveBeenCalledWith('Cleared 2 analytics cache entries');
    });

    it('should do nothing when redis not available', async () => {
      vi.mocked(isRedisAvailable).mockReturnValue(false);

      await clearAnalyticsCache();

      expect(redis.keys).not.toHaveBeenCalled();
    });
  });
});
