import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock dependencies before imports
vi.mock('../../src/config/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/config/cookie.js', () => ({
  SESSION_COOKIE_OPTIONS: { httpOnly: true, secure: true },
  COOKIE_NAMES: { SESSION: 'session' },
}));

const mockRegister = vi.hoisted(() => vi.fn());
const mockGenerateEmailVerificationToken = vi.hoisted(() => vi.fn());
const mockGeneratePhoneVerificationCode = vi.hoisted(() => vi.fn());
const mockVerifyPhoneCode = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/auth.service.js', () => ({
  authService: {
    register: mockRegister,
    generateEmailVerificationToken: mockGenerateEmailVerificationToken,
    generatePhoneVerificationCode: mockGeneratePhoneVerificationCode,
    verifyPhoneCode: mockVerifyPhoneCode,
  },
}));

const mockSendEmailVerificationEmail = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/email.service.js', () => ({
  emailService: {
    sendEmailVerificationEmail: mockSendEmailVerificationEmail,
  },
}));

const mockSendSms = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/sms.service.js', () => ({
  smsService: {
    sendSms: mockSendSms,
  },
}));

vi.mock('../../src/utils/errors.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/utils/errors.js')>('../../src/utils/errors.js');
  return actual;
});

import { AuthController } from '../../src/controllers/auth.controller.js';
import { logger } from '../../src/config/logger.js';

// Helper to create mock request - use any to avoid Express type complexity in tests
function createMockRequest(overrides: Record<string, any> = {}): any {
  return {
    body: {},
    user: undefined,
    ...overrides,
  };
}

// Helper to create mock response
function createMockResponse(): Partial<Response> {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
  };
}

describe('Auth Controller', () => {
  let controller: AuthController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AuthController();
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('register', () => {
    it('registers new user and sets session cookie', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashed',
      };
      mockRegister.mockResolvedValue({ user: mockUser, sessionId: 'session-123' });
      mockGenerateEmailVerificationToken.mockResolvedValue('token-123');

      const req = createMockRequest({
        body: { email: 'test@example.com', password: 'password123', name: 'Test User' },
      });
      const res = createMockResponse();

      await controller.register(req as Request, res as Response, mockNext);

      expect(mockRegister).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });
      expect(res.cookie).toHaveBeenCalledWith('session', 'session-123', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Registration successful',
        user: expect.not.objectContaining({ passwordHash: expect.any(String) }),
      });
    });

    it('sends verification email after registration', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test', passwordHash: 'x' };
      mockRegister.mockResolvedValue({ user: mockUser, sessionId: 'sess-1' });
      mockGenerateEmailVerificationToken.mockResolvedValue('verify-token');

      const req = createMockRequest({
        body: { email: 'test@example.com', password: 'pass', name: 'Test' },
      });
      const res = createMockResponse();

      await controller.register(req as Request, res as Response, mockNext);

      expect(mockGenerateEmailVerificationToken).toHaveBeenCalledWith('user-1');
      expect(mockSendEmailVerificationEmail).toHaveBeenCalledWith('test@example.com', 'verify-token');
    });

    it('succeeds even if verification email fails', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test', passwordHash: 'x' };
      mockRegister.mockResolvedValue({ user: mockUser, sessionId: 'sess-1' });
      mockSendEmailVerificationEmail.mockRejectedValue(new Error('Email failed'));

      const req = createMockRequest({
        body: { email: 'test@example.com', password: 'pass', name: 'Test' },
      });
      const res = createMockResponse();

      await controller.register(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send verification email'),
        expect.any(Error)
      );
    });

    it('passes ConflictError to next on duplicate email', async () => {
      mockRegister.mockRejectedValue(new Error('User already exists'));

      const req = createMockRequest({
        body: { email: 'existing@example.com', password: 'pass', name: 'Test' },
      });
      const res = createMockResponse();

      await controller.register(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User already exists',
        })
      );
    });

    it('passes other errors to next', async () => {
      const error = new Error('Database connection failed');
      mockRegister.mockRejectedValue(error);

      const req = createMockRequest({
        body: { email: 'test@example.com', password: 'pass', name: 'Test' },
      });
      const res = createMockResponse();

      await controller.register(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('sendPhoneVerificationCode', () => {
    it('sends verification code via SMS', async () => {
      mockGeneratePhoneVerificationCode.mockResolvedValue('123456');

      const req = createMockRequest({
        user: { id: 'user-1' },
        body: { phone: '+447123456789' },
      });
      const res = createMockResponse();

      await controller.sendPhoneVerificationCode(req as Request, res as Response, mockNext);

      expect(mockGeneratePhoneVerificationCode).toHaveBeenCalledWith('user-1', '+447123456789');
      expect(mockSendSms).toHaveBeenCalledWith({
        to: '+447123456789',
        body: 'Your SpannerWork verification code is 123456',
      });
      expect(res.json).toHaveBeenCalledWith({
        message: 'Verification code sent',
      });
    });

    it('returns 401 if not authenticated', async () => {
      const req = createMockRequest({
        user: undefined,
        body: { phone: '+447123456789' },
      });
      const res = createMockResponse();

      await controller.sendPhoneVerificationCode(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Not authenticated' })
      );
    });
  });

  describe('verifyPhone', () => {
    it('verifies phone and returns updated user', async () => {
      const mockUser = { id: 'user-1', phone: '+447123456789', passwordHash: 'x' };
      mockVerifyPhoneCode.mockResolvedValue(mockUser);

      const req = createMockRequest({
        user: { id: 'user-1' },
        body: { phone: '+447123456789', code: '123456' },
      });
      const res = createMockResponse();

      await controller.verifyPhone(req as Request, res as Response, mockNext);

      expect(mockVerifyPhoneCode).toHaveBeenCalledWith('user-1', '+447123456789', '123456');
      expect(res.json).toHaveBeenCalledWith({
        message: 'Phone verified successfully',
        user: expect.not.objectContaining({ passwordHash: expect.any(String) }),
      });
    });

    it('returns 401 if not authenticated', async () => {
      const req = createMockRequest({
        user: undefined,
        body: { phone: '+447123456789', code: '123456' },
      });
      const res = createMockResponse();

      await controller.verifyPhone(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Not authenticated' })
      );
    });
  });
});
