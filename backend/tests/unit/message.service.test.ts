/**
 * Message Service Unit Tests
 * 
 * Tests for messaging functionality including sending, receiving,
 * and conversation management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    message: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
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

vi.mock('../../src/services/websocket.service.js', () => ({
  websocketService: {
    sendToUser: vi.fn(),
  },
  notifyConversationRead: vi.fn(),
  notifyMessageRead: vi.fn(),
}));

import { messageService } from '../../src/services/message.service.js';
import { prisma } from '../../src/config/database.js';

describe('MessageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('send', () => {
    const senderId = 'sender-123';
    const recipientId = 'recipient-456';
    const content = 'Hello, world!';

    it('should create a new message', async () => {
      const mockMessage = {
        id: 'msg-1',
        senderId,
        recipientId,
        content,
        read: false,
        createdDate: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: recipientId, accountStatus: 'ACTIVE' } as any);
      vi.mocked(prisma.message.create).mockResolvedValue(mockMessage as any);

      const result = await messageService.send({
        senderId,
        recipientId,
        content,
      });

      expect(result).toEqual(mockMessage);
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          senderId,
          recipientId,
          content,
        },
        include: expect.any(Object),
      });
    });

    it('should throw error when recipient not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        messageService.send({ senderId, recipientId, content })
      ).rejects.toThrow('Recipient not found');
    });

    it('should throw error when sending to self', async () => {
      await expect(
        messageService.send({ senderId, recipientId: senderId, content })
      ).rejects.toThrow('Cannot send message to yourself');
    });

    it('should throw error for empty content', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: recipientId, accountStatus: 'ACTIVE' } as any);

      await expect(
        messageService.send({ senderId, recipientId, content: '' })
      ).rejects.toThrow();
    });
  });

  describe('getConversation', () => {
    const userId = 'user-123';
    const otherUserId = 'user-456';

    it('should return messages between two users', async () => {
      const mockMessages = [
        { id: 'msg-1', senderId: userId, recipientId: otherUserId, content: 'Hi', read: true },
        { id: 'msg-2', senderId: otherUserId, recipientId: userId, content: 'Hello', read: true },
      ];
      const mockOtherUser = { id: otherUserId, name: 'Other User', avatarUrl: null };

      // Mock the $transaction to execute the callback with a mock tx
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          message: {
            findMany: vi.fn().mockResolvedValue(mockMessages),
            count: vi.fn().mockResolvedValue(2),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          user: {
            findUnique: vi.fn().mockResolvedValue(mockOtherUser),
          },
        };
        return callback(mockTx);
      });

      const result = await messageService.getConversation(userId, otherUserId);

      expect(result.messages.reverse()).toEqual(mockMessages);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should paginate results', async () => {
      const mockOtherUser = { id: otherUserId, name: 'Other User', avatarUrl: null };

      // Mock the $transaction to execute the callback with a mock tx
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          message: {
            findMany: vi.fn().mockResolvedValue([]),
            count: vi.fn().mockResolvedValue(0),
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
          user: {
            findUnique: vi.fn().mockResolvedValue(mockOtherUser),
          },
        };
        return callback(mockTx);
      });

      const result = await messageService.getConversation(userId, otherUserId, { page: 2, limit: 10 });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('listConversations', () => {
    const userId = 'user-123';

    it('should return list of conversations with last message', async () => {
      // Mock findMany for getting distinct user IDs
      vi.mocked(prisma.message.findMany)
        .mockResolvedValueOnce([{ recipientId: 'user-456' }] as any) // as sender
        .mockResolvedValueOnce([{ senderId: 'user-789' }] as any); // as recipient

      // Mock batch user fetch
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'user-456', name: 'John', email: 'john@test.com', avatar: null, rating: 4.5 },
        { id: 'user-789', name: 'Jane', email: 'jane@test.com', avatar: null, rating: 4.0 },
      ] as any);

      // Mock raw queries for unread counts and last messages
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([{ senderId: 'user-456', count: BigInt(2) }] as any) // unread counts
        .mockResolvedValueOnce([
          { 
            id: 'msg-1', 
            senderId: 'user-456', 
            recipientId: userId, 
            content: 'Hello',
            read: false,
            createdDate: new Date(),
            otherUserId: 'user-456',
            senderName: 'John',
            senderAvatar: null,
          },
          { 
            id: 'msg-2', 
            senderId: userId, 
            recipientId: 'user-789', 
            content: 'Hi there',
            read: true,
            createdDate: new Date(Date.now() - 1000),
            otherUserId: 'user-789',
            senderName: 'Test User',
            senderAvatar: null,
          },
        ] as any); // last messages

      const result = await messageService.listConversations(userId);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should return empty array when user has no conversations', async () => {
      vi.mocked(prisma.message.findMany)
        .mockResolvedValueOnce([]) // as sender
        .mockResolvedValueOnce([]); // as recipient

      const result = await messageService.listConversations(userId);

      expect(result).toEqual([]);
    });
  });

  describe('markAsRead', () => {
    const messageId = 'msg-123';
    const userId = 'user-123';

    it('should mark message as read', async () => {
      const mockMessage = {
        id: messageId,
        recipientId: userId,
        senderId: 'sender-123',
        read: false,
      };

      (prisma.message.findUnique as any).mockResolvedValue(mockMessage);
      (prisma.message.update as any).mockResolvedValue({ ...mockMessage, read: true, readAt: new Date() });

      await messageService.markAsRead(messageId, userId);

      expect(prisma.message.update).toHaveBeenCalledWith({
        where: { id: messageId },
        data: { read: true, readAt: expect.any(Date) },
      });
    });

    it('should throw error when message not found', async () => {
      (prisma.message.findUnique as any).mockResolvedValue(null);

      await expect(
        messageService.markAsRead(messageId, userId)
      ).rejects.toThrow('Message not found');
    });

    it('should throw error when user is not recipient', async () => {
      (prisma.message.findUnique as any).mockResolvedValue({
        id: messageId,
        recipientId: 'other-user',
      });

      await expect(
        messageService.markAsRead(messageId, userId)
      ).rejects.toThrow();
    });
  });

  describe('markConversationAsRead', () => {
    const userId = 'user-123';
    const otherUserId = 'user-456';

    it('should mark all messages in conversation as read', async () => {
      vi.mocked(prisma.message.updateMany).mockResolvedValue({ count: 5 } as any);

      const result = await messageService.markConversationAsRead(userId, otherUserId);

      expect(result.count).toBe(5);
      expect(prisma.message.updateMany).toHaveBeenCalledWith({
        where: {
          senderId: otherUserId,
          recipientId: userId,
          read: false,
        },
        data: {
          read: true,
          readAt: expect.any(Date),
        },
      });
    });
  });

  describe('getUnreadCount', () => {
    const userId = 'user-123';

    it('should return count of unread messages', async () => {
      vi.mocked(prisma.message.count).mockResolvedValue(10);

      const result = await messageService.getUnreadCount(userId);

      expect(result).toBe(10);
      expect(prisma.message.count).toHaveBeenCalledWith({
        where: {
          recipientId: userId,
          read: false,
        },
      });
    });
  });
});
