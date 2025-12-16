import { Request, Response } from 'express';
import { reviewService } from '../services/review.service.js';
import { logger } from '../config/logger.js';

export class ReviewController {
  /**
   * Create a review
   * POST /api/v1/reviews
   */
  async create(req: Request, res: Response) {
    try {
      const reviewerId = req.user!.id;
      const { transactionId, reviewedUserId, rating, comment } = req.body;

      const review = await reviewService.create({
        reviewerId,
        transactionId,
        reviewedUserId,
        rating,
        comment,
      });

      return res.status(201).json({
        message: 'Review created successfully',
        review,
      });
    } catch (error) {
      logger.error('Error creating review:', error);
      if (error instanceof Error) {
        if (error.message === 'Transaction not found') {
          return res.status(404).json({ error: 'Not Found', message: error.message });
        }
        if (
          error.message.includes('only review completed') ||
          error.message.includes('already reviewed') ||
          error.message.includes('only review transactions')
        ) {
          return res.status(400).json({ error: 'Bad Request', message: error.message });
        }
      }
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create review',
      });
    }
  }

  /**
   * Get review by ID
   * GET /api/v1/reviews/:id
   */
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const review = await reviewService.getById(id);

      return res.json({ review });
    } catch (error) {
      logger.error('Error getting review:', error);
      if (error instanceof Error && error.message === 'Review not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get review',
      });
    }
  }

  /**
   * Get reviews for a user
   * GET /api/v1/reviews/user/:userId
   */
  async getByUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { page, limit } = req.query;

      const result = await reviewService.getByUser(userId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      return res.json(result);
    } catch (error) {
      logger.error('Error getting user reviews:', error);
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get reviews',
      });
    }
  }

  /**
   * Update a review
   * PATCH /api/v1/reviews/:id
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const reviewerId = req.user!.id;
      const { rating, comment } = req.body;

      const review = await reviewService.update(id, reviewerId, {
        rating,
        comment,
      });

      return res.json({
        message: 'Review updated successfully',
        review,
      });
    } catch (error) {
      logger.error('Error updating review:', error);
      if (error instanceof Error) {
        if (error.message === 'Review not found') {
          return res.status(404).json({ error: 'Not Found', message: error.message });
        }
        if (error.message.includes('Not authorized')) {
          return res.status(403).json({ error: 'Forbidden', message: error.message });
        }
      }
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update review',
      });
    }
  }

  /**
   * Delete a review
   * DELETE /api/v1/reviews/:id
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const reviewerId = req.user!.id;

      await reviewService.delete(id, reviewerId);

      return res.json({
        message: 'Review deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting review:', error);
      if (error instanceof Error) {
        if (error.message === 'Review not found') {
          return res.status(404).json({ error: 'Not Found', message: error.message });
        }
        if (error.message.includes('Not authorized')) {
          return res.status(403).json({ error: 'Forbidden', message: error.message });
        }
      }
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete review',
      });
    }
  }
}

export const reviewController = new ReviewController();
