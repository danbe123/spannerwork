import apiClient from '../client';

export interface Badge {
  type: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
  earnedAt?: string;
}

export interface UserStats {
  rating: number | null;
  totalTransactions: number;
  totalReviews: number;
  totalListings: number;
  totalRequests: number;
  reviewsGiven: number;
  memberSince: string;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string | null;
  avatar: string | null;
  rating: number | null;
  totalTransactions: number;
}

export interface NextBadge {
  badge: {
    type: string;
    name: string;
    description: string;
    icon: string;
  };
  progress: number;
  remaining: string;
}

export const gamificationService = {
  /**
   * Get all available badges
   */
  async getAllBadges(): Promise<{ badges: Badge[] }> {
    const response = await apiClient.get<{ badges: Badge[] }>('/gamification/badges');
    return response.data;
  },

  /**
   * Get current user's earned badges
   */
  async getMyBadges(): Promise<{ badges: Badge[] }> {
    const response = await apiClient.get<{ badges: Badge[] }>('/gamification/my-badges');
    return response.data;
  },

  /**
   * Get current user's gamification stats
   */
  async getMyStats(): Promise<{ stats: UserStats }> {
    const response = await apiClient.get<{ stats: UserStats }>('/gamification/my-stats');
    return response.data;
  },

  /**
   * Get local leaderboard
   */
  async getLeaderboard(postcode?: string, limit = 10): Promise<{ leaderboard: LeaderboardEntry[] }> {
    const response = await apiClient.get<{ leaderboard: LeaderboardEntry[] }>(
      '/gamification/leaderboard',
      { params: { postcode, limit } }
    );
    return response.data;
  },

  /**
   * Get next achievable badges with progress
   */
  async getNextBadges(limit = 3): Promise<{ nextBadges: NextBadge[] }> {
    const response = await apiClient.get<{ nextBadges: NextBadge[] }>(
      '/gamification/next-badges',
      { params: { limit } }
    );
    return response.data;
  },
};
