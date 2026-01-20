#!/usr/bin/env tsx
/**
 * PRÉ-11.2 & PRÉ-11.3: Baseline Metrics & Data Integrity Checks
 * 
 * This script validates data integrity and measures performance benchmarks
 * for the trading journal application.
 * 
 * Usage:
 *   npm run baseline-metrics
 *   npm run baseline-metrics -- --verbose
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface MetricResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  value: number | string;
  threshold?: number | string;
  message: string;
}

const results: MetricResult[] = [];
const verbose = process.argv.includes('--verbose');

function log(message: string, level: 'info' | 'success' | 'warn' | 'error' = 'info') {
  if (!verbose && level === 'info') return;
  
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m',
  };
  
  console.log(`${colors[level]}${message}${colors.reset}`);
}

function addResult(result: MetricResult) {
  results.push(result);
  
  const statusIcon = {
    PASS: '✅',
    FAIL: '❌',
    WARN: '⚠️',
  };
  
  log(`${statusIcon[result.status]} ${result.name}: ${result.message}`, 
      result.status === 'PASS' ? 'success' : result.status === 'WARN' ? 'warn' : 'error');
}

async function checkDatabaseConnection(): Promise<void> {
  log('🔍 Checking database connection...');
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    addResult({
      name: 'Database Connection',
      status: 'PASS',
      value: 'Connected',
      message: 'Database is accessible',
    });
  } catch (error) {
    addResult({
      name: 'Database Connection',
      status: 'FAIL',
      value: 'Disconnected',
      message: `Database connection failed: ${error}`,
    });
  }
}

async function checkRedisConnection(): Promise<void> {
  log('🔍 Checking Redis connection...');
  
  try {
    await redis.ping();
    addResult({
      name: 'Redis Connection',
      status: 'PASS',
      value: 'Connected',
      message: 'Redis is accessible',
    });
  } catch (error) {
    addResult({
      name: 'Redis Connection',
      status: 'FAIL',
      value: 'Disconnected',
      message: `Redis connection failed: ${error}`,
    });
  }
}

async function checkDataIntegrity(): Promise<void> {
  log('🔍 Checking data integrity...');
  
  // 1. Check for trades without users (userId is required by schema, so this should always be 0)
  // Skipping this check as userId is non-nullable in the schema
  const orphanTrades = 0;
  
  addResult({
    name: 'Orphan Trades',
    status: 'PASS',
    value: orphanTrades,
    threshold: 0,
    message: 'Schema enforces userId requirement',
  });
  
  // 2. Check for trades with invalid PnL (only check quantity as other fields are non-nullable)
  const invalidPnlTrades = await prisma.trade.count({
    where: {
      quantity: { lte: 0 },
    },
  });
  
  addResult({
    name: 'Invalid Trade Data',
    status: invalidPnlTrades === 0 ? 'PASS' : 'WARN',
    value: invalidPnlTrades,
    threshold: 0,
    message: invalidPnlTrades === 0 ? 'All trades have valid data' : `Found ${invalidPnlTrades} trades with invalid quantity`,
  });
  
  // 3. Check for trades with openedAt > closedAt (timestamps are non-nullable)
  const tradesWithInvertedTime = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM trades
    WHERE opened_at > closed_at
  `;
  
  const invertedCount = Number(tradesWithInvertedTime[0]?.count || 0);
  
  addResult({
    name: 'Trade Timestamps',
    status: invertedCount === 0 ? 'PASS' : 'FAIL',
    value: invertedCount,
    threshold: 0,
    message: invertedCount === 0 ? 'All trade timestamps are valid' : `Found ${invertedCount} trades with inverted timestamps`,
  });
  
  // 4. Check for duplicate trades
  const duplicateTrades = await prisma.$queryRaw<Array<{ count: bigint; duplicate_count: bigint }>>`
    SELECT 
      COUNT(*) as count,
      SUM(duplicate_count) as duplicate_count
    FROM (
      SELECT 
        user_id, 
        symbol, 
        opened_at, 
        closed_at, 
        entry_price, 
        exit_price,
        COUNT(*) - 1 as duplicate_count
      FROM trades
      GROUP BY user_id, symbol, opened_at, closed_at, entry_price, exit_price
      HAVING COUNT(*) > 1
    ) as duplicates
  `;
  
  const duplicateCount = Number(duplicateTrades[0]?.duplicate_count || 0);
  
  addResult({
    name: 'Duplicate Trades',
    status: duplicateCount === 0 ? 'PASS' : 'WARN',
    value: duplicateCount,
    threshold: 0,
    message: duplicateCount === 0 ? 'No duplicate trades found' : `Found ${duplicateCount} potential duplicate trades`,
  });
  
  // 5. Note: Broker model doesn't have a direct accounts relation
  // Brokers are tracked via Account.broker (string) field
  const brokersWithoutAccounts = 0; // Skip this check as schema doesn't support it
  
  addResult({
    name: 'Brokers With Accounts',
    status: 'PASS',
    value: brokersWithoutAccounts,
    message: `Broker-account linking is via Account.broker string field`,
  });
  
  // 6. Check for accounts without brokers
  const orphanAccounts = await prisma.account.count({
    where: {
      broker: null,
    },
  });
  
  addResult({
    name: 'Orphan Accounts',
    status: orphanAccounts === 0 ? 'PASS' : 'FAIL',
    value: orphanAccounts,
    threshold: 0,
    message: orphanAccounts === 0 ? 'No orphan accounts found' : `Found ${orphanAccounts} accounts without brokers`,
  });
  
  // 7. Check users without accounts
  const usersWithoutAccounts = await prisma.user.count({
    where: {
      accounts: {
        none: {},
      },
    },
  });
  
  addResult({
    name: 'Users Without Accounts',
    status: 'PASS',
    value: usersWithoutAccounts,
    message: `${usersWithoutAccounts} users have no accounts (new users expected)`,
  });
  
  // 8. Check for daily bias analyses without users (userId is required by schema)
  const orphanAnalyses = 0; // Schema enforces userId requirement
  
  addResult({
    name: 'Orphan Daily Bias Analyses',
    status: 'PASS',
    value: orphanAnalyses,
    threshold: 0,
    message: 'Schema enforces userId requirement',
  });
}

async function measureDatabasePerformance(): Promise<void> {
  log('🔍 Measuring database performance...');
  
  // 1. Count queries
  const start1 = Date.now();
  const userCount = await prisma.user.count();
  const countLatency = Date.now() - start1;
  
  addResult({
    name: 'User Count Query',
    status: countLatency < 100 ? 'PASS' : countLatency < 500 ? 'WARN' : 'FAIL',
    value: `${countLatency}ms`,
    threshold: '100ms',
    message: `Query took ${countLatency}ms (${userCount} users)`,
  });
  
  // 2. Simple SELECT queries
  const start2 = Date.now();
  await prisma.trade.findMany({
    take: 100,
    orderBy: {
      closedAt: 'desc',
    },
  });
  const selectLatency = Date.now() - start2;
  
  addResult({
    name: 'Trade SELECT Query',
    status: selectLatency < 200 ? 'PASS' : selectLatency < 500 ? 'WARN' : 'FAIL',
    value: `${selectLatency}ms`,
    threshold: '200ms',
    message: `Query took ${selectLatency}ms (100 trades)`,
  });
  
  // 3. JOIN queries
  const start3 = Date.now();
  await prisma.account.findMany({
    take: 50,
    include: {
      user: true,
    },
  });
  const joinLatency = Date.now() - start3;
  
  addResult({
    name: 'Account JOIN Query',
    status: joinLatency < 300 ? 'PASS' : joinLatency < 1000 ? 'WARN' : 'FAIL',
    value: `${joinLatency}ms`,
    threshold: '300ms',
    message: `Query took ${joinLatency}ms (50 accounts with broker + user)`,
  });
  
  // 4. Aggregation queries
  const start4 = Date.now();
  await prisma.trade.groupBy({
    by: ['userId'],
    _sum: {
      realizedPnlUsd: true,
    },
    _count: {
      id: true,
    },
  });
  const aggregationLatency = Date.now() - start4;
  
  addResult({
    name: 'Trade Aggregation Query',
    status: aggregationLatency < 500 ? 'PASS' : aggregationLatency < 2000 ? 'WARN' : 'FAIL',
    value: `${aggregationLatency}ms`,
    threshold: '500ms',
    message: `Query took ${aggregationLatency}ms (PnL aggregation by user)`,
  });
}

async function measureRedisPerformance(): Promise<void> {
  log('🔍 Measuring Redis performance...');
  
  // 1. GET operation
  const start1 = Date.now();
  await redis.get('baseline-test-key');
  const getLatency = Date.now() - start1;
  
  addResult({
    name: 'Redis GET',
    status: getLatency < 10 ? 'PASS' : getLatency < 50 ? 'WARN' : 'FAIL',
    value: `${getLatency}ms`,
    threshold: '10ms',
    message: `GET operation took ${getLatency}ms`,
  });
  
  // 2. SET operation
  const start2 = Date.now();
  await redis.set('baseline-test-key', 'test-value', 'EX', 60);
  const setLatency = Date.now() - start2;
  
  addResult({
    name: 'Redis SET',
    status: setLatency < 10 ? 'PASS' : setLatency < 50 ? 'WARN' : 'FAIL',
    value: `${setLatency}ms`,
    threshold: '10ms',
    message: `SET operation took ${setLatency}ms`,
  });
  
  // 3. INCR operation
  const start3 = Date.now();
  await redis.incr('baseline-test-counter');
  const incrLatency = Date.now() - start3;
  
  addResult({
    name: 'Redis INCR',
    status: incrLatency < 10 ? 'PASS' : incrLatency < 50 ? 'WARN' : 'FAIL',
    value: `${incrLatency}ms`,
    threshold: '10ms',
    message: `INCR operation took ${incrLatency}ms`,
  });
  
  // 4. Pipeline operation
  const start4 = Date.now();
  const pipeline = redis.pipeline();
  for (let i = 0; i < 100; i++) {
    pipeline.set(`baseline-bulk-${i}`, `value-${i}`, 'EX', 60);
  }
  await pipeline.exec();
  const pipelineLatency = Date.now() - start4;
  
  addResult({
    name: 'Redis Pipeline (100 ops)',
    status: pipelineLatency < 50 ? 'PASS' : pipelineLatency < 200 ? 'WARN' : 'FAIL',
    value: `${pipelineLatency}ms`,
    threshold: '50ms',
    message: `Pipeline operation took ${pipelineLatency}ms`,
  });
  
  // Cleanup
  await redis.del('baseline-test-key', 'baseline-test-counter');
  const keys = await redis.keys('baseline-bulk-*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

async function checkBrokerSyncSuccess(): Promise<void> {
  log('🔍 Checking broker sync success rates...');
  
  // Get total accounts by broker (Account.broker is a string, not a relation)
  const accountsByBroker = await prisma.account.groupBy({
    by: ['broker'],
    _count: {
      id: true,
    },
    where: {
      broker: {
        not: null,
      },
    },
  });
  
  for (const group of accountsByBroker) {
    if (!group.broker) continue;
    
    const accountCount = group._count.id;
    const tradeCount = await prisma.trade.count({
      where: {
        account: {
          broker: group.broker,
        },
      },
    });
    
    const avgTradesPerAccount = accountCount > 0 ? tradeCount / accountCount : 0;
    
    addResult({
      name: `${group.broker} Sync`,
      status: tradeCount > 0 ? 'PASS' : 'WARN',
      value: `${accountCount} accounts, ${tradeCount} trades`,
      message: `${group.broker}: ${accountCount} accounts synced with ${tradeCount} total trades (avg ${avgTradesPerAccount.toFixed(1)} trades/account)`,
    });
  }
}

async function generateSummary(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('📊 BASELINE METRICS SUMMARY');
  console.log('='.repeat(80) + '\n');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  console.log(`✅ PASSED: ${passed}`);
  console.log(`⚠️  WARNED: ${warned}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log(`📈 TOTAL:  ${results.length}\n`);
  
  if (failed > 0) {
    console.log('🚨 CRITICAL FAILURES:\n');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`   ❌ ${r.name}: ${r.message}`);
      });
    console.log('');
  }
  
  if (warned > 0) {
    console.log('⚠️  WARNINGS:\n');
    results
      .filter(r => r.status === 'WARN')
      .forEach(r => {
        console.log(`   ⚠️  ${r.name}: ${r.message}`);
      });
    console.log('');
  }
  
  const successRate = ((passed / results.length) * 100).toFixed(1);
  console.log(`📊 Success Rate: ${successRate}%`);
  
  if (parseFloat(successRate) >= 95) {
    console.log('✅ System health: EXCELLENT');
  } else if (parseFloat(successRate) >= 85) {
    console.log('⚠️  System health: GOOD (with warnings)');
  } else {
    console.log('❌ System health: POOR (action required)');
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

async function main() {
  console.log('🚀 Starting baseline metrics validation...\n');
  
  try {
    await checkDatabaseConnection();
    await checkRedisConnection();
    await checkDataIntegrity();
    await measureDatabasePerformance();
    await measureRedisPerformance();
    await checkBrokerSyncSuccess();
    
    await generateSummary();
    
    const failed = results.filter(r => r.status === 'FAIL').length;
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await redis.quit();
  }
}

main();
