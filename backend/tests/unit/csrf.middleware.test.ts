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

vi.mock('csrf-csrf', () => ({
  doubleCsrf: () => ({
    doubleCsrfProtection: mockDoubleCsrfProtection,
    generateToken: mockDoubleCsrfGenerateToken,
  }),
}));

import {
  generateCsrfToken,
  getCsrfToken,
  verifyCsrfToken,
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
});
