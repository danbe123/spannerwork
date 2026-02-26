/**
 * No-Cache Middleware
 *
 * Sets HTTP headers to prevent caching of dynamic content.
 * Use this for routes that must always return fresh data:
 * - Messages and conversations
 * - Feed / request listings
 * - User listings (tools, spaces, services)
 * - Transactions
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to set no-cache headers on responses
 * Prevents both browser and proxy caching
 */
export function noCache(_req: Request, res: Response, next: NextFunction): void {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, private, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
  });
  next();
}

/**
 * Middleware for short-lived cache (30 seconds)
 * Use for data that changes frequently but can tolerate brief staleness
 */
export function shortCache(_req: Request, res: Response, next: NextFunction): void {
  res.set({
    'Cache-Control': 'private, max-age=30, must-revalidate',
  });
  next();
}

/**
 * Middleware for medium cache (5 minutes)
 * Use for semi-static content
 */
export function mediumCache(_req: Request, res: Response, next: NextFunction): void {
  res.set({
    'Cache-Control': 'public, max-age=300, must-revalidate',
  });
  next();
}

export default noCache;
