import apiClient from '../client';
import type { SavedSearch } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface CreateSavedSearchData {
  name: string;
  filters: Record<string, unknown>;
}

export interface UpdateSavedSearchData {
  name?: string;
  filters?: Record<string, unknown>;
}

// ============================================================================
// Service
// ============================================================================

export const savedSearchesService = {
  async list(): Promise<{ savedSearches: SavedSearch[] }> {
    const response = await apiClient.get<{ savedSearches: SavedSearch[] }>('/saved-searches');
    return response.data;
  },

  async create(searchData: CreateSavedSearchData): Promise<{ message: string; savedSearch: SavedSearch }> {
    const response = await apiClient.post<{ message: string; savedSearch: SavedSearch }>(
      '/saved-searches', 
      searchData
    );
    return response.data;
  },

  async delete(searchId: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`/saved-searches/${searchId}`);
    return response.data;
  },

  async update(searchId: string, data: UpdateSavedSearchData): Promise<{ message: string; savedSearch: SavedSearch }> {
    const response = await apiClient.patch<{ message: string; savedSearch: SavedSearch }>(
      `/saved-searches/${searchId}`, 
      data
    );
    return response.data;
  },
};
