import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Mock the service and logger
vi.mock('../../src/services/insuranceClaim.service.js', () => ({
  insuranceClaimService: {
    create: vi.fn(),
    listByUser: vi.fn(),
    getById: vi.fn(),
    withdraw: vi.fn(),
    addEvidence: vi.fn(),
    deleteEvidence: vi.fn(),
    listAll: vi.fn(),
    updateStatus: vi.fn(),
    getStats: vi.fn(),
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { InsuranceClaimController, insuranceClaimController } from '../../src/controllers/insuranceClaim.controller.js';
import { insuranceClaimService } from '../../src/services/insuranceClaim.service.js';

describe('InsuranceClaimController', () => {
  let controller: InsuranceClaimController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new InsuranceClaimController();

    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
  });

  describe('create', () => {
    it('should create an insurance claim successfully', async () => {
      const mockClaim = {
        id: 'claim-123',
        transactionId: 'trans-456',
        claimType: 'TOOL_DAMAGE',
        status: 'SUBMITTED',
      };
      vi.mocked(insuranceClaimService.create).mockResolvedValue(mockClaim as any);

      mockReq = {
        user: { id: 'user-123' } as any,
        body: {
          transactionId: 'trans-456',
          claimType: 'TOOL_DAMAGE',
          incidentDate: '2024-01-15',
          description: 'Tool was damaged during use',
          claimAmount: 5000,
        },
      };

      await controller.create(mockReq as Request, mockRes as Response);

      expect(insuranceClaimService.create).toHaveBeenCalledWith({
        transactionId: 'trans-456',
        claimantId: 'user-123',
        claimType: 'TOOL_DAMAGE',
        incidentDate: expect.any(Date),
        description: 'Tool was damaged during use',
        claimAmount: 5000,
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Insurance claim filed successfully',
        claim: mockClaim,
      });
    });

    it('should return 400 when required fields are missing', async () => {
      mockReq = {
        user: { id: 'user-123' } as any,
        body: {
          transactionId: 'trans-456',
          // Missing claimType, incidentDate, description, claimAmount
        },
      };

      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'transactionId, claimType, incidentDate, description, and claimAmount are required',
      });
    });

    it('should return 400 for invalid claim type', async () => {
      mockReq = {
        user: { id: 'user-123' } as any,
        body: {
          transactionId: 'trans-456',
          claimType: 'INVALID_TYPE',
          incidentDate: '2024-01-15',
          description: 'Test',
          claimAmount: 5000,
        },
      };

      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Invalid claim type',
      });
    });

    it('should return 404 when transaction not found', async () => {
      vi.mocked(insuranceClaimService.create).mockRejectedValue(new Error('Transaction not found'));

      mockReq = {
        user: { id: 'user-123' } as any,
        body: {
          transactionId: 'non-existent',
          claimType: 'TOOL_DAMAGE',
          incidentDate: '2024-01-15',
          description: 'Test',
          claimAmount: 5000,
        },
      };

      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Transaction not found',
      });
    });

    it('should return 403 when not authorized', async () => {
      vi.mocked(insuranceClaimService.create).mockRejectedValue(
        new Error('Not authorized to file claims for this transaction')
      );

      mockReq = {
        user: { id: 'user-123' } as any,
        body: {
          transactionId: 'trans-456',
          claimType: 'TOOL_DAMAGE',
          incidentDate: '2024-01-15',
          description: 'Test',
          claimAmount: 5000,
        },
      };

      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 when user already has an active claim', async () => {
      vi.mocked(insuranceClaimService.create).mockRejectedValue(
        new Error('You already have an active claim on this transaction')
      );

      mockReq = {
        user: { id: 'user-123' } as any,
        body: {
          transactionId: 'trans-456',
          claimType: 'TOOL_DAMAGE',
          incidentDate: '2024-01-15',
          description: 'Test',
          claimAmount: 5000,
        },
      };

      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when incident date is invalid', async () => {
      vi.mocked(insuranceClaimService.create).mockRejectedValue(
        new Error('Incident date must be within the transaction period')
      );

      mockReq = {
        user: { id: 'user-123' } as any,
        body: {
          transactionId: 'trans-456',
          claimType: 'TOOL_DAMAGE',
          incidentDate: '2020-01-15',
          description: 'Test',
          claimAmount: 5000,
        },
      };

      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on unexpected error', async () => {
      vi.mocked(insuranceClaimService.create).mockRejectedValue(new Error('Database error'));

      mockReq = {
        user: { id: 'user-123' } as any,
        body: {
          transactionId: 'trans-456',
          claimType: 'TOOL_DAMAGE',
          incidentDate: '2024-01-15',
          description: 'Test',
          claimAmount: 5000,
        },
      };

      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Failed to file insurance claim',
      });
    });
  });

  describe('listMyClaims', () => {
    it('should return user claims with pagination', async () => {
      const mockResult = {
        claims: [{ id: 'claim-1' }, { id: 'claim-2' }],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };
      vi.mocked(insuranceClaimService.listByUser).mockResolvedValue(mockResult as any);

      mockReq = {
        user: { id: 'user-123' } as any,
        query: { page: '1', limit: '20' },
      };

      await controller.listMyClaims(mockReq as Request, mockRes as Response);

      expect(insuranceClaimService.listByUser).toHaveBeenCalledWith('user-123', {
        page: 1,
        limit: 20,
        status: undefined,
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should filter by status when provided', async () => {
      const mockResult = {
        claims: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
      vi.mocked(insuranceClaimService.listByUser).mockResolvedValue(mockResult as any);

      mockReq = {
        user: { id: 'user-123' } as any,
        query: { page: '1', limit: '20', status: 'SUBMITTED' },
      };

      await controller.listMyClaims(mockReq as Request, mockRes as Response);

      expect(insuranceClaimService.listByUser).toHaveBeenCalledWith('user-123', {
        page: 1,
        limit: 20,
        status: 'SUBMITTED',
      });
    });

    it('should return 500 on error', async () => {
      vi.mocked(insuranceClaimService.listByUser).mockRejectedValue(new Error('Database error'));

      mockReq = {
        user: { id: 'user-123' } as any,
        query: {},
      };

      await controller.listMyClaims(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Failed to list insurance claims',
      });
    });
  });

  describe('getById', () => {
    it('should return claim when authorized', async () => {
      const mockClaim = { id: 'claim-123', status: 'SUBMITTED' };
      vi.mocked(insuranceClaimService.getById).mockResolvedValue(mockClaim as any);

      mockReq = {
        user: { id: 'user-123', role: 'USER' } as any,
        params: { id: 'claim-123' },
      };

      await controller.getById(mockReq as Request, mockRes as Response);

      expect(insuranceClaimService.getById).toHaveBeenCalledWith('claim-123', 'user-123', false);
      expect(mockRes.json).toHaveBeenCalledWith({ claim: mockClaim });
    });

    it('should pass isAdmin true for admin users', async () => {
      const mockClaim = { id: 'claim-123', status: 'SUBMITTED' };
      vi.mocked(insuranceClaimService.getById).mockResolvedValue(mockClaim as any);

      mockReq = {
        user: { id: 'admin-123', role: 'ADMIN' } as any,
        params: { id: 'claim-123' },
      };

      await controller.getById(mockReq as Request, mockRes as Response);

      expect(insuranceClaimService.getById).toHaveBeenCalledWith('claim-123', 'admin-123', true);
    });

    it('should return 404 when claim not found', async () => {
      vi.mocked(insuranceClaimService.getById).mockRejectedValue(
        new Error('Insurance claim not found')
      );

      mockReq = {
        user: { id: 'user-123', role: 'USER' } as any,
        params: { id: 'non-existent' },
      };

      await controller.getById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Insurance claim not found',
      });
    });

    it('should return 403 when not authorized', async () => {
      vi.mocked(insuranceClaimService.getById).mockRejectedValue(
        new Error('Not authorized to view this claim')
      );

      mockReq = {
        user: { id: 'other-user', role: 'USER' } as any,
        params: { id: 'claim-123' },
      };

      await controller.getById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return 500 on unexpected error', async () => {
      vi.mocked(insuranceClaimService.getById).mockRejectedValue(new Error('Database error'));

      mockReq = {
        user: { id: 'user-123', role: 'USER' } as any,
        params: { id: 'claim-123' },
      };

      await controller.getById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('withdraw', () => {
    it('should withdraw a claim successfully', async () => {
      const mockClaim = { id: 'claim-123', status: 'WITHDRAWN' };
      vi.mocked(insuranceClaimService.withdraw).mockResolvedValue(mockClaim as any);

      mockReq = {
        user: { id: 'user-123' } as any,
        params: { id: 'claim-123' },
      };

      await controller.withdraw(mockReq as Request, mockRes as Response);

      expect(insuranceClaimService.withdraw).toHaveBeenCalledWith('claim-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Insurance claim withdrawn successfully',
        claim: mockClaim,
      });
    });

    it('should return 404 when claim not found', async () => {
      vi.mocked(insuranceClaimService.withdraw).mockRejectedValue(
        new Error('Insurance claim not found')
      );

      mockReq = {
        user: { id: 'user-123' } as any,
        params: { id: 'non-existent' },
      };

      await controller.withdraw(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 when not the claimant', async () => {
      vi.mocked(insuranceClaimService.withdraw).mockRejectedValue(
        new Error('Only the claimant can withdraw a claim')
      );

      mockReq = {
        user: { id: 'other-user' } as any,
        params: { id: 'claim-123' },
      };

      await controller.withdraw(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 when claim cannot be withdrawn', async () => {
      vi.mocked(insuranceClaimService.withdraw).mockRejectedValue(
        new Error('This claim cannot be withdrawn at this stage')
      );

      mockReq = {
        user: { id: 'user-123' } as any,
        params: { id: 'claim-123' },
      };

      await controller.withdraw(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on unexpected error', async () => {
      vi.mocked(insuranceClaimService.withdraw).mockRejectedValue(new Error('Database error'));

      mockReq = {
        user: { id: 'user-123' } as any,
        params: { id: 'claim-123' },
      };

      await controller.withdraw(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('addEvidence', () => {
    it('should add evidence successfully', async () => {
      const mockEvidence = {
        id: 'evidence-123',
        claimId: 'claim-123',
        fileUrl: 'https://example.com/photo.jpg',
      };
      vi.mocked(insuranceClaimService.addEvidence).mockResolvedValue(mockEvidence as any);

      mockReq = {
        user: { id: 'user-123' } as any,
        params: { id: 'claim-123' },
        body: {
          fileUrl: 'https://example.com/photo.jpg',
          fileName: 'photo.jpg',
          fileType: 'image/jpeg',
          fileSize: '1024',
          description: 'Photo of damage',
        },
      };

      await controller.addEvidence(mockReq as Request, mockRes as Response);

      expect(insuranceClaimService.addEvidence).toHaveBeenCalledWith({
        claimId: 'claim-123',
        uploaderId: 'user-123',
        fileUrl: 'https://example.com/photo.jpg',
        fileName: 'photo.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024,
        description: 'Photo of damage',
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Evidence added successfully',
        evidence: mockEvidence,
      });
    });

    it('should return 400 when required fields are missing', async () => {
      mockReq = {
        user: { id: 'user-123' } as any,
        params: { id: 'claim-123' },
        body: {
          fileUrl: 'https://example.com/photo.jpg',
          // Missing fileName, fileType, fileSize
        },
      };

      await controller.addEvidence(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'fileUrl, fileName, fileType, and fileSize are required',
      });
    });

    it('should return 404 when claim not found', async () => {
      vi.mocked(insuranceClaimService.addEvidence).mockRejectedValue(
        new Error('Insurance claim not found')
      );

      mockReq = {
        user: { id: 'user-123' } as any,
        params: { id: 'non-existent' },
        body: {
          fileUrl: 'https://example.com/photo.jpg',
          fileName: 'photo.jpg',
          fileType: 'image/jpeg',
          fileSize: '1024',
        },
      };

      await controller.addEvidence(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 when not authorized', async () => {
      vi.mocked(insuranceClaimService.addEvidence).mockRejectedValue(
        new Error('Not authorized to add evidence to this claim')
      );

      mockReq = {
        user: { id: 'other-user' } as any,
        params: { id: 'claim-123' },
        body: {
          fileUrl: 'https://example.com/photo.jpg',
          fileName: 'photo.jpg',
          fileType: 'image/jpeg',
          fileSize: '1024',
        },
      };

      await controller.addEvidence(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 when claim is closed', async () => {
      vi.mocked(insuranceClaimService.addEvidence).mockRejectedValue(
        new Error('Cannot add evidence to a closed claim')
      );

      mockReq = {
        user: { id: 'user-123' } as any,
        params: { id: 'claim-123' },
        body: {
          fileUrl: 'https://example.com/photo.jpg',
          fileName: 'photo.jpg',
          fileType: 'image/jpeg',
          fileSize: '1024',
        },
      };

      await controller.addEvidence(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on unexpected error', async () => {
      vi.mocked(insuranceClaimService.addEvidence).mockRejectedValue(new Error('Database error'));

      mockReq = {
        user: { id: 'user-123' } as any,
        params: { id: 'claim-123' },
        body: {
          fileUrl: 'https://example.com/photo.jpg',
          fileName: 'photo.jpg',
          fileType: 'image/jpeg',
          fileSize: '1024',
        },
      };

      await controller.addEvidence(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('deleteEvidence', () => {
    it('should delete evidence successfully', async () => {
      vi.mocked(insuranceClaimService.deleteEvidence).mockResolvedValue({ success: true });

      mockReq = {
        user: { id: 'user-123' } as any,
        params: { claimId: 'claim-123', evidenceId: 'evidence-123' },
      };

      await controller.deleteEvidence(mockReq as Request, mockRes as Response);

      expect(insuranceClaimService.deleteEvidence).toHaveBeenCalledWith('evidence-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Evidence deleted successfully' });
    });

    it('should return 404 when evidence not found', async () => {
      vi.mocked(insuranceClaimService.deleteEvidence).mockRejectedValue(
        new Error('Evidence not found')
      );

      mockReq = {
        user: { id: 'user-123' } as any,
        params: { claimId: 'claim-123', evidenceId: 'non-existent' },
      };

      await controller.deleteEvidence(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 when not authorized', async () => {
      vi.mocked(insuranceClaimService.deleteEvidence).mockRejectedValue(
        new Error('Not authorized to delete this evidence')
      );

      mockReq = {
        user: { id: 'other-user' } as any,
        params: { claimId: 'claim-123', evidenceId: 'evidence-123' },
      };

      await controller.deleteEvidence(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 when claim is closed', async () => {
      vi.mocked(insuranceClaimService.deleteEvidence).mockRejectedValue(
        new Error('Cannot delete evidence from a closed claim')
      );

      mockReq = {
        user: { id: 'user-123' } as any,
        params: { claimId: 'claim-123', evidenceId: 'evidence-123' },
      };

      await controller.deleteEvidence(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on unexpected error', async () => {
      vi.mocked(insuranceClaimService.deleteEvidence).mockRejectedValue(new Error('Database error'));

      mockReq = {
        user: { id: 'user-123' } as any,
        params: { claimId: 'claim-123', evidenceId: 'evidence-123' },
      };

      await controller.deleteEvidence(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  // =============================================================================
  // ADMIN ENDPOINTS
  // =============================================================================

  describe('listAll (admin)', () => {
    it('should return all claims with pagination', async () => {
      const mockResult = {
        claims: [{ id: 'claim-1' }, { id: 'claim-2' }],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };
      vi.mocked(insuranceClaimService.listAll).mockResolvedValue(mockResult as any);

      mockReq = {
        query: { page: '1', limit: '20' },
      };

      await controller.listAll(mockReq as Request, mockRes as Response);

      expect(insuranceClaimService.listAll).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: undefined,
        claimType: undefined,
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should filter by status', async () => {
      const mockResult = {
        claims: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
      vi.mocked(insuranceClaimService.listAll).mockResolvedValue(mockResult as any);

      mockReq = {
        query: { page: '1', limit: '20', status: 'UNDER_REVIEW' },
      };

      await controller.listAll(mockReq as Request, mockRes as Response);

      expect(insuranceClaimService.listAll).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: 'UNDER_REVIEW',
        claimType: undefined,
      });
    });

    it('should filter by claim type', async () => {
      const mockResult = {
        claims: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
      vi.mocked(insuranceClaimService.listAll).mockResolvedValue(mockResult as any);

      mockReq = {
        query: { page: '1', limit: '20', claimType: 'TOOL_DAMAGE' },
      };

      await controller.listAll(mockReq as Request, mockRes as Response);

      expect(insuranceClaimService.listAll).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: undefined,
        claimType: 'TOOL_DAMAGE',
      });
    });

    it('should return 500 on error', async () => {
      vi.mocked(insuranceClaimService.listAll).mockRejectedValue(new Error('Database error'));

      mockReq = {
        query: {},
      };

      await controller.listAll(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Failed to list insurance claims',
      });
    });
  });

  describe('updateStatus (admin)', () => {
    it('should update claim status successfully', async () => {
      const mockClaim = { id: 'claim-123', status: 'UNDER_REVIEW' };
      vi.mocked(insuranceClaimService.updateStatus).mockResolvedValue(mockClaim as any);

      mockReq = {
        user: { id: 'admin-123' } as any,
        params: { id: 'claim-123' },
        body: {
          status: 'UNDER_REVIEW',
          adminNotes: 'Review started',
        },
      };

      await controller.updateStatus(mockReq as Request, mockRes as Response);

      expect(insuranceClaimService.updateStatus).toHaveBeenCalledWith({
        claimId: 'claim-123',
        status: 'UNDER_REVIEW',
        reviewedBy: 'admin-123',
        adminNotes: 'Review started',
        settlementAmount: undefined,
        rejectionReason: undefined,
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Claim status updated successfully',
        claim: mockClaim,
      });
    });

    it('should return 400 for invalid status', async () => {
      mockReq = {
        user: { id: 'admin-123' } as any,
        params: { id: 'claim-123' },
        body: {
          status: 'INVALID_STATUS',
        },
      };

      await controller.updateStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Invalid status',
      });
    });

    it('should update status to SETTLED with settlement amount', async () => {
      const mockClaim = { id: 'claim-123', status: 'SETTLED', settlementAmount: 5000 };
      vi.mocked(insuranceClaimService.updateStatus).mockResolvedValue(mockClaim as any);

      mockReq = {
        user: { id: 'admin-123' } as any,
        params: { id: 'claim-123' },
        body: {
          status: 'SETTLED',
          settlementAmount: '5000',
        },
      };

      await controller.updateStatus(mockReq as Request, mockRes as Response);

      expect(insuranceClaimService.updateStatus).toHaveBeenCalledWith({
        claimId: 'claim-123',
        status: 'SETTLED',
        reviewedBy: 'admin-123',
        adminNotes: undefined,
        settlementAmount: 5000,
        rejectionReason: undefined,
      });
    });

    it('should update status to REJECTED with rejection reason', async () => {
      const mockClaim = { id: 'claim-123', status: 'REJECTED' };
      vi.mocked(insuranceClaimService.updateStatus).mockResolvedValue(mockClaim as any);

      mockReq = {
        user: { id: 'admin-123' } as any,
        params: { id: 'claim-123' },
        body: {
          status: 'REJECTED',
          rejectionReason: 'Insufficient evidence',
        },
      };

      await controller.updateStatus(mockReq as Request, mockRes as Response);

      expect(insuranceClaimService.updateStatus).toHaveBeenCalledWith({
        claimId: 'claim-123',
        status: 'REJECTED',
        reviewedBy: 'admin-123',
        adminNotes: undefined,
        settlementAmount: undefined,
        rejectionReason: 'Insufficient evidence',
      });
    });

    it('should return 404 when claim not found', async () => {
      vi.mocked(insuranceClaimService.updateStatus).mockRejectedValue(
        new Error('Insurance claim not found')
      );

      mockReq = {
        user: { id: 'admin-123' } as any,
        params: { id: 'non-existent' },
        body: {
          status: 'UNDER_REVIEW',
        },
      };

      await controller.updateStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 when status transition is invalid', async () => {
      vi.mocked(insuranceClaimService.updateStatus).mockRejectedValue(
        new Error('Cannot transition from SUBMITTED to SETTLED')
      );

      mockReq = {
        user: { id: 'admin-123' } as any,
        params: { id: 'claim-123' },
        body: {
          status: 'SETTLED',
          settlementAmount: '5000',
        },
      };

      await controller.updateStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when rejection reason is required', async () => {
      vi.mocked(insuranceClaimService.updateStatus).mockRejectedValue(
        new Error('Rejection reason is required')
      );

      mockReq = {
        user: { id: 'admin-123' } as any,
        params: { id: 'claim-123' },
        body: {
          status: 'REJECTED',
        },
      };

      await controller.updateStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on unexpected error', async () => {
      vi.mocked(insuranceClaimService.updateStatus).mockRejectedValue(new Error('Database error'));

      mockReq = {
        user: { id: 'admin-123' } as any,
        params: { id: 'claim-123' },
        body: {
          status: 'UNDER_REVIEW',
        },
      };

      await controller.updateStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getStats (admin)', () => {
    it('should return claim statistics', async () => {
      const mockStats = {
        byStatus: {
          SUBMITTED: 10,
          UNDER_REVIEW: 5,
          SETTLED: 3,
        },
        byType: {
          TOOL_DAMAGE: 8,
          PROPERTY_DAMAGE: 5,
          THEFT: 5,
        },
        recentClaims: 15,
        totalSettled: {
          count: 3,
          amount: 15000,
        },
      };
      vi.mocked(insuranceClaimService.getStats).mockResolvedValue(mockStats);

      mockReq = {};

      await controller.getStats(mockReq as Request, mockRes as Response);

      expect(insuranceClaimService.getStats).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockStats);
    });

    it('should return 500 on error', async () => {
      vi.mocked(insuranceClaimService.getStats).mockRejectedValue(new Error('Database error'));

      mockReq = {};

      await controller.getStats(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Failed to get claim statistics',
      });
    });
  });

  // Test the exported singleton
  describe('exported instance', () => {
    it('should export insuranceClaimController instance', () => {
      expect(insuranceClaimController).toBeInstanceOf(InsuranceClaimController);
    });
  });
});
