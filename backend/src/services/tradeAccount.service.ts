import { prisma } from '../config/database.js';
import { TradeAccount, TeamMember, AccountType, TeamRole } from '@prisma/client';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { logger } from '../config/logger.js';
import { emailService } from './email.service.js';

export interface CreateTradeAccountData {
  accountType?: AccountType;
  companyName?: string;
  companyRegistrationNo?: string;
  vatNumber?: string;
  billingAddress?: string;
  billingCity?: string;
  billingPostcode?: string;
  billingCountry?: string;
}

// FIX: Removed bulkDiscountPercent from UpdateTradeAccountData
// Users should NOT be able to set their own discount - this is admin-only
export interface UpdateTradeAccountData extends CreateTradeAccountData {
  // bulkDiscountPercent is intentionally excluded - use adminSetBulkDiscount instead
}

export class TradeAccountService {
  /**
   * Get trade account for a user
   */
  async get(userId: string): Promise<TradeAccount | null> {
    return prisma.tradeAccount.findUnique({
      where: { userId },
      include: {
        teamMembers: {
          where: { status: { not: 'REMOVED' } },
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
          orderBy: { invitedAt: 'asc' },
        },
      },
    });
  }

  /**
   * Create a new trade account
   */
  async create(userId: string, data: CreateTradeAccountData): Promise<TradeAccount> {
    // Check if user already has a trade account
    const existing = await prisma.tradeAccount.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new BadRequestError('User already has a trade account');
    }

    // Validate company fields if company type
    if (data.accountType === 'COMPANY') {
      if (!data.companyName) {
        throw new BadRequestError('Company name is required for company accounts');
      }
    }

    // Normalize VAT number if provided
    if (data.vatNumber) {
      data.vatNumber = data.vatNumber.replace(/\s/g, '').toUpperCase();
    }

    const tradeAccount = await prisma.tradeAccount.create({
      data: {
        userId,
        accountType: data.accountType || 'INDIVIDUAL',
        companyName: data.companyName,
        companyRegistrationNo: data.companyRegistrationNo,
        vatNumber: data.vatNumber,
        billingAddress: data.billingAddress,
        billingCity: data.billingCity,
        billingPostcode: data.billingPostcode?.toUpperCase(),
        billingCountry: data.billingCountry || 'GB',
      },
    });

    logger.info('Created trade account', { userId, accountType: data.accountType });
    return tradeAccount;
  }

  /**
   * Update trade account
   */
  async update(userId: string, data: UpdateTradeAccountData): Promise<TradeAccount> {
    const account = await this.get(userId);
    if (!account) {
      throw new NotFoundError('Trade account not found');
    }

    // Validate company fields if switching to company type
    if (data.accountType === 'COMPANY' && !data.companyName && !account.companyName) {
      throw new BadRequestError('Company name is required for company accounts');
    }

    // Normalize VAT number if provided
    if (data.vatNumber) {
      data.vatNumber = data.vatNumber.replace(/\s/g, '').toUpperCase();
    }

    // FIX: Removed bulkDiscountPercent - users cannot set their own discount
    const updated = await prisma.tradeAccount.update({
      where: { userId },
      data: {
        accountType: data.accountType,
        companyName: data.companyName,
        companyRegistrationNo: data.companyRegistrationNo,
        vatNumber: data.vatNumber,
        billingAddress: data.billingAddress,
        billingCity: data.billingCity,
        billingPostcode: data.billingPostcode?.toUpperCase(),
        billingCountry: data.billingCountry,
        // bulkDiscountPercent intentionally not updated here - use adminSetBulkDiscount
      },
    });

    logger.info('Updated trade account', { userId });
    return updated;
  }

  /**
   * FIX: Admin-only method to set bulk discount percentage
   * This ensures users cannot self-assign discounts
   * @param accountId - The trade account ID (not userId)
   * @param discountPercent - Discount percentage (0-50%)
   * @param adminId - The admin user making the change (for audit)
   */
  async adminSetBulkDiscount(
    accountId: string,
    discountPercent: number,
    adminId: string
  ): Promise<TradeAccount> {
    // Validate discount bounds (0-50% max to prevent abuse)
    const MAX_DISCOUNT_PERCENT = 50;
    if (discountPercent < 0 || discountPercent > MAX_DISCOUNT_PERCENT) {
      throw new BadRequestError(`Bulk discount must be between 0 and ${MAX_DISCOUNT_PERCENT}%`);
    }

    const account = await prisma.tradeAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundError('Trade account not found');
    }

    const updated = await prisma.tradeAccount.update({
      where: { id: accountId },
      data: { bulkDiscountPercent: Math.round(discountPercent) },
    });

    logger.info('Admin set bulk discount', {
      accountId,
      discountPercent,
      adminId,
      previousDiscount: account.bulkDiscountPercent,
    });

    return updated;
  }

  /**
   * Invite a team member
   */
  async inviteTeamMember(
    accountOwnerId: string,
    email: string,
    role: TeamRole = 'MEMBER'
  ): Promise<TeamMember> {
    const account = await this.get(accountOwnerId);
    if (!account) {
      throw new NotFoundError('Trade account not found');
    }

    // Find the user by email
    const invitedUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!invitedUser) {
      throw new NotFoundError('User not found with this email. They must have a SpannerWork account first.');
    }

    if (invitedUser.id === accountOwnerId) {
      throw new BadRequestError('You cannot invite yourself');
    }

    // Check if already a member
    const existingMember = await prisma.teamMember.findFirst({
      where: {
        tradeAccountId: account.id,
        userId: invitedUser.id,
        status: { not: 'REMOVED' },
      },
    });

    if (existingMember) {
      throw new BadRequestError('User is already a team member');
    }

    // Check if user is owner of another trade account
    const userOwnAccount = await prisma.tradeAccount.findUnique({
      where: { userId: invitedUser.id },
    });

    if (userOwnAccount) {
      throw new BadRequestError('User already owns a trade account and cannot be added as a team member');
    }

    // Create the invitation
    const member = await prisma.teamMember.create({
      data: {
        tradeAccountId: account.id,
        userId: invitedUser.id,
        email: email.toLowerCase(),
        role,
        status: 'PENDING',
        invitedById: accountOwnerId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    // Send invitation email
    const ownerUser = await prisma.user.findUnique({
      where: { id: accountOwnerId },
      select: { name: true },
    });

    try {
      await emailService.sendTeamInvitation({
        to: email,
        invitedByName: ownerUser?.name || 'A SpannerWork user',
        companyName: account.companyName || 'their trade account',
        acceptUrl: `${process.env.FRONTEND_URL}/trade-account/accept-invitation?id=${member.id}`,
      });
    } catch (error) {
      logger.error('Failed to send team invitation email', { error, memberId: member.id });
    }

    logger.info('Invited team member', { accountId: account.id, invitedUserId: invitedUser.id });
    return member;
  }

  /**
   * Accept team invitation
   */
  async acceptInvitation(userId: string, memberId: string): Promise<TeamMember> {
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: { tradeAccount: true },
    });

    if (!member) {
      throw new NotFoundError('Invitation not found');
    }

    if (member.userId !== userId) {
      throw new ForbiddenError('This invitation is not for you');
    }

    if (member.status === 'ACTIVE') {
      throw new BadRequestError('Invitation already accepted');
    }

    if (member.status === 'REMOVED') {
      throw new BadRequestError('This invitation has been revoked');
    }

    const updated = await prisma.teamMember.update({
      where: { id: memberId },
      data: {
        status: 'ACTIVE',
        acceptedAt: new Date(),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    logger.info('Accepted team invitation', { memberId, userId });
    return updated;
  }

  /**
   * Remove a team member
   */
  async removeTeamMember(accountOwnerId: string, memberId: string): Promise<void> {
    const account = await this.get(accountOwnerId);
    if (!account) {
      throw new NotFoundError('Trade account not found');
    }

    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundError('Team member not found');
    }

    if (member.tradeAccountId !== account.id) {
      throw new ForbiddenError('You can only remove members from your own trade account');
    }

    await prisma.teamMember.update({
      where: { id: memberId },
      data: { status: 'REMOVED' },
    });

    logger.info('Removed team member', { accountId: account.id, memberId });
  }

  /**
   * Update team member role
   */
  async updateMemberRole(
    accountOwnerId: string,
    memberId: string,
    role: TeamRole
  ): Promise<TeamMember> {
    const account = await this.get(accountOwnerId);
    if (!account) {
      throw new NotFoundError('Trade account not found');
    }

    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundError('Team member not found');
    }

    if (member.tradeAccountId !== account.id) {
      throw new ForbiddenError('You can only update members of your own trade account');
    }

    const updated = await prisma.teamMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    logger.info('Updated team member role', { memberId, role });
    return updated;
  }

  /**
   * Get team members for an account
   */
  async getTeamMembers(accountOwnerId: string): Promise<TeamMember[]> {
    const account = await this.get(accountOwnerId);
    if (!account) {
      throw new NotFoundError('Trade account not found');
    }

    return prisma.teamMember.findMany({
      where: {
        tradeAccountId: account.id,
        status: { not: 'REMOVED' },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
      orderBy: { invitedAt: 'asc' },
    });
  }

  /**
   * Check if user is a member of any trade account
   */
  async getUserTradeAccount(userId: string): Promise<TradeAccount | null> {
    // First check if user owns a trade account
    const ownAccount = await this.get(userId);
    if (ownAccount) {
      return ownAccount;
    }

    // Check if user is a team member of another account
    const membership = await prisma.teamMember.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: {
        tradeAccount: true,
      },
    });

    return membership?.tradeAccount || null;
  }

  /**
   * Calculate bulk discount for a trade account
   * FIX: Added upper bound validation (max 50%) to prevent negative amounts
   */
  async calculateBulkDiscount(
    userId: string,
    amount: number
  ): Promise<{ discount: number; finalAmount: number }> {
    const account = await this.getUserTradeAccount(userId);

    if (!account || account.bulkDiscountPercent <= 0) {
      return { discount: 0, finalAmount: amount };
    }

    // FIX: Cap discount at 50% to prevent negative final amounts
    const MAX_DISCOUNT_PERCENT = 50;
    const effectiveDiscount = Math.min(account.bulkDiscountPercent, MAX_DISCOUNT_PERCENT);

    const discount = Math.round(amount * (effectiveDiscount / 100));
    const finalAmount = amount - discount;

    // Sanity check: ensure final amount is never negative
    if (finalAmount < 0) {
      logger.warn('Calculated negative final amount, returning zero discount', {
        userId,
        amount,
        discountPercent: account.bulkDiscountPercent,
      });
      return { discount: 0, finalAmount: amount };
    }

    return {
      discount,
      finalAmount,
    };
  }

  /**
   * Get pending invitations for a user
   */
  async getPendingInvitations(userId: string): Promise<TeamMember[]> {
    return prisma.teamMember.findMany({
      where: {
        userId,
        status: 'PENDING',
      },
      include: {
        tradeAccount: {
          include: {
            user: {
              select: { name: true, email: true },
            },
          },
        },
      },
    });
  }
}

export const tradeAccountService = new TradeAccountService();
