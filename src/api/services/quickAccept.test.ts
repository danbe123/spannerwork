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
import { quickAcceptService } from './quickAccept';

describe('quickAcceptService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMatches', () => {
    it('calls GET /quick-accept/matches/:requestId with default limit', async () => {
      const responseData = {
        providers: [
          { id: 'user-1', name: 'John', email: 'john@example.com', distance: 2.5, rating: 4.8, matchScore: 0.95 },
        ],
      };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      const result = await quickAcceptService.getMatches('request-1');

      expect(mockClient.get).toHaveBeenCalledWith('/quick-accept/matches/request-1', { params: { limit: 10 } });
      expect(result).toEqual(responseData);
    });

    it('calls GET /quick-accept/matches/:requestId with custom limit', async () => {
      const responseData = { providers: [] };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      await quickAcceptService.getMatches('request-2', 5);

      expect(mockClient.get).toHaveBeenCalledWith('/quick-accept/matches/request-2', { params: { limit: 5 } });
    });
  });

  describe('accept', () => {
    it('calls POST /quick-accept/accept with requestId', async () => {
      const responseData = { success: true, transactionId: 'txn-1', message: 'Request accepted' };
      mockClient.post.mockResolvedValueOnce({ data: responseData });

      const result = await quickAcceptService.accept('request-1');

      expect(mockClient.post).toHaveBeenCalledWith('/quick-accept/accept', { requestId: 'request-1', proposedRate: undefined });
      expect(result).toEqual(responseData);
    });

    it('calls POST /quick-accept/accept with proposedRate', async () => {
      const responseData = { success: true, transactionId: 'txn-2', message: 'Request accepted with custom rate' };
      mockClient.post.mockResolvedValueOnce({ data: responseData });

      const result = await quickAcceptService.accept('request-1', 75);

      expect(mockClient.post).toHaveBeenCalledWith('/quick-accept/accept', { requestId: 'request-1', proposedRate: 75 });
      expect(result).toEqual(responseData);
    });
  });

  describe('decline', () => {
    it('calls POST /quick-accept/decline with requestId', async () => {
      const responseData = { success: true, message: 'Request declined' };
      mockClient.post.mockResolvedValueOnce({ data: responseData });

      const result = await quickAcceptService.decline('request-1');

      expect(mockClient.post).toHaveBeenCalledWith('/quick-accept/decline', { requestId: 'request-1' });
      expect(result).toEqual(responseData);
    });
  });

  describe('getPending', () => {
    it('calls GET /quick-accept/pending and returns pending responses', async () => {
      const responseData = {
        responses: [
          {
            id: 'response-1',
            request: { id: 'req-1', title: 'Need drill', description: 'For project', category: 'TOOLS', budget: 50, urgency: 'ASAP' },
            user: { id: 'user-1', name: 'Jane', rating: 4.5, avatar: null },
            createdDate: '2024-01-01',
          },
        ],
      };
      mockClient.get.mockResolvedValueOnce({ data: responseData });

      const result = await quickAcceptService.getPending();

      expect(mockClient.get).toHaveBeenCalledWith('/quick-accept/pending');
      expect(result).toEqual(responseData);
    });
  });

  describe('notifyProviders', () => {
    it('calls POST /quick-accept/notify/:requestId', async () => {
      const responseData = { success: true, notifiedProviders: 5 };
      mockClient.post.mockResolvedValueOnce({ data: responseData });

      const result = await quickAcceptService.notifyProviders('request-1');

      expect(mockClient.post).toHaveBeenCalledWith('/quick-accept/notify/request-1');
      expect(result).toEqual(responseData);
    });

    it('returns zero notified when no matching providers', async () => {
      const responseData = { success: true, notifiedProviders: 0 };
      mockClient.post.mockResolvedValueOnce({ data: responseData });

      const result = await quickAcceptService.notifyProviders('request-remote');

      expect(result.notifiedProviders).toBe(0);
    });
  });
});
