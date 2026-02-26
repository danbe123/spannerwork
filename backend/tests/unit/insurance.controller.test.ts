import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock dependencies
const mockInsuranceService = vi.hoisted(() => ({
  createDocument: vi.fn(),
  getDocumentsByUser: vi.fn(),
  getInsuranceStatus: vi.fn(),
  deleteDocument: vi.fn(),
  getPendingDocuments: vi.fn(),
  getDocumentById: vi.fn(),
  updateDocumentStatus: vi.fn(),
  getExpiringDocuments: vi.fn(),
}));

vi.mock('../../src/services/insurance.service.js', () => ({
  insuranceService: mockInsuranceService,
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  uploadDocument,
  getMyDocuments,
  getMyInsuranceStatus,
  deleteDocument,
  getPendingDocuments,
  getDocumentById,
  approveDocument,
  rejectDocument,
  getExpiringDocuments,
  getUserDocuments,
} from '../../src/controllers/insurance.controller.js';

describe('Insurance Controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('uploadDocument', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockReq = { user: undefined, body: {} };

      await uploadDocument(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return 400 when document URL is missing', async () => {
      mockReq = { user: { id: 'user-123' }, body: {} };

      await uploadDocument(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Document URL is required' });
    });

    it('should upload document successfully', async () => {
      const mockDocument = {
        id: 'doc-123',
        userId: 'user-123',
        documentUrl: 'https://example.com/doc.pdf',
        documentType: 'PUBLIC_LIABILITY',
        status: 'PENDING_REVIEW',
      };
      mockInsuranceService.createDocument.mockResolvedValue(mockDocument);

      mockReq = {
        user: { id: 'user-123' },
        body: {
          documentUrl: 'https://example.com/doc.pdf',
          documentType: 'PUBLIC_LIABILITY',
          provider: 'Test Insurance Co',
          policyNumber: 'POL123',
          coverageAmount: '1000000',
          expiryDate: '2025-12-31',
        },
      };

      await uploadDocument(mockReq as Request, mockRes as Response, mockNext);

      expect(mockInsuranceService.createDocument).toHaveBeenCalledWith({
        userId: 'user-123',
        documentUrl: 'https://example.com/doc.pdf',
        documentType: 'PUBLIC_LIABILITY',
        provider: 'Test Insurance Co',
        policyNumber: 'POL123',
        coverageAmount: 1000000,
        expiryDate: new Date('2025-12-31'),
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockDocument,
        message: 'Insurance document uploaded successfully. It will be reviewed by our team.',
      });
    });

    it('should call next on error', async () => {
      const error = new Error('Database error');
      mockInsuranceService.createDocument.mockRejectedValue(error);

      mockReq = {
        user: { id: 'user-123' },
        body: { documentUrl: 'https://example.com/doc.pdf' },
      };

      await uploadDocument(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getMyDocuments', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockReq = { user: undefined };

      await getMyDocuments(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return user documents', async () => {
      const mockDocuments = [
        { id: 'doc-1', documentType: 'PUBLIC_LIABILITY', status: 'APPROVED' },
        { id: 'doc-2', documentType: 'PROFESSIONAL_INDEMNITY', status: 'PENDING_REVIEW' },
      ];
      mockInsuranceService.getDocumentsByUser.mockResolvedValue(mockDocuments);

      mockReq = { user: { id: 'user-123' } };

      await getMyDocuments(mockReq as Request, mockRes as Response, mockNext);

      expect(mockInsuranceService.getDocumentsByUser).toHaveBeenCalledWith('user-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockDocuments,
      });
    });
  });

  describe('getMyInsuranceStatus', () => {
    it('should return insurance status', async () => {
      const mockStatus = {
        hasValidInsurance: true,
        isVerified: true,
        documentsCount: 2,
      };
      mockInsuranceService.getInsuranceStatus.mockResolvedValue(mockStatus);

      mockReq = { user: { id: 'user-123' } };

      await getMyInsuranceStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(mockInsuranceService.getInsuranceStatus).toHaveBeenCalledWith('user-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockStatus,
      });
    });
  });

  describe('deleteDocument', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockReq = { user: undefined, params: { id: 'doc-123' } };

      await deleteDocument(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should delete document successfully', async () => {
      mockInsuranceService.deleteDocument.mockResolvedValue(undefined);

      mockReq = { user: { id: 'user-123' }, params: { id: 'doc-123' } };

      await deleteDocument(mockReq as Request, mockRes as Response, mockNext);

      expect(mockInsuranceService.deleteDocument).toHaveBeenCalledWith('doc-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Insurance document deleted',
      });
    });
  });

  describe('getPendingDocuments (Admin)', () => {
    it('should return pending documents with pagination', async () => {
      const mockResult = {
        documents: [
          { id: 'doc-1', status: 'PENDING_REVIEW' },
          { id: 'doc-2', status: 'PENDING_REVIEW' },
        ],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };
      mockInsuranceService.getPendingDocuments.mockResolvedValue(mockResult);

      mockReq = { query: { page: '1', limit: '20' } };

      await getPendingDocuments(mockReq as Request, mockRes as Response, mockNext);

      expect(mockInsuranceService.getPendingDocuments).toHaveBeenCalledWith({ page: 1, limit: 20 });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult.documents,
        pagination: mockResult.pagination,
      });
    });

    it('should use default pagination values', async () => {
      const mockResult = { documents: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
      mockInsuranceService.getPendingDocuments.mockResolvedValue(mockResult);

      mockReq = { query: {} };

      await getPendingDocuments(mockReq as Request, mockRes as Response, mockNext);

      expect(mockInsuranceService.getPendingDocuments).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });

    it('should cap limit at 100', async () => {
      const mockResult = { documents: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } };
      mockInsuranceService.getPendingDocuments.mockResolvedValue(mockResult);

      mockReq = { query: { limit: '500' } };

      await getPendingDocuments(mockReq as Request, mockRes as Response, mockNext);

      expect(mockInsuranceService.getPendingDocuments).toHaveBeenCalledWith({ page: 1, limit: 100 });
    });
  });

  describe('getDocumentById (Admin)', () => {
    it('should return document by ID', async () => {
      const mockDocument = {
        id: 'doc-123',
        userId: 'user-123',
        documentType: 'PUBLIC_LIABILITY',
        status: 'PENDING_REVIEW',
        user: { id: 'user-123', name: 'Test User' },
      };
      mockInsuranceService.getDocumentById.mockResolvedValue(mockDocument);

      mockReq = { params: { id: 'doc-123' } };

      await getDocumentById(mockReq as Request, mockRes as Response, mockNext);

      expect(mockInsuranceService.getDocumentById).toHaveBeenCalledWith('doc-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockDocument,
      });
    });
  });

  describe('approveDocument (Admin)', () => {
    it('should return 401 when admin is not authenticated', async () => {
      mockReq = { user: undefined, params: { id: 'doc-123' } };

      await approveDocument(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should approve document successfully', async () => {
      const mockDocument = {
        id: 'doc-123',
        status: 'APPROVED',
        reviewedBy: 'admin-123',
        reviewedAt: new Date(),
      };
      mockInsuranceService.updateDocumentStatus.mockResolvedValue(mockDocument);

      mockReq = { user: { id: 'admin-123' }, params: { id: 'doc-123' } };

      await approveDocument(mockReq as Request, mockRes as Response, mockNext);

      expect(mockInsuranceService.updateDocumentStatus).toHaveBeenCalledWith({
        documentId: 'doc-123',
        status: 'APPROVED',
        reviewedBy: 'admin-123',
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockDocument,
        message: 'Insurance document approved',
      });
    });
  });

  describe('rejectDocument (Admin)', () => {
    it('should return 401 when admin is not authenticated', async () => {
      mockReq = { user: undefined, params: { id: 'doc-123' }, body: { reason: 'Invalid' } };

      await rejectDocument(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 when rejection reason is missing', async () => {
      mockReq = { user: { id: 'admin-123' }, params: { id: 'doc-123' }, body: {} };

      await rejectDocument(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Rejection reason is required' });
    });

    it('should reject document successfully', async () => {
      const mockDocument = {
        id: 'doc-123',
        status: 'REJECTED',
        reviewedBy: 'admin-123',
        rejectionReason: 'Document is expired',
      };
      mockInsuranceService.updateDocumentStatus.mockResolvedValue(mockDocument);

      mockReq = {
        user: { id: 'admin-123' },
        params: { id: 'doc-123' },
        body: { reason: 'Document is expired' },
      };

      await rejectDocument(mockReq as Request, mockRes as Response, mockNext);

      expect(mockInsuranceService.updateDocumentStatus).toHaveBeenCalledWith({
        documentId: 'doc-123',
        status: 'REJECTED',
        reviewedBy: 'admin-123',
        rejectionReason: 'Document is expired',
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockDocument,
        message: 'Insurance document rejected',
      });
    });
  });

  describe('getExpiringDocuments (Admin)', () => {
    it('should return expiring documents with default 30 days', async () => {
      const mockDocuments = [
        { id: 'doc-1', expiryDate: new Date('2025-01-15') },
        { id: 'doc-2', expiryDate: new Date('2025-01-20') },
      ];
      mockInsuranceService.getExpiringDocuments.mockResolvedValue(mockDocuments);

      mockReq = { query: {} };

      await getExpiringDocuments(mockReq as Request, mockRes as Response, mockNext);

      expect(mockInsuranceService.getExpiringDocuments).toHaveBeenCalledWith(30);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockDocuments,
        count: 2,
      });
    });

    it('should accept custom days parameter', async () => {
      mockInsuranceService.getExpiringDocuments.mockResolvedValue([]);

      mockReq = { query: { days: '14' } };

      await getExpiringDocuments(mockReq as Request, mockRes as Response, mockNext);

      expect(mockInsuranceService.getExpiringDocuments).toHaveBeenCalledWith(14);
    });
  });

  describe('getUserDocuments (Admin)', () => {
    it('should return user documents and status', async () => {
      const mockDocuments = [{ id: 'doc-1', status: 'APPROVED' }];
      const mockStatus = { hasValidInsurance: true, isVerified: true };

      mockInsuranceService.getDocumentsByUser.mockResolvedValue(mockDocuments);
      mockInsuranceService.getInsuranceStatus.mockResolvedValue(mockStatus);

      mockReq = { params: { userId: 'user-123' } };

      await getUserDocuments(mockReq as Request, mockRes as Response, mockNext);

      expect(mockInsuranceService.getDocumentsByUser).toHaveBeenCalledWith('user-123');
      expect(mockInsuranceService.getInsuranceStatus).toHaveBeenCalledWith('user-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          documents: mockDocuments,
          status: mockStatus,
        },
      });
    });
  });
});
