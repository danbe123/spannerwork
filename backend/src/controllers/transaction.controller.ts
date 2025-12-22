import { Request, Response, NextFunction } from 'express';
import { transactionService } from '../services/transaction.service.js';
import { logger } from '../config/logger.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';

export class TransactionController {
  /**
   * Create a new transaction
   * POST /api/v1/transactions
   * 
   * For service bookings, requires waiver acceptance (waiverAccepted: true).
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      // Note: rentalFee is calculated server-side based on listing rates
      const { requestId, toolId, spaceId, serviceId, startDate, endDate, notes, waiverAccepted } =
        req.body;

      // Ensure at least one resource is specified
      if (!requestId && !toolId && !spaceId && !serviceId) {
        throw new BadRequestError('Must specify at least one of: requestId, toolId, spaceId, or serviceId');
      }

      // Service bookings require waiver acceptance
      if (serviceId && !waiverAccepted) {
        throw new BadRequestError(
          'You must accept the liability waiver to book a service. ' +
          'By accepting, you acknowledge that the service provider is an independent contractor ' +
          'and SpannerWork is not liable for the quality or outcome of their work.'
        );
      }

      const transaction = await transactionService.create({
        userId,
        requestId,
        toolId,
        spaceId,
        serviceId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        notes,
        waiverAccepted: waiverAccepted ? true : false,
      });

      return res.status(201).json({
        message: 'Transaction created successfully',
        transaction,
      });
    } catch (error) {
      logger.error('Error creating transaction:', error);
      if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
        return next(new NotFoundError(error.message));
      }
      return next(error);
    }
  }

  /**
   * List user's transactions
   * GET /api/v1/transactions
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { page, limit, status, asProvider } = req.query;

      const result = await transactionService.list(userId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as string,
        asProvider: asProvider === 'true',
      });

      return res.json(result);
    } catch (error) {
      logger.error('Error listing transactions:', error);
      return next(error);
    }
  }

  /**
   * Get transaction by ID
   * GET /api/v1/transactions/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const transaction = await transactionService.getById(id);

      // Check if user is authorized to view this transaction
      if (transaction.userId !== userId && transaction.providerId !== userId) {
        throw new ForbiddenError('Not authorized to view this transaction');
      }

      return res.json({ transaction });
    } catch (error) {
      logger.error('Error getting transaction:', error);
      if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
        return next(new NotFoundError(error.message));
      }
      return next(error);
    }
  }

  /**
   * Update transaction status
   * PATCH /api/v1/transactions/:id/status
   */
  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { status } = req.body;

      // Status validation is handled by Zod middleware (updateTransactionStatusSchema)
      const transaction = await transactionService.updateStatus(id, userId, status);

      return res.json({
        message: 'Transaction status updated',
        transaction,
      });
    } catch (error) {
      logger.error('Error updating transaction status:', error);
      // Service throws typed errors (NotFoundError, ForbiddenError, ConflictError)
      return next(error);
    }
  }

  /**
   * Complete a transaction
   * POST /api/v1/transactions/:id/complete
   */
  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const transaction = await transactionService.complete(id, userId);

      return res.json({
        message: 'Transaction completed',
        transaction,
      });
    } catch (error) {
      logger.error('Error completing transaction:', error);
      if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
        return next(new NotFoundError(error.message));
      }
      return next(error);
    }
  }

  /**
   * Cancel a transaction
   * POST /api/v1/transactions/:id/cancel
   */
  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const transaction = await transactionService.cancel(id, userId);

      return res.json({
        message: 'Transaction cancelled',
        transaction,
      });
    } catch (error) {
      logger.error('Error cancelling transaction:', error);
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes('not found')) {
          return next(new NotFoundError(error.message));
        }
        if (message.includes('cannot cancel')) {
          return next(new BadRequestError(error.message));
        }
      }
      return next(error);
    }
  }

  /**
   * Update transaction add-ons (insurance selections)
   * PATCH /api/v1/transactions/:id/add-ons
   */
  async updateAddOns(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const {
        insuranceDamageProtectionSelected,
        insuranceLiabilitySelected,
        insuranceCancellationSelected,
      } = req.body;

      const transaction = await transactionService.updateAddOns({
        transactionId: id,
        userId,
        insuranceDamageProtectionSelected,
        insuranceLiabilitySelected,
        insuranceCancellationSelected,
      });

      return res.json({
        message: 'Transaction add-ons updated',
        transaction,
      });
    } catch (error) {
      logger.error('Error updating transaction add-ons:', error);
      return next(error);
    }
  }
}

export const transactionController = new TransactionController();
