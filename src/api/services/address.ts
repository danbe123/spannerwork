import apiClient from '../client';

// ============================================================================
// Types
// ============================================================================

export interface AddressResult {
  line1: string;
  line2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
}

export interface AddressLookupResponse {
  postcode: string;
  addresses: AddressResult[];
}

// ============================================================================
// Service
// ============================================================================

export const addressService = {
  /**
   * Lookup addresses for a UK postcode using GetAddress.io
   * Returns a list of addresses at that postcode
   */
  async lookupPostcode(postcode: string): Promise<AddressResult[]> {
    try {
      const response = await apiClient.get<{ data: AddressLookupResponse }>(
        `/address/lookup/${encodeURIComponent(postcode)}`
      );
      return response.data?.data?.addresses || [];
    } catch {
      return [];
    }
  },

  /**
   * Check if address lookup service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await apiClient.get<{ data: { available: boolean } }>(
        '/address/available'
      );
      return response.data?.data?.available || false;
    } catch {
      return false;
    }
  },
};
