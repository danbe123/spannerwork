import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import env from '../config/env.js';
import { logger } from '../config/logger.js';
import { COOKIE_NAMES } from '../config/cookie.js';
import { securityEventService } from '../services/securityEvent.service.js';

import crypto from 'crypto';

/**
 * Anonymous session cookie name for unauthenticated CSRF protection
 * Uses __Host- prefix in production for enhanced security
 */
const ANON_SESSION_COOKIE = env.NODE_ENV === 'production'
  ? '__Host-spannerwork.anon'
  : 'spannerwork.anon';

/**
 * Generate a cryptographically secure anonymous session ID
 */
function generateAnonSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a unique session identifier for CSRF protection.
 *
 * IMPORTANT: This must return the SAME identifier for both:
 * 1. When generating a token (GET /csrf-token)
 * 2. When validating a token (POST to protected route)
 *
 * Priority:
 * 1. Authenticated session cookie (most secure)
 * 2. Anonymous session cookie (persists for unauthenticated users)
 * 3. Fingerprint hash as last resort (less reliable but consistent within request)
 */
function getSecureSessionIdentifier(req: Request): string {
  const sessionCookieName = COOKIE_NAMES.SESSION;
  const sessionCookie = req.cookies?.[sessionCookieName];
  const anonCookie = req.cookies?.[ANON_SESSION_COOKIE];

  // Check authenticated session cookie first
  if (sessionCookie) {
    return sessionCookie;
  }

  // Check req.sessionId (set by auth middleware) as fallback
  if (req.sessionId) {
    return req.sessionId;
  }

  // Check for anonymous session cookie (for unauthenticated users)
  if (anonCookie) {
    return anonCookie;
  }

  // Last resort: create fingerprint from multiple headers for better uniqueness
  // This is only used if cookies aren't available yet
  const ip = req.ip || req.socket?.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';
  const acceptLang = req.headers['accept-language'] || '';
  const acceptEnc = req.headers['accept-encoding'] || '';
  const fingerprint = `${ip}:${userAgent}:${acceptLang}:${acceptEnc}`;

  return crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 32);
}

/**
 * Middleware to set anonymous session cookie for unauthenticated users
 * This provides a stable CSRF identifier without relying on IP/headers
 */
export function ensureAnonSession(req: Request, res: Response, next: NextFunction): void {
  // Skip if user is authenticated
  if (req.cookies?.[COOKIE_NAMES.SESSION]) {
    return next();
  }

  // Skip if anonymous session already exists
  if (req.cookies?.[ANON_SESSION_COOKIE]) {
    return next();
  }

  // Set anonymous session cookie
  const anonSessionId = generateAnonSessionId();
  res.cookie(ANON_SESSION_COOKIE, anonSessionId, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours - short-lived for anonymous
    path: '/',
  });

  // Make it available for this request
  req.cookies = req.cookies || {};
  req.cookies[ANON_SESSION_COOKIE] = anonSessionId;

  next();
}

const {
  doubleCsrfProtection,
  generateToken: doubleCsrfGenerateToken,
} = doubleCsrf({
  getSecret: () => env.CSRF_SECRET,
  getSessionIdentifier: getSecureSessionIdentifier,
  cookieName: COOKIE_NAMES.CSRF,
  cookieOptions: {
    // Match session cookie sameSite settings for consistency:
    // - 'lax' in development allows easier testing with navigation
    // - 'strict' in production for maximum CSRF protection
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
  },
  getTokenFromRequest: (req: Request) =>
    (req.headers['x-csrf-token'] as string | undefined) ?? '',
});

export const csrfProtection = doubleCsrfProtection;

/**
 * CSRF Token Middleware
 * Protects against Cross-Site Request Forgery attacks
 */

/**
 * Generate a new CSRF token for the session
 */
export async function generateCsrfToken(req: Request, res: Response, next: NextFunction) {
  try {
    const csrfToken = doubleCsrfGenerateToken(req, res);
    res.locals.csrfToken = csrfToken;
    return next();
  } catch (error) {
    logger.error('CSRF token generation error:', error);
    return next(error);
  }
}

/**
 * Get CSRF token endpoint handler
 * Always uses real tokens in all environments for security consistency
 *
 * IMPORTANT: We pass overwrite=true to force regeneration of the token.
 * This is necessary because when a user logs in/out, their session identifier
 * changes, but the old CSRF cookie may still be present. Without overwrite,
 * the library tries to validate the old cookie with the new session, fails,
 * and throws an error.
 */
export async function getCsrfToken(req: Request, res: Response) {
  try {
    // overwrite=true forces a new token even if an old cookie exists
    // This handles session changes (login/logout) gracefully
    const csrfToken = doubleCsrfGenerateToken(req, res, true);

    // CRITICAL: Prevent any caching of CSRF tokens
    // This ensures fresh tokens are always generated, preventing stale token issues
    // after session changes (login/logout)
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
    });

    return res.status(200).json({
      success: true,
      csrfToken,
    });
  } catch (error) {
    logger.error('Get CSRF token error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate CSRF token',
    });
  }
}

/**
 * Verify CSRF token for state-changing requests
 * Always validates tokens - CSRF protection cannot be disabled
 * Logs security events on CSRF violations
 */
export async function verifyCsrfToken(req: Request, res: Response, next: NextFunction) {
  return doubleCsrfProtection(req, res, (err?: unknown) => {
    if (err) {
      // Log CSRF failures as warnings for security monitoring
      logger.warn('CSRF Verification Failed', {
        method: req.method,
        path: req.path,
        error: err instanceof Error ? err.message : String(err),
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // Log CSRF violation as security event with proper error handling
      // We use .then().catch() instead of void to ensure errors are logged
      securityEventService.logCsrfViolation(
        req.ip || 'unknown',
        req.originalUrl,
        req.method,
        req.get('User-Agent')
      ).catch((logError) => {
        // Log but don't fail - security event logging is best-effort
        logger.error('Failed to log CSRF security event', {
          error: logError instanceof Error ? logError.message : String(logError),
          originalPath: req.originalUrl,
        });
      });
    }
    next(err as Error | undefined);
  });
}

