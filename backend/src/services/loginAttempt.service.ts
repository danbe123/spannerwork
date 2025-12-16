/**
 * Login Attempt Tracking Service
 * 
 * Tracks failed login attempts and implements account lockout
 * with exponential backoff to prevent brute force attacks.
 */

import { safeGet, safeSetex, safeDel } from '../config/redis.js';
import { logger } from '../config/logger.js';

// Configuration
const MAX_FAILED_ATTEMPTS = 5; // Lock after 5 failed attempts
const BASE_LOCKOUT_SECONDS = 60; // Start with 1 minute lockout
const MAX_LOCKOUT_SECONDS = 3600; // Max 1 hour lockout
const ATTEMPT_WINDOW_SECONDS = 900; // 15 minute window for counting attempts

interface LoginAttemptData {
  attempts: number;
  lastAttempt: number;
  lockoutUntil: number | null;
  lockoutCount: number; // Number of times account has been locked
}

export class LoginAttemptService {
  private getKey(email: string): string {
    // Normalize email and create Redis key
    return `login-attempts:${email.toLowerCase()}`;
  }

  /**
   * Get current login attempt data for an email
   */
  async getAttemptData(email: string): Promise<LoginAttemptData | null> {
    const key = this.getKey(email);
    const data = await safeGet(key);
    
    if (!data) return null;
    
    try {
      return JSON.parse(data) as LoginAttemptData;
    } catch {
      return null;
    }
  }

  /**
   * Check if an account is currently locked out
   * Returns remaining lockout time in seconds, or 0 if not locked
   */
  async isLockedOut(email: string): Promise<{ locked: boolean; remainingSeconds: number }> {
    const data = await this.getAttemptData(email);
    
    if (!data || !data.lockoutUntil) {
      return { locked: false, remainingSeconds: 0 };
    }
    
    const now = Date.now();
    if (data.lockoutUntil > now) {
      const remainingSeconds = Math.ceil((data.lockoutUntil - now) / 1000);
      return { locked: true, remainingSeconds };
    }
    
    return { locked: false, remainingSeconds: 0 };
  }

  /**
   * Record a failed login attempt
   * Returns true if account is now locked out
   */
  async recordFailedAttempt(email: string): Promise<{ locked: boolean; remainingSeconds: number }> {
    const key = this.getKey(email);
    const now = Date.now();
    
    let data = await this.getAttemptData(email);
    
    if (!data) {
      data = {
        attempts: 0,
        lastAttempt: now,
        lockoutUntil: null,
        lockoutCount: 0,
      };
    }
    
    // Reset attempts if outside the window
    if (now - data.lastAttempt > ATTEMPT_WINDOW_SECONDS * 1000) {
      data.attempts = 0;
    }
    
    data.attempts += 1;
    data.lastAttempt = now;
    
    // Check if we should lock out
    if (data.attempts >= MAX_FAILED_ATTEMPTS) {
      data.lockoutCount += 1;
      
      // Calculate lockout duration with exponential backoff
      const lockoutSeconds = Math.min(
        BASE_LOCKOUT_SECONDS * Math.pow(2, data.lockoutCount - 1),
        MAX_LOCKOUT_SECONDS
      );
      
      data.lockoutUntil = now + (lockoutSeconds * 1000);
      data.attempts = 0; // Reset attempts after lockout
      
      logger.warn(`Account locked out: ${email} for ${lockoutSeconds} seconds (lockout #${data.lockoutCount})`);
      
      // Store with TTL slightly longer than max lockout
      await safeSetex(key, MAX_LOCKOUT_SECONDS + 60, JSON.stringify(data));
      
      return { locked: true, remainingSeconds: lockoutSeconds };
    }
    
    // Store attempt data
    await safeSetex(key, ATTEMPT_WINDOW_SECONDS + 60, JSON.stringify(data));
    
    logger.debug(`Failed login attempt ${data.attempts}/${MAX_FAILED_ATTEMPTS} for ${email}`);
    
    return { locked: false, remainingSeconds: 0 };
  }

  /**
   * Record a successful login - clears failed attempts
   */
  async recordSuccessfulLogin(email: string): Promise<void> {
    const key = this.getKey(email);
    await safeDel(key);
    logger.debug(`Login attempts cleared for ${email}`);
  }

  /**
   * Manually clear lockout (for admin use)
   */
  async clearLockout(email: string): Promise<void> {
    const key = this.getKey(email);
    await safeDel(key);
    logger.info(`Lockout manually cleared for ${email}`);
  }

  /**
   * Get lockout status with details (for admin/debugging)
   */
  async getLockoutStatus(email: string): Promise<{
    attempts: number;
    isLocked: boolean;
    remainingSeconds: number;
    lockoutCount: number;
  }> {
    const data = await this.getAttemptData(email);
    const { locked, remainingSeconds } = await this.isLockedOut(email);
    
    return {
      attempts: data?.attempts || 0,
      isLocked: locked,
      remainingSeconds,
      lockoutCount: data?.lockoutCount || 0,
    };
  }
}

export const loginAttemptService = new LoginAttemptService();
