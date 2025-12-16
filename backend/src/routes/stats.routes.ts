import { Router, Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

const router = Router();

/**
 * GET /api/v1/stats
 * Get public platform statistics for landing page
 * @public
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    // Run queries in parallel for better performance
    const [
      totalUsers,
      activeRequests,
      totalTools,
      completedTransactions,
    ] = await Promise.all([
      prisma.user.count({
        where: {
          accountStatus: 'ACTIVE',
        },
      }),
      prisma.request.count({
        where: {
          status: 'ACTIVE',
        },
      }),
      prisma.tool.count({
        where: {
          available: true,
        },
      }),
      prisma.transaction.count({
        where: {
          status: 'COMPLETED',
        },
      }),
    ]);

    // Calculate some derived stats
    const totalListings = await Promise.all([
      prisma.tool.count(),
      prisma.space.count(),
      prisma.service.count(),
    ]).then(counts => counts.reduce((sum, count) => sum + count, 0));

    const avgRating = await prisma.review.aggregate({
      _avg: {
        rating: true,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: totalUsers,
        },
        requests: {
          active: activeRequests,
        },
        listings: {
          total: totalListings,
          tools: totalTools,
        },
        transactions: {
          completed: completedTransactions,
        },
        platform: {
          averageRating: avgRating._avg.rating?.toFixed(1) || '5.0',
          trustScore: '4.8', // Could be calculated based on reviews, disputes, etc.
        },
      },
    });
  } catch (error) {
    logger.error('Stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: 'Unable to retrieve platform statistics',
    });
  }
});

/**
 * GET /api/v1/stats/detailed
 * Get detailed platform statistics (for admin/analytics)
 * @public (could add auth for admin-only access)
 */
router.get('/detailed', async (_req: Request, res: Response) => {
  try {
    const [
      userStats,
      requestStats,
      transactionStats,
      reviewStats,
    ] = await Promise.all([
      // User stats
      prisma.user.groupBy({
        by: ['accountStatus'],
        _count: true,
      }),
      // Request stats by status
      prisma.request.groupBy({
        by: ['status'],
        _count: true,
      }),
      // Transaction stats by status
      prisma.transaction.groupBy({
        by: ['status'],
        _count: true,
      }),
      // Review stats
      prisma.review.aggregate({
        _avg: {
          rating: true,
        },
        _count: true,
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: userStats,
        requests: requestStats,
        transactions: transactionStats,
        reviews: {
          total: reviewStats._count,
          averageRating: reviewStats._avg.rating,
        },
      },
    });
  } catch (error) {
    logger.error('Detailed stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: 'Unable to retrieve detailed statistics',
    });
  }
});

/**
 * GET /api/v1/stats/market-insights
 * Get market insights for the Feed page
 * @public
 */
router.get('/market-insights', async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      jobsToday,
      categoryStats,
      avgResponseTime,
    ] = await Promise.all([
      // Jobs posted today
      prisma.request.count({
        where: {
          status: 'ACTIVE',
          createdDate: {
            gte: today,
          },
        },
      }),
      // Most active category (by active requests)
      prisma.request.groupBy({
        by: ['category'],
        where: {
          status: 'ACTIVE',
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 1,
      }),
      // Average time to first offer (in minutes) for transactions in last 30 days
      // This measures how quickly providers respond to requests
      prisma.$queryRaw<{ avg_minutes: number }[]>`
        SELECT
          COALESCE(
            AVG(EXTRACT(EPOCH FROM (t."createdDate" - r."createdDate")) / 60),
            47
          ) as avg_minutes
        FROM "Transaction" t
        JOIN "Request" r ON t."requestId" = r.id
        WHERE t."createdDate" > NOW() - INTERVAL '30 days'
        AND r."createdDate" IS NOT NULL
      `,
    ]);

    // Get most active category name
    const mostActiveCategory = categoryStats[0]?.category || 'Tools';

    // Get average response time in minutes
    const responseTimeMinutes = avgResponseTime[0]?.avg_minutes
      ? Math.round(avgResponseTime[0].avg_minutes)
      : 47; // Default fallback

    res.status(200).json({
      success: true,
      data: {
        avgResponseTimeMinutes: responseTimeMinutes,
        jobsPostedToday: jobsToday,
        mostActiveCategory: mostActiveCategory,
      },
    });
  } catch (error) {
    logger.error('Market insights error:', error);
    res.status(500).json({
      error: 'Failed to fetch market insights',
      message: 'Unable to retrieve market insights',
    });
  }
});

export default router;
