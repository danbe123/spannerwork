/**
 * Admin Email Management Routes
 *
 * Provides endpoints for:
 * - Email delivery metrics and analytics
 * - Dead Letter Queue management
 * - Email template management (future)
 * - Circuit breaker status
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { emailTrackingService } from '../../services/emailTracking.service.js';
import { getEmailCircuitHealth } from '../../services/circuitBreaker.js';
import {
  getQueueStats,
  getDLQJobs,
  getDLQStats,
  retryDLQJob,
  removeDLQJob,
} from '../../config/queue.js';
import { logger } from '../../config/logger.js';

const router = Router();

// Note: Admin authentication is already applied at the parent router level in admin.routes.ts

/**
 * GET /api/v1/admin/email/metrics
 * Get email delivery metrics and analytics
 */
router.get('/metrics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [metrics, queueStats, dlqStats, circuitHealth, hourlyCounts] = await Promise.all([
      emailTrackingService.getMetrics(),
      getQueueStats(),
      getDLQStats(),
      getEmailCircuitHealth(),
      emailTrackingService.getHourlyCounts(),
    ]);

    res.json({
      success: true,
      data: {
        metrics,
        queues: {
          email: queueStats.email,
          dlq: dlqStats,
        },
        circuitBreakers: circuitHealth,
        hourlyTrend: hourlyCounts,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/email/metrics/period
 * Get metrics for a specific time period
 */
router.get('/metrics/period', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      startDate: z.string().transform(s => new Date(s)),
      endDate: z.string().transform(s => new Date(s)),
    });

    const { startDate, endDate } = schema.parse(req.query);
    const metrics = await emailTrackingService.getMetricsByPeriod(startDate, endDate);

    res.json({
      success: true,
      data: {
        metrics,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/email/realtime
 * Get real-time counters from Redis
 */
router.get('/realtime', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const counters = await emailTrackingService.getRealTimeCounters();

    res.json({
      success: true,
      data: {
        counters,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/email/dlq
 * Get Dead Letter Queue jobs for review
 */
router.get('/dlq', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const [jobs, stats] = await Promise.all([
      getDLQJobs(limit),
      getDLQStats(),
    ]);

    res.json({
      success: true,
      data: {
        jobs,
        stats,
        count: jobs.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/admin/email/dlq/:jobId/retry
 * Retry a failed job from the DLQ
 */
router.post('/dlq/:jobId/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const success = await retryDLQJob(jobId);

    if (!success) {
      res.status(404).json({
        success: false,
        error: 'DLQ job not found',
      });
      return;
    }

    logger.info(`Admin retried DLQ job ${jobId}`);
    res.json({
      success: true,
      message: `Job ${jobId} has been re-queued for retry`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/admin/email/dlq/:jobId
 * Remove/discard a job from the DLQ
 */
router.delete('/dlq/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const success = await removeDLQJob(jobId);

    if (!success) {
      res.status(404).json({
        success: false,
        error: 'DLQ job not found',
      });
      return;
    }

    logger.info(`Admin removed DLQ job ${jobId}`);
    res.json({
      success: true,
      message: `Job ${jobId} has been removed from DLQ`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/admin/email/dlq/retry-all
 * Retry all jobs in the DLQ
 */
router.post('/dlq/retry-all', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await getDLQJobs(1000);
    let retried = 0;
    let failed = 0;

    for (const job of jobs) {
      if (job.id) {
        const success = await retryDLQJob(job.id);
        if (success) {
          retried++;
        } else {
          failed++;
        }
      }
    }

    logger.info(`Admin bulk-retried DLQ: ${retried} succeeded, ${failed} failed`);
    res.json({
      success: true,
      data: {
        total: jobs.length,
        retried,
        failed,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/email/logs
 * Search email logs
 */
router.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, limit = '50' } = req.query;

    // If searching by email, use the tracking service
    if (email && typeof email === 'string') {
      const logs = await emailTrackingService.getByRecipient(
        email,
        Math.min(parseInt(limit as string), 100)
      );

      res.json({
        success: true,
        data: {
          logs,
          count: logs.length,
        },
      });
      return;
    }

    // For now, return error for other searches (would need to implement in tracking service)
    res.status(400).json({
      success: false,
      error: 'Email parameter is required for log search',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/email/logs/:jobId
 * Get a specific email log by job ID
 */
router.get('/logs/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const log = await emailTrackingService.getByJobId(jobId);

    if (!log) {
      res.status(404).json({
        success: false,
        error: 'Email log not found',
      });
      return;
    }

    res.json({
      success: true,
      data: log,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/email/health
 * Get overall email system health
 */
router.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [queueStats, dlqStats, circuitHealth, metrics] = await Promise.all([
      getQueueStats(),
      getDLQStats(),
      getEmailCircuitHealth(),
      emailTrackingService.getMetrics(),
    ]);

    // Determine health status
    const issues: string[] = [];

    // Check queue health
    if (queueStats.email.waiting > 1000) {
      issues.push('Email queue backlog is high (>1000 waiting)');
    }

    // Check DLQ
    if (dlqStats.total > 100) {
      issues.push('Dead letter queue has many failed emails (>100)');
    }

    // Check circuit breakers
    if (circuitHealth.mailtrap.state === 'OPEN') {
      issues.push('Mailtrap circuit breaker is OPEN');
    }
    if (circuitHealth.resend.state === 'OPEN') {
      issues.push('Resend circuit breaker is OPEN');
    }

    // Check delivery rate
    if (metrics.deliveryRate < 90 && metrics.total > 100) {
      issues.push(`Low delivery rate: ${metrics.deliveryRate.toFixed(1)}%`);
    }

    // Check bounce rate
    if (metrics.bounceRate > 5 && metrics.total > 100) {
      issues.push(`High bounce rate: ${metrics.bounceRate.toFixed(1)}%`);
    }

    const healthy = issues.length === 0;

    res.json({
      success: true,
      data: {
        healthy,
        status: healthy ? 'healthy' : 'degraded',
        issues,
        summary: {
          queueDepth: queueStats.email.waiting,
          dlqSize: dlqStats.total,
          deliveryRate: metrics.deliveryRate,
          bounceRate: metrics.bounceRate,
          circuitBreakers: {
            mailtrap: circuitHealth.mailtrap.state,
            resend: circuitHealth.resend.state,
          },
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/admin/email/cleanup
 * Clean up old email logs (data retention)
 */
router.post('/cleanup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const retentionDays = parseInt(req.body.retentionDays as string) || 90;
    const deleted = await emailTrackingService.cleanupOldLogs(retentionDays);

    logger.info(`Admin triggered email log cleanup: ${deleted} records deleted (retention: ${retentionDays} days)`);
    res.json({
      success: true,
      data: {
        deleted,
        retentionDays,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
