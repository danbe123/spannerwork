import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodIssue } from 'zod';

// Mock dependencies before imports
vi.mock('../../src/config/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    SENTRY_DSN: null,
  },
}));

vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
}));

import { errorHandler, notFoundHandler, asyncHandler } from '../../src/middleware/error.middleware.js';
import { ValidationError, TooManyRequestsError, ExternalServiceError } from '../../src/utils/errors.js';
import { logger } from '../../src/config/logger.js';

// Helper to create mock request
function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    method: 'GET',
    path: '/api/v1/test',
    ...overrides,
  };
}

// Helper to create mock response
function createMockResponse(): Partial<Response> & { headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  return {
    headers,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    set: vi.fn((name: string, value: string) => {
      headers[name] = value;
      return this;
    }),
  } as any;
}

describe('Error Middleware', () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('errorHandler', () => {
    it('handles CSRF token errors with 403', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const error: Error & { code?: string } = new Error('Invalid CSRF token');
      error.code = 'EBADCSRFTOKEN';

      errorHandler(error, req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Invalid CSRF token',
        code: 'EBADCSRFTOKEN',
      });
    });

    it('handles ZodError validation errors', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const issues: ZodIssue[] = [
        { path: ['email'], message: 'Invalid email', code: 'custom' },
        { path: ['name'], message: 'Required', code: 'custom' },
      ];
      const error = new ZodError(issues);

      errorHandler(error, req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Validation Error',
        code: 'VALIDATION_ERROR',
      }));
    });

    it('handles ValidationError with field errors', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const error = new ValidationError('Invalid input', {
        email: ['Invalid format'],
        password: ['Too short'],
      });

      errorHandler(error, req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Bad Request',
        message: 'Invalid input',
        code: 'VALIDATION_ERROR',
        errors: {
          email: ['Invalid format'],
          password: ['Too short'],
        },
      }));
    });

    it('handles TooManyRequestsError with retryAfter header', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const error = new TooManyRequestsError('Rate limit exceeded', 60);

      errorHandler(error, req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.set).toHaveBeenCalledWith('Retry-After', '60');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Too Many Requests',
        retryAfter: 60,
      }));
    });

    it('handles ExternalServiceError with service name', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      // ExternalServiceError takes (serviceName, message)
      const error = new ExternalServiceError('payment-gateway', 'Service unavailable');

      errorHandler(error, req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Bad Gateway',
        service: 'payment-gateway',
      }));
    });

    it('logs operational errors as warnings', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const error = new ValidationError('Bad input');

      errorHandler(error, req as Request, res as Response, mockNext);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Operational error'),
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          statusCode: 400,
        })
      );
    });

    it('logs non-operational errors as errors', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const error = new Error('Unexpected error');

      errorHandler(error, req as Request, res as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Unhandled error:',
        expect.objectContaining({
          error: 'Unexpected error',
        })
      );
    });

    it('returns generic 500 for non-operational errors', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const error = new Error('Internal error');

      errorHandler(error, req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Internal Server Error',
      }));
    });
  });

  describe('notFoundHandler', () => {
    it('returns 404 with route information', () => {
      const req = createMockRequest({
        method: 'GET',
        path: '/api/v1/nonexistent',
      });
      const res = createMockResponse();

      notFoundHandler(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Route GET /api/v1/nonexistent not found',
        code: 'ROUTE_NOT_FOUND',
      });
    });

    it('includes method in error message', () => {
      const req = createMockRequest({
        method: 'POST',
        path: '/api/v1/missing',
      });
      const res = createMockResponse();

      notFoundHandler(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Route POST /api/v1/missing not found',
      }));
    });
  });

  describe('asyncHandler', () => {
    it('wraps async function and catches errors', async () => {
      const error = new Error('Async error');
      const asyncFn = vi.fn().mockRejectedValue(error);
      const req = createMockRequest();
      const res = createMockResponse();

      const wrapped = asyncHandler(asyncFn);
      await wrapped(req as Request, res as Response, mockNext);

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('allows successful async functions to complete', async () => {
      const asyncFn = vi.fn().mockResolvedValue('success');
      const req = createMockRequest();
      const res = createMockResponse();

      const wrapped = asyncHandler(asyncFn);
      await wrapped(req as Request, res as Response, mockNext);

      expect(asyncFn).toHaveBeenCalledWith(req, res, mockNext);
    });

    it('passes request, response, and next to handler', async () => {
      const asyncFn = vi.fn().mockResolvedValue(undefined);
      const req = createMockRequest();
      const res = createMockResponse();

      const wrapped = asyncHandler(asyncFn);
      await wrapped(req as Request, res as Response, mockNext);

      expect(asyncFn).toHaveBeenCalledWith(req, res, mockNext);
    });
  });
});
