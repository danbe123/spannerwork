import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock the service and logger
vi.mock('../../src/services/user.service.js', () => ({
  userService: {
    getById: vi.fn(),
    update: vi.fn(),
    getUserTools: vi.fn(),
    getUserSpaces: vi.fn(),
    getUserServices: vi.fn(),
    getUserReviews: vi.fn(),
    getUserTransactions: vi.fn(),
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { UserController } from '../../src/controllers/user.controller.js';
import { userService } from '../../src/services/user.service.js';

describe('UserController', () => {
  let controller: UserController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new UserController();
    
    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('getById', () => {
    it('should return user when found', async () => {
      const mockUser = { id: 'user-123', name: 'Test User', email: 'test@example.com' };
      vi.mocked(userService.getById).mockResolvedValue(mockUser as any);

      mockReq = { params: { id: 'user-123' } };

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(userService.getById).toHaveBeenCalledWith('user-123', true);
      expect(mockRes.json).toHaveBeenCalledWith({ user: mockUser });
    });

    it('should return 404 when user not found', async () => {
      vi.mocked(userService.getById).mockResolvedValue(null);

      mockReq = { params: { id: 'non-existent' } };

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'User not found',
      });
    });
  });

  describe('update', () => {
    it('should update user profile when owner', async () => {
      const mockUser = { id: 'user-123', name: 'Updated Name', passwordHash: 'secret' };
      vi.mocked(userService.update).mockResolvedValue(mockUser as any);

      mockReq = {
        user: { id: 'user-123', role: 'USER' },
        params: { id: 'user-123' },
        body: { name: 'Updated Name' },
      };

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(userService.update).toHaveBeenCalledWith('user-123', { name: 'Updated Name' });
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Profile updated successfully',
        user: { id: 'user-123', name: 'Updated Name' },
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockReq = { params: { id: 'user-123' }, body: {} };

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 when updating other user profile', async () => {
      mockReq = {
        user: { id: 'other-user', role: 'USER' },
        params: { id: 'user-123' },
        body: { name: 'Hack' },
      };

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should allow admin to update any profile', async () => {
      const mockUser = { id: 'user-123', name: 'Admin Updated', passwordHash: 'secret' };
      vi.mocked(userService.update).mockResolvedValue(mockUser as any);

      mockReq = {
        user: { id: 'admin-user', role: 'ADMIN' },
        params: { id: 'user-123' },
        body: { name: 'Admin Updated' },
      };

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(userService.update).toHaveBeenCalled();
    });

    it('should return 400 for invalid postcode', async () => {
      vi.mocked(userService.update).mockRejectedValue(new Error('Invalid postcode'));

      mockReq = {
        user: { id: 'user-123', role: 'USER' },
        params: { id: 'user-123' },
        body: { postcode: 'INVALID' },
      };

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 409 for duplicate username', async () => {
      vi.mocked(userService.update).mockRejectedValue(new Error('Username is already taken'));

      mockReq = {
        user: { id: 'user-123', role: 'USER' },
        params: { id: 'user-123' },
        body: { username: 'taken' },
      };

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
    });
  });

  describe('getUserTools', () => {
    it('should return user tools', async () => {
      const mockTools = [{ id: 'tool-1' }, { id: 'tool-2' }];
      vi.mocked(userService.getUserTools).mockResolvedValue(mockTools as any);

      mockReq = { params: { id: 'user-123' } };

      await controller.getUserTools(mockReq as Request, mockRes as Response, mockNext);

      expect(userService.getUserTools).toHaveBeenCalledWith('user-123');
      expect(mockRes.json).toHaveBeenCalledWith({ tools: mockTools });
    });
  });

  describe('getUserSpaces', () => {
    it('should return user spaces', async () => {
      const mockSpaces = [{ id: 'space-1' }];
      vi.mocked(userService.getUserSpaces).mockResolvedValue(mockSpaces as any);

      mockReq = { params: { id: 'user-123' } };

      await controller.getUserSpaces(mockReq as Request, mockRes as Response, mockNext);

      expect(userService.getUserSpaces).toHaveBeenCalledWith('user-123');
      expect(mockRes.json).toHaveBeenCalledWith({ spaces: mockSpaces });
    });
  });

  describe('getUserServices', () => {
    it('should return user services', async () => {
      const mockServices = [{ id: 'service-1' }];
      vi.mocked(userService.getUserServices).mockResolvedValue(mockServices as any);

      mockReq = { params: { id: 'user-123' } };

      await controller.getUserServices(mockReq as Request, mockRes as Response, mockNext);

      expect(userService.getUserServices).toHaveBeenCalledWith('user-123');
      expect(mockRes.json).toHaveBeenCalledWith({ services: mockServices });
    });
  });

  describe('getUserListings', () => {
    it('should return all user listings', async () => {
      vi.mocked(userService.getUserTools).mockResolvedValue([{ id: 'tool-1' }] as any);
      vi.mocked(userService.getUserSpaces).mockResolvedValue([{ id: 'space-1' }] as any);
      vi.mocked(userService.getUserServices).mockResolvedValue([{ id: 'service-1' }] as any);

      mockReq = { params: { id: 'user-123' } };

      await controller.getUserListings(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        tools: [{ id: 'tool-1' }],
        spaces: [{ id: 'space-1' }],
        services: [{ id: 'service-1' }],
      });
    });
  });

  describe('getUserReviews', () => {
    it('should return user reviews with pagination', async () => {
      const mockResult = {
        reviews: [{ id: 'review-1' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      vi.mocked(userService.getUserReviews).mockResolvedValue(mockResult as any);

      mockReq = {
        params: { id: 'user-123' },
        query: { page: '1', limit: '20' },
      };

      await controller.getUserReviews(mockReq as Request, mockRes as Response, mockNext);

      expect(userService.getUserReviews).toHaveBeenCalledWith('user-123', 1, 20);
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('getUserTransactions', () => {
    it('should return user transactions when owner', async () => {
      const mockResult = {
        transactions: [{ id: 'trans-1' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      vi.mocked(userService.getUserTransactions).mockResolvedValue(mockResult as any);

      mockReq = {
        user: { id: 'user-123', role: 'USER' },
        params: { id: 'user-123' },
        query: { page: '1', limit: '20' },
      };

      await controller.getUserTransactions(mockReq as Request, mockRes as Response, mockNext);

      expect(userService.getUserTransactions).toHaveBeenCalledWith('user-123', 1, 20);
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 401 when not authenticated', async () => {
      mockReq = { params: { id: 'user-123' }, query: {} };

      await controller.getUserTransactions(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 when viewing other user transactions', async () => {
      mockReq = {
        user: { id: 'other-user', role: 'USER' },
        params: { id: 'user-123' },
        query: {},
      };

      await controller.getUserTransactions(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should allow admin to view any transactions', async () => {
      vi.mocked(userService.getUserTransactions).mockResolvedValue({ transactions: [] } as any);

      mockReq = {
        user: { id: 'admin-user', role: 'ADMIN' },
        params: { id: 'user-123' },
        query: {},
      };

      await controller.getUserTransactions(mockReq as Request, mockRes as Response, mockNext);

      expect(userService.getUserTransactions).toHaveBeenCalled();
    });
  });
});
