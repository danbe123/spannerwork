import apiClient from '../client';
import type { Review, CreateReviewData, PaginatedResponse } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ListReviewsParams {
  page?: number;
  limit?: number;
}

export interface UpdateReviewData {
  rating?: number;
  comment?: string;
}

// ============================================================================
// Service
// ============================================================================

export const reviewsService = {
  async create(data: CreateReviewData): Promise<{ message: string; review: Review }> {
    const response = await apiClient.post<{ message: string; review: Review }>('/reviews', data);
    return response.data;
  },

  async getById(id: string): Promise<{ review: Review }> {
    const response = await apiClient.get<{ review: Review }>(`/reviews/${id}`);
    return response.data;
  },

  async getByUser(userId: string, params: ListReviewsParams = {}): Promise<PaginatedResponse<Review>> {
    const response = await apiClient.get<PaginatedResponse<Review>>(
      `/reviews/user/${userId}`, 
      { params }
    );
    return response.data;
  },

  async update(id: string, data: UpdateReviewData): Promise<{ message: string; review: Review }> {
    const response = await apiClient.patch<{ message: string; review: Review }>(`/reviews/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`/reviews/${id}`);
    return response.data;
  },
};
