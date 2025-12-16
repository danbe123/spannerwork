import apiClient from '../client';
import type { Dispute, CreateDisputeData, DisputeStatus, PaginatedResponse } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ListDisputesParams {
  page?: number;
  limit?: number;
  status?: DisputeStatus;
}

export interface ResolveDisputeData {
  resolution: string;
  refundAmountInitiator?: number;
  refundAmountRespondent?: number;
}

// ============================================================================
// Service
// ============================================================================

export const disputesService = {
  async create(data: CreateDisputeData): Promise<{ message: string; dispute: Dispute }> {
    const response = await apiClient.post<{ message: string; dispute: Dispute }>('/disputes', data);
    return response.data;
  },

  async list(params: ListDisputesParams = {}): Promise<PaginatedResponse<Dispute>> {
    const response = await apiClient.get<PaginatedResponse<Dispute>>('/disputes', { params });
    return response.data;
  },

  async getById(id: string): Promise<{ dispute: Dispute }> {
    const response = await apiClient.get<{ dispute: Dispute }>(`/disputes/${id}`);
    return response.data;
  },

  async resolve(id: string, data: ResolveDisputeData): Promise<{ message: string; dispute: Dispute }> {
    const response = await apiClient.post<{ message: string; dispute: Dispute }>(
      `/disputes/${id}/resolve`, 
      data
    );
    return response.data;
  },

  async updateStatus(id: string, status: DisputeStatus): Promise<{ message: string; dispute: Dispute }> {
    const response = await apiClient.patch<{ message: string; dispute: Dispute }>(
      `/disputes/${id}/status`, 
      { status }
    );
    return response.data;
  },
};
