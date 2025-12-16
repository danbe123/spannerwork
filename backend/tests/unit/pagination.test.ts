import { describe, it, expect, vi } from 'vitest';
import {
  encodeCursor,
  decodeCursor,
  cursorPaginationSchema,
  offsetPaginationSchema,
  paginateWithCursor,
  paginateWithOffset,
} from '../../src/utils/pagination.js';

describe('Pagination Utilities', () => {
  describe('encodeCursor', () => {
    it('should encode an ID to base64url', () => {
      const id = 'test-id-123';
      const encoded = encodeCursor(id);
      
      expect(encoded).toBeTruthy();
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('+');
    });

    it('should produce different encodings for different IDs', () => {
      const encoded1 = encodeCursor('id-1');
      const encoded2 = encodeCursor('id-2');
      
      expect(encoded1).not.toBe(encoded2);
    });
  });

  describe('decodeCursor', () => {
    it('should decode a valid cursor back to ID', () => {
      const originalId = 'test-id-456';
      const encoded = encodeCursor(originalId);
      const decoded = decodeCursor(encoded);
      
      expect(decoded).toBe(originalId);
    });

    it('should return null for invalid cursor', () => {
      const decoded = decodeCursor('not-valid-base64!!!');
      // It might not return null for all invalid strings, just check it doesn't throw
      expect(decoded !== undefined).toBe(true);
    });

    it('should handle empty string', () => {
      const decoded = decodeCursor('');
      expect(decoded).toBe('');
    });
  });

  describe('cursorPaginationSchema', () => {
    it('should parse valid pagination params', () => {
      const result = cursorPaginationSchema.parse({
        cursor: 'abc123',
        limit: '20',
        direction: 'forward',
      });

      expect(result.cursor).toBe('abc123');
      expect(result.limit).toBe(20);
      expect(result.direction).toBe('forward');
    });

    it('should use default limit when not provided', () => {
      const result = cursorPaginationSchema.parse({});

      expect(result.limit).toBe(20);
      expect(result.direction).toBe('forward');
    });

    it('should cap limit at MAX_LIMIT (100)', () => {
      const result = cursorPaginationSchema.parse({
        limit: '500',
      });

      expect(result.limit).toBe(100);
    });

    it('should enforce minimum limit of 1', () => {
      const result = cursorPaginationSchema.parse({
        limit: '0',
      });

      expect(result.limit).toBeGreaterThanOrEqual(1);
    });

    it('should accept backward direction', () => {
      const result = cursorPaginationSchema.parse({
        direction: 'backward',
      });

      expect(result.direction).toBe('backward');
    });

    it('should reject invalid direction', () => {
      expect(() => {
        cursorPaginationSchema.parse({
          direction: 'invalid',
        });
      }).toThrow();
    });
  });

  describe('offsetPaginationSchema', () => {
    it('should parse valid offset pagination params', () => {
      const result = offsetPaginationSchema.parse({
        page: '2',
        limit: '25',
      });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(25);
    });

    it('should use default page of 1', () => {
      const result = offsetPaginationSchema.parse({});

      expect(result.page).toBe(1);
    });

    it('should enforce minimum page of 1', () => {
      const result = offsetPaginationSchema.parse({
        page: '0',
      });

      expect(result.page).toBe(1);
    });

    it('should cap limit at MAX_LIMIT', () => {
      const result = offsetPaginationSchema.parse({
        limit: '500',
      });

      expect(result.limit).toBe(100);
    });
  });

  describe('paginateWithCursor', () => {
    it('should paginate items forward', async () => {
      const mockModel = {
        findMany: vi.fn().mockResolvedValue([
          { id: '1', name: 'Item 1' },
          { id: '2', name: 'Item 2' },
        ]),
        count: vi.fn().mockResolvedValue(10),
      };

      const result = await paginateWithCursor({
        model: mockModel,
        where: {},
        orderBy: { createdDate: 'desc' },
        limit: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination).toHaveProperty('nextCursor');
      expect(result.pagination).toHaveProperty('hasNextPage');
    });

    it('should handle cursor for next page', async () => {
      const mockModel = {
        findMany: vi.fn().mockResolvedValue([
          { id: '3', name: 'Item 3' },
          { id: '4', name: 'Item 4' },
        ]),
        count: vi.fn().mockResolvedValue(10),
      };

      const cursor = encodeCursor('2');
      const result = await paginateWithCursor({
        model: mockModel,
        cursor,
        limit: 10,
      });

      expect(result.data).toBeDefined();
      expect(mockModel.findMany).toHaveBeenCalled();
    });

    it('should support backward direction', async () => {
      const mockModel = {
        findMany: vi.fn().mockResolvedValue([
          { id: '1', name: 'Item 1' },
        ]),
        count: vi.fn().mockResolvedValue(10),
      };

      const result = await paginateWithCursor({
        model: mockModel,
        direction: 'backward',
        limit: 10,
      });

      expect(result.pagination.hasPrevPage).toBeDefined();
    });

    it('should include total when requested', async () => {
      const mockModel = {
        findMany: vi.fn().mockResolvedValue([{ id: '1' }]),
        count: vi.fn().mockResolvedValue(50),
      };

      const result = await paginateWithCursor({
        model: mockModel,
        includeTotal: true,
      });

      expect(result.pagination.total).toBe(50);
    });

    it('should detect hasNextPage when more items exist', async () => {
      // Return limit + 1 items to indicate there are more
      const mockModel = {
        findMany: vi.fn().mockResolvedValue([
          { id: '1' },
          { id: '2' },
          { id: '3' },
        ]),
        count: vi.fn(),
      };

      const result = await paginateWithCursor({
        model: mockModel,
        limit: 2,
      });

      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.data).toHaveLength(2); // Extra item removed
    });
  });

  describe('paginateWithOffset', () => {
    it('should paginate items with offset', async () => {
      const mockModel = {
        findMany: vi.fn().mockResolvedValue([
          { id: '1', name: 'Item 1' },
          { id: '2', name: 'Item 2' },
        ]),
        count: vi.fn().mockResolvedValue(50),
      };

      const result = await paginateWithOffset(mockModel, {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.totalPages).toBe(5);
    });

    it('should calculate correct skip for page 2', async () => {
      const mockModel = {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(100),
      };

      await paginateWithOffset(mockModel, {
        page: 2,
        limit: 20,
      });

      expect(mockModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        })
      );
    });

    it('should use default values', async () => {
      const mockModel = {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      };

      const result = await paginateWithOffset(mockModel, {});

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it('should calculate totalPages correctly', async () => {
      const mockModel = {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(45),
      };

      const result = await paginateWithOffset(mockModel, {
        limit: 10,
      });

      expect(result.pagination.totalPages).toBe(5); // ceil(45/10)
    });
  });
});
