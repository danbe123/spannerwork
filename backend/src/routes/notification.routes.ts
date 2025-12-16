import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { notificationService } from '../services/notification.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import { env } from '../config/env.js';

const router = Router();

/**
 * Push subscription schema
 */
const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

/**
 * GET /api/notifications/vapid-public-key
 * Get the VAPID public key for client-side subscription
 */
router.get('/vapid-public-key', (_req: Request, res: Response) => {
  if (!env.VAPID_PUBLIC_KEY) {
    res.status(503).json({
      error: 'Push notifications not configured',
    });
    return;
  }

  res.json({
    publicKey: env.VAPID_PUBLIC_KEY,
  });
});

/**
 * POST /api/notifications/subscribe
 * Subscribe the current user to push notifications
 */
router.post('/subscribe', requireAuth, verifyCsrfToken, async (req: Request, res: Response) => {
  try {
    const result = subscriptionSchema.safeParse(req.body);
    
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid subscription data',
        details: result.error.issues,
      });
      return;
    }

    const userId = req.user!.id;
    const success = await notificationService.subscribe(userId, result.data);

    if (success) {
      res.json({ message: 'Subscribed to push notifications' });
    } else {
      res.status(500).json({ error: 'Failed to subscribe' });
    }
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/unsubscribe
 * Unsubscribe the current user from push notifications for a specific endpoint
 */
router.post('/unsubscribe', requireAuth, verifyCsrfToken, async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint || typeof endpoint !== 'string') {
      res.status(400).json({ error: 'Endpoint is required' });
      return;
    }

    const userId = req.user!.id;
    const success = await notificationService.unsubscribe(userId, endpoint);

    if (success) {
      res.json({ message: 'Unsubscribed from push notifications' });
    } else {
      res.status(500).json({ error: 'Failed to unsubscribe' });
    }
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/notifications/unsubscribe-all
 * Unsubscribe the current user from all push notifications
 */
router.delete('/unsubscribe-all', requireAuth, verifyCsrfToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const success = await notificationService.unsubscribeAll(userId);

    if (success) {
      res.json({ message: 'Unsubscribed from all push notifications' });
    } else {
      res.status(500).json({ error: 'Failed to unsubscribe' });
    }
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/test
 * Send a test notification to the current user (development only)
 */
router.post('/test', requireAuth, verifyCsrfToken, async (req: Request, res: Response) => {
  if (env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Not available in production' });
    return;
  }

  try {
    const userId = req.user!.id;
    
    await notificationService.sendToUser(userId, {
      title: 'Test Notification 🔔',
      body: 'Push notifications are working correctly!',
      tag: 'test',
      data: { type: 'test' },
    });

    res.json({ message: 'Test notification sent' });
  } catch {
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

export default router;
