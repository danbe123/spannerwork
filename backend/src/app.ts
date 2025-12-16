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
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
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
const corsOptions =
  env.NODE_ENV === 'development'
    ? {
        // Echo back the requesting origin in development so Vite can use any port
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id'],
      }
    : {
        origin: env.FRONTEND_URL,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id'],
      };

app.use(cors(corsOptions));

// Body parsers - default limit is conservative (100KB)
// Upload routes get larger limits specifically configured
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Cookie parser
app.use(cookieParser());

// Request ID for distributed tracing
app.use(requestIdMiddleware());

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
app.use('/api', apiVersionHeaders);
app.use('/api', validateApiVersion);

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

  const statusCode = health.status === 'ok' ? 200 : 503;
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

// OpenAPI/Swagger documentation
// Interactive UI available at /api/v1/docs (non-production only)
// Raw JSON spec available at /api/v1/docs.json
setupSwagger(app);

// Legacy OpenAPI spec endpoint (for backwards compatibility)
app.get('/api/v1/openapi.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

// Serve uploaded files with security controls
// - Block access to .trash directory (soft-deleted files)
// - Block directory listing
// - Add security headers
app.use('/uploads', (req: Request, res: Response, next) => {
  // Block access to trash directory
  if (req.path.includes('.trash') || req.path.includes('..')) {
    return res.status(404).json({ error: 'Not Found', message: 'File not found' });
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

app.use('/api/v1/auth', authRoutes);
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
