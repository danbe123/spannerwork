import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { referralService } from '../services/referral.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { referralLimiter, referralSmsLimiter } from '../middleware/rateLimit.middleware.js';
import { logger } from '../config/logger.js';
import { emailService } from '../services/email.service.js';
import { smsService } from '../services/sms.service.js';
import { env } from '../config/env.js';

const router = Router();

// Validation schemas
const createReferralSchema = z.object({
  referredEmail: z.string().email('Invalid email address'),
  referralCode: z.string().min(6, 'Referral code must be at least 6 characters'),
});

const sendSmsReferralSchema = z.object({
  phone: z.string().min(6, 'Phone number is required').max(20, 'Phone number is too long'),
  referralCode: z.string().min(6, 'Referral code must be at least 6 characters'),
});

/**
 * POST /api/v1/referrals
 * Create a new referral invitation
 * @auth Required
 * @rateLimit 10 per hour per IP
 */
router.post(
  '/',
  referralLimiter,
  requireAuth,
  verifyCsrfToken,
  validate(createReferralSchema),
  async (req: Request, res: Response) => {
    try {
      const { referredEmail, referralCode } = req.body;
      const referrerId = req.user!.id;

      const referral = await referralService.createReferral({
        referrerId,
        referredEmail,
        referralCode,
      });

      // Production email side-effect (no-op if RESEND_API_KEY is not set)
      await emailService.sendReferralInvitation(
        referredEmail,
        req.user!.name ?? null,
        referralCode,
      );

      return res.status(201).json({
        success: true,
        data: { referral },
      });
    } catch (error) {
      logger.error('Create referral error:', error);
      return res.status(500).json({
        error: 'Failed to create referral',
        message: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  }
);

/**
 * POST /api/v1/referrals/sms
 * Send a referral invitation via SMS
 * @auth Required
 * @rateLimit 5 per hour per IP (strict due to SMS costs)
 */
router.post(
  '/sms',
  referralSmsLimiter,
  requireAuth,
  verifyCsrfToken,
  validate(sendSmsReferralSchema),
  async (req: Request, res: Response) => {
    try {
      const { phone, referralCode } = req.body;
      const referrerId = req.user!.id;

      const referral = await referralService.createSmsReferral({
        referrerId,
        phone,
        referralCode,
      });

      const referralLinkBase = env.FRONTEND_URL || '';
      const referralLink = `${referralLinkBase}/?ref=${encodeURIComponent(referralCode)}`;
      const senderName = req.user!.name || 'a mechanic on SpannerWork';

      const message = `You have been invited to SpannerWork by ${senderName}. Sign up and you can both earn £10 credit: ${referralLink}`;

      await smsService.sendSms({
        to: phone,
        body: message,
      });

      return res.status(201).json({
        success: true,
        data: { referral },
      });
    } catch (error) {
      logger.error('Create SMS referral error:', error);
      return res.status(500).json({
        error: 'Failed to send SMS referral',
        message: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  },
);

/**
 * GET /api/v1/referrals/my
 * Get current user's referrals
 * @auth Required
 */
router.get('/my', requireAuth, async (req: Request, res: Response) => {
  try {
    const referrals = await referralService.getReferralsByReferrer(req.user!.id);

    return res.status(200).json({
      success: true,
      data: { referrals },
    });
  } catch (error) {
    logger.error('Get referrals error:', error);
    return res.status(500).json({
      error: 'Failed to fetch referrals',
      message: error instanceof Error ? error.message : 'An error occurred',
    });
  }
});

/**
 * GET /api/v1/referrals/stats
 * Get referral statistics for current user
 * @auth Required
 */
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const stats = await referralService.getReferralStats(req.user!.id);

    return res.status(200).json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    logger.error('Get referral stats error:', error);
    return res.status(500).json({
      error: 'Failed to fetch referral stats',
      message: error instanceof Error ? error.message : 'An error occurred',
    });
  }
});

/**
 * GET /api/v1/referrals/code/:code
 * Get referral by code (for signup page)
 * @public
 */
router.get('/code/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const referral = await referralService.getReferralByCode(code);

    if (!referral) {
      return res.status(404).json({
        error: 'Referral not found',
        message: 'Invalid or expired referral code',
      });
    }

    return res.status(200).json({
      success: true,
      data: { referral },
    });
  } catch (error) {
    logger.error('Get referral by code error:', error);
    return res.status(500).json({
      error: 'Failed to fetch referral',
      message: error instanceof Error ? error.message : 'An error occurred',
    });
  }
});

// SECURITY: The /complete endpoint has been removed.
// Referral completion is now handled internally during user registration
// in auth.service.ts to prevent unauthorized referral manipulation.
// Users should pass referralCode during registration instead.

export default router;
