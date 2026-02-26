// MUST be first import to suppress third-party library warnings
import './config/suppress-warnings.js';

import http from 'http';
import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma, closeDatabase } from './config/database.js';
import { redis, closeRedis } from './config/redis.js';
import { schedulerService } from './services/scheduler.service.js';
import { smartNotificationsService } from './services/smartNotifications.service.js';
import { startWorkers, closeWorkers } from './workers/index.js';
import { initializeQueueEvents, closeQueues } from './config/queue.js';
import { initializeWebSocket, closeWebSocket } from './services/websocket.service.js';
import { startMetricsCollection, stopMetricsCollection } from './services/metrics.service.js';

// Export for testing
export const PORT = parseInt(env.PORT, 10);

// Server timeout configuration (in milliseconds)
export const REQUEST_TIMEOUT = 30000; // 30 seconds for request processing
export const KEEP_ALIVE_TIMEOUT = 65000; // 65 seconds (should be > load balancer timeout)
export const HEADERS_TIMEOUT = 66000; // Slightly higher than keep-alive
export const SHUTDOWN_TIMEOUT = 30000; // 30 seconds max for graceful shutdown

// Store server reference for graceful shutdown
export let server: http.Server | null = null;
export let isShuttingDown = false;

// Track active connections for graceful shutdown
export const activeConnections = new Set<import('net').Socket>();

// Retry configuration
export const MAX_RETRIES = 5;
export const RETRY_DELAY_MS = 2000;

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Verify database connection with retry logic for transient failures
 */
export async function verifyDatabaseConnection(retries = MAX_RETRIES): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await prisma.$connect();
      logger.info('✅ Database connected successfully');
      return;
    } catch (error) {
      logger.error(`❌ Failed to connect to database (attempt ${attempt}/${retries}):`, error);
      
      if (attempt < retries) {
        const delay = RETRY_DELAY_MS * attempt; // Exponential backoff
        logger.info(`⏳ Retrying database connection in ${delay}ms...`);
        await sleep(delay);
      } else {
        logger.error('❌ All database connection attempts failed');
        process.exit(1);
      }
    }
  }
}

/**
 * Verify Redis connection with retry logic for transient failures
 */
export async function verifyRedisConnection(retries = MAX_RETRIES): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await redis.ping();
      logger.info('✅ Redis connected successfully');
      return;
    } catch (error) {
      logger.error(`❌ Failed to connect to Redis (attempt ${attempt}/${retries}):`, error);
      
      if (attempt < retries) {
        const delay = RETRY_DELAY_MS * attempt; // Exponential backoff
        logger.info(`⏳ Retrying Redis connection in ${delay}ms...`);
        await sleep(delay);
      } else {
        logger.error('❌ All Redis connection attempts failed');
        process.exit(1);
      }
    }
  }
}

// Start server
export async function startServer() {
  try {
    // Verify connections
    await verifyDatabaseConnection();
    await verifyRedisConnection();

    // Initialize queue event listeners
    initializeQueueEvents();

    // Start background workers
    startWorkers();

    // Start scheduled tasks
    schedulerService.start();

    // Start smart notifications (rental reminders, review prompts, etc.)
    smartNotificationsService.start();

    // Start metrics collection
    startMetricsCollection();

    // Create HTTP server with timeouts
    server = http.createServer(app);
    
    // Configure server timeouts
    server.timeout = REQUEST_TIMEOUT; // Max time for request processing
    server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT; // Keep-alive timeout (> LB timeout)
    server.headersTimeout = HEADERS_TIMEOUT; // Headers timeout (> keep-alive)

    // Initialize WebSocket server
    initializeWebSocket(server);
    
    // Handle server-level errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} is already in use`);
      } else {
        logger.error('❌ Server error:', error);
      }
      process.exit(1);
    });

    // Handle client errors (malformed requests, timeouts)
    server.on('clientError', (err, socket) => {
      if (err.message.includes('ECONNRESET') || !socket.writable) {
        return;
      }
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });

    // Track connections for graceful shutdown
    server.on('connection', (socket) => {
      activeConnections.add(socket);
      socket.on('close', () => {
        activeConnections.delete(socket);
      });
    });

    // Start listening
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📝 Environment: ${env.NODE_ENV}`);
      logger.info(`🔗 API: http://localhost:${PORT}/api/v1`);
      logger.info(`💚 Health: http://localhost:${PORT}/health`);
      logger.info(`⏱️  Timeouts: request=${REQUEST_TIMEOUT}ms, keepAlive=${KEEP_ALIVE_TIMEOUT}ms`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown with connection draining
export async function gracefulShutdown(signal: string) {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    logger.info('Shutdown already in progress...');
    return;
  }
  isShuttingDown = true;

  logger.info(`\n${signal} received. Starting graceful shutdown...`);
  logger.info(`📊 Active connections: ${activeConnections.size}`);

  // Set a hard timeout for shutdown
  const shutdownTimer = setTimeout(() => {
    logger.error(`❌ Shutdown timeout (${SHUTDOWN_TIMEOUT}ms) exceeded. Forcing exit.`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {
    // Stop accepting new connections
    if (server) {
      // Close server to stop accepting new connections
      server.close();
      logger.info('🛑 Server stopped accepting new connections');

      // Wait for existing connections to drain
      if (activeConnections.size > 0) {
        logger.info(`⏳ Waiting for ${activeConnections.size} connections to drain...`);
        
        // Give connections time to complete (max 10 seconds for draining)
        const drainTimeout = 10000;
        const drainStart = Date.now();
        
        await new Promise<void>((resolve) => {
          const checkConnections = setInterval(() => {
            if (activeConnections.size === 0) {
              clearInterval(checkConnections);
              logger.info('✅ All connections drained');
              resolve();
            } else if (Date.now() - drainStart > drainTimeout) {
              // Force close remaining connections after timeout
              logger.warn(`⚠️ Forcing close of ${activeConnections.size} remaining connections`);
              for (const socket of activeConnections) {
                socket.destroy();
              }
              activeConnections.clear();
              clearInterval(checkConnections);
              resolve();
            }
          }, 100);
        });
      }

      logger.info('✅ HTTP server closed');
    }

    // Stop scheduled tasks
    schedulerService.stop();
    logger.info('✅ Scheduled tasks stopped');

    // Stop smart notifications
    smartNotificationsService.stop();
    logger.info('✅ Smart notifications stopped');

    // Stop metrics collection
    stopMetricsCollection();
    logger.info('✅ Metrics collection stopped');

    // Close WebSocket server
    await closeWebSocket();
    logger.info('✅ WebSocket server closed');

    // Close queue workers
    await closeWorkers();
    logger.info('✅ Queue workers closed');

    // Close queue connections
    await closeQueues();
    logger.info('✅ Queue connections closed');

    // Close database connection
    await closeDatabase();
    logger.info('✅ Database disconnected');

    // Close Redis connection
    await closeRedis();
    logger.info('✅ Redis disconnected');

    clearTimeout(shutdownTimer);
    logger.info('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    clearTimeout(shutdownTimer);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
startServer().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
