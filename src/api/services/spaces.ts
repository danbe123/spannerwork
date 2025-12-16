import apiClient from '../client';
import type { Space, CreateSpaceData, PaginatedResponse } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ListSpacesParams {
  page?: number;
  limit?: number;
  available?: boolean;
  minPrice?: number;
  maxPrice?: number;
  postcode?: string;
  radius?: number;
  search?: string;
  minSize?: number;
  maxSize?: number;
}

export interface AvailabilityParams {
  startDate: string;
  endDate: string;
}

export interface AvailabilityResponse {
  available: boolean;
  conflicts?: Array<{ startDate: string; endDate: string }>;
}

// ============================================================================
// Service
// ============================================================================

export const spacesService = {
  async list(params: ListSpacesParams = {}): Promise<PaginatedResponse<Space>> {
    const response = await apiClient.get<PaginatedResponse<Space>>('/spaces', { params });
    return response.data;
  },

  async create(data: CreateSpaceData): Promise<{ message: string; space: Space }> {
    const response = await apiClient.post<{ message: string; space: Space }>('/spaces', data);
    return response.data;
  },

  async getById(id: string): Promise<{ space: Space }> {
    const response = await apiClient.get<{ space: Space }>(`/spaces/${id}`);
    return response.data;
  },

  async update(id: string, data: Partial<CreateSpaceData>): Promise<{ message: string; space: Space }> {
    const response = await apiClient.patch<{ message: string; space: Space }>(`/spaces/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`/spaces/${id}`);
    return response.data;
  },

  async checkAvailability(id: string, params: AvailabilityParams): Promise<AvailabilityResponse> {
    const response = await apiClient.get<AvailabilityResponse>(`/spaces/${id}/availability`, { params });
    return response.data;
  },
};
