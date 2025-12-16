import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../src/config/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    SENTRY_DSN: null,
  },
}));

vi.mock('@sentry/node', () => ({
  setMeasurement: vi.fn(),
  startInactiveSpan: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('../../src/config/redis.js', () => ({
  redis: {
    incrby: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  },
  isRedisAvailable: vi.fn().mockReturnValue(false),
}));

// Hoist prisma mocks so they can be reconfigured after clearAllMocks
const mockPrisma = vi.hoisted(() => ({
  session: { count: vi.fn() },
  transaction: {
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  tool: { count: vi.fn() },
  space: { count: vi.fn() },
  service: { count: vi.fn() },
  dispute: { count: vi.fn() },
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: mockPrisma,
}));

import {
  recordMetric,
  recordTiming,
  incrementCounter,
  startMetricsCollection,
  stopMetricsCollection,
  getBusinessMetrics,
  requestMetricsMiddleware,
  BusinessEvents,
} from '../../src/services/metrics.service.js';
import { logger } from '../../src/config/logger.js';

describe('Metrics Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Re-configure prisma mocks after clearAllMocks
    mockPrisma.session.count.mockResolvedValue(10);
    // transaction.count() is called 3 times: total, pending, completed
    mockPrisma.transaction.count
      .mockResolvedValueOnce(50)  // Total transactions
      .mockResolvedValueOnce(25)  // Pending transactions
      .mockResolvedValueOnce(25); // Completed transactions
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { platformFee: 10000 } });
    mockPrisma.tool.count.mockResolvedValue(100);
    mockPrisma.space.count.mockResolvedValue(30);
    mockPrisma.service.count.mockResolvedValue(40);
    mockPrisma.dispute.count.mockResolvedValue(2);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    stopMetricsCollection();
  });

  describe('recordMetric', () => {
    it('logs metric with debug level', () => {
      recordMetric('test.metric', 100);

      expect(logger.debug).toHaveBeenCalledWith('Metric: test.metric=100', undefined);
    });

    it('includes tags in log', () => {
      recordMetric('test.metric', 50, { route: '/api/test', method: 'GET' });

      expect(logger.debug).toHaveBeenCalledWith(
        'Metric: test.metric=50',
        { route: '/api/test', method: 'GET' }
      );
    });
  });

  describe('recordTiming', () => {
    it('prefixes metric name with timing', () => {
      recordTiming('request', 150);

      expect(logger.debug).toHaveBeenCalledWith('Metric: timing.request=150', undefined);
    });

    it('includes tags', () => {
      recordTiming('db_query', 50, { table: 'users' });

      expect(logger.debug).toHaveBeenCalledWith(
        'Metric: timing.db_query=50',
        { table: 'users' }
      );
    });
  });

  describe('incrementCounter', () => {
    it('prefixes metric name with counter', async () => {
      await incrementCounter('api.calls');

      expect(logger.debug).toHaveBeenCalledWith('Metric: counter.api.calls=1', undefined);
    });

    it('uses specified increment value', async () => {
      await incrementCounter('errors', 5);

      expect(logger.debug).toHaveBeenCalledWith('Metric: counter.errors=5', undefined);
    });
  });

  describe('startMetricsCollection / stopMetricsCollection', () => {
    it('starts collection and logs', () => {
      startMetricsCollection();

      expect(logger.info).toHaveBeenCalledWith('Metrics collection started');
    });

    it('stops collection and flushes', () => {
      startMetricsCollection();
      stopMetricsCollection();

      expect(logger.info).toHaveBeenCalledWith('Metrics collection stopped');
    });

    it('does not start twice', () => {
      startMetricsCollection();
      startMetricsCollection();

      expect(logger.info).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBusinessMetrics', () => {
    it('returns business metrics snapshot', async () => {
      const metrics = await getBusinessMetrics();

      expect(metrics).toEqual({
        activeUsers: 10,
        totalBookings: 50,
        pendingTransactions: 25,
        completedTransactions: 25,
        totalRevenue: 10000,
        activeListings: {
          tools: 100,
          spaces: 30,
          services: 40,
        },
        openDisputes: 2,
      });
    });
  });

  describe('requestMetricsMiddleware', () => {
    it('returns middleware function', () => {
      const middleware = requestMetricsMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('adds X-Request-ID header', () => {
      const middleware = requestMetricsMiddleware();
      const req: any = {
        headers: {},
        method: 'GET',
        path: '/test',
      };
      const res: any = {
        setHeader: vi.fn(),
        on: vi.fn(),
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', expect.any(String));
      expect(req.requestId).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it('uses existing X-Request-ID from header', () => {
      const middleware = requestMetricsMiddleware();
      const req: any = {
        headers: { 'x-request-id': 'existing-id' },
        method: 'GET',
        path: '/test',
      };
      const res: any = {
        setHeader: vi.fn(),
        on: vi.fn(),
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(req.requestId).toBe('existing-id');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'existing-id');
    });

    it('records timing on response finish', () => {
      const middleware = requestMetricsMiddleware();
      const finishHandler = vi.fn();
      const req: any = {
        headers: {},
        method: 'GET',
        path: '/test',
        route: { path: '/test' },
      };
      const res: any = {
        setHeader: vi.fn(),
        on: vi.fn((event: string, handler: () => void) => {
          if (event === 'finish') {
            finishHandler.mockImplementation(handler);
          }
        }),
        statusCode: 200,
      };
      const next = vi.fn();

      middleware(req, res, next);

      // Simulate time passing
      vi.advanceTimersByTime(100);

      // Trigger finish event
      finishHandler();

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('timing.http_request'),
        expect.any(Object)
      );
    });
  });

  describe('BusinessEvents', () => {
    it('has userRegistered event', async () => {
      await BusinessEvents.userRegistered();

      expect(logger.debug).toHaveBeenCalledWith(
        'Metric: counter.user.registered=1',
        undefined
      );
    });

    it('has userLoggedIn event', async () => {
      await BusinessEvents.userLoggedIn();

      expect(logger.debug).toHaveBeenCalledWith(
        'Metric: counter.user.login=1',
        undefined
      );
    });

    it('has bookingCreated event', async () => {
      await BusinessEvents.bookingCreated();

      expect(logger.debug).toHaveBeenCalledWith(
        'Metric: counter.booking.created=1',
        undefined
      );
    });

    it('has transactionCompleted event with amount', async () => {
      await BusinessEvents.transactionCompleted(5000);

      expect(logger.debug).toHaveBeenCalledWith(
        'Metric: counter.transaction.completed=1',
        undefined
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Metric: transaction.amount=5000',
        undefined
      );
    });

    it('has listingCreated event with type', async () => {
      await BusinessEvents.listingCreated('tool');

      expect(logger.debug).toHaveBeenCalledWith(
        'Metric: counter.listing.created.tool=1',
        undefined
      );
    });
  });
});
