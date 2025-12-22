/**
 * Centralized Error Handling Middleware
 * 
 * Handles all errors thrown in the application and returns
 * consistent error responses.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import * as Sentry from '@sentry/node';
import { 
  ValidationError, 
  TooManyRequestsError,
  ExternalServiceError,
  DatabaseError,
  isOperationalError, 
  toAppError 
} from '../utils/errors.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

/**
 * Format Zod validation errors into a consistent structure
 */
function formatZodError(error: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  }
  
  return errors;
}

/**
 * Error handler for CSRF token errors
 */
function handleCsrfError(err: Error & { code?: string }, res: Response): boolean {
  if (err.code === 'EBADCSRFTOKEN') {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Your session has expired. Please refresh the page and try again.',
      code: 'EBADCSRFTOKEN',
    });
    return true;
  }
  return false;
}

/**
 * Main error handling middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle CSRF errors
  if (handleCsrfError(err as Error & { code?: string }, res)) {
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const validationError = new ValidationError('Validation Error', formatZodError(err));
    res.status(validationError.statusCode).json({
      error: 'Validation Error',
      message: validationError.message,
      code: validationError.code,
      errors: validationError.errors,
    });
    return;
  }

  // Convert to AppError if needed
  const appError = toAppError(err);

  // Log error
  if (isOperationalError(err)) {
    logger.warn(`Operational error: ${appError.message}`, {
      code: appError.code,
      statusCode: appError.statusCode,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.error('Unhandled error:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });

    // Report non-operational errors to Sentry
    if (env.SENTRY_DSN) {
      Sentry.captureException(err);
    }
  }

  // Build response
  const response: Record<string, unknown> = {
    error: getErrorTitle(appError.statusCode),
    message: env.NODE_ENV === 'production' && !isOperationalError(err)
      ? 'Internal Server Error'
      : appError.message,
    code: appError.code,
  };

  // Add validation errors if present
  if (appError instanceof ValidationError) {
    response.errors = appError.errors;
  }

  // Add retry-after header for rate limit errors
  if (appError instanceof TooManyRequestsError && appError.retryAfter) {
    res.set('Retry-After', appError.retryAfter.toString());
    response.retryAfter = appError.retryAfter;
  }

  // Add service name for external service errors
  if (appError instanceof ExternalServiceError) {
    response.service = appError.serviceName;
  }

  // Log database errors with more detail (but don't expose to client)
  if (appError instanceof DatabaseError && appError.originalError) {
    logger.error('Database error details:', {
      message: appError.originalError.message,
      stack: appError.originalError.stack,
    });
  }

  // Add stack trace in development
  if (env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(appError.statusCode).json(response);
}

/**
 * Get the error title based on status code
 */
function getErrorTitle(statusCode: number): string {
  const titles: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    410: 'Gone',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  
  return titles[statusCode] || 'Error';
}

/**
 * 404 handler for routes that don't exist
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    code: 'ROUTE_NOT_FOUND',
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
