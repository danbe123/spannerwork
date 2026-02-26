import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';

/**
 * Web Push Notification Service
 * 
 * Handles push notifications via the Web Push API.
 * Requires VAPID keys for authentication.
 */

// Check if web-push config is available
const hasWebPushConfig =
  !!env.VAPID_PUBLIC_KEY && !!env.VAPID_PRIVATE_KEY && !!env.VAPID_SUBJECT;

// Lazy load web-push to avoid errors if not configured
let webpushModule: typeof import('web-push') | null = null;

async function getWebPush(): Promise<typeof import('web-push') | null> {
  if (!hasWebPushConfig) {
    return null;
  }

  if (!webpushModule) {
    const imported = await import('web-push');
    // Handle both ESM default export and CommonJS module.exports
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webpushModule = (imported as any).default || imported;
    webpushModule!.setVapidDetails(
      env.VAPID_SUBJECT!,
      env.VAPID_PUBLIC_KEY!,
      env.VAPID_PRIVATE_KEY!
    );
  }

  return webpushModule;
}

export type PushSubscriptionData = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type NotificationPayload = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
};

/**
 * Subscribe a user to push notifications
 */
async function subscribe(userId: string, subscription: PushSubscriptionData): Promise<boolean> {
  try {
    // Check if subscription already exists
    const existing = await prisma.pushSubscription.findFirst({
      where: {
        userId,
        endpoint: subscription.endpoint,
      },
    });

    if (existing) {
      // Update keys if changed
      await prisma.pushSubscription.update({
        where: { id: existing.id },
        data: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          updatedAt: new Date(),
        },
      });
      logger.info('Push subscription updated', { userId });
      return true;
    }

    // Create new subscription
    await prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });

    logger.info('Push subscription created', { userId });
    return true;
  } catch (error) {
    logger.error('Failed to save push subscription', error);
    return false;
  }
}

/**
 * Unsubscribe a user from push notifications
 */
async function unsubscribe(userId: string, endpoint: string): Promise<boolean> {
  try {
    await prisma.pushSubscription.deleteMany({
      where: {
        userId,
        endpoint,
      },
    });

    logger.info('Push subscription removed', { userId });
    return true;
  } catch (error) {
    logger.error('Failed to remove push subscription', error);
    return false;
  }
}

/**
 * Unsubscribe all devices for a user
 */
async function unsubscribeAll(userId: string): Promise<boolean> {
  try {
    await prisma.pushSubscription.deleteMany({
      where: { userId },
    });

    logger.info('All push subscriptions removed', { userId });
    return true;
  } catch (error) {
    logger.error('Failed to remove all push subscriptions', error);
    return false;
  }
}

/**
 * Send push notification to a specific user
 */
async function sendToUser(userId: string, payload: NotificationPayload): Promise<void> {
  const wp = await getWebPush();
  
  if (!wp) {
    logger.warn('Push notification skipped: VAPID keys not configured');
    return;
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    logger.debug('No push subscriptions found for user', { userId });
    return;
  }

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/badge-72.png',
    tag: payload.tag,
    data: payload.data,
    actions: payload.actions,
  });

  const sendPromises = subscriptions.map(async (sub) => {
    try {
      await wp.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        notificationPayload
      );
      logger.debug('Push notification sent', { userId, endpoint: sub.endpoint.slice(0, 50) });
    } catch (error: unknown) {
      // Handle expired/invalid subscriptions
      const webPushError = error as { statusCode?: number; message?: string };
      if (webPushError.statusCode === 404 || webPushError.statusCode === 410) {
        logger.info('Removing expired push subscription', { userId });
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      } else {
        logger.error('Failed to send push notification', {
          userId,
          statusCode: webPushError.statusCode,
          message: webPushError.message,
        });
      }
    }
  });

  await Promise.allSettled(sendPromises);
}

/**
 * Send push notification to multiple users
 * Optimized to batch fetch all subscriptions in one query to avoid N+1
 */
async function sendToUsers(userIds: string[], payload: NotificationPayload): Promise<void> {
  const wp = await getWebPush();

  if (!wp) {
    logger.warn('Push notification skipped: VAPID keys not configured');
    return;
  }

  if (userIds.length === 0) {
    return;
  }

  // Batch fetch all subscriptions in ONE query to avoid N+1
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });

  if (subscriptions.length === 0) {
    logger.debug('No push subscriptions found for users', { userCount: userIds.length });
    return;
  }

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/badge-72.png',
    tag: payload.tag,
    data: payload.data,
    actions: payload.actions,
  });

  const sendPromises = subscriptions.map(async (sub) => {
    try {
      await wp.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        notificationPayload
      );
      logger.debug('Push notification sent', { userId: sub.userId, endpoint: sub.endpoint.slice(0, 50) });
    } catch (error: unknown) {
      // Handle expired/invalid subscriptions
      const webPushError = error as { statusCode?: number; message?: string };
      if (webPushError.statusCode === 404 || webPushError.statusCode === 410) {
        logger.info('Removing expired push subscription', { userId: sub.userId });
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      } else {
        logger.error('Failed to send push notification', {
          userId: sub.userId,
          statusCode: webPushError.statusCode,
          message: webPushError.message,
        });
      }
    }
  });

  await Promise.allSettled(sendPromises);
}

/**
 * Notification templates for common events
 */
const templates = {
  newMessage: (senderName: string, preview: string) => ({
    title: `New message from ${senderName}`,
    body: preview.length > 100 ? preview.slice(0, 97) + '...' : preview,
    tag: 'new-message',
    data: { type: 'message' },
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  }),

  bookingConfirmed: (resourceName: string) => ({
    title: 'Booking Confirmed! 🎉',
    body: `Your booking for ${resourceName} has been confirmed.`,
    tag: 'booking-confirmed',
    data: { type: 'booking' },
    actions: [{ action: 'view', title: 'View Details' }],
  }),

  bookingCancelled: (resourceName: string) => ({
    title: 'Booking Cancelled',
    body: `The booking for ${resourceName} has been cancelled.`,
    tag: 'booking-cancelled',
    data: { type: 'booking' },
  }),

  newBookingRequest: (resourceName: string, requesterName: string) => ({
    title: 'New Booking Request',
    body: `${requesterName} wants to book your ${resourceName}.`,
    tag: 'booking-request',
    data: { type: 'booking' },
    actions: [
      { action: 'accept', title: 'Accept' },
      { action: 'view', title: 'View' },
    ],
  }),

  paymentReceived: (amount: number) => ({
    title: 'Payment Received 💰',
    body: `You received £${(amount / 100).toFixed(2)}`,
    tag: 'payment',
    data: { type: 'payment' },
  }),

  reviewReceived: (rating: number, reviewerName: string) => ({
    title: `New ${rating}-Star Review ⭐`,
    body: `${reviewerName} left you a review.`,
    tag: 'review',
    data: { type: 'review' },
    actions: [{ action: 'view', title: 'View Review' }],
  }),

  disputeUpdate: (status: string) => ({
    title: 'Dispute Update',
    body: `Your dispute status has been updated to: ${status}`,
    tag: 'dispute',
    data: { type: 'dispute' },
  }),

  referralCompleted: (referredName: string) => ({
    title: 'Referral Reward! 🎁',
    body: `${referredName} completed their first transaction. You earned a reward!`,
    tag: 'referral',
    data: { type: 'referral' },
  }),
};

export const notificationService = {
  subscribe,
  unsubscribe,
  unsubscribeAll,
  sendToUser,
  sendToUsers,
  templates,
  
  // Convenience methods using templates
  async notifyNewMessage(userId: string, senderName: string, preview: string) {
    await sendToUser(userId, templates.newMessage(senderName, preview));
  },

  async notifyBookingConfirmed(userId: string, resourceName: string) {
    await sendToUser(userId, templates.bookingConfirmed(resourceName));
  },

  async notifyBookingCancelled(userId: string, resourceName: string) {
    await sendToUser(userId, templates.bookingCancelled(resourceName));
  },

  async notifyNewBookingRequest(userId: string, resourceName: string, requesterName: string) {
    await sendToUser(userId, templates.newBookingRequest(resourceName, requesterName));
  },

  async notifyPaymentReceived(userId: string, amount: number) {
    await sendToUser(userId, templates.paymentReceived(amount));
  },

  async notifyReviewReceived(userId: string, rating: number, reviewerName: string) {
    await sendToUser(userId, templates.reviewReceived(rating, reviewerName));
  },

  async notifyDisputeUpdate(userId: string, status: string) {
    await sendToUser(userId, templates.disputeUpdate(status));
  },

  async notifyReferralCompleted(userId: string, referredName: string) {
    await sendToUser(userId, templates.referralCompleted(referredName));
  },
};
