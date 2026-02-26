import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
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

vi.mock('../../src/services/notification.service.js', () => ({
  notificationService: {
    sendToUser: vi.fn(),
  },
}));

vi.mock('../../src/services/sms.service.js', () => ({
  smsService: {
    sendSms: vi.fn(),
  },
}));

vi.mock('../../src/services/email.service.js', () => ({
  emailService: {
    sendNotificationEmail: vi.fn(),
  },
}));

import { unifiedNotificationService } from '../../src/services/unifiedNotification.service.js';
import { prisma } from '../../src/config/database.js';
import { logger } from '../../src/config/logger.js';
import { notificationService } from '../../src/services/notification.service.js';
import { smsService } from '../../src/services/sms.service.js';
import { emailService } from '../../src/services/email.service.js';

describe('UnifiedNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('send', () => {
    const mockUser = {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      phone: '+447123456789',
      notificationPreferences: {
        emailEnabled: true,
        pushEnabled: true,
        smsEnabled: true,
        quietHoursStart: null,
        quietHoursEnd: null,
        bookingConfirmations: true,
        bookingReminders: true,
        paymentAlerts: true,
        reviewReminders: true,
      },
    };

    it('should send notification via all channels when enabled', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(notificationService.sendToUser).mockResolvedValue(undefined);
      vi.mocked(emailService.sendNotificationEmail).mockResolvedValue(undefined);
      vi.mocked(smsService.sendSms).mockResolvedValue(undefined);

      const result = await unifiedNotificationService.send({
        userId: 'user-1',
        type: 'booking_confirmation',
        title: 'Booking Confirmed',
        body: 'Your booking has been confirmed',
      });

      expect(result.push).toBe(true);
      expect(result.email).toBe(true);
      expect(result.sms).toBe(true);
    });

    it('should return false for all channels when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await unifiedNotificationService.send({
        userId: 'nonexistent',
        type: 'booking_confirmation',
        title: 'Test',
        body: 'Test body',
      });

      expect(result.push).toBe(false);
      expect(result.email).toBe(false);
      expect(result.sms).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith('User not found for notification', { userId: 'nonexistent' });
    });

    it('should respect user preference for disabled notification type', async () => {
      const userWithDisabledPrefs = {
        ...mockUser,
        notificationPreferences: {
          ...mockUser.notificationPreferences,
          bookingConfirmations: false,
        },
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithDisabledPrefs as any);

      const result = await unifiedNotificationService.send({
        userId: 'user-1',
        type: 'booking_confirmation',
        title: 'Booking Confirmed',
        body: 'Your booking has been confirmed',
      });

      expect(result.push).toBe(false);
      expect(result.email).toBe(false);
      expect(result.sms).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith('Notification type disabled by user', expect.any(Object));
    });

    it('should skip SMS when user has no phone', async () => {
      const userWithoutPhone = { ...mockUser, phone: null };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithoutPhone as any);
      vi.mocked(notificationService.sendToUser).mockResolvedValue(undefined);
      vi.mocked(emailService.sendNotificationEmail).mockResolvedValue(undefined);

      const result = await unifiedNotificationService.send({
        userId: 'user-1',
        type: 'booking_confirmation',
        title: 'Test',
        body: 'Test body',
      });

      expect(result.push).toBe(true);
      expect(result.email).toBe(true);
      expect(result.sms).toBe(false);
      expect(smsService.sendSms).not.toHaveBeenCalled();
    });

    it('should skip SMS when smsEnabled is false', async () => {
      const userWithSmsDisabled = {
        ...mockUser,
        notificationPreferences: {
          ...mockUser.notificationPreferences,
          smsEnabled: false,
        },
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithSmsDisabled as any);
      vi.mocked(notificationService.sendToUser).mockResolvedValue(undefined);
      vi.mocked(emailService.sendNotificationEmail).mockResolvedValue(undefined);

      const result = await unifiedNotificationService.send({
        userId: 'user-1',
        type: 'booking_confirmation',
        title: 'Test',
        body: 'Test body',
      });

      expect(result.push).toBe(true);
      expect(result.email).toBe(true);
      expect(result.sms).toBe(false);
    });

    it('should use forceSend to bypass preferences', async () => {
      const userWithDisabledPrefs = {
        ...mockUser,
        notificationPreferences: {
          ...mockUser.notificationPreferences,
          bookingConfirmations: false,
          pushEnabled: false,
          emailEnabled: false,
        },
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithDisabledPrefs as any);
      vi.mocked(notificationService.sendToUser).mockResolvedValue(undefined);
      vi.mocked(emailService.sendNotificationEmail).mockResolvedValue(undefined);
      vi.mocked(smsService.sendSms).mockResolvedValue(undefined);

      const result = await unifiedNotificationService.send({
        userId: 'user-1',
        type: 'booking_confirmation',
        title: 'Test',
        body: 'Test body',
        forceSend: true,
      });

      expect(result.push).toBe(true);
      expect(result.email).toBe(true);
      expect(result.sms).toBe(true);
    });

    it('should only use specified channels', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(notificationService.sendToUser).mockResolvedValue(undefined);

      const result = await unifiedNotificationService.send({
        userId: 'user-1',
        type: 'new_message',
        title: 'Test',
        body: 'Test body',
        channels: ['push'],
      });

      expect(result.push).toBe(true);
      expect(result.email).toBe(false);
      expect(result.sms).toBe(false);
      expect(emailService.sendNotificationEmail).not.toHaveBeenCalled();
      expect(smsService.sendSms).not.toHaveBeenCalled();
    });

    it('should handle push notification failure gracefully', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(notificationService.sendToUser).mockRejectedValue(new Error('Push failed'));
      vi.mocked(emailService.sendNotificationEmail).mockResolvedValue(undefined);
      vi.mocked(smsService.sendSms).mockResolvedValue(undefined);

      const result = await unifiedNotificationService.send({
        userId: 'user-1',
        type: 'booking_confirmation',
        title: 'Test',
        body: 'Test body',
      });

      expect(result.push).toBe(false);
      expect(result.email).toBe(true);
      expect(result.sms).toBe(true);
      expect(logger.error).toHaveBeenCalledWith('Failed to send push notification', expect.any(Object));
    });

    it('should handle email notification failure gracefully', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(notificationService.sendToUser).mockResolvedValue(undefined);
      vi.mocked(emailService.sendNotificationEmail).mockRejectedValue(new Error('Email failed'));
      vi.mocked(smsService.sendSms).mockResolvedValue(undefined);

      const result = await unifiedNotificationService.send({
        userId: 'user-1',
        type: 'booking_confirmation',
        title: 'Test',
        body: 'Test body',
      });

      expect(result.push).toBe(true);
      expect(result.email).toBe(false);
      expect(result.sms).toBe(true);
      expect(logger.error).toHaveBeenCalledWith('Failed to send email notification', expect.any(Object));
    });

    it('should handle SMS notification failure gracefully', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(notificationService.sendToUser).mockResolvedValue(undefined);
      vi.mocked(emailService.sendNotificationEmail).mockResolvedValue(undefined);
      vi.mocked(smsService.sendSms).mockRejectedValue(new Error('SMS failed'));

      const result = await unifiedNotificationService.send({
        userId: 'user-1',
        type: 'booking_confirmation',
        title: 'Test',
        body: 'Test body',
      });

      expect(result.push).toBe(true);
      expect(result.email).toBe(true);
      expect(result.sms).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Failed to send SMS notification', expect.any(Object));
    });

    it('should use smsBody when provided', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(notificationService.sendToUser).mockResolvedValue(undefined);
      vi.mocked(emailService.sendNotificationEmail).mockResolvedValue(undefined);
      vi.mocked(smsService.sendSms).mockResolvedValue(undefined);

      await unifiedNotificationService.send({
        userId: 'user-1',
        type: 'booking_confirmation',
        title: 'Test',
        body: 'Test body that is quite long',
        smsBody: 'Short SMS',
      });

      expect(smsService.sendSms).toHaveBeenCalledWith({
        to: '+447123456789',
        body: 'Short SMS',
      });
    });

    it('should use emailSubject when provided', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(notificationService.sendToUser).mockResolvedValue(undefined);
      vi.mocked(emailService.sendNotificationEmail).mockResolvedValue(undefined);
      vi.mocked(smsService.sendSms).mockResolvedValue(undefined);

      await unifiedNotificationService.send({
        userId: 'user-1',
        type: 'booking_confirmation',
        title: 'Default Title',
        body: 'Test body',
        emailSubject: 'Custom Email Subject',
      });

      expect(emailService.sendNotificationEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test User',
        'Custom Email Subject',
        'Test body'
      );
    });

    it('should allow security_alert notifications without preferences', async () => {
      const userWithNoPrefs = { ...mockUser, notificationPreferences: null };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithNoPrefs as any);
      vi.mocked(notificationService.sendToUser).mockResolvedValue(undefined);
      vi.mocked(emailService.sendNotificationEmail).mockResolvedValue(undefined);
      vi.mocked(smsService.sendSms).mockResolvedValue(undefined);

      const result = await unifiedNotificationService.send({
        userId: 'user-1',
        type: 'security_alert',
        title: 'Security Alert',
        body: 'Suspicious activity detected',
      });

      expect(result.push).toBe(true);
      expect(result.email).toBe(true);
      expect(result.sms).toBe(true);
    });

    it('should use "there" as fallback name when user name is null', async () => {
      const userWithoutName = { ...mockUser, name: null };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithoutName as any);
      vi.mocked(notificationService.sendToUser).mockResolvedValue(undefined);
      vi.mocked(emailService.sendNotificationEmail).mockResolvedValue(undefined);
      vi.mocked(smsService.sendSms).mockResolvedValue(undefined);

      await unifiedNotificationService.send({
        userId: 'user-1',
        type: 'booking_confirmation',
        title: 'Test',
        body: 'Test body',
      });

      expect(emailService.sendNotificationEmail).toHaveBeenCalledWith(
        'test@example.com',
        'there',
        'Test',
        'Test body'
      );
    });
  });

  describe('sendToMany', () => {
    const mockUser1 = {
      id: 'user-1',
      name: 'User One',
      email: 'user1@example.com',
      phone: '+447111111111',
      notificationPreferences: {
        emailEnabled: true,
        pushEnabled: true,
        smsEnabled: true,
        quietHoursStart: null,
        quietHoursEnd: null,
        bookingConfirmations: true,
        bookingReminders: true,
        paymentAlerts: true,
        reviewReminders: true,
      },
    };

    const mockUser2 = {
      id: 'user-2',
      name: 'User Two',
      email: 'user2@example.com',
      phone: '+447222222222',
      notificationPreferences: {
        emailEnabled: true,
        pushEnabled: true,
        smsEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
        bookingConfirmations: true,
        bookingReminders: true,
        paymentAlerts: true,
        reviewReminders: true,
      },
    };

    it('should send notifications to multiple users', async () => {
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser1 as any)
        .mockResolvedValueOnce(mockUser2 as any);
      vi.mocked(notificationService.sendToUser).mockResolvedValue(undefined);
      vi.mocked(emailService.sendNotificationEmail).mockResolvedValue(undefined);
      vi.mocked(smsService.sendSms).mockResolvedValue(undefined);

      const results = await unifiedNotificationService.sendToMany(
        ['user-1', 'user-2'],
        {
          type: 'booking_confirmation',
          title: 'Test',
          body: 'Test body',
        }
      );

      expect(results.size).toBe(2);
      expect(results.get('user-1')).toEqual({ push: true, email: true, sms: true });
      expect(results.get('user-2')).toEqual({ push: true, email: true, sms: false });
    });

    it('should handle empty user list', async () => {
      const results = await unifiedNotificationService.sendToMany(
        [],
        {
          type: 'booking_confirmation',
          title: 'Test',
          body: 'Test body',
        }
      );

      expect(results.size).toBe(0);
    });

    it('should process users in batches', async () => {
      const userIds = Array.from({ length: 25 }, (_, i) => `user-${i}`);

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser1 as any);
      vi.mocked(notificationService.sendToUser).mockResolvedValue(undefined);
      vi.mocked(emailService.sendNotificationEmail).mockResolvedValue(undefined);
      vi.mocked(smsService.sendSms).mockResolvedValue(undefined);

      const results = await unifiedNotificationService.sendToMany(
        userIds,
        {
          type: 'booking_confirmation',
          title: 'Test',
          body: 'Test body',
        }
      );

      expect(results.size).toBe(25);
    });
  });

  describe('templates', () => {
    const mockUser = {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      phone: '+447123456789',
      notificationPreferences: {
        emailEnabled: true,
        pushEnabled: true,
        smsEnabled: true,
        quietHoursStart: null,
        quietHoursEnd: null,
        bookingConfirmations: true,
        bookingReminders: true,
        paymentAlerts: true,
        reviewReminders: true,
      },
    };

    beforeEach(() => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(notificationService.sendToUser).mockResolvedValue(undefined);
      vi.mocked(emailService.sendNotificationEmail).mockResolvedValue(undefined);
      vi.mocked(smsService.sendSms).mockResolvedValue(undefined);
    });

    it('should send bookingConfirmed notification', async () => {
      const result = await unifiedNotificationService.templates.bookingConfirmed(
        'user-1',
        'Power Drill',
        new Date('2025-03-15T10:00:00')
      );

      expect(result.push).toBe(true);
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: 'Booking Confirmed',
        })
      );
    });

    it('should send bookingCancelled notification', async () => {
      const result = await unifiedNotificationService.templates.bookingCancelled(
        'user-1',
        'Power Drill'
      );

      expect(result.push).toBe(true);
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: 'Booking Cancelled',
        })
      );
    });

    it('should send bookingCancelled notification with reason', async () => {
      await unifiedNotificationService.templates.bookingCancelled(
        'user-1',
        'Power Drill',
        'Provider unavailable'
      );

      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          body: expect.stringContaining('Provider unavailable'),
        })
      );
    });

    it('should send bookingReminder notification', async () => {
      const result = await unifiedNotificationService.templates.bookingReminder(
        'user-1',
        'Power Drill',
        2
      );

      expect(result.push).toBe(true);
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: 'Booking Reminder',
          body: expect.stringContaining('2 hours'),
        })
      );
    });

    it('should send bookingReminder with singular hour', async () => {
      await unifiedNotificationService.templates.bookingReminder(
        'user-1',
        'Power Drill',
        1
      );

      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          body: expect.stringContaining('1 hour'),
        })
      );
    });

    it('should send newBookingRequest notification', async () => {
      const result = await unifiedNotificationService.templates.newBookingRequest(
        'user-1',
        'John Doe',
        'Power Drill'
      );

      expect(result.push).toBe(true);
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: 'New Booking Request',
          body: expect.stringContaining('John Doe'),
        })
      );
    });

    it('should send paymentReceived notification', async () => {
      const result = await unifiedNotificationService.templates.paymentReceived(
        'user-1',
        5000,
        'Jane Doe'
      );

      expect(result.push).toBe(true);
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: 'Payment Received',
        })
      );
    });

    it('should send paymentFailed notification', async () => {
      const result = await unifiedNotificationService.templates.paymentFailed(
        'user-1',
        5000,
        'Card declined'
      );

      expect(result.push).toBe(true);
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: 'Payment Failed',
          body: expect.stringContaining('Card declined'),
        })
      );
    });

    it('should send paymentFailed notification without reason', async () => {
      await unifiedNotificationService.templates.paymentFailed('user-1', 5000);

      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          body: expect.stringContaining('update your payment method'),
        })
      );
    });

    it('should send newMessage notification via push only', async () => {
      const result = await unifiedNotificationService.templates.newMessage(
        'user-1',
        'John Doe',
        'Hello, how are you?'
      );

      expect(result.push).toBe(true);
      expect(result.email).toBe(false);
      expect(result.sms).toBe(false);
    });

    it('should truncate long message preview', async () => {
      const longMessage = 'a'.repeat(150);
      await unifiedNotificationService.templates.newMessage(
        'user-1',
        'John Doe',
        longMessage
      );

      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          body: expect.stringMatching(/\.\.\.$/),
        })
      );
    });

    it('should send reviewReceived notification via push and email only', async () => {
      const result = await unifiedNotificationService.templates.reviewReceived(
        'user-1',
        'John Doe',
        5
      );

      expect(result.push).toBe(true);
      expect(result.email).toBe(true);
      expect(result.sms).toBe(false);
    });

    it('should send disputeUpdate notification', async () => {
      const result = await unifiedNotificationService.templates.disputeUpdate(
        'user-1',
        'RESOLVED',
        'dispute-123'
      );

      expect(result.push).toBe(true);
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: 'Dispute Update',
          body: expect.stringContaining('RESOLVED'),
        })
      );
    });

    it('should send insuranceExpiry notification', async () => {
      const result = await unifiedNotificationService.templates.insuranceExpiry(
        'user-1',
        7
      );

      expect(result.push).toBe(true);
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: 'Insurance Expiring Soon',
          body: expect.stringContaining('7 days'),
        })
      );
    });

    it('should send securityAlert notification with forceSend', async () => {
      const result = await unifiedNotificationService.templates.securityAlert(
        'user-1',
        'Unusual login detected from new device'
      );

      expect(result.push).toBe(true);
      expect(result.email).toBe(true);
      expect(result.sms).toBe(true);
    });
  });

  describe('isQuietHours', () => {
    it('should return false when quiet hours not set', () => {
      const result = unifiedNotificationService.isQuietHours(null, null);
      expect(result).toBe(false);
    });

    it('should correctly identify quiet hours during same-day period', () => {
      // Mock current time to 14:00
      const mockDate = new Date('2025-01-15T14:00:00');
      vi.setSystemTime(mockDate);

      // Quiet hours 13:00 - 15:00
      expect(unifiedNotificationService.isQuietHours(13, 15)).toBe(true);

      // Outside quiet hours
      expect(unifiedNotificationService.isQuietHours(16, 18)).toBe(false);

      vi.useRealTimers();
    });

    it('should correctly identify quiet hours during overnight period', () => {
      // Mock current time to 23:00
      const mockDate = new Date('2025-01-15T23:00:00');
      vi.setSystemTime(mockDate);

      // Quiet hours 22:00 - 07:00 (overnight)
      expect(unifiedNotificationService.isQuietHours(22, 7)).toBe(true);

      vi.useRealTimers();
    });

    it('should correctly identify quiet hours during early morning', () => {
      // Mock current time to 05:00
      const mockDate = new Date('2025-01-15T05:00:00');
      vi.setSystemTime(mockDate);

      // Quiet hours 22:00 - 07:00 (overnight)
      expect(unifiedNotificationService.isQuietHours(22, 7)).toBe(true);

      vi.useRealTimers();
    });

    it('should correctly identify outside quiet hours during day', () => {
      // Mock current time to 12:00
      const mockDate = new Date('2025-01-15T12:00:00');
      vi.setSystemTime(mockDate);

      // Quiet hours 22:00 - 07:00 (overnight)
      expect(unifiedNotificationService.isQuietHours(22, 7)).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getUserContext', () => {
    it('should return user context with preferences', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        phone: '+447123456789',
        notificationPreferences: {
          emailEnabled: true,
          pushEnabled: true,
          smsEnabled: true,
          quietHoursStart: 22,
          quietHoursEnd: 7,
          bookingConfirmations: true,
          bookingReminders: true,
          paymentAlerts: true,
          reviewReminders: true,
        },
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const result = await unifiedNotificationService.getUserContext('user-1');

      expect(result).not.toBeNull();
      expect(result?.user.id).toBe('user-1');
      expect(result?.preferences?.emailEnabled).toBe(true);
    });

    it('should return null when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await unifiedNotificationService.getUserContext('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle user without notification preferences', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        phone: '+447123456789',
        notificationPreferences: null,
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const result = await unifiedNotificationService.getUserContext('user-1');

      expect(result).not.toBeNull();
      expect(result?.preferences).toBeNull();
    });
  });

  describe('quiet hours behavior', () => {
    const mockUser = {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      phone: '+447123456789',
      notificationPreferences: {
        emailEnabled: true,
        pushEnabled: true,
        smsEnabled: true,
        quietHoursStart: 22,
        quietHoursEnd: 7,
        bookingConfirmations: true,
        bookingReminders: true,
        paymentAlerts: true,
        reviewReminders: true,
      },
    };

    it('should skip regular notifications during quiet hours', async () => {
      // Mock current time to 23:00 (within quiet hours)
      const mockDate = new Date('2025-01-15T23:00:00');
      vi.setSystemTime(mockDate);

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const result = await unifiedNotificationService.send({
        userId: 'user-1',
        type: 'booking_confirmation',
        title: 'Test',
        body: 'Test body',
      });

      expect(result.push).toBe(false);
      expect(result.email).toBe(false);
      expect(result.sms).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith('Notification deferred due to quiet hours', expect.any(Object));

      vi.useRealTimers();
    });

    it('should send security_alert during quiet hours', async () => {
      // Mock current time to 23:00 (within quiet hours)
      const mockDate = new Date('2025-01-15T23:00:00');
      vi.setSystemTime(mockDate);

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(notificationService.sendToUser).mockResolvedValue(undefined);
      vi.mocked(emailService.sendNotificationEmail).mockResolvedValue(undefined);
      vi.mocked(smsService.sendSms).mockResolvedValue(undefined);

      const result = await unifiedNotificationService.send({
        userId: 'user-1',
        type: 'security_alert',
        title: 'Security Alert',
        body: 'Suspicious activity detected',
      });

      expect(result.push).toBe(true);
      expect(result.email).toBe(true);
      expect(result.sms).toBe(true);

      vi.useRealTimers();
    });

    it('should send system_critical during quiet hours', async () => {
      // Mock current time to 03:00 (within quiet hours)
      const mockDate = new Date('2025-01-15T03:00:00');
      vi.setSystemTime(mockDate);

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(notificationService.sendToUser).mockResolvedValue(undefined);
      vi.mocked(emailService.sendNotificationEmail).mockResolvedValue(undefined);
      vi.mocked(smsService.sendSms).mockResolvedValue(undefined);

      const result = await unifiedNotificationService.send({
        userId: 'user-1',
        type: 'system_critical',
        title: 'Critical Update',
        body: 'Important system notification',
      });

      expect(result.push).toBe(true);
      expect(result.email).toBe(true);

      vi.useRealTimers();
    });

    it('should send notifications with forceSend during quiet hours', async () => {
      // Mock current time to 23:00 (within quiet hours)
      const mockDate = new Date('2025-01-15T23:00:00');
      vi.setSystemTime(mockDate);

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(notificationService.sendToUser).mockResolvedValue(undefined);
      vi.mocked(emailService.sendNotificationEmail).mockResolvedValue(undefined);
      vi.mocked(smsService.sendSms).mockResolvedValue(undefined);

      const result = await unifiedNotificationService.send({
        userId: 'user-1',
        type: 'booking_confirmation',
        title: 'Test',
        body: 'Test body',
        forceSend: true,
      });

      expect(result.push).toBe(true);
      expect(result.email).toBe(true);

      vi.useRealTimers();
    });
  });
});
