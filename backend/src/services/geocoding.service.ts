import { redis } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

interface GeocodingResult {
  lat: number;
  lng: number;
  address: string;
}

interface PostcodesIoResponse {
  status: number;
  result?: {
    latitude: number;
    longitude: number;
    admin_district: string;
  };
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

interface GoogleGeocodingResponse {
  status: string;
  results?: Array<{
    geometry: {
      location: { lat: number; lng: number };
    };
    formatted_address: string;
  }>;
}

interface MapboxGeocodingResponse {
  features?: Array<{
    center: [number, number]; // [lng, lat]
    place_name: string;
  }>;
}

export class GeocodingService {
  private hasGoogleMaps = !!env.GOOGLE_MAPS_API_KEY;
  private hasMapbox = !!env.MAPBOX_ACCESS_TOKEN;

  /**
   * Geocode a UK postcode to latitude/longitude
   * Priority: Google Maps > Mapbox > Postcodes.io > Nominatim
   * Uses Redis caching (30 days)
   */
  async geocodePostcode(postcode: string): Promise<GeocodingResult | null> {
    // Normalize postcode
    const normalizedPostcode = postcode.trim().toUpperCase();

    // Check cache first
    const cacheKey = `geocode:${normalizedPostcode}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      logger.debug(`Geocoding cache hit for ${normalizedPostcode}`);
      return JSON.parse(cached);
    }

    try {
      let result: GeocodingResult | null = null;

      // Try premium providers first (higher rate limits for production)
      if (this.hasGoogleMaps) {
        result = await this.geocodeWithGoogle(normalizedPostcode);
      }

      if (!result && this.hasMapbox) {
        result = await this.geocodeWithMapbox(normalizedPostcode);
      }

      // Fallback to free providers
      if (!result) {
        result = await this.geocodeWithPostcodesIo(normalizedPostcode);
      }

      if (!result) {
        result = await this.geocodeWithNominatim(normalizedPostcode);
      }

      if (result) {
        // Cache for 30 days
        await redis.setex(cacheKey, 30 * 24 * 60 * 60, JSON.stringify(result));
        return result;
      }

      return null;
    } catch (error) {
      logger.error('Geocoding error:', error);
      return null;
    }
  }

  /**
   * Geocode using Google Maps Geocoding API (premium, high rate limits)
   */
  private async geocodeWithGoogle(postcode: string): Promise<GeocodingResult | null> {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?` +
          `address=${encodeURIComponent(postcode)},UK&` +
          `key=${env.GOOGLE_MAPS_API_KEY}`
      );

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as GoogleGeocodingResponse;

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        return {
          lat: location.lat,
          lng: location.lng,
          address: data.results[0].formatted_address,
        };
      }

      return null;
    } catch (error) {
      logger.warn('Google Maps geocoding failed:', error);
      return null;
    }
  }

  /**
   * Geocode using Mapbox Geocoding API (premium, high rate limits)
   */
  private async geocodeWithMapbox(postcode: string): Promise<GeocodingResult | null> {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
          `${encodeURIComponent(postcode)}.json?` +
          `country=gb&` +
          `access_token=${env.MAPBOX_ACCESS_TOKEN}`
      );

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as MapboxGeocodingResponse;

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        return {
          lat,
          lng,
          address: data.features[0].place_name,
        };
      }

      return null;
    } catch (error) {
      logger.warn('Mapbox geocoding failed:', error);
      return null;
    }
  }

  /**
   * Geocode using Postcodes.io (UK-specific)
   */
  private async geocodeWithPostcodesIo(
    postcode: string
  ): Promise<GeocodingResult | null> {
    try {
      const response = await fetch(
        `${env.POSTCODES_IO_URL}/postcodes/${encodeURIComponent(postcode)}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as PostcodesIoResponse;

      if (data.status === 200 && data.result) {
        return {
          lat: data.result.latitude,
          lng: data.result.longitude,
          address: `${postcode}, ${data.result.admin_district}, UK`,
        };
      }

      return null;
    } catch (error) {
      logger.warn('Postcodes.io geocoding failed:', error);
      return null;
    }
  }

  /**
   * Geocode using Nominatim (fallback)
   */
  private async geocodeWithNominatim(
    postcode: string
  ): Promise<GeocodingResult | null> {
    try {
      // Rate limit: 1 request per second for Nominatim
      await this.rateLimitNominatim();

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
          `format=json&q=${encodeURIComponent(postcode)},UK&limit=1`,
        {
          headers: {
            'User-Agent': env.NOMINATIM_USER_AGENT,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as NominatimResult[];

      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          address: data[0].display_name,
        };
      }

      return null;
    } catch (error) {
      logger.warn('Nominatim geocoding failed:', error);
      return null;
    }
  }

  /**
   * Rate limit Nominatim requests (1 req/sec max)
   */
  private async rateLimitNominatim(): Promise<void> {
    const key = 'ratelimit:nominatim';
    const exists = await redis.exists(key);

    if (exists) {
      // Wait 1 second if rate limit hit
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Set rate limit marker for 1 second
    await redis.setex(key, 1, '1');
  }

  /**
   * Calculate distance between two points (Haversine formula)
   * Returns distance in miles
   */
  calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

export const geocodingService = new GeocodingService();
