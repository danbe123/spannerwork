import apiClient from '../client';
import type { User, UserProfile, Review, Tool, Space, Service, PaginatedResponse } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface UpdateUserData {
  name?: string;
  username?: string;
  phone?: string;
  bio?: string;
  postcode?: string;
  avatar?: string;
  locationAddress?: string;
  locationLat?: number;
  locationLng?: number;
}

export interface ListReviewsParams {
  page?: number;
  limit?: number;
}

export interface UserListings {
  tools: Tool[];
  spaces: Space[];
  services: Service[];
}

// ============================================================================
// Service
// ============================================================================

export const usersService = {
  async getById(id: string): Promise<{ user: UserProfile }> {
    const response = await apiClient.get<{ user: UserProfile }>(`/users/${id}`);
    return response.data;
  },

  async update(id: string, data: UpdateUserData): Promise<{ message: string; user: User }> {
    const response = await apiClient.patch<{ message: string; user: User }>(`/users/${id}`, data);
    return response.data;
  },

  async getReviews(id: string, params: ListReviewsParams = {}): Promise<PaginatedResponse<Review>> {
    const response = await apiClient.get<PaginatedResponse<Review>>(
      `/users/${id}/reviews`, 
      { params }
    );
    return response.data;
  },

  async getListings(id: string): Promise<UserListings> {
    const response = await apiClient.get<UserListings>(`/users/${id}/listings`);
    return response.data;
  },
};
