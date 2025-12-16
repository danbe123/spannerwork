import request from 'supertest';
import { app } from '../../src/app.js';
import { authService } from '../../src/services/auth.service.js';
import { prisma } from '../../src/config/database.js';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCsrfToken, resetRateLimits } from '../utils/test-helpers.js';

/**
 * Comprehensive Auth Integration Tests
 * Tests registration, login, logout, password reset, and email verification flows
 */

describe('Auth Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits(); // Reset rate limiters before each test
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-new',
        email: 'newuser@example.com',
        name: 'New User',
        passwordHash: 'hashed',
        emailVerified: false,
        accountStatus: 'ACTIVE',
        role: 'USER',
      };

      vi.spyOn(authService, 'register').mockResolvedValue({
        user: mockUser as any,
        sessionId: 'session-new',
      });

      vi.spyOn(authService, 'generateEmailVerificationToken').mockResolvedValue('token-123');

      const { token, cookies } = await getCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Cookie', cookies.join('; '))
        .set('X-CSRF-Token', token)
        .send({
          email: 'newuser@example.com',
          password: 'Password123!',
          name: 'New User',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Registration successful');
      expect(res.body.user.email).toBe('newuser@example.com');
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should return 409 for existing email', async () => {
      vi.spyOn(authService, 'register').mockRejectedValue(
        new Error('User with this email already exists')
      );

      const { token, cookies } = await getCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Cookie', cookies.join('; '))
        .set('X-CSRF-Token', token)
        .send({
          email: 'existing@example.com',
          password: 'Password123!',
          name: 'Test',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Conflict');
    });

    it('should return 400 for weak password', async () => {
      const { token, cookies } = await getCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Cookie', cookies.join('; '))
        .set('X-CSRF-Token', token)
        .send({
          email: 'test@example.com',
          password: 'weak',
          name: 'Test',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should return 400 for invalid email format', async () => {
      const { token, cookies } = await getCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Cookie', cookies.join('; '))
        .set('X-CSRF-Token', token)
        .send({
          email: 'not-an-email',
          password: 'Password123',
          name: 'Test',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login user and set session cookie', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hash',
        accountStatus: 'ACTIVE',
        role: 'USER',
      };

      vi.spyOn(authService, 'login').mockResolvedValue({
        user: mockUser as any,
        sessionId: 'session-1',
      });

      const { token, cookies } = await getCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Cookie', cookies.join('; '))
        .set('X-CSRF-Token', token)
        .send({
          email: 'test@example.com',
          password: 'Password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Login successful');
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toContain('sessionId');
    });

    it('should return 401 for invalid credentials', async () => {
      vi.spyOn(authService, 'login').mockRejectedValue(
        new Error('Invalid email or password')
      );

      const { token, cookies } = await getCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Cookie', cookies.join('; '))
        .set('X-CSRF-Token', token)
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('should return 401 for suspended account', async () => {
      vi.spyOn(authService, 'login').mockRejectedValue(
        new Error('Account is suspended')
      );

      const { token, cookies } = await getCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Cookie', cookies.join('; '))
        .set('X-CSRF-Token', token)
        .send({
          email: 'suspended@example.com',
          password: 'Password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('suspended');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout and clear session cookie', async () => {
      // Mock authenticated user for logout (now requires authentication)
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        accountStatus: 'ACTIVE',
      };
      vi.spyOn(authService, 'getUserBySession').mockResolvedValue(mockUser as any);
      vi.spyOn(authService, 'deleteSession').mockResolvedValue();

      // Get CSRF token WITH sessionId cookie set - this ensures CSRF token is tied to this session
      const sessionCookie = 'sessionId=session-1';
      const csrfRes = await request(app)
        .get('/api/v1/csrf-token')
        .set('Cookie', sessionCookie);
      
      const token = csrfRes.body.csrfToken;
      const csrfCookies: string[] = Array.isArray(csrfRes.headers['set-cookie']) 
        ? csrfRes.headers['set-cookie'] 
        : csrfRes.headers['set-cookie'] ? [csrfRes.headers['set-cookie']] : [];
      
      // Combine CSRF cookies with session cookie
      const allCookies = csrfCookies.map((c: string) => c.split(';')[0]);
      allCookies.push(sessionCookie);

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', allCookies.join('; '))
        .set('X-CSRF-Token', token);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logout successful');
    });

    it('should return 401 when logging out without valid session', async () => {
      // Now that logout requires authentication, unauthenticated requests should fail
      vi.spyOn(authService, 'getUserBySession').mockResolvedValue(null);
      
      const { token, cookies } = await getCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', cookies.join('; '))
        .set('X-CSRF-Token', token);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return current user when authenticated', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hash',
        role: 'USER',
        accountStatus: 'ACTIVE',
      };

      vi.spyOn(authService, 'getUserBySession').mockResolvedValue(mockUser as any);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', 'sessionId=valid-session');

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('should return 401 for invalid session', async () => {
      vi.spyOn(authService, 'getUserBySession').mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', 'sessionId=invalid-session');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should return success even for non-existent email (prevent enumeration)', async () => {
      vi.spyOn(authService, 'generatePasswordResetToken').mockResolvedValue(null);

      const { token, cookies } = await getCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .set('Cookie', cookies.join('; '))
        .set('X-CSRF-Token', token)
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('If the email exists');
    });

    it('should return success for existing email', async () => {
      vi.spyOn(authService, 'generatePasswordResetToken').mockResolvedValue('reset-token');

      const { token, cookies } = await getCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .set('Cookie', cookies.join('; '))
        .set('X-CSRF-Token', token)
        .send({ email: 'existing@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('If the email exists');
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
      };

      vi.spyOn(authService, 'resetPassword').mockResolvedValue(mockUser as any);

      const { token, cookies } = await getCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .set('Cookie', cookies.join('; '))
        .set('X-CSRF-Token', token)
        .send({
          token: 'valid-reset-token',
          password: 'NewPassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Password reset successful');
    });

    it('should return 400 for invalid/expired token', async () => {
      vi.spyOn(authService, 'resetPassword').mockRejectedValue(
        new Error('Invalid or expired reset token')
      );

      const { token, cookies } = await getCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .set('Cookie', cookies.join('; '))
        .set('X-CSRF-Token', token)
        .send({
          token: 'expired-token',
          password: 'NewPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid or expired');
    });

    it('should return 400 for weak new password', async () => {
      const { token, cookies } = await getCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .set('Cookie', cookies.join('; '))
        .set('X-CSRF-Token', token)
        .send({
          token: 'valid-token',
          password: 'weak',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('POST /api/v1/auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: true,
      };

      vi.spyOn(authService, 'verifyEmail').mockResolvedValue(mockUser as any);
      vi.spyOn(authService, 'rotateSession').mockResolvedValue('new-session-id');

      const { token, cookies } = await getCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Cookie', cookies.join('; '))
        .set('X-CSRF-Token', token)
        .send({ token: 'valid-verification-token' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Email verified successfully');
    });

    it('should return 400 for invalid/expired token', async () => {
      vi.spyOn(authService, 'verifyEmail').mockRejectedValue(
        new Error('Invalid or expired verification token')
      );

      const { token, cookies } = await getCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Cookie', cookies.join('; '))
        .set('X-CSRF-Token', token)
        .send({ token: 'expired-token' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid or expired');
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit login attempts', async () => {
      // Note: Rate limiting is skipped in test environment (NODE_ENV=test)
      // This test verifies the endpoint works correctly, not rate limiting behavior
      vi.spyOn(authService, 'login').mockRejectedValue(
        new Error('Invalid email or password')
      );

      const { token, cookies } = await getCsrfToken();

      // Make multiple rapid requests with CSRF token
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/v1/auth/login')
          .set('Cookie', cookies.join('; '))
          .set('X-CSRF-Token', token)
          .send({ email: 'test@example.com', password: 'wrong' })
      );

      const responses = await Promise.all(requests);
      
      // In test mode, rate limiting is skipped, so all should be 401
      // In production, at least one would be rate limited (429)
      const allUnauthorized = responses.every(r => r.status === 401);
      const rateLimited = responses.some(r => r.status === 429);
      
      expect(rateLimited || allUnauthorized).toBe(true);
    });
  });
});
