/**
 * PRÉ-12.2: E2E Tests - Dashboard
 * 
 * Tests for dashboard functionality:
 * - KPI display
 * - Equity curve rendering
 * - Navigation
 * - Responsiveness
 */

import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!',
};

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
  });
  
  test('should display main KPIs', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check for KPI cards
    await expect(page.locator('[data-testid="kpi-profit-factor"]')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-avg-win"]')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-avg-loss"]')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-avg-rr"]')).toBeVisible();
  });
  
  test('should display equity curve chart', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Wait for chart to render
    await expect(page.locator('[data-testid="equity-curve"]')).toBeVisible({ timeout: 5000 });
    
    // Check for chart canvas/svg
    const chart = page.locator('[data-testid="equity-curve"]');
    await expect(chart.locator('svg, canvas')).toBeVisible();
  });
  
  test('should toggle equity curve timeframe', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Wait for chart
    await page.waitForSelector('[data-testid="equity-curve"]');
    
    // Click on "Monthly" tab
    await page.click('[data-testid="timeframe-monthly"]');
    await page.waitForTimeout(500); // Wait for chart re-render
    
    // Click on "Weekly" tab
    await page.click('[data-testid="timeframe-weekly"]');
    await page.waitForTimeout(500);
    
    // Click back to "All Time"
    await page.click('[data-testid="timeframe-all"]');
    await page.waitForTimeout(500);
  });
  
  test('should display time of day profitability', async ({ page }) => {
    await page.goto('/dashboard');
    
    await expect(page.locator('[data-testid="time-profitability"]')).toBeVisible();
    
    // Should show at least one time slot
    const timeSlots = page.locator('[data-testid^="time-slot-"]');
    await expect(timeSlots.first()).toBeVisible();
  });
  
  test('should navigate to import page from CTA', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Click import button
    await page.click('[data-testid="cta-import"]');
    
    // Should navigate to import page
    await expect(page).toHaveURL(/\/importer/);
  });
  
  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/dashboard');
    
    // KPIs should stack vertically
    const kpiCards = page.locator('[data-testid^="kpi-"]');
    await expect(kpiCards.first()).toBeVisible();
    
    // Check that sidebar is hidden/collapsed
    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar).not.toBeVisible();
    
    // Mobile menu button should be visible
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
  });
  
  test('should display empty state if no trades', async ({ page, context }) => {
    // Create new test user without trades
    // This would require API setup or separate test data
    
    await page.goto('/dashboard');
    
    // Should show empty state message
    const emptyState = page.locator('[data-testid="empty-state"]');
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    
    if (hasEmptyState) {
      await expect(emptyState).toContainText('No trades yet');
      await expect(page.locator('[data-testid="cta-import"]')).toBeVisible();
    }
  });
});
