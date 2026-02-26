import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { COOKIE_NAMES, SESSION_COOKIE_CLEAR_OPTIONS } from '../config/cookie.js';
import { setContextUserId } from './requestId.middleware.js';
import { AccountStatus } from '@prisma/client';

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
      res.clearCookie(COOKIE_NAMES.SESSION, SESSION_COOKIE_CLEAR_OPTIONS);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired session',
      });
    }

    // Block deleted accounts from accessing authenticated endpoints
    if (user.accountStatus === AccountStatus.DELETED) {
      res.clearCookie(COOKIE_NAMES.SESSION, SESSION_COOKIE_CLEAR_OPTIONS);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Account no longer exists',
      });
    }

    // Block suspended accounts from accessing authenticated endpoints
    if (user.accountStatus === AccountStatus.SUSPENDED) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Your account has been suspended. Please contact support for assistance.',
        code: 'ACCOUNT_SUSPENDED',
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

// Re-export requireAdmin from authorize.middleware for convenience
export { requireAdmin } from './authorize.middleware.js';
