import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger before imports
vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { initTracing, shutdownTracing, getCurrentTraceId, createSpan } from '../../src/config/tracing.js';
import { logger } from '../../src/config/logger.js';

describe('Tracing Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initTracing', () => {
    it('should log disabled message when OTEL_ENABLED is not set', async () => {
      // Default env doesn't have OTEL_ENABLED=true
      await initTracing();

      expect(logger.info).toHaveBeenCalledWith(
        'OpenTelemetry tracing is disabled (set OTEL_ENABLED=true to enable)'
      );
    });

    it('should not throw when called', async () => {
      await expect(initTracing()).resolves.not.toThrow();
    });
  });

  describe('shutdownTracing', () => {
    it('should not throw when called without initialization', async () => {
      await expect(shutdownTracing()).resolves.not.toThrow();
    });

    it('should complete without error', async () => {
      await shutdownTracing();
      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('getCurrentTraceId', () => {
    it('should return undefined when OpenTelemetry is not available', () => {
      const traceId = getCurrentTraceId();

      expect(traceId).toBeUndefined();
    });
  });

  describe('createSpan', () => {
    it('should execute function when OTEL is disabled', async () => {
      let executed = false;
      
      await createSpan('test-span', async () => {
        executed = true;
      });

      expect(executed).toBe(true);
    });

    it('should pass through async errors', async () => {
      await expect(
        createSpan('error-span', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });

    it('should handle sync-like async functions', async () => {
      let result = 0;
      
      await createSpan('sync-span', async () => {
        result = 42;
      });

      expect(result).toBe(42);
    });
  });
});
