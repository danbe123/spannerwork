/**
 * Authentication Hook
 * 
 * Provides authentication state management using React Query.
 * Handles user session, caching, and automatic cache invalidation on logout.
 */

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { authService, type CurrentUserResponse } from '@/api/services/auth';
import type { User } from '@/types';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Query key for the current user
 */
export const CURRENT_USER_QUERY_KEY = queryKeys.currentUser();

/**
 * User-specific query keys that should be invalidated on logout
 */
const USER_SPECIFIC_QUERIES = queryKeys.userSpecificRoots;

export interface UseAuthReturn {
  /** Current authenticated user or null if not authenticated */
  user: User | null;
  /** Whether the auth query is loading */
  isLoading: boolean;
  /** Whether the auth query has failed */
  isError: boolean;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Error object if the query failed */
  error: Error | null;
  /** Refetch the current user data */
  refetch: () => Promise<void>;
}

/**
 * Hook for accessing and managing authentication state
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isAuthenticated, isLoading } = useAuth();
 *   
 *   if (isLoading) return <Spinner />;
 *   if (!isAuthenticated) return <LoginPrompt />;
 *   return <Welcome user={user} />;
 * }
 * ```
 */
export function useAuth(): UseAuthReturn {
  const queryClient = useQueryClient();
  const postLoginGracePeriod = useRef<number | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch: queryRefetch,
  } = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: async (): Promise<CurrentUserResponse | null> => {
      try {
        return await authService.getCurrentUser();
      } catch (err: unknown) {
        // Return null for 401 errors (not authenticated)
        if (err instanceof AxiosError && err.response?.status === 401) {
          return null;
        }
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: false, // Don't retry auth queries
    refetchOnWindowFocus: 'always',
  });

  // Set grace period when user data is set in cache (indicating fresh login)
  useEffect(() => {
    const currentUser = queryClient.getQueryData(CURRENT_USER_QUERY_KEY);
    if (currentUser && !postLoginGracePeriod.current) {
      // Set 5-second grace period where 401s won't clear auth
      postLoginGracePeriod.current = Date.now();
      setTimeout(() => {
        postLoginGracePeriod.current = null;
      }, 5000);
    }
  }, [data, queryClient]);

  // Listen for global unauthorized events (e.g., session expiry)
  useEffect(() => {
    function handleUnauthorized(): void {
      // Ignore 401s during post-login grace period to allow cookie processing
      if (postLoginGracePeriod.current && Date.now() - postLoginGracePeriod.current < 5000) {
        return;
      }

      // Clear user data
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, null);

      // Invalidate all user-specific queries to clear cached data
      queryClient.removeQueries({
        predicate: (query) => USER_SPECIFIC_QUERIES.includes(query.queryKey[0] as never),
      });
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [queryClient]);

  useEffect(() => {
    function handleAuthUpdated(): void {
      queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
      void queryClient.refetchQueries({ queryKey: CURRENT_USER_QUERY_KEY });
    }

    function handleStorage(e: StorageEvent): void {
      if (e.key === 'spannerwork:authUpdated') {
        handleAuthUpdated();
      }
    }

    window.addEventListener('auth:updated', handleAuthUpdated);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('auth:updated', handleAuthUpdated);
      window.removeEventListener('storage', handleStorage);
    };
  }, [queryClient]);

  const user = data?.user ?? null;

  return {
    user,
    isLoading,
    isError,
    isAuthenticated: !!user,
    error: error as Error | null,
    refetch: async () => {
      await queryRefetch();
    },
  };
}

export default useAuth;
