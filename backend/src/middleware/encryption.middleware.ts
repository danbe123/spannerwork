/**
 * Prisma Encryption Middleware
 * 
 * Automatically encrypts PII fields before writing to database
 * and decrypts them after reading.
 * 
 * PII fields encrypted:
 * - User: phone (random), email (deterministic for lookups)
 * - Referral: email, phone
 * - Message: content (if containing sensitive data)
 */

import { encryptionService } from '../services/encryption.service.js';
import { logger } from '../config/logger.js';

// Prisma middleware types
interface MiddlewareArgs {
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
  [key: string]: unknown;
}

type MiddlewareParams = {
  model?: string;
  action: string;
  args: MiddlewareArgs;
  dataPath: string[];
  runInTransaction: boolean;
};

type MiddlewareNext = (params: MiddlewareParams) => Promise<unknown>;
type PrismaMiddlewareFn = (params: MiddlewareParams, next: MiddlewareNext) => Promise<unknown>;

// Fields to encrypt with random encryption (more secure, not searchable)
const RANDOM_ENCRYPTED_FIELDS: Record<string, string[]> = {
  User: ['phone'],
  Referral: ['phone'],
};

// Fields to encrypt with deterministic encryption (searchable)
// Deterministic encryption allows the same plaintext to always produce the same ciphertext,
// enabling lookups (e.g., login by email) while still protecting data at rest.
const DETERMINISTIC_ENCRYPTED_FIELDS: Record<string, string[]> = {
  // Email uses deterministic encryption for login lookups
  // This protects email addresses at rest while allowing authentication to work
  User: ['email'],
  Referral: ['email'],
};

/**
 * Encrypt PII fields in the data object
 */
function encryptFields(
  model: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  if (!encryptionService.isEnabled()) {
    return data;
  }

  const result = { ...data };

  // Random encryption
  const randomFields = RANDOM_ENCRYPTED_FIELDS[model] || [];
  for (const field of randomFields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = encryptionService.encrypt(result[field] as string);
    }
  }

  // Deterministic encryption
  const deterministicFields = DETERMINISTIC_ENCRYPTED_FIELDS[model] || [];
  for (const field of deterministicFields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = encryptionService.encryptDeterministic(result[field] as string);
    }
  }

  return result;
}

/**
 * Decrypt PII fields in the result object
 */
function decryptFields(
  model: string,
  data: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!data || !encryptionService.isEnabled()) {
    return data;
  }

  const result = { ...data };

  // Get all encrypted fields for this model
  const randomFields = RANDOM_ENCRYPTED_FIELDS[model] || [];
  const deterministicFields = DETERMINISTIC_ENCRYPTED_FIELDS[model] || [];
  const allFields = [...randomFields, ...deterministicFields];

  for (const field of allFields) {
    if (result[field] && typeof result[field] === 'string') {
      try {
        result[field] = encryptionService.decryptAny(result[field] as string);
      } catch (error) {
        logger.error(`Failed to decrypt ${model}.${field}:`, error);
        // Keep encrypted value on error
      }
    }
  }

  return result;
}

/**
 * Decrypt an array of results
 */
function decryptResultArray(
  model: string,
  results: Record<string, unknown>[]
): Record<string, unknown>[] {
  return results.map(result => decryptFields(model, result) as Record<string, unknown>);
}

/**
 * Get the model name from the Prisma action
 */
function getModelName(params: { model?: string }): string | null {
  return params.model || null;
}

/**
 * Prisma middleware for automatic PII encryption/decryption
 */
export function encryptionMiddleware(): PrismaMiddlewareFn {
  return async (params: MiddlewareParams, next: MiddlewareNext) => {
    const model = getModelName(params);
    
    if (!model) {
      return next(params);
    }

    // Check if this model has encrypted fields
    const hasEncryptedFields = 
      RANDOM_ENCRYPTED_FIELDS[model]?.length > 0 ||
      DETERMINISTIC_ENCRYPTED_FIELDS[model]?.length > 0;

    if (!hasEncryptedFields) {
      return next(params);
    }

    // Encrypt on write operations
    if (params.action === 'create' && params.args.data && !Array.isArray(params.args.data)) {
      params.args.data = encryptFields(model, params.args.data as Record<string, unknown>);
    }

    if (params.action === 'createMany' && params.args.data && Array.isArray(params.args.data)) {
      params.args.data = params.args.data.map((d: Record<string, unknown>) => encryptFields(model, d));
    }

    if (params.action === 'update' && params.args.data && !Array.isArray(params.args.data)) {
      params.args.data = encryptFields(model, params.args.data as Record<string, unknown>);
    }

    if (params.action === 'updateMany' && params.args.data && !Array.isArray(params.args.data)) {
      params.args.data = encryptFields(model, params.args.data as Record<string, unknown>);
    }

    if (params.action === 'upsert') {
      if (params.args.create) {
        params.args.create = encryptFields(model, params.args.create as Record<string, unknown>);
      }
      if (params.args.update) {
        params.args.update = encryptFields(model, params.args.update as Record<string, unknown>);
      }
    }

    // Execute query
    const result = await next(params);

    // Decrypt on read operations
    if (result === null || result === undefined) {
      return result;
    }

    // Single result
    if (
      params.action === 'findUnique' ||
      params.action === 'findFirst' ||
      params.action === 'create' ||
      params.action === 'update' ||
      params.action === 'upsert'
    ) {
      return decryptFields(model, result as Record<string, unknown>);
    }

    // Array results
    if (params.action === 'findMany' && Array.isArray(result)) {
      return decryptResultArray(model, result as Record<string, unknown>[]);
    }

    return result;
  };
}

/**
 * Utility to encrypt a search value for deterministic field lookup
 */
export function encryptForSearch(value: string): string {
  return encryptionService.encryptDeterministic(value);
}

/**
 * Utility to hash a value for searching
 */
export function hashForSearch(value: string): string {
  return encryptionService.hash(value);
}

export default encryptionMiddleware;
