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
import { env } from '../config/env.js';
import { queuePaymentReimbursement } from '../config/queue.js';

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
   * FIX #5: Added validation for transaction status and existing payment intent
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

      // FIX #5: Validate transaction status before creating payment intent
      if (transaction.status === 'CANCELLED') {
        return res.status(400).json({
          error: 'Transaction cancelled',
          message: 'Cannot create payment for a cancelled transaction.',
        });
      }

      if (transaction.status === 'COMPLETED') {
        return res.status(400).json({
          error: 'Transaction completed',
          message: 'This transaction has already been completed.',
        });
      }

      // Check if payment intent already exists
      if (transaction.stripePaymentIntentId) {
        // Return existing payment intent details
        try {
          const existingIntent = await stripeService.getPaymentIntent(transaction.stripePaymentIntentId);

          // Verify the existing payment intent amount matches the current transaction total
          // This prevents stale payment intents after add-ons changed
          if (existingIntent.amount !== transaction.totalAmount) {
            logger.warn('Payment intent amount mismatch', {
              transactionId,
              intentAmount: existingIntent.amount,
              transactionAmount: transaction.totalAmount,
            });
            return res.status(409).json({
              error: 'Price changed',
              message: 'The total amount has changed since payment was initiated. Please refresh the page and try again.',
              expectedAmount: transaction.totalAmount,
              currentIntentAmount: existingIntent.amount,
            });
          }

          return res.json({
            clientSecret: existingIntent.clientSecret,
            paymentIntentId: existingIntent.paymentIntentId,
            amount: existingIntent.amount,
            currency: existingIntent.currency,
            existing: true,
          });
        } catch {
          // If existing intent is invalid, we'll create a new one
          logger.warn(`Existing payment intent ${transaction.stripePaymentIntentId} not found, creating new one`);
        }
      }

      // FIX #5: Check payment status
      if (transaction.paymentStatus === 'PAID') {
        return res.status(400).json({
          error: 'Already paid',
          message: 'This transaction has already been paid.',
        });
      }

      if (transaction.paymentStatus === 'REFUNDED') {
        return res.status(400).json({
          error: 'Payment refunded',
          message: 'This transaction has been refunded.',
        });
      }

      if (!transaction.provider?.stripeConnectId) {
        return res.status(400).json({
          error: 'Provider not set up for payments',
          message: 'The provider has not set up their payment account yet.',
        });
      }

      const applicationFeeAmount = (transaction as unknown as { applicationFeeAmount?: number }).applicationFeeAmount;

      // Create payment intent
      const paymentIntent = await stripeService.createPaymentIntent({
        transactionId: transaction.id,
        amount: transaction.totalAmount,
        providerAccountId: transaction.provider.stripeConnectId,
        applicationFeeAmount: typeof applicationFeeAmount === 'number' ? applicationFeeAmount : transaction.platformFee,
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
   * FIX #2: Uses atomic transaction with optimistic locking to prevent double refunds
   * FIX #15: Uses paidAt date for accurate refund window calculation
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

      // FIX #2: Use atomic transaction with optimistic locking to prevent double refunds
      let refundResult: { refundId: string; amount: number; status: string };

      try {
        refundResult = await prisma.$transaction(async (tx) => {
          // Fetch transaction with version for optimistic locking
          const transaction = await tx.transaction.findUnique({
            where: { id: transactionId },
            select: {
              id: true,
              userId: true,
              stripePaymentIntentId: true,
              paymentStatus: true,
              status: true,
              completedDate: true,
              createdDate: true,
              updatedDate: true, // Used for refund window calculation
              totalAmount: true,
              totalRefunded: true,
              version: true,
            },
          });

          if (!transaction) {
            throw { code: 'NOT_FOUND' };
          }

          if (transaction.userId !== userId) {
            throw { code: 'NOT_AUTHORIZED' };
          }

          if (transaction.paymentStatus !== 'PAID') {
            throw { code: 'NOT_PAID' };
          }

          if (!transaction.stripePaymentIntentId) {
            throw { code: 'NO_PAYMENT' };
          }

          // Check if any refund has already been processed (including partial refunds from disputes)
          const previouslyRefunded = transaction.totalRefunded || 0;
          if (previouslyRefunded > 0) {
            throw { code: 'ALREADY_REFUNDED', amount: previouslyRefunded };
          }

          // FIX: Refund window should only apply AFTER payment is captured (PAID status)
          // If payment is captured but job not completed, use the updated timestamp as payment capture time
          // If job is completed, use completedDate as the refund window start
          const REFUND_WINDOW_HOURS = 48;

          // Only apply refund window if payment has been captured (status is PAID)
          if (transaction.paymentStatus === 'PAID') {
            // Use completedDate if available (job marked done), otherwise use updatedDate
            // as an approximation of when the payment status changed to PAID
            const paymentCaptureDate = transaction.completedDate || transaction.updatedDate;
            const hoursSincePayment = (Date.now() - new Date(paymentCaptureDate).getTime()) / (1000 * 60 * 60);

            if (hoursSincePayment > REFUND_WINDOW_HOURS) {
              logger.warn('Refund request outside eligibility window', {
                transactionId,
                userId,
                hoursSincePayment: Math.round(hoursSincePayment),
                paymentCaptureDate,
              });
              throw { code: 'REFUND_WINDOW_EXPIRED' };
            }
          }
          // If payment status is PENDING, allow refund (payment not yet captured)

          if (transaction.status === 'COMPLETED') {
            throw { code: 'ALREADY_COMPLETED' };
          }

          // Check for refund abuse
          const REFUND_LIMIT = 3;
          const REFUND_PERIOD_DAYS = 30;
          const recentRefunds = await tx.transaction.count({
            where: {
              userId,
              paymentStatus: 'REFUNDED',
              updatedDate: {
                gte: new Date(Date.now() - REFUND_PERIOD_DAYS * 24 * 60 * 60 * 1000),
              },
            },
          });

          if (recentRefunds >= REFUND_LIMIT) {
            logger.warn('Refund abuse detected - limit exceeded', {
              transactionId,
              userId,
              recentRefunds,
            });
            throw { code: 'REFUND_LIMIT_EXCEEDED' };
          }

          // FIX #2: Atomically update status BEFORE calling Stripe with optimistic locking
          const updated = await tx.transaction.updateMany({
            where: {
              id: transactionId,
              version: transaction.version,
              paymentStatus: 'PAID',
            },
            data: {
              paymentStatus: 'REFUNDED',
              status: 'CANCELLED',
              totalRefunded: transaction.totalAmount || 0,
              version: { increment: 1 },
            },
          });

          if (updated.count === 0) {
            throw { code: 'CONCURRENT_MODIFICATION' };
          }

          // Now call Stripe - if this fails, the transaction rolls back
          try {
            const refund = await stripeService.createRefund({
              paymentIntentId: transaction.stripePaymentIntentId,
              reason: reason || 'requested_by_customer',
            });

            return {
              refundId: refund.refundId,
              amount: refund.amount,
              status: refund.status as string,
            };
          } catch (stripeError) {
            logger.error('Stripe refund failed, rolling back DB change', stripeError);
            throw { code: 'STRIPE_ERROR', error: stripeError };
          }
        });
      } catch (txError: unknown) {
        const errorCode = (txError as { code?: string })?.code;

        switch (errorCode) {
          case 'NOT_FOUND':
            return res.status(404).json({ error: 'Transaction not found' });
          case 'NOT_AUTHORIZED':
            return res.status(403).json({ error: 'Not authorized' });
          case 'NOT_PAID':
            return res.status(400).json({ error: 'Transaction has not been paid' });
          case 'NO_PAYMENT':
            return res.status(400).json({ error: 'No payment to refund' });
          case 'ALREADY_REFUNDED': {
            const refundedAmount = (txError as { amount?: number })?.amount || 0;
            return res.status(400).json({
              error: 'Already refunded',
              message: `A refund of £${(refundedAmount / 100).toFixed(2)} has already been processed for this transaction. Please contact support for additional refund requests.`,
            });
          }
          case 'REFUND_WINDOW_EXPIRED':
            return res.status(400).json({
              error: 'Refund window expired',
              message: 'Refunds must be requested within 48 hours of payment. Please contact support for assistance.',
            });
          case 'ALREADY_COMPLETED':
            return res.status(400).json({
              error: 'Cannot refund completed transaction',
              message: 'This transaction has been marked as completed. Please file a dispute if there was an issue.',
            });
          case 'REFUND_LIMIT_EXCEEDED':
            return res.status(400).json({
              error: 'Refund limit exceeded',
              message: 'You have reached the maximum number of refunds (3) in the last 30 days. Please contact support.',
            });
          case 'CONCURRENT_MODIFICATION':
            return res.status(409).json({
              error: 'Concurrent modification',
              message: 'This transaction was modified by another request. Please refresh and try again.',
            });
          case 'STRIPE_ERROR':
            return res.status(500).json({ error: 'Failed to process refund with payment provider' });
          default:
            throw txError;
        }
      }

      return res.json({
        refundId: refundResult.refundId,
        amount: refundResult.amount,
        status: refundResult.status,
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
   *
   * Uses optimistic locking with version field to prevent race conditions
   * and double-capture vulnerabilities.
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

      // Use atomic transaction with optimistic locking to prevent race conditions
      // This ensures no double captures even if two requests arrive simultaneously
      let captureResult: { amountCaptured: number; transferId?: string };
      // FIX #17: Added CPA fields for fee calculation
      let transaction: {
        id: string;
        userId: string;
        providerId: string | null;
        stripePaymentIntentId: string | null;
        stripeInstantPayoutId: string | null;
        paymentStatus: string;
        status: string;
        totalAmount: number;
        rentalFee: number | null;
        applicationFeeAmount: number;
        providerSponsorCpaPercent: number | null;
        renterSponsorCpaPercent: number | null;
        instantPayoutSelected: boolean;
        instantPayoutFee: number;
        provider: { stripeConnectId: string | null } | null;
      };
      let finalApplicationFeeAmount: number;

      try {
        const result = await prisma.$transaction(async (tx) => {
          // Fetch transaction with version for optimistic locking
          // FIX #17: Include CPA percentages and rentalFee for fee calculation
          const txn = await tx.transaction.findUnique({
            where: { id: transactionId },
            select: {
              id: true,
              userId: true,
              providerId: true,
              stripePaymentIntentId: true,
              stripeInstantPayoutId: true,
              paymentStatus: true,
              status: true,
              totalAmount: true,
              rentalFee: true,
              applicationFeeAmount: true,
              providerSponsorCpaPercent: true,
              renterSponsorCpaPercent: true,
              instantPayoutSelected: true,
              instantPayoutFee: true,
              version: true,
              provider: {
                select: {
                  stripeConnectId: true,
                },
              },
            },
          });

          if (!txn) {
            throw { code: 'NOT_FOUND' };
          }

          // Only the customer (userId) can confirm job completion and release payment
          if (txn.userId !== userId) {
            throw { code: 'NOT_AUTHORIZED' };
          }

          if (!txn.stripePaymentIntentId) {
            throw { code: 'NO_PAYMENT' };
          }

          // Verify transaction status allows capture
          if (txn.status === 'CANCELLED') {
            throw { code: 'CANCELLED' };
          }

          if (txn.status === 'COMPLETED') {
            throw { code: 'ALREADY_COMPLETED' };
          }

          if (txn.paymentStatus === 'REFUNDED') {
            throw { code: 'REFUNDED' };
          }

          if (txn.paymentStatus === 'PAID') {
            throw { code: 'ALREADY_PAID' };
          }

          // Check escrow status before capturing
          const escrowStatus = await stripeService.getEscrowStatus(txn.stripePaymentIntentId);

          if (!escrowStatus.requiresCapture) {
            if (escrowStatus.status === 'succeeded') {
              throw { code: 'ALREADY_CAPTURED' };
            }
            throw { code: 'NOT_IN_ESCROW' };
          }

          // Verify provider's Stripe account can receive payments before capture
          // This prevents capturing payment that cannot be transferred to provider
          const providerStripeId = txn.provider?.stripeConnectId;
          if (providerStripeId) {
            const accountStatus = await stripeService.getAccountStatus(providerStripeId);
            if (!accountStatus.payoutsEnabled) {
              throw { code: 'PROVIDER_PAYOUTS_DISABLED' };
            }
          }

          // FIX #17: Calculate CPA fees and update application fee before capture
          // This ensures sponsor CPA fees are captured in the platform fee
          const rentalFee = Number(txn.rentalFee || 0);
          const currentAppFee = Number(txn.applicationFeeAmount || 0);

          // Calculate provider sponsor fee (deducted from their earnings)
          const providerSponsorCpaFee = Math.round(
            rentalFee * ((txn.providerSponsorCpaPercent || 0) / 100)
          );

          // Calculate renter sponsor fee (added to their invoice)
          const renterSponsorCpaFee = Math.round(
            rentalFee * ((txn.renterSponsorCpaPercent || 0) / 100)
          );

          // Both sponsor fees go to platform (add to applicationFeeAmount)
          const totalCpaFees = providerSponsorCpaFee + renterSponsorCpaFee;
          const updatedApplicationFeeAmount = currentAppFee + totalCpaFees;

          // FIX: Validate CPA fees don't cause application fee to exceed total amount
          // Stripe will reject if application_fee_amount > total payment amount
          const totalAmount = Number(txn.totalAmount || 0);
          if (updatedApplicationFeeAmount > totalAmount) {
            logger.error('CPA fee overflow detected - fees exceed total amount', {
              transactionId,
              totalAmount,
              currentAppFee,
              totalCpaFees,
              updatedApplicationFeeAmount,
              providerSponsorCpaPercent: txn.providerSponsorCpaPercent,
              renterSponsorCpaPercent: txn.renterSponsorCpaPercent,
            });
            throw { code: 'FEE_OVERFLOW' };
          }

          // Update Stripe PaymentIntent with new application fee before capture
          if (totalCpaFees > 0) {
            await stripeService.updateApplicationFee(
              txn.stripePaymentIntentId,
              updatedApplicationFeeAmount
            );
          }

          // Capture the payment via Stripe
          const capture = await stripeService.capturePayment({
            paymentIntentId: txn.stripePaymentIntentId,
          });

          // Atomic update with version check (optimistic locking)
          // This prevents race conditions where two requests try to capture simultaneously
          // FIX #17: Include CPA fee amounts in the update
          const updated = await tx.transaction.updateMany({
            where: {
              id: transactionId,
              version: txn.version, // Only update if version matches
              status: { notIn: ['COMPLETED', 'CANCELLED'] }, // Double-check status
              paymentStatus: { notIn: ['PAID', 'REFUNDED'] }, // Double-check payment status
            },
            data: {
              paymentStatus: 'PAID',
              status: 'COMPLETED',
              completedDate: new Date(),
              stripeTransferId: capture.transferId,
              applicationFeeAmount: updatedApplicationFeeAmount,
              providerSponsorCpaFee,
              renterSponsorCpaFee,
              version: { increment: 1 }, // Increment version for next update
            },
          });

          if (updated.count === 0) {
            // Another request beat us to it - the transaction was modified
            throw { code: 'CONCURRENT_MODIFICATION' };
          }

          // FIX #17: Return the updated application fee amount for correct net calculation
          return { transaction: txn, captureResult: capture, updatedApplicationFeeAmount };
        });

        transaction = result.transaction;
        captureResult = result.captureResult;
        finalApplicationFeeAmount = result.updatedApplicationFeeAmount;
      } catch (txError: unknown) {
        // Handle specific error codes from the transaction
        const errorCode = (txError as { code?: string })?.code;

        switch (errorCode) {
          case 'NOT_FOUND':
            return res.status(404).json({ error: 'Transaction not found' });
          case 'NOT_AUTHORIZED':
            return res.status(403).json({
              error: 'Not authorized',
              message: 'Only the customer can confirm job completion and release payment.',
            });
          case 'NO_PAYMENT':
            return res.status(400).json({ error: 'No payment to capture' });
          case 'CANCELLED':
            return res.status(400).json({
              error: 'Transaction cancelled',
              message: 'Cannot capture payment on a cancelled transaction.',
            });
          case 'ALREADY_COMPLETED':
            return res.status(400).json({
              error: 'Transaction already completed',
              message: 'This transaction has already been completed.',
            });
          case 'REFUNDED':
            return res.status(400).json({
              error: 'Payment refunded',
              message: 'Cannot capture a refunded payment.',
            });
          case 'ALREADY_PAID':
            return res.status(400).json({
              error: 'Already paid',
              message: 'This payment has already been captured.',
            });
          case 'ALREADY_CAPTURED':
            return res.status(400).json({
              error: 'Payment already captured',
              message: 'This payment has already been completed.',
            });
          case 'NOT_IN_ESCROW':
            return res.status(400).json({
              error: 'Payment not in escrow',
              message: 'This payment is not ready for capture.',
            });
          case 'PROVIDER_PAYOUTS_DISABLED':
            return res.status(400).json({
              error: 'Provider cannot receive payments',
              message: 'The provider\'s payment account is not enabled. Please contact support.',
            });
          case 'CONCURRENT_MODIFICATION':
            return res.status(409).json({
              error: 'Concurrent modification',
              message: 'This transaction was modified by another request. Please refresh and try again.',
            });
          case 'FEE_OVERFLOW':
            return res.status(400).json({
              error: 'Fee calculation error',
              message: 'The sponsor fees exceed the total payment amount. Please contact support.',
            });
          default:
            throw txError; // Re-throw for generic error handling
        }
      }

      let instantPayoutAttempted = false;
      let instantPayoutSucceeded = false;
      let instantPayoutPayoutId: string | undefined;

      const providerAccountId = transaction.provider?.stripeConnectId || undefined;
      if (
        transaction.instantPayoutSelected &&
        transaction.instantPayoutFee > 0 &&
        providerAccountId
      ) {
        instantPayoutAttempted = true;
        if (transaction.stripeInstantPayoutId) {
          instantPayoutSucceeded = true;
          instantPayoutPayoutId = transaction.stripeInstantPayoutId;
        } else {
          // FIX #17: Use the updated application fee amount that includes CPA fees
          const providerNetAmount = captureResult.amountCaptured - finalApplicationFeeAmount;

          if (providerNetAmount > 0) {
            try {
              const accountStatus = await stripeService.getAccountStatus(providerAccountId);
              if (!accountStatus.payoutsEnabled) {
                throw new Error('Provider payouts are not enabled');
              }

              const payout = await stripeService.createInstantPayout({
                stripeAccountId: providerAccountId,
                amount: providerNetAmount,
                transactionId: transaction.id,
                idempotencyKey: `instant_payout:${transaction.id}`,
              });
              instantPayoutSucceeded = true;
              instantPayoutPayoutId = payout.payoutId;

              await prisma.transaction.update({
                where: { id: transactionId },
                data: { stripeInstantPayoutId: payout.payoutId },
              });
            } catch (error) {
              logger.warn(
                `Instant payout failed for transaction ${transaction.id}. Falling back to standard payout schedule.`,
                error
              );

              // FIX #9: Properly handle instant payout failure with queue-based retry
              // The customer paid for instant payout but it didn't work
              // We need to: 1) Queue reimbursement with retries, 2) Notify both parties, 3) Track the failure
              let reimbursementQueued = false;

              try {
                // Queue the reimbursement with automatic retries
                // This ensures the provider gets their fee back even if Stripe is temporarily unavailable
                await queuePaymentReimbursement({
                  transactionId: transaction.id,
                  amount: transaction.instantPayoutFee,
                  destinationAccountId: providerAccountId,
                  description: 'Instant payout fee reimbursement - instant payout unavailable',
                });
                reimbursementQueued = true;

                // Mark the fee as pending reimbursement
                await prisma.transaction.update({
                  where: { id: transaction.id },
                  data: {
                    notes: `${transaction.stripeInstantPayoutId || ''}\n[SYSTEM] Instant payout failed - fee reimbursement queued`.trim(),
                  },
                });
              } catch (queueError) {
                logger.error(
                  `CRITICAL: Failed to queue instant payout fee reimbursement for transaction ${transaction.id}`,
                  queueError
                );
              }

              // Notify the provider about the instant payout failure
              try {
                const { unifiedNotificationService } = await import('../services/unifiedNotification.service.js');
                await unifiedNotificationService.send({
                  userId: transaction.providerId!,
                  type: 'payment_issue',
                  title: 'Instant Payout Unavailable',
                  body: reimbursementQueued
                    ? `Instant payout for your recent job couldn't be processed. Your funds will arrive via standard payout (1-2 business days). The instant payout fee reimbursement is being processed automatically.`
                    : `Instant payout for your recent job couldn't be processed. Your funds will arrive via standard payout (1-2 business days). Please contact support regarding the instant payout fee.`,
                });
              } catch (notifyError) {
                logger.warn('Failed to notify provider about instant payout failure:', notifyError);
              }
            }
          }
        }
      }

      logger.info(`Payment captured for transaction ${transactionId}, transfer: ${captureResult.transferId}`);

      return res.json({
        success: true,
        message: 'Payment released to provider',
        amountCaptured: captureResult.amountCaptured,
        transferId: captureResult.transferId,
        instantPayoutAttempted,
        instantPayoutSucceeded,
        instantPayoutPayoutId,
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

  async createSubscriptionCheckout(req: Request, res: Response) {
    try {
      if (!stripeService.isEnabled()) {
        return res.status(503).json({
          error: 'Payment service unavailable',
          message: 'Stripe is not configured.',
        });
      }

      const userId = req.user?.id;
      const email = req.user?.email;
      if (!userId || !email) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { plan } = req.body as { plan: 'PRO' | 'BUSINESS' };

      const successUrl = `${env.FRONTEND_URL}/profile?subscription=success`;
      const cancelUrl = `${env.FRONTEND_URL}/profile?subscription=cancel`;

      const session = await stripeService.createSubscriptionCheckoutSession({
        userId,
        email,
        plan,
        successUrl,
        cancelUrl,
      });

      return res.json(session);
    } catch (error) {
      logger.error('Failed to create subscription checkout session:', error);
      return res.status(500).json({ error: 'Failed to create subscription checkout session' });
    }
  }

  async createSubscriptionPortal(req: Request, res: Response) {
    try {
      if (!stripeService.isEnabled()) {
        return res.status(503).json({
          error: 'Payment service unavailable',
          message: 'Stripe is not configured.',
        });
      }

      const userId = req.user?.id;
      const email = req.user?.email;
      if (!userId || !email) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { returnUrl } = req.body as { returnUrl?: string };
      const portalSession = await stripeService.createBillingPortalSession({
        userId,
        email,
        returnUrl: returnUrl || `${env.FRONTEND_URL}/profile`,
      });

      return res.json(portalSession);
    } catch (error) {
      logger.error('Failed to create billing portal session:', error);
      return res.status(500).json({ error: 'Failed to create billing portal session' });
    }
  }
}

export const paymentController = new PaymentController();
