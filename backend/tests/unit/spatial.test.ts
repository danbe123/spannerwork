import { describe, it, expect, vi } from 'vitest';
import {
  calculateDistance,
  getBoundingBox,
  buildLocationFilter,
  sortByDistance,
} from '../../src/utils/spatial.js';

describe('Spatial Utilities', () => {
  describe('calculateDistance', () => {
    it('should return 0 for same coordinates', () => {
      const distance = calculateDistance(51.5074, -0.1278, 51.5074, -0.1278);
      expect(distance).toBeCloseTo(0, 5);
    });

    it('should calculate distance between two UK cities', () => {
      // London to Manchester (approx 163 miles)
      const londonLat = 51.5074;
      const londonLng = -0.1278;
      const manchesterLat = 53.4808;
      const manchesterLng = -2.2426;

      const distance = calculateDistance(londonLat, londonLng, manchesterLat, manchesterLng);
      expect(distance).toBeGreaterThan(150);
      expect(distance).toBeLessThan(180);
    });

    it('should calculate distance between two close points', () => {
      // Two points about 1 mile apart
      const lat1 = 51.5074;
      const lng1 = -0.1278;
      const lat2 = 51.5219; // ~1 mile north
      const lng2 = -0.1278;

      const distance = calculateDistance(lat1, lng1, lat2, lng2);
      expect(distance).toBeGreaterThan(0.8);
      expect(distance).toBeLessThan(1.2);
    });
  });

  describe('getBoundingBox', () => {
    it('should return bounding box around a point', () => {
      const lat = 51.5074;
      const lng = -0.1278;
      const radiusMiles = 10;

      const bbox = getBoundingBox(lat, lng, radiusMiles);

      expect(bbox.minLat).toBeLessThan(lat);
      expect(bbox.maxLat).toBeGreaterThan(lat);
      expect(bbox.minLng).toBeLessThan(lng);
      expect(bbox.maxLng).toBeGreaterThan(lng);
    });

    it('should create larger box for larger radius', () => {
      const lat = 51.5074;
      const lng = -0.1278;

      const smallBox = getBoundingBox(lat, lng, 5);
      const largeBox = getBoundingBox(lat, lng, 20);

      expect(largeBox.maxLat - largeBox.minLat).toBeGreaterThan(
        smallBox.maxLat - smallBox.minLat
      );
    });

    it('should be symmetric around the center point', () => {
      const lat = 51.5074;
      const lng = -0.1278;
      const radius = 10;

      const bbox = getBoundingBox(lat, lng, radius);

      const latOffset = bbox.maxLat - lat;
      expect(lat - bbox.minLat).toBeCloseTo(latOffset, 5);
    });
  });

  describe('buildLocationFilter', () => {
    it('should return Prisma-compatible filter object', () => {
      const filter = buildLocationFilter(51.5074, -0.1278, 10);

      expect(filter).toHaveProperty('locationLat');
      expect(filter).toHaveProperty('locationLng');
      expect(filter.locationLat).toHaveProperty('gte');
      expect(filter.locationLat).toHaveProperty('lte');
      expect(filter.locationLng).toHaveProperty('gte');
      expect(filter.locationLng).toHaveProperty('lte');
    });
  });

  describe('sortByDistance', () => {
    it('should sort items by distance from reference point', () => {
      const refLat = 51.5074;
      const refLng = -0.1278;

      const items = [
        { id: 'far', locationLat: 53.0, locationLng: -2.0 },
        { id: 'near', locationLat: 51.52, locationLng: -0.13 },
        { id: 'medium', locationLat: 52.0, locationLng: -1.0 },
      ];

      const sorted = sortByDistance(items, refLat, refLng);

      expect(sorted[0].id).toBe('near');
      expect(sorted[2].id).toBe('far');
    });

    it('should handle items without location', () => {
      const items = [
        { id: 'with', locationLat: 51.52, locationLng: -0.13 },
        { id: 'without', locationLat: null, locationLng: null },
      ];

      const sorted = sortByDistance(items, 51.5, -0.1);

      expect(sorted[0].id).toBe('with');
      expect(sorted[1].id).toBe('without');
    });

    it('should not mutate original array', () => {
      const items = [
        { id: 'a', locationLat: 53.0, locationLng: -2.0 },
        { id: 'b', locationLat: 51.5, locationLng: -0.1 },
      ];
      const original = [...items];

      sortByDistance(items, 51.5, -0.1);

      expect(items[0].id).toBe(original[0].id);
    });
  });
});
