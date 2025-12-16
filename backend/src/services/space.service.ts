import { prisma } from '../config/database.js';
import { geocodingService } from './geocoding.service.js';
import { Space, Prisma } from '@prisma/client';
import { logger } from '../config/logger.js';
import { ListingCache } from './cache.service.js';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../utils/errors.js';

export class SpaceService {
  /**
   * Create a new space listing
   */
  async create(
    ownerId: string,
    data: {
      name: string;
      description: string;
      hourlyRate: number;
      dailyRate: number;
      weeklyRate?: number;
      size?: number;
      features: string[];
      photos: string[];
      postcode: string;
      locationAddress: string;
    }
  ): Promise<Space> {
    // Geocode the postcode
    const location = await geocodingService.geocodePostcode(data.postcode);
    if (!location) {
      throw new BadRequestError('Invalid postcode. Please enter a valid UK postcode.');
    }

    // Create space listing
    return prisma.space.create({
      data: {
        ...data,
        locationLat: location.lat,
        locationLng: location.lng,
        ownerId,
        available: true,
      },
      include: {
        owner: {
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
   * List spaces with filters
   */
  async list(params: {
    page?: number;
    limit?: number;
    minHourlyRate?: number;
    maxHourlyRate?: number;
    minDailyRate?: number;
    maxDailyRate?: number;
    minSize?: number;
    features?: string[];
    postcode?: string;
    radius?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    // Build filters
    const where: Prisma.SpaceWhereInput = {
      available: true,
    };

    if (params.minHourlyRate || params.maxHourlyRate) {
      where.hourlyRate = {};
      if (params.minHourlyRate) where.hourlyRate.gte = params.minHourlyRate;
      if (params.maxHourlyRate) where.hourlyRate.lte = params.maxHourlyRate;
    }

    if (params.minDailyRate || params.maxDailyRate) {
      where.dailyRate = {};
      if (params.minDailyRate) where.dailyRate.gte = params.minDailyRate;
      if (params.maxDailyRate) where.dailyRate.lte = params.maxDailyRate;
    }

    if (params.minSize) {
      where.size = { gte: params.minSize };
    }

    if (params.features && params.features.length > 0) {
      where.features = {
        hasSome: params.features,
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
          const conditions: string[] = ['available = true'];
          const queryParams: (number | string)[] = [location.lng, location.lat, radiusMeters];
          let paramIndex = 4;
          
          if (params.minHourlyRate) {
            conditions.push(`"hourlyRate" >= $${paramIndex}`);
            queryParams.push(params.minHourlyRate);
            paramIndex++;
          }
          if (params.maxHourlyRate) {
            conditions.push(`"hourlyRate" <= $${paramIndex}`);
            queryParams.push(params.maxHourlyRate);
            paramIndex++;
          }
          if (params.minDailyRate) {
            conditions.push(`"dailyRate" >= $${paramIndex}`);
            queryParams.push(params.minDailyRate);
            paramIndex++;
          }
          if (params.maxDailyRate) {
            conditions.push(`"dailyRate" <= $${paramIndex}`);
            queryParams.push(params.maxDailyRate);
            paramIndex++;
          }
          if (params.minSize) {
            conditions.push(`size >= $${paramIndex}`);
            queryParams.push(params.minSize);
            paramIndex++;
          }
          
          const whereClause = conditions.length > 0 
            ? `AND ${conditions.join(' AND ')}` 
            : '';
          
          // Query using PostGIS
          const geoSpaces = await prisma.$queryRawUnsafe<Space[]>(`
            SELECT s.*, 
                   ST_Distance(
                     ST_SetSRID(ST_MakePoint("locationLng", "locationLat"), 4326)::geography,
                     ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                   ) / 1609.34 as distance_miles
            FROM spaces s
            WHERE "locationLat" IS NOT NULL 
              AND "locationLng" IS NOT NULL
              AND ST_DWithin(
                ST_SetSRID(ST_MakePoint("locationLng", "locationLat"), 4326)::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                $3
              )
              ${whereClause}
            ORDER BY distance_miles ASC
            LIMIT ${limit} OFFSET ${skip}
          `, ...queryParams);

          const countResult = await prisma.$queryRawUnsafe<[{count: bigint}]>(`
            SELECT COUNT(*) as count
            FROM spaces s
            WHERE "locationLat" IS NOT NULL 
              AND "locationLng" IS NOT NULL
              AND ST_DWithin(
                ST_SetSRID(ST_MakePoint("locationLng", "locationLat"), 4326)::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                $3
              )
              ${whereClause}
          `, ...queryParams);

          const total = Number(countResult[0]?.count || 0);

          // Fetch owner details for the spaces
          const spaceIds = geoSpaces.map(s => s.id);
          const spacesWithOwners = spaceIds.length > 0 
            ? await prisma.space.findMany({
                where: { id: { in: spaceIds } },
                include: {
                  owner: {
                    select: {
                      id: true,
                      name: true,
                      avatar: true,
                      rating: true,
                    },
                  },
                },
              })
            : [];

          // Merge owner data with geo results (preserve distance ordering)
          const ownerMap = new Map(spacesWithOwners.map(s => [s.id, s]));
          const mergedSpaces = geoSpaces.map(s => ownerMap.get(s.id) || s);

          return {
            data: mergedSpaces,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          };
        } catch (error) {
          // Fallback to standard query if PostGIS query fails
          logger.warn('PostGIS query failed for spaces, falling back to standard query', error);
        }
      }
    }

    // Fallback: Standard query without geo filtering
    const [spaces, total] = await Promise.all([
      prisma.space.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdDate: 'desc' },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              avatar: true,
              rating: true,
            },
          },
        },
      }),
      prisma.space.count({ where }),
    ]);

    return {
      data: spaces,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get space by ID with caching
   */
  async getById(id: string) {
    // Check cache first
    const cached = await ListingCache.getSpace(id);
    if (cached) {
      return cached as Space;
    }

    const space = await prisma.space.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            avatar: true,
            rating: true,
            totalReviews: true,
          },
        },
        transactions: {
          where: {
            status: { in: ['CONFIRMED', 'PENDING'] },
          },
          select: {
            startDate: true,
            endDate: true,
            status: true,
          },
        },
      },
    });

    // Cache the result
    if (space) {
      await ListingCache.setSpace(id, space);
    }

    return space;
  }

  /**
   * Update space listing
   */
  async update(
    spaceId: string,
    ownerId: string,
    data: Partial<{
      name: string;
      description: string;
      hourlyRate: number;
      dailyRate: number;
      weeklyRate: number;
      size: number;
      features: string[];
      photos: string[];
      postcode: string;
      locationAddress: string;
      available: boolean;
    }>
  ): Promise<Space> {
    // Check ownership
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      select: { ownerId: true },
    });

    if (!space) {
      throw new NotFoundError('Space not found');
    }

    if (space.ownerId !== ownerId) {
      throw new ForbiddenError('You can only update your own spaces');
    }

    // If postcode is being updated, geocode it
    let locationData = {};
    if (data.postcode) {
      const location = await geocodingService.geocodePostcode(data.postcode);
      if (!location) {
        throw new BadRequestError('Invalid postcode. Please enter a valid UK postcode.');
      }
      locationData = {
        locationLat: location.lat,
        locationLng: location.lng,
      };
    }

    // Update space
    const updated = await prisma.space.update({
      where: { id: spaceId },
      data: {
        ...data,
        ...locationData,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            avatar: true,
            rating: true,
          },
        },
      },
    });

    // Invalidate cache
    await ListingCache.invalidateSpace(spaceId);

    return updated;
  }

  /**
   * Delete space listing
   */
  async delete(spaceId: string, ownerId: string): Promise<void> {
    // Check ownership
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      select: { ownerId: true },
    });

    if (!space) {
      throw new NotFoundError('Space not found');
    }

    if (space.ownerId !== ownerId) {
      throw new ForbiddenError('You can only delete your own spaces');
    }

    // Check for active transactions
    const activeTransactions = await prisma.transaction.count({
      where: {
        spaceId,
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
    });

    if (activeTransactions > 0) {
      throw new ConflictError(
        'Cannot delete space with active or pending bookings. Please complete or cancel all bookings first.'
      );
    }

    // Delete space
    await prisma.space.delete({
      where: { id: spaceId },
    });

    // Invalidate cache
    await ListingCache.invalidateSpace(spaceId);
  }

  /**
   * Check space availability for given dates
   */
  async getAvailability(id: string, startDate: Date, endDate: Date) {
    const space = await prisma.space.findUnique({
      where: { id },
      select: { available: true },
    });

    if (!space) {
      return {
        available: false,
        reason: 'Space not found',
      };
    }

    if (!space.available) {
      return {
        available: false,
        reason: 'Space is marked as unavailable',
      };
    }

    // Check for conflicting transactions
    const conflictingTransactions = await prisma.transaction.findMany({
      where: {
        spaceId: id,
        status: { in: ['CONFIRMED', 'PENDING'] },
        OR: [
          // Transaction starts during the requested period
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gte: startDate } },
            ],
          },
          // Transaction ends during the requested period
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: endDate } },
            ],
          },
          // Transaction is completely within the requested period
          {
            AND: [
              { startDate: { gte: startDate } },
              { endDate: { lte: endDate } },
            ],
          },
        ],
      },
      select: {
        startDate: true,
        endDate: true,
      },
    });

    if (conflictingTransactions.length > 0) {
      return {
        available: false,
        reason: 'Space is already booked for these dates',
        conflicts: conflictingTransactions.map((txn) => ({
          startDate: txn.startDate,
          endDate: txn.endDate,
        })),
      };
    }

    return {
      available: true,
    };
  }
}

export const spaceService = new SpaceService();
