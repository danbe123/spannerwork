import { Router, Request, Response } from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/authorize.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import { adminLimiter, getRateLimitMetrics, getTotalBlockedRequests } from '../middleware/rateLimit.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { getPoolMetrics, checkDatabaseHealth } from '../config/database.js';
import { featureFlags } from '../services/featureFlags.service.js';
import insuranceController from '../controllers/insurance.controller.js';

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
// INSURANCE VERIFICATION ROUTES
// =============================================================================

/**
 * @route   GET /api/v1/admin/insurance/pending
 * @desc    Get all insurance documents pending review
 * @access  Admin
 */
router.get('/insurance/pending', asyncHandler(insuranceController.getPendingDocuments));

/**
 * @route   GET /api/v1/admin/insurance/expiring
 * @desc    Get insurance documents expiring soon
 * @access  Admin
 */
router.get('/insurance/expiring', asyncHandler(insuranceController.getExpiringDocuments));

/**
 * @route   GET /api/v1/admin/insurance/user/:userId
 * @desc    Get all insurance documents for a specific user
 * @access  Admin
 */
router.get('/insurance/user/:userId', asyncHandler(insuranceController.getUserDocuments));

/**
 * @route   GET /api/v1/admin/insurance/:id
 * @desc    Get a specific insurance document
 * @access  Admin
 */
router.get('/insurance/:id', asyncHandler(insuranceController.getDocumentById));

/**
 * @route   POST /api/v1/admin/insurance/:id/approve
 * @desc    Approve an insurance document
 * @access  Admin
 */
router.post('/insurance/:id/approve', verifyCsrfToken, asyncHandler(insuranceController.approveDocument));

/**
 * @route   POST /api/v1/admin/insurance/:id/reject
 * @desc    Reject an insurance document
 * @access  Admin
 */
router.post('/insurance/:id/reject', verifyCsrfToken, asyncHandler(insuranceController.rejectDocument));

export default router;
