import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock uuid - use vi.hoisted to avoid hoisting issues
const mockUuidV4 = vi.hoisted(() => vi.fn());
vi.mock('uuid', () => ({
  v4: mockUuidV4,
}));

// Mock logger and requestContext - use vi.hoisted to avoid hoisting issues
const mockRun = vi.hoisted(() => vi.fn((store: any, callback: () => void) => callback()));
const mockGetStore = vi.hoisted(() => vi.fn());

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  requestContext: {
    run: mockRun,
    getStore: mockGetStore,
  },
}));

import {
  requestIdMiddleware,
  setContextUserId,
  getRequestId,
} from '../../src/middleware/requestId.middleware.js';

// Helper to create mock request
function createMockRequest(overrides: Record<string, any> = {}): Partial<Request> {
  return {
    headers: {},
    requestId: undefined,
    ...overrides,
  } as Partial<Request>;
}

// Helper to create mock response
function createMockResponse(): Partial<Response> {
  return {
    setHeader: vi.fn().mockReturnThis(),
  } as any;
}

describe('Request ID Middleware', () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
    // Re-configure mocks after clearAllMocks
    mockUuidV4.mockReturnValue('mock-uuid-1234');
    mockRun.mockImplementation((store: any, callback: () => void) => callback());
    mockGetStore.mockReturnValue({ requestId: 'test-id' });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('requestIdMiddleware', () => {
    it('returns middleware function', () => {
      const middleware = requestIdMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('generates UUID when no X-Request-ID header present', () => {
      const req = createMockRequest({ headers: {} });
      const res = createMockResponse();
      const middleware = requestIdMiddleware();

      middleware(req as Request, res as Response, mockNext);

      expect((req as any).requestId).toBe('mock-uuid-1234');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'mock-uuid-1234');
    });

    it('uses existing X-Request-ID from header', () => {
      const req = createMockRequest({
        headers: { 'x-request-id': 'existing-request-id' },
      });
      const res = createMockResponse();
      const middleware = requestIdMiddleware();

      middleware(req as Request, res as Response, mockNext);

      expect((req as any).requestId).toBe('existing-request-id');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'existing-request-id');
    });

    it('sets X-Request-ID response header', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const middleware = requestIdMiddleware();

      middleware(req as Request, res as Response, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', expect.any(String));
    });

    it('runs next in AsyncLocalStorage context', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const middleware = requestIdMiddleware();

      middleware(req as Request, res as Response, mockNext);

      expect(mockRun).toHaveBeenCalledWith(
        { requestId: 'mock-uuid-1234' },
        expect.any(Function)
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('attaches requestId to request object', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const middleware = requestIdMiddleware();

      middleware(req as Request, res as Response, mockNext);

      expect(req).toHaveProperty('requestId');
      expect((req as any).requestId).toBeTruthy();
    });
  });

  describe('setContextUserId', () => {
    it('sets userId in request context store', () => {
      const store = { requestId: 'test-id', userId: undefined as string | undefined };
      mockGetStore.mockReturnValueOnce(store);

      setContextUserId('user-123');

      expect(mockGetStore).toHaveBeenCalled();
      expect(store.userId).toBe('user-123');
    });

    it('handles missing store gracefully', () => {
      mockGetStore.mockReturnValueOnce(undefined);

      expect(() => setContextUserId('user-123')).not.toThrow();
    });
  });

  describe('getRequestId', () => {
    it('returns requestId from request object', () => {
      const req = createMockRequest({ requestId: 'test-request-id' });

      const result = getRequestId(req as Request);

      expect(result).toBe('test-request-id');
    });

    it('returns "unknown" when no requestId set', () => {
      const req = createMockRequest({ requestId: undefined });

      const result = getRequestId(req as Request);

      expect(result).toBe('unknown');
    });

    it('returns "unknown" for empty requestId', () => {
      const req = createMockRequest({ requestId: '' });

      const result = getRequestId(req as Request);

      expect(result).toBe('unknown');
    });
  });
});
