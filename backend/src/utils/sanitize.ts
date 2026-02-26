/**
 * Input Sanitization Utilities
 * 
 * Provides functions to sanitize user input to prevent
 * injection attacks and ensure data quality.
 */

import sanitizeHtml from 'sanitize-html';

export function stripControlCharacters(input: string, options?: { allowNewlines?: boolean; allowTabs?: boolean }): string {
  const allowNewlines = options?.allowNewlines ?? false;
  const allowTabs = options?.allowTabs ?? false;

  let output = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const code = input.charCodeAt(i);

    if (allowNewlines && (ch === '\n' || ch === '\r')) {
      output += ch;
      continue;
    }

    if (allowTabs && ch === '\t') {
      output += ch;
      continue;
    }

    if (code >= 32 && code !== 127) {
      output += ch;
    }
  }

  return output;
}

/**
 * Sanitize user-generated content to prevent stored XSS attacks.
 * Strips all HTML tags and dangerous content while preserving text.
 * Use this for messages, reviews, descriptions, and other user content.
 */
export function sanitizeUserContent(input: string, maxLength = 5000): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Strip ALL HTML tags - we don't allow any HTML in user content
  const cleaned = sanitizeHtml(input, {
    allowedTags: [], // No HTML tags allowed
    allowedAttributes: {}, // No attributes allowed
    disallowedTagsMode: 'recursiveEscape', // Escape any remaining tags
  });

  return cleaned
    // Remove null bytes
    .replace(/\0/g, '')
    // Normalize whitespace (but preserve newlines for formatting)
    .replace(/[^\S\n]+/g, ' ')
    // Remove excessive newlines (max 2 consecutive)
    .replace(/\n{3,}/g, '\n\n')
    // Trim
    .trim()
    // Limit length
    .slice(0, maxLength);
}

/**
 * Sanitize content that may include basic formatting (bold, italic, links)
 * More permissive - use only when rich text is expected
 */
export function sanitizeRichContent(input: string, maxLength = 10000): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const cleaned = sanitizeHtml(input, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    allowedAttributes: {
      'a': ['href', 'title', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      'a': (tagName: string, attribs: Record<string, string>) => {
        // Force rel="noopener noreferrer" on all links
        return {
          tagName,
          attribs: {
            ...attribs,
            rel: 'noopener noreferrer',
            target: '_blank',
          },
        };
      },
    },
  });

  return cleaned.trim().slice(0, maxLength);
}

/**
 * Sanitize search query string
 * - Removes control characters
 * - Limits length
 * - Removes potential SQL/NoSQL injection patterns
 */
export function sanitizeSearchQuery(input: string, maxLength = 100): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return stripControlCharacters(input)
    // Remove null bytes
    .replace(/\0/g, '')
    // Trim whitespace
    .trim()
    // Limit length
    .slice(0, maxLength)
    // Remove multiple consecutive spaces
    .replace(/\s+/g, ' ');
}

/**
 * Sanitize string for database text fields
 * More permissive than search query but still safe
 */
export function sanitizeText(input: string, maxLength = 5000): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return stripControlCharacters(input, { allowNewlines: true, allowTabs: true })
    // Remove null bytes
    .replace(/\0/g, '')
    // Trim
    .trim()
    // Limit length
    .slice(0, maxLength);
}

/**
 * Sanitize username
 */
export function sanitizeUsername(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    // Only allow alphanumeric and underscores
    .replace(/[^a-zA-Z0-9_]/g, '')
    // Limit length
    .slice(0, 30)
    .toLowerCase();
}

/**
 * Sanitize email for search/display
 */
export function sanitizeEmail(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .toLowerCase()
    .slice(0, 254); // Max email length per RFC
}

/**
 * Sanitize numeric ID
 */
export function sanitizeId(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // Allow alphanumeric, hyphens, underscores (for cuid/uuid)
  const sanitized = input.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
  
  return sanitized.length > 0 ? sanitized : null;
}

/**
 * Sanitize pagination parameters
 */
export function sanitizePagination(
  page: string | number | undefined,
  limit: string | number | undefined,
  maxLimit = 100
): { page: number; limit: number } {
  let parsedPage = typeof page === 'string' ? parseInt(page, 10) : (page || 1);
  let parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : (limit || 20);

  // Ensure valid ranges
  if (isNaN(parsedPage) || parsedPage < 1) parsedPage = 1;
  if (isNaN(parsedLimit) || parsedLimit < 1) parsedLimit = 20;
  if (parsedLimit > maxLimit) parsedLimit = maxLimit;

  return { page: parsedPage, limit: parsedLimit };
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return input.replace(/[&<>"']/g, (char) => htmlEntities[char]);
}

/**
 * Strip HTML tags from input
 */
export function stripHtml(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input.replace(/<[^>]*>/g, '');
}

export default {
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
};
