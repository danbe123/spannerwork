import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Environment variable schema
const envSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().default('3000'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // Security
  SESSION_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),

  // CORS
  FRONTEND_URL: z.string().url(),

  // AWS/S3
  AWS_REGION: z.string().default('eu-west-2'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_ENDPOINT: z
    .string()
    .url()
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val)),
  S3_BUCKET_PUBLIC: z.string().default('spannerwork-public'),
  S3_BUCKET_PRIVATE: z.string().default('spannerwork-private'),
  CDN_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val)),

  // Email
  RESEND_API_KEY: z.string().optional(),
  MAILTRAP_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('noreply@spannerwork.co.uk'),
  EMAIL_FROM_NAME: z.string().default('SpannerWork'),

  // SMS (Twilio)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),

  // Web Push (VAPID)
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().startsWith('mailto:').optional(),

  // External APIs - Geocoding
  NOMINATIM_USER_AGENT: z.string().default('SpannerWork/1.0'),
  POSTCODES_IO_URL: z
    .string()
    .url()
    .default('https://api.postcodes.io'),
  // Optional: Premium geocoding for higher rate limits in production
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  MAPBOX_ACCESS_TOKEN: z.string().optional(),

  // Google Gemini AI
  GEMINI_API_KEY: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX: z.string().default('100'),
  RATE_LIMIT_AUTH_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_AUTH_MAX: z.string().default('5'),

  // Logging & Monitoring
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug'])
    .default('info'),
  SENTRY_DSN: z
    .string()
    .url()
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val)),

  // Platform
  PLATFORM_FEE_PERCENTAGE: z.string().default('5'),

  // Stripe (Payment Processing)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Security Settings
  SALT_ROUNDS: z.string().default('12'),
  SESSION_EXPIRY_DAYS: z.string().default('30'),
  PASSWORD_RESET_EXPIRY_HOURS: z.string().default('1'),
  EMAIL_VERIFICATION_EXPIRY_HOURS: z.string().default('24'),

  // Database Pool Settings
  DB_POOL_SIZE: z.string().default('10'),
  DB_POOL_TIMEOUT: z.string().default('20000'),
  DB_CONNECT_TIMEOUT: z.string().default('10000'),
});

// Validate environment variables
const envValidation = envSchema.safeParse(process.env);

if (!envValidation.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(envValidation.error.format(), null, 2));
  process.exit(1);
}

export const env = envValidation.data;

export default env;
