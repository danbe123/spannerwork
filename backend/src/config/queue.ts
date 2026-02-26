/**
 * BullMQ Queue Configuration
 *
 * This module sets up job queues for background processing of:
 * - Email sending with priority support
 * - Dead letter queue for failed emails
 * - SMS notifications
 * - Other async tasks
 *
 * Note: Cloudways Redis uses allkeys-lfu eviction policy which cannot be changed.
 * BullMQ prefers noeviction to prevent job data loss, but we accept this risk
 * as the alternative (no job queues) is worse. The warning is suppressed in
 * src/config/suppress-warnings.ts which must be imported first.
 */

import { Queue, QueueEvents, Job } from 'bullmq';
import { logger } from './logger.js';
import { REDIS_KEY_PREFIX } from './redis.js';

// Redis connection configuration for BullMQ
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const url = new URL(redisUrl);

export const redisConnection = {
  host: url.hostname,
  port: parseInt(url.port || '6379'),
  // Handle Redis ACL authentication (username + password)
  username: url.username ? decodeURIComponent(url.username) : undefined,
  password: url.password ? decodeURIComponent(url.password) : undefined,
};

// Queue names
export const QUEUE_NAMES = {
  EMAIL: 'email',
  EMAIL_DLQ: 'email-dlq',
  SMS: 'sms',
  NOTIFICATIONS: 'notifications',
  PAYMENT_RETRY: 'payment-retry',
} as const;

// BullMQ prefix for Redis ACL compliance
// Note: BullMQ adds "bull:" prefix by default, but we need our app prefix for ACL
export const BULL_PREFIX = REDIS_KEY_PREFIX ? `${REDIS_KEY_PREFIX}bull` : 'bull';

// Email types - comprehensive list for all email templates
export type EmailType =
  | 'verification'
  | 'password-reset'
  | 'magic-link'
  | 'welcome'
  | 'booking-confirmation'
  | 'booking-cancellation'
  | 'booking-reminder'
  | 'review-request'
  | 'payout-completed'
  | 'weekly-earnings-summary'
  | 'payment-failed'
  | 'refund-confirmation'
  | 'refund-notification-provider'
  | 'dispute-alert'
  | 'insurance-status'
  | 'insurance-expiry-reminder'
  | 'contact-notification'
  | 'contact-confirmation'
  | 'referral-invitation'
  | 'stripe-account-issue'
  | 'rate-limit-alert'
  | 'team-invitation'
  | 'notification';

// Email priority levels (lower number = higher priority)
export const EMAIL_PRIORITY = {
  CRITICAL: 1,   // Password reset, security alerts
  HIGH: 2,       // Auth, payment confirmations
  NORMAL: 3,     // Booking updates, notifications
  LOW: 4,        // Marketing, weekly summaries
} as const;

// Job types
export interface EmailJobData {
  type: EmailType;
  to: string;
  subject?: string;
  data: Record<string, unknown>;
  userId?: string;           // For tracking
  idempotencyKey?: string;   // Prevent duplicates
}

export interface SmsJobData {
  type: 'verification' | 'booking-notification' | 'reminder';
  to: string;
  message: string;
}

export interface NotificationJobData {
  type: 'push' | 'in-app';
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PaymentRetryJobData {
  type: 'instant_payout_reimbursement';
  transactionId: string;
  amount: number;
  destinationAccountId: string;
  description: string;
  attempts: number;
}

// Create queues with prefix for Redis ACL compliance
export const emailQueue = new Queue<EmailJobData>(QUEUE_NAMES.EMAIL, {
  connection: redisConnection,
  prefix: BULL_PREFIX,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 60 * 60, // Keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
    },
  },
});

export const smsQueue = new Queue<SmsJobData>(QUEUE_NAMES.SMS, {
  connection: redisConnection,
  prefix: BULL_PREFIX,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 24 * 60 * 60,
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60,
    },
  },
});

export const notificationQueue = new Queue<NotificationJobData>(QUEUE_NAMES.NOTIFICATIONS, {
  connection: redisConnection,
  prefix: BULL_PREFIX,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 5000,
    },
    removeOnComplete: {
      age: 12 * 60 * 60,
      count: 500,
    },
    removeOnFail: {
      age: 24 * 60 * 60,
    },
  },
});

// Payment retry queue for failed reimbursements (e.g., instant payout fee refunds)
export const paymentRetryQueue = new Queue<PaymentRetryJobData>(QUEUE_NAMES.PAYMENT_RETRY, {
  connection: redisConnection,
  prefix: BULL_PREFIX,
  defaultJobOptions: {
    attempts: 5, // More retries for critical payment operations
    backoff: {
      type: 'exponential',
      delay: 60000, // Start with 1 minute delay
    },
    removeOnComplete: {
      age: 7 * 24 * 60 * 60, // Keep for 7 days for audit
      count: 500,
    },
    removeOnFail: false, // Keep failed payment jobs for manual review
  },
});

// Dead Letter Queue for failed emails (after all retries exhausted)
export interface DLQJobData {
  originalJob: EmailJobData;
  error: string;
  failedAt: string;
  attempts: number;
  originalJobId?: string;
}

export const emailDLQ = new Queue<DLQJobData>(QUEUE_NAMES.EMAIL_DLQ, {
  connection: redisConnection,
  prefix: BULL_PREFIX,
  defaultJobOptions: {
    removeOnComplete: false,  // Keep DLQ jobs for manual review
    removeOnFail: false,
  },
});

// Queue event listeners for monitoring
const setupQueueEvents = (queueName: string) => {
  const events = new QueueEvents(queueName, { connection: redisConnection, prefix: BULL_PREFIX });
  
  events.on('completed', ({ jobId }: { jobId: string }) => {
    logger.debug(`Job ${jobId} in ${queueName} completed`);
  });
  
  events.on('failed', ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
    logger.error(`Job ${jobId} in ${queueName} failed: ${failedReason}`);
  });
  
  events.on('stalled', ({ jobId }: { jobId: string }) => {
    logger.warn(`Job ${jobId} in ${queueName} stalled`);
  });
  
  return events;
};

// Initialize queue events
let emailQueueEvents: QueueEvents | null = null;
let smsQueueEvents: QueueEvents | null = null;
let notificationQueueEvents: QueueEvents | null = null;
let emailDLQEvents: QueueEvents | null = null;

export function initializeQueueEvents() {
  emailQueueEvents = setupQueueEvents(QUEUE_NAMES.EMAIL);
  smsQueueEvents = setupQueueEvents(QUEUE_NAMES.SMS);
  notificationQueueEvents = setupQueueEvents(QUEUE_NAMES.NOTIFICATIONS);
  emailDLQEvents = setupQueueEvents(QUEUE_NAMES.EMAIL_DLQ);

  logger.info('Queue events initialized (including DLQ)');
}

// Graceful shutdown
export async function closeQueues() {
  await Promise.all([
    emailQueue.close(),
    emailDLQ.close(),
    smsQueue.close(),
    notificationQueue.close(),
    paymentRetryQueue.close(),
    emailQueueEvents?.close(),
    emailDLQEvents?.close(),
    smsQueueEvents?.close(),
    notificationQueueEvents?.close(),
  ]);

  logger.info('All queues closed');
}

// Helper function to queue instant payout fee reimbursement
export async function queuePaymentReimbursement(data: Omit<PaymentRetryJobData, 'type' | 'attempts'>) {
  const jobData: PaymentRetryJobData = {
    ...data,
    type: 'instant_payout_reimbursement',
    attempts: 0,
  };

  const job = await paymentRetryQueue.add(
    `reimburse-${data.transactionId}`,
    jobData,
    {
      jobId: `reimburse-${data.transactionId}`, // Idempotency key
    }
  );

  logger.info(`Payment reimbursement queued: ${job.id} for transaction ${data.transactionId}`);
  return job;
}

// Map email type to priority
function getEmailPriority(type: EmailType): number {
  switch (type) {
    case 'password-reset':
    case 'magic-link':
      return EMAIL_PRIORITY.CRITICAL;
    case 'verification':
    case 'payment-failed':
    case 'refund-confirmation':
    case 'dispute-alert':
    case 'stripe-account-issue':
      return EMAIL_PRIORITY.HIGH;
    case 'booking-confirmation':
    case 'booking-cancellation':
    case 'booking-reminder':
    case 'payout-completed':
    case 'team-invitation':
      return EMAIL_PRIORITY.NORMAL;
    case 'welcome':
    case 'weekly-earnings-summary':
    case 'review-request':
    case 'referral-invitation':
    case 'contact-confirmation':
    case 'contact-notification':
    case 'insurance-status':
    case 'insurance-expiry-reminder':
    case 'rate-limit-alert':
    case 'refund-notification-provider':
    case 'notification':
    default:
      return EMAIL_PRIORITY.LOW;
  }
}

// Helper function to add email job with automatic priority
export async function queueEmail(
  data: EmailJobData,
  options?: { delay?: number; priority?: number; jobId?: string }
) {
  const priority = options?.priority ?? getEmailPriority(data.type);

  const job = await emailQueue.add(`email-${data.type}`, data, {
    delay: options?.delay,
    priority,
    jobId: options?.jobId,
  });

  logger.debug(`Email job ${job.id} queued: ${data.type} to ${data.to} (priority: ${priority})`);
  return job;
}

// Helper function to move failed job to DLQ
export async function moveToEmailDLQ(
  job: Job<EmailJobData>,
  error: Error | string
): Promise<void> {
  const dlqData: DLQJobData = {
    originalJob: job.data,
    error: error instanceof Error ? error.message : error,
    failedAt: new Date().toISOString(),
    attempts: job.attemptsMade,
    originalJobId: job.id,
  };

  await emailDLQ.add(`dlq-${job.data.type}`, dlqData);
  logger.warn(`Email job ${job.id} moved to DLQ after ${job.attemptsMade} attempts: ${dlqData.error}`);
}

// Get DLQ jobs for admin review
export async function getDLQJobs(limit = 100) {
  const jobs = await emailDLQ.getJobs(['waiting', 'active', 'delayed', 'failed'], 0, limit);
  return jobs.map(job => ({
    id: job.id,
    data: job.data,
    timestamp: job.timestamp,
  }));
}

// Retry a job from DLQ
export async function retryDLQJob(jobId: string): Promise<boolean> {
  const job = await emailDLQ.getJob(jobId);
  if (!job) {
    logger.warn(`DLQ job ${jobId} not found`);
    return false;
  }

  // Re-queue the original email
  await queueEmail(job.data.originalJob);

  // Remove from DLQ
  await job.remove();
  logger.info(`DLQ job ${jobId} retried and removed from DLQ`);
  return true;
}

// Remove a job from DLQ (discard)
export async function removeDLQJob(jobId: string): Promise<boolean> {
  const job = await emailDLQ.getJob(jobId);
  if (!job) {
    return false;
  }

  await job.remove();
  logger.info(`DLQ job ${jobId} removed`);
  return true;
}

// Get DLQ stats
export async function getDLQStats() {
  const counts = await emailDLQ.getJobCounts();
  return {
    total: counts.waiting + counts.active + counts.delayed + counts.completed + counts.failed,
    waiting: counts.waiting,
    active: counts.active,
    completed: counts.completed,
    failed: counts.failed,
  };
}

// Helper function to add SMS job
export async function queueSms(data: SmsJobData, options?: { delay?: number }) {
  const job = await smsQueue.add(`sms-${data.type}`, data, {
    delay: options?.delay,
  });
  
  logger.debug(`SMS job ${job.id} queued: ${data.type} to ${data.to}`);
  return job;
}

// Helper function to add notification job
export async function queueNotification(data: NotificationJobData, options?: { delay?: number }) {
  const job = await notificationQueue.add(`notification-${data.type}`, data, {
    delay: options?.delay,
  });
  
  logger.debug(`Notification job ${job.id} queued: ${data.type} for user ${data.userId}`);
  return job;
}

// Get queue health stats
export async function getQueueStats() {
  const [emailCounts, emailDLQCounts, smsCounts, notificationCounts] = await Promise.all([
    emailQueue.getJobCounts(),
    emailDLQ.getJobCounts(),
    smsQueue.getJobCounts(),
    notificationQueue.getJobCounts(),
  ]);

  return {
    email: emailCounts,
    emailDLQ: emailDLQCounts,
    sms: smsCounts,
    notifications: notificationCounts,
  };
}
