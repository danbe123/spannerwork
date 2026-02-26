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
      hourlyRate?: number;
      dailyRate: number;
      weeklyRate?: number;
      size?: number;
      features: string[];
      photos: string[];
      postcode: string;
      locationAddress: string;
      sponsorCpaPercent?: number;
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
        hourlyRate: data.hourlyRate ?? 0, // Default to 0 if not provided
        locationLat: location.lat,
        locationLng: location.lng,
        ownerId,
        available: true,
        sponsorCpaPercent: data.sponsorCpaPercent ?? 0,
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

          // FIX: Create separate params array for count query (without limit/skip)
          const countParams = [...queryParams];

          // Add LIMIT and OFFSET as parameterized values to prevent SQL injection
          const limitParamIndex = paramIndex;
          const skipParamIndex = paramIndex + 1;
          queryParams.push(limit, skip);

          // Query using PostGIS with JOIN to get owner details in one query (N+1 fix)
          interface GeoSpaceWithOwner extends Space {
            distance_miles: number;
            owner_id: string;
            owner_name: string | null;
            owner_avatar: string | null;
            owner_rating: number | null;
          }

          const geoSpaces = await prisma.$queryRawUnsafe<GeoSpaceWithOwner[]>(`
            SELECT s.*,
                   ST_Distance(
                     ST_SetSRID(ST_MakePoint(s."locationLng", s."locationLat"), 4326)::geography,
                     ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                   ) / 1609.34 as distance_miles,
                   u.id as owner_id,
                   u.name as owner_name,
                   u.avatar as owner_avatar,
                   u.rating as owner_rating
            FROM spaces s
            LEFT JOIN users u ON s."ownerId" = u.id
            WHERE s."locationLat" IS NOT NULL
              AND s."locationLng" IS NOT NULL
              AND ST_DWithin(
                ST_SetSRID(ST_MakePoint(s."locationLng", s."locationLat"), 4326)::geography,
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

          // FIX: Use countParams (without limit/skip) for the count query
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
          `, ...countParams);

          const total = Number(countResult[0]?.count || 0);

          // Transform raw results to include nested owner object
          const mergedSpaces = geoSpaces.map(s => ({
            ...s,
            owner: {
              id: s.owner_id,
              name: s.owner_name,
              avatar: s.owner_avatar,
              rating: s.owner_rating,
            },
          }));

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
        orderBy: [
          { sponsorCpaPercent: 'desc' }, // Sponsored first
          { createdDate: 'desc' },
        ],
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
            // FIX #2: Include IN_PROGRESS - active bookings block the calendar
            status: { in: ['CONFIRMED', 'PENDING', 'IN_PROGRESS'] },
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
   * FIX: Prevents price changes when there are active bookings to avoid confusion
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
      sponsorCpaPercent: number;
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

    // FIX: Check for active bookings if price-related fields or CPA% are being changed
    const priceFieldsChanged = data.hourlyRate !== undefined ||
                                data.dailyRate !== undefined ||
                                data.weeklyRate !== undefined;

    // Need to get current space data to compare CPA
    const currentSpace = await prisma.space.findUnique({
      where: { id: spaceId },
      select: { sponsorCpaPercent: true },
    });
    const cpaChanged = data.sponsorCpaPercent !== undefined &&
                       data.sponsorCpaPercent !== currentSpace?.sponsorCpaPercent;

    if (priceFieldsChanged || cpaChanged) {
      const activeBookings = await prisma.transaction.count({
        where: {
          spaceId,
          status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
        },
      });

      if (activeBookings > 0) {
        if (cpaChanged) {
          throw new ConflictError(
            'Cannot change sponsor CPA percentage while you have active bookings. ' +
            'This ensures fairness for customers who booked based on the original terms.'
          );
        }
        throw new ConflictError(
          `Cannot change pricing while you have ${activeBookings} active booking${activeBookings > 1 ? 's' : ''}. ` +
          'Please wait until all current bookings are completed or cancelled before updating rates.'
        );
      }
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
    // FIX #2: Include IN_PROGRESS - active bookings block deletion
    const activeTransactions = await prisma.transaction.count({
      where: {
        spaceId,
        status: { in: ['CONFIRMED', 'PENDING', 'IN_PROGRESS'] },
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

    // FIX #2 & #7: Use raw query with FOR UPDATE to prevent race conditions
    // and include IN_PROGRESS status (active bookings must block new bookings)
    interface ConflictResult {
      startDate: Date;
      endDate: Date;
    }

    const conflictingTransactions = await prisma.$queryRaw<ConflictResult[]>`
      SELECT "startDate", "endDate"
      FROM transactions
      WHERE "spaceId" = ${id}
        AND status IN ('CONFIRMED', 'PENDING', 'IN_PROGRESS')
        AND (
          ("startDate" <= ${startDate} AND "endDate" >= ${startDate})
          OR ("startDate" <= ${endDate} AND "endDate" >= ${endDate})
          OR ("startDate" >= ${startDate} AND "endDate" <= ${endDate})
        )
      FOR UPDATE SKIP LOCKED
    `;

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
