/**
 * Payment Routes
 * 
 * Handles payment-related endpoints for Stripe Connect integration.
 * These routes require authentication.
 */

import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { sensitiveLimiter } from '../middleware/rateLimit.middleware.js';
import {
  subscriptionCheckoutSchema,
  subscriptionPortalSchema,
  paymentIntentSchema,
  capturePaymentSchema,
  refundPaymentSchema,
  transactionIdParamSchema,
} from '../utils/validation.schemas.js';
import { validateParams } from '../middleware/validate.middleware.js';

const router = Router();

// Public route - get publishable key
router.get('/config', paymentController.getPublishableKey.bind(paymentController));

// Protected routes - require authentication
router.use(requireAuth);

// Connect account management (for providers)
router.post('/connect/account', verifyCsrfToken, paymentController.createConnectAccount.bind(paymentController));
router.get('/connect/status', paymentController.getAccountStatus.bind(paymentController));
router.get('/connect/dashboard', paymentController.getDashboardLink.bind(paymentController));

// Payment processing (for customers) - rate limited to prevent abuse
router.post('/intent', sensitiveLimiter, verifyCsrfToken, validateBody(paymentIntentSchema), paymentController.createPaymentIntent.bind(paymentController));

router.post(
  '/subscription/checkout',
  sensitiveLimiter,
  verifyCsrfToken,
  validateBody(subscriptionCheckoutSchema),
  paymentController.createSubscriptionCheckout.bind(paymentController)
);

router.post(
  '/subscription/portal',
  sensitiveLimiter,
  verifyCsrfToken,
  validateBody(subscriptionPortalSchema),
  paymentController.createSubscriptionPortal.bind(paymentController)
);

// Escrow - hold payment until job confirmed (rate limited to prevent DoS)
router.post('/capture', sensitiveLimiter, verifyCsrfToken, validateBody(capturePaymentSchema), paymentController.capturePayment.bind(paymentController));
router.get('/escrow-status/:transactionId', validateParams(transactionIdParamSchema), paymentController.getEscrowStatus.bind(paymentController));

// Refunds
router.post('/refund', verifyCsrfToken, validateBody(refundPaymentSchema), paymentController.requestRefund.bind(paymentController));

export default router;
