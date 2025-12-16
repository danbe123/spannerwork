import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { authLimiter, sensitiveLimiter } from '../middleware/rateLimit.middleware.js';
import { verifyCsrfToken } from '../middleware/csrf.middleware.js';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  sendPhoneCodeSchema,
  verifyPhoneCodeSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../utils/validation.schemas.js';

const router = Router();

/**
 * POST /api/v1/auth/register
 * Register a new user
 */
router.post(
  '/register',
  authLimiter,
  validateBody(registerSchema),
  authController.register.bind(authController)
);

/**
 * POST /api/v1/auth/login
 * Login a user
 */
router.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  authController.login.bind(authController)
);

/**
 * POST /api/v1/auth/logout
 * Logout the current user
 * Requires authentication to prevent anonymous logout attacks
 * CSRF protection prevents malicious logout attacks
 */
router.post(
  '/logout',
  requireAuth,
  verifyCsrfToken,
  authController.logout.bind(authController)
);

/**
 * GET /api/v1/auth/me
 * Get current authenticated user
 */
router.get(
  '/me',
  requireAuth,
  authController.me.bind(authController)
);

/**
 * POST /api/v1/auth/verify-email
 * Verify email address with token
 * No CSRF protection - users click this from email clients (external origin)
 * The email token itself is a one-time secret that provides protection
 */
router.post(
  '/verify-email',
  authLimiter,
  validateBody(verifyEmailSchema),
  authController.verifyEmail.bind(authController)
);

/**
 * POST /api/v1/auth/send-verification
 * Send email verification link to current user
 * CSRF protected - authenticated user action from browser
 */
router.post(
  '/send-verification',
  authLimiter,
  requireAuth,
  verifyCsrfToken,
  authController.sendVerificationEmail.bind(authController)
);

/**
 * POST /api/v1/auth/send-phone-code
 * Send phone verification code via SMS to current user
 * CSRF protected - authenticated user action from browser
 */
router.post(
  '/send-phone-code',
  authLimiter,
  requireAuth,
  verifyCsrfToken,
  validateBody(sendPhoneCodeSchema),
  authController.sendPhoneVerificationCode.bind(authController)
);

/**
 * POST /api/v1/auth/verify-phone
 * Verify phone number with SMS code and save to profile
 * CSRF protected - authenticated user action from browser
 */
router.post(
  '/verify-phone',
  authLimiter,
  requireAuth,
  verifyCsrfToken,
  validateBody(verifyPhoneCodeSchema),
  authController.verifyPhone.bind(authController)
);

/**
 * POST /api/v1/auth/forgot-password
 * Request password reset
 * Rate limited more strictly to prevent abuse
 */
router.post(
  '/forgot-password',
  sensitiveLimiter,
  authLimiter,
  validateBody(forgotPasswordSchema),
  authController.forgotPassword.bind(authController)
);

/**
 * POST /api/v1/auth/reset-password
 * Reset password with token
 * Rate limited more strictly to prevent abuse
 */
router.post(
  '/reset-password',
  sensitiveLimiter,
  authLimiter,
  validateBody(resetPasswordSchema),
  authController.resetPassword.bind(authController)
);

export default router;
