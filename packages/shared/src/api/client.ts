/**
 * Platform-agnostic API Client for SpannerWork
 * Can be used in both web and React Native environments
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

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
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'],
};

// Client configuration
export interface ApiClientConfig {
  baseUrl: string;
  isDev?: boolean;
  onUnauthorized?: (status: number, data: unknown) => void;
  getCsrfToken?: () => Promise<string | null>;
  refreshCsrfToken?: () => Promise<string | null>;
  generateRequestId?: () => string;
}

// API Error type
export interface ApiError extends Error {
  status: number;
  data?: Record<string, unknown>;
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoffDelay(retryCount: number): number {
  const exponentialDelay = RETRY_CONFIG.baseDelayMs * Math.pow(2, retryCount);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelayMs);
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

  return RETRY_CONFIG.retryableStatuses.includes(error.response.status);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Default request ID generator
 */
function defaultGenerateRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create an API client instance
 */
export function createApiClient(config: ApiClientConfig): AxiosInstance {
  const {
    baseUrl,
    isDev = false,
    onUnauthorized,
    getCsrfToken,
    refreshCsrfToken,
    generateRequestId = defaultGenerateRequestId,
  } = config;

  const client: AxiosInstance = axios.create({
    baseURL: baseUrl,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor
  client.interceptors.request.use(
    async (requestConfig: InternalAxiosRequestConfig) => {
      if (!requestConfig.headers) {
        requestConfig.headers = {} as typeof requestConfig.headers;
      }

      // Add request ID for tracing
      requestConfig.headers['X-Request-ID'] = generateRequestId();

      // Add CSRF token for mutating requests
      const method = (requestConfig.method || '').toUpperCase();
      const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

      if (needsCsrf && getCsrfToken) {
        if (!requestConfig.headers['X-CSRF-Token']) {
          const token = await getCsrfToken();
          if (token) {
            requestConfig.headers['X-CSRF-Token'] = token;
          }
        }
      }

      return requestConfig;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<{ message?: string; error?: string; code?: string }>) => {
      const originalRequest = error.config as ExtendedAxiosRequestConfig;

      // Retry with exponential backoff for transient errors
      if (originalRequest && isRetryable(originalRequest, error)) {
        originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
        const delay = calculateBackoffDelay(originalRequest._retryCount - 1);
        
        if (isDev) {
          console.warn(`[API] Retrying request (attempt ${originalRequest._retryCount}/${RETRY_CONFIG.maxRetries}) after ${Math.round(delay)}ms`);
        }
        
        await sleep(delay);
        return client(originalRequest);
      }

      if (error.response) {
        const { status, data } = error.response;

        // Handle 401 Unauthorized
        if (status === 401) {
          if (isDev) console.warn('[API] Unauthorized access');
          onUnauthorized?.(status, data);
        }

        // Handle CSRF token errors (403 with EBADCSRFTOKEN)
        if (status === 403 && data?.code === 'EBADCSRFTOKEN' && refreshCsrfToken) {
          originalRequest._csrfRetryCount = originalRequest._csrfRetryCount || 0;

          if (originalRequest._csrfRetryCount < 1) {
            originalRequest._csrfRetryCount += 1;
            if (isDev) console.warn('[API] Invalid CSRF token, refreshing...');
            
            const newToken = await refreshCsrfToken();
            
            if (newToken && originalRequest.headers) {
              originalRequest.headers['X-CSRF-Token'] = newToken;
              return client(originalRequest);
            }
          }
        }

        const apiError: ApiError = new Error(data?.message || 'An error occurred') as ApiError;
        apiError.status = status;
        apiError.data = data as Record<string, unknown>;
        return Promise.reject(apiError);
      } else if (error.request) {
        const networkError: ApiError = new Error('No response from server. Please check your connection.') as ApiError;
        networkError.status = 0;
        return Promise.reject(networkError);
      } else {
        const unexpectedError: ApiError = new Error(error.message || 'An unexpected error occurred') as ApiError;
        unexpectedError.status = 0;
        return Promise.reject(unexpectedError);
      }
    }
  );

  return client;
}

/**
 * Create CSRF token manager
 */
export function createCsrfManager(baseUrl: string) {
  const csrfClient = axios.create({
    baseURL: baseUrl,
    withCredentials: true,
  });

  let csrfToken: string | null = null;
  let csrfTokenTimestamp: number | null = null;
  const CSRF_TOKEN_MAX_AGE = 10 * 60 * 1000; // 10 minutes

  function isCsrfTokenStale(): boolean {
    if (!csrfToken || !csrfTokenTimestamp) return true;
    return Date.now() - csrfTokenTimestamp > CSRF_TOKEN_MAX_AGE;
  }

  async function refreshToken(): Promise<string | null> {
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

  async function getToken(): Promise<string | null> {
    if (!isCsrfTokenStale()) return csrfToken;
    return refreshToken();
  }

  function clearToken(): void {
    csrfToken = null;
    csrfTokenTimestamp = null;
  }

  return {
    getToken,
    refreshToken,
    clearToken,
  };
}

export default createApiClient;
