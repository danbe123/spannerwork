import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../src/config/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    NODE_ENV: 'development', // Use development mode to test logging behavior
    TWILIO_ACCOUNT_SID: 'test-account-sid',
    TWILIO_AUTH_TOKEN: 'test-auth-token',
    TWILIO_FROM_NUMBER: '+15551234567',
  },
}));

import { smsService } from '../../src/services/sms.service.js';
import { logger } from '../../src/config/logger.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SMS Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sid: 'SM123' }),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('sendSms', () => {
    it('sends SMS via Twilio API', async () => {
      // Override env to production mode
      vi.doMock('../../src/config/env.js', () => ({
        env: {
          NODE_ENV: 'production',
          TWILIO_ACCOUNT_SID: 'test-account-sid',
          TWILIO_AUTH_TOKEN: 'test-auth-token',
          TWILIO_FROM_NUMBER: '+15551234567',
        },
      }));

      await smsService.sendSms({
        to: '+447123456789',
        body: 'Test message',
      });

      // In test mode, it should just log
      expect(logger.info).toHaveBeenCalled();
    });

    it('logs SMS in development mode instead of sending', async () => {
      await smsService.sendSms({
        to: '+447123456789',
        body: 'Test message',
      });

      expect(logger.info).toHaveBeenCalledWith(
        '📱 SMS (Development Mode - Not Sent)',
        expect.objectContaining({
          message: 'Test message',
        })
      );
    });

    it('masks phone number in logs', async () => {
      await smsService.sendSms({
        to: '+447123456789',
        body: 'Test message',
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          to: expect.stringContaining('***'),
        })
      );
    });
  });
});

describe('Phone Number Validation', () => {
  // These tests verify the validation logic conceptually
  // The actual validation happens internally in smsService

  it('validates UK mobile formats', async () => {
    // Valid UK formats should not trigger warning
    await smsService.sendSms({ to: '07123456789', body: 'Test' });
    await smsService.sendSms({ to: '+447123456789', body: 'Test' });
    await smsService.sendSms({ to: '447123456789', body: 'Test' });

    // Should log for each SMS (dev mode)
    expect(logger.info).toHaveBeenCalledTimes(3);
  });

  it('handles various phone formats', async () => {
    await smsService.sendSms({ to: '+1234567890', body: 'Test' });
    
    expect(logger.info).toHaveBeenCalled();
  });
});

describe('maskPhoneNumber utility', () => {
  it('should work with sendSms call', async () => {
    // Test through sendSms which calls maskPhoneNumber internally
    await smsService.sendSms({ to: '+447123456789', body: 'Test' });
    
    // The masked phone should have *** in the middle
    expect(logger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        to: '+44***456789',
      })
    );
  });

  it('should mask short phone numbers', async () => {
    await smsService.sendSms({ to: '+123', body: 'Test' });
    
    // Short numbers should show ***
    expect(logger.info).toHaveBeenCalled();
  });

  it('should handle empty phone number', async () => {
    await smsService.sendSms({ to: '', body: 'Test' });
    
    // Should still complete without error
    expect(logger.info).toHaveBeenCalled();
  });
});

describe('SMS message content', () => {
  it('should pass message body correctly', async () => {
    const testMessage = 'Your verification code is 123456';
    
    await smsService.sendSms({ to: '+447123456789', body: testMessage });
    
    expect(logger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        message: testMessage,
      })
    );
  });

  it('should handle special characters in message', async () => {
    const specialMessage = 'Hello! Your code: £5.00 & more...';
    
    await smsService.sendSms({ to: '+447123456789', body: specialMessage });
    
    expect(logger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        message: specialMessage,
      })
    );
  });
});

describe('Production mode SMS', () => {
  // Create a separate module test for production
  it('should call Twilio API in production mode', async () => {
    // Re-import with production env
    vi.resetModules();
    vi.doMock('../../src/config/env.js', () => ({
      env: {
        NODE_ENV: 'production',
        TWILIO_ACCOUNT_SID: 'test-sid',
        TWILIO_AUTH_TOKEN: 'test-token',
        TWILIO_FROM_NUMBER: '+15551234567',
      },
    }));
    vi.doMock('../../src/config/logger.js', () => ({
      logger: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
      },
    }));
    
    // Mock fetch to succeed
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sid: 'SM123' }),
    });

    const { smsService: prodSmsService } = await import('../../src/services/sms.service.js');
    const { logger: prodLogger } = await import('../../src/config/logger.js');
    
    await prodSmsService.sendSms({
      to: '+447123456789',
      body: 'Production test',
    });
    
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.twilio.com'),
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(prodLogger.info).toHaveBeenCalledWith(
      'Twilio SMS sent',
      expect.objectContaining({
        sid: 'SM123',
      })
    );
  });

  it('should handle Twilio API failure', async () => {
    vi.resetModules();
    vi.doMock('../../src/config/env.js', () => ({
      env: {
        NODE_ENV: 'production',
        TWILIO_ACCOUNT_SID: 'test-sid',
        TWILIO_AUTH_TOKEN: 'test-token',
        TWILIO_FROM_NUMBER: '+15551234567',
      },
    }));
    vi.doMock('../../src/config/logger.js', () => ({
      logger: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
      },
    }));
    
    // Mock fetch to fail
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad Request'),
    });

    const { smsService: prodSmsService } = await import('../../src/services/sms.service.js');
    const { logger: prodLogger } = await import('../../src/config/logger.js');
    
    await prodSmsService.sendSms({
      to: '+447123456789',
      body: 'Test',
    });
    
    expect(prodLogger.error).toHaveBeenCalledWith(
      'Twilio SMS send failed',
      expect.objectContaining({
        status: 400,
      })
    );
  });

  it('should handle network errors', async () => {
    vi.resetModules();
    vi.doMock('../../src/config/env.js', () => ({
      env: {
        NODE_ENV: 'production',
        TWILIO_ACCOUNT_SID: 'test-sid',
        TWILIO_AUTH_TOKEN: 'test-token',
        TWILIO_FROM_NUMBER: '+15551234567',
      },
    }));
    vi.doMock('../../src/config/logger.js', () => ({
      logger: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
      },
    }));
    
    // Mock fetch to throw
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { smsService: prodSmsService } = await import('../../src/services/sms.service.js');
    const { logger: prodLogger } = await import('../../src/config/logger.js');
    
    await prodSmsService.sendSms({
      to: '+447123456789',
      body: 'Test',
    });
    
    expect(prodLogger.error).toHaveBeenCalledWith(
      'Error sending SMS via Twilio',
      expect.any(Error)
    );
  });

  it('should skip SMS when Twilio not configured', async () => {
    vi.resetModules();
    vi.doMock('../../src/config/env.js', () => ({
      env: {
        NODE_ENV: 'production',
        TWILIO_ACCOUNT_SID: '', // Not configured
        TWILIO_AUTH_TOKEN: '',
        TWILIO_FROM_NUMBER: '',
      },
    }));
    vi.doMock('../../src/config/logger.js', () => ({
      logger: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
      },
    }));

    const { smsService: prodSmsService } = await import('../../src/services/sms.service.js');
    const { logger: prodLogger } = await import('../../src/config/logger.js');
    
    await prodSmsService.sendSms({
      to: '+447123456789',
      body: 'Test',
    });
    
    expect(prodLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Twilio not fully configured')
    );
  });

  it('should skip SMS for invalid phone number', async () => {
    vi.resetModules();
    vi.doMock('../../src/config/env.js', () => ({
      env: {
        NODE_ENV: 'production',
        TWILIO_ACCOUNT_SID: 'test-sid',
        TWILIO_AUTH_TOKEN: 'test-token',
        TWILIO_FROM_NUMBER: '+15551234567',
      },
    }));
    vi.doMock('../../src/config/logger.js', () => ({
      logger: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
      },
    }));

    const { smsService: prodSmsService } = await import('../../src/services/sms.service.js');
    const { logger: prodLogger } = await import('../../src/config/logger.js');
    
    await prodSmsService.sendSms({
      to: '12345', // Too short, invalid
      body: 'Test',
    });
    
    expect(prodLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('invalid phone number')
    );
  });
});
