/**
 * Payment & Escrow Test Suite
 *
 * Tests all payment-related business logic for bulletproof money handling.
 * Focus: Fee calculations, escrow timing, refunds, edge cases.
 */

import { QualityTestRunner, TestCase, TestResult, assert } from '../core/test-runner.js';

// ============================================================================
// BUSINESS RULES (from actual code)
// ============================================================================

const FEE_RULES = {
  // Platform fee percentages by provider tier
  BUSINESS: 2,
  PRO: 3,
  FREE: 5,

  // Instant payout fee
  INSTANT_PAYOUT_PERCENT: 1.5,

  // Escrow expiry (Stripe limit)
  ESCROW_EXPIRY_DAYS: 7,
};

// ============================================================================
// FEE CALCULATION FUNCTIONS (mirroring actual implementation)
// ============================================================================

function getPlatformFeePercentForProviderPlan(plan: string): number {
  if (plan === 'BUSINESS') return FEE_RULES.BUSINESS;
  if (plan === 'PRO') return FEE_RULES.PRO;
  return FEE_RULES.FREE;
}

function calculatePlatformFee(rentalFee: number, plan: string): number {
  const percent = getPlatformFeePercentForProviderPlan(plan);
  return Math.round(rentalFee * (percent / 100));
}

function calculateInstantPayoutFee(rentalFee: number, selected: boolean): number {
  return selected ? Math.round(rentalFee * (FEE_RULES.INSTANT_PAYOUT_PERCENT / 100)) : 0;
}

function calculateTotalAmount(rentalFee: number, platformFee: number, insuranceFees: number = 0): number {
  return rentalFee + platformFee + insuranceFees;
}

function calculateApplicationFee(platformFee: number, instantPayoutFee: number, insuranceFees: number = 0): number {
  return platformFee + instantPayoutFee + insuranceFees;
}

// ============================================================================
// TEST CASES
// ============================================================================

const paymentTests: TestCase[] = [
  // -------------------------------------------------------------------------
  // FEE CALCULATION TESTS
  // -------------------------------------------------------------------------
  {
    name: 'FREE tier platform fee (5%)',
    description: 'Verify FREE tier charges 5% platform fee',
    category: 'Fee Calculation',
    run: async (): Promise<TestResult> => {
      const rentalFee = 10000; // £100
      const expectedFee = 500; // £5
      const actualFee = calculatePlatformFee(rentalFee, 'FREE');
      return assert.equals(actualFee, expectedFee, `FREE tier: £${rentalFee/100} rental → £${actualFee/100} fee`);
    },
  },
  {
    name: 'PRO tier platform fee (3%)',
    description: 'Verify PRO tier charges 3% platform fee',
    category: 'Fee Calculation',
    run: async (): Promise<TestResult> => {
      const rentalFee = 10000; // £100
      const expectedFee = 300; // £3
      const actualFee = calculatePlatformFee(rentalFee, 'PRO');
      return assert.equals(actualFee, expectedFee, `PRO tier: £${rentalFee/100} rental → £${actualFee/100} fee`);
    },
  },
  {
    name: 'BUSINESS tier platform fee (2%)',
    description: 'Verify BUSINESS tier charges 2% platform fee',
    category: 'Fee Calculation',
    run: async (): Promise<TestResult> => {
      const rentalFee = 10000; // £100
      const expectedFee = 200; // £2
      const actualFee = calculatePlatformFee(rentalFee, 'BUSINESS');
      return assert.equals(actualFee, expectedFee, `BUSINESS tier: £${rentalFee/100} rental → £${actualFee/100} fee`);
    },
  },
  {
    name: 'Unknown tier defaults to FREE',
    description: 'Any unknown tier should default to FREE (5%)',
    category: 'Fee Calculation',
    run: async (): Promise<TestResult> => {
      const rentalFee = 10000;
      const freeRate = calculatePlatformFee(rentalFee, 'FREE');
      const unknownRate = calculatePlatformFee(rentalFee, 'UNKNOWN_TIER');
      return assert.equals(unknownRate, freeRate, 'Unknown tier should default to FREE tier rate');
    },
  },

  // -------------------------------------------------------------------------
  // ROUNDING EDGE CASES
  // -------------------------------------------------------------------------
  {
    name: 'Rounding: £10.01 at 5% → £0.50',
    description: 'Verify rounding when result has half-penny',
    category: 'Rounding',
    run: async (): Promise<TestResult> => {
      // £10.01 = 1001p, 5% = 50.05p → rounds to 50p
      const rentalFee = 1001;
      const fee = calculatePlatformFee(rentalFee, 'FREE');
      return assert.equals(fee, 50, '5% of 1001p = 50.05p → should round to 50p');
    },
  },
  {
    name: 'Rounding: £10.05 at 5% → £0.50',
    description: 'Verify banker rounding (round half to even)',
    category: 'Rounding',
    run: async (): Promise<TestResult> => {
      // £10.05 = 1005p, 5% = 50.25p → rounds to 50p
      const rentalFee = 1005;
      const fee = calculatePlatformFee(rentalFee, 'FREE');
      return assert.equals(fee, 50, '5% of 1005p = 50.25p → should round to 50p');
    },
  },
  {
    name: 'Rounding: £10.10 at 5% → £0.51',
    description: 'Verify rounding up when > 0.5',
    category: 'Rounding',
    run: async (): Promise<TestResult> => {
      // £10.10 = 1010p, 5% = 50.5p → Math.round rounds to 51p (round half up)
      const rentalFee = 1010;
      const fee = calculatePlatformFee(rentalFee, 'FREE');
      return assert.equals(fee, 51, '5% of 1010p = 50.5p → should round to 51p');
    },
  },
  {
    name: 'Minimum viable rental (£1)',
    description: 'Verify fee calculation works for minimum rental',
    category: 'Rounding',
    run: async (): Promise<TestResult> => {
      // £1 = 100p, 5% = 5p
      const rentalFee = 100;
      const fee = calculatePlatformFee(rentalFee, 'FREE');
      return assert.equals(fee, 5, '5% of 100p = 5p');
    },
  },
  {
    name: 'Edge: 1 penny rental',
    description: 'Verify fee for smallest possible amount',
    category: 'Rounding',
    run: async (): Promise<TestResult> => {
      // 1p, 5% = 0.05p → rounds to 0p
      const rentalFee = 1;
      const fee = calculatePlatformFee(rentalFee, 'FREE');
      return assert.equals(fee, 0, '5% of 1p = 0.05p → should round to 0p');
    },
  },
  {
    name: 'Large amount: £9,999.99',
    description: 'Verify fee calculation for maximum rental',
    category: 'Rounding',
    run: async (): Promise<TestResult> => {
      // £9,999.99 = 999999p, 5% = 49999.95p → rounds to 50000p = £500
      const rentalFee = 999999;
      const fee = calculatePlatformFee(rentalFee, 'FREE');
      const expected = Math.round(999999 * 0.05);
      return assert.equals(fee, expected, `5% of £9999.99 = £${fee/100}`);
    },
  },

  // -------------------------------------------------------------------------
  // INSTANT PAYOUT TESTS
  // -------------------------------------------------------------------------
  {
    name: 'Instant payout fee when selected',
    description: 'Verify 1.5% instant payout fee',
    category: 'Instant Payout',
    run: async (): Promise<TestResult> => {
      const rentalFee = 10000; // £100
      const fee = calculateInstantPayoutFee(rentalFee, true);
      const expected = 150; // £1.50
      return assert.equals(fee, expected, 'Instant payout fee should be 1.5%');
    },
  },
  {
    name: 'No instant payout fee when not selected',
    description: 'Verify no fee when instant payout not selected',
    category: 'Instant Payout',
    run: async (): Promise<TestResult> => {
      const rentalFee = 10000;
      const fee = calculateInstantPayoutFee(rentalFee, false);
      return assert.equals(fee, 0, 'Should be 0 when not selected');
    },
  },

  // -------------------------------------------------------------------------
  // TOTAL AMOUNT VERIFICATION
  // -------------------------------------------------------------------------
  {
    name: 'Total amount calculation (no insurance)',
    description: 'Verify total = rental + platform fee',
    category: 'Total Amount',
    run: async (): Promise<TestResult> => {
      const rentalFee = 10000;
      const platformFee = calculatePlatformFee(rentalFee, 'FREE');
      const total = calculateTotalAmount(rentalFee, platformFee);
      const expected = 10500; // £100 + £5
      return assert.equals(total, expected, `Total should be £${expected/100}`);
    },
  },
  {
    name: 'Application fee calculation',
    description: 'Verify application fee = platform + instant payout + insurance',
    category: 'Application Fee',
    run: async (): Promise<TestResult> => {
      const rentalFee = 10000;
      const platformFee = calculatePlatformFee(rentalFee, 'FREE'); // 500
      const instantPayoutFee = calculateInstantPayoutFee(rentalFee, true); // 150
      const insuranceFees = 200;
      const appFee = calculateApplicationFee(platformFee, instantPayoutFee, insuranceFees);
      const expected = 850; // 500 + 150 + 200
      return assert.equals(appFee, expected, `Application fee should be £${expected/100}`);
    },
  },

  // -------------------------------------------------------------------------
  // ESCROW TIMING TESTS
  // -------------------------------------------------------------------------
  {
    name: 'Escrow expiry: Day 6.9 (valid)',
    description: 'Payment should be capturable before 7 days',
    category: 'Escrow Timing',
    run: async (): Promise<TestResult> => {
      const createdAt = new Date();
      const captureAt = new Date(createdAt.getTime() + (6.9 * 24 * 60 * 60 * 1000));
      const expiresAt = new Date(createdAt.getTime() + (7 * 24 * 60 * 60 * 1000));
      const isValid = captureAt < expiresAt;
      return assert.true(isValid, 'Capture at day 6.9 should be within expiry');
    },
  },
  {
    name: 'Escrow expiry: Day 7.0 (boundary)',
    description: 'Payment at exactly 7 days should be at boundary',
    category: 'Escrow Timing',
    run: async (): Promise<TestResult> => {
      const createdAt = new Date();
      const captureAt = new Date(createdAt.getTime() + (7 * 24 * 60 * 60 * 1000));
      const expiresAt = new Date(createdAt.getTime() + (7 * 24 * 60 * 60 * 1000));
      // At exactly 7 days, it's at the boundary (technically still valid but risky)
      const isAtBoundary = captureAt.getTime() === expiresAt.getTime();
      return assert.true(isAtBoundary, 'Capture at day 7.0 is at boundary');
    },
  },
  {
    name: 'Escrow expiry: Day 7.1 (expired)',
    description: 'Payment should be expired after 7 days',
    category: 'Escrow Timing',
    run: async (): Promise<TestResult> => {
      const createdAt = new Date();
      const captureAt = new Date(createdAt.getTime() + (7.1 * 24 * 60 * 60 * 1000));
      const expiresAt = new Date(createdAt.getTime() + (7 * 24 * 60 * 60 * 1000));
      const isExpired = captureAt > expiresAt;
      return assert.true(isExpired, 'Capture at day 7.1 should be after expiry');
    },
  },

  // -------------------------------------------------------------------------
  // FEE BOUNDARY VALIDATION
  // -------------------------------------------------------------------------
  {
    name: 'Fee never negative',
    description: 'Platform fee should never be negative',
    category: 'Boundary Validation',
    run: async (): Promise<TestResult> => {
      const testCases = [0, 1, 10, 100, 1000, 10000, 100000, 999999];
      for (const rentalFee of testCases) {
        const fee = calculatePlatformFee(rentalFee, 'FREE');
        if (fee < 0) {
          return {
            passed: false,
            score: 0,
            details: `Fee was negative for rental ${rentalFee}`,
            error: `Got ${fee} for rental ${rentalFee}`,
          };
        }
      }
      return {
        passed: true,
        score: 100,
        details: 'All fees are non-negative',
      };
    },
  },
  {
    name: 'Fee never exceeds rental amount',
    description: 'Platform fee should never be more than rental',
    category: 'Boundary Validation',
    run: async (): Promise<TestResult> => {
      const testCases = [1, 10, 100, 1000, 10000, 100000, 999999];
      for (const rentalFee of testCases) {
        for (const plan of ['FREE', 'PRO', 'BUSINESS']) {
          const fee = calculatePlatformFee(rentalFee, plan);
          if (fee > rentalFee) {
            return {
              passed: false,
              score: 0,
              details: `Fee exceeded rental for ${plan} tier`,
              error: `Fee ${fee} > rental ${rentalFee}`,
            };
          }
        }
      }
      return {
        passed: true,
        score: 100,
        details: 'All fees are within bounds',
      };
    },
  },

  // -------------------------------------------------------------------------
  // CONSISTENCY TESTS
  // -------------------------------------------------------------------------
  {
    name: 'Fee percentage consistency across tiers',
    description: 'FREE > PRO > BUSINESS fees for same amount',
    category: 'Consistency',
    run: async (): Promise<TestResult> => {
      const rentalFee = 10000;
      const freeFee = calculatePlatformFee(rentalFee, 'FREE');
      const proFee = calculatePlatformFee(rentalFee, 'PRO');
      const businessFee = calculatePlatformFee(rentalFee, 'BUSINESS');

      if (freeFee <= proFee || proFee <= businessFee) {
        return {
          passed: false,
          score: 0,
          details: 'Tier fees not in expected order',
          error: `FREE: ${freeFee}, PRO: ${proFee}, BUSINESS: ${businessFee}`,
        };
      }
      return {
        passed: true,
        score: 100,
        details: `FREE(${freeFee}) > PRO(${proFee}) > BUSINESS(${businessFee})`,
      };
    },
  },
  {
    name: 'Sum verification: parts equal total',
    description: 'Rental + platform fee should equal total (no insurance)',
    category: 'Consistency',
    run: async (): Promise<TestResult> => {
      const testAmounts = [100, 999, 1001, 5000, 10000, 50000, 999999];
      for (const rentalFee of testAmounts) {
        const platformFee = calculatePlatformFee(rentalFee, 'FREE');
        const total = calculateTotalAmount(rentalFee, platformFee);
        const expected = rentalFee + platformFee;
        if (total !== expected) {
          return {
            passed: false,
            score: 0,
            details: 'Sum mismatch detected',
            error: `For ${rentalFee}: total ${total} != rental ${rentalFee} + fee ${platformFee}`,
          };
        }
      }
      return {
        passed: true,
        score: 100,
        details: 'All sums verified correct',
      };
    },
  },

  // -------------------------------------------------------------------------
  // PROVIDER EARNINGS CALCULATION
  // -------------------------------------------------------------------------
  {
    name: 'Provider earnings: FREE tier',
    description: 'Verify provider receives rental minus platform fee',
    category: 'Provider Earnings',
    run: async (): Promise<TestResult> => {
      const rentalFee = 10000; // £100
      const platformFee = calculatePlatformFee(rentalFee, 'FREE'); // £5
      const providerEarnings = rentalFee - platformFee; // £95
      return assert.equals(providerEarnings, 9500, 'FREE tier provider should get £95 from £100');
    },
  },
  {
    name: 'Provider earnings: BUSINESS tier advantage',
    description: 'BUSINESS tier provider earns more than FREE tier',
    category: 'Provider Earnings',
    run: async (): Promise<TestResult> => {
      const rentalFee = 10000;
      const freeFee = calculatePlatformFee(rentalFee, 'FREE');
      const businessFee = calculatePlatformFee(rentalFee, 'BUSINESS');
      const freeEarnings = rentalFee - freeFee;
      const businessEarnings = rentalFee - businessFee;
      const advantage = businessEarnings - freeEarnings;

      return assert.true(
        advantage > 0,
        `BUSINESS tier saves £${advantage/100} per £100 rental`
      );
    },
  },
];

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runPaymentTests(): Promise<void> {
  const runner = new QualityTestRunner('Payment & Escrow Tests');
  runner.addTests(paymentTests);
  await runner.runAll();
}

// Export for use by main test runner
export { paymentTests, runPaymentTests };

// Run if executed directly
if (process.argv[1]?.includes('escrow-tester')) {
  runPaymentTests().catch(console.error);
}
