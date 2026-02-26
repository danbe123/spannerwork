import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock dependencies
const mockAuthService = vi.hoisted(() => ({
  findOrCreateOAuthUser: vi.fn(),
}));

const mockOAuthConfig = vi.hoisted(() => ({
  google: {
    enabled: true,
    clientId: 'google-client-id',
    clientSecret: 'google-client-secret',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    callbackUrl: 'http://localhost:3000/api/v1/auth/oauth/google/callback',
    scopes: ['openid', 'email', 'profile'],
  },
  facebook: {
    enabled: true,
    appId: 'facebook-app-id',
    appSecret: 'facebook-app-secret',
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me',
    callbackUrl: 'http://localhost:3000/api/v1/auth/oauth/facebook/callback',
    scopes: ['email', 'public_profile'],
  },
  apple: {
    enabled: false,
    clientId: 'apple-client-id',
    teamId: 'apple-team-id',
    keyId: 'apple-key-id',
    privateKey: '',
    authUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    callbackUrl: 'http://localhost:3000/api/v1/auth/oauth/apple/callback',
    scopes: ['name', 'email'],
  },
}));

const mockIsProviderEnabled = vi.hoisted(() => vi.fn((provider: string) => {
  if (provider === 'google') return mockOAuthConfig.google.enabled;
  if (provider === 'facebook') return mockOAuthConfig.facebook.enabled;
  if (provider === 'apple') return mockOAuthConfig.apple.enabled;
  return false;
}));

const mockRedis = vi.hoisted(() => ({
  safeSetex: vi.fn().mockResolvedValue(true),
  safeGet: vi.fn().mockResolvedValue('1'),
  safeDel: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../src/services/auth.service.js', () => ({
  authService: mockAuthService,
}));

vi.mock('../../src/config/oauth.js', () => ({
  oauthConfig: mockOAuthConfig,
  isProviderEnabled: mockIsProviderEnabled,
}));

vi.mock('../../src/config/redis.js', () => mockRedis);

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    FRONTEND_URL: 'http://localhost:5173',
  },
}));

vi.mock('../../src/config/cookie.js', () => ({
  SESSION_COOKIE_OPTIONS: { httpOnly: true, secure: false, sameSite: 'lax' },
  COOKIE_NAMES: { SESSION: 'spannerwork_session' },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { OAuthController } from '../../src/controllers/oauth.controller.js';

describe('OAuthController', () => {
  let controller: OAuthController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new OAuthController();

    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis(),
      cookie: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('getProviders', () => {
    it('should return enabled providers', async () => {
      mockReq = {};

      await controller.getProviders(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        providers: {
          google: true,
          facebook: true,
          apple: false,
        },
      });
    });
  });

  describe('googleAuth', () => {
    it('should redirect to Google OAuth URL', async () => {
      mockReq = {};

      await controller.googleAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectUrl = (mockRes.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(redirectUrl).toContain('accounts.google.com');
      expect(redirectUrl).toContain('client_id=google-client-id');
      expect(redirectUrl).toContain('state=');
    });

    it('should redirect to error page if provider is disabled', async () => {
      mockIsProviderEnabled.mockReturnValueOnce(false);
      mockReq = {};

      await controller.googleAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectUrl = (mockRes.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(redirectUrl).toContain('oauth=error');
      expect(redirectUrl).toContain('provider_disabled');
    });
  });

  describe('googleCallback', () => {
    it('should handle error in callback', async () => {
      mockReq = {
        query: {
          error: 'access_denied',
        },
      };

      await controller.googleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectUrl = (mockRes.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(redirectUrl).toContain('oauth=error');
      expect(redirectUrl).toContain('access_denied');
    });

    it('should handle invalid state token', async () => {
      mockRedis.safeGet.mockResolvedValueOnce(null);
      mockReq = {
        query: {
          code: 'auth-code',
          state: 'invalid-state',
        },
      };

      await controller.googleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectUrl = (mockRes.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(redirectUrl).toContain('invalid_state');
    });

    it('should handle missing authorization code', async () => {
      mockReq = {
        query: {
          state: 'valid-state',
        },
      };

      await controller.googleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectUrl = (mockRes.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(redirectUrl).toContain('no_code');
    });

    it('should successfully authenticate with Google', async () => {
      mockReq = {
        query: {
          code: 'auth-code',
          state: 'valid-state',
        },
      };

      // Mock token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'google-access-token' }),
      });

      // Mock user info
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'google-user-123',
          email: 'user@gmail.com',
          name: 'Test User',
          picture: 'https://example.com/avatar.jpg',
        }),
      });

      mockAuthService.findOrCreateOAuthUser.mockResolvedValue({
        user: { id: 'user-123', email: 'user@gmail.com' },
        sessionId: 'session-123',
        isNewUser: false,
      });

      await controller.googleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAuthService.findOrCreateOAuthUser).toHaveBeenCalledWith({
        provider: 'google',
        providerId: 'google-user-123',
        email: 'user@gmail.com',
        name: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
      });

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'spannerwork_session',
        'session-123',
        expect.any(Object)
      );

      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectUrl = (mockRes.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(redirectUrl).toContain('oauth=success');
    });

    it('should handle token exchange failure', async () => {
      mockReq = {
        query: {
          code: 'auth-code',
          state: 'valid-state',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Invalid code'),
      });

      await controller.googleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectUrl = (mockRes.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(redirectUrl).toContain('token_exchange_failed');
    });
  });

  describe('facebookAuth', () => {
    it('should redirect to Facebook OAuth URL', async () => {
      mockReq = {};

      await controller.facebookAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectUrl = (mockRes.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(redirectUrl).toContain('facebook.com');
      expect(redirectUrl).toContain('client_id=facebook-app-id');
    });
  });

  describe('facebookCallback', () => {
    it('should handle error in callback', async () => {
      mockReq = {
        query: {
          error: 'access_denied',
          error_description: 'User denied access',
        },
      };

      await controller.facebookCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectUrl = (mockRes.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(redirectUrl).toContain('access_denied');
    });

    it('should successfully authenticate with Facebook', async () => {
      mockReq = {
        query: {
          code: 'fb-auth-code',
          state: 'valid-state',
        },
      };

      // Mock token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'fb-access-token' }),
      });

      // Mock user info
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'fb-user-123',
          email: 'user@facebook.com',
          name: 'FB User',
          picture: { data: { url: 'https://fb.com/avatar.jpg' } },
        }),
      });

      mockAuthService.findOrCreateOAuthUser.mockResolvedValue({
        user: { id: 'user-123', email: 'user@facebook.com' },
        sessionId: 'session-456',
        isNewUser: true,
      });

      await controller.facebookCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAuthService.findOrCreateOAuthUser).toHaveBeenCalledWith({
        provider: 'facebook',
        providerId: 'fb-user-123',
        email: 'user@facebook.com',
        name: 'FB User',
        avatar: 'https://fb.com/avatar.jpg',
      });

      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectUrl = (mockRes.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(redirectUrl).toContain('oauth=success');
      expect(redirectUrl).toContain('welcome=1');
    });

    it('should require email from Facebook', async () => {
      mockReq = {
        query: {
          code: 'fb-auth-code',
          state: 'valid-state',
        },
      };

      // Mock token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'fb-access-token' }),
      });

      // Mock user info - no email
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'fb-user-123',
          name: 'FB User',
        }),
      });

      await controller.facebookCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectUrl = (mockRes.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(redirectUrl).toContain('email_required');
    });
  });

  describe('appleAuth', () => {
    it('should redirect to error if Apple is disabled', async () => {
      mockIsProviderEnabled.mockImplementation((provider: string) => provider !== 'apple');
      mockReq = {};

      await controller.appleAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectUrl = (mockRes.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(redirectUrl).toContain('provider_disabled');
    });
  });

  describe('appleCallback', () => {
    beforeEach(() => {
      // Enable Apple for callback tests
      mockIsProviderEnabled.mockImplementation(() => true);
    });

    it('should handle error in callback', async () => {
      mockReq = {
        body: {
          error: 'user_cancelled_authorize',
        },
      };

      await controller.appleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectUrl = (mockRes.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(redirectUrl).toContain('user_cancelled_authorize');
    });

    it('should handle invalid state', async () => {
      mockRedis.safeGet.mockResolvedValueOnce(null);
      mockReq = {
        body: {
          code: 'apple-auth-code',
          state: 'invalid-state',
        },
      };

      await controller.appleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectUrl = (mockRes.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(redirectUrl).toContain('invalid_state');
    });
  });
});
