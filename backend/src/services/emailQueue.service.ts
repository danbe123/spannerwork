/**
 * Unified Email Queue Service
 *
 * This is the SINGLE entry point for ALL emails in the system.
 * Every email goes through the queue - no exceptions.
 *
 * Features:
 * - Automatic priority based on email type
 * - Email tracking with database persistence
 * - Idempotency to prevent duplicate sends
 * - Bounce suppression
 * - Integration with circuit breaker for provider failover
 */

import { v4 as uuidv4 } from 'uuid';
import { queueEmail, EmailType, EMAIL_PRIORITY } from '../config/queue.js';
import { emailTrackingService, DuplicateEmailError } from './emailTracking.service.js';
import { logger } from '../config/logger.js';
import { EmailPriority } from '@prisma/client';
import type { BookingReminderData } from '../emails/booking-reminder.template.js';
import type { ReviewRequestData } from '../emails/review-request.template.js';
import type { PayoutCompletedData } from '../emails/payout-completed.template.js';
import type { WeeklyEarningsSummaryData } from '../emails/weekly-earnings-summary.template.js';

interface QueueEmailOptions {
  delay?: number;
  priority?: number;
  idempotencyKey?: string;
  userId?: string;
}

interface QueueResult {
  success: boolean;
  jobId?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Map email type to database priority enum
 */
function mapPriorityToEnum(priority: number): EmailPriority {
  switch (priority) {
    case EMAIL_PRIORITY.CRITICAL:
      return EmailPriority.CRITICAL;
    case EMAIL_PRIORITY.HIGH:
      return EmailPriority.HIGH;
    case EMAIL_PRIORITY.LOW:
      return EmailPriority.LOW;
    default:
      return EmailPriority.NORMAL;
  }
}

/**
 * Core queue function - all emails flow through here
 */
async function queueEmailWithTracking(
  type: EmailType,
  to: string,
  data: Record<string, unknown>,
  options: QueueEmailOptions = {}
): Promise<QueueResult> {
  const idempotencyKey = options.idempotencyKey ?? `${type}:${to}:${Date.now()}`;

  try {
    // Check if email is suppressed (bounced)
    const isSuppressed = await emailTrackingService.isEmailSuppressed(to);
    if (isSuppressed) {
      logger.warn(`Email to ${to} skipped: address is suppressed (bounced)`);
      return {
        success: false,
        skipped: true,
        reason: 'Email address is suppressed due to previous bounces',
      };
    }

    // Check idempotency to prevent duplicates
    const canSend = await emailTrackingService.checkIdempotency(idempotencyKey);
    if (!canSend) {
      logger.info(`Email ${type} to ${to} skipped: duplicate (idempotency key: ${idempotencyKey})`);
      return {
        success: false,
        skipped: true,
        reason: 'Duplicate email prevented by idempotency check',
      };
    }

    // Generate unique job ID
    const jobId = `email-${uuidv4()}`;

    // Queue the email
    const job = await queueEmail(
      {
        type,
        to,
        data,
        userId: options.userId,
        idempotencyKey,
      },
      {
        delay: options.delay,
        priority: options.priority,
        jobId,
      }
    );

    // Create tracking log entry
    await emailTrackingService.createEmailLog({
      jobId: job.id ?? jobId,
      type,
      recipientEmail: to,
      recipientId: options.userId,
      priority: mapPriorityToEnum(options.priority ?? EMAIL_PRIORITY.NORMAL),
      metadata: data,
      idempotencyKey,
    });

    logger.debug(`Email queued: ${type} to ${to} (job: ${job.id})`);
    return {
      success: true,
      jobId: job.id,
    };
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      return {
        success: false,
        skipped: true,
        reason: 'Duplicate email prevented',
      };
    }

    logger.error(`Failed to queue email ${type} to ${to}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Unified Email Queue Service
 *
 * Use these methods instead of calling emailService directly.
 * They ensure ALL emails go through the queue with proper tracking.
 */
export const emailQueueService = {
  // ========================================
  // Auth & Account Emails
  // ========================================

  async queueVerificationEmail(to: string, token: string, name?: string, userId?: string) {
    return queueEmailWithTracking(
      'verification',
      to,
      { token, name },
      { userId, idempotencyKey: `verification:${to}:${token}` }
    );
  },

  async queuePasswordResetEmail(to: string, token: string) {
    return queueEmailWithTracking(
      'password-reset',
      to,
      { token },
      { idempotencyKey: `password-reset:${to}:${token}` }
    );
  },

  async queueMagicLinkEmail(to: string, token: string) {
    return queueEmailWithTracking(
      'magic-link',
      to,
      { token },
      { idempotencyKey: `magic-link:${to}:${token}` }
    );
  },

  async queueWelcomeEmail(to: string, name: string | null, userId?: string) {
    return queueEmailWithTracking(
      'welcome',
      to,
      { name },
      { userId, delay: 5000 } // 5 second delay to ensure registration is complete
    );
  },

  // ========================================
  // Booking Emails
  // ========================================

  async queueBookingConfirmationEmail(
    to: string,
    data: {
      userName: string | null;
      resourceName: string;
      resourceType: 'tool' | 'space' | 'service';
      startDate: Date;
      endDate: Date;
      totalAmount: number;
      transactionId: string;
    },
    userId?: string
  ) {
    return queueEmailWithTracking(
      'booking-confirmation',
      to,
      {
        ...data,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
      },
      { userId, idempotencyKey: `booking-confirmation:${data.transactionId}:${to}` }
    );
  },

  async queueBookingCancellationEmail(
    to: string,
    data: {
      userName: string | null;
      resourceName: string;
      resourceType: 'tool' | 'space' | 'service';
      startDate: Date;
      endDate: Date;
      cancelledBy: 'user' | 'provider';
      transactionId: string;
    },
    userId?: string
  ) {
    return queueEmailWithTracking(
      'booking-cancellation',
      to,
      {
        ...data,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
      },
      { userId, idempotencyKey: `booking-cancellation:${data.transactionId}:${to}` }
    );
  },

  async queueBookingReminderEmail(to: string, data: BookingReminderData, userId?: string) {
    return queueEmailWithTracking(
      'booking-reminder',
      to,
      data as unknown as Record<string, unknown>,
      { userId, idempotencyKey: `booking-reminder:${data.transactionId}:${to}` }
    );
  },

  async queueReviewRequestEmail(to: string, data: ReviewRequestData, userId?: string) {
    return queueEmailWithTracking(
      'review-request',
      to,
      data as unknown as Record<string, unknown>,
      { userId, idempotencyKey: `review-request:${data.transactionId}:${to}`, delay: 3600000 } // 1 hour delay
    );
  },

  // ========================================
  // Payment Emails
  // ========================================

  async queuePayoutCompletedEmail(to: string, data: PayoutCompletedData, userId?: string) {
    return queueEmailWithTracking(
      'payout-completed',
      to,
      data as unknown as Record<string, unknown>,
      { userId, idempotencyKey: `payout:${data.payoutDate}:${to}` }
    );
  },

  async queuePaymentFailedEmail(
    to: string,
    data: {
      userName: string | null;
      transactionId: string;
      amount: number;
      errorMessage: string;
    },
    userId?: string
  ) {
    return queueEmailWithTracking(
      'payment-failed',
      to,
      data,
      { userId, idempotencyKey: `payment-failed:${data.transactionId}:${to}` }
    );
  },

  async queueRefundConfirmationEmail(
    to: string,
    data: {
      userName: string | null;
      transactionId: string;
      amount: number;
    },
    userId?: string
  ) {
    return queueEmailWithTracking(
      'refund-confirmation',
      to,
      data,
      { userId, idempotencyKey: `refund:${data.transactionId}:${to}` }
    );
  },

  async queueRefundNotificationToProviderEmail(
    to: string,
    data: {
      providerName: string | null;
      transactionId: string;
      amount: number;
    },
    userId?: string
  ) {
    return queueEmailWithTracking(
      'refund-notification-provider',
      to,
      data,
      { userId, idempotencyKey: `refund-provider:${data.transactionId}:${to}` }
    );
  },

  // ========================================
  // Summary Emails
  // ========================================

  async queueWeeklyEarningsSummaryEmail(to: string, data: WeeklyEarningsSummaryData, userId?: string) {
    return queueEmailWithTracking(
      'weekly-earnings-summary',
      to,
      data as unknown as Record<string, unknown>,
      { userId, idempotencyKey: `weekly-summary:${data.weekStart}:${to}` }
    );
  },

  // ========================================
  // Dispute & Alert Emails
  // ========================================

  async queueDisputeAlertEmail(
    to: string,
    data: {
      adminName: string | null;
      disputeId: string;
      chargeId: string;
      amount: number;
      reason: string;
      transactionId?: string;
      customerEmail?: string;
      providerEmail?: string;
      evidenceDueBy?: Date;
    }
  ) {
    return queueEmailWithTracking(
      'dispute-alert',
      to,
      {
        ...data,
        evidenceDueBy: data.evidenceDueBy?.toISOString(),
      },
      { idempotencyKey: `dispute-alert:${data.disputeId}:${to}` }
    );
  },

  async queueRateLimitAlertEmail(
    to: string,
    data: {
      timestamp: string;
      returnPath: string;
      userAgent?: string;
      ip?: string;
      userId?: string;
      userEmail?: string;
    }
  ) {
    return queueEmailWithTracking(
      'rate-limit-alert',
      to,
      data,
      { idempotencyKey: `rate-limit:${data.ip ?? 'unknown'}:${data.timestamp}` }
    );
  },

  // ========================================
  // Insurance Emails
  // ========================================

  async queueInsuranceStatusEmail(
    to: string,
    data: {
      userName: string | null;
      status: 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'PENDING_REVIEW';
      rejectionReason?: string | null;
    },
    userId?: string
  ) {
    return queueEmailWithTracking(
      'insurance-status',
      to,
      data,
      { userId, idempotencyKey: `insurance-status:${data.status}:${to}:${Date.now()}` }
    );
  },

  async queueInsuranceExpiryReminderEmail(
    to: string,
    data: {
      userName: string | null;
      documentType: string;
      expiryDate: Date;
      daysUntilExpiry: number;
    },
    userId?: string
  ) {
    return queueEmailWithTracking(
      'insurance-expiry-reminder',
      to,
      {
        ...data,
        expiryDate: data.expiryDate.toISOString(),
      },
      { userId, idempotencyKey: `insurance-expiry:${data.daysUntilExpiry}:${to}` }
    );
  },

  // ========================================
  // Stripe Emails
  // ========================================

  async queueStripeAccountIssueEmail(
    to: string,
    data: {
      userName: string | null;
      issue: string;
      requirements: string[];
    },
    userId?: string
  ) {
    return queueEmailWithTracking(
      'stripe-account-issue',
      to,
      data,
      { userId, idempotencyKey: `stripe-issue:${to}:${Date.now()}` }
    );
  },

  // ========================================
  // Contact Emails
  // ========================================

  async queueContactNotificationEmail(
    to: string,
    data: {
      name: string;
      fromEmail: string;
      subject: string;
      message: string;
    }
  ) {
    return queueEmailWithTracking(
      'contact-notification',
      to,
      data,
      { idempotencyKey: `contact:${data.fromEmail}:${Date.now()}` }
    );
  },

  async queueContactConfirmationEmail(to: string, name: string) {
    return queueEmailWithTracking(
      'contact-confirmation',
      to,
      { name },
      { idempotencyKey: `contact-confirm:${to}:${Date.now()}` }
    );
  },

  // ========================================
  // Referral Emails
  // ========================================

  async queueReferralInvitationEmail(
    to: string,
    referrerName: string | null,
    referralCode: string,
    userId?: string
  ) {
    return queueEmailWithTracking(
      'referral-invitation',
      to,
      { referrerName, referralCode },
      { userId, idempotencyKey: `referral:${referralCode}:${to}` }
    );
  },

  // ========================================
  // Team Emails (B2B)
  // ========================================

  async queueTeamInvitationEmail(
    to: string,
    data: {
      invitedByName: string;
      companyName: string;
      acceptUrl: string;
    }
  ) {
    return queueEmailWithTracking(
      'team-invitation',
      to,
      data,
      { idempotencyKey: `team-invite:${to}:${data.companyName}` }
    );
  },

  // ========================================
  // Generic Notification Email
  // ========================================

  async queueNotificationEmail(
    to: string,
    data: {
      userName: string;
      title: string;
      body: string;
    },
    userId?: string
  ) {
    return queueEmailWithTracking(
      'notification',
      to,
      data,
      { userId }
    );
  },
};

export type { QueueResult, QueueEmailOptions };
