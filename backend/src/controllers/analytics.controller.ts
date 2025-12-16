/**
 * Analytics Controller
 * 
 * Handles admin analytics API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import analyticsService from '../services/analytics.service.js';
import { logger } from '../config/logger.js';

/**
 * GET /api/admin/analytics/overview
 * Get dashboard overview metrics
 */
export async function getOverview(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const metrics = await analyticsService.getOverviewMetrics();
    
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error('Failed to get overview metrics:', error);
    next(error);
  }
}

/**
 * GET /api/admin/analytics/revenue
 * Get revenue time series data
 */
export async function getRevenue(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { startDate, endDate } = req.query;
    const range = analyticsService.parseDateRange(
      startDate as string | undefined,
      endDate as string | undefined,
      30
    );
    
    const data = await analyticsService.getRevenueTimeSeries(range);
    
    // Calculate totals
    const totals = data.reduce(
      (acc, d) => ({
        gmv: acc.gmv + d.gmv,
        platformFee: acc.platformFee + d.platformFee,
        transactionCount: acc.transactionCount + d.transactionCount,
      }),
      { gmv: 0, platformFee: 0, transactionCount: 0 }
    );
    
    res.json({
      success: true,
      data: {
        timeSeries: data,
        totals,
        range: {
          startDate: range.startDate.toISOString(),
          endDate: range.endDate.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get revenue data:', error);
    next(error);
  }
}

/**
 * GET /api/admin/analytics/users
 * Get user growth time series data
 */
export async function getUserGrowth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { startDate, endDate } = req.query;
    const range = analyticsService.parseDateRange(
      startDate as string | undefined,
      endDate as string | undefined,
      30
    );
    
    const data = await analyticsService.getUserGrowthTimeSeries(range);
    
    // Calculate totals
    const totalNewUsers = data.reduce((acc, d) => acc + d.newUsers, 0);
    const latestTotal = data[data.length - 1]?.totalUsers || 0;
    
    res.json({
      success: true,
      data: {
        timeSeries: data,
        totals: {
          newUsers: totalNewUsers,
          totalUsers: latestTotal,
        },
        range: {
          startDate: range.startDate.toISOString(),
          endDate: range.endDate.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get user growth data:', error);
    next(error);
  }
}

/**
 * GET /api/admin/analytics/listings
 * Get listing trends time series data
 */
export async function getListingTrends(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { startDate, endDate } = req.query;
    const range = analyticsService.parseDateRange(
      startDate as string | undefined,
      endDate as string | undefined,
      30
    );
    
    const data = await analyticsService.getListingTrends(range);
    
    // Calculate totals
    const totals = data.reduce(
      (acc, d) => ({
        tools: acc.tools + d.tools,
        spaces: acc.spaces + d.spaces,
        services: acc.services + d.services,
        requests: acc.requests + d.requests,
      }),
      { tools: 0, spaces: 0, services: 0, requests: 0 }
    );
    
    res.json({
      success: true,
      data: {
        timeSeries: data,
        totals,
        range: {
          startDate: range.startDate.toISOString(),
          endDate: range.endDate.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get listing trends:', error);
    next(error);
  }
}

/**
 * GET /api/admin/analytics/categories
 * Get category breakdown
 */
export async function getCategoryBreakdown(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await analyticsService.getCategoryBreakdown();
    
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Failed to get category breakdown:', error);
    next(error);
  }
}

/**
 * GET /api/admin/analytics/geographic
 * Get geographic distribution
 */
export async function getGeographicDistribution(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await analyticsService.getGeographicDistribution();
    
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Failed to get geographic distribution:', error);
    next(error);
  }
}

/**
 * GET /api/admin/analytics/funnel
 * Get conversion funnel metrics
 */
export async function getConversionFunnel(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await analyticsService.getConversionFunnel();
    
    // Calculate conversion rates
    const rates = {
      signupToProfile: data.totalSignups > 0 
        ? ((data.profileCompleted / data.totalSignups) * 100).toFixed(1) 
        : '0',
      profileToListing: data.profileCompleted > 0 
        ? ((data.firstListingCreated / data.profileCompleted) * 100).toFixed(1) 
        : '0',
      signupToTransaction: data.totalSignups > 0 
        ? ((data.firstTransactionCompleted / data.totalSignups) * 100).toFixed(1) 
        : '0',
      transactionToRepeat: data.firstTransactionCompleted > 0 
        ? ((data.repeatCustomers / data.firstTransactionCompleted) * 100).toFixed(1) 
        : '0',
    };
    
    res.json({
      success: true,
      data: {
        funnel: data,
        conversionRates: rates,
      },
    });
  } catch (error) {
    logger.error('Failed to get conversion funnel:', error);
    next(error);
  }
}

/**
 * GET /api/admin/analytics/top-performers
 * Get top providers and earners
 */
export async function getTopPerformers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    
    const [topProviders, topEarners] = await Promise.all([
      analyticsService.getTopProviders(limit),
      analyticsService.getTopEarners(limit),
    ]);
    
    res.json({
      success: true,
      data: {
        topProviders,
        topEarners,
      },
    });
  } catch (error) {
    logger.error('Failed to get top performers:', error);
    next(error);
  }
}

/**
 * POST /api/admin/analytics/cache/clear
 * Clear analytics cache (admin only)
 */
export async function clearCache(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await analyticsService.clearAnalyticsCache();
    
    res.json({
      success: true,
      message: 'Analytics cache cleared',
    });
  } catch (error) {
    logger.error('Failed to clear analytics cache:', error);
    next(error);
  }
}

/**
 * POST /api/admin/analytics/snapshot
 * Manually trigger daily metrics snapshot (admin only)
 */
export async function triggerSnapshot(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await analyticsService.snapshotDailyMetrics();
    
    res.json({
      success: true,
      message: 'Daily metrics snapshot created',
    });
  } catch (error) {
    logger.error('Failed to create metrics snapshot:', error);
    next(error);
  }
}

export default {
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
};
