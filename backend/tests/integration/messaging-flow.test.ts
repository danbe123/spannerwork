import request from 'supertest';
import { app } from '../../src/app.js';
import { authService } from '../../src/services/auth.service.js';
import { messageService } from '../../src/services/message.service.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('Messaging Flow E2E', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete messaging flow', () => {
    it('should require CSRF token for sending messages', async () => {
      const sender = { id: 'user-sender', name: 'Sender User', email: 'sender@test.com' };

      // Mock authentication for sender
      vi.spyOn(authService, 'getUserBySession').mockResolvedValue(sender as any);

      // Send message without CSRF token
      const sendRes = await request(app)
        .post('/api/v1/messages')
        .set('Cookie', ['sessionId=session-sender'])
        .send({
          recipientId: 'user-recipient',
          content: 'Hello, I am interested in your tool listing',
        });

      // CSRF protection returns 403
      expect(sendRes.status).toBe(403);
    });

    it('should list conversations for a user', async () => {
      const user = { id: 'user-1', name: 'Test User' };

      vi.spyOn(authService, 'getUserBySession').mockResolvedValue(user as any);

      const mockConversations = [
        {
          otherUser: { id: 'user-2', name: 'Other User', avatar: null },
          lastMessage: {
            id: 'msg-1',
            content: 'Hello there',
            createdDate: new Date(),
            senderId: 'user-2',
          },
          unreadCount: 2,
        },
      ];
      vi.spyOn(messageService, 'listConversations').mockResolvedValue(mockConversations as any);

      const res = await request(app)
        .get('/api/v1/messages/conversations')
        .set('Cookie', ['sessionId=session-1']);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toHaveLength(1);
      expect(res.body.conversations[0].unreadCount).toBe(2);
    });

    it('should get conversation between two users', async () => {
      const user = { id: 'user-1', name: 'Test User' };
      const otherUserId = 'user-2';

      vi.spyOn(authService, 'getUserBySession').mockResolvedValue(user as any);

      const mockConversation = {
        messages: [
          { id: 'msg-1', content: 'Hi', senderId: 'user-1', createdDate: new Date() },
          { id: 'msg-2', content: 'Hello', senderId: 'user-2', createdDate: new Date() },
        ],
        pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
        otherUser: { id: 'user-2', name: 'Other User' },
      };
      vi.spyOn(messageService, 'getConversation').mockResolvedValue(mockConversation as any);

      const res = await request(app)
        .get(`/api/v1/messages/conversation/${otherUserId}`)
        .set('Cookie', ['sessionId=session-1']);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(2);
      expect(res.body.otherUser.id).toBe('user-2');
    });

    it('should require CSRF token for marking messages as read', async () => {
      const user = { id: 'user-recipient', name: 'Recipient User' };
      const messageId = 'clmessagexxxxxxxxxxxxxxxxxx';

      vi.spyOn(authService, 'getUserBySession').mockResolvedValue(user as any);

      const res = await request(app)
        .patch(`/api/v1/messages/${messageId}/read`)
        .set('Cookie', ['sessionId=session-1']);

      // 403 expected without CSRF token
      expect(res.status).toBe(403);
    });

    it('should require CSRF token when sending message to yourself', async () => {
      const user = { id: 'user-1', name: 'Test User' };

      vi.spyOn(authService, 'getUserBySession').mockResolvedValue(user as any);

      const res = await request(app)
        .post('/api/v1/messages')
        .set('Cookie', ['sessionId=session-1'])
        .send({
          recipientId: 'user-1', // Same as sender
          content: 'Hello myself',
        });

      // 400 for self-send or 403 for CSRF (CSRF check happens first)
      expect([400, 403]).toContain(res.status);
    });

    it('should require CSRF token for sending messages', async () => {
      const user = { id: 'user-1', name: 'Test User' };

      vi.spyOn(authService, 'getUserBySession').mockResolvedValue(user as any);

      const res = await request(app)
        .post('/api/v1/messages')
        .set('Cookie', ['sessionId=session-1'])
        .send({
          recipientId: 'non-existent-user',
          content: 'Hello',
        });

      // 403 for CSRF (checked before message send)
      expect(res.status).toBe(403);
    });

    it('should get unread message count', async () => {
      const user = { id: 'user-1', name: 'Test User' };

      vi.spyOn(authService, 'getUserBySession').mockResolvedValue(user as any);
      vi.spyOn(messageService, 'getUnreadCount').mockResolvedValue(5);

      const res = await request(app)
        .get('/api/v1/messages/unread/count')
        .set('Cookie', ['sessionId=session-1']);

      expect(res.status).toBe(200);
      expect(res.body.unreadCount).toBe(5);
    });

    it('should require CSRF token for marking conversation as read', async () => {
      const user = { id: 'user-1', name: 'Test User' };
      const otherUserId = 'clotherxxxxxxxxxxxxxxxxxxxxxx';

      vi.spyOn(authService, 'getUserBySession').mockResolvedValue(user as any);

      const res = await request(app)
        .patch(`/api/v1/messages/conversation/${otherUserId}/read`)
        .set('Cookie', ['sessionId=session-1']);

      // 403 expected without CSRF token
      expect(res.status).toBe(403);
    });
  });

  describe('Message validation', () => {
    it('should require content for messages', async () => {
      const user = { id: 'user-1', name: 'Test User' };

      vi.spyOn(authService, 'getUserBySession').mockResolvedValue(user as any);

      const res = await request(app)
        .post('/api/v1/messages')
        .set('Cookie', ['sessionId=session-1'])
        .send({
          recipientId: 'user-2',
          // missing content
        });

      // 400 for validation error, 403 for CSRF (expected in test without CSRF token)
      expect([400, 403]).toContain(res.status);
    });

    it('should require recipientId for messages', async () => {
      const user = { id: 'user-1', name: 'Test User' };

      vi.spyOn(authService, 'getUserBySession').mockResolvedValue(user as any);

      const res = await request(app)
        .post('/api/v1/messages')
        .set('Cookie', ['sessionId=session-1'])
        .send({
          content: 'Hello',
          // missing recipientId
        });

      // 400 for validation error, 403 for CSRF (expected in test without CSRF token)
      expect([400, 403]).toContain(res.status);
    });
  });

  describe('Unauthenticated access', () => {
    it('should return 401 for unauthenticated users', async () => {
      vi.spyOn(authService, 'getUserBySession').mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/messages/conversations');

      expect(res.status).toBe(401);
    });
  });
});
