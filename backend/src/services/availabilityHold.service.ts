/**
 * Availability Hold Service
 *
 * FIX: Prevents race conditions between availability check and booking creation
 * by creating temporary holds that reserve a slot for a configurable period.
 *
 * Flow:
 * 1. User checks availability -> system creates a hold token (valid for 10 minutes)
 * 2. User submits booking with hold token -> system validates token and creates booking
 * 3. If no booking within 10 minutes, hold expires automatically
 */

import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';

// Hold duration in minutes
const HOLD_DURATION_MINUTES = 10;

// Maximum holds per user per listing type
const MAX_HOLDS_PER_USER = 3;

export interface CreateHoldParams {
  userId: string;
  toolId?: string;
  spaceId?: string;
  serviceId?: string;
  startDate: Date;
  endDate: Date;
}

export interface ValidateHoldParams {
  token: string;
  userId: string;
}

class AvailabilityHoldService {
  /**
   * Create a hold token after successful availability check
   * The hold prevents others from booking the same slot for HOLD_DURATION_MINUTES
   */
  async createHold(params: CreateHoldParams): Promise<{ token: string; expiresAt: Date }> {
    const { userId, toolId, spaceId, serviceId, startDate, endDate } = params;

    // Validate that exactly one listing type is specified
    const listingCount = [toolId, spaceId, serviceId].filter(Boolean).length;
    if (listingCount !== 1) {
      throw new BadRequestError('Exactly one of toolId, spaceId, or serviceId must be provided');
    }

    // Check user's active hold count to prevent abuse
    const activeHoldsCount = await prisma.availabilityHold.count({
      where: {
        userId,
        expiresAt: { gt: new Date() },
        consumed: false,
      },
    });

    if (activeHoldsCount >= MAX_HOLDS_PER_USER) {
      throw new ConflictError(
        `You can only have ${MAX_HOLDS_PER_USER} active holds at a time. ` +
        'Please complete or wait for your existing holds to expire.'
      );
    }

    const expiresAt = new Date(Date.now() + HOLD_DURATION_MINUTES * 60 * 1000);

    // Use a transaction to atomically check for conflicts and create hold
    const hold = await prisma.$transaction(async (tx) => {
      // Check for existing active holds on this slot
      const conflictingHold = await tx.availabilityHold.findFirst({
        where: {
          ...(toolId && { toolId }),
          ...(spaceId && { spaceId }),
          ...(serviceId && { serviceId }),
          expiresAt: { gt: new Date() },
          consumed: false,
          OR: [
            {
              AND: [
                { startDate: { lte: startDate } },
                { endDate: { gte: startDate } },
              ],
            },
            {
              AND: [
                { startDate: { lte: endDate } },
                { endDate: { gte: endDate } },
              ],
            },
            {
              AND: [
                { startDate: { gte: startDate } },
                { endDate: { lte: endDate } },
              ],
            },
          ],
        },
      });

      if (conflictingHold) {
        // If it's the same user, return their existing hold
        if (conflictingHold.userId === userId) {
          return conflictingHold;
        }
        throw new ConflictError(
          'This slot is currently being held by another user. Please try again in a few minutes.'
        );
      }

      // Check for existing transactions (active bookings)
      const listingField = toolId ? 'toolId' : spaceId ? 'spaceId' : 'serviceId';
      const listingId = toolId || spaceId || serviceId;

      const conflictingTransaction = await tx.transaction.findFirst({
        where: {
          [listingField]: listingId,
          status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
          OR: [
            {
              AND: [
                { startDate: { lte: startDate } },
                { endDate: { gte: startDate } },
              ],
            },
            {
              AND: [
                { startDate: { lte: endDate } },
                { endDate: { gte: endDate } },
              ],
            },
            {
              AND: [
                { startDate: { gte: startDate } },
                { endDate: { lte: endDate } },
              ],
            },
          ],
        },
      });

      if (conflictingTransaction) {
        throw new ConflictError('This slot is no longer available. Please choose different dates.');
      }

      // Create the hold
      return tx.availabilityHold.create({
        data: {
          userId,
          toolId,
          spaceId,
          serviceId,
          startDate,
          endDate,
          expiresAt,
        },
      });
    });

    logger.info('Availability hold created', {
      holdId: hold.id,
      token: hold.token,
      userId,
      toolId,
      spaceId,
      serviceId,
      expiresAt,
    });

    return {
      token: hold.token,
      expiresAt: hold.expiresAt,
    };
  }

  /**
   * Validate a hold token before creating a booking
   * Returns the hold details if valid, throws if invalid/expired
   */
  async validateHold(params: ValidateHoldParams) {
    const { token, userId } = params;

    const hold = await prisma.availabilityHold.findUnique({
      where: { token },
    });

    if (!hold) {
      throw new NotFoundError('Hold token not found. Please check availability again.');
    }

    if (hold.userId !== userId) {
      throw new BadRequestError('This hold token belongs to a different user.');
    }

    if (hold.consumed) {
      throw new BadRequestError('This hold token has already been used.');
    }

    if (hold.expiresAt < new Date()) {
      throw new BadRequestError(
        'This hold has expired. Please check availability and try again.'
      );
    }

    return {
      holdId: hold.id,
      toolId: hold.toolId,
      spaceId: hold.spaceId,
      serviceId: hold.serviceId,
      startDate: hold.startDate,
      endDate: hold.endDate,
      expiresAt: hold.expiresAt,
    };
  }

  /**
   * Validate and consume a hold atomically within a transaction
   * FIX: This prevents race conditions where two requests try to use the same hold
   * Should be called from within the booking transaction
   */
  async validateAndConsumeHoldInTransaction(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    token: string,
    userId: string
  ) {
    // Use FOR UPDATE to lock the hold row and prevent concurrent access
    const holds = await tx.$queryRaw<Array<{
      id: string;
      userId: string;
      toolId: string | null;
      spaceId: string | null;
      serviceId: string | null;
      startDate: Date;
      endDate: Date;
      expiresAt: Date;
      consumed: boolean;
    }>>`
      SELECT id, "userId", "toolId", "spaceId", "serviceId", "startDate", "endDate", "expiresAt", consumed
      FROM availability_holds
      WHERE token = ${token}
      FOR UPDATE
    `;

    if (holds.length === 0) {
      throw new NotFoundError('Hold token not found. Please check availability again.');
    }

    const hold = holds[0];

    if (hold.userId !== userId) {
      throw new BadRequestError('This hold token belongs to a different user.');
    }

    if (hold.consumed) {
      throw new BadRequestError('This hold token has already been used.');
    }

    if (hold.expiresAt < new Date()) {
      throw new BadRequestError(
        'This hold has expired. Please check availability and try again.'
      );
    }

    // Mark as consumed atomically
    await tx.availabilityHold.update({
      where: { id: hold.id },
      data: {
        consumed: true,
        consumedAt: new Date(),
      },
    });

    logger.info('Availability hold validated and consumed atomically', { token, userId });

    return {
      holdId: hold.id,
      toolId: hold.toolId,
      spaceId: hold.spaceId,
      serviceId: hold.serviceId,
      startDate: hold.startDate,
      endDate: hold.endDate,
    };
  }

  /**
   * Consume a hold token when a booking is successfully created
   * This marks the hold as used so it can't be reused
   */
  async consumeHold(token: string): Promise<void> {
    const result = await prisma.availabilityHold.updateMany({
      where: {
        token,
        consumed: false,
        expiresAt: { gt: new Date() },
      },
      data: {
        consumed: true,
        consumedAt: new Date(),
      },
    });

    if (result.count === 0) {
      logger.warn('Attempted to consume invalid or already consumed hold', { token });
    } else {
      logger.info('Availability hold consumed', { token });
    }
  }

  /**
   * Release a hold (e.g., if user cancels the booking process)
   */
  async releaseHold(token: string, userId: string): Promise<void> {
    const result = await prisma.availabilityHold.deleteMany({
      where: {
        token,
        userId,
        consumed: false,
      },
    });

    if (result.count > 0) {
      logger.info('Availability hold released', { token, userId });
    }
  }

  /**
   * Get active holds for a user
   */
  async getUserHolds(userId: string) {
    return prisma.availabilityHold.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
        consumed: false,
      },
      include: {
        tool: { select: { id: true, name: true } },
        space: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Clean up expired holds (can be called periodically by a scheduled job)
   */
  async cleanupExpiredHolds(): Promise<number> {
    const result = await prisma.availabilityHold.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { consumed: true, consumedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        ],
      },
    });

    if (result.count > 0) {
      logger.info(`Cleaned up ${result.count} expired availability holds`);
    }

    return result.count;
  }

  /**
   * Check if a slot has any active holds (excluding a specific user)
   * Used to show "slot being held" status in UI
   */
  async hasActiveHold(params: {
    toolId?: string;
    spaceId?: string;
    serviceId?: string;
    startDate: Date;
    endDate: Date;
    excludeUserId?: string;
  }): Promise<boolean> {
    const { toolId, spaceId, serviceId, startDate, endDate, excludeUserId } = params;

    const hold = await prisma.availabilityHold.findFirst({
      where: {
        ...(toolId && { toolId }),
        ...(spaceId && { spaceId }),
        ...(serviceId && { serviceId }),
        ...(excludeUserId && { userId: { not: excludeUserId } }),
        expiresAt: { gt: new Date() },
        consumed: false,
        OR: [
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gte: startDate } },
            ],
          },
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: endDate } },
            ],
          },
          {
            AND: [
              { startDate: { gte: startDate } },
              { endDate: { lte: endDate } },
            ],
          },
        ],
      },
    });

    return !!hold;
  }
}

export const availabilityHoldService = new AvailabilityHoldService();
