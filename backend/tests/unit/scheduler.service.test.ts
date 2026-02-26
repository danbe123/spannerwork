import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing
vi.mock('../../src/services/auth.service.js', () => ({
  authService: {
    cleanupExpiredSessions: vi.fn(),
    cleanupExpiredPasswordResetTokens: vi.fn(),
  },
}));

vi.mock('../../src/services/upload.service.js', () => ({
  uploadService: {
    cleanupExpiredDeletedFiles: vi.fn(),
  },
}));

vi.mock('../../src/services/analytics.service.js', () => ({
  snapshotDailyMetrics: vi.fn(),
}));

vi.mock('../../src/services/insurance.service.js', () => ({
  insuranceService: {
    markExpiredDocuments: vi.fn(),
  },
}));

vi.mock('../../src/services/email.service.js', () => ({
  emailService: {
    sendInsuranceExpiryReminderEmail: vi.fn(),
    sendEscrowExpiryReminderEmail: vi.fn(),
    sendEscrowExpiryUrgentEmail: vi.fn(),
    sendEscrowAutoCompletedEmail: vi.fn(),
    sendPaymentReleasedEmail: vi.fn(),
  },
}));

vi.mock('../../src/services/stripe.service.js', () => ({
  stripeService: {
    isEnabled: vi.fn().mockReturnValue(true),
    getEscrowStatus: vi.fn(),
    updateApplicationFee: vi.fn(),
    capturePayment: vi.fn(),
  },
}));

vi.mock('../../src/services/availabilityHold.service.js', () => ({
  availabilityHoldService: {
    cleanupExpiredHolds: vi.fn(),
  },
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    tool: {
      findFirst: vi.fn(),
    },
    space: {
      findFirst: vi.fn(),
    },
    service: {
      findFirst: vi.fn(),
    },
    request: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    insuranceDocument: {
      findMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readdir: vi.fn(),
    stat: vi.fn(),
    mkdir: vi.fn(),
    rename: vi.fn(),
  },
}));

import { schedulerService } from '../../src/services/scheduler.service.js';
import { authService } from '../../src/services/auth.service.js';
import { uploadService } from '../../src/services/upload.service.js';
import { snapshotDailyMetrics } from '../../src/services/analytics.service.js';
import { insuranceService } from '../../src/services/insurance.service.js';
import { emailService } from '../../src/services/email.service.js';
import { stripeService } from '../../src/services/stripe.service.js';
import { availabilityHoldService } from '../../src/services/availabilityHold.service.js';
import { prisma } from '../../src/config/database.js';
import { logger } from '../../src/config/logger.js';

describe('SchedulerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    schedulerService.stop();
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe('start/stop', () => {
    it('should start all scheduled tasks', () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);

      schedulerService.start();

      expect(logger.info).toHaveBeenCalledWith('Starting scheduler service...');
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Session cleanup scheduled'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Orphan file cleanup scheduled'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Deleted file cleanup scheduled'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('GDPR compliance checks scheduled'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Daily metrics snapshot scheduled'));
    });

    it('should stop all scheduled tasks', () => {
      schedulerService.start();
      schedulerService.stop();

      expect(logger.info).toHaveBeenCalledWith('Stopping scheduler service...');
    });

    it('should be safe to stop without starting', () => {
      expect(() => schedulerService.stop()).not.toThrow();
    });
  });

  describe('session cleanup', () => {
    it('should call cleanupExpiredSessions on start', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(5);

      schedulerService.start();

      // Allow the immediate cleanup to run (advance by a small amount)
      await vi.advanceTimersByTimeAsync(100);

      expect(authService.cleanupExpiredSessions).toHaveBeenCalled();
    });

    it('should log when sessions are cleaned', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(10);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(logger.info).toHaveBeenCalledWith('Cleaned up 10 expired sessions');
    });

    it('should not log when no sessions cleaned', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Cleaned up 0 expired sessions'));
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockRejectedValue(new Error('DB error'));

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(logger.error).toHaveBeenCalledWith(
        'Error cleaning up expired sessions:',
        expect.any(Error)
      );
    });
  });

  describe('deleted file cleanup', () => {
    it('should call cleanupExpiredDeletedFiles', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(uploadService.cleanupExpiredDeletedFiles).mockResolvedValue(3);

      schedulerService.start();

      // Advance timer past the startup delay (10 minutes)
      await vi.advanceTimersByTimeAsync(11 * 60 * 1000);

      expect(uploadService.cleanupExpiredDeletedFiles).toHaveBeenCalled();
    });

    it('should log when files are deleted', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(uploadService.cleanupExpiredDeletedFiles).mockResolvedValue(5);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(11 * 60 * 1000);

      expect(logger.info).toHaveBeenCalledWith('Permanently deleted 5 expired files');
    });
  });

  describe('GDPR compliance', () => {
    it('should check for pending deletions past deadline', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(authService.cleanupExpiredPasswordResetTokens).mockResolvedValue(0);
      vi.mocked(prisma.user.count).mockResolvedValue(2);

      schedulerService.start();

      // Advance timer past the startup delay (15 minutes)
      await vi.advanceTimersByTimeAsync(16 * 60 * 1000);

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: {
          accountStatus: 'DELETED',
          updatedDate: { lt: expect.any(Date) },
          email: { not: { contains: '@anonymized.local' } },
        },
      });
    });

    it('should log warning when pending deletions exist', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(authService.cleanupExpiredPasswordResetTokens).mockResolvedValue(0);
      vi.mocked(prisma.user.count).mockResolvedValue(3);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(16 * 60 * 1000);

      expect(logger.warn).toHaveBeenCalledWith(
        'GDPR ALERT: 3 user(s) pending anonymization past 30-day deadline'
      );
    });

    it('should cleanup expired password reset tokens', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(authService.cleanupExpiredPasswordResetTokens).mockResolvedValue(10);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(16 * 60 * 1000);

      expect(authService.cleanupExpiredPasswordResetTokens).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Cleaned up 10 expired password reset tokens');
    });
  });

  describe('daily metrics snapshot', () => {
    it('should schedule daily metrics snapshot at midnight', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(snapshotDailyMetrics).mockResolvedValue();

      schedulerService.start();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Daily metrics snapshot scheduled for midnight')
      );
    });

    it('should call snapshotDailyMetrics at midnight', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(snapshotDailyMetrics).mockResolvedValue();

      // Set current time to 23:59
      const now = new Date();
      now.setHours(23, 59, 0, 0);
      vi.setSystemTime(now);

      schedulerService.start();

      // Advance to midnight (1 minute + buffer)
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

      expect(snapshotDailyMetrics).toHaveBeenCalled();
    });

    it('should log success when daily metrics captured', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(snapshotDailyMetrics).mockResolvedValue();

      const now = new Date();
      now.setHours(23, 59, 0, 0);
      vi.setSystemTime(now);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

      expect(logger.info).toHaveBeenCalledWith('Daily metrics snapshot captured successfully');
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(snapshotDailyMetrics).mockRejectedValue(new Error('DB error'));

      const now = new Date();
      now.setHours(23, 59, 0, 0);
      vi.setSystemTime(now);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

      expect(logger.error).toHaveBeenCalledWith(
        'Error capturing daily metrics snapshot:',
        expect.any(Error)
      );
    });
  });

  describe('insurance expiry checks', () => {
    it('should mark expired insurance documents', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(insuranceService.markExpiredDocuments).mockResolvedValue(2);
      vi.mocked(prisma.insuranceDocument.findMany).mockResolvedValue([]);

      schedulerService.start();

      // Advance past the startup delay (20 minutes)
      await vi.advanceTimersByTimeAsync(21 * 60 * 1000);

      expect(insuranceService.markExpiredDocuments).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Marked 2 insurance documents as expired');
    });

    it('should send expiry reminder emails', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(insuranceService.markExpiredDocuments).mockResolvedValue(0);

      const expiringDoc = {
        id: 'doc-1',
        documentType: 'PUBLIC_LIABILITY',
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'test@example.com',
        },
      };

      vi.mocked(prisma.insuranceDocument.findMany).mockResolvedValue([expiringDoc] as any);
      vi.mocked(emailService.sendInsuranceExpiryReminderEmail).mockResolvedValue(undefined);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(21 * 60 * 1000);

      expect(emailService.sendInsuranceExpiryReminderEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          userName: 'Test User',
          documentType: 'PUBLIC_LIABILITY',
        })
      );
    });

    it('should handle email sending errors gracefully', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(insuranceService.markExpiredDocuments).mockResolvedValue(0);

      const expiringDoc = {
        id: 'doc-1',
        documentType: 'PUBLIC_LIABILITY',
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'test@example.com',
        },
      };

      vi.mocked(prisma.insuranceDocument.findMany).mockResolvedValue([expiringDoc] as any);
      vi.mocked(emailService.sendInsuranceExpiryReminderEmail).mockRejectedValue(new Error('Email failed'));

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(21 * 60 * 1000);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send insurance expiry reminder'),
        expect.any(Error)
      );
    });
  });

  describe('request expiry', () => {
    it('should mark expired requests as EXPIRED', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(prisma.request.updateMany).mockResolvedValue({ count: 5 });

      schedulerService.start();

      // Advance past the startup delay (5 minutes)
      await vi.advanceTimersByTimeAsync(6 * 60 * 1000);

      expect(prisma.request.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          expiresAt: { lt: expect.any(Date) },
        },
        data: {
          status: 'EXPIRED',
        },
      });
      expect(logger.info).toHaveBeenCalledWith('Marked 5 expired requests as EXPIRED');
    });

    it('should not log when no requests expired', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(prisma.request.updateMany).mockResolvedValue({ count: 0 });

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(6 * 60 * 1000);

      expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Marked 0 expired requests'));
    });
  });

  describe('webhook event cleanup', () => {
    it('should delete old webhook events in batches', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      // First batch returns 1000 (full batch), second returns less (done)
      vi.mocked(prisma.$executeRaw)
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(500);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned up 1500 expired webhook events')
      );
    });

    it('should handle errors during webhook cleanup', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(prisma.$executeRaw).mockRejectedValue(new Error('DB error'));

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(logger.error).toHaveBeenCalledWith(
        'Error cleaning up expired webhook events:',
        expect.any(Error)
      );
    });
  });

  describe('escrow expiry checks', () => {
    it('should send 48h reminder for expiring escrow payments', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(stripeService.isEnabled).mockReturnValue(true);

      // Calculate dates based on current fake time
      const now = Date.now();
      const expiringTransaction = {
        id: 'txn-1',
        stripePaymentIntentId: 'pi_123',
        status: 'CONFIRMED',
        paymentStatus: 'PENDING',
        createdDate: new Date(now - 5 * 24 * 60 * 60 * 1000), // 5 days ago (48h until expiry)
        userId: 'user-1',
        providerId: 'provider-1',
        rentalFee: 10000,
        applicationFeeAmount: 500,
        providerSponsorCpaPercent: 0,
        renterSponsorCpaPercent: 0,
        notes: '',
        user: { id: 'user-1', email: 'user@test.com', name: 'User' },
        provider: { id: 'provider-1', email: 'provider@test.com', name: 'Provider', stripeConnectId: 'acct_123' },
        tool: { name: 'Test Tool' },
        space: null,
        service: null,
      };

      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce([expiringTransaction] as any) // Expiring transactions
        .mockResolvedValueOnce([]); // Expired transactions
      vi.mocked(emailService.sendEscrowExpiryReminderEmail).mockResolvedValue(undefined);

      schedulerService.start();

      // Advance past the startup delay (25 minutes)
      await vi.advanceTimersByTimeAsync(26 * 60 * 1000);

      expect(emailService.sendEscrowExpiryReminderEmail).toHaveBeenCalledWith(
        'user@test.com',
        expect.objectContaining({
          userName: 'User',
          resourceName: 'Test Tool',
          transactionId: 'txn-1',
        })
      );
    });

    it('should auto-capture escrow payments 12h before expiry', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(stripeService.isEnabled).mockReturnValue(true);

      // Calculate dates based on current fake time
      const now = Date.now();
      const almostExpiredTransaction = {
        id: 'txn-1',
        stripePaymentIntentId: 'pi_123',
        status: 'CONFIRMED',
        paymentStatus: 'PENDING',
        createdDate: new Date(now - 6.5 * 24 * 60 * 60 * 1000), // 6.5 days ago (12h until expiry)
        userId: 'user-1',
        providerId: 'provider-1',
        rentalFee: 10000,
        applicationFeeAmount: 500,
        providerSponsorCpaPercent: 0,
        renterSponsorCpaPercent: 0,
        notes: '',
        user: { id: 'user-1', email: 'user@test.com', name: 'User' },
        provider: { id: 'provider-1', email: 'provider@test.com', name: 'Provider', stripeConnectId: 'acct_123' },
        tool: { name: 'Test Tool' },
        space: null,
        service: null,
      };

      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce([almostExpiredTransaction] as any)
        .mockResolvedValueOnce([]);
      vi.mocked(stripeService.getEscrowStatus).mockResolvedValue({
        requiresCapture: true,
        status: 'requires_capture',
        amount: 10000,
        capturedAmount: 0,
      });
      vi.mocked(stripeService.capturePayment).mockResolvedValue({
        paymentIntentId: 'pi_123',
        status: 'succeeded',
        amountCaptured: 10000,
        transferId: 'tr_123',
      });
      vi.mocked(prisma.transaction.update).mockResolvedValue({} as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(emailService.sendEscrowAutoCompletedEmail).mockResolvedValue(undefined);
      vi.mocked(emailService.sendPaymentReleasedEmail).mockResolvedValue(undefined);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(26 * 60 * 1000);

      expect(stripeService.capturePayment).toHaveBeenCalledWith({
        paymentIntentId: 'pi_123',
      });
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'txn-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          paymentStatus: 'PAID',
        }),
      });
    });

    it('should mark truly expired transactions as cancelled', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(stripeService.isEnabled).mockReturnValue(true);

      // Calculate dates based on current fake time
      const now = Date.now();
      const expiredTransaction = {
        id: 'txn-expired',
        stripePaymentIntentId: 'pi_expired',
        status: 'CONFIRMED',
        paymentStatus: 'PENDING',
        createdDate: new Date(now - 8 * 24 * 60 * 60 * 1000), // 8 days ago (past 7-day limit)
        notes: '',
      };

      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce([]) // No expiring transactions
        .mockResolvedValueOnce([expiredTransaction] as any); // One expired
      vi.mocked(prisma.transaction.update).mockResolvedValue({} as any);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(26 * 60 * 1000);

      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'txn-expired' },
        data: expect.objectContaining({
          status: 'CANCELLED',
          paymentStatus: 'FAILED',
        }),
      });
    });

    it('should skip escrow check when Stripe is not enabled', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(stripeService.isEnabled).mockReturnValue(false);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(26 * 60 * 1000);

      // Transaction.findMany for escrow should not be called with escrow-specific params
      expect(stripeService.capturePayment).not.toHaveBeenCalled();
    });
  });

  describe('availability hold cleanup', () => {
    it('should cleanup expired availability holds', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(availabilityHoldService.cleanupExpiredHolds).mockResolvedValue(3);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(availabilityHoldService.cleanupExpiredHolds).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Cleaned up 3 expired availability holds');
    });

    it('should not log when no holds cleaned', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(availabilityHoldService.cleanupExpiredHolds).mockResolvedValue(0);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Cleaned up 0 expired availability holds'));
    });

    it('should handle errors during hold cleanup', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(availabilityHoldService.cleanupExpiredHolds).mockRejectedValue(new Error('Cleanup failed'));

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(logger.error).toHaveBeenCalledWith(
        'Error cleaning up expired holds:',
        expect.any(Error)
      );
    });
  });
});
