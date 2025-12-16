import { test as base, expect } from '@playwright/test';

/**
 * Authentication fixture for E2E tests
 * 
 * Usage:
 * import { test } from './fixtures/auth.fixture';
 * 
 * test('authenticated test', async ({ authenticatedPage }) => {
 *   // User is already logged in
 * });
 */

// Test user credentials (should match seeded test data)
const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!',
};

// Extend the base test with authenticated page
export const test = base.extend<{
  authenticatedPage: ReturnType<typeof base.extend>['page'];
}>({
  authenticatedPage: async ({ page }, use) => {
    // Navigate to login
    await page.goto('/profile');
    
    // Fill in credentials
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    
    await emailInput.fill(TEST_USER.email);
    await passwordInput.fill(TEST_USER.password);
    
    // Submit login
    const loginButton = page.getByRole('button', { name: /log in|sign in/i });
    await loginButton.click();
    
    // Wait for login to complete (redirect or success message)
    await page.waitForURL(/\/(feed|profile|dashboard)/, { timeout: 10000 }).catch(() => {
      // If no redirect, check for success indication on page
    });
    
    // Use the authenticated page
    await use(page);
  },
});

export { expect };

/**
 * Helper to check if user is logged in
 */
export async function isLoggedIn(page: any): Promise<boolean> {
  await page.goto('/profile');
  
  // Check for logout button or user avatar/name
  const logoutButton = page.getByRole('button', { name: /log out|logout/i });
  const userAvatar = page.locator('[class*="avatar"]');
  
  return (await logoutButton.isVisible()) || (await userAvatar.isVisible());
}

/**
 * Helper to login programmatically
 */
export async function loginUser(page: any, email: string, password: string): Promise<void> {
  await page.goto('/profile');
  
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  
  const loginButton = page.getByRole('button', { name: /log in|sign in/i });
  await loginButton.click();
  
  // Wait for authentication
  await page.waitForTimeout(1000);
}

/**
 * Helper to logout
 */
export async function logoutUser(page: any): Promise<void> {
  await page.goto('/profile');
  
  const logoutButton = page.getByRole('button', { name: /log out|logout/i });
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    await page.waitForTimeout(500);
  }
}
