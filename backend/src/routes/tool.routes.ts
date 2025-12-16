import { Router } from 'express';
import { toolController } from '../controllers/tool.controller.js';
import { requireAuth, requireEmailVerified, optionalAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import {
  createToolSchema,
  updateToolSchema,
} from '../utils/validation.schemas.js';

const router = Router();

/**
 * GET /api/v1/tools
 * List all tools with filters and pagination
 */
router.get('/', optionalAuth, toolController.list.bind(toolController));

/**
 * POST /api/v1/tools
 * Create a new tool listing
 * Requires email verification, CSRF protected
 */
router.post(
  '/',
  requireAuth,
  requireEmailVerified,
  verifyCsrfToken,
  validateBody(createToolSchema),
  toolController.create.bind(toolController)
);

/**
 * GET /api/v1/tools/:id
 * Get tool details by ID
 */
router.get('/:id', optionalAuth, toolController.getById.bind(toolController));

/**
 * PATCH /api/v1/tools/:id
 * Update a tool
 * CSRF protected
 */
router.patch(
  '/:id',
  requireAuth,
  verifyCsrfToken,
  validateBody(updateToolSchema),
  toolController.update.bind(toolController)
);

/**
 * DELETE /api/v1/tools/:id
 * Delete a tool
 * CSRF protected
 */
router.delete(
  '/:id',
  requireAuth,
  verifyCsrfToken,
  toolController.delete.bind(toolController)
);

/**
 * GET /api/v1/tools/:id/availability
 * Check tool availability for specific dates
 */
router.get(
  '/:id/availability',
  toolController.checkAvailability.bind(toolController)
);

export default router;
