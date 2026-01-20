/**
 * POC-2: Market Data Providers - Test Script
 *
 * This script tests the market data provider implementations
 * and validates connectivity/functionality.
 *
 * Usage:
 *   npx ts-node scripts/poc-market-data.ts
 *
 * Environment Variables:
 *   ALPACA_API_KEY - Alpaca API key
 *   ALPACA_API_SECRET - Alpaca API secret
 *   POLYGON_API_KEY - Polygon API key
 */

import {
  getMarketDataFactory,
  AlpacaProvider,
  PolygonProvider,
  MarketDataProvider,
  ProviderHealth,
  ProviderCapabilities,
} from '../src/services/market-data';

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset'): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(title: string): void {
  console.log('\n' + '='.repeat(60));
  log(`  ${title}`, 'bright');
  console.log('='.repeat(60) + '\n');
}

function logResult(label: string, success: boolean, details?: string): void {
  const status = success ? `${colors.green}✓ PASS` : `${colors.red}✗ FAIL`;
  console.log(`  ${status}${colors.reset} ${label}${details ? ` (${details})` : ''}`);
}

async function testProviderHealth(
  provider: MarketDataProvider,
  name: string
): Promise<ProviderHealth> {
  log(`\nTesting ${name}...`, 'cyan');

  const configured = provider.isConfigured();
  logResult('Configuration', configured, configured ? 'API keys found' : 'Missing API keys');

  if (!configured) {
    return {
      provider: provider.name,
      status: 'down',
      latencyMs: 0,
      lastChecked: new Date(),
      error: 'Not configured',
    };
  }

  const connectionResult = await provider.testConnection();
  logResult(
    'Connection',
    connectionResult.success,
    `${connectionResult.latencyMs}ms${connectionResult.error ? ` - ${connectionResult.error}` : ''}`
  );

  const rateLimits = provider.getRateLimitStatus();
  log(`  Rate Limit: ${rateLimits.remaining} remaining, resets at ${rateLimits.resetAt}`, 'blue');

  return {
    provider: provider.name,
    status: connectionResult.success ? 'healthy' : 'down',
    latencyMs: connectionResult.latencyMs,
    lastChecked: new Date(),
    error: connectionResult.error,
  };
}

async function testBarData(provider: MarketDataProvider, symbol: string): Promise<boolean> {
  if (!provider.isConfigured()) {
    log(`  Skipping bar data test (not configured)`, 'yellow');
    return false;
  }

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Last 7 days

    const result = await provider.getBars({
      symbol,
      startDate,
      endDate,
      timeframe: '1day',
      limit: 10,
    });

    logResult(
      `Bar Data (${symbol})`,
      result.bars.length > 0,
      `${result.bars.length} bars, ${result.latencyMs}ms`
    );

    if (result.bars.length > 0) {
      const firstBar = result.bars[0];
      log(`    First bar: ${firstBar.datetime} - O:${firstBar.open} H:${firstBar.high} L:${firstBar.low} C:${firstBar.close}`, 'blue');
    }

    return result.bars.length > 0;
  } catch (error) {
    logResult(`Bar Data (${symbol})`, false, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function testTradeData(provider: MarketDataProvider, symbol: string): Promise<boolean> {
  if (!provider.isConfigured()) {
    log(`  Skipping trade data test (not configured)`, 'yellow');
    return false;
  }

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - 1); // Last hour

    const result = await provider.getTrades({
      symbol,
      startDate,
      endDate,
      tickType: 'trades',
      limit: 10,
    });

    const tradeCount = result.trades?.length || 0;
    logResult(`Trade Ticks (${symbol})`, tradeCount > 0, `${tradeCount} trades, ${result.latencyMs}ms`);

    if (result.trades && result.trades.length > 0) {
      const firstTrade = result.trades[0];
      log(`    First trade: ${firstTrade.datetime} - Price:${firstTrade.price} Size:${firstTrade.size}`, 'blue');
    }

    return tradeCount > 0;
  } catch (error) {
    logResult(`Trade Ticks (${symbol})`, false, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function runPOC(): Promise<void> {
  logHeader('POC-2: Market Data Providers Validation');

  log('Environment Check:', 'bright');
  log(`  ALPACA_API_KEY: ${process.env.ALPACA_API_KEY ? '✓ Set' : '✗ Not set'}`, process.env.ALPACA_API_KEY ? 'green' : 'yellow');
  log(`  ALPACA_API_SECRET: ${process.env.ALPACA_API_SECRET ? '✓ Set' : '✗ Not set'}`, process.env.ALPACA_API_SECRET ? 'green' : 'yellow');
  log(`  POLYGON_API_KEY: ${process.env.POLYGON_API_KEY ? '✓ Set' : '✗ Not set'}`, process.env.POLYGON_API_KEY ? 'green' : 'yellow');

  // Initialize factory
  const factory = getMarketDataFactory();

  // Get capabilities
  logHeader('Provider Capabilities');
  const capabilities = factory.getProviderCapabilities();
  capabilities.forEach((cap: ProviderCapabilities) => {
    log(`\n${cap.provider.toUpperCase()}:`, 'cyan');
    log(`  Assets: ${cap.assets.join(', ')}`);
    log(`  Tick Data: ${cap.tickData ? '✓' : '✗'} | Quote Data: ${cap.quoteData ? '✓' : '✗'} | Bar Data: ${cap.barData ? '✓' : '✗'}`);
    log(`  History: ${cap.historyDepthYears} years`);
    log(`  Rate Limit: ${cap.rateLimit.requestsPerMinute} req/min`);
    log(`  Pricing: ${cap.pricing.tier} ($${cap.pricing.monthlyCost}/mo)`);
  });

  // Test each provider
  logHeader('Provider Health Tests');

  const alpaca = new AlpacaProvider();
  const polygon = new PolygonProvider();

  const healthResults: ProviderHealth[] = [];

  healthResults.push(await testProviderHealth(alpaca, 'Alpaca (Free Tier)'));
  healthResults.push(await testProviderHealth(polygon, 'Polygon.io'));

  // Test data fetching
  logHeader('Data Fetch Tests');

  const testSymbol = 'AAPL';

  log(`\nAlpaca Data Tests:`, 'cyan');
  await testBarData(alpaca, testSymbol);
  await testTradeData(alpaca, testSymbol);

  log(`\nPolygon Data Tests:`, 'cyan');
  await testBarData(polygon, testSymbol);
  await testTradeData(polygon, testSymbol);

  // Summary
  logHeader('POC Summary');

  const healthyProviders = healthResults.filter((h) => h.status === 'healthy');
  const configuredProviders = healthResults.filter((h) => h.error !== 'Not configured');

  log(`Providers Configured: ${configuredProviders.length}/${healthResults.length}`);
  log(`Providers Healthy: ${healthyProviders.length}/${configuredProviders.length}`);

  if (healthyProviders.length > 0) {
    log(`\nBest Provider: ${healthyProviders[0].provider} (${healthyProviders[0].latencyMs}ms latency)`, 'green');
  }

  // Recommendations
  logHeader('Recommendations');

  log('Phase 1 (Development):', 'cyan');
  log('  - Use Alpaca Free tier for testing ($0/mo)');
  log('  - IEX exchange only, 200 req/min limit');
  log('  - Set ALPACA_API_KEY and ALPACA_API_SECRET\n');

  log('Phase 2 (Beta):', 'cyan');
  log('  - Upgrade to Polygon Starter ($29/mo) for 15-min delayed data');
  log('  - Or Alpaca Plus ($99/mo) for full SIP real-time\n');

  log('Phase 3 (Production):', 'cyan');
  log('  - Polygon Advanced ($199/mo) or Business ($1,999/mo)');
  log('  - Full 20+ years historical tick data\n');

  log('Next Steps:', 'bright');
  log('  1. Set up Alpaca API keys for development');
  log('  2. Test with various symbols and timeframes');
  log('  3. Validate 250ms tick precision for replay');
  log('  4. Request PM budget approval for Phase 2\n');

  // Exit status
  const success = healthyProviders.length > 0 || configuredProviders.length === 0;
  process.exit(success ? 0 : 1);
}

// Run POC
runPOC().catch((error) => {
  console.error('POC failed with error:', error);
  process.exit(1);
});
