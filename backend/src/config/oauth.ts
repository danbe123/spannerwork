/**
 * OAuth Configuration
 *
 * Configuration for social login providers (Google, Facebook, Apple)
 */

import { env } from './env.js';

export const oauthConfig = {
  google: {
    clientId: env.GOOGLE_CLIENT_ID || '',
    clientSecret: env.GOOGLE_CLIENT_SECRET || '',
    enabled: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: ['email', 'profile'],
    get callbackUrl() {
      return `${env.FRONTEND_URL.replace(/\/$/, '')}/api/v1/auth/oauth/google/callback`;
    },
  },

  facebook: {
    appId: env.FACEBOOK_APP_ID || '',
    appSecret: env.FACEBOOK_APP_SECRET || '',
    enabled: !!(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET),
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me',
    scopes: ['email', 'public_profile'],
    get callbackUrl() {
      return `${env.FRONTEND_URL.replace(/\/$/, '')}/api/v1/auth/oauth/facebook/callback`;
    },
  },

  apple: {
    clientId: env.APPLE_CLIENT_ID || '',
    teamId: env.APPLE_TEAM_ID || '',
    keyId: env.APPLE_KEY_ID || '',
    privateKey: env.APPLE_PRIVATE_KEY || '',
    enabled: !!(env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY),
    authUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    scopes: ['name', 'email'],
    get callbackUrl() {
      return `${env.FRONTEND_URL.replace(/\/$/, '')}/api/v1/auth/oauth/apple/callback`;
    },
  },
};

export type OAuthProvider = 'google' | 'facebook' | 'apple';

export function isProviderEnabled(provider: OAuthProvider): boolean {
  return oauthConfig[provider].enabled;
}

export function getEnabledProviders(): OAuthProvider[] {
  const providers: OAuthProvider[] = [];
  if (oauthConfig.google.enabled) providers.push('google');
  if (oauthConfig.facebook.enabled) providers.push('facebook');
  if (oauthConfig.apple.enabled) providers.push('apple');
  return providers;
}
