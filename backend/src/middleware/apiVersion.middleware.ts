/**
 * API Versioning Middleware
 * 
 * Adds API versioning headers to all responses and validates requested versions.
 * 
 * Headers:
 *   - X-API-Version: Current API version being used
 *   - X-API-Supported-Versions: All supported API versions
 *   - X-API-Deprecated: Set to 'true' if using a deprecated version
 *   - X-API-Deprecation-Date: When the version will be removed (if deprecated)
 *   - X-API-Latest-Version: The latest available API version
 * 
 * Usage:
 *   Clients can request a specific version via:
 *   - URL path: /api/v1/resource (preferred)
 *   - Header: X-API-Version: 1
 *   - Query param: ?api_version=1
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

// API version status type
type VersionStatus = 'current' | 'deprecated';

interface ApiVersionConfig {
  version: string;
  status: VersionStatus;
  deprecationDate: string | null;
}

// API version configuration
export const API_VERSIONS: Record<string, ApiVersionConfig> = {
  v1: {
    version: '1',
    status: 'current',
    deprecationDate: null,
  },
  // Future versions can be added here
  // v2: {
  //   version: '2',
  //   status: 'current',
  //   deprecationDate: null,
  // },
};

export const LATEST_VERSION = '1';
export const SUPPORTED_VERSIONS = Object.values(API_VERSIONS).map(v => v.version);
export const DEPRECATED_VERSIONS = Object.values(API_VERSIONS)
  .filter(v => v.status === 'deprecated')
  .map(v => v.version);

/**
 * Add API versioning headers to all responses
 */
export function apiVersionHeaders(req: Request, res: Response, next: NextFunction): void {
  // Determine the API version being used
  const pathVersion = req.path.match(/^\/api\/v(\d+)/)?.[1];
  const headerVersion = req.headers['x-api-version'] as string;
  const queryVersion = req.query.api_version as string;
  
  const requestedVersion = pathVersion || headerVersion || queryVersion || LATEST_VERSION;
  
  // Set versioning headers
  res.setHeader('X-API-Version', requestedVersion);
  res.setHeader('X-API-Supported-Versions', SUPPORTED_VERSIONS.join(', '));
  res.setHeader('X-API-Latest-Version', LATEST_VERSION);
  
  // Check if using deprecated version
  const versionConfig = Object.values(API_VERSIONS).find(v => v.version === requestedVersion);
  if (versionConfig?.status === 'deprecated') {
    res.setHeader('X-API-Deprecated', 'true');
    if (versionConfig.deprecationDate) {
      res.setHeader('X-API-Deprecation-Date', versionConfig.deprecationDate);
    }
    logger.warn(`Deprecated API version ${requestedVersion} used`, {
      path: req.path,
      ip: req.ip,
    });
  }
  
  // Store version in request for use in controllers
  req.apiVersion = requestedVersion;
  
  next();
}

/**
 * Validate that the requested API version is supported
 * Returns 400 if an unsupported version is explicitly requested
 */
export function validateApiVersion(req: Request, res: Response, next: NextFunction): void {
  const headerVersion = req.headers['x-api-version'] as string;
  const queryVersion = req.query.api_version as string;
  
  // Only validate if client explicitly requested a version
  const explicitVersion = headerVersion || queryVersion;
  
  if (explicitVersion && !SUPPORTED_VERSIONS.includes(explicitVersion)) {
    res.status(400).json({
      error: 'Unsupported API Version',
      message: `API version ${explicitVersion} is not supported`,
      supportedVersions: SUPPORTED_VERSIONS,
      latestVersion: LATEST_VERSION,
    });
    return;
  }
  
  next();
}

/**
 * Get deprecation warning for response bodies (optional use)
 */
export function getDeprecationWarning(version: string): string | null {
  const versionConfig = Object.values(API_VERSIONS).find(v => v.version === version);
  if (versionConfig?.status === 'deprecated') {
    return `API version ${version} is deprecated and will be removed on ${versionConfig.deprecationDate || 'a future date'}. Please upgrade to version ${LATEST_VERSION}.`;
  }
  return null;
}
