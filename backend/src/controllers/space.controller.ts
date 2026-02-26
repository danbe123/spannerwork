import { Request, Response, NextFunction } from 'express';
import { spaceService } from '../services/space.service.js';
import { activityFeedService } from '../services/activityFeed.service.js';
import { logger } from '../config/logger.js';

export class SpaceController {
  /**
   * List spaces with filters
   * GET /api/v1/spaces
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        page,
        limit,
        minHourlyRate,
        maxHourlyRate,
        minDailyRate,
        maxDailyRate,
        minSize,
        features,
        postcode,
        radius,
      } = req.query;

      const result = await spaceService.list({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        minHourlyRate: minHourlyRate
          ? parseFloat(minHourlyRate as string)
          : undefined,
        maxHourlyRate: maxHourlyRate
          ? parseFloat(maxHourlyRate as string)
          : undefined,
        minDailyRate: minDailyRate
          ? parseFloat(minDailyRate as string)
          : undefined,
        maxDailyRate: maxDailyRate
          ? parseFloat(maxDailyRate as string)
          : undefined,
        minSize: minSize ? parseInt(minSize as string) : undefined,
        features: features
          ? (features as string).split(',').map((f) => f.trim())
          : undefined,
        postcode: postcode as string,
        radius: radius ? parseFloat(radius as string) : undefined,
      });

      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create new space listing
   * POST /api/v1/spaces
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const space = await spaceService.create(req.user.id, req.body);

      logger.info(`Space listing created: ${space.id} by user ${req.user.id}`);

      // Log activity for live feed
      activityFeedService.recordListingCreated(
        req.user.id,
        'space',
        space.name,
        space.postcode || undefined,
        space.id
      ).catch(err => logger.error('Failed to record activity:', err));

      return res.status(201).json({
        message: 'Space listing created successfully',
        space,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Invalid postcode')
      ) {
        return res.status(400).json({
          error: 'Bad Request',
          message: error.message,
        });
      }
      return next(error);
    }
  }

  /**
   * Get space by ID
   * GET /api/v1/spaces/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const space = await spaceService.getById(id);

      if (!space) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Space not found',
        });
      }

      return res.json({ space });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update space listing
   * PATCH /api/v1/spaces/:id
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

      const space = await spaceService.update(id, req.user.id, req.body);

      logger.info(`Space listing updated: ${id} by user ${req.user.id}`);

      return res.json({
        message: 'Space listing updated successfully',
        space,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Space not found') {
          return res.status(404).json({
            error: 'Not Found',
            message: error.message,
          });
        }
        if (
          error.message === 'You can only update your own spaces' ||
          error.message.includes('Invalid postcode')
        ) {
          return res.status(400).json({
            error: 'Bad Request',
            message: error.message,
          });
        }
      }
      return next(error);
    }
  }

  /**
   * Delete space listing
   * DELETE /api/v1/spaces/:id
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

      await spaceService.delete(id, req.user.id);

      logger.info(`Space listing deleted: ${id} by user ${req.user.id}`);

      return res.json({
        message: 'Space listing deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Space not found') {
          return res.status(404).json({
            error: 'Not Found',
            message: error.message,
          });
        }
        if (
          error.message === 'You can only delete your own spaces' ||
          error.message.includes('active or pending bookings')
        ) {
          return res.status(400).json({
            error: 'Bad Request',
            message: error.message,
          });
        }
      }
      return next(error);
    }
  }

  /**
   * Check space availability
   * GET /api/v1/spaces/:id/availability
   */
  async checkAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'startDate and endDate are required',
        });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid date format',
        });
      }

      if (start >= end) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'startDate must be before endDate',
        });
      }

      const availability = await spaceService.getAvailability(id, start, end);

      return res.json(availability);
    } catch (error) {
      return next(error);
    }
  }
}

export const spaceController = new SpaceController();
