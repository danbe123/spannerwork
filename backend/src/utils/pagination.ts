/**
 * Cursor-Based Pagination Utilities
 * 
 * Provides more efficient pagination for large datasets by using
 * cursor-based pagination instead of offset-based pagination.
 * 
 * Benefits:
 * - O(1) query time regardless of page depth
 * - Consistent results when data changes between requests
 * - No "phantom reads" or missing items
 * 
 * Usage:
 * ```typescript
 * const result = await paginateWithCursor({
 *   model: prisma.tool,
 *   where: { available: true },
 *   orderBy: { createdDate: 'desc' },
 *   cursor,
 *   limit: 20,
 * });
 * ```
 */

import { z } from 'zod';

// Cursor direction
export type CursorDirection = 'forward' | 'backward';

// Cursor pagination request
export interface CursorPaginationRequest {
  cursor?: string | null;
  limit?: number;
  direction?: CursorDirection;
}

// Cursor pagination response
export interface CursorPaginationResponse<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    prevCursor: string | null;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    total?: number; // Optional, expensive to compute
  };
}

// Default configuration
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Encode a cursor from an ID
 */
export function encodeCursor(id: string): string {
  return Buffer.from(id).toString('base64url');
}

/**
 * Decode a cursor to an ID
 */
export function decodeCursor(cursor: string): string | null {
  try {
    return Buffer.from(cursor, 'base64url').toString('utf-8');
  } catch {
    return null;
  }
}

/**
 * Zod schema for cursor pagination query parameters
 */
export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .default(String(DEFAULT_LIMIT))
    .transform((val) => Math.min(Math.max(parseInt(val, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT)),
  direction: z.enum(['forward', 'backward']).optional().default('forward'),
});

/**
 * Options for paginated query
 */
export interface PaginateOptions<T, WhereInput, OrderByInput> {
  model: {
    findMany: (args: {
      where?: WhereInput;
      orderBy?: OrderByInput;
      take?: number;
      skip?: number;
      cursor?: { id: string };
    }) => Promise<T[]>;
    count: (args: { where?: WhereInput }) => Promise<number>;
  };
  where?: WhereInput;
  orderBy?: OrderByInput;
  cursor?: string | null;
  limit?: number;
  direction?: CursorDirection;
  includeTotal?: boolean;
}

/**
 * Execute a cursor-paginated query
 */
export async function paginateWithCursor<T extends { id: string }, WhereInput, OrderByInput>(
  options: PaginateOptions<T, WhereInput, OrderByInput>
): Promise<CursorPaginationResponse<T>> {
  const {
    model,
    where,
    orderBy,
    cursor,
    limit = DEFAULT_LIMIT,
    direction = 'forward',
    includeTotal = false,
  } = options;

  // Decode cursor if provided
  const cursorId = cursor ? decodeCursor(cursor) : null;

  // Calculate take with one extra to check for more pages
  const take = limit + 1;
  const isBackward = direction === 'backward';

  // Build query
  const queryOptions: {
    where?: WhereInput;
    orderBy?: OrderByInput;
    take: number;
    skip?: number;
    cursor?: { id: string };
  } = {
    where,
    orderBy,
    take: isBackward ? -take : take,
  };

  // Add cursor if provided
  if (cursorId) {
    queryOptions.cursor = { id: cursorId };
    queryOptions.skip = 1; // Skip the cursor item itself
  }

  // Execute query
  const items = await model.findMany(queryOptions);

  // Handle backward pagination - reverse results
  if (isBackward) {
    items.reverse();
  }

  // Check if there are more pages
  const hasMore = items.length > limit;
  if (hasMore) {
    items.pop(); // Remove the extra item
  }

  // Calculate cursors
  const firstItem = items[0];
  const lastItem = items[items.length - 1];

  const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.id) : null;
  const prevCursor = cursorId && firstItem ? encodeCursor(firstItem.id) : null;

  // Optionally get total count (expensive for large datasets)
  let total: number | undefined;
  if (includeTotal) {
    total = await model.count({ where });
  }

  return {
    data: items,
    pagination: {
      nextCursor,
      prevCursor,
      hasNextPage: isBackward ? !!cursorId : hasMore,
      hasPrevPage: isBackward ? hasMore : !!cursorId,
      total,
    },
  };
}

/**
 * Legacy offset-based pagination for backwards compatibility
 */
export interface OffsetPaginationRequest {
  page?: number;
  limit?: number;
}

export interface OffsetPaginationResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const offsetPaginationSchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => Math.max(parseInt(val, 10) || 1, 1)),
  limit: z
    .string()
    .optional()
    .default(String(DEFAULT_LIMIT))
    .transform((val) => Math.min(Math.max(parseInt(val, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT)),
});

/**
 * Execute an offset-paginated query (legacy support)
 */
export async function paginateWithOffset<T, WhereInput, OrderByInput>(
  model: {
    findMany: (args: {
      where?: WhereInput;
      orderBy?: OrderByInput;
      take?: number;
      skip?: number;
    }) => Promise<T[]>;
    count: (args: { where?: WhereInput }) => Promise<number>;
  },
  options: {
    where?: WhereInput;
    orderBy?: OrderByInput;
    page?: number;
    limit?: number;
  }
): Promise<OffsetPaginationResponse<T>> {
  const { where, orderBy, page = 1, limit = DEFAULT_LIMIT } = options;

  const [data, total] = await Promise.all([
    model.findMany({
      where,
      orderBy,
      take: limit,
      skip: (page - 1) * limit,
    }),
    model.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export default {
  encodeCursor,
  decodeCursor,
  cursorPaginationSchema,
  offsetPaginationSchema,
  paginateWithCursor,
  paginateWithOffset,
};
