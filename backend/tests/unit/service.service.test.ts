import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../src/services/geocoding.service.js', () => ({
  geocodingService: {
    geocodePostcode: vi.fn(),
  },
}));

vi.mock('../../src/services/cache.service.js', () => ({
  ListingCache: {
    invalidate: vi.fn(),
    invalidateService: vi.fn(),
    getService: vi.fn(),
    setService: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  },
}));

// Hoist prisma mocks
const mockPrisma = vi.hoisted(() => ({
  service: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  transaction: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: mockPrisma,
}));

import { ServiceService } from '../../src/services/service.service.js';
import { geocodingService } from '../../src/services/geocoding.service.js';

describe('ServiceService', () => {
  let serviceService: ServiceService;

  beforeEach(() => {
    vi.clearAllMocks();
    serviceService = new ServiceService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('create', () => {
    const mockServiceData = {
      name: 'Professional Plumbing',
      description: 'Expert plumbing services for all your needs',
      specialties: ['Emergency Repairs', 'Installations', 'Maintenance'],
      hourlyRate: 5000,
      calloutFee: 2500,
      radius: 20,
      photos: ['service1.jpg'],
      postcode: 'B1 1AA',
    };

    it('should create a service with valid data', async () => {
      vi.mocked(geocodingService.geocodePostcode).mockResolvedValue({
        lat: 52.4862,
        lng: -1.8904,
        address: 'Birmingham City Centre',
      });

      const mockCreatedService = {
        id: 'service-123',
        ...mockServiceData,
        locationLat: 52.4862,
        locationLng: -1.8904,
        available: true,
        providerId: 'user-123',
        provider: { id: 'user-123', name: 'Provider', avatar: null, rating: 4.8 },
      };

      mockPrisma.service.create.mockResolvedValue(mockCreatedService);

      const result = await serviceService.create('user-123', mockServiceData);

      expect(geocodingService.geocodePostcode).toHaveBeenCalledWith('B1 1AA');
      expect(mockPrisma.service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Professional Plumbing',
            hourlyRate: 5000,
            calloutFee: 2500,
            radius: 20,
            available: true,
            providerId: 'user-123',
          }),
        })
      );
      expect(result.id).toBe('service-123');
    });

    it('should throw error for invalid postcode', async () => {
      vi.mocked(geocodingService.geocodePostcode).mockResolvedValue(null);

      await expect(serviceService.create('user-123', mockServiceData))
        .rejects.toThrow('Invalid postcode. Please enter a valid UK postcode.');
    });

    it('should handle missing photos', async () => {
      vi.mocked(geocodingService.geocodePostcode).mockResolvedValue({
        lat: 52.4862,
        lng: -1.8904,
        address: 'Birmingham',
      });

      mockPrisma.service.create.mockResolvedValue({ id: 'service-123' });

      const dataWithoutPhotos = {
        name: 'Test Service',
        description: 'Test description',
        specialties: ['Test'],
        hourlyRate: 5000,
        radius: 20,
        postcode: 'B1 1AA',
      };

      await serviceService.create('user-123', dataWithoutPhotos);

      const createCall = mockPrisma.service.create.mock.calls[0][0];
      expect(createCall.data.photos).toEqual([]);
    });
  });

  describe('list', () => {
    it('should list services with default pagination', async () => {
      const mockServices = [
        { id: 'service-1', name: 'Service 1' },
        { id: 'service-2', name: 'Service 2' },
      ];

      mockPrisma.service.findMany.mockResolvedValue(mockServices);
      mockPrisma.service.count.mockResolvedValue(2);

      const result = await serviceService.list({});

      expect(mockPrisma.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          where: expect.objectContaining({
            available: true,
          }),
        })
      );
      expect(result.data).toHaveLength(2);
    });

    it('should apply specialty filter', async () => {
      mockPrisma.service.findMany.mockResolvedValue([]);
      mockPrisma.service.count.mockResolvedValue(0);

      await serviceService.list({ specialty: 'Plumbing' });

      expect(mockPrisma.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            specialties: {
              has: 'Plumbing',
            },
          }),
        })
      );
    });

    it('should apply hourly rate filters', async () => {
      mockPrisma.service.findMany.mockResolvedValue([]);
      mockPrisma.service.count.mockResolvedValue(0);

      await serviceService.list({ minHourlyRate: 3000, maxHourlyRate: 8000 });

      expect(mockPrisma.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            hourlyRate: {
              gte: 3000,
              lte: 8000,
            },
          }),
        })
      );
    });

    it('should handle pagination', async () => {
      mockPrisma.service.findMany.mockResolvedValue([]);
      mockPrisma.service.count.mockResolvedValue(50);

      await serviceService.list({ page: 3, limit: 10 });

      expect(mockPrisma.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
    });

    it('should order by created date descending', async () => {
      mockPrisma.service.findMany.mockResolvedValue([]);
      mockPrisma.service.count.mockResolvedValue(0);

      await serviceService.list({});

      expect(mockPrisma.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdDate: 'desc' },
        })
      );
    });
  });

  describe('getById', () => {
    it('should return service by id', async () => {
      const mockService = { id: 'service-123', name: 'Test Service' };
      mockPrisma.service.findUnique.mockResolvedValue(mockService);

      const result = await serviceService.getById('service-123');

      expect(mockPrisma.service.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'service-123' },
        })
      );
      expect(result).toEqual(mockService);
    });

    it('should return null for non-existent service', async () => {
      mockPrisma.service.findUnique.mockResolvedValue(null);

      const result = await serviceService.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      // Mock finding the service for ownership check
      mockPrisma.service.findUnique.mockResolvedValue({ providerId: 'user-123' });
    });

    it('should update service when owner', async () => {
      const mockUpdatedService = { id: 'service-123', name: 'Updated Service' };
      mockPrisma.service.update.mockResolvedValue(mockUpdatedService);

      const result = await serviceService.update('service-123', 'user-123', { name: 'Updated Service' });

      expect(mockPrisma.service.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'service-123' },
        })
      );
      expect(result.name).toBe('Updated Service');
    });

    it('should throw error when not owner', async () => {
      mockPrisma.service.findUnique.mockResolvedValue({ providerId: 'other-user' });

      await expect(serviceService.update('service-123', 'user-123', { name: 'Updated' }))
        .rejects.toThrow('You can only update your own services');
    });

    it('should throw error when service not found', async () => {
      mockPrisma.service.findUnique.mockResolvedValue(null);

      await expect(serviceService.update('service-123', 'user-123', { name: 'Updated' }))
        .rejects.toThrow('Service not found');
    });

    it('should geocode new postcode on update', async () => {
      vi.mocked(geocodingService.geocodePostcode).mockResolvedValue({
        lat: 53.8,
        lng: -1.5,
        address: 'Leeds',
      });
      mockPrisma.service.update.mockResolvedValue({ id: 'service-123' });

      await serviceService.update('service-123', 'user-123', { postcode: 'LS1 1AA' });

      expect(geocodingService.geocodePostcode).toHaveBeenCalledWith('LS1 1AA');
    });

    it('should throw error for invalid postcode on update', async () => {
      vi.mocked(geocodingService.geocodePostcode).mockResolvedValue(null);

      await expect(serviceService.update('service-123', 'user-123', { postcode: 'INVALID' }))
        .rejects.toThrow('Invalid postcode. Please enter a valid UK postcode.');
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      mockPrisma.service.findUnique.mockResolvedValue({ providerId: 'user-123' });
    });

    it('should delete service when owner and no active bookings', async () => {
      mockPrisma.transaction.count.mockResolvedValue(0);
      mockPrisma.service.delete.mockResolvedValue({ id: 'service-123' });

      await serviceService.delete('service-123', 'user-123');

      expect(mockPrisma.service.delete).toHaveBeenCalledWith({
        where: { id: 'service-123' },
      });
    });

    it('should throw error when not owner', async () => {
      mockPrisma.service.findUnique.mockResolvedValue({ providerId: 'other-user' });

      await expect(serviceService.delete('service-123', 'user-123'))
        .rejects.toThrow('You can only delete your own services');
    });

    it('should throw error when service not found', async () => {
      mockPrisma.service.findUnique.mockResolvedValue(null);

      await expect(serviceService.delete('service-123', 'user-123'))
        .rejects.toThrow('Service not found');
    });

    it('should throw error when active bookings exist', async () => {
      mockPrisma.transaction.count.mockResolvedValue(2);

      await expect(serviceService.delete('service-123', 'user-123'))
        .rejects.toThrow('Cannot delete service with active or pending bookings');
    });
  });

  describe('getAvailability', () => {
    it('should return available when no conflicts', async () => {
      mockPrisma.service.findUnique.mockResolvedValue({ available: true });
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      const result = await serviceService.getAvailability(
        'service-123',
        new Date('2024-01-15'),
        new Date('2024-01-20')
      );

      expect(result.available).toBe(true);
    });

    it('should return not available when service is marked unavailable', async () => {
      mockPrisma.service.findUnique.mockResolvedValue({ available: false });

      const result = await serviceService.getAvailability(
        'service-123',
        new Date('2024-01-15'),
        new Date('2024-01-20')
      );

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Service is marked as unavailable');
    });

    it('should return not available when service not found', async () => {
      mockPrisma.service.findUnique.mockResolvedValue(null);

      const result = await serviceService.getAvailability(
        'service-123',
        new Date('2024-01-15'),
        new Date('2024-01-20')
      );

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Service not found');
    });

    it('should return not available when conflicting bookings exist', async () => {
      mockPrisma.service.findUnique.mockResolvedValue({ available: true });
      mockPrisma.transaction.findMany.mockResolvedValue([
        { startDate: new Date('2024-01-16'), endDate: new Date('2024-01-18') },
      ]);

      const result = await serviceService.getAvailability(
        'service-123',
        new Date('2024-01-15'),
        new Date('2024-01-20')
      );

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Service provider is already booked for these dates');
    });
  });
});
