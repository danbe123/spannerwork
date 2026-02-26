/**
 * Trusted Types Policy Setup
 *
 * This creates a default Trusted Types policy that sanitizes HTML using DOMPurify.
 * It protects against DOM-based XSS by requiring all innerHTML/outerHTML usage
 * to go through this sanitization policy.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API
 */

import DOMPurify from 'dompurify';

// Extend Window interface for Trusted Types
declare global {
  interface Window {
    trustedTypes?: {
      createPolicy: (
        name: string,
        policy: {
          createHTML?: (input: string) => string;
          createScript?: (input: string) => string;
          createScriptURL?: (input: string) => string;
        }
      ) => TrustedTypePolicy;
      defaultPolicy?: TrustedTypePolicy;
    };
  }

  interface TrustedTypePolicy {
    createHTML: (input: string) => TrustedHTML;
    createScript: (input: string) => TrustedScript;
    createScriptURL: (input: string) => TrustedScriptURL;
  }

  // Trusted Types primitives
  interface TrustedHTML {
    toString(): string;
  }
  interface TrustedScript {
    toString(): string;
  }
  interface TrustedScriptURL {
    toString(): string;
  }
}

/**
 * Initialize Trusted Types policies
 * Must be called before any DOM manipulation occurs
 */
export function initTrustedTypes(): void {
  // Only set up if browser supports Trusted Types
  if (typeof window === 'undefined' || !window.trustedTypes) {
    return;
  }

  try {
    // Create the 'default' policy - this is automatically used for unprotected sinks
    // When code uses innerHTML without explicitly using a policy, this default is applied
    window.trustedTypes.createPolicy('default', {
      createHTML: (input: string): string => {
        // Sanitize HTML using DOMPurify
        // This removes XSS vectors while preserving safe HTML
        return DOMPurify.sanitize(input, {
          // Allow safe HTML elements and attributes
          USE_PROFILES: { html: true },
          // Allow data URIs for images (needed for inline images)
          ADD_DATA_URI_TAGS: ['img'],
          // Allow target="_blank" on links
          ADD_ATTR: ['target'],
        });
      },
      createScript: (input: string): string => {
        // Allow JSON-LD structured data (used by SEO component)
        // JSON-LD is safe as it's data, not executable code
        try {
          const trimmed = input.trim();
          if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            JSON.parse(trimmed); // Validate it's valid JSON
            return input; // Allow JSON-LD
          }
        } catch {
          // Not valid JSON, continue to block
        }

        // Block other script content
        if (import.meta.env.DEV) {
          console.warn('[Trusted Types] Blocked script content:', input.substring(0, 100));
        }
        return '';
      },
      createScriptURL: (input: string): string => {
        // Only allow same-origin script URLs
        try {
          const url = new URL(input, window.location.origin);
          if (url.origin === window.location.origin) {
            return input;
          }
          if (import.meta.env.DEV) {
            console.warn('[Trusted Types] Blocked external script URL:', input);
          }
          return '';
        } catch {
          if (import.meta.env.DEV) {
            console.warn('[Trusted Types] Invalid script URL:', input);
          }
          return '';
        }
      },
    });

  } catch (error) {
    if (import.meta.env.DEV && error instanceof Error && !error.message.includes('already exists')) {
      console.error('[Trusted Types] Failed to create policy:', error);
    }
  }
}

// Auto-initialize when module is imported
initTrustedTypes();
