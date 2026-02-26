import { authService } from './auth.service.js';
import { uploadService } from './upload.service.js';
import { snapshotDailyMetrics } from './analytics.service.js';
import { insuranceService } from './insurance.service.js';
import { emailService } from './email.service.js';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { stripeService } from './stripe.service.js';

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
  private insuranceExpiryInterval: NodeJS.Timeout | null = null;
  private escrowExpiryInterval: NodeJS.Timeout | null = null;
  private requestExpiryInterval: NodeJS.Timeout | null = null;
  private webhookCleanupInterval: NodeJS.Timeout | null = null; // FIX #15: Webhook event cleanup
  private holdCleanupInterval: NodeJS.Timeout | null = null; // Availability hold cleanup

  private readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  private readonly HOLD_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  private readonly ORPHAN_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly GDPR_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
  private readonly INSURANCE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly ESCROW_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
  private readonly REQUEST_EXPIRY_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  private readonly WEBHOOK_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
    this.startInsuranceExpiryCheck();
    this.startEscrowExpiryCheck();
    this.startRequestExpiryCheck();
    this.startWebhookEventCleanup(); // FIX #15: Start webhook cleanup
    this.startHoldCleanup(); // Availability hold cleanup
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
    if (this.insuranceExpiryInterval) {
      clearInterval(this.insuranceExpiryInterval);
      this.insuranceExpiryInterval = null;
    }
    if (this.escrowExpiryInterval) {
      clearInterval(this.escrowExpiryInterval);
      this.escrowExpiryInterval = null;
    }
    if (this.requestExpiryInterval) {
      clearInterval(this.requestExpiryInterval);
      this.requestExpiryInterval = null;
    }
    if (this.webhookCleanupInterval) {
      clearInterval(this.webhookCleanupInterval);
      this.webhookCleanupInterval = null;
    }
    if (this.holdCleanupInterval) {
      clearInterval(this.holdCleanupInterval);
      this.holdCleanupInterval = null;
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

  /**
   * Start insurance expiry check
   * Sends reminders at 30 days, 14 days, 7 days, and 3 days before expiry
   */
  private startInsuranceExpiryCheck() {
    // Run after startup delay
    setTimeout(() => {
      this.checkInsuranceExpiry();
    }, 20 * 60 * 1000); // 20 minutes after startup

    // Then run daily
    this.insuranceExpiryInterval = setInterval(() => {
      this.checkInsuranceExpiry();
    }, this.INSURANCE_CHECK_INTERVAL_MS);

    logger.info('Insurance expiry check scheduled daily');
  }

  /**
   * Check for expiring insurance and send notifications
   * Also marks expired documents
   */
  private async checkInsuranceExpiry() {
    try {
      // First, mark any expired documents
      const expiredCount = await insuranceService.markExpiredDocuments();
      if (expiredCount > 0) {
        logger.info(`Marked ${expiredCount} insurance documents as expired`);
      }

      // Check for documents expiring at specific thresholds: 30, 14, 7, 3 days
      const thresholds = [30, 14, 7, 3];
      const now = new Date();

      for (const days of thresholds) {
        // Get documents expiring exactly on this threshold day (±12 hours to avoid duplicates)
        const targetDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        const windowStart = new Date(targetDate.getTime() - 12 * 60 * 60 * 1000);
        const windowEnd = new Date(targetDate.getTime() + 12 * 60 * 60 * 1000);

        const expiringDocs = await prisma.insuranceDocument.findMany({
          where: {
            status: 'APPROVED',
            expiryDate: {
              gte: windowStart,
              lte: windowEnd,
            },
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        for (const doc of expiringDocs) {
          try {
            await emailService.sendInsuranceExpiryReminderEmail(doc.user.email, {
              userName: doc.user.name,
              documentType: doc.documentType,
              expiryDate: doc.expiryDate!,
              daysUntilExpiry: days,
            });
            logger.info(`Sent ${days}-day insurance expiry reminder to user ${doc.user.id}`);
          } catch (emailError) {
            logger.error(`Failed to send insurance expiry reminder to user ${doc.user.id}:`, emailError);
          }
        }

        if (expiringDocs.length > 0) {
          logger.info(`Sent ${expiringDocs.length} insurance expiry reminders for ${days}-day threshold`);
        }
      }
    } catch (error) {
      logger.error('Error checking insurance expiry:', error);
    }
  }

  /**
   * Start escrow expiration check
   * Monitors transactions with escrow payments approaching the 7-day Stripe limit
   * Sends alerts at 48 hours, 24 hours, and 6 hours before expiry
   */
  private startEscrowExpiryCheck() {
    // Run after startup delay
    setTimeout(() => {
      this.checkEscrowExpiry();
    }, 25 * 60 * 1000); // 25 minutes after startup

    // Then run every 6 hours
    this.escrowExpiryInterval = setInterval(() => {
      this.checkEscrowExpiry();
    }, this.ESCROW_CHECK_INTERVAL_MS);

    logger.info('Escrow expiry check scheduled every 6 hours');
  }

  /**
   * Check for expiring escrow payments and auto-capture before Stripe expires them
   *
   * FIX #1: Auto-capture escrow payments before 7-day Stripe expiry
   * - 48h before: Send reminder to customer to confirm completion
   * - 24h before: Send urgent reminder
   * - 12h before: AUTO-CAPTURE payment to protect provider (work was done)
   *
   * Stripe auto-cancels uncaptured payments after 7 days, which would cause
   * providers to lose payment for completed work. We auto-capture at 12h
   * to ensure providers are protected.
   */
  private async checkEscrowExpiry() {
    try {
      if (!stripeService.isEnabled()) {
        return;
      }

      const now = new Date();

      // Auto-capture threshold: 12 hours before Stripe expiry
      // This gives buffer for any processing delays
      const AUTO_CAPTURE_HOURS_BEFORE_EXPIRY = 12;

      // Find transactions with escrow payments approaching expiry
      // We check for transactions in CONFIRMED or IN_PROGRESS status (payment authorized) that haven't been captured
      const expiringTransactions = await prisma.transaction.findMany({
        where: {
          status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
          paymentStatus: 'PENDING', // Not yet paid (escrowed)
          stripePaymentIntentId: { not: null },
          createdDate: {
            // 7 days - 48 hours = 5 days ago (approaching expiry)
            lte: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
          provider: { select: { id: true, email: true, name: true, stripeConnectId: true } },
          tool: { select: { name: true } },
          space: { select: { name: true } },
          service: { select: { name: true } },
        },
      });

      for (const transaction of expiringTransactions) {
        // Calculate time remaining until Stripe auto-cancellation (7 days from creation)
        const expiresAt = new Date(transaction.createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        const hoursRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / (60 * 60 * 1000));
        const resourceName = transaction.tool?.name || transaction.space?.name || transaction.service?.name || 'booking';

        // FIX #1: Auto-capture at 12 hours before expiry to protect provider
        if (hoursRemaining <= AUTO_CAPTURE_HOURS_BEFORE_EXPIRY && hoursRemaining > 0) {
          logger.warn(`AUTO-CAPTURING escrow for transaction ${transaction.id} (${hoursRemaining}h until expiry)`);

          try {
            // Verify the payment is still in escrow state before capturing
            const escrowStatus = await stripeService.getEscrowStatus(transaction.stripePaymentIntentId!);

            if (escrowStatus.requiresCapture) {
              // Calculate CPA fees before capture (same as manual capture)
              const rentalFee = Number(transaction.rentalFee || 0);
              const currentAppFee = Number(transaction.applicationFeeAmount || 0);
              const providerSponsorCpaFee = Math.round(rentalFee * ((transaction.providerSponsorCpaPercent || 0) / 100));
              const renterSponsorCpaFee = Math.round(rentalFee * ((transaction.renterSponsorCpaPercent || 0) / 100));
              const totalCpaFees = providerSponsorCpaFee + renterSponsorCpaFee;
              const updatedApplicationFeeAmount = currentAppFee + totalCpaFees;

              // Update application fee if CPA fees apply
              if (totalCpaFees > 0) {
                await stripeService.updateApplicationFee(transaction.stripePaymentIntentId!, updatedApplicationFeeAmount);
              }

              // Capture the payment
              const capture = await stripeService.capturePayment({
                paymentIntentId: transaction.stripePaymentIntentId!,
              });

              // Update transaction status
              await prisma.transaction.update({
                where: { id: transaction.id },
                data: {
                  status: 'COMPLETED',
                  paymentStatus: 'PAID',
                  completedDate: new Date(),
                  stripeTransferId: capture.transferId,
                  applicationFeeAmount: updatedApplicationFeeAmount,
                  providerSponsorCpaFee,
                  renterSponsorCpaFee,
                  notes: `${transaction.notes || ''}\n[System: Payment auto-captured ${hoursRemaining}h before escrow expiry]`.trim(),
                },
              });

              // Update transaction counts for both parties
              await prisma.user.update({
                where: { id: transaction.userId },
                data: { totalTransactions: { increment: 1 } },
              });
              if (transaction.providerId) {
                await prisma.user.update({
                  where: { id: transaction.providerId },
                  data: { totalTransactions: { increment: 1 } },
                });
              }

              logger.info(`Successfully auto-captured payment for transaction ${transaction.id}`);

              // Notify both parties
              try {
                await emailService.sendEscrowAutoCompletedEmail(transaction.user.email, {
                  userName: transaction.user.name,
                  resourceName,
                  transactionId: transaction.id,
                  amount: capture.amountCaptured,
                });

                if (transaction.provider?.email) {
                  await emailService.sendPaymentReleasedEmail(transaction.provider.email, {
                    providerName: transaction.provider.name,
                    resourceName,
                    transactionId: transaction.id,
                    amount: capture.amountCaptured - updatedApplicationFeeAmount,
                  });
                }
              } catch (notifyError) {
                logger.error(`Failed to send auto-capture notifications for ${transaction.id}:`, notifyError);
              }
            } else {
              logger.warn(`Transaction ${transaction.id} no longer requires capture (status: ${escrowStatus.status})`);
            }
          } catch (captureError) {
            logger.error(`Failed to auto-capture payment for transaction ${transaction.id}:`, captureError);

            // Mark as failed if capture fails
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                notes: `${transaction.notes || ''}\n[System: Auto-capture failed - manual intervention required]`.trim(),
              },
            });
          }
        } else if (hoursRemaining <= 48 && hoursRemaining > 24) {
          // 48h reminder
          logger.warn(`ESCROW ALERT: Transaction ${transaction.id} escrow expires in ${hoursRemaining} hours`);

          // Send reminder to customer
          try {
            await emailService.sendEscrowExpiryReminderEmail(transaction.user.email, {
              userName: transaction.user.name,
              resourceName,
              transactionId: transaction.id,
              hoursRemaining,
              providerName: transaction.provider?.name || 'Provider',
            });
          } catch (emailError) {
            logger.error(`Failed to send 48h escrow reminder for ${transaction.id}:`, emailError);
          }
        } else if (hoursRemaining <= 24 && hoursRemaining > AUTO_CAPTURE_HOURS_BEFORE_EXPIRY) {
          // 24h urgent reminder
          logger.warn(`ESCROW CRITICAL: Transaction ${transaction.id} escrow expires in ${hoursRemaining} hours`);

          // Send urgent reminder to customer
          try {
            await emailService.sendEscrowExpiryUrgentEmail(transaction.user.email, {
              userName: transaction.user.name,
              resourceName,
              transactionId: transaction.id,
              hoursRemaining,
              providerName: transaction.provider?.name || 'Provider',
            });
          } catch (emailError) {
            logger.error(`Failed to send 24h escrow reminder for ${transaction.id}:`, emailError);
          }
        }
      }

      // Mark any truly expired transactions (shouldn't happen with auto-capture, but safety check)
      const expiredTransactions = await prisma.transaction.findMany({
        where: {
          status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
          paymentStatus: 'PENDING',
          stripePaymentIntentId: { not: null },
          createdDate: {
            // More than 7 days ago
            lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      });

      for (const transaction of expiredTransactions) {
        logger.error(`ESCROW EXPIRED: Transaction ${transaction.id} - marking as cancelled (auto-capture should have prevented this)`);

        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'CANCELLED',
            paymentStatus: 'FAILED',
            notes: `${transaction.notes || ''}\n[System: Escrow payment expired after 7 days - automatically cancelled]`.trim(),
          },
        });
      }

      if (expiringTransactions.length > 0 || expiredTransactions.length > 0) {
        logger.info(`Escrow check: ${expiringTransactions.length} expiring (${expiringTransactions.filter(t => {
          const exp = new Date(t.createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
          return (exp.getTime() - now.getTime()) / (60 * 60 * 1000) <= AUTO_CAPTURE_HOURS_BEFORE_EXPIRY;
        }).length} auto-captured), ${expiredTransactions.length} expired`);
      }
    } catch (error) {
      logger.error('Error checking escrow expiry:', error);
    }
  }

  /**
   * FIX #11: Start request expiry check
   * Marks expired requests as EXPIRED status
   */
  private startRequestExpiryCheck() {
    // Run after startup delay
    setTimeout(() => {
      this.markExpiredRequests();
    }, 5 * 60 * 1000); // 5 minutes after startup

    // Then run hourly
    this.requestExpiryInterval = setInterval(() => {
      this.markExpiredRequests();
    }, this.REQUEST_EXPIRY_CHECK_INTERVAL_MS);

    logger.info('Request expiry check scheduled every hour');
  }

  /**
   * Mark expired requests as EXPIRED
   */
  private async markExpiredRequests() {
    try {
      const now = new Date();

      // Find and update all expired ACTIVE requests
      // Only update requests where expiresAt is set (not null) AND is in the past
      const result = await prisma.request.updateMany({
        where: {
          status: 'ACTIVE',
          expiresAt: { lt: now },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      if (result.count > 0) {
        logger.info(`Marked ${result.count} expired requests as EXPIRED`);
      }
    } catch (error) {
      logger.error('Error marking expired requests:', error);
    }
  }

  /**
   * FIX #15: Start periodic webhook event cleanup
   * Removes old webhook events to prevent unbounded table growth
   */
  private startWebhookEventCleanup() {
    // Run on startup
    this.cleanupExpiredWebhookEvents();

    // Then run periodically
    this.webhookCleanupInterval = setInterval(() => {
      this.cleanupExpiredWebhookEvents();
    }, this.WEBHOOK_CLEANUP_INTERVAL_MS);

    logger.info(`Webhook event cleanup scheduled every ${this.WEBHOOK_CLEANUP_INTERVAL_MS / 1000 / 60 / 60} hours`);
  }

  /**
   * FIX #15: Clean up old webhook events to prevent table bloat
   * Events older than 30 days are deleted in batches
   */
  private async cleanupExpiredWebhookEvents() {
    const RETENTION_DAYS = 30;
    const BATCH_SIZE = 1000;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

      // Delete in batches to avoid locking the table for too long
      let totalDeleted = 0;
      let deletedInBatch: number;

      do {
        // Delete up to BATCH_SIZE records at a time
        const result = await prisma.$executeRaw`
          DELETE FROM webhook_events
          WHERE "processedAt" < ${cutoffDate}
          AND "eventId" IN (
            SELECT "eventId" FROM webhook_events
            WHERE "processedAt" < ${cutoffDate}
            LIMIT ${BATCH_SIZE}
          )
        `;

        deletedInBatch = result;
        totalDeleted += deletedInBatch;

        // If we deleted a full batch, there might be more
        // Small delay to allow other queries to run
        if (deletedInBatch === BATCH_SIZE) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } while (deletedInBatch === BATCH_SIZE);

      if (totalDeleted > 0) {
        logger.info(`Cleaned up ${totalDeleted} expired webhook events (older than ${RETENTION_DAYS} days)`);
      }
    } catch (error) {
      logger.error('Error cleaning up expired webhook events:', error);
    }
  }

  /**
   * Start periodic availability hold cleanup
   * Removes expired holds to prevent database bloat
   */
  private startHoldCleanup() {
    // Run on startup
    this.cleanupExpiredHolds();

    // Then run periodically
    this.holdCleanupInterval = setInterval(() => {
      this.cleanupExpiredHolds();
    }, this.HOLD_CLEANUP_INTERVAL_MS);

    logger.info(`Availability hold cleanup scheduled every ${this.HOLD_CLEANUP_INTERVAL_MS / 1000 / 60} minutes`);
  }

  /**
   * Clean up expired availability holds
   */
  private async cleanupExpiredHolds() {
    try {
      const { availabilityHoldService } = await import('./availabilityHold.service.js');
      const count = await availabilityHoldService.cleanupExpiredHolds();
      if (count > 0) {
        logger.info(`Cleaned up ${count} expired availability holds`);
      }
    } catch (error) {
      logger.error('Error cleaning up expired holds:', error);
    }
  }
}

export const schedulerService = new SchedulerService();
