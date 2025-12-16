import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock dependencies before imports
vi.mock('../../src/config/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../src/config/env.js', () => ({
  default: {
    NODE_ENV: 'test',
    CSRF_SECRET: 'test-csrf-secret-32-characters-long',
  },
  env: {
    NODE_ENV: 'test',
    CSRF_SECRET: 'test-csrf-secret-32-characters-long',
  },
}));

vi.mock('../../src/config/cookie.js', () => ({
  COOKIE_NAMES: {
    SESSION: 'test-session',
  },
}));

// Mock csrf-csrf module - use vi.hoisted to avoid hoisting issues
const mockDoubleCsrfGenerateToken = vi.hoisted(() => vi.fn().mockReturnValue('mock-csrf-token'));
const mockDoubleCsrfProtection = vi.hoisted(() => vi.fn((req: any, res: any, next: any) => next()));
const mockValidateRequest = vi.hoisted(() => vi.fn().mockReturnValue(true));

vi.mock('csrf-csrf', () => ({
  doubleCsrf: () => ({
    doubleCsrfProtection: mockDoubleCsrfProtection,
    generateToken: mockDoubleCsrfGenerateToken,
    validateRequest: mockValidateRequest,
  }),
}));

import {
  generateCsrfToken,
  getCsrfToken,
  verifyCsrfToken,
  optionalCsrfToken,
} from '../../src/middleware/csrf.middleware.js';

// Helper to create mock request - use any to avoid Express type complexity in tests
function createMockRequest(overrides: Record<string, any> = {}): any {
  return {
    cookies: {},
    headers: {},
    method: 'POST',
    path: '/test',
    ip: '127.0.0.1',
    sessionId: undefined,
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  };
}

// Helper to create mock response
function createMockResponse(): Partial<Response> & { locals: Record<string, any> } {
  return {
    locals: {},
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
  } as any;
}

describe('CSRF Middleware', () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
    // Re-configure mocks after clearAllMocks
    mockDoubleCsrfGenerateToken.mockReturnValue('mock-csrf-token');
    mockDoubleCsrfProtection.mockImplementation((req: any, res: any, next: any) => next());
    mockValidateRequest.mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('generateCsrfToken', () => {
    it('generates and stores CSRF token in res.locals', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await generateCsrfToken(req as Request, res as Response, mockNext);

      expect(mockDoubleCsrfGenerateToken).toHaveBeenCalledWith(req, res);
      expect(res.locals.csrfToken).toBe('mock-csrf-token');
      expect(mockNext).toHaveBeenCalled();
    });

    it('passes errors to next on token generation failure', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const error = new Error('Token generation failed');

      mockDoubleCsrfGenerateToken.mockImplementationOnce(() => {
        throw error;
      });

      await generateCsrfToken(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getCsrfToken', () => {
    it('returns CSRF token in JSON response', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await getCsrfToken(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        csrfToken: 'mock-csrf-token',
      });
    });

    it('calls generateToken with overwrite=true', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await getCsrfToken(req as Request, res as Response);

      expect(mockDoubleCsrfGenerateToken).toHaveBeenCalledWith(req, res, true);
    });

    it('returns 500 on error', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      mockDoubleCsrfGenerateToken.mockImplementationOnce(() => {
        throw new Error('Failed');
      });

      await getCsrfToken(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Failed to generate CSRF token',
      });
    });
  });

  describe('verifyCsrfToken', () => {
    it('delegates to doubleCsrfProtection', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await verifyCsrfToken(req as Request, res as Response, mockNext);

      expect(mockDoubleCsrfProtection).toHaveBeenCalledWith(req, res, mockNext);
    });
  });

  describe('optionalCsrfToken', () => {
    it('skips validation for GET requests', async () => {
      const req = createMockRequest({ method: 'GET' });
      const res = createMockResponse();

      await optionalCsrfToken(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockValidateRequest).not.toHaveBeenCalled();
    });

    it('skips validation for HEAD requests', async () => {
      const req = createMockRequest({ method: 'HEAD' });
      const res = createMockResponse();

      await optionalCsrfToken(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockValidateRequest).not.toHaveBeenCalled();
    });

    it('skips validation for OPTIONS requests', async () => {
      const req = createMockRequest({ method: 'OPTIONS' });
      const res = createMockResponse();

      await optionalCsrfToken(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockValidateRequest).not.toHaveBeenCalled();
    });

    it('validates token for POST requests but continues on invalid', async () => {
      const req = createMockRequest({ method: 'POST' });
      const res = createMockResponse();

      mockValidateRequest.mockReturnValueOnce(false);

      await optionalCsrfToken(req as Request, res as Response, mockNext);

      expect(mockValidateRequest).toHaveBeenCalledWith(req);
      expect(mockNext).toHaveBeenCalled(); // Should still call next
    });

    it('validates token for PUT requests', async () => {
      const req = createMockRequest({ method: 'PUT' });
      const res = createMockResponse();

      mockValidateRequest.mockReturnValueOnce(true);

      await optionalCsrfToken(req as Request, res as Response, mockNext);

      expect(mockValidateRequest).toHaveBeenCalledWith(req);
      expect(mockNext).toHaveBeenCalled();
    });

    it('continues on validation error', async () => {
      const req = createMockRequest({ method: 'POST' });
      const res = createMockResponse();

      mockValidateRequest.mockImplementationOnce(() => {
        throw new Error('Validation error');
      });

      await optionalCsrfToken(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
