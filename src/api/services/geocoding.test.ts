const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    get: vi.fn(),
  },
}));

vi.mock('../client', () => ({
  default: mockClient,
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { geocodingService } from './geocoding';

describe('geocodingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('geocodePostcode', () => {
    it('calls GET /geocoding/postcode/:postcode and returns coordinates', async () => {
      const responseData = {
        data: {
          lat: 51.5074,
          lng: -0.1278,
          address: 'Westminster, London SW1A 1AA',
        },
      };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      const result = await geocodingService.geocodePostcode('SW1A 1AA');

      expect(mockClient.get).toHaveBeenCalledWith('/geocoding/postcode/SW1A%201AA');
      expect(result).toEqual(responseData.data);
    });

    it('encodes postcode with special characters', async () => {
      const responseData = { data: { lat: 53.4808, lng: -2.2426, address: 'Manchester M1 1AA' } };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      await geocodingService.geocodePostcode('M1 1AA');

      expect(mockClient.get).toHaveBeenCalledWith('/geocoding/postcode/M1%201AA');
    });

    it('returns null when API returns empty data', async () => {
      mockClient.get.mockResolvedValueOnce({ data: { data: null } });

      const result = await geocodingService.geocodePostcode('INVALID');

      expect(result).toBeNull();
    });

    it('returns null when API returns no data property', async () => {
      mockClient.get.mockResolvedValueOnce({ data: {} });

      const result = await geocodingService.geocodePostcode('XX1 1XX');

      expect(result).toBeNull();
    });

    it('returns null on API error', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('Network error'));

      const result = await geocodingService.geocodePostcode('SW1A 1AA');

      expect(result).toBeNull();
    });

    it('returns null on 404 error', async () => {
      mockClient.get.mockRejectedValueOnce({ response: { status: 404 } });

      const result = await geocodingService.geocodePostcode('NOTFOUND');

      expect(result).toBeNull();
    });
  });
});
