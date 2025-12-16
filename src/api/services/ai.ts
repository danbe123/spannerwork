import apiClient from '../client';

export interface MatchResult {
  listingId: string;
  listingType: 'tool' | 'space' | 'service';
  matchScore: number;
  matchReason: string;
}

export interface BundleSuggestion {
  id: string;
  type: 'tool' | 'space' | 'service';
  name: string;
  reason: string;
  price: number;
}

export interface OptimizedRequest {
  optimizedTitle: string;
  optimizedDescription: string;
  suggestedBudget: number | null;
}

export const aiService = {
  /**
   * Get AI-powered matches for a request
   */
  async getMatches(data: {
    title: string;
    description: string;
    category: string;
    budget?: number;
    postcode?: string;
  }): Promise<{ matches: MatchResult[] }> {
    const response = await apiClient.post<{ matches: MatchResult[] }>('/ai/match', data);
    return response.data;
  },

  /**
   * Get bundle suggestions for a listing
   */
  async getBundles(
    listingType: 'tool' | 'space' | 'service',
    listingId: string,
    name: string,
    category: string
  ): Promise<{ suggestions: BundleSuggestion[] }> {
    const response = await apiClient.get<{ suggestions: BundleSuggestion[] }>(
      `/ai/bundles/${listingType}/${listingId}`,
      { params: { name, category } }
    );
    return response.data;
  },

  /**
   * Optimize request title and description
   */
  async optimizeRequest(
    title: string,
    description: string,
    category: string
  ): Promise<OptimizedRequest> {
    const response = await apiClient.post<OptimizedRequest>('/ai/optimize-request', {
      title,
      description,
      category,
    });
    return response.data;
  },
};
