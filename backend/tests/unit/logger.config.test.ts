import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs before imports
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
}));

// Mock env
vi.mock('../../src/config/env.js', () => ({
  default: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'debug',
  },
}));

import { requestContext, getCorrelationId, getContextUserId, logger } from '../../src/config/logger.js';

describe('Logger Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logger instance', () => {
    it('should export logger', () => {
      expect(logger).toBeDefined();
    });

    it('should have standard logging methods', () => {
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should log without throwing', () => {
      expect(() => logger.info('Test message')).not.toThrow();
      expect(() => logger.debug('Debug message')).not.toThrow();
      expect(() => logger.warn('Warning message')).not.toThrow();
    });
  });

  describe('requestContext', () => {
    it('should export AsyncLocalStorage instance', () => {
      expect(requestContext).toBeDefined();
      expect(typeof requestContext.run).toBe('function');
      expect(typeof requestContext.getStore).toBe('function');
    });

    it('should store and retrieve context', () => {
      const context = { requestId: 'test-123', userId: 'user-456' };
      
      requestContext.run(context, () => {
        const store = requestContext.getStore();
        expect(store).toEqual(context);
      });
    });

    it('should return undefined outside of context', () => {
      const store = requestContext.getStore();
      expect(store).toBeUndefined();
    });
  });

  describe('getCorrelationId', () => {
    it('should return undefined when no context', () => {
      const correlationId = getCorrelationId();
      expect(correlationId).toBeUndefined();
    });

    it('should return requestId when in context', () => {
      requestContext.run({ requestId: 'req-789' }, () => {
        const correlationId = getCorrelationId();
        expect(correlationId).toBe('req-789');
      });
    });
  });

  describe('getContextUserId', () => {
    it('should return undefined when no context', () => {
      const userId = getContextUserId();
      expect(userId).toBeUndefined();
    });

    it('should return userId when in context', () => {
      requestContext.run({ requestId: 'req-1', userId: 'user-123' }, () => {
        const userId = getContextUserId();
        expect(userId).toBe('user-123');
      });
    });

    it('should return undefined when userId not set in context', () => {
      requestContext.run({ requestId: 'req-1' }, () => {
        const userId = getContextUserId();
        expect(userId).toBeUndefined();
      });
    });
  });

  describe('logging with context', () => {
    it('should log with correlation ID in context', () => {
      requestContext.run({ requestId: 'corr-123' }, () => {
        expect(() => logger.info('Message with correlation')).not.toThrow();
      });
    });

    it('should log with user ID in context', () => {
      requestContext.run({ requestId: 'corr-123', userId: 'user-456' }, () => {
        expect(() => logger.info('Message with user')).not.toThrow();
      });
    });
  });

  describe('log levels', () => {
    it('should support info level', () => {
      expect(() => logger.info('Info message')).not.toThrow();
    });

    it('should support error level', () => {
      expect(() => logger.error('Error message')).not.toThrow();
    });

    it('should support warn level', () => {
      expect(() => logger.warn('Warning message')).not.toThrow();
    });

    it('should support debug level', () => {
      expect(() => logger.debug('Debug message')).not.toThrow();
    });

    it('should support metadata in logs', () => {
      expect(() => logger.info('Message with meta', { key: 'value' })).not.toThrow();
    });

    it('should support error objects', () => {
      const error = new Error('Test error');
      expect(() => logger.error('Error occurred', error)).not.toThrow();
    });
  });
});
