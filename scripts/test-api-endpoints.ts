#!/usr/bin/env node
/**
 * API Endpoints Test Suite
 * Tests all available API endpoints with various parameters
 * 
 * Usage: npx tsx scripts/test-api-endpoints.ts
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

interface TestResult {
  endpoint: string;
  method: string;
  status?: number;
  success: boolean;
  error?: string;
  duration: number;
  note?: string;
}

const results: TestResult[] = [];

// Helper function to make requests
async function testEndpoint(
  method: string,
  endpoint: string,
  body?: any,
  note?: string
): Promise<TestResult> {
  const url = `${BASE_URL}${endpoint}`;
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const duration = Date.now() - startTime;
    const success = response.ok;

    return {
      endpoint,
      method,
      status: response.status,
      success,
      duration,
      note,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      endpoint,
      method,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration,
      note,
    };
  }
}

function green(text: string): string {
  return `\x1b[32m${text}\x1b[0m`;
}

function red(text: string): string {
  return `\x1b[31m${text}\x1b[0m`;
}

function cyan(text: string): string {
  return `\x1b[36m${text}\x1b[0m`;
}

function blue(text: string): string {
  return `\x1b[34m${text}\x1b[0m`;
}

function gray(text: string): string {
  return `\x1b[90m${text}\x1b[0m`;
}

function yellow(text: string): string {
  return `\x1b[33m${text}\x1b[0m`;
}

async function runTests() {
  console.log(`\n${blue('🚀 API ENDPOINTS TEST SUITE\n')}`);
  console.log(`${gray(`Base URL: ${BASE_URL}\n`)}`);

  // Health Check Endpoints
  console.log(`${cyan('📊 Health Check Endpoints')}`);
  results.push(await testEndpoint('GET', '/api/health', undefined, 'Basic liveness probe'));
  results.push(
    await testEndpoint('GET', '/api/health/ready', undefined, 'Full readiness check')
  );
  results.push(
    await testEndpoint('GET', '/api/health/db', undefined, 'Database health')
  );
  results.push(
    await testEndpoint('GET', '/api/health/qdrant', undefined, 'Vector DB health')
  );
  results.push(
    await testEndpoint('GET', '/api/health/redis', undefined, 'Redis health')
  );

  // Observability Endpoints
  console.log(`${cyan('\n📈 Observability Endpoints')}`);
  results.push(
    await testEndpoint('GET', '/api/observability/health', undefined, 'Health metrics')
  );
  results.push(
    await testEndpoint('GET', '/api/observability/metrics', undefined, 'Performance metrics')
  );
  results.push(
    await testEndpoint('GET', '/api/observability/alerts', undefined, 'Active alerts')
  );
  results.push(
    await testEndpoint(
      'GET',
      '/api/observability/costs',
      undefined,
      'Resource costs'
    )
  );

  // Brokers Endpoints
  console.log(`${cyan('\n🏦 Brokers Endpoints')}`);
  results.push(
    await testEndpoint(
      'GET',
      '/api/brokers?page=1&limit=20',
      undefined,
      'List all brokers (paginated)'
    )
  );
  results.push(
    await testEndpoint(
      'GET',
      '/api/brokers?search=alpaca',
      undefined,
      'Search brokers'
    )
  );
  results.push(
    await testEndpoint(
      'GET',
      '/api/brokers?isActive=true',
      undefined,
      'Filter active brokers'
    )
  );
  results.push(
    await testEndpoint(
      'GET',
      '/api/broker/metrics',
      undefined,
      'Broker sync metrics'
    )
  );

  // Accounts Endpoints
  console.log(`${cyan('\n💼 Accounts Endpoints')}`);
  results.push(
    await testEndpoint(
      'GET',
      '/api/accounts?page=1&limit=50',
      undefined,
      'List user accounts (requires auth)'
    )
  );
  results.push(
    await testEndpoint(
      'GET',
      '/api/accounts?search=demo',
      undefined,
      'Search accounts (requires auth)'
    )
  );
  results.push(
    await testEndpoint(
      'GET',
      '/api/accounts/brokers',
      undefined,
      'List account brokers (requires auth)'
    )
  );

  // Vector DB Endpoints
  console.log(`${cyan('\n🔍 Vector DB Endpoints')}`);
  results.push(
    await testEndpoint('GET', '/api/vectordb/health', undefined, 'Vector DB status')
  );
  results.push(
    await testEndpoint(
      'POST',
      '/api/vectordb/search',
      { query: 'test search', limit: 10 },
      'Vector search (requires auth)'
    )
  );

  // TimescaleDB Endpoints
  console.log(`${cyan('\n⏱️ TimescaleDB Endpoints')}`);
  results.push(
    await testEndpoint(
      'GET',
      '/api/timescaledb-poc/info',
      undefined,
      'TimescaleDB info'
    )
  );
  results.push(
    await testEndpoint(
      'GET',
      '/api/timescaledb-poc/metadata',
      undefined,
      'TimescaleDB metadata'
    )
  );
  results.push(
    await testEndpoint(
      'POST',
      '/api/timescaledb-poc/ticks',
      {
        symbol: 'AAPL',
        timeframe: '1m',
        limit: 100,
      },
      'Fetch tick data'
    )
  );
  results.push(
    await testEndpoint(
      'POST',
      '/api/timescaledb-poc/candles',
      {
        symbol: 'AAPL',
        timeframe: '1h',
        limit: 100,
      },
      'Fetch candle data'
    )
  );

  // Queue Endpoints
  console.log(`${cyan('\n📝 Queue Endpoints')}`);
  results.push(
    await testEndpoint('GET', '/api/queue/dashboard', undefined, 'Queue dashboard')
  );
  results.push(
    await testEndpoint(
      'POST',
      '/api/queue/test',
      { message: 'test' },
      'Test queue (dev only)'
    )
  );

  // Subscription Endpoints
  console.log(`${cyan('\n💳 Subscription Endpoints')}`);
  results.push(
    await testEndpoint(
      'GET',
      '/api/subscription/status',
      undefined,
      'Check subscription (requires auth)'
    )
  );

  // AI Coach Endpoints
  console.log(`${cyan('\n🤖 AI Coach Endpoints')}`);
  results.push(
    await testEndpoint(
      'POST',
      '/api/coach/chat',
      { message: 'test' },
      'Coach chat (requires auth)'
    )
  );
  results.push(
    await testEndpoint(
      'POST',
      '/api/coach/feedback',
      { tradeId: 'test' },
      'Trade feedback (requires auth)'
    )
  );

  // AI POC Endpoints
  console.log(`${cyan('\n🧪 AI POC Endpoints')}`);
  results.push(
    await testEndpoint(
      'POST',
      '/api/ai-poc/test',
      { prompt: 'test' },
      'AI model test'
    )
  );

  // Voice Notes Endpoints
  console.log(`${cyan('\n🎙️ Voice Notes Endpoints')}`);
  results.push(
    await testEndpoint(
      'POST',
      '/api/voice-notes/upload',
      { fileName: 'test.wav' },
      'Upload voice note (requires auth)'
    )
  );
  results.push(
    await testEndpoint(
      'POST',
      '/api/day-voice-notes/upload',
      { fileName: 'test.wav' },
      'Upload day voice note (requires auth)'
    )
  );

  // Scheduler Endpoints
  console.log(`${cyan('\n⏰ Scheduler Endpoints')}`);
  results.push(
    await testEndpoint(
      'POST',
      '/api/scheduler/broker-sync',
      {},
      'Trigger broker sync (admin only)'
    )
  );

  // Cron Endpoints
  console.log(`${cyan('\n🔄 Cron Endpoints')}`);
  results.push(
    await testEndpoint(
      'POST',
      '/api/cron/qdrant-backup',
      {},
      'Trigger Qdrant backup'
    )
  );

  // Stripe Endpoints
  console.log(`${cyan('\n💰 Stripe Endpoints')}`);
  results.push(
    await testEndpoint(
      'POST',
      '/api/stripe/webhook',
      { type: 'charge.succeeded' },
      'Stripe webhook'
    )
  );

  // OCR Endpoints
  console.log(`${cyan('\n📸 OCR Endpoints')}`);
  results.push(
    await testEndpoint(
      'POST',
      '/api/ocr/parse',
      { imageUrl: 'https://example.com/image.jpg' },
      'Parse screenshot with OCR (requires auth)'
    )
  );

  // Print Results
  console.log(`\n${blue('\n📋 TEST RESULTS SUMMARY\n')}`);

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;
  const avgDuration =
    results.reduce((sum, r) => sum + r.duration, 0) / results.length;

  console.log(`${green(`✅ Passed: ${successCount}`)}`);
  console.log(`${red(`❌ Failed: ${failureCount}`)}`);
  console.log(`${gray(`⏱️  Average Response Time: ${avgDuration.toFixed(0)}ms\n`)}`);

  // Detailed results
  console.log(`${cyan('Endpoint Details:\n')}`);

  results.forEach((result) => {
    const statusIcon = result.success ? green('✓') : red('✗');
    const statusText = result.status
      ? `${result.status}`
      : result.error || 'No response';
    const statusColor = result.success ? green : red;

    console.log(
      `${statusIcon} ${result.method.padEnd(6)} ${result.endpoint.padEnd(50)} ${statusColor(
        statusText.padEnd(20)
      )} ${gray(`${result.duration}ms`)}`
    );

    if (result.note) {
      console.log(`${gray(`    └─ ${result.note}`)}`);
    }

    if (result.error) {
      console.log(`${gray(`    └─ Error: ${result.error}`)}`);
    }
  });

  // Categories breakdown
  console.log(`\n${blue('📊 Breakdown by Category:\n')}`);

  const categories = {
    'Health Checks': results.filter((r) => r.endpoint.includes('/health')),
    'Brokers': results.filter((r) => r.endpoint.includes('/broker')),
    'Accounts': results.filter((r) => r.endpoint.includes('/account')),
    'Vector DB': results.filter((r) => r.endpoint.includes('/vectordb')),
    'TimescaleDB': results.filter(
      (r) => r.endpoint.includes('/timescaledb') || r.endpoint.includes('/ticks')
    ),
    'Observability': results.filter((r) => r.endpoint.includes('/observability')),
    'Other': results.filter(
      (r) =>
        !r.endpoint.includes('/health') &&
        !r.endpoint.includes('/broker') &&
        !r.endpoint.includes('/account') &&
        !r.endpoint.includes('/vectordb') &&
        !r.endpoint.includes('/timescaledb') &&
        !r.endpoint.includes('/ticks') &&
        !r.endpoint.includes('/observability')
    ),
  };

  Object.entries(categories).forEach(([category, tests]) => {
    if (tests.length > 0) {
      const passed = tests.filter((t) => t.success).length;
      const total = tests.length;
      const percentage = ((passed / total) * 100).toFixed(0);
      const color = passed === total ? green : yellow;
      console.log(
        `${color(`${category}: ${passed}/${total} (${percentage}%`)}`
      );
    }
  });

  console.log('\n');

  // Summary
  const failedTests = results.filter((r) => !r.success);
  if (failedTests.length > 0) {
    console.log(`${yellow('\n⚠️  Failed Endpoints (may require authentication):\n')}`);
    failedTests.forEach((test) => {
      console.log(`${yellow(`  • ${test.method} ${test.endpoint}`)}`);
      if (test.error) {
        console.log(`${gray(`    Error: ${test.error}`)}`);
      }
    });
  }

  console.log(`${green('\n✨ Test suite completed!\n')}`);

  // Return exit code based on results
  process.exit(failureCount > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error(red('Fatal error:'), error);
  process.exit(1);
});
