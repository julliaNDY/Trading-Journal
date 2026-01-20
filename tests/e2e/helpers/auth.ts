/**
 * PRÉ-12: E2E Testing - Authentication Helpers
 */

import { Page } from '@playwright/test';

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  
  // Wait for navigation to dashboard
  await page.waitForURL('/dashboard', { timeout: 10000 });
}

export async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('/login');
}

export async function createTestUser(email: string, password: string) {
  // This would typically use an API endpoint to create a test user
  // For now, we'll use the UI
  return { email, password };
}

export async function deleteTestUser(email: string) {
  // Clean up test user via API
  // Implementation depends on your API structure
}
