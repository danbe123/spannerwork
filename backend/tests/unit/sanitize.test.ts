import { describe, it, expect } from 'vitest';
import {
  sanitizeUserContent,
  sanitizeRichContent,
  sanitizeSearchQuery,
  sanitizeText,
  sanitizeUsername,
  sanitizeEmail,
  sanitizeId,
  sanitizePagination,
  escapeHtml,
  stripHtml,
} from '../../src/utils/sanitize.js';

describe('Sanitize Utilities', () => {
  describe('sanitizeUserContent', () => {
    it('should return empty string for null/undefined', () => {
      expect(sanitizeUserContent(null as any)).toBe('');
      expect(sanitizeUserContent(undefined as any)).toBe('');
    });

    it('should escape or strip HTML tags', () => {
      // sanitize-html escapes tags when using recursiveEscape mode
      const result = sanitizeUserContent('<script>alert("xss")</script>hello');
      expect(result).not.toContain('<script>');
      // Tags are escaped, not stripped
      const boldResult = sanitizeUserContent('<b>bold</b> text');
      expect(boldResult).not.toContain('<b>');
    });

    it('should remove null bytes', () => {
      expect(sanitizeUserContent('hello\x00world')).toBe('helloworld');
    });

    it('should normalize whitespace', () => {
      expect(sanitizeUserContent('hello    world')).toBe('hello world');
    });

    it('should limit excessive newlines', () => {
      expect(sanitizeUserContent('a\n\n\n\n\nb')).toBe('a\n\nb');
    });

    it('should respect maxLength', () => {
      expect(sanitizeUserContent('a'.repeat(100), 10)).toBe('a'.repeat(10));
    });
  });

  describe('sanitizeRichContent', () => {
    it('should return empty string for invalid input', () => {
      expect(sanitizeRichContent(null as any)).toBe('');
      expect(sanitizeRichContent(undefined as any)).toBe('');
    });

    it('should allow basic formatting tags', () => {
      expect(sanitizeRichContent('<b>bold</b>')).toContain('<b>');
      expect(sanitizeRichContent('<strong>strong</strong>')).toContain('<strong>');
      expect(sanitizeRichContent('<em>italic</em>')).toContain('<em>');
    });

    it('should strip dangerous tags', () => {
      expect(sanitizeRichContent('<script>evil</script>')).not.toContain('<script>');
    });

    it('should add rel attribute to links', () => {
      const result = sanitizeRichContent('<a href="https://example.com">link</a>');
      expect(result).toContain('rel="noopener noreferrer"');
    });
  });

  describe('sanitizeSearchQuery', () => {
    it('should return empty string for invalid input', () => {
      expect(sanitizeSearchQuery(null as any)).toBe('');
      expect(sanitizeSearchQuery(undefined as any)).toBe('');
    });

    it('should remove control characters', () => {
      expect(sanitizeSearchQuery('hello\x01world')).toBe('helloworld');
    });

    it('should trim whitespace', () => {
      expect(sanitizeSearchQuery('  hello  ')).toBe('hello');
    });

    it('should collapse multiple spaces', () => {
      expect(sanitizeSearchQuery('hello   world')).toBe('hello world');
    });

    it('should limit length', () => {
      expect(sanitizeSearchQuery('a'.repeat(200), 50)).toBe('a'.repeat(50));
    });
  });

  describe('sanitizeText', () => {
    it('should return empty string for invalid input', () => {
      expect(sanitizeText(null as any)).toBe('');
    });

    it('should remove null bytes', () => {
      expect(sanitizeText('hello\x00world')).toBe('helloworld');
    });

    it('should preserve newlines and tabs', () => {
      expect(sanitizeText('hello\nworld\ttab')).toBe('hello\nworld\ttab');
    });

    it('should limit length', () => {
      expect(sanitizeText('a'.repeat(6000), 100)).toBe('a'.repeat(100));
    });
  });

  describe('sanitizeUsername', () => {
    it('should return empty string for invalid input', () => {
      expect(sanitizeUsername(null as any)).toBe('');
    });

    it('should only allow alphanumeric and underscores', () => {
      expect(sanitizeUsername('user@123!')).toBe('user123');
      expect(sanitizeUsername('user_name')).toBe('user_name');
    });

    it('should convert to lowercase', () => {
      expect(sanitizeUsername('UserName')).toBe('username');
    });

    it('should limit to 30 characters', () => {
      expect(sanitizeUsername('a'.repeat(50))).toBe('a'.repeat(30));
    });
  });

  describe('sanitizeEmail', () => {
    it('should return empty string for invalid input', () => {
      expect(sanitizeEmail(null as any)).toBe('');
    });

    it('should trim and lowercase', () => {
      expect(sanitizeEmail('  Test@Example.COM  ')).toBe('test@example.com');
    });

    it('should limit to 254 characters', () => {
      const longEmail = 'a'.repeat(300) + '@test.com';
      expect(sanitizeEmail(longEmail).length).toBeLessThanOrEqual(254);
    });
  });

  describe('sanitizeId', () => {
    it('should return null for invalid input', () => {
      expect(sanitizeId(null as any)).toBe(null);
      expect(sanitizeId(undefined as any)).toBe(null);
      expect(sanitizeId('')).toBe(null);
    });

    it('should allow alphanumeric, hyphens, and underscores', () => {
      expect(sanitizeId('abc-123_def')).toBe('abc-123_def');
    });

    it('should remove special characters', () => {
      expect(sanitizeId('abc@123!def')).toBe('abc123def');
    });

    it('should limit to 50 characters', () => {
      expect(sanitizeId('a'.repeat(100))?.length).toBe(50);
    });
  });

  describe('sanitizePagination', () => {
    it('should use defaults for invalid input', () => {
      expect(sanitizePagination(undefined, undefined)).toEqual({ page: 1, limit: 20 });
      expect(sanitizePagination('invalid', 'invalid')).toEqual({ page: 1, limit: 20 });
    });

    it('should parse string values', () => {
      expect(sanitizePagination('2', '30')).toEqual({ page: 2, limit: 30 });
    });

    it('should handle numeric values', () => {
      expect(sanitizePagination(3, 50)).toEqual({ page: 3, limit: 50 });
    });

    it('should cap limit at maxLimit', () => {
      expect(sanitizePagination(1, 200, 100)).toEqual({ page: 1, limit: 100 });
    });

    it('should enforce minimum page 1', () => {
      expect(sanitizePagination(-1, 20)).toEqual({ page: 1, limit: 20 });
      expect(sanitizePagination(0, 20)).toEqual({ page: 1, limit: 20 });
    });
  });

  describe('escapeHtml', () => {
    it('should return empty string for invalid input', () => {
      expect(escapeHtml(null as any)).toBe('');
    });

    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(escapeHtml('a & b')).toBe('a &amp; b');
      expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
      expect(escapeHtml("'single'")).toBe('&#39;single&#39;');
    });
  });

  describe('stripHtml', () => {
    it('should return empty string for invalid input', () => {
      expect(stripHtml(null as any)).toBe('');
    });

    it('should remove HTML tags', () => {
      expect(stripHtml('<div>hello</div>')).toBe('hello');
      expect(stripHtml('<p><b>bold</b> text</p>')).toBe('bold text');
    });
  });
});
