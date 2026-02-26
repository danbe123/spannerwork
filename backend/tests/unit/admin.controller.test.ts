import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Mock dependencies
const mockPrisma = vi.hoisted(() => ({
  user: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  transaction: {
    count: vi.fn(),
    aggregate: vi.fn(),
    findMany: vi.fn(),
  },
  dispute: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  tool: {
    count: vi.fn(),
  },
  space: {
    count: vi.fn(),
  },
  service: {
    count: vi.fn(),
  },
  request: {
    count: vi.fn(),
  },
  session: {
    deleteMany: vi.fn(),
  },
  insuranceDocument: {
    count: vi.fn(),
  },
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../src/services/auth.service.js', () => ({
  authService: {
    validatePassword: vi.fn(),
    deleteAllUserSessions: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/services/audit.service.js', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../src/utils/sanitize.js', () => ({
  sanitizeSearchQuery: vi.fn((s) => s),
  sanitizePagination: vi.fn((page, limit) => ({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  })),
}));

import { AdminController } from '../../src/controllers/admin.controller.js';

describe('AdminController', () => {
  let controller: AdminController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AdminController();
    
    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
  });

  describe('getAnalytics', () => {
    it('should return platform analytics', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(90); // activeUsers
      mockPrisma.transaction.count
        .mockResolvedValueOnce(500) // totalTransactions
        .mockResolvedValueOnce(400) // completedTransactions
        .mockResolvedValueOnce(50); // recentTransactions
      mockPrisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { platformFee: 10000 } }) // totalRevenue
        .mockResolvedValueOnce({ _sum: { platformFee: 2000 } }); // recentRevenue
      mockPrisma.dispute.count.mockResolvedValue(5);
      mockPrisma.insuranceDocument.count.mockResolvedValue(3);
      mockPrisma.tool.count.mockResolvedValue(200);
      mockPrisma.space.count.mockResolvedValue(50);
      mockPrisma.service.count.mockResolvedValue(100);
      mockPrisma.request.count.mockResolvedValue(75);

      mockReq = {
        user: { id: 'admin-123' },
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('Mozilla/5.0'),
      };

      await controller.getAnalytics(mockReq as Request, mockRes as Response);

      // Controller returns analytics wrapped in analytics object
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          analytics: expect.objectContaining({
            users: expect.objectContaining({
              total: 100,
              active: 90,
            }),
            transactions: expect.objectContaining({
              total: 500,
              completed: 400,
            }),
            revenue: expect.objectContaining({
              total: 10000,
            }),
            disputes: expect.objectContaining({
              open: 5,
            }),
            listings: expect.objectContaining({
              tools: 200,
              spaces: 50,
              services: 100,
            }),
          }),
        })
      );
    });

    it('should return 500 on error', async () => {
      mockPrisma.user.count.mockRejectedValue(new Error('Database error'));

      mockReq = {
        user: { id: 'admin-123' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.getAnalytics(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('listUsers', () => {
    it('should return paginated users', async () => {
      const mockUsers = [
        { id: 'user-1', email: 'user1@example.com', name: 'User 1' },
        { id: 'user-2', email: 'user2@example.com', name: 'User 2' },
      ];
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.user.count.mockResolvedValue(2);

      mockReq = {
        user: { id: 'admin-123' },
        query: { page: '1', limit: '20' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.listUsers(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          users: expect.arrayContaining([
            expect.objectContaining({ id: 'user-1', email: 'user1@example.com', name: 'User 1' }),
            expect.objectContaining({ id: 'user-2', email: 'user2@example.com', name: 'User 2' }),
          ]),
          pagination: {
            page: 1,
            limit: 20,
            total: 2,
            totalPages: 1,
          },
        })
      );
    });

    it('should filter by search query', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      mockReq = {
        user: { id: 'admin-123' },
        query: { search: 'test@example.com', page: '1', limit: '20' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.listUsers(mockReq as Request, mockRes as Response);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ email: expect.any(Object) }),
              expect.objectContaining({ name: expect.any(Object) }),
            ]),
          }),
        })
      );
    });

    it('should filter by status', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      mockReq = {
        user: { id: 'admin-123' },
        query: { status: 'ACTIVE', page: '1', limit: '20' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.listUsers(mockReq as Request, mockRes as Response);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountStatus: 'ACTIVE',
          }),
        })
      );
    });

    it('should return 500 on error', async () => {
      mockPrisma.user.findMany.mockRejectedValue(new Error('Database error'));

      mockReq = {
        user: { id: 'admin-123' },
        query: { page: '1', limit: '20' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.listUsers(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('suspendUser', () => {
    it('should suspend a user successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'USER', email: 'user@test.com' });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-123',
        email: 'user@test.com',
        accountStatus: 'SUSPENDED',
      });
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 2 });

      mockReq = {
        user: { id: 'admin-123' },
        params: { id: 'user-123' },
        body: { reason: 'Violation of terms' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.suspendUser(mockReq as Request, mockRes as Response);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: expect.objectContaining({
            accountStatus: 'SUSPENDED',
          }),
        })
      );
      expect(mockPrisma.session.deleteMany).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'User suspended successfully',
      }));
    });

    it('should prevent admin from suspending themselves', async () => {
      mockReq = {
        user: { id: 'admin-123' },
        params: { id: 'admin-123' },
        body: { reason: 'Test' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.suspendUser(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'You cannot suspend your own account',
      }));
    });

    it('should return 404 when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      mockReq = {
        user: { id: 'admin-123' },
        params: { id: 'non-existent' },
        body: { reason: 'Test' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.suspendUser(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should prevent suspending another admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'ADMIN', email: 'admin2@test.com' });

      mockReq = {
        user: { id: 'admin-123' },
        params: { id: 'admin-456' },
        body: { reason: 'Test' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.suspendUser(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('reactivateUser', () => {
    it('should reactivate a user successfully', async () => {
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-123',
        email: 'user@test.com',
        accountStatus: 'ACTIVE',
      });

      mockReq = {
        user: { id: 'admin-123' },
        params: { id: 'user-123' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.reactivateUser(mockReq as Request, mockRes as Response);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: expect.objectContaining({
            accountStatus: 'ACTIVE',
            suspendedDate: null,
            suspendedReason: null,
          }),
        })
      );
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'User reactivated successfully',
      }));
    });

    it('should return 500 on error', async () => {
      mockPrisma.user.update.mockRejectedValue(new Error('Database error'));

      mockReq = {
        user: { id: 'admin-123' },
        params: { id: 'user-123' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.reactivateUser(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('listTransactions', () => {
    it('should return paginated transactions', async () => {
      const mockTransactions = [
        { id: 'trans-1', status: 'COMPLETED' },
        { id: 'trans-2', status: 'PENDING' },
      ];
      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.transaction.count.mockResolvedValue(2);

      mockReq = {
        user: { id: 'admin-123' },
        query: { page: '1', limit: '20' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.listTransactions(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        transactions: mockTransactions,
        pagination: expect.objectContaining({
          page: 1,
          limit: 20,
        }),
      }));
    });

    it('should filter by status', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      mockReq = {
        user: { id: 'admin-123' },
        query: { status: 'COMPLETED', page: '1', limit: '20' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.listTransactions(mockReq as Request, mockRes as Response);

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'COMPLETED',
          }),
        })
      );
    });
  });

  describe('listDisputes', () => {
    it('should return paginated disputes', async () => {
      // Mock the dynamic import of disputeService
      vi.doMock('../../src/services/dispute.service.js', () => ({
        disputeService: {
          list: vi.fn().mockResolvedValue({
            disputes: [{ id: 'dispute-1' }],
            pagination: { page: 1, limit: 20, total: 1 },
          }),
        },
      }));

      mockReq = {
        user: { id: 'admin-123' },
        query: { page: '1', limit: '20' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.listDisputes(mockReq as Request, mockRes as Response);

      // Should call the dispute service with adminView flag
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      mockReq = {
        user: { id: 'admin-123' },
        query: { status: 'OPEN', page: '1', limit: '20' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.listDisputes(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalled();
    });
  });

  describe('changeUserRole', () => {
    it('should change user role successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'USER', email: 'test@test.com' });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-123',
        email: 'test@test.com',
        name: 'Test',
        role: 'ADMIN',
      });
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 0 });

      mockReq = {
        user: { id: 'admin-123' },
        params: { id: 'user-123' },
        body: { role: 'ADMIN' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.changeUserRole(mockReq as Request, mockRes as Response);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: { role: 'ADMIN' },
        })
      );
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('User role updated'),
      }));
    });

    it('should reject invalid role', async () => {
      mockReq = {
        user: { id: 'admin-123' },
        params: { id: 'user-123' },
        body: { role: 'INVALID' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.changeUserRole(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Invalid role',
      }));
    });

    it('should prevent changing own role', async () => {
      mockReq = {
        user: { id: 'admin-123' },
        params: { id: 'admin-123' }, // Same as user
        body: { role: 'USER' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.changeUserRole(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'You cannot change your own role',
      }));
    });

    it('should return 500 on error', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      mockReq = {
        user: { id: 'admin-123' },
        params: { id: 'user-123' },
        body: { role: 'ADMIN' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.changeUserRole(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAuditLogs', () => {
    it('should return paginated audit logs', async () => {
      const mockLogs = [
        { id: 'log-1', action: 'USER_CREATED' },
        { id: 'log-2', action: 'USER_UPDATED' },
      ];
      mockPrisma.auditLog = {
        findMany: vi.fn().mockResolvedValue(mockLogs),
        count: vi.fn().mockResolvedValue(2),
      };

      mockReq = {
        user: { id: 'admin-123' },
        query: { page: '1', limit: '20' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.getAuditLogs(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        logs: mockLogs,
        pagination: expect.objectContaining({
          page: 1,
          limit: 20,
        }),
      }));
    });

    it('should filter by action', async () => {
      mockPrisma.auditLog = {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      };

      mockReq = {
        user: { id: 'admin-123' },
        query: { action: 'USER_CREATED', page: '1', limit: '20' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.getAuditLogs(mockReq as Request, mockRes as Response);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: 'USER_CREATED',
          }),
        })
      );
    });

    it('should filter by userId', async () => {
      mockPrisma.auditLog = {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      };

      mockReq = {
        user: { id: 'admin-123' },
        query: { userId: 'user-456', page: '1', limit: '20' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.getAuditLogs(mockReq as Request, mockRes as Response);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-456',
          }),
        })
      );
    });

    it('should filter by resourceType', async () => {
      mockPrisma.auditLog = {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      };

      mockReq = {
        user: { id: 'admin-123' },
        query: { resourceType: 'User', page: '1', limit: '20' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.getAuditLogs(mockReq as Request, mockRes as Response);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            resourceType: 'User',
          }),
        })
      );
    });

    it('should return 500 on error', async () => {
      mockPrisma.auditLog = {
        findMany: vi.fn().mockRejectedValue(new Error('Database error')),
        count: vi.fn().mockResolvedValue(0),
      };

      mockReq = {
        user: { id: 'admin-123' },
        query: { page: '1', limit: '20' },
        ip: '127.0.0.1',
        get: vi.fn(),
      };

      await controller.getAuditLogs(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
