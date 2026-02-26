import apiClient from '../client';
import type { Request, CreateRequestData, PaginatedResponse, Category, Urgency } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ListRequestsParams {
  page?: number;
  limit?: number;
  category?: Category;
  urgency?: Urgency;
  status?: string;
  postcode?: string;
  radius?: number;
  search?: string;
  minBudget?: number;
  maxBudget?: number;
}

// ============================================================================
// Service
// ============================================================================

export const requestsService = {
  /**
   * List all requests with filters
   */
  async list(params: ListRequestsParams = {}): Promise<PaginatedResponse<Request>> {
    const response = await apiClient.get<PaginatedResponse<Request>>('/requests', { params });
    return response.data;
  },

  /**
   * Create a new request
   */
  async create(data: CreateRequestData): Promise<{ message: string; request: Request }> {
    const response = await apiClient.post<{ message: string; request: Request }>('/requests', data);
    return response.data;
  },

  /**
   * Get request by ID
   */
  async getById(id: string): Promise<{ request: Request }> {
    const response = await apiClient.get<{ request: Request }>(`/requests/${id}`);
    return response.data;
  },

  /**
   * Update request
   */
  async update(id: string, data: Partial<CreateRequestData>): Promise<{ message: string; request: Request }> {
    const response = await apiClient.patch<{ message: string; request: Request }>(`/requests/${id}`, data);
    return response.data;
  },

  /**
   * Delete request
   */
  async delete(id: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`/requests/${id}`);
    return response.data;
  },

  /**
   * Cancel request (soft delete)
   */
  async cancel(id: string): Promise<{ message: string; request: Request }> {
    const response = await apiClient.post<{ message: string; request: Request }>(`/requests/${id}/cancel`);
    return response.data;
  },

  /**
   * Mark request as complete/fulfilled
   */
  async markComplete(id: string): Promise<{ message: string; request: Request }> {
    const response = await apiClient.post<{ message: string; request: Request }>(`/requests/${id}/complete`);
    return response.data;
  },
};
