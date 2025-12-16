import { describe, it, expect } from 'vitest';
import { escapeHtml, renderEmailLayout } from '../../src/services/emailTemplates.js';

describe('Email Templates Service', () => {
  describe('escapeHtml', () => {
    it('should escape ampersand', () => {
      expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('should escape less than', () => {
      expect(escapeHtml('a < b')).toBe('a &lt; b');
    });

    it('should escape greater than', () => {
      expect(escapeHtml('a > b')).toBe('a &gt; b');
    });

    it('should escape double quotes', () => {
      expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("'single'")).toBe('&#39;single&#39;');
    });

    it('should escape all special characters together', () => {
      expect(escapeHtml('<script>alert("test")</script>'))
        .toBe('&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;');
    });

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle string with no special characters', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('renderEmailLayout', () => {
    it('should render basic email layout', () => {
      const html = renderEmailLayout({
        title: 'Test Email',
        bodyHtml: '<p>Hello</p>',
      });

      expect(html).toContain('<!doctype html>');
      expect(html).toContain('Test Email');
      expect(html).toContain('<p>Hello</p>');
    });

    it('should include heading when provided', () => {
      const html = renderEmailLayout({
        title: 'Test',
        heading: 'Welcome',
        bodyHtml: '<p>Content</p>',
      });

      expect(html).toContain('Welcome');
    });

    it('should include subheading when provided', () => {
      const html = renderEmailLayout({
        title: 'Test',
        heading: 'Main',
        subheading: 'Sub heading text',
        bodyHtml: '<p>Content</p>',
      });

      expect(html).toContain('Sub heading text');
    });

    it('should include previewText when provided', () => {
      const html = renderEmailLayout({
        title: 'Test',
        previewText: 'This is a preview',
        bodyHtml: '<p>Content</p>',
      });

      expect(html).toContain('This is a preview');
    });

    it('should include CTA button when ctaText and ctaUrl provided', () => {
      const html = renderEmailLayout({
        title: 'Test',
        bodyHtml: '<p>Content</p>',
        ctaText: 'Click Here',
        ctaUrl: 'https://example.com/action',
      });

      expect(html).toContain('Click Here');
      expect(html).toContain('https://example.com/action');
    });

    it('should not include CTA button when only ctaText provided', () => {
      const html = renderEmailLayout({
        title: 'Test',
        bodyHtml: '<p>Content</p>',
        ctaText: 'Click Here',
      });

      // CTA should not appear without URL
      expect(html).not.toContain('Click Here');
    });

    it('should include footer note when provided', () => {
      const html = renderEmailLayout({
        title: 'Test',
        bodyHtml: '<p>Content</p>',
        footerNote: 'Custom footer message',
      });

      expect(html).toContain('Custom footer message');
    });

    it('should escape special characters in title', () => {
      const html = renderEmailLayout({
        title: 'Test <script>',
        bodyHtml: '<p>Content</p>',
      });

      expect(html).toContain('Test &lt;script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('should include copyright year', () => {
      const html = renderEmailLayout({
        title: 'Test',
        bodyHtml: '<p>Content</p>',
      });

      const currentYear = new Date().getFullYear();
      expect(html).toContain(`© ${currentYear}`);
    });

    it('should include SpannerWork branding', () => {
      const html = renderEmailLayout({
        title: 'Test',
        bodyHtml: '<p>Content</p>',
      });

      expect(html).toContain('SpannerWork');
    });

    it('should include support email link', () => {
      const html = renderEmailLayout({
        title: 'Test',
        bodyHtml: '<p>Content</p>',
      });

      expect(html).toContain('support@spannerwork.co.uk');
    });
  });
});
