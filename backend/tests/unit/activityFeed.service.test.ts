import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    activityEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    tool: {
      count: vi.fn(),
    },
    space: {
      count: vi.fn(),
    },
    service: {
      count: vi.fn(),
    },
    request: {
      count: vi.fn(),
    },
  },
}));

vi.mock('../../src/config/redis.js', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/websocket.service.js', () => ({
  default: {
    broadcastActivity: vi.fn(),
  },
}));

import { activityFeedService } from '../../src/services/activityFeed.service.js';
import { prisma } from '../../src/config/database.js';
import { redis } from '../../src/config/redis.js';

describe('ActivityFeedService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getPublicFeed', () => {
    it('should return cached data if available', async () => {
      const cachedData = JSON.stringify([
        { id: '1', type: 'USER_JOINED', message: 'Someone joined' },
      ]);
      vi.mocked(redis.get).mockResolvedValue(cachedData);

      const result = await activityFeedService.getPublicFeed(20);

      expect(redis.get).toHaveBeenCalledWith('activity:feed:public:20');
      expect(result).toHaveLength(1);
      expect(prisma.activityEvent.findMany).not.toHaveBeenCalled();
    });

    it('should batch load users to avoid N+1 queries', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      const mockEvents = [
        { id: '1', type: 'USER_JOINED', actorId: 'user-1', metadata: {}, createdAt: new Date() },
        { id: '2', type: 'USER_JOINED', actorId: 'user-2', metadata: {}, createdAt: new Date() },
        { id: '3', type: 'LISTING_CREATED', actorId: 'user-1', metadata: { itemType: 'tool' }, createdAt: new Date() },
      ];

      const mockUsers = [
        { id: 'user-1', name: 'John Doe' },
        { id: 'user-2', name: 'Jane Smith' },
      ];

      vi.mocked(prisma.activityEvent.findMany).mockResolvedValue(mockEvents as any);
      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);
      vi.mocked(redis.setex).mockResolvedValue('OK');

      const result = await activityFeedService.getPublicFeed(20);

      // Should only make ONE user query for all unique actor IDs
      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['user-1', 'user-2'] } },
        select: { id: true, name: true },
      });

      expect(result).toHaveLength(3);
      expect(redis.setex).toHaveBeenCalledWith(
        'activity:feed:public:20',
        30,
        expect.any(String)
      );
    });

    it('should handle events with no actorId', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      const mockEvents = [
        { id: '1', type: 'LISTING_BOOKED', actorId: null, metadata: { itemName: 'Drill' }, createdAt: new Date() },
      ];

      vi.mocked(prisma.activityEvent.findMany).mockResolvedValue(mockEvents as any);
      vi.mocked(redis.setex).mockResolvedValue('OK');

      const result = await activityFeedService.getPublicFeed(20);

      // Should not query users if no actorIds (service skips the call when actorIds is empty)
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].message).toContain('Drill was just booked');
    });
  });

  describe('getLocalFeed', () => {
    it('should filter by postcode area', async () => {
      const mockEvents = [
        { id: '1', type: 'USER_JOINED', actorId: 'user-1', metadata: {}, createdAt: new Date(), postcode: 'SW1A 1AA' },
      ];
      const mockUsers = [{ id: 'user-1', name: 'Test User' }];

      vi.mocked(prisma.activityEvent.findMany).mockResolvedValue(mockEvents as any);
      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);

      await activityFeedService.getLocalFeed('SW1A 2AA', 20);

      expect(prisma.activityEvent.findMany).toHaveBeenCalledWith({
        where: {
          isPublic: true,
          postcode: { startsWith: 'SW1A' },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    });
  });

  describe('getUserActivity', () => {
    it('should return user activity with batched user loading', async () => {
      const mockEvents = [
        { id: '1', type: 'LISTING_CREATED', actorId: 'user-123', metadata: { itemType: 'space' }, createdAt: new Date() },
      ];
      const mockUsers = [{ id: 'user-123', name: 'John' }];

      vi.mocked(prisma.activityEvent.findMany).mockResolvedValue(mockEvents as any);
      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);

      const result = await activityFeedService.getUserActivity('user-123', 50);

      expect(prisma.activityEvent.findMany).toHaveBeenCalledWith({
        where: { actorId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getLiveStats', () => {
    it('should return cached stats if available', async () => {
      const cachedStats = JSON.stringify({
        dailyTransactions: 100,
        hourlyActivity: 50,
        activeListings: 1000,
        activeRequests: 200,
      });
      vi.mocked(redis.get).mockResolvedValue(cachedStats);

      const result = await activityFeedService.getLiveStats();

      expect(redis.get).toHaveBeenCalledWith('activity:live-stats');
      expect(result.dailyTransactions).toBe(100);
    });

    it('should calculate fresh stats if not cached', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(prisma.activityEvent.count)
        .mockResolvedValueOnce(50) // dailyTransactions
        .mockResolvedValueOnce(20); // hourlyActivity
      vi.mocked(prisma.tool.count).mockResolvedValue(100);
      vi.mocked(prisma.space.count).mockResolvedValue(50);
      vi.mocked(prisma.service.count).mockResolvedValue(30);
      vi.mocked(prisma.request.count).mockResolvedValue(25);
      vi.mocked(redis.setex).mockResolvedValue('OK');

      const result = await activityFeedService.getLiveStats();

      expect(result.dailyTransactions).toBe(50);
      expect(result.hourlyActivity).toBe(20);
      expect(result.activeListings).toBe(180); // 100 + 50 + 30
      expect(result.activeRequests).toBe(25);
      expect(redis.setex).toHaveBeenCalled();
    });
  });

  describe('recordActivity', () => {
    it('should create activity event and broadcast if public', async () => {
      const mockEvent = {
        id: 'event-1',
        type: 'USER_JOINED',
        actorId: 'user-123',
        metadata: {},
        createdAt: new Date(),
        isPublic: true,
      };
      const mockUser = { id: 'user-123', name: 'John Doe' };

      vi.mocked(prisma.activityEvent.create).mockResolvedValue(mockEvent as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(redis.del).mockResolvedValue(1);

      await activityFeedService.recordActivity({
        type: 'USER_JOINED',
        actorId: 'user-123',
        isPublic: true,
      });

      expect(prisma.activityEvent.create).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith('activity:feed:public');
    });
  });

  describe('helper methods', () => {
    it('should record listing created', async () => {
      vi.mocked(prisma.activityEvent.create).mockResolvedValue({} as any);
      vi.mocked(redis.del).mockResolvedValue(1);

      await activityFeedService.recordListingCreated('user-1', 'tool', 'Power Drill', 'SW1A 1AA');

      expect(prisma.activityEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'LISTING_CREATED',
          actorId: 'user-1',
          targetType: 'tool',
          metadata: { itemType: 'tool', itemName: 'Power Drill' },
          postcode: 'SW1A 1AA',
        }),
      });
    });

    it('should record transaction completed', async () => {
      vi.mocked(prisma.activityEvent.create).mockResolvedValue({} as any);
      vi.mocked(redis.del).mockResolvedValue(1);

      await activityFeedService.recordTransactionCompleted('user-1', 'txn-1', 'rental', 'SW1A 1AA');

      expect(prisma.activityEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'TRANSACTION_COMPLETED',
          actorId: 'user-1',
          targetType: 'transaction',
          targetId: 'txn-1',
          metadata: { type: 'rental' },
        }),
      });
    });
  });
});
