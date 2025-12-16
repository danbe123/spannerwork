import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service.js';
import { logger } from '../config/logger.js';

export class UserController {
  /**
   * Get user profile by ID
   * GET /api/v1/users/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const user = await userService.getById(id, true);

      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
      }

      return res.json({ user });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update user profile
   * PATCH /api/v1/users/:id
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const { id } = req.params;

      // Users can only update their own profile
      if (req.user.id !== id && req.user.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only update your own profile',
        });
      }

      const user = await userService.update(id, req.body);

      logger.info(`User profile updated: ${id}`);

      // Remove sensitive data
      const { passwordHash: _passwordHash, ...userWithoutPassword } = user;

      return res.json({
        message: 'Profile updated successfully',
        user: userWithoutPassword,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid postcode')) {
          return res.status(400).json({
            error: 'Bad Request',
            message: error.message,
          });
        }

        if (error.message.includes('Username is already taken')) {
          return res.status(409).json({
            error: 'Conflict',
            message: error.message,
          });
        }
      }
      return next(error);
    }
  }

  /**
   * Get user's tools
   * GET /api/v1/users/:id/tools
   */
  async getUserTools(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const tools = await userService.getUserTools(id);

      return res.json({ tools });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get user's spaces
   * GET /api/v1/users/:id/spaces
   */
  async getUserSpaces(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const spaces = await userService.getUserSpaces(id);

      return res.json({ spaces });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get user's services
   * GET /api/v1/users/:id/services
   */
  async getUserServices(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const services = await userService.getUserServices(id);

      return res.json({ services });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get user's listings (tools, spaces, services)
   * GET /api/v1/users/:id/listings
   */
  async getUserListings(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const [tools, spaces, services] = await Promise.all([
        userService.getUserTools(id),
        userService.getUserSpaces(id),
        userService.getUserServices(id),
      ]);

      return res.json({ tools, spaces, services });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get user's reviews
   * GET /api/v1/users/:id/reviews
   */
  async getUserReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { page, limit } = req.query;

      const result = await userService.getUserReviews(
        id,
        page ? parseInt(page as string) : undefined,
        limit ? parseInt(limit as string) : undefined
      );

      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get user's transactions
   * GET /api/v1/users/:id/transactions
   */
  async getUserTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const { id } = req.params;

      // Users can only view their own transactions
      if (req.user.id !== id && req.user.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only view your own transactions',
        });
      }

      const { page, limit } = req.query;

      const result = await userService.getUserTransactions(
        id,
        page ? parseInt(page as string) : undefined,
        limit ? parseInt(limit as string) : undefined
      );

      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }
}

export const userController = new UserController();
