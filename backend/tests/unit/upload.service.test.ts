/**
 * Upload Service Unit Tests
 * 
 * Tests for file upload, validation, soft delete, and recovery functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    tool: { findFirst: vi.fn() },
    space: { findFirst: vi.fn() },
    service: { findFirst: vi.fn() },
    request: { findFirst: vi.fn() },
    deletedFile: {
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Use vi.hoisted to ensure mockFs is available before vi.mock hoisting
const mockFs = vi.hoisted(() => ({
  mkdir: vi.fn(),
  rename: vi.fn(),
  unlink: vi.fn(),
  access: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: mockFs,
  ...mockFs,
}));

import { uploadService } from '../../src/services/upload.service.js';
import { prisma } from '../../src/config/database.js';

describe('UploadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getFileUrl', () => {
    it('should return correct URL for filename', () => {
      const filename = 'test-file-123.jpg';
      const url = uploadService.getFileUrl(filename);
      expect(url).toBe('/uploads/test-file-123.jpg');
    });
  });

  describe('sanitizeFilename', () => {
    it('should accept valid UUID-based filenames', () => {
      const validFilename = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg';
      expect(uploadService.sanitizeFilename(validFilename)).toBe(validFilename);
    });

    it('should accept valid filenames with different extensions', () => {
      const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'];
      extensions.forEach(ext => {
        const filename = `a1b2c3d4-e5f6-7890-abcd-ef1234567890.${ext}`;
        expect(uploadService.sanitizeFilename(filename)).toBe(filename);
      });
    });

    it('should reject filenames with path traversal', () => {
      expect(() => uploadService.sanitizeFilename('../../../etc/passwd')).toThrow('Invalid filename');
    });

    it('should reject filenames that are not UUID-based', () => {
      expect(() => uploadService.sanitizeFilename('random-file.jpg')).toThrow('Invalid filename format');
    });

    it('should reject empty filenames', () => {
      expect(() => uploadService.sanitizeFilename('')).toThrow('Invalid filename');
    });

    it('should reject dot-only filenames', () => {
      expect(() => uploadService.sanitizeFilename('.')).toThrow('Invalid filename');
      expect(() => uploadService.sanitizeFilename('..')).toThrow('Invalid filename');
    });
  });

  describe('verifyFileOwnership', () => {
    const userId = 'user-123';
    const filename = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg';

    it('should return true when user owns file as avatar', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: userId } as any);
      vi.mocked(prisma.tool.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.space.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.service.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.request.findFirst).mockResolvedValue(null);

      const result = await uploadService.verifyFileOwnership(filename, userId);
      expect(result).toBe(true);
    });

    it('should return true when user owns file in tool photos', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.tool.findFirst).mockResolvedValue({ id: 'tool-1' } as any);
      vi.mocked(prisma.space.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.service.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.request.findFirst).mockResolvedValue(null);

      const result = await uploadService.verifyFileOwnership(filename, userId);
      expect(result).toBe(true);
    });

    it('should return false when user does not own file', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.tool.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.space.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.service.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.request.findFirst).mockResolvedValue(null);

      const result = await uploadService.verifyFileOwnership(filename, userId);
      expect(result).toBe(false);
    });

    it('should run all ownership checks in parallel', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.tool.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.space.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.service.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.request.findFirst).mockResolvedValue(null);

      await uploadService.verifyFileOwnership(filename, userId);

      // All queries should have been called
      expect(prisma.user.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.tool.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.space.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.service.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.request.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe('getFileOwnershipInfo', () => {
    const userId = 'user-123';
    const filename = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg';

    it('should return avatar owner type when file is user avatar', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: userId } as any);
      vi.mocked(prisma.tool.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.space.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.service.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.request.findFirst).mockResolvedValue(null);

      const result = await uploadService.getFileOwnershipInfo(filename, userId);
      expect(result).toEqual({ ownerType: 'avatar', resourceId: userId });
    });

    it('should return tool owner type with resource ID', async () => {
      const toolId = 'tool-456';
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.tool.findFirst).mockResolvedValue({ id: toolId } as any);
      vi.mocked(prisma.space.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.service.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.request.findFirst).mockResolvedValue(null);

      const result = await uploadService.getFileOwnershipInfo(filename, userId);
      expect(result).toEqual({ ownerType: 'tool', resourceId: toolId });
    });

    it('should return null when file is not owned by user', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.tool.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.space.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.service.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.request.findFirst).mockResolvedValue(null);

      const result = await uploadService.getFileOwnershipInfo(filename, userId);
      expect(result).toBeNull();
    });

    it('should prioritize avatar over tool ownership', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: userId } as any);
      vi.mocked(prisma.tool.findFirst).mockResolvedValue({ id: 'tool-1' } as any);
      vi.mocked(prisma.space.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.service.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.request.findFirst).mockResolvedValue(null);

      const result = await uploadService.getFileOwnershipInfo(filename, userId);
      expect(result?.ownerType).toBe('avatar');
    });
  });

  describe('softDeleteFile', () => {
    const filename = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg';
    const userId = 'user-123';

    beforeEach(() => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);
      vi.mocked(prisma.deletedFile.create).mockResolvedValue({} as any);
    });

    it('should create a deleted file record', async () => {
      await uploadService.softDeleteFile(filename, userId, userId, 'avatar');

      expect(prisma.deletedFile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          filename,
          ownerId: userId,
          deletedBy: userId,
          ownerType: 'avatar',
        }),
      });
    });

    it('should move file to trash directory', async () => {
      await uploadService.softDeleteFile(filename, userId, userId);

      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.rename).toHaveBeenCalled();
    });

    it('should throw error for path traversal attempts', async () => {
      await expect(
        uploadService.softDeleteFile('../../../etc/passwd', userId, userId)
      ).rejects.toThrow();
    });
  });

  describe('recoverFile', () => {
    const filename = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg';
    const userId = 'user-123';

    it('should recover a soft-deleted file', async () => {
      const deletedRecord = {
        id: 'deleted-1',
        filename,
        originalPath: `/uploads/${filename}`,
        ownerId: userId,
        permanentlyDeleted: false,
      };

      vi.mocked(prisma.deletedFile.findFirst).mockResolvedValue(deletedRecord as any);
      mockFs.rename.mockResolvedValue(undefined);
      vi.mocked(prisma.deletedFile.delete).mockResolvedValue({} as any);

      await uploadService.recoverFile(filename, userId);

      expect(mockFs.rename).toHaveBeenCalled();
      expect(prisma.deletedFile.delete).toHaveBeenCalledWith({
        where: { id: 'deleted-1' },
      });
    });

    it('should throw error when file not found', async () => {
      vi.mocked(prisma.deletedFile.findFirst).mockResolvedValue(null);

      await expect(
        uploadService.recoverFile(filename, userId)
      ).rejects.toThrow('Deleted file not found');
    });
  });

  describe('deleteFileWithOwnership', () => {
    const filename = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg';
    const userId = 'user-123';

    it('should throw error when user does not own file', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.tool.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.space.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.service.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.request.findFirst).mockResolvedValue(null);

      await expect(
        uploadService.deleteFileWithOwnership(filename, userId)
      ).rejects.toThrow('permission');
    });

    it('should soft delete file when user owns it', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: userId } as any);
      vi.mocked(prisma.tool.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.space.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.service.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.request.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.deletedFile.create).mockResolvedValue({} as any);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      await uploadService.deleteFileWithOwnership(filename, userId);

      expect(prisma.deletedFile.create).toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredDeletedFiles', () => {
    it('should permanently delete expired files', async () => {
      const expiredFiles = [
        { id: '1', filename: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg' },
        { id: '2', filename: 'b2c3d4e5-f6a7-8901-bcde-f12345678901.jpg' },
      ];

      vi.mocked(prisma.deletedFile.findMany).mockResolvedValue(expiredFiles as any);
      // Mock fs.unlink to succeed (called for each file in hardDeleteFile)
      mockFs.unlink.mockResolvedValue(undefined);
      vi.mocked(prisma.deletedFile.update).mockResolvedValue({} as any);

      const count = await uploadService.cleanupExpiredDeletedFiles();

      expect(count).toBe(2);
      expect(prisma.deletedFile.update).toHaveBeenCalledTimes(2);
    });

    it('should handle deletion errors gracefully and continue', async () => {
      const expiredFiles = [
        { id: '1', filename: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg' },
        { id: '2', filename: 'b2c3d4e5-f6a7-8901-bcde-f12345678901.jpg' },
      ];

      vi.mocked(prisma.deletedFile.findMany).mockResolvedValue(expiredFiles as any);
      // First file deletion fails completely, second succeeds
      mockFs.unlink
        .mockRejectedValueOnce(new Error('File not found')) // file1 trash path
        .mockRejectedValueOnce(new Error('File not found')) // file1 uploads path
        .mockResolvedValueOnce(undefined); // file2 trash path succeeds
      vi.mocked(prisma.deletedFile.update).mockResolvedValue({} as any);

      const count = await uploadService.cleanupExpiredDeletedFiles();

      // Should count only successful deletions
      expect(count).toBe(1);
    });

    it('should return 0 when no expired files exist', async () => {
      vi.mocked(prisma.deletedFile.findMany).mockResolvedValue([]);

      const count = await uploadService.cleanupExpiredDeletedFiles();

      expect(count).toBe(0);
    });
  });
});
