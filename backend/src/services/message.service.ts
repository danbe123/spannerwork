import { prisma } from '../config/database.js';
import { Prisma } from '@prisma/client';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';

export class MessageService {
  /**
   * Send a message
   */
  async send(data: { senderId: string; recipientId: string; content: string }) {
    // Validate content is not empty
    if (!data.content || data.content.trim().length === 0) {
      throw new BadRequestError('Message content cannot be empty');
    }

    // Prevent sending messages to self
    if (data.senderId === data.recipientId) {
      throw new BadRequestError('Cannot send message to yourself');
    }

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
      const [messages, total] = await Promise.all([
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
      ]);

      // Mark unread messages as read for the current user
      await tx.message.updateMany({
        where: {
          senderId: otherUserId,
          recipientId: userId,
          read: false,
        },
        data: {
          read: true,
        },
      });

      return { messages, total };
    });

    return {
      messages: result.messages.reverse(), // Return in chronological order
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

      // Get last message for each conversation using a lateral join for efficiency
      // This gets the most recent message for each user pair in a single query
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
        SELECT DISTINCT ON (other_user_id) 
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
        ORDER BY other_user_id, m."createdDate" DESC
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
      select: { recipientId: true },
    });

    if (!message) {
      throw new NotFoundError('Message not found');
    }

    if (message.recipientId !== userId) {
      throw new ForbiddenError('Not authorized to mark this message as read');
    }

    return prisma.message.update({
      where: { id: messageId },
      data: { read: true },
    });
  }

  /**
   * Mark all messages from a user as read
   */
  async markConversationAsRead(userId: string, otherUserId: string) {
    return prisma.message.updateMany({
      where: {
        senderId: otherUserId,
        recipientId: userId,
        read: false,
      },
      data: {
        read: true,
      },
    });
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
