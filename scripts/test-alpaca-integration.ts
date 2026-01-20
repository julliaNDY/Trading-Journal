#!/usr/bin/env tsx
/**
 * Alpaca Integration Test
 * 
 * Tests the Alpaca provider with real API calls to paper trading environment.
 * 
 * Usage:
 *   ALPACA_API_KEY=xxx ALPACA_API_SECRET=xxx tsx scripts/test-alpaca-integration.ts
 * 
 * Get paper trading credentials from: https://app.alpaca.markets/paper/dashboard/overview
 */

import { createAlpacaProvider } from '../src/services/broker/alpaca-provider';
import { BrokerAuthError, BrokerApiError } from '../src/services/broker/types';

const ALPACA_API_KEY = process.env.ALPACA_API_KEY;
const ALPACA_API_SECRET = process.env.ALPACA_API_SECRET;

async function main() {
  console.log('🦙 Alpaca Integration Test\n');

  if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
    console.error('❌ Missing credentials');
    console.error('Set ALPACA_API_KEY and ALPACA_API_SECRET environment variables');
    console.error('\nGet paper trading credentials from:');
    console.error('https://app.alpaca.markets/paper/dashboard/overview');
    process.exit(1);
  }

  const provider = createAlpacaProvider('paper');

  // Test 1: Authentication
  console.log('📝 Test 1: Authentication');
  try {
    const authResult = await provider.authenticate({
      apiKey: ALPACA_API_KEY,
      apiSecret: ALPACA_API_SECRET,
    });

    console.log('✅ Authentication successful');
    console.log(`   User ID: ${authResult.userId}`);
    console.log(`   Expires: ${authResult.expiresAt.toISOString()}`);
    console.log(`   Token length: ${authResult.accessToken.length} chars\n`);

    // Test 2: Get Accounts
    console.log('📝 Test 2: Get Accounts');
    const accounts = await provider.getAccounts(authResult.accessToken);
    console.log(`✅ Found ${accounts.length} account(s)`);
    for (const account of accounts) {
      console.log(`   - ${account.name}`);
      console.log(`     ID: ${account.id}`);
      console.log(`     Balance: $${account.balance?.toFixed(2) || 'N/A'}`);
      console.log(`     Currency: ${account.currency || 'N/A'}`);
    }
    console.log();

    // Test 3: Get Trades (last 30 days)
    console.log('📝 Test 3: Get Trades (last 30 days)');
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const trades = await provider.getTrades(
      authResult.accessToken,
      accounts[0].id,
      since
    );

    console.log(`✅ Found ${trades.length} trade(s)`);
    
    if (trades.length === 0) {
      console.log('   ℹ️  No trades found in the last 30 days');
      console.log('   ℹ️  To test with real data:');
      console.log('      1. Go to https://app.alpaca.markets/paper/dashboard/overview');
      console.log('      2. Place some paper trades');
      console.log('      3. Run this script again');
    } else {
      console.log('\n   Recent trades:');
      for (const trade of trades.slice(0, 5)) {
        console.log(`   - ${trade.symbol} ${trade.direction}`);
        console.log(`     Entry: $${trade.entryPrice} → Exit: $${trade.exitPrice}`);
        console.log(`     Quantity: ${trade.quantity}`);
        console.log(`     PnL: $${trade.realizedPnl.toFixed(2)}`);
        console.log(`     Opened: ${trade.openedAt.toISOString()}`);
        console.log(`     Closed: ${trade.closedAt.toISOString()}`);
      }
      
      if (trades.length > 5) {
        console.log(`   ... and ${trades.length - 5} more`);
      }
    }
    console.log();

    // Test 4: Get All Historical Trades
    console.log('📝 Test 4: Get All Historical Trades');
    const allTrades = await provider.getTrades(
      authResult.accessToken,
      accounts[0].id
    );
    console.log(`✅ Found ${allTrades.length} total trade(s)\n`);

    // Summary
    console.log('📊 Summary');
    console.log('━'.repeat(50));
    console.log(`✅ All tests passed`);
    console.log(`   - Authentication: OK`);
    console.log(`   - Account access: OK`);
    console.log(`   - Trade history: OK`);
    console.log(`   - Total trades: ${allTrades.length}`);
    
    if (allTrades.length > 0) {
      const totalPnl = allTrades.reduce((sum, t) => sum + t.realizedPnl, 0);
      const winners = allTrades.filter(t => t.realizedPnl > 0).length;
      const losers = allTrades.filter(t => t.realizedPnl < 0).length;
      
      console.log(`   - Total PnL: $${totalPnl.toFixed(2)}`);
      console.log(`   - Winners: ${winners}`);
      console.log(`   - Losers: ${losers}`);
      console.log(`   - Win rate: ${((winners / allTrades.length) * 100).toFixed(1)}%`);
    }

  } catch (error) {
    if (error instanceof BrokerAuthError) {
      console.error('❌ Authentication failed');
      console.error(`   ${error.message}`);
      console.error('\n   Check your credentials:');
      console.error('   https://app.alpaca.markets/paper/dashboard/overview');
    } else if (error instanceof BrokerApiError) {
      console.error('❌ API error');
      console.error(`   ${error.message}`);
      console.error(`   Status: ${error.statusCode}`);
    } else {
      console.error('❌ Unexpected error');
      console.error(error);
    }
    process.exit(1);
  }
}

main().catch(console.error);
