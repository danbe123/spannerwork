/**
 * Queue Workers
 *
 * This module sets up workers to process background jobs.
 * Workers run in the same process as the main app but can be
 * separated into a dedicated worker process for scaling.
 *
 * Enhanced with:
 * - Full email tracking integration
 * - Dead Letter Queue for failed emails
 * - Circuit breaker for provider failover
 * - All email types support
 */

import { Worker, Job } from 'bullmq';
import {
  redisConnection,
  QUEUE_NAMES,
  BULL_PREFIX,
  EmailJobData,
  SmsJobData,
  NotificationJobData,
  PaymentRetryJobData,
  moveToEmailDLQ,
} from '../config/queue.js';
import { logger } from '../config/logger.js';
import { emailService } from '../services/email.service.js';
import { smsService } from '../services/sms.service.js';
import { notificationService } from '../services/notification.service.js';
import { emailTrackingService } from '../services/emailTracking.service.js';
import type { BookingReminderData } from '../emails/booking-reminder.template.js';
import type { ReviewRequestData } from '../emails/review-request.template.js';
import type { PayoutCompletedData } from '../emails/payout-completed.template.js';
import type { WeeklyEarningsSummaryData } from '../emails/weekly-earnings-summary.template.js';
import Stripe from 'stripe';
import { prisma } from '../config/database.js';

// Lazy initialization of Stripe for payment retry worker
let stripeInstance: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    stripeInstance = new Stripe(secretKey);
  }
  return stripeInstance;
}

// Email Worker - handles all email types with tracking
export const emailWorker = new Worker<EmailJobData>(
  QUEUE_NAMES.EMAIL,
  async (job: Job<EmailJobData>) => {
    const { type, to, data } = job.data;

    logger.info(`Processing email job ${job.id}: ${type} to ${to}`);

    // Mark as processing in tracking
    await emailTrackingService.markProcessing(job.id!);

    try {
      // Process based on email type
      await processEmailByType(type, to, data);

      // Mark as sent in tracking
      await emailTrackingService.markSent({
        jobId: job.id!,
        status: 'SENT',
        provider: 'mailtrap', // or get from response
      });

      logger.info(`Email job ${job.id} completed successfully`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Email job ${job.id} failed:`, error);

      // Track the failure
      await emailTrackingService.markFailed(job.id!, errorMessage);

      throw error;
    }
  },
  {
    connection: redisConnection,
    prefix: BULL_PREFIX,
    concurrency: 5,
    limiter: {
      max: 100,
      duration: 60000,
    },
  }
);

/**
 * Process email based on type - comprehensive handler for all templates
 */
async function processEmailByType(
  type: string,
  to: string,
  data: Record<string, unknown>
): Promise<void> {
  switch (type) {
    // Auth & Account emails
    case 'verification':
      await emailService.sendEmailVerificationEmail(to, data.token as string, data.name as string | undefined);
      break;

    case 'password-reset':
      await emailService.sendPasswordResetEmail(to, data.token as string);
      break;

    case 'magic-link':
      await emailService.sendMagicLinkEmail(to, data.token as string);
      break;

    case 'welcome':
      await emailService.sendWelcomeEmail(to, data.name as string | null);
      break;

    // Booking emails
    case 'booking-confirmation':
      await emailService.sendBookingConfirmationEmail(to, {
        userName: data.userName as string | null,
        resourceName: data.resourceName as string,
        resourceType: data.resourceType as 'tool' | 'space' | 'service',
        startDate: new Date(data.startDate as string),
        endDate: new Date(data.endDate as string),
        totalAmount: data.totalAmount as number,
        transactionId: data.transactionId as string,
      });
      break;

    case 'booking-cancellation':
      await emailService.sendBookingCancellationEmail(to, {
        userName: data.userName as string | null,
        resourceName: data.resourceName as string,
        resourceType: data.resourceType as 'tool' | 'space' | 'service',
        startDate: new Date(data.startDate as string),
        endDate: new Date(data.endDate as string),
        cancelledBy: data.cancelledBy as 'user' | 'provider',
        transactionId: data.transactionId as string,
      });
      break;

    case 'booking-reminder':
      await emailService.sendBookingReminderEmail(to, data as unknown as BookingReminderData);
      break;

    case 'review-request':
      await emailService.sendReviewRequestEmail(to, data as unknown as ReviewRequestData);
      break;

    // Payment emails
    case 'payout-completed':
      await emailService.sendPayoutCompletedEmail(to, data as unknown as PayoutCompletedData);
      break;

    case 'payment-failed':
      await emailService.sendPaymentFailedEmail(to, {
        userName: data.userName as string | null,
        transactionId: data.transactionId as string,
        amount: data.amount as number,
        errorMessage: data.errorMessage as string,
      });
      break;

    case 'refund-confirmation':
      await emailService.sendRefundConfirmationEmail(to, {
        userName: data.userName as string | null,
        transactionId: data.transactionId as string,
        amount: data.amount as number,
      });
      break;

    case 'refund-notification-provider':
      await emailService.sendRefundNotificationToProviderEmail(to, {
        providerName: data.providerName as string | null,
        transactionId: data.transactionId as string,
        amount: data.amount as number,
      });
      break;

    // Summary emails
    case 'weekly-earnings-summary':
      await emailService.sendWeeklyEarningsSummaryEmail(to, data as unknown as WeeklyEarningsSummaryData);
      break;

    // Dispute & Alert emails
    case 'dispute-alert':
      await emailService.sendDisputeAlertEmail(to, {
        adminName: data.adminName as string | null,
        disputeId: data.disputeId as string,
        chargeId: data.chargeId as string,
        amount: data.amount as number,
        reason: data.reason as string,
        transactionId: data.transactionId as string | undefined,
        customerEmail: data.customerEmail as string | undefined,
        providerEmail: data.providerEmail as string | undefined,
        evidenceDueBy: data.evidenceDueBy ? new Date(data.evidenceDueBy as string) : undefined,
      });
      break;

    case 'rate-limit-alert':
      await emailService.sendRateLimitAlertEmail(to, {
        timestamp: data.timestamp as string,
        returnPath: data.returnPath as string,
        userAgent: data.userAgent as string | undefined,
        ip: data.ip as string | undefined,
        userId: data.userId as string | undefined,
        userEmail: data.userEmail as string | undefined,
      });
      break;

    // Insurance emails
    case 'insurance-status':
      await emailService.sendInsuranceStatusUpdateEmail(to, {
        userName: data.userName as string | null,
        status: data.status as 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'PENDING_REVIEW',
        rejectionReason: data.rejectionReason as string | null | undefined,
      });
      break;

    case 'insurance-expiry-reminder':
      await emailService.sendInsuranceExpiryReminderEmail(to, {
        userName: data.userName as string | null,
        documentType: data.documentType as string,
        expiryDate: new Date(data.expiryDate as string),
        daysUntilExpiry: data.daysUntilExpiry as number,
      });
      break;

    // Stripe emails
    case 'stripe-account-issue':
      await emailService.sendStripeAccountIssueEmail(to, {
        userName: data.userName as string | null,
        issue: data.issue as string,
        requirements: data.requirements as string[],
      });
      break;

    // Contact emails
    case 'contact-notification':
      await emailService.sendContactNotification(
        data.name as string,
        data.fromEmail as string,
        data.subject as string,
        data.message as string
      );
      break;

    case 'contact-confirmation':
      await emailService.sendContactConfirmation(to, data.name as string);
      break;

    // Referral emails
    case 'referral-invitation':
      await emailService.sendReferralInvitation(
        to,
        data.referrerName as string | null,
        data.referralCode as string
      );
      break;

    // Team invitation (B2B)
    case 'team-invitation':
      await emailService.sendTeamInvitation({
        to,
        invitedByName: data.invitedByName as string,
        companyName: data.companyName as string,
        acceptUrl: data.acceptUrl as string,
      });
      break;

    // Generic notification
    case 'notification':
      await emailService.sendNotificationEmail(
        to,
        data.userName as string,
        data.title as string,
        data.body as string
      );
      break;

    default:
      logger.warn(`Unknown email type: ${type}`);
      throw new Error(`Unknown email type: ${type}`);
  }
}

// SMS Worker
export const smsWorker = new Worker<SmsJobData>(
  QUEUE_NAMES.SMS,
  async (job: Job<SmsJobData>) => {
    const { type, to, message } = job.data;

    logger.info(`Processing SMS job ${job.id}: ${type} to ${to}`);

    try {
      await smsService.sendSms({ to, body: message });

      logger.info(`SMS job ${job.id} completed successfully`);
      return { success: true };
    } catch (error) {
      logger.error(`SMS job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    prefix: BULL_PREFIX,
    concurrency: 3, // Process 3 SMS at a time
    limiter: {
      max: 30,
      duration: 60000, // Max 30 SMS per minute
    },
  }
);

// Notification Worker
export const notificationWorker = new Worker<NotificationJobData>(
  QUEUE_NAMES.NOTIFICATIONS,
  async (job: Job<NotificationJobData>) => {
    const { type, userId, title, body, data } = job.data;

    logger.info(`Processing notification job ${job.id}: ${type} for user ${userId}`);

    try {
      // Send push notification using the notification service
      await notificationService.sendToUser(userId, {
        title,
        body,
        tag: type,
        data: data as Record<string, unknown> | undefined,
      });

      // Handle specific notification types with templates for richer notifications
      if (type === 'push') {
        const notificationTag = (data as Record<string, unknown> | undefined)?.tag;
        switch (notificationTag) {
          case 'new-message':
            if (data?.senderName && data?.preview) {
              await notificationService.notifyNewMessage(
                userId,
                data.senderName as string,
                data.preview as string
              );
            }
            break;

          case 'booking-confirmed':
            if (data?.resourceName) {
              await notificationService.notifyBookingConfirmed(userId, data.resourceName as string);
            }
            break;

          case 'booking-cancelled':
            if (data?.resourceName) {
              await notificationService.notifyBookingCancelled(userId, data.resourceName as string);
            }
            break;

          case 'booking-request':
            if (data?.resourceName && data?.requesterName) {
              await notificationService.notifyNewBookingRequest(
                userId,
                data.resourceName as string,
                data.requesterName as string
              );
            }
            break;

          case 'payment-received':
            if (data?.amount) {
              await notificationService.notifyPaymentReceived(userId, data.amount as number);
            }
            break;

          case 'review-received':
            if (data?.rating && data?.reviewerName) {
              await notificationService.notifyReviewReceived(
                userId,
                data.rating as number,
                data.reviewerName as string
              );
            }
            break;

          case 'dispute-update':
            if (data?.status) {
              await notificationService.notifyDisputeUpdate(userId, data.status as string);
            }
            break;

          case 'referral-completed':
            if (data?.referredName) {
              await notificationService.notifyReferralCompleted(userId, data.referredName as string);
            }
            break;

          default:
            // Generic notification already sent above
            logger.debug(`Generic notification sent for type: ${type}`);
        }
      }

      logger.info(`Notification job ${job.id} completed successfully`);
      return { success: true };
    } catch (error) {
      logger.error(`Notification job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    prefix: BULL_PREFIX,
    concurrency: 10,
  }
);

// Payment Retry Worker - handles failed payment reimbursements with exponential backoff
export const paymentRetryWorker = new Worker<PaymentRetryJobData>(
  QUEUE_NAMES.PAYMENT_RETRY,
  async (job: Job<PaymentRetryJobData>) => {
    const { type, transactionId, amount, destinationAccountId, description } = job.data;

    logger.info(`Processing payment retry job ${job.id}: ${type} for transaction ${transactionId}`);

    try {
      // Verify the transaction still exists and needs reimbursement
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        select: {
          id: true,
          status: true,
          instantPayoutFeeReimbursed: true,
        },
      });

      if (!transaction) {
        logger.warn(`Transaction ${transactionId} not found for payment retry`);
        return { success: false, reason: 'transaction_not_found' };
      }

      // Check if already reimbursed (idempotency check)
      if (transaction.instantPayoutFeeReimbursed) {
        logger.info(`Transaction ${transactionId} already reimbursed, skipping`);
        return { success: true, reason: 'already_reimbursed' };
      }

      // Create a transfer to reimburse the provider
      const transfer = await getStripe().transfers.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'gbp',
        destination: destinationAccountId,
        description,
        metadata: {
          transactionId,
          type: 'instant_payout_fee_reimbursement',
          attemptNumber: String(job.attemptsMade + 1),
        },
      });

      // Mark as reimbursed in the database
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          instantPayoutFeeReimbursed: true,
          instantPayoutFeeReimbursedAt: new Date(),
          instantPayoutFeeTransferId: transfer.id,
        },
      });

      logger.info(`Payment retry job ${job.id} completed: transfer ${transfer.id} created`);
      return { success: true, transferId: transfer.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Payment retry job ${job.id} failed:`, error);

      // For Stripe errors, check if retryable
      if (error instanceof Stripe.errors.StripeError) {
        // Non-retryable errors - fail immediately
        const nonRetryableTypes = ['invalid_request_error', 'authentication_error'];
        if (nonRetryableTypes.includes(error.type)) {
          logger.error(`Non-retryable Stripe error for job ${job.id}: ${error.type}`);
          // Don't throw - return failure and don't retry
          return { success: false, reason: error.type, message: errorMessage };
        }
      }

      throw error; // Will trigger retry with exponential backoff
    }
  },
  {
    connection: redisConnection,
    prefix: BULL_PREFIX,
    concurrency: 2, // Low concurrency for payment operations
    limiter: {
      max: 10,
      duration: 60000, // Max 10 payment retries per minute
    },
  }
);

// Error handlers for workers
emailWorker.on('failed', async (job: Job<EmailJobData> | undefined, err: Error) => {
  logger.error(`Email worker failed for job ${job?.id}:`, err);

  // Move to DLQ after max attempts exhausted
  if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
    try {
      await moveToEmailDLQ(job, err);
      logger.warn(`Email job ${job.id} moved to DLQ after ${job.attemptsMade} failed attempts`);
    } catch (dlqError) {
      logger.error(`Failed to move job ${job.id} to DLQ:`, dlqError);
    }
  }
});

smsWorker.on('failed', (job: Job<SmsJobData> | undefined, err: Error) => {
  logger.error(`SMS worker failed for job ${job?.id}:`, err);
});

notificationWorker.on('failed', (job: Job<NotificationJobData> | undefined, err: Error) => {
  logger.error(`Notification worker failed for job ${job?.id}:`, err);
});

paymentRetryWorker.on('failed', (job: Job<PaymentRetryJobData> | undefined, err: Error) => {
  logger.error(`Payment retry worker failed for job ${job?.id}:`, err);

  // Log critical failure for manual review after all retries exhausted
  if (job && job.attemptsMade >= (job.opts.attempts ?? 5)) {
    logger.error('CRITICAL: Payment reimbursement failed after all retries', {
      jobId: job.id,
      transactionId: job.data.transactionId,
      amount: job.data.amount,
      attempts: job.attemptsMade,
      error: err.message,
    });
  }
});

// Graceful shutdown
export async function closeWorkers() {
  await Promise.all([
    emailWorker.close(),
    smsWorker.close(),
    notificationWorker.close(),
    paymentRetryWorker.close(),
  ]);

  logger.info('All workers closed');
}

// Start workers
export function startWorkers() {
  logger.info('Starting queue workers...');

  // Workers start automatically when created, but we log for visibility
  logger.info(`Email worker started (concurrency: 5)`);
  logger.info(`SMS worker started (concurrency: 3)`);
  logger.info(`Notification worker started (concurrency: 10)`);
  logger.info(`Payment retry worker started (concurrency: 2)`);
}

/**
 * Worker Health Status
 */
export interface WorkerHealthStatus {
  name: string;
  running: boolean;
  paused: boolean;
  concurrency: number;
}

export interface WorkersHealthReport {
  healthy: boolean;
  workers: WorkerHealthStatus[];
  timestamp: string;
}

/**
 * Get health status of all workers
 */
export async function getWorkersHealth(): Promise<WorkersHealthReport> {
  const workers = [
    { worker: emailWorker, name: 'email', concurrency: 5 },
    { worker: smsWorker, name: 'sms', concurrency: 3 },
    { worker: notificationWorker, name: 'notifications', concurrency: 10 },
    { worker: paymentRetryWorker, name: 'payment-retry', concurrency: 2 },
  ];
  
  const statuses: WorkerHealthStatus[] = await Promise.all(
    workers.map(async ({ worker, name, concurrency }) => {
      try {
        const isPaused = await worker.isPaused();
        const isRunning = worker.isRunning();
        
        return {
          name,
          running: isRunning,
          paused: isPaused,
          concurrency,
        };
      } catch (error) {
        logger.error(`Error checking ${name} worker health:`, error);
        return {
          name,
          running: false,
          paused: true,
          concurrency,
        };
      }
    })
  );
  
  // All workers should be running and not paused
  const healthy = statuses.every(s => s.running && !s.paused);
  
  return {
    healthy,
    workers: statuses,
    timestamp: new Date().toISOString(),
  };
}
