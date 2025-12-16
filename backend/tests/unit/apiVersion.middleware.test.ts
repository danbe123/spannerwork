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

import {
  apiVersionHeaders,
  validateApiVersion,
  getDeprecationWarning,
  API_VERSIONS,
  LATEST_VERSION,
  SUPPORTED_VERSIONS,
} from '../../src/middleware/apiVersion.middleware.js';

// Helper to create mock request
function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    path: '/api/v1/test',
    headers: {},
    query: {},
    ip: '127.0.0.1',
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
      return this;
    }),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
}

describe('API Version Middleware', () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('apiVersionHeaders', () => {
    it('sets version headers from URL path', () => {
      const req = createMockRequest({ path: '/api/v1/test' });
      const res = createMockResponse();

      apiVersionHeaders(req as Request, res as Response, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith('X-API-Version', '1');
      expect(res.setHeader).toHaveBeenCalledWith('X-API-Supported-Versions', SUPPORTED_VERSIONS.join(', '));
      expect(res.setHeader).toHaveBeenCalledWith('X-API-Latest-Version', LATEST_VERSION);
      expect((req as any).apiVersion).toBe('1');
      expect(mockNext).toHaveBeenCalled();
    });

    it('extracts version from header if path has no version', () => {
      const req = createMockRequest({
        path: '/api/test',
        headers: { 'x-api-version': '1' },
      });
      const res = createMockResponse();

      apiVersionHeaders(req as Request, res as Response, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith('X-API-Version', '1');
      expect((req as any).apiVersion).toBe('1');
      expect(mockNext).toHaveBeenCalled();
    });

    it('extracts version from query parameter', () => {
      const req = createMockRequest({
        path: '/api/test',
        headers: {},
        query: { api_version: '1' },
      });
      const res = createMockResponse();

      apiVersionHeaders(req as Request, res as Response, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith('X-API-Version', '1');
      expect((req as any).apiVersion).toBe('1');
      expect(mockNext).toHaveBeenCalled();
    });

    it('defaults to latest version when no version specified', () => {
      const req = createMockRequest({
        path: '/api/test',
        headers: {},
        query: {},
      });
      const res = createMockResponse();

      apiVersionHeaders(req as Request, res as Response, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith('X-API-Version', LATEST_VERSION);
      expect((req as any).apiVersion).toBe(LATEST_VERSION);
      expect(mockNext).toHaveBeenCalled();
    });

    it('prioritizes path version over header version', () => {
      const req = createMockRequest({
        path: '/api/v1/test',
        headers: { 'x-api-version': '2' },
      });
      const res = createMockResponse();

      apiVersionHeaders(req as Request, res as Response, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith('X-API-Version', '1');
      expect((req as any).apiVersion).toBe('1');
    });
  });

  describe('validateApiVersion', () => {
    it('allows supported versions in header', () => {
      const req = createMockRequest({
        headers: { 'x-api-version': '1' },
      });
      const res = createMockResponse();

      validateApiVersion(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows supported versions in query', () => {
      const req = createMockRequest({
        query: { api_version: '1' },
      });
      const res = createMockResponse();

      validateApiVersion(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns 400 for unsupported version in header', () => {
      const req = createMockRequest({
        headers: { 'x-api-version': '999' },
      });
      const res = createMockResponse();

      validateApiVersion(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unsupported API Version',
        message: 'API version 999 is not supported',
        supportedVersions: SUPPORTED_VERSIONS,
        latestVersion: LATEST_VERSION,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 400 for unsupported version in query', () => {
      const req = createMockRequest({
        query: { api_version: '0' },
      });
      const res = createMockResponse();

      validateApiVersion(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Unsupported API Version',
      }));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('passes through when no explicit version requested', () => {
      const req = createMockRequest({
        headers: {},
        query: {},
      });
      const res = createMockResponse();

      validateApiVersion(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('getDeprecationWarning', () => {
    it('returns null for current version', () => {
      const warning = getDeprecationWarning('1');
      expect(warning).toBeNull();
    });

    it('returns null for unknown version', () => {
      const warning = getDeprecationWarning('999');
      expect(warning).toBeNull();
    });
  });

  describe('exported constants', () => {
    it('exports valid API_VERSIONS configuration', () => {
      expect(API_VERSIONS).toBeDefined();
      expect(API_VERSIONS.v1).toBeDefined();
      expect(API_VERSIONS.v1.version).toBe('1');
      expect(API_VERSIONS.v1.status).toBe('current');
    });

    it('exports LATEST_VERSION', () => {
      expect(LATEST_VERSION).toBe('1');
    });

    it('exports SUPPORTED_VERSIONS array', () => {
      expect(SUPPORTED_VERSIONS).toBeInstanceOf(Array);
      expect(SUPPORTED_VERSIONS).toContain('1');
    });
  });
});
