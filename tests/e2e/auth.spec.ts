/**
 * PRÉ-12.2: E2E Tests - Authentication
 * 
 * Tests for user authentication flow:
 * - Login
 * - Logout
 * - Registration
 * - Password reset
 * - Session management
 */

import { test, expect } from '@playwright/test';
import { login, logout } from './helpers/auth';

const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!',
};

test.describe('Authentication', () => {
  test.describe('Login', () => {
    test('should login successfully with valid credentials', async ({ page }) => {
      await login(page, TEST_USER.email, TEST_USER.password);
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Should display user info
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    });
    
    test('should show error with invalid email', async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', 'invalid@example.com');
      await page.fill('input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
    });
    
    test('should show error with invalid password', async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    });
    
    test('should validate email format', async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', 'not-an-email');
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      
      // Should show validation error
      const emailInput = page.locator('input[name="email"]');
      await expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    });
    
    test('should require password', async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', TEST_USER.email);
      // Leave password empty
      await page.click('button[type="submit"]');
      
      const passwordInput = page.locator('input[name="password"]');
      await expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
    });
  });
  
  test.describe('Logout', () => {
    test('should logout successfully', async ({ page }) => {
      await login(page, TEST_USER.email, TEST_USER.password);
      await logout(page);
      
      // Should redirect to login page
      await expect(page).toHaveURL(/\/login/);
      
      // Should not be able to access dashboard
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/login/);
    });
  });
  
  test.describe('Registration', () => {
    test('should register a new user successfully', async ({ page }) => {
      const newUser = {
        email: `test+${Date.now()}@example.com`,
        password: 'NewPassword123!',
      };
      
      await page.goto('/create-account');
      await page.fill('input[name="email"]', newUser.email);
      await page.fill('input[name="password"]', newUser.password);
      await page.fill('input[name="confirmPassword"]', newUser.password);
      await page.click('button[type="submit"]');
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    });
    
    test('should show error if passwords do not match', async ({ page }) => {
      await page.goto('/create-account');
      await page.fill('input[name="email"]', 'new@example.com');
      await page.fill('input[name="password"]', 'Password123!');
      await page.fill('input[name="confirmPassword"]', 'DifferentPassword123!');
      await page.click('button[type="submit"]');
      
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Passwords do not match');
    });
    
    test('should show error if email already exists', async ({ page }) => {
      await page.goto('/create-account');
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', 'Password123!');
      await page.fill('input[name="confirmPassword"]', 'Password123!');
      await page.click('button[type="submit"]');
      
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Email already exists');
    });
  });
  
  test.describe('Session Management', () => {
    test('should maintain session across page refreshes', async ({ page }) => {
      await login(page, TEST_USER.email, TEST_USER.password);
      
      // Refresh the page
      await page.reload();
      
      // Should still be logged in
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    });
    
    test('should redirect to login if session expires', async ({ page }) => {
      await login(page, TEST_USER.email, TEST_USER.password);
      
      // Clear cookies to simulate expired session
      await page.context().clearCookies();
      
      // Try to access protected route
      await page.goto('/dashboard');
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
