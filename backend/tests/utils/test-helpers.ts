/**
 * Test Helper Utilities
 * 
 * Common utilities for integration tests including:
 * - CSRF token handling
 * - Rate limiter reset
 * - Authenticated request helpers
 */

import request, { SuperTest, Test } from 'supertest';
import { app } from '../../src/app.js';
import { resetRateLimiters } from '../../src/middleware/rateLimit.middleware.js';

/**
 * Get a CSRF token from the server
 * Call this before making POST/PUT/DELETE requests in tests
 */
export async function getCsrfToken(): Promise<{ token: string; cookies: string[] }> {
  const res = await request(app).get('/api/v1/csrf-token');
  
  const token = res.body.csrfToken || '';
  const cookies = res.headers['set-cookie'] || [];
  
  return { token, cookies };
}

/**
 * Make an authenticated POST request with CSRF token
 */
export async function postWithCsrf(
  path: string,
  body: Record<string, unknown>,
  sessionCookie?: string
): Promise<request.Response> {
  const { token, cookies } = await getCsrfToken();
  
  let req = request(app)
    .post(path)
    .set('X-CSRF-Token', token)
    .set('Cookie', cookies.join('; '));
  
  if (sessionCookie) {
    req = req.set('Cookie', [...cookies, sessionCookie].join('; '));
  }
  
  return req.send(body);
}

/**
 * Create a test agent that handles CSRF automatically
 * Use this for tests that need to maintain session state
 */
export class TestAgent {
  private agent: SuperTest<Test>;
  private csrfToken: string = '';
  private cookies: string[] = [];

  constructor() {
    this.agent = request.agent(app);
  }

  /**
   * Initialize CSRF token (call once before making POST requests)
   */
  async initCsrf(): Promise<void> {
    const res = await this.agent.get('/api/v1/csrf-token');
    this.csrfToken = res.body.csrfToken || '';
    if (res.headers['set-cookie']) {
      this.cookies = res.headers['set-cookie'];
    }
  }

  /**
   * Make a GET request
   */
  get(path: string): Test {
    return this.agent.get(path);
  }

  /**
   * Make a POST request with CSRF token
   */
  post(path: string): Test {
    return this.agent
      .post(path)
      .set('X-CSRF-Token', this.csrfToken);
  }

  /**
   * Make a PUT request with CSRF token
   */
  put(path: string): Test {
    return this.agent
      .put(path)
      .set('X-CSRF-Token', this.csrfToken);
  }

  /**
   * Make a DELETE request with CSRF token
   */
  delete(path: string): Test {
    return this.agent
      .delete(path)
      .set('X-CSRF-Token', this.csrfToken);
  }

  /**
   * Set a cookie for subsequent requests
   */
  setCookie(cookie: string): this {
    this.cookies.push(cookie);
    return this;
  }
}

/**
 * Reset rate limiters before each test
 * Call this in beforeEach() hooks
 */
export function resetRateLimits(): void {
  resetRateLimiters();
}

/**
 * Create a mock session cookie
 */
export function mockSessionCookie(sessionId: string = 'test-session'): string {
  return `sessionId=${sessionId}`;
}
