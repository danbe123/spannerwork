import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

/**
 * Middleware to check if user has required role(s)
 * MUST be used after requireAuth middleware
 */
export function authorize(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
    }

    return next();
  };
}

/**
 * Shorthand for requiring admin role
 */
export const requireAdmin = authorize([Role.ADMIN]);

/**
 * Shorthand for requiring admin or moderator role
 */
export const requireModerator = authorize([Role.ADMIN, Role.MODERATOR]);

/**
 * Middleware to check if user is the owner of a resource
 * Expects resource ownerId to be attached to req.resourceOwnerId
 */
export function requireOwner(
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

  // Allow admins to access any resource
  if (req.user.role === Role.ADMIN) {
    return next();
  }

  // Check if user is the owner
  const resourceOwnerId = req.resourceOwnerId;

  if (!resourceOwnerId || resourceOwnerId !== req.user.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to access this resource',
    });
  }

  return next();
}
