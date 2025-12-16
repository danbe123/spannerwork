/**
 * Configuration Index
 * 
 * Centralized exports for all configuration modules.
 */

// Environment configuration
export { env } from './env.js';

// Database
export { prisma, db } from './database.js';

// Redis
export { 
  redis, 
  isRedisAvailable, 
  safeGet, 
  safeSetex, 
  safeDel 
} from './redis.js';

// Queue system
export {
  emailQueue,
  smsQueue,
  notificationQueue,
  QUEUE_NAMES,
  queueEmail,
  queueSms,
  queueNotification,
  getQueueStats,
  initializeQueueEvents,
  closeQueues,
} from './queue.js';

// Cookie configuration
export {
  SESSION_COOKIE_OPTIONS,
  COOKIE_NAMES,
  getSessionCookieOptions,
} from './cookie.js';

// Logging
export { logger } from './logger.js';
