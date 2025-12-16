import { Router } from 'express';
import { spaceController } from '../controllers/space.controller.js';
import { requireAuth, requireEmailVerified, optionalAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import {
  createSpaceSchema,
  updateSpaceSchema,
} from '../utils/validation.schemas.js';

const router = Router();

/**
 * GET /api/v1/spaces
 * List all spaces with optional filters
 */
router.get('/', optionalAuth, spaceController.list.bind(spaceController));

/**
 * POST /api/v1/spaces
 * Create a new space listing
 * Requires email verification
 */
router.post(
  '/',
  requireAuth,
  requireEmailVerified,
  verifyCsrfToken,
  validateBody(createSpaceSchema),
  spaceController.create.bind(spaceController)
);

/**
 * GET /api/v1/spaces/:id
 * Get space details by ID
 */
router.get('/:id', optionalAuth, spaceController.getById.bind(spaceController));

/**
 * PATCH /api/v1/spaces/:id
 * Update space listing
 */
router.patch(
  '/:id',
  requireAuth,
  verifyCsrfToken,
  validateBody(updateSpaceSchema),
  spaceController.update.bind(spaceController)
);

/**
 * DELETE /api/v1/spaces/:id
 * Delete space listing
 */
router.delete(
  '/:id',
  requireAuth,
  verifyCsrfToken,
  spaceController.delete.bind(spaceController)
);

/**
 * GET /api/v1/spaces/:id/availability
 * Check space availability for given dates
 */
router.get(
  '/:id/availability',
  spaceController.checkAvailability.bind(spaceController)
);

export default router;
