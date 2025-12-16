const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../client', () => ({
  default: mockClient,
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { aiService } from './ai';

describe('aiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMatches', () => {
    it('calls POST /ai/match with request data', async () => {
      const responseData = {
        matches: [
          { listingId: 'tool-1', listingType: 'tool', matchScore: 0.95, matchReason: 'Exact category match' },
        ],
      };
      mockClient.post.mockResolvedValueOnce({ data: responseData });

      const requestData = {
        title: 'Need a drill',
        description: 'Looking for a power drill for weekend project',
        category: 'TOOLS',
        budget: 50,
        postcode: 'SW1A 1AA',
      };

      const result = await aiService.getMatches(requestData);

      expect(mockClient.post).toHaveBeenCalledWith('/ai/match', requestData);
      expect(result).toEqual(responseData);
    });

    it('calls POST /ai/match without optional fields', async () => {
      const responseData = { matches: [] };
      mockClient.post.mockResolvedValueOnce({ data: responseData });

      const requestData = {
        title: 'Need help',
        description: 'Looking for assistance',
        category: 'EXPERTISE',
      };

      await aiService.getMatches(requestData);

      expect(mockClient.post).toHaveBeenCalledWith('/ai/match', requestData);
    });
  });

  describe('getBundles', () => {
    it('calls GET /ai/bundles with listing details', async () => {
      const responseData = {
        suggestions: [
          { id: 'tool-2', type: 'tool', name: 'Drill bits set', reason: 'Commonly used together', price: 15 },
        ],
      };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      const result = await aiService.getBundles('tool', 'tool-1', 'Power Drill', 'Power Tools');

      expect(mockClient.get).toHaveBeenCalledWith('/ai/bundles/tool/tool-1', {
        params: { name: 'Power Drill', category: 'Power Tools' },
      });
      expect(result).toEqual(responseData);
    });

    it('calls GET /ai/bundles for space listing', async () => {
      const responseData = { suggestions: [] };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      await aiService.getBundles('space', 'space-1', 'Garage Bay', 'Workshop');

      expect(mockClient.get).toHaveBeenCalledWith('/ai/bundles/space/space-1', {
        params: { name: 'Garage Bay', category: 'Workshop' },
      });
    });

    it('calls GET /ai/bundles for service listing', async () => {
      const responseData = { suggestions: [] };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      await aiService.getBundles('service', 'service-1', 'Mobile Mechanic', 'Automotive');

      expect(mockClient.get).toHaveBeenCalledWith('/ai/bundles/service/service-1', {
        params: { name: 'Mobile Mechanic', category: 'Automotive' },
      });
    });
  });

  describe('optimizeRequest', () => {
    it('calls POST /ai/optimize-request with title, description, category', async () => {
      const responseData = {
        optimizedTitle: 'Professional Power Drill Needed for Home Renovation',
        optimizedDescription: 'Looking for a reliable power drill for a weekend home renovation project...',
        suggestedBudget: 45,
      };
      mockClient.post.mockResolvedValueOnce({ data: responseData });

      const result = await aiService.optimizeRequest('Need drill', 'for project', 'TOOLS');

      expect(mockClient.post).toHaveBeenCalledWith('/ai/optimize-request', {
        title: 'Need drill',
        description: 'for project',
        category: 'TOOLS',
      });
      expect(result).toEqual(responseData);
    });

    it('returns null suggestedBudget when not available', async () => {
      const responseData = {
        optimizedTitle: 'Optimized Title',
        optimizedDescription: 'Optimized description',
        suggestedBudget: null,
      };
      mockClient.post.mockResolvedValueOnce({ data: responseData });

      const result = await aiService.optimizeRequest('Title', 'Desc', 'EXPERTISE');

      expect(result.suggestedBudget).toBeNull();
    });
  });
});
