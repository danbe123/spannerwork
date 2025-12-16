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

vi.mock('../../src/config/env.js', () => ({
  env: {
    GOOGLE_MAPS_API_KEY: null,
    MAPBOX_ACCESS_TOKEN: null,
    POSTCODES_IO_URL: 'https://api.postcodes.io',
    NOMINATIM_USER_AGENT: 'SpannerWork/1.0',
  },
}));

const mockRedisGet = vi.hoisted(() => vi.fn());
const mockRedisSetex = vi.hoisted(() => vi.fn());
const mockRedisExists = vi.hoisted(() => vi.fn());

vi.mock('../../src/config/redis.js', () => ({
  redis: {
    get: mockRedisGet,
    setex: mockRedisSetex,
    exists: mockRedisExists,
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { geocodingService, GeocodingService } from '../../src/services/geocoding.service.js';
import { logger } from '../../src/config/logger.js';

describe('Geocoding Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
    mockRedisSetex.mockResolvedValue('OK');
    mockRedisExists.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('geocodePostcode', () => {
    it('returns cached result if available', async () => {
      const cachedResult = { lat: 51.5074, lng: -0.1278, address: 'London, UK' };
      mockRedisGet.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await geocodingService.geocodePostcode('SW1A 1AA');

      expect(mockRedisGet).toHaveBeenCalledWith('geocode:SW1A 1AA');
      expect(result).toEqual(cachedResult);
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('cache hit'));
    });

    it('normalizes postcode before lookup', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 200,
          result: { latitude: 51.5, longitude: -0.1, admin_district: 'London' },
        }),
      });

      await geocodingService.geocodePostcode('  sw1a 1aa  ');

      expect(mockRedisGet).toHaveBeenCalledWith('geocode:SW1A 1AA');
    });

    it('geocodes using Postcodes.io as fallback', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 200,
          result: {
            latitude: 51.5014,
            longitude: -0.1419,
            admin_district: 'Westminster',
          },
        }),
      });

      const result = await geocodingService.geocodePostcode('SW1A 1AA');

      expect(result).toEqual({
        lat: 51.5014,
        lng: -0.1419,
        address: 'SW1A 1AA, Westminster, UK',
      });
    });

    it('caches successful geocoding result for 30 days', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 200,
          result: {
            latitude: 51.5,
            longitude: -0.1,
            admin_district: 'London',
          },
        }),
      });

      await geocodingService.geocodePostcode('EC1A 1BB');

      expect(mockRedisSetex).toHaveBeenCalledWith(
        'geocode:EC1A 1BB',
        30 * 24 * 60 * 60, // 30 days in seconds
        expect.any(String)
      );
    });

    it('returns null when API returns not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
      });

      const result = await geocodingService.geocodePostcode('INVALID');

      expect(result).toBeNull();
    });

    it('returns null when postcode not found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 404,
          result: null,
        }),
      });

      const result = await geocodingService.geocodePostcode('ZZ99 9ZZ');

      expect(result).toBeNull();
    });

    it('handles fetch error gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await geocodingService.geocodePostcode('SW1A 1AA');

      expect(result).toBeNull();
      // Errors in individual providers are logged as warnings, not errors
      // The outer error handler only catches unexpected errors
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('calculateDistance', () => {
    it('calculates distance between two points', () => {
      // London to Manchester (approximately 163 miles)
      const distance = geocodingService.calculateDistance(
        51.5074, -0.1278, // London
        53.4808, -2.2426  // Manchester
      );

      // Allow some margin for the calculation
      expect(distance).toBeGreaterThan(150);
      expect(distance).toBeLessThan(180);
    });

    it('returns 0 for same location', () => {
      const distance = geocodingService.calculateDistance(
        51.5074, -0.1278,
        51.5074, -0.1278
      );

      expect(distance).toBe(0);
    });

    it('calculates short distances accurately', () => {
      // Two points about 1 mile apart in London
      const distance = geocodingService.calculateDistance(
        51.5074, -0.1278,
        51.5174, -0.1278
      );

      expect(distance).toBeGreaterThan(0.5);
      expect(distance).toBeLessThan(1.5);
    });

    it('handles international distances', () => {
      // London to New York (approximately 3459 miles)
      const distance = geocodingService.calculateDistance(
        51.5074, -0.1278,  // London
        40.7128, -74.0060  // New York
      );

      expect(distance).toBeGreaterThan(3400);
      expect(distance).toBeLessThan(3500);
    });
  });
});
