import request from 'supertest';
import { app } from '../../src/app.js';
import { authService } from '../../src/services/auth.service.js';
import { requestService } from '../../src/services/request.service.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getCsrfToken as _getCsrfToken, resetRateLimits } from '../utils/test-helpers.js';

const user = {
  id: 'user-1',
  email: 'test@example.com',
  emailVerified: true, // Required for creating requests
  accountStatus: 'ACTIVE',
  role: 'USER',
} as any;

vi.mock('../../src/services/request.service.js');

const mockedRequestService = requestService as unknown as {
  create: ReturnType<typeof vi.fn>;
};

describe('Request flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetRateLimits();
  });

  it('POST /api/v1/requests creates a request when authenticated', async () => {
    vi.spyOn(authService, 'getUserBySession').mockResolvedValue(user);

    mockedRequestService.create = vi.fn().mockResolvedValue({
      id: 'req-1',
      title: 'Need a drill',
    });

    const body = {
      title: 'Need a drill',
      description: 'Looking to borrow a cordless drill for the weekend',
      category: 'TOOLS',
      urgency: 'ASAP',
      budget: 50,
      rateType: 'FIXED',
      broadcastRadius: 10,
      postcode: 'SW1A 1AA',
      photos: [],
    };

    // Get CSRF token WITH sessionId cookie - ensures CSRF token is tied to this session
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
      .post('/api/v1/requests')
      .set('Cookie', allCookies.join('; '))
      .set('X-CSRF-Token', token)
      .send(body);

    expect(res.status).toBe(201);
    expect(mockedRequestService.create).toHaveBeenCalled();
    expect(res.body.request.id).toBe('req-1');
  });
});
