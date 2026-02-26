import { Router } from 'express';
import { invoiceController } from '../controllers/invoice.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import { invoiceGenerateLimiter, invoiceExportLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

/**
 * GET /api/v1/invoices/settings
 * Get user's invoice settings
 */
router.get(
  '/settings',
  requireAuth,
  invoiceController.getSettings.bind(invoiceController)
);

/**
 * PATCH /api/v1/invoices/settings
 * Update user's invoice settings
 */
router.patch(
  '/settings',
  requireAuth,
  verifyCsrfToken,
  invoiceController.updateSettings.bind(invoiceController)
);

/**
 * GET /api/v1/invoices
 * List user's invoices with optional filters
 * Query params: type (RENTER|PROVIDER), startDate, endDate, page, limit
 */
router.get(
  '/',
  requireAuth,
  invoiceController.list.bind(invoiceController)
);

/**
 * GET /api/v1/invoices/export/csv
 * Export invoices to CSV
 * Query params: startDate, endDate
 * @rateLimit 30 per 15 minutes per IP
 */
router.get(
  '/export/csv',
  invoiceExportLimiter,
  requireAuth,
  invoiceController.exportCsv.bind(invoiceController)
);

/**
 * GET /api/v1/invoices/tax-summary/:year
 * Get annual tax summary for a given year
 */
router.get(
  '/tax-summary/:year',
  requireAuth,
  invoiceController.getTaxSummary.bind(invoiceController)
);

/**
 * GET /api/v1/invoices/:id/download
 * Download invoice PDF
 * @rateLimit 30 per 15 minutes per IP
 */
router.get(
  '/:id/download',
  invoiceExportLimiter,
  requireAuth,
  invoiceController.download.bind(invoiceController)
);

/**
 * POST /api/v1/invoices/transaction/:transactionId
 * Generate invoice for a transaction
 * Body: { type: 'RENTER' | 'PROVIDER', purchaseOrder?: string }
 * @rateLimit 20 per hour per IP
 */
router.post(
  '/transaction/:transactionId',
  invoiceGenerateLimiter,
  requireAuth,
  verifyCsrfToken,
  invoiceController.createForTransaction.bind(invoiceController)
);

export default router;
