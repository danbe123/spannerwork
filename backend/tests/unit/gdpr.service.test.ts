/**
 * GDPR Service Unit Tests
 * 
 * Tests for user data deletion, anonymization, and export functionality.
 * Critical for GDPR compliance verification.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    tool: { deleteMany: vi.fn() },
    space: { deleteMany: vi.fn() },
    service: { deleteMany: vi.fn() },
    request: { deleteMany: vi.fn() },
    message: { deleteMany: vi.fn() },
    savedSearch: { deleteMany: vi.fn() },
    booking: { deleteMany: vi.fn() },
    transaction: { count: vi.fn(), updateMany: vi.fn() },
    session: { deleteMany: vi.fn() },
    passwordResetToken: { deleteMany: vi.fn() },
    emailVerificationToken: { deleteMany: vi.fn() },
    referral: { updateMany: vi.fn() },
    dispute: { count: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
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

vi.mock('../../src/services/auth.service.js', () => ({
  authService: {
    deleteAllUserSessions: vi.fn(),
  },
}));

vi.mock('../../src/services/audit.service.js', () => ({
  auditService: {
    log: vi.fn(),
  },
}));

import { gdprService } from '../../src/services/gdpr.service.js';
import { prisma } from '../../src/config/database.js';
import { authService } from '../../src/services/auth.service.js';
import { auditService } from '../../src/services/audit.service.js';

describe('GdprService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('softDeleteUser', () => {
    const userId = 'user-123';
    const userEmail = 'test@example.com';

    it('should mark user as deleted and delete sessions', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email: userEmail,
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(authService.deleteAllUserSessions).mockResolvedValue(undefined as any);
      vi.mocked(auditService.log).mockResolvedValue(undefined as any);

      await gdprService.softDeleteUser(userId);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          accountStatus: 'DELETED',
        },
      });
      expect(authService.deleteAllUserSessions).toHaveBeenCalledWith(userId);
    });

    it('should log audit event for soft delete', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email: userEmail,
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(authService.deleteAllUserSessions).mockResolvedValue(undefined as any);
      vi.mocked(auditService.log).mockResolvedValue(undefined as any);

      await gdprService.softDeleteUser(userId, 'admin-1');

      expect(auditService.log).toHaveBeenCalledWith({
        action: 'USER_SOFT_DELETED',
        userId: 'admin-1',
        resourceType: 'User',
        resourceId: userId,
        metadata: { targetEmail: userEmail },
      });
    });

    it('should throw error when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(gdprService.softDeleteUser(userId)).rejects.toThrow('User not found');
    });
  });

  describe('anonymizeUser', () => {
    const userId = 'user-123';
    const requestedBy = 'admin-1';

    it('should anonymize user data within a transaction', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        accountStatus: 'ACTIVE',
      } as any);

      // Mock the transaction
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          user: { update: vi.fn() },
          tool: { deleteMany: vi.fn() },
          space: { deleteMany: vi.fn() },
          service: { deleteMany: vi.fn() },
          request: { deleteMany: vi.fn() },
          message: { deleteMany: vi.fn() },
          savedSearch: { deleteMany: vi.fn() },
          booking: { deleteMany: vi.fn() },
          transaction: { updateMany: vi.fn() },
          session: { deleteMany: vi.fn() },
          passwordResetToken: { deleteMany: vi.fn().mockResolvedValue({}) },
          emailVerificationToken: { deleteMany: vi.fn().mockResolvedValue({}) },
          referral: { updateMany: vi.fn() },
          dispute: { updateMany: vi.fn() },
        };
        await callback(tx as any);
        return {};
      });

      vi.mocked(auditService.log).mockResolvedValue(undefined as any);

      await gdprService.anonymizeUser(userId, requestedBy);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith({
        action: 'USER_ANONYMIZED',
        userId: requestedBy,
        resourceType: 'User',
        resourceId: userId,
        metadata: expect.objectContaining({
          reason: 'GDPR request',
        }),
      });
    });

    it('should throw error when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        gdprService.anonymizeUser(userId, requestedBy)
      ).rejects.toThrow('User not found');
    });
  });

  describe('exportUserData', () => {
    const userId = 'user-123';

    it('should export all user data', async () => {
      const userData = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'secret-hash',
        tools: [],
        spaces: [],
        services: [],
        requestsCreated: [],
        transactions: [],
        reviewsGiven: [],
        reviewsReceived: [],
        messagesFrom: [],
        messagesTo: [],
        savedSearches: [],
        bookings: [],
        referralsGiven: [],
        referralsReceived: [],
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(userData as any);
      vi.mocked(auditService.log).mockResolvedValue(undefined as any);

      const result = await gdprService.exportUserData(userId);

      expect(result).toHaveProperty('exportDate');
      expect(result).toHaveProperty('user');
      // Password hash should be removed
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should log audit event for data export', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
      } as any);
      vi.mocked(auditService.log).mockResolvedValue(undefined as any);

      await gdprService.exportUserData(userId);

      expect(auditService.log).toHaveBeenCalledWith({
        action: 'USER_DATA_EXPORTED',
        userId,
        resourceType: 'User',
        resourceId: userId,
        metadata: { reason: 'GDPR data export request' },
      });
    });

    it('should throw error when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(gdprService.exportUserData(userId)).rejects.toThrow('User not found');
    });
  });

  describe('canPermanentlyDelete', () => {
    const userId = 'user-123';

    it('should return eligible when no pending transactions or disputes', async () => {
      vi.mocked(prisma.transaction.count).mockResolvedValue(0);
      vi.mocked(prisma.dispute.count).mockResolvedValue(0);

      const result = await gdprService.canPermanentlyDelete(userId);

      expect(result.eligible).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('should return not eligible when pending transactions exist', async () => {
      vi.mocked(prisma.transaction.count).mockResolvedValue(2);
      vi.mocked(prisma.dispute.count).mockResolvedValue(0);

      const result = await gdprService.canPermanentlyDelete(userId);

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('2 pending transaction(s) must be completed or cancelled');
    });

    it('should return not eligible when open disputes exist', async () => {
      vi.mocked(prisma.transaction.count).mockResolvedValue(0);
      vi.mocked(prisma.dispute.count).mockResolvedValue(1);

      const result = await gdprService.canPermanentlyDelete(userId);

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('1 open dispute(s) must be resolved');
    });

    it('should return multiple reasons when both exist', async () => {
      vi.mocked(prisma.transaction.count).mockResolvedValue(3);
      vi.mocked(prisma.dispute.count).mockResolvedValue(2);

      const result = await gdprService.canPermanentlyDelete(userId);

      expect(result.eligible).toBe(false);
      expect(result.reasons).toHaveLength(2);
    });
  });
});
