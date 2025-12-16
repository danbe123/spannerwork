import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    tool: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
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

vi.mock('../../src/services/cache.service.js', () => ({
  ListingCache: {
    getTool: vi.fn(),
    setTool: vi.fn(),
    invalidateTool: vi.fn(),
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

vi.mock('../../src/utils/pagination.js', () => ({
  paginateWithCursor: vi.fn(),
}));

import { ToolService } from '../../src/services/tool.service.js';
import { prisma } from '../../src/config/database.js';
import { geocodingService } from '../../src/services/geocoding.service.js';
import { ListingCache } from '../../src/services/cache.service.js';

describe('ToolService', () => {
  let toolService: ToolService;

  beforeEach(() => {
    vi.clearAllMocks();
    toolService = new ToolService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('create', () => {
    it('should create a tool with geocoded location', async () => {
      vi.mocked(geocodingService.geocodePostcode).mockResolvedValue({
        lat: 51.5074,
        lng: -0.1278,
      });

      const mockTool = {
        id: 'tool-1',
        name: 'Power Drill',
        description: 'A powerful cordless drill',
        category: 'POWER_TOOLS',
        dailyRate: 15,
        deposit: 50,
        photos: ['photo1.jpg'],
        condition: 'EXCELLENT',
        postcode: 'SW1A 1AA',
        locationLat: 51.5074,
        locationLng: -0.1278,
        available: true,
        ownerId: 'user-1',
      };

      vi.mocked(prisma.tool.create).mockResolvedValue(mockTool as any);

      const result = await toolService.create('user-1', {
        name: 'Power Drill',
        description: 'A powerful cordless drill',
        category: 'POWER_TOOLS',
        dailyRate: 15,
        deposit: 50,
        photos: ['photo1.jpg'],
        condition: 'EXCELLENT',
        postcode: 'SW1A 1AA',
      });

      expect(geocodingService.geocodePostcode).toHaveBeenCalledWith('SW1A 1AA');
      expect(prisma.tool.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Power Drill',
          locationLat: 51.5074,
          locationLng: -0.1278,
          ownerId: 'user-1',
        }),
        include: expect.any(Object),
      });
      expect(result).toEqual(mockTool);
    });

    it('should throw error for invalid postcode', async () => {
      vi.mocked(geocodingService.geocodePostcode).mockResolvedValue(null);

      await expect(
        toolService.create('user-1', {
          name: 'Test Tool',
          description: 'Test description',
          category: 'POWER_TOOLS',
          dailyRate: 10,
          deposit: 25,
          photos: [],
          condition: 'GOOD',
          postcode: 'INVALID',
        })
      ).rejects.toThrow('Invalid postcode');
    });
  });

  describe('list', () => {
    it('should list tools with pagination', async () => {
      const mockTools = [
        { id: 'tool-1', name: 'Drill' },
        { id: 'tool-2', name: 'Saw' },
      ];

      vi.mocked(prisma.tool.findMany).mockResolvedValue(mockTools as any);
      vi.mocked(prisma.tool.count).mockResolvedValue(2);

      const result = await toolService.list({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by category', async () => {
      vi.mocked(prisma.tool.findMany).mockResolvedValue([]);
      vi.mocked(prisma.tool.count).mockResolvedValue(0);

      await toolService.list({ category: 'POWER_TOOLS' });

      expect(prisma.tool.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'POWER_TOOLS' }),
        })
      );
    });

    it('should filter by availability', async () => {
      vi.mocked(prisma.tool.findMany).mockResolvedValue([]);
      vi.mocked(prisma.tool.count).mockResolvedValue(0);

      await toolService.list({ available: true });

      expect(prisma.tool.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ available: true }),
        })
      );
    });

    it('should filter by price range', async () => {
      vi.mocked(prisma.tool.findMany).mockResolvedValue([]);
      vi.mocked(prisma.tool.count).mockResolvedValue(0);

      await toolService.list({ minPrice: 10, maxPrice: 50 });

      expect(prisma.tool.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dailyRate: { gte: 10, lte: 50 },
          }),
        })
      );
    });
  });

  describe('getById', () => {
    it('should return cached tool if available', async () => {
      const cachedTool = { id: 'tool-1', name: 'Cached Tool' };
      vi.mocked(ListingCache.getTool).mockResolvedValue(cachedTool as any);

      const result = await toolService.getById('tool-1');

      expect(ListingCache.getTool).toHaveBeenCalledWith('tool-1');
      expect(prisma.tool.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual(cachedTool);
    });

    it('should fetch from database and cache if not cached', async () => {
      vi.mocked(ListingCache.getTool).mockResolvedValue(null);
      const mockTool = { id: 'tool-1', name: 'Database Tool' };
      vi.mocked(prisma.tool.findUnique).mockResolvedValue(mockTool as any);
      vi.mocked(ListingCache.setTool).mockResolvedValue();

      const result = await toolService.getById('tool-1');

      expect(prisma.tool.findUnique).toHaveBeenCalledWith({
        where: { id: 'tool-1' },
        include: expect.any(Object),
      });
      expect(ListingCache.setTool).toHaveBeenCalledWith('tool-1', mockTool);
      expect(result).toEqual(mockTool);
    });

    it('should return null for non-existent tool', async () => {
      vi.mocked(ListingCache.getTool).mockResolvedValue(null);
      vi.mocked(prisma.tool.findUnique).mockResolvedValue(null);

      const result = await toolService.getById('nonexistent');

      expect(result).toBeNull();
      expect(ListingCache.setTool).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update tool and invalidate cache', async () => {
      vi.mocked(prisma.tool.findUnique).mockResolvedValue({
        id: 'tool-1',
        ownerId: 'user-1',
      } as any);

      vi.mocked(prisma.tool.update).mockResolvedValue({
        id: 'tool-1',
        name: 'Updated Tool',
      } as any);

      vi.mocked(ListingCache.invalidateTool).mockResolvedValue();

      const result = await toolService.update('tool-1', 'user-1', {
        name: 'Updated Tool',
      });

      expect(prisma.tool.update).toHaveBeenCalledWith({
        where: { id: 'tool-1' },
        data: { name: 'Updated Tool' },
        include: expect.any(Object),
      });
      expect(ListingCache.invalidateTool).toHaveBeenCalledWith('tool-1');
      expect(result.name).toBe('Updated Tool');
    });

    it('should throw error when tool not found', async () => {
      vi.mocked(prisma.tool.findUnique).mockResolvedValue(null);

      await expect(
        toolService.update('nonexistent', 'user-1', { name: 'Test' })
      ).rejects.toThrow('Tool not found');
    });

    it('should throw error when user is not owner', async () => {
      vi.mocked(prisma.tool.findUnique).mockResolvedValue({
        id: 'tool-1',
        ownerId: 'other-user',
      } as any);

      await expect(
        toolService.update('tool-1', 'user-1', { name: 'Test' })
      ).rejects.toThrow('You do not have permission to update this tool');
    });
  });

  describe('delete', () => {
    it('should delete tool and invalidate cache', async () => {
      vi.mocked(prisma.tool.findUnique).mockResolvedValue({
        id: 'tool-1',
        ownerId: 'user-1',
      } as any);

      vi.mocked(prisma.transaction.count).mockResolvedValue(0);
      vi.mocked(prisma.tool.delete).mockResolvedValue({} as any);
      vi.mocked(ListingCache.invalidateTool).mockResolvedValue();

      await toolService.delete('tool-1', 'user-1');

      expect(prisma.tool.delete).toHaveBeenCalledWith({
        where: { id: 'tool-1' },
      });
      expect(ListingCache.invalidateTool).toHaveBeenCalledWith('tool-1');
    });

    it('should throw error when tool not found', async () => {
      vi.mocked(prisma.tool.findUnique).mockResolvedValue(null);

      await expect(toolService.delete('nonexistent', 'user-1')).rejects.toThrow(
        'Tool not found'
      );
    });

    it('should throw error when user is not owner', async () => {
      vi.mocked(prisma.tool.findUnique).mockResolvedValue({
        id: 'tool-1',
        ownerId: 'other-user',
      } as any);

      await expect(toolService.delete('tool-1', 'user-1')).rejects.toThrow(
        'You do not have permission to delete this tool'
      );
    });

    it('should throw error when tool has active bookings', async () => {
      vi.mocked(prisma.tool.findUnique).mockResolvedValue({
        id: 'tool-1',
        ownerId: 'user-1',
      } as any);

      vi.mocked(prisma.transaction.count).mockResolvedValue(2);

      await expect(toolService.delete('tool-1', 'user-1')).rejects.toThrow(
        'Cannot delete tool with active bookings'
      );
    });
  });

  describe('getAvailability', () => {
    it('should return available when no conflicts', async () => {
      vi.mocked(prisma.tool.findUnique).mockResolvedValue({
        id: 'tool-1',
        available: true,
      } as any);

      vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);

      const result = await toolService.getAvailability(
        'tool-1',
        new Date('2025-01-01'),
        new Date('2025-01-03')
      );

      expect(result.available).toBe(true);
    });

    it('should return unavailable when tool is marked unavailable', async () => {
      vi.mocked(prisma.tool.findUnique).mockResolvedValue({
        id: 'tool-1',
        available: false,
      } as any);

      const result = await toolService.getAvailability(
        'tool-1',
        new Date('2025-01-01'),
        new Date('2025-01-03')
      );

      expect(result.available).toBe(false);
      expect(result.reason).toContain('unavailable');
    });

    it('should return unavailable when conflicting bookings exist', async () => {
      vi.mocked(prisma.tool.findUnique).mockResolvedValue({
        id: 'tool-1',
        available: true,
      } as any);

      vi.mocked(prisma.transaction.findMany).mockResolvedValue([
        {
          id: 'booking-1',
          startDate: new Date('2025-01-02'),
          endDate: new Date('2025-01-04'),
        },
      ] as any);

      const result = await toolService.getAvailability(
        'tool-1',
        new Date('2025-01-01'),
        new Date('2025-01-03')
      );

      expect(result.available).toBe(false);
      expect(result.reason).toContain('already booked');
    });

    it('should throw error when tool not found', async () => {
      vi.mocked(prisma.tool.findUnique).mockResolvedValue(null);

      await expect(
        toolService.getAvailability(
          'nonexistent',
          new Date('2025-01-01'),
          new Date('2025-01-03')
        )
      ).rejects.toThrow('Tool not found');
    });
  });
});
