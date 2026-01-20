#!/usr/bin/env tsx
/**
 * Epic 3 API Endpoints Test Script
 * 
 * Tests all API endpoints related to Epic 3: Multi-Account & Broker Sync
 * 
 * Usage:
 *   npm run test:epic3
 *   or
 *   tsx scripts/test-epic3-endpoints.ts
 * 
 * Environment:
 *   - Requires valid session cookie or API key
 *   - Set BASE_URL env var (default: http://localhost:3000)
 *   - Set TEST_USER_EMAIL and TEST_USER_PASSWORD for auth
 */

import { BrokerType, IntegrationStatus, BrokerAssetType } from '@prisma/client';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
}

const results: TestResult[] = [];

// ============================================================================
// UTILITIES
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function printResult(result: TestResult) {
  const icon = result.success ? '✅' : '❌';
  const statusColor = result.status >= 200 && result.status < 300 ? '\x1b[32m' : '\x1b[31m';
  const resetColor = '\x1b[0m';
  
  console.log(
    `${icon} ${result.method.padEnd(6)} ${result.endpoint.padEnd(50)} ${statusColor}${result.status}${resetColor} (${formatDuration(result.duration)})`
  );
  
  if (result.error) {
    console.log(`   ⚠️  ${result.error}`);
  }
  
  if (result.data && process.env.VERBOSE === 'true') {
    console.log(`   📦 Response:`, JSON.stringify(result.data, null, 2).substring(0, 200));
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  
  const total = results.length;
  const passed = results.filter(r => r.success).length;
  const failed = total - passed;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  console.log(`Total Tests:     ${total}`);
  console.log(`Passed:          ${passed} ✅`);
  console.log(`Failed:          ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log(`Total Duration:  ${formatDuration(totalDuration)}`);
  console.log(`Average:         ${formatDuration(totalDuration / total)}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.method} ${r.endpoint} (${r.status}): ${r.error || 'Unknown error'}`);
    });
  }
  
  console.log('='.repeat(80) + '\n');
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

let sessionCookie: string | null = null;

async function makeRequest(
  method: string,
  endpoint: string,
  options: {
    body?: any;
    headers?: Record<string, string>;
    expectStatus?: number;
    requireAuth?: boolean;
  } = {}
): Promise<TestResult> {
  const startTime = Date.now();
  const url = `${BASE_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  // Add session cookie if available and auth is required
  if (options.requireAuth !== false && sessionCookie) {
    headers['Cookie'] = sessionCookie;
  }
  
  const fetchOptions: RequestInit = {
    method,
    headers,
    credentials: 'include',
  };
  
  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }
  
  try {
    const response = await fetch(url, fetchOptions);
    const duration = Date.now() - startTime;
    
    // Save session cookie from login
    if (endpoint === '/api/auth/login' && response.ok) {
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        sessionCookie = setCookie;
      }
    }
    
    let data: any;
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    const expectedStatus = options.expectStatus || 200;
    const success = response.status === expectedStatus;
    
    const result: TestResult = {
      endpoint,
      method,
      status: response.status,
      success,
      duration,
      data,
    };
    
    if (!success) {
      result.error = `Expected ${expectedStatus}, got ${response.status}`;
      if (typeof data === 'object' && data.error) {
        result.error += `: ${data.error}`;
      }
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      endpoint,
      method,
      status: 0,
      success: false,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

async function testAuthentication() {
  console.log('\n🔐 Testing Authentication...\n');
  
  if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
    console.log('⚠️  Skipping auth tests (TEST_USER_EMAIL or TEST_USER_PASSWORD not set)');
    console.log('   Set these env vars to test authenticated endpoints\n');
    return false;
  }
  
  // Note: This app uses Supabase Auth with server actions, not REST API endpoints
  // To test authenticated endpoints, you need to:
  // 1. Login via the web UI at http://localhost:3000/login
  // 2. Extract the session cookie from browser DevTools
  // 3. Set it in the test script manually
  
  console.log('⚠️  Auth uses Supabase server actions (not REST API)');
  console.log('   To test authenticated endpoints:');
  console.log('   1. Login via web UI: http://localhost:3000/login');
  console.log('   2. Copy session cookie from browser');
  console.log('   3. Set sessionCookie variable in test script\n');
  
  return false;
}

async function testAccountsEndpoints() {
  console.log('\n📊 Testing Accounts Endpoints...\n');
  
  // GET /api/accounts - List accounts
  let result = await makeRequest('GET', '/api/accounts');
  results.push(result);
  printResult(result);
  
  // GET /api/accounts?page=1&limit=10
  result = await makeRequest('GET', '/api/accounts?page=1&limit=10');
  results.push(result);
  printResult(result);
  
  // GET /api/accounts?search=test
  result = await makeRequest('GET', '/api/accounts?search=test');
  results.push(result);
  printResult(result);
  
  // GET /api/accounts?broker=IBKR
  result = await makeRequest('GET', '/api/accounts?broker=IBKR');
  results.push(result);
  printResult(result);
  
  // GET /api/accounts/brokers - List unique brokers
  result = await makeRequest('GET', '/api/accounts/brokers');
  results.push(result);
  printResult(result);
}

async function testBrokersEndpoints() {
  console.log('\n🏦 Testing Brokers Endpoints...\n');
  
  // GET /api/brokers - List all brokers
  let result = await makeRequest('GET', '/api/brokers', {
    requireAuth: false, // Public endpoint
  });
  results.push(result);
  printResult(result);
  
  // GET /api/brokers?page=1&limit=20
  result = await makeRequest('GET', '/api/brokers?page=1&limit=20', {
    requireAuth: false,
  });
  results.push(result);
  printResult(result);
  
  // GET /api/brokers?search=Interactive
  result = await makeRequest('GET', '/api/brokers?search=Interactive', {
    requireAuth: false,
  });
  results.push(result);
  printResult(result);
  
  // GET /api/brokers?country=USA
  result = await makeRequest('GET', '/api/brokers?country=USA', {
    requireAuth: false,
  });
  results.push(result);
  printResult(result);
  
  // GET /api/brokers?region=North America
  result = await makeRequest('GET', '/api/brokers?region=North America', {
    requireAuth: false,
  });
  results.push(result);
  printResult(result);
  
  // GET /api/brokers?integrationStatus=API
  result = await makeRequest('GET', `/api/brokers?integrationStatus=${IntegrationStatus.API}`, {
    requireAuth: false,
  });
  results.push(result);
  printResult(result);
  
  // GET /api/brokers?assetType=STOCKS
  result = await makeRequest('GET', `/api/brokers?assetType=${BrokerAssetType.STOCKS}`, {
    requireAuth: false,
  });
  results.push(result);
  printResult(result);
  
  // GET /api/brokers?isActive=true
  result = await makeRequest('GET', '/api/brokers?isActive=true', {
    requireAuth: false,
  });
  results.push(result);
  printResult(result);
  
  // Test combined filters
  result = await makeRequest(
    'GET',
    `/api/brokers?country=USA&integrationStatus=${IntegrationStatus.API}&assetType=${BrokerAssetType.STOCKS}`,
    { requireAuth: false }
  );
  results.push(result);
  printResult(result);
  
  // Test pagination edge cases
  result = await makeRequest('GET', '/api/brokers?page=999&limit=1', {
    requireAuth: false,
  });
  results.push(result);
  printResult(result);
  
  // Test invalid parameters (should return 400)
  result = await makeRequest('GET', '/api/brokers?page=invalid', {
    requireAuth: false,
    expectStatus: 400,
  });
  results.push(result);
  printResult(result);
}

async function testBrokerMetricsEndpoints() {
  console.log('\n📈 Testing Broker Metrics Endpoints...\n');
  
  // GET /api/broker/metrics - All broker metrics
  let result = await makeRequest('GET', '/api/broker/metrics');
  results.push(result);
  printResult(result);
  
  // GET /api/broker/metrics?brokerType=IBKR
  result = await makeRequest('GET', `/api/broker/metrics?brokerType=${BrokerType.IBKR}`);
  results.push(result);
  printResult(result);
  
  // GET /api/broker/metrics?brokerType=TRADOVATE
  result = await makeRequest('GET', `/api/broker/metrics?brokerType=${BrokerType.TRADOVATE}`);
  results.push(result);
  printResult(result);
  
  // GET /api/broker/metrics?since=2026-01-01
  result = await makeRequest('GET', '/api/broker/metrics?since=2026-01-01');
  results.push(result);
  printResult(result);
  
  // GET /api/broker/metrics?format=text
  result = await makeRequest('GET', '/api/broker/metrics?format=text');
  results.push(result);
  printResult(result);
}

async function testSchedulerEndpoints() {
  console.log('\n⏰ Testing Scheduler Endpoints...\n');
  
  const schedulerSecret = process.env.SCHEDULER_SECRET || process.env.CRON_SECRET;
  
  if (!schedulerSecret) {
    console.log('⚠️  Skipping scheduler tests (SCHEDULER_SECRET not set)\n');
    return;
  }
  
  // GET /api/scheduler/broker-sync - Get scheduler status
  let result = await makeRequest('GET', '/api/scheduler/broker-sync', {
    headers: {
      'Authorization': `Bearer ${schedulerSecret}`,
    },
    requireAuth: false,
  });
  results.push(result);
  printResult(result);
  
  // POST /api/scheduler/broker-sync - Trigger sync (commented out to avoid actual sync)
  console.log('⚠️  Skipping POST /api/scheduler/broker-sync (would trigger actual sync)');
  console.log('   Uncomment in script to test actual sync trigger\n');
  
  // Uncomment to test actual sync:
  // result = await makeRequest('POST', '/api/scheduler/broker-sync', {
  //   headers: {
  //     'Authorization': `Bearer ${schedulerSecret}`,
  //   },
  //   requireAuth: false,
  // });
  // results.push(result);
  // printResult(result);
  
  // Test unauthorized access
  result = await makeRequest('GET', '/api/scheduler/broker-sync', {
    requireAuth: false,
    expectStatus: 401,
  });
  results.push(result);
  printResult(result);
}

async function testHealthEndpoints() {
  console.log('\n🏥 Testing Health Endpoints (related to broker infrastructure)...\n');
  
  // GET /api/health
  let result = await makeRequest('GET', '/api/health', {
    requireAuth: false,
  });
  results.push(result);
  printResult(result);
  
  // GET /api/health/db
  result = await makeRequest('GET', '/api/health/db', {
    requireAuth: false,
  });
  results.push(result);
  printResult(result);
  
  // GET /api/health/redis
  result = await makeRequest('GET', '/api/health/redis', {
    requireAuth: false,
  });
  results.push(result);
  printResult(result);
  
  // GET /api/health/ready
  result = await makeRequest('GET', '/api/health/ready', {
    requireAuth: false,
  });
  results.push(result);
  printResult(result);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('🧪 EPIC 3 API ENDPOINTS TEST SUITE');
  console.log('='.repeat(80));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
  
  try {
    // Test authentication first
    const isAuthenticated = await testAuthentication();
    
    // Test health endpoints (no auth required)
    await testHealthEndpoints();
    
    // Test brokers endpoints (public)
    await testBrokersEndpoints();
    
    // Test authenticated endpoints if we have a session
    if (isAuthenticated) {
      await testAccountsEndpoints();
      await testBrokerMetricsEndpoints();
      await testSchedulerEndpoints();
    } else {
      console.log('\n⚠️  Skipping authenticated endpoint tests (not authenticated)\n');
    }
    
    // Print summary
    printSummary();
    
    // Exit with appropriate code
    const failed = results.filter(r => !r.success).length;
    process.exit(failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  main();
}

export { main as testEpic3Endpoints };
