import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    insuranceDocument: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/email.service.js', () => ({
  emailService: {
    sendInsuranceStatusUpdateEmail: vi.fn(),
  },
}));

import { InsuranceService, MIN_PUBLIC_LIABILITY_COVERAGE } from '../../src/services/insurance.service.js';
import { prisma } from '../../src/config/database.js';
import { logger } from '../../src/config/logger.js';
import { emailService } from '../../src/services/email.service.js';

describe('InsuranceService', () => {
  let insuranceService: InsuranceService;

  beforeEach(() => {
    vi.clearAllMocks();
    insuranceService = new InsuranceService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createDocument', () => {
    it('should create an insurance document successfully', async () => {
      const mockDocument = {
        id: 'doc-1',
        userId: 'user-1',
        documentUrl: 'https://example.com/doc.pdf',
        documentType: 'PUBLIC_LIABILITY',
        provider: 'TestInsurer',
        policyNumber: 'POL123',
        coverageAmount: 200000000,
        expiryDate: new Date('2025-12-31'),
        status: 'PENDING_REVIEW',
        createdAt: new Date(),
      };

      vi.mocked(prisma.insuranceDocument.create).mockResolvedValue(mockDocument as any);

      const result = await insuranceService.createDocument({
        userId: 'user-1',
        documentUrl: 'https://example.com/doc.pdf',
        documentType: 'PUBLIC_LIABILITY',
        provider: 'TestInsurer',
        policyNumber: 'POL123',
        coverageAmount: 200000000,
        expiryDate: new Date('2025-12-31'),
      });

      expect(prisma.insuranceDocument.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          documentUrl: 'https://example.com/doc.pdf',
          documentType: 'PUBLIC_LIABILITY',
          provider: 'TestInsurer',
          policyNumber: 'POL123',
          coverageAmount: 200000000,
          expiryDate: expect.any(Date),
          status: 'PENDING_REVIEW',
        },
      });
      expect(result).toEqual(mockDocument);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should use default document type when not provided', async () => {
      const mockDocument = {
        id: 'doc-1',
        userId: 'user-1',
        documentUrl: 'https://example.com/doc.pdf',
        documentType: 'PUBLIC_LIABILITY',
        status: 'PENDING_REVIEW',
      };

      vi.mocked(prisma.insuranceDocument.create).mockResolvedValue(mockDocument as any);

      await insuranceService.createDocument({
        userId: 'user-1',
        documentUrl: 'https://example.com/doc.pdf',
      });

      expect(prisma.insuranceDocument.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          documentType: 'PUBLIC_LIABILITY',
        }),
      });
    });

    it('should throw error when expiry date is in the past', async () => {
      const pastDate = new Date('2020-01-01');

      await expect(
        insuranceService.createDocument({
          userId: 'user-1',
          documentUrl: 'https://example.com/doc.pdf',
          expiryDate: pastDate,
        })
      ).rejects.toThrow('Insurance expiry date must be in the future');
    });
  });

  describe('getDocumentsByUser', () => {
    it('should return all documents for a user', async () => {
      const mockDocuments = [
        { id: 'doc-1', userId: 'user-1', status: 'APPROVED' },
        { id: 'doc-2', userId: 'user-1', status: 'PENDING_REVIEW' },
      ];

      vi.mocked(prisma.insuranceDocument.findMany).mockResolvedValue(mockDocuments as any);

      const result = await insuranceService.getDocumentsByUser('user-1');

      expect(prisma.insuranceDocument.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('getDocumentById', () => {
    it('should return document when found', async () => {
      const mockDocument = {
        id: 'doc-1',
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
      };

      vi.mocked(prisma.insuranceDocument.findUnique).mockResolvedValue(mockDocument as any);

      const result = await insuranceService.getDocumentById('doc-1');

      expect(result).toEqual(mockDocument);
    });

    it('should throw error when document not found', async () => {
      vi.mocked(prisma.insuranceDocument.findUnique).mockResolvedValue(null);

      await expect(insuranceService.getDocumentById('nonexistent')).rejects.toThrow(
        'Insurance document not found'
      );
    });
  });

  describe('getPendingDocuments', () => {
    it('should return pending documents with pagination', async () => {
      const mockDocuments = [
        { id: 'doc-1', status: 'PENDING_REVIEW' },
        { id: 'doc-2', status: 'PENDING_REVIEW' },
      ];

      vi.mocked(prisma.insuranceDocument.findMany).mockResolvedValue(mockDocuments as any);
      vi.mocked(prisma.insuranceDocument.count).mockResolvedValue(2);

      const result = await insuranceService.getPendingDocuments({ page: 1, limit: 10 });

      expect(result.documents).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('should use default pagination values', async () => {
      vi.mocked(prisma.insuranceDocument.findMany).mockResolvedValue([]);
      vi.mocked(prisma.insuranceDocument.count).mockResolvedValue(0);

      await insuranceService.getPendingDocuments();

      expect(prisma.insuranceDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        })
      );
    });
  });

  describe('updateDocumentStatus', () => {
    it('should update document status to APPROVED', async () => {
      const mockDocument = { id: 'doc-1', userId: 'user-1', status: 'PENDING_REVIEW' };
      const updatedDocument = {
        ...mockDocument,
        status: 'APPROVED',
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
      };

      vi.mocked(prisma.insuranceDocument.findUnique).mockResolvedValue(mockDocument as any);
      vi.mocked(prisma.insuranceDocument.update).mockResolvedValue(updatedDocument as any);
      vi.mocked(emailService.sendInsuranceStatusUpdateEmail).mockResolvedValue(undefined);

      const result = await insuranceService.updateDocumentStatus({
        documentId: 'doc-1',
        status: 'APPROVED',
        reviewedBy: 'admin-1',
      });

      expect(result.status).toBe('APPROVED');
      expect(emailService.sendInsuranceStatusUpdateEmail).toHaveBeenCalled();
    });

    it('should throw error when rejecting without reason', async () => {
      const mockDocument = { id: 'doc-1', userId: 'user-1', status: 'PENDING_REVIEW' };

      vi.mocked(prisma.insuranceDocument.findUnique).mockResolvedValue(mockDocument as any);

      await expect(
        insuranceService.updateDocumentStatus({
          documentId: 'doc-1',
          status: 'REJECTED',
          reviewedBy: 'admin-1',
        })
      ).rejects.toThrow('Rejection reason is required when rejecting a document');
    });

    it('should update status to REJECTED with reason', async () => {
      const mockDocument = { id: 'doc-1', userId: 'user-1', status: 'PENDING_REVIEW' };
      const updatedDocument = {
        ...mockDocument,
        status: 'REJECTED',
        rejectionReason: 'Document expired',
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
      };

      vi.mocked(prisma.insuranceDocument.findUnique).mockResolvedValue(mockDocument as any);
      vi.mocked(prisma.insuranceDocument.update).mockResolvedValue(updatedDocument as any);
      vi.mocked(emailService.sendInsuranceStatusUpdateEmail).mockResolvedValue(undefined);

      const result = await insuranceService.updateDocumentStatus({
        documentId: 'doc-1',
        status: 'REJECTED',
        reviewedBy: 'admin-1',
        rejectionReason: 'Document expired',
      });

      expect(result.status).toBe('REJECTED');
    });

    it('should throw error when document not found', async () => {
      vi.mocked(prisma.insuranceDocument.findUnique).mockResolvedValue(null);

      await expect(
        insuranceService.updateDocumentStatus({
          documentId: 'nonexistent',
          status: 'APPROVED',
          reviewedBy: 'admin-1',
        })
      ).rejects.toThrow('Insurance document not found');
    });

    it('should handle email sending failure gracefully', async () => {
      const mockDocument = { id: 'doc-1', userId: 'user-1', status: 'PENDING_REVIEW' };
      const updatedDocument = {
        ...mockDocument,
        status: 'APPROVED',
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
      };

      vi.mocked(prisma.insuranceDocument.findUnique).mockResolvedValue(mockDocument as any);
      vi.mocked(prisma.insuranceDocument.update).mockResolvedValue(updatedDocument as any);
      vi.mocked(emailService.sendInsuranceStatusUpdateEmail).mockRejectedValue(new Error('Email failed'));

      const result = await insuranceService.updateDocumentStatus({
        documentId: 'doc-1',
        status: 'APPROVED',
        reviewedBy: 'admin-1',
      });

      expect(result.status).toBe('APPROVED');
      expect(logger.error).toHaveBeenCalledWith('Failed to send insurance status update email', expect.any(Error));
    });
  });

  describe('hasValidInsurance', () => {
    it('should return true when user has valid insurance', async () => {
      const mockDocument = {
        id: 'doc-1',
        userId: 'user-1',
        status: 'APPROVED',
        documentType: 'PUBLIC_LIABILITY',
        expiryDate: new Date('2025-12-31'),
        coverageAmount: 200000000,
      };

      vi.mocked(prisma.insuranceDocument.findFirst).mockResolvedValue(mockDocument as any);

      const result = await insuranceService.hasValidInsurance('user-1');

      expect(result).toBe(true);
    });

    it('should return false when no valid insurance found', async () => {
      vi.mocked(prisma.insuranceDocument.findFirst).mockResolvedValue(null);

      const result = await insuranceService.hasValidInsurance('user-1');

      expect(result).toBe(false);
    });

    it('should return false when coverage is below minimum', async () => {
      const mockDocument = {
        id: 'doc-1',
        userId: 'user-1',
        status: 'APPROVED',
        documentType: 'PUBLIC_LIABILITY',
        expiryDate: new Date('2025-12-31'),
        coverageAmount: 50000000, // Below minimum
      };

      vi.mocked(prisma.insuranceDocument.findFirst).mockResolvedValue(mockDocument as any);

      const result = await insuranceService.hasValidInsurance('user-1');

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should return true when coverage amount is null (legacy)', async () => {
      const mockDocument = {
        id: 'doc-1',
        userId: 'user-1',
        status: 'APPROVED',
        documentType: 'PUBLIC_LIABILITY',
        expiryDate: new Date('2025-12-31'),
        coverageAmount: null,
      };

      vi.mocked(prisma.insuranceDocument.findFirst).mockResolvedValue(mockDocument as any);

      const result = await insuranceService.hasValidInsurance('user-1');

      expect(result).toBe(true);
    });
  });

  describe('validateCoverageAmount', () => {
    it('should return valid for null coverage', () => {
      const result = insuranceService.validateCoverageAmount(null);
      expect(result.valid).toBe(true);
    });

    it('should return valid for undefined coverage', () => {
      const result = insuranceService.validateCoverageAmount(undefined);
      expect(result.valid).toBe(true);
    });

    it('should return valid for adequate coverage', () => {
      const result = insuranceService.validateCoverageAmount(MIN_PUBLIC_LIABILITY_COVERAGE);
      expect(result.valid).toBe(true);
    });

    it('should return invalid for insufficient coverage', () => {
      const result = insuranceService.validateCoverageAmount(50000000);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('below the minimum requirement');
    });
  });

  describe('getInsuranceStatus', () => {
    it('should return comprehensive status summary', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      const mockDocuments = [
        {
          id: 'doc-1',
          status: 'APPROVED',
          documentType: 'PUBLIC_LIABILITY',
          expiryDate: futureDate,
          coverageAmount: 200000000,
          createdAt: now,
        },
        { id: 'doc-2', status: 'PENDING_REVIEW', documentType: 'OTHER', createdAt: now },
      ];

      vi.mocked(prisma.insuranceDocument.findMany).mockResolvedValue(mockDocuments as any);

      const result = await insuranceService.getInsuranceStatus('user-1');

      expect(result.hasValidInsurance).toBe(true);
      expect(result.canListServices).toBe(true);
      expect(result.documents.total).toBe(2);
      expect(result.documents.approved).toBe(1);
      expect(result.documents.pending).toBe(1);
    });

    it('should detect expiring soon documents', async () => {
      const now = new Date();
      const soonDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days
      const mockDocuments = [
        {
          id: 'doc-1',
          status: 'APPROVED',
          documentType: 'PUBLIC_LIABILITY',
          expiryDate: soonDate,
          coverageAmount: 200000000,
          createdAt: now,
        },
      ];

      vi.mocked(prisma.insuranceDocument.findMany).mockResolvedValue(mockDocuments as any);

      const result = await insuranceService.getInsuranceStatus('user-1');

      expect(result.expiringSoon).toHaveLength(1);
    });

    it('should detect inadequate coverage', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      const mockDocuments = [
        {
          id: 'doc-1',
          status: 'APPROVED',
          documentType: 'PUBLIC_LIABILITY',
          expiryDate: futureDate,
          coverageAmount: 50000000, // Below minimum
          createdAt: now,
        },
      ];

      vi.mocked(prisma.insuranceDocument.findMany).mockResolvedValue(mockDocuments as any);

      const result = await insuranceService.getInsuranceStatus('user-1');

      expect(result.hasValidInsurance).toBe(false);
      expect(result.inadequateCoverage).not.toBeNull();
    });
  });

  describe('markExpiredDocuments', () => {
    it('should mark expired documents and return count', async () => {
      vi.mocked(prisma.insuranceDocument.updateMany).mockResolvedValue({ count: 3 } as any);

      const result = await insuranceService.markExpiredDocuments();

      expect(result).toBe(3);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Marked 3 insurance documents as expired'));
    });

    it('should not log when no documents expired', async () => {
      vi.mocked(prisma.insuranceDocument.updateMany).mockResolvedValue({ count: 0 } as any);

      const result = await insuranceService.markExpiredDocuments();

      expect(result).toBe(0);
    });
  });

  describe('getExpiringDocuments', () => {
    it('should return documents expiring within specified days', async () => {
      const mockDocuments = [
        { id: 'doc-1', expiryDate: new Date(), user: { id: 'user-1', name: 'Test', email: 'test@example.com' } },
      ];

      vi.mocked(prisma.insuranceDocument.findMany).mockResolvedValue(mockDocuments as any);

      const result = await insuranceService.getExpiringDocuments(30);

      expect(result).toHaveLength(1);
      expect(prisma.insuranceDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'APPROVED',
          }),
        })
      );
    });

    it('should use default 30 days when not specified', async () => {
      vi.mocked(prisma.insuranceDocument.findMany).mockResolvedValue([]);

      await insuranceService.getExpiringDocuments();

      expect(prisma.insuranceDocument.findMany).toHaveBeenCalled();
    });
  });

  describe('deleteDocument', () => {
    it('should delete pending document owned by user', async () => {
      const mockDocument = { id: 'doc-1', userId: 'user-1', status: 'PENDING_REVIEW' };

      vi.mocked(prisma.insuranceDocument.findUnique).mockResolvedValue(mockDocument as any);
      vi.mocked(prisma.insuranceDocument.delete).mockResolvedValue(mockDocument as any);

      const result = await insuranceService.deleteDocument('doc-1', 'user-1');

      expect(result.success).toBe(true);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should delete rejected document owned by user', async () => {
      const mockDocument = { id: 'doc-1', userId: 'user-1', status: 'REJECTED' };

      vi.mocked(prisma.insuranceDocument.findUnique).mockResolvedValue(mockDocument as any);
      vi.mocked(prisma.insuranceDocument.delete).mockResolvedValue(mockDocument as any);

      const result = await insuranceService.deleteDocument('doc-1', 'user-1');

      expect(result.success).toBe(true);
    });

    it('should throw error when document not found', async () => {
      vi.mocked(prisma.insuranceDocument.findUnique).mockResolvedValue(null);

      await expect(insuranceService.deleteDocument('nonexistent', 'user-1')).rejects.toThrow(
        'Insurance document not found'
      );
    });

    it('should throw error when user does not own document', async () => {
      const mockDocument = { id: 'doc-1', userId: 'other-user', status: 'PENDING_REVIEW' };

      vi.mocked(prisma.insuranceDocument.findUnique).mockResolvedValue(mockDocument as any);

      await expect(insuranceService.deleteDocument('doc-1', 'user-1')).rejects.toThrow(
        'Not authorized to delete this document'
      );
    });

    it('should throw error when trying to delete approved document', async () => {
      const mockDocument = { id: 'doc-1', userId: 'user-1', status: 'APPROVED' };

      vi.mocked(prisma.insuranceDocument.findUnique).mockResolvedValue(mockDocument as any);

      await expect(insuranceService.deleteDocument('doc-1', 'user-1')).rejects.toThrow(
        'Cannot delete an approved insurance document'
      );
    });
  });
});
