/**
 * Security Event Logging Service
 *
 * Centralized security event tracking for:
 * - Failed login attempts
 * - CSRF violations
 * - Rate limit hits
 * - Suspicious activity
 * - Authentication events
 */

import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';

export enum SecurityEventType {
  // Authentication events
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGIN_BLOCKED = 'LOGIN_BLOCKED',
  LOGOUT = 'LOGOUT',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_HIJACK_ATTEMPT = 'SESSION_HIJACK_ATTEMPT',

  // Password events
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',

  // CSRF events
  CSRF_VIOLATION = 'CSRF_VIOLATION',
  CSRF_TOKEN_EXPIRED = 'CSRF_TOKEN_EXPIRED',

  // Rate limiting events
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  RATE_LIMIT_BLOCKED = 'RATE_LIMIT_BLOCKED',

  // Authorization events
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  PRIVILEGE_ESCALATION_ATTEMPT = 'PRIVILEGE_ESCALATION_ATTEMPT',

  // Input validation events
  XSS_ATTEMPT = 'XSS_ATTEMPT',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  PATH_TRAVERSAL_ATTEMPT = 'PATH_TRAVERSAL_ATTEMPT',

  // Account events
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  ACCOUNT_REACTIVATED = 'ACCOUNT_REACTIVATED',

  // Suspicious activity
  SUSPICIOUS_USER_AGENT = 'SUSPICIOUS_USER_AGENT',
  GEOGRAPHIC_ANOMALY = 'GEOGRAPHIC_ANOMALY',
  BRUTE_FORCE_DETECTED = 'BRUTE_FORCE_DETECTED',
}

export enum SecurityEventSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

interface SecurityEventData {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  userId?: string;
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  details?: Record<string, unknown>;
}

// Alert thresholds - trigger alerts when count reaches threshold in time window
const ALERT_THRESHOLDS = {
  [SecurityEventType.LOGIN_FAILURE]: { count: 5, windowMinutes: 15 },
  [SecurityEventType.CSRF_VIOLATION]: { count: 3, windowMinutes: 5 },
  [SecurityEventType.RATE_LIMIT_EXCEEDED]: { count: 10, windowMinutes: 5 },
  [SecurityEventType.UNAUTHORIZED_ACCESS]: { count: 5, windowMinutes: 10 },
  [SecurityEventType.BRUTE_FORCE_DETECTED]: { count: 1, windowMinutes: 60 },
  [SecurityEventType.PRIVILEGE_ESCALATION_ATTEMPT]: { count: 1, windowMinutes: 60 },
};

// In-memory event counters for quick threshold checking
const eventCounters: Map<string, { count: number; firstSeen: Date }> = new Map();

class SecurityEventService {
  /**
   * Log a security event
   */
  async log(event: SecurityEventData): Promise<void> {
    const timestamp = new Date();

    // Log to Winston with structured data
    const logLevel = this.severityToLogLevel(event.severity);
    logger[logLevel](`Security Event: ${event.type}`, {
      securityEvent: true,
      eventType: event.type,
      severity: event.severity,
      userId: event.userId,
      ip: event.ip,
      userAgent: event.userAgent,
      path: event.path,
      method: event.method,
      details: event.details,
      timestamp: timestamp.toISOString(),
    });

    // Persist to database for audit trail
    try {
      await prisma.auditLog.create({
        data: {
          action: event.type,
          userId: event.userId || 'anonymous',
          resourceType: 'SecurityEvent',
          resourceId: event.type,
          ipAddress: event.ip,
          userAgent: event.userAgent,
          metadata: {
            severity: event.severity,
            path: event.path,
            method: event.method,
            ...event.details,
          },
        },
      });
    } catch (error) {
      // Don't fail the request if audit logging fails
      logger.error('Failed to persist security event to database', { error, event });
    }

    // Check if we need to trigger an alert
    await this.checkAlertThreshold(event);
  }

  /**
   * Log a failed login attempt
   */
  async logFailedLogin(ip: string, email: string, userAgent?: string, reason?: string): Promise<void> {
    await this.log({
      type: SecurityEventType.LOGIN_FAILURE,
      severity: SecurityEventSeverity.WARNING,
      ip,
      userAgent,
      details: {
        email: this.maskEmail(email),
        reason,
      },
    });
  }

  /**
   * Log a successful login
   */
  async logSuccessfulLogin(userId: string, ip: string, userAgent?: string): Promise<void> {
    await this.log({
      type: SecurityEventType.LOGIN_SUCCESS,
      severity: SecurityEventSeverity.INFO,
      userId,
      ip,
      userAgent,
    });
  }

  /**
   * Log a CSRF violation
   */
  async logCsrfViolation(ip: string, path: string, method: string, userAgent?: string): Promise<void> {
    await this.log({
      type: SecurityEventType.CSRF_VIOLATION,
      severity: SecurityEventSeverity.HIGH,
      ip,
      userAgent,
      path,
      method,
    });
  }

  /**
   * Log a rate limit exceeded event
   */
  async logRateLimitExceeded(
    limiterName: string,
    ip: string,
    path: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      severity: SecurityEventSeverity.WARNING,
      ip,
      userAgent,
      path,
      details: {
        limiter: limiterName,
      },
    });
  }

  /**
   * Log an unauthorized access attempt
   */
  async logUnauthorizedAccess(
    userId: string | undefined,
    ip: string,
    path: string,
    method: string,
    requiredRole?: string
  ): Promise<void> {
    await this.log({
      type: SecurityEventType.UNAUTHORIZED_ACCESS,
      severity: SecurityEventSeverity.HIGH,
      userId,
      ip,
      path,
      method,
      details: {
        requiredRole,
      },
    });
  }

  /**
   * Log a brute force detection
   */
  async logBruteForceDetected(ip: string, targetEmail: string, attemptCount: number): Promise<void> {
    await this.log({
      type: SecurityEventType.BRUTE_FORCE_DETECTED,
      severity: SecurityEventSeverity.CRITICAL,
      ip,
      details: {
        targetEmail: this.maskEmail(targetEmail),
        attemptCount,
      },
    });
  }

  /**
   * Log an XSS attempt detected in input
   */
  async logXssAttempt(ip: string, path: string, payload: string, userAgent?: string): Promise<void> {
    await this.log({
      type: SecurityEventType.XSS_ATTEMPT,
      severity: SecurityEventSeverity.HIGH,
      ip,
      userAgent,
      path,
      details: {
        // Truncate and sanitize the payload for logging
        payloadPreview: payload.substring(0, 100).replace(/[<>]/g, ''),
      },
    });
  }

  /**
   * Check if we've hit an alert threshold
   */
  private async checkAlertThreshold(event: SecurityEventData): Promise<void> {
    const threshold = ALERT_THRESHOLDS[event.type as keyof typeof ALERT_THRESHOLDS];
    if (!threshold) return;

    const counterKey = `${event.type}:${event.ip || 'global'}`;
    const now = new Date();
    const windowStart = new Date(now.getTime() - threshold.windowMinutes * 60 * 1000);

    let counter = eventCounters.get(counterKey);

    if (!counter || counter.firstSeen < windowStart) {
      // Reset counter if window expired
      counter = { count: 1, firstSeen: now };
    } else {
      counter.count++;
    }

    eventCounters.set(counterKey, counter);

    if (counter.count === threshold.count) {
      // Trigger alert
      await this.triggerAlert(event, counter.count, threshold.windowMinutes);
    }
  }

  /**
   * Trigger a security alert
   */
  private async triggerAlert(
    event: SecurityEventData,
    count: number,
    windowMinutes: number
  ): Promise<void> {
    logger.error('SECURITY ALERT', {
      alert: true,
      eventType: event.type,
      severity: 'ALERT',
      message: `${event.type} threshold exceeded: ${count} events in ${windowMinutes} minutes`,
      ip: event.ip,
      userId: event.userId,
      details: event.details,
    });

    // Security events are stored in database for admin review
  }

  /**
   * Mask email for logging (show first 2 chars + domain)
   */
  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***';
    const [local, domain] = email.split('@');
    const maskedLocal = local.substring(0, 2) + '***';
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Convert severity to Winston log level
   */
  private severityToLogLevel(severity: SecurityEventSeverity): 'info' | 'warn' | 'error' {
    switch (severity) {
      case SecurityEventSeverity.INFO:
        return 'info';
      case SecurityEventSeverity.WARNING:
        return 'warn';
      case SecurityEventSeverity.HIGH:
      case SecurityEventSeverity.CRITICAL:
        return 'error';
      default:
        return 'info';
    }
  }

  /**
   * Get security events for a specific IP (for admin dashboard)
   */
  async getEventsByIp(ip: string, limit = 100): Promise<unknown[]> {
    return prisma.auditLog.findMany({
      where: {
        ipAddress: ip,
        resourceType: 'SecurityEvent',
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Get security events for a specific user (for admin dashboard)
   */
  async getEventsByUser(userId: string, limit = 100): Promise<unknown[]> {
    return prisma.auditLog.findMany({
      where: {
        userId,
        resourceType: 'SecurityEvent',
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Get recent security events (for admin dashboard)
   */
  async getRecentEvents(limit = 100, severity?: SecurityEventSeverity): Promise<unknown[]> {
    return prisma.auditLog.findMany({
      where: {
        resourceType: 'SecurityEvent',
        ...(severity && {
          metadata: {
            path: ['severity'],
            equals: severity,
          },
        }),
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Clean up old in-memory counters
   */
  cleanupCounters(): void {
    const now = new Date();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [key, counter] of eventCounters.entries()) {
      if (now.getTime() - counter.firstSeen.getTime() > maxAge) {
        eventCounters.delete(key);
      }
    }
  }
}

export const securityEventService = new SecurityEventService();

// Clean up counters every hour
setInterval(() => {
  securityEventService.cleanupCounters();
}, 60 * 60 * 1000);
