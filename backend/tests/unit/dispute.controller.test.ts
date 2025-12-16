import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Mock the service and logger
vi.mock('../../src/services/dispute.service.js', () => ({
  disputeService: {
    create: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    resolve: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { DisputeController } from '../../src/controllers/dispute.controller.js';
import { disputeService } from '../../src/services/dispute.service.js';

describe('DisputeController', () => {
  let controller: DisputeController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new DisputeController();
    
    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
  });

  describe('create', () => {
    it('should create a dispute successfully', async () => {
      const mockDispute = { id: 'dispute-123', reason: 'Product damaged' };
      vi.mocked(disputeService.create).mockResolvedValue(mockDispute as any);

      mockReq = {
        user: { id: 'user-123' },
        body: {
          transactionId: 'trans-456',
          reason: 'Product damaged',
          description: 'The drill was broken',
        },
      };

      await controller.create(mockReq as Request, mockRes as Response);

      expect(disputeService.create).toHaveBeenCalledWith({
        initiatorId: 'user-123',
        transactionId: 'trans-456',
        reason: 'Product damaged',
        description: 'The drill was broken',
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should return 404 when transaction not found', async () => {
      vi.mocked(disputeService.create).mockRejectedValue(new Error('Transaction not found'));

      mockReq = {
        user: { id: 'user-123' },
        body: { transactionId: 'non-existent' },
      };

      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 for duplicate dispute', async () => {
      vi.mocked(disputeService.create).mockRejectedValue(
        new Error('Dispute already exists for this transaction')
      );

      mockReq = {
        user: { id: 'user-123' },
        body: { transactionId: 'trans-456' },
      };

      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('list', () => {
    it('should return user disputes', async () => {
      const mockResult = {
        disputes: [{ id: 'dispute-1' }, { id: 'dispute-2' }],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };
      vi.mocked(disputeService.list).mockResolvedValue(mockResult as any);

      mockReq = {
        user: { id: 'user-123' },
        query: { page: '1', limit: '20' },
      };

      await controller.list(mockReq as Request, mockRes as Response);

      expect(disputeService.list).toHaveBeenCalledWith({
        userId: 'user-123',
        status: undefined,
        page: 1,
        limit: 20,
        adminView: false,
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 500 on error', async () => {
      vi.mocked(disputeService.list).mockRejectedValue(new Error('Database error'));

      mockReq = {
        user: { id: 'user-123' },
        query: {},
      };

      await controller.list(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getById', () => {
    it('should return dispute when authorized', async () => {
      const mockDispute = { id: 'dispute-123', reason: 'Damaged' };
      vi.mocked(disputeService.getById).mockResolvedValue(mockDispute as any);

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'dispute-123' },
      };

      await controller.getById(mockReq as Request, mockRes as Response);

      expect(disputeService.getById).toHaveBeenCalledWith('dispute-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith({ dispute: mockDispute });
    });

    it('should return 404 when not found', async () => {
      vi.mocked(disputeService.getById).mockRejectedValue(new Error('Dispute not found'));

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'non-existent' },
      };

      await controller.getById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 when not authorized', async () => {
      vi.mocked(disputeService.getById).mockRejectedValue(
        new Error('Not authorized to view this dispute')
      );

      mockReq = {
        user: { id: 'other-user' },
        params: { id: 'dispute-123' },
      };

      await controller.getById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('resolve', () => {
    it('should resolve dispute successfully', async () => {
      const mockDispute = { id: 'dispute-123', status: 'RESOLVED' };
      vi.mocked(disputeService.resolve).mockResolvedValue(mockDispute as any);

      mockReq = {
        params: { id: 'dispute-123' },
        body: {
          resolution: 'Full refund to customer',
          refundAmountInitiator: 5000,
          refundAmountRespondent: 0,
        },
      };

      await controller.resolve(mockReq as Request, mockRes as Response);

      expect(disputeService.resolve).toHaveBeenCalledWith('dispute-123', {
        resolution: 'Full refund to customer',
        refundAmountInitiator: 5000,
        refundAmountRespondent: 0,
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Dispute resolved successfully',
        dispute: mockDispute,
      });
    });

    it('should return 404 when dispute not found', async () => {
      vi.mocked(disputeService.resolve).mockRejectedValue(new Error('Dispute not found'));

      mockReq = {
        params: { id: 'non-existent' },
        body: { resolution: 'test' },
      };

      await controller.resolve(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 when already resolved', async () => {
      vi.mocked(disputeService.resolve).mockRejectedValue(
        new Error('Dispute already resolved')
      );

      mockReq = {
        params: { id: 'dispute-123' },
        body: { resolution: 'test' },
      };

      await controller.resolve(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateStatus', () => {
    it('should update dispute status', async () => {
      const mockDispute = { id: 'dispute-123', status: 'UNDER_REVIEW' };
      vi.mocked(disputeService.updateStatus).mockResolvedValue(mockDispute as any);

      mockReq = {
        params: { id: 'dispute-123' },
        body: { status: 'UNDER_REVIEW' },
      };

      await controller.updateStatus(mockReq as Request, mockRes as Response);

      expect(disputeService.updateStatus).toHaveBeenCalledWith('dispute-123', 'UNDER_REVIEW');
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Dispute status updated',
        dispute: mockDispute,
      });
    });

    it('should return 400 for invalid status', async () => {
      mockReq = {
        params: { id: 'dispute-123' },
        body: { status: 'INVALID_STATUS' },
      };

      await controller.updateStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Invalid status',
      });
    });

    it('should return 404 when dispute not found', async () => {
      vi.mocked(disputeService.updateStatus).mockRejectedValue(new Error('Dispute not found'));

      mockReq = {
        params: { id: 'non-existent' },
        body: { status: 'CLOSED' },
      };

      await controller.updateStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});
