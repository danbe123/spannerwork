import { Router, Request, Response } from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/authorize.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import { adminLimiter, getRateLimitMetrics, getTotalBlockedRequests } from '../middleware/rateLimit.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { prisma, getPoolMetrics, checkDatabaseHealth } from '../config/database.js';
import { featureFlags } from '../services/featureFlags.service.js';
import insuranceController from '../controllers/insurance.controller.js';
import { isRedisAvailable, redis } from '../config/redis.js';
import emailAdminRoutes from './admin/email.routes.js';
import { sanitizeSearchQuery, sanitizePagination } from '../utils/sanitize.js';

const router = Router();

// All admin routes require authentication, admin role, and rate limiting
router.use(requireAuth, requireAdmin, adminLimiter);

/**
 * @route   GET /api/v1/admin/analytics
 * @desc    Get platform analytics
 * @access  Admin
 */
router.get('/analytics', asyncHandler(adminController.getAnalytics.bind(adminController)));

/**
 * @route   GET /api/v1/admin/users
 * @desc    List all users
 * @access  Admin
 */
router.get('/users', asyncHandler(adminController.listUsers.bind(adminController)));

/**
 * @route   POST /api/v1/admin/users/:id/suspend
 * @desc    Suspend a user
 * @access  Admin
 */
router.post('/users/:id/suspend', verifyCsrfToken, asyncHandler(adminController.suspendUser.bind(adminController)));

/**
 * @route   POST /api/v1/admin/users/:id/reactivate
 * @desc    Reactivate a suspended user
 * @access  Admin
 */
router.post('/users/:id/reactivate', verifyCsrfToken, asyncHandler(adminController.reactivateUser.bind(adminController)));

/**
 * @route   PATCH /api/v1/admin/users/:id/role
 * @desc    Change user role
 * @access  Admin
 */
router.patch('/users/:id/role', verifyCsrfToken, asyncHandler(adminController.changeUserRole.bind(adminController)));

/**
 * @route   GET /api/v1/admin/transactions
 * @desc    List all transactions
 * @access  Admin
 */
router.get('/transactions', asyncHandler(adminController.listTransactions.bind(adminController)));

/**
 * @route   POST /api/v1/admin/transactions/:id/force-complete
 * @desc    Force-complete a stuck transaction (e.g., when escrow is expiring)
 * @access  Admin
 * FIX #13: Added to allow admins to release payment when customer is unresponsive
 */
router.post('/transactions/:id/force-complete', verifyCsrfToken, asyncHandler(adminController.forceCompleteTransaction.bind(adminController)));

/**
 * @route   GET /api/v1/admin/disputes
 * @desc    List all disputes
 * @access  Admin
 */
router.get('/disputes', asyncHandler(adminController.listDisputes.bind(adminController)));

/**
 * @route   GET /api/v1/admin/audit-logs
 * @desc    Get audit logs with filtering
 * @access  Admin
 */
router.get('/audit-logs', asyncHandler(adminController.getAuditLogs.bind(adminController)));

/**
 * @route   GET /api/v1/admin/system-metrics
 * @desc    Get system metrics (database pool, rate limiting, etc.)
 * @access  Admin
 */
router.get('/system-metrics', asyncHandler(async (_req: Request, res: Response) => {
  // Get Redis cache stats
  let cacheStats = null;
  if (isRedisAvailable()) {
    try {
      const info = await redis.info('stats');
      const memInfo = await redis.info('memory');

      // Parse Redis INFO output (safe string search - no regex)
      const parseInfo = (infoStr: string, key: string): string | null => {
        // Use string operations instead of regex to prevent ReDoS
        const lines = infoStr.split('\n');
        const prefix = `${key}:`;
        const line = lines.find(l => l.startsWith(prefix));
        return line ? line.substring(prefix.length).trim() : null;
      };

      // Get cache key counts by prefix
      const cacheKeyPatterns = ['tool:', 'space:', 'service:', 'user:', 'analytics:'];
      const keyCounts: Record<string, number> = {};
      for (const pattern of cacheKeyPatterns) {
        const keys = await redis.keys(`${pattern}*`);
        keyCounts[pattern.replace(':', '')] = keys.length;
      }

      cacheStats = {
        available: true,
        hits: parseInfo(info, 'keyspace_hits'),
        misses: parseInfo(info, 'keyspace_misses'),
        hitRate: (() => {
          const hits = parseInt(parseInfo(info, 'keyspace_hits') || '0', 10);
          const misses = parseInt(parseInfo(info, 'keyspace_misses') || '0', 10);
          const total = hits + misses;
          return total > 0 ? `${((hits / total) * 100).toFixed(2)}%` : 'N/A';
        })(),
        usedMemoryMB: Math.round(parseInt(parseInfo(memInfo, 'used_memory') || '0', 10) / 1024 / 1024),
        connectedClients: parseInfo(info, 'connected_clients'),
        keyCounts,
      };
    } catch {
      cacheStats = { available: false, error: 'Failed to fetch Redis stats' };
    }
  } else {
    cacheStats = { available: false };
  }

  const [dbHealth, dbMetrics, rateLimitStats] = await Promise.all([
    checkDatabaseHealth(),
    Promise.resolve(getPoolMetrics()),
    Promise.resolve(getRateLimitMetrics()),
  ]);

  return res.json({
    timestamp: new Date().toISOString(),
    database: {
      health: dbHealth,
      pool: dbMetrics,
    },
    cache: cacheStats,
    rateLimiting: {
      limiters: rateLimitStats,
      totalBlocked: getTotalBlockedRequests(),
    },
    process: {
      uptime: process.uptime(),
      memory: {
        heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
    },
  });
}));

/**
 * @route   GET /api/v1/admin/feature-flags
 * @desc    Get all feature flags
 * @access  Admin
 */
router.get('/feature-flags', asyncHandler(async (_req: Request, res: Response) => {
  const flags = await featureFlags.getAllFlags();
  return res.json({ flags });
}));

/**
 * @route   PUT /api/v1/admin/feature-flags/:name
 * @desc    Update a feature flag
 * @access  Admin
 */
router.put('/feature-flags/:name', verifyCsrfToken, asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.params;
  const { enabled, percentage, allowedUsers, blockedUsers } = req.body;

  const existingFlag = await featureFlags.getFlag(name);
  if (!existingFlag) {
    return res.status(404).json({ error: 'Feature flag not found' });
  }

  await featureFlags.setFlag({
    ...existingFlag,
    enabled: enabled ?? existingFlag.enabled,
    percentage: percentage ?? existingFlag.percentage,
    allowedUsers: allowedUsers ?? existingFlag.allowedUsers,
    blockedUsers: blockedUsers ?? existingFlag.blockedUsers,
  });

  const updatedFlag = await featureFlags.getFlag(name);
  return res.json({ flag: updatedFlag });
}));

// =============================================================================
// REQUESTS ADMIN ROUTES
// =============================================================================

/**
 * @route   GET /api/v1/admin/requests
 * @desc    List all requests (admin view)
 * @access  Admin
 */
router.get('/requests', asyncHandler(async (req: Request, res: Response) => {
  const { category, status, search } = req.query;

  // Sanitize pagination parameters to prevent abuse
  const { page, limit } = sanitizePagination(
    req.query.page as string,
    req.query.limit as string,
    100
  );
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (category && category !== 'all') {
    where.category = category as string;
  }

  if (status && status !== 'all') {
    where.status = status as string;
  }

  // Sanitize search input to prevent injection and unexpected behavior
  if (search) {
    const sanitizedSearch = sanitizeSearchQuery(search as string, 100);
    if (sanitizedSearch) {
      where.OR = [
        { title: { contains: sanitizedSearch, mode: 'insensitive' } },
        { description: { contains: sanitizedSearch, mode: 'insensitive' } },
      ];
    }
  }

  const [requests, total] = await Promise.all([
    prisma.request.findMany({
      where,
      include: {
        seeker: {
          select: { id: true, name: true, email: true, username: true },
        },
      },
      orderBy: { createdDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.request.count({ where }),
  ]);

  return res.json({
    data: requests,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}));

// =============================================================================
// INSURANCE VERIFICATION ROUTES
// =============================================================================

/**
 * @route   GET /api/v1/admin/insurance/pending
 * @desc    Get all insurance documents pending review
 * @access  Admin
 * Note: Explicit requireAuth + requireAdmin for defense in depth
 */
router.get('/insurance/pending', requireAuth, requireAdmin, asyncHandler(insuranceController.getPendingDocuments));

/**
 * @route   GET /api/v1/admin/insurance/expiring
 * @desc    Get insurance documents expiring soon
 * @access  Admin
 */
router.get('/insurance/expiring', requireAuth, requireAdmin, asyncHandler(insuranceController.getExpiringDocuments));

/**
 * @route   GET /api/v1/admin/insurance/user/:userId
 * @desc    Get all insurance documents for a specific user
 * @access  Admin
 */
router.get('/insurance/user/:userId', requireAuth, requireAdmin, asyncHandler(insuranceController.getUserDocuments));

/**
 * @route   GET /api/v1/admin/insurance/:id
 * @desc    Get a specific insurance document
 * @access  Admin
 */
router.get('/insurance/:id', requireAuth, requireAdmin, asyncHandler(insuranceController.getDocumentById));

/**
 * @route   POST /api/v1/admin/insurance/:id/approve
 * @desc    Approve an insurance document
 * @access  Admin
 */
router.post('/insurance/:id/approve', requireAuth, requireAdmin, verifyCsrfToken, asyncHandler(insuranceController.approveDocument));

/**
 * @route   POST /api/v1/admin/insurance/:id/reject
 * @desc    Reject an insurance document
 * @access  Admin
 */
router.post('/insurance/:id/reject', requireAuth, requireAdmin, verifyCsrfToken, asyncHandler(insuranceController.rejectDocument));

// =============================================================================
// EMAIL MANAGEMENT ROUTES
// =============================================================================

/**
 * Email admin routes - mounted at /api/v1/admin/email
 * Provides:
 * - Email delivery metrics and analytics
 * - Dead Letter Queue management
 * - Circuit breaker status
 * - Email log search
 */
router.use('/email', emailAdminRoutes);

export default router;
