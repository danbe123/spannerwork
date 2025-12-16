import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { COOKIE_NAMES } from '../config/cookie.js';
import { setContextUserId } from './requestId.middleware.js';

/**
 * Middleware to verify user authentication
 * Checks for session cookie and attaches user to request
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const sessionId = req.cookies?.[COOKIE_NAMES.SESSION];

    if (!sessionId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const user = await authService.getUserBySession(sessionId);

    if (!user) {
      // Clear invalid cookie
      res.clearCookie(COOKIE_NAMES.SESSION);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired session',
      });
    }

    // Attach user to request
    req.user = user;
    req.sessionId = sessionId;

    // Add user ID to request context for logging
    setContextUserId(user.id);

    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Middleware to check if user is authenticated (optional)
 * Doesn't return error if not authenticated, just doesn't attach user
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const sessionId = req.cookies?.[COOKIE_NAMES.SESSION];

    if (sessionId) {
      const user = await authService.getUserBySession(sessionId);
      if (user) {
        req.user = user;
        req.sessionId = sessionId;
        // Add user ID to request context for logging
        setContextUserId(user.id);
      }
    }

    return next();
  } catch {
    // Ignore errors in optional auth
    return next();
  }
}

/**
 * Middleware to check if email is verified
 */
export function requireEmailVerified(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  if (!req.user.emailVerified) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Email verification required',
    });
  }

  return next();
}

/**
 * @deprecated Use requireAdmin from authorize.middleware.ts instead
 * This export is kept for backwards compatibility and will be removed in v2.0.0.
 *
 * Middleware to check if user is an admin
 * Must be used after requireAuth
 */
export { requireAdmin } from './authorize.middleware.js';
