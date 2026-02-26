/**
 * State Machine Validator
 *
 * Tests all entity state machines to ensure:
 * - Only valid transitions are allowed
 * - Terminal states are properly enforced
 * - All business rules are respected
 */

import { QualityTestRunner, TestCase, TestResult, assert } from '../core/test-runner.js';

// ============================================================================
// TRANSACTION STATE MACHINE
// ============================================================================

type TransactionStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED' | 'REFUNDED';
type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

const TRANSACTION_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'DISPUTED'],
  COMPLETED: [], // Terminal
  CANCELLED: [], // Terminal
  DISPUTED: ['COMPLETED', 'REFUNDED'],
  REFUNDED: [], // Terminal
};

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ['PAID', 'FAILED'],
  PAID: ['REFUNDED'],
  FAILED: [], // Terminal
  REFUNDED: [], // Terminal
};

// ============================================================================
// USER VERIFICATION STATE MACHINE
// ============================================================================

type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

const VERIFICATION_TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  UNVERIFIED: ['PENDING'],
  PENDING: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['SUSPENDED'],
  REJECTED: ['PENDING'], // Can resubmit
  SUSPENDED: ['VERIFIED'], // Can reinstate
};

// ============================================================================
// LISTING STATE MACHINE
// ============================================================================

type ListingStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'SUSPENDED' | 'DELETED';

const LISTING_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  DRAFT: ['ACTIVE', 'DELETED'],
  ACTIVE: ['PAUSED', 'SUSPENDED', 'DELETED'],
  PAUSED: ['ACTIVE', 'DELETED'],
  SUSPENDED: ['ACTIVE', 'DELETED'],
  DELETED: [], // Terminal
};

// ============================================================================
// DISPUTE STATE MACHINE
// ============================================================================

type DisputeStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';

const DISPUTE_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  OPEN: ['IN_REVIEW', 'CLOSED'],
  IN_REVIEW: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [], // Terminal
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isValidTransition<T extends string>(
  transitions: Record<T, T[]>,
  from: T,
  to: T
): boolean {
  return transitions[from]?.includes(to) ?? false;
}

function isTerminalState<T extends string>(transitions: Record<T, T[]>, state: T): boolean {
  return (transitions[state]?.length ?? 0) === 0;
}

function getAllStates<T extends string>(transitions: Record<T, T[]>): T[] {
  return Object.keys(transitions) as T[];
}

// ============================================================================
// TEST CASES
// ============================================================================

const stateMachineTests: TestCase[] = [
  // -------------------------------------------------------------------------
  // TRANSACTION STATUS TESTS
  // -------------------------------------------------------------------------
  {
    name: 'Transaction: PENDING → CONFIRMED',
    description: 'Payment authorized moves to confirmed',
    category: 'Transaction Status',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition(TRANSACTION_TRANSITIONS, 'PENDING', 'CONFIRMED'),
        'PENDING → CONFIRMED should be valid'
      );
    },
  },
  {
    name: 'Transaction: PENDING → CANCELLED',
    description: 'Payment failed cancels transaction',
    category: 'Transaction Status',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition(TRANSACTION_TRANSITIONS, 'PENDING', 'CANCELLED'),
        'PENDING → CANCELLED should be valid'
      );
    },
  },
  {
    name: 'Transaction: PENDING → COMPLETED invalid',
    description: 'Cannot skip confirmation step',
    category: 'Transaction Status',
    run: async (): Promise<TestResult> => {
      return assert.false(
        isValidTransition(TRANSACTION_TRANSITIONS, 'PENDING', 'COMPLETED'),
        'Cannot skip CONFIRMED step'
      );
    },
  },
  {
    name: 'Transaction: COMPLETED is terminal',
    description: 'Completed transactions cannot change',
    category: 'Transaction Status',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isTerminalState(TRANSACTION_TRANSITIONS, 'COMPLETED'),
        'COMPLETED should be terminal'
      );
    },
  },
  {
    name: 'Transaction: CANCELLED is terminal',
    description: 'Cancelled transactions cannot change',
    category: 'Transaction Status',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isTerminalState(TRANSACTION_TRANSITIONS, 'CANCELLED'),
        'CANCELLED should be terminal'
      );
    },
  },
  {
    name: 'Transaction: REFUNDED is terminal',
    description: 'Refunded transactions cannot change',
    category: 'Transaction Status',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isTerminalState(TRANSACTION_TRANSITIONS, 'REFUNDED'),
        'REFUNDED should be terminal'
      );
    },
  },
  {
    name: 'Transaction: DISPUTED can resolve',
    description: 'Disputes can be resolved to COMPLETED or REFUNDED',
    category: 'Transaction Status',
    run: async (): Promise<TestResult> => {
      const canComplete = isValidTransition(TRANSACTION_TRANSITIONS, 'DISPUTED', 'COMPLETED');
      const canRefund = isValidTransition(TRANSACTION_TRANSITIONS, 'DISPUTED', 'REFUNDED');
      return assert.true(
        canComplete && canRefund,
        'DISPUTED can resolve to COMPLETED or REFUNDED'
      );
    },
  },
  {
    name: 'Transaction: All states reachable from PENDING',
    description: 'All states should be reachable',
    category: 'Transaction Status',
    run: async (): Promise<TestResult> => {
      // BFS to check reachability
      const reachable = new Set<TransactionStatus>(['PENDING']);
      const queue: TransactionStatus[] = ['PENDING'];

      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const next of TRANSACTION_TRANSITIONS[current]) {
          if (!reachable.has(next)) {
            reachable.add(next);
            queue.push(next);
          }
        }
      }

      const allStates = getAllStates(TRANSACTION_TRANSITIONS);
      const unreachable = allStates.filter(s => !reachable.has(s));

      if (unreachable.length > 0) {
        return {
          passed: false,
          score: 0,
          details: `Unreachable states: ${unreachable.join(', ')}`,
          error: 'Some states cannot be reached',
        };
      }
      return {
        passed: true,
        score: 100,
        details: `All ${allStates.length} states reachable`,
      };
    },
  },

  // -------------------------------------------------------------------------
  // PAYMENT STATUS TESTS
  // -------------------------------------------------------------------------
  {
    name: 'Payment: PENDING → PAID',
    description: 'Payment success',
    category: 'Payment Status',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition(PAYMENT_TRANSITIONS, 'PENDING', 'PAID'),
        'PENDING → PAID should be valid'
      );
    },
  },
  {
    name: 'Payment: PENDING → FAILED',
    description: 'Payment failure',
    category: 'Payment Status',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition(PAYMENT_TRANSITIONS, 'PENDING', 'FAILED'),
        'PENDING → FAILED should be valid'
      );
    },
  },
  {
    name: 'Payment: PAID → REFUNDED',
    description: 'Refund after successful payment',
    category: 'Payment Status',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition(PAYMENT_TRANSITIONS, 'PAID', 'REFUNDED'),
        'PAID → REFUNDED should be valid'
      );
    },
  },
  {
    name: 'Payment: FAILED cannot refund',
    description: 'Cannot refund a failed payment',
    category: 'Payment Status',
    run: async (): Promise<TestResult> => {
      return assert.false(
        isValidTransition(PAYMENT_TRANSITIONS, 'FAILED', 'REFUNDED'),
        'FAILED → REFUNDED should be invalid'
      );
    },
  },

  // -------------------------------------------------------------------------
  // USER VERIFICATION TESTS
  // -------------------------------------------------------------------------
  {
    name: 'Verification: UNVERIFIED → PENDING',
    description: 'User submits documents',
    category: 'User Verification',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition(VERIFICATION_TRANSITIONS, 'UNVERIFIED', 'PENDING'),
        'UNVERIFIED → PENDING should be valid'
      );
    },
  },
  {
    name: 'Verification: PENDING → VERIFIED',
    description: 'Admin approves user',
    category: 'User Verification',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition(VERIFICATION_TRANSITIONS, 'PENDING', 'VERIFIED'),
        'PENDING → VERIFIED should be valid'
      );
    },
  },
  {
    name: 'Verification: REJECTED → PENDING',
    description: 'User can resubmit after rejection',
    category: 'User Verification',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition(VERIFICATION_TRANSITIONS, 'REJECTED', 'PENDING'),
        'REJECTED users can resubmit'
      );
    },
  },
  {
    name: 'Verification: VERIFIED → SUSPENDED',
    description: 'Admin can suspend verified user',
    category: 'User Verification',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition(VERIFICATION_TRANSITIONS, 'VERIFIED', 'SUSPENDED'),
        'VERIFIED → SUSPENDED should be valid'
      );
    },
  },
  {
    name: 'Verification: SUSPENDED → VERIFIED',
    description: 'Admin can reinstate suspended user',
    category: 'User Verification',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition(VERIFICATION_TRANSITIONS, 'SUSPENDED', 'VERIFIED'),
        'SUSPENDED → VERIFIED should be valid'
      );
    },
  },
  {
    name: 'Verification: Cannot skip to VERIFIED',
    description: 'UNVERIFIED cannot jump to VERIFIED',
    category: 'User Verification',
    run: async (): Promise<TestResult> => {
      return assert.false(
        isValidTransition(VERIFICATION_TRANSITIONS, 'UNVERIFIED', 'VERIFIED'),
        'Cannot skip PENDING step'
      );
    },
  },

  // -------------------------------------------------------------------------
  // LISTING STATUS TESTS
  // -------------------------------------------------------------------------
  {
    name: 'Listing: DRAFT → ACTIVE',
    description: 'Publishing a draft listing',
    category: 'Listing Status',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition(LISTING_TRANSITIONS, 'DRAFT', 'ACTIVE'),
        'DRAFT → ACTIVE should be valid'
      );
    },
  },
  {
    name: 'Listing: ACTIVE → PAUSED',
    description: 'Owner pauses listing',
    category: 'Listing Status',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition(LISTING_TRANSITIONS, 'ACTIVE', 'PAUSED'),
        'ACTIVE → PAUSED should be valid'
      );
    },
  },
  {
    name: 'Listing: PAUSED → ACTIVE',
    description: 'Owner resumes listing',
    category: 'Listing Status',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition(LISTING_TRANSITIONS, 'PAUSED', 'ACTIVE'),
        'PAUSED → ACTIVE should be valid'
      );
    },
  },
  {
    name: 'Listing: SUSPENDED → ACTIVE',
    description: 'Admin reinstates listing',
    category: 'Listing Status',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition(LISTING_TRANSITIONS, 'SUSPENDED', 'ACTIVE'),
        'SUSPENDED → ACTIVE should be valid'
      );
    },
  },
  {
    name: 'Listing: DELETED is terminal',
    description: 'Deleted listings cannot change',
    category: 'Listing Status',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isTerminalState(LISTING_TRANSITIONS, 'DELETED'),
        'DELETED should be terminal'
      );
    },
  },
  {
    name: 'Listing: Any → DELETED',
    description: 'Any state can transition to DELETED',
    category: 'Listing Status',
    run: async (): Promise<TestResult> => {
      const states = getAllStates(LISTING_TRANSITIONS).filter(s => s !== 'DELETED');
      for (const state of states) {
        if (!isValidTransition(LISTING_TRANSITIONS, state, 'DELETED')) {
          return {
            passed: false,
            score: 0,
            details: `${state} cannot transition to DELETED`,
            error: 'Soft delete should be available from any state',
          };
        }
      }
      return {
        passed: true,
        score: 100,
        details: 'All non-deleted states can delete',
      };
    },
  },

  // -------------------------------------------------------------------------
  // DISPUTE STATUS TESTS
  // -------------------------------------------------------------------------
  {
    name: 'Dispute: OPEN → IN_REVIEW',
    description: 'Admin starts review',
    category: 'Dispute Status',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition(DISPUTE_TRANSITIONS, 'OPEN', 'IN_REVIEW'),
        'OPEN → IN_REVIEW should be valid'
      );
    },
  },
  {
    name: 'Dispute: IN_REVIEW → RESOLVED',
    description: 'Admin resolves dispute',
    category: 'Dispute Status',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isValidTransition(DISPUTE_TRANSITIONS, 'IN_REVIEW', 'RESOLVED'),
        'IN_REVIEW → RESOLVED should be valid'
      );
    },
  },
  {
    name: 'Dispute: CLOSED is terminal',
    description: 'Closed disputes cannot reopen',
    category: 'Dispute Status',
    run: async (): Promise<TestResult> => {
      return assert.true(
        isTerminalState(DISPUTE_TRANSITIONS, 'CLOSED'),
        'CLOSED should be terminal'
      );
    },
  },

  // -------------------------------------------------------------------------
  // STATE MACHINE INTEGRITY
  // -------------------------------------------------------------------------
  {
    name: 'Integrity: No self-transitions',
    description: 'States should not transition to themselves',
    category: 'Integrity',
    run: async (): Promise<TestResult> => {
      const allMachines = [
        { name: 'Transaction', transitions: TRANSACTION_TRANSITIONS },
        { name: 'Payment', transitions: PAYMENT_TRANSITIONS },
        { name: 'Verification', transitions: VERIFICATION_TRANSITIONS },
        { name: 'Listing', transitions: LISTING_TRANSITIONS },
        { name: 'Dispute', transitions: DISPUTE_TRANSITIONS },
      ];

      for (const { name, transitions } of allMachines) {
        const states = Object.keys(transitions);
        for (const state of states) {
          if ((transitions as Record<string, string[]>)[state].includes(state)) {
            return {
              passed: false,
              score: 0,
              details: `${name}: ${state} can transition to itself`,
              error: 'Self-transitions are not allowed',
            };
          }
        }
      }
      return {
        passed: true,
        score: 100,
        details: 'No self-transitions found',
      };
    },
  },
  {
    name: 'Integrity: Terminal states have no outgoing',
    description: 'Terminal states should have empty transition lists',
    category: 'Integrity',
    run: async (): Promise<TestResult> => {
      const terminalStates = [
        { machine: 'Transaction', states: ['COMPLETED', 'CANCELLED', 'REFUNDED'] },
        { machine: 'Payment', states: ['FAILED', 'REFUNDED'] },
        { machine: 'Listing', states: ['DELETED'] },
        { machine: 'Dispute', states: ['CLOSED'] },
      ];

      for (const { machine, states } of terminalStates) {
        for (const state of states) {
          let transitions: string[] = [];
          if (machine === 'Transaction') transitions = TRANSACTION_TRANSITIONS[state as TransactionStatus];
          if (machine === 'Payment') transitions = PAYMENT_TRANSITIONS[state as PaymentStatus];
          if (machine === 'Listing') transitions = LISTING_TRANSITIONS[state as ListingStatus];
          if (machine === 'Dispute') transitions = DISPUTE_TRANSITIONS[state as DisputeStatus];

          if (transitions.length > 0) {
            return {
              passed: false,
              score: 0,
              details: `${machine}.${state} has outgoing transitions`,
              error: 'Terminal state should have no transitions',
            };
          }
        }
      }
      return {
        passed: true,
        score: 100,
        details: 'All terminal states properly configured',
      };
    },
  },
];

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runStateMachineTests(): Promise<void> {
  const runner = new QualityTestRunner('State Machine Validator');
  runner.addTests(stateMachineTests);
  await runner.runAll();
}

export { stateMachineTests, runStateMachineTests };

if (process.argv[1]?.includes('state-machine-tester')) {
  runStateMachineTests().catch(console.error);
}
