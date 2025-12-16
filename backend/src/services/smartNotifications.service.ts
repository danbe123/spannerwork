import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { notificationService } from './notification.service.js';
// Email notifications can be added here if needed

/**
 * Smart Notifications Service
 * 
 * Sends proactive, context-aware notifications:
 * - Rental ending reminders
 * - Review reminders after transactions
 * - Weekend availability reminders for providers
 * - Re-engagement for inactive users
 * - Streak maintenance reminders
 */

class SmartNotificationsService {
  private intervals: NodeJS.Timeout[] = [];

  /**
   * Start all smart notification jobs
   */
  start() {
    logger.info('Starting smart notifications service...');

    // Check every hour
    this.intervals.push(
      setInterval(() => this.checkRentalReminders(), 60 * 60 * 1000)
    );

    // Check every 6 hours
    this.intervals.push(
      setInterval(() => this.checkReviewReminders(), 6 * 60 * 60 * 1000)
    );

    // Check daily at 10am for weekend reminders (run every hour, filter by time)
    this.intervals.push(
      setInterval(() => this.checkWeekendAvailability(), 60 * 60 * 1000)
    );

    // Check daily for re-engagement
    this.intervals.push(
      setInterval(() => this.checkReengagement(), 24 * 60 * 60 * 1000)
    );

    // Run initial checks after 5 minutes
    setTimeout(() => {
      this.checkRentalReminders();
      this.checkReviewReminders();
    }, 5 * 60 * 1000);

    logger.info('Smart notifications scheduled');
  }

  /**
   * Stop all notification jobs
   */
  stop() {
    logger.info('Stopping smart notifications service...');
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
  }

  /**
   * Rental ending reminders
   * Notifies renters 24h and 2h before rental ends
   */
  async checkRentalReminders(): Promise<void> {
    try {
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);
      const in3Hours = new Date(now.getTime() + 3 * 60 * 60 * 1000);

      // Find rentals ending in ~24 hours
      const rentalsEnding24h = await prisma.transaction.findMany({
        where: {
          status: 'IN_PROGRESS',
          endDate: {
            gte: in24Hours,
            lt: in25Hours,
          },
        },
        include: {
          user: { select: { id: true, name: true } },
          tool: { select: { name: true } },
          space: { select: { name: true } },
          service: { select: { name: true } },
        },
      });

      for (const rental of rentalsEnding24h) {
        const itemName = rental.tool?.name || rental.space?.name || rental.service?.name || 'your rental';
        
        await notificationService.sendToUser(rental.userId, {
          title: '⏰ Rental Ending Tomorrow',
          body: `Your rental of ${itemName} ends in 24 hours. Need to extend?`,
          tag: `rental-reminder-24h-${rental.id}`,
          data: {
            type: 'rental-reminder',
            transactionId: rental.id,
            hoursRemaining: 24,
          },
          actions: [
            { action: 'extend', title: 'Extend Rental' },
            { action: 'view', title: 'View Details' },
          ],
        });

        logger.debug('Sent 24h rental reminder', { transactionId: rental.id });
      }

      // Find rentals ending in ~2 hours
      const rentalsEnding2h = await prisma.transaction.findMany({
        where: {
          status: 'IN_PROGRESS',
          endDate: {
            gte: in2Hours,
            lt: in3Hours,
          },
        },
        include: {
          user: { select: { id: true, name: true } },
          tool: { select: { name: true } },
          space: { select: { name: true } },
          service: { select: { name: true } },
        },
      });

      for (const rental of rentalsEnding2h) {
        const itemName = rental.tool?.name || rental.space?.name || rental.service?.name || 'your rental';
        
        await notificationService.sendToUser(rental.userId, {
          title: '🔔 Rental Ending Soon!',
          body: `${itemName} is due back in 2 hours.`,
          tag: `rental-reminder-2h-${rental.id}`,
          data: {
            type: 'rental-reminder',
            transactionId: rental.id,
            hoursRemaining: 2,
          },
          actions: [
            { action: 'extend', title: 'Extend' },
            { action: 'directions', title: 'Get Directions' },
          ],
        });

        logger.debug('Sent 2h rental reminder', { transactionId: rental.id });
      }

      logger.info('Rental reminders checked', {
        reminders24h: rentalsEnding24h.length,
        reminders2h: rentalsEnding2h.length,
      });
    } catch (error) {
      logger.error('Error checking rental reminders', error);
    }
  }

  /**
   * Review reminders
   * Reminds users to leave reviews 24h after transaction completion
   */
  async checkReviewReminders(): Promise<void> {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      // Find completed transactions from 24-48 hours ago without reviews
      const transactionsNeedingReview = await prisma.transaction.findMany({
        where: {
          status: 'COMPLETED',
          completedDate: {
            gte: twoDaysAgo,
            lt: yesterday,
          },
          reviews: {
            none: {},
          },
        },
        include: {
          user: { select: { id: true, name: true } },
          provider: { select: { id: true, name: true } },
          tool: { select: { name: true } },
          space: { select: { name: true } },
          service: { select: { name: true } },
        },
      });

      for (const transaction of transactionsNeedingReview) {
        const itemName = transaction.tool?.name || transaction.space?.name || transaction.service?.name || 'your recent rental';

        // Remind the renter to review the provider
        await notificationService.sendToUser(transaction.userId, {
          title: '⭐ How Was Your Experience?',
          body: `Leave a review for ${itemName} to help others.`,
          tag: `review-reminder-${transaction.id}`,
          data: {
            type: 'review-reminder',
            transactionId: transaction.id,
            reviewFor: 'provider',
          },
          actions: [
            { action: 'review', title: 'Leave Review' },
          ],
        });

        // Remind the provider to review the renter
        if (transaction.providerId) {
          await notificationService.sendToUser(transaction.providerId, {
            title: '⭐ Rate Your Renter',
            body: `How was ${transaction.user.name || 'your renter'}? Leave a review.`,
            tag: `review-reminder-provider-${transaction.id}`,
            data: {
              type: 'review-reminder',
              transactionId: transaction.id,
              reviewFor: 'user',
            },
            actions: [
              { action: 'review', title: 'Leave Review' },
            ],
          });
        }

        logger.debug('Sent review reminder', { transactionId: transaction.id });
      }

      logger.info('Review reminders sent', { count: transactionsNeedingReview.length });
    } catch (error) {
      logger.error('Error checking review reminders', error);
    }
  }

  /**
   * Weekend availability reminders
   * Notifies providers on Thursday if their listings have no bookings for the weekend
   */
  async checkWeekendAvailability(): Promise<void> {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 4 = Thursday
      const hour = now.getHours();

      // Only run on Thursday between 10-11 AM
      if (dayOfWeek !== 4 || hour !== 10) {
        return;
      }

      // Calculate weekend dates
      const friday = new Date(now);
      friday.setDate(friday.getDate() + 1);
      friday.setHours(0, 0, 0, 0);

      const monday = new Date(now);
      monday.setDate(monday.getDate() + 4);
      monday.setHours(0, 0, 0, 0);

      // Find providers with no weekend bookings
      const toolOwners = await prisma.tool.findMany({
        where: {
          available: true,
          transactions: {
            none: {
              startDate: { lte: monday },
              endDate: { gte: friday },
              status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
            },
          },
        },
        select: {
          ownerId: true,
          name: true,
        },
        distinct: ['ownerId'],
      });

      const spaceOwners = await prisma.space.findMany({
        where: {
          available: true,
          transactions: {
            none: {
              startDate: { lte: monday },
              endDate: { gte: friday },
              status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
            },
          },
        },
        select: {
          ownerId: true,
          name: true,
        },
        distinct: ['ownerId'],
      });

      // Combine and dedupe owners
      const ownerIds = new Set([
        ...toolOwners.map(t => t.ownerId),
        ...spaceOwners.map(s => s.ownerId),
      ]);

      for (const ownerId of ownerIds) {
        await notificationService.sendToUser(ownerId, {
          title: '📅 Weekend Slots Available',
          body: 'Your listings are free this weekend. Share them to earn more!',
          tag: 'weekend-availability',
          data: {
            type: 'weekend-reminder',
          },
          actions: [
            { action: 'share', title: 'Share Listings' },
            { action: 'view', title: 'View Calendar' },
          ],
        });
      }

      logger.info('Weekend availability reminders sent', { count: ownerIds.size });
    } catch (error) {
      logger.error('Error checking weekend availability', error);
    }
  }

  /**
   * Re-engagement notifications
   * Reaches out to users who haven't been active in 7+ days
   */
  async checkReengagement(): Promise<void> {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Find users inactive for 7-14 days who have completed at least one transaction
      const inactiveUsers = await prisma.user.findMany({
        where: {
          accountStatus: 'ACTIVE',
          updatedDate: {
            gte: fourteenDaysAgo,
            lt: sevenDaysAgo,
          },
          totalTransactions: { gte: 1 },
        },
        select: {
          id: true,
          name: true,
        },
        take: 50, // Limit to avoid spam
      });

      for (const user of inactiveUsers) {
        await notificationService.sendToUser(user.id, {
          title: '👋 We Miss You!',
          body: 'Check out new tools and services in your area.',
          tag: 'reengagement',
          data: {
            type: 'reengagement',
          },
          actions: [
            { action: 'browse', title: 'Browse Listings' },
          ],
        });

        logger.debug('Sent reengagement notification', { userId: user.id });
      }

      logger.info('Reengagement notifications sent', { count: inactiveUsers.length });
    } catch (error) {
      logger.error('Error checking reengagement', error);
    }
  }

  /**
   * Send a one-off smart notification
   */
  async sendContextualNotification(
    userId: string,
    context: 'first-listing' | 'first-request' | 'first-booking' | 'streak-at-risk' | 'milestone'
  ): Promise<void> {
    const notifications = {
      'first-listing': {
        title: '🎉 Your First Listing is Live!',
        body: 'Share it with friends to get your first booking faster.',
        tag: 'first-listing',
        data: { type: 'milestone' },
        actions: [{ action: 'share', title: 'Share' }],
      },
      'first-request': {
        title: '📝 Request Posted!',
        body: 'Providers in your area are being notified now.',
        tag: 'first-request',
        data: { type: 'milestone' },
      },
      'first-booking': {
        title: '🎉 First Booking Complete!',
        body: 'You earned the First Rental badge. Keep going!',
        tag: 'first-booking',
        data: { type: 'milestone' },
        actions: [{ action: 'view', title: 'View Badges' }],
      },
      'streak-at-risk': {
        title: '🔥 Your Streak is at Risk!',
        body: 'Complete a transaction today to keep your streak going.',
        tag: 'streak-risk',
        data: { type: 'streak' },
        actions: [{ action: 'browse', title: 'Find Something' }],
      },
      'milestone': {
        title: '🏆 New Achievement Unlocked!',
        body: 'Check your profile to see your new badge.',
        tag: 'milestone',
        data: { type: 'milestone' },
        actions: [{ action: 'view', title: 'View Badges' }],
      },
    };

    const notification = notifications[context];
    if (notification) {
      await notificationService.sendToUser(userId, notification);
    }
  }

  /**
   * Notify nearby users about a new listing
   */
  async notifyNearbyUsersOfNewListing(
    listingType: 'tool' | 'space' | 'service',
    listingId: string,
    listingName: string,
    postcode: string
  ): Promise<number> {
    try {
      // Get users in the same postcode area who might be interested
      const postcodeArea = postcode.split(' ')[0];

      const nearbyUsers = await prisma.user.findMany({
        where: {
          accountStatus: 'ACTIVE',
          postcode: { startsWith: postcodeArea },
          // Has made a request in this category before (interested)
          requestsCreated: { some: {} },
        },
        select: { id: true },
        take: 50,
      });

      for (const user of nearbyUsers) {
        await notificationService.sendToUser(user.id, {
          title: '📍 New Listing Near You',
          body: `${listingName} is now available in your area!`,
          tag: `new-listing-${listingId}`,
          data: {
            type: 'new-listing',
            listingType,
            listingId,
          },
          actions: [{ action: 'view', title: 'View' }],
        });
      }

      return nearbyUsers.length;
    } catch (error) {
      logger.error('Error notifying nearby users', error);
      return 0;
    }
  }
}

export const smartNotificationsService = new SmartNotificationsService();
