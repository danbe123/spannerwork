import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { NotFoundError, InternalServerError, BadRequestError } from '../utils/errors.js';

// FIX: Rate limiting constants to prevent referral abuse
const MAX_REFERRALS_PER_DAY = 10;
const MAX_REFERRALS_PER_HOUR = 5;
const MAX_PENDING_REFERRALS = 50;

// FIX: Referral expiration - pending referrals expire after 30 days
const REFERRAL_EXPIRY_DAYS = 30;

// FIX: Reward caps to prevent referral abuse
const REFERRAL_REWARD_AMOUNT = 10; // £10 per referral
const MAX_LIFETIME_REFERRAL_REWARDS = 500; // £500 max lifetime earnings from referrals
const MAX_COMPLETED_REFERRALS = 50; // Maximum completed referrals per user

/**
 * Referral Service
 * Handles referral system operations
 * FIX: Added rate limiting to prevent spam and abuse
 */
class ReferralService {
  /**
   * Check rate limits before creating a referral
   * FIX: Prevents spam by limiting referral creation rate
   */
  private async checkRateLimits(referrerId: string): Promise<void> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Check hourly limit
    const referralsLastHour = await prisma.referral.count({
      where: {
        referrerId,
        createdDate: { gte: oneHourAgo },
      },
    });

    if (referralsLastHour >= MAX_REFERRALS_PER_HOUR) {
      throw new BadRequestError(
        `You can only send ${MAX_REFERRALS_PER_HOUR} referrals per hour. Please try again later.`
      );
    }

    // Check daily limit
    const referralsLastDay = await prisma.referral.count({
      where: {
        referrerId,
        createdDate: { gte: oneDayAgo },
      },
    });

    if (referralsLastDay >= MAX_REFERRALS_PER_DAY) {
      throw new BadRequestError(
        `You can only send ${MAX_REFERRALS_PER_DAY} referrals per day. Please try again tomorrow.`
      );
    }

    // Check total pending referrals (prevent accumulating too many)
    const pendingReferrals = await prisma.referral.count({
      where: {
        referrerId,
        status: 'PENDING',
      },
    });

    if (pendingReferrals >= MAX_PENDING_REFERRALS) {
      throw new BadRequestError(
        `You have too many pending referrals (${pendingReferrals}). ` +
        'Please wait for some to be completed or expire before sending more.'
      );
    }
  }

  /**
   * Create a new referral invitation
   * FIX: Added rate limiting and duplicate detection
   */
  async createReferral(data: {
    referrerId: string;
    referredEmail: string;
    referralCode: string;
  }) {
    try {
      // FIX: Check rate limits first
      await this.checkRateLimits(data.referrerId);

      // FIX: Check if this email was already referred by this user
      const existingReferral = await prisma.referral.findFirst({
        where: {
          referrerId: data.referrerId,
          email: data.referredEmail,
        },
      });

      if (existingReferral) {
        throw new BadRequestError('You have already sent a referral to this email address.');
      }

      // FIX: Check if user is trying to refer their own email
      const referrer = await prisma.user.findUnique({
        where: { id: data.referrerId },
        select: { email: true },
      });

      if (referrer?.email?.toLowerCase() === data.referredEmail.toLowerCase()) {
        throw new BadRequestError('You cannot refer yourself.');
      }

      // FIX: Check if referred email is already a registered user
      const existingUser = await prisma.user.findUnique({
        where: { email: data.referredEmail.toLowerCase() },
      });

      if (existingUser) {
        throw new BadRequestError('This email is already registered on SpannerWork.');
      }

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
      if (error instanceof BadRequestError) {
        throw error;
      }
      logger.error('Create referral error:', error);
      throw new InternalServerError('Failed to create referral');
    }
  }

  /**
   * Create a new referral invitation sent via SMS
   * FIX: Added rate limiting and duplicate detection
   */
  async createSmsReferral(data: {
    referrerId: string;
    phone: string;
    referralCode: string;
  }) {
    try {
      // FIX: Check rate limits first
      await this.checkRateLimits(data.referrerId);

      // FIX: Check if this phone was already referred by this user
      const existingReferral = await prisma.referral.findFirst({
        where: {
          referrerId: data.referrerId,
          phone: data.phone,
        },
      });

      if (existingReferral) {
        throw new BadRequestError('You have already sent a referral to this phone number.');
      }

      // FIX: Check if user is trying to refer their own phone
      const referrer = await prisma.user.findUnique({
        where: { id: data.referrerId },
        select: { phone: true },
      });

      if (referrer?.phone && referrer.phone === data.phone) {
        throw new BadRequestError('You cannot refer yourself.');
      }

      // FIX: Check if phone number belongs to existing user
      const existingUser = await prisma.user.findFirst({
        where: { phone: data.phone },
      });

      if (existingUser) {
        throw new BadRequestError('This phone number is already registered on SpannerWork.');
      }

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
      if (error instanceof BadRequestError) {
        throw error;
      }
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
   * FIX: Only returns referrals that haven't expired
   */
  async getReferralByCode(code: string) {
    try {
      const expiryDate = new Date(Date.now() - REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      const referral = await prisma.referral.findFirst({
        where: {
          code: code,
          status: 'PENDING',
          // FIX: Only return referrals created within the expiry window
          createdDate: { gte: expiryDate },
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

      // FIX: If referral exists but is expired, return null with logging
      if (!referral) {
        // Check if there's an expired referral with this code
        const expiredReferral = await prisma.referral.findFirst({
          where: {
            code: code,
            status: 'PENDING',
            createdDate: { lt: expiryDate },
          },
        });

        if (expiredReferral) {
          logger.info('Expired referral code used', { code, createdDate: expiredReferral.createdDate });
        }
      }

      return referral;
    } catch (error) {
      logger.error('Get referral by code error:', error);
      throw new InternalServerError('Failed to fetch referral');
    }
  }

  /**
   * Clean up expired referrals
   * FIX: Should be called periodically by a scheduled job
   * Marks old pending referrals as EXPIRED to keep the database clean
   */
  async cleanupExpiredReferrals(): Promise<number> {
    try {
      const expiryDate = new Date(Date.now() - REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      const result = await prisma.referral.updateMany({
        where: {
          status: 'PENDING',
          createdDate: { lt: expiryDate },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      if (result.count > 0) {
        logger.info(`Marked ${result.count} referrals as expired`);
      }

      return result.count;
    } catch (error) {
      logger.error('Cleanup expired referrals error:', error);
      return 0;
    }
  }

  /**
   * Complete a referral (when referred user signs up)
   * FIX #6: Prevents self-referral to avoid reward abuse
   * FIX: Adds caps on total referral rewards per user
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

      // FIX #6: Prevent self-referral - user cannot refer themselves
      if (referral.referrerId === referredUserId) {
        logger.warn('Self-referral attempt detected', {
          referralCode,
          userId: referredUserId,
        });
        throw new BadRequestError('You cannot use your own referral code');
      }

      // FIX: Check if referred user has already been referred by someone else
      const existingCompletedReferral = await prisma.referral.findFirst({
        where: {
          referredId: referredUserId,
          status: 'COMPLETED',
        },
      });

      if (existingCompletedReferral) {
        logger.warn('User already has a completed referral', {
          referralCode,
          referredUserId,
          existingReferralId: existingCompletedReferral.id,
        });
        throw new BadRequestError('This account has already been referred by another user');
      }

      // FIX: Check if referrer has hit the maximum completed referrals cap
      const referrerCompletedCount = await prisma.referral.count({
        where: {
          referrerId: referral.referrerId,
          status: 'COMPLETED',
        },
      });

      if (referrerCompletedCount >= MAX_COMPLETED_REFERRALS) {
        logger.info('Referrer has reached maximum completed referrals', {
          referralCode,
          referrerId: referral.referrerId,
          completedCount: referrerCompletedCount,
        });
        // Still complete the referral for tracking, but flag that no reward is due
        // The reward logic should check this cap before awarding
      }

      // FIX #6: Use atomic transaction to prevent race conditions
      const updated = await prisma.$transaction(async (tx) => {
        // Re-check status inside transaction to prevent race condition
        const freshReferral = await tx.referral.findUnique({
          where: { id: referral.id },
        });

        if (!freshReferral || freshReferral.status !== 'PENDING') {
          throw new NotFoundError('Referral not found or already completed');
        }

        return tx.referral.update({
          where: { id: referral.id },
          data: {
            status: 'COMPLETED',
            referredId: referredUserId,
            completedDate: new Date(),
          },
        });
      });

      // Award referral bonus to referrer (optional)
      // await this.awardReferralBonus(referral.referrerId);

      logger.info(`Referral completed: ${referral.id}`);
      return updated;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BadRequestError) {
        throw error;
      }
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

      // FIX: Apply reward caps to prevent abuse
      const eligibleForReward = Math.min(completed, MAX_COMPLETED_REFERRALS);
      const totalRewards = eligibleForReward * REFERRAL_REWARD_AMOUNT;
      const cappedRewards = Math.min(totalRewards, MAX_LIFETIME_REFERRAL_REWARDS);

      return {
        total,
        completed,
        pending,
        // Calculate potential rewards with caps applied
        rewards: cappedRewards,
        rewardsPerReferral: REFERRAL_REWARD_AMOUNT,
        maxLifetimeRewards: MAX_LIFETIME_REFERRAL_REWARDS,
        maxCompletedReferrals: MAX_COMPLETED_REFERRALS,
        atRewardCap: cappedRewards >= MAX_LIFETIME_REFERRAL_REWARDS,
      };
    } catch (error) {
      logger.error('Get referral stats error:', error);
      throw new InternalServerError('Failed to fetch referral stats');
    }
  }
}

export const referralService = new ReferralService();
