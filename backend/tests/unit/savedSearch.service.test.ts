import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to create mocks that are available during vi.mock hoisting
const { mockCreate, mockFindMany, mockFindFirst, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindMany: vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: class PrismaClient {
    constructor() {
      return {
        savedSearch: {
          create: mockCreate,
          findMany: mockFindMany,
          findFirst: mockFindFirst,
          update: mockUpdate,
          delete: mockDelete,
        },
      } as unknown as object;
    }
  },
  Prisma: {
    InputJsonValue: {},
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks are set up
import { savedSearchService } from '../../src/services/savedSearch.service.js';

// Reference to our mocks for use in tests
const mockPrisma = {
  savedSearch: {
    create: mockCreate,
    findMany: mockFindMany,
    findFirst: mockFindFirst,
    update: mockUpdate,
    delete: mockDelete,
  },
};

describe('SavedSearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('create', () => {
    it('should create a new saved search', async () => {
      const mockSavedSearch = {
        id: 'search-123',
        userId: 'user-123',
        name: 'My Tools Search',
        filters: { category: 'TOOLS', budget: 50 },
        createdDate: new Date(),
      };

      mockPrisma.savedSearch.create.mockResolvedValue(mockSavedSearch);

      const result = await savedSearchService.create({
        userId: 'user-123',
        name: 'My Tools Search',
        filters: { category: 'TOOLS', budget: 50 },
      });

      expect(mockPrisma.savedSearch.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          name: 'My Tools Search',
          filters: { category: 'TOOLS', budget: 50 },
        },
      });
      expect(result).toEqual(mockSavedSearch);
    });

    it('should handle creation errors', async () => {
      mockPrisma.savedSearch.create.mockRejectedValue(new Error('DB error'));

      await expect(
        savedSearchService.create({
          userId: 'user-123',
          name: 'Test',
          filters: {},
        })
      ).rejects.toThrow('DB error');
    });
  });

  describe('list', () => {
    it('should list all saved searches for a user', async () => {
      const mockSearches = [
        { id: 'search-1', name: 'Search 1', userId: 'user-123' },
        { id: 'search-2', name: 'Search 2', userId: 'user-123' },
      ];

      mockPrisma.savedSearch.findMany.mockResolvedValue(mockSearches);

      const result = await savedSearchService.list('user-123');

      expect(mockPrisma.savedSearch.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdDate: 'desc' },
      });
      expect(result).toEqual(mockSearches);
    });

    it('should return empty array when no searches found', async () => {
      mockPrisma.savedSearch.findMany.mockResolvedValue([]);

      const result = await savedSearchService.list('user-123');

      expect(result).toEqual([]);
    });

    it('should handle list errors', async () => {
      mockPrisma.savedSearch.findMany.mockRejectedValue(new Error('DB error'));

      await expect(savedSearchService.list('user-123')).rejects.toThrow('DB error');
    });
  });

  describe('getById', () => {
    it('should return saved search by ID', async () => {
      const mockSearch = {
        id: 'search-123',
        userId: 'user-123',
        name: 'My Search',
        filters: { category: 'TOOLS' },
      };

      mockPrisma.savedSearch.findFirst.mockResolvedValue(mockSearch);

      const result = await savedSearchService.getById('search-123', 'user-123');

      expect(mockPrisma.savedSearch.findFirst).toHaveBeenCalledWith({
        where: { id: 'search-123', userId: 'user-123' },
      });
      expect(result).toEqual(mockSearch);
    });

    it('should throw error when saved search not found', async () => {
      mockPrisma.savedSearch.findFirst.mockResolvedValue(null);

      await expect(
        savedSearchService.getById('nonexistent', 'user-123')
      ).rejects.toThrow('Saved search not found');
    });

    it('should not return searches belonging to other users', async () => {
      mockPrisma.savedSearch.findFirst.mockResolvedValue(null);

      await expect(
        savedSearchService.getById('search-123', 'wrong-user')
      ).rejects.toThrow('Saved search not found');

      expect(mockPrisma.savedSearch.findFirst).toHaveBeenCalledWith({
        where: { id: 'search-123', userId: 'wrong-user' },
      });
    });
  });

  describe('update', () => {
    it('should update a saved search name', async () => {
      const existingSearch = {
        id: 'search-123',
        userId: 'user-123',
        name: 'Old Name',
        filters: { category: 'TOOLS' },
      };

      const updatedSearch = {
        ...existingSearch,
        name: 'New Name',
      };

      mockPrisma.savedSearch.findFirst.mockResolvedValue(existingSearch);
      mockPrisma.savedSearch.update.mockResolvedValue(updatedSearch);

      const result = await savedSearchService.update('search-123', 'user-123', {
        name: 'New Name',
      });

      expect(mockPrisma.savedSearch.update).toHaveBeenCalledWith({
        where: { id: 'search-123' },
        data: { name: 'New Name' },
      });
      expect(result.name).toBe('New Name');
    });

    it('should update saved search filters', async () => {
      const existingSearch = {
        id: 'search-123',
        userId: 'user-123',
        name: 'My Search',
        filters: { category: 'TOOLS' },
      };

      const newFilters = { category: 'SPACE', budget: 100 };
      const updatedSearch = {
        ...existingSearch,
        filters: newFilters,
      };

      mockPrisma.savedSearch.findFirst.mockResolvedValue(existingSearch);
      mockPrisma.savedSearch.update.mockResolvedValue(updatedSearch);

      const result = await savedSearchService.update('search-123', 'user-123', {
        filters: newFilters,
      });

      expect(mockPrisma.savedSearch.update).toHaveBeenCalledWith({
        where: { id: 'search-123' },
        data: { filters: newFilters },
      });
      expect(result.filters).toEqual(newFilters);
    });

    it('should update both name and filters', async () => {
      const existingSearch = {
        id: 'search-123',
        userId: 'user-123',
        name: 'Old Name',
        filters: { category: 'TOOLS' },
      };

      mockPrisma.savedSearch.findFirst.mockResolvedValue(existingSearch);
      mockPrisma.savedSearch.update.mockResolvedValue({
        ...existingSearch,
        name: 'New Name',
        filters: { category: 'SPACE' },
      });

      await savedSearchService.update('search-123', 'user-123', {
        name: 'New Name',
        filters: { category: 'SPACE' },
      });

      expect(mockPrisma.savedSearch.update).toHaveBeenCalledWith({
        where: { id: 'search-123' },
        data: {
          name: 'New Name',
          filters: { category: 'SPACE' },
        },
      });
    });

    it('should throw error when saved search not found', async () => {
      mockPrisma.savedSearch.findFirst.mockResolvedValue(null);

      await expect(
        savedSearchService.update('nonexistent', 'user-123', { name: 'Test' })
      ).rejects.toThrow('Saved search not found');
    });

    it('should verify ownership before updating', async () => {
      mockPrisma.savedSearch.findFirst.mockResolvedValue(null);

      await expect(
        savedSearchService.update('search-123', 'wrong-user', { name: 'Test' })
      ).rejects.toThrow('Saved search not found');

      expect(mockPrisma.savedSearch.findFirst).toHaveBeenCalledWith({
        where: { id: 'search-123', userId: 'wrong-user' },
      });
    });
  });

  describe('delete', () => {
    it('should delete a saved search', async () => {
      const existingSearch = {
        id: 'search-123',
        userId: 'user-123',
        name: 'My Search',
      };

      mockPrisma.savedSearch.findFirst.mockResolvedValue(existingSearch);
      mockPrisma.savedSearch.delete.mockResolvedValue(existingSearch);

      const result = await savedSearchService.delete('search-123', 'user-123');

      expect(mockPrisma.savedSearch.delete).toHaveBeenCalledWith({
        where: { id: 'search-123' },
      });
      expect(result).toEqual({ success: true });
    });

    it('should throw error when saved search not found', async () => {
      mockPrisma.savedSearch.findFirst.mockResolvedValue(null);

      await expect(
        savedSearchService.delete('nonexistent', 'user-123')
      ).rejects.toThrow('Saved search not found');

      expect(mockPrisma.savedSearch.delete).not.toHaveBeenCalled();
    });

    it('should verify ownership before deleting', async () => {
      mockPrisma.savedSearch.findFirst.mockResolvedValue(null);

      await expect(
        savedSearchService.delete('search-123', 'wrong-user')
      ).rejects.toThrow('Saved search not found');

      expect(mockPrisma.savedSearch.findFirst).toHaveBeenCalledWith({
        where: { id: 'search-123', userId: 'wrong-user' },
      });
    });

    it('should handle delete errors', async () => {
      const existingSearch = {
        id: 'search-123',
        userId: 'user-123',
      };

      mockPrisma.savedSearch.findFirst.mockResolvedValue(existingSearch);
      mockPrisma.savedSearch.delete.mockRejectedValue(new Error('DB error'));

      await expect(
        savedSearchService.delete('search-123', 'user-123')
      ).rejects.toThrow('DB error');
    });
  });
});
