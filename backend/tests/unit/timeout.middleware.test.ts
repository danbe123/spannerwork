import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock logger before imports
vi.mock('../../src/config/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { timeout, requestTimeout, extendedTimeout } from '../../src/middleware/timeout.middleware.js';
import { logger } from '../../src/config/logger.js';

// Helper to create mock request
function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    method: 'GET',
    path: '/api/v1/test',
    ...overrides,
  };
}

// Helper to create mock response with event emitter behavior
function createMockResponse(): Partial<Response> & {
  events: Record<string, (() => void)[]>;
  emit: (event: string) => void;
  headersSent: boolean;
} {
  const events: Record<string, (() => void)[]> = {};
  return {
    events,
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    on: vi.fn((event: string, callback: () => void) => {
      if (!events[event]) events[event] = [];
      events[event].push(callback);
    }),
    emit: (event: string) => {
      events[event]?.forEach(cb => cb());
    },
  } as any;
}

describe('Timeout Middleware', () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe('timeout factory', () => {
    it('returns middleware function', () => {
      const middleware = timeout(5000);
      expect(typeof middleware).toBe('function');
    });

    it('calls next immediately', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const middleware = timeout(5000);

      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('returns 503 after timeout expires', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const middleware = timeout(1000);

      middleware(req as Request, res as Response, mockNext);

      // Fast-forward past timeout
      vi.advanceTimersByTime(1001);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Service Unavailable',
        message: 'Request timeout - the server took too long to respond',
        code: 'REQUEST_TIMEOUT',
      });
    });

    it('logs warning on timeout', () => {
      const req = createMockRequest({ method: 'POST', path: '/api/v1/slow' });
      const res = createMockResponse();
      const middleware = timeout(1000);

      middleware(req as Request, res as Response, mockNext);
      vi.advanceTimersByTime(1001);

      expect(logger.warn).toHaveBeenCalledWith(
        'Request timeout: POST /api/v1/slow exceeded 1000ms'
      );
    });

    it('does not send response if headers already sent', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      res.headersSent = true;
      const middleware = timeout(1000);

      middleware(req as Request, res as Response, mockNext);
      vi.advanceTimersByTime(1001);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('clears timeout when response finishes', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const middleware = timeout(1000);

      middleware(req as Request, res as Response, mockNext);

      // Simulate response finish
      res.emit('finish');

      // Fast-forward past timeout
      vi.advanceTimersByTime(1001);

      // Should not have sent timeout response
      expect(res.status).not.toHaveBeenCalled();
    });

    it('clears timeout when connection closes', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const middleware = timeout(1000);

      middleware(req as Request, res as Response, mockNext);

      // Simulate connection close
      res.emit('close');

      // Fast-forward past timeout
      vi.advanceTimersByTime(1001);

      // Should not have sent timeout response
      expect(res.status).not.toHaveBeenCalled();
    });

    it('uses extended timeout for upload routes', () => {
      const req = createMockRequest({ path: '/api/v1/upload/file' });
      const res = createMockResponse();
      const middleware = timeout(1000);

      middleware(req as Request, res as Response, mockNext);

      // Fast-forward past default timeout but not extended
      vi.advanceTimersByTime(30001);
      expect(res.status).not.toHaveBeenCalled();

      // Fast-forward to extended timeout (2 minutes)
      vi.advanceTimersByTime(90000);
      expect(res.status).toHaveBeenCalledWith(503);
    });

    it('uses extended timeout for admin export routes', () => {
      const req = createMockRequest({ path: '/api/v1/admin/export/data' });
      const res = createMockResponse();
      const middleware = timeout(1000);

      middleware(req as Request, res as Response, mockNext);

      // Fast-forward past default timeout
      vi.advanceTimersByTime(30001);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('uses extended timeout for user data export routes', () => {
      const req = createMockRequest({ path: '/api/v1/users/export-data' });
      const res = createMockResponse();
      const middleware = timeout(1000);

      middleware(req as Request, res as Response, mockNext);

      // Fast-forward past default timeout
      vi.advanceTimersByTime(30001);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('requestTimeout', () => {
    it('is configured with 30 second default', () => {
      expect(requestTimeout).toBeDefined();
      expect(typeof requestTimeout).toBe('function');
    });

    it('times out after 30 seconds', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      requestTimeout(req as Request, res as Response, mockNext);

      vi.advanceTimersByTime(30001);

      expect(res.status).toHaveBeenCalledWith(503);
    });
  });

  describe('extendedTimeout', () => {
    it('is configured with 2 minute timeout', () => {
      expect(extendedTimeout).toBeDefined();
      expect(typeof extendedTimeout).toBe('function');
    });

    it('does not timeout before 2 minutes', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      extendedTimeout(req as Request, res as Response, mockNext);

      vi.advanceTimersByTime(119000);

      expect(res.status).not.toHaveBeenCalled();
    });

    it('times out after 2 minutes', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      extendedTimeout(req as Request, res as Response, mockNext);

      vi.advanceTimersByTime(120001);

      expect(res.status).toHaveBeenCalledWith(503);
    });
  });
});
