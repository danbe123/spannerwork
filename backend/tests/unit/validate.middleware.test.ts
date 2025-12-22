import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z, ZodError as _ZodError } from 'zod';
import {
  validate,
  validateBody,
  validateQuery,
  validateParams,
  validateRequest,
} from '../../src/middleware/validate.middleware.js';

// Helper to create mock request
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as Request;
}

// Helper to create mock response
function createMockResponse(): Response {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as Response;
}

describe('Validation Middleware', () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
  });

  describe('validate', () => {
    const schema = z.object({
      body: z.object({
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Invalid email'),
      }),
      query: z.object({}),
      params: z.object({}),
    });

    it('calls next() on valid data', async () => {
      const req = createMockRequest({
        body: { name: 'John', email: 'john@example.com' },
      });
      const res = createMockResponse();

      const middleware = validate(schema);
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns 400 on invalid body data', async () => {
      const req = createMockRequest({
        body: { name: '', email: 'not-an-email' },
      });
      const res = createMockResponse();

      const middleware = validate(schema);
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: expect.any(Array),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns validation error details', async () => {
      const req = createMockRequest({
        body: { name: '', email: 'invalid' },
      });
      const res = createMockResponse();

      const middleware = validate(schema);
      await middleware(req, res, mockNext);

      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(jsonCall.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: expect.stringContaining('name') }),
          expect.objectContaining({ field: expect.stringContaining('email') }),
        ])
      );
    });

    it('passes non-Zod errors to next', async () => {
      const errorSchema = {
        parseAsync: vi.fn().mockRejectedValue(new Error('Unexpected error')),
      };

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = validate(errorSchema as any);
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('validateBody', () => {
    const bodySchema = z.object({
      title: z.string().min(1, 'Title is required'),
      price: z.number().positive('Price must be positive'),
    });

    it('calls next() and sets parsed body on valid data', async () => {
      const req = createMockRequest({
        body: { title: 'Power Drill', price: 25 },
      });
      const res = createMockResponse();

      const middleware = validateBody(bodySchema);
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(req.body).toEqual({ title: 'Power Drill', price: 25 });
    });

    it('returns 400 with formatted errors on invalid data', async () => {
      const req = createMockRequest({
        body: { title: '', price: -5 },
      });
      const res = createMockResponse();

      const middleware = validateBody(bodySchema);
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation Error',
          details: expect.any(Array),
        })
      );
    });

    it('creates user-friendly message for required fields', async () => {
      const req = createMockRequest({
        body: {},
      });
      const res = createMockResponse();

      const simpleSchema = z.object({
        name: z.string({ required_error: 'Required' }),
      });

      const middleware = validateBody(simpleSchema);
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('handles single validation error with summary message', async () => {
      const req = createMockRequest({
        body: { title: 'Valid', price: -1 },
      });
      const res = createMockResponse();

      const middleware = validateBody(bodySchema);
      await middleware(req, res, mockNext);

      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      // Single error should have that error as the message
      expect(jsonCall.message).toBeDefined();
    });

    it('passes non-Zod errors to next', async () => {
      const errorSchema = {
        parseAsync: vi.fn().mockRejectedValue(new Error('Unexpected')),
      };

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = validateBody(errorSchema as any);
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('validateQuery', () => {
    const querySchema = z.object({
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    });

    it('calls next() and sets parsed query on valid data', async () => {
      const req = createMockRequest({
        query: { page: '2', limit: '20' },
      });
      const res = createMockResponse();

      const middleware = validateQuery(querySchema);
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(req.query).toEqual({ page: 2, limit: 20 });
    });

    it('returns 400 on invalid query params', async () => {
      const strictSchema = z.object({
        page: z.coerce.number().int().positive(),
      });

      const req = createMockRequest({
        query: { page: 'invalid' },
      });
      const res = createMockResponse();

      const middleware = validateQuery(strictSchema);
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation Error',
          message: 'Invalid query parameters',
        })
      );
    });

    it('passes non-Zod errors to next', async () => {
      const errorSchema = {
        parseAsync: vi.fn().mockRejectedValue(new Error('Unexpected')),
      };

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = validateQuery(errorSchema as any);
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('validateParams', () => {
    const paramsSchema = z.object({
      id: z.string().cuid('Invalid ID format'),
    });

    it('calls next() and sets parsed params on valid data', async () => {
      const validCuid = 'clh3au7v80000vn1h7qn5f9x2';
      const req = createMockRequest({
        params: { id: validCuid },
      });
      const res = createMockResponse();

      const middleware = validateParams(paramsSchema);
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(req.params).toEqual({ id: validCuid });
    });

    it('returns 400 on invalid params', async () => {
      const req = createMockRequest({
        params: { id: 'invalid-id' },
      });
      const res = createMockResponse();

      const middleware = validateParams(paramsSchema);
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation Error',
          message: 'Invalid route parameters',
        })
      );
    });

    it('passes non-Zod errors to next', async () => {
      const errorSchema = {
        parseAsync: vi.fn().mockRejectedValue(new Error('Unexpected')),
      };

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = validateParams(errorSchema as any);
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('validateRequest', () => {
    const schemas = {
      body: z.object({
        name: z.string().min(1),
      }),
      query: z.object({
        include: z.string().optional(),
      }),
      params: z.object({
        id: z.string().min(1),
      }),
    };

    it('validates all parts when all schemas provided', async () => {
      const req = createMockRequest({
        body: { name: 'Test' },
        query: { include: 'details' },
        params: { id: 'abc123' },
      });
      const res = createMockResponse();

      const middleware = validateRequest(schemas);
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(req.body).toEqual({ name: 'Test' });
      expect(req.query).toEqual({ include: 'details' });
      expect(req.params).toEqual({ id: 'abc123' });
    });

    it('validates only body when only body schema provided', async () => {
      const req = createMockRequest({
        body: { name: 'Test' },
        query: { anyKey: 'anyValue' },
      });
      const res = createMockResponse();

      const middleware = validateRequest({ body: schemas.body });
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(req.body).toEqual({ name: 'Test' });
    });

    it('validates only query when only query schema provided', async () => {
      const req = createMockRequest({
        body: { anyKey: 'anyValue' },
        query: { include: 'details' },
      });
      const res = createMockResponse();

      const middleware = validateRequest({ query: schemas.query });
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('validates only params when only params schema provided', async () => {
      const req = createMockRequest({
        params: { id: 'abc123' },
      });
      const res = createMockResponse();

      const middleware = validateRequest({ params: schemas.params });
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('returns 400 when body validation fails', async () => {
      const req = createMockRequest({
        body: { name: '' },
        params: { id: 'abc123' },
      });
      const res = createMockResponse();

      const middleware = validateRequest(schemas);
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when params validation fails', async () => {
      const req = createMockRequest({
        body: { name: 'Test' },
        params: { id: '' },
      });
      const res = createMockResponse();

      const middleware = validateRequest(schemas);
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('validates params before query before body', async () => {
      const req = createMockRequest({
        body: { name: '' }, // invalid
        query: {},
        params: { id: '' }, // invalid - should fail first
      });
      const res = createMockResponse();

      const middleware = validateRequest(schemas);
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      // First error should be from params
      expect(jsonCall.details[0].field).toBe('id');
    });

    it('passes non-Zod errors to next', async () => {
      const errorSchemas = {
        body: {
          parseAsync: vi.fn().mockRejectedValue(new Error('Unexpected')),
        },
      };

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = validateRequest(errorSchemas as any);
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
