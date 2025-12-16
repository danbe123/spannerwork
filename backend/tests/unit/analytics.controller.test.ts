import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Hoist mock
const mockAnalyticsService = vi.hoisted(() => ({
  getOverviewMetrics: vi.fn(),
  parseDateRange: vi.fn(),
  getRevenueTimeSeries: vi.fn(),
  getUserGrowthTimeSeries: vi.fn(),
  getListingTrends: vi.fn(),
  getCategoryBreakdown: vi.fn(),
  getGeographicDistribution: vi.fn(),
  getConversionFunnel: vi.fn(),
  getTopProviders: vi.fn(),
  getTopEarners: vi.fn(),
  clearAnalyticsCache: vi.fn(),
  snapshotDailyMetrics: vi.fn(),
}));

vi.mock('../../src/services/analytics.service.js', () => ({
  default: mockAnalyticsService,
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  getOverview,
  getRevenue,
  getUserGrowth,
  getListingTrends,
  getCategoryBreakdown,
  getGeographicDistribution,
  getConversionFunnel,
  getTopPerformers,
  clearCache,
  triggerSnapshot,
} from '../../src/controllers/analytics.controller.js';

describe('AnalyticsController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('getOverview', () => {
    it('should return overview metrics', async () => {
      const mockMetrics = { totalUsers: 100, totalGMV: 50000 };
      mockAnalyticsService.getOverviewMetrics.mockResolvedValue(mockMetrics);

      mockReq = {};

      await getOverview(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAnalyticsService.getOverviewMetrics).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockMetrics,
      });
    });

    it('should call next on error', async () => {
      const error = new Error('Database error');
      mockAnalyticsService.getOverviewMetrics.mockRejectedValue(error);

      mockReq = {};

      await getOverview(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getRevenue', () => {
    it('should return revenue time series', async () => {
      const mockRange = { startDate: new Date(), endDate: new Date() };
      const mockData = [{ date: '2024-01-01', gmv: 1000, platformFee: 50, transactionCount: 5 }];
      
      mockAnalyticsService.parseDateRange.mockReturnValue(mockRange);
      mockAnalyticsService.getRevenueTimeSeries.mockResolvedValue(mockData);

      mockReq = { query: { startDate: '2024-01-01', endDate: '2024-01-31' } };

      await getRevenue(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAnalyticsService.parseDateRange).toHaveBeenCalled();
      expect(mockAnalyticsService.getRevenueTimeSeries).toHaveBeenCalledWith(mockRange);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          timeSeries: mockData,
          totals: expect.any(Object),
        }),
      }));
    });
  });

  describe('getUserGrowth', () => {
    it('should return user growth time series', async () => {
      const mockRange = { startDate: new Date(), endDate: new Date() };
      const mockData = [{ date: '2024-01-01', newUsers: 10, totalUsers: 100 }];
      
      mockAnalyticsService.parseDateRange.mockReturnValue(mockRange);
      mockAnalyticsService.getUserGrowthTimeSeries.mockResolvedValue(mockData);

      mockReq = { query: {} };

      await getUserGrowth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });

  describe('getListingTrends', () => {
    it('should return listing trends', async () => {
      const mockRange = { startDate: new Date(), endDate: new Date() };
      const mockData = [{ date: '2024-01-01', tools: 5, spaces: 3, services: 2, requests: 10 }];
      
      mockAnalyticsService.parseDateRange.mockReturnValue(mockRange);
      mockAnalyticsService.getListingTrends.mockResolvedValue(mockData);

      mockReq = { query: {} };

      await getListingTrends(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });

  describe('getCategoryBreakdown', () => {
    it('should return category breakdown', async () => {
      const mockData = [{ category: 'TOOLS', count: 50 }];
      mockAnalyticsService.getCategoryBreakdown.mockResolvedValue(mockData);

      mockReq = {};

      await getCategoryBreakdown(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockData,
      });
    });
  });

  describe('getGeographicDistribution', () => {
    it('should return geographic distribution', async () => {
      const mockData = [{ region: 'London', count: 100 }];
      mockAnalyticsService.getGeographicDistribution.mockResolvedValue(mockData);

      mockReq = {};

      await getGeographicDistribution(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockData,
      });
    });
  });

  describe('getConversionFunnel', () => {
    it('should return conversion funnel with rates', async () => {
      const mockData = {
        totalSignups: 100,
        profileCompleted: 80,
        firstListingCreated: 40,
        firstTransactionCompleted: 20,
        repeatCustomers: 10,
      };
      mockAnalyticsService.getConversionFunnel.mockResolvedValue(mockData);

      mockReq = {};

      await getConversionFunnel(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          funnel: mockData,
          conversionRates: expect.any(Object),
        },
      });
    });
  });

  describe('getTopPerformers', () => {
    it('should return top providers and earners', async () => {
      const mockProviders = [{ id: 'user-1', name: 'Provider 1' }];
      const mockEarners = [{ id: 'user-2', name: 'Earner 1' }];
      
      mockAnalyticsService.getTopProviders.mockResolvedValue(mockProviders);
      mockAnalyticsService.getTopEarners.mockResolvedValue(mockEarners);

      mockReq = { query: { limit: '10' } };

      await getTopPerformers(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          topProviders: mockProviders,
          topEarners: mockEarners,
        },
      });
    });

    it('should cap limit at 50', async () => {
      mockAnalyticsService.getTopProviders.mockResolvedValue([]);
      mockAnalyticsService.getTopEarners.mockResolvedValue([]);

      mockReq = { query: { limit: '100' } };

      await getTopPerformers(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAnalyticsService.getTopProviders).toHaveBeenCalledWith(50);
    });
  });

  describe('clearCache', () => {
    it('should clear analytics cache', async () => {
      mockAnalyticsService.clearAnalyticsCache.mockResolvedValue(undefined);

      mockReq = {};

      await clearCache(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAnalyticsService.clearAnalyticsCache).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Analytics cache cleared',
      });
    });
  });

  describe('triggerSnapshot', () => {
    it('should trigger daily metrics snapshot', async () => {
      mockAnalyticsService.snapshotDailyMetrics.mockResolvedValue(undefined);

      mockReq = {};

      await triggerSnapshot(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAnalyticsService.snapshotDailyMetrics).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Daily metrics snapshot created',
      });
    });
  });
});
