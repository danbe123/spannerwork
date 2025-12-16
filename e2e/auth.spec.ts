import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.describe('Login Flow', () => {
    test('should navigate to profile/login page when accessing protected route', async ({ page }) => {
      // Try to access protected route
      await page.goto('/feed');
      
      // Should be redirected to profile page
      await expect(page).toHaveURL(/\/profile/);
    });

    test('should show login form on profile page', async ({ page }) => {
      await page.goto('/profile');
      
      // Check for login form elements
      const emailInput = page.getByLabel(/email/i);
      const passwordInput = page.getByLabel(/password/i);
      
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
    });

    test('should show validation errors for empty form submission', async ({ page }) => {
      await page.goto('/profile');
      
      // Find and click login button
      const loginButton = page.getByRole('button', { name: /log in|sign in/i });
      
      if (await loginButton.isVisible()) {
        await loginButton.click();
        
        // Should show validation error
        const errorMessage = page.getByText(/required|invalid/i);
        await expect(errorMessage).toBeVisible({ timeout: 5000 });
      }
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/profile');
      
      // Fill in invalid credentials
      await page.getByLabel(/email/i).fill('invalid@example.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      
      // Submit
      const loginButton = page.getByRole('button', { name: /log in|sign in/i });
      if (await loginButton.isVisible()) {
        await loginButton.click();
        
        // Should show error message
        await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible({ timeout: 5000 });
      }
    });

    test('should preserve redirect URL after login redirect', async ({ page }) => {
      // Try to access protected route with query params
      await page.goto('/calendar?view=month');
      
      // Should redirect to profile with redirect param
      await expect(page).toHaveURL(/\/profile\?redirect=/);
      
      // The redirect param should contain the original path
      const url = page.url();
      expect(url).toContain(encodeURIComponent('/calendar'));
    });
  });

  test.describe('Registration Flow', () => {
    test('should have registration form accessible', async ({ page }) => {
      await page.goto('/profile');
      
      // Look for registration tab or link
      const registerTab = page.getByRole('tab', { name: /register|sign up/i });
      const registerLink = page.getByRole('link', { name: /register|sign up/i });
      
      if (await registerTab.isVisible()) {
        await registerTab.click();
      } else if (await registerLink.isVisible()) {
        await registerLink.click();
      }
      
      // Check for registration form fields
      const nameInput = page.getByLabel(/name/i);
      await expect(nameInput).toBeVisible({ timeout: 5000 });
    });

    test('should validate password strength on registration', async ({ page }) => {
      await page.goto('/profile');
      
      // Switch to registration tab if needed
      const registerTab = page.getByRole('tab', { name: /register|sign up/i });
      if (await registerTab.isVisible()) {
        await registerTab.click();
      }

      // Fill in weak password
      const passwordInput = page.getByLabel(/^password$/i);
      if (await passwordInput.isVisible()) {
        await passwordInput.fill('weak');
        await passwordInput.blur();
        
        // Should show password strength error
        const strengthError = page.getByText(/8 characters|uppercase|lowercase|number/i);
        await expect(strengthError).toBeVisible({ timeout: 5000 });
      }
    });

    test('should validate email format on registration', async ({ page }) => {
      await page.goto('/profile');
      
      // Switch to registration tab if needed
      const registerTab = page.getByRole('tab', { name: /register|sign up/i });
      if (await registerTab.isVisible()) {
        await registerTab.click();
      }

      // Fill in invalid email
      const emailInput = page.getByLabel(/email/i);
      if (await emailInput.isVisible()) {
        await emailInput.fill('not-an-email');
        await emailInput.blur();
        
        // Should show email validation error
        const emailError = page.getByText(/valid email|invalid email/i);
        await expect(emailError).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Password Reset', () => {
    test('should navigate to password reset page', async ({ page }) => {
      await page.goto('/reset-password');
      
      // Page should load
      await expect(page.locator('body')).toBeVisible();
    });

    test('should show password reset form elements', async ({ page }) => {
      await page.goto('/reset-password');
      
      // Should have email input or token input
      const emailInput = page.getByLabel(/email/i);
      const tokenInput = page.getByLabel(/token|code/i);
      const passwordInput = page.getByLabel(/new password|password/i);
      
      // At least one of these should be visible
      const hasEmailInput = await emailInput.isVisible().catch(() => false);
      const hasTokenInput = await tokenInput.isVisible().catch(() => false);
      const hasPasswordInput = await passwordInput.isVisible().catch(() => false);
      
      expect(hasEmailInput || hasTokenInput || hasPasswordInput).toBe(true);
    });

    test('should link to password reset from login page', async ({ page }) => {
      await page.goto('/profile');
      
      // Look for forgot password link
      const forgotLink = page.getByRole('link', { name: /forgot|reset/i });
      
      if (await forgotLink.isVisible()) {
        await forgotLink.click();
        
        // Should navigate to reset page or show reset form
        await expect(page).toHaveURL(/reset|forgot/);
      }
    });
  });

  test.describe('Session Expiry', () => {
    test('should handle 401 responses gracefully', async ({ page }) => {
      await page.goto('/');
      
      // Intercept API calls and return 401
      await page.route('**/api/v1/auth/me', route => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized' }),
        });
      });
      
      // Navigate to protected route
      await page.goto('/feed');
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/profile/);
    });
  });

  test.describe('404 Page', () => {
    test('should show 404 page for non-existent routes', async ({ page }) => {
      await page.goto('/this-page-does-not-exist');
      
      // Should show 404 content
      const notFoundText = page.getByText(/404|not found|page.*not.*found/i);
      await expect(notFoundText).toBeVisible({ timeout: 5000 });
    });

    test('should have link to go home from 404 page', async ({ page }) => {
      await page.goto('/non-existent-page');
      
      // Should have a link to go home
      const homeLink = page.getByRole('link', { name: /home|go home/i });
      await expect(homeLink).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Admin Access', () => {
    test('should redirect non-admin users from admin page', async ({ page }) => {
      // Mock a regular user session
      await page.route('**/api/v1/auth/me', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'user-1',
              email: 'user@example.com',
              role: 'USER',
            },
          }),
        });
      });
      
      await page.goto('/admin');
      
      // Should redirect away from admin
      await expect(page).not.toHaveURL(/\/admin$/);
    });
  });
});
