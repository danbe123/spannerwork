import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../src/config/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockCreate = vi.hoisted(() => vi.fn());
const mockFindMany = vi.hoisted(() => vi.fn());
const mockCount = vi.hoisted(() => vi.fn());

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    auditLog: {
      create: mockCreate,
      findMany: mockFindMany,
      count: mockCount,
    },
  },
}));

import { auditService, AuditService } from '../../src/services/audit.service.js';
import { logger } from '../../src/config/logger.js';

describe('Audit Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('log', () => {
    it('creates audit log entry with all fields', async () => {
      const mockAuditLog = { id: 'log-1', action: 'USER_LOGIN' };
      mockCreate.mockResolvedValue(mockAuditLog);

      const result = await auditService.log({
        action: 'USER_LOGIN',
        userId: 'user-123',
        resourceType: 'Session',
        resourceId: 'session-456',
        metadata: { browser: 'Chrome' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'USER_LOGIN',
          userId: 'user-123',
          resourceType: 'Session',
          resourceId: 'session-456',
          metadata: { browser: 'Chrome' },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        }),
      });
      expect(result).toEqual(mockAuditLog);
    });

    it('creates audit log with minimal required fields', async () => {
      mockCreate.mockResolvedValue({ id: 'log-2' });

      await auditService.log({
        action: 'PROFILE_VIEW',
        userId: 'user-123',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'PROFILE_VIEW',
          userId: 'user-123',
        }),
      });
    });

    it('returns null and logs error on database failure', async () => {
      const error = new Error('Database error');
      mockCreate.mockRejectedValue(error);

      const result = await auditService.log({
        action: 'SOME_ACTION',
        userId: 'user-123',
      });

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create audit log',
        expect.objectContaining({ error })
      );
    });
  });

  describe('getLogsForUser', () => {
    it('returns paginated logs for user', async () => {
      const mockLogs = [
        { id: 'log-1', action: 'LOGIN' },
        { id: 'log-2', action: 'LOGOUT' },
      ];
      mockFindMany.mockResolvedValue(mockLogs);
      mockCount.mockResolvedValue(10);

      const result = await auditService.getLogsForUser('user-123', { page: 1, limit: 5 });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { timestamp: 'desc' },
        skip: 0,
        take: 5,
      });
      expect(result).toEqual({
        logs: mockLogs,
        pagination: {
          page: 1,
          limit: 5,
          total: 10,
          totalPages: 2,
        },
      });
    });

    it('uses default pagination values', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await auditService.getLogsForUser('user-123');

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { timestamp: 'desc' },
        skip: 0,
        take: 100,
      });
    });

    it('calculates correct pagination for page 2', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(150);

      const result = await auditService.getLogsForUser('user-123', { page: 2, limit: 50 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 50,
          take: 50,
        })
      );
      expect(result.pagination.totalPages).toBe(3);
    });
  });

  describe('getLogsForResource', () => {
    it('returns logs for specific resource', async () => {
      const mockLogs = [{ id: 'log-1' }, { id: 'log-2' }];
      mockFindMany.mockResolvedValue(mockLogs);

      const result = await auditService.getLogsForResource('Tool', 'tool-123');

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          resourceType: 'Tool',
          resourceId: 'tool-123',
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
      expect(result).toEqual(mockLogs);
    });
  });

  describe('getLogsByAction', () => {
    it('returns paginated logs by action type', async () => {
      const mockLogs = [{ id: 'log-1' }];
      mockFindMany.mockResolvedValue(mockLogs);
      mockCount.mockResolvedValue(25);

      const result = await auditService.getLogsByAction('PASSWORD_CHANGE', { page: 1, limit: 10 });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { action: 'PASSWORD_CHANGE' },
        orderBy: { timestamp: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(result.pagination.total).toBe(25);
    });
  });

  describe('getAllLogs', () => {
    it('returns all logs with user info', async () => {
      const mockLogs = [
        { id: 'log-1', user: { id: 'u1', email: 'a@b.com', name: 'User', role: 'USER' } },
      ];
      mockFindMany.mockResolvedValue(mockLogs);
      mockCount.mockResolvedValue(1);

      const result = await auditService.getAllLogs({ page: 1, limit: 10 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
              },
            },
          },
        })
      );
      expect(result.logs).toEqual(mockLogs);
    });

    it('filters by action when provided', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await auditService.getAllLogs({ action: 'ADMIN_ACTION' });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { action: 'ADMIN_ACTION' },
        })
      );
    });

    it('uses empty where clause when no action filter', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await auditService.getAllLogs({});

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });
  });
});
