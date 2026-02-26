/**
 * Authorization & IDOR Security Test Suite
 *
 * Tests authorization controls and Insecure Direct Object Reference (IDOR) prevention.
 * Validates that users can only access resources they're authorized for.
 */

import { QualityTestRunner, TestCase, TestResult, assert } from '../core/test-runner.js';

// ============================================================================
// MOCK USER ROLES AND PERMISSIONS
// ============================================================================

type UserRole = 'GUEST' | 'USER' | 'PROVIDER' | 'ADMIN';
type ResourceType = 'USER' | 'LISTING' | 'TRANSACTION' | 'MESSAGE' | 'REVIEW' | 'PAYOUT';
type Action = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE';

interface User {
  id: string;
  role: UserRole;
  isVerified: boolean;
  isBanned: boolean;
}

interface Resource {
  id: string;
  type: ResourceType;
  ownerId: string;
  isPublic?: boolean;
}

// ============================================================================
// PERMISSION MATRIX
// ============================================================================

const PERMISSIONS: Record<UserRole, Record<ResourceType, Action[]>> = {
  GUEST: {
    USER: ['READ'],          // Can view public profiles
    LISTING: ['READ'],       // Can view active listings
    TRANSACTION: [],         // No access
    MESSAGE: [],             // No access
    REVIEW: ['READ'],        // Can view reviews
    PAYOUT: [],              // No access
  },
  USER: {
    USER: ['READ', 'UPDATE'],      // Own profile only
    LISTING: ['READ', 'CREATE'],   // Can create listings
    TRANSACTION: ['READ', 'CREATE'], // Own transactions
    MESSAGE: ['READ', 'CREATE'],   // Own messages
    REVIEW: ['READ', 'CREATE'],    // Can create reviews
    PAYOUT: [],                     // No access
  },
  PROVIDER: {
    USER: ['READ', 'UPDATE'],
    LISTING: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
    TRANSACTION: ['READ', 'CREATE', 'UPDATE'],
    MESSAGE: ['READ', 'CREATE'],
    REVIEW: ['READ', 'CREATE'],
    PAYOUT: ['READ', 'CREATE'],    // Can manage payouts
  },
  ADMIN: {
    USER: ['READ', 'UPDATE', 'DELETE'],
    LISTING: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
    TRANSACTION: ['READ', 'UPDATE', 'DELETE'],
    MESSAGE: ['READ', 'DELETE'],
    REVIEW: ['READ', 'UPDATE', 'DELETE'],
    PAYOUT: ['READ', 'UPDATE', 'DELETE'],
  },
};

// ============================================================================
// AUTHORIZATION FUNCTIONS (mirrors actual implementation logic)
// ============================================================================

/**
 * Check if a user has permission for an action on a resource type
 */
function hasPermission(user: User, resourceType: ResourceType, action: Action): boolean {
  // Banned users have no permissions
  if (user.isBanned) {
    return false;
  }

  const rolePermissions = PERMISSIONS[user.role];
  if (!rolePermissions) {
    return false;
  }

  const resourcePermissions = rolePermissions[resourceType];
  return resourcePermissions?.includes(action) ?? false;
}

/**
 * Check if a user can access a specific resource (IDOR prevention)
 */
function canAccessResource(user: User, resource: Resource, action: Action): boolean {
  // First check role-based permission
  if (!hasPermission(user, resource.type, action)) {
    return false;
  }

  // Admin can access everything
  if (user.role === 'ADMIN') {
    return true;
  }

  // For READ, check if resource is public or owned by user
  if (action === 'READ') {
    if (resource.isPublic) {
      return true;
    }
    return resource.ownerId === user.id;
  }

  // For CREATE, permission check is enough
  if (action === 'CREATE') {
    return true;
  }

  // For UPDATE/DELETE, must be owner
  return resource.ownerId === user.id;
}

/**
 * Validate that a user cannot access another user's data (IDOR check)
 */
function validateIdorProtection(
  requestingUserId: string,
  targetResourceOwnerId: string,
  action: Action,
  allowedActions: Action[] = ['READ']
): boolean {
  // If accessing own resource, always allowed for allowed actions
  if (requestingUserId === targetResourceOwnerId) {
    return true;
  }

  // Otherwise, only READ of public resources might be allowed
  // Modification of others' resources should always be blocked
  if (['UPDATE', 'DELETE'].includes(action)) {
    return false;
  }

  // For read, depends on public status (handled elsewhere)
  return allowedActions.includes(action);
}

/**
 * Check if verification is required for an action
 */
function requiresVerification(action: Action, resourceType: ResourceType): boolean {
  // Creating listings, becoming a provider, accessing payouts requires verification
  if (resourceType === 'LISTING' && action === 'CREATE') return true;
  if (resourceType === 'PAYOUT') return true;
  if (resourceType === 'TRANSACTION' && action === 'CREATE') return true;
  return false;
}

/**
 * Full authorization check
 */
function isAuthorized(user: User, resource: Resource, action: Action): {
  allowed: boolean;
  reason?: string;
} {
  // Check banned status
  if (user.isBanned) {
    return { allowed: false, reason: 'User is banned' };
  }

  // Check verification requirements
  if (requiresVerification(action, resource.type) && !user.isVerified) {
    return { allowed: false, reason: 'Verification required' };
  }

  // Check role-based permission
  if (!hasPermission(user, resource.type, action)) {
    return { allowed: false, reason: 'Insufficient role permissions' };
  }

  // Check ownership (IDOR protection)
  if (!canAccessResource(user, resource, action)) {
    return { allowed: false, reason: 'Not authorized to access this resource' };
  }

  return { allowed: true };
}

// ============================================================================
// TEST CASES
// ============================================================================

const authIdorTests: TestCase[] = [
  // -------------------------------------------------------------------------
  // ROLE-BASED ACCESS CONTROL
  // -------------------------------------------------------------------------
  {
    name: 'RBAC: Guest can only read public listings',
    description: 'Guest users have read-only access to public content',
    category: 'Role-Based Access',
    run: async (): Promise<TestResult> => {
      const guest: User = { id: 'guest', role: 'GUEST', isVerified: false, isBanned: false };

      const canRead = hasPermission(guest, 'LISTING', 'READ');
      const canCreate = hasPermission(guest, 'LISTING', 'CREATE');
      const canUpdate = hasPermission(guest, 'LISTING', 'UPDATE');
      const canDelete = hasPermission(guest, 'LISTING', 'DELETE');

      if (!canRead) {
        return { passed: false, score: 0, details: 'Guest should be able to read listings', error: 'Read denied' };
      }
      if (canCreate || canUpdate || canDelete) {
        return { passed: false, score: 0, details: 'Guest should not modify listings', error: 'Write allowed' };
      }
      return { passed: true, score: 100, details: 'Guest access properly restricted' };
    },
  },
  {
    name: 'RBAC: User can create but not delete listings',
    description: 'Regular users can create listings but not delete them',
    category: 'Role-Based Access',
    run: async (): Promise<TestResult> => {
      const user: User = { id: 'user1', role: 'USER', isVerified: true, isBanned: false };

      const canCreate = hasPermission(user, 'LISTING', 'CREATE');
      const canDelete = hasPermission(user, 'LISTING', 'DELETE');

      if (!canCreate) {
        return { passed: false, score: 0, details: 'User should create listings', error: 'Create denied' };
      }
      if (canDelete) {
        return { passed: false, score: 50, details: 'User should not delete listings directly', error: 'Delete allowed' };
      }
      return { passed: true, score: 100, details: 'User permissions correct' };
    },
  },
  {
    name: 'RBAC: Provider has payout access',
    description: 'Providers can manage their payouts',
    category: 'Role-Based Access',
    run: async (): Promise<TestResult> => {
      const provider: User = { id: 'prov1', role: 'PROVIDER', isVerified: true, isBanned: false };
      const user: User = { id: 'user1', role: 'USER', isVerified: true, isBanned: false };

      const providerAccess = hasPermission(provider, 'PAYOUT', 'READ');
      const userAccess = hasPermission(user, 'PAYOUT', 'READ');

      if (!providerAccess) {
        return { passed: false, score: 0, details: 'Provider should access payouts', error: 'Access denied' };
      }
      if (userAccess) {
        return { passed: false, score: 50, details: 'User should not access payouts', error: 'User has payout access' };
      }
      return { passed: true, score: 100, details: 'Payout permissions correct' };
    },
  },
  {
    name: 'RBAC: Admin has full access',
    description: 'Admin users have complete access to all resources',
    category: 'Role-Based Access',
    run: async (): Promise<TestResult> => {
      const admin: User = { id: 'admin1', role: 'ADMIN', isVerified: true, isBanned: false };

      const resourceTypes: ResourceType[] = ['USER', 'LISTING', 'TRANSACTION', 'MESSAGE', 'REVIEW', 'PAYOUT'];

      for (const resourceType of resourceTypes) {
        const canRead = hasPermission(admin, resourceType, 'READ');
        if (!canRead) {
          return { passed: false, score: 0, details: `Admin should read ${resourceType}`, error: 'Access denied' };
        }
      }
      return { passed: true, score: 100, details: 'Admin has full access' };
    },
  },

  // -------------------------------------------------------------------------
  // IDOR PROTECTION
  // -------------------------------------------------------------------------
  {
    name: 'IDOR: User cannot read other user private profile',
    description: 'Users cannot access private data of other users',
    category: 'IDOR Protection',
    run: async (): Promise<TestResult> => {
      const user1: User = { id: 'user1', role: 'USER', isVerified: true, isBanned: false };
      const user2Profile: Resource = { id: 'profile2', type: 'USER', ownerId: 'user2', isPublic: false };

      const result = isAuthorized(user1, user2Profile, 'READ');

      return assert.false(result.allowed, 'User should not read private profiles of others');
    },
  },
  {
    name: 'IDOR: User can read own profile',
    description: 'Users can access their own data',
    category: 'IDOR Protection',
    run: async (): Promise<TestResult> => {
      const user: User = { id: 'user1', role: 'USER', isVerified: true, isBanned: false };
      const ownProfile: Resource = { id: 'profile1', type: 'USER', ownerId: 'user1', isPublic: false };

      const result = isAuthorized(user, ownProfile, 'READ');

      return assert.true(result.allowed, 'User should read own profile');
    },
  },
  {
    name: 'IDOR: User cannot update other user listing',
    description: 'Users cannot modify listings they do not own',
    category: 'IDOR Protection',
    run: async (): Promise<TestResult> => {
      const user1: User = { id: 'user1', role: 'PROVIDER', isVerified: true, isBanned: false };
      const user2Listing: Resource = { id: 'listing2', type: 'LISTING', ownerId: 'user2' };

      const result = isAuthorized(user1, user2Listing, 'UPDATE');

      return assert.false(result.allowed, 'User should not update others listings');
    },
  },
  {
    name: 'IDOR: User cannot delete other user listing',
    description: 'Users cannot delete listings they do not own',
    category: 'IDOR Protection',
    run: async (): Promise<TestResult> => {
      const user1: User = { id: 'user1', role: 'PROVIDER', isVerified: true, isBanned: false };
      const user2Listing: Resource = { id: 'listing2', type: 'LISTING', ownerId: 'user2' };

      const result = isAuthorized(user1, user2Listing, 'DELETE');

      return assert.false(result.allowed, 'User should not delete others listings');
    },
  },
  {
    name: 'IDOR: User cannot access other user transactions',
    description: 'Transaction data is private to involved parties',
    category: 'IDOR Protection',
    run: async (): Promise<TestResult> => {
      const user1: User = { id: 'user1', role: 'USER', isVerified: true, isBanned: false };
      const otherTransaction: Resource = { id: 'tx2', type: 'TRANSACTION', ownerId: 'user2' };

      const result = isAuthorized(user1, otherTransaction, 'READ');

      return assert.false(result.allowed, 'User should not read others transactions');
    },
  },
  {
    name: 'IDOR: User cannot access other user messages',
    description: 'Messages are private to conversation participants',
    category: 'IDOR Protection',
    run: async (): Promise<TestResult> => {
      const user1: User = { id: 'user1', role: 'USER', isVerified: true, isBanned: false };
      const otherMessage: Resource = { id: 'msg2', type: 'MESSAGE', ownerId: 'user2' };

      const result = isAuthorized(user1, otherMessage, 'READ');

      return assert.false(result.allowed, 'User should not read others messages');
    },
  },
  {
    name: 'IDOR: User cannot access other user payout info',
    description: 'Payout information is strictly private',
    category: 'IDOR Protection',
    run: async (): Promise<TestResult> => {
      const user1: User = { id: 'user1', role: 'PROVIDER', isVerified: true, isBanned: false };
      const otherPayout: Resource = { id: 'payout2', type: 'PAYOUT', ownerId: 'user2' };

      const result = isAuthorized(user1, otherPayout, 'READ');

      return assert.false(result.allowed, 'User should not read others payout info');
    },
  },
  {
    name: 'IDOR: Admin CAN access other user data',
    description: 'Admin users bypass IDOR restrictions',
    category: 'IDOR Protection',
    run: async (): Promise<TestResult> => {
      const admin: User = { id: 'admin1', role: 'ADMIN', isVerified: true, isBanned: false };
      const userProfile: Resource = { id: 'profile2', type: 'USER', ownerId: 'user2', isPublic: false };

      const result = isAuthorized(admin, userProfile, 'READ');

      return assert.true(result.allowed, 'Admin should access any user data');
    },
  },

  // -------------------------------------------------------------------------
  // BANNED USER RESTRICTIONS
  // -------------------------------------------------------------------------
  {
    name: 'Banned: Cannot read any resource',
    description: 'Banned users have no permissions',
    category: 'Banned User',
    run: async (): Promise<TestResult> => {
      const bannedUser: User = { id: 'banned1', role: 'USER', isVerified: true, isBanned: true };
      const publicListing: Resource = { id: 'listing1', type: 'LISTING', ownerId: 'owner1', isPublic: true };

      const result = isAuthorized(bannedUser, publicListing, 'READ');

      return assert.false(result.allowed, 'Banned user should have no access');
    },
  },
  {
    name: 'Banned: Cannot create transactions',
    description: 'Banned users cannot make bookings',
    category: 'Banned User',
    run: async (): Promise<TestResult> => {
      const bannedUser: User = { id: 'banned1', role: 'USER', isVerified: true, isBanned: true };
      const newTx: Resource = { id: 'new', type: 'TRANSACTION', ownerId: 'banned1' };

      const result = isAuthorized(bannedUser, newTx, 'CREATE');

      if (result.allowed) {
        return { passed: false, score: 0, details: 'Banned user should not create transactions', error: 'Create allowed' };
      }
      if (result.reason !== 'User is banned') {
        return { passed: false, score: 50, details: 'Wrong rejection reason', error: result.reason };
      }
      return { passed: true, score: 100, details: 'Banned user correctly blocked' };
    },
  },
  {
    name: 'Banned: Even admin role banned is blocked',
    description: 'Banned status overrides admin role',
    category: 'Banned User',
    run: async (): Promise<TestResult> => {
      const bannedAdmin: User = { id: 'badmin', role: 'ADMIN', isVerified: true, isBanned: true };
      const resource: Resource = { id: 'any', type: 'USER', ownerId: 'other' };

      const result = isAuthorized(bannedAdmin, resource, 'READ');

      return assert.false(result.allowed, 'Even banned admin should be blocked');
    },
  },

  // -------------------------------------------------------------------------
  // VERIFICATION REQUIREMENTS
  // -------------------------------------------------------------------------
  {
    name: 'Verification: Unverified cannot create listings',
    description: 'Listing creation requires verified account',
    category: 'Verification',
    run: async (): Promise<TestResult> => {
      const unverified: User = { id: 'user1', role: 'USER', isVerified: false, isBanned: false };
      const newListing: Resource = { id: 'new', type: 'LISTING', ownerId: 'user1' };

      const result = isAuthorized(unverified, newListing, 'CREATE');

      if (result.allowed) {
        return { passed: false, score: 0, details: 'Unverified should not create listings', error: 'Create allowed' };
      }
      if (result.reason !== 'Verification required') {
        return { passed: false, score: 50, details: 'Wrong rejection reason', error: result.reason };
      }
      return { passed: true, score: 100, details: 'Verification requirement enforced' };
    },
  },
  {
    name: 'Verification: Unverified cannot access payouts',
    description: 'Payout access requires verification',
    category: 'Verification',
    run: async (): Promise<TestResult> => {
      const unverified: User = { id: 'prov1', role: 'PROVIDER', isVerified: false, isBanned: false };
      const payout: Resource = { id: 'payout1', type: 'PAYOUT', ownerId: 'prov1' };

      const result = isAuthorized(unverified, payout, 'READ');

      return assert.false(result.allowed, 'Unverified provider should not access payouts');
    },
  },
  {
    name: 'Verification: Verified user CAN create listings',
    description: 'Verified accounts can create listings',
    category: 'Verification',
    run: async (): Promise<TestResult> => {
      const verified: User = { id: 'user1', role: 'USER', isVerified: true, isBanned: false };
      const newListing: Resource = { id: 'new', type: 'LISTING', ownerId: 'user1' };

      const result = isAuthorized(verified, newListing, 'CREATE');

      return assert.true(result.allowed, 'Verified user should create listings');
    },
  },

  // -------------------------------------------------------------------------
  // PUBLIC VS PRIVATE RESOURCES
  // -------------------------------------------------------------------------
  {
    name: 'Public: Anyone can read public listings',
    description: 'Public listings are accessible to all users',
    category: 'Public Access',
    run: async (): Promise<TestResult> => {
      const guest: User = { id: 'guest', role: 'GUEST', isVerified: false, isBanned: false };
      const publicListing: Resource = { id: 'listing1', type: 'LISTING', ownerId: 'owner1', isPublic: true };

      const result = isAuthorized(guest, publicListing, 'READ');

      return assert.true(result.allowed, 'Public listings should be readable by anyone');
    },
  },
  {
    name: 'Public: Cannot update public listing not owned',
    description: 'Even public listings cannot be modified by non-owners',
    category: 'Public Access',
    run: async (): Promise<TestResult> => {
      const user: User = { id: 'user1', role: 'PROVIDER', isVerified: true, isBanned: false };
      const publicListing: Resource = { id: 'listing2', type: 'LISTING', ownerId: 'owner2', isPublic: true };

      const result = isAuthorized(user, publicListing, 'UPDATE');

      return assert.false(result.allowed, 'Cannot update public listing not owned');
    },
  },
  {
    name: 'Public: Anyone can read public reviews',
    description: 'Reviews are publicly readable',
    category: 'Public Access',
    run: async (): Promise<TestResult> => {
      const guest: User = { id: 'guest', role: 'GUEST', isVerified: false, isBanned: false };
      const review: Resource = { id: 'review1', type: 'REVIEW', ownerId: 'user1', isPublic: true };

      const result = isAuthorized(guest, review, 'READ');

      return assert.true(result.allowed, 'Reviews should be publicly readable');
    },
  },

  // -------------------------------------------------------------------------
  // ROLE ESCALATION PREVENTION
  // -------------------------------------------------------------------------
  {
    name: 'Escalation: Regular user cannot access admin endpoints',
    description: 'Users cannot escalate to admin privileges',
    category: 'Escalation Prevention',
    run: async (): Promise<TestResult> => {
      const user: User = { id: 'user1', role: 'USER', isVerified: true, isBanned: false };
      const otherUser: Resource = { id: 'user2', type: 'USER', ownerId: 'user2' };

      // Regular user trying to delete another user (admin action)
      const result = isAuthorized(user, otherUser, 'DELETE');

      return assert.false(result.allowed, 'User cannot perform admin actions');
    },
  },
  {
    name: 'Escalation: Provider cannot delete transactions',
    description: 'Providers cannot delete transaction records',
    category: 'Escalation Prevention',
    run: async (): Promise<TestResult> => {
      const provider: User = { id: 'prov1', role: 'PROVIDER', isVerified: true, isBanned: false };
      const tx: Resource = { id: 'tx1', type: 'TRANSACTION', ownerId: 'prov1' };

      // Provider trying to delete own transaction
      const result = isAuthorized(provider, tx, 'DELETE');

      return assert.false(result.allowed, 'Provider cannot delete transactions');
    },
  },

  // -------------------------------------------------------------------------
  // COMPREHENSIVE IDOR SCENARIOS
  // -------------------------------------------------------------------------
  {
    name: 'IDOR Matrix: User ID manipulation blocked',
    description: 'Changing user ID in request does not grant access',
    category: 'IDOR Matrix',
    run: async (): Promise<TestResult> => {
      // Simulate attacker trying to access different user IDs
      const attacker: User = { id: 'attacker', role: 'USER', isVerified: true, isBanned: false };
      const victimIds = ['victim1', 'victim2', 'admin', 'system'];

      for (const victimId of victimIds) {
        const victimResource: Resource = { id: 'private', type: 'USER', ownerId: victimId, isPublic: false };
        const result = isAuthorized(attacker, victimResource, 'READ');

        if (result.allowed) {
          return {
            passed: false,
            score: 0,
            details: `IDOR vulnerability: accessed ${victimId} data`,
            error: 'User ID manipulation succeeded',
          };
        }
      }
      return { passed: true, score: 100, details: 'All user ID manipulations blocked' };
    },
  },
  {
    name: 'IDOR Matrix: Listing ID manipulation blocked',
    description: 'Changing listing ID in request does not grant update access',
    category: 'IDOR Matrix',
    run: async (): Promise<TestResult> => {
      const attacker: User = { id: 'attacker', role: 'PROVIDER', isVerified: true, isBanned: false };
      const targetListings = ['listing1', 'listing2', 'listing999'];

      for (const listingId of targetListings) {
        const listing: Resource = { id: listingId, type: 'LISTING', ownerId: 'victim' };
        const result = isAuthorized(attacker, listing, 'UPDATE');

        if (result.allowed) {
          return {
            passed: false,
            score: 0,
            details: `IDOR: updated listing ${listingId}`,
            error: 'Listing ID manipulation succeeded',
          };
        }
      }
      return { passed: true, score: 100, details: 'All listing ID manipulations blocked' };
    },
  },
  {
    name: 'IDOR Matrix: Transaction ID manipulation blocked',
    description: 'Cannot access transactions by guessing IDs',
    category: 'IDOR Matrix',
    run: async (): Promise<TestResult> => {
      const attacker: User = { id: 'attacker', role: 'USER', isVerified: true, isBanned: false };
      const targetTxIds = ['tx001', 'tx002', 'tx999', 'uuid-1234-5678'];

      for (const txId of targetTxIds) {
        const tx: Resource = { id: txId, type: 'TRANSACTION', ownerId: 'victim' };
        const result = isAuthorized(attacker, tx, 'READ');

        if (result.allowed) {
          return {
            passed: false,
            score: 0,
            details: `IDOR: read transaction ${txId}`,
            error: 'Transaction ID manipulation succeeded',
          };
        }
      }
      return { passed: true, score: 100, details: 'All transaction ID manipulations blocked' };
    },
  },
];

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runAuthIdorTests(): Promise<void> {
  const runner = new QualityTestRunner('Authorization & IDOR Security Tests');
  runner.addTests(authIdorTests);
  await runner.runAll();
}

export { authIdorTests, runAuthIdorTests };

if (process.argv[1]?.includes('auth-idor-tester')) {
  runAuthIdorTests().catch(console.error);
}
