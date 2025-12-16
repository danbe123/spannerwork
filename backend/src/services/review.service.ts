import { prisma } from '../config/database.js';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../utils/errors.js';

// Review deadline in days after transaction completion
const REVIEW_DEADLINE_DAYS = 30;

export class ReviewService {
  /**
   * Create a review
   */
  async create(data: {
    reviewerId: string;
    transactionId: string;
    reviewedUserId: string;
    rating: number;
    comment?: string;
  }) {
    // Check if transaction exists and is completed
    const transaction = await prisma.transaction.findUnique({
      where: { id: data.transactionId },
      select: {
        id: true,
        userId: true,
        providerId: true,
        status: true,
        completedDate: true,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    if (transaction.status !== 'COMPLETED') {
      throw new BadRequestError('Can only review completed transactions');
    }

    // Check review deadline
    if (transaction.completedDate) {
      const deadlineDate = new Date();
      deadlineDate.setDate(deadlineDate.getDate() - REVIEW_DEADLINE_DAYS);

      if (transaction.completedDate < deadlineDate) {
        throw new BadRequestError(`Review deadline has passed (${REVIEW_DEADLINE_DAYS} days after completion)`);
      }
    }

    // Check if reviewer is part of the transaction
    if (transaction.userId !== data.reviewerId && transaction.providerId !== data.reviewerId) {
      throw new ForbiddenError('You can only review transactions you were part of');
    }

    // Check if already reviewed
    const existingReview = await prisma.review.findUnique({
      where: {
        transactionId_reviewerId: {
          transactionId: data.transactionId,
          reviewerId: data.reviewerId,
        },
      },
    });

    if (existingReview) {
      throw new ConflictError('You have already reviewed this transaction');
    }

    // Create review and update user rating atomically
    const review = await prisma.$transaction(async (tx) => {
      // Create the review
      const newReview = await tx.review.create({
        data: {
          transactionId: data.transactionId,
          reviewerId: data.reviewerId,
          reviewedUserId: data.reviewedUserId,
          rating: data.rating,
          comment: data.comment,
        },
        include: {
          reviewer: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          reviewedUser: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          transaction: {
            select: {
              id: true,
              tool: {
                select: {
                  id: true,
                  name: true,
                },
              },
              space: {
                select: {
                  id: true,
                  name: true,
                },
              },
              service: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Update user's rating using aggregate for better performance
      const ratingStats = await tx.review.aggregate({
        where: { reviewedUserId: data.reviewedUserId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.user.update({
        where: { id: data.reviewedUserId },
        data: {
          rating: Math.round((ratingStats._avg.rating || 0) * 10) / 10,
          totalReviews: ratingStats._count.rating,
        },
      });

      return newReview;
    });

    return review;
  }

  /**
   * Update user's average rating
   */
  async updateUserRating(userId: string) {
    // Use aggregate for better performance instead of fetching all reviews
    const ratingStats = await prisma.review.aggregate({
      where: { reviewedUserId: userId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        rating: Math.round((ratingStats._avg.rating || 0) * 10) / 10,
        totalReviews: ratingStats._count.rating,
      },
    });
  }

  /**
   * Get review by ID
   */
  async getById(id: string) {
    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        reviewedUser: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        transaction: {
          select: {
            id: true,
            tool: {
              select: {
                id: true,
                name: true,
              },
            },
            space: {
              select: {
                id: true,
                name: true,
              },
            },
            service: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    return review;
  }

  /**
   * Get reviews for a user
   */
  async getByUser(
    userId: string,
    options: { page?: number; limit?: number } = {}
  ) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { reviewedUserId: userId },
        include: {
          reviewer: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          transaction: {
            select: {
              id: true,
              tool: {
                select: {
                  id: true,
                  name: true,
                },
              },
              space: {
                select: {
                  id: true,
                  name: true,
                },
              },
              service: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where: { reviewedUserId: userId } }),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update a review
   */
  async update(id: string, reviewerId: string, data: { rating?: number; comment?: string }) {
    const review = await prisma.review.findUnique({
      where: { id },
      select: { reviewerId: true, reviewedUserId: true },
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    if (review.reviewerId !== reviewerId) {
      throw new ForbiddenError('Not authorized to update this review');
    }

    // Update review and user rating atomically (if rating changed)
    const updated = await prisma.$transaction(async (tx) => {
      const updatedReview = await tx.review.update({
        where: { id },
        data: {
          rating: data.rating,
          comment: data.comment,
        },
        include: {
          reviewer: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          reviewedUser: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      // Update user's rating if rating changed using aggregate for better performance
      if (data.rating !== undefined) {
        const ratingStats = await tx.review.aggregate({
          where: { reviewedUserId: review.reviewedUserId },
          _avg: { rating: true },
          _count: { rating: true },
        });

        if (ratingStats._count.rating > 0) {
          await tx.user.update({
            where: { id: review.reviewedUserId },
            data: {
              rating: Math.round((ratingStats._avg.rating || 0) * 10) / 10,
              totalReviews: ratingStats._count.rating,
            },
          });
        }
      }

      return updatedReview;
    });

    return updated;
  }

  /**
   * Delete a review
   */
  async delete(id: string, reviewerId: string) {
    const review = await prisma.review.findUnique({
      where: { id },
      select: { reviewerId: true, reviewedUserId: true },
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    if (review.reviewerId !== reviewerId) {
      throw new ForbiddenError('Not authorized to delete this review');
    }

    // Delete review and update user rating atomically
    await prisma.$transaction(async (tx) => {
      await tx.review.delete({
        where: { id },
      });

      // Update user's rating using aggregate for better performance
      const ratingStats = await tx.review.aggregate({
        where: { reviewedUserId: review.reviewedUserId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.user.update({
        where: { id: review.reviewedUserId },
        data: {
          rating: Math.round((ratingStats._avg.rating || 0) * 10) / 10,
          totalReviews: ratingStats._count.rating,
        },
      });
    });
  }
}

export const reviewService = new ReviewService();
