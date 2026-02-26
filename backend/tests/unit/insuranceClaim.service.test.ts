import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    transaction: {
      findUnique: vi.fn(),
    },
    insuranceClaim: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    insuranceDocument: {
      findFirst: vi.fn(),
    },
    insuranceClaimEvidence: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
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

vi.mock('../../src/services/unifiedNotification.service.js', () => ({
  unifiedNotificationService: {
    send: vi.fn(),
  },
}));

import { insuranceClaimService } from '../../src/services/insuranceClaim.service.js';
import { prisma } from '../../src/config/database.js';
import { logger } from '../../src/config/logger.js';
import { unifiedNotificationService } from '../../src/services/unifiedNotification.service.js';

describe('InsuranceClaimService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('create', () => {
    const mockTransaction = {
      id: 'tx-1',
      userId: 'user-1',
      providerId: 'provider-1',
      status: 'COMPLETED',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-15'),
      tool: { name: 'Power Drill' },
      space: null,
      service: null,
    };

    it('should create a claim successfully', async () => {
      const mockClaim = {
        id: 'claim-1',
        transactionId: 'tx-1',
        claimantId: 'user-1',
        claimType: 'PROPERTY_DAMAGE',
        incidentDate: new Date('2025-01-10'),
        description: 'Tool was damaged',
        claimAmount: 10000,
        status: 'SUBMITTED',
        transaction: { id: 'tx-1', tool: { name: 'Power Drill' } },
        claimant: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
      };

      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(mockTransaction as any);
      vi.mocked(prisma.insuranceClaim.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.insuranceDocument.findFirst).mockResolvedValue({ id: 'ins-doc-1' } as any);
      vi.mocked(prisma.insuranceClaim.create).mockResolvedValue(mockClaim as any);

      const result = await insuranceClaimService.create({
        transactionId: 'tx-1',
        claimantId: 'user-1',
        claimType: 'PROPERTY_DAMAGE',
        incidentDate: new Date('2025-01-10'),
        description: 'Tool was damaged',
        claimAmount: 10000,
      });

      expect(result.id).toBe('claim-1');
      expect(result.status).toBe('SUBMITTED');
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error when transaction not found', async () => {
      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null);

      await expect(
        insuranceClaimService.create({
          transactionId: 'nonexistent',
          claimantId: 'user-1',
          claimType: 'PROPERTY_DAMAGE',
          incidentDate: new Date('2025-01-10'),
          description: 'Test',
          claimAmount: 10000,
        })
      ).rejects.toThrow('Transaction not found');
    });

    it('should throw error when claimant is not party to transaction', async () => {
      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(mockTransaction as any);

      await expect(
        insuranceClaimService.create({
          transactionId: 'tx-1',
          claimantId: 'other-user',
          claimType: 'PROPERTY_DAMAGE',
          incidentDate: new Date('2025-01-10'),
          description: 'Test',
          claimAmount: 10000,
        })
      ).rejects.toThrow('You can only file claims for transactions you were part of');
    });

    it('should throw error when incident date is outside transaction period', async () => {
      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(mockTransaction as any);

      await expect(
        insuranceClaimService.create({
          transactionId: 'tx-1',
          claimantId: 'user-1',
          claimType: 'PROPERTY_DAMAGE',
          incidentDate: new Date('2024-01-01'), // Before transaction
          description: 'Test',
          claimAmount: 10000,
        })
      ).rejects.toThrow('Incident date must be within the transaction period');
    });

    it('should throw error when active claim already exists', async () => {
      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(mockTransaction as any);
      vi.mocked(prisma.insuranceClaim.findFirst).mockResolvedValue({ id: 'existing-claim' } as any);

      await expect(
        insuranceClaimService.create({
          transactionId: 'tx-1',
          claimantId: 'user-1',
          claimType: 'PROPERTY_DAMAGE',
          incidentDate: new Date('2025-01-10'),
          description: 'Test',
          claimAmount: 10000,
        })
      ).rejects.toThrow('You already have an active claim on this transaction');
    });

    it('should allow provider to file a claim', async () => {
      const mockClaim = {
        id: 'claim-1',
        transactionId: 'tx-1',
        claimantId: 'provider-1',
        status: 'SUBMITTED',
        transaction: { id: 'tx-1', tool: { name: 'Power Drill' } },
        claimant: { id: 'provider-1', name: 'Provider', email: 'provider@example.com' },
      };

      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(mockTransaction as any);
      vi.mocked(prisma.insuranceClaim.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.insuranceDocument.findFirst).mockResolvedValue({ id: 'ins-doc-1' } as any);
      vi.mocked(prisma.insuranceClaim.create).mockResolvedValue(mockClaim as any);

      const result = await insuranceClaimService.create({
        transactionId: 'tx-1',
        claimantId: 'provider-1',
        claimType: 'PROPERTY_DAMAGE',
        incidentDate: new Date('2025-01-10'),
        description: 'Test',
        claimAmount: 10000,
      });

      expect(result.claimantId).toBe('provider-1');
    });
  });

  describe('getById', () => {
    const mockClaim = {
      id: 'claim-1',
      claimantId: 'user-1',
      transaction: {
        id: 'tx-1',
        userId: 'user-1',
        providerId: 'provider-1',
      },
      claimant: { id: 'user-1', name: 'Test User' },
      evidence: [],
    };

    it('should return claim when found', async () => {
      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);

      const result = await insuranceClaimService.getById('claim-1');

      expect(result.id).toBe('claim-1');
    });

    it('should throw error when claim not found', async () => {
      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(null);

      await expect(insuranceClaimService.getById('nonexistent')).rejects.toThrow(
        'Insurance claim not found'
      );
    });

    it('should allow access for claimant', async () => {
      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);

      const result = await insuranceClaimService.getById('claim-1', 'user-1');

      expect(result.id).toBe('claim-1');
    });

    it('should allow access for transaction user', async () => {
      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);

      const result = await insuranceClaimService.getById('claim-1', 'user-1');

      expect(result.id).toBe('claim-1');
    });

    it('should allow access for provider', async () => {
      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);

      const result = await insuranceClaimService.getById('claim-1', 'provider-1');

      expect(result.id).toBe('claim-1');
    });

    it('should throw error when user not authorized', async () => {
      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);

      await expect(insuranceClaimService.getById('claim-1', 'other-user')).rejects.toThrow(
        'Not authorized to view this claim'
      );
    });

    it('should allow admin access', async () => {
      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);

      const result = await insuranceClaimService.getById('claim-1', 'any-user', true);

      expect(result.id).toBe('claim-1');
    });
  });

  describe('listByUser', () => {
    it('should return claims with pagination', async () => {
      const mockClaims = [
        { id: 'claim-1', status: 'SUBMITTED' },
        { id: 'claim-2', status: 'UNDER_REVIEW' },
      ];

      vi.mocked(prisma.insuranceClaim.findMany).mockResolvedValue(mockClaims as any);
      vi.mocked(prisma.insuranceClaim.count).mockResolvedValue(2);

      const result = await insuranceClaimService.listByUser('user-1', { page: 1, limit: 10 });

      expect(result.claims).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter by status', async () => {
      vi.mocked(prisma.insuranceClaim.findMany).mockResolvedValue([]);
      vi.mocked(prisma.insuranceClaim.count).mockResolvedValue(0);

      await insuranceClaimService.listByUser('user-1', { status: 'SUBMITTED' });

      expect(prisma.insuranceClaim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'SUBMITTED' }),
        })
      );
    });
  });

  describe('listAll', () => {
    it('should return all claims with pagination for admin', async () => {
      const mockClaims = [
        { id: 'claim-1', status: 'SUBMITTED' },
        { id: 'claim-2', status: 'APPROVED' },
      ];

      vi.mocked(prisma.insuranceClaim.findMany).mockResolvedValue(mockClaims as any);
      vi.mocked(prisma.insuranceClaim.count).mockResolvedValue(2);

      const result = await insuranceClaimService.listAll({ page: 1, limit: 20 });

      expect(result.claims).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter by status and claimType', async () => {
      vi.mocked(prisma.insuranceClaim.findMany).mockResolvedValue([]);
      vi.mocked(prisma.insuranceClaim.count).mockResolvedValue(0);

      await insuranceClaimService.listAll({ status: 'SUBMITTED', claimType: 'PROPERTY_DAMAGE' });

      expect(prisma.insuranceClaim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'SUBMITTED',
            claimType: 'PROPERTY_DAMAGE',
          }),
        })
      );
    });
  });

  describe('updateStatus', () => {
    it('should update status from SUBMITTED to UNDER_REVIEW', async () => {
      const mockClaim = {
        id: 'claim-1',
        claimantId: 'user-1',
        status: 'SUBMITTED',
        adminNotes: null,
        settlementAmount: null,
        claimant: { id: 'user-1', name: 'Test', email: 'test@example.com' },
      };

      const updatedClaim = { ...mockClaim, status: 'UNDER_REVIEW' };

      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);
      vi.mocked(prisma.insuranceClaim.update).mockResolvedValue(updatedClaim as any);
      vi.mocked(unifiedNotificationService.send).mockResolvedValue({ push: true, email: true, sms: false });

      const result = await insuranceClaimService.updateStatus({
        claimId: 'claim-1',
        status: 'UNDER_REVIEW',
        reviewedBy: 'admin-1',
      });

      expect(result.status).toBe('UNDER_REVIEW');
      expect(unifiedNotificationService.send).toHaveBeenCalled();
    });

    it('should throw error for invalid status transition', async () => {
      const mockClaim = { id: 'claim-1', status: 'SETTLED' }; // Final state

      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);

      await expect(
        insuranceClaimService.updateStatus({
          claimId: 'claim-1',
          status: 'SUBMITTED',
          reviewedBy: 'admin-1',
        })
      ).rejects.toThrow('Cannot transition from SETTLED to SUBMITTED');
    });

    it('should throw error when rejecting without reason', async () => {
      const mockClaim = { id: 'claim-1', status: 'UNDER_REVIEW' };

      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);

      await expect(
        insuranceClaimService.updateStatus({
          claimId: 'claim-1',
          status: 'REJECTED',
          reviewedBy: 'admin-1',
        })
      ).rejects.toThrow('Rejection reason is required');
    });

    it('should throw error when settling without amount', async () => {
      const mockClaim = { id: 'claim-1', status: 'APPROVED' };

      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);

      await expect(
        insuranceClaimService.updateStatus({
          claimId: 'claim-1',
          status: 'SETTLED',
          reviewedBy: 'admin-1',
        })
      ).rejects.toThrow('Settlement amount is required when settling a claim');
    });

    it('should settle claim with amount', async () => {
      const mockClaim = {
        id: 'claim-1',
        claimantId: 'user-1',
        status: 'APPROVED',
        claimant: { id: 'user-1', name: 'Test', email: 'test@example.com' },
      };

      const updatedClaim = { ...mockClaim, status: 'SETTLED', settlementAmount: 5000 };

      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);
      vi.mocked(prisma.insuranceClaim.update).mockResolvedValue(updatedClaim as any);
      vi.mocked(unifiedNotificationService.send).mockResolvedValue({ push: true, email: true, sms: false });

      const result = await insuranceClaimService.updateStatus({
        claimId: 'claim-1',
        status: 'SETTLED',
        reviewedBy: 'admin-1',
        settlementAmount: 5000,
      });

      expect(result.status).toBe('SETTLED');
      expect(result.settlementAmount).toBe(5000);
    });

    it('should throw error when claim not found', async () => {
      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(null);

      await expect(
        insuranceClaimService.updateStatus({
          claimId: 'nonexistent',
          status: 'UNDER_REVIEW',
          reviewedBy: 'admin-1',
        })
      ).rejects.toThrow('Insurance claim not found');
    });

    it('should handle notification failure gracefully', async () => {
      const mockClaim = {
        id: 'claim-1',
        claimantId: 'user-1',
        status: 'SUBMITTED',
        claimant: { id: 'user-1', name: 'Test', email: 'test@example.com' },
      };

      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);
      vi.mocked(prisma.insuranceClaim.update).mockResolvedValue({ ...mockClaim, status: 'UNDER_REVIEW' } as any);
      vi.mocked(unifiedNotificationService.send).mockRejectedValue(new Error('Notification failed'));

      const result = await insuranceClaimService.updateStatus({
        claimId: 'claim-1',
        status: 'UNDER_REVIEW',
        reviewedBy: 'admin-1',
      });

      expect(result.status).toBe('UNDER_REVIEW');
      expect(logger.error).toHaveBeenCalledWith('Failed to send claim status notification', expect.any(Error));
    });
  });

  describe('addEvidence', () => {
    it('should add evidence successfully', async () => {
      const mockClaim = {
        id: 'claim-1',
        claimantId: 'user-1',
        status: 'SUBMITTED',
        transaction: { userId: 'user-1', providerId: 'provider-1' },
      };

      const mockEvidence = {
        id: 'evidence-1',
        claimId: 'claim-1',
        uploaderId: 'user-1',
        fileUrl: 'https://example.com/file.pdf',
        uploader: { id: 'user-1', name: 'Test User' },
      };

      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);
      vi.mocked(prisma.insuranceClaimEvidence.create).mockResolvedValue(mockEvidence as any);

      const result = await insuranceClaimService.addEvidence({
        claimId: 'claim-1',
        uploaderId: 'user-1',
        fileUrl: 'https://example.com/file.pdf',
        fileName: 'file.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        description: 'Photo evidence',
      });

      expect(result.id).toBe('evidence-1');
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error when claim not found', async () => {
      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(null);

      await expect(
        insuranceClaimService.addEvidence({
          claimId: 'nonexistent',
          uploaderId: 'user-1',
          fileUrl: 'https://example.com/file.pdf',
          fileName: 'file.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
        })
      ).rejects.toThrow('Insurance claim not found');
    });

    it('should throw error when user not authorized', async () => {
      const mockClaim = {
        id: 'claim-1',
        claimantId: 'user-1',
        status: 'SUBMITTED',
        transaction: { userId: 'user-1', providerId: 'provider-1' },
      };

      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);

      await expect(
        insuranceClaimService.addEvidence({
          claimId: 'claim-1',
          uploaderId: 'other-user',
          fileUrl: 'https://example.com/file.pdf',
          fileName: 'file.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
        })
      ).rejects.toThrow('Not authorized to add evidence to this claim');
    });

    it('should throw error when claim is closed', async () => {
      const mockClaim = {
        id: 'claim-1',
        claimantId: 'user-1',
        status: 'SETTLED',
        transaction: { userId: 'user-1', providerId: 'provider-1' },
      };

      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);

      await expect(
        insuranceClaimService.addEvidence({
          claimId: 'claim-1',
          uploaderId: 'user-1',
          fileUrl: 'https://example.com/file.pdf',
          fileName: 'file.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
        })
      ).rejects.toThrow('Cannot add evidence to a closed claim');
    });
  });

  describe('deleteEvidence', () => {
    it('should delete evidence successfully', async () => {
      const mockEvidence = {
        id: 'evidence-1',
        uploaderId: 'user-1',
        claim: { status: 'SUBMITTED' },
      };

      vi.mocked(prisma.insuranceClaimEvidence.findUnique).mockResolvedValue(mockEvidence as any);
      vi.mocked(prisma.insuranceClaimEvidence.delete).mockResolvedValue(mockEvidence as any);

      const result = await insuranceClaimService.deleteEvidence('evidence-1', 'user-1');

      expect(result.success).toBe(true);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error when evidence not found', async () => {
      vi.mocked(prisma.insuranceClaimEvidence.findUnique).mockResolvedValue(null);

      await expect(insuranceClaimService.deleteEvidence('nonexistent', 'user-1')).rejects.toThrow(
        'Evidence not found'
      );
    });

    it('should throw error when user not authorized', async () => {
      const mockEvidence = {
        id: 'evidence-1',
        uploaderId: 'other-user',
        claim: { status: 'SUBMITTED' },
      };

      vi.mocked(prisma.insuranceClaimEvidence.findUnique).mockResolvedValue(mockEvidence as any);

      await expect(insuranceClaimService.deleteEvidence('evidence-1', 'user-1')).rejects.toThrow(
        'Not authorized to delete this evidence'
      );
    });

    it('should throw error when claim is closed', async () => {
      const mockEvidence = {
        id: 'evidence-1',
        uploaderId: 'user-1',
        claim: { status: 'SETTLED' },
      };

      vi.mocked(prisma.insuranceClaimEvidence.findUnique).mockResolvedValue(mockEvidence as any);

      await expect(insuranceClaimService.deleteEvidence('evidence-1', 'user-1')).rejects.toThrow(
        'Cannot delete evidence from a closed claim'
      );
    });
  });

  describe('withdraw', () => {
    it('should withdraw claim successfully', async () => {
      const mockClaim = { id: 'claim-1', claimantId: 'user-1', status: 'SUBMITTED' };
      const withdrawnClaim = { ...mockClaim, status: 'WITHDRAWN' };

      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);
      vi.mocked(prisma.insuranceClaim.update).mockResolvedValue(withdrawnClaim as any);

      const result = await insuranceClaimService.withdraw('claim-1', 'user-1');

      expect(result.status).toBe('WITHDRAWN');
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error when claim not found', async () => {
      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(null);

      await expect(insuranceClaimService.withdraw('nonexistent', 'user-1')).rejects.toThrow(
        'Insurance claim not found'
      );
    });

    it('should throw error when user is not claimant', async () => {
      const mockClaim = { id: 'claim-1', claimantId: 'other-user', status: 'SUBMITTED' };

      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);

      await expect(insuranceClaimService.withdraw('claim-1', 'user-1')).rejects.toThrow(
        'Only the claimant can withdraw a claim'
      );
    });

    it('should throw error when claim cannot be withdrawn', async () => {
      const mockClaim = { id: 'claim-1', claimantId: 'user-1', status: 'APPROVED' };

      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);

      await expect(insuranceClaimService.withdraw('claim-1', 'user-1')).rejects.toThrow(
        'This claim cannot be withdrawn at this stage'
      );
    });

    it('should allow withdrawal from UNDER_REVIEW status', async () => {
      const mockClaim = { id: 'claim-1', claimantId: 'user-1', status: 'UNDER_REVIEW' };
      const withdrawnClaim = { ...mockClaim, status: 'WITHDRAWN' };

      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);
      vi.mocked(prisma.insuranceClaim.update).mockResolvedValue(withdrawnClaim as any);

      const result = await insuranceClaimService.withdraw('claim-1', 'user-1');

      expect(result.status).toBe('WITHDRAWN');
    });

    it('should allow withdrawal from ADDITIONAL_INFO status', async () => {
      const mockClaim = { id: 'claim-1', claimantId: 'user-1', status: 'ADDITIONAL_INFO' };
      const withdrawnClaim = { ...mockClaim, status: 'WITHDRAWN' };

      vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(mockClaim as any);
      vi.mocked(prisma.insuranceClaim.update).mockResolvedValue(withdrawnClaim as any);

      const result = await insuranceClaimService.withdraw('claim-1', 'user-1');

      expect(result.status).toBe('WITHDRAWN');
    });
  });

  describe('getStats', () => {
    it('should return comprehensive statistics', async () => {
      vi.mocked(prisma.insuranceClaim.groupBy)
        .mockResolvedValueOnce([
          { status: 'SUBMITTED', _count: { id: 5 } },
          { status: 'APPROVED', _count: { id: 3 } },
          { status: 'SETTLED', _count: { id: 10 } },
        ] as any)
        .mockResolvedValueOnce([
          { claimType: 'PROPERTY_DAMAGE', _count: { id: 8 } },
          { claimType: 'PERSONAL_INJURY', _count: { id: 5 } },
        ] as any);

      vi.mocked(prisma.insuranceClaim.count).mockResolvedValue(7);
      vi.mocked(prisma.insuranceClaim.aggregate).mockResolvedValue({
        _sum: { settlementAmount: 500000 },
        _count: { id: 10 },
      } as any);

      const result = await insuranceClaimService.getStats();

      expect(result.byStatus).toEqual({
        SUBMITTED: 5,
        APPROVED: 3,
        SETTLED: 10,
      });
      expect(result.byType).toEqual({
        PROPERTY_DAMAGE: 8,
        PERSONAL_INJURY: 5,
      });
      expect(result.recentClaims).toBe(7);
      expect(result.totalSettled).toEqual({
        count: 10,
        amount: 500000,
      });
    });

    it('should handle empty statistics', async () => {
      vi.mocked(prisma.insuranceClaim.groupBy)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      vi.mocked(prisma.insuranceClaim.count).mockResolvedValue(0);
      vi.mocked(prisma.insuranceClaim.aggregate).mockResolvedValue({
        _sum: { settlementAmount: null },
        _count: { id: 0 },
      } as any);

      const result = await insuranceClaimService.getStats();

      expect(result.byStatus).toEqual({});
      expect(result.byType).toEqual({});
      expect(result.recentClaims).toBe(0);
      expect(result.totalSettled).toEqual({ count: 0, amount: 0 });
    });
  });
});
