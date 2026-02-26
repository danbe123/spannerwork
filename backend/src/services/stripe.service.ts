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
import { redis, isRedisAvailable, prefixKey } from '../config/redis.js';

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
    // FIX: Platform fee default aligned with FREE tier (5%) from transaction.service.ts
    // Actual fee should always come from transaction.applicationFeeAmount which is calculated
    // based on provider's plan: BUSINESS=2%, PRO=3%, FREE=5%
    this.platformFeePercent = parseInt(env.PLATFORM_FEE_PERCENTAGE || '5', 10);
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

    const paymentIntent = await stripe.paymentIntents.create(
      {
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
      },
      {
        // Idempotency key prevents duplicate charges if request is retried
        // Using transactionId ensures one payment intent per transaction
        idempotencyKey: `pi_${params.transactionId}`,
      }
    );

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
   * FIX #17: Update the application fee on an uncaptured PaymentIntent
   *
   * This must be called BEFORE capture to ensure CPA fees are included
   * in the platform fee. Stripe allows updating application_fee_amount
   * on uncaptured PaymentIntents.
   */
  async updateApplicationFee(paymentIntentId: string, newApplicationFeeAmount: number): Promise<void> {
    this.ensureConfigured();
    const stripe = this.getStripe();

    logger.info(`Updating application fee for ${paymentIntentId} to ${newApplicationFeeAmount}`);

    await stripe.paymentIntents.update(paymentIntentId, {
      application_fee_amount: newApplicationFeeAmount,
    });

    logger.info(`Application fee updated for ${paymentIntentId}`);
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

    // Calculate expiry (uncaptured payments expire after 7 days from authorization)
    // Note: Stripe doesn't expose the exact authorization timestamp, so we use creation time
    // as an approximation. The difference is typically seconds/minutes and conservative.
    // The 7-day limit may also vary slightly by card network.
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

  // NOTE: Old check/mark methods removed in FIX #9 - replaced by atomic tryClaimWebhookEvent

  /**
   * Handle a webhook event
   * This should be called after verifying the signature
   * FIX #9: Uses atomic claim pattern to prevent double processing from race conditions
   */
  async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    logger.info(`Handling webhook event: ${event.type} (${event.id})`);

    // FIX #9: Atomically try to claim this event BEFORE processing
    // This prevents race conditions where two webhook deliveries are processed simultaneously
    const claimed = await this.tryClaimWebhookEvent(event.id, event.type);
    if (!claimed) {
      logger.info(`Webhook event ${event.id} already claimed by another process, skipping`);
      return;
    }

    try {
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
        return; // Don't mark unhandled events as processed
      }

      logger.info(`Webhook event ${event.id} processed successfully`);
    } catch (error) {
      // FIX #9: Log error but don't unclaim - let the event stay claimed to prevent retries causing duplicate processing
      logger.error(`Error processing webhook event ${event.id}:`, error);
      throw error;
    }
  }

  /**
   * FIX #9: Atomically try to claim a webhook event for processing
   * Returns true if successfully claimed, false if already claimed
   *
   * Uses database as source of truth with Redis as fast-path optimization.
   * This prevents race conditions when Redis availability changes mid-processing.
   */
  private async tryClaimWebhookEvent(eventId: string, eventType: string): Promise<boolean> {
    // ALWAYS use database as the authoritative source of truth
    // This prevents race conditions when Redis is intermittently available
    try {
      await prisma.webhookEvent.create({
        data: {
          eventId,
          eventType,
          processedAt: new Date(),
        },
      });

      // Successfully claimed in DB - also set in Redis for faster future checks
      if (isRedisAvailable() && redis) {
        const key = prefixKey(`webhook:${eventId}`);
        await redis.setex(key, 7 * 24 * 60 * 60, `processed:${eventType}:${Date.now()}`);
      }

      return true;
    } catch (error) {
      // Check if it's a unique constraint violation (already claimed)
      const isUniqueViolation = error instanceof Error &&
        (error.message.includes('Unique constraint') ||
         error.message.includes('unique constraint') ||
         error.message.includes('P2002')); // Prisma unique constraint error code

      if (isUniqueViolation) {
        logger.debug(`Webhook event ${eventId} already claimed, skipping`);
        return false;
      }

      // For other errors, log and re-throw
      logger.error('Failed to claim webhook event', { eventId, eventType, error });
      throw error;
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
    const paymentIntent = event.data.object as {
      id: string;
      metadata?: { transactionId?: string };
      last_payment_error?: { message?: string };
    };
    const transactionId = paymentIntent.metadata?.transactionId;

    if (!transactionId) {
      logger.warn(`Payment failed but no transactionId in metadata: ${paymentIntent.id}`);
      return;
    }

    logger.error(`Payment failed for transaction ${transactionId}`);

    // Update transaction payment status to FAILED
    const transaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        paymentStatus: 'FAILED',
        status: 'CANCELLED',
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
        provider: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    // Notify the user about the failed payment
    try {
      const { emailService } = await import('./email.service.js');
      await emailService.sendPaymentFailedEmail(transaction.user.email, {
        userName: transaction.user.name,
        transactionId,
        amount: transaction.totalAmount,
        errorMessage: paymentIntent.last_payment_error?.message || 'Payment could not be processed',
      });
    } catch (emailError) {
      logger.error('Failed to send payment failed notification email', emailError);
    }
  }

  private async handleAccountUpdated(event: WebhookEvent): Promise<void> {
    const account = event.data.object as {
      id: string;
      charges_enabled: boolean;
      payouts_enabled: boolean;
      details_submitted: boolean;
      requirements?: {
        currently_due?: string[];
        past_due?: string[];
        disabled_reason?: string;
      };
    };

    logger.info(`Connect account updated: ${account.id}, charges_enabled: ${account.charges_enabled}`);

    // Find user by Stripe Connect ID
    const user = await prisma.user.findFirst({
      where: { stripeConnectId: account.id },
    });

    if (!user) {
      logger.warn(`No user found for Stripe Connect account: ${account.id}`);
      return;
    }

    // Determine account status based on Stripe's response
    let accountStatus: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE';
    let suspendedReason: string | null = null;

    if (!account.charges_enabled || !account.payouts_enabled) {
      // If charges or payouts are disabled, account may need attention
      if (account.requirements?.disabled_reason) {
        accountStatus = 'SUSPENDED';
        suspendedReason = `Stripe account issue: ${account.requirements.disabled_reason}`;
      } else if (account.requirements?.past_due && account.requirements.past_due.length > 0) {
        // Has past due requirements - may be restricted soon
        logger.warn(`User ${user.id} has past due Stripe requirements`, {
          pastDue: account.requirements.past_due,
        });
      }
    }

    // Update user record with Stripe account status
    await prisma.user.update({
      where: { id: user.id },
      data: {
        // Only update account status if there's a problem
        ...(accountStatus === 'SUSPENDED' && {
          accountStatus,
          suspendedReason,
          suspendedDate: new Date(),
        }),
      },
    });

    // Send notification if account has issues
    if (!account.charges_enabled && account.details_submitted) {
      try {
        const { emailService } = await import('./email.service.js');
        await emailService.sendStripeAccountIssueEmail(user.email, {
          userName: user.name,
          issue: account.requirements?.disabled_reason || 'Your payment account requires attention',
          requirements: account.requirements?.currently_due || [],
        });
      } catch (emailError) {
        logger.error('Failed to send Stripe account issue email', emailError);
      }
    }

    logger.info(`Updated Stripe account status for user ${user.id}`, {
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    });
  }

  private async handleTransferCreated(event: WebhookEvent): Promise<void> {
    const transfer = event.data.object as {
      id: string;
      amount: number;
      destination: string;
      transfer_group?: string;
      metadata?: { transactionId?: string };
    };

    logger.info(`Transfer created: ${transfer.id}, amount: ${transfer.amount}`);

    // Try to find the transaction from transfer_group (which we set to transactionId)
    const transactionId = transfer.transfer_group || transfer.metadata?.transactionId;

    if (transactionId) {
      // Update transaction with transfer ID
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          stripeTransferId: transfer.id,
        },
      });

      logger.info(`Linked transfer ${transfer.id} to transaction ${transactionId}`);
    }

    // Update provider's earnings in UserStats
    const provider = await prisma.user.findFirst({
      where: { stripeConnectId: transfer.destination },
    });

    if (provider) {
      await prisma.userStats.upsert({
        where: { userId: provider.id },
        update: {
          totalEarned: { increment: transfer.amount },
        },
        create: {
          userId: provider.id,
          totalEarned: transfer.amount,
        },
      });

      logger.info(`Updated earnings for provider ${provider.id}: +${transfer.amount}`);
    }
  }

  private async handlePayoutPaid(event: WebhookEvent): Promise<void> {
    const payout = event.data.object as {
      id: string;
      amount: number;
      arrival_date: number;
      destination?: string;
      metadata?: { transactionId?: string };
    };

    logger.info(`Payout completed: ${payout.id}, amount: ${payout.amount}`);

    // If this is an instant payout linked to a transaction, update it
    if (payout.metadata?.transactionId) {
      await prisma.transaction.update({
        where: { id: payout.metadata.transactionId },
        data: {
          stripeInstantPayoutId: payout.id,
        },
      });

      logger.info(`Linked payout ${payout.id} to transaction ${payout.metadata.transactionId}`);
    }

    // Log payout in audit trail
    await prisma.auditLog.create({
      data: {
        action: 'PAYOUT_COMPLETED',
        userId: 'system',
        resourceType: 'Payout',
        resourceId: payout.id,
        metadata: {
          amount: payout.amount,
          arrivalDate: new Date(payout.arrival_date * 1000).toISOString(),
          transactionId: payout.metadata?.transactionId,
        },
      },
    });
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

  /**
   * FIX: Updated to track subscription period end for proper plan expiry handling
   */
  private async handleCustomerSubscriptionUpdated(event: WebhookEvent): Promise<void> {
    const subscription = event.data.object as {
      id: string;
      customer: string;
      status: string;
      current_period_end?: number;
      cancel_at_period_end?: boolean;
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

    // FIX: Track subscription period end to honor paid plans until expiry
    const subscriptionPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null;

    await prisma.user.updateMany({
      where: { stripeCustomerId: subscription.customer },
      data: {
        providerPlan,
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionStatus: subscription.status,
        subscriptionPeriodEnd,
      } as unknown as Record<string, unknown>,
    });

    logger.info('Subscription updated', {
      customerId: subscription.customer,
      subscriptionId: subscription.id,
      status: subscription.status,
      plan: providerPlan,
      periodEnd: subscriptionPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  }

  /**
   * FIX: When subscription is deleted, keep the current plan until period end
   * This ensures users get what they paid for
   */
  private async handleCustomerSubscriptionDeleted(event: WebhookEvent): Promise<void> {
    const subscription = event.data.object as {
      id: string;
      customer: string;
      status: string;
      current_period_end?: number;
      canceled_at?: number;
    };

    // FIX: Check if the subscription ended at period end (user got full value)
    // or was cancelled mid-period (should still honor remaining time)
    const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : new Date();

    const now = new Date();
    const hasRemainingTime = periodEnd > now;

    if (hasRemainingTime) {
      // FIX: Keep the current plan active until the period ends
      // The user paid for this period, so honor it
      logger.info('Subscription cancelled with remaining time - keeping plan until period end', {
        customerId: subscription.customer,
        subscriptionId: subscription.id,
        periodEnd,
      });

      await prisma.user.updateMany({
        where: { stripeCustomerId: subscription.customer },
        data: {
          stripeSubscriptionId: null,
          stripeSubscriptionStatus: 'canceled',
          subscriptionPeriodEnd: periodEnd,
          // Note: providerPlan is NOT changed here - it stays at the current level
          // The fee calculation logic should check subscriptionPeriodEnd
        } as unknown as Record<string, unknown>,
      });
    } else {
      // Period already ended, safe to downgrade immediately
      await prisma.user.updateMany({
        where: { stripeCustomerId: subscription.customer },
        data: {
          providerPlan: 'FREE',
          stripeSubscriptionId: null,
          stripeSubscriptionStatus: subscription.status,
          subscriptionPeriodEnd: null,
        } as unknown as Record<string, unknown>,
      });

      logger.info('Subscription deleted - downgraded to FREE plan', {
        customerId: subscription.customer,
        subscriptionId: subscription.id,
      });
    }
  }

  private async handleChargeRefunded(event: WebhookEvent): Promise<void> {
    const charge = event.data.object as {
      id: string;
      payment_intent: string | null;
      amount_refunded: number;
      refunded: boolean;
    };

    logger.info(`Charge refunded: ${charge.id}, amount_refunded: ${charge.amount_refunded}`);

    if (!charge.payment_intent) {
      logger.warn(`Refunded charge ${charge.id} has no payment_intent`);
      return;
    }

    // Find transaction by payment intent ID
    const transaction = await prisma.transaction.findFirst({
      where: { stripePaymentIntentId: charge.payment_intent },
      include: {
        user: { select: { id: true, email: true, name: true } },
        provider: { select: { id: true, email: true, name: true } },
      },
    });

    if (!transaction) {
      logger.warn(`No transaction found for payment intent: ${charge.payment_intent}`);
      return;
    }

    // FIX: Idempotency check - skip if already refunded to prevent double-processing
    if (transaction.paymentStatus === 'REFUNDED') {
      logger.info(`Transaction ${transaction.id} already refunded, skipping duplicate webhook`);
      return;
    }

    // Update transaction payment status to REFUNDED
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        paymentStatus: 'REFUNDED',
        status: 'CANCELLED',
      },
    });

    logger.info(`Updated transaction ${transaction.id} to REFUNDED status`);

    // Notify both parties about the refund
    try {
      const { emailService } = await import('./email.service.js');

      // Notify customer
      await emailService.sendRefundConfirmationEmail(transaction.user.email, {
        userName: transaction.user.name,
        transactionId: transaction.id,
        amount: charge.amount_refunded,
      });

      // Notify provider
      if (transaction.provider?.email) {
        await emailService.sendRefundNotificationToProviderEmail(transaction.provider.email, {
          providerName: transaction.provider.name,
          transactionId: transaction.id,
          amount: charge.amount_refunded,
        });
      }
    } catch (emailError) {
      logger.error('Failed to send refund notification emails', emailError);
    }

    // FIX #19: Update provider's earnings (subtract refunded amount) with bounds checking
    if (transaction.providerId) {
      // First get current stats to prevent going negative
      const currentStats = await prisma.userStats.findUnique({
        where: { userId: transaction.providerId },
        select: { totalEarned: true },
      });

      if (currentStats) {
        const currentEarned = Number(currentStats.totalEarned) || 0;
        const refundAmount = charge.amount_refunded || 0;
        // FIX #19: Ensure we don't go below 0
        const newEarned = Math.max(0, currentEarned - refundAmount);

        await prisma.userStats.update({
          where: { userId: transaction.providerId },
          data: {
            totalEarned: newEarned,
          },
        });
      }
    }
  }

  private async handleDisputeCreated(event: WebhookEvent): Promise<void> {
    const stripeDispute = event.data.object as {
      id: string;
      charge: string;
      amount: number;
      reason: string;
      status: string;
      evidence_details?: { due_by?: number };
    };

    logger.error(`Dispute created: ${stripeDispute.id} for charge: ${stripeDispute.charge}, reason: ${stripeDispute.reason}`);

    // Find the transaction via the charge's payment intent
    // First, we need to get the payment intent from the charge
    let transaction;
    try {
      const stripe = this.getStripe();
      const charge = await stripe.charges.retrieve(stripeDispute.charge);

      if (charge.payment_intent) {
        transaction = await prisma.transaction.findFirst({
          where: { stripePaymentIntentId: charge.payment_intent as string },
          include: {
            user: { select: { id: true, email: true, name: true } },
            provider: { select: { id: true, email: true, name: true } },
          },
        });
      }
    } catch (err) {
      logger.error('Failed to retrieve charge for dispute', err);
    }

    if (!transaction) {
      logger.warn(`Could not find transaction for disputed charge: ${stripeDispute.charge}`);
      // Still create a record for admin review
    }

    // Create a dispute record in our system
    if (transaction && transaction.providerId) {
      // FIX: Idempotency check - prevent duplicate disputes for the same Stripe dispute
      const existingDispute = await prisma.dispute.findFirst({
        where: {
          transactionId: transaction.id,
          description: { contains: stripeDispute.id },
        },
      });

      if (existingDispute) {
        logger.info(`Dispute already exists for Stripe dispute ${stripeDispute.id}, skipping duplicate`);
        return;
      }

      const dispute = await prisma.dispute.create({
        data: {
          transactionId: transaction.id,
          initiatorId: transaction.userId, // Customer initiated (via their bank)
          respondentId: transaction.providerId,
          reason: `Stripe Dispute: ${stripeDispute.reason}`,
          description: `A payment dispute has been filed through Stripe. Dispute ID: ${stripeDispute.id}. Reason: ${stripeDispute.reason}. Amount: £${(stripeDispute.amount / 100).toFixed(2)}`,
          status: 'OPEN',
        },
      });

      logger.info(`Created dispute record ${dispute.id} for Stripe dispute ${stripeDispute.id}`);
    }

    // Notify admins about the dispute
    try {
      const { emailService } = await import('./email.service.js');

      // Get admin emails
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { email: true, name: true },
      });

      for (const admin of admins) {
        await emailService.sendDisputeAlertEmail(admin.email, {
          adminName: admin.name,
          disputeId: stripeDispute.id,
          chargeId: stripeDispute.charge,
          amount: stripeDispute.amount,
          reason: stripeDispute.reason,
          transactionId: transaction?.id,
          customerEmail: transaction?.user.email,
          providerEmail: transaction?.provider?.email,
          evidenceDueBy: stripeDispute.evidence_details?.due_by
            ? new Date(stripeDispute.evidence_details.due_by * 1000)
            : undefined,
        });
      }
    } catch (emailError) {
      logger.error('Failed to send dispute alert emails to admins', emailError);
    }

    // Log in audit trail
    await prisma.auditLog.create({
      data: {
        action: 'STRIPE_DISPUTE_CREATED',
        userId: 'system',
        resourceType: 'Dispute',
        resourceId: stripeDispute.id,
        metadata: {
          chargeId: stripeDispute.charge,
          amount: stripeDispute.amount,
          reason: stripeDispute.reason,
          transactionId: transaction?.id,
        },
      },
    });
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
