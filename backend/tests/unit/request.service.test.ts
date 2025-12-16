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

// Hoist prisma mocks
const mockPrisma = vi.hoisted(() => ({
  request: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  $queryRawUnsafe: vi.fn(),
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: mockPrisma,
}));

import { RequestService } from '../../src/services/request.service.js';
import { geocodingService } from '../../src/services/geocoding.service.js';

describe('RequestService', () => {
  let requestService: RequestService;

  beforeEach(() => {
    vi.clearAllMocks();
    requestService = new RequestService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('create', () => {
    const mockRequestData = {
      title: 'Need a drill',
      description: 'Looking for a power drill for weekend project',
      category: 'TOOLS',
      urgency: 'ASAP',
      budget: 5000,
      rateType: 'DAILY',
      broadcastRadius: 10,
      postcode: 'SW1A 1AA',
      photos: ['photo1.jpg'],
    };

    it('should create a request with valid data', async () => {
      vi.mocked(geocodingService.geocodePostcode).mockResolvedValue({
        lat: 51.5014,
        lng: -0.1419,
        address: '10 Downing Street, London',
      });

      const mockCreatedRequest = {
        id: 'req-123',
        ...mockRequestData,
        locationLat: 51.5014,
        locationLng: -0.1419,
        locationAddress: '10 Downing Street, London',
        status: 'ACTIVE',
        seekerId: 'user-123',
        seeker: { id: 'user-123', name: 'Test User', avatar: null, rating: 4.5, totalReviews: 10 },
      };

      mockPrisma.request.create.mockResolvedValue(mockCreatedRequest);

      const result = await requestService.create('user-123', mockRequestData);

      expect(geocodingService.geocodePostcode).toHaveBeenCalledWith('SW1A 1AA');
      expect(mockPrisma.request.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Need a drill',
            description: 'Looking for a power drill for weekend project',
            category: 'TOOLS',
            urgency: 'ASAP',
            budget: 5000,
            status: 'ACTIVE',
            seekerId: 'user-123',
          }),
        })
      );
      expect(result.id).toBe('req-123');
    });

    it('should throw error for invalid postcode', async () => {
      vi.mocked(geocodingService.geocodePostcode).mockResolvedValue(null);

      await expect(requestService.create('user-123', mockRequestData))
        .rejects.toThrow('Invalid postcode. Please enter a valid UK postcode.');
    });

    it('should set expiration to 7 days from now', async () => {
      vi.mocked(geocodingService.geocodePostcode).mockResolvedValue({
        lat: 51.5014,
        lng: -0.1419,
        address: 'London',
      });

      mockPrisma.request.create.mockResolvedValue({ id: 'req-123' });

      await requestService.create('user-123', mockRequestData);

      const createCall = mockPrisma.request.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt;
      
      const now = new Date();
      const expectedExpiry = new Date(now);
      expectedExpiry.setDate(expectedExpiry.getDate() + 7);
      
      // Check expiry is roughly 7 days from now (within 1 minute tolerance)
      expect(Math.abs(expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(60000);
    });

    it('should handle missing photos', async () => {
      vi.mocked(geocodingService.geocodePostcode).mockResolvedValue({
        lat: 51.5014,
        lng: -0.1419,
        address: 'London',
      });

      mockPrisma.request.create.mockResolvedValue({ id: 'req-123' });

      const dataWithoutPhotos = { ...mockRequestData };
      delete dataWithoutPhotos.photos;

      await requestService.create('user-123', dataWithoutPhotos);

      const createCall = mockPrisma.request.create.mock.calls[0][0];
      expect(createCall.data.photos).toEqual([]);
    });
  });

  describe('list', () => {
    it('should list requests with default pagination', async () => {
      const mockRequests = [
        { id: 'req-1', title: 'Request 1' },
        { id: 'req-2', title: 'Request 2' },
      ];

      mockPrisma.request.findMany.mockResolvedValue(mockRequests);
      mockPrisma.request.count.mockResolvedValue(2);

      const result = await requestService.list({});

      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        })
      );
      expect(result.data).toHaveLength(2);
    });

    it('should apply category filter', async () => {
      mockPrisma.request.findMany.mockResolvedValue([]);
      mockPrisma.request.count.mockResolvedValue(0);

      await requestService.list({ category: 'TOOLS' });

      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'TOOLS',
          }),
        })
      );
    });

    it('should apply urgency filter', async () => {
      mockPrisma.request.findMany.mockResolvedValue([]);
      mockPrisma.request.count.mockResolvedValue(0);

      await requestService.list({ urgency: 'ASAP' });

      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            urgency: 'ASAP',
          }),
        })
      );
    });

    it('should apply status filter', async () => {
      mockPrisma.request.findMany.mockResolvedValue([]);
      mockPrisma.request.count.mockResolvedValue(0);

      await requestService.list({ status: 'FULFILLED' });

      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'FULFILLED',
          }),
        })
      );
    });

    it('should default to ACTIVE status when no status provided', async () => {
      mockPrisma.request.findMany.mockResolvedValue([]);
      mockPrisma.request.count.mockResolvedValue(0);

      await requestService.list({});

      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('should respect pagination parameters', async () => {
      mockPrisma.request.findMany.mockResolvedValue([]);
      mockPrisma.request.count.mockResolvedValue(100);

      await requestService.list({ page: 3, limit: 10 });

      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (page 3 - 1) * 10
          take: 10,
        })
      );
    });

    it('should cap limit at 100', async () => {
      mockPrisma.request.findMany.mockResolvedValue([]);
      mockPrisma.request.count.mockResolvedValue(500);

      await requestService.list({ limit: 500 });

      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });

    it('should fallback to standard query when PostGIS query fails', async () => {
      // Setup geocoding to return valid location (triggers PostGIS path)
      vi.mocked(geocodingService.geocodePostcode).mockResolvedValue({
        lat: 51.5074,
        lng: -0.1278,
        address: 'London, UK',
      });
      
      // Make PostGIS query throw an error
      mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error('PostGIS extension not available'));
      
      // Setup fallback query to succeed
      const mockRequests = [{ id: 'req-1', title: 'Test Request' }];
      mockPrisma.request.findMany.mockResolvedValue(mockRequests);
      mockPrisma.request.count.mockResolvedValue(1);
      
      const result = await requestService.list({ postcode: 'SW1A 1AA', radius: 10 });
      
      // Should fallback to standard query
      expect(mockPrisma.request.findMany).toHaveBeenCalled();
      expect(result.data).toEqual(mockRequests);
    });

    it('should use standard query when no postcode/radius provided', async () => {
      const mockRequests = [{ id: 'req-1', title: 'Test Request' }];
      mockPrisma.request.findMany.mockResolvedValue(mockRequests);
      mockPrisma.request.count.mockResolvedValue(1);
      
      const result = await requestService.list({});
      
      // Should use standard Prisma query, not PostGIS
      expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
      expect(mockPrisma.request.findMany).toHaveBeenCalled();
      expect(result.data).toEqual(mockRequests);
    });

    it('should use standard query when geocoding fails', async () => {
      vi.mocked(geocodingService.geocodePostcode).mockResolvedValue(null);
      
      const mockRequests = [{ id: 'req-1', title: 'Test Request' }];
      mockPrisma.request.findMany.mockResolvedValue(mockRequests);
      mockPrisma.request.count.mockResolvedValue(1);
      
      const result = await requestService.list({ postcode: 'INVALID', radius: 10 });
      
      // Should fallback to standard query since geocoding failed
      expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
      expect(mockPrisma.request.findMany).toHaveBeenCalled();
      expect(result.data).toEqual(mockRequests);
    });
  });

  describe('getById', () => {
    it('should return request by id', async () => {
      const mockRequest = { id: 'req-123', title: 'Test Request' };
      mockPrisma.request.findUnique.mockResolvedValue(mockRequest);

      const result = await requestService.getById('req-123');

      expect(mockPrisma.request.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-123' },
        })
      );
      expect(result).toEqual(mockRequest);
    });

    it('should return null for non-existent request', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(null);

      const result = await requestService.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      mockPrisma.request.findUnique.mockResolvedValue({ id: 'req-123', seekerId: 'user-123' });
    });

    it('should update request when owner', async () => {
      const mockUpdatedRequest = { id: 'req-123', title: 'Updated Title' };
      mockPrisma.request.update.mockResolvedValue(mockUpdatedRequest);

      const result = await requestService.update('req-123', 'user-123', { title: 'Updated Title' });

      expect(mockPrisma.request.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-123' },
        })
      );
      expect(result.title).toBe('Updated Title');
    });

    it('should throw error when not owner', async () => {
      mockPrisma.request.findUnique.mockResolvedValue({ id: 'req-123', seekerId: 'other-user' });

      await expect(requestService.update('req-123', 'user-123', { title: 'Updated' }))
        .rejects.toThrow('You do not have permission to update this request');
    });

    it('should throw error when request not found', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(null);

      await expect(requestService.update('req-123', 'user-123', { title: 'Updated' }))
        .rejects.toThrow('Request not found');
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      mockPrisma.request.findUnique.mockResolvedValue({ id: 'req-123', seekerId: 'user-123' });
    });

    it('should delete request when owner', async () => {
      mockPrisma.request.delete.mockResolvedValue({ id: 'req-123' });

      await requestService.delete('req-123', 'user-123');

      expect(mockPrisma.request.delete).toHaveBeenCalledWith({
        where: { id: 'req-123' },
      });
    });

    it('should throw error when not owner', async () => {
      mockPrisma.request.findUnique.mockResolvedValue({ id: 'req-123', seekerId: 'other-user' });

      await expect(requestService.delete('req-123', 'user-123'))
        .rejects.toThrow('You do not have permission to delete this request');
    });

    it('should throw error when request not found', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(null);

      await expect(requestService.delete('req-123', 'user-123'))
        .rejects.toThrow('Request not found');
    });
  });

  describe('cancel', () => {
    beforeEach(() => {
      mockPrisma.request.findUnique.mockResolvedValue({ id: 'req-123', seekerId: 'user-123' });
    });

    it('should cancel request when owner', async () => {
      mockPrisma.request.update.mockResolvedValue({ id: 'req-123', status: 'CANCELLED' });

      const result = await requestService.cancel('req-123', 'user-123');

      expect(mockPrisma.request.update).toHaveBeenCalledWith({
        where: { id: 'req-123' },
        data: { status: 'CANCELLED' },
      });
      expect(result.status).toBe('CANCELLED');
    });

    it('should throw error when not owner', async () => {
      mockPrisma.request.findUnique.mockResolvedValue({ id: 'req-123', seekerId: 'other-user' });

      await expect(requestService.cancel('req-123', 'user-123'))
        .rejects.toThrow('You do not have permission to cancel this request');
    });
  });
});
