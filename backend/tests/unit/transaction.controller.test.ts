import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock the service, logger, and errors
vi.mock('../../src/services/transaction.service.js', () => ({
  transactionService: {
    create: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    updateStatus: vi.fn(),
    complete: vi.fn(),
    cancel: vi.fn(),
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../src/utils/errors.js', () => ({
  BadRequestError: class extends Error { constructor(m: string) { super(m); this.name = 'BadRequestError'; } },
  NotFoundError: class extends Error { constructor(m: string) { super(m); this.name = 'NotFoundError'; } },
  ForbiddenError: class extends Error { constructor(m: string) { super(m); this.name = 'ForbiddenError'; } },
  ConflictError: class extends Error { constructor(m: string) { super(m); this.name = 'ConflictError'; } },
}));

import { TransactionController } from '../../src/controllers/transaction.controller.js';
import { transactionService } from '../../src/services/transaction.service.js';

describe('TransactionController', () => {
  let controller: TransactionController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new TransactionController();
    
    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('create', () => {
    it('should create a transaction for a tool', async () => {
      const mockTransaction = { id: 'trans-123', toolId: 'tool-456' };
      vi.mocked(transactionService.create).mockResolvedValue(mockTransaction as any);

      mockReq = {
        user: { id: 'user-123' },
        body: {
          toolId: 'tool-456',
          startDate: '2024-01-15',
          endDate: '2024-01-17',
          notes: 'Test booking',
        },
      };

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(transactionService.create).toHaveBeenCalledWith({
        userId: 'user-123',
        requestId: undefined,
        toolId: 'tool-456',
        spaceId: undefined,
        serviceId: undefined,
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        notes: 'Test booking',
        waiverAccepted: false,
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should call next with BadRequestError when no resource specified', async () => {
      mockReq = {
        user: { id: 'user-123' },
        body: {
          startDate: '2024-01-15',
          endDate: '2024-01-17',
        },
      };

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        name: 'BadRequestError',
      }));
    });

    it('should handle not found errors', async () => {
      vi.mocked(transactionService.create).mockRejectedValue(new Error('Tool not found'));

      mockReq = {
        user: { id: 'user-123' },
        body: { toolId: 'non-existent', startDate: '2024-01-15', endDate: '2024-01-17' },
      };

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        name: 'NotFoundError',
      }));
    });
  });

  describe('list', () => {
    it('should return user transactions', async () => {
      const mockResult = {
        transactions: [{ id: 'trans-1' }, { id: 'trans-2' }],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };
      vi.mocked(transactionService.list).mockResolvedValue(mockResult as any);

      mockReq = {
        user: { id: 'user-123' },
        query: { page: '1', limit: '20', status: 'COMPLETED' },
      };

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(transactionService.list).toHaveBeenCalledWith('user-123', {
        page: 1,
        limit: 20,
        status: 'COMPLETED',
        asProvider: false,
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should filter as provider', async () => {
      vi.mocked(transactionService.list).mockResolvedValue({ transactions: [] } as any);

      mockReq = {
        user: { id: 'user-123' },
        query: { asProvider: 'true' },
      };

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(transactionService.list).toHaveBeenCalledWith('user-123', expect.objectContaining({
        asProvider: true,
      }));
    });
  });

  describe('getById', () => {
    it('should return transaction when user is part of it', async () => {
      const mockTransaction = { id: 'trans-123', userId: 'user-123', providerId: 'provider-456' };
      vi.mocked(transactionService.getById).mockResolvedValue(mockTransaction as any);

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'trans-123' },
      };

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ transaction: mockTransaction });
    });

    it('should call next with ForbiddenError when not authorized', async () => {
      const mockTransaction = { id: 'trans-123', userId: 'other-user', providerId: 'provider-456' };
      vi.mocked(transactionService.getById).mockResolvedValue(mockTransaction as any);

      mockReq = {
        user: { id: 'unauthorized-user' },
        params: { id: 'trans-123' },
      };

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        name: 'ForbiddenError',
      }));
    });

    it('should call next with NotFoundError when not found', async () => {
      vi.mocked(transactionService.getById).mockRejectedValue(new Error('Transaction not found'));

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'non-existent' },
      };

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        name: 'NotFoundError',
      }));
    });
  });

  describe('updateStatus', () => {
    it('should update transaction status', async () => {
      const mockTransaction = { id: 'trans-123', status: 'CONFIRMED' };
      vi.mocked(transactionService.updateStatus).mockResolvedValue(mockTransaction as any);

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'trans-123' },
        body: { status: 'CONFIRMED' },
      };

      await controller.updateStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(transactionService.updateStatus).toHaveBeenCalledWith('trans-123', 'user-123', 'CONFIRMED');
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Transaction status updated',
        transaction: mockTransaction,
      });
    });

    it('should call next with error when service throws for invalid status', async () => {
      // Note: Status validation is handled by Zod middleware in routes.
      // Controller passes status to service, which may throw for invalid status.
      const serviceError = new Error('Invalid status');
      vi.mocked(transactionService.updateStatus).mockRejectedValue(serviceError);

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'trans-123' },
        body: { status: 'INVALID' },
      };

      await controller.updateStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(transactionService.updateStatus).toHaveBeenCalledWith('trans-123', 'user-123', 'INVALID');
      expect(mockNext).toHaveBeenCalledWith(serviceError);
    });
  });

  describe('complete', () => {
    it('should complete a transaction', async () => {
      const mockTransaction = { id: 'trans-123', status: 'COMPLETED' };
      vi.mocked(transactionService.complete).mockResolvedValue(mockTransaction as any);

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'trans-123' },
      };

      await controller.complete(mockReq as Request, mockRes as Response, mockNext);

      expect(transactionService.complete).toHaveBeenCalledWith('trans-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Transaction completed',
        transaction: mockTransaction,
      });
    });

    it('should handle not found errors', async () => {
      vi.mocked(transactionService.complete).mockRejectedValue(new Error('Transaction not found'));

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'non-existent' },
      };

      await controller.complete(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        name: 'NotFoundError',
      }));
    });
  });

  describe('cancel', () => {
    it('should cancel a transaction', async () => {
      const mockTransaction = { id: 'trans-123', status: 'CANCELLED' };
      vi.mocked(transactionService.cancel).mockResolvedValue(mockTransaction as any);

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'trans-123' },
      };

      await controller.cancel(mockReq as Request, mockRes as Response, mockNext);

      expect(transactionService.cancel).toHaveBeenCalledWith('trans-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Transaction cancelled',
        transaction: mockTransaction,
      });
    });

    it('should handle cannot cancel errors', async () => {
      vi.mocked(transactionService.cancel).mockRejectedValue(
        new Error('Cannot cancel completed transaction')
      );

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'trans-123' },
      };

      await controller.cancel(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        name: 'BadRequestError',
      }));
    });
  });
});
