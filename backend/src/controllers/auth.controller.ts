import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { logger } from '../config/logger.js';
import { emailService } from '../services/email.service.js';
import { smsService } from '../services/sms.service.js';
import { SESSION_COOKIE_OPTIONS, COOKIE_NAMES } from '../config/cookie.js';
import { UnauthorizedError, ConflictError, BadRequestError } from '../utils/errors.js';

export class AuthController {
  /**
   * Register a new user
   * POST /api/v1/auth/register
   */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, name } = req.body;

      const { user, sessionId } = await authService.register({
        email,
        password,
        name,
      });

      // Set session cookie using standardized config
      res.cookie(COOKIE_NAMES.SESSION, sessionId, SESSION_COOKIE_OPTIONS);

      logger.info(`User registered: ${user.email}`);

      // Send email verification link (best-effort, registration still succeeds even if this fails)
      try {
        const token = await authService.generateEmailVerificationToken(user.id);
        await emailService.sendEmailVerificationEmail(user.email, token);
      } catch (emailError) {
        logger.error('Failed to send verification email after registration', emailError);
      }

      // Don't send password hash to client
      const { passwordHash: _passwordHash, ...userWithoutPassword } = user;

      return res.status(201).json({
        message: 'Registration successful',
        user: userWithoutPassword,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        return next(new ConflictError(error.message));
      }
      return next(error);
    }
  }

  /**
   * Send phone verification code via SMS
   * POST /api/v1/auth/send-phone-code
   */
  async sendPhoneVerificationCode(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Not authenticated'));
      }

      const { phone } = req.body as { phone: string };

      const code = await authService.generatePhoneVerificationCode(req.user.id, phone);

      await smsService.sendSms({
        to: phone,
        body: `Your SpannerWork verification code is ${code}`,
      });

      return res.json({
        message: 'Verification code sent',
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Verify phone with SMS code and save to profile
   * POST /api/v1/auth/verify-phone
   */
  async verifyPhone(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Not authenticated'));
      }

      const { phone, code } = req.body as { phone: string; code: string };

      const user = await authService.verifyPhoneCode(req.user.id, phone, code);

      const { passwordHash: _passwordHash, ...userWithoutPassword } = user;

      return res.json({
        message: 'Phone verified successfully',
        user: userWithoutPassword,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid or expired')) {
        return next(new BadRequestError(error.message));
      }
      return next(error);
    }
  }

  /**
   * Send email verification link to current user
   * POST /api/v1/auth/send-verification
   */
  async sendVerificationEmail(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Not authenticated'));
      }

      if (req.user.emailVerified) {
        return res.json({
          message: 'Email is already verified',
        });
      }

      const token = await authService.generateEmailVerificationToken(req.user.id);

      await emailService.sendEmailVerificationEmail(req.user.email, token);

      return res.json({
        message: 'Verification email sent',
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Login a user
   * POST /api/v1/auth/login
   * Session is rotated on login to prevent session fixation attacks
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      
      // Pass existing session ID for rotation (prevents session fixation)
      const existingSessionId = req.cookies?.[COOKIE_NAMES.SESSION];

      const { user, sessionId } = await authService.login({
        email,
        password,
        existingSessionId,
      });

      // Set session cookie using standardized config
      res.cookie(COOKIE_NAMES.SESSION, sessionId, SESSION_COOKIE_OPTIONS);

      logger.info(`User logged in: ${user.email}`);

      // Don't send password hash to client
      const { passwordHash: _passwordHash, ...userWithoutPassword } = user;

      return res.json({
        message: 'Login successful',
        user: userWithoutPassword,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid email or password') || error.message.includes('suspended')) {
          return next(new UnauthorizedError(error.message));
        }
      }
      return next(error);
    }
  }

  /**
   * Logout the current user
   * POST /api/v1/auth/logout
   */
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = req.sessionId;

      if (sessionId) {
        await authService.deleteSession(sessionId);
        logger.info(`User logged out`);
      }

      res.clearCookie(COOKIE_NAMES.SESSION);

      return res.json({
        message: 'Logout successful',
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get current user
   * GET /api/v1/auth/me
   */
  async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Not authenticated'));
      }

      // Don't send password hash to client
      const { passwordHash: _passwordHash, ...userWithoutPassword } = req.user;

      return res.json({
        user: userWithoutPassword,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Verify email with token
   * POST /api/v1/auth/verify-email
   */
  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body;

      const user = await authService.verifyEmail(token);

      logger.info(`Email verified for user: ${user.email}`);

      // Rotate session after email verification (privilege escalation)
      if (req.sessionId && req.user?.id === user.id) {
        const newSessionId = await authService.rotateSession(req.sessionId, user.id);

        // Update session cookie with new ID using standardized config
        res.cookie(COOKIE_NAMES.SESSION, newSessionId, SESSION_COOKIE_OPTIONS);

        logger.info(`Session rotated after email verification for user: ${user.email}`);
      }

      return res.json({
        message: 'Email verified successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid or expired')) {
        return next(new BadRequestError(error.message));
      }
      return next(error);
    }
  }

  /**
   * Request password reset
   * POST /api/v1/auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;

      const token = await authService.generatePasswordResetToken(email);

      // Only send email if user exists (token is not null)
      // We still return success either way to prevent email enumeration
      if (token) {
        await emailService.sendPasswordResetEmail(email, token);
      }

      // Always return success to prevent email enumeration
      return res.json({
        message: 'If the email exists, a password reset link has been sent',
      });
    } catch {
      // Don't reveal if email exists
      return res.json({
        message: 'If the email exists, a password reset link has been sent',
      });
    }
  }

  /**
   * Reset password with token
   * POST /api/v1/auth/reset-password
   */
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body;

      await authService.resetPassword(token, password);

      logger.info('Password reset successful');

      return res.json({
        message: 'Password reset successful',
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid or expired')) {
        return next(new BadRequestError(error.message));
      }
      return next(error);
    }
  }
}

export const authController = new AuthController();
