import { prisma } from '../config/database.js';
import { geocodingService } from './geocoding.service.js';
import { Request, RequestStatus, Category, Urgency, RateType, Prisma } from '@prisma/client';
import { logger } from '../config/logger.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';

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
    }
  ): Promise<Request> {
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
          
          const whereClause = conditions.length > 0 
            ? `AND ${conditions.join(' AND ')}` 
            : '';
          
          // Create separate params for count query (without limit/skip)
          const countParams = [...queryParams];
          
          // Add limit and skip as parameterized values for the main query
          const limitParamIndex = paramIndex;
          const skipParamIndex = paramIndex + 1;
          queryParams.push(limit, skip);
          
          // Query using PostGIS with fully parameterized query
          const geoRequests = await prisma.$queryRawUnsafe<Request[]>(`
            SELECT r.*, 
                   ST_Distance(
                     ST_SetSRID(ST_MakePoint("locationLng", "locationLat"), 4326)::geography,
                     ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                   ) / 1609.34 as distance_miles
            FROM requests r
            WHERE "locationLat" IS NOT NULL 
              AND "locationLng" IS NOT NULL
              AND ST_DWithin(
                ST_SetSRID(ST_MakePoint("locationLng", "locationLat"), 4326)::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                $3
              )
              ${whereClause}
            ORDER BY distance_miles ASC
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

          // Fetch seeker details for the requests
          const requestIds = geoRequests.map(r => r.id);
          const requestsWithSeekers = requestIds.length > 0 
            ? await prisma.request.findMany({
                where: { id: { in: requestIds } },
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
              })
            : [];

          // Merge seeker data with geo results (preserve distance ordering)
          const seekerMap = new Map(requestsWithSeekers.map(r => [r.id, r]));
          const mergedRequests = geoRequests.map(r => seekerMap.get(r.id) || r);

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
        orderBy: { createdDate: 'desc' },
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
   */
  async getById(id: string): Promise<Request | null> {
    return prisma.request.findUnique({
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
    }>
  ): Promise<Request> {
    // Verify ownership
    const request = await prisma.request.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundError('Request not found');
    }

    if (request.seekerId !== userId) {
      throw new ForbiddenError('You do not have permission to update this request');
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
   */
  async delete(id: string, userId: string): Promise<void> {
    // Verify ownership
    const request = await prisma.request.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundError('Request not found');
    }

    if (request.seekerId !== userId) {
      throw new ForbiddenError('You do not have permission to delete this request');
    }

    // Delete request
    await prisma.request.delete({
      where: { id },
    });
  }

  /**
   * Cancel request (soft delete)
   */
  async cancel(id: string, userId: string): Promise<Request> {
    // Verify ownership
    const request = await prisma.request.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundError('Request not found');
    }

    if (request.seekerId !== userId) {
      throw new ForbiddenError('You do not have permission to cancel this request');
    }

    // Update status to cancelled
    return prisma.request.update({
      where: { id },
      data: { status: RequestStatus.CANCELLED },
    });
  }
}

export const requestService = new RequestService();
