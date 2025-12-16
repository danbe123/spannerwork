/**
 * BullMQ Queue Configuration
 * 
 * This module sets up job queues for background processing of:
 * - Email sending
 * - SMS notifications
 * - Other async tasks
 */

import { Queue, QueueEvents } from 'bullmq';
import { logger } from './logger.js';

// Redis connection configuration for BullMQ
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const url = new URL(redisUrl);

export const redisConnection = {
  host: url.hostname,
  port: parseInt(url.port || '6379'),
  password: url.password || undefined,
};

// Queue names
export const QUEUE_NAMES = {
  EMAIL: 'email',
  SMS: 'sms',
  NOTIFICATIONS: 'notifications',
} as const;

// Job types
export interface EmailJobData {
  type: 'verification' | 'password-reset' | 'welcome' | 'booking-confirmation' | 'booking-cancellation';
  to: string;
  subject?: string;
  data: Record<string, unknown>;
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

// Create queues
export const emailQueue = new Queue<EmailJobData>(QUEUE_NAMES.EMAIL, {
  connection: redisConnection,
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

// Queue event listeners for monitoring
const setupQueueEvents = (queueName: string) => {
  const events = new QueueEvents(queueName, { connection: redisConnection });
  
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

export function initializeQueueEvents() {
  emailQueueEvents = setupQueueEvents(QUEUE_NAMES.EMAIL);
  smsQueueEvents = setupQueueEvents(QUEUE_NAMES.SMS);
  notificationQueueEvents = setupQueueEvents(QUEUE_NAMES.NOTIFICATIONS);
  
  logger.info('Queue events initialized');
}

// Graceful shutdown
export async function closeQueues() {
  await Promise.all([
    emailQueue.close(),
    smsQueue.close(),
    notificationQueue.close(),
    emailQueueEvents?.close(),
    smsQueueEvents?.close(),
    notificationQueueEvents?.close(),
  ]);
  
  logger.info('All queues closed');
}

// Helper function to add email job
export async function queueEmail(data: EmailJobData, options?: { delay?: number; priority?: number }) {
  const job = await emailQueue.add(`email-${data.type}`, data, {
    delay: options?.delay,
    priority: options?.priority,
  });
  
  logger.debug(`Email job ${job.id} queued: ${data.type} to ${data.to}`);
  return job;
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
  const [emailCounts, smsCounts, notificationCounts] = await Promise.all([
    emailQueue.getJobCounts(),
    smsQueue.getJobCounts(),
    notificationQueue.getJobCounts(),
  ]);
  
  return {
    email: emailCounts,
    sms: smsCounts,
    notifications: notificationCounts,
  };
}
