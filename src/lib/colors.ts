/**
 * Brand colors for use in JavaScript contexts (charts, canvas, SVG)
 * These match the brand colors defined in tailwind.config.js
 * 
 * For Tailwind classes, use: bg-brand-800, text-brand-500, etc.
 * For JS contexts (charts, SVG, canvas), import from here.
 */
export const brandColors = {
  50: '#FBE9E7',
  100: '#FFCCBC',
  200: '#FFAB91',
  300: '#FF8A65',
  400: '#FF7043',
  500: '#FF5722',
  600: '#F4511E',
  700: '#E64A19',
  800: '#D84315',  // Primary brand color
  900: '#BF360C',
  DEFAULT: '#D84315',
} as const;

// Convenience exports for common use cases
export const BRAND_PRIMARY = brandColors[800];
export const BRAND_DARK = brandColors[900];
export const BRAND_LIGHT = brandColors[500];
