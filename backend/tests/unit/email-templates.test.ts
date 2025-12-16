import { describe, it, expect, vi } from 'vitest';

// Mock the renderEmailLayout function
vi.mock('../../src/services/emailTemplates.js', () => ({
  renderEmailLayout: vi.fn((data) => `<html>${data.heading} - ${data.bodyHtml}</html>`),
  escapeHtml: vi.fn((text) => text),
}));

import { emailVerificationTemplate } from '../../src/emails/email-verification.template.js';
import { passwordResetTemplate } from '../../src/emails/password-reset.template.js';
import { welcomeTemplate } from '../../src/emails/welcome.template.js';
import { bookingConfirmationTemplate } from '../../src/emails/booking-confirmation.template.js';
import { bookingCancellationTemplate } from '../../src/emails/booking-cancellation.template.js';
import { newMessageTemplate } from '../../src/emails/new-message.template.js';
import { reviewReceivedTemplate } from '../../src/emails/review-received.template.js';
import { disputeUpdateTemplate } from '../../src/emails/dispute-update.template.js';
import { paymentReceivedTemplate } from '../../src/emails/payment-received.template.js';
import { referralInvitationTemplate } from '../../src/emails/referral-invitation.template.js';

describe('Email Templates', () => {
  describe('emailVerificationTemplate', () => {
    it('should generate verification email with name', () => {
      const result = emailVerificationTemplate({
        verifyUrl: 'https://example.com/verify?token=abc123',
        name: 'John',
      });

      expect(result.subject).toBe('Verify your email for SpannerWork');
      expect(result.text).toContain('Hey John!');
      expect(result.text).toContain('https://example.com/verify?token=abc123');
      expect(result.html).toContain('Verify Your Email');
    });

    it('should generate verification email without name', () => {
      const result = emailVerificationTemplate({
        verifyUrl: 'https://example.com/verify?token=xyz789',
      });

      expect(result.text).toContain('Hey there!');
      expect(result.text).toContain('xyz789');
    });

    it('should include expiration notice', () => {
      const result = emailVerificationTemplate({
        verifyUrl: 'https://example.com/verify',
        name: 'Test',
      });

      expect(result.text).toContain('24 hours');
    });

    it('should include the verification URL in HTML', () => {
      const url = 'https://example.com/verify?token=test123';
      const result = emailVerificationTemplate({
        verifyUrl: url,
      });

      expect(result.html).toContain(url);
    });
  });

  describe('passwordResetTemplate', () => {
    it('should generate password reset email', () => {
      const result = passwordResetTemplate({
        resetUrl: 'https://example.com/reset?token=abc123',
      });

      expect(result.subject).toBe('Reset your SpannerWork password');
      expect(result.text).toContain('reset your SpannerWork password');
      expect(result.text).toContain('https://example.com/reset?token=abc123');
    });

    it('should include expiration notice', () => {
      const result = passwordResetTemplate({
        resetUrl: 'https://example.com/reset',
      });

      expect(result.text).toContain('1 hour');
    });

    it('should include safety notice', () => {
      const result = passwordResetTemplate({
        resetUrl: 'https://example.com/reset',
      });

      expect(result.text).toContain('If you did not request this');
    });
  });

  describe('welcomeTemplate', () => {
    it('should generate welcome email with name', () => {
      const result = welcomeTemplate({
        name: 'John',
        dashboardUrl: 'https://example.com/dashboard',
        createListingUrl: 'https://example.com/create',
      });

      expect(result.subject).toContain('Welcome');
      expect(result.text).toContain('Hi John');
      expect(result.text).toContain('https://example.com/dashboard');
    });

    it('should generate welcome email without name', () => {
      const result = welcomeTemplate({
        name: null,
        dashboardUrl: 'https://example.com/dashboard',
        createListingUrl: 'https://example.com/create',
      });

      expect(result.text).toContain('Hi,');
      expect(result.text).not.toContain('Hi null');
    });

    it('should list SpannerWork features', () => {
      const result = welcomeTemplate({
        name: 'Test',
        dashboardUrl: 'https://example.com/dashboard',
        createListingUrl: 'https://example.com/create',
      });

      expect(result.text).toContain('Rent tools');
      expect(result.text).toContain('workshop space');
    });
  });

  describe('bookingConfirmationTemplate', () => {
    it('should generate booking confirmation for tool', () => {
      const result = bookingConfirmationTemplate({
        userName: 'John',
        resourceName: 'Power Drill',
        resourceType: 'tool',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-17'),
        totalAmount: 2500, // £25.00
        transactionUrl: 'https://example.com/transaction/123',
      });

      expect(result.subject).toContain('Power Drill');
      expect(result.text).toContain('Hi John');
      expect(result.text).toContain('Power Drill');
      expect(result.text).toContain('£25.00');
    });

    it('should generate booking confirmation for space', () => {
      const result = bookingConfirmationTemplate({
        userName: null,
        resourceName: 'Workshop',
        resourceType: 'space',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-20'),
        totalAmount: 15000, // £150.00
        transactionUrl: 'https://example.com/transaction/456',
      });

      expect(result.subject).toContain('Workshop');
      expect(result.text).toContain('Hi,');
      expect(result.text).toContain('£150.00');
      expect(result.text).toContain('Space:');
    });

    it('should generate booking confirmation for service', () => {
      const result = bookingConfirmationTemplate({
        userName: 'Jane',
        resourceName: 'Car Repair',
        resourceType: 'service',
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-01'),
        totalAmount: 8000,
        transactionUrl: 'https://example.com/transaction/789',
      });

      expect(result.text).toContain('Service:');
      expect(result.text).toContain('Car Repair');
    });

    it('should format dates correctly', () => {
      const result = bookingConfirmationTemplate({
        userName: 'Test',
        resourceName: 'Item',
        resourceType: 'tool',
        startDate: new Date('2024-03-15'),
        endDate: new Date('2024-03-17'),
        totalAmount: 1000,
        transactionUrl: 'https://example.com/transaction',
      });

      // UK date format should include month name
      expect(result.text).toContain('Mar');
      expect(result.text).toContain('2024');
    });
  });

  describe('bookingCancellationTemplate', () => {
    it('should generate cancellation email for user-cancelled', () => {
      const result = bookingCancellationTemplate({
        userName: 'John',
        resourceName: 'Power Drill',
        resourceType: 'tool',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-17'),
        cancelledBy: 'user',
        transactionUrl: 'https://example.com/transaction/123',
        searchUrl: 'https://example.com/search',
      });

      expect(result.subject).toContain('cancelled');
      expect(result.text).toContain('You cancelled');
    });

    it('should generate cancellation email for provider-cancelled', () => {
      const result = bookingCancellationTemplate({
        userName: 'Jane',
        resourceName: 'Workshop',
        resourceType: 'space',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-17'),
        cancelledBy: 'provider',
        transactionUrl: 'https://example.com/transaction/456',
        searchUrl: 'https://example.com/search',
      });

      expect(result.text).toContain('The provider cancelled');
    });

    it('should include search link', () => {
      const result = bookingCancellationTemplate({
        userName: null,
        resourceName: 'Item',
        resourceType: 'tool',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-17'),
        cancelledBy: 'user',
        transactionUrl: 'https://example.com/transaction',
        searchUrl: 'https://example.com/search/tools',
      });

      expect(result.text).toContain('alternative');
    });
  });

  describe('newMessageTemplate', () => {
    it('should generate new message email', () => {
      const result = newMessageTemplate({
        recipientName: 'John',
        senderName: 'Jane',
        messagePreview: 'Hello, is the drill still available?',
        conversationUrl: 'https://example.com/messages/123',
      });

      expect(result.subject).toContain('Jane');
      expect(result.text).toContain('Hello, is the drill still available?');
      expect(result.text).toContain('https://example.com/messages/123');
    });

    it('should handle null recipient name', () => {
      const result = newMessageTemplate({
        recipientName: null,
        senderName: 'Sender',
        messagePreview: 'Test message',
        conversationUrl: 'https://example.com/messages',
      });

      expect(result.text).toContain('Hi,');
      expect(result.text).not.toContain('Hi null');
    });
  });

  describe('reviewReceivedTemplate', () => {
    it('should generate review email with comment', () => {
      const result = reviewReceivedTemplate({
        recipientName: 'John',
        reviewerName: 'Jane',
        rating: 5,
        comment: 'Excellent service!',
        profileUrl: 'https://example.com/profile/john',
      });

      expect(result.subject).toContain('5-star');
      expect(result.text).toContain('Excellent service!');
      expect(result.text).toContain('★★★★★');
    });

    it('should generate review email without comment', () => {
      const result = reviewReceivedTemplate({
        recipientName: 'Test',
        reviewerName: 'Reviewer',
        rating: 4,
        comment: null,
        profileUrl: 'https://example.com/profile',
      });

      expect(result.text).toContain('4-star');
      expect(result.text).toContain('★★★★☆');
    });

    it('should render correct star rating', () => {
      const result = reviewReceivedTemplate({
        recipientName: 'User',
        reviewerName: 'Reviewer',
        rating: 3,
        comment: null,
        profileUrl: 'https://example.com/profile',
      });

      expect(result.text).toContain('★★★☆☆');
    });
  });

  describe('disputeUpdateTemplate', () => {
    it('should generate dispute update email with resolution', () => {
      const result = disputeUpdateTemplate({
        userName: 'John',
        disputeId: 'dispute-123',
        status: 'resolved',
        resourceName: 'Power Drill',
        resolution: 'Full refund provided',
        disputeUrl: 'https://example.com/disputes/123',
      });

      expect(result.subject).toContain('Resolved');
      expect(result.text).toContain('Full refund provided');
      expect(result.text).toContain('Power Drill');
    });

    it('should generate dispute update without resolution', () => {
      const result = disputeUpdateTemplate({
        userName: null,
        disputeId: 'dispute-456',
        status: 'under_review',
        resourceName: 'Workshop',
        resolution: null,
        disputeUrl: 'https://example.com/disputes/456',
      });

      expect(result.subject).toContain('Under Review');
      expect(result.text).toContain('Hi,');
      expect(result.text).not.toContain('Resolution:');
    });

    it('should format status correctly', () => {
      const result = disputeUpdateTemplate({
        userName: 'Test',
        disputeId: 'dispute-789',
        status: 'under_review',
        resourceName: 'Item',
        resolution: null,
        disputeUrl: 'https://example.com/disputes/789',
      });

      // Status formatting converts underscores to spaces and capitalizes each word
      expect(result.text).toMatch(/Under.?Review/i);
    });
  });

  describe('paymentReceivedTemplate', () => {
    it('should generate payment received email for tool', () => {
      const result = paymentReceivedTemplate({
        recipientName: 'John',
        amount: 2500, // £25.00
        resourceName: 'Power Drill',
        resourceType: 'tool',
        transactionId: 'txn-123',
        transactionUrl: 'https://example.com/transactions/123',
        earningsUrl: 'https://example.com/earnings',
      });

      expect(result.subject).toContain('£25.00');
      expect(result.text).toContain('£25.00');
      expect(result.text).toContain('Power Drill');
      expect(result.text).toContain('txn-123');
    });

    it('should generate payment received email for space', () => {
      const result = paymentReceivedTemplate({
        recipientName: null,
        amount: 15000, // £150.00
        resourceName: 'Workshop',
        resourceType: 'space',
        transactionId: 'txn-456',
        transactionUrl: 'https://example.com/transactions/456',
        earningsUrl: 'https://example.com/earnings',
      });

      expect(result.text).toContain('£150.00');
      expect(result.text).toContain('Hi,');
    });

    it('should generate payment received email for service', () => {
      const result = paymentReceivedTemplate({
        recipientName: 'Jane',
        amount: 8000, // £80.00
        resourceName: 'Car Repair',
        resourceType: 'service',
        transactionId: 'txn-789',
        transactionUrl: 'https://example.com/transactions/789',
        earningsUrl: 'https://example.com/earnings',
      });

      // Service name should be in the email
      expect(result.text).toContain('Car Repair');
      expect(result.text).toContain('£80.00');
    });
  });

  describe('referralInvitationTemplate', () => {
    it('should generate referral email with referrer name', () => {
      const result = referralInvitationTemplate({
        referrerName: 'John',
        referralCode: 'ABC123',
        signupUrl: 'https://example.com/signup?ref=ABC123',
      });

      expect(result.subject).toContain('John');
      expect(result.text).toContain('John has invited you');
      expect(result.text).toContain('ABC123');
      expect(result.text).toContain('https://example.com/signup?ref=ABC123');
    });

    it('should handle null referrer name', () => {
      const result = referralInvitationTemplate({
        referrerName: null,
        referralCode: 'XYZ789',
        signupUrl: 'https://example.com/signup',
      });

      expect(result.subject).toContain('A friend');
      expect(result.text).toContain('A friend has invited you');
    });

    it('should include features list', () => {
      const result = referralInvitationTemplate({
        referrerName: 'Test',
        referralCode: 'CODE',
        signupUrl: 'https://example.com',
      });

      expect(result.text).toContain('Rent tools');
      expect(result.text).toContain('workspace');
    });
  });
});
