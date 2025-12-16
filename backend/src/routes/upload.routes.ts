import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { upload, uploadService } from '../services/upload.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import { uploadLimiter } from '../middleware/rateLimit.middleware.js';
import { logger } from '../config/logger.js';
import { validateFileMagicBytes } from '../utils/fileValidation.js';
import { virusScanService } from '../services/virusScan.service.js';

const router = Router();

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
 * POST /api/v1/upload
 * Upload a single file
 * @auth Required
 * @csrf Required
 * @rateLimit 20 uploads per 15 minutes
 */
router.post('/', uploadLimiter, validateContentLength, requireAuth, verifyCsrfToken, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided',
        message: 'Please upload a file',
      });
    }

    // Validate magic bytes to prevent MIME type spoofing
    const filePath = path.join(process.cwd(), 'uploads', req.file.filename);
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

    const fileUrl = uploadService.getFileUrl(req.file.filename);

    logger.info(`File uploaded: ${req.file.filename} by user ${req.user?.id}`);

    return res.status(200).json({
      success: true,
      data: {
        fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
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
router.post('/multiple', uploadLimiter, validateContentLength, requireAuth, verifyCsrfToken, upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'No files provided',
        message: 'Please upload at least one file',
      });
    }

    // Validate magic bytes and virus scan for all files
    const validatedFiles: Express.Multer.File[] = [];
    const invalidFiles: string[] = [];
    const infectedFiles: string[] = [];

    for (const file of files) {
      const filePath = path.join(process.cwd(), 'uploads', file.filename);
      const isValidMagicBytes = await validateFileMagicBytes(filePath, file.mimetype);

      if (!isValidMagicBytes) {
        // Delete invalid file
        await fs.unlink(filePath).catch(() => {});
        invalidFiles.push(file.originalname);
        logger.warn(`Magic byte validation failed for file: ${file.originalname} (claimed: ${file.mimetype})`);
        continue;
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

      validatedFiles.push(file);
    }

    // If all files were invalid or infected, return error
    if (validatedFiles.length === 0) {
      return res.status(400).json({
        error: 'Invalid files',
        message: 'None of the uploaded files passed validation',
        invalidFiles,
        infectedFiles,
      });
    }

    const uploadedFiles = validatedFiles.map(file => ({
      fileUrl: uploadService.getFileUrl(file.filename),
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    }));

    logger.info(`${validatedFiles.length} files uploaded by user ${req.user?.id}`);

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
router.delete('/:filename', requireAuth, verifyCsrfToken, async (req: Request, res: Response) => {
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
router.post('/recover/:filename', requireAuth, verifyCsrfToken, async (req: Request, res: Response) => {
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
