import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    userBadge: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    userStats: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    activityEvent: {
      create: vi.fn(),
    },
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

import { gamificationService, BADGE_DEFINITIONS } from '../../src/services/gamification.service.js';
import { prisma } from '../../src/config/database.js';

describe('GamificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('awardBadge', () => {
    it('should award badge if user does not already have it', async () => {
      vi.mocked(prisma.userBadge.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userBadge.create).mockResolvedValue({
        id: 'badge-1',
        userId: 'user-1',
        badge: 'FIRST_RENTAL',
        earnedAt: new Date(),
      } as any);
      vi.mocked(prisma.activityEvent.create).mockResolvedValue({} as any);

      const result = await gamificationService.awardBadge('user-1', 'FIRST_RENTAL');

      expect(result).toBe(true);
      expect(prisma.userBadge.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', badge: 'FIRST_RENTAL' },
      });
      expect(prisma.activityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'BADGE_EARNED',
            actorId: 'user-1',
          }),
        })
      );
    });

    it('should return false if user already has badge', async () => {
      vi.mocked(prisma.userBadge.findUnique).mockResolvedValue({
        id: 'existing',
        badge: 'FIRST_RENTAL',
      } as any);

      const result = await gamificationService.awardBadge('user-1', 'FIRST_RENTAL');

      expect(result).toBe(false);
      expect(prisma.userBadge.create).not.toHaveBeenCalled();
    });

    it('should return false on error', async () => {
      vi.mocked(prisma.userBadge.findUnique).mockRejectedValue(new Error('DB error'));

      const result = await gamificationService.awardBadge('user-1', 'FIRST_RENTAL');

      expect(result).toBe(false);
    });
  });

  describe('checkMilestones', () => {
    it('should award rental milestone badges', async () => {
      vi.mocked(prisma.userStats.findUnique).mockResolvedValue({
        userId: 'user-1',
        totalRentalsAsRenter: 10,
        totalRentalsAsProvider: 5,
        totalEarned: 500,
        totalSpent: 200,
        averageResponseMinutes: 30,
        cancellationRate: 0,
        successfulReferrals: 2,
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        name: 'Test User',
        postcode: 'SW1A 1AA',
        bio: 'Test bio',
        avatar: 'avatar.jpg',
        rating: 4.5,
        totalReviews: 5,
        tools: [],
        spaces: [],
        services: [],
        reviewsGiven: [],
        badges: [],
      } as any);

      vi.mocked(prisma.userBadge.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userBadge.create).mockResolvedValue({} as any);
      vi.mocked(prisma.activityEvent.create).mockResolvedValue({} as any);

      const awarded = await gamificationService.checkMilestones('user-1');

      // Should have tried to award multiple rental badges
      expect(prisma.userBadge.create).toHaveBeenCalled();
      // Should include badges for 1, 5, 10 rentals (total = 15)
      expect(awarded.length).toBeGreaterThan(0);
    });

    it('should return empty array if user not found', async () => {
      vi.mocked(prisma.userStats.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const awarded = await gamificationService.checkMilestones('unknown-user');

      expect(awarded).toEqual([]);
    });

    it('should award provider badges when user has listings', async () => {
      vi.mocked(prisma.userStats.findUnique).mockResolvedValue({
        userId: 'user-1',
        totalRentalsAsRenter: 0,
        totalRentalsAsProvider: 0,
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        tools: [{ id: 'tool-1' }],
        spaces: [{ id: 'space-1' }],
        services: [{ id: 'service-1' }],
        reviewsGiven: [],
        badges: [],
      } as any);

      vi.mocked(prisma.userBadge.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userBadge.create).mockResolvedValue({} as any);
      vi.mocked(prisma.activityEvent.create).mockResolvedValue({} as any);

      const awarded = await gamificationService.checkMilestones('user-1');

      expect(awarded).toContain('TOOL_PROVIDER');
      expect(awarded).toContain('SPACE_PROVIDER');
      expect(awarded).toContain('SERVICE_PROVIDER');
    });

    it('should award profile complete badge when profile is filled', async () => {
      vi.mocked(prisma.userStats.findUnique).mockResolvedValue({
        userId: 'user-1',
        totalRentalsAsRenter: 0,
        totalRentalsAsProvider: 0,
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        name: 'Full Name',
        postcode: 'SW1A 1AA',
        bio: 'A bio',
        avatar: 'avatar.jpg',
        tools: [],
        spaces: [],
        services: [],
        reviewsGiven: [],
        badges: [],
      } as any);

      vi.mocked(prisma.userBadge.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userBadge.create).mockResolvedValue({} as any);
      vi.mocked(prisma.activityEvent.create).mockResolvedValue({} as any);

      const awarded = await gamificationService.checkMilestones('user-1');

      expect(awarded).toContain('PROFILE_COMPLETE');
    });
  });

  describe('getUserBadges', () => {
    it('should return user badges with definitions', async () => {
      vi.mocked(prisma.userBadge.findMany).mockResolvedValue([
        { id: 'b1', userId: 'user-1', badge: 'FIRST_RENTAL', earnedAt: new Date() },
        { id: 'b2', userId: 'user-1', badge: 'TOOL_PROVIDER', earnedAt: new Date() },
      ] as any);

      const badges = await gamificationService.getUserBadges('user-1');

      expect(badges).toHaveLength(2);
      expect(badges[0].definition).toEqual(BADGE_DEFINITIONS['FIRST_RENTAL']);
      expect(badges[1].definition).toEqual(BADGE_DEFINITIONS['TOOL_PROVIDER']);
    });
  });

  describe('getOrCreateStats', () => {
    it('should return existing stats', async () => {
      const existingStats = {
        userId: 'user-1',
        totalRentalsAsRenter: 5,
        totalRentalsAsProvider: 3,
      };

      vi.mocked(prisma.userStats.findUnique).mockResolvedValue(existingStats as any);

      const result = await gamificationService.getOrCreateStats('user-1');

      expect(result).toEqual(existingStats);
      expect(prisma.userStats.create).not.toHaveBeenCalled();
    });

    it('should create new stats if not exists', async () => {
      vi.mocked(prisma.userStats.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userStats.create).mockResolvedValue({
        userId: 'user-1',
        totalRentalsAsRenter: 0,
        totalRentalsAsProvider: 0,
      } as any);

      await gamificationService.getOrCreateStats('user-1');

      expect(prisma.userStats.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
      });
    });
  });

  describe('updateStatsAfterTransaction', () => {
    it('should update stats for renter', async () => {
      vi.mocked(prisma.userStats.findUnique).mockResolvedValue({
        userId: 'user-1',
        totalRentalsAsRenter: 5,
        totalRentalsAsProvider: 0,
        totalEarned: 0,
        totalSpent: 100,
      } as any);

      vi.mocked(prisma.userStats.update).mockResolvedValue({} as any);

      // Mock the user.findUnique for checkMilestones
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        tools: [],
        spaces: [],
        services: [],
        reviewsGiven: [],
        badges: [],
      } as any);

      await gamificationService.updateStatsAfterTransaction('user-1', false, 50, true);

      expect(prisma.userStats.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: expect.objectContaining({
          totalRentalsAsRenter: 6,
          totalSpent: 150,
        }),
      });
    });

    it('should update stats for provider', async () => {
      vi.mocked(prisma.userStats.findUnique).mockResolvedValue({
        userId: 'provider-1',
        totalRentalsAsRenter: 0,
        totalRentalsAsProvider: 10,
        totalEarned: 500,
        totalSpent: 0,
      } as any);

      vi.mocked(prisma.userStats.update).mockResolvedValue({} as any);

      // Mock the user.findUnique for checkMilestones
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'provider-1',
        tools: [],
        spaces: [],
        services: [],
        reviewsGiven: [],
        badges: [],
      } as any);

      await gamificationService.updateStatsAfterTransaction('provider-1', true, 75, true);

      expect(prisma.userStats.update).toHaveBeenCalledWith({
        where: { userId: 'provider-1' },
        data: expect.objectContaining({
          totalRentalsAsProvider: 11,
          totalEarned: 575,
        }),
      });
    });
  });

  describe('getLocalLeaderboard', () => {
    it('should return top users in area', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          name: 'Top User',
          avatar: 'avatar.jpg',
          rating: 4.9,
          totalTransactions: 50,
          badges: [{ badge: 'TOP_RATED' }],
        },
        {
          id: 'user-2',
          name: 'Second User',
          avatar: 'avatar2.jpg',
          rating: 4.7,
          totalTransactions: 30,
          badges: [],
        },
      ] as any);

      const leaderboard = await gamificationService.getLocalLeaderboard('SW1A 1AA', 10);

      expect(leaderboard).toHaveLength(2);
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[1].rank).toBe(2);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            postcode: { startsWith: 'SW1' },
          }),
        })
      );
    });
  });

  describe('getNextBadges', () => {
    it('should suggest next achievable badges', async () => {
      vi.mocked(prisma.userStats.findUnique).mockResolvedValue({
        userId: 'user-1',
        totalRentalsAsRenter: 3,
        totalRentalsAsProvider: 0,
        successfulReferrals: 2,
      } as any);

      vi.mocked(prisma.userStats.create).mockResolvedValue({
        userId: 'user-1',
        totalRentalsAsRenter: 3,
        totalRentalsAsProvider: 0,
        successfulReferrals: 2,
      } as any);

      vi.mocked(prisma.userBadge.findMany).mockResolvedValue([
        { badge: 'FIRST_RENTAL' },
      ] as any);

      const suggestions = await gamificationService.getNextBadges('user-1', 3);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].badge).toBeDefined();
      expect(suggestions[0].progress).toBeDefined();
      expect(suggestions[0].remaining).toBeDefined();
    });
  });

  describe('BADGE_DEFINITIONS', () => {
    it('should have all required badge properties', () => {
      for (const [key, badge] of Object.entries(BADGE_DEFINITIONS)) {
        expect(badge.type).toBe(key);
        expect(badge.name).toBeTruthy();
        expect(badge.description).toBeTruthy();
        expect(badge.icon).toBeTruthy();
        expect(badge.requirement).toBeTruthy();
      }
    });
  });
});
