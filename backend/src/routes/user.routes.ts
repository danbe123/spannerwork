import { Router } from 'express';
import { userController } from '../controllers/user.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { updateUserSchema } from '../utils/validation.schemas.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';

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
 */
router.get(
  '/:id/tools',
  userController.getUserTools.bind(userController)
);

/**
 * GET /api/v1/users/:id/listings
 * Get user's aggregated listings (tools, spaces, services)
 */
router.get(
  '/:id/listings',
  userController.getUserListings.bind(userController)
);

/**
 * GET /api/v1/users/:id/spaces
 * Get user's space listings
 */
router.get(
  '/:id/spaces',
  userController.getUserSpaces.bind(userController)
);

/**
 * GET /api/v1/users/:id/services
 * Get user's service listings
 */
router.get(
  '/:id/services',
  userController.getUserServices.bind(userController)
);

/**
 * GET /api/v1/users/:id/reviews
 * Get user's reviews
 */
router.get(
  '/:id/reviews',
  userController.getUserReviews.bind(userController)
);

/**
 * GET /api/v1/users/:id/transactions
 * Get user's transactions (private)
 */
router.get(
  '/:id/transactions',
  requireAuth,
  userController.getUserTransactions.bind(userController)
);

export default router;
