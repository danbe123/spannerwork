import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock the service and logger
vi.mock('../../src/services/request.service.js', () => ({
  requestService: {
    list: vi.fn(),
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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

import { RequestController } from '../../src/controllers/request.controller.js';
import { requestService } from '../../src/services/request.service.js';

describe('RequestController', () => {
  let controller: RequestController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new RequestController();
    
    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
    
    mockNext = vi.fn();
  });

  describe('list', () => {
    it('should return paginated requests', async () => {
      const mockResult = {
        data: [{ id: 'req-1' }, { id: 'req-2' }],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };
      vi.mocked(requestService.list).mockResolvedValue(mockResult);

      mockReq = { query: { page: '1', limit: '20' } };

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(requestService.list).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        category: undefined,
        urgency: undefined,
        status: undefined,
        postcode: undefined,
        radius: undefined,
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should apply filters from query params', async () => {
      vi.mocked(requestService.list).mockResolvedValue({ data: [], pagination: {} });

      mockReq = {
        query: {
          category: 'TOOLS',
          urgency: 'ASAP',
          status: 'ACTIVE',
          postcode: 'SW1A',
          radius: '10',
        },
      };

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(requestService.list).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'TOOLS',
          urgency: 'ASAP',
          status: 'ACTIVE',
          postcode: 'SW1A',
          radius: 10,
        })
      );
    });

    it('should call next on error', async () => {
      const error = new Error('Database error');
      vi.mocked(requestService.list).mockRejectedValue(error);

      mockReq = { query: {} };

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('create', () => {
    it('should create a request when authenticated', async () => {
      const mockRequest = { id: 'req-123', title: 'Need a drill' };
      vi.mocked(requestService.create).mockResolvedValue(mockRequest as any);

      mockReq = {
        user: { id: 'user-123', email: 'test@example.com' },
        body: { title: 'Need a drill', postcode: 'SW1A 1AA' },
      };

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(requestService.create).toHaveBeenCalledWith('user-123', mockReq.body);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Request created successfully',
        request: mockRequest,
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockReq = { body: {} };

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    });

    it('should return 400 for invalid postcode', async () => {
      vi.mocked(requestService.create).mockRejectedValue(new Error('Invalid postcode'));

      mockReq = {
        user: { id: 'user-123' },
        body: { postcode: 'INVALID' },
      };

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getById', () => {
    it('should return request when found', async () => {
      const mockRequest = { id: 'req-123', title: 'Test Request' };
      vi.mocked(requestService.getById).mockResolvedValue(mockRequest as any);

      mockReq = { params: { id: 'req-123' } };

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(requestService.getById).toHaveBeenCalledWith('req-123');
      expect(mockRes.json).toHaveBeenCalledWith({ request: mockRequest });
    });

    it('should return 404 when not found', async () => {
      vi.mocked(requestService.getById).mockResolvedValue(null);

      mockReq = { params: { id: 'non-existent' } };

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Request not found',
      });
    });
  });

  describe('update', () => {
    it('should update request when owner', async () => {
      const mockUpdated = { id: 'req-123', title: 'Updated' };
      vi.mocked(requestService.update).mockResolvedValue(mockUpdated as any);

      mockReq = {
        user: { id: 'user-123', email: 'test@example.com' },
        params: { id: 'req-123' },
        body: { title: 'Updated' },
      };

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(requestService.update).toHaveBeenCalledWith('req-123', 'user-123', { title: 'Updated' });
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Request updated successfully',
        request: mockUpdated,
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockReq = { params: { id: 'req-123' }, body: {} };

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 when request not found', async () => {
      vi.mocked(requestService.update).mockRejectedValue(new Error('Request not found'));

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'req-123' },
        body: {},
      };

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 when not owner', async () => {
      vi.mocked(requestService.update).mockRejectedValue(
        new Error('You do not have permission to update')
      );

      mockReq = {
        user: { id: 'other-user' },
        params: { id: 'req-123' },
        body: {},
      };

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('delete', () => {
    it('should delete request when owner', async () => {
      vi.mocked(requestService.delete).mockResolvedValue();

      mockReq = {
        user: { id: 'user-123', email: 'test@example.com' },
        params: { id: 'req-123' },
      };

      await controller.delete(mockReq as Request, mockRes as Response, mockNext);

      expect(requestService.delete).toHaveBeenCalledWith('req-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Request deleted successfully',
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockReq = { params: { id: 'req-123' } };

      await controller.delete(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 when not owner', async () => {
      vi.mocked(requestService.delete).mockRejectedValue(
        new Error('You do not have permission to delete')
      );

      mockReq = {
        user: { id: 'other-user' },
        params: { id: 'req-123' },
      };

      await controller.delete(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('cancel', () => {
    it('should cancel request when owner', async () => {
      const mockCancelled = { id: 'req-123', status: 'CANCELLED' };
      vi.mocked(requestService.cancel).mockResolvedValue(mockCancelled as any);

      mockReq = {
        user: { id: 'user-123', email: 'test@example.com' },
        params: { id: 'req-123' },
      };

      await controller.cancel(mockReq as Request, mockRes as Response, mockNext);

      expect(requestService.cancel).toHaveBeenCalledWith('req-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Request cancelled successfully',
        request: mockCancelled,
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockReq = { params: { id: 'req-123' } };

      await controller.cancel(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });
});
