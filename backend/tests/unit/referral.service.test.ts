import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    referral: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { referralService } from '../../src/services/referral.service.js';
import { prisma } from '../../src/config/database.js';
import { logger } from '../../src/config/logger.js';

describe('ReferralService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createReferral', () => {
    it('creates a referral with email invitation', async () => {
      const mockReferral = {
        id: 'ref-1',
        referrerId: 'user-1',
        email: 'friend@example.com',
        code: 'ABC123',
        status: 'PENDING',
        referrer: {
          id: 'user-1',
          name: 'John Doe',
          email: 'john@example.com',
        },
      };

      vi.mocked(prisma.referral.create).mockResolvedValue(mockReferral as any);

      const result = await referralService.createReferral({
        referrerId: 'user-1',
        referredEmail: 'friend@example.com',
        referralCode: 'ABC123',
      });

      expect(prisma.referral.create).toHaveBeenCalledWith({
        data: {
          referrerId: 'user-1',
          email: 'friend@example.com',
          code: 'ABC123',
          status: 'PENDING',
        },
        include: {
          referrer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      expect(result).toEqual(mockReferral);
      expect(logger.info).toHaveBeenCalledWith('Referral created: ref-1');
    });

    it('throws error on database failure', async () => {
      vi.mocked(prisma.referral.create).mockRejectedValue(new Error('DB error'));

      await expect(
        referralService.createReferral({
          referrerId: 'user-1',
          referredEmail: 'friend@example.com',
          referralCode: 'ABC123',
        })
      ).rejects.toThrow('Failed to create referral');

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('createSmsReferral', () => {
    it('creates a referral with phone invitation', async () => {
      const mockReferral = {
        id: 'ref-2',
        referrerId: 'user-1',
        phone: '+447123456789',
        code: 'XYZ789',
        status: 'PENDING',
        referrer: {
          id: 'user-1',
          name: 'John Doe',
          email: 'john@example.com',
        },
      };

      vi.mocked(prisma.referral.create).mockResolvedValue(mockReferral as any);

      const result = await referralService.createSmsReferral({
        referrerId: 'user-1',
        phone: '+447123456789',
        referralCode: 'XYZ789',
      });

      expect(prisma.referral.create).toHaveBeenCalledWith({
        data: {
          referrerId: 'user-1',
          code: 'XYZ789',
          phone: '+447123456789',
          status: 'PENDING',
        },
        include: {
          referrer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      expect(result).toEqual(mockReferral);
      expect(logger.info).toHaveBeenCalledWith('SMS referral created: ref-2');
    });

    it('throws error on database failure', async () => {
      vi.mocked(prisma.referral.create).mockRejectedValue(new Error('DB error'));

      await expect(
        referralService.createSmsReferral({
          referrerId: 'user-1',
          phone: '+447123456789',
          referralCode: 'XYZ789',
        })
      ).rejects.toThrow('Failed to create SMS referral');

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getReferralsByReferrer', () => {
    it('returns referrals for a user', async () => {
      const mockReferrals = [
        {
          id: 'ref-1',
          code: 'ABC123',
          status: 'COMPLETED',
          referred: {
            id: 'user-2',
            name: 'Jane Doe',
            email: 'jane@example.com',
            createdDate: new Date(),
          },
        },
        {
          id: 'ref-2',
          code: 'XYZ789',
          status: 'PENDING',
          referred: null,
        },
      ];

      vi.mocked(prisma.referral.findMany).mockResolvedValue(mockReferrals as any);

      const result = await referralService.getReferralsByReferrer('user-1');

      expect(prisma.referral.findMany).toHaveBeenCalledWith({
        where: {
          referrerId: 'user-1',
        },
        include: {
          referred: {
            select: {
              id: true,
              name: true,
              email: true,
              createdDate: true,
            },
          },
        },
        orderBy: {
          createdDate: 'desc',
        },
      });

      expect(result).toEqual(mockReferrals);
    });

    it('returns empty array when no referrals exist', async () => {
      vi.mocked(prisma.referral.findMany).mockResolvedValue([]);

      const result = await referralService.getReferralsByReferrer('user-1');

      expect(result).toEqual([]);
    });

    it('throws error on database failure', async () => {
      vi.mocked(prisma.referral.findMany).mockRejectedValue(new Error('DB error'));

      await expect(
        referralService.getReferralsByReferrer('user-1')
      ).rejects.toThrow('Failed to fetch referrals');

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getReferralByCode', () => {
    it('returns referral when valid pending code exists', async () => {
      const mockReferral = {
        id: 'ref-1',
        code: 'ABC123',
        status: 'PENDING',
        referrer: {
          id: 'user-1',
          name: 'John Doe',
        },
      };

      vi.mocked(prisma.referral.findFirst).mockResolvedValue(mockReferral as any);

      const result = await referralService.getReferralByCode('ABC123');

      expect(prisma.referral.findFirst).toHaveBeenCalledWith({
        where: {
          code: 'ABC123',
          status: 'PENDING',
        },
        include: {
          referrer: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      expect(result).toEqual(mockReferral);
    });

    it('returns null when code does not exist', async () => {
      vi.mocked(prisma.referral.findFirst).mockResolvedValue(null);

      const result = await referralService.getReferralByCode('INVALID');

      expect(result).toBeNull();
    });

    it('returns null for completed referral codes', async () => {
      vi.mocked(prisma.referral.findFirst).mockResolvedValue(null);

      const result = await referralService.getReferralByCode('COMPLETED_CODE');

      expect(result).toBeNull();
    });

    it('throws error on database failure', async () => {
      vi.mocked(prisma.referral.findFirst).mockRejectedValue(new Error('DB error'));

      await expect(
        referralService.getReferralByCode('ABC123')
      ).rejects.toThrow('Failed to fetch referral');

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('completeReferral', () => {
    it('marks referral as completed', async () => {
      const mockPendingReferral = {
        id: 'ref-1',
        code: 'ABC123',
        status: 'PENDING',
        referrerId: 'user-1',
      };

      const mockCompletedReferral = {
        ...mockPendingReferral,
        status: 'COMPLETED',
        referredId: 'user-2',
        completedDate: new Date(),
      };

      vi.mocked(prisma.referral.findFirst).mockResolvedValue(mockPendingReferral as any);
      vi.mocked(prisma.referral.update).mockResolvedValue(mockCompletedReferral as any);

      const result = await referralService.completeReferral('ABC123', 'user-2');

      expect(prisma.referral.findFirst).toHaveBeenCalledWith({
        where: {
          code: 'ABC123',
          status: 'PENDING',
        },
      });

      expect(prisma.referral.update).toHaveBeenCalledWith({
        where: {
          id: 'ref-1',
        },
        data: {
          status: 'COMPLETED',
          referredId: 'user-2',
          completedDate: expect.any(Date),
        },
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.referredId).toBe('user-2');
      expect(logger.info).toHaveBeenCalledWith('Referral completed: ref-1');
    });

    it('throws error when referral not found', async () => {
      vi.mocked(prisma.referral.findFirst).mockResolvedValue(null);

      await expect(
        referralService.completeReferral('INVALID', 'user-2')
      ).rejects.toThrow('Failed to complete referral');

      expect(prisma.referral.update).not.toHaveBeenCalled();
    });

    it('throws error when referral already completed', async () => {
      vi.mocked(prisma.referral.findFirst).mockResolvedValue(null); // Returns null for non-PENDING

      await expect(
        referralService.completeReferral('COMPLETED_CODE', 'user-2')
      ).rejects.toThrow('Failed to complete referral');
    });

    it('throws error on database failure', async () => {
      vi.mocked(prisma.referral.findFirst).mockRejectedValue(new Error('DB error'));

      await expect(
        referralService.completeReferral('ABC123', 'user-2')
      ).rejects.toThrow('Failed to complete referral');

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getReferralStats', () => {
    it('returns correct stats for user with referrals', async () => {
      vi.mocked(prisma.referral.count)
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(5)  // completed
        .mockResolvedValueOnce(3); // pending

      const result = await referralService.getReferralStats('user-1');

      expect(prisma.referral.count).toHaveBeenNthCalledWith(1, {
        where: { referrerId: 'user-1' },
      });

      expect(prisma.referral.count).toHaveBeenNthCalledWith(2, {
        where: { referrerId: 'user-1', status: 'COMPLETED' },
      });

      expect(prisma.referral.count).toHaveBeenNthCalledWith(3, {
        where: { referrerId: 'user-1', status: 'PENDING' },
      });

      expect(result).toEqual({
        total: 10,
        completed: 5,
        pending: 3,
        rewards: 50, // 5 completed * £10
      });
    });

    it('returns zero stats for user with no referrals', async () => {
      vi.mocked(prisma.referral.count)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await referralService.getReferralStats('user-1');

      expect(result).toEqual({
        total: 0,
        completed: 0,
        pending: 0,
        rewards: 0,
      });
    });

    it('calculates rewards at £10 per completed referral', async () => {
      vi.mocked(prisma.referral.count)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(5);

      const result = await referralService.getReferralStats('user-1');

      expect(result.rewards).toBe(150); // 15 * £10
    });

    it('throws error on database failure', async () => {
      vi.mocked(prisma.referral.count).mockRejectedValue(new Error('DB error'));

      await expect(
        referralService.getReferralStats('user-1')
      ).rejects.toThrow('Failed to fetch referral stats');

      expect(logger.error).toHaveBeenCalled();
    });
  });
});
