import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Type for activity events until Prisma is regenerated
type ActivityEvent = {
  id: string;
  type: string;
  actorId: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  isPublic: boolean;
  postcode: string | null;
  createdAt: Date;
};

/**
 * Format activity for display
 */
async function formatActivity(event: ActivityEvent) {
  const metadata = (event.metadata as Record<string, unknown>) || {};
  let actorName = 'Someone';
  
  if (event.actorId) {
    const user = await prisma.user.findUnique({
      where: { id: event.actorId },
      select: { name: true },
    });
    actorName = user?.name?.split(' ')[0] || 'Someone';
  }

  const templates: Record<string, { message: string; icon: string }> = {
    LISTING_CREATED: { message: `${actorName} listed a new ${metadata.itemType || 'item'}`, icon: '📦' },
    LISTING_BOOKED: { message: `${metadata.itemName || 'A listing'} was just booked`, icon: '✅' },
    REQUEST_POSTED: { message: `${actorName} is looking for ${metadata.category || 'help'}`, icon: '🔍' },
    REQUEST_FULFILLED: { message: `A ${metadata.category || 'request'} was fulfilled`, icon: '🎉' },
    TRANSACTION_COMPLETED: { message: `${actorName} completed a ${metadata.type || 'rental'}`, icon: '🤝' },
    REVIEW_POSTED: { message: `${actorName} left a ${metadata.rating || 5}-star review`, icon: '⭐' },
    USER_JOINED: { message: `${actorName} joined SpannerWork`, icon: '👋' },
    BADGE_EARNED: { message: `${actorName} earned the ${metadata.badgeName || 'new'} badge`, icon: '🏆' },
  };

  const template = templates[event.type] || { message: 'Activity occurred', icon: '📌' };

  return {
    id: event.id,
    type: event.type,
    message: template.message,
    icon: template.icon,
    timestamp: event.createdAt,
    metadata,
    targetType: event.targetType,
    targetId: event.targetId,
  };
}

/**
 * @swagger
 * /activity/feed:
 *   get:
 *     summary: Get public activity feed
 *     tags: [Activity]
 */
router.get('/feed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    
    try {
      const events = await (prisma as unknown as { activityEvent: { findMany: (args: unknown) => Promise<ActivityEvent[]> } }).activityEvent.findMany({
        where: { isPublic: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      const formatted = await Promise.all(events.map(formatActivity));
      res.json({ activities: formatted });
    } catch {
      // Table may not exist in all environments - return empty array
      res.json({ activities: [] });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /activity/local:
 *   get:
 *     summary: Get local activity feed for a postcode area
 *     tags: [Activity]
 */
router.get('/local', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const postcode = req.query.postcode as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    
    if (!postcode) {
      res.status(400).json({ error: 'Postcode is required' });
      return;
    }

    const areaCode = postcode.split(' ')[0];
    
    try {
      const events = await (prisma as unknown as { activityEvent: { findMany: (args: unknown) => Promise<ActivityEvent[]> } }).activityEvent.findMany({
        where: {
          isPublic: true,
          postcode: { startsWith: areaCode },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      const formatted = await Promise.all(events.map(formatActivity));
      res.json({ activities: formatted });
    } catch {
      res.json({ activities: [] });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /activity/stats:
 *   get:
 *     summary: Get live platform stats
 *     tags: [Activity]
 */
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      activeListings,
      activeRequests,
      recentTransactions,
    ] = await Promise.all([
      Promise.all([
        prisma.tool.count({ where: { available: true } }),
        prisma.space.count({ where: { available: true } }),
        prisma.service.count({ where: { available: true } }),
      ]).then(counts => counts.reduce((a, b) => a + b, 0)),
      prisma.request.count({ where: { status: 'ACTIVE' } }),
      prisma.transaction.count({
        where: { createdDate: { gte: oneDayAgo } },
      }),
    ]);

    res.json({
      activeListings,
      activeRequests,
      recentTransactions,
      updatedAt: now,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
