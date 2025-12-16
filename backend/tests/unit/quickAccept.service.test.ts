import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    request: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
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
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/notification.service.js', () => ({
  notificationService: {
    sendToUser: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../src/services/geocoding.service.js', () => ({
  geocodingService: {
    calculateDistance: vi.fn(),
  },
}));

import { quickAcceptService } from '../../src/services/quickAccept.service.js';
import { prisma } from '../../src/config/database.js';
import { notificationService } from '../../src/services/notification.service.js';
import { geocodingService } from '../../src/services/geocoding.service.js';

describe('QuickAcceptService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('findMatchingProviders', () => {
    it('should return empty array when request not found', async () => {
      vi.mocked(prisma.request.findUnique).mockResolvedValue(null);

      const result = await quickAcceptService.findMatchingProviders('request-123');

      expect(result).toEqual([]);
    });

    it('should return empty array when request has no location', async () => {
      vi.mocked(prisma.request.findUnique).mockResolvedValue({
        id: 'request-123',
        locationLat: null,
        locationLng: null,
        seeker: { id: 'seeker-123' },
      } as any);

      const result = await quickAcceptService.findMatchingProviders('request-123');

      expect(result).toEqual([]);
    });

    it('should find tool providers for TOOLS category', async () => {
      const mockRequest = {
        id: 'request-123',
        category: 'TOOLS',
        locationLat: 51.5074,
        locationLng: -0.1278,
        broadcastRadius: 10,
        seeker: { id: 'seeker-123' },
      };

      const mockTools = [
        {
          id: 'tool-1',
          owner: {
            id: 'provider-1',
            name: 'Provider One',
            email: 'provider1@test.com',
            rating: 4.5,
            postcode: 'SW1A 1AA',
            locationLat: 51.5080,
            locationLng: -0.1280,
          },
        },
      ];

      vi.mocked(prisma.request.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.tool.findMany).mockResolvedValue(mockTools as any);
      vi.mocked(geocodingService.calculateDistance).mockReturnValue(0.5);

      const result = await quickAcceptService.findMatchingProviders('request-123');

      expect(prisma.tool.findMany).toHaveBeenCalledWith({
        where: { available: true },
        include: expect.any(Object),
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('provider-1');
    });

    it('should find service providers for EXPERTISE category', async () => {
      const mockRequest = {
        id: 'request-123',
        category: 'EXPERTISE',
        locationLat: 51.5074,
        locationLng: -0.1278,
        broadcastRadius: 10,
        seeker: { id: 'seeker-123' },
      };

      const mockServices = [
        {
          id: 'service-1',
          provider: {
            id: 'provider-1',
            name: 'Provider One',
            email: 'provider1@test.com',
            rating: 4.5,
            postcode: 'SW1A 1AA',
            locationLat: 51.5080,
            locationLng: -0.1280,
          },
        },
      ];

      vi.mocked(prisma.request.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.service.findMany).mockResolvedValue(mockServices as any);
      vi.mocked(geocodingService.calculateDistance).mockReturnValue(0.5);

      const result = await quickAcceptService.findMatchingProviders('request-123');

      expect(prisma.service.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should find space owners for SPACE category', async () => {
      const mockRequest = {
        id: 'request-123',
        category: 'SPACE',
        locationLat: 51.5074,
        locationLng: -0.1278,
        broadcastRadius: 10,
        seeker: { id: 'seeker-123' },
      };

      const mockSpaces = [
        {
          id: 'space-1',
          owner: {
            id: 'provider-1',
            name: 'Provider One',
            email: 'provider1@test.com',
            rating: 4.5,
            postcode: 'SW1A 1AA',
            locationLat: 51.5080,
            locationLng: -0.1280,
          },
        },
      ];

      vi.mocked(prisma.request.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.space.findMany).mockResolvedValue(mockSpaces as any);
      vi.mocked(geocodingService.calculateDistance).mockReturnValue(0.5);

      const result = await quickAcceptService.findMatchingProviders('request-123');

      expect(prisma.space.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should exclude the seeker from matching providers', async () => {
      const mockRequest = {
        id: 'request-123',
        category: 'TOOLS',
        locationLat: 51.5074,
        locationLng: -0.1278,
        broadcastRadius: 10,
        seeker: { id: 'seeker-123' },
      };

      const mockTools = [
        {
          id: 'tool-1',
          owner: {
            id: 'seeker-123', // Same as seeker
            name: 'Seeker',
            email: 'seeker@test.com',
            rating: 4.5,
            postcode: 'SW1A 1AA',
            locationLat: 51.5080,
            locationLng: -0.1280,
          },
        },
      ];

      vi.mocked(prisma.request.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.tool.findMany).mockResolvedValue(mockTools as any);

      const result = await quickAcceptService.findMatchingProviders('request-123');

      expect(result).toHaveLength(0);
    });

    it('should filter providers outside radius', async () => {
      const mockRequest = {
        id: 'request-123',
        category: 'TOOLS',
        locationLat: 51.5074,
        locationLng: -0.1278,
        broadcastRadius: 5,
        seeker: { id: 'seeker-123' },
      };

      const mockTools = [
        {
          id: 'tool-1',
          owner: {
            id: 'provider-1',
            name: 'Far Provider',
            email: 'far@test.com',
            rating: 4.5,
            postcode: 'M1 1AA',
            locationLat: 53.4808,
            locationLng: -2.2426,
          },
        },
      ];

      vi.mocked(prisma.request.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.tool.findMany).mockResolvedValue(mockTools as any);
      vi.mocked(geocodingService.calculateDistance).mockReturnValue(200); // 200 miles

      const result = await quickAcceptService.findMatchingProviders('request-123');

      expect(result).toHaveLength(0);
    });

    it('should dedupe providers with multiple listings', async () => {
      const mockRequest = {
        id: 'request-123',
        category: 'TOOLS',
        locationLat: 51.5074,
        locationLng: -0.1278,
        broadcastRadius: 10,
        seeker: { id: 'seeker-123' },
      };

      const mockTools = [
        {
          id: 'tool-1',
          owner: {
            id: 'provider-1',
            name: 'Provider',
            email: 'provider@test.com',
            rating: 4.5,
            postcode: 'SW1A 1AA',
            locationLat: 51.5080,
            locationLng: -0.1280,
          },
        },
        {
          id: 'tool-2',
          owner: {
            id: 'provider-1', // Same provider
            name: 'Provider',
            email: 'provider@test.com',
            rating: 4.5,
            postcode: 'SW1A 1AA',
            locationLat: 51.5080,
            locationLng: -0.1280,
          },
        },
      ];

      vi.mocked(prisma.request.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.tool.findMany).mockResolvedValue(mockTools as any);
      vi.mocked(geocodingService.calculateDistance).mockReturnValue(0.5);

      const result = await quickAcceptService.findMatchingProviders('request-123');

      expect(result).toHaveLength(1);
    });

    it('should sort providers by match score', async () => {
      const mockRequest = {
        id: 'request-123',
        category: 'TOOLS',
        locationLat: 51.5074,
        locationLng: -0.1278,
        broadcastRadius: 10,
        seeker: { id: 'seeker-123' },
      };

      const mockTools = [
        {
          id: 'tool-1',
          owner: {
            id: 'provider-low',
            name: 'Low Rating',
            email: 'low@test.com',
            rating: 2.0,
            postcode: 'SW1A 1AA',
            locationLat: 51.5080,
            locationLng: -0.1280,
          },
        },
        {
          id: 'tool-2',
          owner: {
            id: 'provider-high',
            name: 'High Rating',
            email: 'high@test.com',
            rating: 5.0,
            postcode: 'SW1A 1AA',
            locationLat: 51.5080,
            locationLng: -0.1280,
          },
        },
      ];

      vi.mocked(prisma.request.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.tool.findMany).mockResolvedValue(mockTools as any);
      vi.mocked(geocodingService.calculateDistance).mockReturnValue(0.5);

      const result = await quickAcceptService.findMatchingProviders('request-123');

      expect(result[0].id).toBe('provider-high');
    });

    it('should respect limit parameter', async () => {
      const mockRequest = {
        id: 'request-123',
        category: 'TOOLS',
        locationLat: 51.5074,
        locationLng: -0.1278,
        broadcastRadius: 10,
        seeker: { id: 'seeker-123' },
      };

      const mockTools = Array.from({ length: 20 }, (_, i) => ({
        id: `tool-${i}`,
        owner: {
          id: `provider-${i}`,
          name: `Provider ${i}`,
          email: `provider${i}@test.com`,
          rating: 4.0,
          postcode: 'SW1A 1AA',
          locationLat: 51.5080,
          locationLng: -0.1280,
        },
      }));

      vi.mocked(prisma.request.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.tool.findMany).mockResolvedValue(mockTools as any);
      vi.mocked(geocodingService.calculateDistance).mockReturnValue(0.5);

      const result = await quickAcceptService.findMatchingProviders('request-123', 5);

      expect(result).toHaveLength(5);
    });
  });

  describe('notifyMatchingProviders', () => {
    it('should return 0 when request not found', async () => {
      vi.mocked(prisma.request.findUnique).mockResolvedValue(null);

      const result = await quickAcceptService.notifyMatchingProviders('request-123');

      expect(result).toBe(0);
    });

    it('should send notifications to matching providers', async () => {
      const mockRequest = {
        id: 'request-123',
        title: 'Need a drill',
        budget: 50,
        category: 'TOOLS',
        locationLat: 51.5074,
        locationLng: -0.1278,
        broadcastRadius: 10,
        seeker: { id: 'seeker-123', name: 'John' },
      };

      const mockTools = [
        {
          id: 'tool-1',
          owner: {
            id: 'provider-1',
            name: 'Provider',
            email: 'provider@test.com',
            rating: 4.5,
            postcode: 'SW1A 1AA',
            locationLat: 51.5080,
            locationLng: -0.1280,
          },
        },
      ];

      vi.mocked(prisma.request.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.tool.findMany).mockResolvedValue(mockTools as any);
      vi.mocked(geocodingService.calculateDistance).mockReturnValue(0.5);

      const result = await quickAcceptService.notifyMatchingProviders('request-123');

      expect(result).toBe(1);
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'provider-1',
        expect.objectContaining({
          title: expect.stringContaining('New Job'),
          data: expect.objectContaining({
            type: 'quick-accept',
            requestId: 'request-123',
          }),
        })
      );
    });
  });

  describe('quickAccept', () => {
    it('should return error when request not found', async () => {
      vi.mocked(prisma.request.findUnique).mockResolvedValue(null);

      const result = await quickAcceptService.quickAccept('request-123', 'provider-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request not found');
    });

    it('should return error when request is not active', async () => {
      vi.mocked(prisma.request.findUnique).mockResolvedValue({
        id: 'request-123',
        status: 'COMPLETED',
        seekerId: 'seeker-123',
        seeker: { id: 'seeker-123', name: 'Seeker', email: 'seeker@test.com' },
      } as any);

      const result = await quickAcceptService.quickAccept('request-123', 'provider-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request is no longer active');
    });

    it('should return error when trying to accept own request', async () => {
      vi.mocked(prisma.request.findUnique).mockResolvedValue({
        id: 'request-123',
        status: 'ACTIVE',
        seekerId: 'user-123',
        seeker: { id: 'user-123', name: 'User', email: 'user@test.com' },
      } as any);

      const result = await quickAcceptService.quickAccept('request-123', 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot accept your own request');
    });

    it('should return error when already responded', async () => {
      vi.mocked(prisma.request.findUnique).mockResolvedValue({
        id: 'request-123',
        status: 'ACTIVE',
        seekerId: 'seeker-123',
        seeker: { id: 'seeker-123', name: 'Seeker', email: 'seeker@test.com' },
      } as any);

      vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
        id: 'existing-txn',
      } as any);

      const result = await quickAcceptService.quickAccept('request-123', 'provider-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('You have already responded to this request');
    });

    it('should create transaction and notify seeker on success', async () => {
      const mockRequest = {
        id: 'request-123',
        status: 'ACTIVE',
        seekerId: 'seeker-123',
        budget: 100,
        title: 'Need help',
        seeker: { id: 'seeker-123', name: 'Seeker', email: 'seeker@test.com' },
      };

      vi.mocked(prisma.request.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        name: 'Provider',
        email: 'provider@test.com',
      } as any);
      vi.mocked(prisma.transaction.create).mockResolvedValue({
        id: 'txn-123',
      } as any);
      vi.mocked(prisma.request.update).mockResolvedValue({} as any);

      const result = await quickAcceptService.quickAccept('request-123', 'provider-123');

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('txn-123');
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          requestId: 'request-123',
          userId: 'seeker-123',
          providerId: 'provider-123',
          status: 'PENDING',
        }),
      });
      expect(prisma.request.update).toHaveBeenCalledWith({
        where: { id: 'request-123' },
        data: { responseCount: { increment: 1 } },
      });
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'seeker-123',
        expect.objectContaining({
          title: expect.stringContaining('Accepted'),
        })
      );
    });

    it('should use proposed rate when provided', async () => {
      const mockRequest = {
        id: 'request-123',
        status: 'ACTIVE',
        seekerId: 'seeker-123',
        budget: 100,
        title: 'Need help',
        seeker: { id: 'seeker-123', name: 'Seeker', email: 'seeker@test.com' },
      };

      vi.mocked(prisma.request.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: 'Provider' } as any);
      vi.mocked(prisma.transaction.create).mockResolvedValue({ id: 'txn-123' } as any);
      vi.mocked(prisma.request.update).mockResolvedValue({} as any);

      await quickAcceptService.quickAccept('request-123', 'provider-123', 75);

      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          rentalFee: 75,
          platformFee: 8, // 10% of 75 rounded
          totalAmount: 83,
        }),
      });
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(prisma.request.findUnique).mockRejectedValue(new Error('DB error'));

      const result = await quickAcceptService.quickAccept('request-123', 'provider-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to accept request');
    });
  });

  describe('quickDecline', () => {
    it('should return true on successful decline', async () => {
      const result = await quickAcceptService.quickDecline('request-123', 'provider-123');

      expect(result).toBe(true);
    });
  });

  describe('getPendingResponses', () => {
    it('should return pending transactions for provider', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          providerId: 'provider-123',
          status: 'PENDING',
          request: { id: 'req-1', title: 'Request 1' },
          user: { id: 'user-1', name: 'User 1' },
        },
      ];

      vi.mocked(prisma.transaction.findMany).mockResolvedValue(mockTransactions as any);

      const result = await quickAcceptService.getPendingResponses('provider-123');

      expect(prisma.transaction.findMany).toHaveBeenCalledWith({
        where: {
          providerId: 'provider-123',
          status: 'PENDING',
        },
        include: expect.any(Object),
        orderBy: { createdDate: 'desc' },
        take: 20,
      });
      expect(result).toEqual(mockTransactions);
    });
  });
});
