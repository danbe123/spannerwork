import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { notificationService, NotificationPayload } from './notification.service.js';
import { smsService } from './sms.service.js';
import { emailService } from './email.service.js';

/**
 * Unified Notification Service
 *
 * Coordinates notifications across all channels (push, email, SMS)
 * based on user preferences and notification type.
 */

export type NotificationChannel = 'push' | 'email' | 'sms';
export type NotificationType =
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'booking_cancelled'
  | 'payment_received'
  | 'payment_failed'
  | 'payment_issue' // FIX #9: For payment-related issues like instant payout failures
  | 'new_message'
  | 'new_booking_request'
  | 'review_received'
  | 'dispute_update'
  | 'insurance_expiry'
  | 'security_alert'
  | 'system_critical'
  | 'system_important'; // FIX #10: For important non-critical system notifications (badge changes, etc.)

interface UnifiedNotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  // Optional SMS-specific short message (max 160 chars recommended)
  smsBody?: string;
  // Optional email-specific subject (defaults to title)
  emailSubject?: string;
  // Push notification data
  pushData?: NotificationPayload['data'];
  pushActions?: NotificationPayload['actions'];
  // Force send regardless of preferences (for security alerts)
  forceSend?: boolean;
  // Which channels to use (defaults to all enabled)
  channels?: NotificationChannel[];
}

interface UserNotificationContext {
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
  };
  preferences: {
    emailEnabled: boolean;
    pushEnabled: boolean;
    smsEnabled: boolean;
    quietHoursStart: number | null;
    quietHoursEnd: number | null;
    // Specific notification type preferences
    bookingConfirmations: boolean;
    bookingReminders: boolean;
    paymentAlerts: boolean;
    reviewReminders: boolean;
  } | null;
}

/**
 * Check if current time is within quiet hours
 */
function isQuietHours(start: number | null, end: number | null): boolean {
  if (start === null || end === null) return false;

  const now = new Date();
  const currentHour = now.getHours();

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (start > end) {
    return currentHour >= start || currentHour < end;
  }

  // Same day quiet hours (e.g., 13:00 - 14:00)
  return currentHour >= start && currentHour < end;
}

/**
 * Get user and their notification preferences
 */
async function getUserContext(userId: string): Promise<UserNotificationContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      notificationPreferences: {
        select: {
          emailEnabled: true,
          pushEnabled: true,
          smsEnabled: true,
          quietHoursStart: true,
          quietHoursEnd: true,
          bookingConfirmations: true,
          bookingReminders: true,
          paymentAlerts: true,
          reviewReminders: true,
        },
      },
    },
  });

  if (!user) return null;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
    },
    preferences: user.notificationPreferences,
  };
}

/**
 * Check if notification type is allowed by user preferences
 */
function isNotificationTypeAllowed(
  type: NotificationType,
  preferences: UserNotificationContext['preferences']
): boolean {
  if (!preferences) return true; // Default to allow if no preferences set

  const typePreferenceMap: Record<NotificationType, keyof typeof preferences | null> = {
    booking_confirmation: 'bookingConfirmations',
    booking_reminder: 'bookingReminders',
    booking_cancelled: 'bookingConfirmations',
    payment_received: 'paymentAlerts',
    payment_failed: 'paymentAlerts',
    payment_issue: 'paymentAlerts', // FIX #9: Payment issues follow payment alerts preference
    new_message: null, // Always allow
    new_booking_request: 'bookingConfirmations',
    review_received: 'reviewReminders',
    dispute_update: null, // Always allow
    insurance_expiry: null, // Always allow
    security_alert: null, // Always allow
    system_critical: null, // Always allow
    system_important: null, // FIX #10: Important system notifications always allowed
  };

  const preferenceKey = typePreferenceMap[type];
  if (!preferenceKey) return true; // No specific preference, allow

  return preferences[preferenceKey] as boolean;
}

/**
 * Send notification via all configured and enabled channels
 */
async function send(payload: UnifiedNotificationPayload): Promise<{
  push: boolean;
  email: boolean;
  sms: boolean;
}> {
  const result = { push: false, email: false, sms: false };

  const context = await getUserContext(payload.userId);
  if (!context) {
    logger.warn('User not found for notification', { userId: payload.userId });
    return result;
  }

  const { user, preferences } = context;

  // Check if notification type is allowed
  if (!payload.forceSend && !isNotificationTypeAllowed(payload.type, preferences)) {
    logger.debug('Notification type disabled by user', { userId: user.id, type: payload.type });
    return result;
  }

  // Check quiet hours (skip for security alerts and critical)
  const isCritical = ['security_alert', 'system_critical'].includes(payload.type);
  const inQuietHours = !isCritical && !payload.forceSend &&
    isQuietHours(preferences?.quietHoursStart ?? null, preferences?.quietHoursEnd ?? null);

  if (inQuietHours) {
    logger.debug('Notification deferred due to quiet hours', { userId: user.id, type: payload.type });
    // Could queue for later, but for now just skip
    return result;
  }

  // Determine which channels to use
  const enabledChannels = payload.channels || ['push', 'email', 'sms'];

  // Send push notification
  if (enabledChannels.includes('push') && (payload.forceSend || preferences?.pushEnabled !== false)) {
    try {
      await notificationService.sendToUser(user.id, {
        title: payload.title,
        body: payload.body,
        data: payload.pushData,
        actions: payload.pushActions,
        tag: payload.type,
      });
      result.push = true;
    } catch (error) {
      logger.error('Failed to send push notification', { userId: user.id, error });
    }
  }

  // Send email notification
  if (enabledChannels.includes('email') && (payload.forceSend || preferences?.emailEnabled !== false)) {
    try {
      // Use generic notification email template
      await emailService.sendNotificationEmail(
        user.email,
        user.name || 'there',
        payload.emailSubject || payload.title,
        payload.body
      );
      result.email = true;
    } catch (error) {
      logger.error('Failed to send email notification', { userId: user.id, error });
    }
  }

  // Send SMS notification
  if (enabledChannels.includes('sms') &&
      user.phone &&
      (payload.forceSend || preferences?.smsEnabled === true)) {
    try {
      const smsBody = payload.smsBody ||
        `SpannerWork: ${payload.title}. ${payload.body}`.substring(0, 160);

      await smsService.sendSms({
        to: user.phone,
        body: smsBody,
      });
      result.sms = true;
      logger.info('SMS notification sent', { userId: user.id, type: payload.type });
    } catch (error) {
      logger.error('Failed to send SMS notification', { userId: user.id, error });
    }
  }

  return result;
}

/**
 * Send notification to multiple users
 */
async function sendToMany(
  userIds: string[],
  payload: Omit<UnifiedNotificationPayload, 'userId'>
): Promise<Map<string, { push: boolean; email: boolean; sms: boolean }>> {
  const results = new Map<string, { push: boolean; email: boolean; sms: boolean }>();

  // Process in parallel with concurrency limit
  const batchSize = 10;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (userId) => {
        const result = await send({ ...payload, userId });
        return { userId, result };
      })
    );

    batchResults.forEach(({ userId, result }) => {
      results.set(userId, result);
    });
  }

  return results;
}

// Convenience methods for common notification types
const templates = {
  async bookingConfirmed(userId: string, resourceName: string, startDate: Date) {
    const formattedDate = startDate.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    return send({
      userId,
      type: 'booking_confirmation',
      title: 'Booking Confirmed',
      body: `Your booking for ${resourceName} is confirmed for ${formattedDate}.`,
      smsBody: `SpannerWork: Booking confirmed for ${resourceName} on ${formattedDate}`,
      pushActions: [{ action: 'view', title: 'View Details' }],
    });
  },

  async bookingCancelled(userId: string, resourceName: string, reason?: string) {
    return send({
      userId,
      type: 'booking_cancelled',
      title: 'Booking Cancelled',
      body: reason
        ? `Your booking for ${resourceName} has been cancelled: ${reason}`
        : `Your booking for ${resourceName} has been cancelled.`,
      smsBody: `SpannerWork: Booking for ${resourceName} cancelled`,
    });
  },

  async bookingReminder(userId: string, resourceName: string, hoursUntil: number) {
    const timeText = hoursUntil === 1 ? '1 hour' : `${hoursUntil} hours`;

    return send({
      userId,
      type: 'booking_reminder',
      title: 'Booking Reminder',
      body: `Your rental of ${resourceName} starts in ${timeText}.`,
      smsBody: `SpannerWork: ${resourceName} booking starts in ${timeText}`,
      channels: ['push', 'sms'], // Skip email for reminders
    });
  },

  async newBookingRequest(userId: string, requesterName: string, resourceName: string) {
    return send({
      userId,
      type: 'new_booking_request',
      title: 'New Booking Request',
      body: `${requesterName} wants to book your ${resourceName}.`,
      smsBody: `SpannerWork: New booking request from ${requesterName} for ${resourceName}`,
      pushActions: [
        { action: 'accept', title: 'Accept' },
        { action: 'view', title: 'View' },
      ],
    });
  },

  async paymentReceived(userId: string, amount: number, fromName: string) {
    const formattedAmount = `£${(amount / 100).toFixed(2)}`;

    return send({
      userId,
      type: 'payment_received',
      title: 'Payment Received',
      body: `You received ${formattedAmount} from ${fromName}.`,
      smsBody: `SpannerWork: Payment received ${formattedAmount} from ${fromName}`,
    });
  },

  async paymentFailed(userId: string, amount: number, reason?: string) {
    const formattedAmount = `£${(amount / 100).toFixed(2)}`;

    return send({
      userId,
      type: 'payment_failed',
      title: 'Payment Failed',
      body: reason
        ? `Payment of ${formattedAmount} failed: ${reason}`
        : `Payment of ${formattedAmount} failed. Please update your payment method.`,
      smsBody: `SpannerWork: Payment of ${formattedAmount} failed. Check your payment method.`,
      channels: ['push', 'email', 'sms'], // Important - use all channels
    });
  },

  async newMessage(userId: string, senderName: string, preview: string) {
    return send({
      userId,
      type: 'new_message',
      title: `Message from ${senderName}`,
      body: preview.length > 100 ? preview.slice(0, 97) + '...' : preview,
      channels: ['push', 'email'], // Send both push and email for messages
    });
  },

  async reviewReceived(userId: string, reviewerName: string, rating: number) {
    return send({
      userId,
      type: 'review_received',
      title: `New ${rating}-Star Review`,
      body: `${reviewerName} left you a review.`,
      pushActions: [{ action: 'view', title: 'View Review' }],
      channels: ['push', 'email'], // No SMS for reviews
    });
  },

  async disputeUpdate(userId: string, status: string, disputeId: string) {
    return send({
      userId,
      type: 'dispute_update',
      title: 'Dispute Update',
      body: `Your dispute status has been updated to: ${status}`,
      smsBody: `SpannerWork: Dispute #${disputeId.slice(-6)} updated to ${status}`,
      pushData: { disputeId },
    });
  },

  async insuranceExpiry(userId: string, daysUntil: number) {
    return send({
      userId,
      type: 'insurance_expiry',
      title: 'Insurance Expiring Soon',
      body: `Your insurance expires in ${daysUntil} days. Update to continue listing.`,
      smsBody: `SpannerWork: Insurance expires in ${daysUntil} days. Please renew.`,
    });
  },

  async securityAlert(userId: string, message: string) {
    return send({
      userId,
      type: 'security_alert',
      title: 'Security Alert',
      body: message,
      smsBody: `SpannerWork Security: ${message.substring(0, 140)}`,
      forceSend: true, // Bypass preferences for security
    });
  },
};

export const unifiedNotificationService = {
  send,
  sendToMany,
  templates,
  getUserContext,
  isQuietHours,
};
