import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env
vi.mock('../../src/config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    SESSION_EXPIRY_DAYS: '30',
  },
}));

import { 
  SESSION_COOKIE_OPTIONS, 
  getSessionCookieOptions, 
  COOKIE_NAMES 
} from '../../src/config/cookie.js';

describe('Cookie Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SESSION_COOKIE_OPTIONS', () => {
    it('should have httpOnly set to true', () => {
      expect(SESSION_COOKIE_OPTIONS.httpOnly).toBe(true);
    });

    it('should have path set to /', () => {
      expect(SESSION_COOKIE_OPTIONS.path).toBe('/');
    });

    it('should have maxAge based on SESSION_EXPIRY_DAYS', () => {
      // 30 days in milliseconds
      const expectedMaxAge = 30 * 24 * 60 * 60 * 1000;
      expect(SESSION_COOKIE_OPTIONS.maxAge).toBe(expectedMaxAge);
    });

    it('should have sameSite set to lax in non-production', () => {
      expect(SESSION_COOKIE_OPTIONS.sameSite).toBe('lax');
    });

    it('should not be secure in non-production', () => {
      expect(SESSION_COOKIE_OPTIONS.secure).toBe(false);
    });
  });

  describe('getSessionCookieOptions', () => {
    it('should return standard options by default', () => {
      const options = getSessionCookieOptions();

      expect(options.httpOnly).toBe(true);
      expect(options.maxAge).toBe(SESSION_COOKIE_OPTIONS.maxAge);
    });

    it('should extend session to 60 days when extendSession is true', () => {
      const options = getSessionCookieOptions(true);

      // 60 days in milliseconds
      const expectedMaxAge = 60 * 24 * 60 * 60 * 1000;
      expect(options.maxAge).toBe(expectedMaxAge);
    });

    it('should not extend session when extendSession is false', () => {
      const options = getSessionCookieOptions(false);

      expect(options.maxAge).toBe(SESSION_COOKIE_OPTIONS.maxAge);
    });

    it('should preserve all other options when extending session', () => {
      const options = getSessionCookieOptions(true);

      expect(options.httpOnly).toBe(true);
      expect(options.path).toBe('/');
      expect(options.sameSite).toBe('lax');
    });
  });

  describe('COOKIE_NAMES', () => {
    it('should have SESSION cookie name', () => {
      expect(COOKIE_NAMES.SESSION).toBeDefined();
    });

    it('should have CSRF cookie name', () => {
      expect(COOKIE_NAMES.CSRF).toBe('_csrf');
    });

    it('should use sessionId in non-production', () => {
      expect(COOKIE_NAMES.SESSION).toBe('sessionId');
    });
  });

  describe('Cookie security', () => {
    it('should be httpOnly to prevent XSS access', () => {
      expect(SESSION_COOKIE_OPTIONS.httpOnly).toBe(true);
    });

    it('should have proper sameSite for CSRF protection', () => {
      expect(['strict', 'lax']).toContain(SESSION_COOKIE_OPTIONS.sameSite);
    });

    it('should have path set to root', () => {
      expect(SESSION_COOKIE_OPTIONS.path).toBe('/');
    });
  });
});

describe('Cookie Expiry Calculations', () => {
  it('should calculate 30 days correctly in milliseconds', () => {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(SESSION_COOKIE_OPTIONS.maxAge).toBe(thirtyDaysMs);
  });

  it('should calculate 60 days correctly for extended sessions', () => {
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
    const options = getSessionCookieOptions(true);
    expect(options.maxAge).toBe(sixtyDaysMs);
  });
});
