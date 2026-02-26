import { Request, Response, NextFunction } from 'express';
import { toolService } from '../services/tool.service.js';
import { activityFeedService } from '../services/activityFeed.service.js';
import { logger } from '../config/logger.js';

export class ToolController {
  /**
   * List tools with filters
   * GET /api/v1/tools
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        page,
        limit,
        category,
        available,
        postcode,
        radius,
        minPrice,
        maxPrice,
      } = req.query;

      const result = await toolService.list({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        category: category as string,
        available: available === 'true' ? true : available === 'false' ? false : undefined,
        postcode: postcode as string,
        radius: radius ? parseInt(radius as string) : undefined,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
      });

      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create a new tool
   * POST /api/v1/tools
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const tool = await toolService.create(req.user.id, req.body);

      logger.info(`Tool created: ${tool.id} by ${req.user.email}`);

      // Log activity for live feed
      activityFeedService.recordListingCreated(
        req.user.id,
        'tool',
        tool.name,
        tool.postcode || undefined,
        tool.id
      ).catch(err => logger.error('Failed to record activity:', err));

      return res.status(201).json({
        message: 'Tool created successfully',
        tool,
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
   * Get tool by ID
   * GET /api/v1/tools/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const tool = await toolService.getById(id);

      if (!tool) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Tool not found',
        });
      }

      return res.json({ tool });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update tool
   * PATCH /api/v1/tools/:id
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

      const tool = await toolService.update(id, req.user.id, req.body);

      logger.info(`Tool updated: ${id} by ${req.user.email}`);

      return res.json({
        message: 'Tool updated successfully',
        tool,
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
   * Delete tool
   * DELETE /api/v1/tools/:id
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

      await toolService.delete(id, req.user.id);

      logger.info(`Tool deleted: ${id} by ${req.user.email}`);

      return res.json({
        message: 'Tool deleted successfully',
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
        if (error.message.includes('active bookings')) {
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
   * Check tool availability
   * GET /api/v1/tools/:id/availability
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

      const result = await toolService.getAvailability(
        id,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      return res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
      }
      return next(error);
    }
  }
}

export const toolController = new ToolController();
