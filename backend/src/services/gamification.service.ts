import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { BadgeType } from '@prisma/client';

interface BadgeDefinition {
  type: BadgeType;
  name: string;
  description: string;
  icon: string;
  requirement: string;
}

export const BADGE_DEFINITIONS: Record<BadgeType, BadgeDefinition> = {
  // Onboarding
  EARLY_ADOPTER: {
    type: 'EARLY_ADOPTER',
    name: 'Early Adopter',
    description: 'Joined during our launch phase',
    icon: '🚀',
    requirement: 'Join during beta',
  },
  FOUNDING_MEMBER: {
    type: 'FOUNDING_MEMBER',
    name: 'Founding Member',
    description: 'One of our first 100 members',
    icon: '⭐',
    requirement: 'Be among first 100 users',
  },
  PROFILE_COMPLETE: {
    type: 'PROFILE_COMPLETE',
    name: 'Profile Pro',
    description: 'Completed your profile with all details',
    icon: '✅',
    requirement: 'Fill out all profile fields',
  },
  FIRST_LISTING: {
    type: 'FIRST_LISTING',
    name: 'First Listing',
    description: 'Posted your first item or service',
    icon: '📦',
    requirement: 'Create first listing',
  },
  FIRST_REQUEST: {
    type: 'FIRST_REQUEST',
    name: 'First Request',
    description: 'Posted your first job request',
    icon: '📝',
    requirement: 'Create first request',
  },
  
  // Activity milestones
  FIRST_RENTAL: {
    type: 'FIRST_RENTAL',
    name: 'First Rental',
    description: 'Completed your first rental',
    icon: '🎉',
    requirement: 'Complete 1 rental',
  },
  FIVE_RENTALS: {
    type: 'FIVE_RENTALS',
    name: 'Getting Started',
    description: 'Completed 5 rentals',
    icon: '🔧',
    requirement: 'Complete 5 rentals',
  },
  TEN_RENTALS: {
    type: 'TEN_RENTALS',
    name: 'Regular User',
    description: 'Completed 10 rentals',
    icon: '🛠️',
    requirement: 'Complete 10 rentals',
  },
  TWENTY_FIVE_RENTALS: {
    type: 'TWENTY_FIVE_RENTALS',
    name: 'Power User',
    description: 'Completed 25 rentals',
    icon: '💪',
    requirement: 'Complete 25 rentals',
  },
  FIFTY_RENTALS: {
    type: 'FIFTY_RENTALS',
    name: 'Super Renter',
    description: 'Completed 50 rentals',
    icon: '🏆',
    requirement: 'Complete 50 rentals',
  },
  CENTURY_CLUB: {
    type: 'CENTURY_CLUB',
    name: 'Century Club',
    description: 'Completed 100 rentals!',
    icon: '💯',
    requirement: 'Complete 100 rentals',
  },
  
  // Provider milestones
  TOOL_PROVIDER: {
    type: 'TOOL_PROVIDER',
    name: 'Tool Provider',
    description: 'Listed tools for rent',
    icon: '🔧',
    requirement: 'List at least 1 tool',
  },
  SPACE_PROVIDER: {
    type: 'SPACE_PROVIDER',
    name: 'Space Provider',
    description: 'Listed workspace for rent',
    icon: '🏠',
    requirement: 'List at least 1 space',
  },
  SERVICE_PROVIDER: {
    type: 'SERVICE_PROVIDER',
    name: 'Service Provider',
    description: 'Offering your expertise',
    icon: '👨‍🔧',
    requirement: 'List at least 1 service',
  },
  SUPER_PROVIDER: {
    type: 'SUPER_PROVIDER',
    name: 'Super Provider',
    description: 'Completed 50+ jobs as provider',
    icon: '🌟',
    requirement: 'Complete 50 jobs as provider',
  },
  
  // Quality
  FIVE_STAR_RATING: {
    type: 'FIVE_STAR_RATING',
    name: 'Five Star',
    description: 'Received a 5-star review',
    icon: '⭐',
    requirement: 'Get a 5-star review',
  },
  TOP_RATED: {
    type: 'TOP_RATED',
    name: 'Top Rated',
    description: 'Maintained 4.8+ rating with 10+ reviews',
    icon: '🏅',
    requirement: '4.8+ average with 10+ reviews',
  },
  QUICK_RESPONDER: {
    type: 'QUICK_RESPONDER',
    name: 'Quick Responder',
    description: 'Average response time under 1 hour',
    icon: '⚡',
    requirement: '<1hr average response time',
  },
  RELIABLE: {
    type: 'RELIABLE',
    name: 'Reliable',
    description: 'No cancellations in 20+ transactions',
    icon: '🤝',
    requirement: 'Zero cancellations (20+ transactions)',
  },
  
  // Community
  HELPFUL_REVIEWER: {
    type: 'HELPFUL_REVIEWER',
    name: 'Helpful Reviewer',
    description: 'Left 10+ helpful reviews',
    icon: '📝',
    requirement: 'Write 10 reviews',
  },
  COMMUNITY_BUILDER: {
    type: 'COMMUNITY_BUILDER',
    name: 'Community Builder',
    description: 'Referred 5+ new members',
    icon: '👥',
    requirement: '5 successful referrals',
  },
  LOCAL_HERO: {
    type: 'LOCAL_HERO',
    name: 'Local Hero',
    description: 'Top provider in your area',
    icon: '🦸',
    requirement: 'Be #1 provider in your postcode area',
  },
  
  // Special
  VERIFIED_PRO: {
    type: 'VERIFIED_PRO',
    name: 'Verified Pro',
    description: 'Professionally verified provider',
    icon: '✓',
    requirement: 'Complete professional verification',
  },
  BETA_TESTER: {
    type: 'BETA_TESTER',
    name: 'Beta Tester',
    description: 'Helped test new features',
    icon: '🧪',
    requirement: 'Participate in beta testing',
  },
};

class GamificationService {
  /**
   * Award a badge to a user
   */
  async awardBadge(userId: string, badge: BadgeType): Promise<boolean> {
    try {
      // Check if already has badge
      const existing = await prisma.userBadge.findUnique({
        where: { userId_badge: { userId, badge } },
      });
      
      if (existing) return false;

      await prisma.userBadge.create({
        data: { userId, badge },
      });

      // Log activity
      await prisma.activityEvent.create({
        data: {
          type: 'BADGE_EARNED',
          actorId: userId,
          targetType: 'badge',
          targetId: badge,
          metadata: { badgeName: BADGE_DEFINITIONS[badge].name },
          isPublic: true,
        },
      });

      logger.info(`Badge awarded: ${badge} to user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error awarding badge:', error);
      return false;
    }
  }

  /**
   * Check and award milestone badges based on user activity
   */
  async checkMilestones(userId: string): Promise<BadgeType[]> {
    const awarded: BadgeType[] = [];

    // Get user stats
    const stats = await prisma.userStats.findUnique({ where: { userId } });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tools: { select: { id: true } },
        spaces: { select: { id: true } },
        services: { select: { id: true } },
        reviewsGiven: { select: { id: true } },
        badges: { select: { badge: true } },
      },
    });

    if (!user) return awarded;

    const existingBadges = new Set(user.badges.map(b => b.badge));
    const totalRentals = (stats?.totalRentalsAsRenter || 0) + (stats?.totalRentalsAsProvider || 0);

    // Check rental milestones
    const rentalMilestones: [number, BadgeType][] = [
      [1, 'FIRST_RENTAL'],
      [5, 'FIVE_RENTALS'],
      [10, 'TEN_RENTALS'],
      [25, 'TWENTY_FIVE_RENTALS'],
      [50, 'FIFTY_RENTALS'],
      [100, 'CENTURY_CLUB'],
    ];

    for (const [count, badge] of rentalMilestones) {
      if (totalRentals >= count && !existingBadges.has(badge)) {
        if (await this.awardBadge(userId, badge)) {
          awarded.push(badge);
        }
      }
    }

    // Check provider badges
    if (user.tools.length > 0 && !existingBadges.has('TOOL_PROVIDER')) {
      if (await this.awardBadge(userId, 'TOOL_PROVIDER')) awarded.push('TOOL_PROVIDER');
    }
    if (user.spaces.length > 0 && !existingBadges.has('SPACE_PROVIDER')) {
      if (await this.awardBadge(userId, 'SPACE_PROVIDER')) awarded.push('SPACE_PROVIDER');
    }
    if (user.services.length > 0 && !existingBadges.has('SERVICE_PROVIDER')) {
      if (await this.awardBadge(userId, 'SERVICE_PROVIDER')) awarded.push('SERVICE_PROVIDER');
    }

    // Check super provider
    if ((stats?.totalRentalsAsProvider || 0) >= 50 && !existingBadges.has('SUPER_PROVIDER')) {
      if (await this.awardBadge(userId, 'SUPER_PROVIDER')) awarded.push('SUPER_PROVIDER');
    }

    // Check reviewer badge
    if (user.reviewsGiven.length >= 10 && !existingBadges.has('HELPFUL_REVIEWER')) {
      if (await this.awardBadge(userId, 'HELPFUL_REVIEWER')) awarded.push('HELPFUL_REVIEWER');
    }

    // Check top rated
    if (user.rating && user.rating >= 4.8 && user.totalReviews >= 10 && !existingBadges.has('TOP_RATED')) {
      if (await this.awardBadge(userId, 'TOP_RATED')) awarded.push('TOP_RATED');
    }

    // Check quick responder
    if (stats?.averageResponseMinutes && stats.averageResponseMinutes < 60 && !existingBadges.has('QUICK_RESPONDER')) {
      if (await this.awardBadge(userId, 'QUICK_RESPONDER')) awarded.push('QUICK_RESPONDER');
    }

    // Check reliable
    if (stats && stats.cancellationRate === 0 && (stats.totalRentalsAsRenter + stats.totalRentalsAsProvider) >= 20 && !existingBadges.has('RELIABLE')) {
      if (await this.awardBadge(userId, 'RELIABLE')) awarded.push('RELIABLE');
    }

    // Check community builder (referrals)
    if ((stats?.successfulReferrals || 0) >= 5 && !existingBadges.has('COMMUNITY_BUILDER')) {
      if (await this.awardBadge(userId, 'COMMUNITY_BUILDER')) awarded.push('COMMUNITY_BUILDER');
    }

    // Check profile complete
    if (user.name && user.postcode && user.bio && user.avatar && !existingBadges.has('PROFILE_COMPLETE')) {
      if (await this.awardBadge(userId, 'PROFILE_COMPLETE')) awarded.push('PROFILE_COMPLETE');
    }

    return awarded;
  }

  /**
   * FIX: Revoke badges that are no longer deserved
   * This prevents users from gaming the system by achieving a badge and then
   * degrading their behavior knowing the badge is permanent
   */
  async checkAndRevokeBadges(userId: string): Promise<BadgeType[]> {
    const revoked: BadgeType[] = [];

    const stats = await prisma.userStats.findUnique({ where: { userId } });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        rating: true,
        totalReviews: true,
        badges: { select: { badge: true } },
      },
    });

    if (!user || !stats) return revoked;

    const existingBadges = new Set(user.badges.map(b => b.badge));

    // FIX: Revoke RELIABLE badge if cancellation rate is no longer 0%
    // Uses rolling window - badge stays if they maintain reliability
    if (existingBadges.has('RELIABLE') && stats.cancellationRate > 0) {
      const reason = `Your cancellation rate increased to ${(stats.cancellationRate * 100).toFixed(1)}%`;
      if (await this.revokeBadge(userId, 'RELIABLE', reason)) {
        revoked.push('RELIABLE');
        logger.info(`RELIABLE badge revoked from user ${userId} due to cancellations`);
      }
    }

    // FIX: Revoke TOP_RATED badge if rating drops below 4.8 or reviews drop below 10
    if (existingBadges.has('TOP_RATED')) {
      if (!user.rating || user.rating < 4.8 || user.totalReviews < 10) {
        const reason = user.rating && user.rating < 4.8
          ? `Your rating dropped to ${user.rating.toFixed(1)} stars (minimum: 4.8)`
          : `You need at least 10 reviews (currently: ${user.totalReviews})`;
        if (await this.revokeBadge(userId, 'TOP_RATED', reason)) {
          revoked.push('TOP_RATED');
          logger.info(`TOP_RATED badge revoked from user ${userId} - rating: ${user.rating}, reviews: ${user.totalReviews}`);
        }
      }
    }

    // FIX: Revoke QUICK_RESPONDER badge if response time degrades
    if (existingBadges.has('QUICK_RESPONDER')) {
      // Allow some buffer - only revoke if response time exceeds 90 minutes (vs 60 to earn)
      if (stats.averageResponseMinutes && stats.averageResponseMinutes > 90) {
        const reason = `Your average response time increased to ${Math.round(stats.averageResponseMinutes)} minutes`;
        if (await this.revokeBadge(userId, 'QUICK_RESPONDER', reason)) {
          revoked.push('QUICK_RESPONDER');
          logger.info(`QUICK_RESPONDER badge revoked from user ${userId} - avg response: ${stats.averageResponseMinutes} mins`);
        }
      }
    }

    return revoked;
  }

  /**
   * FIX: Revoke a specific badge from a user
   * FIX #10: Now sends notification to user about badge revocation
   */
  async revokeBadge(userId: string, badge: BadgeType, reason?: string): Promise<boolean> {
    try {
      const existing = await prisma.userBadge.findUnique({
        where: { userId_badge: { userId, badge } },
      });

      if (!existing) return false;

      await prisma.userBadge.delete({
        where: { userId_badge: { userId, badge } },
      });

      const badgeDef = BADGE_DEFINITIONS[badge];
      const revocationReason = reason || 'No longer meets criteria';

      // Log activity
      await prisma.activityEvent.create({
        data: {
          type: 'BADGE_EARNED', // Reusing type, metadata indicates revocation
          actorId: userId,
          targetType: 'badge',
          targetId: badge,
          metadata: {
            badgeName: badgeDef.name,
            action: 'revoked',
            reason: revocationReason,
          },
          isPublic: false, // Don't show revocations publicly
        },
      });

      // FIX #10: Send notification to user about badge revocation
      // This ensures users understand why their badge was removed
      try {
        const { unifiedNotificationService } = await import('./unifiedNotification.service.js');
        await unifiedNotificationService.send({
          userId,
          type: 'system_important',
          title: `${badgeDef.icon} Badge Update`,
          body: `Your "${badgeDef.name}" badge has been removed. Reason: ${revocationReason}. ` +
            `To earn it back: ${badgeDef.requirement}`,
        });
      } catch (notifyError) {
        logger.warn(`Failed to send badge revocation notification to user ${userId}:`, notifyError);
        // Don't fail the revocation just because notification failed
      }

      logger.info(`Badge revoked: ${badge} from user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error revoking badge:', error);
      return false;
    }
  }

  /**
   * Get user's badges with definitions
   */
  async getUserBadges(userId: string) {
    const badges = await prisma.userBadge.findMany({
      where: { userId },
      orderBy: { earnedAt: 'desc' },
    });

    return badges.map(b => ({
      ...b,
      definition: BADGE_DEFINITIONS[b.badge],
    }));
  }

  /**
   * Get or create user stats
   */
  async getOrCreateStats(userId: string) {
    let stats = await prisma.userStats.findUnique({ where: { userId } });
    
    if (!stats) {
      stats = await prisma.userStats.create({
        data: { userId },
      });
    }
    
    return stats;
  }

  /**
   * Update user stats after a transaction
   */
  async updateStatsAfterTransaction(
    userId: string,
    isProvider: boolean,
    amount: number,
    _wasCompleted: boolean
  ) {
    const stats = await this.getOrCreateStats(userId);
    
    await prisma.userStats.update({
      where: { userId },
      data: {
        totalRentalsAsRenter: isProvider ? stats.totalRentalsAsRenter : stats.totalRentalsAsRenter + 1,
        totalRentalsAsProvider: isProvider ? stats.totalRentalsAsProvider + 1 : stats.totalRentalsAsProvider,
        totalEarned: isProvider ? stats.totalEarned + amount : stats.totalEarned,
        totalSpent: isProvider ? stats.totalSpent : stats.totalSpent + amount,
        lastActiveAt: new Date(),
      },
    });

    // Check for new milestones
    await this.checkMilestones(userId);
  }

  /**
   * Get leaderboard for an area
   */
  async getLocalLeaderboard(postcode: string, limit = 10) {
    // Get first part of postcode (outward code)
    const postcodeArea = postcode.split(' ')[0].slice(0, -1);
    
    const users = await prisma.user.findMany({
      where: {
        postcode: { startsWith: postcodeArea },
        accountStatus: 'ACTIVE',
      },
      orderBy: [
        { rating: 'desc' },
        { totalTransactions: 'desc' },
      ],
      take: limit,
      select: {
        id: true,
        name: true,
        avatar: true,
        rating: true,
        totalTransactions: true,
        badges: {
          select: { badge: true },
          take: 3,
          orderBy: { earnedAt: 'desc' },
        },
      },
    });

    return users.map((u, index) => ({
      rank: index + 1,
      ...u,
      badges: u.badges.map(b => BADGE_DEFINITIONS[b.badge]),
    }));
  }

  /**
   * Get next achievable badges for a user
   */
  async getNextBadges(userId: string, limit = 3) {
    const stats = await this.getOrCreateStats(userId);
    const existingBadges = await prisma.userBadge.findMany({
      where: { userId },
      select: { badge: true },
    });
    const hasBadge = new Set(existingBadges.map(b => b.badge));

    const suggestions: Array<{
      badge: BadgeDefinition;
      progress: number;
      remaining: string;
    }> = [];

    const totalRentals = stats.totalRentalsAsRenter + stats.totalRentalsAsProvider;

    // Check rental progress
    const rentalTargets: [number, BadgeType][] = [
      [1, 'FIRST_RENTAL'],
      [5, 'FIVE_RENTALS'],
      [10, 'TEN_RENTALS'],
      [25, 'TWENTY_FIVE_RENTALS'],
      [50, 'FIFTY_RENTALS'],
    ];

    for (const [target, badge] of rentalTargets) {
      if (!hasBadge.has(badge) && totalRentals < target) {
        suggestions.push({
          badge: BADGE_DEFINITIONS[badge],
          progress: Math.round((totalRentals / target) * 100),
          remaining: `${target - totalRentals} more rental${target - totalRentals > 1 ? 's' : ''}`,
        });
        break; // Only show next rental milestone
      }
    }

    // Check referral progress
    if (!hasBadge.has('COMMUNITY_BUILDER') && stats.successfulReferrals < 5) {
      suggestions.push({
        badge: BADGE_DEFINITIONS['COMMUNITY_BUILDER'],
        progress: Math.round((stats.successfulReferrals / 5) * 100),
        remaining: `${5 - stats.successfulReferrals} more referral${5 - stats.successfulReferrals > 1 ? 's' : ''}`,
      });
    }

    return suggestions.slice(0, limit);
  }
}

export const gamificationService = new GamificationService();
