import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';
import { env } from './env.js';
import { createHash } from 'crypto';

/**
 * Database Connection Pooling Configuration
 * ==========================================
 * 
 * Prisma uses a connection pool to manage database connections efficiently.
 * The pool is automatically managed by the Prisma Query Engine.
 * 
 * ## Environment Variables
 * 
 * - `DB_POOL_SIZE`: Maximum number of connections in the pool (default: 10)
 *   - Set this based on your database's max connections and number of app instances
 *   - Formula: (max_db_connections - reserved) / number_of_instances
 *   - Example: For a DB with 100 max connections and 5 instances: 100/5 = 20 per instance
 * 
 * - `DB_POOL_TIMEOUT`: Max time to wait for an available connection in ms (default: 20000)
 *   - If no connection is available within this time, the query fails
 *   - Increase this if you see "Timed out fetching a new connection" errors
 * 
 * - `DB_CONNECT_TIMEOUT`: Timeout for establishing a new connection in ms (default: 10000)
 *   - Increase if connecting to a remote database with high latency
 * 
 * ## How Prisma Pooling Works
 * 
 * 1. Connections are created lazily (on first query, not at startup)
 * 2. Idle connections are kept alive for reuse (controlled by `idle_timeout`)
 * 3. Pool grows up to `connection_limit` as needed under load
 * 4. Connections are released back to pool after each query completes
 * 5. Pool automatically shrinks during low activity periods
 * 
 * ## Monitoring
 * 
 * In development, query logs show execution time. For production monitoring,
 * consider using Prisma Pulse or database-level connection monitoring.
 * 
 * ## Troubleshooting
 * 
 * - "Too many connections": Reduce DB_POOL_SIZE or check for connection leaks
 * - "Timed out fetching connection": Increase DB_POOL_TIMEOUT or add more pool capacity
 * - Slow queries: Check query logs, add indexes, or optimize queries
 * 
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/connection-pool
 */

// Pool configuration from environment
const DB_POOL_SIZE = parseInt(process.env.DB_POOL_SIZE || '10', 10);
const DB_POOL_TIMEOUT = parseInt(process.env.DB_POOL_TIMEOUT || '20000', 10);
const DB_CONNECT_TIMEOUT = parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10);

// Build connection URL with pool parameters
function getDatabaseUrl(): string {
  const baseUrl = env.DATABASE_URL;
  const url = new URL(baseUrl);
  
  // Add pool configuration as query parameters
  url.searchParams.set('connection_limit', DB_POOL_SIZE.toString());
  url.searchParams.set('pool_timeout', Math.floor(DB_POOL_TIMEOUT / 1000).toString());
  url.searchParams.set('connect_timeout', Math.floor(DB_CONNECT_TIMEOUT / 1000).toString());
  
  return url.toString();
}

// Log pool configuration on startup
logger.info(`Database pool configuration: size=${DB_POOL_SIZE}, poolTimeout=${DB_POOL_TIMEOUT}ms, connectTimeout=${DB_CONNECT_TIMEOUT}ms`);

// Create Prisma Client instance with optimized settings
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
  // Enable query engine metrics in development
  ...(env.NODE_ENV === 'development' && {
    errorFormat: 'pretty',
  }),
});

// Note: PII encryption middleware is available in encryption.middleware.ts
// For Prisma 5+, use query extensions or call encryptionService directly in services
// The middleware pattern has been deprecated in favor of explicit encryption calls

// Backwards-compatible alias used by some services/controllers
export const db = prisma;

function hashQuery(query: string): string {
  return createHash('sha256').update(query).digest('hex').slice(0, 12);
}

// Log database queries
// In development: detailed query logs
// In production: only slow queries (> 100ms) for performance monitoring
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug('Query: ' + hashQuery(e.query));
    logger.debug('Duration: ' + e.duration + 'ms');
  });
} else if (process.env.NODE_ENV === 'production') {
  // Production: Log slow queries for monitoring
  const SLOW_QUERY_THRESHOLD_MS = 100;
  prisma.$on('query', (e) => {
    if (e.duration > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn(`Slow query detected (${e.duration}ms):`, {
        query: hashQuery(e.query),
        duration: e.duration,
        timestamp: new Date().toISOString(),
      });
    }
  });
}

// Log database errors
prisma.$on('error', (e) => {
  logger.error('Database error:', e);
});

// Log database warnings
prisma.$on('warn', (e) => {
  logger.warn('Database warning:', e);
});

// Log database info
prisma.$on('info', (e) => {
  logger.info('Database info:', e);
});

// Graceful shutdown
export async function closeDatabase(): Promise<void> {
  await prisma.$disconnect();
}

// =============================================================================
// Database Connection Pool Monitoring
// =============================================================================

interface PoolMetrics {
  poolSize: number;
  poolTimeout: number;
  connectTimeout: number;
  slowQueries: {
    count: number;
    lastQuery?: { query: string; duration: number; timestamp: string };
  };
  errors: {
    count: number;
    lastError?: { message: string; timestamp: string };
  };
  queryStats: {
    totalQueries: number;
    avgDurationMs: number;
    maxDurationMs: number;
  };
}

// Metrics tracking
let metricsData = {
  slowQueryCount: 0,
  lastSlowQuery: null as { query: string; duration: number; timestamp: string } | null,
  errorCount: 0,
  lastError: null as { message: string; timestamp: string } | null,
  totalQueries: 0,
  totalDurationMs: 0,
  maxDurationMs: 0,
};

// Track query metrics in production
if (process.env.NODE_ENV === 'production') {
  const SLOW_QUERY_THRESHOLD_MS = 100;
  
  // Override the existing query handler to also track metrics
  prisma.$on('query', (e) => {
    metricsData.totalQueries++;
    metricsData.totalDurationMs += e.duration;
    if (e.duration > metricsData.maxDurationMs) {
      metricsData.maxDurationMs = e.duration;
    }
    
    if (e.duration > SLOW_QUERY_THRESHOLD_MS) {
      metricsData.slowQueryCount++;
      metricsData.lastSlowQuery = {
        query: hashQuery(e.query),
        duration: e.duration,
        timestamp: new Date().toISOString(),
      };
    }
  });
}

// Track errors
prisma.$on('error', (e) => {
  metricsData.errorCount++;
  metricsData.lastError = {
    message: String(e),
    timestamp: new Date().toISOString(),
  };
});

/**
 * Get current database pool metrics
 * Useful for health checks and monitoring dashboards
 */
export function getPoolMetrics(): PoolMetrics {
  const avgDuration = metricsData.totalQueries > 0 
    ? Math.round(metricsData.totalDurationMs / metricsData.totalQueries)
    : 0;

  return {
    poolSize: DB_POOL_SIZE,
    poolTimeout: DB_POOL_TIMEOUT,
    connectTimeout: DB_CONNECT_TIMEOUT,
    slowQueries: {
      count: metricsData.slowQueryCount,
      lastQuery: metricsData.lastSlowQuery || undefined,
    },
    errors: {
      count: metricsData.errorCount,
      lastError: metricsData.lastError || undefined,
    },
    queryStats: {
      totalQueries: metricsData.totalQueries,
      avgDurationMs: avgDuration,
      maxDurationMs: metricsData.maxDurationMs,
    },
  };
}

/**
 * Reset pool metrics (for testing or periodic cleanup)
 */
export function resetPoolMetrics(): void {
  metricsData = {
    slowQueryCount: 0,
    lastSlowQuery: null,
    errorCount: 0,
    lastError: null,
    totalQueries: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
  };
}

/**
 * Check database connection health
 * Returns true if database is reachable, false otherwise
 */
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      healthy: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default prisma;
