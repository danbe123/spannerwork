/**
 * Email Tracking Service
 *
 * Tracks email delivery status through the entire lifecycle:
 * QUEUED -> PROCESSING -> SENT -> DELIVERED -> OPENED -> CLICKED
 * Or: QUEUED -> PROCESSING -> FAILED -> (retried) -> SENT
 * Or: SENT -> BOUNCED
 */

import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { redis, isRedisAvailable, prefixKey } from '../config/redis.js';
import { EmailStatus, EmailPriority, Prisma } from '@prisma/client';

export interface CreateEmailLogParams {
  jobId: string;
  type: string;
  recipientEmail: string;
  recipientId?: string;
  subject?: string;
  priority?: EmailPriority;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  maxAttempts?: number;
}

export interface UpdateEmailStatusParams {
  jobId: string;
  status: EmailStatus;
  provider?: string;
  providerMessageId?: string;
  error?: string;
}

export interface EmailMetrics {
  total: number;
  queued: number;
  processing: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  deliveryRate: number;
  bounceRate: number;
  openRate: number;
}

class EmailTrackingService {
  private readonly METRICS_CACHE_KEY = 'email:metrics:summary';
  private readonly METRICS_CACHE_TTL = 300; // 5 minutes

  /**
   * Create a new email log entry when email is queued
   */
  async createEmailLog(params: CreateEmailLogParams): Promise<string> {
    try {
      const emailLog = await prisma.emailLog.create({
        data: {
          jobId: params.jobId,
          type: params.type,
          recipientEmail: params.recipientEmail,
          recipientId: params.recipientId,
          subject: params.subject,
          priority: params.priority ?? EmailPriority.NORMAL,
          status: EmailStatus.QUEUED,
          metadata: params.metadata as Prisma.InputJsonValue,
          idempotencyKey: params.idempotencyKey,
          maxAttempts: params.maxAttempts ?? 3,
          attempts: 0,
        },
      });

      logger.debug(`Email log created: ${emailLog.id} for job ${params.jobId}`);
      await this.incrementCounter('queued');
      return emailLog.id;
    } catch (error) {
      // Handle unique constraint violation for idempotency
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        logger.info(`Duplicate email prevented by idempotency key: ${params.idempotencyKey}`);
        throw new DuplicateEmailError(params.idempotencyKey ?? params.jobId);
      }
      logger.error('Failed to create email log:', error);
      throw error;
    }
  }

  /**
   * Mark email as processing (worker picked it up)
   */
  async markProcessing(jobId: string): Promise<void> {
    try {
      await prisma.emailLog.update({
        where: { jobId },
        data: {
          status: EmailStatus.PROCESSING,
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      });
      await this.decrementCounter('queued');
      await this.incrementCounter('processing');
    } catch (error) {
      logger.error(`Failed to mark email ${jobId} as processing:`, error);
    }
  }

  /**
   * Mark email as sent
   */
  async markSent(params: UpdateEmailStatusParams): Promise<void> {
    try {
      await prisma.emailLog.update({
        where: { jobId: params.jobId },
        data: {
          status: EmailStatus.SENT,
          provider: params.provider,
          providerMessageId: params.providerMessageId,
          sentAt: new Date(),
          error: null,
        },
      });
      await this.decrementCounter('processing');
      await this.incrementCounter('sent');
      logger.info(`Email ${params.jobId} sent via ${params.provider}`);
    } catch (error) {
      logger.error(`Failed to mark email ${params.jobId} as sent:`, error);
    }
  }

  /**
   * Mark email as failed
   */
  async markFailed(jobId: string, error: string): Promise<void> {
    try {
      const log = await prisma.emailLog.update({
        where: { jobId },
        data: {
          status: EmailStatus.FAILED,
          error,
        },
      });

      await this.decrementCounter('processing');
      await this.incrementCounter('failed');
      logger.error(`Email ${jobId} failed: ${error}`);

      // Check if max attempts reached
      if (log.attempts >= log.maxAttempts) {
        logger.warn(`Email ${jobId} exceeded max attempts (${log.maxAttempts}), moving to DLQ`);
      }
    } catch (err) {
      logger.error(`Failed to mark email ${jobId} as failed:`, err);
    }
  }

  /**
   * Mark email as delivered (from webhook)
   */
  async markDelivered(providerMessageId: string): Promise<void> {
    try {
      await prisma.emailLog.updateMany({
        where: { providerMessageId },
        data: {
          status: EmailStatus.DELIVERED,
          deliveredAt: new Date(),
        },
      });
      await this.decrementCounter('sent');
      await this.incrementCounter('delivered');
    } catch (error) {
      logger.error(`Failed to mark email ${providerMessageId} as delivered:`, error);
    }
  }

  /**
   * Mark email as opened (from webhook)
   */
  async markOpened(providerMessageId: string): Promise<void> {
    try {
      await prisma.emailLog.updateMany({
        where: { providerMessageId, openedAt: null },
        data: {
          status: EmailStatus.OPENED,
          openedAt: new Date(),
        },
      });
      await this.incrementCounter('opened');
    } catch (error) {
      logger.error(`Failed to mark email ${providerMessageId} as opened:`, error);
    }
  }

  /**
   * Mark email as clicked (from webhook)
   */
  async markClicked(providerMessageId: string): Promise<void> {
    try {
      await prisma.emailLog.updateMany({
        where: { providerMessageId, clickedAt: null },
        data: {
          status: EmailStatus.CLICKED,
          clickedAt: new Date(),
        },
      });
      await this.incrementCounter('clicked');
    } catch (error) {
      logger.error(`Failed to mark email ${providerMessageId} as clicked:`, error);
    }
  }

  /**
   * Mark email as bounced (from webhook)
   */
  async markBounced(providerMessageId: string, bounceType: 'hard' | 'soft', reason?: string): Promise<void> {
    try {
      const result = await prisma.emailLog.updateMany({
        where: { providerMessageId },
        data: {
          status: EmailStatus.BOUNCED,
          bouncedAt: new Date(),
          bounceType,
          bounceReason: reason,
        },
      });

      if (result.count > 0) {
        await this.incrementCounter('bounced');

        // Get the email to record the bounce
        const emailLog = await prisma.emailLog.findFirst({
          where: { providerMessageId },
        });

        if (emailLog && bounceType === 'hard') {
          await this.recordHardBounce(emailLog.recipientEmail, reason);
        }
      }
    } catch (error) {
      logger.error(`Failed to mark email ${providerMessageId} as bounced:`, error);
    }
  }

  /**
   * Record a hard bounce for suppression
   */
  private async recordHardBounce(email: string, reason?: string): Promise<void> {
    try {
      await prisma.emailBounce.upsert({
        where: { email },
        create: {
          email,
          bounceType: 'hard',
          bounceCount: 1,
          reason,
          suppressed: true,
          suppressedAt: new Date(),
        },
        update: {
          bounceCount: { increment: 1 },
          lastBounceAt: new Date(),
          reason,
          suppressed: true,
          suppressedAt: new Date(),
        },
      });
      logger.warn(`Hard bounce recorded for ${email}, email suppressed`);
    } catch (error) {
      logger.error(`Failed to record hard bounce for ${email}:`, error);
    }
  }

  /**
   * Check if an email is suppressed (bounced)
   */
  async isEmailSuppressed(email: string): Promise<boolean> {
    try {
      const bounce = await prisma.emailBounce.findUnique({
        where: { email },
        select: { suppressed: true },
      });
      return bounce?.suppressed ?? false;
    } catch (error) {
      logger.error(`Failed to check suppression for ${email}:`, error);
      return false;
    }
  }

  /**
   * Check idempotency - prevent duplicate sends
   */
  async checkIdempotency(key: string): Promise<boolean> {
    if (!isRedisAvailable() || !redis) {
      // Fall back to database check
      const existing = await prisma.emailLog.findUnique({
        where: { idempotencyKey: key },
      });
      return existing === null;
    }

    const idempotencyKey = prefixKey(`email:idempotency:${key}`);
    const result = await redis.set(idempotencyKey, '1', 'EX', 86400, 'NX'); // 24h TTL, only if not exists
    return result === 'OK';
  }

  /**
   * Get email log by job ID
   */
  async getByJobId(jobId: string) {
    return prisma.emailLog.findUnique({
      where: { jobId },
    });
  }

  /**
   * Get email logs for a recipient
   */
  async getByRecipient(email: string, limit = 50) {
    return prisma.emailLog.findMany({
      where: { recipientEmail: email },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get email metrics summary
   */
  async getMetrics(forceRefresh = false): Promise<EmailMetrics> {
    if (!forceRefresh && isRedisAvailable() && redis) {
      const cached = await redis.get(prefixKey(this.METRICS_CACHE_KEY));
      if (cached) {
        return JSON.parse(cached) as EmailMetrics;
      }
    }

    const [counts, totals] = await Promise.all([
      prisma.emailLog.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.emailLog.aggregate({
        _count: true,
      }),
    ]);

    const statusCounts = counts.reduce((acc, c) => {
      acc[c.status.toLowerCase()] = c._count;
      return acc;
    }, {} as Record<string, number>);

    const total = totals._count;
    const sent = statusCounts['sent'] ?? 0;
    const delivered = statusCounts['delivered'] ?? 0;
    const opened = statusCounts['opened'] ?? 0;
    const clicked = statusCounts['clicked'] ?? 0;
    const bounced = statusCounts['bounced'] ?? 0;

    const metrics: EmailMetrics = {
      total,
      queued: statusCounts['queued'] ?? 0,
      processing: statusCounts['processing'] ?? 0,
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      failed: statusCounts['failed'] ?? 0,
      deliveryRate: sent > 0 ? ((delivered + opened + clicked) / sent) * 100 : 0,
      bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
      openRate: delivered > 0 ? ((opened + clicked) / delivered) * 100 : 0,
    };

    // Cache metrics
    if (isRedisAvailable() && redis) {
      await redis.setex(prefixKey(this.METRICS_CACHE_KEY), this.METRICS_CACHE_TTL, JSON.stringify(metrics));
    }

    return metrics;
  }

  /**
   * Get metrics for a specific time period
   */
  async getMetricsByPeriod(startDate: Date, endDate: Date): Promise<EmailMetrics> {
    const [counts, totals] = await Promise.all([
      prisma.emailLog.groupBy({
        by: ['status'],
        _count: true,
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      prisma.emailLog.aggregate({
        _count: true,
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
    ]);

    const statusCounts = counts.reduce((acc, c) => {
      acc[c.status.toLowerCase()] = c._count;
      return acc;
    }, {} as Record<string, number>);

    const total = totals._count;
    const sent = statusCounts['sent'] ?? 0;
    const delivered = statusCounts['delivered'] ?? 0;
    const opened = statusCounts['opened'] ?? 0;
    const clicked = statusCounts['clicked'] ?? 0;
    const bounced = statusCounts['bounced'] ?? 0;

    return {
      total,
      queued: statusCounts['queued'] ?? 0,
      processing: statusCounts['processing'] ?? 0,
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      failed: statusCounts['failed'] ?? 0,
      deliveryRate: sent > 0 ? ((delivered + opened + clicked) / sent) * 100 : 0,
      bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
      openRate: delivered > 0 ? ((opened + clicked) / delivered) * 100 : 0,
    };
  }

  /**
   * Get hourly email counts for the last 24 hours
   */
  async getHourlyCounts(): Promise<{ hour: string; sent: number; delivered: number; failed: number }[]> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Using raw query for hour grouping
    const result = await prisma.$queryRaw<Array<{ hour: Date; status: EmailStatus; count: bigint }>>`
      SELECT
        date_trunc('hour', "createdAt") as hour,
        status,
        COUNT(*) as count
      FROM email_logs
      WHERE "createdAt" >= ${twentyFourHoursAgo}
      GROUP BY date_trunc('hour', "createdAt"), status
      ORDER BY hour ASC
    `;

    // Group by hour
    const hourMap = new Map<string, { sent: number; delivered: number; failed: number }>();

    for (const row of result) {
      const hourKey = row.hour.toISOString().slice(0, 13);
      if (!hourMap.has(hourKey)) {
        hourMap.set(hourKey, { sent: 0, delivered: 0, failed: 0 });
      }
      const hourData = hourMap.get(hourKey)!;
      const count = Number(row.count);

      if (row.status === 'SENT' || row.status === 'DELIVERED' || row.status === 'OPENED' || row.status === 'CLICKED') {
        hourData.sent += count;
      }
      if (row.status === 'DELIVERED' || row.status === 'OPENED' || row.status === 'CLICKED') {
        hourData.delivered += count;
      }
      if (row.status === 'FAILED') {
        hourData.failed += count;
      }
    }

    return Array.from(hourMap.entries()).map(([hour, data]) => ({
      hour,
      ...data,
    }));
  }

  /**
   * Increment a counter in Redis
   */
  private async incrementCounter(status: string): Promise<void> {
    if (!isRedisAvailable() || !redis) return;

    try {
      const key = prefixKey(`email:counter:${status}`);
      await redis.incr(key);
    } catch (error) {
      // Non-critical, just log
      logger.debug(`Failed to increment email counter ${status}:`, error);
    }
  }

  /**
   * Decrement a counter in Redis
   */
  private async decrementCounter(status: string): Promise<void> {
    if (!isRedisAvailable() || !redis) return;

    try {
      const key = prefixKey(`email:counter:${status}`);
      await redis.decr(key);
    } catch (error) {
      logger.debug(`Failed to decrement email counter ${status}:`, error);
    }
  }

  /**
   * Get real-time counters from Redis
   */
  async getRealTimeCounters(): Promise<Record<string, number>> {
    if (!isRedisAvailable() || !redis) {
      return {};
    }

    const statuses = ['queued', 'processing', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'];
    const results: Record<string, number> = {};

    for (const status of statuses) {
      const key = prefixKey(`email:counter:${status}`);
      const value = await redis.get(key);
      results[status] = value ? parseInt(value, 10) : 0;
    }

    return results;
  }

  /**
   * Clean up old email logs (retention policy)
   */
  async cleanupOldLogs(retentionDays = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.emailLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        status: {
          in: [EmailStatus.DELIVERED, EmailStatus.OPENED, EmailStatus.CLICKED],
        },
      },
    });

    logger.info(`Cleaned up ${result.count} email logs older than ${retentionDays} days`);
    return result.count;
  }
}

/**
 * Error for duplicate email attempts
 */
export class DuplicateEmailError extends Error {
  constructor(idempotencyKey: string) {
    super(`Duplicate email prevented by idempotency key: ${idempotencyKey}`);
    this.name = 'DuplicateEmailError';
  }
}

export const emailTrackingService = new EmailTrackingService();
