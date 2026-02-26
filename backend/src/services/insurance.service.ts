/**
 * Insurance Service
 * 
 * Handles provider insurance document management:
 * - Upload and storage of insurance certificates
 * - Admin verification workflow
 * - Expiry tracking and notifications
 * - Checking if a provider can list services
 */

import { prisma } from '../config/database.js';
import { InsuranceStatus, InsuranceType } from '@prisma/client';
import { logger } from '../config/logger.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { emailService } from './email.service.js';

// Minimum coverage amount required (£1M = 100,000,000 pence)
export const MIN_PUBLIC_LIABILITY_COVERAGE = 100000000;

export interface CreateInsuranceDocumentParams {
  userId: string;
  documentUrl: string;
  documentType?: InsuranceType;
  provider?: string;
  policyNumber?: string;
  coverageAmount?: number;
  expiryDate?: Date;
}

export interface UpdateInsuranceStatusParams {
  documentId: string;
  status: InsuranceStatus;
  reviewedBy: string;
  rejectionReason?: string;
}

export class InsuranceService {
  /**
   * Upload a new insurance document
   */
  async createDocument(params: CreateInsuranceDocumentParams) {
    const { userId, documentUrl, documentType, provider, policyNumber, coverageAmount, expiryDate } = params;

    // Validate expiry date is in the future
    if (expiryDate && expiryDate <= new Date()) {
      throw new BadRequestError('Insurance expiry date must be in the future');
    }

    const document = await prisma.insuranceDocument.create({
      data: {
        userId,
        documentUrl,
        documentType: documentType || 'PUBLIC_LIABILITY',
        provider,
        policyNumber,
        coverageAmount,
        expiryDate,
        status: 'PENDING_REVIEW',
      },
    });

    logger.info(`Insurance document created for user ${userId}`, { documentId: document.id });

    return document;
  }

  /**
   * Get all insurance documents for a user
   */
  async getDocumentsByUser(userId: string) {
    return prisma.insuranceDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a specific insurance document
   */
  async getDocumentById(documentId: string) {
    const document = await prisma.insuranceDocument.findUnique({
      where: { id: documentId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundError('Insurance document not found');
    }

    return document;
  }

  /**
   * Get all documents pending review (admin)
   */
  async getPendingDocuments(options: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [documents, total] = await Promise.all([
      prisma.insuranceDocument.findMany({
        where: { status: 'PENDING_REVIEW' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' }, // Oldest first
        skip,
        take: limit,
      }),
      prisma.insuranceDocument.count({ where: { status: 'PENDING_REVIEW' } }),
    ]);

    return {
      documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update insurance document status (admin verification)
   */
  async updateDocumentStatus(params: UpdateInsuranceStatusParams) {
    const { documentId, status, reviewedBy, rejectionReason } = params;

    const document = await prisma.insuranceDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundError('Insurance document not found');
    }

    // Require rejection reason if rejecting
    if (status === 'REJECTED' && !rejectionReason) {
      throw new BadRequestError('Rejection reason is required when rejecting a document');
    }

    // Require coverageAmount and expiryDate when approving to prevent bypass
    if (status === 'APPROVED') {
      if (document.coverageAmount === null || document.coverageAmount === undefined) {
        throw new BadRequestError(
          'Coverage amount must be specified before approving. ' +
          'Please update the document with the coverage amount from the insurance certificate.'
        );
      }
      if (document.expiryDate === null || document.expiryDate === undefined) {
        throw new BadRequestError(
          'Expiry date must be specified before approving. ' +
          'Please update the document with the expiry date from the insurance certificate.'
        );
      }
      if (document.coverageAmount < MIN_PUBLIC_LIABILITY_COVERAGE) {
        const minInPounds = MIN_PUBLIC_LIABILITY_COVERAGE / 100;
        const providedInPounds = document.coverageAmount / 100;
        throw new BadRequestError(
          `Insurance coverage of £${providedInPounds.toLocaleString()} is below the minimum requirement of £${minInPounds.toLocaleString()}. ` +
          'Cannot approve documents with insufficient coverage.'
        );
      }
    }

    const updated = await prisma.insuranceDocument.update({
      where: { id: documentId },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedBy,
        rejectionReason: status === 'REJECTED' ? rejectionReason : null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    logger.info(`Insurance document ${documentId} status updated to ${status}`, {
      reviewedBy,
      userId: document.userId,
    });

    try {
      await emailService.sendInsuranceStatusUpdateEmail(updated.user.email, {
        userName: updated.user.name,
        status,
        rejectionReason: status === 'REJECTED' ? rejectionReason : null,
      });
    } catch (error) {
      logger.error('Failed to send insurance status update email', error);
    }

    return updated;
  }

  /**
   * Check if a user has valid, approved insurance
   * Returns true if they have at least one approved, non-expired PUBLIC_LIABILITY policy
   * with adequate coverage (minimum £1M)
   */
  async hasValidInsurance(userId: string): Promise<boolean> {
    const now = new Date();

    // Require explicit expiry date and coverage amount - no null bypasses
    const validDocument = await prisma.insuranceDocument.findFirst({
      where: {
        userId,
        status: 'APPROVED',
        documentType: 'PUBLIC_LIABILITY',
        expiryDate: { gt: now },
        coverageAmount: { gte: MIN_PUBLIC_LIABILITY_COVERAGE },
      },
    });

    if (!validDocument) {
      // Log if user has legacy documents with null values that are no longer valid
      const legacyDoc = await prisma.insuranceDocument.findFirst({
        where: {
          userId,
          status: 'APPROVED',
          documentType: 'PUBLIC_LIABILITY',
          OR: [
            { expiryDate: null },
            { coverageAmount: null },
          ],
        },
      });
      if (legacyDoc) {
        logger.warn(`User ${userId} has legacy insurance document without required fields`, {
          documentId: legacyDoc.id,
          hasExpiry: legacyDoc.expiryDate !== null,
          hasCoverage: legacyDoc.coverageAmount !== null,
        });
      }
      return false;
    }

    return true;
  }

  /**
   * Validate insurance coverage meets minimum requirements
   */
  validateCoverageAmount(coverageAmount: number | null | undefined): { valid: boolean; message?: string } {
    if (coverageAmount === null || coverageAmount === undefined) {
      return { valid: true }; // Allow if not specified (will be validated manually)
    }

    if (coverageAmount < MIN_PUBLIC_LIABILITY_COVERAGE) {
      const minInPounds = MIN_PUBLIC_LIABILITY_COVERAGE / 100;
      const providedInPounds = coverageAmount / 100;
      return {
        valid: false,
        message: `Insurance coverage of £${providedInPounds.toLocaleString()} is below the minimum requirement of £${minInPounds.toLocaleString()}`,
      };
    }

    return { valid: true };
  }

  /**
   * Get user's insurance status summary
   */
  async getInsuranceStatus(userId: string) {
    const documents = await prisma.insuranceDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const approved = documents.filter(d => d.status === 'APPROVED');
    const pending = documents.filter(d => d.status === 'PENDING_REVIEW');
    const rejected = documents.filter(d => d.status === 'REJECTED');

    // Check for valid (approved + not expired + adequate coverage) public liability
    const validPublicLiability = approved.find(
      d => d.documentType === 'PUBLIC_LIABILITY' &&
           (d.expiryDate === null || d.expiryDate > now) &&
           (d.coverageAmount === null || d.coverageAmount >= MIN_PUBLIC_LIABILITY_COVERAGE)
    );

    // Check for inadequate coverage
    const inadequateCoverage = approved.find(
      d => d.documentType === 'PUBLIC_LIABILITY' &&
           (d.expiryDate === null || d.expiryDate > now) &&
           d.coverageAmount !== null &&
           d.coverageAmount < MIN_PUBLIC_LIABILITY_COVERAGE
    );

    // Check for expiring soon (within 30 days)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringSoon = approved.filter(
      d => d.expiryDate && d.expiryDate > now && d.expiryDate <= thirtyDaysFromNow
    );

    return {
      hasValidInsurance: !!validPublicLiability,
      canListServices: !!validPublicLiability,
      documents: {
        total: documents.length,
        approved: approved.length,
        pending: pending.length,
        rejected: rejected.length,
      },
      validPublicLiability: validPublicLiability || null,
      inadequateCoverage: inadequateCoverage ? {
        document: inadequateCoverage,
        currentCoverage: inadequateCoverage.coverageAmount,
        requiredCoverage: MIN_PUBLIC_LIABILITY_COVERAGE,
      } : null,
      expiringSoon,
      latestDocument: documents[0] || null,
    };
  }

  /**
   * Check and mark expired insurance documents
   * Should be called by scheduler daily
   */
  async markExpiredDocuments(): Promise<number> {
    const now = new Date();

    const result = await prisma.insuranceDocument.updateMany({
      where: {
        status: 'APPROVED',
        expiryDate: { lte: now },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    if (result.count > 0) {
      logger.info(`Marked ${result.count} insurance documents as expired`);
    }

    return result.count;
  }

  /**
   * Get documents expiring soon (for notification purposes)
   */
  async getExpiringDocuments(daysAhead: number = 30) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    return prisma.insuranceDocument.findMany({
      where: {
        status: 'APPROVED',
        expiryDate: {
          gt: now,
          lte: futureDate,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { expiryDate: 'asc' },
    });
  }

  /**
   * Delete an insurance document (user can delete their own pending/rejected docs)
   */
  async deleteDocument(documentId: string, userId: string) {
    const document = await prisma.insuranceDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundError('Insurance document not found');
    }

    if (document.userId !== userId) {
      throw new ForbiddenError('Not authorized to delete this document');
    }

    // Can only delete pending or rejected documents
    if (document.status === 'APPROVED') {
      throw new BadRequestError('Cannot delete an approved insurance document. Contact support if needed.');
    }

    await prisma.insuranceDocument.delete({
      where: { id: documentId },
    });

    logger.info(`Insurance document ${documentId} deleted by user ${userId}`);

    return { success: true };
  }
}

export const insuranceService = new InsuranceService();
