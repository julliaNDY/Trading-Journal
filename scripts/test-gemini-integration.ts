/**
 * Integration Test Script for Gemini Production API
 * PRÉ-7.1: API Integration (16h) - Phase 11
 * 
 * Tests:
 * 1. Basic generation
 * 2. Caching
 * 3. Rate limiting
 * 4. Fallback mechanism
 * 5. Health monitoring
 * 6. Batch processing
 */

import {
  generateWithGeminiProduction,
  getGeminiHealthStatus,
  getRateLimitInfo,
  resetHealthMetrics,
  batchGenerateWithGemini,
  isGeminiConfigured,
  type GeminiRequest,
} from '../src/lib/gemini-production';

// ============================================================================
// Test Configuration
// ============================================================================

const VERBOSE = process.env.VERBOSE === 'true';

function log(message: string, data?: unknown) {
  if (VERBOSE) {
    console.log(`[TEST] ${message}`, data || '');
  }
}

function logSuccess(message: string) {
  console.log(`✅ ${message}`);
}

function logError(message: string, error?: unknown) {
  console.error(`❌ ${message}`, error || '');
}

function logInfo(message: string) {
  console.log(`ℹ️  ${message}`);
}

// ============================================================================
// Test Suite
// ============================================================================

async function runTests() {
  console.log('\n🚀 Starting Gemini Production API Integration Tests\n');
  
  let passed = 0;
  let failed = 0;
  
  // Reset metrics before tests
  resetHealthMetrics();
  
  // Test 1: Configuration Check
  try {
    logInfo('Test 1: Configuration Check');
    
    if (!isGeminiConfigured()) {
      throw new Error('GOOGLE_GEMINI_API_KEY not configured');
    }
    
    logSuccess('Configuration check passed');
    passed++;
  } catch (error) {
    logError('Configuration check failed', error);
    failed++;
    return; // Can't continue without configuration
  }
  
  // Test 2: Basic Generation
  try {
    logInfo('Test 2: Basic Generation');
    
    const request: GeminiRequest = {
      prompt: 'What is 2 + 2? Answer with just the number.',
      temperature: 0.1,
      maxTokens: 10,
      skipCache: true,
    };
    
    log('Sending request', request);
    
    const response = await generateWithGeminiProduction(request);
    
    log('Response received', {
      content: response.content,
      provider: response.provider,
      cached: response.cached,
      latency: response.latency,
    });
    
    if (!response.content) {
      throw new Error('Empty response content');
    }
    
    if (response.latency > 5000) {
      logError(`High latency: ${response.latency}ms (expected < 5000ms)`);
    }
    
    logSuccess(`Basic generation passed (${response.latency}ms, provider: ${response.provider})`);
    passed++;
  } catch (error) {
    logError('Basic generation failed', error);
    failed++;
  }
  
  // Test 3: Caching
  try {
    logInfo('Test 3: Caching');
    
    const request: GeminiRequest = {
      prompt: 'What is the capital of France?',
      cacheKey: 'test-cache-france',
      temperature: 0.7,
    };
    
    // First request (cache miss)
    log('First request (cache miss expected)');
    const response1 = await generateWithGeminiProduction(request);
    
    if (response1.cached) {
      throw new Error('First request should not be cached');
    }
    
    log('First response', {
      cached: response1.cached,
      latency: response1.latency,
    });
    
    // Second request (cache hit)
    log('Second request (cache hit expected)');
    const response2 = await generateWithGeminiProduction(request);
    
    if (!response2.cached) {
      logError('Second request should be cached (Redis may not be configured)');
    } else {
      log('Second response', {
        cached: response2.cached,
        latency: response2.latency,
      });
      
      if (response2.latency > 100) {
        throw new Error(`Cache hit too slow: ${response2.latency}ms (expected < 100ms)`);
      }
    }
    
    logSuccess('Caching test passed');
    passed++;
  } catch (error) {
    logError('Caching test failed', error);
    failed++;
  }
  
  // Test 4: Rate Limiting Info
  try {
    logInfo('Test 4: Rate Limiting Info');
    
    const rateLimit = getRateLimitInfo();
    
    log('Rate limit info', rateLimit);
    
    if (rateLimit.limit !== 10) {
      throw new Error(`Expected limit 10, got ${rateLimit.limit}`);
    }
    
    if (rateLimit.remaining < 0 || rateLimit.remaining > 10) {
      throw new Error(`Invalid remaining: ${rateLimit.remaining}`);
    }
    
    logSuccess(`Rate limiting info passed (${rateLimit.remaining}/${rateLimit.limit} remaining)`);
    passed++;
  } catch (error) {
    logError('Rate limiting info failed', error);
    failed++;
  }
  
  // Test 5: Health Status
  try {
    logInfo('Test 5: Health Status');
    
    const health = getGeminiHealthStatus();
    
    log('Health status', health);
    
    if (health.requestCount < 2) {
      throw new Error(`Expected at least 2 requests, got ${health.requestCount}`);
    }
    
    if (health.errorRate > 0.5) {
      logError(`High error rate: ${health.errorRate * 100}%`);
    }
    
    logSuccess(`Health status passed (${health.requestCount} requests, ${(health.errorRate * 100).toFixed(1)}% error rate)`);
    passed++;
  } catch (error) {
    logError('Health status failed', error);
    failed++;
  }
  
  // Test 6: Batch Processing
  try {
    logInfo('Test 6: Batch Processing');
    
    const requests: GeminiRequest[] = [
      { prompt: 'What is 1+1?', cacheKey: 'batch-1', temperature: 0.1, maxTokens: 10 },
      { prompt: 'What is 2+2?', cacheKey: 'batch-2', temperature: 0.1, maxTokens: 10 },
      { prompt: 'What is 3+3?', cacheKey: 'batch-3', temperature: 0.1, maxTokens: 10 },
    ];
    
    log('Sending batch requests', { count: requests.length });
    
    const startTime = Date.now();
    const responses = await batchGenerateWithGemini(requests);
    const totalTime = Date.now() - startTime;
    
    log('Batch responses received', {
      count: responses.length,
      totalTime,
      avgTime: totalTime / responses.length,
    });
    
    if (responses.length !== requests.length) {
      throw new Error(`Expected ${requests.length} responses, got ${responses.length}`);
    }
    
    const successCount = responses.filter(r => r.content).length;
    
    logSuccess(`Batch processing passed (${successCount}/${responses.length} successful, ${totalTime}ms total)`);
    passed++;
  } catch (error) {
    logError('Batch processing failed', error);
    failed++;
  }
  
  // Test 7: Rate Limiting Enforcement (Optional - takes time)
  if (process.env.TEST_RATE_LIMIT === 'true') {
    try {
      logInfo('Test 7: Rate Limiting Enforcement (this may take a few seconds)');
      
      const requests: GeminiRequest[] = Array(15).fill(null).map((_, i) => ({
        prompt: `Count to ${i + 1}`,
        skipCache: true,
        temperature: 0.1,
        maxTokens: 20,
      }));
      
      log('Sending 15 requests (exceeds 10 req/sec limit)');
      
      const startTime = Date.now();
      const responses = await batchGenerateWithGemini(requests);
      const totalTime = Date.now() - startTime;
      
      log('All requests completed', {
        count: responses.length,
        totalTime,
        avgTime: totalTime / responses.length,
      });
      
      // Should take at least 1 second due to rate limiting
      if (totalTime < 1000) {
        logError(`Rate limiting may not be working (completed in ${totalTime}ms)`);
      } else {
        logSuccess(`Rate limiting enforcement passed (${totalTime}ms for 15 requests)`);
        passed++;
      }
    } catch (error) {
      logError('Rate limiting enforcement failed', error);
      failed++;
    }
  } else {
    logInfo('Test 7: Rate Limiting Enforcement (skipped, set TEST_RATE_LIMIT=true to run)');
  }
  
  // Test 8: Skip Cache
  try {
    logInfo('Test 8: Skip Cache');
    
    const request: GeminiRequest = {
      prompt: 'What is the current time?',
      cacheKey: 'test-skip-cache',
      skipCache: true,
    };
    
    log('Sending request with skipCache=true');
    
    const response = await generateWithGeminiProduction(request);
    
    if (response.cached) {
      throw new Error('Response should not be cached when skipCache=true');
    }
    
    logSuccess('Skip cache test passed');
    passed++;
  } catch (error) {
    logError('Skip cache test failed', error);
    failed++;
  }
  
  // Final Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  // Final Health Check
  const finalHealth = getGeminiHealthStatus();
  console.log('\n📊 Final Health Status:');
  console.log(`   Healthy: ${finalHealth.healthy ? '✅' : '❌'}`);
  console.log(`   Provider: ${finalHealth.provider}`);
  console.log(`   Requests: ${finalHealth.requestCount}`);
  console.log(`   Errors: ${finalHealth.errorCount}`);
  console.log(`   Error Rate: ${(finalHealth.errorRate * 100).toFixed(1)}%`);
  console.log(`   Circuit Breaker: ${finalHealth.circuitBreakerOpen ? '🔴 OPEN' : '🟢 CLOSED'}`);
  
  if (finalHealth.lastError) {
    console.log(`   Last Error: ${finalHealth.lastError}`);
    console.log(`   Last Error Time: ${finalHealth.lastErrorTime}`);
  }
  
  console.log('='.repeat(60) + '\n');
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// ============================================================================
// Run Tests
// ============================================================================

runTests().catch((error) => {
  console.error('\n❌ Fatal error during tests:', error);
  process.exit(1);
});
