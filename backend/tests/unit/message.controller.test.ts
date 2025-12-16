import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';

// Mock dependencies before imports
vi.mock('../../src/config/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockSend = vi.hoisted(() => vi.fn());
const mockGetConversation = vi.hoisted(() => vi.fn());
const mockListConversations = vi.hoisted(() => vi.fn());
const mockMarkAsRead = vi.hoisted(() => vi.fn());
const mockMarkConversationAsRead = vi.hoisted(() => vi.fn());
const mockGetUnreadCount = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/message.service.js', () => ({
  messageService: {
    send: mockSend,
    getConversation: mockGetConversation,
    listConversations: mockListConversations,
    markAsRead: mockMarkAsRead,
    markConversationAsRead: mockMarkConversationAsRead,
    getUnreadCount: mockGetUnreadCount,
  },
}));

import { MessageController, messageController } from '../../src/controllers/message.controller.js';
import { logger } from '../../src/config/logger.js';

// Helper to create mock request - use any to avoid Express type complexity in tests
function createMockRequest(overrides: Record<string, any> = {}): any {
  return {
    body: {},
    params: {},
    query: {},
    user: { id: 'user-1' },
    ...overrides,
  };
}

// Helper to create mock response
function createMockResponse(): Partial<Response> {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe('Message Controller', () => {
  let controller: MessageController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new MessageController();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('send', () => {
    it('sends message and returns 201', async () => {
      const mockMessage = { id: 'msg-1', content: 'Hello' };
      mockSend.mockResolvedValue(mockMessage);

      const req = createMockRequest({
        body: { recipientId: 'user-2', content: 'Hello' },
      });
      const res = createMockResponse();

      await controller.send(req as Request, res as Response);

      expect(mockSend).toHaveBeenCalledWith({
        senderId: 'user-1',
        recipientId: 'user-2',
        content: 'Hello',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Message sent',
        data: mockMessage,
      });
    });

    it('returns 400 when sending to self', async () => {
      const req = createMockRequest({
        body: { recipientId: 'user-1', content: 'Hello' },
      });
      const res = createMockResponse();

      await controller.send(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Cannot send message to yourself',
      });
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('returns 404 when recipient not found', async () => {
      mockSend.mockRejectedValue(new Error('Recipient not found'));

      const req = createMockRequest({
        body: { recipientId: 'nonexistent', content: 'Hello' },
      });
      const res = createMockResponse();

      await controller.send(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Recipient not found',
      });
    });

    it('returns 400 when sending to inactive user', async () => {
      mockSend.mockRejectedValue(new Error('Cannot message inactive user'));

      const req = createMockRequest({
        body: { recipientId: 'user-2', content: 'Hello' },
      });
      const res = createMockResponse();

      await controller.send(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 500 on unexpected error', async () => {
      mockSend.mockRejectedValue(new Error('Database error'));

      const req = createMockRequest({
        body: { recipientId: 'user-2', content: 'Hello' },
      });
      const res = createMockResponse();

      await controller.send(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getConversation', () => {
    it('returns conversation with pagination', async () => {
      const mockResult = {
        messages: [{ id: 'msg-1' }],
        pagination: { page: 1, limit: 20, total: 1 },
      };
      mockGetConversation.mockResolvedValue(mockResult);

      const req = createMockRequest({
        params: { userId: 'user-2' },
        query: { page: '1', limit: '20' },
      });
      const res = createMockResponse();

      await controller.getConversation(req as Request, res as Response);

      expect(mockGetConversation).toHaveBeenCalledWith('user-1', 'user-2', {
        page: 1,
        limit: 20,
      });
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('handles missing pagination params', async () => {
      mockGetConversation.mockResolvedValue({ messages: [] });

      const req = createMockRequest({
        params: { userId: 'user-2' },
        query: {},
      });
      const res = createMockResponse();

      await controller.getConversation(req as Request, res as Response);

      expect(mockGetConversation).toHaveBeenCalledWith('user-1', 'user-2', {
        page: undefined,
        limit: undefined,
      });
    });

    it('returns 500 on error', async () => {
      mockGetConversation.mockRejectedValue(new Error('DB error'));

      const req = createMockRequest({
        params: { userId: 'user-2' },
      });
      const res = createMockResponse();

      await controller.getConversation(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('listConversations', () => {
    it('returns all conversations', async () => {
      const conversations = [{ id: 'conv-1' }, { id: 'conv-2' }];
      mockListConversations.mockResolvedValue(conversations);

      const req = createMockRequest();
      const res = createMockResponse();

      await controller.listConversations(req as Request, res as Response);

      expect(mockListConversations).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ conversations });
    });
  });

  describe('markAsRead', () => {
    it('marks message as read', async () => {
      const mockMessage = { id: 'msg-1', readAt: new Date() };
      mockMarkAsRead.mockResolvedValue(mockMessage);

      const req = createMockRequest({
        params: { id: 'msg-1' },
      });
      const res = createMockResponse();

      await controller.markAsRead(req as Request, res as Response);

      expect(mockMarkAsRead).toHaveBeenCalledWith('msg-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith({
        message: 'Message marked as read',
        data: mockMessage,
      });
    });

    it('returns 404 when message not found', async () => {
      mockMarkAsRead.mockRejectedValue(new Error('Message not found'));

      const req = createMockRequest({
        params: { id: 'nonexistent' },
      });
      const res = createMockResponse();

      await controller.markAsRead(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 403 when not authorized', async () => {
      mockMarkAsRead.mockRejectedValue(new Error('Not authorized'));

      const req = createMockRequest({
        params: { id: 'msg-1' },
      });
      const res = createMockResponse();

      await controller.markAsRead(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('markConversationAsRead', () => {
    it('marks all messages in conversation as read', async () => {
      mockMarkConversationAsRead.mockResolvedValue(undefined);

      const req = createMockRequest({
        params: { userId: 'user-2' },
      });
      const res = createMockResponse();

      await controller.markConversationAsRead(req as Request, res as Response);

      expect(mockMarkConversationAsRead).toHaveBeenCalledWith('user-1', 'user-2');
      expect(res.json).toHaveBeenCalledWith({
        message: 'Conversation marked as read',
      });
    });
  });

  describe('getUnreadCount', () => {
    it('returns unread count', async () => {
      mockGetUnreadCount.mockResolvedValue(5);

      const req = createMockRequest();
      const res = createMockResponse();

      await controller.getUnreadCount(req as Request, res as Response);

      expect(mockGetUnreadCount).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ unreadCount: 5 });
    });
  });
});
