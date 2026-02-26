#!/usr/bin/env npx tsx
/**
 * Master Quality Test Runner
 *
 * Runs all quality test suites and generates a comprehensive report.
 * Similar to the AI prompt optimizer but for code logic validation.
 *
 * Usage: npx tsx scripts/quality/run-all-tests.ts
 */

import { QualityTestRunner, TestSuiteResult } from './core/test-runner.js';
import { paymentTests } from './payment/escrow-tester.js';
import { feeTests } from './payment/fee-validator.js';
import { bookingTests } from './booking/race-condition-tester.js';
import { stateMachineTests } from './booking/state-machine-tester.js';
import { geoTests } from './geo/distance-validator.js';
import { inputTests } from './security/input-validator.js';
import { authIdorTests } from './security/auth-idor-tester.js';
import { performanceTests } from './performance/baseline-tester.js';
import * as fs from 'fs';

interface MasterReport {
  timestamp: string;
  overallScore: number;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  duration: number;
  suites: TestSuiteResult[];
  criticalFailures: Array<{
    suite: string;
    test: string;
    error: string;
  }>;
}

async function runAllTests(): Promise<void> {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║        SPANNERWORK MASTER QUALITY ASSURANCE SUITE                    ║');
  console.log('║              "Doctor Evil\'s Brainiac Due Diligence"                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  const startTime = Date.now();
  const results: TestSuiteResult[] = [];

  // Define all test suites
  const suites = [
    { name: 'Payment & Escrow Tests', tests: paymentTests },
    { name: 'Fee Calculation Validator', tests: feeTests },
    { name: 'Booking & Date Logic Tests', tests: bookingTests },
    { name: 'State Machine Validator', tests: stateMachineTests },
    { name: 'Geographic Distance Validator', tests: geoTests },
    { name: 'Input Validation & Security', tests: inputTests },
    { name: 'Authorization & IDOR Security', tests: authIdorTests },
    { name: 'Performance Baseline', tests: performanceTests },
  ];

  // Run each suite
  for (const { name, tests } of suites) {
    const runner = new QualityTestRunner(name);
    runner.addTests(tests);
    const result = await runner.runAll();
    results.push(result);
  }

  // Calculate overall metrics
  const totalTests = results.reduce((sum, r) => sum + r.totalTests, 0);
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const overallScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
  const duration = Date.now() - startTime;

  // Collect critical failures
  const criticalFailures: MasterReport['criticalFailures'] = [];
  for (const suite of results) {
    for (const test of suite.results) {
      if (!test.passed) {
        criticalFailures.push({
          suite: suite.suite,
          test: test.name,
          error: test.error || test.details,
        });
      }
    }
  }

  // Print master summary
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                    MASTER QUALITY REPORT                             ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');

  // Score visualization
  const scoreBar = '█'.repeat(Math.floor(overallScore / 5)) + '░'.repeat(20 - Math.floor(overallScore / 5));
  const scoreEmoji = overallScore >= 95 ? '🏆' : overallScore >= 80 ? '✅' : overallScore >= 60 ? '⚠️' : '❌';

  console.log(`║                                                                      ║`);
  console.log(`║   Overall Score: ${scoreEmoji} ${overallScore}%                                               `);
  console.log(`║   [${scoreBar}]                                           `);
  console.log(`║                                                                      ║`);
  console.log(`║   Total Tests:  ${totalTests.toString().padEnd(5)}                                            ║`);
  console.log(`║   Passed:       ${totalPassed.toString().padEnd(5)} ✅                                        ║`);
  console.log(`║   Failed:       ${totalFailed.toString().padEnd(5)} ${totalFailed > 0 ? '❌' : '  '}                                        ║`);
  console.log(`║   Duration:     ${duration}ms                                           `);
  console.log(`║                                                                      ║`);
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log('║   Suite Results:                                                     ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');

  for (const suite of results) {
    const status = suite.passed === suite.totalTests ? '✅' : '⚠️';
    const suiteName = suite.suite.padEnd(35);
    console.log(`║   ${status} ${suiteName} ${suite.passed}/${suite.totalTests} (${suite.score}%)      ║`);
  }

  if (criticalFailures.length > 0) {
    console.log('╠══════════════════════════════════════════════════════════════════════╣');
    console.log('║   ❌ FAILURES:                                                       ║');
    console.log('╠══════════════════════════════════════════════════════════════════════╣');
    for (const failure of criticalFailures.slice(0, 5)) {
      console.log(`║   • ${failure.test.substring(0, 40).padEnd(40)}           ║`);
      console.log(`║     ${failure.error.substring(0, 50).padEnd(50)}         ║`);
    }
    if (criticalFailures.length > 5) {
      console.log(`║   ... and ${criticalFailures.length - 5} more failures                                    ║`);
    }
  }

  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  // Quality grade
  let grade = 'F';
  if (overallScore >= 98) grade = 'A+';
  else if (overallScore >= 95) grade = 'A';
  else if (overallScore >= 90) grade = 'A-';
  else if (overallScore >= 85) grade = 'B+';
  else if (overallScore >= 80) grade = 'B';
  else if (overallScore >= 75) grade = 'B-';
  else if (overallScore >= 70) grade = 'C+';
  else if (overallScore >= 65) grade = 'C';
  else if (overallScore >= 60) grade = 'C-';
  else if (overallScore >= 50) grade = 'D';

  console.log(`\n   Quality Grade: ${grade}`);
  console.log(`   ${overallScore >= 95 ? '🎉 EXCELLENT! Code is production-ready.' : overallScore >= 80 ? '👍 Good quality. Minor improvements possible.' : '⚠️ Needs attention before production.'}`);

  // Save master report
  const report: MasterReport = {
    timestamp: new Date().toISOString(),
    overallScore,
    totalTests,
    totalPassed,
    totalFailed,
    duration,
    suites: results,
    criticalFailures,
  };

  const reportsDir = './scripts/quality/reports';
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = `${reportsDir}/master-report-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Master report saved: ${reportPath}\n`);

  // Exit with error code if failures
  if (totalFailed > 0) {
    process.exit(1);
  }
}

// Run if executed directly
runAllTests().catch(console.error);
