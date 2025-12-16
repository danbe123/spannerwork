/**
 * Centralized Error Classes
 * 
 * Custom error classes for consistent error handling across the application.
 * Each error class automatically sets the appropriate HTTP status code.
 */

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
    
    // Set the prototype explicitly for instanceof to work
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * 400 Bad Request - Invalid input or request format
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request', code: string = 'BAD_REQUEST') {
    super(message, 400, code);
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

/**
 * 400 Validation Error - Input validation failed
 */
export class ValidationError extends AppError {
  public readonly errors: Record<string, string[]>;

  constructor(
    message: string = 'Validation Error',
    errors: Record<string, string[]> = {}
  ) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 401 Unauthorized - Authentication required or failed
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', code: string = 'UNAUTHORIZED') {
    super(message, 401, code);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * 403 Forbidden - Authenticated but not allowed
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', code: string = 'FORBIDDEN') {
    super(message, 403, code);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Not Found', code: string = 'NOT_FOUND') {
    super(message, 404, code);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 409 Conflict - Resource already exists or state conflict
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', code: string = 'CONFLICT') {
    super(message, 409, code);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * 410 Gone - Resource no longer available
 */
export class GoneError extends AppError {
  constructor(message: string = 'Gone', code: string = 'GONE') {
    super(message, 410, code);
    Object.setPrototypeOf(this, GoneError.prototype);
  }
}

/**
 * 422 Unprocessable Entity - Semantic errors in request
 */
export class UnprocessableEntityError extends AppError {
  constructor(message: string = 'Unprocessable Entity', code: string = 'UNPROCESSABLE_ENTITY') {
    super(message, 422, code);
    Object.setPrototypeOf(this, UnprocessableEntityError.prototype);
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class TooManyRequestsError extends AppError {
  public readonly retryAfter?: number;

  constructor(message: string = 'Too Many Requests', retryAfter?: number) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, TooManyRequestsError.prototype);
  }
}

/**
 * 500 Internal Server Error - Unexpected server error
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal Server Error', code: string = 'INTERNAL_ERROR') {
    super(message, 500, code, false); // Not operational - indicates a bug
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

/**
 * 502 Bad Gateway - Upstream service error
 */
export class BadGatewayError extends AppError {
  constructor(message: string = 'Bad Gateway', code: string = 'BAD_GATEWAY') {
    super(message, 502, code);
    Object.setPrototypeOf(this, BadGatewayError.prototype);
  }
}

/**
 * 503 Service Unavailable - Service temporarily unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service Unavailable', code: string = 'SERVICE_UNAVAILABLE') {
    super(message, 503, code);
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * Check if an error is an operational error (expected) vs programming error
 */
export function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new InternalServerError(error.message);
  }
  
  return new InternalServerError('An unexpected error occurred');
}

/**
 * 408 Request Timeout - Request took too long
 */
export class RequestTimeoutError extends AppError {
  constructor(message: string = 'Request Timeout', code: string = 'REQUEST_TIMEOUT') {
    super(message, 408, code);
    Object.setPrototypeOf(this, RequestTimeoutError.prototype);
  }
}

/**
 * 413 Payload Too Large - Request body too large
 */
export class PayloadTooLargeError extends AppError {
  constructor(message: string = 'Payload Too Large', code: string = 'PAYLOAD_TOO_LARGE') {
    super(message, 413, code);
    Object.setPrototypeOf(this, PayloadTooLargeError.prototype);
  }
}

/**
 * Database Error - Wraps Prisma/DB errors
 */
export class DatabaseError extends AppError {
  public readonly originalError?: Error;

  constructor(message: string = 'Database Error', originalError?: Error) {
    super(message, 500, 'DATABASE_ERROR', false);
    this.originalError = originalError;
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * External Service Error - Third-party API failures
 */
export class ExternalServiceError extends AppError {
  public readonly serviceName: string;

  constructor(serviceName: string, message?: string) {
    super(message || `${serviceName} service is temporarily unavailable`, 502, 'EXTERNAL_SERVICE_ERROR');
    this.serviceName = serviceName;
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}

/**
 * Common error factory functions for frequently used errors
 */
export const Errors = {
  // Auth errors
  invalidCredentials: () => new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS'),
  sessionExpired: () => new UnauthorizedError('Session expired', 'SESSION_EXPIRED'),
  accountSuspended: () => new ForbiddenError('Account is suspended', 'ACCOUNT_SUSPENDED'),
  accountLocked: (minutes: number) => new TooManyRequestsError(
    `Account temporarily locked. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
    minutes * 60
  ),
  emailNotVerified: () => new ForbiddenError('Email verification required', 'EMAIL_NOT_VERIFIED'),
  tokenExpired: () => new UnauthorizedError('Token has expired', 'TOKEN_EXPIRED'),
  invalidSession: () => new UnauthorizedError('Invalid or expired session', 'INVALID_SESSION'),
  
  // Resource errors
  userNotFound: () => new NotFoundError('User not found', 'USER_NOT_FOUND'),
  resourceNotFound: (resource: string) => new NotFoundError(`${resource} not found`, 'RESOURCE_NOT_FOUND'),
  emailAlreadyExists: () => new ConflictError('User with this email already exists', 'EMAIL_EXISTS'),
  usernameAlreadyExists: () => new ConflictError('This username is already taken', 'USERNAME_EXISTS'),
  
  // Validation errors
  invalidInput: (message: string) => new BadRequestError(message, 'INVALID_INPUT'),
  invalidToken: () => new BadRequestError('Invalid or expired token', 'INVALID_TOKEN'),
  invalidId: (resource: string = 'resource') => new BadRequestError(`Invalid ${resource} ID format`, 'INVALID_ID'),
  missingField: (field: string) => new BadRequestError(`Missing required field: ${field}`, 'MISSING_FIELD'),
  invalidFileType: (allowed: string[]) => new BadRequestError(
    `Invalid file type. Allowed types: ${allowed.join(', ')}`,
    'INVALID_FILE_TYPE'
  ),
  fileTooLarge: (maxSize: string) => new PayloadTooLargeError(`File size exceeds ${maxSize} limit`),
  
  // Permission errors
  insufficientPermissions: () => new ForbiddenError('Insufficient permissions', 'INSUFFICIENT_PERMISSIONS'),
  notResourceOwner: () => new ForbiddenError('You do not have permission to access this resource', 'NOT_OWNER'),
  accountDeleted: () => new GoneError('This account has been deleted', 'ACCOUNT_DELETED'),
  resourceDeleted: (resource: string) => new GoneError(`This ${resource} has been deleted`, 'RESOURCE_DELETED'),
  
  // Transaction errors
  bookingConflict: () => new ConflictError('This time slot is no longer available', 'BOOKING_CONFLICT'),
  transactionInProgress: () => new ConflictError('Transaction already in progress', 'TRANSACTION_IN_PROGRESS'),
  invalidTransactionState: (current: string, expected: string) => new ConflictError(
    `Cannot perform this action. Transaction is ${current}, expected ${expected}`,
    'INVALID_TRANSACTION_STATE'
  ),
  paymentRequired: () => new ForbiddenError('Payment is required to complete this action', 'PAYMENT_REQUIRED'),
  refundFailed: () => new InternalServerError('Refund could not be processed. Please contact support.'),
  
  // Rate limiting
  rateLimitExceeded: (retryAfter?: number) => new TooManyRequestsError(
    'Too many requests. Please try again later.',
    retryAfter
  ),
  
  // External service errors
  emailServiceError: () => new ExternalServiceError('Email', 'Failed to send email. Please try again later.'),
  paymentServiceError: () => new ExternalServiceError('Payment', 'Payment service is temporarily unavailable.'),
  geocodingServiceError: () => new ExternalServiceError('Geocoding', 'Location service is temporarily unavailable.'),
  
  // Database errors
  databaseError: (originalError?: Error) => new DatabaseError('A database error occurred', originalError),
  concurrencyError: () => new ConflictError('This record was modified by another request. Please refresh and try again.', 'CONCURRENCY_ERROR'),
};
