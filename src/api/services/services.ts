import apiClient from '../client';
import type { Service, CreateServiceData, PaginatedResponse } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ListServicesParams {
  page?: number;
  limit?: number;
  available?: boolean;
  minPrice?: number;
  maxPrice?: number;
  postcode?: string;
  radius?: number;
  search?: string;
  specialty?: string;
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

export const servicesService = {
  async list(params: ListServicesParams = {}): Promise<PaginatedResponse<Service>> {
    const response = await apiClient.get<PaginatedResponse<Service>>('/services', { params });
    return response.data;
  },

  async create(data: CreateServiceData): Promise<{ message: string; service: Service }> {
    const response = await apiClient.post<{ message: string; service: Service }>('/services', data);
    return response.data;
  },

  async getById(id: string): Promise<{ service: Service }> {
    const response = await apiClient.get<{ service: Service }>(`/services/${id}`);
    return response.data;
  },

  async update(id: string, data: Partial<CreateServiceData>): Promise<{ message: string; service: Service }> {
    const response = await apiClient.patch<{ message: string; service: Service }>(`/services/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`/services/${id}`);
    return response.data;
  },

  async checkAvailability(id: string, params: AvailabilityParams): Promise<AvailabilityResponse> {
    const response = await apiClient.get<AvailabilityResponse>(`/services/${id}/availability`, { params });
    return response.data;
  },
};
