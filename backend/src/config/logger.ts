import winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';
import env from './env.js';
import { mkdirSync, existsSync } from 'fs';

const logLevel = env.LOG_LEVEL || 'info';

// Ensure logs directory exists in production
if (env.NODE_ENV === 'production') {
  const logsDir = 'logs';
  if (!existsSync(logsDir)) {
    try {
      mkdirSync(logsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }
  }
}

// AsyncLocalStorage for request context (correlation ID)
interface RequestContext {
  requestId: string;
  userId?: string;
}
export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Get current correlation ID from async context
 */
export function getCorrelationId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

/**
 * Get current user ID from async context
 */
export function getContextUserId(): string | undefined {
  return requestContext.getStore()?.userId;
}

// Custom format to add correlation ID to all logs
const correlationFormat = winston.format((info) => {
  const store = requestContext.getStore();
  if (store?.requestId) {
    info.correlationId = store.requestId;
  }
  if (store?.userId) {
    info.userId = store.userId;
  }
  return info;
});

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    correlationFormat(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'spannerwork-api' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp, level, message, correlationId, userId, ...meta }) => {
            const prefix = correlationId ? `[${correlationId}]` : '';
            const userPrefix = userId ? `[user:${userId}]` : '';
            const metaStr = Object.keys(meta).filter(k => k !== 'service').length 
              ? JSON.stringify(meta, null, 2) 
              : '';
            return `${timestamp} ${prefix}${userPrefix} [${level}]: ${message} ${metaStr}`.trim();
          }
        )
      ),
    }),
  ],
});

// In production, write logs to files
if (env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
    })
  );
}

export default logger;
