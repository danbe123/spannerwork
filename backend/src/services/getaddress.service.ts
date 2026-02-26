import { safeGet, safeSetex } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export interface AddressResult {
  line1: string;
  line2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
}

interface GetAddressResponse {
  postcode: string;
  latitude: number;
  longitude: number;
  addresses: string[];
}

export class GetAddressService {
  private hasApiKey = !!env.GETADDRESS_API_KEY;

  /**
   * Lookup addresses for a UK postcode using GetAddress.io
   * Uses Redis caching (30 days) to minimize API calls
   * Free tier: 20 lookups/day
   */
  async lookupPostcode(postcode: string): Promise<AddressResult[]> {
    if (!this.hasApiKey) {
      logger.warn('GetAddress.io API key not configured');
      return [];
    }

    // Normalize postcode (remove spaces, uppercase)
    const normalizedPostcode = postcode.replace(/\s+/g, '').toUpperCase();

    // Validate UK postcode format
    const ukPostcodeRegex = /^[A-Z]{1,2}\d{1,2}[A-Z]?\d[A-Z]{2}$/i;
    if (!ukPostcodeRegex.test(normalizedPostcode)) {
      logger.debug(`Invalid UK postcode format: ${postcode}`);
      return [];
    }

    // Check cache first
    const cacheKey = `getaddress:${normalizedPostcode}`;
    const cached = await safeGet(cacheKey);

    if (cached) {
      logger.debug(`GetAddress cache hit for ${normalizedPostcode}`);
      return JSON.parse(cached);
    }

    try {
      const response = await fetch(
        `https://api.getaddress.io/find/${encodeURIComponent(normalizedPostcode)}?api-key=${env.GETADDRESS_API_KEY}&expand=true`
      );

      if (!response.ok) {
        if (response.status === 404) {
          // Postcode not found - cache empty result
          await safeSetex(cacheKey, 30 * 24 * 60 * 60, JSON.stringify([]));
          return [];
        }
        if (response.status === 401) {
          logger.error('GetAddress.io API key invalid');
          return [];
        }
        if (response.status === 429) {
          logger.warn('GetAddress.io rate limit exceeded');
          return [];
        }
        logger.warn(`GetAddress.io API error: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as GetAddressResponse;

      // Parse addresses from GetAddress.io format
      // Each address is a comma-separated string with components
      const addresses: AddressResult[] = data.addresses.map((addressStr) => {
        const parts = addressStr.split(',').map((p) => p.trim());

        // GetAddress.io returns: line1, line2, line3, line4, locality, town/city, county
        // We want: line1, line2, city, county
        return {
          line1: parts[0] || '',
          line2: parts[1] || '',
          city: parts[5] || parts[4] || '', // town/city or locality
          county: parts[6] || '',
          postcode: data.postcode,
          country: 'GB',
        };
      });

      // Cache for 30 days
      await safeSetex(cacheKey, 30 * 24 * 60 * 60, JSON.stringify(addresses));

      logger.debug(`GetAddress lookup for ${normalizedPostcode}: ${addresses.length} addresses found`);
      return addresses;
    } catch (error) {
      logger.error('GetAddress.io lookup error:', error);
      return [];
    }
  }

  /**
   * Check if GetAddress.io is available
   */
  isAvailable(): boolean {
    return this.hasApiKey;
  }
}

export const getAddressService = new GetAddressService();
