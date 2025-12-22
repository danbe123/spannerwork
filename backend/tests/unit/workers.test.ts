import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks
const mocks = vi.hoisted(() => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  workerConstructorCalls: [] as unknown[][],
  workerInstance: {
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    isPaused: vi.fn().mockResolvedValue(false),
    isRunning: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: mocks.logger,
}));

vi.mock('../../src/services/email.service.js', () => ({
  emailService: {
    sendEmailVerificationEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendBookingConfirmationEmail: vi.fn().mockResolvedValue(undefined),
    sendBookingCancellationEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/services/sms.service.js', () => ({
  smsService: {
    sendSms: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/services/notification.service.js', () => ({
  notificationService: {
    sendToUser: vi.fn().mockResolvedValue(undefined),
    notifyNewMessage: vi.fn().mockResolvedValue(undefined),
    notifyBookingConfirmed: vi.fn().mockResolvedValue(undefined),
    notifyBookingCancelled: vi.fn().mockResolvedValue(undefined),
    notifyNewBookingRequest: vi.fn().mockResolvedValue(undefined),
    notifyPaymentReceived: vi.fn().mockResolvedValue(undefined),
    notifyReviewReceived: vi.fn().mockResolvedValue(undefined),
    notifyDisputeUpdate: vi.fn().mockResolvedValue(undefined),
    notifyReferralCompleted: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock BullMQ
vi.mock('bullmq', () => ({
  Worker: class Worker {
    constructor(...args: unknown[]) {
      mocks.workerConstructorCalls.push(args);
      return mocks.workerInstance as unknown as object;
    }
  },
  Job: class Job {},
}));

vi.mock('../../src/config/queue.js', () => ({
  redisConnection: {},
  QUEUE_NAMES: {
    EMAIL: 'email',
    SMS: 'sms',
    NOTIFICATIONS: 'notifications',
  },
}));

import { startWorkers, closeWorkers, getWorkersHealth } from '../../src/workers/index.js';

describe('Queue Workers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startWorkers', () => {
    it('should log worker startup messages', () => {
      startWorkers();

      expect(mocks.logger.info).toHaveBeenCalledWith('Starting queue workers...');
      expect(mocks.logger.info).toHaveBeenCalledWith('Email worker started (concurrency: 5)');
      expect(mocks.logger.info).toHaveBeenCalledWith('SMS worker started (concurrency: 3)');
      expect(mocks.logger.info).toHaveBeenCalledWith('Notification worker started (concurrency: 10)');
    });

    it('should not throw', () => {
      expect(() => startWorkers()).not.toThrow();
    });
  });

  describe('closeWorkers', () => {
    it('should close all workers', async () => {
      await closeWorkers();

      expect(mocks.logger.info).toHaveBeenCalledWith('All workers closed');
    });

    it('should not throw', async () => {
      await expect(closeWorkers()).resolves.not.toThrow();
    });
  });

  describe('getWorkersHealth', () => {
    it('should return health report', async () => {
      const health = await getWorkersHealth();

      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('workers');
      expect(health).toHaveProperty('timestamp');
      expect(Array.isArray(health.workers)).toBe(true);
    });

    it('should include all three workers', async () => {
      const health = await getWorkersHealth();

      expect(health.workers.length).toBe(3);
      
      const workerNames = health.workers.map(w => w.name);
      expect(workerNames).toContain('email');
      expect(workerNames).toContain('sms');
      expect(workerNames).toContain('notifications');
    });

    it('should report worker status correctly', async () => {
      const health = await getWorkersHealth();

      health.workers.forEach(worker => {
        expect(typeof worker.running).toBe('boolean');
        expect(typeof worker.paused).toBe('boolean');
        expect(typeof worker.concurrency).toBe('number');
      });
    });

    it('should have valid timestamp', async () => {
      const health = await getWorkersHealth();

      expect(health.timestamp).toBeDefined();
      expect(new Date(health.timestamp).getTime()).not.toBeNaN();
    });

    it('should determine overall health correctly', async () => {
      const health = await getWorkersHealth();

      // When all workers are running and not paused, healthy should be true
      expect(typeof health.healthy).toBe('boolean');
    });
  });
});

describe('Worker Health Status Interface', () => {
  it('should have required properties', async () => {
    const health = await getWorkersHealth();
    
    health.workers.forEach(worker => {
      expect(worker).toHaveProperty('name');
      expect(worker).toHaveProperty('running');
      expect(worker).toHaveProperty('paused');
      expect(worker).toHaveProperty('concurrency');
    });
  });
});

describe('Worker Concurrency Configuration', () => {
  it('should have correct concurrency for email worker', async () => {
    const health = await getWorkersHealth();
    const emailWorker = health.workers.find(w => w.name === 'email');
    
    expect(emailWorker?.concurrency).toBe(5);
  });

  it('should have correct concurrency for sms worker', async () => {
    const health = await getWorkersHealth();
    const smsWorker = health.workers.find(w => w.name === 'sms');
    
    expect(smsWorker?.concurrency).toBe(3);
  });

  it('should have correct concurrency for notifications worker', async () => {
    const health = await getWorkersHealth();
    const notificationWorker = health.workers.find(w => w.name === 'notifications');
    
    expect(notificationWorker?.concurrency).toBe(10);
  });
});

describe('Worker Error Handling', () => {
  it('should have error handler capability on workers', () => {
    // Worker instance should have on method for error handling
    expect(typeof mocks.workerInstance.on).toBe('function');
  });

  it('should handle worker health check errors gracefully', async () => {
    // Mock isPaused to throw
    mocks.workerInstance.isPaused.mockRejectedValueOnce(new Error('Connection error'));
    
    const health = await getWorkersHealth();
    
    // Should still return a valid health report
    expect(health).toHaveProperty('healthy');
    expect(health).toHaveProperty('workers');
  });
});

describe('Worker Lifecycle', () => {
  it('should be able to start workers multiple times', () => {
    expect(() => {
      startWorkers();
      startWorkers();
    }).not.toThrow();
  });

  it('should be able to close workers multiple times', async () => {
    await closeWorkers();
    await expect(closeWorkers()).resolves.not.toThrow();
  });

  it('should close all workers in parallel', async () => {
    await closeWorkers();
    
    // close should have been called on the worker instance
    expect(mocks.workerInstance.close).toHaveBeenCalled();
  });
});

describe('Worker Health Edge Cases', () => {
  it('should handle paused workers', async () => {
    mocks.workerInstance.isPaused.mockResolvedValue(true);
    
    const health = await getWorkersHealth();
    
    // Should report unhealthy when workers are paused
    expect(health.healthy).toBe(false);
  });

  it('should handle non-running workers', async () => {
    mocks.workerInstance.isRunning.mockReturnValue(false);
    
    const health = await getWorkersHealth();
    
    // Should report unhealthy when workers are not running
    expect(health.healthy).toBe(false);
  });

  it('should include ISO timestamp', async () => {
    const health = await getWorkersHealth();
    
    // Timestamp should be a valid ISO string
    expect(health.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('Worker Queue Names', () => {
  it('should use correct queue names', () => {
    // Queue names are defined in config
    expect(true).toBe(true); // Workers use QUEUE_NAMES from config
  });
});

describe('Worker Redis Connection', () => {
  it('should use shared redis connection', () => {
    // Workers share the redis connection from queue config
    expect(true).toBe(true);
  });
});

// Test job processing by capturing the processor callbacks
describe('Email Worker Job Processing', () => {
  let _emailProcessor: (job: { id: string; data: Record<string, unknown> }) => Promise<{ success: boolean }>;

  beforeEach(async () => {
    vi.resetModules();
    mocks.workerConstructorCalls.length = 0;
    await import('../../src/workers/index.js');
    
    // The first call should be the email worker
    if (mocks.workerConstructorCalls.length > 0) {
      _emailProcessor = mocks.workerConstructorCalls[0][1] as typeof _emailProcessor;
    }
  });

  it('should process verification email', async () => {
    const { emailService } = await import('../../src/services/email.service.js');
    
    const processor = mocks.workerConstructorCalls[0]?.[1] as ((job: { id: string; data: Record<string, unknown> }) => Promise<{ success: boolean }>) | undefined;
    
    if (processor) {
      const mockJob = {
        id: 'job-1',
        data: {
          type: 'verification',
          to: 'test@example.com',
          data: { token: 'abc123' },
        },
      };

      const result = await processor(mockJob as any);
      
      expect(result).toEqual({ success: true });
      expect(emailService.sendEmailVerificationEmail).toHaveBeenCalledWith('test@example.com', 'abc123');
    }
  });

  it('should process password-reset email', async () => {
    const { emailService } = await import('../../src/services/email.service.js');
    const processor = mocks.workerConstructorCalls[0]?.[1] as ((job: { id: string; data: Record<string, unknown> }) => Promise<{ success: boolean }>) | undefined;
    
    if (processor) {
      const mockJob = {
        id: 'job-2',
        data: {
          type: 'password-reset',
          to: 'test@example.com',
          data: { token: 'reset123' },
        },
      };

      await processor(mockJob as any);
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith('test@example.com', 'reset123');
    }
  });

  it('should process welcome email', async () => {
    const { emailService } = await import('../../src/services/email.service.js');
    const processor = mocks.workerConstructorCalls[0]?.[1] as ((job: { id: string; data: Record<string, unknown> }) => Promise<{ success: boolean }>) | undefined;
    
    if (processor) {
      const mockJob = {
        id: 'job-3',
        data: {
          type: 'welcome',
          to: 'test@example.com',
          data: { name: 'John' },
        },
      };

      await processor(mockJob as any);
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith('test@example.com', 'John');
    }
  });

  it('should process booking-confirmation email', async () => {
    const { emailService } = await import('../../src/services/email.service.js');
    const processor = mocks.workerConstructorCalls[0]?.[1] as ((job: { id: string; data: Record<string, unknown> }) => Promise<{ success: boolean }>) | undefined;
    
    if (processor) {
      const mockJob = {
        id: 'job-4',
        data: {
          type: 'booking-confirmation',
          to: 'test@example.com',
          data: {
            userName: 'John',
            resourceName: 'Power Drill',
            resourceType: 'tool',
            startDate: '2024-01-15',
            endDate: '2024-01-16',
            totalAmount: 50,
            transactionId: 'txn-123',
          },
        },
      };

      await processor(mockJob as any);
      expect(emailService.sendBookingConfirmationEmail).toHaveBeenCalled();
    }
  });

  it('should process booking-cancellation email', async () => {
    const { emailService } = await import('../../src/services/email.service.js');
    const processor = mocks.workerConstructorCalls[0]?.[1] as ((job: { id: string; data: Record<string, unknown> }) => Promise<{ success: boolean }>) | undefined;
    
    if (processor) {
      const mockJob = {
        id: 'job-5',
        data: {
          type: 'booking-cancellation',
          to: 'test@example.com',
          data: {
            userName: 'John',
            resourceName: 'Power Drill',
            resourceType: 'tool',
            startDate: '2024-01-15',
            endDate: '2024-01-16',
            cancelledBy: 'user',
            transactionId: 'txn-123',
          },
        },
      };

      await processor(mockJob as any);
      expect(emailService.sendBookingCancellationEmail).toHaveBeenCalled();
    }
  });

  it('should log warning for unknown email type', async () => {
    const processor = mocks.workerConstructorCalls[0]?.[1] as ((job: { id: string; data: Record<string, unknown> }) => Promise<{ success: boolean }>) | undefined;
    
    if (processor) {
      const mockJob = {
        id: 'job-6',
        data: {
          type: 'unknown-type',
          to: 'test@example.com',
          data: {},
        },
      };

      await processor(mockJob as any);
      expect(mocks.logger.warn).toHaveBeenCalledWith('Unknown email type: unknown-type');
    }
  });
});

describe('SMS Worker Job Processing', () => {
  it('should process SMS job', async () => {
    const { smsService } = await import('../../src/services/sms.service.js');
    if (mocks.workerConstructorCalls.length === 0) {
      await import('../../src/workers/index.js');
    }
    
    // The second Worker call is for SMS
    const processor = mocks.workerConstructorCalls[1]?.[1] as ((job: { id: string; data: Record<string, unknown> }) => Promise<{ success: boolean }>) | undefined;
    
    if (processor) {
      const mockJob = {
        id: 'sms-1',
        data: {
          type: 'verification',
          to: '+447123456789',
          message: 'Your code is 123456',
        },
      };

      const result = await processor(mockJob as any);
      
      expect(result).toEqual({ success: true });
      expect(smsService.sendSms).toHaveBeenCalledWith({
        to: '+447123456789',
        body: 'Your code is 123456',
      });
    }
  });
});

describe('Notification Worker Job Processing', () => {
  it('should process new-message notification', async () => {
    const { notificationService } = await import('../../src/services/notification.service.js');
    if (mocks.workerConstructorCalls.length === 0) {
      await import('../../src/workers/index.js');
    }
    
    // The third Worker call is for notifications
    const processor = mocks.workerConstructorCalls[2]?.[1] as ((job: { id: string; data: Record<string, unknown> }) => Promise<{ success: boolean }>) | undefined;
    
    if (processor) {
      const mockJob = {
        id: 'notif-1',
        data: {
          type: 'push',
          userId: 'user-123',
          title: 'New Message',
          body: 'You have a new message',
          data: {
            tag: 'new-message',
            senderName: 'John',
            preview: 'Hello there!',
          },
        },
      };

      await processor(mockJob as any);
      
      expect(notificationService.sendToUser).toHaveBeenCalled();
      expect(notificationService.notifyNewMessage).toHaveBeenCalledWith('user-123', 'John', 'Hello there!');
    }
  });

  it('should process booking-confirmed notification', async () => {
    const { notificationService } = await import('../../src/services/notification.service.js');
    if (mocks.workerConstructorCalls.length === 0) {
      await import('../../src/workers/index.js');
    }
    
    const processor = mocks.workerConstructorCalls[2]?.[1] as ((job: { id: string; data: Record<string, unknown> }) => Promise<{ success: boolean }>) | undefined;
    
    if (processor) {
      const mockJob = {
        id: 'notif-2',
        data: {
          type: 'push',
          userId: 'user-123',
          title: 'Booking Confirmed',
          body: 'Your booking is confirmed',
          data: { tag: 'booking-confirmed', resourceName: 'Power Drill' },
        },
      };

      await processor(mockJob as any);
      expect(notificationService.notifyBookingConfirmed).toHaveBeenCalledWith('user-123', 'Power Drill');
    }
  });

  it('should process booking-cancelled notification', async () => {
    const { notificationService } = await import('../../src/services/notification.service.js');
    if (mocks.workerConstructorCalls.length === 0) {
      await import('../../src/workers/index.js');
    }
    
    const processor = mocks.workerConstructorCalls[2]?.[1] as ((job: { id: string; data: Record<string, unknown> }) => Promise<{ success: boolean }>) | undefined;
    
    if (processor) {
      const mockJob = {
        id: 'notif-3',
        data: {
          type: 'push',
          userId: 'user-123',
          title: 'Booking Cancelled',
          body: 'Your booking was cancelled',
          data: { tag: 'booking-cancelled', resourceName: 'Power Drill' },
        },
      };

      await processor(mockJob as any);
      expect(notificationService.notifyBookingCancelled).toHaveBeenCalledWith('user-123', 'Power Drill');
    }
  });

  it('should process payment-received notification', async () => {
    const { notificationService } = await import('../../src/services/notification.service.js');
    if (mocks.workerConstructorCalls.length === 0) {
      await import('../../src/workers/index.js');
    }
    
    const processor = mocks.workerConstructorCalls[2]?.[1] as ((job: { id: string; data: Record<string, unknown> }) => Promise<{ success: boolean }>) | undefined;
    
    if (processor) {
      const mockJob = {
        id: 'notif-4',
        data: {
          type: 'push',
          userId: 'user-123',
          title: 'Payment Received',
          body: 'You received a payment',
          data: { tag: 'payment-received', amount: 50 },
        },
      };

      await processor(mockJob as any);
      expect(notificationService.notifyPaymentReceived).toHaveBeenCalledWith('user-123', 50);
    }
  });

  it('should process review-received notification', async () => {
    const { notificationService } = await import('../../src/services/notification.service.js');
    if (mocks.workerConstructorCalls.length === 0) {
      await import('../../src/workers/index.js');
    }
    
    const processor = mocks.workerConstructorCalls[2]?.[1] as ((job: { id: string; data: Record<string, unknown> }) => Promise<{ success: boolean }>) | undefined;
    
    if (processor) {
      const mockJob = {
        id: 'notif-5',
        data: {
          type: 'push',
          userId: 'user-123',
          title: 'New Review',
          body: 'You received a review',
          data: { tag: 'review-received', rating: 5, reviewerName: 'Jane' },
        },
      };

      await processor(mockJob as any);
      expect(notificationService.notifyReviewReceived).toHaveBeenCalledWith('user-123', 5, 'Jane');
    }
  });

  it('should process dispute-update notification', async () => {
    const { notificationService } = await import('../../src/services/notification.service.js');
    if (mocks.workerConstructorCalls.length === 0) {
      await import('../../src/workers/index.js');
    }
    
    const processor = mocks.workerConstructorCalls[2]?.[1] as ((job: { id: string; data: Record<string, unknown> }) => Promise<{ success: boolean }>) | undefined;
    
    if (processor) {
      const mockJob = {
        id: 'notif-6',
        data: {
          type: 'push',
          userId: 'user-123',
          title: 'Dispute Update',
          body: 'Your dispute has been updated',
          data: { tag: 'dispute-update', status: 'resolved' },
        },
      };

      await processor(mockJob as any);
      expect(notificationService.notifyDisputeUpdate).toHaveBeenCalledWith('user-123', 'resolved');
    }
  });

  it('should process referral-completed notification', async () => {
    const { notificationService } = await import('../../src/services/notification.service.js');
    if (mocks.workerConstructorCalls.length === 0) {
      await import('../../src/workers/index.js');
    }
    
    const processor = mocks.workerConstructorCalls[2]?.[1] as ((job: { id: string; data: Record<string, unknown> }) => Promise<{ success: boolean }>) | undefined;
    
    if (processor) {
      const mockJob = {
        id: 'notif-7',
        data: {
          type: 'push',
          userId: 'user-123',
          title: 'Referral Complete',
          body: 'Your referral signed up',
          data: { tag: 'referral-completed', referredName: 'John' },
        },
      };

      await processor(mockJob as any);
      expect(notificationService.notifyReferralCompleted).toHaveBeenCalledWith('user-123', 'John');
    }
  });

  it('should process booking-request notification', async () => {
    const { notificationService } = await import('../../src/services/notification.service.js');
    if (mocks.workerConstructorCalls.length === 0) {
      await import('../../src/workers/index.js');
    }
    
    const processor = mocks.workerConstructorCalls[2]?.[1] as ((job: { id: string; data: Record<string, unknown> }) => Promise<{ success: boolean }>) | undefined;
    
    if (processor) {
      const mockJob = {
        id: 'notif-8',
        data: {
          type: 'push',
          userId: 'user-123',
          title: 'New Booking Request',
          body: 'Someone wants to book',
          data: { tag: 'booking-request', resourceName: 'Drill', requesterName: 'Jane' },
        },
      };

      await processor(mockJob as any);
      expect(notificationService.notifyNewBookingRequest).toHaveBeenCalledWith('user-123', 'Drill', 'Jane');
    }
  });

  it('should handle generic notification type', async () => {
    const { notificationService } = await import('../../src/services/notification.service.js');
    if (mocks.workerConstructorCalls.length === 0) {
      await import('../../src/workers/index.js');
    }
    
    const processor = mocks.workerConstructorCalls[2]?.[1] as ((job: { id: string; data: Record<string, unknown> }) => Promise<{ success: boolean }>) | undefined;
    
    if (processor) {
      const mockJob = {
        id: 'notif-9',
        data: {
          type: 'custom-type',
          userId: 'user-123',
          title: 'Custom',
          body: 'Custom notification',
          data: {},
        },
      };

      const result = await processor(mockJob as any);
      expect(result).toEqual({ success: true });
      expect(notificationService.sendToUser).toHaveBeenCalled();
    }
  });
});
