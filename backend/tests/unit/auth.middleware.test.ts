import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextFunction } from 'express';

// Mock dependencies before importing
vi.mock('../../src/services/auth.service.js', () => ({
  authService: {
    getUserBySession: vi.fn(),
  },
}));

vi.mock('../../src/config/cookie.js', () => ({
  COOKIE_NAMES: {
    SESSION: '__Host-session',
  },
  SESSION_COOKIE_CLEAR_OPTIONS: {},
}));

vi.mock('../../src/middleware/requestId.middleware.js', () => ({
  setContextUserId: vi.fn(),
}));

vi.mock('../../src/middleware/authorize.middleware.js', () => ({
  requireAdmin: vi.fn(),
}));

import {
  requireAuth,
  optionalAuth,
  requireEmailVerified,
} from '../../src/middleware/auth.middleware.js';
import { authService } from '../../src/services/auth.service.js';
import { COOKIE_NAMES } from '../../src/config/cookie.js';
import { setContextUserId } from '../../src/middleware/requestId.middleware.js';

// Helper to create mock request - use 'any' to avoid Express type complexity in tests
function createMockRequest(overrides: Record<string, any> = {}): any {
  return {
    cookies: {},
    user: undefined,
    sessionId: undefined,
    ...overrides,
  };
}

// Helper to create mock response
function createMockResponse(): any {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  };
}

describe('Auth Middleware', () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('requireAuth', () => {
    it('returns 401 when no session cookie present', async () => {
      const req = createMockRequest({ cookies: {} });
      const res = createMockResponse();

      await requireAuth(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 401 and clears cookie when session is invalid', async () => {
      const req = createMockRequest({
        cookies: { [COOKIE_NAMES.SESSION]: 'invalid-session' },
      });
      const res = createMockResponse();

      vi.mocked(authService.getUserBySession).mockResolvedValue(null);

      await requireAuth(req, res, mockNext);

      expect(authService.getUserBySession).toHaveBeenCalledWith('invalid-session');
      expect(res.clearCookie).toHaveBeenCalledWith(COOKIE_NAMES.SESSION, expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid or expired session',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('attaches user to request and calls next on valid session', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
      };

      const req = createMockRequest({
        cookies: { [COOKIE_NAMES.SESSION]: 'valid-session' },
      });
      const res = createMockResponse();

      vi.mocked(authService.getUserBySession).mockResolvedValue(mockUser as any);

      await requireAuth(req, res, mockNext);

      expect(authService.getUserBySession).toHaveBeenCalledWith('valid-session');
      expect(req.user).toEqual(mockUser);
      expect(req.sessionId).toBe('valid-session');
      expect(setContextUserId).toHaveBeenCalledWith('user-1');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('passes errors to next', async () => {
      const req = createMockRequest({
        cookies: { [COOKIE_NAMES.SESSION]: 'session' },
      });
      const res = createMockResponse();
      const error = new Error('Database error');

      vi.mocked(authService.getUserBySession).mockRejectedValue(error);

      await requireAuth(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('optionalAuth', () => {
    it('calls next without attaching user when no session cookie', async () => {
      const req = createMockRequest({ cookies: {} });
      const res = createMockResponse();

      await optionalAuth(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('attaches user when valid session exists', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      };

      const req = createMockRequest({
        cookies: { [COOKIE_NAMES.SESSION]: 'valid-session' },
      });
      const res = createMockResponse();

      vi.mocked(authService.getUserBySession).mockResolvedValue(mockUser as any);

      await optionalAuth(req, res, mockNext);

      expect(req.user).toEqual(mockUser);
      expect(req.sessionId).toBe('valid-session');
      expect(setContextUserId).toHaveBeenCalledWith('user-1');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('calls next without user when session is invalid', async () => {
      const req = createMockRequest({
        cookies: { [COOKIE_NAMES.SESSION]: 'invalid-session' },
      });
      const res = createMockResponse();

      vi.mocked(authService.getUserBySession).mockResolvedValue(null);

      await optionalAuth(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('ignores errors and calls next', async () => {
      const req = createMockRequest({
        cookies: { [COOKIE_NAMES.SESSION]: 'session' },
      });
      const res = createMockResponse();

      vi.mocked(authService.getUserBySession).mockRejectedValue(new Error('DB error'));

      await optionalAuth(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requireEmailVerified', () => {
    it('returns 401 when user not attached to request', () => {
      const req = createMockRequest({ user: undefined });
      const res = createMockResponse();

      requireEmailVerified(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 403 when email not verified', () => {
      const req = createMockRequest({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          emailVerified: false,
        },
      } as any);
      const res = createMockResponse();

      requireEmailVerified(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Email verification required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('calls next when email is verified', () => {
      const req = createMockRequest({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          emailVerified: true,
        },
      } as any);
      const res = createMockResponse();

      requireEmailVerified(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('middleware chaining', () => {
    it('requireAuth -> requireEmailVerified works for verified users', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: true,
      };

      const req = createMockRequest({
        cookies: { [COOKIE_NAMES.SESSION]: 'valid-session' },
      });
      const res = createMockResponse();

      vi.mocked(authService.getUserBySession).mockResolvedValue(mockUser as any);

      // First middleware
      await requireAuth(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(req.user).toEqual(mockUser);

      // Reset next mock
      mockNext = vi.fn();

      // Second middleware
      requireEmailVerified(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('requireAuth -> requireEmailVerified blocks unverified users', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: false,
      };

      const req = createMockRequest({
        cookies: { [COOKIE_NAMES.SESSION]: 'valid-session' },
      });
      const res = createMockResponse();

      vi.mocked(authService.getUserBySession).mockResolvedValue(mockUser as any);

      // First middleware
      await requireAuth(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Reset next mock
      mockNext = vi.fn();

      // Second middleware
      requireEmailVerified(req, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
