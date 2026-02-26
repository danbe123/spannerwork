import { Request, Response } from 'express';
import { disputeService } from '../services/dispute.service.js';
import { logger } from '../config/logger.js';

export class DisputeController {
  /**
   * Create a dispute
   * POST /api/v1/disputes
   */
  async create(req: Request, res: Response) {
    try {
      const initiatorId = req.user!.id;
      const { transactionId, reason, description } = req.body;

      const dispute = await disputeService.create({
        initiatorId,
        transactionId,
        reason,
        description,
      });

      return res.status(201).json({
        message: 'Dispute created successfully',
        dispute,
      });
    } catch (error) {
      logger.error('Error creating dispute:', error);
      if (error instanceof Error) {
        if (error.message === 'Transaction not found') {
          return res.status(404).json({ error: 'Not Found', message: error.message });
        }
        if (
          error.message.includes('only dispute transactions') ||
          error.message.includes('already exists') ||
          error.message.includes('Invalid transaction')
        ) {
          return res.status(400).json({ error: 'Bad Request', message: error.message });
        }
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create dispute',
      });
    }
  }

  /**
   * List disputes
   * GET /api/v1/disputes
   */
  async list(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { status, page, limit } = req.query;

      const result = await disputeService.list({
        userId,
        status: status as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        adminView: false,
      });

      return res.json(result);
    } catch (error) {
      logger.error('Error listing disputes:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to list disputes',
      });
    }
  }

  /**
   * Get dispute by ID
   * GET /api/v1/disputes/:id
   */
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const dispute = await disputeService.getById(id, userId);

      return res.json({ dispute });
    } catch (error) {
      logger.error('Error getting dispute:', error);
      if (error instanceof Error) {
        if (error.message === 'Dispute not found') {
          return res.status(404).json({ error: 'Not Found', message: error.message });
        }
        if (error.message.includes('Not authorized')) {
          return res.status(403).json({ error: 'Forbidden', message: error.message });
        }
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get dispute',
      });
    }
  }

  /**
   * Resolve a dispute (admin only)
   * POST /api/v1/disputes/:id/resolve
   */
  async resolve(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { resolution, refundAmountInitiator, refundAmountRespondent } = req.body;

      const dispute = await disputeService.resolve(id, {
        resolution,
        refundAmountInitiator,
        refundAmountRespondent,
      });

      return res.json({
        message: 'Dispute resolved successfully',
        dispute,
      });
    } catch (error) {
      logger.error('Error resolving dispute:', error);
      if (error instanceof Error) {
        if (error.message === 'Dispute not found') {
          return res.status(404).json({ error: 'Not Found', message: error.message });
        }
        if (error.message.includes('already resolved')) {
          return res.status(400).json({ error: 'Bad Request', message: error.message });
        }
      }
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to resolve dispute',
      });
    }
  }

  /**
   * Update dispute status (admin only)
   * PATCH /api/v1/disputes/:id/status
   */
  async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED'].includes(status)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid status',
        });
      }

      const dispute = await disputeService.updateStatus(id, status);

      return res.json({
        message: 'Dispute status updated',
        dispute,
      });
    } catch (error) {
      logger.error('Error updating dispute status:', error);
      if (error instanceof Error && error.message === 'Dispute not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update dispute status',
      });
    }
  }

  /**
   * Add evidence to a dispute
   * POST /api/v1/disputes/:id/evidence
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

      const evidence = await disputeService.addEvidence({
        disputeId: id,
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
      logger.error('Error adding evidence:', error);
      if (error instanceof Error) {
        if (error.message === 'Dispute not found') {
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
   * Get evidence for a dispute
   * GET /api/v1/disputes/:id/evidence
   */
  async getEvidence(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const isAdmin = req.user!.role === 'ADMIN';

      const evidence = await disputeService.getEvidence(id, isAdmin ? undefined : userId);

      return res.json({ evidence });
    } catch (error) {
      logger.error('Error getting evidence:', error);
      if (error instanceof Error) {
        if (error.message === 'Dispute not found') {
          return res.status(404).json({ error: 'Not Found', message: error.message });
        }
        if (error.message.includes('Not authorized')) {
          return res.status(403).json({ error: 'Forbidden', message: error.message });
        }
      }
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get evidence',
      });
    }
  }

  /**
   * Delete evidence from a dispute
   * DELETE /api/v1/disputes/:disputeId/evidence/:evidenceId
   */
  async deleteEvidence(req: Request, res: Response) {
    try {
      const { evidenceId } = req.params;
      const userId = req.user!.id;

      await disputeService.deleteEvidence(evidenceId, userId);

      return res.json({ message: 'Evidence deleted successfully' });
    } catch (error) {
      logger.error('Error deleting evidence:', error);
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
}

export const disputeController = new DisputeController();
