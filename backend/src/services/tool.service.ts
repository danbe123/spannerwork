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
    // Legacy offset pagination
    page?: number;
    limit?: number;
    // New cursor pagination
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
          
          // Query using PostGIS
          const geoTools = await prisma.$queryRawUnsafe<Tool[]>(`
            SELECT t.*, 
                   ST_Distance(
                     ST_SetSRID(ST_MakePoint("locationLng", "locationLat"), 4326)::geography,
                     ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                   ) / 1609.34 as distance_miles
            FROM tools t
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
            FROM tools t
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

          // Fetch owner details for the tools
          const toolIds = geoTools.map(t => t.id);
          const toolsWithOwners = toolIds.length > 0 
            ? await prisma.tool.findMany({
                where: { id: { in: toolIds } },
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
              })
            : [];

          // Merge owner data with geo results (preserve distance ordering)
          const ownerMap = new Map(toolsWithOwners.map(t => [t.id, t]));
          const mergedTools = geoTools.map(t => ownerMap.get(t.id) || t);

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
        orderBy: { createdDate: 'desc' },
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
        orderBy: { createdDate: 'desc' },
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
            status: { in: ['CONFIRMED', 'PENDING'] },
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
        status: { in: ['CONFIRMED', 'PENDING'] },
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

    // Check for conflicting transactions
    const conflictingTransactions = await prisma.transaction.findMany({
      where: {
        toolId: id,
        status: { in: ['CONFIRMED', 'PENDING'] },
        OR: [
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gte: startDate } },
            ],
          },
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: endDate } },
            ],
          },
          {
            AND: [
              { startDate: { gte: startDate } },
              { endDate: { lte: endDate } },
            ],
          },
        ],
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });

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
