/**
 * Admin Analytics API Service
 * Provides platform-wide analytics for admin dashboard
 */

import { apiClient } from '../client';

// Types for analytics responses
export interface OverviewMetrics {
  totalUsers: number;
  totalListings: number;
  totalTransactions: number;
  totalGmv: number;
  platformRevenue: number;
  activeUsers24h: number;
  newUsersToday: number;
  pendingDisputes: number;
}

export interface RevenueDataPoint {
  date: string;
  gmv: number;
  platformFee: number;
  transactionCount: number;
}

export interface RevenueResponse {
  timeSeries: RevenueDataPoint[];
  totals: {
    gmv: number;
    platformFee: number;
    transactionCount: number;
  };
  range: {
    startDate: string;
    endDate: string;
  };
}

export interface UserGrowthDataPoint {
  date: string;
  newUsers: number;
  totalUsers: number;
}

export interface UserGrowthResponse {
  timeSeries: UserGrowthDataPoint[];
  totals: {
    newUsers: number;
    totalUsers: number;
  };
  range: {
    startDate: string;
    endDate: string;
  };
}

export interface ListingTrendsDataPoint {
  date: string;
  tools: number;
  spaces: number;
  services: number;
  requests: number;
}

export interface ListingTrendsResponse {
  timeSeries: ListingTrendsDataPoint[];
  totals: {
    tools: number;
    spaces: number;
    services: number;
    requests: number;
  };
  range: {
    startDate: string;
    endDate: string;
  };
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  revenue: number;
}

export interface GeographicDataPoint {
  region: string;
  userCount: number;
  listingCount: number;
  transactionCount: number;
}

export interface ConversionFunnel {
  totalSignups: number;
  profileCompleted: number;
  firstListingCreated: number;
  firstBookingMade: number;
  firstTransactionCompleted: number;
  repeatCustomers: number;
}

export interface ConversionFunnelResponse {
  funnel: ConversionFunnel;
  conversionRates: {
    signupToProfile: string;
    profileToListing: string;
    signupToTransaction: string;
    transactionToRepeat: string;
  };
}

export interface TopPerformer {
  id: string;
  name: string;
  avatar?: string;
  metric: number;
  metricLabel: string;
}

export interface TopPerformersResponse {
  topProviders: TopPerformer[];
  topEarners: TopPerformer[];
}

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

/**
 * Analytics API service for admin dashboard
 */
export const analyticsService = {
  /**
   * Get overview metrics
   */
  async getOverview(): Promise<OverviewMetrics> {
    const response = await apiClient.get<{ success: boolean; data: OverviewMetrics }>(
      '/admin/analytics/overview'
    );
    return response.data.data;
  },

  /**
   * Get revenue time series data
   */
  async getRevenue(params?: DateRangeParams): Promise<RevenueResponse> {
    const response = await apiClient.get<{ success: boolean; data: RevenueResponse }>(
      '/admin/analytics/revenue',
      { params }
    );
    return response.data.data;
  },

  /**
   * Get user growth time series data
   */
  async getUserGrowth(params?: DateRangeParams): Promise<UserGrowthResponse> {
    const response = await apiClient.get<{ success: boolean; data: UserGrowthResponse }>(
      '/admin/analytics/users',
      { params }
    );
    return response.data.data;
  },

  /**
   * Get listing trends time series data
   */
  async getListingTrends(params?: DateRangeParams): Promise<ListingTrendsResponse> {
    const response = await apiClient.get<{ success: boolean; data: ListingTrendsResponse }>(
      '/admin/analytics/listings',
      { params }
    );
    return response.data.data;
  },

  /**
   * Get category breakdown
   */
  async getCategoryBreakdown(): Promise<CategoryBreakdown[]> {
    const response = await apiClient.get<{ success: boolean; data: CategoryBreakdown[] }>(
      '/admin/analytics/categories'
    );
    return response.data.data;
  },

  /**
   * Get geographic distribution
   */
  async getGeographicDistribution(): Promise<GeographicDataPoint[]> {
    const response = await apiClient.get<{ success: boolean; data: GeographicDataPoint[] }>(
      '/admin/analytics/geographic'
    );
    return response.data.data;
  },

  /**
   * Get conversion funnel
   */
  async getConversionFunnel(): Promise<ConversionFunnelResponse> {
    const response = await apiClient.get<{ success: boolean; data: ConversionFunnelResponse }>(
      '/admin/analytics/funnel'
    );
    return response.data.data;
  },

  /**
   * Get top performers
   */
  async getTopPerformers(limit?: number): Promise<TopPerformersResponse> {
    const response = await apiClient.get<{ success: boolean; data: TopPerformersResponse }>(
      '/admin/analytics/top-performers',
      { params: { limit } }
    );
    return response.data.data;
  },

  /**
   * Clear analytics cache
   */
  async clearCache(): Promise<void> {
    await apiClient.post('/admin/analytics/cache/clear');
  },

  /**
   * Trigger daily metrics snapshot
   */
  async triggerSnapshot(): Promise<void> {
    await apiClient.post('/admin/analytics/snapshot');
  },
};

export default analyticsService;
