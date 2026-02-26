import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const isDev = import.meta.env.DEV;

// Extended config type for retry tracking
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _csrfRetryCount?: number;
  _retryCount?: number;
  _retryable?: boolean;
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  // Status codes that are retryable (transient errors)
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  // Methods that are safe to retry (idempotent)
  retryableMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'],
};

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoffDelay(retryCount: number): number {
  const exponentialDelay = RETRY_CONFIG.baseDelayMs * Math.pow(2, retryCount);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelayMs);
}

function parseRetryAfterMs(retryAfter: unknown): number | null {
  if (typeof retryAfter !== 'string' || retryAfter.trim() === '') return null;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) {
    const ms = Math.max(0, Math.floor(seconds * 1000));
    return ms;
  }
  const dateMs = Date.parse(retryAfter);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return null;
}

/**
 * Check if a request is retryable
 */
function isRetryable(config: ExtendedAxiosRequestConfig, error: AxiosError): boolean {
  if ((config._retryCount || 0) >= RETRY_CONFIG.maxRetries) {
    return false;
  }

  const method = (config.method || '').toUpperCase();
  if (!RETRY_CONFIG.retryableMethods.includes(method)) {
    if (method === 'POST' && !config._retryable) {
      return false;
    }
  }

  if (!error.response) {
    return true;
  }

  if (error.response.status === 429) {
    const retryAfterMs = parseRetryAfterMs(error.response.headers?.['retry-after']);
    if (retryAfterMs === null || retryAfterMs > 30000) {
      return false;
    }
    return (config._retryCount || 0) < 1;
  }

  return RETRY_CONFIG.retryableStatuses.includes(error.response.status);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

const csrfClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

let csrfToken: string | null = null;
let csrfTokenTimestamp: number | null = null;
const CSRF_TOKEN_MAX_AGE = 10 * 60 * 1000;

/**
 * Check if CSRF token needs refresh
 */
function isCsrfTokenStale(): boolean {
  if (!csrfToken || !csrfTokenTimestamp) return true;
  return Date.now() - csrfTokenTimestamp > CSRF_TOKEN_MAX_AGE;
}

/**
 * Force refresh CSRF token
 */
export async function refreshCsrfToken(): Promise<string | null> {
  try {
    const response = await csrfClient.get<{ csrfToken: string }>('/csrf-token');
    csrfToken = response.data?.csrfToken;
    csrfTokenTimestamp = Date.now();
    return csrfToken;
  } catch {
    csrfToken = null;
    csrfTokenTimestamp = null;
    return null;
  }
}

/**
 * Get CSRF token, refreshing if stale
 */
async function getCsrfToken(): Promise<string | null> {
  if (!isCsrfTokenStale()) return csrfToken;
  return refreshCsrfToken();
}

export function clearCsrfToken(): void {
  csrfToken = null;
  csrfTokenTimestamp = null;
}

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Request interceptor
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (!config.headers) {
      config.headers = {} as typeof config.headers;
    }

    config.headers['X-Request-ID'] = generateRequestId();

    const method = (config.method || '').toUpperCase();
    const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (needsCsrf) {
      if (!config.headers['X-CSRF-Token']) {
        const token = await getCsrfToken();
        if (token) {
          config.headers['X-CSRF-Token'] = token;
        }
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const MAX_CSRF_RETRIES = 1;

// API Error type
export interface ApiError extends Error {
  status: number;
  data?: Record<string, unknown>;
}

// Response interceptor for error handling with CSRF retry and exponential backoff
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError<{ message?: string; error?: string; code?: string }>) => {
    const originalRequest = error.config as ExtendedAxiosRequestConfig;

    // Check if we should retry with exponential backoff (transient errors)
    if (originalRequest && isRetryable(originalRequest, error)) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;

      const retryAfterMs = parseRetryAfterMs(error.response?.headers?.['retry-after']);
      const delay = retryAfterMs !== null
        ? Math.min(retryAfterMs, RETRY_CONFIG.maxDelayMs)
        : calculateBackoffDelay(originalRequest._retryCount - 1);
      
      if (isDev) {
        console.warn(`[API] Retrying request (attempt ${originalRequest._retryCount}/${RETRY_CONFIG.maxRetries}) after ${Math.round(delay)}ms`);
      }
      
      await sleep(delay);
      return apiClient(originalRequest);
    }

    // Handle common errors
    if (error.response) {
      // Server responded with error
      const { status, data } = error.response;

      // Handle specific status codes
      if (status === 401) {
        if (isDev) console.warn('[API] Unauthorized access');
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(
            new CustomEvent('auth:unauthorized', {
              detail: { status, data },
            }),
          );
        }
      } else if (status === 429) {
        if (isDev) console.warn('[API] Rate limited');
        const retryAfter = parseRetryAfterMs(error.response.headers?.['retry-after']);
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(
            new CustomEvent('api:rate-limited', {
              detail: {
                status,
                retryAfter: retryAfter ? Math.ceil(retryAfter / 1000) : 60,
                path: originalRequest?.url || '/',
              },
            }),
          );
        }
      } else if (status === 403) {
        // Handle CSRF and general forbidden errors
        if (data?.code === 'EBADCSRFTOKEN') {
          // Track retry count to prevent infinite loops
          originalRequest._csrfRetryCount = originalRequest._csrfRetryCount || 0;

          if (originalRequest._csrfRetryCount < MAX_CSRF_RETRIES) {
            originalRequest._csrfRetryCount += 1;
            if (isDev) console.warn('[API] Invalid CSRF token, refreshing and retrying...');

            // Clear and refresh the CSRF token
            clearCsrfToken();
            const newToken = await refreshCsrfToken();

            if (newToken && originalRequest.headers) {
              // Update the request with new token and retry
              originalRequest.headers['X-CSRF-Token'] = newToken;
              return apiClient(originalRequest);
            }
          }

          if (isDev) console.error('[API] CSRF token refresh failed after retry');

          // Provide a user-friendly error message
          const csrfError: ApiError = new Error('Your session has expired. Please refresh the page and try again.') as ApiError;
          csrfError.status = 403;
          csrfError.data = data as Record<string, unknown>;
          return Promise.reject(csrfError);
        }
        // Forbidden access is handled by the error being thrown
      }
      // 404 and 500 errors are handled by the error being thrown

      // Return proper Error object for handling in components
      const apiError: ApiError = new Error(data?.message || data?.error || 'An error occurred') as ApiError;
      apiError.status = status;
      apiError.data = data as Record<string, unknown>;
      return Promise.reject(apiError);
    } else if (error.request) {
      // Request made but no response
      const networkError: ApiError = new Error('No response from server. Please check your connection.') as ApiError;
      networkError.status = 0;
      return Promise.reject(networkError);
    } else {
      // Something else happened
      const unexpectedError: ApiError = new Error(error.message || 'An unexpected error occurred') as ApiError;
      unexpectedError.status = 0;
      return Promise.reject(unexpectedError);
    }
  }
);

// Listen for auth state changes (login, logout, OAuth callbacks)
// and refresh CSRF token to ensure it matches the new session
if (typeof window !== 'undefined') {
  window.addEventListener('auth:updated', () => {
    clearCsrfToken();
    void refreshCsrfToken();
  });
}

export default apiClient;
