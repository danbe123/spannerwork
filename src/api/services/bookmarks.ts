import apiClient from '../client';
import type { Request } from '@/types';

// Types

export interface Bookmark {
  id: string;
  requestId: string;
  createdAt: string;
  request: Request;
}

export interface BookmarkIdsResponse {
  ids: string[];
}

export interface BookmarksListResponse {
  bookmarks: Bookmark[];
  count: number;
}

export interface BookmarkCheckResponse {
  bookmarked: boolean;
}

export interface BookmarkToggleResponse {
  message: string;
  bookmarked: boolean;
}

export interface BookmarkSyncResponse {
  message: string;
  ids: string[];
}

// Local storage key for unauthenticated users
const LOCAL_STORAGE_KEY = 'spannerwork_bookmarks';

// Local storage helpers for unauthenticated users

function getLocalBookmarks(): Set<string> {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveLocalBookmarks(ids: Set<string>): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage unavailable
  }
}

function clearLocalBookmarks(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}

// API service

export const bookmarksService = {
  /**
   * Get all bookmarks with request data
   * Returns from server if authenticated, localStorage otherwise
   */
  async list(): Promise<BookmarksListResponse> {
    try {
      const response = await apiClient.get<BookmarksListResponse>('/bookmarks');
      return response.data;
    } catch (error: unknown) {
      // If not authenticated, return empty (localStorage bookmarks are handled separately)
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 401) {
          return { bookmarks: [], count: 0 };
        }
      }
      throw error;
    }
  },

  /**
   * Get bookmark IDs only (for quick sync)
   */
  async getIds(): Promise<string[]> {
    try {
      const response = await apiClient.get<BookmarkIdsResponse>('/bookmarks/ids');
      return response.data.ids;
    } catch (error: unknown) {
      // If not authenticated, return localStorage bookmarks
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 401) {
          return [...getLocalBookmarks()];
        }
      }
      throw error;
    }
  },

  /**
   * Check if a request is bookmarked
   */
  async isBookmarked(requestId: string): Promise<boolean> {
    try {
      const response = await apiClient.get<BookmarkCheckResponse>(`/bookmarks/check/${requestId}`);
      return response.data.bookmarked;
    } catch (error: unknown) {
      // If not authenticated, check localStorage
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 401) {
          return getLocalBookmarks().has(requestId);
        }
      }
      throw error;
    }
  },

  /**
   * Add a bookmark
   */
  async add(requestId: string): Promise<void> {
    try {
      await apiClient.post(`/bookmarks/${requestId}`);
    } catch (error: unknown) {
      // If not authenticated, save to localStorage
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 401) {
          const bookmarks = getLocalBookmarks();
          bookmarks.add(requestId);
          saveLocalBookmarks(bookmarks);
          return;
        }
      }
      throw error;
    }
  },

  /**
   * Remove a bookmark
   */
  async remove(requestId: string): Promise<void> {
    try {
      await apiClient.delete(`/bookmarks/${requestId}`);
    } catch (error: unknown) {
      // If not authenticated, remove from localStorage
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 401) {
          const bookmarks = getLocalBookmarks();
          bookmarks.delete(requestId);
          saveLocalBookmarks(bookmarks);
          return;
        }
      }
      throw error;
    }
  },

  /**
   * Toggle a bookmark
   */
  async toggle(requestId: string): Promise<BookmarkToggleResponse> {
    try {
      const response = await apiClient.post<BookmarkToggleResponse>(`/bookmarks/${requestId}/toggle`);
      return response.data;
    } catch (error: unknown) {
      // If not authenticated, toggle in localStorage
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 401) {
          const bookmarks = getLocalBookmarks();
          const wasBookmarked = bookmarks.has(requestId);
          if (wasBookmarked) {
            bookmarks.delete(requestId);
          } else {
            bookmarks.add(requestId);
          }
          saveLocalBookmarks(bookmarks);
          return {
            message: wasBookmarked ? 'Bookmark removed' : 'Bookmark added',
            bookmarked: !wasBookmarked,
          };
        }
      }
      throw error;
    }
  },

  /**
   * Sync localStorage bookmarks to server (call after login)
   */
  async syncFromLocalStorage(): Promise<string[]> {
    const localBookmarks = getLocalBookmarks();
    if (localBookmarks.size === 0) {
      // No local bookmarks to sync, just get server bookmarks
      return this.getIds();
    }

    try {
      const response = await apiClient.post<BookmarkSyncResponse>('/bookmarks/sync', {
        ids: [...localBookmarks],
      });
      // Clear localStorage after successful sync
      clearLocalBookmarks();
      return response.data.ids;
    } catch {
      // If sync fails, return local bookmarks
      return [...localBookmarks];
    }
  },

  /**
   * Get local bookmarks (for components that need them without async)
   */
  getLocalBookmarkIds(): string[] {
    return [...getLocalBookmarks()];
  },

  /**
   * Check if bookmarked locally (for components that need sync check)
   */
  isLocallyBookmarked(requestId: string): boolean {
    return getLocalBookmarks().has(requestId);
  },
};
