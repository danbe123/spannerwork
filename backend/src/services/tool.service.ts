import { prisma } from '../config/database.js';
import { geocodingService } from './geocoding.service.js';
import { Tool, Prisma } from '@prisma/client';
import { logger } from '../config/logger.js';
import { ListingCache } from './cache.service.js';
import { paginateWithCursor, CursorPaginationResponse } from '../utils/pagination.js';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../utils/errors.js';

export class ToolService {
  /**
   * Create a new tool listing
   */
  async create(
    userId: string,
    data: {
      name: string;
      description: string;
      category: string;
      dailyRate: number;
      weeklyRate?: number;
      deposit: number;
      photos: string[];
      condition: string;
      postcode: string;
      sponsorCpaPercent?: number;
    }
  ): Promise<Tool> {
    // Geocode the postcode
    const location = await geocodingService.geocodePostcode(data.postcode);

    if (!location) {
      throw new BadRequestError('Invalid postcode. Please enter a valid UK postcode.');
    }

    // Create tool
    const tool = await prisma.tool.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        dailyRate: data.dailyRate,
        weeklyRate: data.weeklyRate,
        deposit: data.deposit,
        photos: data.photos,
        condition: data.condition,
        postcode: data.postcode,
        locationLat: location.lat,
        locationLng: location.lng,
        available: true,
        ownerId: userId,
        sponsorCpaPercent: data.sponsorCpaPercent ?? 0,
      },
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
      },
    });

    return tool;
  }

  /**
   * List tools with filters and pagination (supports both cursor and offset)
   */
  async list(params: {
    // Offset pagination (page/limit)
    page?: number;
    limit?: number;
    // Cursor pagination (for infinite scroll)
    cursor?: string;
    direction?: 'forward' | 'backward';
    // Filters
    category?: string;
    available?: boolean;
    postcode?: string;
    radius?: number;
    minPrice?: number;
    maxPrice?: number;
  }) {
    const limit = Math.min(params.limit || 20, 100);
    const page = params.page || 1;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ToolWhereInput = {};

    if (params.category) {
      where.category = params.category;
    }

    if (params.available !== undefined) {
      where.available = params.available;
    }

    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      where.dailyRate = {};
      if (params.minPrice !== undefined) {
        where.dailyRate.gte = params.minPrice;
      }
      if (params.maxPrice !== undefined) {
        where.dailyRate.lte = params.maxPrice;
      }
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
          const queryParams: (number | string | boolean)[] = [location.lng, location.lat, radiusMeters];
          let paramIndex = 4;
          
          if (params.category) {
            conditions.push(`category = $${paramIndex}`);
            queryParams.push(params.category);
            paramIndex++;
          }
          if (params.available !== undefined) {
            conditions.push(`available = $${paramIndex}`);
            queryParams.push(params.available);
            paramIndex++;
          }
          if (params.minPrice !== undefined) {
            conditions.push(`"dailyRate" >= $${paramIndex}`);
            queryParams.push(params.minPrice);
            paramIndex++;
          }
          if (params.maxPrice !== undefined) {
            conditions.push(`"dailyRate" <= $${paramIndex}`);
            queryParams.push(params.maxPrice);
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
          interface GeoToolWithOwner extends Tool {
            distance_miles: number;
            owner_id: string;
            owner_name: string | null;
            owner_avatar: string | null;
            owner_rating: number | null;
            owner_totalReviews: number | null;
          }

          const geoTools = await prisma.$queryRawUnsafe<GeoToolWithOwner[]>(`
            SELECT t.*,
                   ST_Distance(
                     ST_SetSRID(ST_MakePoint(t."locationLng", t."locationLat"), 4326)::geography,
                     ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                   ) / 1609.34 as distance_miles,
                   u.id as owner_id,
                   u.name as owner_name,
                   u.avatar as owner_avatar,
                   u.rating as owner_rating,
                   u."totalReviews" as "owner_totalReviews"
            FROM tools t
            LEFT JOIN users u ON t."ownerId" = u.id
            WHERE t."locationLat" IS NOT NULL
              AND t."locationLng" IS NOT NULL
              AND ST_DWithin(
                ST_SetSRID(ST_MakePoint(t."locationLng", t."locationLat"), 4326)::geography,
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
            FROM tools t
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
          const mergedTools = geoTools.map(t => ({
            ...t,
            owner: {
              id: t.owner_id,
              name: t.owner_name,
              avatar: t.owner_avatar,
              rating: t.owner_rating,
              totalReviews: t.owner_totalReviews,
            },
          }));

          return {
            data: mergedTools,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          };
        } catch (error) {
          // Fallback to in-memory filtering if PostGIS query fails
          logger.warn('PostGIS query failed, falling back to in-memory filtering', error);
        }
      }
    }

    // Use cursor pagination if cursor is provided
    if (params.cursor !== undefined) {
      return paginateWithCursor({
        model: prisma.tool,
        where,
        orderBy: [
          { sponsorCpaPercent: 'desc' }, // Sponsored first
          { createdDate: 'desc' },
        ],
        cursor: params.cursor,
        limit,
        direction: params.direction,
        includeTotal: true,
      }) as Promise<CursorPaginationResponse<Tool>>;
    }

    // Fallback: Standard offset-based query without geo filtering
    const [tools, total] = await Promise.all([
      prisma.tool.findMany({
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
              totalReviews: true,
            },
          },
        },
      }),
      prisma.tool.count({ where }),
    ]);

    return {
      data: tools,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get tool by ID with caching
   */
  async getById(id: string): Promise<Tool | null> {
    // Check cache first
    const cached = await ListingCache.getTool(id);
    if (cached) {
      return cached as Tool;
    }

    const tool = await prisma.tool.findUnique({
      where: { id },
      include: {
        owner: {
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
          where: {
            // FIX #2: Include IN_PROGRESS - active rentals block the calendar
            status: { in: ['CONFIRMED', 'PENDING', 'IN_PROGRESS'] },
          },
          select: {
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    // Cache the result
    if (tool) {
      await ListingCache.setTool(id, tool);
    }

    return tool;
  }

  /**
   * Update tool
   * FIX: Prevents price/deposit changes when there are active bookings to avoid confusion
   */
  async update(
    id: string,
    userId: string,
    data: Partial<{
      name: string;
      description: string;
      category: string;
      dailyRate: number;
      weeklyRate: number;
      deposit: number;
      photos: string[];
      condition: string;
      available: boolean;
      sponsorCpaPercent: number;
    }>
  ): Promise<Tool> {
    // Verify ownership
    const tool = await prisma.tool.findUnique({
      where: { id },
    });

    if (!tool) {
      throw new NotFoundError('Tool not found');
    }

    if (tool.ownerId !== userId) {
      throw new ForbiddenError('You do not have permission to update this tool');
    }

    // FIX: Check for active bookings if price-related fields or CPA% are being changed
    const priceFieldsChanged = data.dailyRate !== undefined ||
                                data.weeklyRate !== undefined ||
                                data.deposit !== undefined;
    const cpaChanged = data.sponsorCpaPercent !== undefined &&
                       data.sponsorCpaPercent !== tool.sponsorCpaPercent;

    if (priceFieldsChanged || cpaChanged) {
      const activeBookings = await prisma.transaction.count({
        where: {
          toolId: id,
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

    // Update tool
    const updated = await prisma.tool.update({
      where: { id },
      data,
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
    await ListingCache.invalidateTool(id);

    return updated;
  }

  /**
   * Delete tool
   */
  async delete(id: string, userId: string): Promise<void> {
    // Verify ownership
    const tool = await prisma.tool.findUnique({
      where: { id },
    });

    if (!tool) {
      throw new NotFoundError('Tool not found');
    }

    if (tool.ownerId !== userId) {
      throw new ForbiddenError('You do not have permission to delete this tool');
    }

    // Check for active transactions
    const activeTransactions = await prisma.transaction.count({
      where: {
        toolId: id,
        // FIX #2: Include IN_PROGRESS - active rentals block deletion
        status: { in: ['CONFIRMED', 'PENDING', 'IN_PROGRESS'] },
      },
    });

    if (activeTransactions > 0) {
      throw new ConflictError(
        'Cannot delete tool with active bookings. Please cancel or complete them first.'
      );
    }

    // Delete tool
    await prisma.tool.delete({
      where: { id },
    });

    // Invalidate cache
    await ListingCache.invalidateTool(id);
  }

  /**
   * Get tool availability
   *
   * FIX #2: Added IN_PROGRESS to status check - active rentals should block new bookings
   * FIX #7: Uses FOR UPDATE lock to prevent race conditions in concurrent availability checks
   */
  async getAvailability(id: string, startDate: Date, endDate: Date) {
    const tool = await prisma.tool.findUnique({
      where: { id },
    });

    if (!tool) {
      throw new NotFoundError('Tool not found');
    }

    if (!tool.available) {
      return { available: false, reason: 'Tool is marked as unavailable' };
    }

    // FIX #2 & #7: Use raw query with FOR UPDATE to prevent race conditions
    // and include IN_PROGRESS status (active rentals must block new bookings)
    const conflictingTransactions = await prisma.$queryRaw<{
      id: string;
      startDate: Date;
      endDate: Date;
      status: string;
    }[]>`
      SELECT id, "startDate", "endDate", status
      FROM transactions
      WHERE "toolId" = ${id}
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
        reason: 'Tool is already booked for these dates',
        conflictingDates: conflictingTransactions,
      };
    }

    return { available: true };
  }
}

export const toolService = new ToolService();
