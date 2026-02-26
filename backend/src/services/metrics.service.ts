/**
 * Metrics Service
 * 
 * Provides custom metrics tracking for:
 * - Business KPIs (bookings, transactions, users)
 * - Performance metrics (response times, error rates)
 * - Distributed tracing context
 */

import * as Sentry from '@sentry/node';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';
import { redis, isRedisAvailable, prefixKey } from '../config/redis.js';
import { env } from '../config/env.js';

// Metric types
interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: Date;
}

interface BusinessMetrics {
  activeUsers: number;
  totalBookings: number;
  pendingTransactions: number;
  completedTransactions: number;
  totalRevenue: number;
  activeListings: {
    tools: number;
    spaces: number;
    services: number;
  };
  openDisputes: number;
}

// In-memory metrics buffer for batching
const metricsBuffer: MetricData[] = [];
const BUFFER_FLUSH_INTERVAL = 60000; // 1 minute
const MAX_BUFFER_SIZE = 100;

/**
 * Record a custom metric
 */
export function recordMetric(
  name: string,
  value: number,
  tags?: Record<string, string>
): void {
  const metric: MetricData = {
    name,
    value,
    tags,
    timestamp: new Date(),
  };

  metricsBuffer.push(metric);

  // Log metric
  logger.debug(`Metric: ${name}=${value}`, tags);

  // Flush if buffer is full
  if (metricsBuffer.length >= MAX_BUFFER_SIZE) {
    flushMetrics();
  }
}

/**
 * Record a timing metric
 */
export function recordTiming(
  name: string,
  durationMs: number,
  tags?: Record<string, string>
): void {
  recordMetric(`timing.${name}`, durationMs, tags);
  
  // Also send to Sentry as a measurement
  if (env.SENTRY_DSN) {
    Sentry.setMeasurement(name, durationMs, 'millisecond');
  }
}

/**
 * Increment a counter metric
 */
export async function incrementCounter(
  name: string,
  increment: number = 1,
  tags?: Record<string, string>
): Promise<void> {
  // Use Redis for distributed counting if available
  if (isRedisAvailable()) {
    try {
      const key = prefixKey(`metrics:counter:${name}`);
      await redis.incrby(key, increment);
      // Set expiry to prevent unbounded growth
      await redis.expire(key, 86400); // 24 hours
    } catch (error) {
      logger.error(`Failed to increment counter ${name}:`, error);
    }
  }
  
  recordMetric(`counter.${name}`, increment, tags);
}

/**
 * Flush metrics buffer (send to external service or log)
 */
function flushMetrics(): void {
  if (metricsBuffer.length === 0) return;

  // Metrics are logged for monitoring - OpenTelemetry tracing handles detailed metrics when enabled
  const metricsSummary = metricsBuffer.reduce((acc, m) => {
    acc[m.name] = (acc[m.name] || 0) + m.value;
    return acc;
  }, {} as Record<string, number>);

  logger.info('Metrics flush:', metricsSummary);

  // Clear buffer
  metricsBuffer.length = 0;
}

/**
 * Start periodic metrics flushing
 */
let flushInterval: NodeJS.Timeout | null = null;

export function startMetricsCollection(): void {
  if (flushInterval) return;
  
  flushInterval = setInterval(flushMetrics, BUFFER_FLUSH_INTERVAL);
  logger.info('Metrics collection started');
}

export function stopMetricsCollection(): void {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
    flushMetrics(); // Final flush
    logger.info('Metrics collection stopped');
  }
}

/**
 * Get current business metrics snapshot
 */
export async function getBusinessMetrics(): Promise<BusinessMetrics> {
  const [
    activeUsers,
    totalBookings,
    pendingTransactions,
    completedTransactions,
    revenueResult,
    toolCount,
    spaceCount,
    serviceCount,
    openDisputes,
  ] = await Promise.all([
    // Active users (logged in within last 24 hours)
    prisma.session.count({
      where: {
        expiresAt: { gt: new Date() },
      },
    }),
    
    // Total transactions
    prisma.transaction.count(),

    // Pending transactions
    prisma.transaction.count({
      where: { status: 'PENDING' },
    }),
    
    // Completed transactions
    prisma.transaction.count({
      where: { status: 'COMPLETED' },
    }),
    
    // Total revenue (platform fees)
    prisma.transaction.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { platformFee: true },
    }),
    
    // Active tool listings
    prisma.tool.count({
      where: { available: true },
    }),
    
    // Active space listings
    prisma.space.count({
      where: { available: true },
    }),
    
    // Active service listings
    prisma.service.count({
      where: { available: true },
    }),
    
    // Open disputes
    prisma.dispute.count({
      where: {
        status: { in: ['OPEN', 'UNDER_REVIEW'] },
      },
    }),
  ]);

  return {
    activeUsers,
    totalBookings,
    pendingTransactions,
    completedTransactions,
    totalRevenue: revenueResult._sum.platformFee || 0,
    activeListings: {
      tools: toolCount,
      spaces: spaceCount,
      services: serviceCount,
    },
    openDisputes,
  };
}

/**
 * Create a tracing span for an operation
 */
export function startSpan(
  name: string,
  op: string = 'function'
): Sentry.Span | undefined {
  if (!env.SENTRY_DSN) return undefined;
  
  return Sentry.startInactiveSpan({
    name,
    op,
  });
}

/**
 * Middleware to track request metrics
 */
export function requestMetricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Add request ID for tracing
    const headerRequestId = req.headers['x-request-id'];
    const requestId =
      (Array.isArray(headerRequestId) ? headerRequestId[0] : headerRequestId) ||
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    // Track response
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const route = req.route?.path || req.path || 'unknown';
      const method = req.method;
      const statusCode = res.statusCode;
      
      // Record timing
      recordTiming('http_request', duration, {
        method,
        route,
        status: String(statusCode),
      });

      // Record error rate
      if (statusCode >= 500) {
        incrementCounter('http_errors_5xx', 1, { route, method });
      } else if (statusCode >= 400) {
        incrementCounter('http_errors_4xx', 1, { route, method });
      }

      // Log slow requests
      if (duration > 1000) {
        logger.warn(`Slow request: ${method} ${route} took ${duration}ms`, {
          requestId,
          statusCode,
        });
      }
    });

    next();
  };
}

/**
 * Track specific business events
 */
export const BusinessEvents = {
  userRegistered: () => incrementCounter('user.registered'),
  userLoggedIn: () => incrementCounter('user.login'),
  bookingCreated: () => incrementCounter('booking.created'),
  bookingConfirmed: () => incrementCounter('booking.confirmed'),
  bookingCancelled: () => incrementCounter('booking.cancelled'),
  transactionCompleted: (amount: number) => {
    incrementCounter('transaction.completed');
    recordMetric('transaction.amount', amount);
  },
  disputeOpened: () => incrementCounter('dispute.opened'),
  disputeResolved: () => incrementCounter('dispute.resolved'),
  messagesSent: () => incrementCounter('message.sent'),
  listingCreated: (type: 'tool' | 'space' | 'service') => 
    incrementCounter(`listing.created.${type}`),
};

export default {
  recordMetric,
  recordTiming,
  incrementCounter,
  startMetricsCollection,
  stopMetricsCollection,
  getBusinessMetrics,
  startSpan,
  requestMetricsMiddleware,
  BusinessEvents,
};
