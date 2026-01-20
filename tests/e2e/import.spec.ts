/**
 * PRÉ-12.2: E2E Tests - CSV Import
 * 
 * Tests for CSV import functionality:
 * - File upload
 * - Column mapping
 * - Data validation
 * - Import success/errors
 */

import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import path from 'path';

const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!',
};

test.describe('CSV Import', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await page.goto('/importer');
  });
  
  test('should display drag and drop zone', async ({ page }) => {
    await expect(page.locator('[data-testid="dropzone"]')).toBeVisible();
    await expect(page.locator('[data-testid="dropzone"]')).toContainText('Drag');
  });
  
  test('should upload CSV file successfully', async ({ page }) => {
    const filePath = path.join(__dirname, '../fixtures/test-trades.csv');
    
    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
    
    // Wait for preview to appear
    await expect(page.locator('[data-testid="import-preview"]')).toBeVisible({ timeout: 5000 });
    
    // Should show preview rows
    await expect(page.locator('[data-testid="preview-row"]').first()).toBeVisible();
  });
  
  test('should show column mapping interface', async ({ page }) => {
    const filePath = path.join(__dirname, '../fixtures/test-trades.csv');
    
    await page.locator('input[type="file"]').setInputFiles(filePath);
    await page.waitForSelector('[data-testid="import-preview"]');
    
    // Click next to go to mapping
    await page.click('[data-testid="btn-next"]');
    
    // Should show mapping interface
    await expect(page.locator('[data-testid="column-mapping"]')).toBeVisible();
    
    // Should have dropdowns for each required field
    await expect(page.locator('[data-testid="map-symbol"]')).toBeVisible();
    await expect(page.locator('[data-testid="map-entry-price"]')).toBeVisible();
    await expect(page.locator('[data-testid="map-exit-price"]')).toBeVisible();
  });
  
  test('should validate required mappings', async ({ page }) => {
    const filePath = path.join(__dirname, '../fixtures/test-trades.csv');
    
    await page.locator('input[type="file"]').setInputFiles(filePath);
    await page.waitForSelector('[data-testid="import-preview"]');
    await page.click('[data-testid="btn-next"]');
    
    // Try to proceed without mapping all required fields
    await page.click('[data-testid="btn-import"]');
    
    // Should show validation error
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('required');
  });
  
  test('should successfully import trades', async ({ page }) => {
    const filePath = path.join(__dirname, '../fixtures/test-trades.csv');
    
    await page.locator('input[type="file"]').setInputFiles(filePath);
    await page.waitForSelector('[data-testid="import-preview"]');
    await page.click('[data-testid="btn-next"]');
    
    // Map columns (assuming auto-detection works)
    // If not, manually map them here
    
    // Click import
    await page.click('[data-testid="btn-import"]');
    
    // Wait for import to complete
    await expect(page.locator('[data-testid="import-success"]')).toBeVisible({ timeout: 15000 });
    
    // Should show import summary
    await expect(page.locator('[data-testid="import-summary"]')).toContainText('imported');
  });
  
  test('should handle duplicate trades', async ({ page }) => {
    const filePath = path.join(__dirname, '../fixtures/test-trades.csv');
    
    // Import once
    await page.locator('input[type="file"]').setInputFiles(filePath);
    await page.waitForSelector('[data-testid="import-preview"]');
    await page.click('[data-testid="btn-next"]');
    await page.click('[data-testid="btn-import"]');
    await page.waitForSelector('[data-testid="import-success"]', { timeout: 15000 });
    
    // Try to import again
    await page.goto('/importer');
    await page.locator('input[type="file"]').setInputFiles(filePath);
    await page.waitForSelector('[data-testid="import-preview"]');
    await page.click('[data-testid="btn-next"]');
    await page.click('[data-testid="btn-import"]');
    
    // Should show duplicate warning
    await expect(page.locator('[data-testid="import-summary"]')).toContainText('duplicate');
  });
  
  test('should reject invalid CSV format', async ({ page }) => {
    const invalidFilePath = path.join(__dirname, '../fixtures/invalid-file.txt');
    
    await page.locator('input[type="file"]').setInputFiles(invalidFilePath);
    
    // Should show error
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid file format');
  });
});
