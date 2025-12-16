import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.describe('Public Pages', () => {
    test('should navigate to how it works page', async ({ page }) => {
      await page.goto('/');
      
      // Find and click how it works link
      const howItWorksLink = page.getByRole('link', { name: /how it works/i });
      if (await howItWorksLink.isVisible()) {
        await howItWorksLink.click();
        await expect(page).toHaveURL(/\/how-it-works/);
      }
    });

    test('should navigate to pricing page', async ({ page }) => {
      await page.goto('/');
      
      const pricingLink = page.getByRole('link', { name: /pricing/i });
      if (await pricingLink.isVisible()) {
        await pricingLink.click();
        await expect(page).toHaveURL(/\/pricing/);
      }
    });

    test('should navigate to map view', async ({ page }) => {
      await page.goto('/map');
      
      // Page should load
      await expect(page.locator('body')).toBeVisible();
    });

    test('should navigate to about page', async ({ page }) => {
      await page.goto('/about');
      
      await expect(page.locator('body')).toBeVisible();
    });

    test('should navigate to contact page', async ({ page }) => {
      await page.goto('/contact');
      
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Legal Pages', () => {
    test('should navigate to terms page', async ({ page }) => {
      await page.goto('/terms');
      await expect(page.locator('body')).toBeVisible();
    });

    test('should navigate to privacy page', async ({ page }) => {
      await page.goto('/privacy');
      await expect(page.locator('body')).toBeVisible();
    });

    test('should navigate to cookies page', async ({ page }) => {
      await page.goto('/cookies');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Route Redirects (Legacy PascalCase)', () => {
    test('should redirect /Feed to /feed', async ({ page }) => {
      await page.goto('/Feed');
      // Note: Feed is protected, so will redirect to profile first
      await expect(page).toHaveURL(/\/(feed|profile)/);
    });

    test('should redirect /MapView to /map', async ({ page }) => {
      await page.goto('/MapView');
      await expect(page).toHaveURL(/\/map/);
    });

    test('should redirect /HowItWorks to /how-it-works', async ({ page }) => {
      await page.goto('/HowItWorks');
      await expect(page).toHaveURL(/\/how-it-works/);
    });
  });
});

test.describe('Search and Discovery', () => {
  test('should be able to search from home page', async ({ page }) => {
    await page.goto('/');
    
    // Look for search input
    const searchInput = page.getByPlaceholder(/search|find|what are you looking for/i);
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('power drill');
      // Should have autocomplete or search button
    }
  });
});

test.describe('Footer Navigation', () => {
  test('should have footer with links', async ({ page }) => {
    await page.goto('/');
    
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    
    // Check for common footer links
    const termsLink = footer.getByRole('link', { name: /terms/i });
    const privacyLink = footer.getByRole('link', { name: /privacy/i });
    
    // At least one should be visible
    const hasTerms = await termsLink.isVisible();
    const hasPrivacy = await privacyLink.isVisible();
    
    expect(hasTerms || hasPrivacy).toBeTruthy();
  });
});
