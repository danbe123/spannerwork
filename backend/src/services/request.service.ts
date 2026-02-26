import { prisma } from '../config/database.js';
import { geocodingService } from './geocoding.service.js';
import { Request, RequestStatus, Category, Urgency, RateType, Prisma } from '@prisma/client';
import { logger } from '../config/logger.js';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../utils/errors.js';

// Rate limiting constants for request creation
const REQUEST_RATE_LIMITS = {
  HOURLY_LIMIT: 5,       // Max requests per hour
  DAILY_LIMIT: 15,       // Max requests per day
  ACTIVE_LIMIT: 20,      // Max active requests at any time
} as const;

// Enum validation helpers
function validateCategory(value: string): Category {
  const valid = Object.values(Category);
  if (!valid.includes(value as Category)) {
    throw new BadRequestError(`Invalid category: ${value}. Must be one of: ${valid.join(', ')}`);
  }
  return value as Category;
}

function validateUrgency(value: string): Urgency {
  const valid = Object.values(Urgency);
  if (!valid.includes(value as Urgency)) {
    throw new BadRequestError(`Invalid urgency: ${value}. Must be one of: ${valid.join(', ')}`);
  }
  return value as Urgency;
}

function validateRateType(value: string): RateType {
  const valid = Object.values(RateType);
  if (!valid.includes(value as RateType)) {
    throw new BadRequestError(`Invalid rate type: ${value}. Must be one of: ${valid.join(', ')}`);
  }
  return value as RateType;
}

function validateRequestStatus(value: string): RequestStatus {
  const valid = Object.values(RequestStatus);
  if (!valid.includes(value as RequestStatus)) {
    throw new BadRequestError(`Invalid status: ${value}. Must be one of: ${valid.join(', ')}`);
  }
  return value as RequestStatus;
}

export class RequestService {
  /**
   * Create a new request
   * Includes rate limiting to prevent spam and abuse
   */
  async create(
    userId: string,
    data: {
      title: string;
      description: string;
      category: string;
      urgency: string;
      budget: number;
      rateType: string;
      broadcastRadius: number;
      postcode: string;
      photos?: string[];
      sponsorCpaPercent?: number;
    }
  ): Promise<Request> {
    // Rate limiting checks
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [hourlyCount, dailyCount, activeCount] = await Promise.all([
      prisma.request.count({
        where: { seekerId: userId, createdDate: { gte: oneHourAgo } },
      }),
      prisma.request.count({
        where: { seekerId: userId, createdDate: { gte: oneDayAgo } },
      }),
      prisma.request.count({
        where: { seekerId: userId, status: 'ACTIVE' },
      }),
    ]);

    if (hourlyCount >= REQUEST_RATE_LIMITS.HOURLY_LIMIT) {
      logger.warn('Request creation rate limit exceeded (hourly)', { userId, hourlyCount });
      throw new BadRequestError(
        `You can only create ${REQUEST_RATE_LIMITS.HOURLY_LIMIT} requests per hour. Please wait before posting another request.`
      );
    }

    if (dailyCount >= REQUEST_RATE_LIMITS.DAILY_LIMIT) {
      logger.warn('Request creation rate limit exceeded (daily)', { userId, dailyCount });
      throw new BadRequestError(
        `You can only create ${REQUEST_RATE_LIMITS.DAILY_LIMIT} requests per day. Please try again tomorrow.`
      );
    }

    if (activeCount >= REQUEST_RATE_LIMITS.ACTIVE_LIMIT) {
      logger.warn('Active request limit exceeded', { userId, activeCount });
      throw new BadRequestError(
        `You can only have ${REQUEST_RATE_LIMITS.ACTIVE_LIMIT} active requests at a time. ` +
        'Please complete or cancel some existing requests before posting new ones.'
      );
    }

    // Geocode the postcode
    const location = await geocodingService.geocodePostcode(data.postcode);

    if (!location) {
      throw new BadRequestError('Invalid postcode. Please enter a valid UK postcode.');
    }

    // Set expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Validate enum values before creating request
    const category = validateCategory(data.category);
    const urgency = validateUrgency(data.urgency);
    const rateType = validateRateType(data.rateType);

    // Create request
    const request = await prisma.request.create({
      data: {
        title: data.title,
        description: data.description,
        category,
        urgency,
        budget: data.budget,
        rateType,
        broadcastRadius: data.broadcastRadius,
        postcode: data.postcode,
        locationAddress: location.address,
        locationLat: location.lat,
        locationLng: location.lng,
        photos: data.photos || [],
        status: RequestStatus.ACTIVE,
        expiresAt,
        seekerId: userId,
        sponsorCpaPercent: data.sponsorCpaPercent ?? 0,
      },
      include: {
        seeker: {
          select: {
            id: true,
            name: true,
            avatar: true,
            rating: true,
            totalReviews: true,
          },
        },
      },
    });

    return request;
  }

  /**
   * List requests with filters and pagination
   */
  async list(params: {
    page?: number;
    limit?: number;
    category?: string;
    urgency?: string;
    status?: string;
    postcode?: string;
    radius?: number;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.RequestWhereInput = {};

    if (params.category) {
      where.category = validateCategory(params.category);
    }

    if (params.urgency) {
      where.urgency = validateUrgency(params.urgency);
    }

    if (params.status) {
      where.status = validateRequestStatus(params.status);
    } else {
      // Default to active requests only
      where.status = RequestStatus.ACTIVE;
    }

    // FIX #11: Filter out expired requests when showing ACTIVE requests
    // Expired requests should not be shown to providers
    if (where.status === RequestStatus.ACTIVE) {
      // Only show requests that are either:
      // 1. Have no expiry date (expiresAt is null) - handled by NOT lt
      // 2. Have expiry date in the future
      where.NOT = {
        expiresAt: { lt: new Date() },
      };
    }

    // Location-based filtering using PostGIS for better performance
    if (params.postcode && params.radius) {
      const location = await geocodingService.geocodePostcode(params.postcode);
      if (location) {
        try {
          // Use PostGIS ST_DWithin for efficient geo queries
          // Convert miles to meters (1 mile = 1609.34 meters)
          const radiusMeters = params.radius * 1609.34;
          
          // Build additional WHERE conditions
          const conditions: string[] = [];
          const queryParams: (number | string)[] = [location.lng, location.lat, radiusMeters];
          let paramIndex = 4;
          
          if (params.category) {
            conditions.push(`category = $${paramIndex}`);
            queryParams.push(params.category);
            paramIndex++;
          }
          if (params.urgency) {
            conditions.push(`urgency = $${paramIndex}`);
            queryParams.push(params.urgency);
            paramIndex++;
          }
          if (params.status) {
            conditions.push(`status = $${paramIndex}`);
            queryParams.push(params.status);
            paramIndex++;
          } else {
            conditions.push(`status = $${paramIndex}`);
            queryParams.push('ACTIVE');
            paramIndex++;
          }

          // FIX #11: Add expiry filter for ACTIVE requests in raw SQL
          if (!params.status || params.status === 'ACTIVE') {
            conditions.push(`("expiresAt" IS NULL OR "expiresAt" >= NOW())`);
          }

          const whereClause = conditions.length > 0
            ? `AND ${conditions.join(' AND ')}`
            : '';
          
          // Create separate params for count query (without limit/skip)
          const countParams = [...queryParams];
          
          // Add limit and skip as parameterized values for the main query
          const limitParamIndex = paramIndex;
          const skipParamIndex = paramIndex + 1;
          queryParams.push(limit, skip);
          
          // Query using PostGIS with JOIN to get seeker details in one query (N+1 fix)
          interface GeoRequestWithSeeker extends Request {
            distance_miles: number;
            seeker_id: string;
            seeker_name: string | null;
            seeker_avatar: string | null;
            seeker_rating: number | null;
            seeker_totalReviews: number | null;
          }

          const geoRequests = await prisma.$queryRawUnsafe<GeoRequestWithSeeker[]>(`
            SELECT r.*,
                   ST_Distance(
                     ST_SetSRID(ST_MakePoint(r."locationLng", r."locationLat"), 4326)::geography,
                     ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                   ) / 1609.34 as distance_miles,
                   u.id as seeker_id,
                   u.name as seeker_name,
                   u.avatar as seeker_avatar,
                   u.rating as seeker_rating,
                   u."totalReviews" as "seeker_totalReviews"
            FROM requests r
            LEFT JOIN users u ON r."seekerId" = u.id
            WHERE r."locationLat" IS NOT NULL
              AND r."locationLng" IS NOT NULL
              AND ST_DWithin(
                ST_SetSRID(ST_MakePoint(r."locationLng", r."locationLat"), 4326)::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                $3
              )
              ${whereClause}
            ORDER BY
              CASE WHEN "sponsorCpaPercent" > 0 THEN 0 ELSE 1 END,
              "sponsorCpaPercent" DESC,
              distance_miles ASC
            LIMIT $${limitParamIndex} OFFSET $${skipParamIndex}
          `, ...queryParams);

          const countResult = await prisma.$queryRawUnsafe<[{count: bigint}]>(`
            SELECT COUNT(*) as count
            FROM requests r
            WHERE "locationLat" IS NOT NULL
              AND "locationLng" IS NOT NULL
              AND ST_DWithin(
                ST_SetSRID(ST_MakePoint("locationLng", "locationLat"), 4326)::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                $3
              )
              ${whereClause}
          `, ...countParams);

          const total = Number(countResult[0]?.count || 0);

          // Transform raw results to include nested seeker object
          const mergedRequests = geoRequests.map(r => ({
            ...r,
            seeker: {
              id: r.seeker_id,
              name: r.seeker_name,
              avatar: r.seeker_avatar,
              rating: r.seeker_rating,
              totalReviews: r.seeker_totalReviews,
            },
          }));

          return {
            data: mergedRequests,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          };
        } catch (error) {
          // Fallback to standard query if PostGIS query fails
          logger.warn('PostGIS query failed for requests, falling back to standard query', error);
        }
      }
    }

    // Fallback: Standard query without geo filtering
    const [requests, total] = await Promise.all([
      prisma.request.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { sponsorCpaPercent: 'desc' }, // Sponsored first
          { createdDate: 'desc' },
        ],
        include: {
          seeker: {
            select: {
              id: true,
              name: true,
              avatar: true,
              rating: true,
              totalReviews: true,
            },
          },
        },
      }),
      prisma.request.count({ where }),
    ]);

    return {
      data: requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get request by ID
   * @param id - Request ID
   * @param currentUserId - Optional current user ID to check if they've already quoted
   */
  async getById(id: string, currentUserId?: string): Promise<(Request & { userHasQuoted?: boolean; userTransactionId?: string }) | null> {
    const request = await prisma.request.findUnique({
      where: { id },
      include: {
        seeker: {
          select: {
            id: true,
            name: true,
            avatar: true,
            rating: true,
            totalReviews: true,
            emailVerified: true,
          },
        },
        transactions: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!request) return null;

    // Check if current user has already quoted on this request
    let userHasQuoted = false;
    let userTransactionId: string | undefined;

    if (currentUserId && currentUserId !== request.seekerId) {
      const existingTransaction = await prisma.transaction.findFirst({
        where: { requestId: id, providerId: currentUserId },
        select: { id: true },
      });
      if (existingTransaction) {
        userHasQuoted = true;
        userTransactionId = existingTransaction.id;
      }
    }

    return { ...request, userHasQuoted, userTransactionId };
  }

  /**
   * Update request
   */
  async update(
    id: string,
    userId: string,
    data: Partial<{
      title: string;
      description: string;
      category: string;
      urgency: string;
      budget: number;
      rateType: string;
      broadcastRadius: number;
      photos: string[];
      sponsorCpaPercent: number;
    }>,
    isAdmin = false
  ): Promise<Request> {
    // Verify ownership or admin
    const request = await prisma.request.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundError('Request not found');
    }

    if (request.seekerId !== userId && !isAdmin) {
      throw new ForbiddenError('You do not have permission to update this request');
    }

    // FIX: Block CPA% and budget changes once the request has responses
    // This prevents gaming the system by posting with high CPA/budget for visibility
    // then lowering it after getting responses
    const cpaChanging = data.sponsorCpaPercent !== undefined && data.sponsorCpaPercent !== request.sponsorCpaPercent;
    const budgetChanging = data.budget !== undefined && data.budget !== request.budget;

    if (cpaChanging || budgetChanging) {
      // Check if request has any responses (transactions)
      const responseCount = await prisma.transaction.count({
        where: { requestId: id },
      });

      if (responseCount > 0) {
        if (cpaChanging) {
          throw new ConflictError(
            'Cannot change sponsor CPA percentage after receiving responses. ' +
            'This ensures fairness for providers who responded based on the original terms.'
          );
        }
        if (budgetChanging) {
          throw new ConflictError(
            'Cannot change budget after receiving responses. ' +
            'This ensures fairness for providers who quoted based on the original budget.'
          );
        }
      }
    }

    // Build update data with proper types
    const updateData: Prisma.RequestUpdateInput = {};
    if (data.title) updateData.title = data.title;
    if (data.description) updateData.description = data.description;
    if (data.category) updateData.category = validateCategory(data.category);
    if (data.urgency) updateData.urgency = validateUrgency(data.urgency);
    if (data.budget !== undefined) updateData.budget = data.budget;
    if (data.rateType) updateData.rateType = data.rateType as RateType;
    if (data.broadcastRadius !== undefined) updateData.broadcastRadius = data.broadcastRadius;
    if (data.photos) updateData.photos = data.photos;
    if (data.sponsorCpaPercent !== undefined) updateData.sponsorCpaPercent = data.sponsorCpaPercent;

    // Update request
    return prisma.request.update({
      where: { id },
      data: updateData,
      include: {
        seeker: {
          select: {
            id: true,
            name: true,
            avatar: true,
            rating: true,
          },
        },
      },
    });
  }

  /**
   * Delete request
   *
   * FIX #3: Check for linked transactions before deletion to prevent data integrity issues
   */
  async delete(id: string, userId: string, isAdmin = false): Promise<void> {
    // Verify ownership or admin
    const request = await prisma.request.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundError('Request not found');
    }

    if (request.seekerId !== userId && !isAdmin) {
      throw new ForbiddenError('You do not have permission to delete this request');
    }

    // FIX #3: Check for linked transactions before deletion
    const linkedTransactions = await prisma.transaction.count({
      where: {
        requestId: id,
        // Allow deletion if all transactions are cancelled or completed
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
      },
    });

    if (linkedTransactions > 0) {
      throw new ConflictError(
        'Cannot delete request with active transactions. Please cancel or complete all bookings first, or use the cancel function instead.'
      );
    }

    // Soft-delete by setting status to CANCELLED if there are any completed transactions
    // This preserves history for completed transactions
    const completedTransactions = await prisma.transaction.count({
      where: { requestId: id, status: 'COMPLETED' },
    });

    if (completedTransactions > 0) {
      // Soft delete - update status to CANCELLED instead of hard delete
      await prisma.request.update({
        where: { id },
        data: { status: RequestStatus.CANCELLED },
      });
      return;
    }

    // Hard delete if no linked transactions
    await prisma.request.delete({
      where: { id },
    });
  }

  /**
   * Cancel request (soft delete)
   */
  async cancel(id: string, userId: string): Promise<Request> {
    // Use transaction to ensure atomic cancellation of request + related transactions
    return prisma.$transaction(async (tx) => {
      // Verify ownership
      const request = await tx.request.findUnique({
        where: { id },
      });

      if (!request) {
        throw new NotFoundError('Request not found');
      }

      if (request.seekerId !== userId) {
        throw new ForbiddenError('You do not have permission to cancel this request');
      }

      // Cancel all related pending/confirmed transactions (cascading cancellation)
      const relatedTransactions = await tx.transaction.findMany({
        where: {
          requestId: id,
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        select: { id: true, providerId: true },
      });

      if (relatedTransactions.length > 0) {
        const timestamp = new Date().toISOString();

        // Update all related transactions to CANCELLED
        await tx.transaction.updateMany({
          where: {
            requestId: id,
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
          data: {
            status: 'CANCELLED',
            notes: `[${timestamp}] Auto-cancelled: Parent request was cancelled by seeker`,
          },
        });

        // Decrement responseCount for each cancelled transaction
        await tx.request.update({
          where: { id },
          data: {
            responseCount: { decrement: relatedTransactions.length },
          },
        });

        logger.info(`Cascade-cancelled ${relatedTransactions.length} transactions for request ${id}`);
      }

      // Update request status to cancelled
      return tx.request.update({
        where: { id },
        data: { status: RequestStatus.CANCELLED },
      });
    });
  }

  /**
   * Mark request as complete/fulfilled
   */
  async markComplete(id: string, userId: string, isAdmin = false): Promise<Request> {
    // Verify ownership or admin
    const request = await prisma.request.findUnique({
      where: { id },
      include: {
        seeker: { select: { id: true, email: true, name: true } },
      },
    });

    if (!request) {
      throw new NotFoundError('Request not found');
    }

    if (request.seekerId !== userId && !isAdmin) {
      throw new ForbiddenError('You do not have permission to complete this request');
    }

    if (request.status !== 'ACTIVE') {
      throw new ConflictError(`Cannot complete a request with status: ${request.status}`);
    }

    // Update request status to fulfilled
    return prisma.request.update({
      where: { id },
      data: { status: RequestStatus.FULFILLED },
      include: {
        seeker: { select: { id: true, email: true, name: true, avatar: true } },
      },
    });
  }
}

export const requestService = new RequestService();
