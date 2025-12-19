/**
 * Analytics Service
 * 
 * Provides platform-wide analytics for admin dashboard:
 * - Revenue and GMV tracking
 * - User growth and retention
 * - Listing and transaction trends
 * - Geographic distribution
 * - Conversion funnel analysis
 */

import { prisma } from '../config/database.js';
import { redis, isRedisAvailable } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { subDays, startOfDay, endOfDay, format, eachDayOfInterval } from 'date-fns';

// Cache keys
const CACHE_PREFIX = 'analytics';
const CACHE_TTL = 300; // 5 minutes

// Types
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface OverviewMetrics {
  totalUsers: number;
  totalListings: number;
  totalTransactions: number;
  totalGmv: number; // In pence
  platformRevenue: number; // In pence
  activeUsers24h: number;
  newUsersToday: number;
  pendingDisputes: number;
}

export interface RevenueDataPoint {
  date: string;
  gmv: number;
  platformFee: number;
  transactionCount: number;
}

export interface UserGrowthDataPoint {
  date: string;
  newUsers: number;
  totalUsers: number;
}

export interface ListingTrendsDataPoint {
  date: string;
  tools: number;
  spaces: number;
  services: number;
  requests: number;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  revenue: number;
}

export interface GeographicDataPoint {
  region: string; // First part of postcode (e.g., "SW", "M", "B")
  userCount: number;
  listingCount: number;
  transactionCount: number;
}

export interface ConversionFunnel {
  totalSignups: number;
  profileCompleted: number;
  firstListingCreated: number;
  firstBookingMade: number;
  firstTransactionCompleted: number;
  repeatCustomers: number;
}

export interface RetentionCohort {
  cohortMonth: string;
  totalUsers: number;
  week1: number;
  week2: number;
  week4: number;
  week8: number;
  week12: number;
}

export interface TopPerformer {
  id: string;
  name: string;
  avatar?: string;
  metric: number;
  metricLabel: string;
}

// Helper: Get cached data or compute
async function getCachedOrCompute<T>(
  key: string,
  computeFn: () => Promise<T>,
  ttl: number = CACHE_TTL
): Promise<T> {
  if (isRedisAvailable()) {
    try {
      const cached = await redis.get(`${CACHE_PREFIX}:${key}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.warn('Cache read error:', error);
    }
  }

  const result = await computeFn();

  if (isRedisAvailable()) {
    try {
      await redis.setex(`${CACHE_PREFIX}:${key}`, ttl, JSON.stringify(result));
    } catch (error) {
      logger.warn('Cache write error:', error);
    }
  }

  return result;
}

// Helper: Parse date range from query params
export function parseDateRange(
  startDate?: string,
  endDate?: string,
  defaultDays: number = 30
): DateRange {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : subDays(end, defaultDays);
  
  return {
    startDate: startOfDay(start),
    endDate: endOfDay(end),
  };
}

// Helper: Extract postcode region (e.g., "SW1A 1AA" -> "SW")
function extractPostcodeRegion(postcode: string): string {
  const match = postcode.match(/^([A-Z]{1,2})/i);
  return match ? match[1].toUpperCase() : 'UNKNOWN';
}

/**
 * Get overview metrics for dashboard header
 */
export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  return getCachedOrCompute('overview', async () => {
    const now = new Date();
    const todayStart = startOfDay(now);

    const [
      totalUsers,
      totalTools,
      totalSpaces,
      totalServices,
      totalTransactions,
      revenueAgg,
      activeUsers24h,
      newUsersToday,
      pendingDisputes,
    ] = await Promise.all([
      prisma.user.count({ where: { accountStatus: 'ACTIVE' } }),
      prisma.tool.count(),
      prisma.space.count(),
      prisma.service.count(),
      prisma.transaction.count({ where: { status: 'COMPLETED' } }),
      prisma.transaction.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { totalAmount: true, platformFee: true },
      }),
      prisma.session.count({
        where: { expiresAt: { gt: now } },
      }),
      prisma.user.count({
        where: { createdDate: { gte: todayStart } },
      }),
      prisma.dispute.count({
        where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      }),
    ]);

    return {
      totalUsers,
      totalListings: totalTools + totalSpaces + totalServices,
      totalTransactions,
      totalGmv: revenueAgg._sum.totalAmount || 0,
      platformRevenue: revenueAgg._sum.platformFee || 0,
      activeUsers24h,
      newUsersToday,
      pendingDisputes,
    };
  });
}

/**
 * Get revenue data over time
 */
export async function getRevenueTimeSeries(
  range: DateRange
): Promise<RevenueDataPoint[]> {
  const cacheKey = `revenue:${format(range.startDate, 'yyyy-MM-dd')}:${format(range.endDate, 'yyyy-MM-dd')}`;
  
  return getCachedOrCompute(cacheKey, async () => {
    const transactions = await prisma.transaction.findMany({
      where: {
        status: 'COMPLETED',
        completedDate: {
          gte: range.startDate,
          lte: range.endDate,
        },
      },
      select: {
        completedDate: true,
        totalAmount: true,
        platformFee: true,
      },
    });

    // Group by date
    const byDate: Record<string, { gmv: number; platformFee: number; count: number }> = {};
    
    // Initialize all dates in range
    const allDates = eachDayOfInterval({ start: range.startDate, end: range.endDate });
    allDates.forEach((date: Date) => {
      const key = format(date, 'yyyy-MM-dd');
      byDate[key] = { gmv: 0, platformFee: 0, count: 0 };
    });

    // Aggregate transactions
    transactions.forEach(t => {
      if (t.completedDate) {
        const key = format(t.completedDate, 'yyyy-MM-dd');
        if (byDate[key]) {
          byDate[key].gmv += t.totalAmount;
          byDate[key].platformFee += t.platformFee;
          byDate[key].count += 1;
        }
      }
    });

    return Object.entries(byDate)
      .map(([date, data]) => ({
        date,
        gmv: data.gmv,
        platformFee: data.platformFee,
        transactionCount: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  });
}

/**
 * Get user growth over time
 */
export async function getUserGrowthTimeSeries(
  range: DateRange
): Promise<UserGrowthDataPoint[]> {
  const cacheKey = `users:${format(range.startDate, 'yyyy-MM-dd')}:${format(range.endDate, 'yyyy-MM-dd')}`;
  
  return getCachedOrCompute(cacheKey, async () => {
    // Get all users created up to end date
    const users = await prisma.user.findMany({
      where: {
        createdDate: { lte: range.endDate },
        accountStatus: 'ACTIVE',
      },
      select: { createdDate: true },
      orderBy: { createdDate: 'asc' },
    });

    // Count users before start date
    const usersBeforeStart = users.filter(u => u.createdDate < range.startDate).length;
    
    // Group new users by date
    const allDates = eachDayOfInterval({ start: range.startDate, end: range.endDate });
    let runningTotal = usersBeforeStart;
    
    return allDates.map((date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      
      const newUsers = users.filter(
        u => u.createdDate >= dayStart && u.createdDate <= dayEnd
      ).length;
      
      runningTotal += newUsers;
      
      return {
        date: dateStr,
        newUsers,
        totalUsers: runningTotal,
      };
    });
  });
}

/**
 * Get listing creation trends
 */
export async function getListingTrends(
  range: DateRange
): Promise<ListingTrendsDataPoint[]> {
  const cacheKey = `listings:${format(range.startDate, 'yyyy-MM-dd')}:${format(range.endDate, 'yyyy-MM-dd')}`;
  
  return getCachedOrCompute(cacheKey, async () => {
    const [tools, spaces, services, requests] = await Promise.all([
      prisma.tool.findMany({
        where: { createdDate: { gte: range.startDate, lte: range.endDate } },
        select: { createdDate: true },
      }),
      prisma.space.findMany({
        where: { createdDate: { gte: range.startDate, lte: range.endDate } },
        select: { createdDate: true },
      }),
      prisma.service.findMany({
        where: { createdDate: { gte: range.startDate, lte: range.endDate } },
        select: { createdDate: true },
      }),
      prisma.request.findMany({
        where: { createdDate: { gte: range.startDate, lte: range.endDate } },
        select: { createdDate: true },
      }),
    ]);

    const allDates = eachDayOfInterval({ start: range.startDate, end: range.endDate });
    
    return allDates.map((date: Date) => {
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      
      return {
        date: format(date, 'yyyy-MM-dd'),
        tools: tools.filter(t => t.createdDate >= dayStart && t.createdDate <= dayEnd).length,
        spaces: spaces.filter(s => s.createdDate >= dayStart && s.createdDate <= dayEnd).length,
        services: services.filter(s => s.createdDate >= dayStart && s.createdDate <= dayEnd).length,
        requests: requests.filter(r => r.createdDate >= dayStart && r.createdDate <= dayEnd).length,
      };
    });
  });
}

/**
 * Get category breakdown for pie charts
 */
export async function getCategoryBreakdown(): Promise<CategoryBreakdown[]> {
  return getCachedOrCompute('categories', async () => {
    const [toolCount, spaceCount, serviceCount] = await Promise.all([
      prisma.tool.count(),
      prisma.space.count(),
      prisma.service.count(),
    ]);

    const [toolRevenue, spaceRevenue, serviceRevenue] = await Promise.all([
      prisma.transaction.aggregate({
        where: { toolId: { not: null }, status: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
      prisma.transaction.aggregate({
        where: { spaceId: { not: null }, status: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
      prisma.transaction.aggregate({
        where: { serviceId: { not: null }, status: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
    ]);

    return [
      { category: 'Tools', count: toolCount, revenue: toolRevenue._sum.totalAmount || 0 },
      { category: 'Spaces', count: spaceCount, revenue: spaceRevenue._sum.totalAmount || 0 },
      { category: 'Services', count: serviceCount, revenue: serviceRevenue._sum.totalAmount || 0 },
    ];
  });
}

/**
 * Get geographic distribution
 */
export async function getGeographicDistribution(): Promise<GeographicDataPoint[]> {
  return getCachedOrCompute('geographic', async () => {
    const [users, tools, spaces, services, transactions] = await Promise.all([
      prisma.user.findMany({
        where: { postcode: { not: null }, accountStatus: 'ACTIVE' },
        select: { postcode: true },
      }),
      prisma.tool.findMany({ select: { postcode: true } }),
      prisma.space.findMany({ select: { postcode: true } }),
      prisma.service.findMany({ select: { postcode: true } }),
      prisma.transaction.findMany({
        where: { status: 'COMPLETED' },
        include: { tool: { select: { postcode: true } } },
      }),
    ]);

    // Aggregate by region
    const regions: Record<string, GeographicDataPoint> = {};

    const addToRegion = (postcode: string | null, type: 'user' | 'listing' | 'transaction') => {
      if (!postcode) return;
      const region = extractPostcodeRegion(postcode);
      if (!regions[region]) {
        regions[region] = { region, userCount: 0, listingCount: 0, transactionCount: 0 };
      }
      if (type === 'user') regions[region].userCount++;
      if (type === 'listing') regions[region].listingCount++;
      if (type === 'transaction') regions[region].transactionCount++;
    };

    users.forEach(u => addToRegion(u.postcode, 'user'));
    tools.forEach(t => addToRegion(t.postcode, 'listing'));
    spaces.forEach(s => addToRegion(s.postcode, 'listing'));
    services.forEach(s => addToRegion(s.postcode, 'listing'));
    transactions.forEach(t => addToRegion(t.tool?.postcode || null, 'transaction'));

    return Object.values(regions)
      .sort((a, b) => b.userCount - a.userCount)
      .slice(0, 20); // Top 20 regions
  });
}

/**
 * Get conversion funnel metrics
 */
export async function getConversionFunnel(): Promise<ConversionFunnel> {
  return getCachedOrCompute('funnel', async () => {
    const [
      totalSignups,
      profileCompleted,
      usersWithListings,
      usersWithBookings,
      usersWithCompletedTransactions,
      repeatCustomers,
    ] = await Promise.all([
      // Total signups
      prisma.user.count({ where: { accountStatus: 'ACTIVE' } }),
      
      // Profile completed (has name, postcode, and avatar)
      prisma.user.count({
        where: {
          accountStatus: 'ACTIVE',
          name: { not: null },
          postcode: { not: null },
        },
      }),
      
      // Users with at least one listing
      prisma.user.count({
        where: {
          accountStatus: 'ACTIVE',
          OR: [
            { tools: { some: {} } },
            { spaces: { some: {} } },
            { services: { some: {} } },
          ],
        },
      }),
      
      // Users with at least one transaction
      prisma.user.count({
        where: {
          accountStatus: 'ACTIVE',
          transactions: { some: {} },
        },
      }),
      
      // Users with completed transaction
      prisma.user.count({
        where: {
          accountStatus: 'ACTIVE',
          transactions: { some: { status: 'COMPLETED' } },
        },
      }),
      
      // Repeat customers (2+ completed transactions)
      prisma.user.findMany({
        where: {
          accountStatus: 'ACTIVE',
          transactions: { some: { status: 'COMPLETED' } },
        },
        select: {
          _count: { select: { transactions: { where: { status: 'COMPLETED' } } } },
        },
      }).then(users => users.filter(u => u._count.transactions >= 2).length),
    ]);

    return {
      totalSignups,
      profileCompleted,
      firstListingCreated: usersWithListings,
      firstBookingMade: usersWithBookings,
      firstTransactionCompleted: usersWithCompletedTransactions,
      repeatCustomers,
    };
  });
}

/**
 * Get top performers (providers/renters)
 */
export async function getTopProviders(limit: number = 10): Promise<TopPerformer[]> {
  return getCachedOrCompute(`top-providers:${limit}`, async () => {
    const providers = await prisma.user.findMany({
      where: {
        accountStatus: 'ACTIVE',
        transactionsAsProvider: { some: { status: 'COMPLETED' } },
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        _count: {
          select: { transactionsAsProvider: { where: { status: 'COMPLETED' } } },
        },
      },
      orderBy: {
        transactionsAsProvider: { _count: 'desc' },
      },
      take: limit,
    });

    return providers.map(p => ({
      id: p.id,
      name: p.name || 'Anonymous',
      avatar: p.avatar || undefined,
      metric: p._count.transactionsAsProvider,
      metricLabel: 'completed rentals',
    }));
  });
}

/**
 * Get top earners
 */
export async function getTopEarners(limit: number = 10): Promise<TopPerformer[]> {
  return getCachedOrCompute(`top-earners:${limit}`, async () => {
    // Aggregate earnings by provider
    const earnings = await prisma.transaction.groupBy({
      by: ['providerId'],
      where: {
        status: 'COMPLETED',
        providerId: { not: null },
      },
      _sum: { rentalFee: true },
      orderBy: { _sum: { rentalFee: 'desc' } },
      take: limit,
    });

    // Fetch user details
    const userIds = earnings.map(e => e.providerId).filter(Boolean) as string[];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatar: true },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    return earnings.map(e => {
      const user = userMap.get(e.providerId || '');
      return {
        id: e.providerId || '',
        name: user?.name || 'Anonymous',
        avatar: user?.avatar || undefined,
        metric: e._sum.rentalFee || 0,
        metricLabel: 'total earnings (pence)',
      };
    });
  });
}

/**
 * Snapshot daily metrics (run via scheduler)
 */
export async function snapshotDailyMetrics(): Promise<void> {
  const today = startOfDay(new Date());
  
  // Check if snapshot already exists
  const existing = await prisma.dailyMetrics.findUnique({
    where: { date: today },
  });
  
  if (existing) {
    logger.info('Daily metrics snapshot already exists for today');
    return;
  }

  const [
    totalUsers,
    newUsers,
    activeUsers,
    totalListings,
    totalBookings,
    revenue,
  ] = await Promise.all([
    prisma.user.count({ where: { accountStatus: 'ACTIVE' } }),
    prisma.user.count({
      where: { createdDate: { gte: today } },
    }),
    prisma.session.count({
      where: { expiresAt: { gt: new Date() } },
    }),
    Promise.all([
      prisma.tool.count(),
      prisma.space.count(),
      prisma.service.count(),
    ]).then(counts => counts.reduce((a, b) => a + b, 0)),
    prisma.transaction.count(),
    prisma.transaction.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { totalAmount: true, platformFee: true },
    }),
  ]);

  await prisma.dailyMetrics.create({
    data: {
      date: today,
      totalUsers,
      newUsers,
      activeUsers,
      totalListings,
      totalBookings,
      gmv: revenue._sum.totalAmount || 0,
      platformRevenue: revenue._sum.platformFee || 0,
    },
  });

  logger.info('Daily metrics snapshot created');
}

/**
 * Clear analytics cache
 */
export async function clearAnalyticsCache(): Promise<void> {
  if (!isRedisAvailable()) return;
  
  try {
    const keys = await redis.keys(`${CACHE_PREFIX}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    logger.info(`Cleared ${keys.length} analytics cache entries`);
  } catch (error) {
    logger.error('Failed to clear analytics cache:', error);
  }
}

export default {
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
};
