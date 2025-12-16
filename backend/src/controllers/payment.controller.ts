/**
 * Payment Controller
 * 
 * Handles payment-related API endpoints for Stripe Connect integration.
 * All methods return appropriate error messages when Stripe is not configured.
 */

import { Request, Response } from 'express';
import { stripeService } from '../services/stripe.service.js';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

export class PaymentController {
  /**
   * Get Stripe publishable key for client-side use
   */
  async getPublishableKey(_req: Request, res: Response) {
    try {
      if (!stripeService.isEnabled()) {
        return res.status(503).json({
          error: 'Payment service unavailable',
          message: 'Stripe is not configured. Please contact support.',
        });
      }

      const publishableKey = stripeService.getPublishableKey();
      return res.json({ publishableKey });
    } catch (error) {
      logger.error('Failed to get publishable key:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Create or get Stripe Connect account for the current user (provider)
   */
  async createConnectAccount(req: Request, res: Response) {
    try {
      if (!stripeService.isEnabled()) {
        return res.status(503).json({
          error: 'Payment service unavailable',
          message: 'Stripe is not configured. Please contact support.',
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if user already has a Stripe account
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, stripeConnectId: true },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.stripeConnectId) {
        // User already has account, generate new onboarding link
        const onboardingUrl = await stripeService.createOnboardingLink(user.stripeConnectId);
        return res.json({
          accountId: user.stripeConnectId,
          onboardingUrl,
          isNew: false,
        });
      }

      // Create new Connect account
      const result = await stripeService.createConnectAccount({
        userId,
        email: user.email,
        country: 'GB',
        businessType: 'individual',
      });

      // Save Stripe account ID to user
      await prisma.user.update({
        where: { id: userId },
        data: { stripeConnectId: result.accountId },
      });

      return res.json({
        accountId: result.accountId,
        onboardingUrl: result.onboardingUrl,
        isNew: true,
      });
    } catch (error) {
      logger.error('Failed to create Connect account:', error);
      
      if (error instanceof Error && error.message.includes('not yet implemented')) {
        return res.status(503).json({
          error: 'Payment service unavailable',
          message: 'Stripe integration is pending. Please try again later.',
        });
      }
      
      return res.status(500).json({ error: 'Failed to create payment account' });
    }
  }

  /**
   * Get current user's Connect account status
   */
  async getAccountStatus(req: Request, res: Response) {
    try {
      if (!stripeService.isEnabled()) {
        return res.status(503).json({
          error: 'Payment service unavailable',
          message: 'Stripe is not configured.',
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeConnectId: true },
      });

      if (!user?.stripeConnectId) {
        return res.json({
          hasAccount: false,
          status: null,
        });
      }

      const status = await stripeService.getAccountStatus(user.stripeConnectId);
      return res.json({
        hasAccount: true,
        status,
      });
    } catch (error) {
      logger.error('Failed to get account status:', error);
      
      if (error instanceof Error && error.message.includes('not yet implemented')) {
        return res.status(503).json({
          error: 'Payment service unavailable',
          message: 'Stripe integration is pending.',
        });
      }
      
      return res.status(500).json({ error: 'Failed to get account status' });
    }
  }

  /**
   * Get dashboard link for provider to manage their Stripe account
   */
  async getDashboardLink(req: Request, res: Response) {
    try {
      if (!stripeService.isEnabled()) {
        return res.status(503).json({
          error: 'Payment service unavailable',
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeConnectId: true },
      });

      if (!user?.stripeConnectId) {
        return res.status(400).json({
          error: 'No payment account',
          message: 'You need to set up a payment account first.',
        });
      }

      const dashboardUrl = await stripeService.createDashboardLink(user.stripeConnectId);
      return res.json({ dashboardUrl });
    } catch (error) {
      logger.error('Failed to get dashboard link:', error);
      
      if (error instanceof Error && error.message.includes('not yet implemented')) {
        return res.status(503).json({
          error: 'Payment service unavailable',
        });
      }
      
      return res.status(500).json({ error: 'Failed to get dashboard link' });
    }
  }

  /**
   * Create a payment intent for a transaction
   */
  async createPaymentIntent(req: Request, res: Response) {
    try {
      if (!stripeService.isEnabled()) {
        return res.status(503).json({
          error: 'Payment service unavailable',
          message: 'Stripe is not configured. Please contact support.',
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { transactionId } = req.body;
      if (!transactionId) {
        return res.status(400).json({ error: 'Transaction ID is required' });
      }

      // Get transaction details
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          provider: {
            select: { id: true, stripeConnectId: true },
          },
        },
      });

      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      if (transaction.userId !== userId) {
        return res.status(403).json({ error: 'Not authorized to pay for this transaction' });
      }

      if (!transaction.provider?.stripeConnectId) {
        return res.status(400).json({
          error: 'Provider not set up for payments',
          message: 'The provider has not set up their payment account yet.',
        });
      }

      // Create payment intent
      const paymentIntent = await stripeService.createPaymentIntent({
        transactionId: transaction.id,
        amount: transaction.totalAmount,
        providerAccountId: transaction.provider.stripeConnectId,
        metadata: {
          transactionId: transaction.id,
          userId: userId,
          providerId: transaction.providerId || '',
        },
      });

      // Update transaction with payment intent ID
      await prisma.transaction.update({
        where: { id: transactionId },
        data: { stripePaymentIntentId: paymentIntent.paymentIntentId },
      });

      return res.json({
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.paymentIntentId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      });
    } catch (error) {
      logger.error('Failed to create payment intent:', error);
      
      if (error instanceof Error && error.message.includes('not yet implemented')) {
        return res.status(503).json({
          error: 'Payment service unavailable',
          message: 'Stripe integration is pending.',
        });
      }
      
      return res.status(500).json({ error: 'Failed to create payment' });
    }
  }

  /**
   * Request a refund for a transaction
   */
  async requestRefund(req: Request, res: Response) {
    try {
      if (!stripeService.isEnabled()) {
        return res.status(503).json({
          error: 'Payment service unavailable',
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { transactionId, reason } = req.body;
      if (!transactionId) {
        return res.status(400).json({ error: 'Transaction ID is required' });
      }

      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        select: {
          id: true,
          userId: true,
          stripePaymentIntentId: true,
          paymentStatus: true,
        },
      });

      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      if (transaction.userId !== userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (transaction.paymentStatus !== 'PAID') {
        return res.status(400).json({ error: 'Transaction has not been paid' });
      }

      if (!transaction.stripePaymentIntentId) {
        return res.status(400).json({ error: 'No payment to refund' });
      }

      const refund = await stripeService.createRefund({
        paymentIntentId: transaction.stripePaymentIntentId,
        reason: reason || 'requested_by_customer',
      });

      // Update transaction status
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          paymentStatus: 'REFUNDED',
          status: 'CANCELLED',
        },
      });

      return res.json({
        refundId: refund.refundId,
        amount: refund.amount,
        status: refund.status,
      });
    } catch (error) {
      logger.error('Failed to process refund:', error);
      
      if (error instanceof Error && error.message.includes('not yet implemented')) {
        return res.status(503).json({
          error: 'Payment service unavailable',
        });
      }
      
      return res.status(500).json({ error: 'Failed to process refund' });
    }
  }

  /**
   * Capture an escrow payment
   * Called when customer confirms job completion
   * POST /api/v1/payments/capture
   */
  async capturePayment(req: Request, res: Response) {
    try {
      if (!stripeService.isEnabled()) {
        return res.status(503).json({
          error: 'Payment service unavailable',
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { transactionId } = req.body;
      if (!transactionId) {
        return res.status(400).json({ error: 'Transaction ID is required' });
      }

      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        select: {
          id: true,
          userId: true,
          providerId: true,
          stripePaymentIntentId: true,
          paymentStatus: true,
          status: true,
          totalAmount: true,
        },
      });

      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Only the customer (userId) can confirm job completion and release payment
      if (transaction.userId !== userId) {
        return res.status(403).json({ 
          error: 'Not authorized',
          message: 'Only the customer can confirm job completion and release payment.',
        });
      }

      if (!transaction.stripePaymentIntentId) {
        return res.status(400).json({ error: 'No payment to capture' });
      }

      // Check escrow status before capturing
      const escrowStatus = await stripeService.getEscrowStatus(transaction.stripePaymentIntentId);
      
      if (!escrowStatus.requiresCapture) {
        if (escrowStatus.status === 'succeeded') {
          return res.status(400).json({ 
            error: 'Payment already captured',
            message: 'This payment has already been completed.',
          });
        }
        return res.status(400).json({ 
          error: 'Payment not in escrow',
          message: 'This payment is not ready for capture.',
        });
      }

      // Capture the payment
      const captureResult = await stripeService.capturePayment({
        paymentIntentId: transaction.stripePaymentIntentId,
      });

      // Update transaction status
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          completedDate: new Date(),
          stripeTransferId: captureResult.transferId,
        },
      });

      logger.info(`Payment captured for transaction ${transactionId}, transfer: ${captureResult.transferId}`);

      return res.json({
        success: true,
        message: 'Payment released to provider',
        amountCaptured: captureResult.amountCaptured,
        transferId: captureResult.transferId,
      });
    } catch (error) {
      logger.error('Failed to capture payment:', error);
      
      if (error instanceof Error && error.message.includes('not yet implemented')) {
        return res.status(503).json({
          error: 'Payment service unavailable',
        });
      }
      
      return res.status(500).json({ error: 'Failed to capture payment' });
    }
  }

  /**
   * Get escrow status for a transaction
   * GET /api/v1/payments/escrow-status/:transactionId
   */
  async getEscrowStatus(req: Request, res: Response) {
    try {
      if (!stripeService.isEnabled()) {
        return res.status(503).json({
          error: 'Payment service unavailable',
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { transactionId } = req.params;
      if (!transactionId) {
        return res.status(400).json({ error: 'Transaction ID is required' });
      }

      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        select: {
          id: true,
          userId: true,
          providerId: true,
          stripePaymentIntentId: true,
          paymentStatus: true,
          status: true,
          totalAmount: true,
        },
      });

      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Only customer or provider can view escrow status
      if (transaction.userId !== userId && transaction.providerId !== userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (!transaction.stripePaymentIntentId) {
        return res.json({
          inEscrow: false,
          status: 'no_payment',
          message: 'No payment has been made for this transaction.',
        });
      }

      const escrowStatus = await stripeService.getEscrowStatus(transaction.stripePaymentIntentId);

      return res.json({
        inEscrow: escrowStatus.requiresCapture,
        status: escrowStatus.status,
        amount: escrowStatus.amount,
        capturedAmount: escrowStatus.capturedAmount,
        expiresAt: escrowStatus.expiresAt,
        message: escrowStatus.requiresCapture 
          ? 'Payment is held in escrow. Customer must confirm job completion to release funds.'
          : escrowStatus.status === 'succeeded'
            ? 'Payment has been completed and transferred to provider.'
            : 'Payment is being processed.',
      });
    } catch (error) {
      logger.error('Failed to get escrow status:', error);
      return res.status(500).json({ error: 'Failed to get payment status' });
    }
  }
}

export const paymentController = new PaymentController();
