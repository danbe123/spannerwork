import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    
    // Check for main heading or logo
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have navigation elements', async ({ page }) => {
    await page.goto('/');
    
    // Check for navigation links
    const nav = page.locator('nav, header');
    await expect(nav).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Page should still render
    await expect(page.locator('body')).toBeVisible();
  });
});
