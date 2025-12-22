import { prisma } from '../config/database.js';
import { geocodingService } from './geocoding.service.js';
import { Prisma, User } from '@prisma/client';
import { BadRequestError, ConflictError } from '../utils/errors.js';

// Maximum pagination limit to prevent excessive queries
const MAX_LIMIT = 100;

export class UserService {
  /**
   * Get user by ID with optional relations
   */
  async getById(id: string, includeRelations = false) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        phone: true,
        avatar: true,
        bio: true,
        postcode: true,
        locationAddress: true,
        locationLat: true,
        locationLng: true,
        role: true,
        accountStatus: true,
        emailVerified: true,
        providerPlan: true,
        defaultPayoutSpeed: true,
        rating: true,
        totalTransactions: true,
        totalReviews: true,
        createdDate: true,
        updatedDate: true,
        // Don't include passwordHash, sessions, etc.
        ...(includeRelations && {
          tools: {
            where: { available: true },
            take: 10,
            select: {
              id: true,
              name: true,
              category: true,
              dailyRate: true,
              photos: true,
            },
          },
          spaces: {
            where: { available: true },
            take: 10,
            select: {
              id: true,
              name: true,
              dailyRate: true,
              photos: true,
            },
          },
          services: {
            where: { available: true },
            take: 10,
            select: {
              id: true,
              name: true,
              hourlyRate: true,
              specialties: true,
            },
          },
          reviewsReceived: {
            take: 10,
            orderBy: { createdDate: 'desc' },
            include: {
              reviewer: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                },
              },
            },
          },
        }),
      },
    });
  }

  /**
   * Update user profile
   */
  async update(
    userId: string,
    data: {
      name?: string;
      username?: string;
      phone?: string;
      defaultPayoutSpeed?: 'STANDARD' | 'INSTANT';
      bio?: string;
      postcode?: string;
      avatar?: string;
      locationAddress?: string;
      locationLat?: number;
      locationLng?: number;
    }
  ): Promise<User> {
    // Enforce unique username if provided
    if (data.username) {
      const existing = await prisma.user.findFirst({
        where: {
          username: data.username,
          NOT: { id: userId },
        },
      });

      if (existing) {
        throw new ConflictError('Username is already taken');
      }
    }

    // If postcode is being updated, geocode it
    let locationData: Prisma.UserUpdateInput = {};
    if (data.postcode) {
      const location = await geocodingService.geocodePostcode(data.postcode);
      if (!location) {
        throw new BadRequestError('Invalid postcode. Please enter a valid UK postcode.');
      }
      locationData = {
        locationAddress: location.address,
        locationLat: location.lat,
        locationLng: location.lng,
      };
    } else if (
      typeof data.locationLat === 'number' &&
      typeof data.locationLng === 'number' &&
      data.locationAddress
    ) {
      locationData = {
        locationAddress: data.locationAddress,
        locationLat: data.locationLat,
        locationLng: data.locationLng,
      };
    }

    // Update user
    return prisma.user.update({
      where: { id: userId },
      data: {
        ...data,
        ...locationData,
      },
    });
  }

  /**
   * Get user's tools (with limit to prevent unbounded queries)
   */
  async getUserTools(userId: string, limit = 100) {
    const safeLimit = Math.min(limit, MAX_LIMIT);
    return prisma.tool.findMany({
      where: { ownerId: userId },
      orderBy: { createdDate: 'desc' },
      take: safeLimit,
      include: {
        transactions: {
          where: {
            status: { in: ['CONFIRMED', 'PENDING', 'IN_PROGRESS'] },
          },
          select: {
            startDate: true,
            endDate: true,
          },
        },
      },
    });
  }

  /**
   * Get user's spaces (with limit to prevent unbounded queries)
   */
  async getUserSpaces(userId: string, limit = 100) {
    const safeLimit = Math.min(limit, MAX_LIMIT);
    return prisma.space.findMany({
      where: { ownerId: userId },
      orderBy: { createdDate: 'desc' },
      take: safeLimit,
    });
  }

  /**
   * Get user's services (with limit to prevent unbounded queries)
   */
  async getUserServices(userId: string, limit = 100) {
    const safeLimit = Math.min(limit, MAX_LIMIT);
    return prisma.service.findMany({
      where: { providerId: userId },
      orderBy: { createdDate: 'desc' },
      take: safeLimit,
    });
  }

  /**
   * Get user's reviews
   */
  async getUserReviews(userId: string, page = 1, limit = 20) {
    const safeLimit = Math.min(limit, MAX_LIMIT);
    const skip = (page - 1) * safeLimit;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { reviewedUserId: userId },
        skip,
        take: safeLimit,
        orderBy: { createdDate: 'desc' },
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
              startDate: true,
              endDate: true,
            },
          },
        },
      }),
      prisma.review.count({
        where: { reviewedUserId: userId },
      }),
    ]);

    return {
      data: reviews,
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  /**
   * Get user's transactions
   */
  async getUserTransactions(userId: string, page = 1, limit = 20) {
    const safeLimit = Math.min(limit, MAX_LIMIT);
    const skip = (page - 1) * safeLimit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        skip,
        take: safeLimit,
        orderBy: { createdDate: 'desc' },
        include: {
          request: {
            select: {
              id: true,
              title: true,
              category: true,
            },
          },
          tool: {
            select: {
              id: true,
              name: true,
              category: true,
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
      }),
      prisma.transaction.count({
        where: { userId },
      }),
    ]);

    return {
      data: transactions,
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  /**
   * Update user rating after a new review
   * Uses Prisma aggregate for better performance
   */
  async updateUserRating(userId: string): Promise<void> {
    // Use aggregate for better performance instead of fetching all reviews
    const ratingStats = await prisma.review.aggregate({
      where: { reviewedUserId: userId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    if (ratingStats._count.rating === 0) {
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        rating: Math.round((ratingStats._avg.rating || 0) * 10) / 10, // Round to 1 decimal
        totalReviews: ratingStats._count.rating,
      },
    });
  }
}

export const userService = new UserService();
