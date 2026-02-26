/**
 * Console Warning Suppressor
 *
 * This file MUST be imported before any other modules to suppress
 * warnings from third-party libraries that cannot be fixed.
 *
 * Currently suppresses:
 * - BullMQ eviction policy warnings (Cloudways Redis uses allkeys-lfu)
 */

const suppressedPatterns = [
  'eviction policy',
  'noeviction',
  'allkeys-lfu',
  'IMPORTANT! Eviction policy',
];

function shouldSuppress(args: unknown[]): boolean {
  const message = args.map(a => String(a)).join(' ').toLowerCase();
  return suppressedPatterns.some(p => message.includes(p.toLowerCase()));
}

// Store originals
const originalError = console.error.bind(console);
const originalWarn = console.warn.bind(console);

// Replace with filtered versions
console.error = (...args: unknown[]) => {
  if (!shouldSuppress(args)) {
    originalError(...args);
  }
};

console.warn = (...args: unknown[]) => {
  if (!shouldSuppress(args)) {
    originalWarn(...args);
  }
};

export {};
