import { Request, Response } from 'express';
import { insuranceClaimService } from '../services/insuranceClaim.service.js';
import { InsuranceClaimStatus, InsuranceClaimType } from '@prisma/client';
import { logger } from '../config/logger.js';

export class InsuranceClaimController {
  /**
   * File a new insurance claim
   * POST /api/v1/insurance-claims
   */
  async create(req: Request, res: Response) {
    try {
      const claimantId = req.user!.id;
      const { transactionId, claimType, incidentDate, description, claimAmount } = req.body;

      if (!transactionId || !claimType || !incidentDate || !description || claimAmount === undefined) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'transactionId, claimType, incidentDate, description, and claimAmount are required',
        });
      }

      const validClaimTypes: InsuranceClaimType[] = [
        'TOOL_DAMAGE',
        'PROPERTY_DAMAGE',
        'PERSONAL_INJURY',
        'THEFT',
        'ACCIDENTAL_DAMAGE',
        'OTHER',
      ];
      if (!validClaimTypes.includes(claimType)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid claim type',
        });
      }

      const claim = await insuranceClaimService.create({
        transactionId,
        claimantId,
        claimType,
        incidentDate: new Date(incidentDate),
        description,
        claimAmount: parseInt(claimAmount, 10),
      });

      return res.status(201).json({
        message: 'Insurance claim filed successfully',
        claim,
      });
    } catch (error) {
      logger.error('Error creating insurance claim:', error);
      if (error instanceof Error) {
        if (error.message === 'Transaction not found') {
          return res.status(404).json({ error: 'Not Found', message: error.message });
        }
        if (error.message.includes('Not authorized') || error.message.includes('only file claims')) {
          return res.status(403).json({ error: 'Forbidden', message: error.message });
        }
        if (error.message.includes('already have an active claim') || error.message.includes('Incident date')) {
          return res.status(400).json({ error: 'Bad Request', message: error.message });
        }
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to file insurance claim',
      });
    }
  }

  /**
   * Get user's insurance claims
   * GET /api/v1/insurance-claims
   */
  async listMyClaims(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { page, limit, status } = req.query;

      const result = await insuranceClaimService.listByUser(userId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as InsuranceClaimStatus | undefined,
      });

      return res.json(result);
    } catch (error) {
      logger.error('Error listing insurance claims:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to list insurance claims',
      });
    }
  }

  /**
   * Get claim by ID
   * GET /api/v1/insurance-claims/:id
   */
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const isAdmin = req.user!.role === 'ADMIN';

      const claim = await insuranceClaimService.getById(id, userId, isAdmin);

      return res.json({ claim });
    } catch (error) {
      logger.error('Error getting insurance claim:', error);
      if (error instanceof Error) {
        if (error.message === 'Insurance claim not found') {
          return res.status(404).json({ error: 'Not Found', message: error.message });
        }
        if (error.message.includes('Not authorized')) {
          return res.status(403).json({ error: 'Forbidden', message: error.message });
        }
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get insurance claim',
      });
    }
  }

  /**
   * Withdraw a claim
   * POST /api/v1/insurance-claims/:id/withdraw
   */
  async withdraw(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const claim = await insuranceClaimService.withdraw(id, userId);

      return res.json({
        message: 'Insurance claim withdrawn successfully',
        claim,
      });
    } catch (error) {
      logger.error('Error withdrawing insurance claim:', error);
      if (error instanceof Error) {
        if (error.message === 'Insurance claim not found') {
          return res.status(404).json({ error: 'Not Found', message: error.message });
        }
        if (error.message.includes('Only the claimant')) {
          return res.status(403).json({ error: 'Forbidden', message: error.message });
        }
        if (error.message.includes('cannot be withdrawn')) {
          return res.status(400).json({ error: 'Bad Request', message: error.message });
        }
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to withdraw insurance claim',
      });
    }
  }

  /**
   * Add evidence to a claim
   * POST /api/v1/insurance-claims/:id/evidence
   */
  async addEvidence(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const uploaderId = req.user!.id;
      const { fileUrl, fileName, fileType, fileSize, description } = req.body;

      if (!fileUrl || !fileName || !fileType || !fileSize) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'fileUrl, fileName, fileType, and fileSize are required',
        });
      }

      const evidence = await insuranceClaimService.addEvidence({
        claimId: id,
        uploaderId,
        fileUrl,
        fileName,
        fileType,
        fileSize: parseInt(fileSize, 10),
        description,
      });

      return res.status(201).json({
        message: 'Evidence added successfully',
        evidence,
      });
    } catch (error) {
      logger.error('Error adding claim evidence:', error);
      if (error instanceof Error) {
        if (error.message === 'Insurance claim not found') {
          return res.status(404).json({ error: 'Not Found', message: error.message });
        }
        if (error.message.includes('Not authorized')) {
          return res.status(403).json({ error: 'Forbidden', message: error.message });
        }
        if (error.message.includes('Cannot add evidence')) {
          return res.status(400).json({ error: 'Bad Request', message: error.message });
        }
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to add evidence',
      });
    }
  }

  /**
   * Delete evidence from a claim
   * DELETE /api/v1/insurance-claims/:claimId/evidence/:evidenceId
   */
  async deleteEvidence(req: Request, res: Response) {
    try {
      const { evidenceId } = req.params;
      const userId = req.user!.id;

      await insuranceClaimService.deleteEvidence(evidenceId, userId);

      return res.json({ message: 'Evidence deleted successfully' });
    } catch (error) {
      logger.error('Error deleting claim evidence:', error);
      if (error instanceof Error) {
        if (error.message === 'Evidence not found') {
          return res.status(404).json({ error: 'Not Found', message: error.message });
        }
        if (error.message.includes('Not authorized')) {
          return res.status(403).json({ error: 'Forbidden', message: error.message });
        }
        if (error.message.includes('Cannot delete')) {
          return res.status(400).json({ error: 'Bad Request', message: error.message });
        }
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete evidence',
      });
    }
  }

  // =============================================================================
  // ADMIN ENDPOINTS
  // =============================================================================

  /**
   * List all claims (admin)
   * GET /api/v1/admin/insurance-claims
   */
  async listAll(req: Request, res: Response) {
    try {
      const { page, limit, status, claimType } = req.query;

      const result = await insuranceClaimService.listAll({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as InsuranceClaimStatus | undefined,
        claimType: claimType as InsuranceClaimType | undefined,
      });

      return res.json(result);
    } catch (error) {
      logger.error('Error listing all insurance claims:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to list insurance claims',
      });
    }
  }

  /**
   * Update claim status (admin)
   * PATCH /api/v1/admin/insurance-claims/:id/status
   */
  async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const reviewedBy = req.user!.id;
      const { status, adminNotes, settlementAmount, rejectionReason } = req.body;

      const validStatuses: InsuranceClaimStatus[] = [
        'UNDER_REVIEW',
        'ADDITIONAL_INFO',
        'APPROVED',
        'SETTLED',
        'REJECTED',
      ];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid status',
        });
      }

      const claim = await insuranceClaimService.updateStatus({
        claimId: id,
        status,
        reviewedBy,
        adminNotes,
        settlementAmount: settlementAmount !== undefined ? parseInt(settlementAmount, 10) : undefined,
        rejectionReason,
      });

      return res.json({
        message: 'Claim status updated successfully',
        claim,
      });
    } catch (error) {
      logger.error('Error updating claim status:', error);
      if (error instanceof Error) {
        if (error.message === 'Insurance claim not found') {
          return res.status(404).json({ error: 'Not Found', message: error.message });
        }
        if (error.message.includes('Cannot transition') || error.message.includes('required')) {
          return res.status(400).json({ error: 'Bad Request', message: error.message });
        }
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update claim status',
      });
    }
  }

  /**
   * Get claim statistics (admin)
   * GET /api/v1/admin/insurance-claims/stats
   */
  async getStats(_req: Request, res: Response) {
    try {
      const stats = await insuranceClaimService.getStats();
      return res.json(stats);
    } catch (error) {
      logger.error('Error getting claim stats:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get claim statistics',
      });
    }
  }
}

export const insuranceClaimController = new InsuranceClaimController();
