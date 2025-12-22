/**
 * Stripe Connect Service
 * 
 * This service handles all Stripe payment operations for SpannerWork.
 * Uses Stripe Connect for marketplace payments with platform fees.
 * 
 * SETUP REQUIRED:
 * 1. Create Stripe account at https://dashboard.stripe.com
 * 2. Enable Connect in your Stripe dashboard
 * 3. Set environment variables (see .env.example)
 * 4. Configure webhook endpoint in Stripe dashboard
 * 
 * @see https://stripe.com/docs/connect
 */

import Stripe from 'stripe';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface StripeConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  platformFeePercent: number;
}

export interface CreateConnectAccountParams {
  userId: string;
  email: string;
  country?: string;
  businessType?: 'individual' | 'company';
}

export interface ConnectAccountResult {
  accountId: string;
  onboardingUrl: string;
  expiresAt: Date;
}

export interface CreatePaymentIntentParams {
  transactionId: string;
  amount: number; // In pence/cents
  currency?: string;
  customerId?: string;
  providerAccountId: string;
  applicationFeeAmount?: number; // In pence/cents
  metadata?: Record<string, string>;
  /** 
   * If true, uses manual capture (escrow) - payment is authorized but not captured.
   * Customer's card is charged only when capturePayment() is called.
   * Default: true for service bookings (escrow mode)
   */
  useEscrow?: boolean;
}

export interface PaymentIntentResult {
  paymentIntentId: string;
  clientSecret: string;
  status: PaymentIntentStatus;
  amount: number;
  currency: string;
  /** True if payment is in escrow (authorized but not captured) */
  requiresCapture: boolean;
}

export interface CapturePaymentParams {
  paymentIntentId: string;
  /** Optional: capture a different amount than originally authorized */
  amountToCapture?: number;
}

export interface CaptureResult {
  paymentIntentId: string;
  status: PaymentIntentStatus;
  amountCaptured: number;
  transferId?: string;
}

export type PaymentIntentStatus = 
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'requires_capture'
  | 'canceled'
  | 'succeeded';

export interface RefundParams {
  paymentIntentId: string;
  amount?: number; // Partial refund amount, full refund if not specified
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}

export interface RefundResult {
  refundId: string;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';
}

export interface TransferParams {
  amount: number;
  destinationAccountId: string;
  transactionId: string;
  description?: string;
  idempotencyKey?: string;
}

export interface TransferResult {
  transferId: string;
  amount: number;
  destinationAccountId: string;
  status: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
  created: number;
}

export interface AccountStatus {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirements: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
  };
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class StripeService {
  private secretKey: string;
  private webhookSecret: string;
  private platformFeePercent: number;
  private isConfigured: boolean;
  private stripe: Stripe | null = null;

  constructor() {
    this.secretKey = env.STRIPE_SECRET_KEY || '';
    this.webhookSecret = env.STRIPE_WEBHOOK_SECRET || '';
    this.platformFeePercent = parseInt(env.PLATFORM_FEE_PERCENTAGE || '10', 10);
    this.isConfigured = Boolean(this.secretKey && this.webhookSecret);

    if (this.isConfigured) {
      this.stripe = new Stripe(this.secretKey);
    } else {
      logger.warn('Stripe is not configured. Payment features will be disabled.');
    }

  }

  async ensureCustomerId(params: { userId: string; email: string }): Promise<string> {
    this.ensureConfigured();
    const stripe = this.getStripe();

    const existing = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { stripeCustomerId: true },
    });

    if (existing?.stripeCustomerId) {
      return existing.stripeCustomerId;
    }

    const customer = await stripe.customers.create({
      email: params.email,
      metadata: {
        userId: params.userId,
      },
    });

    await prisma.user.update({
      where: { id: params.userId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  async createSubscriptionCheckoutSession(params: {
    userId: string;
    email: string;
    plan: 'PRO' | 'BUSINESS';
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string; sessionId: string }> {
    this.ensureConfigured();
    const stripe = this.getStripe();

    const customerId = await this.ensureCustomerId({ userId: params.userId, email: params.email });

    const priceId = params.plan === 'PRO' ? env.STRIPE_PRO_PRICE_ID : env.STRIPE_BUSINESS_PRICE_ID;
    if (!priceId) {
      throw new Error('Stripe price is not configured');
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        userId: params.userId,
        plan: params.plan,
      },
    });

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL');
    }

    return { url: session.url, sessionId: session.id };
  }

  async createBillingPortalSession(params: {
    userId: string;
    email: string;
    returnUrl: string;
  }): Promise<{ url: string }> {
    this.ensureConfigured();
    const stripe = this.getStripe();

    const customerId = await this.ensureCustomerId({ userId: params.userId, email: params.email });

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: params.returnUrl,
    });

    return { url: session.url };
  }

  async createInstantPayout(params: {
    stripeAccountId: string;
    amount: number;
    currency?: string;
    transactionId: string;
    idempotencyKey?: string;
  }): Promise<{ payoutId: string }> {
    this.ensureConfigured();
    const stripe = this.getStripe();

    const payout = await stripe.payouts.create(
      {
        amount: params.amount,
        currency: params.currency || 'gbp',
        method: 'instant',
        metadata: {
          transactionId: params.transactionId,
        },
      },
      {
        stripeAccount: params.stripeAccountId,
        idempotencyKey: params.idempotencyKey,
      }
    );

    return { payoutId: payout.id };
  }

  /**
   * Get the Stripe client instance
   */
  private getStripe(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }
    return this.stripe;
  }

  /**
   * Check if Stripe is properly configured
   */
  isEnabled(): boolean {
    return this.isConfigured;
  }

  /**
   * Get the publishable key for client-side use
   */
  getPublishableKey(): string {
    return env.STRIPE_PUBLISHABLE_KEY || '';
  }

  // ==========================================================================
  // CONNECT ACCOUNT MANAGEMENT
  // ==========================================================================

  /**
   * Create a Stripe Connect account for a provider
   * This allows providers to receive payments directly
   */
  async createConnectAccount(params: CreateConnectAccountParams): Promise<ConnectAccountResult> {
    this.ensureConfigured();
    const stripe = this.getStripe();

    logger.info(`Creating Stripe Connect account for user ${params.userId}`);

    const account = await stripe.accounts.create({
      type: 'express',
      country: params.country || 'GB',
      email: params.email,
      business_type: params.businessType || 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        userId: params.userId,
      },
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${env.FRONTEND_URL}/provider/onboarding/refresh`,
      return_url: `${env.FRONTEND_URL}/provider/onboarding/complete`,
      type: 'account_onboarding',
    });

    return {
      accountId: account.id,
      onboardingUrl: accountLink.url,
      expiresAt: new Date(accountLink.expires_at * 1000),
    };
  }

  /**
   * Generate a new onboarding link for an existing Connect account
   */
  async createOnboardingLink(accountId: string): Promise<string> {
    this.ensureConfigured();
    const stripe = this.getStripe();

    logger.info(`Creating onboarding link for account ${accountId}`);

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${env.FRONTEND_URL}/provider/onboarding/refresh`,
      return_url: `${env.FRONTEND_URL}/provider/onboarding/complete`,
      type: 'account_onboarding',
    });

    return accountLink.url;
  }

  /**
   * Get the status of a Connect account
   */
  async getAccountStatus(accountId: string): Promise<AccountStatus> {
    this.ensureConfigured();
    const stripe = this.getStripe();

    logger.info(`Getting status for account ${accountId}`);

    const account = await stripe.accounts.retrieve(accountId);

    return {
      accountId: account.id,
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      detailsSubmitted: account.details_submitted ?? false,
      requirements: {
        currentlyDue: account.requirements?.currently_due || [],
        eventuallyDue: account.requirements?.eventually_due || [],
        pastDue: account.requirements?.past_due || [],
      },
    };
  }

  /**
   * Create a login link for the Connect Express dashboard
   */
  async createDashboardLink(accountId: string): Promise<string> {
    this.ensureConfigured();
    const stripe = this.getStripe();

    const loginLink = await stripe.accounts.createLoginLink(accountId);

    return loginLink.url;
  }

  // ==========================================================================
  // PAYMENT PROCESSING
  // ==========================================================================

  /**
   * Create a payment intent for a transaction
   * 
   * ESCROW MODE (useEscrow = true, default):
   * - Payment is authorized but NOT captured immediately
   * - Customer's card is verified and funds are held
   * - Funds are only captured when capturePayment() is called
   * - This provides escrow protection for service bookings
   * 
   * IMMEDIATE MODE (useEscrow = false):
   * - Payment is captured immediately
   * - Use for tool/space rentals or when escrow isn't needed
   */
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    this.ensureConfigured();
    const stripe = this.getStripe();

    const useEscrow = params.useEscrow !== false; // Default to escrow mode
    logger.info(`Creating payment intent for transaction ${params.transactionId} (escrow: ${useEscrow})`);

    const applicationFeeAmount = typeof params.applicationFeeAmount === 'number'
      ? params.applicationFeeAmount
      : Math.round(params.amount * (this.platformFeePercent / 100));

    if (applicationFeeAmount < 0 || applicationFeeAmount > params.amount) {
      throw new Error('Invalid application fee amount');
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency || 'gbp',
      customer: params.customerId,
      application_fee_amount: applicationFeeAmount,
      // ESCROW: Use manual capture so we can hold funds until job completion
      capture_method: useEscrow ? 'manual' : 'automatic',
      transfer_data: {
        destination: params.providerAccountId,
      },
      metadata: {
        transactionId: params.transactionId,
        useEscrow: useEscrow ? 'true' : 'false',
        ...params.metadata,
      },
      // Payment intent description for customer's bank statement
      statement_descriptor_suffix: 'SPANNERWORK',
    });

    logger.info(`Created payment intent ${paymentIntent.id} (capture_method: ${paymentIntent.capture_method})`);

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
      status: paymentIntent.status as PaymentIntentStatus,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      requiresCapture: paymentIntent.status === 'requires_capture',
    };
  }

  /**
   * Capture a payment that was authorized with escrow mode
   * 
   * This should be called when:
   * - Customer confirms the job/service is complete
   * - After the agreed service period ends (auto-capture)
   * - Admin resolves a dispute in provider's favor
   * 
   * Note: Uncaptured payments expire after 7 days (Stripe limit)
   */
  async capturePayment(params: CapturePaymentParams): Promise<CaptureResult> {
    this.ensureConfigured();
    const stripe = this.getStripe();

    logger.info(`Capturing payment ${params.paymentIntentId}`);

    const captureParams: Stripe.PaymentIntentCaptureParams = {};
    if (params.amountToCapture) {
      captureParams.amount_to_capture = params.amountToCapture;
    }

    const paymentIntent = await stripe.paymentIntents.capture(
      params.paymentIntentId,
      captureParams
    );

    logger.info(`Payment captured: ${paymentIntent.id}, status: ${paymentIntent.status}`);

    // Get transfer ID if available
    let transferId: string | undefined;
    if (paymentIntent.transfer_data?.destination) {
      const transfers = await stripe.transfers.list({
        destination: paymentIntent.transfer_data.destination as string,
        limit: 1,
      });
      if (transfers.data.length > 0) {
        transferId = transfers.data[0].id;
      }
    }

    return {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status as PaymentIntentStatus,
      amountCaptured: paymentIntent.amount_received,
      transferId,
    };
  }

  /**
   * Get the escrow status of a payment
   */
  async getEscrowStatus(paymentIntentId: string): Promise<{
    status: PaymentIntentStatus;
    requiresCapture: boolean;
    amount: number;
    capturedAmount: number;
    expiresAt?: Date;
  }> {
    this.ensureConfigured();
    const stripe = this.getStripe();

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Calculate expiry (uncaptured payments expire after 7 days)
    let expiresAt: Date | undefined;
    if (paymentIntent.status === 'requires_capture') {
      expiresAt = new Date(paymentIntent.created * 1000 + 7 * 24 * 60 * 60 * 1000);
    }

    return {
      status: paymentIntent.status as PaymentIntentStatus,
      requiresCapture: paymentIntent.status === 'requires_capture',
      amount: paymentIntent.amount,
      capturedAmount: paymentIntent.amount_received,
      expiresAt,
    };
  }

  /**
   * Confirm a payment intent (server-side confirmation)
   */
  async confirmPaymentIntent(paymentIntentId: string): Promise<PaymentIntentResult> {
    this.ensureConfigured();
    const stripe = this.getStripe();

    logger.info(`Confirming payment intent ${paymentIntentId}`);

    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
      status: paymentIntent.status as PaymentIntentStatus,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      requiresCapture: paymentIntent.status === 'requires_capture',
    };
  }

  /**
   * Cancel a payment intent
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    this.ensureConfigured();
    const stripe = this.getStripe();

    logger.info(`Canceling payment intent ${paymentIntentId}`);

    await stripe.paymentIntents.cancel(paymentIntentId);
  }

  /**
   * Retrieve a payment intent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<PaymentIntentResult> {
    this.ensureConfigured();
    const stripe = this.getStripe();

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
      status: paymentIntent.status as PaymentIntentStatus,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      requiresCapture: paymentIntent.status === 'requires_capture',
    };
  }

  // ==========================================================================
  // REFUNDS
  // ==========================================================================

  /**
   * Create a refund for a payment
   */
  async createRefund(params: RefundParams): Promise<RefundResult> {
    this.ensureConfigured();
    const stripe = this.getStripe();

    logger.info(`Creating refund for payment ${params.paymentIntentId}`);

    const refund = await stripe.refunds.create({
      payment_intent: params.paymentIntentId,
      amount: params.amount, // undefined = full refund
      reason: params.reason,
      reverse_transfer: true, // Reverse the transfer to provider
      refund_application_fee: true, // Refund the platform fee too
    });

    return {
      refundId: refund.id,
      amount: refund.amount ?? 0,
      status: (refund.status ?? 'pending') as RefundResult['status'],
    };
  }

  // ==========================================================================
  // TRANSFERS (for manual payouts if needed)
  // ==========================================================================

  /**
   * Create a transfer to a Connect account
   * This is typically automatic with payment intents, but can be done manually
   */
  async createTransfer(params: TransferParams): Promise<TransferResult> {
    this.ensureConfigured();
    const stripe = this.getStripe();

    logger.info(`Creating transfer of ${params.amount} to ${params.destinationAccountId}`);

    const transfer = await stripe.transfers.create(
      {
        amount: params.amount,
        currency: 'gbp',
        destination: params.destinationAccountId,
        transfer_group: params.transactionId,
        description: params.description,
      },
      params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined
    );

    return {
      transferId: transfer.id,
      amount: transfer.amount,
      destinationAccountId: transfer.destination as string,
      status: 'pending',
    };
  }

  // ==========================================================================
  // WEBHOOKS
  // ==========================================================================

  /**
   * Verify and parse a webhook event from Stripe
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): WebhookEvent {
    this.ensureConfigured();
    const stripe = this.getStripe();

    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret
    );

    return event as unknown as WebhookEvent;
  }

  /**
   * Handle a webhook event
   * This should be called after verifying the signature
   */
  async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    logger.info(`Handling webhook event: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSucceeded(event);
        break;

      case 'payment_intent.amount_capturable_updated':
        await this.handlePaymentAuthorized(event);
        break;
      
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event);
        break;
      
      case 'account.updated':
        await this.handleAccountUpdated(event);
        break;
      
      case 'transfer.created':
        await this.handleTransferCreated(event);
        break;
      
      case 'payout.paid':
        await this.handlePayoutPaid(event);
        break;

      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event);
        break;

      case 'customer.subscription.updated':
        await this.handleCustomerSubscriptionUpdated(event);
        break;

      case 'customer.subscription.deleted':
        await this.handleCustomerSubscriptionDeleted(event);
        break;
      
      case 'charge.refunded':
        await this.handleChargeRefunded(event);
        break;
      
      case 'charge.dispute.created':
        await this.handleDisputeCreated(event);
        break;
      
      default:
        logger.debug(`Unhandled webhook event type: ${event.type}`);
    }
  }

  // ==========================================================================
  // WEBHOOK HANDLERS (private)
  // ==========================================================================

  private async handlePaymentSucceeded(event: WebhookEvent): Promise<void> {
    const paymentIntent = event.data.object as { 
      id: string; 
      metadata?: { transactionId?: string };
      amount_received: number;
    };
    const transactionId = paymentIntent.metadata?.transactionId;

    if (!transactionId) {
      logger.warn(`Payment succeeded but no transactionId in metadata: ${paymentIntent.id}`);
      return;
    }

    logger.info(`Payment succeeded for transaction ${transactionId}`);

    // Update transaction payment status to PAID
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { paymentStatus: 'PAID' },
    });
  }

  /**
   * Handle payment authorized (escrow) - funds are held but not captured
   * This fires when customer completes payment for an escrow transaction
   */
  private async handlePaymentAuthorized(event: WebhookEvent): Promise<void> {
    const paymentIntent = event.data.object as { 
      id: string; 
      metadata?: { transactionId?: string; useEscrow?: string };
      amount_capturable: number;
    };
    const transactionId = paymentIntent.metadata?.transactionId;

    if (!transactionId) {
      logger.warn(`Payment authorized but no transactionId in metadata: ${paymentIntent.id}`);
      return;
    }

    logger.info(`Payment authorized (escrow) for transaction ${transactionId}, amount: ${paymentIntent.amount_capturable}`);

    // Update transaction to show funds are held in escrow
    // Payment status stays PENDING until captured, but we can track escrow status
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { 
        status: 'CONFIRMED', // Move from PENDING to CONFIRMED since payment is authorized
      },
    });
  }

  private async handlePaymentFailed(event: WebhookEvent): Promise<void> {
    const paymentIntent = event.data.object as { id: string; metadata?: { transactionId?: string } };
    const transactionId = paymentIntent.metadata?.transactionId;

    if (transactionId) {
      logger.error(`Payment failed for transaction ${transactionId}`);
      // TODO: Update transaction status and notify user
    }
  }

  private async handleAccountUpdated(event: WebhookEvent): Promise<void> {
    const account = event.data.object as { id: string; charges_enabled: boolean };
    logger.info(`Connect account updated: ${account.id}, charges_enabled: ${account.charges_enabled}`);

    // TODO: Update user's stripeAccountStatus in database
  }

  private async handleTransferCreated(event: WebhookEvent): Promise<void> {
    const transfer = event.data.object as { id: string; amount: number };
    logger.info(`Transfer created: ${transfer.id}, amount: ${transfer.amount}`);
  }

  private async handlePayoutPaid(event: WebhookEvent): Promise<void> {
    const payout = event.data.object as { id: string; amount: number };
    logger.info(`Payout completed: ${payout.id}, amount: ${payout.amount}`);
  }

  private async handleCheckoutSessionCompleted(event: WebhookEvent): Promise<void> {
    const session = event.data.object as {
      id: string;
      mode?: string;
      metadata?: { userId?: string; plan?: string };
      customer?: string;
      subscription?: string;
    };

    if (session.mode !== 'subscription') {
      return;
    }

    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan;
    if (!userId || (plan !== 'PRO' && plan !== 'BUSINESS')) {
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        providerPlan: plan,
        stripeCustomerId: session.customer || undefined,
        stripeSubscriptionId: session.subscription || undefined,
        stripeSubscriptionStatus: 'active',
      } as unknown as Record<string, unknown>,
    });
  }

  private async handleCustomerSubscriptionUpdated(event: WebhookEvent): Promise<void> {
    const subscription = event.data.object as {
      id: string;
      customer: string;
      status: string;
      items?: { data?: Array<{ price?: { id?: string } }> };
    };

    const priceId = subscription.items?.data?.[0]?.price?.id;
    let providerPlan: 'FREE' | 'PRO' | 'BUSINESS' = 'FREE';

    if (subscription.status === 'active' || subscription.status === 'trialing') {
      if (priceId && env.STRIPE_BUSINESS_PRICE_ID && priceId === env.STRIPE_BUSINESS_PRICE_ID) {
        providerPlan = 'BUSINESS';
      } else if (priceId && env.STRIPE_PRO_PRICE_ID && priceId === env.STRIPE_PRO_PRICE_ID) {
        providerPlan = 'PRO';
      }
    }

    await prisma.user.updateMany({
      where: { stripeCustomerId: subscription.customer },
      data: {
        providerPlan,
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionStatus: subscription.status,
      } as unknown as Record<string, unknown>,
    });
  }

  private async handleCustomerSubscriptionDeleted(event: WebhookEvent): Promise<void> {
    const subscription = event.data.object as { id: string; customer: string; status: string };

    await prisma.user.updateMany({
      where: { stripeCustomerId: subscription.customer },
      data: {
        providerPlan: 'FREE',
        stripeSubscriptionId: null,
        stripeSubscriptionStatus: subscription.status,
      } as unknown as Record<string, unknown>,
    });
  }

  private async handleChargeRefunded(event: WebhookEvent): Promise<void> {
    const charge = event.data.object as { id: string; payment_intent: string };
    logger.info(`Charge refunded: ${charge.id}`);

    // TODO: Update transaction status
  }

  private async handleDisputeCreated(event: WebhookEvent): Promise<void> {
    const dispute = event.data.object as { id: string; charge: string };
    logger.error(`Dispute created for charge: ${dispute.charge}`);

    // TODO: Create dispute record and notify admin
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Ensure Stripe is configured before making API calls
   */
  private ensureConfigured(): void {
    if (!this.isConfigured) {
      throw new Error(
        'Stripe is not configured. Please set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET environment variables.'
      );
    }
  }

  /**
   * Calculate platform fee for an amount
   */
  calculatePlatformFee(amount: number): number {
    return Math.round(amount * (this.platformFeePercent / 100));
  }

  /**
   * Calculate provider payout after platform fee
   */
  calculateProviderAmount(amount: number): number {
    return amount - this.calculatePlatformFee(amount);
  }
}

// Export singleton instance
export const stripeService = new StripeService();
