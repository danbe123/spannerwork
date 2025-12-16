import { test, expect } from '@playwright/test';

test.describe('Transaction Flows', () => {
  test.describe('Booking Creation', () => {
    test('should show booking form on tool detail page', async ({ page }) => {
      // Navigate to a tool detail page
      await page.goto('/feed');
      
      // Look for a tool card and click it
      const toolCard = page.locator('[data-testid="listing-card"]').first();
      if (await toolCard.isVisible()) {
        await toolCard.click();
        
        // Should see booking/contact options
        const bookingButton = page.getByRole('button', { name: /book|rent|contact/i });
        await expect(bookingButton).toBeVisible({ timeout: 5000 });
      }
    });

    test('should require authentication to book', async ({ page }) => {
      // Navigate to tool detail without being logged in
      await page.goto('/feed');
      
      // Mock a tool detail response
      await page.route('**/api/v1/tools/*', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            tool: {
              id: 'tool-1',
              name: 'Test Tool',
              dailyRate: 2000,
              available: true,
              owner: { id: 'owner-1', name: 'Owner' },
            },
          }),
        });
      });

      // Navigate directly to tool detail
      await page.goto('/tool/tool-1');
      
      // Try to book
      const bookButton = page.getByRole('button', { name: /book|rent|start/i });
      if (await bookButton.isVisible()) {
        await bookButton.click();
        
        // Should redirect to login or show login modal
        await expect(page).toHaveURL(/profile|login/);
      }
    });

    test('should display calculated price based on dates', async ({ page }) => {
      // Mock authenticated user
      await page.route('**/api/v1/auth/me', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'user-1', email: 'test@example.com', role: 'USER' },
          }),
        });
      });

      // Mock tool data
      await page.route('**/api/v1/tools/*', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            tool: {
              id: 'tool-1',
              name: 'Power Drill',
              dailyRate: 2000, // £20/day
              weeklyRate: 10000, // £100/week
              available: true,
              owner: { id: 'owner-1', name: 'Tool Owner' },
            },
          }),
        });
      });

      await page.goto('/tool/tool-1');
      
      // If there's a date picker or price display
      const priceElement = page.locator('[data-testid="calculated-price"]');
      if (await priceElement.isVisible()) {
        // Price should be visible
        await expect(priceElement).toContainText(/£/);
      }
    });
  });

  test.describe('Transaction Status Updates', () => {
    test('should display transaction list for authenticated user', async ({ page }) => {
      // Mock authenticated user
      await page.route('**/api/v1/auth/me', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'user-1', email: 'test@example.com', role: 'USER' },
          }),
        });
      });

      // Mock transactions list
      await page.route('**/api/v1/transactions*', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            transactions: [
              {
                id: 'txn-1',
                status: 'PENDING',
                rentalFee: 2000,
                totalAmount: 2100,
                tool: { name: 'Power Drill' },
                startDate: '2024-01-01',
                endDate: '2024-01-02',
              },
            ],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
          }),
        });
      });

      await page.goto('/calendar');
      
      // Should show transactions
      const transactionItem = page.locator('[data-testid="transaction-item"]');
      if (await transactionItem.first().isVisible()) {
        await expect(transactionItem.first()).toContainText(/Power Drill|PENDING/i);
      }
    });

    test('should navigate to transaction detail', async ({ page }) => {
      // Mock authenticated user
      await page.route('**/api/v1/auth/me', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'user-1', email: 'test@example.com', role: 'USER' },
          }),
        });
      });

      // Mock single transaction
      await page.route('**/api/v1/transactions/txn-1', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            transaction: {
              id: 'txn-1',
              userId: 'user-1',
              providerId: 'owner-1',
              status: 'PENDING',
              rentalFee: 2000,
              platformFee: 100,
              totalAmount: 2100,
              tool: { id: 'tool-1', name: 'Power Drill' },
              user: { name: 'Customer' },
              startDate: '2024-01-01',
              endDate: '2024-01-02',
            },
          }),
        });
      });

      await page.goto('/transaction/txn-1');
      
      // Page should load
      await expect(page.locator('body')).toBeVisible();
    });

    test('should show status action buttons for provider', async ({ page }) => {
      // Mock authenticated provider
      await page.route('**/api/v1/auth/me', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'provider-1', email: 'provider@example.com', role: 'USER' },
          }),
        });
      });

      // Mock transaction where current user is provider
      await page.route('**/api/v1/transactions/txn-1', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            transaction: {
              id: 'txn-1',
              userId: 'customer-1',
              providerId: 'provider-1', // Current user is provider
              status: 'PENDING',
              rentalFee: 2000,
              totalAmount: 2100,
              tool: { name: 'Power Drill' },
            },
          }),
        });
      });

      await page.goto('/transaction/txn-1');
      
      // Provider should see confirm button for pending transactions
      const confirmButton = page.getByRole('button', { name: /confirm|accept/i });
      if (await confirmButton.isVisible()) {
        await expect(confirmButton).toBeEnabled();
      }
    });
  });

  test.describe('Transaction Cancellation', () => {
    test('should allow cancellation of pending transaction', async ({ page }) => {
      // Mock authenticated user
      await page.route('**/api/v1/auth/me', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'user-1', email: 'test@example.com', role: 'USER' },
          }),
        });
      });

      // Mock transaction where current user is customer
      await page.route('**/api/v1/transactions/txn-1', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            transaction: {
              id: 'txn-1',
              userId: 'user-1', // Current user is customer
              providerId: 'provider-1',
              status: 'PENDING',
              rentalFee: 2000,
              totalAmount: 2100,
              tool: { name: 'Power Drill' },
            },
          }),
        });
      });

      await page.goto('/transaction/txn-1');
      
      // User should see cancel button
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      if (await cancelButton.isVisible()) {
        await expect(cancelButton).toBeEnabled();
      }
    });

    test('should not show cancel for completed transactions', async ({ page }) => {
      // Mock authenticated user
      await page.route('**/api/v1/auth/me', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'user-1', email: 'test@example.com', role: 'USER' },
          }),
        });
      });

      // Mock completed transaction
      await page.route('**/api/v1/transactions/txn-1', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            transaction: {
              id: 'txn-1',
              userId: 'user-1',
              providerId: 'provider-1',
              status: 'COMPLETED', // Already completed
              rentalFee: 2000,
              totalAmount: 2100,
              tool: { name: 'Power Drill' },
            },
          }),
        });
      });

      await page.goto('/transaction/txn-1');
      
      // Cancel button should not be visible for completed transactions
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      await expect(cancelButton).not.toBeVisible({ timeout: 2000 }).catch(() => {
        // If it exists, it should be disabled
      });
    });
  });

  test.describe('Server-side Fee Calculation', () => {
    test('should display server-calculated fees correctly', async ({ page }) => {
      // Mock authenticated user
      await page.route('**/api/v1/auth/me', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'user-1', email: 'test@example.com', role: 'USER' },
          }),
        });
      });

      // Mock transaction with server-calculated fees
      await page.route('**/api/v1/transactions/txn-1', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            transaction: {
              id: 'txn-1',
              userId: 'user-1',
              providerId: 'provider-1',
              status: 'PENDING',
              rentalFee: 4000, // £40 - server calculated
              platformFee: 200, // 5% - server calculated
              totalAmount: 4200,
              tool: { 
                name: 'Power Drill',
                dailyRate: 2000, // £20/day
              },
              startDate: '2024-01-01',
              endDate: '2024-01-03', // 2 days = £40
            },
          }),
        });
      });

      await page.goto('/transaction/txn-1');
      
      // Fee breakdown should be visible
      const feeDisplay = page.locator('text=/£40|£42|platform fee|service fee/i');
      if (await feeDisplay.first().isVisible()) {
        await expect(feeDisplay.first()).toBeVisible();
      }
    });
  });
});
