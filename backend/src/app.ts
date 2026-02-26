import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import * as Sentry from '@sentry/node';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import openApiSpec from './config/openapi.js';
import { setupSwagger } from './config/swagger.js';
// CSRF protection is applied per-route, not globally
// See individual route files for verifyCsrfToken usage
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { requestMetricsMiddleware } from './services/metrics.service.js';
import { requestIdMiddleware } from './middleware/requestId.middleware.js';
import { requestTimeout } from './middleware/timeout.middleware.js';
import { apiVersionHeaders, validateApiVersion } from './middleware/apiVersion.middleware.js';
import { apiLimiter } from './middleware/rateLimit.middleware.js';
import webhookRoutes from './routes/webhook.routes.js';
import { emailService } from './services/email.service.js';
import { PrismaClient } from '@prisma/client';

// Initialize Sentry (if configured)
if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
  });
}

// Create Express app
export const app: Application = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Trust proxy for proper client IP detection behind reverse proxy/load balancer
// Required for rate limiting, logging, and HTTPS detection
app.set('trust proxy', 1);

// HTTPS redirect in production
// Users accessing via HTTP will be redirected to HTTPS
if (env.NODE_ENV === 'production') {
  app.use((req: Request, res: Response, next) => {
    // Check X-Forwarded-Proto header (set by reverse proxy/load balancer)
    if (req.headers['x-forwarded-proto'] !== 'https') {
      // 301 permanent redirect to HTTPS
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    return next();
  });
}

// Security headers
// Note on CSP styleSrc 'unsafe-inline':
// Required for Tailwind CSS and React UI libraries that inject inline styles.
// To remove this, the frontend would need to use CSS-in-JS with nonces or style hashing.
// This is a known trade-off documented in SECURITY_INCIDENT_RESPONSE.md
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Required for Tailwind CSS
        scriptSrc: ["'self'"],
        imgSrc: [
          "'self'",
          'data:',
          env.CDN_URL || '',
          'https://*.s3.amazonaws.com',
          'https://*.r2.cloudflarestorage.com',
        ].filter(Boolean),
        frameAncestors: ["'self'"], // Prevent clickjacking
        formAction: ["'self'"], // Restrict form submissions
        baseUri: ["'self'"], // Restrict base tag
        objectSrc: ["'none'"], // Block plugins (Flash, etc.)
      },
    },
    // HSTS - enforce HTTPS in production
    // max-age: 1 year, includeSubDomains, preload-ready
    hsts: env.NODE_ENV === 'production' 
      ? {
          maxAge: 31536000, // 1 year in seconds
          includeSubDomains: true,
          preload: true,
        }
      : false,
  })
);

// CORS
const getAllowedOrigins = (): string[] => {
  const origins = [env.FRONTEND_URL];
  if (env.CORS_ALLOWED_ORIGINS) {
    const additionalOrigins = env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim());
    origins.push(...additionalOrigins);
  }
  return origins;
};

const isAllowedDevOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return true;
    }
    const allowedOrigins = getAllowedOrigins();
    return allowedOrigins.includes(origin);
  } catch {
    return false;
  }
};

const corsOptions =
  env.NODE_ENV === 'development'
    ? {
        // Echo back the requesting origin in development so Vite can use any port
        origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          if (!origin) {
            callback(null, true);
            return;
          }
          callback(null, isAllowedDevOrigin(origin));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id'],
      }
    : {
        origin: getAllowedOrigins(),
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id'],
      };

app.use(cors(corsOptions));

app.use('/api/webhooks', webhookRoutes);

// Custom middleware to fix Apache-escaped characters in JSON bodies
// Apache mod_proxy escapes special characters like ! into \! which breaks JSON parsing
app.use(express.raw({ type: 'application/json', limit: '100kb' }), (req, _res, next) => {
  if (req.body && Buffer.isBuffer(req.body)) {
    try {
      let bodyStr = req.body.toString('utf8');
      // Try parsing first to see if it's already valid JSON
      try {
        req.body = JSON.parse(bodyStr);
        return next();
      } catch {
        // If parsing fails, try unescaping Apache-escaped characters
        // Apache escapes special chars like \! \@ \# etc.
        bodyStr = bodyStr.replace(/\\([!@#$%^&*()_+=[\]{};':",.<>?/|`~-])/g, '$1');
        req.body = JSON.parse(bodyStr);
        return next();
      }
    } catch (error) {
      // If still can't parse, let the default error handling take over
      logger.warn('Failed to parse request body', { error });
    }
  }
  next();
});

// Body parsers for other content types
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Cookie parser
app.use(cookieParser());

// Request ID for distributed tracing
app.use(requestIdMiddleware());

app.use('/api', apiLimiter);

// Request timeout (30 seconds default, extended for upload routes)
app.use(requestTimeout);

// CSRF protection is handled per-route, not globally
// This allows fine-grained control over which endpoints need CSRF
// See individual route files for CSRF middleware usage

// Compression
app.use(compression());

// Request metrics tracking
app.use(requestMetricsMiddleware());

// API versioning headers and validation
// Adds X-API-Version, X-API-Supported-Versions headers to all API responses
app.use(apiVersionHeaders);

// API version validation
app.use(validateApiVersion);

// HTTP request logging
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    })
  );
}

// ============================================================================
// ROUTES
// ============================================================================

// Health check with dependency status and system metrics
app.get('/health', async (_req: Request, res: Response) => {
  // Measure event loop lag
  const eventLoopStart = Date.now();
  await new Promise(resolve => setImmediate(resolve));
  const eventLoopLag = Date.now() - eventLoopStart;

  // Get memory usage
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = {
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    rss: Math.round(memoryUsage.rss / 1024 / 1024),
    external: Math.round(memoryUsage.external / 1024 / 1024),
  };

  const health: {
    status: 'ok' | 'degraded' | 'error';
    timestamp: string;
    uptime: number;
    system: {
      memoryMB: typeof memoryUsageMB;
      eventLoopLagMs: number;
      cpuUsage: NodeJS.CpuUsage;
    };
    dependencies: {
      database: 'ok' | 'error';
      redis: 'ok' | 'error';
      workers: 'ok' | 'error' | 'unknown';
      storage: 'ok' | 'error' | 'unconfigured';
    };
    workers?: { name: string; running: boolean; paused: boolean }[];
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    system: {
      memoryMB: memoryUsageMB,
      eventLoopLagMs: eventLoopLag,
      cpuUsage: process.cpuUsage(),
    },
    dependencies: {
      database: 'ok',
      redis: 'ok',
      workers: 'unknown',
      storage: 'unconfigured',
    },
  };

  // Check for high memory usage (>90% of heap)
  if (memoryUsageMB.heapUsed / memoryUsageMB.heapTotal > 0.9) {
    health.status = 'degraded';
  }

  // Check for high event loop lag (>100ms indicates problems)
  if (eventLoopLag > 100) {
    health.status = 'degraded';
  }

  // Check database connection
  try {
    const { prisma } = await import('./config/database.js');
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    health.dependencies.database = 'error';
    health.status = 'degraded';
  }

  // Check Redis connection
  try {
    const { isRedisAvailable } = await import('./config/redis.js');
    if (!isRedisAvailable()) {
      health.dependencies.redis = 'error';
      health.status = 'degraded';
    }
  } catch {
    health.dependencies.redis = 'error';
    health.status = 'degraded';
  }

  // Check worker status
  try {
    const { getWorkersHealth } = await import('./workers/index.js');
    const workersHealth = await getWorkersHealth();
    health.dependencies.workers = workersHealth.healthy ? 'ok' : 'error';
    health.workers = workersHealth.workers;
    
    if (!workersHealth.healthy) {
      health.status = 'degraded';
    }
  } catch {
    health.dependencies.workers = 'unknown';
    // Don't degrade status if workers can't be checked
  }

  // Check S3/storage connectivity using singleton client
  try {
    const { checkS3Health } = await import('./config/s3.js');
    health.dependencies.storage = await checkS3Health();
  } catch {
    health.dependencies.storage = 'error';
    // S3 issues shouldn't degrade the API, but we log them
  }

  const statusCode = health.status === 'error' ? 503 : 200;
  res.status(statusCode).json(health);
});

// API routes
app.get('/api/v1', (_req: Request, res: Response) => {
  res.json({
    name: 'SpannerWork API',
    version: '1.0.0',
    description: 'Backend API for SpannerWork marketplace',
  });
});

// Rate limit alert endpoint - notifies admins when users hit rate limits
// This endpoint is intentionally unauthenticated to allow rate-limited users to trigger alerts
// Includes rate limiting itself to prevent abuse
const rateLimitPrisma = new PrismaClient();

// Track recent alerts to prevent spam (in-memory, resets on restart)
const recentAlerts = new Map<string, number>();
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between alerts from same IP

// Periodic cleanup of expired entries (runs every 5 minutes)
const cleanupRecentAlerts = () => {
  const threshold = Date.now() - ALERT_COOLDOWN_MS;
  for (const [key, time] of recentAlerts.entries()) {
    if (time < threshold) recentAlerts.delete(key);
  }
};
const alertCleanupInterval = setInterval(cleanupRecentAlerts, ALERT_COOLDOWN_MS);
// Prevent interval from keeping the process alive during shutdown
alertCleanupInterval.unref();

// Rate limit alert endpoint - notifies admins when users hit rate limits
// Note: This is intentionally a public endpoint (not behind admin auth) as it's
// called by the client-side RateLimited page to alert admins about rate limit events
app.post('/api/v1/notifications/rate-limit-alert', async (req: Request, res: Response): Promise<void> => {
  try {
    const ip = req.ip || 'unknown';
    const lastAlert = recentAlerts.get(ip);
    const now = Date.now();

    // Rate limit the alerts themselves
    if (lastAlert && now - lastAlert < ALERT_COOLDOWN_MS) {
      res.status(200).json({ success: true, message: 'Alert already sent recently' });
      return;
    }

    recentAlerts.set(ip, now);

    // Clean up old entries if map gets too large (safety valve)
    // Regular cleanup happens via alertCleanupInterval
    if (recentAlerts.size > 10000) {
      cleanupRecentAlerts();
    }

    const { timestamp, returnPath, userAgent } = req.body;

    // Try to get the user if they're logged in (from session)
    // Note: This is best-effort for logging purposes only. We don't expose
    // any session information in the response to prevent enumeration attacks.
    let userId: string | undefined;
    let userEmail: string | undefined;
    try {
      const sessionCookie = req.cookies?.['connect.sid'];
      if (sessionCookie && typeof sessionCookie === 'string') {
        // Extract session ID: format is s:SESSION_ID.SIGNATURE
        // Only proceed if format looks valid (UUID-like after 's:')
        const match = sessionCookie.match(/^s:([a-f0-9-]{36})\./);
        if (match && match[1]) {
          const sessionId = match[1];
          // Use exact match to prevent enumeration attacks
          const session = await rateLimitPrisma.session.findUnique({
            where: { id: sessionId },
            select: { userId: true, user: { select: { email: true } } },
          });
          if (session) {
            userId = session.userId || undefined;
            userEmail = session.user?.email || undefined;
          }
        }
      }
    } catch {
      // Ignore session lookup errors - this is best-effort for logging only
    }

    // Find admin users to notify
    const admins = await rateLimitPrisma.user.findMany({
      where: { role: 'ADMIN', email: { not: undefined } },
      select: { email: true },
    });

    // Send email to each admin (fire-and-forget)
    for (const admin of admins) {
      if (admin.email) {
        emailService.sendRateLimitAlertEmail(admin.email, {
          timestamp: timestamp || new Date().toISOString(),
          returnPath: returnPath || '/',
          userAgent,
          ip,
          userId,
          userEmail,
        }).catch(() => {
          // Ignore email sending errors - this is best-effort
        });
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error processing rate limit alert:', error);
    // Return success anyway - we don't want to expose internal errors
    res.status(200).json({ success: true });
  }
});

// OpenAPI/Swagger documentation
// Interactive UI available at /api/v1/docs (non-production only)
// Raw JSON spec available at /api/v1/docs.json
setupSwagger(app);

// Alternative OpenAPI spec endpoint (some tools prefer /openapi.json)
app.get('/api/v1/openapi.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

// Serve uploaded files with security controls
// - Block access to .trash directory (soft-deleted files)
// - Block access to /invoices directory (requires authentication via API)
// - Block directory listing
// - Add security headers
app.use('/uploads', (req: Request, res: Response, next) => {
  // Block access to trash directory
  if (req.path.includes('.trash') || req.path.includes('..')) {
    return res.status(404).json({ error: 'Not Found', message: 'File not found' });
  }

  // SECURITY: Block direct access to invoices - must use authenticated API endpoint
  // Invoice PDFs contain sensitive financial information and should only be
  // accessed via /api/v1/invoices/:id/download which verifies ownership
  if (req.path.startsWith('/invoices')) {
    logger.warn('Blocked direct access attempt to invoice file', {
      path: req.path,
      ip: req.ip,
    });
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invoice PDFs must be accessed via the authenticated API endpoint',
    });
  }

  // Validate file extension - only allow expected types
  const ext = path.extname(req.path).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'];
  if (ext && !allowedExtensions.includes(ext)) {
    return res.status(404).json({ error: 'Not Found', message: 'File not found' });
  }

  return next();
}, express.static('uploads', {
  dotfiles: 'deny', // Block dotfiles (.trash, etc.)
  index: false, // Disable directory listing
  setHeaders: (res) => {
    // Add security headers for served files
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day cache
  },
}));

// Import and use route modules
import authRoutes from './routes/auth.routes.js';
import oauthRoutes from './routes/oauth.routes.js';
import requestRoutes from './routes/request.routes.js';
import toolRoutes from './routes/tool.routes.js';
import userRoutes from './routes/user.routes.js';
import spaceRoutes from './routes/space.routes.js';
import serviceRoutes from './routes/service.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import messageRoutes from './routes/message.routes.js';
import reviewRoutes from './routes/review.routes.js';
import disputeRoutes from './routes/dispute.routes.js';
import adminRoutes from './routes/admin.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import contactRoutes from './routes/contact.routes.js';
import statsRoutes from './routes/stats.routes.js';
import referralRoutes from './routes/referral.routes.js';
import savedSearchRoutes from './routes/savedSearch.routes.js';
import csrfRoutes from './routes/csrf.routes.js';
import geocodingRoutes from './routes/geocoding.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import aiRoutes from './routes/ai.routes.js';
import activityRoutes from './routes/activity.routes.js';
import gamificationRoutes from './routes/gamification.routes.js';
import quickAcceptRoutes from './routes/quickAccept.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import insuranceRoutes from './routes/insurance.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import blogRoutes from './routes/blog.routes.js';
import bookmarkRoutes from './routes/bookmark.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import tradeAccountRoutes from './routes/tradeAccount.routes.js';
import addressRoutes from './routes/address.routes.js';

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth/oauth', oauthRoutes);
app.use('/api/v1/requests', requestRoutes);
app.use('/api/v1/tools', toolRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/spaces', spaceRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/disputes', disputeRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/contact', contactRoutes);
app.use('/api/v1/stats', statsRoutes);
app.use('/api/v1/referrals', referralRoutes);
app.use('/api/v1/saved-searches', savedSearchRoutes);
app.use('/api/v1/csrf-token', csrfRoutes);
app.use('/api/v1/geocoding', geocodingRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/activity', activityRoutes);
app.use('/api/v1/gamification', gamificationRoutes);
app.use('/api/v1/quick-accept', quickAcceptRoutes);
app.use('/api/v1/admin/analytics', analyticsRoutes);
app.use('/api/v1/insurance', insuranceRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/blog', blogRoutes);
app.use('/api/v1/bookmarks', bookmarkRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/trade-account', tradeAccountRoutes);
app.use('/api/v1/address', addressRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler - uses centralized handler from error.middleware.ts
app.use(notFoundHandler);

// Global error handler - uses centralized handler from error.middleware.ts
// This handler:
// - Handles CSRF token errors
// - Formats Zod validation errors
// - Reports non-operational errors to Sentry
// - Hides error details in production
app.use(errorHandler);

export default app;
