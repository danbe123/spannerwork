import { Router, Request, Response, NextFunction } from 'express';
import { requestController } from '../controllers/request.controller.js';
import { requireAuth, requireEmailVerified, optionalAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import { geocodingLimiter } from '../middleware/rateLimit.middleware.js';
import {
  createRequestSchema,
  updateRequestSchema,
} from '../utils/validation.schemas.js';

const router = Router();

/**
 * Conditionally apply geocoding rate limit when postcode and radius are provided
 * This prevents abuse of expensive PostGIS queries
 */
const conditionalGeoLimiter = (req: Request, res: Response, next: NextFunction): void => {
  if (req.query.postcode && req.query.radius) {
    geocodingLimiter(req, res, next);
    return;
  }
  next();
};

/**
 * GET /api/v1/requests
 * List all requests with filters and pagination
 * Rate limited when using geo queries (postcode + radius)
 */
router.get(
  '/',
  optionalAuth,
  conditionalGeoLimiter,
  requestController.list.bind(requestController)
);

/**
 * POST /api/v1/requests
 * Create a new request
 * Requires email verification
 * CSRF protected
 */
router.post(
  '/',
  requireAuth,
  requireEmailVerified,
  verifyCsrfToken,
  validateBody(createRequestSchema),
  requestController.create.bind(requestController)
);

/**
 * GET /api/v1/requests/:id
 * Get request details by ID
 */
router.get(
  '/:id',
  optionalAuth,
  requestController.getById.bind(requestController)
);

/**
 * PATCH /api/v1/requests/:id
 * Update a request
 * CSRF protected
 */
router.patch(
  '/:id',
  requireAuth,
  verifyCsrfToken,
  validateBody(updateRequestSchema),
  requestController.update.bind(requestController)
);

/**
 * DELETE /api/v1/requests/:id
 * Delete a request
 * CSRF protected
 */
router.delete(
  '/:id',
  requireAuth,
  verifyCsrfToken,
  requestController.delete.bind(requestController)
);

/**
 * POST /api/v1/requests/:id/cancel
 * Cancel a request (soft delete)
 * CSRF protected
 */
router.post(
  '/:id/cancel',
  requireAuth,
  verifyCsrfToken,
  requestController.cancel.bind(requestController)
);

export default router;
