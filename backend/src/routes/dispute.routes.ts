import { Router } from 'express';
import { disputeController } from '../controllers/dispute.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/authorize.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import { createDisputeSchema } from '../utils/validation.schemas.js';

const router = Router();

/**
 * @route   POST /api/v1/disputes
 * @desc    Create a dispute
 * @access  Private
 */
router.post(
  '/',
  requireAuth,
  verifyCsrfToken,
  validateBody(createDisputeSchema),
  disputeController.create.bind(disputeController)
);

/**
 * @route   GET /api/v1/disputes
 * @desc    List user's disputes
 * @access  Private
 */
router.get('/', requireAuth, disputeController.list.bind(disputeController));

/**
 * @route   GET /api/v1/disputes/:id
 * @desc    Get dispute by ID
 * @access  Private
 */
router.get('/:id', requireAuth, disputeController.getById.bind(disputeController));

/**
 * @route   POST /api/v1/disputes/:id/resolve
 * @desc    Resolve a dispute (admin only)
 * @access  Admin
 */
router.post(
  '/:id/resolve',
  requireAuth,
  requireAdmin,
  verifyCsrfToken,
  disputeController.resolve.bind(disputeController)
);

/**
 * @route   PATCH /api/v1/disputes/:id/status
 * @desc    Update dispute status (admin only)
 * @access  Admin
 */
router.patch(
  '/:id/status',
  requireAuth,
  requireAdmin,
  verifyCsrfToken,
  disputeController.updateStatus.bind(disputeController)
);

export default router;
