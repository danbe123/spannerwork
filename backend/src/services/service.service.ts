import { prisma } from '../config/database.js';
import { geocodingService } from './geocoding.service.js';
import { Service, Prisma } from '@prisma/client';
import { ListingCache } from './cache.service.js';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../utils/errors.js';

export class ServiceService {
  /**
   * Create a new service listing
   */
  async create(
    providerId: string,
    data: {
      name: string;
      description: string;
      specialties: string[];
      hourlyRate: number;
      calloutFee?: number;
      radius: number;
      photos?: string[];
      requiresInsurance?: boolean;
      postcode: string;
      sponsorCpaPercent?: number;
    }
  ): Promise<Service> {
    // Geocode the postcode
    const location = await geocodingService.geocodePostcode(data.postcode);
    if (!location) {
      throw new BadRequestError('Invalid postcode. Please enter a valid UK postcode.');
    }

    // Create service listing
    return prisma.service.create({
      data: {
        ...data,
        photos: data.photos || [],
        locationLat: location.lat,
        locationLng: location.lng,
        providerId,
        available: true,
        sponsorCpaPercent: data.sponsorCpaPercent ?? 0,
      },
      include: {
        provider: {
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
   * List services with filters
   * FIX: Uses PostGIS for location filtering BEFORE pagination to ensure accurate results
   */
  async list(params: {
    page?: number;
    limit?: number;
    specialty?: string;
    minHourlyRate?: number;
    maxHourlyRate?: number;
    postcode?: string;
    radius?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(Math.max(1, params.limit || 20), 100);
    const skip = (page - 1) * limit;

    // If location filter provided, use PostGIS query for accurate filtering
    if (params.postcode) {
      const location = await geocodingService.geocodePostcode(params.postcode);
      if (location) {
        return this.listWithPostGIS(params, location, page, limit, skip);
      }
    }

    // No location filter - use standard Prisma query
    const where: Prisma.ServiceWhereInput = {
      available: true,
    };

    if (params.specialty) {
      where.specialties = {
        has: params.specialty,
      };
    }

    if (params.minHourlyRate || params.maxHourlyRate) {
      where.hourlyRate = {};
      if (params.minHourlyRate) where.hourlyRate.gte = params.minHourlyRate;
      if (params.maxHourlyRate) where.hourlyRate.lte = params.maxHourlyRate;
    }

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { sponsorCpaPercent: 'desc' },
          { createdDate: 'desc' },
        ],
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              avatar: true,
              rating: true,
            },
          },
        },
      }),
      prisma.service.count({ where }),
    ]);

    return {
      data: services,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List services using PostGIS for accurate location-based filtering
   * Checks if customer location is within each provider's service radius
   */
  private async listWithPostGIS(
    params: {
      specialty?: string;
      minHourlyRate?: number;
      maxHourlyRate?: number;
    },
    location: { lat: number; lng: number },
    page: number,
    limit: number,
    skip: number
  ) {
    // Build WHERE conditions
    const conditions: string[] = ['s.available = true'];
    const queryParams: (string | number)[] = [location.lng, location.lat];
    let paramIndex = 3;

    if (params.specialty) {
      conditions.push(`$${paramIndex} = ANY(s.specialties)`);
      queryParams.push(params.specialty);
      paramIndex++;
    }

    if (params.minHourlyRate) {
      conditions.push(`s."hourlyRate" >= $${paramIndex}`);
      queryParams.push(params.minHourlyRate);
      paramIndex++;
    }

    if (params.maxHourlyRate) {
      conditions.push(`s."hourlyRate" <= $${paramIndex}`);
      queryParams.push(params.maxHourlyRate);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Query services where customer location is within provider's service radius
    // The radius field is in miles, so convert to meters (1609.34)
    const services = await prisma.$queryRawUnsafe<Array<Service & {
      provider: { id: string; name: string; avatar: string | null; rating: number | null };
      distance_miles: number;
    }>>(
      `SELECT
        s.*,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'avatar', u.avatar,
          'rating', u.rating
        ) as provider,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(s."locationLng", s."locationLat"), 4326)::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1609.34 as distance_miles
      FROM services s
      JOIN users u ON s."providerId" = u.id
      WHERE ${whereClause}
        AND s."locationLat" IS NOT NULL
        AND s."locationLng" IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(s."locationLng", s."locationLat"), 4326)::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          s.radius * 1609.34
        )
      ORDER BY s."sponsorCpaPercent" DESC, distance_miles ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      ...queryParams,
      limit,
      skip
    );

    // Count total matching services
    const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count
      FROM services s
      WHERE ${whereClause}
        AND s."locationLat" IS NOT NULL
        AND s."locationLng" IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(s."locationLng", s."locationLat"), 4326)::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          s.radius * 1609.34
        )`,
      ...queryParams
    );

    const total = Number(countResult[0]?.count || 0);

    return {
      data: services,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get service by ID with caching
   */
  async getById(id: string) {
    // Check cache first
    const cached = await ListingCache.getService(id);
    if (cached) {
      return cached as Service;
    }

    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            avatar: true,
            rating: true,
            totalReviews: true,
            bio: true,
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
    if (service) {
      await ListingCache.setService(id, service);
    }

    return service;
  }

  /**
   * Update service listing
   * FIX: Prevents price changes when there are active bookings to avoid confusion
   */
  async update(
    serviceId: string,
    providerId: string,
    data: Partial<{
      name: string;
      description: string;
      specialties: string[];
      hourlyRate: number;
      calloutFee: number;
      radius: number;
      photos: string[];
      postcode: string;
      available: boolean;
      requiresInsurance: boolean;
      sponsorCpaPercent: number;
    }>
  ): Promise<Service> {
    // Check ownership
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { providerId: true },
    });

    if (!service) {
      throw new NotFoundError('Service not found');
    }

    if (service.providerId !== providerId) {
      throw new ForbiddenError('You can only update your own services');
    }

    // FIX: Check for active bookings if price-related fields or CPA% are being changed
    const priceFieldsChanged = data.hourlyRate !== undefined ||
                                data.calloutFee !== undefined;

    // Need to get current service data to compare CPA
    const currentService = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { sponsorCpaPercent: true },
    });
    const cpaChanged = data.sponsorCpaPercent !== undefined &&
                       data.sponsorCpaPercent !== currentService?.sponsorCpaPercent;

    if (priceFieldsChanged || cpaChanged) {
      const activeBookings = await prisma.transaction.count({
        where: {
          serviceId,
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
        locationAddress: location.address,
        locationLat: location.lat,
        locationLng: location.lng,
      };
    }

    // Update service
    const updated = await prisma.service.update({
      where: { id: serviceId },
      data: {
        ...data,
        ...locationData,
      },
      include: {
        provider: {
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
    await ListingCache.invalidateService(serviceId);

    return updated;
  }

  /**
   * Delete service listing
   */
  async delete(serviceId: string, providerId: string): Promise<void> {
    // Check ownership
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { providerId: true },
    });

    if (!service) {
      throw new NotFoundError('Service not found');
    }

    if (service.providerId !== providerId) {
      throw new ForbiddenError('You can only delete your own services');
    }

    // Check for active transactions
    // FIX #2: Include IN_PROGRESS - active bookings block deletion
    const activeTransactions = await prisma.transaction.count({
      where: {
        serviceId,
        status: { in: ['CONFIRMED', 'PENDING', 'IN_PROGRESS'] },
      },
    });

    if (activeTransactions > 0) {
      throw new ConflictError(
        'Cannot delete service with active or pending bookings. Please complete or cancel all bookings first.'
      );
    }

    // Delete service
    await prisma.service.delete({
      where: { id: serviceId },
    });

    // Invalidate cache
    await ListingCache.invalidateService(serviceId);
  }

  /**
   * Check service availability for given dates
   */
  async getAvailability(id: string, startDate: Date, endDate: Date) {
    const service = await prisma.service.findUnique({
      where: { id },
      select: { available: true },
    });

    if (!service) {
      return {
        available: false,
        reason: 'Service not found',
      };
    }

    if (!service.available) {
      return {
        available: false,
        reason: 'Service is marked as unavailable',
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
      WHERE "serviceId" = ${id}
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
        reason: 'Service provider is already booked for these dates',
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

export const serviceService = new ServiceService();
