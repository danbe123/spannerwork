import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    tool: {
      findMany: vi.fn(),
    },
    space: {
      findMany: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
    review: {
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../src/services/geocoding.service.js', () => ({
  geocodingService: {
    geocodePostcode: vi.fn(),
  },
}));

import { UserService } from '../../src/services/user.service.js';
import { prisma } from '../../src/config/database.js';
import { geocodingService } from '../../src/services/geocoding.service.js';

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getById', () => {
    it('should return user by ID without relations', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        username: 'testuser',
        phone: '+447123456789',
        avatar: null,
        bio: 'Test bio',
        postcode: 'SW1A 1AA',
        locationAddress: 'London',
        locationLat: 51.5074,
        locationLng: -0.1278,
        role: 'USER',
        accountStatus: 'ACTIVE',
        emailVerified: true,
        rating: 4.5,
        totalTransactions: 10,
        totalReviews: 5,
        createdDate: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const result = await userService.getById('user-123');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: expect.objectContaining({
          id: true,
          email: true,
          name: true,
        }),
      });
      expect(result).toBeDefined();
    });

    it('should return null for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await userService.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user profile with valid data', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'Updated Name',
        bio: 'Updated bio',
      };

      vi.mocked(prisma.user.findFirst).mockResolvedValue(null); // No existing username
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

      const result = await userService.update('user-123', {
        name: 'Updated Name',
        bio: 'Updated bio',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          name: 'Updated Name',
          bio: 'Updated bio',
        }),
      });
      expect(result.name).toBe('Updated Name');
    });

    it('should throw error if username is already taken', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'other-user' } as any);

      await expect(
        userService.update('user-123', { username: 'taken-username' })
      ).rejects.toThrow('Username is already taken');
    });

    it('should geocode postcode when provided', async () => {
      const mockLocation = {
        lat: 51.5074,
        lng: -0.1278,
        address: 'London, UK',
      };

      vi.mocked(geocodingService.geocodePostcode).mockResolvedValue(mockLocation);
      vi.mocked(prisma.user.update).mockResolvedValue({ id: 'user-123' } as any);

      await userService.update('user-123', { postcode: 'SW1A 1AA' });

      expect(geocodingService.geocodePostcode).toHaveBeenCalledWith('SW1A 1AA');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          postcode: 'SW1A 1AA',
          locationLat: 51.5074,
          locationLng: -0.1278,
          locationAddress: 'London, UK',
        }),
      });
    });

    it('should throw error for invalid postcode', async () => {
      vi.mocked(geocodingService.geocodePostcode).mockResolvedValue(null);

      await expect(
        userService.update('user-123', { postcode: 'INVALID' })
      ).rejects.toThrow('Invalid postcode');
    });
  });

  describe('getUserTools', () => {
    it('should return user tools with limit', async () => {
      const mockTools = [
        { id: 'tool-1', name: 'Drill', ownerId: 'user-123' },
        { id: 'tool-2', name: 'Saw', ownerId: 'user-123' },
      ];

      vi.mocked(prisma.tool.findMany).mockResolvedValue(mockTools as any);

      const result = await userService.getUserTools('user-123');

      expect(prisma.tool.findMany).toHaveBeenCalledWith({
        where: { ownerId: 'user-123' },
        orderBy: { createdDate: 'desc' },
        take: 100,
        include: expect.any(Object),
      });
      expect(result).toHaveLength(2);
    });

    it('should respect custom limit', async () => {
      vi.mocked(prisma.tool.findMany).mockResolvedValue([]);

      await userService.getUserTools('user-123', 50);

      expect(prisma.tool.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      );
    });
  });

  describe('getUserSpaces', () => {
    it('should return user spaces with limit', async () => {
      const mockSpaces = [
        { id: 'space-1', name: 'Workshop', ownerId: 'user-123' },
      ];

      vi.mocked(prisma.space.findMany).mockResolvedValue(mockSpaces as any);

      const result = await userService.getUserSpaces('user-123');

      expect(prisma.space.findMany).toHaveBeenCalledWith({
        where: { ownerId: 'user-123' },
        orderBy: { createdDate: 'desc' },
        take: 100,
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getUserServices', () => {
    it('should return user services with limit', async () => {
      const mockServices = [
        { id: 'service-1', name: 'Plumbing', providerId: 'user-123' },
      ];

      vi.mocked(prisma.service.findMany).mockResolvedValue(mockServices as any);

      const result = await userService.getUserServices('user-123');

      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: { providerId: 'user-123' },
        orderBy: { createdDate: 'desc' },
        take: 100,
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getUserReviews', () => {
    it('should return paginated reviews', async () => {
      const mockReviews = [
        { id: 'review-1', rating: 5, comment: 'Great!' },
        { id: 'review-2', rating: 4, comment: 'Good' },
      ];

      vi.mocked(prisma.review.findMany).mockResolvedValue(mockReviews as any);
      vi.mocked(prisma.review.count).mockResolvedValue(10);

      const result = await userService.getUserReviews('user-123', 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 10,
        totalPages: 1,
      });
    });

    it('should handle empty reviews', async () => {
      vi.mocked(prisma.review.findMany).mockResolvedValue([]);
      vi.mocked(prisma.review.count).mockResolvedValue(0);

      const result = await userService.getUserReviews('user-123');

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('getUserTransactions', () => {
    it('should return paginated transactions', async () => {
      const mockTransactions = [
        { id: 'txn-1', status: 'COMPLETED' },
        { id: 'txn-2', status: 'PENDING' },
      ];

      vi.mocked(prisma.transaction.findMany).mockResolvedValue(mockTransactions as any);
      vi.mocked(prisma.transaction.count).mockResolvedValue(5);

      const result = await userService.getUserTransactions('user-123', 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(5);
    });
  });

  describe('updateUserRating', () => {
    it('should update user rating from review aggregate', async () => {
      vi.mocked(prisma.review.aggregate).mockResolvedValue({
        _avg: { rating: 4.5 },
        _count: { rating: 10 },
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({ id: 'user-123' } as any);

      await userService.updateUserRating('user-123');

      expect(prisma.review.aggregate).toHaveBeenCalledWith({
        where: { reviewedUserId: 'user-123' },
        _avg: { rating: true },
        _count: { rating: true },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          rating: 4.5,
          totalReviews: 10,
        },
      });
    });

    it('should not update if no reviews exist', async () => {
      vi.mocked(prisma.review.aggregate).mockResolvedValue({
        _avg: { rating: null },
        _count: { rating: 0 },
      } as any);

      await userService.updateUserRating('user-123');

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
