/**
 * OANDA Integration Test Script
 * 
 * Quick test script to validate OANDA provider implementation.
 * 
 * Usage:
 *   OANDA_API_KEY=your-api-key npm run test:oanda
 * 
 * Note: Use a practice account API key for testing
 */

import { createOandaProvider } from '../src/services/broker/oanda-provider';

async function testOandaIntegration() {
  console.log('🌐 OANDA Integration Test\n');

  const apiKey = process.env.OANDA_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: OANDA_API_KEY environment variable not set');
    console.log('\nUsage: OANDA_API_KEY=your-api-key npm run test:oanda');
    console.log('\n💡 Get a practice account API key from: https://www.oanda.com/demo-account/');
    process.exit(1);
  }

  // Use practice environment for testing
  const provider = createOandaProvider('practice');
  console.log('✅ Created OANDA provider (practice environment)\n');

  try {
    // Test 1: Authentication
    console.log('📝 Test 1: Authentication');
    const authResult = await provider.authenticate({
      apiKey,
      apiSecret: '', // OANDA doesn't use API secret
    });
    console.log('✅ Authentication successful');
    console.log(`   User ID: ${authResult.userId}`);
    console.log(`   Token expires: ${authResult.expiresAt.toISOString()}\n`);

    // Test 2: Get Accounts
    console.log('📝 Test 2: Get Accounts');
    const accounts = await provider.getAccounts(authResult.accessToken);
    console.log(`✅ Found ${accounts.length} account(s)`);
    accounts.forEach((account, index) => {
      console.log(`   Account ${index + 1}:`);
      console.log(`     ID: ${account.id}`);
      console.log(`     Name: ${account.name}`);
      console.log(`     Balance: ${account.currency} ${account.balance?.toFixed(2) ?? 'N/A'}`);
    });
    console.log('');

    if (accounts.length === 0) {
      console.log('⚠️  No accounts found. Please create a practice account first.');
      return;
    }

    // Test 3: Get Trades
    console.log('📝 Test 3: Get Trades (last 30 days)');
    const accountId = accounts[0].id;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    
    const trades = await provider.getTrades(authResult.accessToken, accountId, since);
    console.log(`✅ Found ${trades.length} trade(s)`);
    
    if (trades.length > 0) {
      console.log('\n   Recent trades:');
      trades.slice(0, 5).forEach((trade, index) => {
        console.log(`   Trade ${index + 1}:`);
        console.log(`     ID: ${trade.brokerTradeId}`);
        console.log(`     Symbol: ${trade.symbol}`);
        console.log(`     Direction: ${trade.direction}`);
        console.log(`     Entry: ${trade.entryPrice.toFixed(5)}`);
        console.log(`     Exit: ${trade.exitPrice.toFixed(5)}`);
        console.log(`     Quantity: ${trade.quantity}`);
        console.log(`     PnL: ${trade.realizedPnl.toFixed(2)}`);
        console.log(`     Opened: ${trade.openedAt.toISOString()}`);
        console.log(`     Closed: ${trade.closedAt.toISOString()}`);
        console.log('');
      });

      if (trades.length > 5) {
        console.log(`   ... and ${trades.length - 5} more trade(s)\n`);
      }

      // Calculate statistics
      const totalPnL = trades.reduce((sum, t) => sum + t.realizedPnl, 0);
      const winners = trades.filter(t => t.realizedPnl > 0).length;
      const losers = trades.filter(t => t.realizedPnl < 0).length;
      const winRate = trades.length > 0 ? (winners / trades.length * 100).toFixed(1) : '0.0';

      console.log('   Statistics:');
      console.log(`     Total PnL: ${totalPnL.toFixed(2)}`);
      console.log(`     Winners: ${winners}`);
      console.log(`     Losers: ${losers}`);
      console.log(`     Win Rate: ${winRate}%`);
    } else {
      console.log('   No trades found in the last 30 days.');
      console.log('   💡 Place some trades in your practice account to test trade sync.');
    }

    console.log('\n✅ All tests passed!');
    console.log('\n🎉 OANDA integration is working correctly!');
    
  } catch (error) {
    console.error('\n❌ Test failed:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      if (error.stack) {
        console.error('\n   Stack trace:');
        console.error(error.stack);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

// Run tests
testOandaIntegration().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
