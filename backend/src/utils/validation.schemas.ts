import { z } from 'zod';
import { sanitizeUserContent } from './sanitize.js';

// ============================================================================
// CUSTOM VALIDATORS
// ============================================================================

/**
 * Photo URL validator - accepts both relative paths (/uploads/...) and full URLs
 * This is needed because uploads return relative paths, not full URLs
 */
const photoUrlSchema = z.string().refine(
  (val) => {
    // Accept relative upload paths
    if (val.startsWith('/uploads/')) {
      return true;
    }
    // Accept full URLs
    try {
      new URL(val);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Must be a valid URL or upload path' }
);

// ============================================================================
// AUTH SCHEMAS
// ============================================================================

/**
 * Password validation regex
 * Requires: lowercase, uppercase, digit, special character, min 8 chars
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/;
const PASSWORD_MESSAGE = 'Password needs uppercase, lowercase, number, and special character';

export const registerSchema = z.object({
  email: z
    .string({ required_error: 'Email address is required' })
    .min(1, 'Email address is required')
    .email('Please enter a valid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .regex(PASSWORD_REGEX, PASSWORD_MESSAGE),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name is too long')
    .optional(),
  referralCode: z
    .string()
    .min(6, 'Referral code must be at least 6 characters')
    .max(50, 'Referral code is too long')
    .optional(),
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const sendPhoneCodeSchema = z.object({
  phone: z
    .string()
    .min(10, 'Phone number must be at least 10 characters')
    .max(20, 'Phone number is too long')
    .regex(
      /^\+?[0-9\s\-()]+$/,
      'Phone number can only contain digits, spaces, hyphens, parentheses, and optional leading +'
    ),
});

export const verifyPhoneCodeSchema = z.object({
  phone: z
    .string()
    .min(10, 'Phone number must be at least 10 characters')
    .max(20, 'Phone number is too long')
    .regex(
      /^\+?[0-9\s\-()]+$/,
      'Phone number can only contain digits, spaces, hyphens, parentheses, and optional leading +'
    ),
  code: z.string().min(4, 'Code is required').max(10, 'Code is too long'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(PASSWORD_REGEX, PASSWORD_MESSAGE),
});

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  phone: z.string().max(20).optional(),
  defaultPayoutSpeed: z.enum(['STANDARD', 'INSTANT']).optional(),
  bio: z
    .string()
    .max(500)
    .transform((val) => sanitizeUserContent(val, 500)) // Sanitize to prevent XSS
    .optional(),
  postcode: z
    .string()
    .regex(
      /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i,
      'Invalid UK postcode'
    )
    .optional(),
  street: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  county: z.string().max(100).optional(),
  country: z.string().length(2).default('GB').optional(),
  avatar: z.string().min(1).optional(), // Can be relative path or full URL
  locationAddress: z.string().min(3).max(200).optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
});

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const createRequestSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(100),
  description: z
    .string()
    .min(20, 'Description must be at least 20 characters')
    .max(2000)
    .transform((val) => sanitizeUserContent(val, 2000)), // Sanitize to prevent XSS
  category: z.enum(['TOOLS', 'EXPERTISE', 'SPACE']),
  urgency: z.enum(['ASAP', 'TODAY', 'THIS_WEEKEND', 'FLEXIBLE']),
  budget: z.number().positive().max(10000000), // Max £100,000 in pence
  rateType: z.enum(['FIXED', 'HOURLY', 'DAILY']),
  broadcastRadius: z.number().int().min(1).max(999),
  postcode: z
    .string()
    .regex(
      /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i,
      'Invalid UK postcode'
    ),
  photos: z.array(photoUrlSchema).max(10).optional(),
  sponsorCpaPercent: z.number().int().min(0).max(50).optional()
    .refine((val) => val === undefined || val === 0 || val >= 5, {
      message: 'Sponsored listing CPA must be 0 (not sponsored) or at least 5%',
    }), // 0 = not sponsored, 5-50% = sponsored
});

// Update schema is more lenient - allows shorter descriptions when editing
export const updateRequestSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z
    .string()
    .min(10)
    .max(2000)
    .transform((val) => sanitizeUserContent(val, 2000))
    .optional(),
  category: z.enum(['TOOLS', 'EXPERTISE', 'SPACE']).optional(),
  urgency: z.enum(['ASAP', 'TODAY', 'THIS_WEEKEND', 'FLEXIBLE']).optional(),
  budget: z.number().positive().max(10000000).optional(), // Max £100,000 in pence
  rateType: z.enum(['FIXED', 'HOURLY', 'DAILY']).optional(),
  broadcastRadius: z.number().int().min(1).max(999).optional(),
  photos: z.array(photoUrlSchema).max(10).optional(),
  sponsorCpaPercent: z.number().int().min(0).max(50).optional()
    .refine((val) => val === undefined || val === 0 || val >= 5, {
      message: 'Sponsored listing CPA must be 0 (not sponsored) or at least 5%',
    }), // 0 = not sponsored, 5-50% = sponsored
});

// ============================================================================
// TOOL SCHEMAS
// ============================================================================

export const createToolSchema = z.object({
  name: z.string().min(3).max(100),
  description: z
    .string()
    .min(20)
    .max(2000)
    .transform((val) => sanitizeUserContent(val, 2000)), // Sanitize to prevent XSS
  category: z.string().min(1).max(50),
  dailyRate: z.number().int().positive().max(100000),
  weeklyRate: z.number().int().positive().max(500000).optional(),
  deposit: z.number().int().nonnegative().max(1000000),
  photos: z.array(photoUrlSchema).min(1).max(10),
  condition: z.string().min(1).max(100),
  postcode: z
    .string()
    .regex(
      /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i,
      'Invalid UK postcode'
    ),
  sponsorCpaPercent: z.number().int().min(0).max(50).optional()
    .refine((val) => val === undefined || val === 0 || val >= 5, {
      message: 'Sponsored listing CPA must be 0 (not sponsored) or at least 5%',
    }), // 0 = not sponsored, 5-50% = sponsored
});

export const updateToolSchema = createToolSchema.partial();

// ============================================================================
// SPACE SCHEMAS
// ============================================================================

export const createSpaceSchema = z.object({
  name: z.string().min(3).max(100),
  description: z
    .string()
    .min(20)
    .max(2000)
    .transform((val) => sanitizeUserContent(val, 2000)), // Sanitize to prevent XSS
  hourlyRate: z.number().int().positive().max(50000).optional(),
  dailyRate: z.number().int().positive().max(100000),
  weeklyRate: z.number().int().positive().max(500000).optional(),
  size: z.number().int().positive().optional(),
  features: z.array(z.string()).max(20),
  photos: z.array(photoUrlSchema).min(1).max(10),
  postcode: z
    .string()
    .regex(
      /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i,
      'Invalid UK postcode'
    ),
  locationAddress: z.string().min(3).max(200),
  sponsorCpaPercent: z.number().int().min(0).max(50).optional()
    .refine((val) => val === undefined || val === 0 || val >= 5, {
      message: 'Sponsored listing CPA must be 0 (not sponsored) or at least 5%',
    }), // 0 = not sponsored, 5-50% = sponsored
});

export const updateSpaceSchema = createSpaceSchema.partial();

// ============================================================================
// SERVICE SCHEMAS
// ============================================================================

export const createServiceSchema = z.object({
  name: z.string().min(3).max(100),
  description: z
    .string()
    .min(20)
    .max(2000)
    .transform((val) => sanitizeUserContent(val, 2000)), // Sanitize to prevent XSS
  specialties: z.array(z.string()).min(1).max(10),
  hourlyRate: z.number().int().positive().max(50000),
  calloutFee: z.number().int().nonnegative().max(20000).optional(),
  radius: z.number().int().min(1).max(100),
  photos: z.array(photoUrlSchema).max(10).optional(),
  requiresInsurance: z.boolean().optional(),
  postcode: z
    .string()
    .regex(
      /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i,
      'Invalid UK postcode'
    ),
  sponsorCpaPercent: z.number().int().min(0).max(50).optional()
    .refine((val) => val === undefined || val === 0 || val >= 5, {
      message: 'Sponsored listing CPA must be 0 (not sponsored) or at least 5%',
    }), // 0 = not sponsored, 5-50% = sponsored
});

export const updateServiceSchema = createServiceSchema.partial();

// ============================================================================
// TRANSACTION SCHEMAS
// ============================================================================

export const createTransactionSchema = z.object({
  requestId: z.string().cuid().optional(),
  toolId: z.string().cuid().optional(),
  spaceId: z.string().cuid().optional(),
  serviceId: z.string().cuid().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  // Required: Client must send the quoted price they saw to detect price changes
  quotedRentalFee: z.number().int().positive({
    message: 'Quoted rental fee is required to verify price has not changed',
  }),
  notes: z
    .string()
    .max(1000)
    .transform((val) => sanitizeUserContent(val, 1000))
    .optional(),
});

export const updateTransactionStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], {
    errorMap: () => ({ message: 'Invalid status. Must be one of: CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED' }),
  }),
});

export const updateTransactionAddOnsSchema = z
  .object({
    insuranceDamageProtectionSelected: z.boolean().optional(),
    insuranceLiabilitySelected: z.boolean().optional(),
    insuranceCancellationSelected: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.insuranceDamageProtectionSelected !== undefined ||
      data.insuranceLiabilitySelected !== undefined ||
      data.insuranceCancellationSelected !== undefined,
    {
      message: 'At least one add-on field is required',
    }
  );

export const subscriptionCheckoutSchema = z.object({
  plan: z.enum(['PRO', 'BUSINESS']),
});

export const subscriptionPortalSchema = z.object({
  returnUrl: z.string().url().optional(),
});

// ============================================================================
// REVIEW SCHEMAS
// ============================================================================

export const createReviewSchema = z.object({
  transactionId: z.string().cuid(),
  reviewedUserId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .max(1000)
    .transform((val) => sanitizeUserContent(val, 1000)) // Sanitize to prevent XSS
    .optional(),
});

// ============================================================================
// MESSAGE SCHEMAS
// ============================================================================

export const sendMessageSchema = z.object({
  recipientId: z.string().cuid(),
  content: z
    .string()
    .min(1)
    .max(5000)
    .transform((val) => sanitizeUserContent(val, 5000)), // Sanitize to prevent XSS
});

// ============================================================================
// DISPUTE SCHEMAS
// ============================================================================

export const createDisputeSchema = z.object({
  transactionId: z.string().cuid(),
  reason: z
    .string()
    .min(1)
    .max(100)
    .transform((val) => sanitizeUserContent(val, 100)), // Sanitize to prevent XSS
  description: z
    .string()
    .min(20)
    .max(2000)
    .transform((val) => sanitizeUserContent(val, 2000)), // Sanitize to prevent XSS
});

// ============================================================================
// PAGINATION SCHEMA
// ============================================================================

export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10)),
  limit: z
    .string()
    .optional()
    .default('20')
    .transform((val) => Math.min(parseInt(val, 10), 100)),
});

// ============================================================================
// PARAMS SCHEMAS (for route parameters)
// ============================================================================

/**
 * Validates CUID format for resource IDs
 */
export const idParamSchema = z.object({
  id: z.string().cuid('Invalid resource ID format'),
});

/**
 * Validates CUID format for user IDs
 */
export const userIdParamSchema = z.object({
  userId: z.string().cuid('Invalid user ID format'),
});

/**
 * Validates CUID format for transaction IDs
 */
export const transactionIdParamSchema = z.object({
  transactionId: z.string().cuid('Invalid transaction ID format'),
});

// ============================================================================
// SEARCH/FILTER SCHEMAS
// ============================================================================

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(100).optional(),
  category: z.string().max(50).optional(),
  minPrice: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((val) => val === undefined || val >= 0, 'Min price must be positive'),
  maxPrice: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((val) => val === undefined || val >= 0, 'Max price must be positive'),
  lat: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .refine((val) => val === undefined || (val >= -90 && val <= 90), 'Invalid latitude'),
  lng: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .refine((val) => val === undefined || (val >= -180 && val <= 180), 'Invalid longitude'),
  radius: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((val) => val === undefined || (val >= 1 && val <= 100), 'Radius must be between 1 and 100 miles'),
  sortBy: z.enum(['distance', 'price', 'rating', 'newest']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

/**
 * Query parameters for listing endpoints (tools, spaces, services, requests)
 * Validates and transforms all common list query parameters
 */
export const listQuerySchema = z.object({
  // Pagination
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val >= 1, 'Page must be at least 1'),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => val >= 1 && val <= 100, 'Limit must be between 1 and 100'),

  // Category filter - allow common categories, sanitize input
  category: z
    .string()
    .max(50)
    .regex(/^[A-Za-z_]+$/, 'Invalid category format')
    .optional(),

  // Availability filter
  available: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),

  // Location-based filtering
  postcode: z
    .string()
    .max(10)
    .regex(/^[A-Za-z0-9\s]+$/, 'Invalid postcode format')
    .optional(),
  radius: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((val) => val === undefined || (val >= 1 && val <= 100), 'Radius must be between 1 and 100 miles'),
  lat: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .refine((val) => val === undefined || (val >= -90 && val <= 90), 'Invalid latitude'),
  lng: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .refine((val) => val === undefined || (val >= -180 && val <= 180), 'Invalid longitude'),

  // Price filtering
  minPrice: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .refine((val) => val === undefined || val >= 0, 'Min price must be positive'),
  maxPrice: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .refine((val) => val === undefined || val >= 0, 'Max price must be positive'),

  // Text search (sanitized)
  search: z
    .string()
    .max(100)
    .optional()
    .transform((val) => val?.replace(/[<>'"%;()&+]/g, '')), // Strip dangerous chars
  q: z
    .string()
    .max(100)
    .optional()
    .transform((val) => val?.replace(/[<>'"%;()&+]/g, '')), // Strip dangerous chars

  // Sorting
  sortBy: z.enum(['distance', 'price', 'rating', 'newest', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),

  // Request-specific filters
  urgency: z.enum(['ASAP', 'THIS_WEEK', 'THIS_MONTH', 'FLEXIBLE']).optional(),
  status: z.string().max(20).regex(/^[A-Z_]+$/, 'Invalid status format').optional(),
});

/**
 * Query parameters for request listings with additional filters
 */
export const requestListQuerySchema = listQuerySchema.extend({
  urgency: z.enum(['ASAP', 'THIS_WEEK', 'THIS_MONTH', 'FLEXIBLE']).optional(),
});

// ============================================================================
// PAYMENT SCHEMAS
// ============================================================================

export const paymentIntentSchema = z.object({
  transactionId: z.string().cuid('Invalid transaction ID format'),
});

export const capturePaymentSchema = z.object({
  transactionId: z.string().cuid('Invalid transaction ID format'),
});

export const refundPaymentSchema = z.object({
  transactionId: z.string().cuid('Invalid transaction ID format'),
  reason: z
    .string()
    .max(500)
    .transform((val) => sanitizeUserContent(val, 500)) // Sanitize to prevent XSS
    .optional(),
});
