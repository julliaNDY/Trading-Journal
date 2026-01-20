/**
 * TradeStation Integration Test Script
 * 
 * Manual integration test for TradeStation OAuth flow and trade sync.
 * 
 * Usage:
 *   npm run tsx scripts/test-tradestation-integration.ts
 * 
 * Prerequisites:
 *   1. Set environment variables in .env:
 *      - TRADESTATION_CLIENT_ID
 *      - TRADESTATION_CLIENT_SECRET
 *      - TRADESTATION_REDIRECT_URI
 *   2. Have a TradeStation account (live or sim)
 *   3. Complete OAuth flow manually (see instructions below)
 */

import { createTradeStationProvider } from '../src/services/broker/tradestation-provider';
import { config } from 'dotenv';
import * as readline from 'readline';

// Load environment variables
config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function main() {
  console.log('🚀 TradeStation Integration Test\n');

  // Check environment variables
  const clientId = process.env.TRADESTATION_CLIENT_ID;
  const clientSecret = process.env.TRADESTATION_CLIENT_SECRET;
  const redirectUri = process.env.TRADESTATION_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error('❌ Missing environment variables:');
    console.error('   - TRADESTATION_CLIENT_ID');
    console.error('   - TRADESTATION_CLIENT_SECRET');
    console.error('   - TRADESTATION_REDIRECT_URI');
    console.error('\nPlease set these in your .env file.');
    process.exit(1);
  }

  console.log('✅ Environment variables configured\n');

  // Ask for environment
  const envChoice = await question('Choose environment (1=Live, 2=Sim): ');
  const environment = envChoice === '2' ? 'sim' : 'live';

  console.log(`\n📊 Using ${environment.toUpperCase()} environment\n`);

  // Create provider
  const provider = createTradeStationProvider(environment, clientId, clientSecret, redirectUri);

  // Step 1: Generate authorization URL
  const state = Math.random().toString(36).substring(7);
  const authUrl = provider.getAuthorizationUrl(state);

  console.log('📝 Step 1: OAuth Authorization\n');
  console.log('Please open this URL in your browser:');
  console.log(`\n${authUrl}\n`);
  console.log('After authorizing, you will be redirected to:');
  console.log(`${redirectUri}?code=AUTHORIZATION_CODE&state=${state}\n`);

  // Step 2: Get authorization code
  const authCode = await question('Enter the authorization code from the redirect URL: ');

  if (!authCode.trim()) {
    console.error('❌ No authorization code provided');
    process.exit(1);
  }

  console.log('\n🔐 Step 2: Exchanging authorization code for access token...\n');

  try {
    // Authenticate
    const authResult = await provider.authenticate({
      apiKey: '',
      apiSecret: '',
      authorizationCode: authCode.trim(),
    });

    console.log('✅ Authentication successful!');
    console.log(`   Access Token: ${authResult.accessToken.substring(0, 20)}...`);
    console.log(`   Expires At: ${authResult.expiresAt.toISOString()}\n`);

    // Step 3: Fetch accounts
    console.log('📋 Step 3: Fetching accounts...\n');

    const accounts = await provider.getAccounts(authResult.accessToken);

    console.log(`✅ Found ${accounts.length} account(s):\n`);
    accounts.forEach((account, index) => {
      console.log(`   ${index + 1}. ${account.name} (ID: ${account.id})`);
      console.log(`      Currency: ${account.currency || 'USD'}`);
      if (account.balance) {
        console.log(`      Balance: $${account.balance.toFixed(2)}`);
      }
      console.log('');
    });

    if (accounts.length === 0) {
      console.log('⚠️  No accounts found. Please check your TradeStation account.');
      rl.close();
      return;
    }

    // Step 4: Fetch trades
    const accountChoice = await question(`Select account to sync (1-${accounts.length}): `);
    const accountIndex = parseInt(accountChoice) - 1;

    if (accountIndex < 0 || accountIndex >= accounts.length) {
      console.error('❌ Invalid account selection');
      process.exit(1);
    }

    const selectedAccount = accounts[accountIndex];
    console.log(`\n📊 Step 4: Fetching trades for ${selectedAccount.name}...\n`);

    // Fetch trades from last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const trades = await provider.getTrades(
      authResult.accessToken,
      selectedAccount.id,
      since
    );

    console.log(`✅ Found ${trades.length} trade(s) in the last 30 days:\n`);

    if (trades.length === 0) {
      console.log('   No trades found in the last 30 days.');
    } else {
      // Display first 5 trades
      const displayTrades = trades.slice(0, 5);
      displayTrades.forEach((trade, index) => {
        console.log(`   ${index + 1}. ${trade.symbol} ${trade.direction}`);
        console.log(`      Entry: $${trade.entryPrice} @ ${trade.openedAt.toISOString()}`);
        console.log(`      Exit: $${trade.exitPrice} @ ${trade.closedAt.toISOString()}`);
        console.log(`      Quantity: ${trade.quantity}`);
        console.log(`      PnL: $${trade.realizedPnl.toFixed(2)}`);
        if (trade.fees) {
          console.log(`      Fees: $${trade.fees.toFixed(2)}`);
        }
        console.log('');
      });

      if (trades.length > 5) {
        console.log(`   ... and ${trades.length - 5} more trade(s)\n`);
      }

      // Calculate summary
      const totalPnl = trades.reduce((sum, t) => sum + Number(t.realizedPnl), 0);
      const totalFees = trades.reduce((sum, t) => sum + Number(t.fees || 0), 0);
      const winningTrades = trades.filter((t) => Number(t.realizedPnl) > 0).length;
      const losingTrades = trades.filter((t) => Number(t.realizedPnl) < 0).length;

      console.log('📈 Summary:');
      console.log(`   Total Trades: ${trades.length}`);
      console.log(`   Winning Trades: ${winningTrades}`);
      console.log(`   Losing Trades: ${losingTrades}`);
      console.log(`   Win Rate: ${((winningTrades / trades.length) * 100).toFixed(1)}%`);
      console.log(`   Total PnL: $${totalPnl.toFixed(2)}`);
      console.log(`   Total Fees: $${totalFees.toFixed(2)}`);
      console.log(`   Net PnL: $${(totalPnl - totalFees).toFixed(2)}\n`);
    }

    console.log('✅ Integration test completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Error during integration test:');
    console.error(error instanceof Error ? error.message : error);
    console.error('\nStack trace:');
    console.error(error instanceof Error ? error.stack : 'No stack trace available');
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
