import apiClient from '../client';

export interface ActivityEvent {
  id: string;
  type: string;
  message: string;
  icon: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  targetType?: string | null;
  targetId?: string | null;
}

export interface LiveStats {
  activeListings: number;
  activeRequests: number;
  recentTransactions: number;
  updatedAt: string;
}

export const activityService = {
  /**
   * Get public activity feed
   */
  async getFeed(limit = 20): Promise<{ activities: ActivityEvent[] }> {
    const response = await apiClient.get<{ activities: ActivityEvent[] }>('/activity/feed', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get local activity feed for a postcode area
   */
  async getLocalFeed(postcode: string, limit = 20): Promise<{ activities: ActivityEvent[] }> {
    const response = await apiClient.get<{ activities: ActivityEvent[] }>('/activity/local', {
      params: { postcode, limit },
    });
    return response.data;
  },

  /**
   * Get live platform stats
   */
  async getStats(): Promise<LiveStats> {
    const response = await apiClient.get<LiveStats>('/activity/stats');
    return response.data;
  },
};
