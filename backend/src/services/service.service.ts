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
      postcode: string;
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
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    // Build filters
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

    // Fetch services
    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdDate: 'desc' },
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

    // Apply location-based filtering if provided
    let filteredServices = services;
    let locationFilter: { lat: number; lng: number; radius: number } | null =
      null;

    if (params.postcode && params.radius) {
      const location = await geocodingService.geocodePostcode(params.postcode);
      if (location) {
        locationFilter = {
          lat: location.lat,
          lng: location.lng,
          radius: params.radius,
        };

        // Filter services where the provider's service area includes the searched location
        filteredServices = services.filter((service) => {
          if (!service.locationLat || !service.locationLng) return false;

          const distance = geocodingService.calculateDistance(
            locationFilter!.lat,
            locationFilter!.lng,
            service.locationLat,
            service.locationLng
          );

          // Check if the searched location is within the provider's service radius
          return distance <= service.radius;
        });
      }
    }

    return {
      data: filteredServices,
      pagination: {
        page,
        limit,
        total: locationFilter ? filteredServices.length : total,
        totalPages: Math.ceil(
          (locationFilter ? filteredServices.length : total) / limit
        ),
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
    if (service) {
      await ListingCache.setService(id, service);
    }

    return service;
  }

  /**
   * Update service listing
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
    const activeTransactions = await prisma.transaction.count({
      where: {
        serviceId,
        status: { in: ['CONFIRMED', 'PENDING'] },
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

    // Check for conflicting transactions
    const conflictingTransactions = await prisma.transaction.findMany({
      where: {
        serviceId: id,
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
