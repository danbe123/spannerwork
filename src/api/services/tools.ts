import apiClient from '../client';
import type { Tool, CreateToolData, PaginatedResponse } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ListToolsParams {
  page?: number;
  limit?: number;
  category?: string;
  available?: boolean;
  minPrice?: number;
  maxPrice?: number;
  postcode?: string;
  radius?: number;
  search?: string;
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

export const toolsService = {
  /**
   * List all tools with filters
   */
  async list(params: ListToolsParams = {}): Promise<PaginatedResponse<Tool>> {
    const response = await apiClient.get<PaginatedResponse<Tool>>('/tools', { params });
    return response.data;
  },

  /**
   * Create a new tool listing
   */
  async create(data: CreateToolData): Promise<{ message: string; tool: Tool }> {
    const response = await apiClient.post<{ message: string; tool: Tool }>('/tools', data);
    return response.data;
  },

  /**
   * Get tool by ID
   */
  async getById(id: string): Promise<{ tool: Tool }> {
    const response = await apiClient.get<{ tool: Tool }>(`/tools/${id}`);
    return response.data;
  },

  /**
   * Update tool
   */
  async update(id: string, data: Partial<CreateToolData>): Promise<{ message: string; tool: Tool }> {
    const response = await apiClient.patch<{ message: string; tool: Tool }>(`/tools/${id}`, data);
    return response.data;
  },

  /**
   * Delete tool
   */
  async delete(id: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`/tools/${id}`);
    return response.data;
  },

  /**
   * Check tool availability
   */
  async checkAvailability(id: string, params: AvailabilityParams): Promise<AvailabilityResponse> {
    const response = await apiClient.get<AvailabilityResponse>(`/tools/${id}/availability`, { params });
    return response.data;
  },
};
