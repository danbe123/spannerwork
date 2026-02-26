import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';
import multer from 'multer';
import { upload, uploadService, isHeicFile, convertHeicToJpeg } from '../services/upload.service.js';
import { imageProcessorService, ProcessedImage } from '../services/image-processor.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
// Note: CSRF is intentionally NOT applied to upload routes because:
// 1. All upload routes require authentication (requireAuth middleware)
// 2. Session cookies use SameSite=strict which prevents CSRF in modern browsers
// 3. File uploads don't expose sensitive data in responses
// 4. Multipart form uploads have known issues with CSRF token validation
import { uploadLimiter } from '../middleware/rateLimit.middleware.js';
import { logger } from '../config/logger.js';
import { validateFileMagicBytes, validateFileExtension } from '../utils/fileValidation.js';
import { virusScanService } from '../services/virusScan.service.js';

const router = Router();

/**
 * Validate filename to prevent path traversal attacks
 * Rejects filenames containing '..' or path separators
 */
function validateFilename(req: Request, res: Response, next: NextFunction): void {
  const { filename } = req.params;

  if (!filename) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Filename is required',
    });
    return;
  }

  // Check for path traversal patterns
  if (
    filename.includes('..') ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('\0') || // Null byte injection
    filename.startsWith('.') // Hidden files
  ) {
    logger.warn(`Path traversal attempt detected: ${filename}`, {
      ip: req.ip,
      userId: req.user?.id,
    });
    res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid filename provided',
    });
    return;
  }

  // Validate filename format (alphanumeric, hyphens, underscores, dots)
  const validFilenamePattern = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/;
  if (!validFilenamePattern.test(filename)) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid filename format',
    });
    return;
  }

  next();
}

/**
 * Multer error handler middleware
 * Catches multer-specific errors and returns user-friendly messages
 */
function handleMulterError(err: Error, _req: Request, res: Response, next: NextFunction): void {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: 'File Too Large',
        message: 'File size exceeds 10MB limit',
      });
      return;
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      res.status(400).json({
        error: 'Invalid Upload',
        message: 'Unexpected file field',
      });
      return;
    }
    res.status(400).json({
      error: 'Upload Error',
      message: err.message,
    });
    return;
  }

  // File filter errors (invalid file type)
  if (err.message && err.message.includes('Invalid file type')) {
    logger.warn(`File type rejected: ${err.message}`);
    res.status(400).json({
      error: 'Invalid File Type',
      message: 'Only JPEG, PNG, GIF, WEBP, and PDF files are allowed. HEIC/HEIF files from iPhones must be converted to JPEG first.',
    });
    return;
  }

  // Pass other errors to the global error handler
  next(err);
}

// Maximum upload size in bytes (10MB) - matches multer config
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

/**
 * Middleware to validate Content-Length before processing upload
 * Rejects requests with excessive Content-Length headers early,
 * before multer starts buffering the request body
 */
function validateContentLength(req: Request, res: Response, next: NextFunction) {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  
  if (contentLength > MAX_UPLOAD_SIZE) {
    return res.status(413).json({
      error: 'Payload Too Large',
      message: `File size exceeds maximum allowed size of ${MAX_UPLOAD_SIZE / 1024 / 1024}MB`,
    });
  }
  
  return next();
}

/**
 * Wrapper to handle multer errors for single file upload
 */
function uploadSingle(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err) => {
    if (err) {
      handleMulterError(err, req, res, next);
      return;
    }
    next();
  });
}

/**
 * Wrapper to handle multer errors for multiple file upload
 */
function uploadMultiple(req: Request, res: Response, next: NextFunction): void {
  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      handleMulterError(err, req, res, next);
      return;
    }
    next();
  });
}

/**
 * POST /api/v1/upload
 * Upload a single file
 * @auth Required
 * @csrf Required
 * @rateLimit 20 uploads per 15 minutes
 */
router.post('/', uploadLimiter, validateContentLength, requireAuth, uploadSingle, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided',
        message: 'Please upload a file',
      });
    }

    let filePath = path.join(process.cwd(), 'uploads', req.file.filename);
    let filename = req.file.filename;
    let mimetype = req.file.mimetype;

    // Convert HEIC/HEIF to JPEG
    if (isHeicFile(req.file.mimetype)) {
      try {
        const converted = await convertHeicToJpeg(filePath, filename);
        filePath = converted.newPath;
        filename = converted.newFilename;
        mimetype = 'image/jpeg';
      } catch (error) {
        await fs.unlink(filePath).catch(() => {});
        return res.status(400).json({
          error: 'Conversion failed',
          message: error instanceof Error ? error.message : 'Failed to process image',
        });
      }
    } else {
      // Validate magic bytes to prevent MIME type spoofing (skip for HEIC as it's already converted)
      const isValidMagicBytes = await validateFileMagicBytes(filePath, req.file.mimetype);

      if (!isValidMagicBytes) {
        // Delete the invalid file
        await fs.unlink(filePath).catch(() => {});
        logger.warn(`Magic byte validation failed for file: ${req.file.originalname} (claimed: ${req.file.mimetype})`);
        return res.status(400).json({
          error: 'Invalid file',
          message: 'File content does not match the declared file type',
        });
      }

      // Validate file extension matches MIME type to prevent extension mismatch attacks
      const isValidExtension = validateFileExtension(filename, req.file.mimetype);

      if (!isValidExtension) {
        await fs.unlink(filePath).catch(() => {});
        logger.warn(`Extension validation failed for file: ${req.file.originalname} (claimed: ${req.file.mimetype})`);
        return res.status(400).json({
          error: 'Invalid file',
          message: 'File extension does not match the file type',
        });
      }
    }

    // Virus scan the file
    const scanResult = await virusScanService.scanFile(filePath);
    if (!scanResult.clean) {
      // Delete the infected/suspicious file
      await fs.unlink(filePath).catch(() => {});
      logger.warn(`Virus scan failed for file: ${req.file.originalname}`, {
        virus: scanResult.virus,
        error: scanResult.error,
      });
      return res.status(400).json({
        error: 'File rejected',
        message: scanResult.virus
          ? 'File contains malware and has been rejected'
          : 'File could not be verified as safe',
      });
    }

    const fileUrl = uploadService.getFileUrl(filename);

    // Process image into multiple sizes (for images only, not PDFs)
    let optimized: ProcessedImage | null = null;
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);

    if (isImage) {
      try {
        optimized = await imageProcessorService.processImage(filePath, filename);
        logger.info(`Image optimized: ${filename} - generated responsive versions`);
      } catch (error) {
        // Log but don't fail - original image still works
        logger.warn(`Image optimization failed for ${filename}:`, error);
      }
    }

    logger.info(`File uploaded: ${filename} by user ${req.user?.id}`);

    return res.status(200).json({
      success: true,
      data: {
        fileUrl,
        filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype,
        // Include optimized versions if available
        ...(optimized && {
          optimized: {
            srcsetAvif: imageProcessorService.generateSrcSet(optimized, 'avif'),
            srcset: imageProcessorService.generateSrcSet(optimized, 'webp'),
            srcsetFallback: imageProcessorService.generateSrcSet(optimized, 'fallback'),
            sizes: optimized,
          },
        }),
      },
    });
  } catch (error) {
    logger.error('Upload error:', error);
    return res.status(500).json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Failed to upload file',
    });
  }
});

/**
 * POST /api/v1/upload/multiple
 * Upload multiple files (max 10)
 * @auth Required
 * @csrf Required
 * @rateLimit 20 uploads per 15 minutes
 */
router.post('/multiple', uploadLimiter, validateContentLength, requireAuth, uploadMultiple, async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'No files provided',
        message: 'Please upload at least one file',
      });
    }

    // Process, validate and virus scan all files
    const processedFiles: { filename: string; originalName: string; size: number; mimetype: string; optimized: ProcessedImage | null }[] = [];
    const invalidFiles: string[] = [];
    const infectedFiles: string[] = [];

    for (const file of files) {
      let filePath = path.join(process.cwd(), 'uploads', file.filename);
      let filename = file.filename;
      let mimetype = file.mimetype;

      // Convert HEIC/HEIF to JPEG
      if (isHeicFile(file.mimetype)) {
        try {
          const converted = await convertHeicToJpeg(filePath, filename);
          filePath = converted.newPath;
          filename = converted.newFilename;
          mimetype = 'image/jpeg';
        } catch {
          await fs.unlink(filePath).catch(() => {});
          invalidFiles.push(file.originalname);
          logger.warn(`HEIC conversion failed for file: ${file.originalname}`);
          continue;
        }
      } else {
        // Validate magic bytes (skip for HEIC as it's already converted)
        const isValidMagicBytes = await validateFileMagicBytes(filePath, file.mimetype);

        if (!isValidMagicBytes) {
          await fs.unlink(filePath).catch(() => {});
          invalidFiles.push(file.originalname);
          logger.warn(`Magic byte validation failed for file: ${file.originalname} (claimed: ${file.mimetype})`);
          continue;
        }
      }

      // Virus scan the file
      const scanResult = await virusScanService.scanFile(filePath);
      if (!scanResult.clean) {
        await fs.unlink(filePath).catch(() => {});
        infectedFiles.push(file.originalname);
        logger.warn(`Virus scan failed for file: ${file.originalname}`, {
          virus: scanResult.virus,
          error: scanResult.error,
        });
        continue;
      }

      // Process image into multiple sizes (for images only)
      let optimized: ProcessedImage | null = null;
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);

      if (isImage) {
        try {
          optimized = await imageProcessorService.processImage(filePath, filename);
        } catch (error) {
          logger.warn(`Image optimization failed for ${filename}:`, error);
        }
      }

      processedFiles.push({
        filename,
        originalName: file.originalname,
        size: file.size,
        mimetype,
        optimized,
      });
    }

    // If all files were invalid or infected, return error
    if (processedFiles.length === 0) {
      return res.status(400).json({
        error: 'Invalid files',
        message: 'None of the uploaded files passed validation',
        invalidFiles,
        infectedFiles,
      });
    }

    const uploadedFiles = processedFiles.map(file => ({
      fileUrl: uploadService.getFileUrl(file.filename),
      filename: file.filename,
      originalName: file.originalName,
      size: file.size,
      mimetype: file.mimetype,
      ...(file.optimized && {
        optimized: {
          srcsetAvif: imageProcessorService.generateSrcSet(file.optimized, 'avif'),
          srcset: imageProcessorService.generateSrcSet(file.optimized, 'webp'),
          srcsetFallback: imageProcessorService.generateSrcSet(file.optimized, 'fallback'),
          sizes: file.optimized,
        },
      }),
    }));

    logger.info(`${processedFiles.length} files uploaded by user ${req.user?.id}`);

    // Build warnings for rejected files
    const rejectedCount = invalidFiles.length + infectedFiles.length;

    // Return success with info about any rejected files
    return res.status(200).json({
      success: true,
      data: {
        files: uploadedFiles,
        count: uploadedFiles.length,
        ...(rejectedCount > 0 && {
          warning: `${rejectedCount} file(s) were rejected`,
          ...(invalidFiles.length > 0 && { invalidFiles }),
          ...(infectedFiles.length > 0 && { infectedFiles }),
        }),
      },
    });
  } catch (error) {
    logger.error('Multiple upload error:', error);
    return res.status(500).json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Failed to upload files',
    });
  }
});

/**
 * DELETE /api/v1/upload/:filename
 * Delete an uploaded file
 * @auth Required
 * @csrf Required
 */
router.delete('/:filename', requireAuth, validateFilename, async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    }

    // Delete file with ownership verification
    await uploadService.deleteFileWithOwnership(filename, userId);

    // Also delete optimized versions
    await imageProcessorService.deleteOptimizedVersions(filename);

    logger.info(`File deleted: ${filename} by user ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    logger.error('Delete file error:', error);

    // Return appropriate status codes
    if (error instanceof Error) {
      if (error.message.includes('permission') || error.message.includes('own')) {
        return res.status(403).json({
          error: 'Forbidden',
          message: error.message,
        });
      }
      if (error.message.includes('Invalid filename') || error.message.includes('path traversal')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid filename provided',
        });
      }
    }

    return res.status(500).json({
      error: 'Delete failed',
      message: error instanceof Error ? error.message : 'Failed to delete file',
    });
  }
});

/**
 * POST /api/v1/upload/recover/:filename
 * Recover a soft-deleted file
 * @auth Required
 * @csrf Required
 */
router.post('/recover/:filename', requireAuth, validateFilename, async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    }

    await uploadService.recoverFile(filename, userId);

    logger.info(`File recovered: ${filename} by user ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'File recovered successfully',
      data: {
        fileUrl: uploadService.getFileUrl(filename),
      },
    });
  } catch (error) {
    logger.error('Recover file error:', error);

    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('permanently deleted')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
      }
    }

    return res.status(500).json({
      error: 'Recovery failed',
      message: error instanceof Error ? error.message : 'Failed to recover file',
    });
  }
});

export default router;
