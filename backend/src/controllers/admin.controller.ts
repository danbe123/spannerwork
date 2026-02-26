import { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { authService } from '../services/auth.service.js';
import { auditService } from '../services/audit.service.js';
import { Prisma, AccountStatus, TransactionStatus } from '@prisma/client';
import { sanitizeSearchQuery, sanitizePagination } from '../utils/sanitize.js';

export class AdminController {
  /**
   * Get platform analytics
   * GET /api/v1/admin/analytics
   */
  async getAnalytics(req: Request, res: Response) {
    try {
      // Log admin access to analytics (read-only but sensitive)
      await auditService.log({
        action: 'ADMIN_ANALYTICS_VIEWED',
        userId: req.user!.id,
        resourceType: 'Analytics',
        resourceId: 'platform',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      // Use Promise.allSettled to ensure one failing query doesn't crash the entire endpoint
      const results = await Promise.allSettled([
        prisma.user.count(),
        prisma.user.count({ where: { accountStatus: 'ACTIVE' } }),
        prisma.transaction.count(),
        prisma.transaction.count({ where: { status: 'COMPLETED' } }),
        prisma.transaction.aggregate({
          where: { status: 'COMPLETED' },
          _sum: { platformFee: true },
        }),
        prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
        prisma.insuranceDocument.count({ where: { status: 'PENDING_REVIEW' } }),
        prisma.tool.count(),
        prisma.space.count(),
        prisma.service.count(),
        prisma.request.count({ where: { status: 'ACTIVE' } }),
      ]);

      // Extract values with fallbacks for any failed queries
      const getValue = <T>(result: PromiseSettledResult<T>, fallback: T): T =>
        result.status === 'fulfilled' ? result.value : fallback;

      const totalUsers = getValue(results[0], 0);
      const activeUsers = getValue(results[1], 0);
      const totalTransactions = getValue(results[2], 0);
      const completedTransactions = getValue(results[3], 0);
      const totalRevenue = getValue(results[4], { _sum: { platformFee: null } });
      const openDisputes = getValue(results[5], 0);
      const pendingInsurance = getValue(results[6], 0);
      const totalTools = getValue(results[7], 0);
      const totalSpaces = getValue(results[8], 0);
      const totalServices = getValue(results[9], 0);
      const totalRequests = getValue(results[10], 0);

      // Log any failed queries for monitoring
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.warn(`Analytics query ${index} failed:`, result.reason);
        }
      });

      // Get recent transactions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentTransactions = await prisma.transaction.count({
        where: {
          createdDate: {
            gte: thirtyDaysAgo,
          },
        },
      });

      const recentRevenue = await prisma.transaction.aggregate({
        where: {
          status: 'COMPLETED',
          completedDate: {
            gte: thirtyDaysAgo,
          },
        },
        _sum: { platformFee: true },
      });

      return res.json({
        analytics: {
          users: {
            total: totalUsers,
            active: activeUsers,
            suspended: totalUsers - activeUsers,
          },
          transactions: {
            total: totalTransactions,
            completed: completedTransactions,
            pending: totalTransactions - completedTransactions,
            last30Days: recentTransactions,
          },
          revenue: {
            total: totalRevenue._sum.platformFee || 0,
            last30Days: recentRevenue._sum.platformFee || 0,
          },
          disputes: {
            open: openDisputes,
          },
          insurance: {
            pending: pendingInsurance,
          },
          listings: {
            tools: totalTools,
            spaces: totalSpaces,
            services: totalServices,
            requests: totalRequests,
          },
        },
      });
    } catch (error) {
      logger.error('Error getting analytics:', error);
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get analytics',
      });
    }
  }

  /**
   * List all users (admin)
   * GET /api/v1/admin/users
   */
  async listUsers(req: Request, res: Response) {
    try {
      const { search, status } = req.query;
      
      // Log admin access to user list
      await auditService.log({
        action: 'ADMIN_USERS_LISTED',
        userId: req.user!.id,
        resourceType: 'User',
        resourceId: 'list',
        metadata: { search: search as string, status: status as string },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      // Sanitize pagination parameters
      const { page, limit } = sanitizePagination(
        req.query.page as string,
        req.query.limit as string,
        100
      );
      const skip = (page - 1) * limit;

      const where: Prisma.UserWhereInput = {};

      if (search) {
        // Sanitize search input to prevent injection
        const sanitizedSearch = sanitizeSearchQuery(search as string, 100);
        if (sanitizedSearch) {
          where.OR = [
            { email: { contains: sanitizedSearch, mode: 'insensitive' } },
            { name: { contains: sanitizedSearch, mode: 'insensitive' } },
          ];
        }
      }

      // Validate status against AccountStatus enum
      if (status) {
        const validStatuses = Object.values(AccountStatus);
        if (validStatuses.includes(status as AccountStatus)) {
          where.accountStatus = status as AccountStatus;
        }
        // Invalid status values are silently ignored (returns all statuses)
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            accountStatus: true,
            emailVerified: true,
            rating: true,
            totalTransactions: true,
            totalReviews: true,
            createdDate: true,
            suspendedDate: true,
            suspendedReason: true,
            stats: {
              select: {
                lastActiveAt: true,
              },
            },
          },
          orderBy: { createdDate: 'desc' },
          skip,
          take: limit,
        }),
        prisma.user.count({ where }),
      ]);

      // Flatten stats.lastActiveAt into the user object
      const flattenedUsers = users.map(user => ({
        ...user,
        lastActiveAt: user.stats?.lastActiveAt || null,
        stats: undefined,
      }));

      return res.json({
        users: flattenedUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error('Error listing users:', error);
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to list users',
      });
    }
  }

  /**
   * Suspend a user
   * POST /api/v1/admin/users/:id/suspend
   */
  async suspendUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      // Prevent admin from suspending themselves
      if (id === req.user!.id) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'You cannot suspend your own account',
        });
      }

      // Prevent suspending other admins (only super-admin protection)
      const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { role: true, email: true },
      });

      if (!targetUser) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
      }

      if (targetUser.role === 'ADMIN') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Cannot suspend another admin. Contact system administrator.',
        });
      }

      const user = await prisma.user.update({
        where: { id },
        data: {
          accountStatus: 'SUSPENDED',
          suspendedDate: new Date(),
          suspendedReason: reason,
        },
        select: {
          id: true,
          email: true,
          name: true,
          accountStatus: true,
          suspendedDate: true,
          suspendedReason: true,
        },
      });

      // Delete all active sessions
      await prisma.session.deleteMany({
        where: { userId: id },
      });

      // Log audit event
      await auditService.log({
        action: 'USER_SUSPENDED',
        userId: req.user!.id,
        resourceType: 'User',
        resourceId: id,
        metadata: { reason, targetEmail: user.email },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      logger.info(`Admin ${req.user!.id} suspended user ${id}`);

      return res.json({
        message: 'User suspended successfully',
        user,
      });
    } catch (error) {
      logger.error('Error suspending user:', error);
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to suspend user',
      });
    }
  }

  /**
   * Reactivate a user
   * POST /api/v1/admin/users/:id/reactivate
   */
  async reactivateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const user = await prisma.user.update({
        where: { id },
        data: {
          accountStatus: 'ACTIVE',
          suspendedDate: null,
          suspendedReason: null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          accountStatus: true,
        },
      });

      // Log audit event
      await auditService.log({
        action: 'USER_REACTIVATED',
        userId: req.user!.id,
        resourceType: 'User',
        resourceId: id,
        metadata: { targetEmail: user.email },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      logger.info(`Admin ${req.user!.id} reactivated user ${id}`);

      return res.json({
        message: 'User reactivated successfully',
        user,
      });
    } catch (error) {
      logger.error('Error reactivating user:', error);
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to reactivate user',
      });
    }
  }

  /**
   * List all transactions (admin)
   * GET /api/v1/admin/transactions
   */
  async listTransactions(req: Request, res: Response) {
    try {
      const { status } = req.query;

      // Log admin access to transaction list
      await auditService.log({
        action: 'ADMIN_TRANSACTIONS_LISTED',
        userId: req.user!.id,
        resourceType: 'Transaction',
        resourceId: 'list',
        metadata: { status: status as string },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      // Sanitize pagination parameters
      const { page, limit } = sanitizePagination(
        req.query.page as string,
        req.query.limit as string,
        100
      );
      const skip = (page - 1) * limit;

      const where: Prisma.TransactionWhereInput = {};

      // Validate status against TransactionStatus enum
      if (status) {
        const validStatuses = Object.values(TransactionStatus);
        if (validStatuses.includes(status as TransactionStatus)) {
          where.status = status as TransactionStatus;
        }
        // Invalid status values are silently ignored (returns all statuses)
      }

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            tool: {
              select: {
                id: true,
                name: true,
              },
            },
            space: {
              select: {
                id: true,
                name: true,
              },
            },
            service: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdDate: 'desc' },
          skip,
          take: limit,
        }),
        prisma.transaction.count({ where }),
      ]);

      return res.json({
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error('Error listing transactions:', error);
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to list transactions',
      });
    }
  }

  /**
   * List all disputes (admin)
   * GET /api/v1/admin/disputes
   */
  async listDisputes(req: Request, res: Response) {
    try {
      const { status } = req.query;

      // Log admin access to dispute list
      await auditService.log({
        action: 'ADMIN_DISPUTES_LISTED',
        userId: req.user!.id,
        resourceType: 'Dispute',
        resourceId: 'list',
        metadata: { status: status as string },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      // Sanitize pagination parameters
      const { page, limit } = sanitizePagination(
        req.query.page as string,
        req.query.limit as string,
        100
      );

      // Use dispute service with admin view
      const { disputeService } = await import('../services/dispute.service.js');
      
      const result = await disputeService.list({
        status: status as string,
        page,
        limit,
        adminView: true,
      });

      return res.json(result);
    } catch (error) {
      logger.error('Error listing disputes:', error);
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to list disputes',
      });
    }
  }

  /**
   * Change user role
   * PATCH /api/v1/admin/users/:id/role
   */
  async changeUserRole(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!['USER', 'ADMIN', 'MODERATOR'].includes(role)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid role',
        });
      }

      // Prevent admin from changing their own role
      if (id === req.user!.id) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'You cannot change your own role',
        });
      }

      // Get old role first for audit log
      const oldUser = await prisma.user.findUnique({
        where: { id },
        select: { role: true, email: true },
      });

      if (!oldUser) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
      }

      // Prevent demoting other admins - requires super-admin or system-level intervention
      // This prevents privilege escalation attacks where a rogue admin removes other admins
      if (oldUser.role === 'ADMIN' && role !== 'ADMIN') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Cannot demote other administrators. Contact system administrator for admin role changes.',
        });
      }

      const user = await prisma.user.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      // Invalidate all sessions for this user (force re-login after privilege change)
      await authService.deleteAllUserSessions(id);
      logger.info(`All sessions invalidated for user ${user.email} after role change to ${role}`);

      // Log audit event
      await auditService.log({
        action: 'USER_ROLE_CHANGED',
        userId: req.user!.id,
        resourceType: 'User',
        resourceId: id,
        metadata: {
          targetEmail: user.email,
          oldRole: oldUser?.role,
          newRole: role,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      logger.info(`Admin ${req.user!.id} changed user ${id} role from ${oldUser?.role} to ${role}`);

      return res.json({
        message: 'User role updated successfully. User must log in again.',
        user,
      });
    } catch (error) {
      logger.error('Error changing user role:', error);
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to change user role',
      });
    }
  }

  /**
   * Get audit logs with filtering
   * GET /api/v1/admin/audit-logs
   */
  async getAuditLogs(req: Request, res: Response) {
    try {
      const { action, userId, resourceType, resourceId } = req.query;
      
      // Sanitize pagination parameters
      const { page, limit } = sanitizePagination(
        req.query.page as string,
        req.query.limit as string,
        100
      );
      const skip = (page - 1) * limit;

      const where: Prisma.AuditLogWhereInput = {};

      if (action) {
        where.action = sanitizeSearchQuery(action as string, 50);
      }

      if (userId) {
        where.userId = userId as string;
      }

      if (resourceType) {
        where.resourceType = sanitizeSearchQuery(resourceType as string, 50);
      }

      if (resourceId) {
        where.resourceId = resourceId as string;
      }

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

      // Log that audit logs were viewed (meta-audit)
      await auditService.log({
        action: 'ADMIN_AUDIT_LOGS_VIEWED',
        userId: req.user!.id,
        resourceType: 'AuditLog',
        resourceId: 'list',
        metadata: { filters: { action, userId, resourceType, resourceId } },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.json({
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error('Error getting audit logs:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get audit logs',
      });
    }
  }

  /**
   * FIX #13: Force-complete a stuck transaction (admin only)
   * POST /api/v1/admin/transactions/:id/force-complete
   *
   * Use case: When escrow is about to expire and customer is unresponsive,
   * admin can force-complete to protect the provider.
   */
  async forceCompleteTransaction(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || reason.length < 10) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Please provide a detailed reason for force-completing this transaction (min 10 chars)',
        });
      }

      // Get transaction with payment details
      const transaction = await prisma.transaction.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, email: true, name: true } },
          provider: { select: { id: true, email: true, name: true, stripeConnectId: true } },
          tool: { select: { name: true } },
          space: { select: { name: true } },
          service: { select: { name: true } },
        },
      });

      if (!transaction) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Transaction not found',
        });
      }

      // Only allow force-complete for transactions in CONFIRMED or IN_PROGRESS status
      if (!['CONFIRMED', 'IN_PROGRESS'].includes(transaction.status)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Cannot force-complete a transaction in ${transaction.status} status`,
        });
      }

      const resourceName = transaction.tool?.name || transaction.space?.name || transaction.service?.name || 'booking';

      // Try to capture payment if there's a payment intent
      let stripeTransferId: string | null = null;
      if (transaction.stripePaymentIntentId && transaction.paymentStatus === 'PENDING') {
        try {
          const { stripeService } = await import('../services/stripe.service.js');

          if (stripeService.isEnabled()) {
            const escrowStatus = await stripeService.getEscrowStatus(transaction.stripePaymentIntentId);

            if (escrowStatus.requiresCapture) {
              // Calculate CPA fees before capture
              const rentalFee = Number(transaction.rentalFee || 0);
              const currentAppFee = Number(transaction.applicationFeeAmount || 0);
              const providerSponsorCpaFee = Math.round(rentalFee * ((transaction.providerSponsorCpaPercent || 0) / 100));
              const renterSponsorCpaFee = Math.round(rentalFee * ((transaction.renterSponsorCpaPercent || 0) / 100));
              const totalCpaFees = providerSponsorCpaFee + renterSponsorCpaFee;
              const updatedApplicationFeeAmount = currentAppFee + totalCpaFees;

              if (totalCpaFees > 0) {
                await stripeService.updateApplicationFee(transaction.stripePaymentIntentId, updatedApplicationFeeAmount);
              }

              const capture = await stripeService.capturePayment({
                paymentIntentId: transaction.stripePaymentIntentId,
              });
              stripeTransferId = capture.transferId || null;
            }
          }
        } catch (stripeError) {
          logger.error('Failed to capture payment during force-complete:', stripeError);
          // Continue with status update even if payment capture fails
        }
      }

      // Update transaction status
      const updatedTransaction = await prisma.transaction.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          paymentStatus: stripeTransferId ? 'PAID' : transaction.paymentStatus,
          completedDate: new Date(),
          stripeTransferId: stripeTransferId || transaction.stripeTransferId,
          notes: `${transaction.notes || ''}\n[Admin Force-Complete by ${req.user!.id}: ${reason}]`.trim(),
        },
      });

      // Update transaction counts
      await prisma.user.update({
        where: { id: transaction.userId },
        data: { totalTransactions: { increment: 1 } },
      });
      if (transaction.providerId) {
        await prisma.user.update({
          where: { id: transaction.providerId },
          data: { totalTransactions: { increment: 1 } },
        });
      }

      // Log audit event
      await auditService.log({
        action: 'ADMIN_TRANSACTION_FORCE_COMPLETED',
        userId: req.user!.id,
        resourceType: 'Transaction',
        resourceId: id,
        metadata: {
          reason,
          previousStatus: transaction.status,
          paymentCaptured: !!stripeTransferId,
          customerEmail: transaction.user?.email,
          providerEmail: transaction.provider?.email,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      logger.info(`Admin ${req.user!.id} force-completed transaction ${id}: ${reason}`);

      // Send notifications
      try {
        const { emailService } = await import('../services/email.service.js');

        if (transaction.user?.email) {
          await emailService.sendAdminActionNotificationEmail(transaction.user.email, {
            userName: transaction.user.name,
            action: 'Transaction Completed',
            resourceType: 'booking',
            resourceName,
            reason: `Your booking for "${resourceName}" has been marked as completed by an administrator.`,
          });
        }

        if (transaction.provider?.email) {
          await emailService.sendAdminActionNotificationEmail(transaction.provider.email, {
            userName: transaction.provider.name,
            action: 'Transaction Completed',
            resourceType: 'booking',
            resourceName,
            reason: `The booking for "${resourceName}" has been marked as completed by an administrator. Payment has been released.`,
          });
        }
      } catch (emailError) {
        logger.error('Failed to send force-complete notifications:', emailError);
      }

      return res.json({
        message: 'Transaction force-completed successfully',
        transaction: updatedTransaction,
        paymentCaptured: !!stripeTransferId,
      });
    } catch (error) {
      logger.error('Error force-completing transaction:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to force-complete transaction',
      });
    }
  }
}

export const adminController = new AdminController();
