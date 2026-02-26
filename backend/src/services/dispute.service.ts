import { prisma } from '../config/database.js';
import { Prisma } from '@prisma/client';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../utils/errors.js';
import { unifiedNotificationService } from './unifiedNotification.service.js';
import { logger } from '../config/logger.js';
import { stripeService } from './stripe.service.js';

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
    // SECURITY: Disputes can only be filed within 90 days of transaction
    const DISPUTE_FILING_DEADLINE_DAYS = 90;

    // Check if transaction exists
    const transaction = await prisma.transaction.findUnique({
      where: { id: data.transactionId },
      select: {
        id: true,
        userId: true,
        providerId: true,
        status: true,
        completedDate: true,
        endDate: true,
        createdDate: true,
        totalAmount: true,
        rentalFee: true,
        totalRefunded: true,
        paymentStatus: true,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // SECURITY: Check dispute filing deadline
    // Use completedDate, endDate, or createdDate (whichever is latest/most relevant)
    const referenceDate = transaction.completedDate || transaction.endDate || transaction.createdDate;
    const daysSinceTransaction = (Date.now() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceTransaction > DISPUTE_FILING_DEADLINE_DAYS) {
      throw new BadRequestError(
        `Disputes must be filed within ${DISPUTE_FILING_DEADLINE_DAYS} days of transaction completion. ` +
        `This transaction is ${Math.floor(daysSinceTransaction)} days old. Please contact support for assistance.`
      );
    }

    // FIX: Check if transaction already has significant refunds
    // Warn users about existing refunds to prevent settlement confusion
    const transactionAmount = Number(transaction.totalAmount || transaction.rentalFee || 0);
    const alreadyRefunded = Number(transaction.totalRefunded || 0);

    if (transaction.paymentStatus === 'REFUNDED') {
      throw new BadRequestError(
        'This transaction has already been fully refunded. ' +
        'If you have additional concerns, please contact support directly.'
      );
    }

    if (alreadyRefunded > 0 && transactionAmount > 0) {
      const refundPercentage = (alreadyRefunded / transactionAmount) * 100;
      // If more than 50% already refunded, require manual review via support
      if (refundPercentage >= 50) {
        throw new BadRequestError(
          `This transaction has already been ${refundPercentage.toFixed(0)}% refunded ` +
          `(£${(alreadyRefunded / 100).toFixed(2)} of £${(transactionAmount / 100).toFixed(2)}). ` +
          'For transactions with significant existing refunds, please contact support directly to discuss your case.'
        );
      }
      // Log warning for partial refunds under 50%
      logger.warn('Dispute filed on partially refunded transaction', {
        transactionId: data.transactionId,
        initiatorId: data.initiatorId,
        alreadyRefunded,
        transactionAmount,
        refundPercentage,
      });
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

    // Check if dispute already exists (including resolved/closed to prevent repeated disputes)
    const existingDispute = await prisma.dispute.findFirst({
      where: {
        transactionId: data.transactionId,
      },
      orderBy: { createdDate: 'desc' },
    });

    if (existingDispute) {
      if (existingDispute.status === 'OPEN' || existingDispute.status === 'UNDER_REVIEW') {
        throw new ConflictError('An active dispute already exists for this transaction');
      }
      // Only allow one dispute per transaction to prevent repeated dispute abuse
      if (existingDispute.status === 'RESOLVED' || existingDispute.status === 'CLOSED') {
        throw new ConflictError(
          'A dispute has already been resolved for this transaction. ' +
          'Please contact support if you need further assistance.'
        );
      }
    }

    // Calculate SLA deadline (14 days from now)
    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + 14);

    // Create dispute
    const dispute = await prisma.dispute.create({
      data: {
        transactionId: data.transactionId,
        initiatorId: data.initiatorId,
        respondentId,
        reason: data.reason,
        description: data.description,
        status: 'OPEN',
        deadlineDate,
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
   * When userId is provided, contact details are hidden for privacy.
   * Admin calls (no userId) get full contact details for support purposes.
   */
  async getById(id: string, userId?: string) {
    // For admin access (no userId), include full contact details
    // For user access, hide email/phone to protect privacy (use in-app messaging)
    const isAdminAccess = !userId;

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
                avatar: true,
                // Only include email for admin access
                ...(isAdminAccess && { email: true }),
              },
            },
          },
        },
        initiator: {
          select: {
            id: true,
            name: true,
            avatar: true,
            // Only include contact details for admin access
            ...(isAdminAccess && { email: true, phone: true }),
          },
        },
        respondent: {
          select: {
            id: true,
            name: true,
            avatar: true,
            // Only include contact details for admin access
            ...(isAdminAccess && { email: true, phone: true }),
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
   * Uses database transaction with pessimistic locking to prevent race conditions and double refunds.
   * Validates refund amounts against original transaction amount and tracks cumulative refunds.
   *
   * FIX: IMPORTANT CLARIFICATION on refund fields:
   * - refundAmountInitiator: Portion of refund attributed to the dispute initiator's claim
   * - refundAmountRespondent: Portion of refund attributed to the respondent's counter-claim
   *
   * NOTE: Both amounts are COMBINED and refunded to the CUSTOMER (renter/userId) who originally
   * paid for the transaction. The initiator/respondent fields are for TRACKING/ACCOUNTING purposes
   * only - they indicate how much of the refund was justified by each party's claims.
   *
   * The provider (providerId) does NOT receive any of this refund directly - it comes out of
   * what they would have received. For provider compensation, a separate transfer must be made.
   */
  async resolve(
    id: string,
    data: {
      resolution: string;
      /** Amount to refund to customer, attributed to initiator's claim (in pence) */
      refundAmountInitiator?: number;
      /** Amount to refund to customer, attributed to respondent's claim (in pence) */
      refundAmountRespondent?: number;
    }
  ) {
    // Wrap entire resolve operation in a transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Use FOR UPDATE to lock the dispute row during resolution
      const disputeRows = await tx.$queryRaw<Array<{
        id: string;
        status: string;
        transactionId: string;
        initiatorId: string;
        respondentId: string;
      }>>`
        SELECT id, status, "transactionId", "initiatorId", "respondentId"
        FROM disputes
        WHERE id = ${id}
        FOR UPDATE
      `;

      if (disputeRows.length === 0) {
        throw new NotFoundError('Dispute not found');
      }

      const dispute = disputeRows[0];

      if (dispute.status === 'RESOLVED' || dispute.status === 'CLOSED') {
        throw new ConflictError('Dispute is already resolved or closed');
      }

      // Fetch transaction to validate refund amounts (also locked)
      const transactionRows = await tx.$queryRaw<Array<{
        id: string;
        totalAmount: number | null;
        rentalFee: number | null;
        stripePaymentIntentId: string | null;
        paymentStatus: string;
        totalRefunded: number | null;
      }>>`
        SELECT id, "totalAmount", "rentalFee", "stripePaymentIntentId", "paymentStatus", "totalRefunded"
        FROM transactions
        WHERE id = ${dispute.transactionId}
        FOR UPDATE
      `;

      if (transactionRows.length === 0) {
        throw new NotFoundError('Associated transaction not found');
      }

      const transaction = transactionRows[0];

      const maxRefundAmount = Number(transaction.totalAmount || transaction.rentalFee || 0);
      const previouslyRefunded = Number(transaction.totalRefunded || 0);
      const refundInitiator = data.refundAmountInitiator || 0;
      const refundRespondent = data.refundAmountRespondent || 0;

      // FIX: Both refund amounts are combined and sent to the original payer (customer)
      // This is for accounting/attribution purposes only - both parties' justified amounts
      // result in a single refund to whoever made the original payment
      const totalRefund = refundInitiator + refundRespondent;

      // Validate individual refund amounts are non-negative
      if (refundInitiator < 0 || refundRespondent < 0) {
        throw new BadRequestError('Refund amounts cannot be negative');
      }

      // FIX: Log the refund attribution for clarity
      if (totalRefund > 0) {
        logger.info('Dispute refund breakdown', {
          disputeId: id,
          transactionId: dispute.transactionId,
          attributedToInitiator: refundInitiator,
          attributedToRespondent: refundRespondent,
          totalToCustomer: totalRefund,
          note: 'Both amounts combined into single refund to original payer',
        });
      }

      // Validate total refund (including previous refunds) does not exceed original amount
      const totalWithPrevious = totalRefund + previouslyRefunded;
      if (totalWithPrevious > maxRefundAmount) {
        throw new BadRequestError(
          `Total refund amount (£${(totalWithPrevious / 100).toFixed(2)}) cannot exceed ` +
          `the original transaction amount (£${(maxRefundAmount / 100).toFixed(2)}). ` +
          `Previous refunds: £${(previouslyRefunded / 100).toFixed(2)}`
        );
      }

      // Atomically update dispute status BEFORE processing refund
      const resolved = await tx.dispute.update({
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

      // Process refund if needed
      let refundProcessed = false;
      let refundError: string | null = null;

      if (totalRefund > 0 && transaction.stripePaymentIntentId && transaction.paymentStatus === 'PAID') {
        try {
          if (stripeService.isEnabled()) {
            const refundResult = await stripeService.createRefund({
              paymentIntentId: transaction.stripePaymentIntentId,
              amount: totalRefund,
              reason: 'requested_by_customer',
            });

            refundProcessed = refundResult.status === 'succeeded' || refundResult.status === 'pending';

            // Track cumulative refunds to prevent over-refunding
            const newTotalRefunded = previouslyRefunded + totalRefund;
            const newPaymentStatus = newTotalRefunded >= maxRefundAmount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

            await tx.transaction.update({
              where: { id: dispute.transactionId },
              data: {
                paymentStatus: newPaymentStatus,
                totalRefunded: newTotalRefunded,
              },
            });

            logger.info('Dispute refund processed successfully', {
              disputeId: id,
              transactionId: dispute.transactionId,
              refundAmount: totalRefund,
              totalRefunded: newTotalRefunded,
              refundId: refundResult.refundId,
            });
          } else {
            refundError = 'Stripe is not configured - refund recorded but not processed';
            logger.warn('Dispute refund recorded but Stripe not configured', {
              disputeId: id,
              transactionId: dispute.transactionId,
              refundAmount: totalRefund,
            });
          }
        } catch (error) {
          refundError = error instanceof Error ? error.message : 'Unknown error processing refund';
          logger.error('Failed to process dispute refund via Stripe', {
            disputeId: id,
            transactionId: dispute.transactionId,
            refundAmount: totalRefund,
            error,
          });
          // Re-throw to rollback the transaction if Stripe fails
          throw new BadRequestError(`Failed to process refund: ${refundError}`);
        }
      } else if (totalRefund > 0 && !transaction.stripePaymentIntentId) {
        refundError = 'No payment intent found - refund recorded but not processed';
        logger.warn('Dispute refund recorded but no payment intent found', {
          disputeId: id,
          transactionId: dispute.transactionId,
        });
      }

      // Update dispute with refund processing status if there was a non-critical error
      if (refundError && !refundError.includes('Failed to process')) {
        await tx.dispute.update({
          where: { id },
          data: {
            resolution: `${data.resolution}\n\n[System Note: Refund processing issue - ${refundError}]`,
          },
        });
      }

      return { resolved, refundProcessed, refundError, dispute };
    });

    const { resolved, refundProcessed, refundError, dispute: _dispute } = result;

    // Notify both parties of resolution (outside transaction)
    const totalRefund = (data.refundAmountInitiator || 0) + (data.refundAmountRespondent || 0);
    try {
      // Log refund status for audit trail
      if (totalRefund > 0) {
        const refundStatus = refundProcessed ? 'processed' : 'recorded';
        logger.info(`Dispute resolved with refund ${refundStatus}`, {
          disputeId: id,
          refundAmount: totalRefund,
          refundProcessed,
        });
      }

      await Promise.all([
        unifiedNotificationService.templates.disputeUpdate(
          resolved.initiatorId,
          'RESOLVED',
          id
        ),
        unifiedNotificationService.templates.disputeUpdate(
          resolved.respondentId,
          'RESOLVED',
          id
        ),
      ]);
    } catch (error) {
      logger.error('Error sending dispute resolution notifications', error);
    }

    return { ...resolved, refundProcessed, refundError };
  }

  /**
   * Update dispute status (admin only)
   * Validates status transitions to prevent reopening closed disputes.
   */
  async updateStatus(id: string, status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED') {
    const dispute = await prisma.dispute.findUnique({
      where: { id },
    });

    if (!dispute) {
      throw new NotFoundError('Dispute not found');
    }

    // Define valid status transitions
    const validTransitions: Record<string, string[]> = {
      OPEN: ['UNDER_REVIEW', 'RESOLVED', 'CLOSED'],
      UNDER_REVIEW: ['OPEN', 'RESOLVED', 'CLOSED'],
      RESOLVED: [], // Final state - cannot be changed
      CLOSED: [],   // Final state - cannot be changed
    };

    const currentStatus = dispute.status as string;
    if (!validTransitions[currentStatus]?.includes(status)) {
      throw new BadRequestError(
        `Cannot transition dispute from ${currentStatus} to ${status}. ` +
        `${currentStatus === 'RESOLVED' || currentStatus === 'CLOSED'
          ? 'Resolved and closed disputes cannot be modified.'
          : `Valid transitions from ${currentStatus}: ${validTransitions[currentStatus].join(', ') || 'none'}`}`
      );
    }

    const updated = await prisma.dispute.update({
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

    // Notify both parties of status change
    try {
      const statusDisplay = status === 'UNDER_REVIEW' ? 'Under Review' : status;
      await Promise.all([
        unifiedNotificationService.templates.disputeUpdate(
          updated.initiatorId,
          statusDisplay,
          id
        ),
        unifiedNotificationService.templates.disputeUpdate(
          updated.respondentId,
          statusDisplay,
          id
        ),
      ]);
    } catch (error) {
      logger.error('Error sending dispute status notifications', error);
    }

    return updated;
  }

  /**
   * Close a dispute
   */
  async close(id: string) {
    return this.updateStatus(id, 'CLOSED');
  }

  /**
   * Add evidence to a dispute
   */
  async addEvidence(data: {
    disputeId: string;
    uploaderId: string;
    fileUrl: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    description?: string;
  }) {
    // SECURITY: Evidence limits and validation
    const MAX_EVIDENCE_PER_USER = 10;
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_TOTAL_STORAGE_PER_USER = 100 * 1024 * 1024; // 100MB total per user across all disputes
    const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

    // Rate limiting to prevent upload abuse (upload/delete/reupload cycles)
    const DAILY_UPLOAD_LIMIT = 20;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentUploadCount = await prisma.disputeEvidence.count({
      where: {
        uploaderId: data.uploaderId,
        createdDate: { gte: oneDayAgo },
      },
    });

    if (recentUploadCount >= DAILY_UPLOAD_LIMIT) {
      throw new BadRequestError(
        `Daily upload limit reached (${DAILY_UPLOAD_LIMIT} files per day). ` +
        `Please wait before uploading more evidence, or contact support for urgent cases.`
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(data.fileType)) {
      throw new BadRequestError(
        `Invalid file type. Allowed types: ${ALLOWED_FILE_TYPES.map(t => t.split('/')[1]).join(', ')}`
      );
    }

    // Validate file size
    if (data.fileSize > MAX_FILE_SIZE) {
      throw new BadRequestError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // FIX: Check total storage quota across all disputes for this user
    const totalStorageResult = await prisma.disputeEvidence.aggregate({
      where: { uploaderId: data.uploaderId },
      _sum: { fileSize: true },
    });
    const currentTotalStorage = totalStorageResult._sum.fileSize || 0;

    if (currentTotalStorage + data.fileSize > MAX_TOTAL_STORAGE_PER_USER) {
      const usedMB = Math.round(currentTotalStorage / 1024 / 1024);
      const maxMB = MAX_TOTAL_STORAGE_PER_USER / 1024 / 1024;
      throw new BadRequestError(
        `Storage limit exceeded. You've used ${usedMB}MB of your ${maxMB}MB evidence storage quota. ` +
        'Please delete some existing evidence or contact support for assistance.'
      );
    }

    // SECURITY: Validate file URL is from trusted sources (prevent external URL injection)
    // Must be either:
    // 1. A relative path starting with /uploads/ (no path traversal)
    // 2. A full URL from our CDN domains
    const isValidRelativePath = data.fileUrl.startsWith('/uploads/') && !data.fileUrl.includes('..');
    const isValidCloudflareUrl = /^https:\/\/[a-z0-9-]+\.r2\.cloudflarestorage\.com\//.test(data.fileUrl) ||
                                  /^https:\/\/[a-z0-9-]+\.cloudflare\.com\//.test(data.fileUrl);
    const isValidS3Url = /^https:\/\/[a-z0-9-]+\.s3\.[a-z0-9-]+\.amazonaws\.com\//.test(data.fileUrl);

    if (!isValidRelativePath && !isValidCloudflareUrl && !isValidS3Url) {
      throw new BadRequestError('Invalid file URL. Files must be uploaded through the platform.');
    }

    // Check if dispute exists and is still open
    const dispute = await prisma.dispute.findUnique({
      where: { id: data.disputeId },
      select: { id: true, status: true, initiatorId: true, respondentId: true },
    });

    if (!dispute) {
      throw new NotFoundError('Dispute not found');
    }

    // Check if user is party to the dispute
    if (dispute.initiatorId !== data.uploaderId && dispute.respondentId !== data.uploaderId) {
      throw new ForbiddenError('Not authorized to add evidence to this dispute');
    }

    // Check if dispute is still open for evidence (block during UNDER_REVIEW for fairness)
    if (dispute.status === 'UNDER_REVIEW' || dispute.status === 'RESOLVED' || dispute.status === 'CLOSED') {
      throw new ConflictError(
        dispute.status === 'UNDER_REVIEW'
          ? 'Cannot add evidence while the dispute is under review. Both parties must submit evidence before admin review begins.'
          : 'Cannot add evidence to a resolved or closed dispute'
      );
    }

    // SECURITY: Check evidence count limit per user
    const existingEvidenceCount = await prisma.disputeEvidence.count({
      where: {
        disputeId: data.disputeId,
        uploaderId: data.uploaderId,
      },
    });

    if (existingEvidenceCount >= MAX_EVIDENCE_PER_USER) {
      throw new BadRequestError(
        `Maximum evidence limit reached (${MAX_EVIDENCE_PER_USER} files per user). ` +
        `Please consolidate your evidence or contact support.`
      );
    }

    // Create evidence record
    const evidence = await prisma.disputeEvidence.create({
      data: {
        disputeId: data.disputeId,
        uploaderId: data.uploaderId,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize,
        description: data.description,
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    return evidence;
  }

  /**
   * Get evidence for a dispute
   */
  async getEvidence(disputeId: string, userId?: string) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      select: { id: true, initiatorId: true, respondentId: true },
    });

    if (!dispute) {
      throw new NotFoundError('Dispute not found');
    }

    // Check authorization if userId provided (not admin)
    if (userId && dispute.initiatorId !== userId && dispute.respondentId !== userId) {
      throw new ForbiddenError('Not authorized to view evidence for this dispute');
    }

    return prisma.disputeEvidence.findMany({
      where: { disputeId },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdDate: 'asc' },
    });
  }

  /**
   * Delete evidence (only own evidence, and only if dispute is still open)
   */
  async deleteEvidence(evidenceId: string, userId: string) {
    const evidence = await prisma.disputeEvidence.findUnique({
      where: { id: evidenceId },
      include: {
        dispute: {
          select: { status: true },
        },
      },
    });

    if (!evidence) {
      throw new NotFoundError('Evidence not found');
    }

    if (evidence.uploaderId !== userId) {
      throw new ForbiddenError('Not authorized to delete this evidence');
    }

    // Block evidence deletion during review - once admin starts reviewing, evidence is immutable
    if (evidence.dispute.status === 'UNDER_REVIEW' ||
        evidence.dispute.status === 'RESOLVED' ||
        evidence.dispute.status === 'CLOSED') {
      throw new ConflictError(
        'Cannot delete evidence once the dispute is under review, resolved, or closed. ' +
        'Evidence submitted during the review process cannot be removed.'
      );
    }

    await prisma.disputeEvidence.delete({
      where: { id: evidenceId },
    });

    return { success: true };
  }
}

export const disputeService = new DisputeService();
