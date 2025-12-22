import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { EncryptionService, encryptionService } from '../../src/services/encryption.service.js';
import { logger as _logger } from '../../src/config/logger.js';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = encryptionService; // Use the singleton that has the actual config
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('isEnabled', () => {
    it('should return boolean indicating if encryption is enabled', () => {
      // The result depends on whether ENCRYPTION_KEY is set in env
      expect(typeof service.isEnabled()).toBe('boolean');
    });
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string when enabled, or pass through when disabled', () => {
      const plaintext = 'Hello, World!';
      const encrypted = service.encrypt(plaintext);

      if (service.isEnabled()) {
        expect(encrypted).toMatch(/^enc:/);
        expect(encrypted).not.toBe(plaintext);
      } else {
        expect(encrypted).toBe(plaintext);
      }

      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should return same value if already not encrypted for decrypt', () => {
      const plaintext = 'Not encrypted';
      const result = service.decrypt(plaintext);
      expect(result).toBe(plaintext);
    });

    it('should return empty value as-is for encrypt', () => {
      expect(service.encrypt('')).toBe('');
    });

    it('should return empty value as-is for decrypt', () => {
      expect(service.decrypt('')).toBe('');
    });

    it('should handle encryption round-trip correctly', () => {
      const plaintext = 'Test message';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      // If enabled, different ciphertext each time due to random IV
      // If disabled, same plaintext returned
      if (service.isEnabled()) {
        expect(encrypted1).not.toBe(encrypted2);
      }

      // Both should decrypt to the same value
      expect(service.decrypt(encrypted1)).toBe(plaintext);
      expect(service.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'Hello 世界! 🌍';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('encryptDeterministic/decryptDeterministic', () => {
    it('should produce same ciphertext for same plaintext when enabled', () => {
      const plaintext = 'searchable@email.com';
      const encrypted1 = service.encryptDeterministic(plaintext);
      const encrypted2 = service.encryptDeterministic(plaintext);

      expect(encrypted1).toBe(encrypted2);
      if (service.isEnabled()) {
        expect(encrypted1).toMatch(/^det:/);
      }
    });

    it('should decrypt deterministically encrypted values', () => {
      const plaintext = 'test@example.com';
      const encrypted = service.encryptDeterministic(plaintext);
      const decrypted = service.decryptDeterministic(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should return empty value as-is', () => {
      expect(service.encryptDeterministic('')).toBe('');
      expect(service.decryptDeterministic('')).toBe('');
    });

    it('should return non-encrypted value as-is', () => {
      expect(service.decryptDeterministic('not-encrypted')).toBe('not-encrypted');
    });
  });

  describe('isEncrypted', () => {
    it('should identify encrypted values', () => {
      const plaintext = 'Test';
      const encrypted = service.encrypt(plaintext);
      const deterministicEncrypted = service.encryptDeterministic(plaintext);

      if (service.isEnabled()) {
        expect(service.isEncrypted(encrypted)).toBe(true);
        expect(service.isEncrypted(deterministicEncrypted)).toBe(true);
      } else {
        // When disabled, values pass through unchanged
        expect(service.isEncrypted(encrypted)).toBe(false);
        expect(service.isEncrypted(deterministicEncrypted)).toBe(false);
      }
      expect(service.isEncrypted(plaintext)).toBe(false);
      expect(service.isEncrypted('')).toBe(false);
    });
  });

  describe('decryptAny', () => {
    it('should auto-detect and decrypt random encryption', () => {
      const plaintext = 'Random encrypted';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decryptAny(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should auto-detect and decrypt deterministic encryption', () => {
      const plaintext = 'Deterministic encrypted';
      const encrypted = service.encryptDeterministic(plaintext);
      const decrypted = service.decryptAny(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should return non-encrypted values as-is', () => {
      expect(service.decryptAny('plain text')).toBe('plain text');
    });

    it('should handle empty/null values', () => {
      expect(service.decryptAny('')).toBe('');
    });
  });

  describe('hash', () => {
    it('should produce consistent hash for same input', () => {
      const value = 'test@example.com';
      const hash1 = service.hash(value);
      const hash2 = service.hash(value);

      expect(hash1).toBe(hash2);
      if (service.isEnabled()) {
        expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex output
      } else {
        // When disabled, returns value as-is (lowercased)
        expect(hash1).toBe(value.toLowerCase());
      }
    });

    it('should be case-insensitive when encryption is enabled', () => {
      // The hash function lowercases input, so these should be equal
      const hash1 = service.hash('TEST@EXAMPLE.COM');
      const hash2 = service.hash('test@example.com');

      if (service.isEnabled()) {
        // Both should produce a valid SHA-256 hash
        expect(hash1).toMatch(/^[a-f0-9]{64}$/);
        expect(hash2).toMatch(/^[a-f0-9]{64}$/);
        expect(hash1).toBe(hash2);
      } else {
        // When disabled, returns value as-is (no hashing, no lowercasing)
        expect(hash1).toBe('TEST@EXAMPLE.COM');
        expect(hash2).toBe('test@example.com');
        // Note: they are NOT equal when disabled
      }
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = service.hash('user1@example.com');
      const hash2 = service.hash('user2@example.com');

      expect(hash1).not.toBe(hash2);
    });

    it('should return empty value as-is', () => {
      expect(service.hash('')).toBe('');
    });
  });
});

// Test with encryption enabled by reimporting with key set
describe('EncryptionService with encryption enabled', () => {
  const TEST_ENCRYPTION_KEY = 'a'.repeat(64);

  it('should encrypt and decrypt correctly when enabled', async () => {
    vi.resetModules();
    process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    
    vi.doMock('../../src/config/logger.js', () => ({
      logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    }));

    const { encryptionService: enabledService } = await import('../../src/services/encryption.service.js');
    
    expect(enabledService.isEnabled()).toBe(true);
    
    const plaintext = 'secret data';
    const encrypted = enabledService.encrypt(plaintext);
    
    expect(encrypted).toMatch(/^enc:/);
    expect(encrypted).not.toContain(plaintext);
    
    const decrypted = enabledService.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
    
    // Clean up
    delete process.env.ENCRYPTION_KEY;
  });

  it('should produce different ciphertext for same plaintext (random IV)', async () => {
    vi.resetModules();
    process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    
    vi.doMock('../../src/config/logger.js', () => ({
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));

    const { encryptionService: enabledService } = await import('../../src/services/encryption.service.js');
    
    const plaintext = 'same message';
    const encrypted1 = enabledService.encrypt(plaintext);
    const encrypted2 = enabledService.encrypt(plaintext);
    
    expect(encrypted1).not.toBe(encrypted2);
    
    delete process.env.ENCRYPTION_KEY;
  });

  it('should handle deterministic encryption', async () => {
    vi.resetModules();
    process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    
    vi.doMock('../../src/config/logger.js', () => ({
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));

    const { encryptionService: enabledService } = await import('../../src/services/encryption.service.js');
    
    const plaintext = 'searchable value';
    const encrypted1 = enabledService.encryptDeterministic(plaintext);
    const encrypted2 = enabledService.encryptDeterministic(plaintext);
    
    expect(encrypted1).toMatch(/^det:/);
    expect(encrypted1).toBe(encrypted2); // Same result each time
    
    const decrypted = enabledService.decryptDeterministic(encrypted1);
    expect(decrypted).toBe(plaintext);
    
    delete process.env.ENCRYPTION_KEY;
  });

  it('should produce valid SHA-256 hash when enabled', async () => {
    vi.resetModules();
    process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    
    vi.doMock('../../src/config/logger.js', () => ({
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));

    const { encryptionService: enabledService } = await import('../../src/services/encryption.service.js');
    
    const hash = enabledService.hash('test@example.com');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    
    delete process.env.ENCRYPTION_KEY;
  });

  it('should throw error on decrypt with tampered ciphertext', async () => {
    vi.resetModules();
    process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    
    const mockLogger = { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() };
    vi.doMock('../../src/config/logger.js', () => ({
      logger: mockLogger,
    }));

    const { encryptionService: enabledService } = await import('../../src/services/encryption.service.js');
    
    const plaintext = 'sensitive data';
    const encrypted = enabledService.encrypt(plaintext);
    
    // Tamper with the ciphertext
    const tampered = encrypted.slice(0, -5) + 'XXXXX';
    
    expect(() => enabledService.decrypt(tampered)).toThrow('Failed to decrypt data');
    expect(mockLogger.error).toHaveBeenCalledWith('Decryption failed:', expect.any(Error));
    
    delete process.env.ENCRYPTION_KEY;
  });

  it('should correctly identify encrypted values', async () => {
    vi.resetModules();
    process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    
    vi.doMock('../../src/config/logger.js', () => ({
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));

    const { encryptionService: enabledService } = await import('../../src/services/encryption.service.js');
    
    const encrypted = enabledService.encrypt('test');
    const deterministicEncrypted = enabledService.encryptDeterministic('test');
    
    expect(enabledService.isEncrypted(encrypted)).toBe(true);
    expect(enabledService.isEncrypted(deterministicEncrypted)).toBe(true);
    expect(enabledService.isEncrypted('plain text')).toBe(false);
    
    delete process.env.ENCRYPTION_KEY;
  });

  it('should handle unicode and special characters', async () => {
    vi.resetModules();
    process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    
    vi.doMock('../../src/config/logger.js', () => ({
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));

    const { encryptionService: enabledService } = await import('../../src/services/encryption.service.js');
    
    const plaintext = 'Special chars: £€¥ 日本語 🔒';
    const encrypted = enabledService.encrypt(plaintext);
    const decrypted = enabledService.decrypt(encrypted);
    
    expect(decrypted).toBe(plaintext);
    
    delete process.env.ENCRYPTION_KEY;
  });

  it('should use decryptAny for auto-detection', async () => {
    vi.resetModules();
    process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    
    vi.doMock('../../src/config/logger.js', () => ({
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));

    const { encryptionService: enabledService } = await import('../../src/services/encryption.service.js');
    
    const plaintext = 'auto detect this';
    const encRandom = enabledService.encrypt(plaintext);
    const encDeterministic = enabledService.encryptDeterministic(plaintext);
    
    expect(enabledService.decryptAny(encRandom)).toBe(plaintext);
    expect(enabledService.decryptAny(encDeterministic)).toBe(plaintext);
    expect(enabledService.decryptAny('not encrypted')).toBe('not encrypted');
    
    delete process.env.ENCRYPTION_KEY;
  });
});
