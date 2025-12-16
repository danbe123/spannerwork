/**
 * Shared utilities for SpannerWork
 * Platform-agnostic helpers for web and mobile
 */

import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

// ============================================================================
// CURRENCY FORMATTING (UK - Pounds Sterling)
// ============================================================================

/**
 * Format pence to pounds string (e.g., 1500 -> "£15.00")
 */
export function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

/**
 * Format pence to pounds without decimals (e.g., 1500 -> "£15")
 */
export function formatPenceShort(pence: number): string {
  const pounds = pence / 100;
  return pounds % 1 === 0 ? `£${pounds.toFixed(0)}` : `£${pounds.toFixed(2)}`;
}

/**
 * Convert pounds to pence (e.g., 15.50 -> 1550)
 */
export function poundsToPence(pounds: number): number {
  return Math.round(pounds * 100);
}

/**
 * Convert pence to pounds (e.g., 1550 -> 15.50)
 */
export function penceToPounds(pence: number): number {
  return pence / 100;
}

/**
 * Format currency with compact notation for large amounts
 * e.g., 150000 pence -> "£1.5k"
 */
export function formatPenceCompact(pence: number): string {
  const pounds = pence / 100;
  if (pounds >= 1000000) {
    return `£${(pounds / 1000000).toFixed(1)}m`;
  }
  if (pounds >= 1000) {
    return `£${(pounds / 1000).toFixed(1)}k`;
  }
  return formatPenceShort(pence);
}

// ============================================================================
// DATE FORMATTING
// ============================================================================

/**
 * Format ISO date string to readable format
 */
export function formatDate(dateString: string | Date, formatStr: string = 'PPP'): string {
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
  if (!isValid(date)) return 'Invalid date';
  return format(date, formatStr);
}

/**
 * Format date as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
  if (!isValid(date)) return 'Invalid date';
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Format date for display in lists (e.g., "Mon, 15 Jan")
 */
export function formatShortDate(dateString: string | Date): string {
  return formatDate(dateString, 'EEE, d MMM');
}

/**
 * Format date with time (e.g., "15 Jan 2024 at 14:30")
 */
export function formatDateTime(dateString: string | Date): string {
  return formatDate(dateString, "d MMM yyyy 'at' HH:mm");
}

/**
 * Format date range (e.g., "15 Jan - 20 Jan 2024")
 */
export function formatDateRange(startDate: string | Date, endDate: string | Date): string {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
  
  if (!isValid(start) || !isValid(end)) return 'Invalid date range';
  
  // Same month and year
  if (format(start, 'MMM yyyy') === format(end, 'MMM yyyy')) {
    return `${format(start, 'd')} - ${format(end, 'd MMM yyyy')}`;
  }
  
  // Same year
  if (format(start, 'yyyy') === format(end, 'yyyy')) {
    return `${format(start, 'd MMM')} - ${format(end, 'd MMM yyyy')}`;
  }
  
  return `${format(start, 'd MMM yyyy')} - ${format(end, 'd MMM yyyy')}`;
}

// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter of string
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Convert snake_case or SCREAMING_SNAKE_CASE to Title Case
 */
export function snakeToTitle(text: string): string {
  return text
    .toLowerCase()
    .split('_')
    .map(word => capitalize(word))
    .join(' ');
}

/**
 * Slugify a string for URLs
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate initials from name (e.g., "John Doe" -> "JD")
 */
export function getInitials(name: string | null | undefined, fallback: string = '?'): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ============================================================================
// POSTCODE UTILITIES (UK)
// ============================================================================

/**
 * Format UK postcode (e.g., "sw1a1aa" -> "SW1A 1AA")
 */
export function formatPostcode(postcode: string): string {
  const cleaned = postcode.replace(/\s+/g, '').toUpperCase();
  if (cleaned.length < 5 || cleaned.length > 7) return cleaned;
  
  // Insert space before last 3 characters
  return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`;
}

/**
 * Extract outcode from postcode (e.g., "SW1A 1AA" -> "SW1A")
 */
export function getOutcode(postcode: string): string {
  const formatted = formatPostcode(postcode);
  return formatted.split(' ')[0];
}

/**
 * Extract area from postcode (e.g., "SW1A 1AA" -> "SW")
 */
export function getPostcodeArea(postcode: string): string {
  const match = postcode.match(/^([A-Z]{1,2})/i);
  return match ? match[1].toUpperCase() : '';
}

/**
 * Validate UK postcode format
 */
export function isValidPostcode(postcode: string): boolean {
  const regex = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}$/i;
  return regex.test(postcode.trim());
}

// ============================================================================
// RATING UTILITIES
// ============================================================================

/**
 * Format rating for display (e.g., 4.5 -> "4.5", 4.0 -> "4.0")
 */
export function formatRating(rating: number | null | undefined): string {
  if (rating === null || rating === undefined) return 'N/A';
  return rating.toFixed(1);
}

/**
 * Get rating color class based on value
 */
export function getRatingColor(rating: number | null | undefined): string {
  if (rating === null || rating === undefined) return 'text-gray-400';
  if (rating >= 4.5) return 'text-green-600';
  if (rating >= 4.0) return 'text-green-500';
  if (rating >= 3.0) return 'text-yellow-500';
  if (rating >= 2.0) return 'text-orange-500';
  return 'text-red-500';
}

// ============================================================================
// STATUS UTILITIES
// ============================================================================

/**
 * Get display label for transaction status
 */
export function getTransactionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: 'Pending',
    CONFIRMED: 'Confirmed',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };
  return labels[status] || status;
}

/**
 * Get display label for request status
 */
export function getRequestStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ACTIVE: 'Active',
    FULFILLED: 'Fulfilled',
    EXPIRED: 'Expired',
    CANCELLED: 'Cancelled',
  };
  return labels[status] || status;
}

/**
 * Get display label for urgency
 */
export function getUrgencyLabel(urgency: string): string {
  const labels: Record<string, string> = {
    ASAP: 'ASAP',
    TODAY: 'Today',
    THIS_WEEKEND: 'This Weekend',
    FLEXIBLE: 'Flexible',
  };
  return labels[urgency] || urgency;
}

/**
 * Get display label for rate type
 */
export function getRateTypeLabel(rateType: string): string {
  const labels: Record<string, string> = {
    FIXED: 'Fixed',
    HOURLY: 'Per Hour',
    DAILY: 'Per Day',
  };
  return labels[rateType] || rateType;
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Check if email is valid
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Check if UK phone number is valid
 */
export function isValidUKPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s+/g, '');
  const regex = /^(\+44|0)7\d{9}$/;
  return regex.test(cleaned);
}

/**
 * Format UK phone number
 */
export function formatUKPhone(phone: string): string {
  const cleaned = phone.replace(/\s+/g, '');
  if (cleaned.startsWith('+44')) {
    const local = cleaned.slice(3);
    return `+44 ${local.slice(0, 4)} ${local.slice(4)}`;
  }
  if (cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  return phone;
}

// ============================================================================
// MISC UTILITIES
// ============================================================================

/**
 * Calculate distance between two lat/lng points in miles
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Format distance for display
 */
export function formatDistance(miles: number): string {
  if (miles < 0.1) return 'Nearby';
  if (miles < 1) return `${(miles * 1760).toFixed(0)} yards`;
  if (miles < 10) return `${miles.toFixed(1)} miles`;
  return `${Math.round(miles)} miles`;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Generate a random ID
 */
export function generateId(length: number = 8): string {
  return Math.random().toString(36).substring(2, 2 + length);
}
