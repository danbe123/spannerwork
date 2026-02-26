import { Router } from 'express';
import { serviceController } from '../controllers/service.controller.js';
import { requireAuth, requireEmailVerified, optionalAuth } from '../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../middleware/validate.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import {
  createServiceSchema,
  updateServiceSchema,
  listQuerySchema,
} from '../utils/validation.schemas.js';

const router = Router();

/**
 * GET /api/v1/services
 * List all services with optional filters
 * Query parameters validated to prevent injection attacks
 */
router.get('/', optionalAuth, validateQuery(listQuerySchema), serviceController.list.bind(serviceController));

/**
 * POST /api/v1/services
 * Create a new service listing
 * Requires email verification
 */
router.post(
  '/',
  requireAuth,
  requireEmailVerified,
  verifyCsrfToken,
  validateBody(createServiceSchema),
  serviceController.create.bind(serviceController)
);

/**
 * GET /api/v1/services/:id
 * Get service details by ID
 */
router.get(
  '/:id',
  optionalAuth,
  serviceController.getById.bind(serviceController)
);

/**
 * PATCH /api/v1/services/:id
 * Update service listing
 */
router.patch(
  '/:id',
  requireAuth,
  verifyCsrfToken,
  validateBody(updateServiceSchema),
  serviceController.update.bind(serviceController)
);

/**
 * DELETE /api/v1/services/:id
 * Delete service listing
 */
router.delete(
  '/:id',
  requireAuth,
  verifyCsrfToken,
  serviceController.delete.bind(serviceController)
);

/**
 * GET /api/v1/services/:id/availability
 * Check service availability for given dates
 */
router.get(
  '/:id/availability',
  serviceController.checkAvailability.bind(serviceController)
);

export default router;
