/**
 * Payment Routes
 * 
 * Handles payment-related endpoints for Stripe Connect integration.
 * These routes require authentication.
 */

import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Public route - get publishable key
router.get('/config', paymentController.getPublishableKey.bind(paymentController));

// Protected routes - require authentication
router.use(requireAuth);

// Connect account management (for providers)
router.post('/connect/account', paymentController.createConnectAccount.bind(paymentController));
router.get('/connect/status', paymentController.getAccountStatus.bind(paymentController));
router.get('/connect/dashboard', paymentController.getDashboardLink.bind(paymentController));

// Payment processing (for customers)
router.post('/intent', paymentController.createPaymentIntent.bind(paymentController));

// Escrow - hold payment until job confirmed
router.post('/capture', paymentController.capturePayment.bind(paymentController));
router.get('/escrow-status/:transactionId', paymentController.getEscrowStatus.bind(paymentController));

// Refunds
router.post('/refund', paymentController.requestRefund.bind(paymentController));

export default router;
