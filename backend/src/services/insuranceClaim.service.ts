/**
 * Insurance Claim Service
 *
 * Handles the insurance claim workflow:
 * - Filing claims against transactions
 * - Evidence upload and management
 * - Admin review and settlement
 * - Notifications throughout the process
 */

import { prisma } from '../config/database.js';
import { InsuranceClaimStatus, InsuranceClaimType } from '@prisma/client';
import { logger } from '../config/logger.js';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../utils/errors.js';
import { unifiedNotificationService } from './unifiedNotification.service.js';

export interface CreateClaimParams {
  transactionId: string;
  claimantId: string;
  claimType: InsuranceClaimType;
  incidentDate: Date;
  description: string;
  claimAmount: number; // in pence
}

export interface UpdateClaimStatusParams {
  claimId: string;
  status: InsuranceClaimStatus;
  reviewedBy: string;
  adminNotes?: string;
  settlementAmount?: number;
  rejectionReason?: string;
}

export interface AddClaimEvidenceParams {
  claimId: string;
  uploaderId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  description?: string;
}

class InsuranceClaimService {
  /**
   * File a new insurance claim
   */
  async create(params: CreateClaimParams) {
    const { transactionId, claimantId, claimType, incidentDate, description, claimAmount } = params;

    // Verify transaction exists
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        userId: true,
        providerId: true,
        status: true,
        startDate: true,
        endDate: true,
        totalAmount: true,
        rentalFee: true,
        tool: { select: { name: true, dailyRate: true } },
        space: { select: { name: true, hourlyRate: true } },
        service: { select: { name: true, hourlyRate: true } },
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // Validate transaction status - only allow claims on completed or in-progress transactions
    const allowedStatuses = ['COMPLETED', 'IN_PROGRESS'];
    if (!allowedStatuses.includes(transaction.status)) {
      throw new BadRequestError(
        `Cannot file a claim against a ${transaction.status.toLowerCase()} transaction. ` +
        'Claims can only be filed for completed or in-progress transactions.'
      );
    }

    // Validate claim amount - max 3x transaction value or £50k absolute cap
    const MAX_CLAIM_MULTIPLIER = 3;
    const MAX_ABSOLUTE_CLAIM = 50000_00; // £50,000 maximum in pence
    // FIX: Minimum transaction value required to file a claim (prevents abuse of £0 transactions)
    const MIN_TRANSACTION_VALUE = 500; // £5.00 minimum in pence

    const transactionValue = Number(transaction.totalAmount || transaction.rentalFee || 0);

    // FIX: Reject claims on transactions with value below minimum threshold
    // This prevents users from creating £0 transactions to access the £50k default cap
    if (transactionValue < MIN_TRANSACTION_VALUE) {
      throw new BadRequestError(
        `Insurance claims cannot be filed for transactions under £${(MIN_TRANSACTION_VALUE / 100).toFixed(2)}. ` +
        'The transaction value must be at least £5.00 to be eligible for insurance claims. ' +
        'Please contact support if you have questions about coverage.'
      );
    }

    // With the minimum threshold enforced, we can now safely calculate max claim
    const maxClaimByTransaction = transactionValue * MAX_CLAIM_MULTIPLIER;
    const effectiveMaxClaim = Math.min(maxClaimByTransaction, MAX_ABSOLUTE_CLAIM);

    if (claimAmount <= 0) {
      throw new BadRequestError('Claim amount must be greater than zero');
    }

    if (claimAmount > effectiveMaxClaim) {
      throw new BadRequestError(
        `Claim amount (£${(claimAmount / 100).toFixed(2)}) exceeds maximum allowed ` +
        `(£${(effectiveMaxClaim / 100).toFixed(2)}). For larger claims, please contact support directly.`
      );
    }

    // Verify claimant is party to the transaction
    if (transaction.userId !== claimantId && transaction.providerId !== claimantId) {
      throw new ForbiddenError('You can only file claims for transactions you were part of');
    }

    // Claim filing deadline - 90 days from transaction end
    const CLAIM_DEADLINE_DAYS = 90;
    const transactionEnd = new Date(transaction.endDate);
    const deadlineDate = new Date(transactionEnd.getTime() + CLAIM_DEADLINE_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();

    if (now > deadlineDate) {
      const daysSinceEnd = Math.floor((now.getTime() - transactionEnd.getTime()) / (24 * 60 * 60 * 1000));
      throw new BadRequestError(
        `Claims must be filed within ${CLAIM_DEADLINE_DAYS} days of the transaction end date. ` +
        `This transaction ended ${daysSinceEnd} days ago. Please contact support if you have exceptional circumstances.`
      );
    }

    // Verify incident date is within transaction period (with some buffer)
    const transactionStart = new Date(transaction.startDate);
    // transactionEnd already declared above for deadline check
    const bufferDays = 7; // Allow claims up to 7 days after transaction end
    const maxClaimDate = new Date(transactionEnd.getTime() + bufferDays * 24 * 60 * 60 * 1000);

    if (incidentDate < transactionStart || incidentDate > maxClaimDate) {
      throw new BadRequestError(
        `Incident date must be within the transaction period or within ${bufferDays} days after`
      );
    }

    // Check for existing claims - only one claim per transaction per claimant
    // Use transaction to prevent race conditions with concurrent claim creation
    const existingClaimByUser = await prisma.insuranceClaim.findFirst({
      where: {
        transactionId,
        claimantId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingClaimByUser) {
      if (existingClaimByUser.status === 'SUBMITTED' || existingClaimByUser.status === 'UNDER_REVIEW' ||
          existingClaimByUser.status === 'ADDITIONAL_INFO' || existingClaimByUser.status === 'APPROVED') {
        throw new ConflictError('You already have an active claim on this transaction');
      }
      // Prevent filing new claims after rejection/settlement to prevent abuse
      if (existingClaimByUser.status === 'REJECTED') {
        throw new ConflictError(
          'Your previous claim on this transaction was rejected. ' +
          'Please contact support if you believe this was in error.'
        );
      }
      if (existingClaimByUser.status === 'SETTLED') {
        throw new ConflictError(
          'A claim has already been settled for this transaction. ' +
          'You cannot file additional claims.'
        );
      }
      // WITHDRAWN claims can be re-filed (user chose to withdraw)
    }

    // Prevent double claims - check if OTHER party has already filed a settled/approved claim
    const existingClaimByOtherParty = await prisma.insuranceClaim.findFirst({
      where: {
        transactionId,
        claimantId: { not: claimantId }, // Other party
        status: { in: ['APPROVED', 'SETTLED'] },
      },
    });

    if (existingClaimByOtherParty) {
      throw new ConflictError(
        'A claim on this transaction has already been approved or settled. ' +
        'If you believe you are also entitled to compensation, please contact support to review the case.'
      );
    }

    // Find applicable insurance document (for provider's liability claims)
    let insuranceDocumentId: string | null = null;
    if (transaction.providerId) {
      const insuranceDoc = await prisma.insuranceDocument.findFirst({
        where: {
          userId: transaction.providerId,
          status: 'APPROVED',
          documentType: 'PUBLIC_LIABILITY',
          OR: [
            { expiryDate: null },
            { expiryDate: { gt: new Date() } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
      insuranceDocumentId = insuranceDoc?.id || null;
    }

    const claim = await prisma.insuranceClaim.create({
      data: {
        transactionId,
        claimantId,
        insuranceDocumentId,
        claimType,
        incidentDate,
        description,
        claimAmount,
        status: 'SUBMITTED',
      },
      include: {
        transaction: {
          select: {
            id: true,
            tool: { select: { name: true } },
            space: { select: { name: true } },
            service: { select: { name: true } },
          },
        },
        claimant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    logger.info('Insurance claim created', {
      claimId: claim.id,
      transactionId,
      claimantId,
      claimType,
      claimAmount,
    });

    return claim;
  }

  /**
   * Get claim by ID
   */
  async getById(claimId: string, userId?: string, isAdmin = false) {
    const claim = await prisma.insuranceClaim.findUnique({
      where: { id: claimId },
      include: {
        transaction: {
          select: {
            id: true,
            userId: true,
            providerId: true,
            startDate: true,
            endDate: true,
            totalAmount: true,
            tool: { select: { id: true, name: true } },
            space: { select: { id: true, name: true } },
            service: { select: { id: true, name: true } },
          },
        },
        claimant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        insuranceDocument: {
          select: {
            id: true,
            documentType: true,
            provider: true,
            policyNumber: true,
            coverageAmount: true,
          },
        },
        evidence: {
          include: {
            uploader: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!claim) {
      throw new NotFoundError('Insurance claim not found');
    }

    // Authorization check
    if (!isAdmin && userId) {
      const isParty =
        claim.claimantId === userId ||
        claim.transaction.userId === userId ||
        claim.transaction.providerId === userId;
      if (!isParty) {
        throw new ForbiddenError('Not authorized to view this claim');
      }
    }

    return claim;
  }

  /**
   * List claims for a user
   */
  async listByUser(userId: string, options: { page?: number; limit?: number; status?: InsuranceClaimStatus } = {}) {
    const { page = 1, limit = 20, status } = options;
    const skip = (page - 1) * limit;

    const where = {
      OR: [
        { claimantId: userId },
        { transaction: { userId } },
        { transaction: { providerId: userId } },
      ],
      ...(status && { status }),
    };

    const [claims, total] = await Promise.all([
      prisma.insuranceClaim.findMany({
        where,
        include: {
          transaction: {
            select: {
              id: true,
              tool: { select: { name: true } },
              space: { select: { name: true } },
              service: { select: { name: true } },
            },
          },
          claimant: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.insuranceClaim.count({ where }),
    ]);

    return {
      claims,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List all claims (admin)
   */
  async listAll(options: {
    page?: number;
    limit?: number;
    status?: InsuranceClaimStatus;
    claimType?: InsuranceClaimType;
  } = {}) {
    const { page = 1, limit = 20, status, claimType } = options;
    const skip = (page - 1) * limit;

    const where = {
      ...(status && { status }),
      ...(claimType && { claimType }),
    };

    const [claims, total] = await Promise.all([
      prisma.insuranceClaim.findMany({
        where,
        include: {
          transaction: {
            select: {
              id: true,
              userId: true,
              providerId: true,
              tool: { select: { name: true } },
              space: { select: { name: true } },
              service: { select: { name: true } },
            },
          },
          claimant: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          insuranceDocument: {
            select: {
              provider: true,
              policyNumber: true,
              coverageAmount: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.insuranceClaim.count({ where }),
    ]);

    return {
      claims,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update claim status (admin only)
   */
  async updateStatus(params: UpdateClaimStatusParams) {
    const { claimId, status, reviewedBy, adminNotes, settlementAmount, rejectionReason } = params;

    const claim = await prisma.insuranceClaim.findUnique({
      where: { id: claimId },
      include: {
        claimant: {
          select: { id: true, name: true, email: true },
        },
      },
    }) as (Awaited<ReturnType<typeof prisma.insuranceClaim.findUnique>> & {
      claimAmount: number;
      insuranceDocumentId: string | null
    }) | null;

    if (!claim) {
      throw new NotFoundError('Insurance claim not found');
    }

    // Validate status transitions
    const validTransitions: Record<InsuranceClaimStatus, InsuranceClaimStatus[]> = {
      SUBMITTED: ['UNDER_REVIEW', 'REJECTED', 'WITHDRAWN'],
      UNDER_REVIEW: ['ADDITIONAL_INFO', 'APPROVED', 'REJECTED'],
      ADDITIONAL_INFO: ['UNDER_REVIEW', 'REJECTED', 'WITHDRAWN'],
      APPROVED: ['SETTLED', 'REJECTED'],
      SETTLED: [], // Final state
      REJECTED: [], // Final state
      WITHDRAWN: [], // Final state
    };

    if (!validTransitions[claim.status].includes(status)) {
      throw new BadRequestError(
        `Cannot transition from ${claim.status} to ${status}`
      );
    }

    // Require rejection reason if rejecting
    if (status === 'REJECTED' && !rejectionReason) {
      throw new BadRequestError('Rejection reason is required');
    }

    // Require settlement amount if settling
    if (status === 'SETTLED' && settlementAmount === undefined) {
      throw new BadRequestError('Settlement amount is required when settling a claim');
    }

    // Validate settlement amount against claim amount and policy coverage
    if (status === 'SETTLED' && settlementAmount !== undefined) {
      if (settlementAmount < 0) {
        throw new BadRequestError('Settlement amount cannot be negative');
      }

      if (settlementAmount > claim.claimAmount) {
        throw new BadRequestError(
          `Settlement amount (£${(settlementAmount / 100).toFixed(2)}) cannot exceed ` +
          `the claimed amount (£${(claim.claimAmount / 100).toFixed(2)})`
        );
      }

      // Fetch insurance document to check coverage limit and expiry
      if (claim.insuranceDocumentId) {
        const insuranceDoc = await prisma.insuranceDocument.findUnique({
          where: { id: claim.insuranceDocumentId },
          select: { coverageAmount: true, expiryDate: true, status: true },
        });

        // Verify insurance document is still valid at settlement time
        if (insuranceDoc) {
          if (insuranceDoc.status !== 'APPROVED') {
            throw new BadRequestError(
              `Cannot settle claim: The linked insurance document is no longer approved (status: ${insuranceDoc.status}). ` +
              'Please contact the claimant to provide updated insurance documentation.'
            );
          }

          if (insuranceDoc.expiryDate && new Date(insuranceDoc.expiryDate) < new Date()) {
            throw new BadRequestError(
              'Cannot settle claim: The linked insurance policy has expired. ' +
              'Please contact the claimant to provide updated insurance documentation or process through alternative means.'
            );
          }

          // Check settlement against remaining policy coverage (aggregate tracking)
          if (insuranceDoc.coverageAmount) {
            // Calculate total previously settled against this policy
            const previousSettlements = await prisma.insuranceClaim.aggregate({
              where: {
                insuranceDocumentId: claim.insuranceDocumentId,
                status: 'SETTLED',
                id: { not: claimId }, // Exclude current claim
              },
              _sum: { settlementAmount: true },
            });

            const totalPreviouslySettled = previousSettlements._sum.settlementAmount || 0;
            const remainingCoverage = insuranceDoc.coverageAmount - totalPreviouslySettled;

            if (settlementAmount > remainingCoverage) {
              throw new BadRequestError(
                `Settlement amount (£${(settlementAmount / 100).toFixed(2)}) exceeds remaining policy coverage. ` +
                `Policy limit: £${(insuranceDoc.coverageAmount / 100).toFixed(2)}, ` +
                `previously settled: £${(totalPreviouslySettled / 100).toFixed(2)}, ` +
                `remaining: £${(remainingCoverage / 100).toFixed(2)}.`
              );
            }
          }
        }
      }
    }

    const updated = await prisma.insuranceClaim.update({
      where: { id: claimId },
      data: {
        status,
        adminNotes: adminNotes || claim.adminNotes,
        settlementAmount: status === 'SETTLED' ? settlementAmount : claim.settlementAmount,
        rejectionReason: status === 'REJECTED' ? rejectionReason : null,
        reviewedAt: new Date(),
        reviewedBy,
        ...(status === 'SETTLED' && { settledAt: new Date() }),
      },
      include: {
        claimant: {
          select: { id: true, name: true, email: true },
        },
        transaction: {
          select: {
            id: true,
            tool: { select: { name: true } },
            space: { select: { name: true } },
            service: { select: { name: true } },
          },
        },
      },
    });

    logger.info('Insurance claim status updated', {
      claimId,
      oldStatus: claim.status,
      newStatus: status,
      reviewedBy,
    });

    // Notify claimant of status change
    try {
      const statusMessage = status === 'SETTLED'
        ? `Your insurance claim has been settled for £${((settlementAmount || 0) / 100).toFixed(2)}`
        : status === 'REJECTED'
        ? `Your insurance claim has been rejected: ${rejectionReason}`
        : status === 'ADDITIONAL_INFO'
        ? 'We need additional information for your insurance claim'
        : `Your insurance claim status has been updated to ${status}`;

      await unifiedNotificationService.send({
        userId: claim.claimantId,
        type: 'system_critical',
        title: 'Insurance Claim Update',
        body: statusMessage,
        smsBody: `SpannerWork: Claim #${claimId.slice(-6)} ${status.toLowerCase().replace('_', ' ')}`,
      });
    } catch (error) {
      logger.error('Failed to send claim status notification', error);
    }

    return updated;
  }

  // FIX: Evidence file validation constants (mirrored from dispute.service.ts)
  private static readonly MAX_EVIDENCE_PER_USER = 10;
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly ALLOWED_FILE_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'video/mp4', 'video/quicktime', // Allow videos for incident footage
  ];
  private static readonly DAILY_UPLOAD_LIMIT = 20;

  /**
   * Validate that file URL points to our storage bucket (prevent SSRF/external file injection)
   */
  private validateFileUrl(fileUrl: string): void {
    // Accept common cloud storage patterns
    const allowedPatterns = [
      /^https:\/\/[a-z0-9-]+\.s3\.[a-z0-9-]+\.amazonaws\.com\//,
      /^https:\/\/[a-z0-9-]+\.r2\.cloudflarestorage\.com\//,
      /^https:\/\/storage\.googleapis\.com\//,
      /^\/uploads\//,  // Local uploads path
    ];

    const isValid = allowedPatterns.some(pattern => pattern.test(fileUrl));
    if (!isValid) {
      logger.warn('Invalid file URL rejected', { fileUrl: fileUrl.substring(0, 100) });
      throw new BadRequestError(
        'File URL must point to our storage. Please upload files through the proper upload endpoint.'
      );
    }
  }

  /**
   * Add evidence to a claim
   * FIX: Added comprehensive file validation (matching dispute evidence validation)
   */
  async addEvidence(params: AddClaimEvidenceParams) {
    const { claimId, uploaderId, fileUrl, fileName, fileType, fileSize, description } = params;

    // FIX: Validate file URL to prevent SSRF attacks
    this.validateFileUrl(fileUrl);

    // FIX: Validate file type
    if (!InsuranceClaimService.ALLOWED_FILE_TYPES.includes(fileType)) {
      throw new BadRequestError(
        `File type '${fileType}' is not allowed. Allowed types: images (JPEG, PNG, GIF, WebP), PDF, and videos (MP4, MOV).`
      );
    }

    // FIX: Validate file size
    if (fileSize > InsuranceClaimService.MAX_FILE_SIZE) {
      throw new BadRequestError(
        `File size (${(fileSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (10MB).`
      );
    }

    if (fileSize <= 0) {
      throw new BadRequestError('Invalid file size');
    }

    const claim = await prisma.insuranceClaim.findUnique({
      where: { id: claimId },
      select: {
        id: true,
        claimantId: true,
        status: true,
        transaction: {
          select: { userId: true, providerId: true },
        },
      },
    });

    if (!claim) {
      throw new NotFoundError('Insurance claim not found');
    }

    // Check authorization
    const isParty =
      claim.claimantId === uploaderId ||
      claim.transaction.userId === uploaderId ||
      claim.transaction.providerId === uploaderId;

    if (!isParty) {
      throw new ForbiddenError('Not authorized to add evidence to this claim');
    }

    // Check claim is still open for evidence
    const closedStatuses: InsuranceClaimStatus[] = ['SETTLED', 'REJECTED', 'WITHDRAWN'];
    if (closedStatuses.includes(claim.status)) {
      throw new BadRequestError('Cannot add evidence to a closed claim');
    }

    // FIX: Check evidence count limit per user per claim
    const existingEvidenceCount = await prisma.insuranceClaimEvidence.count({
      where: {
        claimId,
        uploaderId,
      },
    });

    if (existingEvidenceCount >= InsuranceClaimService.MAX_EVIDENCE_PER_USER) {
      throw new BadRequestError(
        `Maximum evidence limit reached (${InsuranceClaimService.MAX_EVIDENCE_PER_USER} files per user). ` +
        'Please contact support if you need to submit more evidence.'
      );
    }

    // FIX: Check daily upload limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyUploads = await prisma.insuranceClaimEvidence.count({
      where: {
        uploaderId,
        createdAt: { gte: today },
      },
    });

    if (dailyUploads >= InsuranceClaimService.DAILY_UPLOAD_LIMIT) {
      throw new BadRequestError(
        `Daily upload limit reached (${InsuranceClaimService.DAILY_UPLOAD_LIMIT} files). Please try again tomorrow.`
      );
    }

    const evidence = await prisma.insuranceClaimEvidence.create({
      data: {
        claimId,
        uploaderId,
        fileUrl,
        fileName,
        fileType,
        fileSize,
        description,
      },
      include: {
        uploader: {
          select: { id: true, name: true },
        },
      },
    });

    logger.info('Evidence added to insurance claim', {
      claimId,
      evidenceId: evidence.id,
      uploaderId,
    });

    return evidence;
  }

  /**
   * Delete evidence from a claim
   */
  async deleteEvidence(evidenceId: string, userId: string) {
    const evidence = await prisma.insuranceClaimEvidence.findUnique({
      where: { id: evidenceId },
      include: {
        claim: {
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

    // FIX: Block evidence deletion during UNDER_REVIEW as well (matching dispute.service.ts behavior)
    // Once admin starts reviewing, evidence must be immutable to prevent manipulation
    const immutableStatuses: InsuranceClaimStatus[] = ['UNDER_REVIEW', 'APPROVED', 'SETTLED', 'REJECTED', 'WITHDRAWN'];
    if (immutableStatuses.includes(evidence.claim.status)) {
      throw new BadRequestError(
        evidence.claim.status === 'UNDER_REVIEW'
          ? 'Cannot delete evidence while claim is under review. Evidence submitted during review is immutable.'
          : 'Cannot delete evidence from a closed claim'
      );
    }

    await prisma.insuranceClaimEvidence.delete({
      where: { id: evidenceId },
    });

    logger.info('Evidence deleted from insurance claim', { evidenceId, userId });

    return { success: true };
  }

  /**
   * Withdraw a claim (claimant only)
   */
  async withdraw(claimId: string, userId: string) {
    const claim = await prisma.insuranceClaim.findUnique({
      where: { id: claimId },
    });

    if (!claim) {
      throw new NotFoundError('Insurance claim not found');
    }

    if (claim.claimantId !== userId) {
      throw new ForbiddenError('Only the claimant can withdraw a claim');
    }

    const withdrawableStatuses: InsuranceClaimStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'ADDITIONAL_INFO'];
    if (!withdrawableStatuses.includes(claim.status)) {
      throw new BadRequestError('This claim cannot be withdrawn at this stage');
    }

    const withdrawn = await prisma.insuranceClaim.update({
      where: { id: claimId },
      data: {
        status: 'WITHDRAWN',
        updatedAt: new Date(),
      },
    });

    logger.info('Insurance claim withdrawn', { claimId, userId });

    return withdrawn;
  }

  /**
   * Get claim statistics (admin)
   */
  async getStats() {
    const [byStatus, byType, recentClaims, totalSettled] = await Promise.all([
      prisma.insuranceClaim.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.insuranceClaim.groupBy({
        by: ['claimType'],
        _count: { id: true },
      }),
      prisma.insuranceClaim.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      }),
      prisma.insuranceClaim.aggregate({
        where: { status: 'SETTLED' },
        _sum: { settlementAmount: true },
        _count: { id: true },
      }),
    ]);

    return {
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
      byType: byType.reduce((acc, item) => {
        acc[item.claimType] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
      recentClaims,
      totalSettled: {
        count: totalSettled._count.id,
        amount: totalSettled._sum.settlementAmount || 0,
      },
    };
  }
}

export const insuranceClaimService = new InsuranceClaimService();
