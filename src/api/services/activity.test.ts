const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    get: vi.fn(),
  },
}));

vi.mock('../client', () => ({
  default: mockClient,
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { activityService } from './activity';

describe('activityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFeed', () => {
    it('calls GET /activity/feed with default limit', async () => {
      const responseData = { activities: [{ id: '1', type: 'LISTING_CREATED', message: 'Test', icon: '🔧', timestamp: '2024-01-01' }] };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      const result = await activityService.getFeed();

      expect(mockClient.get).toHaveBeenCalledWith('/activity/feed', { params: { limit: 20 } });
      expect(result).toEqual(responseData);
    });

    it('calls GET /activity/feed with custom limit', async () => {
      const responseData = { activities: [] };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      await activityService.getFeed(50);

      expect(mockClient.get).toHaveBeenCalledWith('/activity/feed', { params: { limit: 50 } });
    });
  });

  describe('getLocalFeed', () => {
    it('calls GET /activity/local with postcode and limit', async () => {
      const responseData = { activities: [{ id: '2', type: 'REQUEST_POSTED', message: 'Local', icon: '📍', timestamp: '2024-01-01' }] };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      const result = await activityService.getLocalFeed('SW1A 1AA');

      expect(mockClient.get).toHaveBeenCalledWith('/activity/local', { params: { postcode: 'SW1A 1AA', limit: 20 } });
      expect(result).toEqual(responseData);
    });

    it('calls GET /activity/local with custom limit', async () => {
      const responseData = { activities: [] };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      await activityService.getLocalFeed('M1 1AA', 10);

      expect(mockClient.get).toHaveBeenCalledWith('/activity/local', { params: { postcode: 'M1 1AA', limit: 10 } });
    });
  });

  describe('getStats', () => {
    it('calls GET /activity/stats and returns live stats', async () => {
      const responseData = {
        activeListings: 150,
        activeRequests: 75,
        recentTransactions: 30,
        updatedAt: '2024-01-01T12:00:00Z',
      };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      const result = await activityService.getStats();

      expect(mockClient.get).toHaveBeenCalledWith('/activity/stats');
      expect(result).toEqual(responseData);
    });
  });
});
