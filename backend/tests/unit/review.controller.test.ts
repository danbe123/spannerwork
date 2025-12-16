import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Mock the service and logger
vi.mock('../../src/services/review.service.js', () => ({
  reviewService: {
    create: vi.fn(),
    getById: vi.fn(),
    getByUser: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { ReviewController } from '../../src/controllers/review.controller.js';
import { reviewService } from '../../src/services/review.service.js';

describe('ReviewController', () => {
  let controller: ReviewController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ReviewController();
    
    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
  });

  describe('create', () => {
    it('should create a review successfully', async () => {
      const mockReview = { id: 'review-123', rating: 5, comment: 'Great!' };
      vi.mocked(reviewService.create).mockResolvedValue(mockReview as any);

      mockReq = {
        user: { id: 'user-123' },
        body: {
          transactionId: 'trans-456',
          reviewedUserId: 'provider-789',
          rating: 5,
          comment: 'Great!',
        },
      };

      await controller.create(mockReq as Request, mockRes as Response);

      expect(reviewService.create).toHaveBeenCalledWith({
        reviewerId: 'user-123',
        transactionId: 'trans-456',
        reviewedUserId: 'provider-789',
        rating: 5,
        comment: 'Great!',
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Review created successfully',
        review: mockReview,
      });
    });

    it('should return 404 when transaction not found', async () => {
      vi.mocked(reviewService.create).mockRejectedValue(new Error('Transaction not found'));

      mockReq = {
        user: { id: 'user-123' },
        body: { transactionId: 'non-existent' },
      };

      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Transaction not found',
      });
    });

    it('should return 400 for already reviewed transaction', async () => {
      vi.mocked(reviewService.create).mockRejectedValue(
        new Error('You have already reviewed this transaction')
      );

      mockReq = {
        user: { id: 'user-123' },
        body: { transactionId: 'trans-456' },
      };

      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for incomplete transaction', async () => {
      vi.mocked(reviewService.create).mockRejectedValue(
        new Error('Can only review completed transactions')
      );

      mockReq = {
        user: { id: 'user-123' },
        body: { transactionId: 'trans-456' },
      };

      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on unknown error', async () => {
      vi.mocked(reviewService.create).mockRejectedValue(new Error('Unknown error'));

      mockReq = {
        user: { id: 'user-123' },
        body: {},
      };

      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getById', () => {
    it('should return review when found', async () => {
      const mockReview = { id: 'review-123', rating: 5 };
      vi.mocked(reviewService.getById).mockResolvedValue(mockReview as any);

      mockReq = { params: { id: 'review-123' } };

      await controller.getById(mockReq as Request, mockRes as Response);

      expect(reviewService.getById).toHaveBeenCalledWith('review-123');
      expect(mockRes.json).toHaveBeenCalledWith({ review: mockReview });
    });

    it('should return 404 when not found', async () => {
      vi.mocked(reviewService.getById).mockRejectedValue(new Error('Review not found'));

      mockReq = { params: { id: 'non-existent' } };

      await controller.getById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getByUser', () => {
    it('should return user reviews with pagination', async () => {
      const mockResult = {
        reviews: [{ id: 'review-1' }, { id: 'review-2' }],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };
      vi.mocked(reviewService.getByUser).mockResolvedValue(mockResult as any);

      mockReq = {
        params: { userId: 'user-123' },
        query: { page: '1', limit: '20' },
      };

      await controller.getByUser(mockReq as Request, mockRes as Response);

      expect(reviewService.getByUser).toHaveBeenCalledWith('user-123', {
        page: 1,
        limit: 20,
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 500 on error', async () => {
      vi.mocked(reviewService.getByUser).mockRejectedValue(new Error('Database error'));

      mockReq = {
        params: { userId: 'user-123' },
        query: {},
      };

      await controller.getByUser(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('update', () => {
    it('should update review when owner', async () => {
      const mockUpdated = { id: 'review-123', rating: 4 };
      vi.mocked(reviewService.update).mockResolvedValue(mockUpdated as any);

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'review-123' },
        body: { rating: 4, comment: 'Updated' },
      };

      await controller.update(mockReq as Request, mockRes as Response);

      expect(reviewService.update).toHaveBeenCalledWith('review-123', 'user-123', {
        rating: 4,
        comment: 'Updated',
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Review updated successfully',
        review: mockUpdated,
      });
    });

    it('should return 404 when review not found', async () => {
      vi.mocked(reviewService.update).mockRejectedValue(new Error('Review not found'));

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'non-existent' },
        body: {},
      };

      await controller.update(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 when not owner', async () => {
      vi.mocked(reviewService.update).mockRejectedValue(
        new Error('Not authorized to update this review')
      );

      mockReq = {
        user: { id: 'other-user' },
        params: { id: 'review-123' },
        body: {},
      };

      await controller.update(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('delete', () => {
    it('should delete review when owner', async () => {
      vi.mocked(reviewService.delete).mockResolvedValue();

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'review-123' },
      };

      await controller.delete(mockReq as Request, mockRes as Response);

      expect(reviewService.delete).toHaveBeenCalledWith('review-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Review deleted successfully',
      });
    });

    it('should return 404 when review not found', async () => {
      vi.mocked(reviewService.delete).mockRejectedValue(new Error('Review not found'));

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'non-existent' },
      };

      await controller.delete(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 when not owner', async () => {
      vi.mocked(reviewService.delete).mockRejectedValue(
        new Error('Not authorized to delete this review')
      );

      mockReq = {
        user: { id: 'other-user' },
        params: { id: 'review-123' },
      };

      await controller.delete(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });
});
