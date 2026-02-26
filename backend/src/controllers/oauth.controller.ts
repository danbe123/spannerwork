/**
 * OAuth Controller
 *
 * Handles social login flows for Google, Facebook, and Apple
 */

import { Request, Response, NextFunction } from 'express';
import { randomBytes, createSign } from 'crypto';
import { authService } from '../services/auth.service.js';
import { logger } from '../config/logger.js';
import { oauthConfig, isProviderEnabled, type OAuthProvider } from '../config/oauth.js';
import { env } from '../config/env.js';
import { SESSION_COOKIE_OPTIONS, COOKIE_NAMES } from '../config/cookie.js';
import { safeSetex, safeGet, safeDel } from '../config/redis.js';
// BadRequestError available for future use if needed

// State token expiry (5 minutes)
const STATE_EXPIRY = 5 * 60;

export class OAuthController {
  /**
   * Generate OAuth state token to prevent CSRF
   */
  private async generateStateToken(): Promise<string> {
    const state = randomBytes(32).toString('hex');
    await safeSetex(`oauth-state:${state}`, STATE_EXPIRY, '1');
    return state;
  }

  /**
   * Validate OAuth state token
   */
  private async validateStateToken(state: string): Promise<boolean> {
    const valid = await safeGet(`oauth-state:${state}`);
    if (valid) {
      await safeDel(`oauth-state:${state}`);
      return true;
    }
    return false;
  }

  /**
   * Handle successful OAuth login
   */
  private async handleOAuthSuccess(
    res: Response,
    provider: OAuthProvider,
    userData: { providerId: string; email: string; name?: string; avatar?: string }
  ) {
    const { user, sessionId, isNewUser } = await authService.findOrCreateOAuthUser({
      provider,
      ...userData,
    });

    // Set session cookie
    res.cookie(COOKIE_NAMES.SESSION, sessionId, SESSION_COOKIE_OPTIONS);

    logger.info(`User logged in via ${provider}: ${user.email}`, { isNewUser });

    // Redirect to frontend with success
    const redirectUrl = new URL('/profile', env.FRONTEND_URL);
    if (isNewUser) {
      redirectUrl.searchParams.set('welcome', '1');
    }
    redirectUrl.searchParams.set('oauth', 'success');

    return res.redirect(redirectUrl.toString());
  }

  /**
   * Handle OAuth error
   */
  private handleOAuthError(res: Response, error: string, description?: string) {
    logger.error('OAuth error', { error, description });

    const redirectUrl = new URL('/profile', env.FRONTEND_URL);
    redirectUrl.searchParams.set('oauth', 'error');
    redirectUrl.searchParams.set('error', error);
    if (description) {
      redirectUrl.searchParams.set('error_description', description);
    }

    return res.redirect(redirectUrl.toString());
  }

  /**
   * Check if provider is enabled
   */
  private checkProviderEnabled(res: Response, provider: OAuthProvider): boolean {
    if (!isProviderEnabled(provider)) {
      this.handleOAuthError(res, 'provider_disabled', `${provider} login is not configured`);
      return false;
    }
    return true;
  }

  // ================== GOOGLE ==================

  /**
   * Initiate Google OAuth flow
   * GET /api/v1/auth/oauth/google
   */
  async googleAuth(_req: Request, res: Response, next: NextFunction) {
    try {
      if (!this.checkProviderEnabled(res, 'google')) return;

      const state = await this.generateStateToken();
      const { clientId, authUrl, callbackUrl, scopes } = oauthConfig.google;

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl,
        response_type: 'code',
        scope: scopes.join(' '),
        state,
        access_type: 'offline',
        prompt: 'select_account',
      });

      return res.redirect(`${authUrl}?${params.toString()}`);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Handle Google OAuth callback
   * GET /api/v1/auth/oauth/google/callback
   */
  async googleCallback(req: Request, res: Response, _next: NextFunction) {
    try {
      if (!this.checkProviderEnabled(res, 'google')) return;

      const { code, state, error } = req.query;

      if (error) {
        return this.handleOAuthError(res, error as string);
      }

      if (!state || !(await this.validateStateToken(state as string))) {
        return this.handleOAuthError(res, 'invalid_state', 'Invalid or expired state token');
      }

      if (!code) {
        return this.handleOAuthError(res, 'no_code', 'No authorization code received');
      }

      const { clientId, clientSecret, tokenUrl, userInfoUrl, callbackUrl } = oauthConfig.google;

      // Exchange code for token
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code as string,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: callbackUrl,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        logger.error('Google token exchange failed', { status: tokenResponse.status, error: errorText });
        return this.handleOAuthError(res, 'token_exchange_failed');
      }

      const tokenData = await tokenResponse.json() as { access_token: string };

      // Get user info
      const userResponse = await fetch(userInfoUrl, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userResponse.ok) {
        return this.handleOAuthError(res, 'user_info_failed');
      }

      const userData = await userResponse.json() as {
        id: string;
        email: string;
        name?: string;
        picture?: string;
      };

      return this.handleOAuthSuccess(res, 'google', {
        providerId: userData.id,
        email: userData.email,
        name: userData.name,
        avatar: userData.picture,
      });
    } catch (error) {
      logger.error('Google OAuth error', error);
      return this.handleOAuthError(res, 'server_error');
    }
  }

  // ================== FACEBOOK ==================

  /**
   * Initiate Facebook OAuth flow
   * GET /api/v1/auth/oauth/facebook
   */
  async facebookAuth(_req: Request, res: Response, next: NextFunction) {
    try {
      if (!this.checkProviderEnabled(res, 'facebook')) return;

      const state = await this.generateStateToken();
      const { appId, authUrl, callbackUrl, scopes } = oauthConfig.facebook;

      const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: callbackUrl,
        response_type: 'code',
        scope: scopes.join(','),
        state,
      });

      return res.redirect(`${authUrl}?${params.toString()}`);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Handle Facebook OAuth callback
   * GET /api/v1/auth/oauth/facebook/callback
   */
  async facebookCallback(req: Request, res: Response, _next: NextFunction) {
    try {
      if (!this.checkProviderEnabled(res, 'facebook')) return;

      const { code, state, error, error_description } = req.query;

      if (error) {
        return this.handleOAuthError(res, error as string, error_description as string);
      }

      if (!state || !(await this.validateStateToken(state as string))) {
        return this.handleOAuthError(res, 'invalid_state', 'Invalid or expired state token');
      }

      if (!code) {
        return this.handleOAuthError(res, 'no_code', 'No authorization code received');
      }

      const { appId, appSecret, tokenUrl, userInfoUrl, callbackUrl } = oauthConfig.facebook;

      // Exchange code for token
      const tokenParams = new URLSearchParams({
        code: code as string,
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: callbackUrl,
      });

      const tokenResponse = await fetch(`${tokenUrl}?${tokenParams.toString()}`);

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        logger.error('Facebook token exchange failed', { status: tokenResponse.status, error: errorText });
        return this.handleOAuthError(res, 'token_exchange_failed');
      }

      const tokenData = await tokenResponse.json() as { access_token: string };

      // Get user info
      const userParams = new URLSearchParams({
        fields: 'id,email,name,picture.type(large)',
        access_token: tokenData.access_token,
      });

      const userResponse = await fetch(`${userInfoUrl}?${userParams.toString()}`);

      if (!userResponse.ok) {
        return this.handleOAuthError(res, 'user_info_failed');
      }

      const userData = await userResponse.json() as {
        id: string;
        email?: string;
        name?: string;
        picture?: { data?: { url?: string } };
      };

      if (!userData.email) {
        return this.handleOAuthError(res, 'email_required', 'Email permission is required');
      }

      return this.handleOAuthSuccess(res, 'facebook', {
        providerId: userData.id,
        email: userData.email,
        name: userData.name,
        avatar: userData.picture?.data?.url,
      });
    } catch (error) {
      logger.error('Facebook OAuth error', error);
      return this.handleOAuthError(res, 'server_error');
    }
  }

  // ================== APPLE ==================

  /**
   * Generate Apple client secret (JWT)
   */
  private generateAppleClientSecret(): string {
    const { clientId, teamId, keyId, privateKey } = oauthConfig.apple;

    const header = {
      alg: 'ES256',
      kid: keyId,
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: teamId,
      iat: now,
      exp: now + 86400 * 180, // 6 months
      aud: 'https://appleid.apple.com',
      sub: clientId,
    };

    const headerBase64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signatureInput = `${headerBase64}.${payloadBase64}`;

    const sign = createSign('SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(privateKey, 'base64url');

    return `${signatureInput}.${signature}`;
  }

  /**
   * Initiate Apple OAuth flow
   * GET /api/v1/auth/oauth/apple
   */
  async appleAuth(_req: Request, res: Response, next: NextFunction) {
    try {
      if (!this.checkProviderEnabled(res, 'apple')) return;

      const state = await this.generateStateToken();
      const { clientId, authUrl, callbackUrl, scopes } = oauthConfig.apple;

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl,
        response_type: 'code id_token',
        scope: scopes.join(' '),
        state,
        response_mode: 'form_post',
      });

      return res.redirect(`${authUrl}?${params.toString()}`);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Handle Apple OAuth callback (POST - Apple uses form_post)
   * POST /api/v1/auth/oauth/apple/callback
   */
  async appleCallback(req: Request, res: Response, _next: NextFunction) {
    try {
      if (!this.checkProviderEnabled(res, 'apple')) return;

      const { code, state, error, user } = req.body as {
        code?: string;
        state?: string;
        error?: string;
        user?: string | { name?: { firstName?: string; lastName?: string } };
      };

      if (error) {
        return this.handleOAuthError(res, error);
      }

      if (!state || !(await this.validateStateToken(state))) {
        return this.handleOAuthError(res, 'invalid_state', 'Invalid or expired state token');
      }

      if (!code) {
        return this.handleOAuthError(res, 'no_code', 'No authorization code received');
      }

      const { clientId, tokenUrl, callbackUrl } = oauthConfig.apple;
      const clientSecret = this.generateAppleClientSecret();

      // Exchange code for token
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: callbackUrl,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        logger.error('Apple token exchange failed', { status: tokenResponse.status, error: errorText });
        return this.handleOAuthError(res, 'token_exchange_failed');
      }

      const tokenData = await tokenResponse.json() as { id_token: string };

      // Decode the ID token to get user info
      const idTokenPayload = JSON.parse(
        Buffer.from(tokenData.id_token.split('.')[1], 'base64url').toString()
      ) as { sub: string; email?: string };

      if (!idTokenPayload.email) {
        return this.handleOAuthError(res, 'email_required', 'Email is required');
      }

      // Apple only sends user info on first authorization
      let userName: string | undefined;
      if (user) {
        try {
          const userInfo = typeof user === 'string' ? JSON.parse(user) : user;
          if (userInfo.name) {
            userName = [userInfo.name.firstName, userInfo.name.lastName].filter(Boolean).join(' ');
          }
        } catch {
          // Ignore parsing errors
        }
      }

      return this.handleOAuthSuccess(res, 'apple', {
        providerId: idTokenPayload.sub,
        email: idTokenPayload.email,
        name: userName,
      });
    } catch (error) {
      logger.error('Apple OAuth error', error);
      return this.handleOAuthError(res, 'server_error');
    }
  }

  // ================== STATUS ==================

  /**
   * Get enabled OAuth providers
   * GET /api/v1/auth/oauth/providers
   */
  async getProviders(_req: Request, res: Response) {
    return res.json({
      providers: {
        google: oauthConfig.google.enabled,
        facebook: oauthConfig.facebook.enabled,
        apple: oauthConfig.apple.enabled,
      },
    });
  }
}

export const oauthController = new OAuthController();
