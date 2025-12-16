import { authService } from './auth.service.js';
import { uploadService } from './upload.service.js';
import { snapshotDailyMetrics } from './analytics.service.js';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

/**
 * Scheduler Service
 * Handles periodic cleanup and maintenance tasks
 */
class SchedulerService {
  private sessionCleanupInterval: NodeJS.Timeout | null = null;
  private orphanFileCleanupInterval: NodeJS.Timeout | null = null;
  private deletedFileCleanupInterval: NodeJS.Timeout | null = null;
  private gdprReminderInterval: NodeJS.Timeout | null = null;
  private dailyMetricsInterval: NodeJS.Timeout | null = null;

  private readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  private readonly ORPHAN_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly GDPR_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

  /**
   * Start all scheduled tasks
   */
  start() {
    logger.info('Starting scheduler service...');
    this.startSessionCleanup();
    this.startOrphanFileCleanup();
    this.startDeletedFileCleanup();
    this.startGdprReminders();
    this.startDailyMetricsSnapshot();
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    logger.info('Stopping scheduler service...');
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
      this.sessionCleanupInterval = null;
    }
    if (this.orphanFileCleanupInterval) {
      clearInterval(this.orphanFileCleanupInterval);
      this.orphanFileCleanupInterval = null;
    }
    if (this.deletedFileCleanupInterval) {
      clearInterval(this.deletedFileCleanupInterval);
      this.deletedFileCleanupInterval = null;
    }
    if (this.gdprReminderInterval) {
      clearInterval(this.gdprReminderInterval);
      this.gdprReminderInterval = null;
    }
    if (this.dailyMetricsInterval) {
      clearInterval(this.dailyMetricsInterval);
      this.dailyMetricsInterval = null;
    }
  }

  /**
   * Start periodic session cleanup
   */
  private startSessionCleanup() {
    // Run immediately on startup
    this.cleanupExpiredSessions();

    // Then run periodically
    this.sessionCleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.CLEANUP_INTERVAL_MS);

    logger.info(`Session cleanup scheduled every ${this.CLEANUP_INTERVAL_MS / 1000 / 60} minutes`);
  }

  /**
   * Clean up expired sessions
   */
  private async cleanupExpiredSessions() {
    try {
      const count = await authService.cleanupExpiredSessions();
      if (count > 0) {
        logger.info(`Cleaned up ${count} expired sessions`);
      }
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
    }
  }

  /**
   * Start periodic orphan file cleanup
   * Removes files uploaded but never associated with any resource
   */
  private startOrphanFileCleanup() {
    // Run after a delay on startup (let system stabilize)
    setTimeout(() => {
      this.cleanupOrphanFiles();
    }, 5 * 60 * 1000); // 5 minutes after startup

    // Then run daily
    this.orphanFileCleanupInterval = setInterval(() => {
      this.cleanupOrphanFiles();
    }, this.ORPHAN_CLEANUP_INTERVAL_MS);

    logger.info(`Orphan file cleanup scheduled every ${this.ORPHAN_CLEANUP_INTERVAL_MS / 1000 / 60 / 60} hours`);
  }

  /**
   * Clean up orphan files (uploaded but never used)
   * Files older than 24 hours that aren't referenced anywhere
   */
  private async cleanupOrphanFiles() {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      
      let cleanedCount = 0;
      
      try {
        const files = await fs.readdir(uploadsDir);
        
        for (const file of files) {
          // Skip directories and hidden files
          if (file.startsWith('.')) continue;
          
          const filePath = path.join(uploadsDir, file);
          const stats = await fs.stat(filePath);
          
          // Skip directories
          if (stats.isDirectory()) continue;
          
          // Skip recent files (less than 24 hours old)
          if (stats.mtimeMs > cutoffTime) continue;
          
          // Check if file is referenced anywhere
          const fileUrl = `/uploads/${file}`;
          const isReferenced = await this.isFileReferenced(fileUrl);
          
          if (!isReferenced) {
            // Move to trash instead of deleting immediately
            const trashDir = path.join(uploadsDir, '.trash');
            await fs.mkdir(trashDir, { recursive: true });
            await fs.rename(filePath, path.join(trashDir, file));
            cleanedCount++;
            logger.debug(`Moved orphan file to trash: ${file}`);
          }
        }
        
        if (cleanedCount > 0) {
          logger.info(`Cleaned up ${cleanedCount} orphan files`);
        }
      } catch (error) {
        // Directory might not exist yet
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    } catch (error) {
      logger.error('Error cleaning up orphan files:', error);
    }
  }

  /**
   * Check if a file URL is referenced in any database table
   */
  private async isFileReferenced(fileUrl: string): Promise<boolean> {
    const [user, tool, space, service, request] = await Promise.all([
      prisma.user.findFirst({ where: { avatar: fileUrl }, select: { id: true } }),
      prisma.tool.findFirst({ where: { photos: { has: fileUrl } }, select: { id: true } }),
      prisma.space.findFirst({ where: { photos: { has: fileUrl } }, select: { id: true } }),
      prisma.service.findFirst({ where: { photos: { has: fileUrl } }, select: { id: true } }),
      prisma.request.findFirst({ where: { photos: { has: fileUrl } }, select: { id: true } }),
    ]);
    
    return !!(user || tool || space || service || request);
  }

  /**
   * Start periodic cleanup of soft-deleted files past retention
   */
  private startDeletedFileCleanup() {
    // Run after a delay on startup
    setTimeout(() => {
      this.cleanupDeletedFiles();
    }, 10 * 60 * 1000); // 10 minutes after startup

    // Then run daily
    this.deletedFileCleanupInterval = setInterval(() => {
      this.cleanupDeletedFiles();
    }, this.ORPHAN_CLEANUP_INTERVAL_MS);

    logger.info('Deleted file cleanup scheduled daily');
  }

  /**
   * Permanently delete files past their retention period
   */
  private async cleanupDeletedFiles() {
    try {
      const count = await uploadService.cleanupExpiredDeletedFiles();
      if (count > 0) {
        logger.info(`Permanently deleted ${count} expired files`);
      }
    } catch (error) {
      logger.error('Error cleaning up deleted files:', error);
    }
  }

  /**
   * Start GDPR compliance reminders
   * Logs warnings for pending data export requests approaching deadline
   */
  private startGdprReminders() {
    // Run after startup
    setTimeout(() => {
      this.checkGdprCompliance();
    }, 15 * 60 * 1000); // 15 minutes after startup

    // Then run every 6 hours
    this.gdprReminderInterval = setInterval(() => {
      this.checkGdprCompliance();
    }, this.GDPR_CHECK_INTERVAL_MS);

    logger.info('GDPR compliance checks scheduled every 6 hours');
  }

  /**
   * Check for GDPR compliance issues
   * GDPR requires data export requests to be fulfilled within 30 days
   */
  private async checkGdprCompliance() {
    try {
      // Check for accounts marked as DELETED that haven't been anonymized
      // These should be processed within 30 days per GDPR
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const pendingDeletions = await prisma.user.count({
        where: {
          accountStatus: 'DELETED',
          updatedDate: { lt: thirtyDaysAgo },
          // Check if still has PII (not anonymized)
          email: { not: { contains: '@anonymized.local' } },
        },
      });

      if (pendingDeletions > 0) {
        logger.warn(`GDPR ALERT: ${pendingDeletions} user(s) pending anonymization past 30-day deadline`);
      }

      // Check for expired password reset tokens that should be cleaned up
      const expiredTokens = await authService.cleanupExpiredPasswordResetTokens();
      if (expiredTokens > 0) {
        logger.info(`Cleaned up ${expiredTokens} expired password reset tokens`);
      }
    } catch (error) {
      logger.error('Error checking GDPR compliance:', error);
    }
  }

  /**
   * Start daily metrics snapshot
   * Creates a snapshot of platform metrics at midnight
   */
  private startDailyMetricsSnapshot() {
    // Calculate time until next midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0); // Next midnight
    const msUntilMidnight = midnight.getTime() - now.getTime();

    // Run at next midnight, then every 24 hours
    setTimeout(() => {
      this.captureDailyMetrics();
      
      // Then run daily at midnight
      this.dailyMetricsInterval = setInterval(() => {
        this.captureDailyMetrics();
      }, 24 * 60 * 60 * 1000); // 24 hours
    }, msUntilMidnight);

    logger.info(`Daily metrics snapshot scheduled for midnight (in ${Math.round(msUntilMidnight / 1000 / 60)} minutes)`);
  }

  /**
   * Capture daily metrics snapshot
   */
  private async captureDailyMetrics() {
    try {
      await snapshotDailyMetrics();
      logger.info('Daily metrics snapshot captured successfully');
    } catch (error) {
      logger.error('Error capturing daily metrics snapshot:', error);
    }
  }
}

export const schedulerService = new SchedulerService();
