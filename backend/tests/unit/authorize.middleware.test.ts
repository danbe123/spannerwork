import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { authorize, requireAdmin, requireModerator, requireOwner } from '../../src/middleware/authorize.middleware.js';

describe('Authorize Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('authorize', () => {
    it('should return 401 if no user', () => {
      const middleware = authorize([Role.ADMIN]);
      
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Unauthorized',
      }));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if user role not allowed', () => {
      mockReq.user = { id: 'user-1', role: Role.USER } as any;
      const middleware = authorize([Role.ADMIN]);
      
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Insufficient permissions',
      }));
    });

    it('should call next if user has allowed role', () => {
      mockReq.user = { id: 'admin-1', role: Role.ADMIN } as any;
      const middleware = authorize([Role.ADMIN]);
      
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow multiple roles', () => {
      mockReq.user = { id: 'mod-1', role: Role.MODERATOR } as any;
      const middleware = authorize([Role.ADMIN, Role.MODERATOR]);
      
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should allow admin users', () => {
      mockReq.user = { id: 'admin-1', role: Role.ADMIN } as any;
      
      requireAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject non-admin users', () => {
      mockReq.user = { id: 'user-1', role: Role.USER } as any;
      
      requireAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireModerator', () => {
    it('should allow admin users', () => {
      mockReq.user = { id: 'admin-1', role: Role.ADMIN } as any;
      
      requireModerator(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow moderator users', () => {
      mockReq.user = { id: 'mod-1', role: Role.MODERATOR } as any;
      
      requireModerator(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject regular users', () => {
      mockReq.user = { id: 'user-1', role: Role.USER } as any;
      
      requireModerator(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireOwner', () => {
    it('should return 401 if no user', () => {
      requireOwner(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should allow admin to access any resource', () => {
      mockReq.user = { id: 'admin-1', role: Role.ADMIN } as any;
      mockReq.resourceOwnerId = 'other-user';
      
      requireOwner(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow owner to access their resource', () => {
      mockReq.user = { id: 'user-1', role: Role.USER } as any;
      mockReq.resourceOwnerId = 'user-1';
      
      requireOwner(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject non-owner from accessing resource', () => {
      mockReq.user = { id: 'user-1', role: Role.USER } as any;
      mockReq.resourceOwnerId = 'other-user';
      
      requireOwner(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'You do not have permission to access this resource',
      }));
    });

    it('should reject if no resourceOwnerId set', () => {
      mockReq.user = { id: 'user-1', role: Role.USER } as any;
      // resourceOwnerId not set
      
      requireOwner(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });
});
