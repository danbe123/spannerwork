import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../src/config/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockSafeGet = vi.hoisted(() => vi.fn());
const mockSafeSetex = vi.hoisted(() => vi.fn());
const mockSafeDel = vi.hoisted(() => vi.fn());

vi.mock('../../src/config/redis.js', () => ({
  safeGet: mockSafeGet,
  safeSetex: mockSafeSetex,
  safeDel: mockSafeDel,
}));

import { loginAttemptService, LoginAttemptService as _LoginAttemptService } from '../../src/services/loginAttempt.service.js';
import { logger } from '../../src/config/logger.js';

describe('Login Attempt Service', () => {
  const testEmail = 'test@example.com';

  beforeEach(() => {
    vi.clearAllMocks();
    mockSafeGet.mockResolvedValue(null);
    mockSafeSetex.mockResolvedValue('OK');
    mockSafeDel.mockResolvedValue(1);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getAttemptData', () => {
    it('returns null when no data exists', async () => {
      mockSafeGet.mockResolvedValue(null);

      const result = await loginAttemptService.getAttemptData(testEmail);

      expect(result).toBeNull();
    });

    it('returns parsed data when exists', async () => {
      const data = { attempts: 3, lastAttempt: Date.now(), lockoutUntil: null, lockoutCount: 0 };
      mockSafeGet.mockResolvedValue(JSON.stringify(data));

      const result = await loginAttemptService.getAttemptData(testEmail);

      expect(result).toEqual(data);
    });

    it('returns null on parse error', async () => {
      mockSafeGet.mockResolvedValue('invalid json');

      const result = await loginAttemptService.getAttemptData(testEmail);

      expect(result).toBeNull();
    });

    it('normalizes email to lowercase', async () => {
      await loginAttemptService.getAttemptData('TEST@Example.COM');

      expect(mockSafeGet).toHaveBeenCalledWith('login-attempts:test@example.com');
    });
  });

  describe('isLockedOut', () => {
    it('returns not locked when no data exists', async () => {
      mockSafeGet.mockResolvedValue(null);

      const result = await loginAttemptService.isLockedOut(testEmail);

      expect(result).toEqual({ locked: false, remainingSeconds: 0 });
    });

    it('returns not locked when lockoutUntil is null', async () => {
      mockSafeGet.mockResolvedValue(JSON.stringify({
        attempts: 3,
        lastAttempt: Date.now(),
        lockoutUntil: null,
        lockoutCount: 0,
      }));

      const result = await loginAttemptService.isLockedOut(testEmail);

      expect(result).toEqual({ locked: false, remainingSeconds: 0 });
    });

    it('returns locked with remaining time when in lockout', async () => {
      const futureTime = Date.now() + 60000; // 60 seconds in future
      mockSafeGet.mockResolvedValue(JSON.stringify({
        attempts: 0,
        lastAttempt: Date.now(),
        lockoutUntil: futureTime,
        lockoutCount: 1,
      }));

      const result = await loginAttemptService.isLockedOut(testEmail);

      expect(result.locked).toBe(true);
      expect(result.remainingSeconds).toBeGreaterThan(50);
      expect(result.remainingSeconds).toBeLessThanOrEqual(60);
    });

    it('returns not locked when lockout has expired', async () => {
      const pastTime = Date.now() - 60000; // 60 seconds in past
      mockSafeGet.mockResolvedValue(JSON.stringify({
        attempts: 0,
        lastAttempt: Date.now(),
        lockoutUntil: pastTime,
        lockoutCount: 1,
      }));

      const result = await loginAttemptService.isLockedOut(testEmail);

      expect(result).toEqual({ locked: false, remainingSeconds: 0 });
    });
  });

  describe('recordFailedAttempt', () => {
    it('creates new record on first failed attempt', async () => {
      const result = await loginAttemptService.recordFailedAttempt(testEmail);

      expect(result).toEqual({ locked: false, remainingSeconds: 0 });
      expect(mockSafeSetex).toHaveBeenCalled();
    });

    it('increments attempt count', async () => {
      mockSafeGet.mockResolvedValue(JSON.stringify({
        attempts: 2,
        lastAttempt: Date.now(),
        lockoutUntil: null,
        lockoutCount: 0,
      }));

      await loginAttemptService.recordFailedAttempt(testEmail);

      const savedData = JSON.parse(mockSafeSetex.mock.calls[0][2]);
      expect(savedData.attempts).toBe(3);
    });

    it('locks out after 5 failed attempts', async () => {
      mockSafeGet.mockResolvedValue(JSON.stringify({
        attempts: 4,
        lastAttempt: Date.now(),
        lockoutUntil: null,
        lockoutCount: 0,
      }));

      const result = await loginAttemptService.recordFailedAttempt(testEmail);

      expect(result.locked).toBe(true);
      expect(result.remainingSeconds).toBeGreaterThan(0);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Account locked out')
      );
    });

    it('resets attempts after window expires', async () => {
      const oldTimestamp = Date.now() - (16 * 60 * 1000); // 16 minutes ago
      mockSafeGet.mockResolvedValue(JSON.stringify({
        attempts: 4,
        lastAttempt: oldTimestamp,
        lockoutUntil: null,
        lockoutCount: 0,
      }));

      await loginAttemptService.recordFailedAttempt(testEmail);

      const savedData = JSON.parse(mockSafeSetex.mock.calls[0][2]);
      expect(savedData.attempts).toBe(1); // Reset to 0 then incremented to 1
    });

    it('applies exponential backoff to lockout duration', async () => {
      // First lockout: 60 seconds
      mockSafeGet.mockResolvedValue(JSON.stringify({
        attempts: 4,
        lastAttempt: Date.now(),
        lockoutUntil: null,
        lockoutCount: 0,
      }));

      let result = await loginAttemptService.recordFailedAttempt(testEmail);
      expect(result.remainingSeconds).toBe(60);

      // Second lockout: 120 seconds
      mockSafeGet.mockResolvedValue(JSON.stringify({
        attempts: 4,
        lastAttempt: Date.now(),
        lockoutUntil: null,
        lockoutCount: 1,
      }));

      result = await loginAttemptService.recordFailedAttempt(testEmail);
      expect(result.remainingSeconds).toBe(120);

      // Third lockout: 240 seconds
      mockSafeGet.mockResolvedValue(JSON.stringify({
        attempts: 4,
        lastAttempt: Date.now(),
        lockoutUntil: null,
        lockoutCount: 2,
      }));

      result = await loginAttemptService.recordFailedAttempt(testEmail);
      expect(result.remainingSeconds).toBe(240);
    });

    it('caps lockout at maximum 1 hour', async () => {
      mockSafeGet.mockResolvedValue(JSON.stringify({
        attempts: 4,
        lastAttempt: Date.now(),
        lockoutUntil: null,
        lockoutCount: 10, // Many previous lockouts
      }));

      const result = await loginAttemptService.recordFailedAttempt(testEmail);

      expect(result.remainingSeconds).toBe(3600); // 1 hour max
    });
  });

  describe('recordSuccessfulLogin', () => {
    it('clears login attempt data', async () => {
      await loginAttemptService.recordSuccessfulLogin(testEmail);

      expect(mockSafeDel).toHaveBeenCalledWith('login-attempts:test@example.com');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('cleared')
      );
    });
  });

  describe('clearLockout', () => {
    it('manually clears lockout', async () => {
      await loginAttemptService.clearLockout(testEmail);

      expect(mockSafeDel).toHaveBeenCalledWith('login-attempts:test@example.com');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('manually cleared')
      );
    });
  });

  describe('getLockoutStatus', () => {
    it('returns status with all fields', async () => {
      const futureTime = Date.now() + 30000;
      mockSafeGet.mockResolvedValue(JSON.stringify({
        attempts: 3,
        lastAttempt: Date.now(),
        lockoutUntil: futureTime,
        lockoutCount: 2,
      }));

      const result = await loginAttemptService.getLockoutStatus(testEmail);

      expect(result).toEqual({
        attempts: 3,
        isLocked: true,
        remainingSeconds: expect.any(Number),
        lockoutCount: 2,
      });
    });

    it('returns defaults when no data exists', async () => {
      mockSafeGet.mockResolvedValue(null);

      const result = await loginAttemptService.getLockoutStatus(testEmail);

      expect(result).toEqual({
        attempts: 0,
        isLocked: false,
        remainingSeconds: 0,
        lockoutCount: 0,
      });
    });
  });
});
