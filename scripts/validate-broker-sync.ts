#!/usr/bin/env tsx
/**
 * PRÉ-11.1: Broker Sync Success Metrics
 * 
 * This script validates broker sync operations and generates detailed reports
 * on sync success rates, data completeness, and potential issues.
 * 
 * Usage:
 *   npm run validate-broker-sync
 *   npm run validate-broker-sync -- --broker=ALPACA
 *   npm run validate-broker-sync -- --verbose
 */

import { PrismaClient, BrokerType } from '@prisma/client';

const prisma = new PrismaClient();

interface SyncMetrics {
  broker: string;
  totalAccounts: number;
  activeAccounts: number;
  totalTrades: number;
  avgTradesPerAccount: number;
  oldestTrade: Date | null;
  newestTrade: Date | null;
  syncCoverage: number; // days of history
  tradesLast24h: number;
  tradesLast7d: number;
  tradesLast30d: number;
  status: 'EXCELLENT' | 'GOOD' | 'POOR' | 'NO_DATA';
  issues: string[];
}

const verbose = process.argv.includes('--verbose');
const brokerFilter = process.argv.find(arg => arg.startsWith('--broker='))?.split('=')[1];

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

async function validateBrokerSync(brokerType: BrokerType): Promise<SyncMetrics> {
  log(`\n🔍 Validating ${brokerType} sync...`, 'info');
  
  // BrokerConnection uses brokerType enum, find connections first
  const brokerConnections = await prisma.brokerConnection.findMany({
    where: {
      brokerType: brokerType,
    },
  });
  
  if (brokerConnections.length === 0) {
    return {
      broker: brokerType,
      totalAccounts: 0,
      activeAccounts: 0,
      totalTrades: 0,
      avgTradesPerAccount: 0,
      oldestTrade: null,
      newestTrade: null,
      syncCoverage: 0,
      tradesLast24h: 0,
      tradesLast7d: 0,
      tradesLast30d: 0,
      status: 'NO_DATA',
      issues: ['No broker connections found in database'],
    };
  }
  
  // Get all accounts for these broker connections
  const accountIds = brokerConnections
    .map(bc => bc.accountId)
    .filter((id): id is string => id !== null);
  
  const accounts = await prisma.account.findMany({
    where: {
      id: { in: accountIds },
    },
    include: {
      _count: {
        select: {
          trades: true,
        },
      },
    },
  });
  
  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter(a => a._count.trades > 0).length;
  
  // Get trade statistics - accountIds already defined above, reuse it
  const trades = await prisma.trade.findMany({
    where: {
      accountId: { in: accountIds },
    },
    orderBy: {
      closedAt: 'asc',
    },
    select: {
      closedAt: true,
    },
  });
  
  const totalTrades = trades.length;
  const avgTradesPerAccount = totalAccounts > 0 ? totalTrades / totalAccounts : 0;
  
  const oldestTrade = trades[0]?.closedAt || null;
  const newestTrade = trades[trades.length - 1]?.closedAt || null;
  
  // Calculate sync coverage in days
  let syncCoverage = 0;
  if (oldestTrade && newestTrade) {
    const diff = newestTrade.getTime() - oldestTrade.getTime();
    syncCoverage = Math.floor(diff / (1000 * 60 * 60 * 24));
  }
  
  // Trades in last time periods
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const tradesLast24h = await prisma.trade.count({
    where: {
      accountId: { in: accountIds },
      closedAt: {
        gte: yesterday,
      },
    },
  });
  
  const tradesLast7d = await prisma.trade.count({
    where: {
      accountId: { in: accountIds },
      closedAt: {
        gte: last7d,
      },
    },
  });
  
  const tradesLast30d = await prisma.trade.count({
    where: {
      accountId: { in: accountIds },
      closedAt: {
        gte: last30d,
      },
    },
  });
  
  // Identify issues
  const issues: string[] = [];
  
  if (totalAccounts === 0) {
    issues.push('No accounts configured');
  }
  
  if (totalAccounts > 0 && activeAccounts === 0) {
    issues.push('No accounts have synced any trades');
  }
  
  if (totalAccounts > 0 && activeAccounts / totalAccounts < 0.5) {
    issues.push(`Low account activation rate: ${((activeAccounts / totalAccounts) * 100).toFixed(1)}%`);
  }
  
  if (totalTrades > 0 && avgTradesPerAccount < 5) {
    issues.push(`Low average trades per account: ${avgTradesPerAccount.toFixed(1)}`);
  }
  
  if (totalTrades > 0 && syncCoverage < 30) {
    issues.push(`Limited sync coverage: only ${syncCoverage} days of history`);
  }
  
  if (totalTrades > 0 && tradesLast24h === 0 && tradesLast7d === 0) {
    issues.push('No recent trades (last 7 days) - sync may be stale');
  }
  
  // Determine status
  let status: 'EXCELLENT' | 'GOOD' | 'POOR' | 'NO_DATA' = 'NO_DATA';
  
  if (totalTrades > 0) {
    if (issues.length === 0 && activeAccounts / totalAccounts >= 0.8) {
      status = 'EXCELLENT';
    } else if (issues.length <= 2 && activeAccounts / totalAccounts >= 0.5) {
      status = 'GOOD';
    } else {
      status = 'POOR';
    }
  }
  
  return {
    broker: brokerType,
    totalAccounts,
    activeAccounts,
    totalTrades,
    avgTradesPerAccount,
    oldestTrade,
    newestTrade,
    syncCoverage,
    tradesLast24h,
    tradesLast7d,
    tradesLast30d,
    status,
    issues,
  };
}

function displayMetrics(metrics: SyncMetrics) {
  const statusIcon = {
    EXCELLENT: '✅',
    GOOD: '⚠️',
    POOR: '❌',
    NO_DATA: '⚫',
  };
  
  const statusColor = {
    EXCELLENT: '\x1b[32m',
    GOOD: '\x1b[33m',
    POOR: '\x1b[31m',
    NO_DATA: '\x1b[90m',
    reset: '\x1b[0m',
  };
  
  console.log(`\n${statusIcon[metrics.status]} ${statusColor[metrics.status]}${metrics.broker}${statusColor.reset}`);
  console.log('─'.repeat(60));
  console.log(`  Accounts:           ${metrics.totalAccounts} total, ${metrics.activeAccounts} active`);
  console.log(`  Trades:             ${metrics.totalTrades} total`);
  console.log(`  Avg Trades/Account: ${metrics.avgTradesPerAccount.toFixed(2)}`);
  
  if (metrics.oldestTrade && metrics.newestTrade) {
    console.log(`  History Range:      ${metrics.oldestTrade.toISOString().split('T')[0]} to ${metrics.newestTrade.toISOString().split('T')[0]}`);
    console.log(`  Sync Coverage:      ${metrics.syncCoverage} days`);
  }
  
  console.log(`  Trades (24h):       ${metrics.tradesLast24h}`);
  console.log(`  Trades (7d):        ${metrics.tradesLast7d}`);
  console.log(`  Trades (30d):       ${metrics.tradesLast30d}`);
  console.log(`  Status:             ${statusColor[metrics.status]}${metrics.status}${statusColor.reset}`);
  
  if (metrics.issues.length > 0) {
    console.log(`  Issues:`);
    metrics.issues.forEach(issue => {
      console.log(`    • ${issue}`);
    });
  }
}

function generateSummaryReport(allMetrics: SyncMetrics[]) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 BROKER SYNC VALIDATION SUMMARY');
  console.log('='.repeat(80));
  
  const excellent = allMetrics.filter(m => m.status === 'EXCELLENT').length;
  const good = allMetrics.filter(m => m.status === 'GOOD').length;
  const poor = allMetrics.filter(m => m.status === 'POOR').length;
  const noData = allMetrics.filter(m => m.status === 'NO_DATA').length;
  
  console.log(`\n✅ EXCELLENT: ${excellent}`);
  console.log(`⚠️  GOOD:      ${good}`);
  console.log(`❌ POOR:      ${poor}`);
  console.log(`⚫ NO DATA:   ${noData}`);
  console.log(`📈 TOTAL:     ${allMetrics.length}\n`);
  
  const totalTrades = allMetrics.reduce((sum, m) => sum + m.totalTrades, 0);
  const totalAccounts = allMetrics.reduce((sum, m) => sum + m.totalAccounts, 0);
  const activeAccounts = allMetrics.reduce((sum, m) => sum + m.activeAccounts, 0);
  
  console.log(`📊 Global Statistics:`);
  console.log(`   • Total Accounts: ${totalAccounts}`);
  console.log(`   • Active Accounts: ${activeAccounts} (${((activeAccounts / totalAccounts) * 100).toFixed(1)}%)`);
  console.log(`   • Total Trades: ${totalTrades}`);
  console.log(`   • Avg Trades/Account: ${(totalTrades / totalAccounts).toFixed(2)}`);
  
  const brokersWithIssues = allMetrics.filter(m => m.issues.length > 0);
  
  if (brokersWithIssues.length > 0) {
    console.log(`\n🚨 BROKERS WITH ISSUES (${brokersWithIssues.length}):\n`);
    brokersWithIssues.forEach(m => {
      console.log(`   ${m.broker}:`);
      m.issues.forEach(issue => {
        console.log(`      • ${issue}`);
      });
    });
  }
  
  const successRate = ((excellent + good) / allMetrics.length) * 100;
  console.log(`\n📊 Success Rate: ${successRate.toFixed(1)}%`);
  
  if (successRate >= 90) {
    console.log('✅ Overall sync health: EXCELLENT');
  } else if (successRate >= 70) {
    console.log('⚠️  Overall sync health: GOOD (some issues to address)');
  } else {
    console.log('❌ Overall sync health: POOR (immediate action required)');
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

async function main() {
  console.log('🚀 Starting broker sync validation...\n');
  
  try {
    // Get all broker types
    const brokerTypes: BrokerType[] = brokerFilter 
      ? [brokerFilter as BrokerType]
      : [
          'ALPACA',
          'OANDA',
          'TRADESTATION',
          'TOPSTEPX',
          'NINJATRADER',
          'BINANCE',
          'AMP_FUTURES',
          'APEX_TRADER',
          'TRADOVATE',
          'IBKR',
        ];
    
    const allMetrics: SyncMetrics[] = [];
    
    for (const brokerType of brokerTypes) {
      const metrics = await validateBrokerSync(brokerType);
      allMetrics.push(metrics);
      displayMetrics(metrics);
    }
    
    generateSummaryReport(allMetrics);
    
    const poor = allMetrics.filter(m => m.status === 'POOR').length;
    process.exit(poor > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
