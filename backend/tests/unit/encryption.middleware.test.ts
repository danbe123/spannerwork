import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../src/config/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockEncrypt = vi.hoisted(() => vi.fn((val: string) => `encrypted:${val}`));
const mockEncryptDeterministic = vi.hoisted(() => vi.fn((val: string) => `det:${val}`));
const mockDecryptAny = vi.hoisted(() => vi.fn((val: string) => {
  if (val.startsWith('encrypted:')) return val.replace('encrypted:', '');
  if (val.startsWith('det:')) return val.replace('det:', '');
  return val;
}));
const mockHash = vi.hoisted(() => vi.fn((val: string) => `hash:${val}`));
const mockIsEnabled = vi.hoisted(() => vi.fn().mockReturnValue(true));

vi.mock('../../src/services/encryption.service.js', () => ({
  encryptionService: {
    encrypt: mockEncrypt,
    encryptDeterministic: mockEncryptDeterministic,
    decryptAny: mockDecryptAny,
    hash: mockHash,
    isEnabled: mockIsEnabled,
  },
}));

import {
  encryptionMiddleware,
  encryptForSearch,
  hashForSearch,
} from '../../src/middleware/encryption.middleware.js';

describe('Encryption Middleware', () => {
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-configure mocks after clearAllMocks
    mockEncrypt.mockImplementation((val: string) => `encrypted:${val}`);
    mockEncryptDeterministic.mockImplementation((val: string) => `det:${val}`);
    mockDecryptAny.mockImplementation((val: string) => {
      if (val.startsWith('encrypted:')) return val.replace('encrypted:', '');
      if (val.startsWith('det:')) return val.replace('det:', '');
      return val;
    });
    mockHash.mockImplementation((val: string) => `hash:${val}`);
    mockIsEnabled.mockReturnValue(true);
    
    mockNext = vi.fn().mockImplementation(async (params: any) => {
      // Return the data as passed through (simulating Prisma)
      if (params.action === 'create' || params.action === 'update') {
        return params.args.data;
      }
      if (params.action === 'findUnique' || params.action === 'findFirst') {
        return params.args.data || null;
      }
      if (params.action === 'findMany') {
        return params.args.data ? [params.args.data] : [];
      }
      return null;
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('encryptionMiddleware', () => {
    it('returns middleware function', () => {
      const middleware = encryptionMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('passes through when model is null', async () => {
      const middleware = encryptionMiddleware();
      const params = {
        model: undefined,
        action: 'create',
        args: { data: { phone: '1234567890' } },
        dataPath: [],
        runInTransaction: false,
      };

      await middleware(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(params);
      expect(mockEncrypt).not.toHaveBeenCalled();
    });

    it('passes through when model has no encrypted fields', async () => {
      const middleware = encryptionMiddleware();
      const params = {
        model: 'Transaction',
        action: 'create',
        args: { data: { amount: 100 } },
        dataPath: [],
        runInTransaction: false,
      };

      await middleware(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(params);
      expect(mockEncrypt).not.toHaveBeenCalled();
    });

    it('encrypts phone field on User create', async () => {
      const middleware = encryptionMiddleware();
      const params = {
        model: 'User',
        action: 'create',
        args: { data: { phone: '1234567890', name: 'Test User' } },
        dataPath: [],
        runInTransaction: false,
      };

      await middleware(params, mockNext);

      expect(mockEncrypt).toHaveBeenCalledWith('1234567890');
      expect(mockNext).toHaveBeenCalledWith({
        ...params,
        args: { data: { phone: 'encrypted:1234567890', name: 'Test User' } },
      });
    });

    it('encrypts phone field on User update', async () => {
      const middleware = encryptionMiddleware();
      const params = {
        model: 'User',
        action: 'update',
        args: { data: { phone: '9876543210' } },
        dataPath: [],
        runInTransaction: false,
      };

      await middleware(params, mockNext);

      expect(mockEncrypt).toHaveBeenCalledWith('9876543210');
    });

    it('encrypts phone field on Referral create', async () => {
      const middleware = encryptionMiddleware();
      const params = {
        model: 'Referral',
        action: 'create',
        args: { data: { phone: '5551234567', email: 'test@example.com' } },
        dataPath: [],
        runInTransaction: false,
      };

      await middleware(params, mockNext);

      expect(mockEncrypt).toHaveBeenCalledWith('5551234567');
    });

    it('handles createMany action', async () => {
      const middleware = encryptionMiddleware();
      const params = {
        model: 'User',
        action: 'createMany',
        args: {
          data: [
            { phone: '1111111111', name: 'User 1' },
            { phone: '2222222222', name: 'User 2' },
          ],
        },
        dataPath: [],
        runInTransaction: false,
      };

      await middleware(params, mockNext);

      expect(mockEncrypt).toHaveBeenCalledWith('1111111111');
      expect(mockEncrypt).toHaveBeenCalledWith('2222222222');
    });

    it('handles updateMany action', async () => {
      const middleware = encryptionMiddleware();
      const params = {
        model: 'User',
        action: 'updateMany',
        args: { data: { phone: '3333333333' } },
        dataPath: [],
        runInTransaction: false,
      };

      await middleware(params, mockNext);

      expect(mockEncrypt).toHaveBeenCalledWith('3333333333');
    });

    it('handles upsert action - create and update', async () => {
      const middleware = encryptionMiddleware();
      const params = {
        model: 'User',
        action: 'upsert',
        args: {
          create: { phone: '4444444444', name: 'New User' },
          update: { phone: '5555555555' },
        },
        dataPath: [],
        runInTransaction: false,
      };

      await middleware(params, mockNext);

      expect(mockEncrypt).toHaveBeenCalledWith('4444444444');
      expect(mockEncrypt).toHaveBeenCalledWith('5555555555');
    });

    it('skips encryption when field is not a string', async () => {
      const middleware = encryptionMiddleware();
      const params = {
        model: 'User',
        action: 'create',
        args: { data: { phone: null, name: 'Test User' } },
        dataPath: [],
        runInTransaction: false,
      };

      await middleware(params, mockNext);

      expect(mockEncrypt).not.toHaveBeenCalled();
    });

    it('skips encryption when encryption is disabled', async () => {
      mockIsEnabled.mockReturnValue(false);
      
      const middleware = encryptionMiddleware();
      const params = {
        model: 'User',
        action: 'create',
        args: { data: { phone: '1234567890', name: 'Test User' } },
        dataPath: [],
        runInTransaction: false,
      };

      await middleware(params, mockNext);

      expect(mockEncrypt).not.toHaveBeenCalled();
    });

    it('decrypts result on findUnique', async () => {
      const middleware = encryptionMiddleware();
      mockNext.mockResolvedValueOnce({ phone: 'encrypted:1234567890', name: 'Test User' });

      const params = {
        model: 'User',
        action: 'findUnique',
        args: { where: { id: '1' } },
        dataPath: [],
        runInTransaction: false,
      };

      const result = await middleware(params, mockNext);

      expect(mockDecryptAny).toHaveBeenCalledWith('encrypted:1234567890');
      expect(result).toEqual({ phone: '1234567890', name: 'Test User' });
    });

    it('decrypts result on findFirst', async () => {
      const middleware = encryptionMiddleware();
      mockNext.mockResolvedValueOnce({ phone: 'encrypted:9999999999', name: 'First User' });

      const params = {
        model: 'User',
        action: 'findFirst',
        args: {},
        dataPath: [],
        runInTransaction: false,
      };

      const result = await middleware(params, mockNext);

      expect(mockDecryptAny).toHaveBeenCalledWith('encrypted:9999999999');
      expect(result).toEqual({ phone: '9999999999', name: 'First User' });
    });

    it('decrypts array results on findMany', async () => {
      const middleware = encryptionMiddleware();
      mockNext.mockResolvedValueOnce([
        { phone: 'encrypted:1111111111', name: 'User 1' },
        { phone: 'encrypted:2222222222', name: 'User 2' },
      ]);

      const params = {
        model: 'User',
        action: 'findMany',
        args: {},
        dataPath: [],
        runInTransaction: false,
      };

      const result = await middleware(params, mockNext);

      expect(result).toEqual([
        { phone: '1111111111', name: 'User 1' },
        { phone: '2222222222', name: 'User 2' },
      ]);
    });

    it('returns null when result is null', async () => {
      const middleware = encryptionMiddleware();
      mockNext.mockResolvedValueOnce(null);

      const params = {
        model: 'User',
        action: 'findUnique',
        args: { where: { id: 'non-existent' } },
        dataPath: [],
        runInTransaction: false,
      };

      const result = await middleware(params, mockNext);

      expect(result).toBeNull();
      expect(mockDecryptAny).not.toHaveBeenCalled();
    });

    it('keeps encrypted value on decryption error', async () => {
      const middleware = encryptionMiddleware();
      mockNext.mockResolvedValueOnce({ phone: 'invalid-encrypted-data', name: 'Test User' });
      mockDecryptAny.mockImplementationOnce(() => {
        throw new Error('Decryption failed');
      });

      const params = {
        model: 'User',
        action: 'findUnique',
        args: { where: { id: '1' } },
        dataPath: [],
        runInTransaction: false,
      };

      const result = await middleware(params, mockNext);

      expect(result).toEqual({ phone: 'invalid-encrypted-data', name: 'Test User' });
    });
  });

  describe('encryptForSearch', () => {
    it('uses deterministic encryption', () => {
      const result = encryptForSearch('test@example.com');
      
      expect(mockEncryptDeterministic).toHaveBeenCalledWith('test@example.com');
      expect(result).toBe('det:test@example.com');
    });
  });

  describe('hashForSearch', () => {
    it('returns a string', () => {
      const result = hashForSearch('sensitive-data');
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns consistent hash for same input', () => {
      const result1 = hashForSearch('test-value');
      const result2 = hashForSearch('test-value');
      
      expect(result1).toBe(result2);
    });
  });
});
