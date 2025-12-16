import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch for Mailtrap API calls
const mockFetch = vi.hoisted(() => vi.fn());
global.fetch = mockFetch as any;

// Mock dependencies before imports
vi.mock('../../src/config/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    RESEND_API_KEY: null, // Not using Resend
    MAILTRAP_API_KEY: 'test-mailtrap-key',
    EMAIL_FROM: 'noreply@test.com',
    EMAIL_FROM_NAME: 'SpannerWork',
    FRONTEND_URL: 'https://spannerwork.test',
  },
}));

vi.mock('../../src/services/emailTemplates.js', () => ({
  renderEmailLayout: vi.fn((params) => `<html>${params.heading}</html>`),
}));

import { emailService } from '../../src/services/email.service.js';

describe('Email Service (Mailtrap)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('sendPasswordResetEmail', () => {
    it('sends password reset email via Mailtrap', async () => {
      await emailService.sendPasswordResetEmail('user@example.com', 'reset-token-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://send.api.mailtrap.io/api/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-mailtrap-key',
          }),
        })
      );
    });

    it('includes correct recipient in request body', async () => {
      await emailService.sendPasswordResetEmail('user@example.com', 'reset-token-123');

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.to).toEqual([{ email: 'user@example.com' }]);
    });
  });

  describe('sendEmailVerificationEmail', () => {
    it('sends verification email via Mailtrap', async () => {
      await emailService.sendEmailVerificationEmail('user@example.com', 'verify-token', 'John');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://send.api.mailtrap.io/api/send',
        expect.any(Object)
      );
    });

    it('includes subject in request', async () => {
      await emailService.sendEmailVerificationEmail('user@example.com', 'verify-token', 'John');

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.subject).toContain('Verify');
    });
  });

  describe('sendWelcomeEmail', () => {
    it('sends welcome email via Mailtrap', async () => {
      await emailService.sendWelcomeEmail('user@example.com', 'John');

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('sendContactNotification', () => {
    it('sends contact notification via Mailtrap', async () => {
      await emailService.sendContactNotification(
        'John Doe',
        'john@example.com',
        'Question',
        'I have a question about...'
      );

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('sendBookingConfirmationEmail', () => {
    it('sends booking confirmation via Mailtrap', async () => {
      await emailService.sendBookingConfirmationEmail('user@example.com', {
        userName: 'John',
        resourceName: 'Impact Wrench',
        resourceType: 'tool',
        startDate: new Date('2025-01-15'),
        endDate: new Date('2025-01-17'),
        totalAmount: 5000,
        transactionId: 'txn-123',
      });

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('sendBookingCancellationEmail', () => {
    it('sends cancellation email via Mailtrap', async () => {
      await emailService.sendBookingCancellationEmail('user@example.com', {
        userName: 'John',
        resourceName: 'Workshop Bay',
        resourceType: 'space',
        startDate: new Date('2025-01-15'),
        endDate: new Date('2025-01-17'),
        cancelledBy: 'user',
        transactionId: 'txn-123',
      });

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('sendReferralInvitation', () => {
    it('sends referral invitation via Mailtrap', async () => {
      await emailService.sendReferralInvitation(
        'friend@example.com',
        'John',
        'REF123'
      );

      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
