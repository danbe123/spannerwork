import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist prisma mocks
const mockPrisma = vi.hoisted(() => ({
  transaction: {
    findUnique: vi.fn(),
  },
  review: {
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
    count: vi.fn(),
  },
  user: {
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: mockPrisma,
}));

import { ReviewService } from '../../src/services/review.service.js';

describe('ReviewService', () => {
  let reviewService: ReviewService;

  beforeEach(() => {
    vi.clearAllMocks();
    reviewService = new ReviewService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('create', () => {
    const mockReviewData = {
      reviewerId: 'user-123',
      transactionId: 'trans-456',
      reviewedUserId: 'provider-789',
      rating: 5,
      comment: 'Excellent service!',
    };

    it('should create a review for completed transaction', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'trans-456',
        userId: 'user-123',
        providerId: 'provider-789',
        status: 'COMPLETED',
        completedDate: new Date(),
      });

      mockPrisma.review.findUnique.mockResolvedValue(null);

      const mockCreatedReview = {
        id: 'review-123',
        ...mockReviewData,
        createdDate: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          review: {
            create: vi.fn().mockResolvedValue(mockCreatedReview),
            aggregate: vi.fn().mockResolvedValue({ _avg: { rating: 4.5 }, _count: { rating: 10 } }),
          },
          user: {
            update: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await reviewService.create(mockReviewData);

      expect(mockPrisma.transaction.findUnique).toHaveBeenCalledWith({
        where: { id: 'trans-456' },
        select: expect.any(Object),
      });
      expect(result).toBeDefined();
    });

    it('should throw error when transaction not found', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      await expect(reviewService.create(mockReviewData))
        .rejects.toThrow('Transaction not found');
    });

    it('should throw error when transaction not completed', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'trans-456',
        userId: 'user-123',
        providerId: 'provider-789',
        status: 'IN_PROGRESS',
        completedDate: null,
      });

      await expect(reviewService.create(mockReviewData))
        .rejects.toThrow('Can only review completed transactions');
    });

    it('should throw error when review deadline passed', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31); // 31 days ago

      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'trans-456',
        userId: 'user-123',
        providerId: 'provider-789',
        status: 'COMPLETED',
        completedDate: oldDate,
      });

      await expect(reviewService.create(mockReviewData))
        .rejects.toThrow('Review deadline has passed (30 days after completion)');
    });

    it('should throw error when reviewer not part of transaction', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'trans-456',
        userId: 'other-user',
        providerId: 'other-provider',
        status: 'COMPLETED',
        completedDate: new Date(),
      });

      await expect(reviewService.create(mockReviewData))
        .rejects.toThrow('You can only review transactions you were part of');
    });

    it('should throw error when already reviewed', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'trans-456',
        userId: 'user-123',
        providerId: 'provider-789',
        status: 'COMPLETED',
        completedDate: new Date(),
      });

      mockPrisma.review.findUnique.mockResolvedValue({
        id: 'existing-review',
        transactionId: 'trans-456',
        reviewerId: 'user-123',
      });

      await expect(reviewService.create(mockReviewData))
        .rejects.toThrow('You have already reviewed this transaction');
    });

    it('should allow provider to review within deadline', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 15); // 15 days ago

      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'trans-456',
        userId: 'user-123',
        providerId: 'provider-789',
        status: 'COMPLETED',
        completedDate: recentDate,
      });

      mockPrisma.review.findUnique.mockResolvedValue(null);

      const providerReview = {
        ...mockReviewData,
        reviewerId: 'provider-789',
        reviewedUserId: 'user-123',
      };

      const mockCreatedReview = { id: 'review-123', ...providerReview };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          review: {
            create: vi.fn().mockResolvedValue(mockCreatedReview),
            aggregate: vi.fn().mockResolvedValue({ _avg: { rating: 4.0 }, _count: { rating: 5 } }),
          },
          user: {
            update: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await reviewService.create(providerReview);

      expect(result).toBeDefined();
    });
  });

  describe('getById', () => {
    it('should return review by id', async () => {
      const mockReview = { id: 'review-123', rating: 5, comment: 'Great!' };
      mockPrisma.review.findUnique.mockResolvedValue(mockReview);

      const result = await reviewService.getById('review-123');

      expect(mockPrisma.review.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'review-123' },
        })
      );
      expect(result).toEqual(mockReview);
    });

    it('should throw error when review not found', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      await expect(reviewService.getById('non-existent'))
        .rejects.toThrow('Review not found');
    });
  });

  describe('getByUser', () => {
    it('should return reviews for a user', async () => {
      const mockReviews = [
        { id: 'review-1', rating: 5 },
        { id: 'review-2', rating: 4 },
        { id: 'review-3', rating: 5 },
      ];

      mockPrisma.review.findMany.mockResolvedValue(mockReviews);
      mockPrisma.review.count.mockResolvedValue(3);

      const result = await reviewService.getByUser('user-123', { page: 1, limit: 10 });

      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { reviewedUserId: 'user-123' },
        })
      );
      expect(result.reviews).toHaveLength(3);
    });

    it('should paginate reviews', async () => {
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.review.count.mockResolvedValue(50);

      await reviewService.getByUser('user-123', { page: 2, limit: 10 });

      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('should use default pagination values', async () => {
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.review.count.mockResolvedValue(0);

      await reviewService.getByUser('user-123');

      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        })
      );
    });
  });

  describe('updateUserRating', () => {
    it('should update user rating based on reviews', async () => {
      mockPrisma.review.aggregate.mockResolvedValue({
        _avg: { rating: 4.5 },
        _count: { rating: 10 },
      });
      mockPrisma.user.update.mockResolvedValue({});

      await reviewService.updateUserRating('user-123');

      expect(mockPrisma.review.aggregate).toHaveBeenCalledWith({
        where: { reviewedUserId: 'user-123' },
        _avg: { rating: true },
        _count: { rating: true },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          rating: 4.5,
          totalReviews: 10,
        },
      });
    });

    it('should handle zero reviews', async () => {
      mockPrisma.review.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: { rating: 0 },
      });
      mockPrisma.user.update.mockResolvedValue({});

      await reviewService.updateUserRating('user-123');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          rating: 0,
          totalReviews: 0,
        },
      });
    });
  });

  describe('update', () => {
    beforeEach(() => {
      mockPrisma.review.findUnique.mockResolvedValue({
        reviewerId: 'user-123',
        reviewedUserId: 'provider-789',
      });
    });

    it('should update review when owner', async () => {
      const mockUpdatedReview = { id: 'review-123', rating: 4, comment: 'Updated' };
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          review: {
            update: vi.fn().mockResolvedValue(mockUpdatedReview),
            aggregate: vi.fn().mockResolvedValue({ _avg: { rating: 4.2 }, _count: { rating: 5 } }),
          },
          user: {
            update: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await reviewService.update('review-123', 'user-123', { rating: 4 });

      expect(result).toEqual(mockUpdatedReview);
    });

    it('should throw error when not owner', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        reviewerId: 'other-user',
        reviewedUserId: 'provider-789',
      });

      await expect(reviewService.update('review-123', 'user-123', { rating: 4 }))
        .rejects.toThrow('Not authorized to update this review');
    });

    it('should throw error when review not found', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      await expect(reviewService.update('review-123', 'user-123', { rating: 4 }))
        .rejects.toThrow('Review not found');
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      mockPrisma.review.findUnique.mockResolvedValue({
        reviewerId: 'user-123',
        reviewedUserId: 'provider-789',
      });
    });

    it('should delete review when owner', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          review: {
            delete: vi.fn().mockResolvedValue({}),
            aggregate: vi.fn().mockResolvedValue({ _avg: { rating: 4.0 }, _count: { rating: 4 } }),
          },
          user: {
            update: vi.fn().mockResolvedValue({}),
          },
        });
      });

      await reviewService.delete('review-123', 'user-123');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw error when not owner', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        reviewerId: 'other-user',
        reviewedUserId: 'provider-789',
      });

      await expect(reviewService.delete('review-123', 'user-123'))
        .rejects.toThrow('Not authorized to delete this review');
    });

    it('should throw error when review not found', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      await expect(reviewService.delete('review-123', 'user-123'))
        .rejects.toThrow('Review not found');
    });
  });
});
