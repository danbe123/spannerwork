import bcrypt from 'bcrypt';
import { randomBytes, randomInt, timingSafeEqual, createHash } from 'crypto';
import { prisma } from '../config/database.js';
import { safeGet, safeSetex, safeDel } from '../config/redis.js';
import { User, AccountStatus } from '@prisma/client';
import { env } from '../config/env.js';
import { loginAttemptService } from './loginAttempt.service.js';

// Security settings from environment (with defaults)
const SALT_ROUNDS = parseInt(env.SALT_ROUNDS || '12', 10);
const SESSION_EXPIRY = parseInt(env.SESSION_EXPIRY_DAYS || '30', 10) * 24 * 60 * 60; // Days to seconds
const PASSWORD_HISTORY_COUNT = 5; // Number of previous passwords to check against

export class AuthService {
  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(
    password: string,
    hash: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a random session ID
   */
  generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Create a new session for a user
   */
  async createSession(userId: string): Promise<string> {
    const sessionId = this.generateSessionId();
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + SESSION_EXPIRY);

    // Store in database
    await prisma.session.create({
      data: {
        id: sessionId,
        userId,
        expiresAt,
      },
    });

    // Store in Redis for fast lookup (graceful degradation if Redis unavailable)
    await safeSetex(`session:${sessionId}`, SESSION_EXPIRY, userId);

    return sessionId;
  }

  /**
   * Get user by session ID
   */
  async getUserBySession(sessionId: string): Promise<User | null> {
    // Try Redis first (fast) - graceful degradation if unavailable
    const userId = await safeGet(`session:${sessionId}`);

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      return user;
    }

    // Fallback to database
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    // Refresh Redis cache (graceful degradation if unavailable)
    const ttl = Math.floor(
      (session.expiresAt.getTime() - Date.now()) / 1000
    );
    if (ttl > 0) {
      await safeSetex(`session:${sessionId}`, ttl, session.userId);
    }

    return session.user;
  }

  /**
   * Delete a session (logout)
   */
  async deleteSession(sessionId: string): Promise<void> {
    // Delete from Redis (graceful degradation if unavailable)
    await safeDel(`session:${sessionId}`);

    // Delete from database
    await prisma.session.delete({
      where: { id: sessionId },
    });
  }

  /**
   * Rotate session ID (create new session, delete old one)
   * Used on login and privilege escalation for security
   */
  async rotateSession(oldSessionId: string, userId: string): Promise<string> {
    // Create new session
    const newSessionId = await this.createSession(userId);

    // Delete old session
    try {
      await this.deleteSession(oldSessionId);
    } catch {
      // If old session doesn't exist, that's okay - just log it
      // The important thing is we have a new session
    }

    return newSessionId;
  }

  /**
   * Delete all sessions for a user
   * Used on password reset for security
   */
  async deleteAllUserSessions(userId: string): Promise<void> {
    // Get all sessions from database
    const sessions = await prisma.session.findMany({
      where: { userId },
      select: { id: true },
    });

    // Delete from Redis (graceful degradation if unavailable)
    await Promise.all(
      sessions.map(session => safeDel(`session:${session.id}`))
    );

    // Delete from database
    await prisma.session.deleteMany({
      where: { userId },
    });
  }

  /**
   * Register a new user
   */
  async register(data: {
    email: string;
    password: string;
    name?: string;
  }): Promise<{ user: User; sessionId: string }> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(data.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        name: data.name,
        emailVerified: false,
      },
    });

    // Create session
    const sessionId = await this.createSession(user.id);

    return { user, sessionId };
  }

  /**
   * Login a user
   * Implements account lockout after multiple failed attempts
   * Session ID is rotated on login to prevent session fixation attacks
   */
  async login(data: {
    email: string;
    password: string;
    existingSessionId?: string; // Optional existing session to rotate
  }): Promise<{ user: User; sessionId: string }> {
    const normalizedEmail = data.email.toLowerCase();

    // Check if account is locked out due to failed attempts
    const lockoutStatus = await loginAttemptService.isLockedOut(normalizedEmail);
    if (lockoutStatus.locked) {
      const minutes = Math.ceil(lockoutStatus.remainingSeconds / 60);
      throw new Error(`Account temporarily locked. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`);
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      // Perform dummy bcrypt compare to prevent timing attacks
      // This ensures consistent response time whether user exists or not
      await bcrypt.compare(data.password, '$2b$12$K4o4k8K4o4k8K4o4k8K4oeK4o4k8K4o4k8K4o4k8K4o4k8K4o4k8');
      // Record failed attempt even for non-existent users (prevents enumeration)
      await loginAttemptService.recordFailedAttempt(normalizedEmail);
      throw new Error('Invalid email or password');
    }

    // Check if account is suspended
    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throw new Error('Account is suspended');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(
      data.password,
      user.passwordHash
    );

    if (!isValidPassword) {
      // Record failed attempt
      const result = await loginAttemptService.recordFailedAttempt(normalizedEmail);
      if (result.locked) {
        const minutes = Math.ceil(result.remainingSeconds / 60);
        throw new Error(`Too many failed attempts. Account locked for ${minutes} minute${minutes !== 1 ? 's' : ''}.`);
      }
      throw new Error('Invalid email or password');
    }

    // Clear failed attempts on successful login
    await loginAttemptService.recordSuccessfulLogin(normalizedEmail);

    // Rotate session on login to prevent session fixation attacks
    // If there was an existing session, delete it and create a new one
    let sessionId: string;
    if (data.existingSessionId) {
      sessionId = await this.rotateSession(data.existingSessionId, user.id);
    } else {
      sessionId = await this.createSession(user.id);
    }

    return { user, sessionId };
  }

  /**
   * Generate email verification token
   * Stores token in both database (primary) and Redis (cache)
   */
  async generateEmailVerificationToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const expiresAtSeconds = 24 * 60 * 60; // 24 hours in seconds for Redis

    // Invalidate any existing email verification tokens for this user
    await prisma.emailVerificationToken.updateMany({
      where: {
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        usedAt: new Date(), // Mark as used to invalidate
      },
    });

    // Store in database (primary storage)
    await prisma.emailVerificationToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    // Also cache in Redis for faster lookups
    await safeSetex(`email-verification:${token}`, expiresAtSeconds, userId);

    return token;
  }

  /**
   * Generate phone verification code (for SMS)
   * Uses cryptographically secure random number generation
   */
  async generatePhoneVerificationCode(userId: string, phone: string): Promise<string> {
    // Use crypto.randomInt for cryptographically secure 6-digit code (100000-999999)
    const code = randomInt(100000, 1000000).toString();
    const expiresAt = 5 * 60; // 5 minutes (shorter for security)

    const payload = JSON.stringify({ userId, phone, code });

    await safeSetex(`phone-verification:${userId}`, expiresAt, payload);

    return code;
  }

  /**
   * Verify phone verification code and update user's phone number
   */
  async verifyPhoneCode(userId: string, phone: string, code: string): Promise<User> {
    const key = `phone-verification:${userId}`;
    const raw = await safeGet(key);

    if (!raw) {
      throw new Error('Invalid or expired verification code');
    }

    let payload: { userId: string; phone: string; code: string };
    try {
      payload = JSON.parse(raw) as { userId: string; phone: string; code: string };
    } catch {
      await safeDel(key);
      throw new Error('Invalid or expired verification code');
    }

    // Use constant-time comparison to prevent timing attacks on the verification code
    const userIdMatch = payload.userId === userId;
    const phoneMatch = payload.phone === phone;
    
    // Convert codes to buffers for timing-safe comparison
    const expectedCode = Buffer.from(payload.code, 'utf8');
    const providedCode = Buffer.from(code, 'utf8');
    const codeMatch = expectedCode.length === providedCode.length && 
      timingSafeEqual(expectedCode, providedCode);
    
    if (!userIdMatch || !phoneMatch || !codeMatch) {
      throw new Error('Invalid or expired verification code');
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { phone },
    });

    await safeDel(key);

    return user;
  }

  /**
   * Verify email with token
   * Validates against database as source of truth
   */
  async verifyEmail(token: string): Promise<User> {
    // Always validate against database as source of truth
    const dbToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!dbToken || dbToken.usedAt || dbToken.expiresAt < new Date()) {
      // Clean up Redis if token exists there but is invalid in DB
      await safeDel(`email-verification:${token}`);
      throw new Error('Invalid or expired verification token');
    }

    const userId = dbToken.userId;

    // Use transaction to ensure atomicity
    const user = await prisma.$transaction(async (tx) => {
      // Update user
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });

      // Mark token as used in database
      await tx.emailVerificationToken.update({
        where: { token },
        data: { usedAt: new Date() },
      });

      return updatedUser;
    });

    // Only delete from Redis after successful DB transaction
    await safeDel(`email-verification:${token}`);

    return user;
  }

  /**
   * Hash a token using SHA-256
   * Used for securely storing password reset and email verification tokens
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate password reset token
   * Returns null if user doesn't exist (prevents timing attacks)
   * Stores HASHED token in database for security - if DB is compromised,
   * attackers cannot use the hashes to reset passwords
   */
  async generatePasswordResetToken(email: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Generate token regardless of whether user exists to prevent timing attacks
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const expiresAtSeconds = 60 * 60; // 1 hour in seconds for Redis

    if (!user) {
      // Return null but don't throw - caller should show same message either way
      return null;
    }

    // Invalidate any existing password reset tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        usedAt: new Date(), // Mark as used to invalidate
      },
    });

    // Store HASHED token in database (if DB is compromised, hashes are useless)
    await prisma.passwordResetToken.create({
      data: {
        token: tokenHash, // Store hash, not raw token
        userId: user.id,
        expiresAt,
      },
    });

    // Cache hash->userId mapping in Redis for faster lookups
    await safeSetex(`password-reset:${tokenHash}`, expiresAtSeconds, user.id);

    // Return the raw token to send to user (only they have it)
    return token;
  }

  /**
   * Check if password was recently used
   * Returns true if password matches any of the last N passwords
   */
  async isPasswordRecentlyUsed(userId: string, newPassword: string): Promise<boolean> {
    // Get the user's recent password history
    const history = await prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: PASSWORD_HISTORY_COUNT,
      select: { passwordHash: true },
    });

    // Check if new password matches any historical password
    for (const entry of history) {
      const matches = await this.verifyPassword(newPassword, entry.passwordHash);
      if (matches) {
        return true;
      }
    }

    return false;
  }

  /**
   * Save password to history
   */
  async savePasswordToHistory(userId: string, passwordHash: string): Promise<void> {
    // Add current password to history
    await prisma.passwordHistory.create({
      data: {
        userId,
        passwordHash,
      },
    });

    // Clean up old history entries (keep only PASSWORD_HISTORY_COUNT)
    const oldEntries = await prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: PASSWORD_HISTORY_COUNT,
      select: { id: true },
    });

    if (oldEntries.length > 0) {
      await prisma.passwordHistory.deleteMany({
        where: {
          id: { in: oldEntries.map((e: { id: string }) => e.id) },
        },
      });
    }
  }

  /**
   * Reset password with token
   * Validates hashed token against database
   * Checks password history to prevent reuse
   */
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<User> {
    // Hash the provided token to look up in database
    const tokenHash = this.hashToken(token);

    // Always validate against database as source of truth
    const dbToken = await prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
    });

    if (!dbToken || dbToken.usedAt || dbToken.expiresAt < new Date()) {
      // Clean up Redis if token exists there but is invalid in DB
      await safeDel(`password-reset:${tokenHash}`);
      throw new Error('Invalid or expired reset token');
    }

    const userId = dbToken.userId;

    // Hash new password before transaction (CPU-intensive, do outside transaction)
    const newPasswordHash = await this.hashPassword(newPassword);

    // Use transaction to ensure atomicity of all operations
    // This prevents race conditions where concurrent requests could bypass password history check
    const user = await prisma.$transaction(async (tx) => {
      // Check password history INSIDE transaction to prevent race conditions
      const history = await tx.passwordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: PASSWORD_HISTORY_COUNT,
        select: { passwordHash: true },
      });

      // Check if new password matches any historical password
      for (const entry of history) {
        const matches = await this.verifyPassword(newPassword, entry.passwordHash);
        if (matches) {
          // Generic message to avoid confirming account existence
          throw new Error('Password reset failed. Please choose a different password.');
        }
      }

      // Get current password hash before update (to save to history)
      const currentUser = await tx.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });

      // Update password
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });

      // Mark token as used in database
      await tx.passwordResetToken.update({
        where: { token: tokenHash },
        data: { usedAt: new Date() },
      });

      // Save old password to history inside transaction
      if (currentUser?.passwordHash) {
        await tx.passwordHistory.create({
          data: {
            userId,
            passwordHash: currentUser.passwordHash,
          },
        });

        // Clean up old history entries (keep only PASSWORD_HISTORY_COUNT)
        const oldEntries = await tx.passwordHistory.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip: PASSWORD_HISTORY_COUNT,
          select: { id: true },
        });

        if (oldEntries.length > 0) {
          await tx.passwordHistory.deleteMany({
            where: {
              id: { in: oldEntries.map((e: { id: string }) => e.id) },
            },
          });
        }
      }

      return updatedUser;
    });

    // Only delete from Redis after successful DB transaction
    // This ensures Redis and DB are in sync
    await safeDel(`password-reset:${tokenHash}`);

    // Delete all sessions for this user (force re-login on all devices)
    await this.deleteAllUserSessions(user.id);

    return user;
  }

  /**
   * Clean up expired password reset tokens
   */
  async cleanupExpiredPasswordResetTokens(): Promise<number> {
    const result = await prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } },
        ],
      },
    });

    return result.count;
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }
}

export const authService = new AuthService();
