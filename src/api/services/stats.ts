import apiClient from '../client';

// ============================================================================
// Types
// ============================================================================

export interface PublicStats {
  users: {
    total: number;
    active: number;
  };
  requests: {
    active: number;
  };
  listings: {
    total: number;
    tools: number;
  };
  transactions: {
    completed: number;
  };
  platform: {
    averageRating: string;
    trustScore: string;
  };
}

export interface DetailedStats {
  users: Array<{ date: string; count: number }>;
  requests: Array<{ date: string; count: number }>;
  transactions: Array<{ date: string; count: number; revenue: number }>;
  reviews: {
    averageRating: number;
    totalCount: number;
    distribution: Record<number, number>;
  };
}

interface StatsResponse<T> {
  success: boolean;
  data: T;
}

// ============================================================================
// Service
// ============================================================================

export const statsService = {
  /**
   * Get public platform statistics
   */
  async getPublicStats(): Promise<PublicStats> {
    const response = await apiClient.get<StatsResponse<PublicStats>>('/stats');
    return response.data.data;
  },

  /**
   * Get detailed statistics (admin)
   */
  async getDetailedStats(): Promise<DetailedStats> {
    const response = await apiClient.get<StatsResponse<DetailedStats>>('/stats/detailed');
    return response.data.data;
  },
};
