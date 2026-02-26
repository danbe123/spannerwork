import { Request, Response } from 'express';
import { messageService } from '../services/message.service.js';
import { logger } from '../config/logger.js';
import { unifiedNotificationService } from '../services/unifiedNotification.service.js';
import { isUserOnline } from '../services/websocket.service.js';

export class MessageController {
  /**
   * Send a message
   * POST /api/v1/messages
   */
  async send(req: Request, res: Response) {
    try {
      const senderId = req.user!.id;
      const { recipientId, content } = req.body;

      // Prevent sending message to self
      if (senderId === recipientId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Cannot send message to yourself',
        });
      }

      const message = await messageService.send({
        senderId,
        recipientId,
        content,
      });

      // Send notification to recipient (async - don't await to not slow down response)
      // Only send email if user is offline - online users get real-time WebSocket notification
      const recipientOnline = isUserOnline(recipientId);

      if (recipientOnline) {
        // User is online - they'll see the message in real-time via WebSocket
        // No need for email notification
        logger.debug(`Skipping email for message to ${recipientId} - user is online`);
      } else {
        // User is offline - send email notification
        unifiedNotificationService.templates.newMessage(
          recipientId,
          message.sender.name || 'Someone',
          content
        ).catch(err => {
          logger.error('Failed to send new message notification:', err);
        });
      }

      return res.status(201).json({
        message: 'Message sent',
        data: message,
      });
    } catch (error) {
      logger.error('Error sending message:', error);
      if (error instanceof Error) {
        if (error.message === 'Recipient not found') {
          return res.status(404).json({ error: 'Not Found', message: error.message });
        }
        if (error.message.includes('inactive user')) {
          return res.status(400).json({ error: 'Bad Request', message: error.message });
        }
      }
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to send message',
      });
    }
  }

  /**
   * Get conversation with another user
   * GET /api/v1/messages/conversation/:userId
   */
  async getConversation(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { userId: otherUserId } = req.params;
      const { page, limit } = req.query;

      const result = await messageService.getConversation(userId, otherUserId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      // Prevent browser/proxy caching - messages must always be fresh
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      return res.json(result);
    } catch (error) {
      logger.error('Error getting conversation:', error);
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get conversation',
      });
    }
  }

  /**
   * List all conversations
   * GET /api/v1/messages/conversations
   */
  async listConversations(req: Request, res: Response) {
    try {
      const userId = req.user!.id;

      const conversations = await messageService.listConversations(userId);

      // Prevent browser/proxy caching - conversations must always be fresh
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      return res.json({ conversations });
    } catch (error) {
      logger.error('Error listing conversations:', error);
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to list conversations',
      });
    }
  }

  /**
   * Mark message as read
   * PATCH /api/v1/messages/:id/read
   */
  async markAsRead(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const message = await messageService.markAsRead(id, userId);

      return res.json({
        message: 'Message marked as read',
        data: message,
      });
    } catch (error) {
      logger.error('Error marking message as read:', error);
      if (error instanceof Error) {
        if (error.message === 'Message not found') {
          return res.status(404).json({ error: 'Not Found', message: error.message });
        }
        if (error.message.includes('Not authorized')) {
          return res.status(403).json({ error: 'Forbidden', message: error.message });
        }
      }
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to mark message as read',
      });
    }
  }

  /**
   * Mark all messages in conversation as read
   * PATCH /api/v1/messages/conversation/:userId/read
   */
  async markConversationAsRead(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { userId: otherUserId } = req.params;

      await messageService.markConversationAsRead(userId, otherUserId);

      return res.json({
        message: 'Conversation marked as read',
      });
    } catch (error) {
      logger.error('Error marking conversation as read:', error);
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to mark conversation as read',
      });
    }
  }

  /**
   * Get unread message count
   * GET /api/v1/messages/unread/count
   */
  async getUnreadCount(req: Request, res: Response) {
    try {
      const userId = req.user!.id;

      const count = await messageService.getUnreadCount(userId);

      // Prevent browser/proxy caching - unread count must always be fresh
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      return res.json({ unreadCount: count });
    } catch (error) {
      logger.error('Error getting unread count:', error);
     return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get unread count',
      });
    }
  }
}

export const messageController = new MessageController();
