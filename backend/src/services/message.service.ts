import { prisma } from '../config/database.js';
import { Prisma } from '@prisma/client';
import { NotFoundError, BadRequestError, ForbiddenError, TooManyRequestsError } from '../utils/errors.js';
import { notifyMessageRead, notifyConversationRead } from './websocket.service.js';
import { redis, isRedisAvailable, prefixKey } from '../config/redis.js';
import { logger } from '../config/logger.js';

// Rate limiting constants for message abuse prevention
const MESSAGE_RATE_LIMIT = {
  // Global messages per hour per user
  GLOBAL_MAX_PER_HOUR: 100,
  GLOBAL_WINDOW_SECONDS: 3600,
  // Messages to same recipient per hour
  PER_RECIPIENT_MAX_PER_HOUR: 20,
  PER_RECIPIENT_WINDOW_SECONDS: 3600,
  // Maximum message length
  MAX_MESSAGE_LENGTH: 5000,
  // Fallback limits when Redis is down (more restrictive)
  FALLBACK_GLOBAL_MAX_PER_HOUR: 30,
  FALLBACK_PER_RECIPIENT_MAX_PER_HOUR: 10,
};

// In-memory fallback rate limiting when Redis is unavailable
const memoryRateLimits = new Map<string, { count: number; resetAt: number }>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memoryRateLimits.entries()) {
    if (now > value.resetAt) {
      memoryRateLimits.delete(key);
    }
  }
}, 5 * 60 * 1000);

function checkMemoryRateLimit(key: string, maxCount: number, windowSeconds: number): boolean {
  const now = Date.now();
  const existing = memoryRateLimits.get(key);

  if (!existing || now > existing.resetAt) {
    memoryRateLimits.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }

  if (existing.count >= maxCount) {
    return false;
  }

  existing.count++;
  return true;
}

export class MessageService {
  /**
   * Check rate limits for message sending
   */
  private async checkRateLimits(senderId: string, recipientId: string): Promise<void> {
    if (!isRedisAvailable()) {
      // FIX: Use in-memory fallback with stricter limits when Redis is unavailable
      logger.warn('Redis not available for message rate limiting, using memory fallback');

      // Check global rate limit with fallback
      const globalKey = `msg_rate:global:${senderId}`;
      if (!checkMemoryRateLimit(globalKey, MESSAGE_RATE_LIMIT.FALLBACK_GLOBAL_MAX_PER_HOUR, MESSAGE_RATE_LIMIT.GLOBAL_WINDOW_SECONDS)) {
        throw new TooManyRequestsError(
          `You have sent too many messages. Please wait before sending more.`,
          MESSAGE_RATE_LIMIT.GLOBAL_WINDOW_SECONDS
        );
      }

      // Check per-recipient rate limit with fallback
      const recipientKey = `msg_rate:user:${senderId}:${recipientId}`;
      if (!checkMemoryRateLimit(recipientKey, MESSAGE_RATE_LIMIT.FALLBACK_PER_RECIPIENT_MAX_PER_HOUR, MESSAGE_RATE_LIMIT.PER_RECIPIENT_WINDOW_SECONDS)) {
        throw new TooManyRequestsError(
          `You have sent too many messages to this user. Please wait before sending more.`,
          MESSAGE_RATE_LIMIT.PER_RECIPIENT_WINDOW_SECONDS
        );
      }

      return;
    }

    // Check global rate limit (messages per hour across all recipients)
    // Use prefixKey for Cloudways Redis ACL compliance
    const globalKey = prefixKey(`msg_rate:global:${senderId}`);
    const globalCount = await redis.incr(globalKey);
    if (globalCount === 1) {
      await redis.expire(globalKey, MESSAGE_RATE_LIMIT.GLOBAL_WINDOW_SECONDS);
    }

    if (globalCount > MESSAGE_RATE_LIMIT.GLOBAL_MAX_PER_HOUR) {
      logger.warn('Message rate limit exceeded (global)', { senderId, count: globalCount });
      throw new TooManyRequestsError(
        `You have sent too many messages. Please wait before sending more.`,
        MESSAGE_RATE_LIMIT.GLOBAL_WINDOW_SECONDS
      );
    }

    // Check per-recipient rate limit (prevent harassment of single user)
    // Use prefixKey for Cloudways Redis ACL compliance
    const recipientKey = prefixKey(`msg_rate:user:${senderId}:${recipientId}`);
    const recipientCount = await redis.incr(recipientKey);
    if (recipientCount === 1) {
      await redis.expire(recipientKey, MESSAGE_RATE_LIMIT.PER_RECIPIENT_WINDOW_SECONDS);
    }

    if (recipientCount > MESSAGE_RATE_LIMIT.PER_RECIPIENT_MAX_PER_HOUR) {
      logger.warn('Message rate limit exceeded (per-recipient)', { senderId, recipientId, count: recipientCount });
      throw new TooManyRequestsError(
        `You have sent too many messages to this user. Please wait before sending more.`,
        MESSAGE_RATE_LIMIT.PER_RECIPIENT_WINDOW_SECONDS
      );
    }
  }

  /**
   * Send a message
   */
  async send(data: { senderId: string; recipientId: string; content: string }) {
    // Validate content is not empty
    if (!data.content || data.content.trim().length === 0) {
      throw new BadRequestError('Message content cannot be empty');
    }

    // SECURITY: Validate message length to prevent abuse
    if (data.content.length > MESSAGE_RATE_LIMIT.MAX_MESSAGE_LENGTH) {
      throw new BadRequestError(
        `Message too long. Maximum length is ${MESSAGE_RATE_LIMIT.MAX_MESSAGE_LENGTH} characters.`
      );
    }

    // Prevent sending messages to self
    if (data.senderId === data.recipientId) {
      throw new BadRequestError('Cannot send message to yourself');
    }

    // SECURITY: Check rate limits before proceeding
    await this.checkRateLimits(data.senderId, data.recipientId);

    // Check if recipient exists
    const recipient = await prisma.user.findUnique({
      where: { id: data.recipientId },
      select: { id: true, accountStatus: true },
    });

    if (!recipient) {
      throw new NotFoundError('Recipient not found');
    }

    if (recipient.accountStatus !== 'ACTIVE') {
      throw new BadRequestError('Cannot send message to inactive user');
    }

    const message = await prisma.message.create({
      data: {
        senderId: data.senderId,
        recipientId: data.recipientId,
        content: data.content,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    return message;
  }

  /**
   * Get conversation between two users
   * Uses a transaction to atomically fetch messages and mark them as read
   */
  async getConversation(
    userId: string,
    otherUserId: string,
    options: { page?: number; limit?: number } = {}
  ) {
    const { page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.MessageWhereInput = {
      OR: [
        { senderId: userId, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: userId },
      ],
    };

    // Use transaction to ensure consistent read state
    const result = await prisma.$transaction(async (tx) => {
      const [messages, total, otherUser] = await Promise.all([
        tx.message.findMany({
          where,
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
            recipient: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdDate: 'desc' },
          skip,
          take: limit,
        }),
        tx.message.count({ where }),
        // Fetch the other user's details
        tx.user.findUnique({
          where: { id: otherUserId },
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            rating: true,
          },
        }),
      ]);

      // Mark unread messages as read for the current user
      const readAt = new Date();
      const readResult = await tx.message.updateMany({
        where: {
          senderId: otherUserId,
          recipientId: userId,
          read: false,
        },
        data: {
          read: true,
          readAt,
        },
      });

      return { messages, total, otherUser, readCount: readResult.count, readAt };
    });

    // Notify sender that their messages were read (outside transaction)
    if (result.readCount > 0) {
      notifyConversationRead(otherUserId, {
        recipientId: userId,
        readAt: result.readAt.toISOString(),
        count: result.readCount,
      });
    }

    return {
      messages: result.messages.reverse(), // Return in chronological order
      otherUser: result.otherUser,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  /**
   * List all conversations for a user
   * Optimized to avoid N+1 queries by batching database calls
   */
  async listConversations(userId: string) {
    // Get all users the current user has messaged with in parallel
    const [messagesAsSender, messagesAsRecipient] = await Promise.all([
      prisma.message.findMany({
        where: { senderId: userId },
        select: { recipientId: true },
        distinct: ['recipientId'],
      }),
      prisma.message.findMany({
        where: { recipientId: userId },
        select: { senderId: true },
        distinct: ['senderId'],
      }),
    ]);

    // Combine and deduplicate user IDs
    const userIds = Array.from(new Set([
      ...messagesAsSender.map((m) => m.recipientId),
      ...messagesAsRecipient.map((m) => m.senderId),
    ]));

    if (userIds.length === 0) {
      return [];
    }

    // Batch fetch all required data to avoid N+1 queries
    const [users, unreadCounts, lastMessages] = await Promise.all([
      // Fetch all other users in one query
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          rating: true,
        },
      }),

      // Get unread counts grouped by sender using raw query for efficiency
      prisma.$queryRaw<{ senderId: string; count: bigint }[]>`
        SELECT "senderId", COUNT(*) as count
        FROM messages
        WHERE "recipientId" = ${userId}
          AND read = false
          AND "senderId" = ANY(${userIds})
        GROUP BY "senderId"
      `,

      // Get last message for each conversation using a subquery approach
      // First compute otherUserId in subquery, then use DISTINCT ON
      prisma.$queryRaw<{
        id: string;
        senderId: string;
        recipientId: string;
        content: string;
        read: boolean;
        createdDate: Date;
        otherUserId: string;
        senderName: string | null;
        senderAvatar: string | null;
      }[]>`
        SELECT DISTINCT ON (sub."otherUserId")
          sub.id,
          sub."senderId",
          sub."recipientId",
          sub.content,
          sub.read,
          sub."createdDate",
          sub."otherUserId",
          sub."senderName",
          sub."senderAvatar"
        FROM (
          SELECT
            m.id,
            m."senderId",
            m."recipientId",
            m.content,
            m.read,
            m."createdDate",
            CASE
              WHEN m."senderId" = ${userId} THEN m."recipientId"
              ELSE m."senderId"
            END as "otherUserId",
            s.name as "senderName",
            s.avatar as "senderAvatar"
          FROM messages m
          LEFT JOIN users s ON s.id = m."senderId"
          WHERE (m."senderId" = ${userId} OR m."recipientId" = ${userId})
            AND (
              (m."senderId" = ${userId} AND m."recipientId" = ANY(${userIds}))
              OR (m."recipientId" = ${userId} AND m."senderId" = ANY(${userIds}))
            )
        ) sub
        ORDER BY sub."otherUserId", sub."createdDate" DESC
      `,
    ]);

    // Build lookup maps for O(1) access
    const userMap = new Map(users.map(u => [u.id, u]));
    const unreadMap = new Map(unreadCounts.map(u => [u.senderId, Number(u.count)]));
    const lastMessageMap = new Map(lastMessages.map(m => [m.otherUserId, m]));

    // Assemble conversations
    const conversations = userIds.map(otherUserId => {
      const lastMsg = lastMessageMap.get(otherUserId);
      return {
        user: userMap.get(otherUserId) || null,
        lastMessage: lastMsg ? {
          id: lastMsg.id,
          senderId: lastMsg.senderId,
          recipientId: lastMsg.recipientId,
          content: lastMsg.content,
          read: lastMsg.read,
          createdDate: lastMsg.createdDate,
          sender: {
            id: lastMsg.senderId,
            name: lastMsg.senderName,
            avatar: lastMsg.senderAvatar,
          },
        } : null,
        unreadCount: unreadMap.get(otherUserId) || 0,
      };
    });

    // Sort by last message date (most recent first)
    return conversations.sort((a, b) => {
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdDate).getTime() - new Date(a.lastMessage.createdDate).getTime();
    });
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string, userId: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { recipientId: true, senderId: true, read: true },
    });

    if (!message) {
      throw new NotFoundError('Message not found');
    }

    if (message.recipientId !== userId) {
      throw new ForbiddenError('Not authorized to mark this message as read');
    }

    // Skip if already read
    if (message.read) {
      return prisma.message.findUnique({ where: { id: messageId } });
    }

    const readAt = new Date();
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { read: true, readAt },
    });

    // Notify sender that message was read
    notifyMessageRead(message.senderId, {
      messageId,
      recipientId: userId,
      readAt: readAt.toISOString(),
    });

    return updatedMessage;
  }

  /**
   * Mark all messages from a user as read
   */
  async markConversationAsRead(userId: string, otherUserId: string) {
    const readAt = new Date();

    const result = await prisma.message.updateMany({
      where: {
        senderId: otherUserId,
        recipientId: userId,
        read: false,
      },
      data: {
        read: true,
        readAt,
      },
    });

    // Notify sender that their messages were read
    if (result.count > 0) {
      notifyConversationRead(otherUserId, {
        recipientId: userId,
        readAt: readAt.toISOString(),
        count: result.count,
      });
    }

    return result;
  }

  /**
   * Get unread message count
   */
  async getUnreadCount(userId: string) {
    return prisma.message.count({
      where: {
        recipientId: userId,
        read: false,
      },
    });
  }
}

export const messageService = new MessageService();
