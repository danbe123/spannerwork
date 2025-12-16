import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mocks
const mocks = vi.hoisted(() => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  env: {
    AWS_ACCESS_KEY_ID: 'test-key-id',
    AWS_SECRET_ACCESS_KEY: 'test-secret',
    AWS_REGION: 'us-east-1',
    AWS_ENDPOINT: undefined,
    S3_BUCKET_PUBLIC: 'test-bucket',
  },
  mockS3Client: {
    send: vi.fn(),
    destroy: vi.fn(),
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: mocks.logger,
}));

vi.mock('../../src/config/env.js', () => ({
  env: mocks.env,
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => mocks.mockS3Client),
  HeadBucketCommand: vi.fn(),
}));

import { isS3Configured, getS3Client, checkS3Health, resetS3Client } from '../../src/config/s3.js';

describe('S3 Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetS3Client();
  });

  afterEach(() => {
    resetS3Client();
  });

  describe('isS3Configured', () => {
    it('should return true when all credentials are present', () => {
      expect(isS3Configured()).toBe(true);
    });

    it('should return false when AWS_ACCESS_KEY_ID is missing', () => {
      const originalKey = mocks.env.AWS_ACCESS_KEY_ID;
      mocks.env.AWS_ACCESS_KEY_ID = '';
      
      expect(isS3Configured()).toBe(false);
      
      mocks.env.AWS_ACCESS_KEY_ID = originalKey;
    });

    it('should return false when AWS_SECRET_ACCESS_KEY is missing', () => {
      const originalSecret = mocks.env.AWS_SECRET_ACCESS_KEY;
      mocks.env.AWS_SECRET_ACCESS_KEY = '';
      
      expect(isS3Configured()).toBe(false);
      
      mocks.env.AWS_SECRET_ACCESS_KEY = originalSecret;
    });

    it('should return false when S3_BUCKET_PUBLIC is missing', () => {
      const originalBucket = mocks.env.S3_BUCKET_PUBLIC;
      mocks.env.S3_BUCKET_PUBLIC = '';
      
      expect(isS3Configured()).toBe(false);
      
      mocks.env.S3_BUCKET_PUBLIC = originalBucket;
    });
  });

  describe('getS3Client', () => {
    it('should return S3Client when configured', () => {
      const client = getS3Client();
      
      expect(client).toBeDefined();
    });

    it('should return same instance on subsequent calls (singleton)', () => {
      const client1 = getS3Client();
      const client2 = getS3Client();
      
      expect(client1).toBe(client2);
    });

    it('should return null when not configured', () => {
      const originalKey = mocks.env.AWS_ACCESS_KEY_ID;
      mocks.env.AWS_ACCESS_KEY_ID = '';
      resetS3Client();
      
      const client = getS3Client();
      
      expect(client).toBeNull();
      
      mocks.env.AWS_ACCESS_KEY_ID = originalKey;
    });

    it('should log initialization', () => {
      resetS3Client();
      getS3Client();
      
      expect(mocks.logger.info).toHaveBeenCalledWith(
        'S3 client initialized',
        expect.any(Object)
      );
    });
  });

  describe('checkS3Health', () => {
    it('should return unconfigured when S3 is not configured', async () => {
      const originalKey = mocks.env.AWS_ACCESS_KEY_ID;
      mocks.env.AWS_ACCESS_KEY_ID = '';
      resetS3Client();
      
      const result = await checkS3Health();
      
      expect(result).toBe('unconfigured');
      
      mocks.env.AWS_ACCESS_KEY_ID = originalKey;
    });

    it('should return ok when bucket is accessible', async () => {
      mocks.mockS3Client.send.mockResolvedValue({});
      
      const result = await checkS3Health();
      
      expect(result).toBe('ok');
    });

    it('should return error when bucket is not accessible', async () => {
      mocks.mockS3Client.send.mockRejectedValue(new Error('Access Denied'));
      
      const result = await checkS3Health();
      
      expect(result).toBe('error');
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        'S3 health check failed',
        expect.any(Object)
      );
    });
  });

  describe('resetS3Client', () => {
    it('should destroy and reset client', () => {
      // Create client first
      getS3Client();
      
      // Reset it
      resetS3Client();
      
      // Getting client again should create new one
      expect(mocks.mockS3Client.destroy).toHaveBeenCalled();
    });

    it('should not throw when called without existing client', () => {
      expect(() => resetS3Client()).not.toThrow();
    });
  });
});
