import { Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';

// Soft delete retention period (30 days)
const SOFT_DELETE_RETENTION_DAYS = 30;

// Configure storage
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    
    // Ensure uploads directory exists
    try {
      await fs.mkdir(uploadDir, { recursive: true });
    } catch (error) {
      logger.error('Error creating upload directory:', error);
    }
    
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    const filename = `${uniqueId}${ext}`;
    cb(null, filename);
  },
});

// File filter
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed image types
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf', // For insurance documents
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WEBP, and PDF files are allowed.'));
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

/**
 * Upload Service
 * Handles file uploads and management
 */
class UploadService {
  /**
   * Get file URL for a filename
   */
  getFileUrl(filename: string): string {
    // In production, this would return CDN URL
    // For now, return relative URL
    return `/uploads/${filename}`;
  }

  /**
   * Sanitize filename to prevent path traversal attacks
   */
  sanitizeFilename(filename: string): string {
    // Remove any path components (directory traversal attempts)
    const basename = path.basename(filename);

    // Only allow alphanumeric characters, hyphens, underscores, and a single extension
    const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, '');

    // Ensure filename isn't empty after sanitization
    if (!sanitized || sanitized === '.' || sanitized === '..') {
      throw new Error('Invalid filename');
    }

    // Validate that it's a UUID-based filename (our format)
    const uuidPattern = /^[a-f0-9-]{36}\.(jpg|jpeg|png|gif|webp|pdf)$/i;
    if (!uuidPattern.test(sanitized)) {
      throw new Error('Invalid filename format');
    }

    return sanitized;
  }

  /**
   * Verify that a user owns a file
   * Optimized: Uses parallel queries instead of sequential to reduce latency
   */
  async verifyFileOwnership(filename: string, userId: string): Promise<boolean> {
    try {
      const fileUrl = this.getFileUrl(filename);

      // Run all ownership checks in parallel for better performance
      const [userWithAvatar, toolWithPhoto, spaceWithPhoto, serviceWithPhoto, requestWithPhoto] = 
        await Promise.all([
          // Check if file exists in user's avatar
          prisma.user.findFirst({
            where: { id: userId, avatar: fileUrl },
            select: { id: true },
          }),
          // Check if file exists in user's tools
          prisma.tool.findFirst({
            where: { ownerId: userId, photos: { has: fileUrl } },
            select: { id: true },
          }),
          // Check if file exists in user's spaces
          prisma.space.findFirst({
            where: { ownerId: userId, photos: { has: fileUrl } },
            select: { id: true },
          }),
          // Check if file exists in user's services
          prisma.service.findFirst({
            where: { providerId: userId, photos: { has: fileUrl } },
            select: { id: true },
          }),
          // Check if file exists in user's requests
          prisma.request.findFirst({
            where: { seekerId: userId, photos: { has: fileUrl } },
            select: { id: true },
          }),
        ]);

      return !!(userWithAvatar || toolWithPhoto || spaceWithPhoto || serviceWithPhoto || requestWithPhoto);
    } catch (error) {
      logger.error('Error verifying file ownership:', error);
      return false;
    }
  }

  /**
   * Soft delete a file - moves to deleted state with recovery option
   * File is recorded in DeletedFile table and will be permanently deleted after retention period
   */
  async softDeleteFile(
    filename: string,
    ownerId: string,
    deletedBy: string,
    ownerType: string = 'unknown',
    resourceId?: string
  ): Promise<void> {
    try {
      // Sanitize filename to prevent path traversal
      const sanitizedFilename = this.sanitizeFilename(filename);
      const fileUrl = this.getFileUrl(sanitizedFilename);
      const filePath = path.join(process.cwd(), 'uploads', sanitizedFilename);

      // Ensure the resolved path is still within uploads directory
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const resolvedPath = path.resolve(filePath);

      if (!resolvedPath.startsWith(uploadsDir)) {
        throw new Error('Invalid file path - path traversal attempt detected');
      }

      // Calculate expiry date for permanent deletion
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + SOFT_DELETE_RETENTION_DAYS);

      // Record the deletion in database BEFORE deleting the file
      // This ensures we have a record even if file deletion fails
      await prisma.deletedFile.create({
        data: {
          filename: sanitizedFilename,
          originalPath: filePath,
          fileUrl,
          ownerId,
          ownerType,
          resourceId,
          deletedBy,
          expiresAt,
        },
      });

      // Move file to trash directory instead of deleting
      const trashDir = path.join(process.cwd(), 'uploads', '.trash');
      await fs.mkdir(trashDir, { recursive: true });
      const trashPath = path.join(trashDir, sanitizedFilename);
      
      try {
        await fs.rename(filePath, trashPath);
        logger.info(`File soft-deleted: ${sanitizedFilename} (expires: ${expiresAt.toISOString()})`);
      } catch {
        // If move fails, try to copy then delete
        await fs.copyFile(filePath, trashPath);
        await fs.unlink(filePath);
        logger.info(`File soft-deleted (copy): ${sanitizedFilename}`);
      }
    } catch (error) {
      logger.error(`Error soft-deleting file ${filename}:`, error);
      throw new Error('Failed to delete file');
    }
  }

  /**
   * Hard delete a file (internal use only - for permanent deletion)
   */
  async hardDeleteFile(filename: string): Promise<void> {
    try {
      const sanitizedFilename = this.sanitizeFilename(filename);
      const trashPath = path.join(process.cwd(), 'uploads', '.trash', sanitizedFilename);
      const uploadsPath = path.join(process.cwd(), 'uploads', sanitizedFilename);

      // Try trash directory first, then uploads directory
      try {
        await fs.unlink(trashPath);
      } catch {
        await fs.unlink(uploadsPath);
      }

      logger.info(`File permanently deleted: ${sanitizedFilename}`);
    } catch (error) {
      logger.error(`Error hard-deleting file ${filename}:`, error);
      throw new Error('Failed to permanently delete file');
    }
  }

  /**
   * Recover a soft-deleted file
   */
  async recoverFile(filename: string, userId: string): Promise<void> {
    const sanitizedFilename = this.sanitizeFilename(filename);
    
    // Find the deleted file record
    const deletedFile = await prisma.deletedFile.findFirst({
      where: {
        filename: sanitizedFilename,
        ownerId: userId,
        permanentlyDeleted: false,
      },
    });

    if (!deletedFile) {
      throw new Error('Deleted file not found or already permanently deleted');
    }

    const trashPath = path.join(process.cwd(), 'uploads', '.trash', sanitizedFilename);
    const originalPath = deletedFile.originalPath;

    try {
      await fs.rename(trashPath, originalPath);
      
      // Remove the deletion record
      await prisma.deletedFile.delete({
        where: { id: deletedFile.id },
      });

      logger.info(`File recovered: ${sanitizedFilename}`);
    } catch (error) {
      logger.error(`Error recovering file ${filename}:`, error);
      throw new Error('Failed to recover file');
    }
  }

  /**
   * Delete a file with ownership verification (uses soft delete)
   */
  async deleteFileWithOwnership(filename: string, userId: string): Promise<void> {
    // Verify ownership and get owner type
    const ownershipInfo = await this.getFileOwnershipInfo(filename, userId);

    if (!ownershipInfo) {
      logger.warn(`User ${userId} attempted to delete file they don't own: ${filename}`);
      throw new Error('You do not have permission to delete this file');
    }

    await this.softDeleteFile(
      filename,
      userId,
      userId,
      ownershipInfo.ownerType,
      ownershipInfo.resourceId
    );
  }

  /**
   * Get file ownership info for soft delete tracking
   * Optimized: Uses parallel queries for better performance
   */
  async getFileOwnershipInfo(
    filename: string,
    userId: string
  ): Promise<{ ownerType: string; resourceId?: string } | null> {
    try {
      const fileUrl = this.getFileUrl(filename);

      // Run all ownership checks in parallel for better performance
      const [userWithAvatar, tool, space, service, request] = await Promise.all([
        // Check avatar
        prisma.user.findFirst({
          where: { id: userId, avatar: fileUrl },
          select: { id: true },
        }),
        // Check tools
        prisma.tool.findFirst({
          where: { ownerId: userId, photos: { has: fileUrl } },
          select: { id: true },
        }),
        // Check spaces
        prisma.space.findFirst({
          where: { ownerId: userId, photos: { has: fileUrl } },
          select: { id: true },
        }),
        // Check services
        prisma.service.findFirst({
          where: { providerId: userId, photos: { has: fileUrl } },
          select: { id: true },
        }),
        // Check requests
        prisma.request.findFirst({
          where: { seekerId: userId, photos: { has: fileUrl } },
          select: { id: true },
        }),
      ]);

      // Return the first match found (priority order: avatar > tool > space > service > request)
      if (userWithAvatar) return { ownerType: 'avatar', resourceId: userId };
      if (tool) return { ownerType: 'tool', resourceId: tool.id };
      if (space) return { ownerType: 'space', resourceId: space.id };
      if (service) return { ownerType: 'service', resourceId: service.id };
      if (request) return { ownerType: 'request', resourceId: request.id };

      return null;
    } catch (error) {
      logger.error('Error getting file ownership info:', error);
      return null;
    }
  }

  /**
   * Delete multiple files with ownership verification (uses soft delete)
   */
  async deleteFilesWithOwnership(filenames: string[], userId: string): Promise<void> {
    // Verify ownership of all files first before deleting any
    const ownershipChecks = await Promise.all(
      filenames.map(async (filename) => ({
        filename,
        ownershipInfo: await this.getFileOwnershipInfo(filename, userId),
      }))
    );

    const unauthorizedFiles = ownershipChecks
      .filter((check) => !check.ownershipInfo)
      .map((check) => check.filename);

    if (unauthorizedFiles.length > 0) {
      logger.warn(
        `User ${userId} attempted to delete files they don't own: ${unauthorizedFiles.join(', ')}`
      );
      throw new Error('You do not have permission to delete one or more files');
    }

    // All files verified, proceed with soft deletion
    await Promise.all(
      ownershipChecks.map((check) =>
        this.softDeleteFile(
          check.filename,
          userId,
          userId,
          check.ownershipInfo!.ownerType,
          check.ownershipInfo!.resourceId
        )
      )
    );
  }

  /**
   * Cleanup expired soft-deleted files (run periodically)
   */
  async cleanupExpiredDeletedFiles(): Promise<number> {
    const expiredFiles = await prisma.deletedFile.findMany({
      where: {
        expiresAt: { lt: new Date() },
        permanentlyDeleted: false,
      },
    });

    let deletedCount = 0;

    for (const file of expiredFiles) {
      try {
        await this.hardDeleteFile(file.filename);
        await prisma.deletedFile.update({
          where: { id: file.id },
          data: { permanentlyDeleted: true },
        });
        deletedCount++;
      } catch (error) {
        logger.error(`Failed to permanently delete expired file ${file.filename}:`, error);
      }
    }

    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} expired deleted files`);
    }

    return deletedCount;
  }
}

export const uploadService = new UploadService();
