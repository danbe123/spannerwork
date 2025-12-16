import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { redis } from '../config/redis.js';
import websocketService from './websocket.service.js';
import { ActivityType, Prisma } from '@prisma/client';

interface ActivityEventData {
  type: ActivityType;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  isPublic?: boolean;
  postcode?: string;
}

interface FormattedActivity {
  id: string;
  type: ActivityType;
  message: string;
  icon: string;
  timestamp: Date;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

class ActivityFeedService {
  /**
   * Record a new activity event
   */
  async recordActivity(data: ActivityEventData): Promise<void> {
    try {
      const event = await prisma.activityEvent.create({
        data: {
          type: data.type,
          actorId: data.actorId,
          targetType: data.targetType,
          targetId: data.targetId,
          metadata: (data.metadata ?? null) as Prisma.InputJsonValue,
          isPublic: data.isPublic ?? true,
          postcode: data.postcode,
        },
      });

      // Broadcast to live feed via WebSocket if public
      if (data.isPublic) {
        const formatted = await this.formatActivity(event);
        websocketService.broadcastActivity({
          id: formatted.id,
          type: formatted.type,
          message: formatted.message,
          icon: formatted.icon,
          timestamp: formatted.timestamp.toISOString(),
          metadata: formatted.metadata,
          targetType: formatted.targetType ?? null,
          targetId: formatted.targetId ?? null,
        });
      }

      // Invalidate cache
      await redis.del('activity:feed:public');
    } catch (error) {
      logger.error('Error recording activity:', error);
    }
  }

  /**
   * Format single activity with user lookup (for real-time broadcast)
   */
  private async formatActivity(event: {
    id: string;
    type: ActivityType;
    actorId: string | null;
    targetType: string | null;
    targetId: string | null;
    metadata: unknown;
    createdAt: Date;
  }): Promise<FormattedActivity> {
    let userName: string | null = null;
    if (event.actorId) {
      const user = await prisma.user.findUnique({
        where: { id: event.actorId },
        select: { name: true },
      });
      userName = user?.name || null;
    }
    return this.formatActivitySync(event, userName);
  }

  /**
   * Format activity for display (sync version with pre-loaded user name)
   */
  private formatActivitySync(
    event: {
      id: string;
      type: ActivityType;
      actorId: string | null;
      targetType: string | null;
      targetId?: string | null;
      metadata: unknown;
      createdAt: Date;
    },
    userName?: string | null
  ): FormattedActivity {
    const metadata = event.metadata as Record<string, unknown> || {};
    const actorName = userName?.split(' ')[0] || 'Someone'; // First name only for privacy

    const templates: Record<ActivityType, { message: string; icon: string }> = {
      LISTING_CREATED: {
        message: `${actorName} listed a new ${metadata.itemType || 'item'}`,
        icon: '📦',
      },
      LISTING_BOOKED: {
        message: `${metadata.itemName || 'A listing'} was just booked`,
        icon: '✅',
      },
      REQUEST_POSTED: {
        message: `${actorName} is looking for ${metadata.category || 'help'}`,
        icon: '🔍',
      },
      REQUEST_FULFILLED: {
        message: `A ${metadata.category || 'request'} was fulfilled`,
        icon: '🎉',
      },
      TRANSACTION_COMPLETED: {
        message: `${actorName} completed a ${metadata.type || 'rental'}`,
        icon: '🤝',
      },
      REVIEW_POSTED: {
        message: `${actorName} left a ${metadata.rating || 5}-star review`,
        icon: '⭐',
      },
      USER_JOINED: {
        message: `${actorName} joined SpannerWork`,
        icon: '👋',
      },
      BADGE_EARNED: {
        message: `${actorName} earned the ${metadata.badgeName || 'new'} badge`,
        icon: '🏆',
      },
    };

    const template = templates[event.type] || { message: 'Activity occurred', icon: '📌' };

    return {
      id: event.id,
      type: event.type,
      message: template.message,
      icon: template.icon,
      timestamp: event.createdAt,
      targetType: event.targetType,
      targetId: event.targetId ?? null,
      metadata,
    };
  }

  /**
   * Get public activity feed (optimized to avoid N+1 queries)
   */
  async getPublicFeed(limit = 20): Promise<FormattedActivity[]> {
    // Check cache
    const cacheKey = `activity:feed:public:${limit}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const events = await prisma.activityEvent.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Batch load all users in ONE query to avoid N+1
    const actorIds = [...new Set(events.map(e => e.actorId).filter((id): id is string => id !== null))];
    const users = actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : [];
    const userMap = new Map(users.map(u => [u.id, u.name]));

    // Format with pre-loaded user data (no additional queries)
    const formatted = events.map(event => {
      const userName = event.actorId ? userMap.get(event.actorId) : null;
      return this.formatActivitySync(event, userName);
    });

    // Cache for 30 seconds (live feed should be fresh)
    await redis.setex(cacheKey, 30, JSON.stringify(formatted));

    return formatted;
  }

  /**
   * Get local activity feed for a postcode area (optimized to avoid N+1 queries)
   */
  async getLocalFeed(postcode: string, limit = 20): Promise<FormattedActivity[]> {
    const areaCode = postcode.split(' ')[0];

    const events = await prisma.activityEvent.findMany({
      where: {
        isPublic: true,
        postcode: { startsWith: areaCode },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Batch load all users in ONE query to avoid N+1
    const actorIds = [...new Set(events.map(e => e.actorId).filter((id): id is string => id !== null))];
    const users = actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : [];
    const userMap = new Map(users.map(u => [u.id, u.name]));

    return events.map(event => {
      const userName = event.actorId ? userMap.get(event.actorId) : null;
      return this.formatActivitySync(event, userName);
    });
  }

  /**
   * Get user's personal activity (their actions) - optimized to avoid N+1 queries
   */
  async getUserActivity(userId: string, limit = 50): Promise<FormattedActivity[]> {
    const events = await prisma.activityEvent.findMany({
      where: { actorId: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Batch load all users in ONE query to avoid N+1
    const actorIds = [...new Set(events.map(e => e.actorId).filter((id): id is string => id !== null))];
    const users = actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : [];
    const userMap = new Map(users.map(u => [u.id, u.name]));

    return events.map(event => {
      const userName = event.actorId ? userMap.get(event.actorId) : null;
      return this.formatActivitySync(event, userName);
    });
  }

  /**
   * Get live stats for display
   */
  async getLiveStats() {
    const cacheKey = 'activity:live-stats';
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [
      dailyTransactions,
      hourlyActivity,
      toolCount,
      spaceCount,
      serviceCount,
      activeRequests,
    ] = await Promise.all([
      prisma.activityEvent.count({
        where: {
          type: 'TRANSACTION_COMPLETED',
          createdAt: { gte: oneDayAgo },
        },
      }),
      prisma.activityEvent.count({
        where: { createdAt: { gte: oneHourAgo } },
      }),
      prisma.tool.count({ where: { available: true } }),
      prisma.space.count({ where: { available: true } }),
      prisma.service.count({ where: { available: true } }),
      prisma.request.count({ where: { status: 'ACTIVE' } }),
    ]);

    const activeListings = toolCount + spaceCount + serviceCount;

    const stats = {
      dailyTransactions,
      hourlyActivity,
      activeListings,
      activeRequests,
      updatedAt: now,
    };

    // Cache for 1 minute
    await redis.setex(cacheKey, 60, JSON.stringify(stats));

    return stats;
  }

  // Helper methods to record specific activities
  async recordListingCreated(userId: string, listingType: string, listingName: string, postcode?: string, listingId?: string) {
    await this.recordActivity({
      type: 'LISTING_CREATED',
      actorId: userId,
      targetType: listingType,
      targetId: listingId,
      metadata: { itemType: listingType, itemName: listingName, listingId },
      postcode,
    });
  }

  async recordListingBooked(userId: string, listingType: string, listingId: string, listingName: string, postcode?: string) {
    await this.recordActivity({
      type: 'LISTING_BOOKED',
      actorId: userId,
      targetType: listingType,
      targetId: listingId,
      metadata: { itemType: listingType, itemName: listingName },
      postcode,
    });
  }

  async recordRequestPosted(userId: string, requestId: string, category: string, postcode?: string) {
    await this.recordActivity({
      type: 'REQUEST_POSTED',
      actorId: userId,
      targetType: 'request',
      targetId: requestId,
      metadata: { category },
      postcode,
    });
  }

  async recordTransactionCompleted(userId: string, transactionId: string, type: string, postcode?: string) {
    await this.recordActivity({
      type: 'TRANSACTION_COMPLETED',
      actorId: userId,
      targetType: 'transaction',
      targetId: transactionId,
      metadata: { type },
      postcode,
    });
  }

  async recordReviewPosted(userId: string, reviewId: string, rating: number) {
    await this.recordActivity({
      type: 'REVIEW_POSTED',
      actorId: userId,
      targetType: 'review',
      targetId: reviewId,
      metadata: { rating },
    });
  }

  async recordUserJoined(userId: string, postcode?: string) {
    await this.recordActivity({
      type: 'USER_JOINED',
      actorId: userId,
      postcode,
    });
  }
}

export const activityFeedService = new ActivityFeedService();
