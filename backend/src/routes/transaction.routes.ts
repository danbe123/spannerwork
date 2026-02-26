import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller.js';
import { requireAuth, requireEmailVerified } from '../middleware/auth.middleware.js';
import { validateBody, validateParams } from '../middleware/validate.middleware.js';
import {
  createTransactionSchema,
  updateTransactionStatusSchema,
  updateTransactionAddOnsSchema,
  idParamSchema,
} from '../utils/validation.schemas.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import { noCache } from '../middleware/noCache.middleware.js';

const router = Router();

/**
 * @route   POST /api/v1/transactions
 * @desc    Create new transaction
 * @access  Private
 * @requires Email verification
 */
router.post(
  '/',
  requireAuth,
  requireEmailVerified,
  verifyCsrfToken,
  validateBody(createTransactionSchema),
  transactionController.create.bind(transactionController)
);

/**
 * @route   GET /api/v1/transactions
 * @desc    List user's transactions
 * @access  Private
 * @cache   No-cache - Transactions must always be fresh
 */
router.get('/', noCache, requireAuth, transactionController.list.bind(transactionController));

/**
 * @route   GET /api/v1/transactions/:id
 * @desc    Get transaction by ID
 * @access  Private
 * @cache   No-cache - Transaction details must always be fresh
 */
router.get('/:id', noCache, requireAuth, validateParams(idParamSchema), transactionController.getById.bind(transactionController));

/**
 * @route   PATCH /api/v1/transactions/:id/status
 * @desc    Update transaction status
 * @access  Private
 */
router.patch(
  '/:id/status',
  requireAuth,
  validateParams(idParamSchema),
  verifyCsrfToken,
  validateBody(updateTransactionStatusSchema),
  transactionController.updateStatus.bind(transactionController)
);

/**
 * @route   POST /api/v1/transactions/:id/complete
 * @desc    Complete a transaction
 * @access  Private
 */
router.post('/:id/complete', requireAuth, validateParams(idParamSchema), verifyCsrfToken, transactionController.complete.bind(transactionController));

/**
 * @route   POST /api/v1/transactions/:id/cancel
 * @desc    Cancel a transaction
 * @access  Private
 */
router.post('/:id/cancel', requireAuth, validateParams(idParamSchema), verifyCsrfToken, transactionController.cancel.bind(transactionController));

router.patch(
  '/:id/add-ons',
  requireAuth,
  validateParams(idParamSchema),
  verifyCsrfToken,
  validateBody(updateTransactionAddOnsSchema),
  transactionController.updateAddOns.bind(transactionController)
);

export default router;
