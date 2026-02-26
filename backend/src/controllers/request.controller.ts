import { Request, Response, NextFunction } from 'express';
import { requestService } from '../services/request.service.js';
import { activityFeedService } from '../services/activityFeed.service.js';
import { logger } from '../config/logger.js';

export class RequestController {
  /**
   * List requests with filters
   * GET /api/v1/requests
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, category, urgency, status, postcode, radius } =
        req.query;

      const result = await requestService.list({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        category: category as string,
        urgency: urgency as string,
        status: status as string,
        postcode: postcode as string,
        radius: radius ? parseInt(radius as string) : undefined,
      });

      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create a new request
   * POST /api/v1/requests
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const request = await requestService.create(req.user.id, req.body);

      logger.info(`Request created: ${request.id} by ${req.user.email}`);

      // Log activity for live feed
      activityFeedService.recordRequestPosted(
        req.user.id,
        request.id,
        request.category,
        request.locationAddress?.split(',')[0] // Extract postcode area
      ).catch(err => logger.error('Failed to record activity:', err));

      return res.status(201).json({
        message: 'Request created successfully',
        request,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid postcode')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: error.message,
        });
      }
      return next(error);
    }
  }

  /**
   * Get request by ID
   * GET /api/v1/requests/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      // Pass current user ID to check if they've already quoted on this request
      const currentUserId = req.user?.id;

      const request = await requestService.getById(id, currentUserId);

      if (!request) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Request not found',
        });
      }

      return res.json({ request });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update request
   * PATCH /api/v1/requests/:id
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
      const isAdmin = req.user.role === 'ADMIN';

      const request = await requestService.update(id, req.user.id, req.body, isAdmin);

      logger.info(`Request updated: ${id} by ${req.user.email}`);

      return res.json({
        message: 'Request updated successfully',
        request,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({
            error: 'Not Found',
            message: error.message,
          });
        }
        if (error.message.includes('permission')) {
          return res.status(403).json({
            error: 'Forbidden',
            message: error.message,
          });
        }
      }
      return next(error);
    }
  }

  /**
   * Delete request
   * DELETE /api/v1/requests/:id
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const { id } = req.params;
      const isAdmin = req.user.role === 'ADMIN';

      await requestService.delete(id, req.user.id, isAdmin);

      logger.info(`Request deleted: ${id} by ${req.user.email}`);

      return res.json({
        message: 'Request deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({
            error: 'Not Found',
            message: error.message,
          });
        }
        if (error.message.includes('permission')) {
          return res.status(403).json({
            error: 'Forbidden',
            message: error.message,
          });
        }
      }
      return next(error);
    }
  }

  /**
   * Cancel request
   * POST /api/v1/requests/:id/cancel
   */
  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const { id } = req.params;

      const request = await requestService.cancel(id, req.user.id);

      logger.info(`Request cancelled: ${id} by ${req.user.email}`);

      return res.json({
        message: 'Request cancelled successfully',
        request,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({
            error: 'Not Found',
            message: error.message,
          });
        }
        if (error.message.includes('permission')) {
          return res.status(403).json({
            error: 'Forbidden',
            message: error.message,
          });
        }
      }
      return next(error);
    }
  }

  /**
   * Mark request as complete
   * POST /api/v1/requests/:id/complete
   */
  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const { id } = req.params;
      const isAdmin = req.user.role === 'ADMIN';

      const request = await requestService.markComplete(id, req.user.id, isAdmin);

      logger.info(`Request marked complete: ${id} by ${req.user.email}`);

      return res.json({
        message: 'Request marked as complete',
        request,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({
            error: 'Not Found',
            message: error.message,
          });
        }
        if (error.message.includes('permission')) {
          return res.status(403).json({
            error: 'Forbidden',
            message: error.message,
          });
        }
        if (error.message.includes('Cannot complete')) {
          return res.status(409).json({
            error: 'Conflict',
            message: error.message,
          });
        }
      }
      return next(error);
    }
  }
}

export const requestController = new RequestController();
