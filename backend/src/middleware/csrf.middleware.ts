import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import env from '../config/env.js';
import { logger } from '../config/logger.js';
import { COOKIE_NAMES } from '../config/cookie.js';

import crypto from 'crypto';

/**
 * Generate a unique session identifier for CSRF protection.
 * 
 * IMPORTANT: This must return the SAME identifier for both:
 * 1. When generating a token (GET /csrf-token)
 * 2. When validating a token (POST to protected route)
 * 
 * We use the session cookie directly (not req.sessionId which is only set by auth middleware)
 * to ensure consistency. Falls back to IP+UserAgent hash for unauthenticated users.
 */
function getSecureSessionIdentifier(req: Request): string {
  // Check session cookie directly - this is set by login and persists across requests
  // Use the correct cookie name from config (different in dev vs prod)
  const sessionCookie = req.cookies?.[COOKIE_NAMES.SESSION];
  if (sessionCookie) {
    return sessionCookie;
  }
  
  // Also check req.sessionId (set by auth middleware) as fallback
  if (req.sessionId) {
    return req.sessionId;
  }
  
  // For unauthenticated users, create a fingerprint from IP + User-Agent
  // This ensures each client gets a unique CSRF context
  const ip = req.ip || req.socket?.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';
  const fingerprint = `${ip}:${userAgent}`;
  
  // Hash the fingerprint to create a consistent identifier
  return crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 32);
}

const {
  doubleCsrfProtection,
  generateToken: doubleCsrfGenerateToken,
  validateRequest: validateCsrfRequest,
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
 * Always validates tokens in all environments for security consistency
 */
export async function verifyCsrfToken(req: Request, _res: Response, next: NextFunction) {
  return doubleCsrfProtection(req, _res, next);
}

/**
 * Optional CSRF verification - logs but doesn't block
 * Use for gradual rollout or non-critical endpoints
 */
export async function optionalCsrfToken(req: Request, _res: Response, next: NextFunction) {
  try {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
      return next();
    }
    const isValid = validateCsrfRequest(req);
    if (!isValid) {
      logger.info(`Optional CSRF: Invalid or missing token for ${req.method} ${req.path}`);
    }

    return next();
  } catch (error) {
    logger.error('Optional CSRF verification error:', error);
    return next();
  }
}
