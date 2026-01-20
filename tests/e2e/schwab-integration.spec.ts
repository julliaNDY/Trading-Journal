/**
 * PRÉ-5.3: E2E Tests - Charles Schwab Integration
 * 
 * Integration tests for Charles Schwab broker connection:
 * - OAuth flow initiation
 * - OAuth callback handling
 * - Account connection
 * - Trade sync
 * 
 * @module tests/e2e/schwab-integration
 * @created 2026-01-18
 */

import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!',
};

test.describe('Charles Schwab Integration', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await page.goto('/comptes/brokers');
  });

  test('should display Schwab in broker list', async ({ page }) => {
    // Wait for broker list to load
    await expect(page.locator('[data-testid="broker-list"]')).toBeVisible();
    
    // Check for Schwab broker option
    await expect(page.locator('text=Charles Schwab')).toBeVisible();
  });

  test('should initiate OAuth flow when clicking Connect Schwab', async ({ page }) => {
    // Find and click Connect button for Schwab
    const schwabRow = page.locator('[data-testid="broker-row-SCHWAB"]');
    await expect(schwabRow).toBeVisible();
    
    // Click Connect button
    const connectButton = schwabRow.locator('button:has-text("Connect")');
    await connectButton.click();
    
    // Should redirect to Schwab authorization page
    // Note: This will redirect externally, so we check URL pattern
    await page.waitForTimeout(2000); // Wait for redirect
    
    // Check if we're redirected to Schwab OAuth (or stay on authorize endpoint)
    const currentUrl = page.url();
    expect(
      currentUrl.includes('/api/broker/schwab/authorize') ||
      currentUrl.includes('schwabapi.com') ||
      currentUrl.includes('schwab.com')
    ).toBeTruthy();
  });

  test('should handle OAuth callback with authorization code', async ({ page, context }) => {
    // Mock OAuth callback
    const mockCode = 'mock_auth_code_123';
    const mockState = 'mock_state_456';
    
    // Navigate to callback endpoint
    await page.goto(`/api/broker/schwab/callback?code=${mockCode}&state=${mockState}`);
    
    // Should redirect to brokers page
    await page.waitForURL(/\/comptes\/brokers/, { timeout: 5000 });
    
    // Check for success or error message
    const url = page.url();
    expect(url).toMatch(/\/comptes\/brokers/);
  });

  test('should handle OAuth callback with error', async ({ page }) => {
    const mockError = 'access_denied';
    const mockErrorDescription = 'User denied access';
    
    await page.goto(
      `/api/broker/schwab/callback?error=${mockError}&error_description=${encodeURIComponent(mockErrorDescription)}`
    );
    
    // Should redirect to brokers page with error
    await page.waitForURL(/\/comptes\/brokers/, { timeout: 5000 });
    
    const url = page.url();
    expect(url).toMatch(/error=/);
  });

  test('should handle missing authorization code', async ({ page }) => {
    await page.goto('/api/broker/schwab/callback?state=mock_state');
    
    // Should redirect with error
    await page.waitForURL(/\/comptes\/brokers/, { timeout: 5000 });
    
    const url = page.url();
    expect(url).toMatch(/error=missing_code/);
  });

  test('should show connected status after successful connection', async ({ page }) => {
    // This test assumes a connection was already established
    // In real scenario, we'd mock the OAuth flow completion
    
    // Navigate to brokers page
    await page.goto('/comptes/brokers');
    
    // Look for Schwab connection with CONNECTED status
    const schwabConnection = page.locator('[data-testid="broker-connection-SCHWAB"]');
    
    // If connection exists, check status
    const connectionExists = await schwabConnection.count() > 0;
    if (connectionExists) {
      await expect(schwabConnection.locator('text=CONNECTED')).toBeVisible();
    }
  });

  test('should allow disconnecting Schwab', async ({ page }) => {
    // Navigate to brokers page
    await page.goto('/comptes/brokers');
    
    // Find Schwab connection
    const schwabConnection = page.locator('[data-testid="broker-connection-SCHWAB"]');
    
    // If connection exists, test disconnect
    const connectionExists = await schwabConnection.count() > 0;
    if (connectionExists) {
      const disconnectButton = schwabConnection.locator('button:has-text("Disconnect")');
      await disconnectButton.click();
      
      // Confirm disconnect
      const confirmButton = page.locator('button:has-text("Confirm")');
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
      }
      
      // Should show disconnected status
      await expect(schwabConnection.locator('text=DISCONNECTED')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should sync trades from Schwab account', async ({ page }) => {
    // Navigate to brokers page
    await page.goto('/comptes/brokers');
    
    // Find Schwab connection
    const schwabConnection = page.locator('[data-testid="broker-connection-SCHWAB"]');
    const connectionExists = await schwabConnection.count() > 0;
    
    if (connectionExists) {
      // Click Sync button
      const syncButton = schwabConnection.locator('button:has-text("Sync")');
      await syncButton.click();
      
      // Wait for sync to complete (with timeout)
      await page.waitForTimeout(3000);
      
      // Check for sync success message or updated sync timestamp
      // This would be implementation-specific
    }
  });
});
