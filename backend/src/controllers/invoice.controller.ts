import { Request, Response, NextFunction } from 'express';
import { invoiceService } from '../services/invoice.service.js';
import { invoiceSettingsService } from '../services/invoiceSettings.service.js';
import { logger } from '../config/logger.js';

export class InvoiceController {
  /**
   * Get invoice settings
   * GET /api/v1/invoices/settings
   */
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const settings = await invoiceSettingsService.get(req.user.id);
      return res.json({ settings });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update invoice settings
   * PATCH /api/v1/invoices/settings
   */
  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const settings = await invoiceSettingsService.update(req.user.id, req.body);
      logger.info('Invoice settings updated', { userId: req.user.id });

      return res.json({
        message: 'Invoice settings updated successfully',
        settings,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * List user's invoices
   * GET /api/v1/invoices
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const { type, startDate, endDate, page, limit } = req.query;

      const filters: {
        type?: 'RENTER' | 'PROVIDER';
        startDate?: Date;
        endDate?: Date;
        page?: number;
        limit?: number;
      } = {};

      if (type === 'RENTER' || type === 'PROVIDER') {
        filters.type = type;
      }
      if (startDate && typeof startDate === 'string') {
        filters.startDate = new Date(startDate);
      }
      if (endDate && typeof endDate === 'string') {
        filters.endDate = new Date(endDate);
      }
      if (page) {
        filters.page = parseInt(page as string, 10);
      }
      if (limit) {
        filters.limit = parseInt(limit as string, 10);
      }

      const result = await invoiceService.getForUser(req.user.id, filters);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Download invoice PDF
   * GET /api/v1/invoices/:id/download
   */
  async download(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const { id } = req.params;
      const result = await invoiceService.download(req.user.id, id);

      if ('redirectUrl' in result) {
        return res.redirect(result.redirectUrl);
      }

      // Stream PDF directly
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.send(result.buffer);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Invoice not found',
          });
        }
        if (error.message.includes('not authorized')) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'You are not authorized to access this invoice',
          });
        }
      }
      return next(error);
    }
  }

  /**
   * Generate invoice for a transaction
   * POST /api/v1/invoices/transaction/:transactionId
   */
  async createForTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const { transactionId } = req.params;
      const { type, purchaseOrder } = req.body;

      if (!type || (type !== 'RENTER' && type !== 'PROVIDER')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invoice type must be RENTER or PROVIDER',
        });
      }

      const invoice = await invoiceService.createForTransaction(
        transactionId,
        type,
        req.user.id,
        purchaseOrder
      );

      logger.info('Invoice created', { invoiceId: invoice.id, transactionId });

      return res.status(201).json({
        message: 'Invoice created successfully',
        invoice,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({
            error: 'Not Found',
            message: error.message,
          });
        }
        if (error.message.includes('not authorized') || error.message.includes('not involved')) {
          return res.status(403).json({
            error: 'Forbidden',
            message: error.message,
          });
        }
        if (error.message.includes('already exists')) {
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
   * Export invoices to CSV
   * GET /api/v1/invoices/export/csv
   */
  async exportCsv(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const { startDate, endDate } = req.query;

      const dateRange: { startDate?: Date; endDate?: Date } = {};
      if (startDate && typeof startDate === 'string') {
        dateRange.startDate = new Date(startDate);
      }
      if (endDate && typeof endDate === 'string') {
        dateRange.endDate = new Date(endDate);
      }

      const csv = await invoiceService.exportCsv(req.user.id, dateRange);

      const filename = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get annual tax summary
   * GET /api/v1/invoices/tax-summary/:year
   */
  async getTaxSummary(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const year = parseInt(req.params.year, 10);

      if (isNaN(year) || year < 2020 || year > new Date().getFullYear() + 1) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid year',
        });
      }

      const summary = await invoiceService.getAnnualTaxSummary(req.user.id, year);
      return res.json({ summary });
    } catch (error) {
      return next(error);
    }
  }
}

export const invoiceController = new InvoiceController();
