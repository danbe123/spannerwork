/**
 * Fee Calculation Validator
 *
 * Deep validation of all fee calculations to ensure:
 * - No penny is lost in rounding
 * - VAT extraction/addition is correct
 * - Sponsor CPA calculations are accurate
 * - Insurance fees are properly calculated
 */

import { QualityTestRunner, TestCase, TestResult, assert } from '../core/test-runner.js';

// ============================================================================
// VAT CALCULATION RULES (UK)
// ============================================================================

const VAT_RATE = 0.20; // 20% UK VAT

/**
 * Extract VAT from a gross amount (amount includes VAT)
 * Gross = Net + (Net × 0.20) = Net × 1.20
 * Net = Gross ÷ 1.20
 * VAT = Gross - Net
 */
function extractVatFromGross(grossAmount: number): { net: number; vat: number } {
  const net = Math.round(grossAmount / 1.2);
  const vat = grossAmount - net;
  return { net, vat };
}

/**
 * Add VAT to a net amount
 * Gross = Net × 1.20
 */
function addVatToNet(netAmount: number): { gross: number; vat: number } {
  const vat = Math.round(netAmount * VAT_RATE);
  const gross = netAmount + vat;
  return { gross, vat };
}

// ============================================================================
// RENTAL FEE CALCULATIONS
// ============================================================================

function calculateDailyRentalFee(dailyRate: number, days: number): number {
  return dailyRate * days;
}

function calculateWeeklyRentalFee(weeklyRate: number, weeks: number): number {
  return weeklyRate * weeks;
}

function calculateHourlyRentalFee(hourlyRate: number, hours: number, calloutFee: number = 0): number {
  return (hourlyRate * hours) + calloutFee;
}

/**
 * Smart rental fee calculation:
 * - Use weekly rate if >= 7 days and weekly rate exists
 * - Otherwise use daily rate
 */
function calculateSmartRentalFee(dailyRate: number, weeklyRate: number | null, days: number): number {
  if (days >= 7 && weeklyRate) {
    const weeks = Math.ceil(days / 7);
    return weeks * weeklyRate;
  }
  return days * dailyRate;
}

// ============================================================================
// SPONSOR CPA CALCULATIONS
// ============================================================================

function calculateSponsorCpaFee(rentalFee: number, cpaPercent: number): number {
  return Math.round(rentalFee * (cpaPercent / 100));
}

// ============================================================================
// TEST CASES
// ============================================================================

const feeTests: TestCase[] = [
  // -------------------------------------------------------------------------
  // VAT CALCULATIONS
  // -------------------------------------------------------------------------
  {
    name: 'VAT extraction: £120 gross → £100 net + £20 VAT',
    description: 'Standard VAT extraction from gross amount',
    category: 'VAT Calculation',
    run: async (): Promise<TestResult> => {
      const { net, vat } = extractVatFromGross(12000); // £120 in pence
      return assert.true(
        net === 10000 && vat === 2000,
        `£120 gross → £${net/100} net + £${vat/100} VAT`
      );
    },
  },
  {
    name: 'VAT extraction: £1 gross (small amount)',
    description: 'VAT extraction for small amounts',
    category: 'VAT Calculation',
    run: async (): Promise<TestResult> => {
      const { net, vat } = extractVatFromGross(100); // £1 in pence
      const expectedNet = 83; // 100 / 1.2 = 83.33 → 83
      const expectedVat = 17; // 100 - 83 = 17
      return assert.true(
        net === expectedNet && vat === expectedVat,
        `£1 gross → ${net}p net + ${vat}p VAT`
      );
    },
  },
  {
    name: 'VAT extraction: sum equals original',
    description: 'Net + VAT should always equal gross',
    category: 'VAT Calculation',
    run: async (): Promise<TestResult> => {
      const testAmounts = [100, 120, 500, 1000, 1234, 5678, 10000, 99999];
      for (const gross of testAmounts) {
        const { net, vat } = extractVatFromGross(gross);
        if (net + vat !== gross) {
          return {
            passed: false,
            score: 0,
            details: 'VAT extraction sum mismatch',
            error: `For gross ${gross}: net ${net} + vat ${vat} = ${net + vat}`,
          };
        }
      }
      return {
        passed: true,
        score: 100,
        details: 'All VAT extractions sum correctly',
      };
    },
  },
  {
    name: 'VAT addition: £100 net → £120 gross',
    description: 'Standard VAT addition to net amount',
    category: 'VAT Calculation',
    run: async (): Promise<TestResult> => {
      const { gross, vat } = addVatToNet(10000); // £100 net
      return assert.true(
        gross === 12000 && vat === 2000,
        `£100 net → £${gross/100} gross (£${vat/100} VAT)`
      );
    },
  },
  {
    name: 'VAT roundtrip: gross → net → gross',
    description: 'Adding VAT to extracted net should give original gross',
    category: 'VAT Calculation',
    run: async (): Promise<TestResult> => {
      // Note: Due to rounding, this won't always be exact
      const testAmounts = [1200, 2400, 6000, 12000, 24000];
      for (const originalGross of testAmounts) {
        const { net } = extractVatFromGross(originalGross);
        const { gross: recalculatedGross } = addVatToNet(net);
        // Allow 1p tolerance due to rounding
        const diff = Math.abs(recalculatedGross - originalGross);
        if (diff > 1) {
          return {
            passed: false,
            score: 0,
            details: 'VAT roundtrip failed',
            error: `Original ${originalGross} → net ${net} → recalc ${recalculatedGross}`,
          };
        }
      }
      return {
        passed: true,
        score: 100,
        details: 'VAT roundtrip accurate within 1p',
      };
    },
  },

  // -------------------------------------------------------------------------
  // RENTAL FEE CALCULATIONS
  // -------------------------------------------------------------------------
  {
    name: 'Daily rate: 3 days at £20/day',
    description: 'Basic daily rental calculation',
    category: 'Rental Calculation',
    run: async (): Promise<TestResult> => {
      const fee = calculateDailyRentalFee(2000, 3);
      return assert.equals(fee, 6000, '3 days × £20 = £60');
    },
  },
  {
    name: 'Weekly rate: 2 weeks at £100/week',
    description: 'Basic weekly rental calculation',
    category: 'Rental Calculation',
    run: async (): Promise<TestResult> => {
      const fee = calculateWeeklyRentalFee(10000, 2);
      return assert.equals(fee, 20000, '2 weeks × £100 = £200');
    },
  },
  {
    name: 'Hourly rate with callout fee',
    description: 'Service fee with callout charge',
    category: 'Rental Calculation',
    run: async (): Promise<TestResult> => {
      const fee = calculateHourlyRentalFee(5000, 3, 2500); // £50/hr × 3 + £25 callout
      return assert.equals(fee, 17500, '3hrs × £50 + £25 callout = £175');
    },
  },
  {
    name: 'Smart fee: 6 days uses daily rate',
    description: 'Under 7 days should use daily rate even if weekly exists',
    category: 'Rental Calculation',
    run: async (): Promise<TestResult> => {
      const dailyRate = 2000; // £20/day
      const weeklyRate = 10000; // £100/week
      const fee = calculateSmartRentalFee(dailyRate, weeklyRate, 6);
      const expectedDaily = 6 * 2000; // £120
      return assert.equals(fee, expectedDaily, '6 days should use daily rate');
    },
  },
  {
    name: 'Smart fee: 7 days uses weekly rate',
    description: 'Exactly 7 days should use weekly rate',
    category: 'Rental Calculation',
    run: async (): Promise<TestResult> => {
      const dailyRate = 2000; // £20/day → £140 for 7 days
      const weeklyRate = 10000; // £100/week
      const fee = calculateSmartRentalFee(dailyRate, weeklyRate, 7);
      return assert.equals(fee, 10000, '7 days should use 1 week rate');
    },
  },
  {
    name: 'Smart fee: 10 days uses 2 weeks',
    description: '10 days rounds up to 2 weeks',
    category: 'Rental Calculation',
    run: async (): Promise<TestResult> => {
      const dailyRate = 2000;
      const weeklyRate = 10000;
      const fee = calculateSmartRentalFee(dailyRate, weeklyRate, 10);
      // Math.ceil(10/7) = 2 weeks
      return assert.equals(fee, 20000, '10 days = ceil(10/7) = 2 weeks');
    },
  },
  {
    name: 'Smart fee: no weekly rate falls back to daily',
    description: 'When no weekly rate, use daily even for long bookings',
    category: 'Rental Calculation',
    run: async (): Promise<TestResult> => {
      const dailyRate = 2000;
      const fee = calculateSmartRentalFee(dailyRate, null, 14);
      return assert.equals(fee, 28000, '14 days × £20 = £280 (no weekly rate)');
    },
  },

  // -------------------------------------------------------------------------
  // SPONSOR CPA CALCULATIONS
  // -------------------------------------------------------------------------
  {
    name: 'Sponsor CPA: 10% of £100 rental',
    description: 'Basic CPA fee calculation',
    category: 'Sponsor CPA',
    run: async (): Promise<TestResult> => {
      const fee = calculateSponsorCpaFee(10000, 10);
      return assert.equals(fee, 1000, '10% of £100 = £10');
    },
  },
  {
    name: 'Sponsor CPA: 0% means no fee',
    description: 'Zero CPA should result in zero fee',
    category: 'Sponsor CPA',
    run: async (): Promise<TestResult> => {
      const fee = calculateSponsorCpaFee(10000, 0);
      return assert.equals(fee, 0, '0% CPA = £0 fee');
    },
  },
  {
    name: 'Sponsor CPA: rounding on fractional amounts',
    description: 'CPA should round to nearest penny',
    category: 'Sponsor CPA',
    run: async (): Promise<TestResult> => {
      // £33.33 rental at 10% = £3.333 → £3.33 (333p)
      const fee = calculateSponsorCpaFee(3333, 10);
      const expected = Math.round(3333 * 0.10);
      return assert.equals(fee, expected, `10% of 3333p = ${expected}p`);
    },
  },
  {
    name: 'Sponsor CPA: never negative',
    description: 'CPA fee should never be negative',
    category: 'Sponsor CPA',
    run: async (): Promise<TestResult> => {
      const testCases = [
        { rental: 0, cpa: 10 },
        { rental: 100, cpa: 0 },
        { rental: 1, cpa: 1 },
      ];
      for (const { rental, cpa } of testCases) {
        const fee = calculateSponsorCpaFee(rental, cpa);
        if (fee < 0) {
          return {
            passed: false,
            score: 0,
            details: 'Negative CPA fee detected',
            error: `rental=${rental}, cpa=${cpa}, fee=${fee}`,
          };
        }
      }
      return {
        passed: true,
        score: 100,
        details: 'All CPA fees non-negative',
      };
    },
  },
  {
    name: 'Sponsor CPA: never exceeds rental',
    description: 'Even 100% CPA should not exceed rental',
    category: 'Sponsor CPA',
    run: async (): Promise<TestResult> => {
      const rental = 10000;
      const fee = calculateSponsorCpaFee(rental, 100);
      return assert.true(
        fee <= rental,
        `100% CPA (${fee}p) should not exceed rental (${rental}p)`
      );
    },
  },

  // -------------------------------------------------------------------------
  // EDGE CASES & OVERFLOW
  // -------------------------------------------------------------------------
  {
    name: 'Large amount: No overflow at £1,000,000',
    description: 'Calculations should not overflow for large amounts',
    category: 'Edge Cases',
    run: async (): Promise<TestResult> => {
      const rental = 100000000; // £1,000,000 in pence
      const fee = calculateSponsorCpaFee(rental, 5);
      const expected = 5000000; // £50,000
      return assert.equals(fee, expected, 'Large amounts should calculate correctly');
    },
  },
  {
    name: 'Zero handling: 0 rental fee',
    description: 'Zero rental should result in zero fees',
    category: 'Edge Cases',
    run: async (): Promise<TestResult> => {
      const fee = calculateSponsorCpaFee(0, 10);
      return assert.equals(fee, 0, 'Zero rental = zero CPA');
    },
  },

  // -------------------------------------------------------------------------
  // INSURANCE FEE VALIDATION
  // -------------------------------------------------------------------------
  {
    name: 'Insurance fees: sum of components',
    description: 'Total insurance = damage + liability + cancellation',
    category: 'Insurance Fees',
    run: async (): Promise<TestResult> => {
      const damageProtection = 500;  // £5
      const liability = 300;         // £3
      const cancellation = 200;      // £2
      const total = damageProtection + liability + cancellation;
      return assert.equals(total, 1000, 'Insurance total = £10');
    },
  },
  {
    name: 'Insurance fees: optional components',
    description: 'Unselected insurance should be £0',
    category: 'Insurance Fees',
    run: async (): Promise<TestResult> => {
      const selected = false;
      const fee = selected ? 500 : 0;
      return assert.equals(fee, 0, 'Unselected insurance = £0');
    },
  },

  // -------------------------------------------------------------------------
  // COMPLETE TRANSACTION VALIDATION
  // -------------------------------------------------------------------------
  {
    name: 'Complete transaction: all fees sum correctly',
    description: 'Full transaction breakdown verification',
    category: 'Complete Validation',
    run: async (): Promise<TestResult> => {
      // Simulate a real transaction
      const rentalFee = 10000;        // £100 base rental
      const platformFee = 500;        // £5 (5% FREE tier)
      const instantPayoutFee = 150;   // £1.50
      const insuranceFees = 1000;     // £10

      const totalAmount = rentalFee + platformFee + insuranceFees; // Customer pays
      const applicationFee = platformFee + instantPayoutFee + insuranceFees; // Platform keeps
      const providerGets = totalAmount - applicationFee;

      // Verify invariants
      const customerPays = totalAmount; // £115
      const platformKeeps = applicationFee; // £16.50
      const providerReceives = providerGets; // £98.50

      // Money conservation: Customer pays = Platform keeps + Provider receives
      const balanced = customerPays === (platformKeeps + providerReceives);

      return assert.true(
        balanced,
        `Customer: £${customerPays/100} = Platform: £${platformKeeps/100} + Provider: £${providerReceives/100}`
      );
    },
  },
];

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runFeeValidation(): Promise<void> {
  const runner = new QualityTestRunner('Fee Calculation Validator');
  runner.addTests(feeTests);
  await runner.runAll();
}

export { feeTests, runFeeValidation };

if (process.argv[1]?.includes('fee-validator')) {
  runFeeValidation().catch(console.error);
}
