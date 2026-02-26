/**
 * File Validation Utilities
 * 
 * Magic byte validation for uploaded files to prevent MIME type spoofing.
 * This provides an additional layer of security beyond just checking the MIME type.
 */

import fs from 'fs/promises';
import { logger } from '../config/logger.js';

/**
 * Magic byte signatures for allowed file types
 * These are the first few bytes that identify a file's true type
 */
const MAGIC_BYTES: Record<string, { bytes: number[]; offset?: number }[]> = {
  // JPEG
  'image/jpeg': [
    { bytes: [0xFF, 0xD8, 0xFF] },
  ],
  // PNG
  'image/png': [
    { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  ],
  // GIF
  'image/gif': [
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
  ],
  // WebP
  'image/webp': [
    { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF header
    // Note: WebP also has 'WEBP' at offset 8, but checking RIFF is usually sufficient
  ],
  // PDF
  'application/pdf': [
    { bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  ],
};

/**
 * Allowed MIME types for uploads
 */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

/**
 * Map jpg to jpeg for magic byte lookup
 */
function normalizeMimeType(mimeType: string): string {
  if (mimeType === 'image/jpg') {
    return 'image/jpeg';
  }
  return mimeType;
}

/**
 * Check if buffer starts with expected bytes at given offset
 */
function bufferStartsWith(buffer: Buffer, expectedBytes: number[], offset = 0): boolean {
  if (buffer.length < offset + expectedBytes.length) {
    return false;
  }
  
  for (let i = 0; i < expectedBytes.length; i++) {
    if (buffer[offset + i] !== expectedBytes[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Validate file magic bytes match a known allowed image/file type
 *
 * This is more lenient than strict MIME matching - if the file is ANY valid
 * allowed type, it passes. This handles cases where browsers report incorrect
 * MIME types (common on mobile devices, especially iOS).
 *
 * @param filePath - Path to the uploaded file
 * @param declaredMimeType - The MIME type declared by the upload (used for logging)
 * @returns True if magic bytes match any allowed type, false otherwise
 */
export async function validateFileMagicBytes(
  filePath: string,
  declaredMimeType: string
): Promise<boolean> {
  try {
    // Read the first 16 bytes of the file (enough for any signature we check)
    const fileHandle = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(16);

    try {
      await fileHandle.read(buffer, 0, 16, 0);
    } finally {
      await fileHandle.close();
    }

    // Check if file matches ANY allowed type (lenient validation)
    // This handles browser MIME type mismatches common on mobile devices
    for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
      for (const signature of signatures) {
        if (bufferStartsWith(buffer, signature.bytes, signature.offset || 0)) {
          // Special handling for WebP - must also have 'WEBP' at offset 8
          if (mimeType === 'image/webp') {
            const webpBytes = [0x57, 0x45, 0x42, 0x50]; // 'WEBP'
            if (bufferStartsWith(buffer, webpBytes, 8)) {
              if (mimeType !== normalizeMimeType(declaredMimeType)) {
                logger.info(`File type mismatch accepted: declared ${declaredMimeType}, actual ${mimeType}`);
              }
              return true;
            }
            // RIFF but not WebP - continue checking other types
            continue;
          }

          if (mimeType !== normalizeMimeType(declaredMimeType)) {
            logger.info(`File type mismatch accepted: declared ${declaredMimeType}, actual ${mimeType}`);
          }
          return true;
        }
      }
    }

    logger.warn(`Magic byte validation failed for ${filePath}`, {
      declaredMimeType,
      actualBytes: buffer.slice(0, 8).toString('hex'),
    });

    return false;
  } catch (error) {
    logger.error('Error validating file magic bytes:', error);
    return false;
  }
}

/**
 * Detect actual file type from magic bytes
 * 
 * @param filePath - Path to the file
 * @returns Detected MIME type or null if unknown
 */
export async function detectFileType(filePath: string): Promise<string | null> {
  try {
    const fileHandle = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(16);
    
    try {
      await fileHandle.read(buffer, 0, 16, 0);
    } finally {
      await fileHandle.close();
    }
    
    // Check each known type
    for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
      for (const signature of signatures) {
        if (bufferStartsWith(buffer, signature.bytes, signature.offset || 0)) {
          // Special handling for WebP
          if (mimeType === 'image/webp') {
            const webpBytes = [0x57, 0x45, 0x42, 0x50];
            if (!bufferStartsWith(buffer, webpBytes, 8)) {
              continue;
            }
          }
          return mimeType;
        }
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Error detecting file type:', error);
    return null;
  }
}

/**
 * Validate that the file extension matches common expectations for the MIME type
 */
export function validateFileExtension(filename: string, mimeType: string): boolean {
  const ext = filename.toLowerCase().split('.').pop();
  
  const validExtensions: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/jpg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/gif': ['gif'],
    'image/webp': ['webp'],
    'application/pdf': ['pdf'],
  };
  
  const allowed = validExtensions[mimeType];
  if (!allowed) {
    return false;
  }
  
  return ext ? allowed.includes(ext) : false;
}
