import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    tradeAccount: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    teamMember: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
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

vi.mock('../../src/services/email.service.js', () => ({
  emailService: {
    sendTeamInvitation: vi.fn(),
  },
}));

import { TradeAccountService } from '../../src/services/tradeAccount.service.js';
import { prisma } from '../../src/config/database.js';
import { emailService } from '../../src/services/email.service.js';
import { logger } from '../../src/config/logger.js';

describe('TradeAccountService', () => {
  let tradeAccountService: TradeAccountService;

  beforeEach(() => {
    vi.clearAllMocks();
    tradeAccountService = new TradeAccountService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('get', () => {
    it('should return trade account with team members', async () => {
      const mockAccount = {
        id: 'account-1',
        userId: 'user-1',
        companyName: 'Test Company',
        teamMembers: [],
      };

      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue(mockAccount as any);

      const result = await tradeAccountService.get('user-1');

      expect(result).toEqual(mockAccount);
      expect(prisma.tradeAccount.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: expect.objectContaining({
          teamMembers: expect.any(Object),
        }),
      });
    });

    it('should return null when no account exists', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue(null);

      const result = await tradeAccountService.get('user-1');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create an individual trade account', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.tradeAccount.create).mockResolvedValue({
        id: 'account-1',
        userId: 'user-1',
        accountType: 'INDIVIDUAL',
      } as any);

      const result = await tradeAccountService.create('user-1', {
        accountType: 'INDIVIDUAL',
      });

      expect(result.accountType).toBe('INDIVIDUAL');
      expect(prisma.tradeAccount.create).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Created trade account', expect.any(Object));
    });

    it('should create a company trade account', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.tradeAccount.create).mockResolvedValue({
        id: 'account-1',
        userId: 'user-1',
        accountType: 'COMPANY',
        companyName: 'ACME Ltd',
        vatNumber: 'GB123456789',
      } as any);

      const result = await tradeAccountService.create('user-1', {
        accountType: 'COMPANY',
        companyName: 'ACME Ltd',
        vatNumber: 'gb 123 456 789',
      });

      expect(result.accountType).toBe('COMPANY');
      // VAT number should be normalized
      expect(prisma.tradeAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          vatNumber: 'GB123456789', // Normalized (spaces removed, uppercase)
        }),
      });
    });

    it('should throw error if user already has trade account', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue({
        id: 'existing-account',
      } as any);

      await expect(
        tradeAccountService.create('user-1', { accountType: 'INDIVIDUAL' })
      ).rejects.toThrow('User already has a trade account');
    });

    it('should require company name for company accounts', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue(null);

      await expect(
        tradeAccountService.create('user-1', { accountType: 'COMPANY' })
      ).rejects.toThrow('Company name is required for company accounts');
    });
  });

  describe('update', () => {
    it('should update trade account', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue({
        id: 'account-1',
        userId: 'user-1',
        accountType: 'INDIVIDUAL',
        teamMembers: [],
      } as any);

      vi.mocked(prisma.tradeAccount.update).mockResolvedValue({
        id: 'account-1',
        companyName: 'New Company',
      } as any);

      const result = await tradeAccountService.update('user-1', {
        companyName: 'New Company',
      });

      expect(result.companyName).toBe('New Company');
      expect(logger.info).toHaveBeenCalledWith('Updated trade account', { userId: 'user-1' });
    });

    it('should throw error when account not found', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue(null);

      await expect(
        tradeAccountService.update('user-1', { companyName: 'Test' })
      ).rejects.toThrow('Trade account not found');
    });

    it('should require company name when switching to company type', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue({
        id: 'account-1',
        userId: 'user-1',
        accountType: 'INDIVIDUAL',
        companyName: null,
        teamMembers: [],
      } as any);

      await expect(
        tradeAccountService.update('user-1', { accountType: 'COMPANY' })
      ).rejects.toThrow('Company name is required for company accounts');
    });

    it('should normalize postcode to uppercase', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue({
        id: 'account-1',
        userId: 'user-1',
        teamMembers: [],
      } as any);

      vi.mocked(prisma.tradeAccount.update).mockResolvedValue({
        id: 'account-1',
        billingPostcode: 'SW1A 1AA',
      } as any);

      await tradeAccountService.update('user-1', {
        billingPostcode: 'sw1a 1aa',
      });

      expect(prisma.tradeAccount.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: expect.objectContaining({
          billingPostcode: 'SW1A 1AA',
        }),
      });
    });
  });

  describe('adminSetBulkDiscount', () => {
    it('should set bulk discount within bounds', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue({
        id: 'account-1',
        bulkDiscountPercent: 0,
      } as any);

      vi.mocked(prisma.tradeAccount.update).mockResolvedValue({
        id: 'account-1',
        bulkDiscountPercent: 15,
      } as any);

      const result = await tradeAccountService.adminSetBulkDiscount('account-1', 15, 'admin-1');

      expect(result.bulkDiscountPercent).toBe(15);
      expect(logger.info).toHaveBeenCalledWith('Admin set bulk discount', expect.objectContaining({
        accountId: 'account-1',
        discountPercent: 15,
        adminId: 'admin-1',
      }));
    });

    it('should reject discount below 0%', async () => {
      await expect(
        tradeAccountService.adminSetBulkDiscount('account-1', -5, 'admin-1')
      ).rejects.toThrow('Bulk discount must be between 0 and 50%');
    });

    it('should reject discount above 50%', async () => {
      await expect(
        tradeAccountService.adminSetBulkDiscount('account-1', 60, 'admin-1')
      ).rejects.toThrow('Bulk discount must be between 0 and 50%');
    });

    it('should throw error when account not found', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue(null);

      await expect(
        tradeAccountService.adminSetBulkDiscount('nonexistent', 10, 'admin-1')
      ).rejects.toThrow('Trade account not found');
    });

    it('should round discount to nearest integer', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue({
        id: 'account-1',
        bulkDiscountPercent: 0,
      } as any);

      vi.mocked(prisma.tradeAccount.update).mockResolvedValue({
        id: 'account-1',
        bulkDiscountPercent: 15,
      } as any);

      await tradeAccountService.adminSetBulkDiscount('account-1', 14.7, 'admin-1');

      expect(prisma.tradeAccount.update).toHaveBeenCalledWith({
        where: { id: 'account-1' },
        data: { bulkDiscountPercent: 15 },
      });
    });
  });

  describe('calculateBulkDiscount', () => {
    it('should calculate discount correctly', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue({
        id: 'account-1',
        bulkDiscountPercent: 10,
        teamMembers: [],
      } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);

      const result = await tradeAccountService.calculateBulkDiscount('user-1', 10000);

      expect(result.discount).toBe(1000); // 10% of £100
      expect(result.finalAmount).toBe(9000); // £100 - £10
    });

    it('should return zero discount when user has no trade account', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);

      const result = await tradeAccountService.calculateBulkDiscount('user-1', 10000);

      expect(result.discount).toBe(0);
      expect(result.finalAmount).toBe(10000);
    });

    it('should return zero discount when discount percent is 0', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue({
        id: 'account-1',
        bulkDiscountPercent: 0,
        teamMembers: [],
      } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);

      const result = await tradeAccountService.calculateBulkDiscount('user-1', 10000);

      expect(result.discount).toBe(0);
      expect(result.finalAmount).toBe(10000);
    });

    it('should cap discount at 50%', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue({
        id: 'account-1',
        bulkDiscountPercent: 80, // Above max
        teamMembers: [],
      } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);

      const result = await tradeAccountService.calculateBulkDiscount('user-1', 10000);

      expect(result.discount).toBe(5000); // 50% max
      expect(result.finalAmount).toBe(5000);
    });

    it('should use team member account discount when user is a member', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue(null); // User doesn't own account
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        tradeAccount: {
          id: 'account-1',
          bulkDiscountPercent: 20,
        },
      } as any);

      const result = await tradeAccountService.calculateBulkDiscount('user-1', 10000);

      expect(result.discount).toBe(2000); // 20%
      expect(result.finalAmount).toBe(8000);
    });
  });

  describe('inviteTeamMember', () => {
    it('should invite a team member', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue({
        id: 'account-1',
        userId: 'owner-1',
        companyName: 'Test Company',
        teamMembers: [],
      } as any);

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce({ id: 'invitee-1', email: 'invitee@test.com' } as any) // Invitee lookup
        .mockResolvedValueOnce({ name: 'Owner Name' } as any); // Owner lookup

      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null); // Not already a member
      vi.mocked(prisma.tradeAccount.findUnique)
        .mockResolvedValueOnce({
          id: 'account-1',
          userId: 'owner-1',
          companyName: 'Test Company',
          teamMembers: [],
        } as any)
        .mockResolvedValueOnce(null); // Invitee doesn't own an account

      vi.mocked(prisma.teamMember.create).mockResolvedValue({
        id: 'member-1',
        userId: 'invitee-1',
        status: 'PENDING',
        user: { id: 'invitee-1', name: 'Invitee', email: 'invitee@test.com' },
      } as any);

      vi.mocked(emailService.sendTeamInvitation).mockResolvedValue(undefined);

      const result = await tradeAccountService.inviteTeamMember('owner-1', 'invitee@test.com');

      expect(result.status).toBe('PENDING');
      expect(emailService.sendTeamInvitation).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Invited team member', expect.any(Object));
    });

    it('should throw error when inviting yourself', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue({
        id: 'account-1',
        userId: 'owner-1',
        teamMembers: [],
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'owner-1', // Same as owner
        email: 'owner@test.com',
      } as any);

      await expect(
        tradeAccountService.inviteTeamMember('owner-1', 'owner@test.com')
      ).rejects.toThrow('You cannot invite yourself');
    });

    it('should throw error when user not found', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue({
        id: 'account-1',
        userId: 'owner-1',
        teamMembers: [],
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        tradeAccountService.inviteTeamMember('owner-1', 'nonexistent@test.com')
      ).rejects.toThrow('User not found with this email');
    });

    it('should throw error when user already a member', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue({
        id: 'account-1',
        userId: 'owner-1',
        teamMembers: [],
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'invitee-1',
        email: 'invitee@test.com',
      } as any);

      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        status: 'ACTIVE',
      } as any);

      await expect(
        tradeAccountService.inviteTeamMember('owner-1', 'invitee@test.com')
      ).rejects.toThrow('User is already a team member');
    });

    it('should throw error when user owns another trade account', async () => {
      vi.mocked(prisma.tradeAccount.findUnique)
        .mockResolvedValueOnce({
          id: 'account-1',
          userId: 'owner-1',
          teamMembers: [],
        } as any)
        .mockResolvedValueOnce({
          id: 'other-account', // Invitee owns this account
          userId: 'invitee-1',
        } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'invitee-1',
        email: 'invitee@test.com',
      } as any);

      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);

      await expect(
        tradeAccountService.inviteTeamMember('owner-1', 'invitee@test.com')
      ).rejects.toThrow('User already owns a trade account');
    });
  });

  describe('acceptInvitation', () => {
    it('should accept a pending invitation', async () => {
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({
        id: 'member-1',
        userId: 'user-1',
        status: 'PENDING',
        tradeAccount: { id: 'account-1' },
      } as any);

      vi.mocked(prisma.teamMember.update).mockResolvedValue({
        id: 'member-1',
        status: 'ACTIVE',
        acceptedAt: new Date(),
        user: { id: 'user-1', name: 'User' },
      } as any);

      const result = await tradeAccountService.acceptInvitation('user-1', 'member-1');

      expect(result.status).toBe('ACTIVE');
      expect(logger.info).toHaveBeenCalledWith('Accepted team invitation', expect.any(Object));
    });

    it('should throw error when invitation not found', async () => {
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null);

      await expect(
        tradeAccountService.acceptInvitation('user-1', 'nonexistent')
      ).rejects.toThrow('Invitation not found');
    });

    it('should throw error when invitation is not for this user', async () => {
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({
        id: 'member-1',
        userId: 'other-user',
        status: 'PENDING',
      } as any);

      await expect(
        tradeAccountService.acceptInvitation('user-1', 'member-1')
      ).rejects.toThrow('This invitation is not for you');
    });

    it('should throw error when already accepted', async () => {
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({
        id: 'member-1',
        userId: 'user-1',
        status: 'ACTIVE',
      } as any);

      await expect(
        tradeAccountService.acceptInvitation('user-1', 'member-1')
      ).rejects.toThrow('Invitation already accepted');
    });

    it('should throw error when invitation was revoked', async () => {
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({
        id: 'member-1',
        userId: 'user-1',
        status: 'REMOVED',
      } as any);

      await expect(
        tradeAccountService.acceptInvitation('user-1', 'member-1')
      ).rejects.toThrow('This invitation has been revoked');
    });
  });

  describe('removeTeamMember', () => {
    it('should remove a team member', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue({
        id: 'account-1',
        userId: 'owner-1',
        teamMembers: [],
      } as any);

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({
        id: 'member-1',
        tradeAccountId: 'account-1',
      } as any);

      vi.mocked(prisma.teamMember.update).mockResolvedValue({
        id: 'member-1',
        status: 'REMOVED',
      } as any);

      await tradeAccountService.removeTeamMember('owner-1', 'member-1');

      expect(prisma.teamMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { status: 'REMOVED' },
      });
      expect(logger.info).toHaveBeenCalledWith('Removed team member', expect.any(Object));
    });

    it('should throw error when trying to remove member from another account', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue({
        id: 'account-1',
        userId: 'owner-1',
        teamMembers: [],
      } as any);

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({
        id: 'member-1',
        tradeAccountId: 'other-account', // Different account
      } as any);

      await expect(
        tradeAccountService.removeTeamMember('owner-1', 'member-1')
      ).rejects.toThrow('You can only remove members from your own trade account');
    });
  });

  describe('updateMemberRole', () => {
    it('should update team member role', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue({
        id: 'account-1',
        userId: 'owner-1',
        teamMembers: [],
      } as any);

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({
        id: 'member-1',
        tradeAccountId: 'account-1',
        role: 'MEMBER',
      } as any);

      vi.mocked(prisma.teamMember.update).mockResolvedValue({
        id: 'member-1',
        role: 'ADMIN',
        user: { id: 'user-1', name: 'User' },
      } as any);

      const result = await tradeAccountService.updateMemberRole('owner-1', 'member-1', 'ADMIN');

      expect(result.role).toBe('ADMIN');
      expect(logger.info).toHaveBeenCalledWith('Updated team member role', { memberId: 'member-1', role: 'ADMIN' });
    });
  });

  describe('getTeamMembers', () => {
    it('should return active team members', async () => {
      vi.mocked(prisma.tradeAccount.findUnique).mockResolvedValue({
        id: 'account-1',
        userId: 'owner-1',
        teamMembers: [],
      } as any);

      vi.mocked(prisma.teamMember.findMany).mockResolvedValue([
        { id: 'member-1', role: 'MEMBER', status: 'ACTIVE', user: { id: 'user-1', name: 'User 1' } },
        { id: 'member-2', role: 'ADMIN', status: 'ACTIVE', user: { id: 'user-2', name: 'User 2' } },
      ] as any);

      const result = await tradeAccountService.getTeamMembers('owner-1');

      expect(result).toHaveLength(2);
      expect(prisma.teamMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: 'REMOVED' },
          }),
        })
      );
    });
  });

  describe('getPendingInvitations', () => {
    it('should return pending invitations for user', async () => {
      vi.mocked(prisma.teamMember.findMany).mockResolvedValue([
        {
          id: 'invite-1',
          status: 'PENDING',
          tradeAccount: {
            companyName: 'Test Company',
            user: { name: 'Owner' },
          },
        },
      ] as any);

      const result = await tradeAccountService.getPendingInvitations('user-1');

      expect(result).toHaveLength(1);
      expect(prisma.teamMember.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          status: 'PENDING',
        },
        include: expect.any(Object),
      });
    });
  });
});
