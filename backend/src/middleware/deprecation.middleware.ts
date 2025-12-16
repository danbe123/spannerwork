/**
 * API Deprecation Middleware
 * 
 * Provides middleware for marking API endpoints as deprecated.
 * Adds standard HTTP headers to inform clients about deprecation status.
 * 
 * Headers added:
 * - Deprecation: RFC 8594 deprecation date (true or ISO 8601 date)
 * - Sunset: RFC 8594 sunset date when the endpoint will be removed
 * - Link: Points to documentation or replacement endpoint
 * 
 * @see https://datatracker.ietf.org/doc/html/rfc8594
 * 
 * Usage:
 * ```typescript
 * // Mark endpoint as deprecated with sunset date
 * router.get('/old-endpoint', 
 *   deprecate({ 
 *     sunset: '2025-06-01',
 *     link: '/api/v2/new-endpoint',
 *     message: 'Use /api/v2/new-endpoint instead'
 *   }),
 *   handler
 * );
 * 
 * // Mark as deprecated without sunset (deprecation warning only)
 * router.get('/legacy', deprecate(), handler);
 * ```
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

export interface DeprecationOptions {
  /**
   * When the endpoint was deprecated (ISO 8601 date string)
   * If not provided, defaults to 'true' per RFC 8594
   */
  deprecatedAt?: string;

  /**
   * When the endpoint will be removed (ISO 8601 date string)
   * This sets the Sunset header per RFC 8594
   */
  sunset?: string;

  /**
   * URL to replacement endpoint or documentation
   */
  link?: string;

  /**
   * Human-readable deprecation message
   * Will be included in response body for some content types
   */
  message?: string;

  /**
   * Whether to log usage of deprecated endpoints
   * Default: true in production, false in development
   */
  logUsage?: boolean;
}

/**
 * Middleware to mark an endpoint as deprecated
 * Adds RFC 8594 compliant deprecation headers
 */
export function deprecate(options: DeprecationOptions = {}) {
  const {
    deprecatedAt,
    sunset,
    link,
    message,
    logUsage = process.env.NODE_ENV === 'production',
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Deprecation header (RFC 8594)
    // Can be 'true' or an ISO 8601 date when it was deprecated
    res.setHeader('Deprecation', deprecatedAt || 'true');

    // Sunset header (RFC 8594) - when the endpoint will be removed
    if (sunset) {
      // Ensure proper HTTP date format
      const sunsetDate = new Date(sunset);
      res.setHeader('Sunset', sunsetDate.toUTCString());
    }

    // Link header pointing to documentation or replacement
    if (link) {
      // Combine with any existing Link header
      const existingLink = res.getHeader('Link');
      const deprecationLink = `<${link}>; rel="deprecation"`;
      
      if (existingLink) {
        res.setHeader('Link', `${existingLink}, ${deprecationLink}`);
      } else {
        res.setHeader('Link', deprecationLink);
      }
    }

    // Add deprecation warning as a custom header (human-readable)
    if (message) {
      res.setHeader('X-Deprecation-Notice', message);
    }

    // Log usage of deprecated endpoints
    if (logUsage) {
      logger.warn('Deprecated endpoint accessed', {
        method: req.method,
        path: req.path,
        sunset: sunset || 'not set',
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
    }

    next();
  };
}

/**
 * Registry of deprecated endpoints for documentation and monitoring
 */
export interface DeprecatedEndpoint {
  method: string;
  path: string;
  deprecatedAt: string;
  sunset?: string;
  replacement?: string;
  reason?: string;
}

const deprecatedEndpoints: DeprecatedEndpoint[] = [];

/**
 * Register a deprecated endpoint for tracking/documentation
 */
export function registerDeprecation(endpoint: DeprecatedEndpoint): void {
  deprecatedEndpoints.push(endpoint);
}

/**
 * Get all registered deprecated endpoints
 * Useful for generating deprecation documentation
 */
export function getDeprecatedEndpoints(): DeprecatedEndpoint[] {
  return [...deprecatedEndpoints];
}

/**
 * Check if an endpoint is in the deprecation registry
 */
export function isEndpointDeprecated(method: string, path: string): boolean {
  return deprecatedEndpoints.some(
    e => e.method.toUpperCase() === method.toUpperCase() && e.path === path
  );
}

export default deprecate;
