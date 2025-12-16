import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../src/config/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/geocoding.service.js', () => ({
  geocodingService: {
    geocodePostcode: vi.fn(),
  },
}));

vi.mock('../../src/services/cache.service.js', () => ({
  ListingCache: {
    invalidate: vi.fn(),
    invalidateSpace: vi.fn(),
    getSpace: vi.fn(),
    setSpace: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  },
}));

// Hoist prisma mocks
const mockPrisma = vi.hoisted(() => ({
  space: {
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
  $queryRaw: vi.fn(),
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: mockPrisma,
}));

import { SpaceService } from '../../src/services/space.service.js';
import { geocodingService } from '../../src/services/geocoding.service.js';

describe('SpaceService', () => {
  let spaceService: SpaceService;

  beforeEach(() => {
    vi.clearAllMocks();
    spaceService = new SpaceService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('create', () => {
    const mockSpaceData = {
      name: 'Workshop Space',
      description: 'Large workshop with power tools access',
      hourlyRate: 2500,
      dailyRate: 15000,
      weeklyRate: 75000,
      size: 50,
      features: ['POWER_OUTLETS', 'WIFI', 'HEATING'],
      photos: ['space1.jpg', 'space2.jpg'],
      postcode: 'M1 1AA',
      locationAddress: '123 Workshop Lane, Manchester',
    };

    it('should create a space with valid data', async () => {
      vi.mocked(geocodingService.geocodePostcode).mockResolvedValue({
        lat: 53.4808,
        lng: -2.2426,
        address: 'Manchester City Centre',
      });

      const mockCreatedSpace = {
        id: 'space-123',
        ...mockSpaceData,
        locationLat: 53.4808,
        locationLng: -2.2426,
        available: true,
        ownerId: 'user-123',
        owner: { id: 'user-123', name: 'Owner', avatar: null, rating: 4.5 },
      };

      mockPrisma.space.create.mockResolvedValue(mockCreatedSpace);

      const result = await spaceService.create('user-123', mockSpaceData);

      expect(geocodingService.geocodePostcode).toHaveBeenCalledWith('M1 1AA');
      expect(mockPrisma.space.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Workshop Space',
            hourlyRate: 2500,
            dailyRate: 15000,
            available: true,
            ownerId: 'user-123',
          }),
        })
      );
      expect(result.id).toBe('space-123');
    });

    it('should throw error for invalid postcode', async () => {
      vi.mocked(geocodingService.geocodePostcode).mockResolvedValue(null);

      await expect(spaceService.create('user-123', mockSpaceData))
        .rejects.toThrow('Invalid postcode. Please enter a valid UK postcode.');
    });

    it('should set available to true by default', async () => {
      vi.mocked(geocodingService.geocodePostcode).mockResolvedValue({
        lat: 53.4808,
        lng: -2.2426,
        address: 'Manchester',
      });

      mockPrisma.space.create.mockResolvedValue({ id: 'space-123' });

      await spaceService.create('user-123', mockSpaceData);

      const createCall = mockPrisma.space.create.mock.calls[0][0];
      expect(createCall.data.available).toBe(true);
    });
  });

  describe('list', () => {
    it('should list spaces with default pagination', async () => {
      const mockSpaces = [
        { id: 'space-1', name: 'Space 1' },
        { id: 'space-2', name: 'Space 2' },
      ];

      mockPrisma.space.findMany.mockResolvedValue(mockSpaces);
      mockPrisma.space.count.mockResolvedValue(2);

      const result = await spaceService.list({});

      expect(mockPrisma.space.findMany).toHaveBeenCalledWith(
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

    it('should apply hourly rate filters', async () => {
      mockPrisma.space.findMany.mockResolvedValue([]);
      mockPrisma.space.count.mockResolvedValue(0);

      await spaceService.list({ minHourlyRate: 1000, maxHourlyRate: 5000 });

      expect(mockPrisma.space.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            hourlyRate: {
              gte: 1000,
              lte: 5000,
            },
          }),
        })
      );
    });

    it('should apply daily rate filters', async () => {
      mockPrisma.space.findMany.mockResolvedValue([]);
      mockPrisma.space.count.mockResolvedValue(0);

      await spaceService.list({ minDailyRate: 5000, maxDailyRate: 20000 });

      expect(mockPrisma.space.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dailyRate: {
              gte: 5000,
              lte: 20000,
            },
          }),
        })
      );
    });

    it('should apply minimum size filter', async () => {
      mockPrisma.space.findMany.mockResolvedValue([]);
      mockPrisma.space.count.mockResolvedValue(0);

      await spaceService.list({ minSize: 30 });

      expect(mockPrisma.space.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            size: { gte: 30 },
          }),
        })
      );
    });

    it('should apply features filter', async () => {
      mockPrisma.space.findMany.mockResolvedValue([]);
      mockPrisma.space.count.mockResolvedValue(0);

      await spaceService.list({ features: ['WIFI', 'PARKING'] });

      expect(mockPrisma.space.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            features: {
              hasSome: ['WIFI', 'PARKING'],
            },
          }),
        })
      );
    });

    it('should handle pagination', async () => {
      mockPrisma.space.findMany.mockResolvedValue([]);
      mockPrisma.space.count.mockResolvedValue(100);

      await spaceService.list({ page: 2, limit: 15 });

      expect(mockPrisma.space.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 15, // (page 2 - 1) * 15
          take: 15,
        })
      );
    });
  });

  describe('getById', () => {
    it('should return space by id', async () => {
      const mockSpace = { id: 'space-123', name: 'Test Space' };
      mockPrisma.space.findUnique.mockResolvedValue(mockSpace);

      const result = await spaceService.getById('space-123');

      expect(mockPrisma.space.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'space-123' },
        })
      );
      expect(result).toEqual(mockSpace);
    });

    it('should return null for non-existent space', async () => {
      mockPrisma.space.findUnique.mockResolvedValue(null);

      const result = await spaceService.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      mockPrisma.space.findUnique.mockResolvedValue({ ownerId: 'user-123' });
    });

    it('should update space when owner', async () => {
      const mockUpdatedSpace = { id: 'space-123', name: 'Updated Space' };
      mockPrisma.space.update.mockResolvedValue(mockUpdatedSpace);

      const result = await spaceService.update('space-123', 'user-123', { name: 'Updated Space' });

      expect(mockPrisma.space.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'space-123' },
        })
      );
      expect(result.name).toBe('Updated Space');
    });

    it('should throw error when not owner', async () => {
      mockPrisma.space.findUnique.mockResolvedValue({ ownerId: 'other-user' });

      await expect(spaceService.update('space-123', 'user-123', { name: 'Updated' }))
        .rejects.toThrow('You can only update your own spaces');
    });

    it('should throw error when space not found', async () => {
      mockPrisma.space.findUnique.mockResolvedValue(null);

      await expect(spaceService.update('space-123', 'user-123', { name: 'Updated' }))
        .rejects.toThrow('Space not found');
    });

    it('should geocode new postcode on update', async () => {
      vi.mocked(geocodingService.geocodePostcode).mockResolvedValue({
        lat: 51.5,
        lng: -0.1,
        address: 'London',
      });
      mockPrisma.space.update.mockResolvedValue({ id: 'space-123' });

      await spaceService.update('space-123', 'user-123', { postcode: 'SW1A 1AA' });

      expect(geocodingService.geocodePostcode).toHaveBeenCalledWith('SW1A 1AA');
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      mockPrisma.space.findUnique.mockResolvedValue({ ownerId: 'user-123' });
    });

    it('should delete space when owner and no bookings', async () => {
      mockPrisma.transaction.count.mockResolvedValue(0);
      mockPrisma.space.delete.mockResolvedValue({ id: 'space-123' });

      await spaceService.delete('space-123', 'user-123');

      expect(mockPrisma.space.delete).toHaveBeenCalledWith({
        where: { id: 'space-123' },
      });
    });

    it('should throw error when not owner', async () => {
      mockPrisma.space.findUnique.mockResolvedValue({ ownerId: 'other-user' });

      await expect(spaceService.delete('space-123', 'user-123'))
        .rejects.toThrow('You can only delete your own spaces');
    });

    it('should throw error when space not found', async () => {
      mockPrisma.space.findUnique.mockResolvedValue(null);

      await expect(spaceService.delete('space-123', 'user-123'))
        .rejects.toThrow('Space not found');
    });

    it('should throw error when active bookings exist', async () => {
      mockPrisma.transaction.count.mockResolvedValue(2);

      await expect(spaceService.delete('space-123', 'user-123'))
        .rejects.toThrow('Cannot delete space with active or pending bookings');
    });
  });

  describe('getAvailability', () => {
    const startDate = new Date('2024-01-15');
    const endDate = new Date('2024-01-20');

    it('should return available for space with no conflicts', async () => {
      mockPrisma.space.findUnique.mockResolvedValue({ available: true });
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      const result = await spaceService.getAvailability('space-123', startDate, endDate);

      expect(result.available).toBe(true);
    });

    it('should return unavailable for non-existent space', async () => {
      mockPrisma.space.findUnique.mockResolvedValue(null);

      const result = await spaceService.getAvailability('non-existent', startDate, endDate);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Space not found');
    });

    it('should return unavailable for space marked unavailable', async () => {
      mockPrisma.space.findUnique.mockResolvedValue({ available: false });

      const result = await spaceService.getAvailability('space-123', startDate, endDate);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Space is marked as unavailable');
    });

    it('should return unavailable with conflicts', async () => {
      mockPrisma.space.findUnique.mockResolvedValue({ available: true });
      mockPrisma.transaction.findMany.mockResolvedValue([
        { startDate: new Date('2024-01-16'), endDate: new Date('2024-01-18') },
      ]);

      const result = await spaceService.getAvailability('space-123', startDate, endDate);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Space is already booked for these dates');
      expect(result.conflicts).toHaveLength(1);
    });
  });
});
