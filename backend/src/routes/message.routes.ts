import { Router } from 'express';
import { messageController } from '../controllers/message.controller.js';
import { requireAuth, requireEmailVerified } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import { noCache } from '../middleware/noCache.middleware.js';
import { sendMessageSchema } from '../utils/validation.schemas.js';

const router = Router();

/**
 * @route   POST /api/v1/messages
 * @desc    Send a message
 * @access  Private
 * @csrf    Required
 */
router.post(
  '/',
  requireAuth,
  requireEmailVerified,
  verifyCsrfToken,
  validateBody(sendMessageSchema),
  messageController.send.bind(messageController)
);

/**
 * @route   GET /api/v1/messages/conversations
 * @desc    List all conversations
 * @access  Private
 * @cache   No-cache - Messages must always be fresh
 */
router.get('/conversations', noCache, requireAuth, messageController.listConversations.bind(messageController));

/**
 * @route   GET /api/v1/messages/unread/count
 * @desc    Get unread message count
 * @access  Private
 * @cache   No-cache - Unread count must always be fresh
 */
router.get('/unread/count', noCache, requireAuth, messageController.getUnreadCount.bind(messageController));

/**
 * @route   GET /api/v1/messages/conversation/:userId
 * @desc    Get conversation with specific user
 * @access  Private
 * @cache   No-cache - Conversation messages must always be fresh
 */
router.get('/conversation/:userId', noCache, requireAuth, messageController.getConversation.bind(messageController));

/**
 * @route   PATCH /api/v1/messages/conversation/:userId/read
 * @desc    Mark all messages in conversation as read
 * @access  Private
 * @csrf    Required
 */
router.patch('/conversation/:userId/read', requireAuth, verifyCsrfToken, messageController.markConversationAsRead.bind(messageController));

/**
 * @route   PATCH /api/v1/messages/:id/read
 * @desc    Mark single message as read
 * @access  Private
 * @csrf    Required
 */
router.patch('/:id/read', requireAuth, verifyCsrfToken, messageController.markAsRead.bind(messageController));

export default router;
