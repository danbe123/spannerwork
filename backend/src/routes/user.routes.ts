import { Router } from 'express';
import { userController } from '../controllers/user.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { updateUserSchema } from '../utils/validation.schemas.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import { noCache } from '../middleware/noCache.middleware.js';

const router = Router();

/**
 * GET /api/v1/users/:id
 * Get user profile by ID
 */
router.get('/:id', optionalAuth, userController.getById.bind(userController));

/**
 * PATCH /api/v1/users/:id
 * Update user profile
 */
router.patch(
  '/:id',
  requireAuth,
  verifyCsrfToken,
  validateBody(updateUserSchema),
  userController.update.bind(userController)
);

/**
 * GET /api/v1/users/:id/tools
 * Get user's tool listings
 * No-cache: User listings must always show fresh data
 */
router.get(
  '/:id/tools',
  noCache,
  userController.getUserTools.bind(userController)
);

/**
 * GET /api/v1/users/:id/listings
 * Get user's aggregated listings (tools, spaces, services)
 * No-cache: User listings must always show fresh data
 */
router.get(
  '/:id/listings',
  noCache,
  userController.getUserListings.bind(userController)
);

/**
 * GET /api/v1/users/:id/spaces
 * Get user's space listings
 * No-cache: User listings must always show fresh data
 */
router.get(
  '/:id/spaces',
  noCache,
  userController.getUserSpaces.bind(userController)
);

/**
 * GET /api/v1/users/:id/services
 * Get user's service listings
 * No-cache: User listings must always show fresh data
 */
router.get(
  '/:id/services',
  noCache,
  userController.getUserServices.bind(userController)
);

/**
 * GET /api/v1/users/:id/requests
 * Get user's posted job requests
 * No-cache: User requests must always show fresh data
 */
router.get(
  '/:id/requests',
  noCache,
  userController.getUserRequests.bind(userController)
);

/**
 * GET /api/v1/users/:id/reviews
 * Get user's reviews
 * No-cache: Reviews must always show fresh data
 */
router.get(
  '/:id/reviews',
  noCache,
  userController.getUserReviews.bind(userController)
);

/**
 * GET /api/v1/users/:id/transactions
 * Get user's transactions (private)
 * No-cache: Transactions must always show fresh data
 */
router.get(
  '/:id/transactions',
  noCache,
  requireAuth,
  userController.getUserTransactions.bind(userController)
);

export default router;
