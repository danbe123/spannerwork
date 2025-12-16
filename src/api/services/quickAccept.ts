import apiClient from '../client';

export interface MatchingProvider {
  id: string;
  name: string | null;
  email: string;
  distance: number;
  rating: number | null;
  matchScore: number;
}

export interface PendingResponse {
  id: string;
  request: {
    id: string;
    title: string;
    description: string;
    category: string;
    budget: number;
    urgency: string;
  };
  user: {
    id: string;
    name: string | null;
    rating: number | null;
    avatar: string | null;
  };
  createdDate: string;
}

export const quickAcceptService = {
  /**
   * Get matching providers for a request
   */
  async getMatches(requestId: string, limit = 10): Promise<{ providers: MatchingProvider[] }> {
    const response = await apiClient.get<{ providers: MatchingProvider[] }>(
      `/quick-accept/matches/${requestId}`,
      { params: { limit } }
    );
    return response.data;
  },

  /**
   * Quick accept a request (provider action)
   */
  async accept(
    requestId: string,
    proposedRate?: number
  ): Promise<{ success: boolean; transactionId?: string; message: string }> {
    const response = await apiClient.post<{
      success: boolean;
      transactionId?: string;
      message: string;
    }>('/quick-accept/accept', { requestId, proposedRate });
    return response.data;
  },

  /**
   * Decline a request (provider action)
   */
  async decline(requestId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      '/quick-accept/decline',
      { requestId }
    );
    return response.data;
  },

  /**
   * Get pending responses for the current provider
   */
  async getPending(): Promise<{ responses: PendingResponse[] }> {
    const response = await apiClient.get<{ responses: PendingResponse[] }>('/quick-accept/pending');
    return response.data;
  },

  /**
   * Trigger notifications to matching providers
   */
  async notifyProviders(requestId: string): Promise<{ success: boolean; notifiedProviders: number }> {
    const response = await apiClient.post<{ success: boolean; notifiedProviders: number }>(
      `/quick-accept/notify/${requestId}`
    );
    return response.data;
  },
};
