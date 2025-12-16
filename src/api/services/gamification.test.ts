const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    get: vi.fn(),
  },
}));

vi.mock('../client', () => ({
  default: mockClient,
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { gamificationService } from './gamification';

describe('gamificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllBadges', () => {
    it('calls GET /gamification/badges and returns all badges', async () => {
      const responseData = {
        badges: [
          { type: 'EARLY_ADOPTER', name: 'Early Adopter', description: 'Joined early', icon: '🌟', requirement: 'Join before launch' },
          { type: 'FIRST_RENTAL', name: 'First Rental', description: 'Completed first rental', icon: '🔧', requirement: 'Complete 1 rental' },
        ],
      };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      const result = await gamificationService.getAllBadges();

      expect(mockClient.get).toHaveBeenCalledWith('/gamification/badges');
      expect(result).toEqual(responseData);
    });
  });

  describe('getMyBadges', () => {
    it('calls GET /gamification/my-badges and returns earned badges', async () => {
      const responseData = {
        badges: [
          { type: 'EARLY_ADOPTER', name: 'Early Adopter', description: 'Joined early', icon: '🌟', requirement: 'Join before launch', earnedAt: '2024-01-01' },
        ],
      };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      const result = await gamificationService.getMyBadges();

      expect(mockClient.get).toHaveBeenCalledWith('/gamification/my-badges');
      expect(result).toEqual(responseData);
    });
  });

  describe('getMyStats', () => {
    it('calls GET /gamification/my-stats and returns user stats', async () => {
      const responseData = {
        stats: {
          rating: 4.8,
          totalTransactions: 25,
          totalReviews: 20,
          totalListings: 5,
          totalRequests: 10,
          reviewsGiven: 15,
          memberSince: '2024-01-01',
        },
      };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      const result = await gamificationService.getMyStats();

      expect(mockClient.get).toHaveBeenCalledWith('/gamification/my-stats');
      expect(result).toEqual(responseData);
    });
  });

  describe('getLeaderboard', () => {
    it('calls GET /gamification/leaderboard with default params', async () => {
      const responseData = {
        leaderboard: [
          { rank: 1, id: 'user-1', name: 'Top User', avatar: null, rating: 5.0, totalTransactions: 100 },
        ],
      };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      const result = await gamificationService.getLeaderboard();

      expect(mockClient.get).toHaveBeenCalledWith('/gamification/leaderboard', {
        params: { postcode: undefined, limit: 10 },
      });
      expect(result).toEqual(responseData);
    });

    it('calls GET /gamification/leaderboard with postcode filter', async () => {
      const responseData = { leaderboard: [] };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      await gamificationService.getLeaderboard('SW1A', 5);

      expect(mockClient.get).toHaveBeenCalledWith('/gamification/leaderboard', {
        params: { postcode: 'SW1A', limit: 5 },
      });
    });
  });

  describe('getNextBadges', () => {
    it('calls GET /gamification/next-badges with default limit', async () => {
      const responseData = {
        nextBadges: [
          {
            badge: { type: 'FIVE_RENTALS', name: 'Five Rentals', description: 'Complete 5 rentals', icon: '⭐' },
            progress: 60,
            remaining: '2 more rentals',
          },
        ],
      };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      const result = await gamificationService.getNextBadges();

      expect(mockClient.get).toHaveBeenCalledWith('/gamification/next-badges', {
        params: { limit: 3 },
      });
      expect(result).toEqual(responseData);
    });

    it('calls GET /gamification/next-badges with custom limit', async () => {
      const responseData = { nextBadges: [] };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      await gamificationService.getNextBadges(5);

      expect(mockClient.get).toHaveBeenCalledWith('/gamification/next-badges', {
        params: { limit: 5 },
      });
    });
  });
});
