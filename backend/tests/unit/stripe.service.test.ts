import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mocks
const mockStripe = vi.hoisted(() => ({
  accounts: {
    create: vi.fn(),
    retrieve: vi.fn(),
    createLoginLink: vi.fn(),
  },
  accountLinks: {
    create: vi.fn(),
  },
  paymentIntents: {
    create: vi.fn(),
    capture: vi.fn(),
    retrieve: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(),
  },
  refunds: {
    create: vi.fn(),
  },
  transfers: {
    create: vi.fn(),
    list: vi.fn(),
  },
  charges: {
    retrieve: vi.fn(),
  },
  webhooks: {
    constructEvent: vi.fn(),
  },
  customers: {
    create: vi.fn(),
  },
  checkout: {
    sessions: {
      create: vi.fn(),
    },
  },
  billingPortal: {
    sessions: {
      create: vi.fn(),
    },
  },
  payouts: {
    create: vi.fn(),
  },
}));

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  transaction: {
    update: vi.fn(),
    findFirst: vi.fn(),
  },
  userStats: {
    upsert: vi.fn(),
    update: vi.fn(),
  },
  dispute: {
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}));

vi.mock('stripe', () => {
  return {
    default: function Stripe() {
      return mockStripe;
    },
  };
});

vi.mock('../../src/config/database.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
    PLATFORM_FEE_PERCENTAGE: '10',
    FRONTEND_URL: 'https://spannerwork.test',
    STRIPE_PRO_PRICE_ID: 'price_pro',
    STRIPE_BUSINESS_PRICE_ID: 'price_business',
  },
}));

vi.mock('../../src/services/email.service.js', () => ({
  emailService: {
    sendPaymentFailedEmail: vi.fn(),
    sendStripeAccountIssueEmail: vi.fn(),
    sendRefundConfirmationEmail: vi.fn(),
    sendRefundNotificationToProviderEmail: vi.fn(),
    sendDisputeAlertEmail: vi.fn(),
  },
}));

import { StripeService } from '../../src/services/stripe.service.js';

describe('StripeService', () => {
  let stripeService: StripeService;

  beforeEach(() => {
    vi.clearAllMocks();
    stripeService = new StripeService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('isEnabled', () => {
    it('returns true when configured', () => {
      expect(stripeService.isEnabled()).toBe(true);
    });
  });

  describe('getPublishableKey', () => {
    it('returns the publishable key', () => {
      expect(stripeService.getPublishableKey()).toBe('pk_test_123');
    });
  });

  describe('calculatePlatformFee', () => {
    it('calculates 10% platform fee', () => {
      expect(stripeService.calculatePlatformFee(10000)).toBe(1000);
    });

    it('handles small amounts', () => {
      expect(stripeService.calculatePlatformFee(100)).toBe(10);
    });
  });

  describe('calculateProviderAmount', () => {
    it('calculates provider amount after fee', () => {
      expect(stripeService.calculateProviderAmount(10000)).toBe(9000);
    });
  });

  describe('createConnectAccount', () => {
    it('creates a Connect account and returns onboarding URL', async () => {
      mockStripe.accounts.create.mockResolvedValue({ id: 'acct_123' });
      mockStripe.accountLinks.create.mockResolvedValue({
        url: 'https://connect.stripe.com/onboarding',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      });

      const result = await stripeService.createConnectAccount({
        userId: 'user_123',
        email: 'test@example.com',
      });

      expect(result.accountId).toBe('acct_123');
      expect(result.onboardingUrl).toBe('https://connect.stripe.com/onboarding');
      expect(mockStripe.accounts.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'express',
          country: 'GB',
          email: 'test@example.com',
        })
      );
    });
  });

  describe('getAccountStatus', () => {
    it('returns account status', async () => {
      mockStripe.accounts.retrieve.mockResolvedValue({
        id: 'acct_123',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        requirements: {
          currently_due: [],
          eventually_due: [],
          past_due: [],
        },
      });

      const result = await stripeService.getAccountStatus('acct_123');

      expect(result.chargesEnabled).toBe(true);
      expect(result.payoutsEnabled).toBe(true);
      expect(result.detailsSubmitted).toBe(true);
    });
  });

  describe('createPaymentIntent', () => {
    it('creates payment intent with escrow mode by default', async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_123',
        client_secret: 'pi_123_secret',
        status: 'requires_payment_method',
        amount: 10000,
        currency: 'gbp',
      });

      const result = await stripeService.createPaymentIntent({
        transactionId: 'txn_123',
        amount: 10000,
        providerAccountId: 'acct_123',
      });

      expect(result.paymentIntentId).toBe('pi_123');
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          capture_method: 'manual',
          amount: 10000,
        })
      );
    });

    it('creates payment intent with automatic capture when escrow disabled', async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_123',
        client_secret: 'pi_123_secret',
        status: 'succeeded',
        amount: 10000,
        currency: 'gbp',
      });

      await stripeService.createPaymentIntent({
        transactionId: 'txn_123',
        amount: 10000,
        providerAccountId: 'acct_123',
        useEscrow: false,
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          capture_method: 'automatic',
        })
      );
    });
  });

  describe('capturePayment', () => {
    it('captures a payment', async () => {
      mockStripe.paymentIntents.capture.mockResolvedValue({
        id: 'pi_123',
        status: 'succeeded',
        amount_received: 10000,
        transfer_data: { destination: 'acct_123' },
      });
      mockStripe.transfers.list.mockResolvedValue({ data: [{ id: 'tr_123' }] });

      const result = await stripeService.capturePayment({ paymentIntentId: 'pi_123' });

      expect(result.status).toBe('succeeded');
      expect(result.amountCaptured).toBe(10000);
    });
  });

  describe('createRefund', () => {
    it('creates a refund', async () => {
      mockStripe.refunds.create.mockResolvedValue({
        id: 're_123',
        amount: 5000,
        status: 'succeeded',
      });

      const result = await stripeService.createRefund({ paymentIntentId: 'pi_123' });

      expect(result.refundId).toBe('re_123');
      expect(result.amount).toBe(5000);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('verifies webhook signature', () => {
      const mockEvent = { id: 'evt_123', type: 'payment_intent.succeeded' };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = stripeService.verifyWebhookSignature('payload', 'sig_123');

      expect(result.id).toBe('evt_123');
    });
  });

  describe('handleWebhookEvent', () => {
    describe('payment_intent.succeeded', () => {
      it('updates transaction to PAID', async () => {
        const event = {
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_123',
              metadata: { transactionId: 'txn_123' },
              amount_received: 10000,
            },
          },
        };

        await stripeService.handleWebhookEvent(event as any);

        expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
          where: { id: 'txn_123' },
          data: { paymentStatus: 'PAID' },
        });
      });
    });

    describe('payment_intent.payment_failed', () => {
      it('updates transaction to FAILED and notifies user', async () => {
        mockPrisma.transaction.update.mockResolvedValue({
          id: 'txn_123',
          totalAmount: 10000,
          user: { id: 'user_123', email: 'user@test.com', name: 'John' },
          provider: { id: 'prov_123', email: 'provider@test.com', name: 'Jane' },
        });

        const event = {
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: 'pi_123',
              metadata: { transactionId: 'txn_123' },
              last_payment_error: { message: 'Card declined' },
            },
          },
        };

        await stripeService.handleWebhookEvent(event as any);

        expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'txn_123' },
            data: { paymentStatus: 'FAILED', status: 'CANCELLED' },
          })
        );
      });
    });

    describe('account.updated', () => {
      it('updates user when account has issues', async () => {
        mockPrisma.user.findFirst.mockResolvedValue({
          id: 'user_123',
          email: 'user@test.com',
          name: 'John',
        });
        mockPrisma.user.update.mockResolvedValue({});

        const event = {
          type: 'account.updated',
          data: {
            object: {
              id: 'acct_123',
              charges_enabled: false,
              payouts_enabled: false,
              details_submitted: true,
              requirements: {
                disabled_reason: 'requirements.past_due',
                currently_due: ['identity_document'],
                past_due: ['identity_document'],
              },
            },
          },
        };

        await stripeService.handleWebhookEvent(event as any);

        expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
          where: { stripeConnectId: 'acct_123' },
        });
      });
    });

    describe('transfer.created', () => {
      it('updates transaction and provider earnings', async () => {
        mockPrisma.transaction.update.mockResolvedValue({});
        mockPrisma.user.findFirst.mockResolvedValue({ id: 'prov_123' });
        mockPrisma.userStats.upsert.mockResolvedValue({});

        const event = {
          type: 'transfer.created',
          data: {
            object: {
              id: 'tr_123',
              amount: 9000,
              destination: 'acct_123',
              transfer_group: 'txn_123',
            },
          },
        };

        await stripeService.handleWebhookEvent(event as any);

        expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
          where: { id: 'txn_123' },
          data: { stripeTransferId: 'tr_123' },
        });
      });
    });

    describe('payout.paid', () => {
      it('creates audit log entry', async () => {
        mockPrisma.auditLog.create.mockResolvedValue({});

        const event = {
          type: 'payout.paid',
          data: {
            object: {
              id: 'po_123',
              amount: 9000,
              arrival_date: Math.floor(Date.now() / 1000),
              metadata: { transactionId: 'txn_123' },
            },
          },
        };

        await stripeService.handleWebhookEvent(event as any);

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: 'PAYOUT_COMPLETED',
              resourceType: 'Payout',
              resourceId: 'po_123',
            }),
          })
        );
      });
    });

    describe('charge.refunded', () => {
      it('updates transaction to REFUNDED', async () => {
        mockPrisma.transaction.findFirst.mockResolvedValue({
          id: 'txn_123',
          providerId: 'prov_123',
          user: { id: 'user_123', email: 'user@test.com', name: 'John' },
          provider: { id: 'prov_123', email: 'provider@test.com', name: 'Jane' },
        });
        mockPrisma.transaction.update.mockResolvedValue({});
        mockPrisma.userStats.update.mockResolvedValue({});

        const event = {
          type: 'charge.refunded',
          data: {
            object: {
              id: 'ch_123',
              payment_intent: 'pi_123',
              amount_refunded: 10000,
              refunded: true,
            },
          },
        };

        await stripeService.handleWebhookEvent(event as any);

        expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
          where: { id: 'txn_123' },
          data: { paymentStatus: 'REFUNDED', status: 'CANCELLED' },
        });
      });
    });

    describe('charge.dispute.created', () => {
      it('creates dispute record and notifies admins', async () => {
        mockStripe.charges.retrieve.mockResolvedValue({
          id: 'ch_123',
          payment_intent: 'pi_123',
        });
        mockPrisma.transaction.findFirst.mockResolvedValue({
          id: 'txn_123',
          userId: 'user_123',
          providerId: 'prov_123',
          user: { id: 'user_123', email: 'user@test.com', name: 'John' },
          provider: { id: 'prov_123', email: 'provider@test.com', name: 'Jane' },
        });
        mockPrisma.dispute.create.mockResolvedValue({ id: 'dispute_123' });
        mockPrisma.user.findMany.mockResolvedValue([
          { email: 'admin@test.com', name: 'Admin' },
        ]);
        mockPrisma.auditLog.create.mockResolvedValue({});

        const event = {
          type: 'charge.dispute.created',
          data: {
            object: {
              id: 'dp_123',
              charge: 'ch_123',
              amount: 10000,
              reason: 'fraudulent',
              status: 'needs_response',
              evidence_details: { due_by: Math.floor(Date.now() / 1000) + 86400 },
            },
          },
        };

        await stripeService.handleWebhookEvent(event as any);

        expect(mockPrisma.dispute.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              transactionId: 'txn_123',
              reason: expect.stringContaining('Stripe Dispute'),
            }),
          })
        );
        expect(mockPrisma.auditLog.create).toHaveBeenCalled();
      });
    });
  });
});
