/**
 * Account Performance Benchmark
 * Story 3.1: Unlimited Accounts - Performance Testing
 *
 * Benchmarks account queries with 100+ accounts to ensure < 500ms p95 latency.
 *
 * Usage:
 *   npx tsx scripts/benchmark-accounts.ts
 *   npx tsx scripts/benchmark-accounts.ts --accounts 150
 *   npx tsx scripts/benchmark-accounts.ts --cleanup
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/observability';
import {
  getAccounts,
  getAccountById,
  getAccountsWithStats,
  getAccountStats,
  getUserBrokers,
  createAccount,
  getAccountCount,
} from '@/services/account-service';
import {
  getAggregateMetrics,
  getAggregateEquityCurve,
} from '@/services/account-aggregate-service';
import { flushCache } from '@/lib/cache';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_ACCOUNT_COUNT = 100;
const BENCHMARK_USER_EMAIL = 'benchmark-test@example.com';
const BROKERS = ['Interactive Brokers', 'Tradovate', 'NinjaTrader', 'TD Ameritrade', 'E*TRADE'];

// ============================================================================
// Test Data Generation
// ============================================================================

async function createBenchmarkUser(): Promise<string> {
  console.log('Creating benchmark user...');

  // Check if user exists
  let user = await prisma.user.findUnique({
    where: { email: BENCHMARK_USER_EMAIL },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: BENCHMARK_USER_EMAIL,
      },
    });
    console.log(`✓ Created user: ${user.id}`);
  } else {
    console.log(`✓ Using existing user: ${user.id}`);
  }

  return user.id;
}

async function generateTestAccounts(userId: string, count: number): Promise<void> {
  console.log(`\nGenerating ${count} test accounts...`);

  const existingCount = await getAccountCount(userId);
  if (existingCount >= count) {
    console.log(`✓ Already have ${existingCount} accounts, skipping generation`);
    return;
  }

  const accountsToCreate = count - existingCount;
  console.log(`Creating ${accountsToCreate} new accounts...`);

  const batchSize = 50;
  for (let i = 0; i < accountsToCreate; i += batchSize) {
    const batch = Math.min(batchSize, accountsToCreate - i);
    const accounts = Array.from({ length: batch }, (_, j) => {
      const index = existingCount + i + j + 1;
      return {
        userId,
        name: `Test Account ${index}`,
        broker: BROKERS[index % BROKERS.length],
        description: `Benchmark test account ${index}`,
        color: '#6366f1',
        initialBalance: 10000 + Math.random() * 90000,
      };
    });

    await prisma.account.createMany({
      data: accounts,
      skipDuplicates: true,
    });

    console.log(`  Created accounts ${existingCount + i + 1} to ${existingCount + i + batch}`);
  }

  console.log(`✓ Generated ${accountsToCreate} accounts`);
}

async function generateTestTrades(userId: string, accountCount: number): Promise<void> {
  console.log('\nGenerating test trades...');

  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true },
    take: accountCount,
  });

  // Check if trades already exist
  const existingTradeCount = await prisma.trade.count({
    where: { userId },
  });

  if (existingTradeCount > 0) {
    console.log(`✓ Already have ${existingTradeCount} trades, skipping generation`);
    return;
  }

  console.log(`Creating trades for ${accounts.length} accounts...`);

  // Create 10-50 trades per account
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const tradeCount = 10 + Math.floor(Math.random() * 40);

    const trades = Array.from({ length: tradeCount }, (_, j) => {
      const isWin = Math.random() > 0.4; // 60% win rate
      const pnl = isWin ? 100 + Math.random() * 500 : -(50 + Math.random() * 300);

      return {
        userId,
        accountId: account.id,
        symbol: ['ES', 'NQ', 'YM', 'RTY', 'CL'][Math.floor(Math.random() * 5)],
        direction: (Math.random() > 0.5 ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
        openedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        closedAt: new Date(Date.now() - Math.random() * 29 * 24 * 60 * 60 * 1000),
        entryPrice: 4000 + Math.random() * 500,
        exitPrice: 4000 + Math.random() * 500,
        quantity: 1,
        realizedPnlUsd: pnl,
      };
    });

    await prisma.trade.createMany({
      data: trades,
      skipDuplicates: true,
    });

    if ((i + 1) % 10 === 0) {
      console.log(`  Created trades for ${i + 1}/${accounts.length} accounts`);
    }
  }

  const totalTrades = await prisma.trade.count({ where: { userId } });
  console.log(`✓ Generated ${totalTrades} trades`);
}

// ============================================================================
// Benchmark Functions
// ============================================================================

interface BenchmarkResult {
  name: string;
  iterations: number;
  times: number[];
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  passed: boolean;
}

function calculatePercentile(times: number[], percentile: number): number {
  const sorted = [...times].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

async function runBenchmark(
  name: string,
  fn: () => Promise<void>,
  iterations: number = 10
): Promise<BenchmarkResult> {
  console.log(`\nRunning: ${name}`);
  const times: number[] = [];

  // Warm-up run
  await fn();

  // Benchmark runs
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const duration = performance.now() - start;
    times.push(duration);
    process.stdout.write('.');
  }

  console.log(''); // New line after dots

  const min = Math.min(...times);
  const max = Math.max(...times);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p50 = calculatePercentile(times, 50);
  const p95 = calculatePercentile(times, 95);
  const p99 = calculatePercentile(times, 99);

  const passed = p95 < 500; // Target: < 500ms p95

  console.log(`  Min: ${min.toFixed(2)}ms`);
  console.log(`  Max: ${max.toFixed(2)}ms`);
  console.log(`  Avg: ${avg.toFixed(2)}ms`);
  console.log(`  P50: ${p50.toFixed(2)}ms`);
  console.log(`  P95: ${p95.toFixed(2)}ms ${passed ? '✓' : '✗ FAILED'}`);
  console.log(`  P99: ${p99.toFixed(2)}ms`);

  return {
    name,
    iterations,
    times,
    min,
    max,
    avg,
    p50,
    p95,
    p99,
    passed,
  };
}

// ============================================================================
// Benchmarks
// ============================================================================

async function benchmarkGetAccounts(userId: string): Promise<BenchmarkResult> {
  return runBenchmark('getAccounts (paginated, limit 50)', async () => {
    await getAccounts({ userId }, { limit: 50 });
  });
}

async function benchmarkGetAccountsWithStats(userId: string): Promise<BenchmarkResult> {
  return runBenchmark('getAccountsWithStats (limit 50)', async () => {
    await getAccountsWithStats({ userId }, { limit: 50 });
  });
}

async function benchmarkGetAccountById(userId: string): Promise<BenchmarkResult> {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true },
    take: 1,
  });

  const accountId = accounts[0].id;

  return runBenchmark('getAccountById (cached)', async () => {
    await getAccountById(accountId, userId);
  });
}

async function benchmarkGetAccountStats(userId: string): Promise<BenchmarkResult> {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true },
    take: 1,
  });

  const accountId = accounts[0].id;

  return runBenchmark('getAccountStats (cached)', async () => {
    await getAccountStats(accountId, userId);
  });
}

async function benchmarkGetUserBrokers(userId: string): Promise<BenchmarkResult> {
  return runBenchmark('getUserBrokers (cached)', async () => {
    await getUserBrokers(userId);
  });
}

async function benchmarkGetAggregateMetrics(userId: string): Promise<BenchmarkResult> {
  return runBenchmark('getAggregateMetrics (all accounts)', async () => {
    await getAggregateMetrics({ userId });
  });
}

async function benchmarkGetAggregateEquityCurve(userId: string): Promise<BenchmarkResult> {
  return runBenchmark('getAggregateEquityCurve (all accounts)', async () => {
    await getAggregateEquityCurve({ userId });
  });
}

// ============================================================================
// Main
// ============================================================================

async function cleanup() {
  console.log('\n🧹 Cleaning up benchmark data...');

  const user = await prisma.user.findUnique({
    where: { email: BENCHMARK_USER_EMAIL },
  });

  if (!user) {
    console.log('No benchmark user found');
    return;
  }

  // Delete trades
  const deletedTrades = await prisma.trade.deleteMany({
    where: { userId: user.id },
  });
  console.log(`✓ Deleted ${deletedTrades.count} trades`);

  // Delete accounts
  const deletedAccounts = await prisma.account.deleteMany({
    where: { userId: user.id },
  });
  console.log(`✓ Deleted ${deletedAccounts.count} accounts`);

  // Delete user
  await prisma.user.delete({
    where: { id: user.id },
  });
  console.log(`✓ Deleted user`);

  // Flush cache
  await flushCache();
  console.log(`✓ Flushed cache`);

  console.log('\n✅ Cleanup complete');
}

async function main() {
  const args = process.argv.slice(2);

  // Handle cleanup flag
  if (args.includes('--cleanup')) {
    await cleanup();
    process.exit(0);
  }

  // Parse account count
  const accountCountArg = args.find((arg) => arg.startsWith('--accounts='));
  const accountCount = accountCountArg
    ? parseInt(accountCountArg.split('=')[1], 10)
    : DEFAULT_ACCOUNT_COUNT;

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Account Performance Benchmark - Story 3.1                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nTarget: < 500ms p95 latency with ${accountCount}+ accounts\n`);

  try {
    // Setup
    const userId = await createBenchmarkUser();
    await generateTestAccounts(userId, accountCount);
    await generateTestTrades(userId, accountCount);

    // Flush cache to ensure fair benchmarks
    await flushCache();
    console.log('\n✓ Cache flushed for clean benchmarks');

    // Run benchmarks
    const results: BenchmarkResult[] = [];

    results.push(await benchmarkGetAccounts(userId));
    results.push(await benchmarkGetAccountsWithStats(userId));
    results.push(await benchmarkGetAccountById(userId));
    results.push(await benchmarkGetAccountStats(userId));
    results.push(await benchmarkGetUserBrokers(userId));
    results.push(await benchmarkGetAggregateMetrics(userId));
    results.push(await benchmarkGetAggregateEquityCurve(userId));

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  BENCHMARK SUMMARY                                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const allPassed = results.every((r) => r.passed);

    results.forEach((result) => {
      const status = result.passed ? '✓ PASS' : '✗ FAIL';
      console.log(`${status} ${result.name}`);
      console.log(`     P95: ${result.p95.toFixed(2)}ms (target: < 500ms)`);
    });

    console.log('\n' + '─'.repeat(60));
    console.log(`Total: ${results.length} benchmarks`);
    console.log(`Passed: ${results.filter((r) => r.passed).length}`);
    console.log(`Failed: ${results.filter((r) => !r.passed).length}`);

    if (allPassed) {
      console.log('\n✅ All benchmarks passed! Performance target met.');
    } else {
      console.log('\n❌ Some benchmarks failed. Optimization needed.');
    }

    console.log('\nTo clean up test data, run:');
    console.log('  npx tsx scripts/benchmark-accounts.ts --cleanup');
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
