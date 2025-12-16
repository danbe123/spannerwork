import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Mock the service and logger
vi.mock('../../src/services/savedSearch.service.js', () => ({
  savedSearchService: {
    create: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { SavedSearchController } from '../../src/controllers/savedSearch.controller.js';
import { savedSearchService } from '../../src/services/savedSearch.service.js';

describe('SavedSearchController', () => {
  let controller: SavedSearchController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new SavedSearchController();
    
    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
  });

  describe('create', () => {
    it('should create a saved search successfully', async () => {
      const mockSavedSearch = { id: 'search-123', name: 'Power Tools London' };
      vi.mocked(savedSearchService.create).mockResolvedValue(mockSavedSearch as any);

      mockReq = {
        user: { id: 'user-123' },
        body: {
          name: 'Power Tools London',
          filters: { category: 'POWER_TOOLS', postcode: 'SW1A' },
        },
      };

      await controller.create(mockReq as Request, mockRes as Response);

      expect(savedSearchService.create).toHaveBeenCalledWith({
        userId: 'user-123',
        name: 'Power Tools London',
        filters: { category: 'POWER_TOOLS', postcode: 'SW1A' },
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Saved search created successfully',
        savedSearch: mockSavedSearch,
      });
    });

    it('should return 500 on error', async () => {
      vi.mocked(savedSearchService.create).mockRejectedValue(new Error('Database error'));

      mockReq = {
        user: { id: 'user-123' },
        body: { name: 'Test', filters: {} },
      };

      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('list', () => {
    it('should return user saved searches', async () => {
      const mockSearches = [
        { id: 'search-1', name: 'Search 1' },
        { id: 'search-2', name: 'Search 2' },
      ];
      vi.mocked(savedSearchService.list).mockResolvedValue(mockSearches as any);

      mockReq = {
        user: { id: 'user-123' },
      };

      await controller.list(mockReq as Request, mockRes as Response);

      expect(savedSearchService.list).toHaveBeenCalledWith('user-123');
      expect(mockRes.json).toHaveBeenCalledWith({ savedSearches: mockSearches });
    });

    it('should return 500 on error', async () => {
      vi.mocked(savedSearchService.list).mockRejectedValue(new Error('Database error'));

      mockReq = {
        user: { id: 'user-123' },
      };

      await controller.list(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getById', () => {
    it('should return saved search when found', async () => {
      const mockSearch = { id: 'search-123', name: 'My Search' };
      vi.mocked(savedSearchService.getById).mockResolvedValue(mockSearch as any);

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'search-123' },
      };

      await controller.getById(mockReq as Request, mockRes as Response);

      expect(savedSearchService.getById).toHaveBeenCalledWith('search-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith({ savedSearch: mockSearch });
    });

    it('should return 404 when not found', async () => {
      vi.mocked(savedSearchService.getById).mockRejectedValue(new Error('Saved search not found'));

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'non-existent' },
      };

      await controller.getById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('update', () => {
    it('should update saved search successfully', async () => {
      const mockSearch = { id: 'search-123', name: 'Updated Name' };
      vi.mocked(savedSearchService.update).mockResolvedValue(mockSearch as any);

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'search-123' },
        body: { name: 'Updated Name', filters: { category: 'HAND_TOOLS' } },
      };

      await controller.update(mockReq as Request, mockRes as Response);

      expect(savedSearchService.update).toHaveBeenCalledWith('search-123', 'user-123', {
        name: 'Updated Name',
        filters: { category: 'HAND_TOOLS' },
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Saved search updated successfully',
        savedSearch: mockSearch,
      });
    });

    it('should return 404 when not found', async () => {
      vi.mocked(savedSearchService.update).mockRejectedValue(new Error('Saved search not found'));

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'non-existent' },
        body: { name: 'Test' },
      };

      await controller.update(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('delete', () => {
    it('should delete saved search successfully', async () => {
      vi.mocked(savedSearchService.delete).mockResolvedValue(undefined);

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'search-123' },
      };

      await controller.delete(mockReq as Request, mockRes as Response);

      expect(savedSearchService.delete).toHaveBeenCalledWith('search-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Saved search deleted successfully',
      });
    });

    it('should return 404 when not found', async () => {
      vi.mocked(savedSearchService.delete).mockRejectedValue(new Error('Saved search not found'));

      mockReq = {
        user: { id: 'user-123' },
        params: { id: 'non-existent' },
      };

      await controller.delete(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});
