import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { NotFoundError, InternalServerError } from '../utils/errors.js';

/**
 * Referral Service
 * Handles referral system operations
 */
class ReferralService {
  /**
   * Create a new referral invitation
   */
  async createReferral(data: {
    referrerId: string;
    referredEmail: string;
    referralCode: string;
  }) {
    try {
      const referral = await prisma.referral.create({
        data: {
          referrerId: data.referrerId,
          email: data.referredEmail,
          code: data.referralCode,
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

      logger.info(`Referral created: ${referral.id}`);
      return referral;
    } catch (error) {
      logger.error('Create referral error:', error);
      throw new InternalServerError('Failed to create referral');
    }
  }

  /**
   * Create a new referral invitation sent via SMS
   */
  async createSmsReferral(data: {
    referrerId: string;
    phone: string;
    referralCode: string;
  }) {
    try {
      const referral = await prisma.referral.create({
        data: {
          referrerId: data.referrerId,
          code: data.referralCode,
          phone: data.phone,
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

      logger.info(`SMS referral created: ${referral.id}`);
      return referral;
    } catch (error) {
      logger.error('Create SMS referral error:', error);
      throw new InternalServerError('Failed to create SMS referral');
    }
  }

  /**
   * Get referrals by referrer ID
   */
  async getReferralsByReferrer(referrerId: string) {
    try {
      const referrals = await prisma.referral.findMany({
        where: {
          referrerId,
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

      return referrals;
    } catch (error) {
      logger.error('Get referrals error:', error);
      throw new InternalServerError('Failed to fetch referrals');
    }
  }

  /**
   * Get referral by code
   */
  async getReferralByCode(code: string) {
    try {
      const referral = await prisma.referral.findFirst({
        where: {
          code: code,
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

      return referral;
    } catch (error) {
      logger.error('Get referral by code error:', error);
      throw new InternalServerError('Failed to fetch referral');
    }
  }

  /**
   * Complete a referral (when referred user signs up)
   */
  async completeReferral(referralCode: string, referredUserId: string) {
    try {
      const referral = await prisma.referral.findFirst({
        where: {
          code: referralCode,
          status: 'PENDING',
        },
      });

      if (!referral) {
        throw new NotFoundError('Referral not found or already completed');
      }

      // Update referral status
      const updated = await prisma.referral.update({
        where: {
          id: referral.id,
        },
        data: {
          status: 'COMPLETED',
          referredId: referredUserId,
          completedDate: new Date(),
        },
      });

      // Award referral bonus to referrer (optional)
      // await this.awardReferralBonus(referral.referrerId);

      logger.info(`Referral completed: ${referral.id}`);
      return updated;
    } catch (error) {
      logger.error('Complete referral error:', error);
      throw new InternalServerError('Failed to complete referral');
    }
  }

  /**
   * Get referral stats for a user
   */
  async getReferralStats(userId: string) {
    try {
      const [total, completed, pending] = await Promise.all([
        prisma.referral.count({
          where: { referrerId: userId },
        }),
        prisma.referral.count({
          where: { referrerId: userId, status: 'COMPLETED' },
        }),
        prisma.referral.count({
          where: { referrerId: userId, status: 'PENDING' },
        }),
      ]);

      return {
        total,
        completed,
        pending,
        // Calculate potential rewards based on completed referrals
        rewards: completed * 10, // £10 per completed referral
      };
    } catch (error) {
      logger.error('Get referral stats error:', error);
      throw new InternalServerError('Failed to fetch referral stats');
    }
  }
}

export const referralService = new ReferralService();
