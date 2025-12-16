import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    tool: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { spatialService } from '../../src/services/spatial.service.js';
import { prisma } from '../../src/config/database.js';

describe('SpatialService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('milesToMeters', () => {
    it('should convert miles to meters correctly', () => {
      expect(spatialService.milesToMeters(1)).toBeCloseTo(1609.34, 2);
      expect(spatialService.milesToMeters(10)).toBeCloseTo(16093.4, 2);
      expect(spatialService.milesToMeters(0)).toBe(0);
    });
  });

  describe('metersToMiles', () => {
    it('should convert meters to miles correctly', () => {
      expect(spatialService.metersToMiles(1609.34)).toBeCloseTo(1, 2);
      expect(spatialService.metersToMiles(16093.4)).toBeCloseTo(10, 2);
      expect(spatialService.metersToMiles(0)).toBe(0);
    });

    it('should be inverse of milesToMeters', () => {
      const miles = 5;
      const meters = spatialService.milesToMeters(miles);
      expect(spatialService.metersToMiles(meters)).toBeCloseTo(miles, 5);
    });
  });

  describe('findToolsWithinRadius', () => {
    it('should return tools with distance information', async () => {
      const mockTools = [
        {
          id: 'tool-1',
          name: 'Drill',
          available: true,
          locationLat: 51.5074,
          locationLng: -0.1278,
          distance_meters: 500,
        },
        {
          id: 'tool-2',
          name: 'Saw',
          available: true,
          locationLat: 51.5080,
          locationLng: -0.1280,
          distance_meters: 1200,
        },
      ];

      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockTools);

      const results = await spatialService.findToolsWithinRadius({
        center: { lat: 51.5074, lng: -0.1278 },
        radiusMiles: 10,
        limit: 50,
      });

      expect(results).toHaveLength(2);
      expect(results[0].distanceMeters).toBe(500);
      expect(results[0].distanceMiles).toBeCloseTo(0.31, 2);
      expect(results[1].distanceMeters).toBe(1200);
    });

    it('should fall back to bounding box search on PostGIS error', async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('PostGIS not available'));
      vi.mocked(prisma.tool.findMany).mockResolvedValue([
        {
          id: 'tool-1',
          name: 'Drill',
          description: 'A power drill',
          category: 'Power Tools',
          dailyRate: 1500,
          weeklyRate: 7000,
          deposit: 5000,
          photos: [],
          condition: 'Good',
          available: true,
          postcode: 'SW1A 1AA',
          locationLat: 51.5074,
          locationLng: -0.1278,
          ownerId: 'user-1',
          createdDate: new Date(),
          updatedDate: new Date(),
        },
      ]);

      const results = await spatialService.findToolsWithinRadius({
        center: { lat: 51.5074, lng: -0.1278 },
        radiusMiles: 10,
      });

      expect(prisma.tool.findMany).toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].item.name).toBe('Drill');
      // Should have calculated distance using Haversine
      expect(results[0].distanceMeters).toBeGreaterThanOrEqual(0);
    });

    it('should respect limit and offset options', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      await spatialService.findToolsWithinRadius({
        center: { lat: 51.5074, lng: -0.1278 },
        radiusMiles: 5,
        limit: 20,
        offset: 10,
      });

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('findSpacesWithinRadius', () => {
    it('should return spaces with distance information', async () => {
      const mockSpaces = [
        {
          id: 'space-1',
          name: 'Workshop',
          distance_meters: 800,
        },
      ];

      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockSpaces);

      const results = await spatialService.findSpacesWithinRadius({
        center: { lat: 51.5074, lng: -0.1278 },
        radiusMiles: 5,
      });

      expect(results).toHaveLength(1);
      expect(results[0].distanceMeters).toBe(800);
    });

    it('should return empty array on error', async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('DB error'));

      const results = await spatialService.findSpacesWithinRadius({
        center: { lat: 51.5074, lng: -0.1278 },
        radiusMiles: 5,
      });

      expect(results).toEqual([]);
    });
  });

  describe('findServicesWithinRadius', () => {
    it('should return services with distance information', async () => {
      const mockServices = [
        {
          id: 'service-1',
          name: 'Plumber',
          distance_meters: 2000,
        },
      ];

      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockServices);

      const results = await spatialService.findServicesWithinRadius({
        center: { lat: 51.5074, lng: -0.1278 },
        radiusMiles: 5,
      });

      expect(results).toHaveLength(1);
      expect(results[0].distanceMiles).toBeCloseTo(1.24, 2);
    });
  });

  describe('findRequestsWithinRadius', () => {
    it('should return active requests with distance information', async () => {
      const mockRequests = [
        {
          id: 'request-1',
          title: 'Need a drill',
          status: 'ACTIVE',
          distance_meters: 1500,
        },
      ];

      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockRequests);

      const results = await spatialService.findRequestsWithinRadius({
        center: { lat: 51.5074, lng: -0.1278 },
        radiusMiles: 10,
      });

      expect(results).toHaveLength(1);
      expect(results[0].item.status).toBe('ACTIVE');
    });
  });
});
