import { describe, it, expect } from 'vitest';
import {
  AppError,
  BadRequestError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../../src/utils/errors.js';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with default values', () => {
      const error = new AppError('Test error');
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should create error with custom values', () => {
      const error = new AppError('Custom error', 418, 'TEAPOT', false);
      
      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(418);
      expect(error.code).toBe('TEAPOT');
      expect(error.isOperational).toBe(false);
    });

    it('should be instance of Error', () => {
      const error = new AppError('Test');
      expect(error).toBeInstanceOf(Error);
    });

    it('should be instance of AppError', () => {
      const error = new AppError('Test');
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('BadRequestError', () => {
    it('should create 400 error with default message', () => {
      const error = new BadRequestError();
      
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad Request');
      expect(error.code).toBe('BAD_REQUEST');
    });

    it('should create 400 error with custom message', () => {
      const error = new BadRequestError('Invalid input');
      
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
    });

    it('should be instance of BadRequestError', () => {
      const error = new BadRequestError();
      expect(error).toBeInstanceOf(BadRequestError);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('ValidationError', () => {
    it('should create error with validation errors', () => {
      const errors = { email: ['Invalid email format'] };
      const error = new ValidationError('Validation failed', errors);
      
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.errors).toEqual(errors);
    });

    it('should default to empty errors object', () => {
      const error = new ValidationError();
      
      expect(error.errors).toEqual({});
    });
  });

  describe('UnauthorizedError', () => {
    it('should create 401 error', () => {
      const error = new UnauthorizedError();
      
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Unauthorized');
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('should create 401 error with custom message', () => {
      const error = new UnauthorizedError('Token expired');
      
      expect(error.message).toBe('Token expired');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('ForbiddenError', () => {
    it('should create 403 error', () => {
      const error = new ForbiddenError();
      
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Forbidden');
      expect(error.code).toBe('FORBIDDEN');
    });

    it('should create 403 error with custom message', () => {
      const error = new ForbiddenError('Access denied');
      
      expect(error.message).toBe('Access denied');
    });
  });

  describe('NotFoundError', () => {
    it('should create 404 error', () => {
      const error = new NotFoundError();
      
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not Found');
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should create 404 error with custom message', () => {
      const error = new NotFoundError('User not found');
      
      expect(error.message).toBe('User not found');
    });
  });

  describe('ConflictError', () => {
    it('should create 409 error', () => {
      const error = new ConflictError();
      
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Conflict');
      expect(error.code).toBe('CONFLICT');
    });

    it('should create 409 error with custom message', () => {
      const error = new ConflictError('Resource already exists');
      
      expect(error.message).toBe('Resource already exists');
    });
  });
});
