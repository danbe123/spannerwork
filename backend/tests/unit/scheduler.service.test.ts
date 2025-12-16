import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing
vi.mock('../../src/services/auth.service.js', () => ({
  authService: {
    cleanupExpiredSessions: vi.fn(),
    cleanupExpiredPasswordResetTokens: vi.fn(),
  },
}));

vi.mock('../../src/services/upload.service.js', () => ({
  uploadService: {
    cleanupExpiredDeletedFiles: vi.fn(),
  },
}));

vi.mock('../../src/services/analytics.service.js', () => ({
  snapshotDailyMetrics: vi.fn(),
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    tool: {
      findFirst: vi.fn(),
    },
    space: {
      findFirst: vi.fn(),
    },
    service: {
      findFirst: vi.fn(),
    },
    request: {
      findFirst: vi.fn(),
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

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readdir: vi.fn(),
    stat: vi.fn(),
    mkdir: vi.fn(),
    rename: vi.fn(),
  },
}));

import { schedulerService } from '../../src/services/scheduler.service.js';
import { authService } from '../../src/services/auth.service.js';
import { uploadService } from '../../src/services/upload.service.js';
import { snapshotDailyMetrics } from '../../src/services/analytics.service.js';
import { prisma } from '../../src/config/database.js';
import { logger } from '../../src/config/logger.js';

describe('SchedulerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    schedulerService.stop();
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe('start/stop', () => {
    it('should start all scheduled tasks', () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);

      schedulerService.start();

      expect(logger.info).toHaveBeenCalledWith('Starting scheduler service...');
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Session cleanup scheduled'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Orphan file cleanup scheduled'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Deleted file cleanup scheduled'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('GDPR compliance checks scheduled'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Daily metrics snapshot scheduled'));
    });

    it('should stop all scheduled tasks', () => {
      schedulerService.start();
      schedulerService.stop();

      expect(logger.info).toHaveBeenCalledWith('Stopping scheduler service...');
    });

    it('should be safe to stop without starting', () => {
      expect(() => schedulerService.stop()).not.toThrow();
    });
  });

  describe('session cleanup', () => {
    it('should call cleanupExpiredSessions on start', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(5);

      schedulerService.start();

      // Allow the immediate cleanup to run (advance by a small amount)
      await vi.advanceTimersByTimeAsync(100);

      expect(authService.cleanupExpiredSessions).toHaveBeenCalled();
    });

    it('should log when sessions are cleaned', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(10);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(logger.info).toHaveBeenCalledWith('Cleaned up 10 expired sessions');
    });

    it('should not log when no sessions cleaned', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Cleaned up 0 expired sessions'));
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockRejectedValue(new Error('DB error'));

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(logger.error).toHaveBeenCalledWith(
        'Error cleaning up expired sessions:',
        expect.any(Error)
      );
    });
  });

  describe('deleted file cleanup', () => {
    it('should call cleanupExpiredDeletedFiles', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(uploadService.cleanupExpiredDeletedFiles).mockResolvedValue(3);

      schedulerService.start();

      // Advance timer past the startup delay (10 minutes)
      await vi.advanceTimersByTimeAsync(11 * 60 * 1000);

      expect(uploadService.cleanupExpiredDeletedFiles).toHaveBeenCalled();
    });

    it('should log when files are deleted', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(uploadService.cleanupExpiredDeletedFiles).mockResolvedValue(5);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(11 * 60 * 1000);

      expect(logger.info).toHaveBeenCalledWith('Permanently deleted 5 expired files');
    });
  });

  describe('GDPR compliance', () => {
    it('should check for pending deletions past deadline', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(authService.cleanupExpiredPasswordResetTokens).mockResolvedValue(0);
      vi.mocked(prisma.user.count).mockResolvedValue(2);

      schedulerService.start();

      // Advance timer past the startup delay (15 minutes)
      await vi.advanceTimersByTimeAsync(16 * 60 * 1000);

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: {
          accountStatus: 'DELETED',
          updatedDate: { lt: expect.any(Date) },
          email: { not: { contains: '@anonymized.local' } },
        },
      });
    });

    it('should log warning when pending deletions exist', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(authService.cleanupExpiredPasswordResetTokens).mockResolvedValue(0);
      vi.mocked(prisma.user.count).mockResolvedValue(3);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(16 * 60 * 1000);

      expect(logger.warn).toHaveBeenCalledWith(
        'GDPR ALERT: 3 user(s) pending anonymization past 30-day deadline'
      );
    });

    it('should cleanup expired password reset tokens', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(authService.cleanupExpiredPasswordResetTokens).mockResolvedValue(10);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(16 * 60 * 1000);

      expect(authService.cleanupExpiredPasswordResetTokens).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Cleaned up 10 expired password reset tokens');
    });
  });

  describe('daily metrics snapshot', () => {
    it('should schedule daily metrics snapshot at midnight', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(snapshotDailyMetrics).mockResolvedValue();

      schedulerService.start();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Daily metrics snapshot scheduled for midnight')
      );
    });

    it('should call snapshotDailyMetrics at midnight', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(snapshotDailyMetrics).mockResolvedValue();

      // Set current time to 23:59
      const now = new Date();
      now.setHours(23, 59, 0, 0);
      vi.setSystemTime(now);

      schedulerService.start();

      // Advance to midnight (1 minute + buffer)
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

      expect(snapshotDailyMetrics).toHaveBeenCalled();
    });

    it('should log success when daily metrics captured', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(snapshotDailyMetrics).mockResolvedValue();

      const now = new Date();
      now.setHours(23, 59, 0, 0);
      vi.setSystemTime(now);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

      expect(logger.info).toHaveBeenCalledWith('Daily metrics snapshot captured successfully');
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(authService.cleanupExpiredSessions).mockResolvedValue(0);
      vi.mocked(snapshotDailyMetrics).mockRejectedValue(new Error('DB error'));

      const now = new Date();
      now.setHours(23, 59, 0, 0);
      vi.setSystemTime(now);

      schedulerService.start();
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

      expect(logger.error).toHaveBeenCalledWith(
        'Error capturing daily metrics snapshot:',
        expect.any(Error)
      );
    });
  });
});
