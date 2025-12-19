import { prisma } from '../config/database.js';
import { Prisma, TransactionStatus } from '@prisma/client';
import { smsService } from './sms.service.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { BadRequestError, NotFoundError, ForbiddenError, ConflictError } from '../utils/errors.js';

// Maximum length for user-generated content in SMS messages
const SMS_CONTENT_MAX_LENGTH = 50;

function stripControlCharacters(input: string): string {
  let output = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= 32 && code !== 127) {
      output += input[i];
    }
  }
  return output;
}

/**
 * Sanitize user-generated content for SMS messages
 * - Truncates to max length
 * - Removes control characters and newlines
 * - Escapes special characters
 */
function sanitizeForSms(text: string, maxLength = SMS_CONTENT_MAX_LENGTH): string {
  const cleaned = stripControlCharacters(text)
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Trim whitespace
    .trim();

  // Only add ellipsis if actually truncating
  if (cleaned.length > maxLength) {
    return cleaned.slice(0, maxLength - 3) + '...';
  }
  return cleaned;
}

export class TransactionService {
  /**
   * Calculate the number of days between two dates (inclusive)
   */
  private calculateDays(startDate: Date, endDate: Date): number {
    if (endDate < startDate) {
      throw new BadRequestError('End date must be after start date');
    }
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays); // Minimum 1 day
  }

  /**
   * Calculate the number of hours between two dates
   */
  private calculateHours(startDate: Date, endDate: Date): number {
    if (endDate < startDate) {
      throw new BadRequestError('End date must be after start date');
    }
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    return Math.max(1, diffHours); // Minimum 1 hour
  }

  /**
   * Create a new transaction/booking
   * Rental fee is calculated server-side based on listing rates to prevent manipulation
   * All pricing queries are inside the transaction to prevent race conditions
   */
  async create(data: {
    userId: string;
    requestId?: string;
    toolId?: string;
    spaceId?: string;
    serviceId?: string;
    startDate: Date;
    endDate: Date;
    notes?: string;
    waiverAccepted?: boolean;
  }) {
    const days = this.calculateDays(data.startDate, data.endDate);
    const hours = this.calculateHours(data.startDate, data.endDate);

    // Create transaction and booking atomically with conflict check
    // All pricing queries are inside the transaction to prevent race conditions
    const transaction = await prisma.$transaction(async (tx) => {
      // Determine providerId and calculate rental fee based on what's being booked
      // These queries use tx (transaction client) to ensure atomicity
      let providerId: string | null = null;
      let rentalFee: number = 0;

      if (data.toolId) {
        const tool = await tx.tool.findUnique({
          where: { id: data.toolId },
          select: { ownerId: true, available: true, dailyRate: true, weeklyRate: true },
        });
        if (!tool) throw new NotFoundError('Tool not found');
        if (!tool.available) throw new ConflictError('Tool is not available');
        providerId = tool.ownerId;
        
        // Calculate rental fee: use weekly rate if >= 7 days and available, otherwise daily
        if (days >= 7 && tool.weeklyRate) {
          const weeks = Math.ceil(days / 7);
          rentalFee = weeks * tool.weeklyRate;
        } else {
          rentalFee = days * tool.dailyRate;
        }
      } else if (data.spaceId) {
        const space = await tx.space.findUnique({
          where: { id: data.spaceId },
          select: { ownerId: true, available: true, hourlyRate: true, dailyRate: true, weeklyRate: true },
        });
        if (!space) throw new NotFoundError('Space not found');
        if (!space.available) throw new ConflictError('Space is not available');
        providerId = space.ownerId;
        
        // Calculate rental fee: weekly > daily > hourly based on duration
        if (days >= 7 && space.weeklyRate) {
          const weeks = Math.ceil(days / 7);
          rentalFee = weeks * space.weeklyRate;
        } else if (days >= 1) {
          rentalFee = days * space.dailyRate;
        } else {
          rentalFee = hours * space.hourlyRate;
        }
      } else if (data.serviceId) {
        const service = await tx.service.findUnique({
          where: { id: data.serviceId },
          select: { providerId: true, available: true, hourlyRate: true, calloutFee: true, requiresInsurance: true },
        });
        if (!service) throw new NotFoundError('Service not found');
        if (!service.available) throw new ConflictError('Service is not available');
        providerId = service.providerId;

        if (service.requiresInsurance) {
          const now = new Date();
          const validInsurance = await tx.insuranceDocument.findFirst({
            where: {
              userId: providerId,
              status: 'APPROVED',
              documentType: 'PUBLIC_LIABILITY',
              OR: [
                { expiryDate: null },
                { expiryDate: { gt: now } },
              ],
            },
            select: { id: true },
          });

          if (!validInsurance) {
            throw new ForbiddenError(
              'This service cannot be booked because the provider does not have valid public liability insurance.',
              'PROVIDER_INSURANCE_REQUIRED'
            );
          }
        }
        
        // Calculate service fee: hourly rate * hours + callout fee
        rentalFee = (hours * service.hourlyRate) + (service.calloutFee || 0);
      }

      // Validate rental fee is positive
      if (rentalFee <= 0) {
        throw new BadRequestError('Could not calculate valid rental fee for the specified booking');
      }

      // Calculate platform fee based on configured percentage - all values in pence
      const platformFeePercentage = parseInt(env.PLATFORM_FEE_PERCENTAGE, 10) / 100;
      const platformFee = Math.round(rentalFee * platformFeePercentage);
      const totalAmount = rentalFee + platformFee;

      // Check for booking conflicts INSIDE transaction for atomicity
      const where: Prisma.TransactionWhereInput = {
        status: {
          in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'],
        },
        OR: [
          {
            startDate: {
              lte: data.endDate,
            },
            endDate: {
              gte: data.startDate,
            },
          },
        ],
      };

      if (data.toolId) where.toolId = data.toolId;
      if (data.spaceId) where.spaceId = data.spaceId;
      if (data.serviceId) where.serviceId = data.serviceId;

      const conflictingTransaction = await tx.transaction.findFirst({
        where,
      });

      if (conflictingTransaction) {
        throw new ConflictError('Booking conflict: Resource is already booked for these dates');
      }

      // Create transaction - this is the single source of truth for bookings
      // Availability checks should query Transaction, not the deprecated Booking model
      const newTransaction = await tx.transaction.create({
        data: {
          userId: data.userId,
          providerId,
          requestId: data.requestId,
          toolId: data.toolId,
          spaceId: data.spaceId,
          serviceId: data.serviceId,
          startDate: data.startDate,
          endDate: data.endDate,
          rentalFee,
          platformFee,
          totalAmount,
          notes: data.notes,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          // Store waiver acceptance timestamp for service bookings
          customerWaiverAcceptedAt: data.waiverAccepted ? new Date() : null,
          waiverVersion: data.waiverAccepted ? '1.0' : null,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          tool: true,
          space: true,
          service: true,
          request: true,
        },
      });

      return newTransaction;
    });

    // Best-effort SMS notification for new booking
    try {
      const user = await prisma.user.findUnique({
        where: { id: data.userId },
        select: { phone: true, name: true },
      });

      const rawResourceName =
        transaction.tool?.name || transaction.space?.name || transaction.service?.name || 'booking';
      const resourceName = sanitizeForSms(rawResourceName);

      if (user?.phone) {
        const body = `We've received your SpannerWork booking request for ${resourceName}.`;
        await smsService.sendSms({ to: user.phone, body });
      }
    } catch (error) {
      logger.error('Error sending SMS for new transaction', error);
    }

    return transaction;
  }

  /**
   * Check if there's a booking conflict
   */
  async checkBookingConflict(data: {
    toolId?: string;
    spaceId?: string;
    serviceId?: string;
    startDate: Date;
    endDate: Date;
    excludeTransactionId?: string;
  }): Promise<boolean> {
    const where: Prisma.TransactionWhereInput = {
      status: {
        in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'],
      },
      OR: [
        {
          startDate: {
            lte: data.endDate,
          },
          endDate: {
            gte: data.startDate,
          },
        },
      ],
    };

    if (data.toolId) where.toolId = data.toolId;
    if (data.spaceId) where.spaceId = data.spaceId;
    if (data.serviceId) where.serviceId = data.serviceId;
    if (data.excludeTransactionId) {
      where.id = { not: data.excludeTransactionId };
    }

    const conflictingTransaction = await prisma.transaction.findFirst({
      where,
    });

    return !!conflictingTransaction;
  }

  /**
   * List user's transactions with pagination
   */
  async list(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      asProvider?: boolean;
    } = {}
  ) {
    const MAX_LIMIT = 100;
    const { page = 1, limit = 20, status, asProvider = false } = options;
    const safeLimit = Math.min(limit, MAX_LIMIT);
    const skip = (page - 1) * safeLimit;

    const where: Prisma.TransactionWhereInput = asProvider
      ? { providerId: userId }
      : { userId };

    // Validate status against TransactionStatus enum
    if (status) {
      const validStatuses = Object.values(TransactionStatus);
      if (validStatuses.includes(status as TransactionStatus)) {
        where.status = status as TransactionStatus;
      }
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
              avatar: true,
            },
          },
          tool: {
            select: {
              id: true,
              name: true,
              dailyRate: true,
              photos: true,
            },
          },
          space: {
            select: {
              id: true,
              name: true,
              dailyRate: true,
              photos: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
              hourlyRate: true,
              photos: true,
            },
          },
          request: {
            select: {
              id: true,
              title: true,
              category: true,
            },
          },
        },
        orderBy: { createdDate: 'desc' },
        skip,
        take: safeLimit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  /**
   * Get transaction by ID
   */
  async getById(id: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatar: true,
            rating: true,
          },
        },
        tool: true,
        space: true,
        service: true,
        request: true,
        reviews: {
          include: {
            reviewer: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
        disputes: true,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    return transaction;
  }

  /**
   * Update transaction status with optimistic locking
   * @param expectedVersion - Optional version for optimistic locking (prevents concurrent updates)
   */
  async updateStatus(
    id: string,
    userId: string,
    status: 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
    expectedVersion?: number
  ) {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      select: { userId: true, providerId: true, status: true, version: true },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // Only user or provider can update status
    if (transaction.userId !== userId && transaction.providerId !== userId) {
      throw new ForbiddenError('Not authorized to update this transaction');
    }

    // Role-based authorization for specific status changes
    const isCustomer = transaction.userId === userId;
    const isProvider = transaction.providerId === userId;

    // Only provider can confirm bookings
    if (status === 'CONFIRMED' && !isProvider) {
      throw new ForbiddenError('Only the provider can confirm bookings');
    }

    // Only provider can mark as in progress
    if (status === 'IN_PROGRESS' && !isProvider) {
      throw new ForbiddenError('Only the provider can mark transaction as in progress');
    }

    // Only customer can mark as completed
    if (status === 'COMPLETED' && !isCustomer) {
      throw new ForbiddenError('Only the customer can mark transaction as completed');
    }

    // Either party can cancel (no restriction for CANCELLED status)

    // Update transaction and user counts atomically with optimistic locking
    const updated = await prisma.$transaction(async (tx) => {
      // Build where clause with optimistic locking
      const whereClause: { id: string; version?: number } = { id };
      if (expectedVersion !== undefined) {
        whereClause.version = expectedVersion;
      }

      // Update transaction with version increment
      const updatedTransaction = await tx.transaction.update({
        where: whereClause,
        data: {
          status,
          version: { increment: 1 }, // Increment version for optimistic locking
          ...(status === 'COMPLETED' && { completedDate: new Date() }),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          tool: true,
          space: true,
          service: true,
        },
      }).catch((error) => {
        // Handle optimistic locking failure (record not found with matching version)
        if (error.code === 'P2025') {
          throw new ConflictError('Transaction was modified by another request. Please refresh and try again.');
        }
        throw error;
      });

      // Update user transaction count if completed
      if (status === 'COMPLETED') {
        await tx.user.update({
          where: { id: transaction.userId },
          data: { totalTransactions: { increment: 1 } },
        });

        if (transaction.providerId) {
          await tx.user.update({
            where: { id: transaction.providerId },
            data: { totalTransactions: { increment: 1 } },
          });
        }
      }

      return updatedTransaction;
    });

    // Best-effort SMS notifications for booking status change
    try {
      const [user, provider] = await Promise.all([
        prisma.user.findUnique({
          where: { id: transaction.userId },
          select: { phone: true, name: true },
        }),
        transaction.providerId
          ? prisma.user.findUnique({
              where: { id: transaction.providerId },
              select: { phone: true, name: true },
            })
          : Promise.resolve(null),
      ]);

      const rawResourceName =
        updated.tool?.name || updated.space?.name || updated.service?.name || 'booking';
      const resourceName = sanitizeForSms(rawResourceName);

      if (user?.phone) {
        const body =
          status === 'CONFIRMED'
            ? `Your SpannerWork booking for ${resourceName} has been confirmed.`
            : status === 'CANCELLED'
            ? `Your SpannerWork booking for ${resourceName} has been cancelled.`
            : status === 'COMPLETED'
            ? `Your SpannerWork booking for ${resourceName} has been completed.`
            : `Your SpannerWork booking for ${resourceName} is now ${status}.`;

        await smsService.sendSms({ to: user.phone, body });
      }

      if (provider?.phone) {
        const body =
          status === 'CONFIRMED'
            ? `A booking for ${resourceName} has been confirmed.`
            : status === 'CANCELLED'
            ? `A booking for ${resourceName} has been cancelled.`
            : status === 'COMPLETED'
            ? `A booking for ${resourceName} has been completed.`
            : `A booking for ${resourceName} is now ${status}.`;

        await smsService.sendSms({ to: provider.phone, body });
      }
    } catch (error) {
      logger.error('Error sending SMS notifications for transaction status', error);
    }

    return updated;
  }

  /**
   * Complete a transaction
   */
  async complete(id: string, userId: string) {
    return this.updateStatus(id, userId, 'COMPLETED');
  }

  /**
   * Cancel a transaction
   * Both the customer (userId) and provider (providerId) can cancel
   */
  async cancel(id: string, userId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      select: { userId: true, providerId: true, status: true },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // Allow both customer AND provider to cancel
    if (transaction.userId !== userId && transaction.providerId !== userId) {
      throw new ForbiddenError('Not authorized to cancel this transaction');
    }

    if (!['PENDING', 'CONFIRMED'].includes(transaction.status)) {
      throw new BadRequestError('Cannot cancel a transaction that is already in progress or completed');
    }

    return this.updateStatus(id, userId, 'CANCELLED');
  }
}

export const transactionService = new TransactionService();
