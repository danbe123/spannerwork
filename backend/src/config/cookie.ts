/**
 * Standardized Cookie Configuration
 * 
 * Centralized cookie settings for consistency across all auth operations.
 * Cookie expiry is aligned with SESSION_EXPIRY_DAYS from environment.
 */

import { CookieOptions } from 'express';
import { env } from './env.js';

/**
 * Session expiry in days (aligned with auth.service.ts)
 */
const SESSION_EXPIRY_DAYS = parseInt(env.SESSION_EXPIRY_DAYS || '30', 10);

/**
 * Session cookie configuration
 * Used for authentication cookies (sessionId)
 * Note: maxAge is aligned with SESSION_EXPIRY_DAYS to prevent cookie/session mismatch
 * 
 * Security: Uses 'strict' sameSite in production to prevent CSRF attacks.
 * In development, 'lax' is used to allow easier testing with navigation.
 */
export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax', // Use 'lax' in dev, not false
  maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000, // Aligned with session expiry
  path: '/',
  // Don't set domain in development - let browser handle it
  // Setting domain: 'localhost' can cause issues with 127.0.0.1 access
  ...(env.NODE_ENV === 'production' ? {} : {}),
};

/**
 * Get session cookie options
 * Can optionally extend the session duration
 */
export function getSessionCookieOptions(extendSession = false): CookieOptions {
  return {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: extendSession 
      ? 60 * 24 * 60 * 60 * 1000  // 60 days for "remember me" (2x normal)
      : SESSION_COOKIE_OPTIONS.maxAge,
  };
}

/**
 * Cookie name constants
 * Uses __Host- prefix in production for enhanced security (requires Secure, no Domain, Path=/)
 */
export const COOKIE_NAMES = {
  SESSION: env.NODE_ENV === 'production' ? '__Host-spannerwork.session' : 'sessionId',
  CSRF: '_csrf',
} as const;
