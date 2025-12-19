import apiClient from '../client';

// ============================================================================
// Types
// ============================================================================

export interface StripeConfig {
  publishableKey: string;
}

export interface ConnectAccountResponse {
  accountId: string;
  onboardingUrl: string;
  isNew: boolean;
}

export interface AccountStatus {
  hasAccount: boolean;
  status: {
    accountId: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    requirements: {
      currentlyDue: string[];
      eventuallyDue: string[];
      pastDue: string[];
    };
  } | null;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}

export interface EscrowStatus {
  inEscrow: boolean;
  status: string;
  amount?: number;
  capturedAmount?: number;
  expiresAt?: string;
  message: string;
}

export interface CaptureResponse {
  success: boolean;
  message: string;
  amountCaptured: number;
  transferId?: string;
}

export interface RefundResponse {
  refundId: string;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';
}

// ============================================================================
// Service
// ============================================================================

export const paymentsService = {
  /**
   * Get Stripe publishable key for client-side use
   */
  async getConfig(): Promise<StripeConfig> {
    const response = await apiClient.get<StripeConfig>('/payments/config');
    return response.data;
  },

  /**
   * Create or get Stripe Connect account for the current user (provider)
   */
  async createConnectAccount(): Promise<ConnectAccountResponse> {
    const response = await apiClient.post<ConnectAccountResponse>('/payments/connect/account');
    return response.data;
  },

  /**
   * Get current user's Connect account status
   */
  async getAccountStatus(): Promise<AccountStatus> {
    const response = await apiClient.get<AccountStatus>('/payments/connect/status');
    return response.data;
  },

  /**
   * Get dashboard link for provider to manage their Stripe account
   */
  async getDashboardLink(): Promise<{ dashboardUrl: string }> {
    const response = await apiClient.get<{ dashboardUrl: string }>('/payments/connect/dashboard');
    return response.data;
  },

  /**
   * Create a payment intent for a transaction
   */
  async createPaymentIntent(transactionId: string): Promise<PaymentIntentResponse> {
    const response = await apiClient.post<PaymentIntentResponse>('/payments/intent', { transactionId });
    return response.data;
  },

  /**
   * Get escrow status for a transaction
   */
  async getEscrowStatus(transactionId: string): Promise<EscrowStatus> {
    const response = await apiClient.get<EscrowStatus>(`/payments/escrow-status/${transactionId}`);
    return response.data;
  },

  /**
   * Capture an escrow payment (release funds to provider)
   */
  async capturePayment(transactionId: string): Promise<CaptureResponse> {
    const response = await apiClient.post<CaptureResponse>('/payments/capture', { transactionId });
    return response.data;
  },

  /**
   * Request a refund for a transaction
   */
  async requestRefund(transactionId: string, reason?: string): Promise<RefundResponse> {
    const response = await apiClient.post<RefundResponse>('/payments/refund', { transactionId, reason });
    return response.data;
  },
};
