import request from 'supertest';
import { app } from '../../src/app.js';
import { authService } from '../../src/services/auth.service.js';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { getCsrfToken, resetRateLimits } from '../utils/test-helpers.js';

describe('Auth routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetRateLimits();
  });

  it('POST /api/v1/auth/login returns success and sets cookie', async () => {
    const user = {
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hash',
      accountStatus: 'ACTIVE',
    } as any;

    const loginMock = vi
      .spyOn(authService, 'login')
      .mockResolvedValue({ user, sessionId: 'session-1' });

    // Get CSRF token first
    const { token, cookies } = await getCsrfToken();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', cookies.join('; '))
      .set('X-CSRF-Token', token)
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(loginMock).toHaveBeenCalled();
    expect(res.headers['set-cookie']).toBeDefined();
  });
});
