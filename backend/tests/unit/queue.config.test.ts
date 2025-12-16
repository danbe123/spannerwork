import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks
const mocks = vi.hoisted(() => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-123' }),
    close: vi.fn().mockResolvedValue(undefined),
    getJobCounts: vi.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 10,
      failed: 1,
    }),
  },
  mockQueueEvents: {
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: mocks.logger,
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn(() => mocks.mockQueue),
  QueueEvents: vi.fn(() => mocks.mockQueueEvents),
}));

import {
  QUEUE_NAMES,
  redisConnection,
  initializeQueueEvents,
  closeQueues,
  queueEmail,
  queueSms,
  queueNotification,
  getQueueStats,
} from '../../src/config/queue.js';

describe('Queue Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('QUEUE_NAMES', () => {
    it('should define EMAIL queue name', () => {
      expect(QUEUE_NAMES.EMAIL).toBe('email');
    });

    it('should define SMS queue name', () => {
      expect(QUEUE_NAMES.SMS).toBe('sms');
    });

    it('should define NOTIFICATIONS queue name', () => {
      expect(QUEUE_NAMES.NOTIFICATIONS).toBe('notifications');
    });
  });

  describe('redisConnection', () => {
    it('should have host property', () => {
      expect(redisConnection).toHaveProperty('host');
    });

    it('should have port property', () => {
      expect(redisConnection).toHaveProperty('port');
      expect(typeof redisConnection.port).toBe('number');
    });
  });

  describe('initializeQueueEvents', () => {
    it('should initialize queue events and log', () => {
      initializeQueueEvents();

      expect(mocks.logger.info).toHaveBeenCalledWith('Queue events initialized');
    });

    it('should not throw', () => {
      expect(() => initializeQueueEvents()).not.toThrow();
    });
  });

  describe('closeQueues', () => {
    it('should close all queues and log', async () => {
      await closeQueues();

      expect(mocks.logger.info).toHaveBeenCalledWith('All queues closed');
    });

    it('should not throw', async () => {
      await expect(closeQueues()).resolves.not.toThrow();
    });
  });

  describe('queueEmail', () => {
    it('should add email job to queue', async () => {
      const jobData = {
        type: 'verification' as const,
        to: 'test@example.com',
        data: { token: 'abc123' },
      };

      const job = await queueEmail(jobData);

      expect(job).toHaveProperty('id');
      expect(mocks.logger.debug).toHaveBeenCalled();
    });

    it('should support delay option', async () => {
      const jobData = {
        type: 'welcome' as const,
        to: 'test@example.com',
        data: { name: 'Test User' },
      };

      await queueEmail(jobData, { delay: 5000 });

      expect(mocks.mockQueue.add).toHaveBeenCalled();
    });

    it('should support priority option', async () => {
      const jobData = {
        type: 'password-reset' as const,
        to: 'test@example.com',
        data: { token: 'xyz789' },
      };

      await queueEmail(jobData, { priority: 1 });

      expect(mocks.mockQueue.add).toHaveBeenCalled();
    });
  });

  describe('queueSms', () => {
    it('should add SMS job to queue', async () => {
      const jobData = {
        type: 'verification' as const,
        to: '+447123456789',
        message: 'Your code is 123456',
      };

      const job = await queueSms(jobData);

      expect(job).toHaveProperty('id');
    });

    it('should support delay option', async () => {
      const jobData = {
        type: 'reminder' as const,
        to: '+447123456789',
        message: 'Reminder message',
      };

      await queueSms(jobData, { delay: 10000 });

      expect(mocks.mockQueue.add).toHaveBeenCalled();
    });
  });

  describe('queueNotification', () => {
    it('should add notification job to queue', async () => {
      const jobData = {
        type: 'push' as const,
        userId: 'user-123',
        title: 'New Message',
        body: 'You have a new message',
      };

      const job = await queueNotification(jobData);

      expect(job).toHaveProperty('id');
    });

    it('should support data payload', async () => {
      const jobData = {
        type: 'in-app' as const,
        userId: 'user-456',
        title: 'Booking Confirmed',
        body: 'Your booking is confirmed',
        data: { bookingId: 'booking-789' },
      };

      await queueNotification(jobData);

      expect(mocks.mockQueue.add).toHaveBeenCalled();
    });
  });

  describe('getQueueStats', () => {
    it('should return stats for all queues', async () => {
      const stats = await getQueueStats();

      expect(stats).toHaveProperty('email');
      expect(stats).toHaveProperty('sms');
      expect(stats).toHaveProperty('notifications');
    });

    it('should return job counts', async () => {
      const stats = await getQueueStats();

      expect(stats.email).toHaveProperty('waiting');
      expect(stats.email).toHaveProperty('active');
      expect(stats.email).toHaveProperty('completed');
      expect(stats.email).toHaveProperty('failed');
    });
  });
});

describe('Queue Job Types', () => {
  it('should support verification email type', async () => {
    const job = await queueEmail({
      type: 'verification',
      to: 'test@example.com',
      data: { token: 'token' },
    });
    expect(job).toBeDefined();
  });

  it('should support password-reset email type', async () => {
    const job = await queueEmail({
      type: 'password-reset',
      to: 'test@example.com',
      data: { token: 'token' },
    });
    expect(job).toBeDefined();
  });

  it('should support welcome email type', async () => {
    const job = await queueEmail({
      type: 'welcome',
      to: 'test@example.com',
      data: { name: 'User' },
    });
    expect(job).toBeDefined();
  });

  it('should support booking-confirmation email type', async () => {
    const job = await queueEmail({
      type: 'booking-confirmation',
      to: 'test@example.com',
      data: { resourceName: 'Tool' },
    });
    expect(job).toBeDefined();
  });

  it('should support booking-cancellation email type', async () => {
    const job = await queueEmail({
      type: 'booking-cancellation',
      to: 'test@example.com',
      data: { resourceName: 'Tool' },
    });
    expect(job).toBeDefined();
  });
});
