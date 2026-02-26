/**
 * Centralized Business Constants
 *
 * All business-critical configuration values in one place.
 * These values affect pricing, deadlines, limits, and business rules.
 */

// ==========================================
// PLATFORM FEES
// ==========================================
export const PLATFORM_FEES = {
  /** Platform fee for FREE tier providers */
  FREE_TIER_PERCENT: 5,
  /** Platform fee for PRO tier providers */
  PRO_TIER_PERCENT: 3,
  /** Platform fee for BUSINESS tier providers */
  BUSINESS_TIER_PERCENT: 2,
} as const;

// ==========================================
// TAX RATES
// ==========================================
export const TAX_RATES = {
  /** UK VAT rate */
  VAT_RATE: 0.20,
  /** VAT rate as percentage for display */
  VAT_RATE_PERCENT: 20,
} as const;

// ==========================================
// INSTANT PAYOUT
// ==========================================
export const INSTANT_PAYOUT = {
  /** Instant payout fee percentage */
  FEE_PERCENT: 1.5,
} as const;

// ==========================================
// INSURANCE
// ==========================================
export const INSURANCE = {
  /** Damage protection fee as percentage of rental */
  DAMAGE_PROTECTION_PERCENT: 5,
  /** Cancellation protection fee as percentage of rental */
  CANCELLATION_PROTECTION_PERCENT: 3,
  /** Liability protection flat fee in pence (£3) */
  LIABILITY_PROTECTION_FEE: 300,
  /** Maximum claim amount relative to transaction value */
  MAX_CLAIM_MULTIPLIER: 3,
  /** Absolute maximum claim amount in pence (£50,000) */
  MAX_ABSOLUTE_CLAIM: 50000_00,
  /** Minimum transaction value for insurance claims in pence (£5) */
  MIN_TRANSACTION_FOR_CLAIMS: 500,
  /** Days after transaction end to file a claim */
  CLAIM_DEADLINE_DAYS: 90,
  /** Buffer days after transaction for incident reporting */
  INCIDENT_BUFFER_DAYS: 7,
} as const;

// ==========================================
// DISPUTES
// ==========================================
export const DISPUTES = {
  /** Days after transaction completion to file a dispute */
  FILING_DEADLINE_DAYS: 90,
  /** Maximum evidence files per user per dispute */
  MAX_EVIDENCE_PER_USER: 10,
  /** Maximum file size for evidence in bytes (10MB) */
  MAX_EVIDENCE_FILE_SIZE: 10 * 1024 * 1024,
  /** Maximum evidence uploads per day per user */
  DAILY_UPLOAD_LIMIT: 20,
} as const;

// ==========================================
// REVIEWS
// ==========================================
export const REVIEWS = {
  /** Days after transaction to leave a review */
  REVIEW_DEADLINE_DAYS: 30,
  /** Days after initial review to update it */
  UPDATE_WINDOW_DAYS: 7,
  /** Minimum rating for TOP_RATED badge */
  TOP_RATED_MIN_RATING: 4.8,
  /** Minimum reviews for TOP_RATED badge */
  TOP_RATED_MIN_REVIEWS: 10,
} as const;

// ==========================================
// REFERRALS
// ==========================================
export const REFERRALS = {
  /** Referral reward amount in pence (£10) */
  REWARD_AMOUNT: 1000,
  /** Days for referral to be completed */
  EXPIRY_DAYS: 30,
} as const;

// ==========================================
// ESCROW & PAYMENTS
// ==========================================
export const ESCROW = {
  /** Stripe escrow expiry in days (payment must be captured before this) */
  STRIPE_EXPIRY_DAYS: 7,
  /** Hours before expiry to auto-capture payment */
  AUTO_CAPTURE_HOURS_BEFORE: 12,
  /** Hours before expiry for first reminder */
  FIRST_REMINDER_HOURS: 48,
  /** Hours before expiry for urgent reminder */
  URGENT_REMINDER_HOURS: 24,
  /** Refund window in hours after payment */
  REFUND_WINDOW_HOURS: 48,
} as const;

// ==========================================
// BOOKING & AVAILABILITY
// ==========================================
export const BOOKING = {
  /** Grace period for day calculation in hours */
  GRACE_PERIOD_HOURS: 1,
  /** Availability hold expiry in minutes */
  HOLD_EXPIRY_MINUTES: 5,
  /** Minimum booking duration in hours */
  MIN_DURATION_HOURS: 1,
} as const;

// ==========================================
// AUTHENTICATION & SECURITY
// ==========================================
export const AUTH = {
  /** Password reset token expiry in hours */
  PASSWORD_RESET_EXPIRY_HOURS: 1,
  /** Email verification token expiry in hours */
  EMAIL_VERIFICATION_EXPIRY_HOURS: 24,
  /** Session expiry in days */
  SESSION_EXPIRY_DAYS: 7,
  /** Maximum login attempts before lockout */
  MAX_LOGIN_ATTEMPTS: 5,
  /** Lockout duration in minutes */
  LOCKOUT_DURATION_MINUTES: 15,
} as const;

// ==========================================
// TRADE ACCOUNTS
// ==========================================
export const TRADE_ACCOUNTS = {
  /** Maximum bulk discount percentage */
  MAX_BULK_DISCOUNT_PERCENT: 20,
  /** Minimum order value for bulk discount in pence (£100) */
  MIN_ORDER_FOR_DISCOUNT: 10000,
} as const;

// ==========================================
// GAMIFICATION
// ==========================================
export const GAMIFICATION = {
  /** Transactions required for POWER_USER badge */
  POWER_USER_TRANSACTIONS: 50,
  /** Transactions required for MARKETPLACE_LEGEND badge */
  LEGEND_TRANSACTIONS: 100,
  /** Days streak for STREAK_MASTER badge */
  STREAK_MASTER_DAYS: 30,
  /** Referrals for COMMUNITY_BUILDER badge */
  COMMUNITY_BUILDER_REFERRALS: 5,
  /** Years active for LOYAL_MEMBER badge */
  LOYAL_MEMBER_YEARS: 1,
} as const;

// ==========================================
// WEBHOOKS & CLEANUP
// ==========================================
export const WEBHOOKS = {
  /** Days to retain webhook events before cleanup */
  EVENT_RETENTION_DAYS: 30,
  /** Maximum events to delete per cleanup run */
  CLEANUP_BATCH_SIZE: 1000,
} as const;

// ==========================================
// REQUESTS
// ==========================================
export const REQUESTS = {
  /** Default request expiry in days */
  DEFAULT_EXPIRY_DAYS: 30,
  /** Maximum sponsored CPA percentage */
  MAX_SPONSOR_CPA_PERCENT: 50,
} as const;

// ==========================================
// TYPE EXPORTS
// ==========================================
export type PlatformFees = typeof PLATFORM_FEES;
export type TaxRates = typeof TAX_RATES;
export type InsuranceConfig = typeof INSURANCE;
export type DisputeConfig = typeof DISPUTES;
export type ReviewConfig = typeof REVIEWS;
export type EscrowConfig = typeof ESCROW;
export type BookingConfig = typeof BOOKING;
export type AuthConfig = typeof AUTH;
export type GamificationConfig = typeof GAMIFICATION;
export type WebhookConfig = typeof WEBHOOKS;
