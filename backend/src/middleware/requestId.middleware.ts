/**
 * Request ID Middleware
 * 
 * Adds a unique request ID to each request for distributed tracing and debugging.
 * The ID is passed through response headers, included in logs via AsyncLocalStorage,
 * and available throughout the request lifecycle.
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requestContext } from '../config/logger.js';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
  }
}

/**
 * Generate or extract request ID for tracing
 * Uses incoming X-Request-ID header if present, otherwise generates a new UUID
 * Also sets up AsyncLocalStorage context for correlation in logs
 */
export function requestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Use existing request ID from header (for distributed tracing) or generate new one
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    
    // Attach to request object
    req.requestId = requestId;
    
    // Add to response headers for client-side debugging
    res.setHeader('X-Request-ID', requestId);
    
    // Run the rest of the request in AsyncLocalStorage context
    // This allows all logs within this request to include the correlation ID
    requestContext.run({ requestId }, () => {
      next();
    });
  };
}

/**
 * Update the request context with user ID after authentication
 * Call this in auth middleware after user is verified
 */
export function setContextUserId(userId: string): void {
  const store = requestContext.getStore();
  if (store) {
    store.userId = userId;
  }
}

/**
 * Get request ID from current request context
 * Useful for logging and error reporting
 */
export function getRequestId(req: Request): string {
  return req.requestId || 'unknown';
}
