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

import deprecate, {
  registerDeprecation,
  getDeprecatedEndpoints,
  isEndpointDeprecated,
  DeprecationOptions,
} from '../../src/middleware/deprecation.middleware.js';
import { logger } from '../../src/config/logger.js';

// Helper to create mock request
function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    method: 'GET',
    path: '/api/v1/old-endpoint',
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' },
    ...overrides,
  };
}

// Helper to create mock response
function createMockResponse(): Partial<Response> & { headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value;
    }),
    getHeader: vi.fn((name: string) => headers[name]),
  } as any;
}

describe('Deprecation Middleware', () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('deprecate middleware', () => {
    it('sets Deprecation header to "true" by default', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const middleware = deprecate();

      middleware(req as Request, res as Response, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
      expect(mockNext).toHaveBeenCalled();
    });

    it('sets Deprecation header with specific date', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const middleware = deprecate({ deprecatedAt: '2024-01-15' });

      middleware(req as Request, res as Response, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith('Deprecation', '2024-01-15');
      expect(mockNext).toHaveBeenCalled();
    });

    it('sets Sunset header when sunset date provided', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const sunset = '2025-06-01';
      const middleware = deprecate({ sunset });

      middleware(req as Request, res as Response, mockNext);

      const sunsetDate = new Date(sunset);
      expect(res.setHeader).toHaveBeenCalledWith('Sunset', sunsetDate.toUTCString());
      expect(mockNext).toHaveBeenCalled();
    });

    it('sets Link header when link provided', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const middleware = deprecate({ link: '/api/v2/new-endpoint' });

      middleware(req as Request, res as Response, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith('Link', '</api/v2/new-endpoint>; rel="deprecation"');
      expect(mockNext).toHaveBeenCalled();
    });

    it('appends to existing Link header', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      res.headers['Link'] = '<https://docs.example.com>; rel="help"';
      const middleware = deprecate({ link: '/api/v2/new-endpoint' });

      middleware(req as Request, res as Response, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Link',
        '<https://docs.example.com>; rel="help", </api/v2/new-endpoint>; rel="deprecation"'
      );
    });

    it('sets X-Deprecation-Notice header when message provided', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const message = 'Use /api/v2/new-endpoint instead';
      const middleware = deprecate({ message });

      middleware(req as Request, res as Response, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith('X-Deprecation-Notice', message);
      expect(mockNext).toHaveBeenCalled();
    });

    it('logs usage when logUsage is true', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const middleware = deprecate({ logUsage: true, sunset: '2025-06-01' });

      middleware(req as Request, res as Response, mockNext);

      expect(logger.warn).toHaveBeenCalledWith('Deprecated endpoint accessed', {
        method: 'GET',
        path: '/api/v1/old-endpoint',
        sunset: '2025-06-01',
        userAgent: 'test-agent',
        ip: '127.0.0.1',
      });
    });

    it('does not log when logUsage is false', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const middleware = deprecate({ logUsage: false });

      middleware(req as Request, res as Response, mockNext);

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('sets all headers with full options', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const options: DeprecationOptions = {
        deprecatedAt: '2024-01-15',
        sunset: '2025-06-01',
        link: '/api/v2/new-endpoint',
        message: 'This endpoint is deprecated',
        logUsage: false,
      };
      const middleware = deprecate(options);

      middleware(req as Request, res as Response, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith('Deprecation', '2024-01-15');
      expect(res.setHeader).toHaveBeenCalledWith('Sunset', new Date('2025-06-01').toUTCString());
      expect(res.setHeader).toHaveBeenCalledWith('Link', '</api/v2/new-endpoint>; rel="deprecation"');
      expect(res.setHeader).toHaveBeenCalledWith('X-Deprecation-Notice', 'This endpoint is deprecated');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('registerDeprecation', () => {
    it('registers a deprecated endpoint', () => {
      const endpoint = {
        method: 'GET',
        path: '/api/v1/legacy',
        deprecatedAt: '2024-01-01',
        sunset: '2025-01-01',
        replacement: '/api/v2/new',
        reason: 'Replaced with improved API',
      };

      registerDeprecation(endpoint);

      const endpoints = getDeprecatedEndpoints();
      expect(endpoints).toContainEqual(endpoint);
    });
  });

  describe('getDeprecatedEndpoints', () => {
    it('returns a copy of deprecated endpoints', () => {
      const endpoints1 = getDeprecatedEndpoints();
      const endpoints2 = getDeprecatedEndpoints();

      // Should return different array instances
      expect(endpoints1).not.toBe(endpoints2);
      expect(endpoints1).toEqual(endpoints2);
    });
  });

  describe('isEndpointDeprecated', () => {
    it('returns true for registered deprecated endpoint', () => {
      registerDeprecation({
        method: 'POST',
        path: '/api/v1/deprecated-post',
        deprecatedAt: '2024-01-01',
      });

      expect(isEndpointDeprecated('POST', '/api/v1/deprecated-post')).toBe(true);
    });

    it('matches method case-insensitively', () => {
      registerDeprecation({
        method: 'DELETE',
        path: '/api/v1/deprecated-delete',
        deprecatedAt: '2024-01-01',
      });

      expect(isEndpointDeprecated('delete', '/api/v1/deprecated-delete')).toBe(true);
      expect(isEndpointDeprecated('DELETE', '/api/v1/deprecated-delete')).toBe(true);
    });

    it('returns false for non-deprecated endpoint', () => {
      expect(isEndpointDeprecated('GET', '/api/v1/non-existent')).toBe(false);
    });

    it('returns false when path does not match', () => {
      registerDeprecation({
        method: 'GET',
        path: '/api/v1/specific-path',
        deprecatedAt: '2024-01-01',
      });

      expect(isEndpointDeprecated('GET', '/api/v1/different-path')).toBe(false);
    });
  });
});
