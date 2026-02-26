import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Mock dependencies
const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  transaction: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

const mockStripeService = vi.hoisted(() => ({
  isEnabled: vi.fn(),
  getPublishableKey: vi.fn(),
  createConnectAccount: vi.fn(),
  createOnboardingLink: vi.fn(),
  getAccountStatus: vi.fn(),
  createDashboardLink: vi.fn(),
  createPaymentIntent: vi.fn(),
  createRefund: vi.fn(),
  capturePayment: vi.fn(),
  getEscrowStatus: vi.fn(),
  createInstantPayout: vi.fn(),
  createTransfer: vi.fn(),
  createSubscriptionCheckoutSession: vi.fn(),
  createBillingPortalSession: vi.fn(),
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../src/services/stripe.service.js', () => ({
  stripeService: mockStripeService,
}));

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

import { PaymentController } from '../../src/controllers/payment.controller.js';

describe('PaymentController', () => {
  let controller: PaymentController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new PaymentController();

    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
  });

  describe('getPublishableKey', () => {
    it('should return publishable key when Stripe is enabled', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockStripeService.getPublishableKey.mockReturnValue('pk_test_123');

      mockReq = {};

      await controller.getPublishableKey(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({ publishableKey: 'pk_test_123' });
    });

    it('should return 503 when Stripe is not enabled', async () => {
      mockStripeService.isEnabled.mockReturnValue(false);

      mockReq = {};

      await controller.getPublishableKey(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Payment service unavailable',
        message: 'Stripe is not configured. Please contact support.',
      });
    });
  });

  describe('createConnectAccount', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockReq = { user: undefined };

      await controller.createConnectAccount(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return 404 when user is not found', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      mockReq = { user: { id: 'user-123' } };

      await controller.createConnectAccount(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'User not found' });
    });

    it('should return existing account with new onboarding link', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'user@test.com',
        stripeConnectId: 'acct_existing',
      });
      mockStripeService.createOnboardingLink.mockResolvedValue('https://connect.stripe.com/onboard');

      mockReq = { user: { id: 'user-123' } };

      await controller.createConnectAccount(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        accountId: 'acct_existing',
        onboardingUrl: 'https://connect.stripe.com/onboard',
        isNew: false,
      });
    });

    it('should create new Connect account for user without one', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'user@test.com',
        stripeConnectId: null,
      });
      mockStripeService.createConnectAccount.mockResolvedValue({
        accountId: 'acct_new',
        onboardingUrl: 'https://connect.stripe.com/onboard',
      });
      mockPrisma.user.update.mockResolvedValue({});

      mockReq = { user: { id: 'user-123' } };

      await controller.createConnectAccount(mockReq as Request, mockRes as Response);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { stripeConnectId: 'acct_new' },
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        accountId: 'acct_new',
        onboardingUrl: 'https://connect.stripe.com/onboard',
        isNew: true,
      });
    });
  });

  describe('getAccountStatus', () => {
    it('should return hasAccount false when user has no Stripe account', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockPrisma.user.findUnique.mockResolvedValue({
        stripeConnectId: null,
      });

      mockReq = { user: { id: 'user-123' } };

      await controller.getAccountStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        hasAccount: false,
        status: null,
      });
    });

    it('should return account status when user has Stripe account', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockPrisma.user.findUnique.mockResolvedValue({
        stripeConnectId: 'acct_123',
      });
      mockStripeService.getAccountStatus.mockResolvedValue({
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
      });

      mockReq = { user: { id: 'user-123' } };

      await controller.getAccountStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        hasAccount: true,
        status: {
          chargesEnabled: true,
          payoutsEnabled: true,
          detailsSubmitted: true,
        },
      });
    });
  });

  describe('createPaymentIntent', () => {
    it('should return 400 when transaction ID is missing', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);

      mockReq = { user: { id: 'user-123' }, body: {} };

      await controller.createPaymentIntent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Transaction ID is required' });
    });

    it('should return 404 when transaction not found', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      mockReq = { user: { id: 'user-123' }, body: { transactionId: 'txn-123' } };

      await controller.createPaymentIntent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Transaction not found' });
    });

    it('should return 403 when user is not the transaction owner', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-123',
        userId: 'other-user',
        provider: { id: 'provider-123', stripeConnectId: 'acct_provider' },
      });

      mockReq = { user: { id: 'user-123' }, body: { transactionId: 'txn-123' } };

      await controller.createPaymentIntent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Not authorized to pay for this transaction' });
    });

    it('should return 400 when provider has no Stripe account', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-123',
        userId: 'user-123',
        provider: { id: 'provider-123', stripeConnectId: null },
      });

      mockReq = { user: { id: 'user-123' }, body: { transactionId: 'txn-123' } };

      await controller.createPaymentIntent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Provider not set up for payments',
        message: 'The provider has not set up their payment account yet.',
      });
    });

    it('should create payment intent successfully', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-123',
        userId: 'user-123',
        providerId: 'provider-123',
        totalAmount: 5000,
        platformFee: 500,
        provider: { id: 'provider-123', stripeConnectId: 'acct_provider' },
      });
      mockStripeService.createPaymentIntent.mockResolvedValue({
        paymentIntentId: 'pi_123',
        clientSecret: 'pi_123_secret',
        amount: 5000,
        currency: 'gbp',
      });
      mockPrisma.transaction.update.mockResolvedValue({});

      mockReq = { user: { id: 'user-123' }, body: { transactionId: 'txn-123' } };

      await controller.createPaymentIntent(mockReq as Request, mockRes as Response);

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'txn-123' },
        data: { stripePaymentIntentId: 'pi_123' },
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        clientSecret: 'pi_123_secret',
        paymentIntentId: 'pi_123',
        amount: 5000,
        currency: 'gbp',
      });
    });
  });

  describe('requestRefund', () => {
    it('should return 403 when user is not transaction owner', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-123',
        userId: 'other-user',
        stripePaymentIntentId: 'pi_123',
        paymentStatus: 'PAID',
      });

      mockReq = { user: { id: 'user-123' }, body: { transactionId: 'txn-123' } };

      await controller.requestRefund(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Not authorized' });
    });

    it('should return 400 when transaction has not been paid', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-123',
        userId: 'user-123',
        stripePaymentIntentId: 'pi_123',
        paymentStatus: 'PENDING',
      });

      mockReq = { user: { id: 'user-123' }, body: { transactionId: 'txn-123' } };

      await controller.requestRefund(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Transaction has not been paid' });
    });

    it('should process refund successfully', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-123',
        userId: 'user-123',
        stripePaymentIntentId: 'pi_123',
        paymentStatus: 'PAID',
      });
      mockStripeService.createRefund.mockResolvedValue({
        refundId: 're_123',
        amount: 5000,
        status: 'succeeded',
      });
      mockPrisma.transaction.update.mockResolvedValue({});

      mockReq = { user: { id: 'user-123' }, body: { transactionId: 'txn-123', reason: 'duplicate' } };

      await controller.requestRefund(mockReq as Request, mockRes as Response);

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'txn-123' },
        data: {
          paymentStatus: 'REFUNDED',
          status: 'CANCELLED',
        },
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        refundId: 're_123',
        amount: 5000,
        status: 'succeeded',
      });
    });
  });

  describe('capturePayment', () => {
    it('should return 403 when user is not the customer', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-123',
        userId: 'other-user',
        providerId: 'provider-123',
        stripePaymentIntentId: 'pi_123',
      });

      mockReq = { user: { id: 'user-123' }, body: { transactionId: 'txn-123' } };

      await controller.capturePayment(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Not authorized',
        message: 'Only the customer can confirm job completion and release payment.',
      });
    });

    it('should return 400 when payment already captured', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-123',
        userId: 'user-123',
        stripePaymentIntentId: 'pi_123',
      });
      mockStripeService.getEscrowStatus.mockResolvedValue({
        requiresCapture: false,
        status: 'succeeded',
      });

      mockReq = { user: { id: 'user-123' }, body: { transactionId: 'txn-123' } };

      await controller.capturePayment(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Payment already captured',
        message: 'This payment has already been completed.',
      });
    });

    it('should capture payment successfully', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-123',
        userId: 'user-123',
        providerId: 'provider-123',
        stripePaymentIntentId: 'pi_123',
        totalAmount: 5000,
        applicationFeeAmount: 500,
        instantPayoutSelected: false,
        provider: { stripeConnectId: 'acct_provider' },
      });
      mockStripeService.getEscrowStatus.mockResolvedValue({
        requiresCapture: true,
        status: 'requires_capture',
      });
      mockStripeService.capturePayment.mockResolvedValue({
        amountCaptured: 5000,
        transferId: 'tr_123',
      });
      mockPrisma.transaction.update.mockResolvedValue({});

      mockReq = { user: { id: 'user-123' }, body: { transactionId: 'txn-123' } };

      await controller.capturePayment(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Payment released to provider',
        amountCaptured: 5000,
        transferId: 'tr_123',
        instantPayoutAttempted: false,
        instantPayoutSucceeded: false,
        instantPayoutPayoutId: undefined,
      });
    });
  });

  describe('getEscrowStatus', () => {
    it('should return 403 when user is neither customer nor provider', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-123',
        userId: 'other-user',
        providerId: 'another-provider',
        stripePaymentIntentId: 'pi_123',
      });

      mockReq = { user: { id: 'user-123' }, params: { transactionId: 'txn-123' } };

      await controller.getEscrowStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Not authorized' });
    });

    it('should allow customer to view escrow status', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-123',
        userId: 'user-123',
        providerId: 'provider-123',
        stripePaymentIntentId: 'pi_123',
        totalAmount: 5000,
      });
      mockStripeService.getEscrowStatus.mockResolvedValue({
        requiresCapture: true,
        status: 'requires_capture',
        amount: 5000,
        capturedAmount: 0,
        expiresAt: new Date('2024-01-15'),
      });

      mockReq = { user: { id: 'user-123' }, params: { transactionId: 'txn-123' } };

      await controller.getEscrowStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        inEscrow: true,
        status: 'requires_capture',
        amount: 5000,
        capturedAmount: 0,
        expiresAt: new Date('2024-01-15'),
        message: 'Payment is held in escrow. Customer must confirm job completion to release funds.',
      });
    });

    it('should allow provider to view escrow status', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-123',
        userId: 'customer-123',
        providerId: 'user-123',
        stripePaymentIntentId: 'pi_123',
        totalAmount: 5000,
      });
      mockStripeService.getEscrowStatus.mockResolvedValue({
        requiresCapture: false,
        status: 'succeeded',
        amount: 5000,
        capturedAmount: 5000,
      });

      mockReq = { user: { id: 'user-123' }, params: { transactionId: 'txn-123' } };

      await controller.getEscrowStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        inEscrow: false,
        status: 'succeeded',
        amount: 5000,
        capturedAmount: 5000,
        expiresAt: undefined,
        message: 'Payment has been completed and transferred to provider.',
      });
    });
  });

  describe('createSubscriptionCheckout', () => {
    it('should create subscription checkout session', async () => {
      mockStripeService.isEnabled.mockReturnValue(true);
      mockStripeService.createSubscriptionCheckoutSession.mockResolvedValue({
        sessionId: 'cs_123',
        url: 'https://checkout.stripe.com/cs_123',
      });

      mockReq = {
        user: { id: 'user-123', email: 'user@test.com' },
        body: { plan: 'PRO' },
      };

      await controller.createSubscriptionCheckout(mockReq as Request, mockRes as Response);

      expect(mockStripeService.createSubscriptionCheckoutSession).toHaveBeenCalledWith({
        userId: 'user-123',
        email: 'user@test.com',
        plan: 'PRO',
        successUrl: 'http://localhost:5173/profile?subscription=success',
        cancelUrl: 'http://localhost:5173/profile?subscription=cancel',
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        sessionId: 'cs_123',
        url: 'https://checkout.stripe.com/cs_123',
      });
    });
  });
});
