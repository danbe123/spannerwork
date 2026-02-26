/**
 * Performance Baseline Test Suite
 *
 * Establishes performance baselines and validates response time requirements.
 * Tests algorithm complexity and identifies potential performance bottlenecks.
 */

import { QualityTestRunner, TestCase, TestResult, assert } from '../core/test-runner.js';

// ============================================================================
// PERFORMANCE THRESHOLDS (in milliseconds)
// ============================================================================

const THRESHOLDS = {
  // Response time targets
  p50Target: 100,    // 50th percentile < 100ms
  p95Target: 500,    // 95th percentile < 500ms
  p99Target: 1000,   // 99th percentile < 1000ms

  // Algorithm complexity limits
  linearOp: 1,       // O(n) per item
  logarithmicOp: 10, // O(log n) per operation
  constantOp: 0.1,   // O(1) per operation

  // Memory limits
  maxArraySize: 100000,
  maxObjectDepth: 50,
};

// ============================================================================
// PERFORMANCE MEASUREMENT UTILITIES
// ============================================================================

interface PerformanceMetrics {
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  stdDev: number;
}

function measureOperation(fn: () => void, iterations: number = 1000): PerformanceMetrics {
  const times: number[] = [];

  // Warmup
  for (let i = 0; i < 10; i++) {
    fn();
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }

  times.sort((a, b) => a - b);

  const sum = times.reduce((a, b) => a + b, 0);
  const mean = sum / times.length;
  const variance = times.reduce((acc, t) => acc + Math.pow(t - mean, 2), 0) / times.length;

  return {
    min: times[0],
    max: times[times.length - 1],
    mean,
    p50: times[Math.floor(times.length * 0.5)],
    p95: times[Math.floor(times.length * 0.95)],
    p99: times[Math.floor(times.length * 0.99)],
    stdDev: Math.sqrt(variance),
  };
}

function formatMs(ms: number): string {
  if (ms < 0.01) return `${(ms * 1000).toFixed(2)}µs`;
  if (ms < 1) return `${ms.toFixed(3)}ms`;
  return `${ms.toFixed(1)}ms`;
}

// ============================================================================
// SIMULATED OPERATIONS (mirrors actual app complexity)
// ============================================================================

/**
 * Simulate search operation with filtering and sorting
 */
function simulateSearchOperation(itemCount: number): void {
  const items = Array.from({ length: itemCount }, (_, i) => ({
    id: `item-${i}`,
    name: `Item ${i}`,
    price: Math.random() * 10000,
    distance: Math.random() * 100,
    rating: Math.random() * 5,
  }));

  // Filter
  const filtered = items.filter(item =>
    item.price >= 1000 && item.price <= 5000 && item.distance <= 25
  );

  // Sort
  filtered.sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    return a.distance - b.distance;
  });

  // Take top 20
  const _results = filtered.slice(0, 20);
}

/**
 * Simulate distance calculation for multiple points
 */
function simulateDistanceCalculation(pointCount: number): void {
  const points = Array.from({ length: pointCount }, () => ({
    lat: 51 + Math.random() * 5,
    lng: -2 + Math.random() * 4,
  }));

  const center = { lat: 51.5074, lng: -0.1278 };

  // Calculate distances using Haversine formula
  const _distances = points.map(point => {
    const R = 3958.8; // Earth radius in miles
    const dLat = (point.lat - center.lat) * Math.PI / 180;
    const dLng = (point.lng - center.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(center.lat * Math.PI / 180) *
              Math.cos(point.lat * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  });
}

/**
 * Simulate date overlap checking for multiple bookings
 */
function simulateDateOverlapCheck(bookingCount: number): void {
  const bookings = Array.from({ length: bookingCount }, (_, i) => ({
    id: `booking-${i}`,
    startDate: new Date(2024, 0, 1 + i * 2),
    endDate: new Date(2024, 0, 2 + i * 2),
  }));

  const newBooking = {
    startDate: new Date(2024, 0, 15),
    endDate: new Date(2024, 0, 20),
  };

  // Check for overlaps with all existing bookings
  const _conflicts = bookings.filter(booking =>
    newBooking.startDate <= booking.endDate &&
    newBooking.endDate >= booking.startDate
  );
}

/**
 * Simulate fee calculation with multiple tiers
 */
function simulateFeeCalculation(calculationCount: number): void {
  const tiers = ['FREE', 'PRO', 'BUSINESS'];
  const feeRates = { FREE: 0.05, PRO: 0.03, BUSINESS: 0.02 };

  for (let i = 0; i < calculationCount; i++) {
    const amount = Math.floor(Math.random() * 100000) + 100;
    const tier = tiers[i % 3] as keyof typeof feeRates;
    const _fee = Math.round(amount * feeRates[tier]);
    const _vat = Math.round(_fee * 0.2);
    const _total = amount + _fee;
  }
}

/**
 * Simulate JSON serialization/deserialization
 */
function simulateJsonProcessing(objectCount: number): void {
  const objects = Array.from({ length: objectCount }, (_, i) => ({
    id: `obj-${i}`,
    data: {
      name: `Object ${i}`,
      properties: Array.from({ length: 10 }, (_, j) => ({
        key: `prop-${j}`,
        value: Math.random().toString(36),
      })),
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }));

  const json = JSON.stringify(objects);
  JSON.parse(json);
}

/**
 * Simulate array operations (map, filter, reduce)
 */
function simulateArrayOperations(size: number): void {
  const arr = Array.from({ length: size }, (_, i) => i);

  // Map
  const mapped = arr.map(x => x * 2);

  // Filter
  const filtered = mapped.filter(x => x % 3 === 0);

  // Reduce
  const _sum = filtered.reduce((acc, x) => acc + x, 0);
}

/**
 * Simulate string manipulation
 */
function simulateStringOperations(iterations: number): void {
  const templates = [
    'Hello, {name}! Your booking #{id} is confirmed.',
    'The total amount is £{amount} including £{vat} VAT.',
    'Your rental starts on {startDate} and ends on {endDate}.',
  ];

  for (let i = 0; i < iterations; i++) {
    const template = templates[i % templates.length];
    const _result = template
      .replace('{name}', 'John')
      .replace('{id}', String(i))
      .replace('{amount}', '100.00')
      .replace('{vat}', '20.00')
      .replace('{startDate}', '2024-01-15')
      .replace('{endDate}', '2024-01-20');
  }
}

// ============================================================================
// TEST CASES
// ============================================================================

const performanceTests: TestCase[] = [
  // -------------------------------------------------------------------------
  // SEARCH PERFORMANCE
  // -------------------------------------------------------------------------
  {
    name: 'Search: 100 items < 1ms',
    description: 'Small dataset search performance',
    category: 'Search Performance',
    run: async (): Promise<TestResult> => {
      const metrics = measureOperation(() => simulateSearchOperation(100), 100);
      return assert.true(
        metrics.p95 < 1,
        `100 items search p95: ${formatMs(metrics.p95)}`
      );
    },
  },
  {
    name: 'Search: 1000 items < 5ms',
    description: 'Medium dataset search performance',
    category: 'Search Performance',
    run: async (): Promise<TestResult> => {
      const metrics = measureOperation(() => simulateSearchOperation(1000), 100);
      return assert.true(
        metrics.p95 < 5,
        `1000 items search p95: ${formatMs(metrics.p95)}`
      );
    },
  },
  {
    name: 'Search: 10000 items < 50ms',
    description: 'Large dataset search performance',
    category: 'Search Performance',
    run: async (): Promise<TestResult> => {
      const metrics = measureOperation(() => simulateSearchOperation(10000), 50);
      return assert.true(
        metrics.p95 < 50,
        `10000 items search p95: ${formatMs(metrics.p95)}`
      );
    },
  },

  // -------------------------------------------------------------------------
  // DISTANCE CALCULATION PERFORMANCE
  // -------------------------------------------------------------------------
  {
    name: 'Distance: 100 points < 0.5ms',
    description: 'Nearby search distance calculation',
    category: 'Distance Calculation',
    run: async (): Promise<TestResult> => {
      const metrics = measureOperation(() => simulateDistanceCalculation(100), 100);
      return assert.true(
        metrics.p95 < 0.5,
        `100 points distance p95: ${formatMs(metrics.p95)}`
      );
    },
  },
  {
    name: 'Distance: 1000 points < 5ms',
    description: 'Wide area distance calculation',
    category: 'Distance Calculation',
    run: async (): Promise<TestResult> => {
      const metrics = measureOperation(() => simulateDistanceCalculation(1000), 100);
      return assert.true(
        metrics.p95 < 5,
        `1000 points distance p95: ${formatMs(metrics.p95)}`
      );
    },
  },

  // -------------------------------------------------------------------------
  // BOOKING VALIDATION PERFORMANCE
  // -------------------------------------------------------------------------
  {
    name: 'Overlap: 50 bookings < 0.1ms',
    description: 'Typical user booking history',
    category: 'Booking Validation',
    run: async (): Promise<TestResult> => {
      const metrics = measureOperation(() => simulateDateOverlapCheck(50), 1000);
      return assert.true(
        metrics.p95 < 0.1,
        `50 bookings overlap check p95: ${formatMs(metrics.p95)}`
      );
    },
  },
  {
    name: 'Overlap: 500 bookings < 1ms',
    description: 'Popular listing booking history',
    category: 'Booking Validation',
    run: async (): Promise<TestResult> => {
      const metrics = measureOperation(() => simulateDateOverlapCheck(500), 100);
      return assert.true(
        metrics.p95 < 1,
        `500 bookings overlap check p95: ${formatMs(metrics.p95)}`
      );
    },
  },

  // -------------------------------------------------------------------------
  // FEE CALCULATION PERFORMANCE
  // -------------------------------------------------------------------------
  {
    name: 'Fee: 100 calculations < 0.1ms',
    description: 'Batch fee calculation',
    category: 'Fee Calculation',
    run: async (): Promise<TestResult> => {
      const metrics = measureOperation(() => simulateFeeCalculation(100), 1000);
      return assert.true(
        metrics.p95 < 0.1,
        `100 fee calcs p95: ${formatMs(metrics.p95)}`
      );
    },
  },
  {
    name: 'Fee: 1000 calculations < 1ms',
    description: 'Report generation fee calculation',
    category: 'Fee Calculation',
    run: async (): Promise<TestResult> => {
      const metrics = measureOperation(() => simulateFeeCalculation(1000), 100);
      return assert.true(
        metrics.p95 < 1,
        `1000 fee calcs p95: ${formatMs(metrics.p95)}`
      );
    },
  },

  // -------------------------------------------------------------------------
  // JSON PROCESSING PERFORMANCE
  // -------------------------------------------------------------------------
  {
    name: 'JSON: 100 objects serialize/parse < 5ms',
    description: 'API response serialization',
    category: 'JSON Processing',
    run: async (): Promise<TestResult> => {
      const metrics = measureOperation(() => simulateJsonProcessing(100), 100);
      return assert.true(
        metrics.p95 < 5,
        `100 objects JSON p95: ${formatMs(metrics.p95)}`
      );
    },
  },
  {
    name: 'JSON: 1000 objects serialize/parse < 50ms',
    description: 'Large API response serialization',
    category: 'JSON Processing',
    run: async (): Promise<TestResult> => {
      const metrics = measureOperation(() => simulateJsonProcessing(1000), 50);
      return assert.true(
        metrics.p95 < 50,
        `1000 objects JSON p95: ${formatMs(metrics.p95)}`
      );
    },
  },

  // -------------------------------------------------------------------------
  // ARRAY OPERATIONS PERFORMANCE
  // -------------------------------------------------------------------------
  {
    name: 'Array: 10000 items map/filter/reduce < 5ms',
    description: 'Data transformation performance',
    category: 'Array Operations',
    run: async (): Promise<TestResult> => {
      const metrics = measureOperation(() => simulateArrayOperations(10000), 100);
      return assert.true(
        metrics.p95 < 5,
        `10000 items array ops p95: ${formatMs(metrics.p95)}`
      );
    },
  },
  {
    name: 'Array: 100000 items map/filter/reduce < 30ms',
    description: 'Large dataset transformation',
    category: 'Array Operations',
    run: async (): Promise<TestResult> => {
      const metrics = measureOperation(() => simulateArrayOperations(100000), 50);
      return assert.true(
        metrics.p95 < 30,
        `100000 items array ops p95: ${formatMs(metrics.p95)}`
      );
    },
  },

  // -------------------------------------------------------------------------
  // STRING OPERATIONS PERFORMANCE
  // -------------------------------------------------------------------------
  {
    name: 'String: 1000 template replacements < 5ms',
    description: 'Email/notification templating',
    category: 'String Operations',
    run: async (): Promise<TestResult> => {
      const metrics = measureOperation(() => simulateStringOperations(1000), 100);
      return assert.true(
        metrics.p95 < 5,
        `1000 string ops p95: ${formatMs(metrics.p95)}`
      );
    },
  },

  // -------------------------------------------------------------------------
  // SCALING TESTS
  // -------------------------------------------------------------------------
  {
    name: 'Scaling: Linear complexity verified',
    description: 'Verify O(n) scaling for search',
    category: 'Scaling',
    run: async (): Promise<TestResult> => {
      const metrics100 = measureOperation(() => simulateSearchOperation(100), 50);
      const metrics1000 = measureOperation(() => simulateSearchOperation(1000), 50);

      // Time should scale roughly linearly (within 20x for 10x data)
      const ratio = metrics1000.mean / metrics100.mean;

      if (ratio > 20) {
        return {
          passed: false,
          score: 50,
          details: `Scaling ratio ${ratio.toFixed(1)}x exceeds linear expectation`,
          error: 'Non-linear scaling detected',
        };
      }
      return {
        passed: true,
        score: 100,
        details: `Scaling ratio: ${ratio.toFixed(1)}x for 10x data (expected ~10x)`,
      };
    },
  },
  {
    name: 'Scaling: No quadratic bottleneck',
    description: 'Verify no O(n²) operations',
    category: 'Scaling',
    run: async (): Promise<TestResult> => {
      const metrics100 = measureOperation(() => simulateDistanceCalculation(100), 50);
      const metrics1000 = measureOperation(() => simulateDistanceCalculation(1000), 50);

      // For 10x data, time should be < 100x (would be quadratic)
      const ratio = metrics1000.mean / metrics100.mean;

      if (ratio > 50) {
        return {
          passed: false,
          score: 0,
          details: `Scaling ratio ${ratio.toFixed(1)}x suggests quadratic complexity`,
          error: 'Possible O(n²) detected',
        };
      }
      return {
        passed: true,
        score: 100,
        details: `Scaling ratio: ${ratio.toFixed(1)}x (no quadratic bottleneck)`,
      };
    },
  },

  // -------------------------------------------------------------------------
  // MEMORY EFFICIENCY
  // -------------------------------------------------------------------------
  {
    name: 'Memory: Large array creation < 100ms',
    description: 'Verify memory allocation efficiency',
    category: 'Memory',
    run: async (): Promise<TestResult> => {
      const metrics = measureOperation(() => {
        const arr = new Array(100000).fill(0).map((_, i) => ({ id: i, value: i * 2 }));
        arr.length; // Prevent optimization
      }, 20);

      return assert.true(
        metrics.p95 < 100,
        `100k object array creation p95: ${formatMs(metrics.p95)}`
      );
    },
  },
  {
    name: 'Memory: Object deep clone < 10ms',
    description: 'Complex object cloning performance',
    category: 'Memory',
    run: async (): Promise<TestResult> => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              data: Array.from({ length: 1000 }, (_, i) => ({
                id: i,
                nested: { value: i * 2 },
              })),
            },
          },
        },
      };

      const metrics = measureOperation(() => {
        JSON.parse(JSON.stringify(deepObject));
      }, 100);

      return assert.true(
        metrics.p95 < 10,
        `Deep object clone p95: ${formatMs(metrics.p95)}`
      );
    },
  },

  // -------------------------------------------------------------------------
  // BASELINE SUMMARY
  // -------------------------------------------------------------------------
  {
    name: 'Baseline: All operations within targets',
    description: 'Overall performance baseline verification',
    category: 'Baseline Summary',
    run: async (): Promise<TestResult> => {
      const operations = [
        { name: 'search', fn: () => simulateSearchOperation(500), target: 10 },
        { name: 'distance', fn: () => simulateDistanceCalculation(500), target: 5 },
        { name: 'overlap', fn: () => simulateDateOverlapCheck(100), target: 1 },
        { name: 'fee', fn: () => simulateFeeCalculation(500), target: 1 },
        { name: 'json', fn: () => simulateJsonProcessing(500), target: 20 },
      ];

      const results: string[] = [];
      let allPassed = true;

      for (const op of operations) {
        const metrics = measureOperation(op.fn, 50);
        const passed = metrics.p95 < op.target;
        if (!passed) allPassed = false;
        results.push(`${op.name}: ${formatMs(metrics.p95)} (target: ${op.target}ms)`);
      }

      return {
        passed: allPassed,
        score: allPassed ? 100 : 50,
        details: results.join(', '),
        error: allPassed ? undefined : 'Some operations exceeded targets',
      };
    },
  },
];

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runPerformanceTests(): Promise<void> {
  const runner = new QualityTestRunner('Performance Baseline Tests');
  runner.addTests(performanceTests);
  await runner.runAll();
}

export { performanceTests, runPerformanceTests };

if (process.argv[1]?.includes('baseline-tester')) {
  runPerformanceTests().catch(console.error);
}
