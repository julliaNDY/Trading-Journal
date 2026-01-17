# Broker Sync Architecture

**Story 3.3**: Multi-Provider Abstraction for 240+ Broker Integrations

This directory contains the broker synchronization architecture that enables integration with 240+ brokers through a robust, extensible, and scalable system.

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Adding a New Broker](#adding-a-new-broker)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Best Practices](#best-practices)
7. [Examples](#examples)

---

## Architecture Overview

The broker sync architecture follows a **Strategy Pattern** with a **Factory** for provider instantiation. Key design principles:

- **Extensibility**: Easy to add new broker integrations
- **Reliability**: Robust error handling with retry logic and exponential backoff
- **Performance**: Redis-based rate limiting to respect broker API limits
- **Observability**: Structured logging for debugging and monitoring

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  (broker-sync-service.ts, scheduler.ts)                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                  Provider Factory                           │
│  (provider-factory.ts)                                      │
│  - Registry-based provider management                       │
│  - Metadata & capabilities                                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
│  Tradovate   │ │    IBKR     │ │   OANDA    │ │  Future    │
│  Provider    │ │  Provider   │ │  Provider  │ │  Providers │
└──────────────┘ └─────────────┘ └────────────┘ └────────────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
│ Error Handler│ │Rate Limiter │ │  Logger    │
│ (retry logic)│ │  (Redis)    │ │ (observ.)  │
└──────────────┘ └─────────────┘ └────────────┘
```

---

## Core Components

### 1. BrokerProvider Interface (`types.ts`)

The core abstraction that all broker integrations must implement:

```typescript
interface BrokerProvider {
  readonly brokerType: BrokerType;
  
  authenticate(credentials: BrokerCredentials): Promise<AuthResult>;
  refreshToken?(accessToken: string): Promise<AuthResult | null>;
  getAccounts(accessToken: string): Promise<BrokerAccount[]>;
  getTrades(accessToken: string, accountId: string, since?: Date): Promise<BrokerTrade[]>;
}
```

**Key Types:**
- `BrokerCredentials`: API key/secret for authentication
- `AuthResult`: Access token + expiry
- `BrokerAccount`: Broker account metadata
- `BrokerTrade`: Standardized trade format

**Error Types:**
- `BrokerAuthError`: Authentication failures (non-retryable)
- `BrokerRateLimitError`: Rate limit exceeded (retryable with backoff)
- `BrokerApiError`: API errors (retryable)

### 2. Provider Factory (`provider-factory.ts`)

Registry-based factory for creating broker providers:

```typescript
// Get a provider
const provider = getBrokerProvider('TRADOVATE', { environment: 'live' });

// Register a custom provider
registerBrokerProvider('MY_BROKER', (options) => new MyBrokerProvider(options));

// Check support
if (isBrokerSupported('TRADOVATE')) {
  // ...
}

// Get metadata
const metadata = getBrokerMetadata('TRADOVATE');
console.log(metadata.rateLimit); // { requestsPerMinute: 100 }
```

**Features:**
- ✅ Registry-based provider management
- ✅ Provider metadata (auth type, rate limits, capabilities)
- ✅ Configuration validation
- ✅ Easy extensibility

### 3. Error Handler (`error-handler.ts`)

Robust error handling with retry logic and exponential backoff:

```typescript
// Retry with exponential backoff
const result = await withRetry(
  () => provider.getTrades(token, accountId),
  BROKER_RETRY_CONFIGS['TRADOVATE'],
  { operation: 'getTrades', brokerType: 'TRADOVATE' }
);

// Classify errors for user feedback
const classification = classifyError(error);
console.log(classification.userMessage); // User-friendly message
console.log(classification.retryable); // Should we retry?
```

**Features:**
- ✅ Exponential backoff with jitter
- ✅ Configurable retry policies per broker
- ✅ Timeout handling
- ✅ Error classification
- ✅ Circuit breaker pattern (optional)

**Default Retry Config:**
```typescript
{
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [BrokerApiError, BrokerRateLimitError],
  timeoutMs: 60000
}
```

### 4. Rate Limiter (`rate-limiter.ts`)

Redis-based rate limiting using sliding window algorithm:

```typescript
// Create rate limiter
const limiter = createRateLimiter('TRADOVATE', accountId);

// Check limit before API call
await limiter.checkLimit(); // Throws BrokerRateLimitError if exceeded

// Get status
const status = await limiter.getStatus();
console.log(`${status.current}/${status.max} requests used`);
console.log(`Resets at: ${status.resetAt}`);
```

**Features:**
- ✅ Redis-based (distributed, scales horizontally)
- ✅ Sliding window algorithm (accurate rate limiting)
- ✅ Per-broker and per-account limits
- ✅ In-memory fallback (if Redis unavailable)
- ✅ Respects `Retry-After` headers

**Rate Limits:**
```typescript
BROKER_RATE_LIMITS = {
  TRADOVATE: { maxRequests: 100, windowMs: 60000 }, // 100/min
  IBKR: { maxRequests: 50, windowMs: 60000 },       // 50/min
}
```

### 5. Broker Sync Service (`broker-sync-service.ts`)

Main service for connecting brokers and syncing trades:

```typescript
// Connect a broker
const { connectionId, brokerAccounts } = await connectBroker({
  userId: 'user123',
  brokerType: 'TRADOVATE',
  apiKey: 'key',
  apiSecret: 'secret',
  environment: 'live',
});

// Sync trades
const result = await syncBrokerTrades(connectionId, userId, 'manual');
console.log(`Imported: ${result.tradesImported}, Skipped: ${result.tradesSkipped}`);
```

**Features:**
- ✅ Credential encryption (AES)
- ✅ Token management (refresh when expired)
- ✅ Deduplication (based on broker trade ID)
- ✅ Sync logging (audit trail)
- ✅ Error recovery

---

## Adding a New Broker

Follow these steps to integrate a new broker:

### Step 1: Create Provider Implementation

Create `src/services/broker/my-broker-provider.ts`:

```typescript
import { BrokerType } from '@prisma/client';
import {
  BrokerProvider,
  BrokerCredentials,
  BrokerAccount,
  BrokerTrade,
  AuthResult,
  BrokerAuthError,
  BrokerApiError,
} from './types';

export class MyBrokerProvider implements BrokerProvider {
  readonly brokerType = BrokerType.MY_BROKER;
  
  async authenticate(credentials: BrokerCredentials): Promise<AuthResult> {
    // Implement authentication
    const response = await fetch('https://api.mybroker.com/auth', {
      method: 'POST',
      body: JSON.stringify({
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
      }),
    });
    
    if (!response.ok) {
      throw new BrokerAuthError('Authentication failed');
    }
    
    const data = await response.json();
    return {
      accessToken: data.token,
      expiresAt: new Date(data.expiresAt),
    };
  }
  
  async getAccounts(accessToken: string): Promise<BrokerAccount[]> {
    // Implement account fetching
    const response = await fetch('https://api.mybroker.com/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    const accounts = await response.json();
    return accounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      balance: acc.balance,
      currency: acc.currency,
    }));
  }
  
  async getTrades(
    accessToken: string,
    accountId: string,
    since?: Date
  ): Promise<BrokerTrade[]> {
    // Implement trade fetching
    const url = new URL('https://api.mybroker.com/trades');
    url.searchParams.set('accountId', accountId);
    if (since) {
      url.searchParams.set('since', since.toISOString());
    }
    
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    const trades = await response.json();
    return trades.map(trade => this.mapTrade(trade));
  }
  
  private mapTrade(rawTrade: any): BrokerTrade {
    return {
      brokerTradeId: rawTrade.id,
      symbol: rawTrade.symbol,
      direction: rawTrade.side === 'buy' ? 'LONG' : 'SHORT',
      openedAt: new Date(rawTrade.openedAt),
      closedAt: new Date(rawTrade.closedAt),
      entryPrice: rawTrade.entryPrice,
      exitPrice: rawTrade.exitPrice,
      quantity: rawTrade.quantity,
      realizedPnl: rawTrade.pnl,
      fees: rawTrade.commission,
    };
  }
}

export function createMyBrokerProvider(): MyBrokerProvider {
  return new MyBrokerProvider();
}
```

### Step 2: Register Provider

In `provider-factory.ts`, add your broker:

```typescript
import { createMyBrokerProvider } from './my-broker-provider';

// Add metadata
PROVIDER_METADATA.MY_BROKER = {
  brokerType: 'MY_BROKER',
  name: 'My Broker',
  description: 'Description of broker',
  authType: 'api_key',
  supportsRealtime: true,
  supportsHistorical: true,
  maxHistoricalDays: 365,
  requiresEnvironment: false,
  documentationUrl: 'https://docs.mybroker.com',
  rateLimit: {
    requestsPerMinute: 60,
  },
};

// Register factory
registry.register('MY_BROKER', () => createMyBrokerProvider());
```

### Step 3: Add Rate Limit Config

In `rate-limiter.ts`:

```typescript
BROKER_RATE_LIMITS.MY_BROKER = {
  maxRequests: 60,
  windowMs: 60000, // 60 requests per minute
  brokerType: 'MY_BROKER',
};
```

### Step 4: Add Retry Config (Optional)

In `error-handler.ts`:

```typescript
BROKER_RETRY_CONFIGS.MY_BROKER = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
};
```

### Step 5: Update Prisma Schema

Add your broker to the enum in `prisma/schema.prisma`:

```prisma
enum BrokerType {
  TRADOVATE
  IBKR
  MY_BROKER  // Add here
}
```

Run migration:
```bash
npx prisma migrate dev --name add_my_broker
```

### Step 6: Export Provider

In `index.ts`:

```typescript
export { MyBrokerProvider, createMyBrokerProvider } from './my-broker-provider';
```

### Step 7: Test Integration

```typescript
import { connectBroker, syncBrokerTrades } from '@/services/broker';

// Connect
const { connectionId } = await connectBroker({
  userId: 'test-user',
  brokerType: 'MY_BROKER',
  apiKey: 'test-key',
  apiSecret: 'test-secret',
});

// Sync
const result = await syncBrokerTrades(connectionId, 'test-user');
console.log(result);
```

---

## Error Handling

### Retry Strategy

The error handler automatically retries failed requests with exponential backoff:

```typescript
// Automatic retry for retryable errors
const trades = await withRetry(
  () => provider.getTrades(token, accountId),
  {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
  { operation: 'getTrades', brokerType: 'TRADOVATE' }
);
```

**Retry Flow:**
1. Attempt 1: Execute immediately
2. Attempt 2: Wait 1s (initial delay)
3. Attempt 3: Wait 2s (1s × 2)
4. Attempt 4: Wait 4s (2s × 2)
5. Fail: Throw error

**Jitter:** ±20% random jitter added to prevent thundering herd

### Error Classification

Errors are classified for better handling:

```typescript
const classification = classifyError(error);

switch (classification.type) {
  case 'auth':
    // Show login prompt
    break;
  case 'rate_limit':
    // Show "try again in X seconds"
    break;
  case 'network':
    // Show "check your connection"
    break;
  case 'timeout':
    // Show "request timed out"
    break;
}
```

### Circuit Breaker (Optional)

For advanced use cases, use the circuit breaker to prevent cascading failures:

```typescript
const breaker = new CircuitBreaker(5, 60000); // 5 failures, 60s reset

const result = await breaker.execute(async () => {
  return provider.getTrades(token, accountId);
});

console.log(breaker.getState()); // 'closed' | 'open' | 'half-open'
```

---

## Rate Limiting

### How It Works

The rate limiter uses a **sliding window algorithm** with Redis:

1. Each API call adds a timestamp to a Redis sorted set
2. Old timestamps (outside the window) are removed
3. If count < limit, allow request
4. If count >= limit, throw `BrokerRateLimitError` with `retryAfterMs`

### Usage

```typescript
// Automatic rate limiting in sync service
const limiter = createRateLimiter('TRADOVATE', accountId);

// Check before each API call
await limiter.checkLimit(); // Throws if limit exceeded
const result = await provider.getTrades(token, accountId);

// Get status
const status = await limiter.getStatus();
console.log(`Used: ${status.current}/${status.max}`);
console.log(`Resets at: ${status.resetAt}`);
```

### Per-Account vs Per-Broker

Rate limits can be:
- **Per-broker**: Shared across all accounts (default)
- **Per-account**: Separate limit for each account

```typescript
// Per-broker (shared)
const limiter1 = createRateLimiter('TRADOVATE');

// Per-account (isolated)
const limiter2 = createRateLimiter('TRADOVATE', 'account123');
```

### Fallback

If Redis is unavailable, the rate limiter falls back to in-memory tracking:

```
[Broker] Redis rate limit check failed, falling back to in-memory
```

**Note:** In-memory fallback is not distributed, so it only works for single-instance deployments.

---

## Best Practices

### 1. Always Use Retry Logic

```typescript
// ✅ Good: Automatic retry
const result = await withRetry(
  () => provider.getTrades(token, accountId),
  BROKER_RETRY_CONFIGS[brokerType],
  { operation: 'getTrades', brokerType }
);

// ❌ Bad: No retry
const result = await provider.getTrades(token, accountId);
```

### 2. Always Check Rate Limits

```typescript
// ✅ Good: Check rate limit before API call
await rateLimiter.checkLimit();
const result = await provider.getTrades(token, accountId);

// ❌ Bad: No rate limit check
const result = await provider.getTrades(token, accountId);
```

### 3. Log Structured Data

```typescript
// ✅ Good: Structured logging
brokerLogger.info('Fetching trades', {
  brokerType,
  accountId,
  since: sinceDate?.toISOString(),
});

// ❌ Bad: Unstructured logging
console.log('Fetching trades from ' + brokerType);
```

### 4. Handle Errors Gracefully

```typescript
// ✅ Good: Classify and handle errors
try {
  await syncBrokerTrades(connectionId, userId);
} catch (error) {
  const classification = classifyError(error);
  
  if (classification.type === 'auth') {
    // Prompt user to re-authenticate
    await disconnectBroker(connectionId, userId);
  } else if (classification.retryable) {
    // Queue for retry later
    await queueRetry(connectionId);
  } else {
    // Log and alert
    logger.error('Non-retryable error', error);
  }
}

// ❌ Bad: Generic error handling
try {
  await syncBrokerTrades(connectionId, userId);
} catch (error) {
  console.error(error);
}
```

### 5. Respect Broker Limits

Always configure rate limits conservatively:

```typescript
// ✅ Good: Conservative limit (broker allows 100/min, we use 80/min)
BROKER_RATE_LIMITS.MY_BROKER = {
  maxRequests: 80,
  windowMs: 60000,
  brokerType: 'MY_BROKER',
};

// ❌ Bad: Aggressive limit (might hit broker's limit)
BROKER_RATE_LIMITS.MY_BROKER = {
  maxRequests: 100,
  windowMs: 60000,
  brokerType: 'MY_BROKER',
};
```

---

## Examples

### Example 1: Connect Tradovate

```typescript
import { connectBroker } from '@/services/broker';

const result = await connectBroker({
  userId: 'user123',
  brokerType: 'TRADOVATE',
  apiKey: 'my-api-key',
  apiSecret: 'my-api-secret',
  environment: 'live', // or 'demo'
});

console.log(`Connected! Connection ID: ${result.connectionId}`);
console.log(`Accounts: ${result.brokerAccounts.map(a => a.name).join(', ')}`);
```

### Example 2: Sync Trades

```typescript
import { syncBrokerTrades } from '@/services/broker';

const result = await syncBrokerTrades(connectionId, userId, 'manual');

console.log(`Imported: ${result.tradesImported}`);
console.log(`Skipped (duplicates): ${result.tradesSkipped}`);
console.log(`Updated: ${result.tradesUpdated}`);
console.log(`Errors: ${result.errors.length}`);
console.log(`Duration: ${result.durationMs}ms`);
```

### Example 3: Scheduled Sync

```typescript
import { runScheduledSync } from '@/services/broker';

// Run sync for all connected brokers
const results = await runScheduledSync();

for (const result of results.results) {
  if (result.success) {
    console.log(`✅ ${result.brokerType}: ${result.tradesImported} trades`);
  } else {
    console.log(`❌ ${result.brokerType}: ${result.error}`);
  }
}
```

### Example 4: Custom Provider with Rate Limiting

```typescript
import { withRetry, withRateLimit } from '@/services/broker';

class MyBrokerProvider implements BrokerProvider {
  async getTrades(token: string, accountId: string): Promise<BrokerTrade[]> {
    // Wrap API call with rate limiting and retry
    return withRateLimit('MY_BROKER', async () => {
      return withRetry(
        async () => {
          const response = await fetch(`https://api.mybroker.com/trades`);
          return response.json();
        },
        { maxRetries: 3 },
        { operation: 'getTrades', brokerType: 'MY_BROKER' }
      );
    }, accountId);
  }
}
```

### Example 5: Error Handling

```typescript
import { syncBrokerTrades, classifyError } from '@/services/broker';

try {
  await syncBrokerTrades(connectionId, userId);
} catch (error) {
  const classification = classifyError(error);
  
  // Show user-friendly message
  alert(classification.userMessage);
  
  // Log technical details
  logger.error('Sync failed', {
    type: classification.type,
    severity: classification.severity,
    retryable: classification.retryable,
    details: classification.technicalDetails,
  });
  
  // Handle based on type
  if (classification.type === 'auth') {
    // Redirect to re-authentication
    router.push('/settings/brokers?reconnect=' + connectionId);
  } else if (classification.type === 'rate_limit') {
    // Show countdown timer
    showRateLimitNotification(classification.technicalDetails);
  }
}
```

---

## Architecture Decisions

### Why Strategy Pattern?

- **Extensibility**: Easy to add new brokers without modifying existing code
- **Testability**: Each provider can be tested in isolation
- **Maintainability**: Clear separation of concerns

### Why Factory Pattern?

- **Centralized Creation**: Single place to manage provider instantiation
- **Metadata Management**: Easy to query broker capabilities
- **Configuration**: Consistent configuration across all providers

### Why Redis for Rate Limiting?

- **Distributed**: Works across multiple instances (horizontal scaling)
- **Accurate**: Sliding window algorithm is more accurate than fixed window
- **Fast**: In-memory data structure for low latency

### Why Exponential Backoff?

- **Respectful**: Gives broker API time to recover
- **Efficient**: Reduces unnecessary retries
- **Jitter**: Prevents thundering herd problem

---

## Troubleshooting

### Issue: Rate Limit Exceeded

**Symptom:** `BrokerRateLimitError: Rate limit exceeded`

**Solution:**
1. Check rate limit status: `await limiter.getStatus()`
2. Reduce sync frequency in scheduler
3. Adjust rate limit config (if broker allows)

### Issue: Authentication Failed

**Symptom:** `BrokerAuthError: Authentication failed`

**Solution:**
1. Verify API credentials are correct
2. Check if API key has required permissions
3. For Tradovate, verify environment (demo vs live)
4. For IBKR, verify Flex Query ID and Token

### Issue: Trades Not Importing

**Symptom:** `tradesImported: 0, tradesSkipped: X`

**Solution:**
1. Check if trades already exist (deduplication)
2. Verify date range (manual sync imports all, scheduled uses lastSyncAt)
3. Check broker API response (enable debug logging)

### Issue: Redis Connection Failed

**Symptom:** `Redis rate limit check failed, falling back to in-memory`

**Solution:**
1. Verify Redis is running: `redis-cli ping`
2. Check environment variables: `REDIS_URL` or `REDIS_HOST`
3. Test connection: `await testRedisConnection()`

---

## Performance Considerations

### Sync Performance

- **Batch Size**: Fetch trades in batches (default: all)
- **Parallel Syncs**: Use BullMQ to parallelize syncs across accounts
- **Incremental Sync**: Use `lastSyncAt` for scheduled syncs

### Rate Limit Optimization

- **Per-Account Limits**: Use separate limiters for each account
- **Burst Handling**: Rate limiter allows bursts within the window
- **Redis Connection Pooling**: Use connection pool for high throughput

### Error Recovery

- **Circuit Breaker**: Prevent cascading failures
- **Exponential Backoff**: Reduce load on failing services
- **Dead Letter Queue**: Store failed syncs for manual retry

---

## Monitoring & Observability

### Logs

All broker operations are logged with structured data:

```typescript
brokerLogger.info('Sync completed', {
  brokerType: 'TRADOVATE',
  accountId: 'acc123',
  tradesImported: 10,
  durationMs: 5000,
});
```

### Metrics

Track these metrics for monitoring:

- **Sync Success Rate**: `syncSuccessCount / syncTotalCount`
- **Average Sync Duration**: `avg(syncDurationMs)`
- **Rate Limit Hit Rate**: `rateLimitErrorCount / totalRequests`
- **Retry Rate**: `retryCount / totalRequests`

### Alerts

Set up alerts for:

- **High Error Rate**: > 10% sync failures
- **Rate Limit Exceeded**: Frequent rate limit errors
- **Slow Syncs**: Sync duration > 60s
- **Authentication Failures**: Credentials expired

---

## Future Enhancements

### Planned Features

- [ ] **Webhook Support**: Real-time trade updates via webhooks
- [ ] **Batch Import**: Bulk import from CSV/Excel
- [ ] **Conflict Resolution**: Handle conflicting trades from multiple sources
- [ ] **Sync Scheduling**: Per-account sync schedules
- [ ] **Historical Backfill**: Async backfill for large date ranges

### Broker Roadmap

- [ ] **Phase 1** (Current): Tradovate, IBKR (2 brokers)
- [ ] **Phase 2** (Q2 2026): Top 10 brokers (TD Ameritrade, E*TRADE, etc.)
- [ ] **Phase 3** (Q3 2026): Top 50 brokers
- [ ] **Phase 4** (Q4 2026): 240+ brokers (via aggregators like Plaid, Yodlee)

---

## References

- [Architecture Document](../../../docs/architecture-trading-path-journal.md)
- [Story 3.3](../../../docs/stories/3.3.story.md)
- [Tradovate API Docs](https://api.tradovate.com)
- [IBKR Flex Query Docs](https://www.interactivebrokers.com/en/software/am/am/reports/flex_web_service_version_3.htm)

---

**Last Updated**: 2026-01-17  
**Story**: 3.3 - Broker Sync Architecture  
**Status**: ✅ Completed
