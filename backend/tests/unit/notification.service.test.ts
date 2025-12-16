import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    pushSubscription: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    VAPID_PUBLIC_KEY: null,
    VAPID_PRIVATE_KEY: null,
    VAPID_SUBJECT: null,
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { notificationService } from '../../src/services/notification.service.js';
import { prisma } from '../../src/config/database.js';
import { logger } from '../../src/config/logger.js';

describe('NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('subscribe', () => {
    it('should create new subscription', async () => {
      vi.mocked(prisma.pushSubscription.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.pushSubscription.create).mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        endpoint: 'https://push.example.com',
        p256dh: 'key1',
        auth: 'auth1',
      } as any);

      const result = await notificationService.subscribe('user-1', {
        endpoint: 'https://push.example.com',
        keys: {
          p256dh: 'key1',
          auth: 'auth1',
        },
      });

      expect(result).toBe(true);
      expect(prisma.pushSubscription.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          endpoint: 'https://push.example.com',
          p256dh: 'key1',
          auth: 'auth1',
        },
      });
    });

    it('should update existing subscription', async () => {
      vi.mocked(prisma.pushSubscription.findFirst).mockResolvedValue({
        id: 'existing-sub',
        userId: 'user-1',
        endpoint: 'https://push.example.com',
      } as any);

      vi.mocked(prisma.pushSubscription.update).mockResolvedValue({} as any);

      const result = await notificationService.subscribe('user-1', {
        endpoint: 'https://push.example.com',
        keys: {
          p256dh: 'new-key',
          auth: 'new-auth',
        },
      });

      expect(result).toBe(true);
      expect(prisma.pushSubscription.update).toHaveBeenCalledWith({
        where: { id: 'existing-sub' },
        data: expect.objectContaining({
          p256dh: 'new-key',
          auth: 'new-auth',
        }),
      });
    });

    it('should return false on error', async () => {
      vi.mocked(prisma.pushSubscription.findFirst).mockRejectedValue(new Error('DB error'));

      const result = await notificationService.subscribe('user-1', {
        endpoint: 'https://push.example.com',
        keys: { p256dh: 'key', auth: 'auth' },
      });

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('unsubscribe', () => {
    it('should delete subscription', async () => {
      vi.mocked(prisma.pushSubscription.deleteMany).mockResolvedValue({ count: 1 });

      const result = await notificationService.unsubscribe(
        'user-1',
        'https://push.example.com'
      );

      expect(result).toBe(true);
      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          endpoint: 'https://push.example.com',
        },
      });
    });

    it('should return false on error', async () => {
      vi.mocked(prisma.pushSubscription.deleteMany).mockRejectedValue(new Error('DB error'));

      const result = await notificationService.unsubscribe(
        'user-1',
        'https://push.example.com'
      );

      expect(result).toBe(false);
    });
  });

  describe('unsubscribeAll', () => {
    it('should delete all subscriptions for user', async () => {
      vi.mocked(prisma.pushSubscription.deleteMany).mockResolvedValue({ count: 3 });

      const result = await notificationService.unsubscribeAll('user-1');

      expect(result).toBe(true);
      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  describe('sendToUser', () => {
    it('should log warning when VAPID not configured', async () => {
      vi.mocked(prisma.pushSubscription.findMany).mockResolvedValue([]);

      await notificationService.sendToUser('user-1', {
        title: 'Test',
        body: 'Test body',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Push notification skipped: VAPID keys not configured'
      );
    });
  });

  describe('templates', () => {
    it('should generate newMessage template', () => {
      const template = notificationService.templates.newMessage('John', 'Hello there!');

      expect(template.title).toBe('New message from John');
      expect(template.body).toBe('Hello there!');
      expect(template.tag).toBe('new-message');
    });

    it('should truncate long message preview', () => {
      const longMessage = 'a'.repeat(150);
      const template = notificationService.templates.newMessage('John', longMessage);

      expect(template.body.length).toBe(100);
      expect(template.body.endsWith('...')).toBe(true);
    });

    it('should generate bookingConfirmed template', () => {
      const template = notificationService.templates.bookingConfirmed('Power Drill');

      expect(template.title).toBe('Booking Confirmed! 🎉');
      expect(template.body).toContain('Power Drill');
    });

    it('should generate bookingCancelled template', () => {
      const template = notificationService.templates.bookingCancelled('Workshop Space');

      expect(template.title).toBe('Booking Cancelled');
      expect(template.body).toContain('Workshop Space');
    });

    it('should generate newBookingRequest template', () => {
      const template = notificationService.templates.newBookingRequest('Drill', 'Jane');

      expect(template.title).toBe('New Booking Request');
      expect(template.body).toContain('Jane');
      expect(template.body).toContain('Drill');
    });

    it('should generate paymentReceived template', () => {
      const template = notificationService.templates.paymentReceived(5000);

      expect(template.title).toBe('Payment Received 💰');
      expect(template.body).toBe('You received £50.00');
    });

    it('should generate reviewReceived template', () => {
      const template = notificationService.templates.reviewReceived(5, 'Mike');

      expect(template.title).toBe('New 5-Star Review ⭐');
      expect(template.body).toContain('Mike');
    });

    it('should generate disputeUpdate template', () => {
      const template = notificationService.templates.disputeUpdate('RESOLVED');

      expect(template.title).toBe('Dispute Update');
      expect(template.body).toContain('RESOLVED');
    });

    it('should generate referralCompleted template', () => {
      const template = notificationService.templates.referralCompleted('Sarah');

      expect(template.title).toBe('Referral Reward! 🎁');
      expect(template.body).toContain('Sarah');
    });
  });
});
