import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcrypt';
import { createHash } from 'crypto';

// Helper to hash tokens the same way the service does
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Mock dependencies before importing the service
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    passwordResetToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    emailVerificationToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    passwordHistory: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback({
      user: { update: vi.fn() },
      passwordResetToken: { update: vi.fn() },
      emailVerificationToken: { update: vi.fn() },
      passwordHistory: { create: vi.fn(), deleteMany: vi.fn() },
    })),
  },
}));

vi.mock('../../src/config/redis.js', () => ({
  safeGet: vi.fn(),
  safeSetex: vi.fn(),
  safeDel: vi.fn(),
}));

import { AuthService } from '../../src/services/auth.service.js';
import { prisma } from '../../src/config/database.js';
import { safeGet, safeSetex, safeDel } from '../../src/config/redis.js';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'TestPassword123!';
      const hash = await authService.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are long
    });

    it('should produce different hashes for same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await authService.hashPassword(password);
      const hash2 = await authService.hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await bcrypt.hash(password, 12);
      
      const result = await authService.verifyPassword(password, hash);
      
      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'TestPassword123!';
      const hash = await bcrypt.hash(password, 12);
      
      const result = await authService.verifyPassword('WrongPassword', hash);
      
      expect(result).toBe(false);
    });
  });

  describe('generateSessionId', () => {
    it('should generate a unique session ID', () => {
      const sessionId1 = authService.generateSessionId();
      const sessionId2 = authService.generateSessionId();
      
      expect(sessionId1).toBeDefined();
      expect(sessionId1.length).toBe(64); // 32 bytes = 64 hex chars
      expect(sessionId1).not.toBe(sessionId2);
    });
  });

  describe('createSession', () => {
    it('should create a session in database and Redis', async () => {
      const userId = 'user-123';
      
      vi.mocked(prisma.session.create).mockResolvedValue({
        id: 'session-id',
        userId,
        expiresAt: new Date(),
      });
      vi.mocked(safeSetex).mockResolvedValue(true);
      
      const sessionId = await authService.createSession(userId);
      
      expect(sessionId).toBeDefined();
      expect(sessionId.length).toBe(64);
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          expiresAt: expect.any(Date),
        }),
      });
      expect(safeSetex).toHaveBeenCalled();
    });
  });

  describe('getUserBySession', () => {
    it('should return user from Redis cache', async () => {
      const userId = 'user-123';
      const user = { id: userId, email: 'test@example.com' };
      
      vi.mocked(safeGet).mockResolvedValue(userId);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
      
      const result = await authService.getUserBySession('session-123');
      
      expect(result).toEqual(user);
      expect(safeGet).toHaveBeenCalledWith('session:session-123');
    });

    it('should fallback to database when Redis misses', async () => {
      const userId = 'user-123';
      const user = { id: userId, email: 'test@example.com' };
      const session = {
        id: 'session-123',
        userId,
        expiresAt: new Date(Date.now() + 86400000),
        user,
      };
      
      vi.mocked(safeGet).mockResolvedValue(null);
      vi.mocked(prisma.session.findUnique).mockResolvedValue(session as any);
      vi.mocked(safeSetex).mockResolvedValue(true);
      
      const result = await authService.getUserBySession('session-123');
      
      expect(result).toEqual(user);
      expect(prisma.session.findUnique).toHaveBeenCalled();
      expect(safeSetex).toHaveBeenCalled(); // Should refresh cache
    });

    it('should return null for expired session', async () => {
      const session = {
        id: 'session-123',
        userId: 'user-123',
        expiresAt: new Date(Date.now() - 86400000), // Expired
        user: { id: 'user-123' },
      };
      
      vi.mocked(safeGet).mockResolvedValue(null);
      vi.mocked(prisma.session.findUnique).mockResolvedValue(session as any);
      
      const result = await authService.getUserBySession('session-123');
      
      expect(result).toBeNull();
    });
  });

  describe('register', () => {
    it('should create a new user and session', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      };
      const createdUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: false,
      };
      
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(createdUser as any);
      vi.mocked(prisma.session.create).mockResolvedValue({
        id: 'session-123',
        userId: 'user-123',
        expiresAt: new Date(),
      });
      vi.mocked(safeSetex).mockResolvedValue(true);
      
      const result = await authService.register(userData);
      
      expect(result.user).toEqual(createdUser);
      expect(result.sessionId).toBeDefined();
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@example.com',
          name: 'Test User',
          emailVerified: false,
        }),
      });
    });

    it('should throw error for existing user', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'TestPassword123!',
      };
      
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'existing-user',
        email: 'existing@example.com',
      } as any);
      
      await expect(authService.register(userData)).rejects.toThrow(
        'User with this email already exists'
      );
    });

    it('should lowercase email', async () => {
      const userData = {
        email: 'TEST@EXAMPLE.COM',
        password: 'TestPassword123!',
      };
      
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      } as any);
      vi.mocked(prisma.session.create).mockResolvedValue({
        id: 'session-123',
        userId: 'user-123',
        expiresAt: new Date(),
      });
      vi.mocked(safeSetex).mockResolvedValue(true);
      
      await authService.register(userData);
      
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('login', () => {
    it('should login valid user', async () => {
      const password = 'TestPassword123!';
      const hash = await bcrypt.hash(password, 12);
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: hash,
        accountStatus: 'ACTIVE',
      };
      
      vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
      vi.mocked(prisma.session.create).mockResolvedValue({
        id: 'session-123',
        userId: 'user-123',
        expiresAt: new Date(),
      });
      vi.mocked(safeSetex).mockResolvedValue(true);
      
      const result = await authService.login({
        email: 'test@example.com',
        password,
      });
      
      expect(result.user).toEqual(user);
      expect(result.sessionId).toBeDefined();
    });

    it('should reject invalid password', async () => {
      const hash = await bcrypt.hash('CorrectPassword', 12);
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: hash,
        accountStatus: 'ACTIVE',
      };
      
      vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
      
      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'WrongPassword',
        })
      ).rejects.toThrow('Invalid email or password');
    });

    it('should reject suspended account', async () => {
      const password = 'TestPassword123!';
      const hash = await bcrypt.hash(password, 12);
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: hash,
        accountStatus: 'SUSPENDED',
      };
      
      vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
      
      await expect(
        authService.login({
          email: 'test@example.com',
          password,
        })
      ).rejects.toThrow('Account is suspended');
    });

    it('should reject non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      
      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'SomePassword',
        })
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('deleteSession', () => {
    it('should delete session from Redis and database', async () => {
      const sessionId = 'session-123';
      
      vi.mocked(safeDel).mockResolvedValue(true);
      vi.mocked(prisma.session.delete).mockResolvedValue({} as any);
      
      await authService.deleteSession(sessionId);
      
      expect(safeDel).toHaveBeenCalledWith('session:session-123');
      expect(prisma.session.delete).toHaveBeenCalledWith({
        where: { id: sessionId },
      });
    });
  });

  describe('generatePasswordResetToken', () => {
    it('should generate token and store HASH in database', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      
      vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
      vi.mocked(prisma.passwordResetToken.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.passwordResetToken.create).mockResolvedValue({} as any);
      vi.mocked(safeSetex).mockResolvedValue(true);
      
      const token = await authService.generatePasswordResetToken('test@example.com');
      
      // Token returned to user should be 64 chars (32 bytes hex)
      expect(token).toBeDefined();
      expect(token?.length).toBe(64);
      
      // Verify that the HASH was stored, not the raw token
      expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          token: hashToken(token!), // Hash should be stored
          userId: user.id,
        }),
      });
      
      // Redis should also use the hash
      expect(safeSetex).toHaveBeenCalledWith(
        `password-reset:${hashToken(token!)}`,
        expect.any(Number),
        user.id
      );
    });

    it('should return null for non-existent user (timing attack protection)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      
      const token = await authService.generatePasswordResetToken('nonexistent@example.com');
      
      expect(token).toBeNull();
    });
  });

  describe('resetPassword', () => {
    it('should reset password using hashed token lookup', async () => {
      const userId = 'user-123';
      const rawToken = 'valid-token';
      const tokenHash = hashToken(rawToken);
      const user = { id: userId, email: 'test@example.com' };
      const dbToken = {
        token: tokenHash, // DB stores the hash
        userId,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        usedAt: null,
      };
      
      // Mock DB token lookup - should be called with HASH
      vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(dbToken as any);
      
      // Mock transaction
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          user: { update: vi.fn().mockResolvedValue(user), findUnique: vi.fn().mockResolvedValue({ passwordHash: 'old-hash' }) },
          passwordResetToken: { update: vi.fn().mockResolvedValue({}) },
          passwordHistory: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), deleteMany: vi.fn() },
        };
        return callback(mockTx);
      });
      
      vi.mocked(safeDel).mockResolvedValue(true);
      vi.mocked(prisma.session.findMany).mockResolvedValue([]);
      vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.passwordHistory.findMany).mockResolvedValue([]); // No password history
      
      const result = await authService.resetPassword(rawToken, 'NewPassword123!');
      
      expect(result).toEqual(user);
      // Verify lookup uses the HASH of the provided token
      expect(prisma.passwordResetToken.findUnique).toHaveBeenCalledWith({
        where: { token: tokenHash },
      });
      // Redis cleanup should also use hash
      expect(safeDel).toHaveBeenCalledWith(`password-reset:${tokenHash}`);
    });

    it('should reject invalid token', async () => {
      // Token not found in DB
      vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(null);
      vi.mocked(safeDel).mockResolvedValue(true);
      
      await expect(
        authService.resetPassword('invalid-token', 'NewPassword123!')
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should reject expired token', async () => {
      const rawToken = 'expired-token';
      const tokenHash = hashToken(rawToken);
      const expiredToken = {
        token: tokenHash, // DB stores hash
        userId: 'user-123',
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        usedAt: null,
      };
      
      vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(expiredToken as any);
      vi.mocked(safeDel).mockResolvedValue(true);
      
      await expect(
        authService.resetPassword(rawToken, 'NewPassword123!')
      ).rejects.toThrow('Invalid or expired reset token');
    });
  });

  describe('verifyPhoneCode', () => {
    it('should verify phone code successfully', async () => {
      const userId = 'user-123';
      const phone = '+447123456789';
      const code = '123456';
      const payload = JSON.stringify({ userId, phone, code });
      const user = { id: userId, phone };

      vi.mocked(safeGet).mockResolvedValue(payload);
      vi.mocked(prisma.user.update).mockResolvedValue(user as any);
      vi.mocked(safeDel).mockResolvedValue(true);

      const result = await authService.verifyPhoneCode(userId, phone, code);

      expect(result).toEqual(user);
      expect(safeDel).toHaveBeenCalled();
    });

    it('should reject invalid verification code', async () => {
      vi.mocked(safeGet).mockResolvedValue(null);

      await expect(
        authService.verifyPhoneCode('user-123', '+447123456789', '000000')
      ).rejects.toThrow('Invalid or expired verification code');
    });

    it('should reject mismatched phone number', async () => {
      const payload = JSON.stringify({ 
        userId: 'user-123', 
        phone: '+447123456789', 
        code: '123456' 
      });
      vi.mocked(safeGet).mockResolvedValue(payload);

      await expect(
        authService.verifyPhoneCode('user-123', '+447999999999', '123456')
      ).rejects.toThrow('Invalid or expired verification code');
    });

    it('should reject corrupted payload', async () => {
      vi.mocked(safeGet).mockResolvedValue('not-valid-json');
      vi.mocked(safeDel).mockResolvedValue(true);

      await expect(
        authService.verifyPhoneCode('user-123', '+447123456789', '123456')
      ).rejects.toThrow('Invalid or expired verification code');
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      const token = 'valid-token';
      const userId = 'user-123';
      const user = { id: userId, emailVerified: true };
      const dbToken = {
        token,
        userId,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      };

      vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue(dbToken as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          user: { update: vi.fn().mockResolvedValue(user) },
          emailVerificationToken: { update: vi.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });
      vi.mocked(safeDel).mockResolvedValue(true);

      const result = await authService.verifyEmail(token);

      expect(result).toEqual(user);
    });

    it('should reject invalid email token', async () => {
      vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue(null);
      vi.mocked(safeDel).mockResolvedValue(true);

      await expect(
        authService.verifyEmail('invalid-token')
      ).rejects.toThrow('Invalid or expired verification token');
    });

    it('should reject expired email token', async () => {
      const dbToken = {
        token: 'expired-token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() - 3600000), // expired
        usedAt: null,
      };

      vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue(dbToken as any);
      vi.mocked(safeDel).mockResolvedValue(true);

      await expect(
        authService.verifyEmail('expired-token')
      ).rejects.toThrow('Invalid or expired verification token');
    });

    it('should reject already used email token', async () => {
      const dbToken = {
        token: 'used-token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: new Date(), // already used
      };

      vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue(dbToken as any);
      vi.mocked(safeDel).mockResolvedValue(true);

      await expect(
        authService.verifyEmail('used-token')
      ).rejects.toThrow('Invalid or expired verification token');
    });
  });

  describe('isPasswordRecentlyUsed', () => {
    it('should return true if password was recently used', async () => {
      const userId = 'user-123';
      const password = 'OldPassword123!';
      const hash = await bcrypt.hash(password, 10);

      vi.mocked(prisma.passwordHistory.findMany).mockResolvedValue([
        { passwordHash: hash },
      ] as any);

      const result = await authService.isPasswordRecentlyUsed(userId, password);

      expect(result).toBe(true);
    });

    it('should return false if password was not recently used', async () => {
      const userId = 'user-123';
      const differentHash = await bcrypt.hash('DifferentPassword!', 10);

      vi.mocked(prisma.passwordHistory.findMany).mockResolvedValue([
        { passwordHash: differentHash },
      ] as any);

      const result = await authService.isPasswordRecentlyUsed(userId, 'NewPassword123!');

      expect(result).toBe(false);
    });

    it('should return false if no password history', async () => {
      vi.mocked(prisma.passwordHistory.findMany).mockResolvedValue([]);

      const result = await authService.isPasswordRecentlyUsed('user-123', 'AnyPassword!');

      expect(result).toBe(false);
    });
  });

  describe('savePasswordToHistory', () => {
    it('should save password to history', async () => {
      const userId = 'user-123';
      const passwordHash = 'hashed-password';

      vi.mocked(prisma.passwordHistory.create).mockResolvedValue({} as any);
      vi.mocked(prisma.passwordHistory.findMany).mockResolvedValue([]);

      await authService.savePasswordToHistory(userId, passwordHash);

      expect(prisma.passwordHistory.create).toHaveBeenCalledWith({
        data: { userId, passwordHash },
      });
    });

    it('should cleanup old history entries', async () => {
      const userId = 'user-123';
      const oldEntries = [{ id: 'old-1' }, { id: 'old-2' }];

      vi.mocked(prisma.passwordHistory.create).mockResolvedValue({} as any);
      vi.mocked(prisma.passwordHistory.findMany).mockResolvedValue(oldEntries as any);
      vi.mocked(prisma.passwordHistory.deleteMany).mockResolvedValue({ count: 2 });

      await authService.savePasswordToHistory(userId, 'hash');

      expect(prisma.passwordHistory.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['old-1', 'old-2'] } },
      });
    });
  });
});
