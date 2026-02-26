/**
 * OAuth Routes
 *
 * Routes for social login (Google, Facebook, Apple)
 */

import { Router } from 'express';
import { oauthController } from '../controllers/oauth.controller.js';
import { authLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

/**
 * GET /api/v1/auth/oauth/providers
 * Get list of enabled OAuth providers
 */
router.get(
  '/providers',
  oauthController.getProviders.bind(oauthController)
);

// ================== GOOGLE ==================

/**
 * GET /api/v1/auth/oauth/google
 * Initiate Google OAuth flow
 */
router.get(
  '/google',
  authLimiter,
  oauthController.googleAuth.bind(oauthController)
);

/**
 * GET /api/v1/auth/oauth/google/callback
 * Handle Google OAuth callback
 */
router.get(
  '/google/callback',
  authLimiter,
  oauthController.googleCallback.bind(oauthController)
);

// ================== FACEBOOK ==================

/**
 * GET /api/v1/auth/oauth/facebook
 * Initiate Facebook OAuth flow
 */
router.get(
  '/facebook',
  authLimiter,
  oauthController.facebookAuth.bind(oauthController)
);

/**
 * GET /api/v1/auth/oauth/facebook/callback
 * Handle Facebook OAuth callback
 */
router.get(
  '/facebook/callback',
  authLimiter,
  oauthController.facebookCallback.bind(oauthController)
);

// ================== APPLE ==================

/**
 * GET /api/v1/auth/oauth/apple
 * Initiate Apple OAuth flow
 */
router.get(
  '/apple',
  authLimiter,
  oauthController.appleAuth.bind(oauthController)
);

/**
 * POST /api/v1/auth/oauth/apple/callback
 * Handle Apple OAuth callback (Apple uses form_post)
 */
router.post(
  '/apple/callback',
  authLimiter,
  oauthController.appleCallback.bind(oauthController)
);

export default router;
