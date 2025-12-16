/**
 * Insurance Controller
 * 
 * Handles insurance document API endpoints:
 * - Provider: upload, view, delete their documents
 * - Admin: review, approve/reject documents
 */

import { Request, Response, NextFunction } from 'express';
import { insuranceService } from '../services/insurance.service.js';
import { logger } from '../config/logger.js';
import { InsuranceType } from '@prisma/client';

/**
 * POST /api/v1/insurance/upload
 * Upload a new insurance document
 */
export async function uploadDocument(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { documentUrl, documentType, provider, policyNumber, coverageAmount, expiryDate } = req.body;

    if (!documentUrl) {
      res.status(400).json({ error: 'Document URL is required' });
      return;
    }

    const document = await insuranceService.createDocument({
      userId,
      documentUrl,
      documentType: documentType as InsuranceType,
      provider,
      policyNumber,
      coverageAmount: coverageAmount ? parseInt(coverageAmount, 10) : undefined,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
    });

    res.status(201).json({
      success: true,
      data: document,
      message: 'Insurance document uploaded successfully. It will be reviewed by our team.',
    });
  } catch (error) {
    logger.error('Failed to upload insurance document:', error);
    next(error);
  }
}

/**
 * GET /api/v1/insurance/my-documents
 * Get current user's insurance documents
 */
export async function getMyDocuments(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const documents = await insuranceService.getDocumentsByUser(userId);

    res.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    logger.error('Failed to get insurance documents:', error);
    next(error);
  }
}

/**
 * GET /api/v1/insurance/status
 * Get current user's insurance status summary
 */
export async function getMyInsuranceStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const status = await insuranceService.getInsuranceStatus(userId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Failed to get insurance status:', error);
    next(error);
  }
}

/**
 * DELETE /api/v1/insurance/:id
 * Delete an insurance document (only pending/rejected)
 */
export async function deleteDocument(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    await insuranceService.deleteDocument(id, userId);

    res.json({
      success: true,
      message: 'Insurance document deleted',
    });
  } catch (error) {
    logger.error('Failed to delete insurance document:', error);
    next(error);
  }
}

// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================

/**
 * GET /api/v1/admin/insurance/pending
 * Get all documents pending review
 */
export async function getPendingDocuments(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const result = await insuranceService.getPendingDocuments({ page, limit });

    res.json({
      success: true,
      data: result.documents,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Failed to get pending insurance documents:', error);
    next(error);
  }
}

/**
 * GET /api/v1/admin/insurance/:id
 * Get a specific insurance document (admin view)
 */
export async function getDocumentById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const document = await insuranceService.getDocumentById(id);

    res.json({
      success: true,
      data: document,
    });
  } catch (error) {
    logger.error('Failed to get insurance document:', error);
    next(error);
  }
}

/**
 * POST /api/v1/admin/insurance/:id/approve
 * Approve an insurance document
 */
export async function approveDocument(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminId = req.user?.id;
    if (!adminId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const document = await insuranceService.updateDocumentStatus({
      documentId: id,
      status: 'APPROVED',
      reviewedBy: adminId,
    });

    res.json({
      success: true,
      data: document,
      message: 'Insurance document approved',
    });
  } catch (error) {
    logger.error('Failed to approve insurance document:', error);
    next(error);
  }
}

/**
 * POST /api/v1/admin/insurance/:id/reject
 * Reject an insurance document
 */
export async function rejectDocument(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminId = req.user?.id;
    if (!adminId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({ error: 'Rejection reason is required' });
      return;
    }

    const document = await insuranceService.updateDocumentStatus({
      documentId: id,
      status: 'REJECTED',
      reviewedBy: adminId,
      rejectionReason: reason,
    });

    res.json({
      success: true,
      data: document,
      message: 'Insurance document rejected',
    });
  } catch (error) {
    logger.error('Failed to reject insurance document:', error);
    next(error);
  }
}

/**
 * GET /api/v1/admin/insurance/expiring
 * Get documents expiring soon (for proactive outreach)
 */
export async function getExpiringDocuments(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const days = parseInt(req.query.days as string) || 30;

    const documents = await insuranceService.getExpiringDocuments(days);

    res.json({
      success: true,
      data: documents,
      count: documents.length,
    });
  } catch (error) {
    logger.error('Failed to get expiring insurance documents:', error);
    next(error);
  }
}

/**
 * GET /api/v1/admin/insurance/user/:userId
 * Get all insurance documents for a specific user (admin)
 */
export async function getUserDocuments(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req.params;

    const documents = await insuranceService.getDocumentsByUser(userId);
    const status = await insuranceService.getInsuranceStatus(userId);

    res.json({
      success: true,
      data: {
        documents,
        status,
      },
    });
  } catch (error) {
    logger.error('Failed to get user insurance documents:', error);
    next(error);
  }
}

export default {
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
};
