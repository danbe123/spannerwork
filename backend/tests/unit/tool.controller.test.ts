import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock the service and logger
vi.mock('../../src/services/tool.service.js', () => ({
  toolService: {
    list: vi.fn(),
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { ToolController } from '../../src/controllers/tool.controller.js';
import { toolService } from '../../src/services/tool.service.js';

describe('ToolController', () => {
  let controller: ToolController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ToolController();
    
    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('list', () => {
    it('should return paginated tools', async () => {
      const mockResult = {
        data: [{ id: 'tool-1' }, { id: 'tool-2' }],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };
      vi.mocked(toolService.list).mockResolvedValue(mockResult as any);

      mockReq = { query: { page: '1', limit: '20' } };

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(toolService.list).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should apply category filter', async () => {
      vi.mocked(toolService.list).mockResolvedValue({ data: [], pagination: {} } as any);

      mockReq = { query: { category: 'POWER_TOOLS' } };

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(toolService.list).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'POWER_TOOLS',
        })
      );
    });

    it('should apply price filters', async () => {
      vi.mocked(toolService.list).mockResolvedValue({ data: [], pagination: {} } as any);

      mockReq = {
        query: {
          minPrice: '500',
          maxPrice: '2000',
        },
      };

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(toolService.list).toHaveBeenCalledWith(
        expect.objectContaining({
          minPrice: 500,
          maxPrice: 2000,
        })
      );
    });

    it('should call next on error', async () => {
      const error = new Error('Database error');
      vi.mocked(toolService.list).mockRejectedValue(error);

      mockReq = { query: {} };

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('create', () => {
    it('should create a tool when authenticated', async () => {
      const mockTool = { id: 'tool-123', name: 'Power Drill' };
      vi.mocked(toolService.create).mockResolvedValue(mockTool as any);

      mockReq = {
        user: { id: 'user-123', email: 'test@example.com' },
        body: { name: 'Power Drill', postcode: 'SW1A 1AA' },
      };

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(toolService.create).toHaveBeenCalledWith('user-123', mockReq.body);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should return 401 when not authenticated', async () => {
      mockReq = { body: {} };

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 for invalid postcode', async () => {
      vi.mocked(toolService.create).mockRejectedValue(new Error('Invalid postcode'));

      mockReq = {
        user: { id: 'user-123' },
        body: { postcode: 'INVALID' },
      };

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getById', () => {
    it('should return tool when found', async () => {
      const mockTool = { id: 'tool-123', name: 'Test Tool' };
      vi.mocked(toolService.getById).mockResolvedValue(mockTool as any);

      mockReq = { params: { id: 'tool-123' } };

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(toolService.getById).toHaveBeenCalledWith('tool-123');
      expect(mockRes.json).toHaveBeenCalledWith({ tool: mockTool });
    });

    it('should return 404 when not found', async () => {
      vi.mocked(toolService.getById).mockResolvedValue(null);

      mockReq = { params: { id: 'non-existent' } };

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('update', () => {
    it('should update tool when owner', async () => {
      const mockUpdated = { id: 'tool-123', name: 'Updated Tool' };
      vi.mocked(toolService.update).mockResolvedValue(mockUpdated as any);

      mockReq = {
        user: { id: 'user-123', email: 'test@example.com' },
        params: { id: 'tool-123' },
        body: { name: 'Updated Tool' },
      };

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(toolService.update).toHaveBeenCalledWith('tool-123', 'user-123', { name: 'Updated Tool' });
    });

    it('should return 401 when not authenticated', async () => {
      mockReq = { params: { id: 'tool-123' }, body: {} };

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 when tool not found', async () => {
      vi.mocked(toolService.update).mockRejectedValue(new Error('Tool not found'));

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'tool-123' },
        body: {},
      };

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 when not owner', async () => {
      vi.mocked(toolService.update).mockRejectedValue(
        new Error('You do not have permission to update this tool')
      );

      mockReq = {
        user: { id: 'other-user' },
        params: { id: 'tool-123' },
        body: {},
      };

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('delete', () => {
    it('should delete tool when owner', async () => {
      vi.mocked(toolService.delete).mockResolvedValue();

      mockReq = {
        user: { id: 'user-123', email: 'test@example.com' },
        params: { id: 'tool-123' },
      };

      await controller.delete(mockReq as Request, mockRes as Response, mockNext);

      expect(toolService.delete).toHaveBeenCalledWith('tool-123', 'user-123');
    });

    it('should return 401 when not authenticated', async () => {
      mockReq = { params: { id: 'tool-123' } };

      await controller.delete(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 409 when active bookings exist', async () => {
      vi.mocked(toolService.delete).mockRejectedValue(
        new Error('Cannot delete tool with active bookings')
      );

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'tool-123' },
      };

      await controller.delete(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
    });
  });
});
