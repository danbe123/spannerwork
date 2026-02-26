/**
 * Quality Test Runner - Core Framework
 *
 * Orchestrates all quality tests and generates reports.
 * Similar to the AI prompt optimizer but for code logic.
 */

import * as fs from 'fs';

export interface TestCase {
  name: string;
  description: string;
  category: string;
  run: () => Promise<TestResult>;
}

export interface TestResult {
  passed: boolean;
  score: number;  // 0-100
  details: string;
  error?: string;
  duration?: number;
}

export interface TestSuiteResult {
  suite: string;
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  score: number;
  duration: number;
  results: Array<{
    name: string;
    category: string;
    passed: boolean;
    score: number;
    details: string;
    error?: string;
  }>;
}

export class QualityTestRunner {
  private tests: TestCase[] = [];
  private results: TestSuiteResult[] = [];
  private reportsDir = './scripts/quality/reports';

  constructor(private suiteName: string) {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  addTest(test: TestCase): void {
    this.tests.push(test);
  }

  addTests(tests: TestCase[]): void {
    this.tests.push(...tests);
  }

  async runAll(): Promise<TestSuiteResult> {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🧪 Running: ${this.suiteName}`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`Tests: ${this.tests.length}\n`);

    const startTime = Date.now();
    const results: TestSuiteResult['results'] = [];
    let passed = 0;
    let totalScore = 0;

    for (const test of this.tests) {
      process.stdout.write(`  Testing: ${test.name}... `);

      const testStart = Date.now();
      try {
        const result = await test.run();
        const duration = Date.now() - testStart;

        results.push({
          name: test.name,
          category: test.category,
          passed: result.passed,
          score: result.score,
          details: result.details,
          error: result.error,
        });

        if (result.passed) {
          passed++;
          console.log(`✅ ${result.score}% (${duration}ms)`);
        } else {
          console.log(`❌ ${result.score}% - ${result.error || result.details}`);
        }

        totalScore += result.score;
      } catch (error: any) {
        console.log(`💥 CRASH: ${error.message}`);
        results.push({
          name: test.name,
          category: test.category,
          passed: false,
          score: 0,
          details: 'Test crashed',
          error: error.message,
        });
      }
    }

    const suiteResult: TestSuiteResult = {
      suite: this.suiteName,
      timestamp: new Date().toISOString(),
      totalTests: this.tests.length,
      passed,
      failed: this.tests.length - passed,
      score: Math.round(totalScore / this.tests.length),
      duration: Date.now() - startTime,
      results,
    };

    this.results.push(suiteResult);
    this.printSummary(suiteResult);
    this.saveReport(suiteResult);

    return suiteResult;
  }

  private printSummary(result: TestSuiteResult): void {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📊 SUMMARY: ${result.suite}`);
    console.log(`${'─'.repeat(70)}`);
    console.log(`Score: ${result.score}%`);
    console.log(`Passed: ${result.passed}/${result.totalTests}`);
    console.log(`Duration: ${result.duration}ms`);

    // Group by category
    const byCategory: Record<string, { passed: number; total: number; score: number }> = {};
    for (const r of result.results) {
      if (!byCategory[r.category]) {
        byCategory[r.category] = { passed: 0, total: 0, score: 0 };
      }
      byCategory[r.category].total++;
      byCategory[r.category].score += r.score;
      if (r.passed) byCategory[r.category].passed++;
    }

    console.log(`\nBy Category:`);
    for (const [cat, stats] of Object.entries(byCategory)) {
      const avgScore = Math.round(stats.score / stats.total);
      const status = stats.passed === stats.total ? '✅' : '⚠️';
      console.log(`  ${status} ${cat}: ${stats.passed}/${stats.total} (${avgScore}%)`);
    }

    // Show failures
    const failures = result.results.filter(r => !r.passed);
    if (failures.length > 0) {
      console.log(`\n❌ Failures:`);
      for (const f of failures) {
        console.log(`  • ${f.name}: ${f.error || f.details}`);
      }
    }

    console.log(`${'═'.repeat(70)}\n`);
  }

  private saveReport(result: TestSuiteResult): void {
    const filename = `${this.suiteName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
    const filepath = `${this.reportsDir}/${filename}`;
    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
    console.log(`📄 Report saved: ${filepath}`);
  }
}

// Utility functions for test assertions
export const assert = {
  equals: <T>(actual: T, expected: T, message?: string): TestResult => {
    const passed = actual === expected;
    return {
      passed,
      score: passed ? 100 : 0,
      details: message || `Expected ${expected}, got ${actual}`,
      error: passed ? undefined : `Expected ${expected}, got ${actual}`,
    };
  },

  closeTo: (actual: number, expected: number, tolerance: number, message?: string): TestResult => {
    const diff = Math.abs(actual - expected);
    const passed = diff <= tolerance;
    const score = passed ? 100 : Math.max(0, 100 - (diff / expected) * 100);
    return {
      passed,
      score: Math.round(score),
      details: message || `Expected ~${expected} (±${tolerance}), got ${actual}`,
      error: passed ? undefined : `Difference ${diff} exceeds tolerance ${tolerance}`,
    };
  },

  true: (condition: boolean, message?: string): TestResult => ({
    passed: condition,
    score: condition ? 100 : 0,
    details: message || 'Condition check',
    error: condition ? undefined : message || 'Condition was false',
  }),

  false: (condition: boolean, message?: string): TestResult => ({
    passed: !condition,
    score: !condition ? 100 : 0,
    details: message || 'Condition check',
    error: !condition ? undefined : message || 'Condition was true',
  }),

  throws: async (fn: () => Promise<any>, expectedError?: string): Promise<TestResult> => {
    try {
      await fn();
      return {
        passed: false,
        score: 0,
        details: 'Expected function to throw',
        error: 'Function did not throw',
      };
    } catch (error: any) {
      const passed = !expectedError || error.message.includes(expectedError);
      return {
        passed,
        score: passed ? 100 : 50,
        details: `Threw: ${error.message}`,
        error: passed ? undefined : `Expected error containing "${expectedError}"`,
      };
    }
  },

  noThrow: async (fn: () => Promise<any>): Promise<TestResult> => {
    try {
      await fn();
      return {
        passed: true,
        score: 100,
        details: 'Function completed without error',
      };
    } catch (error: any) {
      return {
        passed: false,
        score: 0,
        details: 'Function should not throw',
        error: error.message,
      };
    }
  },
};

export default QualityTestRunner;
