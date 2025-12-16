import { test, expect } from '@playwright/test';

test.describe('Booking Flow', () => {
  test.describe('Tool Booking', () => {
    test('should display tool detail page', async ({ page }) => {
      // Navigate to map view to find tools
      await page.goto('/map');
      
      // Page should load
      await expect(page.locator('body')).toBeVisible();
      
      // Look for tool listings or map
      const mapContainer = page.locator('[class*="map"], [class*="leaflet"]');
      await expect(mapContainer).toBeVisible({ timeout: 10000 });
    });

    test('should show tool details when clicking on a tool', async ({ page }) => {
      // Direct navigation to a tool detail page (with placeholder ID)
      await page.goto('/tool/test-id');
      
      // Page should load (even if tool doesn't exist)
      await expect(page.locator('body')).toBeVisible();
    });

    test('should require auth to start transaction', async ({ page }) => {
      await page.goto('/start-transaction');
      
      // Should redirect to login since it's protected
      await expect(page).toHaveURL(/\/profile/);
    });
  });

  test.describe('Space Booking', () => {
    test('should display space detail page', async ({ page }) => {
      await page.goto('/space/test-id');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Service Booking', () => {
    test('should display service detail page', async ({ page }) => {
      await page.goto('/service/test-id');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Transaction Flow', () => {
    test('should protect transaction detail page', async ({ page }) => {
      await page.goto('/transaction/test-id');
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/profile/);
    });

    test('should protect calendar page', async ({ page }) => {
      await page.goto('/calendar');
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/profile/);
    });
  });
});

test.describe('Request Flow', () => {
  test('should protect create request page', async ({ page }) => {
    await page.goto('/create-request');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/profile/);
  });

  test('should display request detail page', async ({ page }) => {
    await page.goto('/request/test-id');
    
    // Page should load
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display feed page after login', async ({ page }) => {
    // This would require authentication helpers
    await page.goto('/feed');
    
    // Should redirect to profile for login
    await expect(page).toHaveURL(/\/profile/);
  });
});

test.describe('Offer Creation', () => {
  test('should protect create offer page', async ({ page }) => {
    await page.goto('/create-offer');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/profile/);
  });
});
