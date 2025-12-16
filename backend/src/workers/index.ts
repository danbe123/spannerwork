/**
 * Queue Workers
 * 
 * This module sets up workers to process background jobs.
 * Workers run in the same process as the main app but can be
 * separated into a dedicated worker process for scaling.
 */

import { Worker, Job } from 'bullmq';
import {
  redisConnection,
  QUEUE_NAMES,
  EmailJobData,
  SmsJobData,
  NotificationJobData
} from '../config/queue.js';
import { logger } from '../config/logger.js';
import { emailService } from '../services/email.service.js';
import { smsService } from '../services/sms.service.js';
import { notificationService } from '../services/notification.service.js';

// Email Worker
export const emailWorker = new Worker<EmailJobData>(
  QUEUE_NAMES.EMAIL,
  async (job: Job<EmailJobData>) => {
    const { type, to, data } = job.data;
    
    logger.info(`Processing email job ${job.id}: ${type} to ${to}`);
    
    try {
      switch (type) {
        case 'verification':
          await emailService.sendEmailVerificationEmail(to, data.token as string);
          break;
          
        case 'password-reset':
          await emailService.sendPasswordResetEmail(to, data.token as string);
          break;
          
        case 'welcome':
          await emailService.sendWelcomeEmail(to, data.name as string | null);
          break;
          
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
          
        default:
          logger.warn(`Unknown email type: ${type}`);
      }
      
      logger.info(`Email job ${job.id} completed successfully`);
      return { success: true };
    } catch (error) {
      logger.error(`Email job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process 5 emails at a time
    limiter: {
      max: 100,
      duration: 60000, // Max 100 emails per minute
    },
  }
);

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
    concurrency: 10,
  }
);

// Error handlers for workers
emailWorker.on('failed', (job: Job<EmailJobData> | undefined, err: Error) => {
  logger.error(`Email worker failed for job ${job?.id}:`, err);
});

smsWorker.on('failed', (job: Job<SmsJobData> | undefined, err: Error) => {
  logger.error(`SMS worker failed for job ${job?.id}:`, err);
});

notificationWorker.on('failed', (job: Job<NotificationJobData> | undefined, err: Error) => {
  logger.error(`Notification worker failed for job ${job?.id}:`, err);
});

// Graceful shutdown
export async function closeWorkers() {
  await Promise.all([
    emailWorker.close(),
    smsWorker.close(),
    notificationWorker.close(),
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
