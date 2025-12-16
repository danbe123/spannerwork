import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock the service and logger
vi.mock('../../src/services/space.service.js', () => ({
  spaceService: {
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

import { SpaceController } from '../../src/controllers/space.controller.js';
import { spaceService } from '../../src/services/space.service.js';

describe('SpaceController', () => {
  let controller: SpaceController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new SpaceController();
    
    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('list', () => {
    it('should return paginated spaces', async () => {
      const mockResult = {
        data: [{ id: 'space-1' }, { id: 'space-2' }],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };
      vi.mocked(spaceService.list).mockResolvedValue(mockResult as any);

      mockReq = { query: { page: '1', limit: '20' } };

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(spaceService.list).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should apply rate filters', async () => {
      vi.mocked(spaceService.list).mockResolvedValue({ data: [], pagination: {} } as any);

      mockReq = {
        query: {
          minHourlyRate: '1000',
          maxHourlyRate: '5000',
          minDailyRate: '5000',
          maxDailyRate: '20000',
        },
      };

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(spaceService.list).toHaveBeenCalledWith(
        expect.objectContaining({
          minHourlyRate: 1000,
          maxHourlyRate: 5000,
          minDailyRate: 5000,
          maxDailyRate: 20000,
        })
      );
    });

    it('should apply feature and size filters', async () => {
      vi.mocked(spaceService.list).mockResolvedValue({ data: [], pagination: {} } as any);

      mockReq = {
        query: {
          minSize: '50',
          features: 'WIFI,PARKING',
        },
      };

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(spaceService.list).toHaveBeenCalledWith(
        expect.objectContaining({
          minSize: 50,
          features: ['WIFI', 'PARKING'],
        })
      );
    });

    it('should call next on error', async () => {
      const error = new Error('Database error');
      vi.mocked(spaceService.list).mockRejectedValue(error);

      mockReq = { query: {} };

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('create', () => {
    it('should create a space when authenticated', async () => {
      const mockSpace = { id: 'space-123', name: 'Workshop' };
      vi.mocked(spaceService.create).mockResolvedValue(mockSpace as any);

      mockReq = {
        user: { id: 'user-123', email: 'test@example.com' },
        body: { name: 'Workshop', postcode: 'M1 1AA' },
      };

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(spaceService.create).toHaveBeenCalledWith('user-123', mockReq.body);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should return 401 when not authenticated', async () => {
      mockReq = { body: {} };

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 for invalid postcode', async () => {
      vi.mocked(spaceService.create).mockRejectedValue(new Error('Invalid postcode'));

      mockReq = {
        user: { id: 'user-123' },
        body: { postcode: 'INVALID' },
      };

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getById', () => {
    it('should return space when found', async () => {
      const mockSpace = { id: 'space-123', name: 'Test Space' };
      vi.mocked(spaceService.getById).mockResolvedValue(mockSpace as any);

      mockReq = { params: { id: 'space-123' } };

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(spaceService.getById).toHaveBeenCalledWith('space-123');
      expect(mockRes.json).toHaveBeenCalledWith({ space: mockSpace });
    });

    it('should return 404 when not found', async () => {
      vi.mocked(spaceService.getById).mockResolvedValue(null);

      mockReq = { params: { id: 'non-existent' } };

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('update', () => {
    it('should update space when owner', async () => {
      const mockUpdated = { id: 'space-123', name: 'Updated' };
      vi.mocked(spaceService.update).mockResolvedValue(mockUpdated as any);

      mockReq = {
        user: { id: 'user-123', email: 'test@example.com' },
        params: { id: 'space-123' },
        body: { name: 'Updated' },
      };

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(spaceService.update).toHaveBeenCalledWith('space-123', 'user-123', { name: 'Updated' });
    });

    it('should return 401 when not authenticated', async () => {
      mockReq = { params: { id: 'space-123' }, body: {} };

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 when space not found', async () => {
      vi.mocked(spaceService.update).mockRejectedValue(new Error('Space not found'));

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'space-123' },
        body: {},
      };

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 when not owner', async () => {
      vi.mocked(spaceService.update).mockRejectedValue(
        new Error('You can only update your own spaces')
      );

      mockReq = {
        user: { id: 'other-user' },
        params: { id: 'space-123' },
        body: {},
      };

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('delete', () => {
    it('should delete space when owner', async () => {
      vi.mocked(spaceService.delete).mockResolvedValue();

      mockReq = {
        user: { id: 'user-123', email: 'test@example.com' },
        params: { id: 'space-123' },
      };

      await controller.delete(mockReq as Request, mockRes as Response, mockNext);

      expect(spaceService.delete).toHaveBeenCalledWith('space-123', 'user-123');
    });

    it('should return 401 when not authenticated', async () => {
      mockReq = { params: { id: 'space-123' } };

      await controller.delete(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 when active bookings exist', async () => {
      vi.mocked(spaceService.delete).mockRejectedValue(
        new Error('Cannot delete space with active or pending bookings')
      );

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'space-123' },
      };

      await controller.delete(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});
