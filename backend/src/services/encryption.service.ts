/**
 * Encryption Service
 * 
 * Provides application-level encryption for PII (Personally Identifiable Information)
 * Uses AES-256-GCM for authenticated encryption.
 * 
 * Configuration:
 * - ENCRYPTION_KEY: 32-byte (256-bit) key in hex format (64 characters)
 *   Generate with: openssl rand -hex 32
 * 
 * Security Features:
 * - AES-256-GCM authenticated encryption
 * - Unique IV per encryption
 * - Authentication tag prevents tampering
 * - Deterministic encryption option for searchable fields
 */

import crypto from 'crypto';
import { logger } from '../config/logger.js';

// Encryption algorithm
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // AES block size
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 16;

// Encryption key from environment
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

// Check if encryption is enabled
const ENCRYPTION_ENABLED = !!ENCRYPTION_KEY && ENCRYPTION_KEY.length === 64;

if (!ENCRYPTION_ENABLED) {
  logger.warn('PII encryption is disabled. Set ENCRYPTION_KEY (64 hex chars) to enable.');
}

/**
 * Derive a key from the master key and a salt
 * This allows for key rotation and different keys per field type
 */
function deriveKey(salt: Buffer): Buffer {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key not configured');
  }
  const masterKey = Buffer.from(ENCRYPTION_KEY, 'hex');
  return crypto.pbkdf2Sync(masterKey, salt, 100000, 32, 'sha256');
}

/**
 * Encryption Service for PII data
 */
export class EncryptionService {
  /**
   * Check if encryption is enabled
   */
  isEnabled(): boolean {
    return ENCRYPTION_ENABLED;
  }

  /**
   * Encrypt a value using AES-256-GCM
   * Returns base64-encoded ciphertext with IV and auth tag
   * 
   * Format: base64(salt + iv + authTag + ciphertext)
   */
  encrypt(plaintext: string): string {
    if (!ENCRYPTION_ENABLED || !plaintext) {
      return plaintext;
    }

    try {
      // Generate random salt and IV
      const salt = crypto.randomBytes(SALT_LENGTH);
      const iv = crypto.randomBytes(IV_LENGTH);
      const key = deriveKey(salt);

      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      // Encrypt
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);

      // Get auth tag
      const authTag = cipher.getAuthTag();

      // Combine all parts: salt + iv + authTag + ciphertext
      const combined = Buffer.concat([salt, iv, authTag, encrypted]);

      // Return as base64 with prefix to identify encrypted values
      return `enc:${combined.toString('base64')}`;
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt a value encrypted with encrypt()
   */
  decrypt(ciphertext: string): string {
    if (!ENCRYPTION_ENABLED || !ciphertext) {
      return ciphertext;
    }

    // Check if value is encrypted
    if (!ciphertext.startsWith('enc:')) {
      return ciphertext; // Return as-is if not encrypted
    }

    try {
      // Remove prefix and decode
      const combined = Buffer.from(ciphertext.slice(4), 'base64');

      // Extract parts
      const salt = combined.subarray(0, SALT_LENGTH);
      const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
      const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
      const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

      // Derive key
      const key = deriveKey(salt);

      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      logger.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Deterministic encryption for searchable fields
   * Uses a fixed IV derived from the plaintext, allowing searching on encrypted values
   * Less secure than random IV but enables database queries
   * 
   * WARNING: Use only for fields that require searching
   */
  encryptDeterministic(plaintext: string): string {
    if (!ENCRYPTION_ENABLED || !plaintext) {
      return plaintext;
    }

    try {
      const masterKey = Buffer.from(ENCRYPTION_KEY!, 'hex');
      
      // Derive IV from plaintext hash (deterministic)
      const iv = crypto
        .createHmac('sha256', masterKey)
        .update(plaintext)
        .digest()
        .subarray(0, IV_LENGTH);

      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
      
      // Encrypt
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);

      // Get auth tag
      const authTag = cipher.getAuthTag();

      // Combine: iv + authTag + ciphertext
      const combined = Buffer.concat([iv, authTag, encrypted]);

      return `det:${combined.toString('base64')}`;
    } catch (error) {
      logger.error('Deterministic encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt deterministically encrypted value
   */
  decryptDeterministic(ciphertext: string): string {
    if (!ENCRYPTION_ENABLED || !ciphertext) {
      return ciphertext;
    }

    if (!ciphertext.startsWith('det:')) {
      return ciphertext;
    }

    try {
      const masterKey = Buffer.from(ENCRYPTION_KEY!, 'hex');
      const combined = Buffer.from(ciphertext.slice(4), 'base64');

      // Extract parts
      const iv = combined.subarray(0, IV_LENGTH);
      const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      logger.error('Deterministic decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Check if a value is encrypted
   */
  isEncrypted(value: string): boolean {
    return value?.startsWith('enc:') || value?.startsWith('det:');
  }

  /**
   * Decrypt a value (auto-detect encryption type)
   */
  decryptAny(value: string): string {
    if (!value) return value;
    if (value.startsWith('enc:')) return this.decrypt(value);
    if (value.startsWith('det:')) return this.decryptDeterministic(value);
    return value;
  }

  /**
   * Hash a value for searching encrypted fields
   * Returns a consistent hash that can be used for exact-match lookups
   */
  hash(value: string): string {
    if (!ENCRYPTION_KEY || !value) {
      return value;
    }
    
    const masterKey = Buffer.from(ENCRYPTION_KEY, 'hex');
    return crypto
      .createHmac('sha256', masterKey)
      .update(value.toLowerCase())
      .digest('hex');
  }
}

export const encryptionService = new EncryptionService();
export default encryptionService;
