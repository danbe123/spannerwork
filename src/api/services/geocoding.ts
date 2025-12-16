import apiClient from '../client';

// ============================================================================
// Types
// ============================================================================

export interface GeocodingResult {
  lat: number;
  lng: number;
  address: string;
}

// ============================================================================
// Service
// ============================================================================

export const geocodingService = {
  /**
   * Geocode a UK postcode to lat/lng coordinates
   * Routes through backend to avoid rate limiting issues
   */
  async geocodePostcode(postcode: string): Promise<GeocodingResult | null> {
    try {
      const response = await apiClient.get<{ data: GeocodingResult }>(
        `/geocoding/postcode/${encodeURIComponent(postcode)}`
      );
      return response.data?.data || null;
    } catch {
      return null;
    }
  },
};
