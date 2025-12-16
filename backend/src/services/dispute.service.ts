import { prisma } from '../config/database.js';
import { Prisma } from '@prisma/client';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../utils/errors.js';

export class DisputeService {
  /**
   * Create a dispute
   */
  async create(data: {
    initiatorId: string;
    transactionId: string;
    reason: string;
    description: string;
  }) {
    // Check if transaction exists
    const transaction = await prisma.transaction.findUnique({
      where: { id: data.transactionId },
      select: {
        id: true,
        userId: true,
        providerId: true,
        status: true,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // Check if initiator is part of the transaction
    if (
      transaction.userId !== data.initiatorId &&
      transaction.providerId !== data.initiatorId
    ) {
      throw new ForbiddenError('You can only dispute transactions you were part of');
    }

    // Determine respondent
    const respondentId =
      transaction.userId === data.initiatorId
        ? transaction.providerId
        : transaction.userId;

    if (!respondentId) {
      throw new BadRequestError('Cannot create dispute: Invalid transaction structure');
    }

    // Check if dispute already exists
    const existingDispute = await prisma.dispute.findFirst({
      where: {
        transactionId: data.transactionId,
        status: {
          in: ['OPEN', 'UNDER_REVIEW'],
        },
      },
    });

    if (existingDispute) {
      throw new ConflictError('An active dispute already exists for this transaction');
    }

    // Create dispute
    const dispute = await prisma.dispute.create({
      data: {
        transactionId: data.transactionId,
        initiatorId: data.initiatorId,
        respondentId,
        reason: data.reason,
        description: data.description,
        status: 'OPEN',
      },
      include: {
        transaction: {
          include: {
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
        },
        initiator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        respondent: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    return dispute;
  }

  /**
   * List disputes
   */
  async list(
    options: {
      userId?: string;
      status?: string;
      page?: number;
      limit?: number;
      adminView?: boolean;
    } = {}
  ) {
    const { userId, status, page = 1, limit = 20, adminView = false } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.DisputeWhereInput = {};

    // If not admin view, filter by user
    if (!adminView && userId) {
      where.OR = [{ initiatorId: userId }, { respondentId: userId }];
    }

    if (status) {
      where.status = status as unknown as Prisma.DisputeWhereInput['status'];
    }

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        include: {
          transaction: {
            select: {
              id: true,
              rentalFee: true,
              totalAmount: true,
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
          },
          initiator: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          respondent: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.dispute.count({ where }),
    ]);

    return {
      disputes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get dispute by ID
   */
  async getById(id: string, userId?: string) {
    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: {
        transaction: {
          include: {
            tool: true,
            space: true,
            service: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        initiator: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatar: true,
          },
        },
        respondent: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatar: true,
          },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundError('Dispute not found');
    }

    // Check authorization if userId provided
    if (userId && dispute.initiatorId !== userId && dispute.respondentId !== userId) {
      throw new ForbiddenError('Not authorized to view this dispute');
    }

    return dispute;
  }

  /**
   * Resolve a dispute (admin only)
   */
  async resolve(
    id: string,
    data: {
      resolution: string;
      refundAmountInitiator?: number;
      refundAmountRespondent?: number;
    }
  ) {
    const dispute = await prisma.dispute.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!dispute) {
      throw new NotFoundError('Dispute not found');
    }

    if (dispute.status === 'RESOLVED' || dispute.status === 'CLOSED') {
      throw new ConflictError('Dispute is already resolved or closed');
    }

    const resolved = await prisma.dispute.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolution: data.resolution,
        refundAmountInitiator: data.refundAmountInitiator,
        refundAmountRespondent: data.refundAmountRespondent,
        resolvedDate: new Date(),
      },
      include: {
        transaction: {
          select: {
            id: true,
            rentalFee: true,
            totalAmount: true,
          },
        },
        initiator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        respondent: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return resolved;
  }

  /**
   * Update dispute status (admin only)
   */
  async updateStatus(id: string, status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED') {
    const dispute = await prisma.dispute.findUnique({
      where: { id },
    });

    if (!dispute) {
      throw new NotFoundError('Dispute not found');
    }

    return prisma.dispute.update({
      where: { id },
      data: {
        status,
        ...(status === 'RESOLVED' && { resolvedDate: new Date() }),
      },
      include: {
        initiator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        respondent: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Close a dispute
   */
  async close(id: string) {
    return this.updateStatus(id, 'CLOSED');
  }
}

export const disputeService = new DisputeService();
