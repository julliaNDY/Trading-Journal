# Alpaca Provider Implementation

## Overview

The Alpaca provider enables automatic trade synchronization from Alpaca Markets accounts (both paper and live trading).

## Implementation Status

✅ **COMPLETE** - All core functionality implemented and tested

## Features

- ✅ Authentication with API Key + Secret
- ✅ Account information retrieval
- ✅ Historical trade fetching
- ✅ Trade reconstruction from orders
- ✅ Support for LONG and SHORT trades
- ✅ Multiple entries with weighted average
- ✅ Rate limit handling (200 req/min)
- ✅ Paper and Live trading environments
- ✅ Comprehensive error handling
- ✅ Unit tests (9 tests, all passing)

## Architecture

### Access Token Format

Unlike OAuth-based brokers, Alpaca requires both API Key and Secret for every request. To work with the existing `BrokerProvider` interface, we store both credentials in the `accessToken` as a JSON string:

```typescript
{
  "apiKey": "string",
  "apiSecret": "string",
  "environment": "paper" | "live"
}
```

This approach:
- ✅ Works with existing broker sync architecture
- ✅ Maintains security (encrypted in database)
- ✅ Supports environment switching
- ✅ No interface changes required

### Trade Reconstruction

Alpaca returns **orders**, not **trades**. The provider reconstructs complete round-trip trades by:

1. Fetching all closed orders
2. Grouping by symbol
3. Tracking position changes
4. Matching entry/exit pairs
5. Calculating PnL

**Example**:
```
Order 1: Buy 100 AAPL @ $150  → Position: +100
Order 2: Sell 100 AAPL @ $155 → Position: 0
→ Trade: LONG, Entry $150, Exit $155, Qty 100, PnL $500
```

## Usage

### Basic Usage

```typescript
import { createAlpacaProvider } from '@/services/broker/alpaca-provider';

// Create provider
const provider = createAlpacaProvider('paper'); // or 'live'

// Authenticate
const authResult = await provider.authenticate({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
});

// Get accounts
const accounts = await provider.getAccounts(authResult.accessToken);

// Get trades (last 30 days)
const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const trades = await provider.getTrades(
  authResult.accessToken,
  accounts[0].id,
  since
);
```

### Via Broker Sync Service

```typescript
import { connectBroker, syncBrokerTrades } from '@/services/broker';

// Connect broker
const { connectionId } = await connectBroker({
  userId: 'user-id',
  brokerType: 'ALPACA',
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
  environment: 'paper', // or 'live'
});

// Sync trades
const result = await syncBrokerTrades(connectionId, 'user-id');
console.log(`Imported ${result.tradesImported} trades`);
```

## Testing

### Unit Tests

```bash
npm test src/services/broker/__tests__/alpaca-provider.test.ts
```

**Coverage**:
- ✅ Authentication (success, 401, 429)
- ✅ Account retrieval
- ✅ Trade reconstruction (LONG, SHORT, multiple)
- ✅ Date filtering
- ✅ Rate limit warnings

### Integration Tests

```bash
# Set credentials
export ALPACA_API_KEY=your_paper_key
export ALPACA_API_SECRET=your_paper_secret

# Run test
tsx scripts/test-alpaca-integration.ts
```

**What it tests**:
1. Real authentication with Alpaca API
2. Account information retrieval
3. Trade history fetching
4. Trade reconstruction with real data
5. Error handling

## API Details

### Endpoints Used

| Endpoint | Purpose | Rate Limit |
|----------|---------|------------|
| `GET /v2/account` | Account info | 200/min |
| `GET /v2/orders` | Order history | 200/min |

### Rate Limits

- **Limit**: 200 requests per minute
- **Burst**: Up to 200 in quick succession
- **Headers**: `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Handling**: Automatic warnings + exponential backoff

### Error Codes

| Status | Error Type | Handling |
|--------|------------|----------|
| 401 | `BrokerAuthError` | Invalid credentials |
| 403 | `BrokerAuthError` | Unauthorized |
| 429 | `BrokerRateLimitError` | Rate limit exceeded |
| 500+ | `BrokerApiError` | Server error |

## Trade Data Mapping

| Alpaca Field | Our Field | Transformation |
|--------------|-----------|----------------|
| `id` (composite) | `brokerTradeId` | `entry-id-exit-id` |
| `symbol` | `symbol` | Direct |
| `side` | `direction` | `buy`→`LONG`, `sell`→`SHORT` |
| `filled_at` | `openedAt`/`closedAt` | Based on order type |
| `filled_avg_price` | `entryPrice`/`exitPrice` | Based on order type |
| `filled_qty` | `quantity` | Direct |
| Calculated | `realizedPnl` | `(exit-entry)*qty*direction` |
| `commission` | `commission` | Always $0 |

## Known Limitations

1. **No Real-Time Sync**: Polling-based (no webhooks)
2. **Order-Based**: Must reconstruct trades from orders
3. **No Options**: Options trades not yet supported
4. **No Crypto**: Crypto trades not yet supported
5. **90-Day Limit**: Some endpoints limit to 90 days

## Future Enhancements

- [ ] WebSocket support for real-time updates
- [ ] Options trade support
- [ ] Crypto trade support (BTCUSD, ETHUSD)
- [ ] Advanced order types (brackets, OCO)
- [ ] Position tracking for open trades
- [ ] Account activities API (alternative to orders)

## Troubleshooting

### Authentication Failed

**Symptoms**: 401 error

**Solutions**:
1. Verify API Key and Secret
2. Check environment (paper vs live)
3. Regenerate keys if needed
4. Ensure account is active

### No Trades Found

**Symptoms**: Empty trades array

**Solutions**:
1. Place paper trades for testing
2. Remove date filter (fetch all)
3. Check Alpaca dashboard
4. Verify orders are filled/closed

### Rate Limit Exceeded

**Symptoms**: 429 error

**Solutions**:
1. Wait for rate limit reset
2. Reduce sync frequency
3. Use manual sync only
4. Implement caching

## Documentation

- **API Docs**: https://alpaca.markets/docs/
- **Integration Guide**: `/docs/brokers/alpaca-integration.md`
- **API Research**: `/docs/brokers/api-research/alpaca.md`

## Files

```
src/services/broker/
├── alpaca-provider.ts              # Main provider implementation
├── __tests__/
│   └── alpaca-provider.test.ts     # Unit tests
└── provider-factory.ts             # Factory registration

scripts/
└── test-alpaca-integration.ts      # Integration test

docs/brokers/
├── alpaca-integration.md           # User guide
└── api-research/alpaca.md          # API research
```

## Changelog

### 2026-01-17 - Initial Implementation
- ✅ Core provider implementation
- ✅ Trade reconstruction logic
- ✅ Rate limit handling
- ✅ Error handling
- ✅ Unit tests (9 tests)
- ✅ Integration test script
- ✅ Documentation

---

**Status**: Production Ready  
**Version**: 1.0.0  
**Last Updated**: 2026-01-17
