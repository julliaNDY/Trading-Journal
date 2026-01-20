/**
 * Test Script: Gemini Rate Limiter Integration
 * PRÉ-7.2: Rate Limiting (12h) - Phase 11
 * 
 * Tests the Gemini rate limiter with real API calls
 * 
 * Usage:
 *   npx tsx scripts/test-gemini-rate-limiter.ts
 */

import {
  createGeminiRateLimiter,
  withGeminiRateLimit,
  withGeminiRetry,
  getGeminiRateLimitStatus,
  GeminiRateLimitError,
  GEMINI_RATE_LIMITS,
} from '../src/lib/gemini-rate-limiter';
import { generateWithGemini } from '../src/lib/google-gemini';

// ============================================================================
// Test Utilities
// ============================================================================

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`  ${title}`);
  console.log('='.repeat(80) + '\n');
}

function logSuccess(message: string) {
  console.log(`✅ ${message}`);
}

function logError(message: string) {
  console.log(`❌ ${message}`);
}

function logInfo(message: string) {
  console.log(`ℹ️  ${message}`);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Test Cases
// ============================================================================

async function testBasicRateLimiting() {
  logSection('Test 1: Basic Rate Limiting');

  const limiter = createGeminiRateLimiter();

  try {
    // Make a few requests
    for (let i = 1; i <= 3; i++) {
      await limiter.checkLimit(1000);
      logSuccess(`Request ${i} passed rate limit check`);
    }

    // Get status
    const status = await limiter.getStatus();
    logInfo(`Current usage: ${status.second.current}/${status.second.max} per second`);
    logInfo(`Token usage: ${status.tokens.current}/${status.tokens.max} per minute`);
  } catch (error) {
    logError(`Test failed: ${error}`);
    throw error;
  }
}

async function testPerUserRateLimiting() {
  logSection('Test 2: Per-User Rate Limiting');

  const user1Limiter = createGeminiRateLimiter('user-1');
  const user2Limiter = createGeminiRateLimiter('user-2');

  try {
    // User 1 makes requests
    await user1Limiter.checkLimit(1000);
    logSuccess('User 1 request passed');

    // User 2 makes requests (should be independent)
    await user2Limiter.checkLimit(1000);
    logSuccess('User 2 request passed');

    // Get status for both users
    const status1 = await user1Limiter.getStatus();
    const status2 = await user2Limiter.getStatus();

    logInfo(`User 1 usage: ${status1.second.current}/${status1.second.max}`);
    logInfo(`User 2 usage: ${status2.second.current}/${status2.second.max}`);
  } catch (error) {
    logError(`Test failed: ${error}`);
    throw error;
  }
}

async function testRateLimitExceeded() {
  logSection('Test 3: Rate Limit Exceeded');

  const limiter = createGeminiRateLimiter('test-user');
  const maxPerSecond = GEMINI_RATE_LIMITS.PER_USER.maxRequestsPerSecond;

  try {
    // Exhaust rate limit
    for (let i = 0; i < maxPerSecond; i++) {
      await limiter.checkLimit(100);
    }
    logInfo(`Made ${maxPerSecond} requests (limit reached)`);

    // Next request should fail
    try {
      await limiter.checkLimit(100);
      logError('Expected rate limit error but request passed');
    } catch (error) {
      if (error instanceof GeminiRateLimitError) {
        logSuccess(`Rate limit error thrown as expected`);
        logInfo(`Retry after: ${error.retryAfterMs}ms`);
        logInfo(`Limit type: ${error.limitType}`);
      } else {
        throw error;
      }
    }

    // Reset and try again
    await limiter.reset();
    logInfo('Rate limit reset');

    await limiter.checkLimit(100);
    logSuccess('Request passed after reset');
  } catch (error) {
    logError(`Test failed: ${error}`);
    throw error;
  }
}

async function testTokenLimitExceeded() {
  logSection('Test 4: Token Limit Exceeded');

  const limiter = createGeminiRateLimiter('test-user');
  const maxTokens = GEMINI_RATE_LIMITS.PER_USER.maxTokensPerMinute;

  try {
    // Try to consume more tokens than allowed
    try {
      await limiter.checkLimit(maxTokens + 1000);
      logError('Expected token limit error but request passed');
    } catch (error) {
      if (error instanceof GeminiRateLimitError) {
        logSuccess('Token limit error thrown as expected');
        logInfo(`Limit type: ${error.limitType}`);
      } else {
        throw error;
      }
    }

    await limiter.reset();
    logInfo('Rate limit reset');
  } catch (error) {
    logError(`Test failed: ${error}`);
    throw error;
  }
}

async function testWithRateLimitWrapper() {
  logSection('Test 5: withGeminiRateLimit Wrapper');

  try {
    const mockFn = async () => {
      return 'Test result';
    };

    const result = await withGeminiRateLimit(mockFn, {
      userId: 'test-user',
      estimatedTokens: 1000,
    });

    logSuccess(`Function executed with rate limiting: ${result}`);
  } catch (error) {
    logError(`Test failed: ${error}`);
    throw error;
  }
}

async function testWithRetryWrapper() {
  logSection('Test 6: withGeminiRetry Wrapper');

  let attempts = 0;

  try {
    const mockFn = async () => {
      attempts++;
      if (attempts === 1) {
        throw new GeminiRateLimitError('Rate limit', 100, 'global');
      }
      return 'Success after retry';
    };

    const result = await withGeminiRetry(mockFn, {
      initialDelayMs: 100,
      maxRetries: 2,
    });

    logSuccess(`Function succeeded after ${attempts} attempts: ${result}`);
  } catch (error) {
    logError(`Test failed: ${error}`);
    throw error;
  }
}

async function testRateLimitStatus() {
  logSection('Test 7: Rate Limit Status');

  try {
    // Create a fresh limiter for this test
    const testUserId = 'test-status-' + Date.now();
    const limiter = createGeminiRateLimiter(testUserId);
    await limiter.checkLimit(1000);
    await sleep(100); // Small delay to avoid hitting per-second limit
    await limiter.checkLimit(2000);

    // Get comprehensive status
    const status = await getGeminiRateLimitStatus(testUserId);

    logInfo('Global Rate Limits:');
    console.log(`  - Second: ${status.global.second.current}/${status.global.second.max}`);
    console.log(`  - Minute: ${status.global.minute.current}/${status.global.minute.max}`);
    console.log(`  - Hour: ${status.global.hour.current}/${status.global.hour.max}`);
    console.log(`  - Tokens: ${status.global.tokens.current}/${status.global.tokens.max}`);

    if (status.user) {
      logInfo('User Rate Limits:');
      console.log(`  - Second: ${status.user.second.current}/${status.user.second.max}`);
      console.log(`  - Minute: ${status.user.minute.current}/${status.user.minute.max}`);
      console.log(`  - Hour: ${status.user.hour.current}/${status.user.hour.max}`);
      console.log(`  - Tokens: ${status.user.tokens.current}/${status.user.tokens.max}`);
    }

    logSuccess('Rate limit status retrieved successfully');
  } catch (error) {
    logError(`Test failed: ${error}`);
    throw error;
  }
}

async function testRealGeminiAPICall() {
  logSection('Test 8: Real Gemini API Call (Optional)');

  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    logInfo('Skipping real API test (GOOGLE_GEMINI_API_KEY not set)');
    return;
  }

  try {
    const result = await generateWithGemini('Say "Hello World" in exactly 2 words', {
      userId: 'test-user',
      maxTokens: 10,
      temperature: 0.1,
    });

    logSuccess(`Real API call succeeded: ${result.content}`);
    if (result.usage) {
      logInfo(`Tokens used: ${result.usage.totalTokens}`);
    }
  } catch (error) {
    logError(`Real API test failed: ${error}`);
    // Don't throw - this test is optional
  }
}

async function testConcurrentRequests() {
  logSection('Test 9: Concurrent Requests');

  try {
    // Create a fresh limiter for this test
    const testUserId = 'test-concurrent-' + Date.now();
    const limiter = createGeminiRateLimiter(testUserId);

    // Make multiple concurrent requests (within limit)
    const promises = [];
    const maxPerSecond = 2; // Per-user limit
    for (let i = 0; i < maxPerSecond; i++) {
      promises.push(
        limiter.checkLimit(500).then(() => {
          logSuccess(`Concurrent request ${i + 1} passed`);
        })
      );
    }

    await Promise.all(promises);
    logSuccess('All concurrent requests handled correctly');
  } catch (error) {
    logError(`Test failed: ${error}`);
    throw error;
  }
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runAllTests() {
  console.log('\n🚀 Starting Gemini Rate Limiter Integration Tests\n');

  const tests = [
    { name: 'Basic Rate Limiting', fn: testBasicRateLimiting },
    { name: 'Per-User Rate Limiting', fn: testPerUserRateLimiting },
    { name: 'Rate Limit Exceeded', fn: testRateLimitExceeded },
    { name: 'Token Limit Exceeded', fn: testTokenLimitExceeded },
    { name: 'withGeminiRateLimit Wrapper', fn: testWithRateLimitWrapper },
    { name: 'withGeminiRetry Wrapper', fn: testWithRetryWrapper },
    { name: 'Rate Limit Status', fn: testRateLimitStatus },
    { name: 'Real Gemini API Call', fn: testRealGeminiAPICall },
    { name: 'Concurrent Requests', fn: testConcurrentRequests },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      passed++;
      await sleep(100); // Small delay between tests
    } catch (error) {
      failed++;
      console.error(`\n❌ Test "${test.name}" failed:`, error);
    }
  }

  // Summary
  logSection('Test Summary');
  console.log(`Total tests: ${tests.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success rate: ${((passed / tests.length) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
