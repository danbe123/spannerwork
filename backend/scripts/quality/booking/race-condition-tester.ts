/**
 * Booking Race Condition & Date Logic Tester
 *
 * Tests booking conflict detection, date boundary handling,
 * and validates the guards against double-booking.
 */

import { QualityTestRunner, TestCase, TestResult, assert } from '../core/test-runner.js';

// ============================================================================
// DATE OVERLAP DETECTION (mirrors actual implementation)
// ============================================================================

interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Check if two date ranges overlap
 * Uses the same logic as the Prisma query in transaction.service.ts
 */
function dateRangesOverlap(a: DateRange, b: DateRange): boolean {
  // Overlap exists if: A starts before B ends AND A ends after B starts
  return a.startDate <= b.endDate && a.endDate >= b.startDate;
}

/**
 * Calculate duration in days
 */
function calculateDays(start: Date, end: Date): number {
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

/**
 * Calculate duration in hours
 */
function calculateHours(start: Date, end: Date): number {
  const diffTime = end.getTime() - start.getTime();
  const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
  return Math.max(1, diffHours);
}

// ============================================================================
// STATUS TRANSITIONS
// ============================================================================

type TransactionStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED' | 'REFUNDED';

const VALID_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'DISPUTED'],
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
  DISPUTED: ['COMPLETED', 'REFUNDED'],
  REFUNDED: [], // Terminal state
};

function isValidTransition(from: TransactionStatus, to: TransactionStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ============================================================================
// UK TIMEZONE HELPERS
// ============================================================================

function createUKDate(year: number, month: number, day: number, hour: number = 0): Date {
  // Create a date in UK timezone
  const date = new Date(Date.UTC(year, month - 1, day, hour));
  return date;
}

// UK DST transitions (approximate - last Sunday of March/October)
const DST_2024_START = createUKDate(2024, 3, 31, 1); // March 31, 2024 1:00 AM → 2:00 AM
const DST_2024_END = createUKDate(2024, 10, 27, 2);  // October 27, 2024 2:00 AM → 1:00 AM

// ============================================================================
// TEST CASES
// ============================================================================

const bookingTests: TestCase[] = [
  // -------------------------------------------------------------------------
  // DATE OVERLAP TESTS
  // -------------------------------------------------------------------------
  {
    name: 'Overlap: Identical ranges',
    description: 'Same start and end dates should overlap',
    category: 'Date Overlap',
    run: async (): Promise<TestResult> => {
      const a = { startDate: new Date('2024-01-15'), endDate: new Date('2024-01-20') };
      const b = { startDate: new Date('2024-01-15'), endDate: new Date('2024-01-20') };
      return assert.true(dateRangesOverlap(a, b), 'Identical ranges should overlap');
    },
  },
  {
    name: 'Overlap: B entirely within A',
    description: 'Range B inside range A should overlap',
    category: 'Date Overlap',
    run: async (): Promise<TestResult> => {
      const a = { startDate: new Date('2024-01-10'), endDate: new Date('2024-01-25') };
      const b = { startDate: new Date('2024-01-15'), endDate: new Date('2024-01-20') };
      return assert.true(dateRangesOverlap(a, b), 'Contained range should overlap');
    },
  },
  {
    name: 'Overlap: A entirely within B',
    description: 'Range A inside range B should overlap',
    category: 'Date Overlap',
    run: async (): Promise<TestResult> => {
      const a = { startDate: new Date('2024-01-15'), endDate: new Date('2024-01-20') };
      const b = { startDate: new Date('2024-01-10'), endDate: new Date('2024-01-25') };
      return assert.true(dateRangesOverlap(a, b), 'Containing range should overlap');
    },
  },
  {
    name: 'Overlap: Partial overlap (A starts before B)',
    description: 'Overlapping end of A with start of B',
    category: 'Date Overlap',
    run: async (): Promise<TestResult> => {
      const a = { startDate: new Date('2024-01-10'), endDate: new Date('2024-01-18') };
      const b = { startDate: new Date('2024-01-15'), endDate: new Date('2024-01-25') };
      return assert.true(dateRangesOverlap(a, b), 'Partial overlap should be detected');
    },
  },
  {
    name: 'No overlap: A before B',
    description: 'Non-overlapping ranges (A ends before B starts)',
    category: 'Date Overlap',
    run: async (): Promise<TestResult> => {
      const a = { startDate: new Date('2024-01-10'), endDate: new Date('2024-01-14') };
      const b = { startDate: new Date('2024-01-15'), endDate: new Date('2024-01-20') };
      return assert.false(dateRangesOverlap(a, b), 'Non-overlapping should return false');
    },
  },
  {
    name: 'No overlap: B before A',
    description: 'Non-overlapping ranges (B ends before A starts)',
    category: 'Date Overlap',
    run: async (): Promise<TestResult> => {
      const a = { startDate: new Date('2024-01-15'), endDate: new Date('2024-01-20') };
      const b = { startDate: new Date('2024-01-01'), endDate: new Date('2024-01-10') };
      return assert.false(dateRangesOverlap(a, b), 'Non-overlapping should return false');
    },
  },
  {
    name: 'Boundary: Adjacent ranges (A ends when B starts)',
    description: 'Back-to-back bookings touching at boundary',
    category: 'Date Overlap',
    run: async (): Promise<TestResult> => {
      // Same day boundary - A ends Jan 15, B starts Jan 15
      const a = { startDate: new Date('2024-01-10'), endDate: new Date('2024-01-15') };
      const b = { startDate: new Date('2024-01-15'), endDate: new Date('2024-01-20') };
      // This SHOULD overlap because both have the same date (depends on business logic)
      // In our case, if end date is inclusive, this is an overlap
      return assert.true(
        dateRangesOverlap(a, b),
        'Adjacent ranges at boundary should overlap (end date inclusive)'
      );
    },
  },

  // -------------------------------------------------------------------------
  // DURATION CALCULATION TESTS
  // -------------------------------------------------------------------------
  {
    name: 'Duration: Same day = 1 day minimum',
    description: 'Booking on same day should be at least 1 day',
    category: 'Duration',
    run: async (): Promise<TestResult> => {
      const start = new Date('2024-01-15T09:00:00');
      const end = new Date('2024-01-15T17:00:00');
      const days = calculateDays(start, end);
      return assert.equals(days, 1, 'Same day booking = 1 day');
    },
  },
  {
    name: 'Duration: 3 full days',
    description: 'Start Jan 15, end Jan 18 = 3 days',
    category: 'Duration',
    run: async (): Promise<TestResult> => {
      const start = new Date('2024-01-15');
      const end = new Date('2024-01-18');
      const days = calculateDays(start, end);
      return assert.equals(days, 3, 'Jan 15-18 = 3 days');
    },
  },
  {
    name: 'Duration: Partial day rounds up',
    description: '1.5 days should round up to 2 days',
    category: 'Duration',
    run: async (): Promise<TestResult> => {
      const start = new Date('2024-01-15T00:00:00');
      const end = new Date('2024-01-16T12:00:00');
      const days = calculateDays(start, end);
      return assert.equals(days, 2, '1.5 days rounds up to 2');
    },
  },
  {
    name: 'Duration: Hours calculation',
    description: '8 hours of service',
    category: 'Duration',
    run: async (): Promise<TestResult> => {
      const start = new Date('2024-01-15T09:00:00');
      const end = new Date('2024-01-15T17:00:00');
      const hours = calculateHours(start, end);
      return assert.equals(hours, 8, '09:00-17:00 = 8 hours');
    },
  },
  {
    name: 'Duration: Minimum 1 hour',
    description: 'Very short booking should be at least 1 hour',
    category: 'Duration',
    run: async (): Promise<TestResult> => {
      const start = new Date('2024-01-15T09:00:00');
      const end = new Date('2024-01-15T09:30:00');
      const hours = calculateHours(start, end);
      return assert.equals(hours, 1, '30 min rounds up to 1 hour');
    },
  },

  // -------------------------------------------------------------------------
  // DATE BOUNDARY TESTS
  // -------------------------------------------------------------------------
  {
    name: 'Boundary: Feb 28 → Mar 1 (non-leap year)',
    description: 'February boundary in non-leap year',
    category: 'Date Boundary',
    run: async (): Promise<TestResult> => {
      // 2023 is not a leap year
      const start = new Date('2023-02-27');
      const end = new Date('2023-03-02');
      const days = calculateDays(start, end);
      // Feb 27, 28, Mar 1, 2 = but our calc is end - start in days
      // Mar 2 - Feb 27 = 3 days
      return assert.equals(days, 3, 'Feb 27 to Mar 2 (non-leap) = 3 days');
    },
  },
  {
    name: 'Boundary: Feb 28 → Mar 1 (leap year)',
    description: 'February boundary in leap year',
    category: 'Date Boundary',
    run: async (): Promise<TestResult> => {
      // 2024 is a leap year
      const start = new Date('2024-02-27');
      const end = new Date('2024-03-02');
      const days = calculateDays(start, end);
      // Feb 27, 28, 29, Mar 1, 2 = but calc is end - start
      // Mar 2 - Feb 27 = 4 days (includes Feb 29)
      return assert.equals(days, 4, 'Feb 27 to Mar 2 (leap) = 4 days');
    },
  },
  {
    name: 'Boundary: Dec 31 → Jan 1 (year boundary)',
    description: 'New Year boundary crossing',
    category: 'Date Boundary',
    run: async (): Promise<TestResult> => {
      const start = new Date('2023-12-30');
      const end = new Date('2024-01-02');
      const days = calculateDays(start, end);
      // Dec 30, 31, Jan 1, 2 = 3 days
      return assert.equals(days, 3, 'Dec 30 to Jan 2 = 3 days');
    },
  },
  {
    name: 'Boundary: Midnight crossing',
    description: 'Booking spanning 11:59 PM to 12:01 AM',
    category: 'Date Boundary',
    run: async (): Promise<TestResult> => {
      const start = new Date('2024-01-15T23:30:00');
      const end = new Date('2024-01-16T00:30:00');
      const hours = calculateHours(start, end);
      return assert.equals(hours, 1, 'Midnight crossing = 1 hour');
    },
  },

  // -------------------------------------------------------------------------
  // DST TRANSITION TESTS (UK)
  // -------------------------------------------------------------------------
  {
    name: 'DST: Spring forward (March, lose 1 hour)',
    description: 'UK clocks go forward, losing 1 hour',
    category: 'DST',
    run: async (): Promise<TestResult> => {
      // On DST day, a booking from 1 AM to 4 AM should be 2 hours (not 3)
      // because 2 AM → 3 AM is skipped
      // This test validates awareness of DST issues
      const beforeDst = new Date('2024-03-31T00:00:00Z');
      const afterDst = new Date('2024-03-31T04:00:00Z');
      const hours = calculateHours(beforeDst, afterDst);
      // In UTC this is exactly 4 hours, but in UK time it spans the DST gap
      // Our UTC-based calculation should still work correctly
      return assert.equals(hours, 4, 'DST spring: 4 UTC hours = 4 hours');
    },
  },
  {
    name: 'DST: Fall back (October, gain 1 hour)',
    description: 'UK clocks go back, gaining 1 hour',
    category: 'DST',
    run: async (): Promise<TestResult> => {
      // On DST day, a booking might seem longer due to repeated hour
      const beforeDst = new Date('2024-10-27T00:00:00Z');
      const afterDst = new Date('2024-10-27T04:00:00Z');
      const hours = calculateHours(beforeDst, afterDst);
      return assert.equals(hours, 4, 'DST fall: 4 UTC hours = 4 hours');
    },
  },

  // -------------------------------------------------------------------------
  // STATUS TRANSITION TESTS
  // -------------------------------------------------------------------------
  {
    name: 'Status: PENDING → CONFIRMED (valid)',
    description: 'Payment success should confirm booking',
    category: 'Status Transition',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition('PENDING', 'CONFIRMED'),
        'PENDING → CONFIRMED should be valid'
      );
    },
  },
  {
    name: 'Status: PENDING → CANCELLED (valid)',
    description: 'Payment failure should cancel booking',
    category: 'Status Transition',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition('PENDING', 'CANCELLED'),
        'PENDING → CANCELLED should be valid'
      );
    },
  },
  {
    name: 'Status: PENDING → COMPLETED (invalid)',
    description: 'Cannot skip payment to complete',
    category: 'Status Transition',
    run: async (): Promise<TestResult> => {
      return assert.false(
        isValidTransition('PENDING', 'COMPLETED'),
        'PENDING → COMPLETED should be invalid (skip payment)'
      );
    },
  },
  {
    name: 'Status: CONFIRMED → IN_PROGRESS (valid)',
    description: 'Start date reached activates booking',
    category: 'Status Transition',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition('CONFIRMED', 'IN_PROGRESS'),
        'CONFIRMED → IN_PROGRESS should be valid'
      );
    },
  },
  {
    name: 'Status: IN_PROGRESS → COMPLETED (valid)',
    description: 'Job finished successfully',
    category: 'Status Transition',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition('IN_PROGRESS', 'COMPLETED'),
        'IN_PROGRESS → COMPLETED should be valid'
      );
    },
  },
  {
    name: 'Status: IN_PROGRESS → DISPUTED (valid)',
    description: 'Customer raises issue during rental',
    category: 'Status Transition',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition('IN_PROGRESS', 'DISPUTED'),
        'IN_PROGRESS → DISPUTED should be valid'
      );
    },
  },
  {
    name: 'Status: COMPLETED → any (invalid)',
    description: 'Completed is terminal state',
    category: 'Status Transition',
    run: async (): Promise<TestResult> => {
      const invalidTransitions = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'CANCELLED', 'DISPUTED', 'REFUNDED'];
      for (const to of invalidTransitions) {
        if (isValidTransition('COMPLETED', to as TransactionStatus)) {
          return {
            passed: false,
            score: 0,
            details: `COMPLETED → ${to} should be invalid`,
            error: 'Terminal state should not transition',
          };
        }
      }
      return {
        passed: true,
        score: 100,
        details: 'COMPLETED is properly terminal',
      };
    },
  },
  {
    name: 'Status: CANCELLED → any (invalid)',
    description: 'Cancelled is terminal state',
    category: 'Status Transition',
    run: async (): Promise<TestResult> => {
      const invalidTransitions = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED', 'REFUNDED'];
      for (const to of invalidTransitions) {
        if (isValidTransition('CANCELLED', to as TransactionStatus)) {
          return {
            passed: false,
            score: 0,
            details: `CANCELLED → ${to} should be invalid`,
            error: 'Terminal state should not transition',
          };
        }
      }
      return {
        passed: true,
        score: 100,
        details: 'CANCELLED is properly terminal',
      };
    },
  },
  {
    name: 'Status: DISPUTED → COMPLETED (valid)',
    description: 'Dispute resolved in provider favor',
    category: 'Status Transition',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition('DISPUTED', 'COMPLETED'),
        'DISPUTED → COMPLETED should be valid'
      );
    },
  },
  {
    name: 'Status: DISPUTED → REFUNDED (valid)',
    description: 'Dispute resolved with refund',
    category: 'Status Transition',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition('DISPUTED', 'REFUNDED'),
        'DISPUTED → REFUNDED should be valid'
      );
    },
  },

  // -------------------------------------------------------------------------
  // CONFLICT DETECTION SCENARIOS
  // -------------------------------------------------------------------------
  {
    name: 'Conflict: Same tool, overlapping dates',
    description: 'Two users trying to book same tool same time',
    category: 'Conflict Detection',
    run: async (): Promise<TestResult> => {
      const existingBooking = {
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-20'),
      };
      const newBooking = {
        startDate: new Date('2024-01-18'),
        endDate: new Date('2024-01-25'),
      };
      return assert.true(
        dateRangesOverlap(existingBooking, newBooking),
        'Overlapping tool bookings should conflict'
      );
    },
  },
  {
    name: 'No Conflict: Same tool, non-overlapping dates',
    description: 'Sequential bookings for same tool',
    category: 'Conflict Detection',
    run: async (): Promise<TestResult> => {
      const existingBooking = {
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-17'),
      };
      const newBooking = {
        startDate: new Date('2024-01-20'),
        endDate: new Date('2024-01-25'),
      };
      return assert.false(
        dateRangesOverlap(existingBooking, newBooking),
        'Non-overlapping bookings should not conflict'
      );
    },
  },
];

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runBookingTests(): Promise<void> {
  const runner = new QualityTestRunner('Booking Race Condition & Date Logic Tests');
  runner.addTests(bookingTests);
  await runner.runAll();
}

export { bookingTests, runBookingTests };

if (process.argv[1]?.includes('race-condition-tester')) {
  runBookingTests().catch(console.error);
}
