import { prisma } from '../config/database.js';
import { Prisma } from '@prisma/client';
import { logger } from '../config/logger.js';

export class AuditService {
  /**
   * Log an audit event
   */
  async log(data: {
    action: string;
    userId: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: Prisma.InputJsonValue;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      return await prisma.auditLog.create({
        data: {
          action: data.action,
          userId: data.userId,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          metadata: data.metadata,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      // Log to file if database fails (don't throw - audit logging should never break main flow)
      logger.error('Failed to create audit log', { data, error });
      return null;
    }
  }

  /**
   * Get audit logs for a specific user
   */
  async getLogsForUser(userId: string, options: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 100 } = options;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where: { userId } }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get audit logs for a specific resource
   */
  async getLogsForResource(resourceType: string, resourceId: string) {
    return await prisma.auditLog.findMany({
      where: {
        resourceType,
        resourceId,
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }

  /**
   * Get audit logs by action type
   */
  async getLogsByAction(action: string, options: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 100 } = options;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { action },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where: { action } }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get all audit logs (admin only)
   */
  async getAllLogs(options: { page?: number; limit?: number; action?: string } = {}) {
    const { page = 1, limit = 100, action } = options;
    const skip = (page - 1) * limit;

    const where = action ? { action } : {};

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
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
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const auditService = new AuditService();
