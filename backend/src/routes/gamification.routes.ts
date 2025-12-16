import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Badge definitions (until Prisma types are regenerated)
const BADGE_DEFINITIONS: Record<string, { name: string; description: string; icon: string; requirement: string }> = {
  EARLY_ADOPTER: { name: 'Early Adopter', description: 'Joined during our launch phase', icon: '🚀', requirement: 'Join during beta' },
  FOUNDING_MEMBER: { name: 'Founding Member', description: 'One of our first 100 members', icon: '⭐', requirement: 'Be among first 100 users' },
  PROFILE_COMPLETE: { name: 'Profile Pro', description: 'Completed your profile with all details', icon: '✅', requirement: 'Fill out all profile fields' },
  FIRST_LISTING: { name: 'First Listing', description: 'Posted your first item or service', icon: '📦', requirement: 'Create first listing' },
  FIRST_REQUEST: { name: 'First Request', description: 'Posted your first job request', icon: '📝', requirement: 'Create first request' },
  FIRST_RENTAL: { name: 'First Rental', description: 'Completed your first rental', icon: '🎉', requirement: 'Complete 1 rental' },
  FIVE_RENTALS: { name: 'Getting Started', description: 'Completed 5 rentals', icon: '🔧', requirement: 'Complete 5 rentals' },
  TEN_RENTALS: { name: 'Regular User', description: 'Completed 10 rentals', icon: '🛠️', requirement: 'Complete 10 rentals' },
  TWENTY_FIVE_RENTALS: { name: 'Power User', description: 'Completed 25 rentals', icon: '💪', requirement: 'Complete 25 rentals' },
  FIFTY_RENTALS: { name: 'Super Renter', description: 'Completed 50 rentals', icon: '🏆', requirement: 'Complete 50 rentals' },
  CENTURY_CLUB: { name: 'Century Club', description: 'Completed 100 rentals!', icon: '💯', requirement: 'Complete 100 rentals' },
  TOOL_PROVIDER: { name: 'Tool Provider', description: 'Listed tools for rent', icon: '🔧', requirement: 'List at least 1 tool' },
  SPACE_PROVIDER: { name: 'Space Provider', description: 'Listed workspace for rent', icon: '🏠', requirement: 'List at least 1 space' },
  SERVICE_PROVIDER: { name: 'Service Provider', description: 'Offering your expertise', icon: '👨‍🔧', requirement: 'List at least 1 service' },
  SUPER_PROVIDER: { name: 'Super Provider', description: 'Completed 50+ jobs as provider', icon: '🌟', requirement: 'Complete 50 jobs as provider' },
  FIVE_STAR_RATING: { name: 'Five Star', description: 'Received a 5-star review', icon: '⭐', requirement: 'Get a 5-star review' },
  TOP_RATED: { name: 'Top Rated', description: 'Maintained 4.8+ rating with 10+ reviews', icon: '🏅', requirement: '4.8+ average with 10+ reviews' },
  QUICK_RESPONDER: { name: 'Quick Responder', description: 'Average response time under 1 hour', icon: '⚡', requirement: '<1hr average response time' },
  RELIABLE: { name: 'Reliable', description: 'No cancellations in 20+ transactions', icon: '🤝', requirement: 'Zero cancellations (20+ transactions)' },
  HELPFUL_REVIEWER: { name: 'Helpful Reviewer', description: 'Left 10+ helpful reviews', icon: '📝', requirement: 'Write 10 reviews' },
  COMMUNITY_BUILDER: { name: 'Community Builder', description: 'Referred 5+ new members', icon: '👥', requirement: '5 successful referrals' },
  LOCAL_HERO: { name: 'Local Hero', description: 'Top provider in your area', icon: '🦸', requirement: 'Be #1 provider in your postcode area' },
  VERIFIED_PRO: { name: 'Verified Pro', description: 'Professionally verified provider', icon: '✓', requirement: 'Complete professional verification' },
  BETA_TESTER: { name: 'Beta Tester', description: 'Helped test new features', icon: '🧪', requirement: 'Participate in beta testing' },
};

/**
 * @swagger
 * /gamification/badges:
 *   get:
 *     summary: Get all available badges
 *     tags: [Gamification]
 */
router.get('/badges', (_req: Request, res: Response) => {
  const badges = Object.entries(BADGE_DEFINITIONS).map(([type, def]) => ({
    type,
    ...def,
  }));
  res.json({ badges });
});

/**
 * @swagger
 * /gamification/my-badges:
 *   get:
 *     summary: Get current user's earned badges
 *     tags: [Gamification]
 */
router.get('/my-badges', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    
    try {
      const userBadges = await (prisma as unknown as { userBadge: { findMany: (args: unknown) => Promise<Array<{ id: string; badge: string; earnedAt: Date }>> } }).userBadge.findMany({
        where: { userId },
        orderBy: { earnedAt: 'desc' },
      });

      const badges = userBadges.map((ub: { id: string; badge: string; earnedAt: Date }) => ({
        id: ub.id,
        ...BADGE_DEFINITIONS[ub.badge],
        type: ub.badge,
        earnedAt: ub.earnedAt,
      }));

      res.json({ badges });
    } catch {
      // Table doesn't exist yet
      res.json({ badges: [] });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /gamification/my-stats:
 *   get:
 *     summary: Get current user's gamification stats
 *     tags: [Gamification]
 */
router.get('/my-stats', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    
    // Get basic stats from existing data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        rating: true,
        totalTransactions: true,
        totalReviews: true,
        createdDate: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Count listings
    const [toolCount, spaceCount, serviceCount, requestCount, reviewsGiven] = await Promise.all([
      prisma.tool.count({ where: { ownerId: userId } }),
      prisma.space.count({ where: { ownerId: userId } }),
      prisma.service.count({ where: { providerId: userId } }),
      prisma.request.count({ where: { seekerId: userId } }),
      prisma.review.count({ where: { reviewerId: userId } }),
    ]);

    res.json({
      stats: {
        rating: user.rating,
        totalTransactions: user.totalTransactions,
        totalReviews: user.totalReviews,
        totalListings: toolCount + spaceCount + serviceCount,
        totalRequests: requestCount,
        reviewsGiven,
        memberSince: user.createdDate,
      },
    });
    return;
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /gamification/leaderboard:
 *   get:
 *     summary: Get local leaderboard
 *     tags: [Gamification]
 */
router.get('/leaderboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const postcode = req.query.postcode as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    let whereClause = {};
    if (postcode) {
      const postcodeArea = postcode.split(' ')[0].slice(0, -1);
      whereClause = { postcode: { startsWith: postcodeArea } };
    }

    const users = await prisma.user.findMany({
      where: {
        ...whereClause,
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
      },
    });

    const leaderboard = users.map((u, index) => ({
      rank: index + 1,
      ...u,
    }));

    res.json({ leaderboard });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /gamification/next-badges:
 *   get:
 *     summary: Get user's next achievable badges with progress
 *     tags: [Gamification]
 */
router.get('/next-badges', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 3, 5);

    // Get user's current earned badges
    let earnedBadges: string[] = [];
    try {
      const userBadges = await (prisma as unknown as { userBadge: { findMany: (args: unknown) => Promise<Array<{ badge: string }>> } }).userBadge.findMany({
        where: { userId },
        select: { badge: true },
      });
      earnedBadges = userBadges.map((b: { badge: string }) => b.badge);
    } catch {
      // Table doesn't exist yet
    }

    const hasBadge = new Set(earnedBadges);

    // Get user's stats
    const [user, toolCount, reviewsGiven] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { totalTransactions: true, name: true, postcode: true, bio: true, avatar: true },
      }),
      prisma.tool.count({ where: { ownerId: userId } }),
      prisma.review.count({ where: { reviewerId: userId } }),
    ]);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const suggestions: Array<{
      badge: { type: string; name: string; description: string; icon: string };
      progress: number;
      remaining: string;
    }> = [];

    // Check rental milestones
    const totalRentals = user.totalTransactions;
    const rentalTargets: [number, string][] = [
      [1, 'FIRST_RENTAL'],
      [5, 'FIVE_RENTALS'],
      [10, 'TEN_RENTALS'],
      [25, 'TWENTY_FIVE_RENTALS'],
    ];

    for (const [target, badge] of rentalTargets) {
      if (!hasBadge.has(badge) && totalRentals < target) {
        suggestions.push({
          badge: { type: badge, ...BADGE_DEFINITIONS[badge] },
          progress: Math.round((totalRentals / target) * 100),
          remaining: `${target - totalRentals} more rental${target - totalRentals > 1 ? 's' : ''}`,
        });
        break;
      }
    }

    // Check profile complete
    if (!hasBadge.has('PROFILE_COMPLETE') && !(user.name && user.postcode && user.bio && user.avatar)) {
      const fields = [user.name, user.postcode, user.bio, user.avatar].filter(Boolean).length;
      suggestions.push({
        badge: { type: 'PROFILE_COMPLETE', ...BADGE_DEFINITIONS['PROFILE_COMPLETE'] },
        progress: Math.round((fields / 4) * 100),
        remaining: 'Complete your profile',
      });
    }

    // Check provider badges
    if (!hasBadge.has('TOOL_PROVIDER') && toolCount === 0) {
      suggestions.push({
        badge: { type: 'TOOL_PROVIDER', ...BADGE_DEFINITIONS['TOOL_PROVIDER'] },
        progress: 0,
        remaining: 'List your first tool',
      });
    }

    // Check reviewer badge
    if (!hasBadge.has('HELPFUL_REVIEWER') && reviewsGiven < 10) {
      suggestions.push({
        badge: { type: 'HELPFUL_REVIEWER', ...BADGE_DEFINITIONS['HELPFUL_REVIEWER'] },
        progress: Math.round((reviewsGiven / 10) * 100),
        remaining: `${10 - reviewsGiven} more review${10 - reviewsGiven > 1 ? 's' : ''}`,
      });
    }

    res.json({ nextBadges: suggestions.slice(0, limit) });
    return;
  } catch (error) {
    next(error);
  }
});

export default router;
