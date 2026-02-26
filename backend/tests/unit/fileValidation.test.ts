import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  validateFileMagicBytes,
  detectFileType,
  validateFileExtension,
  ALLOWED_MIME_TYPES,
} from '../../src/utils/fileValidation.js';
import { logger } from '../../src/config/logger.js';

describe('fileValidation', () => {
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'filevalidation-test-'));
  });

  afterEach(async () => {
    vi.resetAllMocks();
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('ALLOWED_MIME_TYPES', () => {
    it('should include common image types', () => {
      expect(ALLOWED_MIME_TYPES).toContain('image/jpeg');
      expect(ALLOWED_MIME_TYPES).toContain('image/jpg');
      expect(ALLOWED_MIME_TYPES).toContain('image/png');
      expect(ALLOWED_MIME_TYPES).toContain('image/gif');
      expect(ALLOWED_MIME_TYPES).toContain('image/webp');
    });

    it('should include PDF', () => {
      expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
    });
  });

  describe('validateFileExtension', () => {
    it('should validate JPEG extensions', () => {
      expect(validateFileExtension('photo.jpg', 'image/jpeg')).toBe(true);
      expect(validateFileExtension('photo.jpeg', 'image/jpeg')).toBe(true);
      expect(validateFileExtension('photo.JPG', 'image/jpeg')).toBe(true);
    });

    it('should validate PNG extension', () => {
      expect(validateFileExtension('image.png', 'image/png')).toBe(true);
      expect(validateFileExtension('image.PNG', 'image/png')).toBe(true);
    });

    it('should validate GIF extension', () => {
      expect(validateFileExtension('animation.gif', 'image/gif')).toBe(true);
    });

    it('should validate WebP extension', () => {
      expect(validateFileExtension('image.webp', 'image/webp')).toBe(true);
    });

    it('should validate PDF extension', () => {
      expect(validateFileExtension('document.pdf', 'application/pdf')).toBe(true);
    });

    it('should reject mismatched extensions', () => {
      expect(validateFileExtension('image.png', 'image/jpeg')).toBe(false);
      expect(validateFileExtension('document.pdf', 'image/png')).toBe(false);
    });

    it('should reject unknown MIME types', () => {
      expect(validateFileExtension('file.exe', 'application/exe')).toBe(false);
    });

    it('should handle files without extension', () => {
      expect(validateFileExtension('noextension', 'image/jpeg')).toBe(false);
    });

    it('should handle image/jpg as alias for image/jpeg', () => {
      expect(validateFileExtension('photo.jpg', 'image/jpg')).toBe(true);
      expect(validateFileExtension('photo.jpeg', 'image/jpg')).toBe(true);
    });
  });

  describe('validateFileMagicBytes', () => {
    it('should validate JPEG magic bytes', async () => {
      // JPEG magic bytes: FF D8 FF
      const jpegFile = path.join(tempDir, 'test.jpg');
      await fs.writeFile(jpegFile, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]));

      const result = await validateFileMagicBytes(jpegFile, 'image/jpeg');
      expect(result).toBe(true);
    });

    it('should validate PNG magic bytes', async () => {
      // PNG magic bytes
      const pngFile = path.join(tempDir, 'test.png');
      await fs.writeFile(pngFile, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));

      const result = await validateFileMagicBytes(pngFile, 'image/png');
      expect(result).toBe(true);
    });

    it('should validate GIF87a magic bytes', async () => {
      // GIF87a magic bytes
      const gifFile = path.join(tempDir, 'test.gif');
      await fs.writeFile(gifFile, Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x00, 0x00]));

      const result = await validateFileMagicBytes(gifFile, 'image/gif');
      expect(result).toBe(true);
    });

    it('should validate GIF89a magic bytes', async () => {
      // GIF89a magic bytes
      const gifFile = path.join(tempDir, 'test.gif');
      await fs.writeFile(gifFile, Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00]));

      const result = await validateFileMagicBytes(gifFile, 'image/gif');
      expect(result).toBe(true);
    });

    it('should validate PDF magic bytes', async () => {
      // PDF magic bytes: %PDF
      const pdfFile = path.join(tempDir, 'test.pdf');
      await fs.writeFile(pdfFile, Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E]));

      const result = await validateFileMagicBytes(pdfFile, 'application/pdf');
      expect(result).toBe(true);
    });

    it('should validate WebP magic bytes', async () => {
      // WebP: RIFF at 0, WEBP at 8
      const webpFile = path.join(tempDir, 'test.webp');
      const webpData = Buffer.alloc(16);
      // RIFF header
      webpData.writeUInt8(0x52, 0); // R
      webpData.writeUInt8(0x49, 1); // I
      webpData.writeUInt8(0x46, 2); // F
      webpData.writeUInt8(0x46, 3); // F
      // File size (placeholder)
      webpData.writeUInt32LE(0, 4);
      // WEBP signature
      webpData.writeUInt8(0x57, 8);  // W
      webpData.writeUInt8(0x45, 9);  // E
      webpData.writeUInt8(0x42, 10); // B
      webpData.writeUInt8(0x50, 11); // P
      await fs.writeFile(webpFile, webpData);

      const result = await validateFileMagicBytes(webpFile, 'image/webp');
      expect(result).toBe(true);
    });

    it('should normalize image/jpg to image/jpeg', async () => {
      const jpegFile = path.join(tempDir, 'test.jpg');
      await fs.writeFile(jpegFile, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]));

      const result = await validateFileMagicBytes(jpegFile, 'image/jpg');
      expect(result).toBe(true);
    });

    it('should reject files with wrong magic bytes', async () => {
      const fakeJpegFile = path.join(tempDir, 'fake.jpg');
      await fs.writeFile(fakeJpegFile, Buffer.from([0x00, 0x00, 0x00, 0x00]));

      const result = await validateFileMagicBytes(fakeJpegFile, 'image/jpeg');
      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Magic byte validation failed'),
        expect.any(Object)
      );
    });

    it('should reject unknown MIME types', async () => {
      const unknownFile = path.join(tempDir, 'unknown.exe');
      await fs.writeFile(unknownFile, Buffer.from([0x4D, 0x5A])); // MZ for EXE

      const result = await validateFileMagicBytes(unknownFile, 'application/exe');
      expect(result).toBe(false);
      // Unknown MIME types also get logged as validation failures
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Magic byte validation failed'),
        expect.any(Object)
      );
    });

    it('should handle file read errors', async () => {
      const result = await validateFileMagicBytes('/nonexistent/file.jpg', 'image/jpeg');
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should reject files too short for signature', async () => {
      const shortFile = path.join(tempDir, 'short.png');
      await fs.writeFile(shortFile, Buffer.from([0x89, 0x50])); // Only 2 bytes

      const result = await validateFileMagicBytes(shortFile, 'image/png');
      expect(result).toBe(false);
    });
  });

  describe('detectFileType', () => {
    it('should detect JPEG files', async () => {
      const jpegFile = path.join(tempDir, 'mystery.bin');
      await fs.writeFile(jpegFile, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]));

      const result = await detectFileType(jpegFile);
      expect(result).toBe('image/jpeg');
    });

    it('should detect PNG files', async () => {
      const pngFile = path.join(tempDir, 'mystery.bin');
      await fs.writeFile(pngFile, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));

      const result = await detectFileType(pngFile);
      expect(result).toBe('image/png');
    });

    it('should detect GIF files', async () => {
      const gifFile = path.join(tempDir, 'mystery.bin');
      await fs.writeFile(gifFile, Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00]));

      const result = await detectFileType(gifFile);
      expect(result).toBe('image/gif');
    });

    it('should detect PDF files', async () => {
      const pdfFile = path.join(tempDir, 'mystery.bin');
      await fs.writeFile(pdfFile, Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E]));

      const result = await detectFileType(pdfFile);
      expect(result).toBe('application/pdf');
    });

    it('should detect WebP files', async () => {
      const webpFile = path.join(tempDir, 'mystery.bin');
      const webpData = Buffer.alloc(16);
      webpData.writeUInt8(0x52, 0); // R
      webpData.writeUInt8(0x49, 1); // I
      webpData.writeUInt8(0x46, 2); // F
      webpData.writeUInt8(0x46, 3); // F
      webpData.writeUInt32LE(0, 4);
      webpData.writeUInt8(0x57, 8);  // W
      webpData.writeUInt8(0x45, 9);  // E
      webpData.writeUInt8(0x42, 10); // B
      webpData.writeUInt8(0x50, 11); // P
      await fs.writeFile(webpFile, webpData);

      const result = await detectFileType(webpFile);
      expect(result).toBe('image/webp');
    });

    it('should return null for unknown file types', async () => {
      const unknownFile = path.join(tempDir, 'unknown.bin');
      await fs.writeFile(unknownFile, Buffer.from([0x00, 0x11, 0x22, 0x33]));

      const result = await detectFileType(unknownFile);
      expect(result).toBeNull();
    });

    it('should handle file read errors', async () => {
      const result = await detectFileType('/nonexistent/file.bin');
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should not detect WebP without proper WEBP signature at offset 8', async () => {
      const notWebpFile = path.join(tempDir, 'nowebp.bin');
      const data = Buffer.alloc(16);
      // RIFF header only, no WEBP signature
      data.writeUInt8(0x52, 0); // R
      data.writeUInt8(0x49, 1); // I
      data.writeUInt8(0x46, 2); // F
      data.writeUInt8(0x46, 3); // F
      data.writeUInt32LE(0, 4);
      data.writeUInt8(0x00, 8);  // Not W
      data.writeUInt8(0x00, 9);  // Not E
      data.writeUInt8(0x00, 10); // Not B
      data.writeUInt8(0x00, 11); // Not P
      await fs.writeFile(notWebpFile, data);

      const result = await detectFileType(notWebpFile);
      // Should not be detected as WebP since WEBP signature is missing
      expect(result).not.toBe('image/webp');
    });
  });
});
