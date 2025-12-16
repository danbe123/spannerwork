/**
 * Webhook Routes
 * 
 * Handles incoming webhooks from external services.
 * These routes do NOT use the standard JSON body parser.
 */

import { Router, raw } from 'express';
import { stripeService } from '../services/stripe.service.js';
import { logger } from '../config/logger.js';

const router = Router();

/**
 * Stripe webhook endpoint
 * 
 * IMPORTANT: This endpoint uses raw body parsing to verify webhook signatures.
 * The raw body is required for signature verification.
 * 
 * Configure this endpoint in Stripe Dashboard:
 * https://dashboard.stripe.com/webhooks
 * 
 * Endpoint URL: https://your-domain.com/api/webhooks/stripe
 */
router.post(
  '/stripe',
  raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      logger.warn('Stripe webhook received without signature');
      return res.status(400).json({ error: 'Missing signature' });
    }

    if (!stripeService.isEnabled()) {
      logger.warn('Stripe webhook received but Stripe is not configured');
      return res.status(503).json({ error: 'Payment service unavailable' });
    }

    try {
      // Verify signature and parse event
      const event = stripeService.verifyWebhookSignature(req.body, signature);

      logger.info(`Stripe webhook received: ${event.type}`);

      // Handle the event
      await stripeService.handleWebhookEvent(event);

      // Return 200 to acknowledge receipt
      return res.json({ received: true });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not yet implemented')) {
          logger.warn('Stripe webhook received but integration is pending');
          return res.status(503).json({ error: 'Integration pending' });
        }
        
        if (error.message.includes('signature')) {
          logger.error('Stripe webhook signature verification failed:', error.message);
          return res.status(400).json({ error: 'Invalid signature' });
        }
      }

      logger.error('Stripe webhook error:', error);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

/**
 * Health check for webhook endpoint
 */
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    stripe: stripeService.isEnabled() ? 'configured' : 'not_configured',
    timestamp: new Date().toISOString(),
  });
});

export default router;
