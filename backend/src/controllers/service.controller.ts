import { Request, Response, NextFunction } from 'express';
import { serviceService } from '../services/service.service.js';
import { insuranceService } from '../services/insurance.service.js';
import { logger } from '../config/logger.js';

export class ServiceController {
  /**
   * List services with filters
   * GET /api/v1/services
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        page,
        limit,
        specialty,
        minHourlyRate,
        maxHourlyRate,
        postcode,
        radius,
      } = req.query;

      const result = await serviceService.list({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        specialty: specialty as string,
        minHourlyRate: minHourlyRate
          ? parseFloat(minHourlyRate as string)
          : undefined,
        maxHourlyRate: maxHourlyRate
          ? parseFloat(maxHourlyRate as string)
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
   * Create new service listing
   * POST /api/v1/services
   * 
   * Requires valid public liability insurance to list services.
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      // Check if provider has valid insurance before allowing service listing
      const hasValidInsurance = await insuranceService.hasValidInsurance(req.user.id);
      if (!hasValidInsurance) {
        return res.status(403).json({
          error: 'Insurance Required',
          message: 'You must have valid, approved public liability insurance to list services. Please upload your insurance certificate in your provider settings.',
          code: 'INSURANCE_REQUIRED',
        });
      }

      const service = await serviceService.create(req.user.id, req.body);

      logger.info(
        `Service listing created: ${service.id} by user ${req.user.id}`
      );

      return res.status(201).json({
        message: 'Service listing created successfully',
        service,
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
   * Get service by ID
   * GET /api/v1/services/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const service = await serviceService.getById(id);

      if (!service) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Service not found',
        });
      }

      return res.json({ service });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update service listing
   * PATCH /api/v1/services/:id
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

      const service = await serviceService.update(id, req.user.id, req.body);

      logger.info(`Service listing updated: ${id} by user ${req.user.id}`);

      return res.json({
        message: 'Service listing updated successfully',
        service,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Service not found') {
          return res.status(404).json({
            error: 'Not Found',
            message: error.message,
          });
        }
        if (
          error.message === 'You can only update your own services' ||
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
   * Delete service listing
   * DELETE /api/v1/services/:id
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

      await serviceService.delete(id, req.user.id);

      logger.info(`Service listing deleted: ${id} by user ${req.user.id}`);

      return res.json({
        message: 'Service listing deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Service not found') {
          return res.status(404).json({
            error: 'Not Found',
            message: error.message,
          });
        }
        if (
          error.message === 'You can only delete your own services' ||
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
   * Check service availability
   * GET /api/v1/services/:id/availability
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

      const availability = await serviceService.getAvailability(id, start, end);

      return res.json(availability);
    } catch (error) {
      return next(error);
    }
  }
}

export const serviceController = new ServiceController();
