/**
 * GDPR Compliance Service
 * 
 * Handles user data deletion, anonymization, and export
 * in compliance with GDPR requirements.
 */

import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { authService } from './auth.service.js';
import { auditService } from './audit.service.js';

/**
 * Anonymize user data while preserving transaction history
 */
function anonymizeUserData() {
  return {
    email: `deleted_${Date.now()}@anonymized.local`,
    passwordHash: null,
    name: 'Deleted User',
    username: null,
    phone: null,
    avatar: null,
    bio: null,
    postcode: null,
    locationAddress: null,
    locationLat: null,
    locationLng: null,
  };
}

export class GdprService {
  /**
   * Soft delete a user account
   * Marks the account as deleted but preserves data for legal requirements
   */
  async softDeleteUser(userId: string, deletedBy?: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Soft delete the user
    await prisma.user.update({
      where: { id: userId },
      data: {
        accountStatus: 'DELETED',
        // Store deletion metadata using updatedDate for now
        // In production, add deletedAt, deletedBy columns to schema
      },
    });

    // Delete all active sessions
    await authService.deleteAllUserSessions(userId);

    // Log audit event
    await auditService.log({
      action: 'USER_SOFT_DELETED',
      userId: deletedBy || userId,
      resourceType: 'User',
      resourceId: userId,
      metadata: { targetEmail: user.email },
    });

    logger.info(`User ${userId} soft deleted`);
  }

  /**
   * Anonymize user data (for GDPR "right to be forgotten")
   * This permanently removes PII while preserving transaction records
   */
  async anonymizeUser(userId: string, requestedBy: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        email: true,
        accountStatus: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Use transaction for atomic update
    await prisma.$transaction(async (tx) => {
      // Anonymize user data
      await tx.user.update({
        where: { id: userId },
        data: {
          ...anonymizeUserData(),
          accountStatus: 'DELETED',
        },
      });

      // Delete user's tool listings
      await tx.tool.deleteMany({
        where: { ownerId: userId },
      });

      // Delete user's space listings
      await tx.space.deleteMany({
        where: { ownerId: userId },
      });

      // Delete user's service listings
      await tx.service.deleteMany({
        where: { providerId: userId },
      });

      // Delete user's requests
      await tx.request.deleteMany({
        where: { seekerId: userId },
      });

      // Delete user's messages
      await tx.message.deleteMany({
        where: {
          OR: [
            { senderId: userId },
            { recipientId: userId },
          ],
        },
      });

      // Delete saved searches
      await tx.savedSearch.deleteMany({
        where: { userId },
      });

      // Keep transactions but anonymize user reference in notes (for legal records)
      await tx.transaction.updateMany({
        where: { userId },
        data: { notes: '[User data anonymized]' },
      });

      // Delete all sessions
      await tx.session.deleteMany({
        where: { userId },
      });

      // Delete password reset tokens
      await tx.passwordResetToken.deleteMany({
        where: { userId },
      }).catch(() => { /* Table may not exist */ });

      // Delete email verification tokens
      await tx.emailVerificationToken.deleteMany({
        where: { userId },
      }).catch(() => { /* Table may not exist */ });

      // Anonymize referrals (preserve structure but remove PII)
      // Mark user's referrals as completed with anonymized email
      await tx.referral.updateMany({
        where: { referrerId: userId },
        data: {
          email: null,
          phone: null,
          status: 'EXPIRED',
        },
      });

      // Remove user from received referrals
      await tx.referral.updateMany({
        where: { referredId: userId },
        data: {
          referredId: null,
          status: 'EXPIRED',
        },
      });

      // Anonymize disputes (preserve for legal records but remove sensitive details)
      // Keep dispute structure but anonymize description and resolution
      await tx.dispute.updateMany({
        where: {
          OR: [
            { initiatorId: userId },
            { respondentId: userId },
          ],
        },
        data: {
          description: '[Content anonymized per GDPR request]',
          resolution: '[Resolution anonymized per GDPR request]',
        },
      });
    });

    // Log audit event
    await auditService.log({
      action: 'USER_ANONYMIZED',
      userId: requestedBy,
      resourceType: 'User',
      resourceId: userId,
      metadata: { originalEmail: user.email, reason: 'GDPR request' },
    });

    logger.info(`User ${userId} data anonymized per GDPR request`);
  }

  /**
   * Export all user data (for GDPR "right to data portability")
   */
  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tools: true,
        spaces: true,
        services: true,
        requestsCreated: true,
        transactions: {
          include: {
            reviews: true,
          },
        },
        reviewsGiven: true,
        reviewsReceived: true,
        messagesFrom: true,
        messagesTo: true,
        savedSearches: true,
        referralsGiven: true,
        referralsReceived: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Remove sensitive internal data
    const { passwordHash: _passwordHash, ...userData } = user;

    // Log audit event
    await auditService.log({
      action: 'USER_DATA_EXPORTED',
      userId,
      resourceType: 'User',
      resourceId: userId,
      metadata: { reason: 'GDPR data export request' },
    });

    logger.info(`User ${userId} data exported`);

    return {
      exportDate: new Date().toISOString(),
      user: userData,
    };
  }

  /**
   * Check if user account is eligible for permanent deletion
   * (e.g., no pending transactions, all disputes resolved)
   */
  async canPermanentlyDelete(userId: string): Promise<{ eligible: boolean; reasons: string[] }> {
    const reasons: string[] = [];

    // Check for pending transactions
    const pendingTransactions = await prisma.transaction.count({
      where: {
        OR: [
          { userId },
          { providerId: userId },
        ],
        status: {
          in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'],
        },
      },
    });

    if (pendingTransactions > 0) {
      reasons.push(`${pendingTransactions} pending transaction(s) must be completed or cancelled`);
    }

    // Check for open disputes
    const openDisputes = await prisma.dispute.count({
      where: {
        OR: [
          { initiatorId: userId },
          { respondentId: userId },
        ],
        status: {
          in: ['OPEN', 'UNDER_REVIEW'],
        },
      },
    });

    if (openDisputes > 0) {
      reasons.push(`${openDisputes} open dispute(s) must be resolved`);
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }
}

export const gdprService = new GdprService();
