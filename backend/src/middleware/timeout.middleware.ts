/**
 * Request Timeout Middleware
 * 
 * Prevents long-running requests from exhausting server resources.
 * Returns 503 Service Unavailable if request exceeds timeout.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

// Default timeout in milliseconds (30 seconds)
const DEFAULT_TIMEOUT_MS = 30000;

// Extended timeout for specific routes (2 minutes)
const EXTENDED_TIMEOUT_MS = 120000;

// Routes that need extended timeout (uploads, exports, etc.)
const EXTENDED_TIMEOUT_ROUTES = [
  '/api/v1/upload',
  '/api/v1/admin/export',
  '/api/v1/users/export-data',
];

/**
 * Timeout middleware factory
 * @param timeoutMs - Timeout in milliseconds
 */
export function timeout(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if this route needs extended timeout
    const needsExtendedTimeout = EXTENDED_TIMEOUT_ROUTES.some(
      route => req.path.startsWith(route)
    );
    
    const actualTimeout = needsExtendedTimeout ? EXTENDED_TIMEOUT_MS : timeoutMs;
    
    // Set a timeout on the request
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn(`Request timeout: ${req.method} ${req.path} exceeded ${actualTimeout}ms`);
        
        res.status(503).json({
          error: 'Service Unavailable',
          message: 'Request timeout - the server took too long to respond',
          code: 'REQUEST_TIMEOUT',
        });
      }
    }, actualTimeout);

    // Clear timeout when response finishes
    res.on('finish', () => {
      clearTimeout(timeoutId);
    });

    // Clear timeout on close (client disconnect)
    res.on('close', () => {
      clearTimeout(timeoutId);
    });

    next();
  };
}

/**
 * Default timeout middleware (30 seconds)
 */
export const requestTimeout = timeout(DEFAULT_TIMEOUT_MS);

/**
 * Extended timeout middleware (2 minutes)
 * Use for routes that need more time (uploads, exports)
 */
export const extendedTimeout = timeout(EXTENDED_TIMEOUT_MS);

export default requestTimeout;
