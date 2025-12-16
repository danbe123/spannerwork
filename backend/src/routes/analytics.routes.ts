/**
 * Analytics Routes
 * 
 * Admin-only routes for platform analytics
 * All routes require authentication and admin role
 */

import { Router } from 'express';
import analyticsController from '../controllers/analytics.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/authorize.middleware.js';

const router = Router();

// All analytics routes require auth + admin
router.use(requireAuth);
router.use(requireAdmin);

/**
 * @openapi
 * /api/admin/analytics/overview:
 *   get:
 *     summary: Get dashboard overview metrics
 *     tags: [Admin Analytics]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Overview metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: integer
 *                     totalListings:
 *                       type: integer
 *                     totalTransactions:
 *                       type: integer
 *                     totalGmv:
 *                       type: integer
 *                       description: Total GMV in pence
 *                     platformRevenue:
 *                       type: integer
 *                       description: Platform fees in pence
 *                     activeUsers24h:
 *                       type: integer
 *                     newUsersToday:
 *                       type: integer
 *                     pendingDisputes:
 *                       type: integer
 */
router.get('/overview', analyticsController.getOverview);

/**
 * @openapi
 * /api/admin/analytics/revenue:
 *   get:
 *     summary: Get revenue time series data
 *     tags: [Admin Analytics]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: startDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (defaults to 30 days ago)
 *       - name: endDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (defaults to today)
 *     responses:
 *       200:
 *         description: Revenue data
 */
router.get('/revenue', analyticsController.getRevenue);

/**
 * @openapi
 * /api/admin/analytics/users:
 *   get:
 *     summary: Get user growth time series data
 *     tags: [Admin Analytics]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: startDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *       - name: endDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: User growth data
 */
router.get('/users', analyticsController.getUserGrowth);

/**
 * @openapi
 * /api/admin/analytics/listings:
 *   get:
 *     summary: Get listing creation trends
 *     tags: [Admin Analytics]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: startDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *       - name: endDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Listing trends data
 */
router.get('/listings', analyticsController.getListingTrends);

/**
 * @openapi
 * /api/admin/analytics/categories:
 *   get:
 *     summary: Get category breakdown (listings and revenue by type)
 *     tags: [Admin Analytics]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Category breakdown
 */
router.get('/categories', analyticsController.getCategoryBreakdown);

/**
 * @openapi
 * /api/admin/analytics/geographic:
 *   get:
 *     summary: Get geographic distribution of users and listings
 *     tags: [Admin Analytics]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Geographic distribution data
 */
router.get('/geographic', analyticsController.getGeographicDistribution);

/**
 * @openapi
 * /api/admin/analytics/funnel:
 *   get:
 *     summary: Get conversion funnel metrics
 *     tags: [Admin Analytics]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Conversion funnel data with rates
 */
router.get('/funnel', analyticsController.getConversionFunnel);

/**
 * @openapi
 * /api/admin/analytics/top-performers:
 *   get:
 *     summary: Get top providers and earners
 *     tags: [Admin Analytics]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Top performers data
 */
router.get('/top-performers', analyticsController.getTopPerformers);

/**
 * @openapi
 * /api/admin/analytics/cache/clear:
 *   post:
 *     summary: Clear analytics cache
 *     tags: [Admin Analytics]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Cache cleared
 */
router.post('/cache/clear', analyticsController.clearCache);

/**
 * @openapi
 * /api/admin/analytics/snapshot:
 *   post:
 *     summary: Manually trigger daily metrics snapshot
 *     tags: [Admin Analytics]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Snapshot created
 */
router.post('/snapshot', analyticsController.triggerSnapshot);

export default router;
