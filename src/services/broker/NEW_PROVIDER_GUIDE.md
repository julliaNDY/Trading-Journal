# Quick Guide: Adding a New Broker Provider

**Story 3.3**: Step-by-step guide for adding a new broker integration

---

## Prerequisites

Before starting, gather the following information:

- [ ] Broker API documentation URL
- [ ] Authentication method (API key, OAuth, etc.)
- [ ] Rate limits (requests per minute/hour)
- [ ] Historical data availability (days)
- [ ] Real-time data support (yes/no)
- [ ] Test credentials (demo account)

---

## Step-by-Step Checklist

### 1. Update Prisma Schema

**File:** `prisma/schema.prisma`

Add your broker to the `BrokerType` enum:

```prisma
enum BrokerType {
  TRADOVATE
  IBKR
  MY_BROKER  // ← Add here
}
```

Run migration:
```bash
npx prisma migrate dev --name add_my_broker
npx prisma generate
```

---

### 2. Create Provider Implementation

**File:** `src/services/broker/my-broker-provider.ts`

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
  BrokerRateLimitError,
} from './types';

const API_BASE_URL = 'https://api.mybroker.com';

export class MyBrokerProvider implements BrokerProvider {
  readonly brokerType = BrokerType.MY_BROKER;
  
  // ========================================================================
  // AUTHENTICATION
  // ========================================================================
  
  async authenticate(credentials: BrokerCredentials): Promise<AuthResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: credentials.apiKey,
          apiSecret: credentials.apiSecret,
        }),
      });
      
      if (response.status === 401) {
        throw new BrokerAuthError('Invalid API credentials');
      }
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new BrokerRateLimitError(
          'Rate limit exceeded during authentication',
          retryAfter ? parseInt(retryAfter) * 1000 : 60000
        );
      }
      
      if (!response.ok) {
        throw new BrokerApiError(
          `Authentication failed: ${response.statusText}`,
          response.status
        );
      }
      
      const data = await response.json();
      
      return {
        accessToken: data.access_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        userId: data.user_id,
      };
    } catch (error) {
      if (error instanceof BrokerAuthError || 
          error instanceof BrokerRateLimitError || 
          error instanceof BrokerApiError) {
        throw error;
      }
      throw new BrokerAuthError(
        `Failed to authenticate: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  // Optional: Implement token refresh if broker supports it
  async refreshToken(accessToken: string): Promise<AuthResult | null> {
    // If broker doesn't support refresh, return null
    return null;
    
    // If broker supports refresh:
    // const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    //   headers: { Authorization: `Bearer ${accessToken}` },
    // });
    // const data = await response.json();
    // return { accessToken: data.access_token, expiresAt: new Date(...) };
  }
  
  // ========================================================================
  // ACCOUNTS
  // ========================================================================
  
  async getAccounts(accessToken: string): Promise<BrokerAccount[]> {
    const response = await this.apiRequest<any[]>(
      accessToken,
      '/accounts'
    );
    
    return response.map(acc => ({
      id: acc.account_id.toString(),
      name: acc.account_name || acc.account_id,
      balance: acc.balance,
      currency: acc.currency || 'USD',
    }));
  }
  
  // ========================================================================
  // TRADES
  // ========================================================================
  
  async getTrades(
    accessToken: string,
    accountId: string,
    since?: Date
  ): Promise<BrokerTrade[]> {
    // Build query parameters
    const params = new URLSearchParams({
      account_id: accountId,
    });
    
    if (since) {
      params.set('start_date', since.toISOString());
    }
    
    // Fetch trades from API
    const response = await this.apiRequest<any[]>(
      accessToken,
      `/trades?${params.toString()}`
    );
    
    // Map to standard format
    return response.map(trade => this.mapTrade(trade));
  }
  
  // ========================================================================
  // MAPPING
  // ========================================================================
  
  private mapTrade(rawTrade: any): BrokerTrade {
    // Map broker-specific fields to standard format
    return {
      brokerTradeId: rawTrade.trade_id.toString(),
      symbol: rawTrade.symbol,
      direction: rawTrade.side === 'buy' ? 'LONG' : 'SHORT',
      openedAt: new Date(rawTrade.opened_at),
      closedAt: new Date(rawTrade.closed_at),
      entryPrice: parseFloat(rawTrade.entry_price),
      exitPrice: parseFloat(rawTrade.exit_price),
      quantity: parseFloat(rawTrade.quantity),
      realizedPnl: parseFloat(rawTrade.profit_loss),
      fees: parseFloat(rawTrade.commission || '0'),
      commission: parseFloat(rawTrade.commission || '0'),
      metadata: {
        orderId: rawTrade.order_id,
        exchange: rawTrade.exchange,
      },
    };
  }
  
  // ========================================================================
  // API HELPERS
  // ========================================================================
  
  private async apiRequest<T>(
    accessToken: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    // Handle errors
    if (response.status === 401) {
      throw new BrokerAuthError('Access token expired or invalid');
    }
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new BrokerRateLimitError(
        'Rate limit exceeded',
        retryAfter ? parseInt(retryAfter) * 1000 : 60000
      );
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new BrokerApiError(
        `API error: ${errorText}`,
        response.status
      );
    }
    
    return response.json();
  }
}

// ========================================================================
// FACTORY
// ========================================================================

export function createMyBrokerProvider(): MyBrokerProvider {
  return new MyBrokerProvider();
}
```

---

### 3. Register Provider in Factory

**File:** `src/services/broker/provider-factory.ts`

Add import:
```typescript
import { createMyBrokerProvider } from './my-broker-provider';
```

Add metadata:
```typescript
PROVIDER_METADATA.MY_BROKER = {
  brokerType: 'MY_BROKER',
  name: 'My Broker',
  description: 'Description of what this broker offers',
  authType: 'api_key', // or 'oauth', 'flex_query'
  supportsRealtime: true, // Does it support real-time data?
  supportsHistorical: true, // Does it support historical data?
  maxHistoricalDays: 365, // How many days of history?
  requiresEnvironment: false, // Does it need demo/live environment?
  documentationUrl: 'https://docs.mybroker.com',
  rateLimit: {
    requestsPerMinute: 60,
    requestsPerHour: 3000,
  },
};
```

Register factory:
```typescript
// In the "REGISTER BUILT-IN PROVIDERS" section
registry.register('MY_BROKER', () => createMyBrokerProvider());
```

---

### 4. Configure Rate Limits

**File:** `src/services/broker/rate-limiter.ts`

Add rate limit configuration:
```typescript
BROKER_RATE_LIMITS.MY_BROKER = {
  maxRequests: 60, // Conservative: use 80% of broker's limit
  windowMs: 60000, // 60 seconds
  brokerType: 'MY_BROKER',
};
```

**Important:** Always use a conservative limit (e.g., 80% of broker's actual limit) to avoid hitting the limit.

---

### 5. Configure Retry Policy (Optional)

**File:** `src/services/broker/error-handler.ts`

If your broker has specific retry requirements:
```typescript
BROKER_RETRY_CONFIGS.MY_BROKER = {
  maxRetries: 3,
  initialDelayMs: 2000, // Start with 2s delay
  maxDelayMs: 30000,    // Max 30s delay
  backoffMultiplier: 2,
  timeoutMs: 60000,     // 60s timeout
};
```

---

### 6. Export Provider

**File:** `src/services/broker/index.ts`

Add export:
```typescript
export { MyBrokerProvider, createMyBrokerProvider } from './my-broker-provider';
```

---

### 7. Write Tests

**File:** `src/services/broker/__tests__/my-broker-provider.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { MyBrokerProvider } from '../my-broker-provider';
import { BrokerAuthError } from '../types';

describe('MyBrokerProvider', () => {
  const provider = new MyBrokerProvider();
  
  describe('authenticate', () => {
    it('should authenticate successfully', async () => {
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          user_id: 'user123',
        }),
      });
      
      const result = await provider.authenticate({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });
      
      expect(result.accessToken).toBe('test-token');
      expect(result.userId).toBe('user123');
    });
    
    it('should throw BrokerAuthError on invalid credentials', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });
      
      await expect(
        provider.authenticate({
          apiKey: 'invalid',
          apiSecret: 'invalid',
        })
      ).rejects.toThrow(BrokerAuthError);
    });
  });
  
  describe('getTrades', () => {
    it('should fetch and map trades correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ([
          {
            trade_id: '123',
            symbol: 'AAPL',
            side: 'buy',
            opened_at: '2024-01-01T10:00:00Z',
            closed_at: '2024-01-01T11:00:00Z',
            entry_price: '150.00',
            exit_price: '155.00',
            quantity: '10',
            profit_loss: '50.00',
            commission: '1.00',
          },
        ]),
      });
      
      const trades = await provider.getTrades('token', 'account123');
      
      expect(trades).toHaveLength(1);
      expect(trades[0].symbol).toBe('AAPL');
      expect(trades[0].direction).toBe('LONG');
      expect(trades[0].realizedPnl).toBe(50);
    });
  });
});
```

Run tests:
```bash
npm test src/services/broker/__tests__/my-broker-provider.test.ts
```

---

### 8. Test Integration

Create a test script:

**File:** `scripts/test-broker-integration.ts`

```typescript
import { connectBroker, syncBrokerTrades } from '@/services/broker';

async function testMyBroker() {
  console.log('Testing MY_BROKER integration...\n');
  
  // Step 1: Connect
  console.log('1. Connecting broker...');
  const { connectionId, brokerAccounts } = await connectBroker({
    userId: 'test-user',
    brokerType: 'MY_BROKER',
    apiKey: process.env.MY_BROKER_API_KEY!,
    apiSecret: process.env.MY_BROKER_API_SECRET!,
  });
  
  console.log(`✅ Connected! Connection ID: ${connectionId}`);
  console.log(`   Accounts: ${brokerAccounts.map(a => a.name).join(', ')}\n`);
  
  // Step 2: Sync trades
  console.log('2. Syncing trades...');
  const result = await syncBrokerTrades(connectionId, 'test-user', 'manual');
  
  console.log(`✅ Sync completed!`);
  console.log(`   Imported: ${result.tradesImported}`);
  console.log(`   Skipped: ${result.tradesSkipped}`);
  console.log(`   Errors: ${result.errors.length}`);
  console.log(`   Duration: ${result.durationMs}ms\n`);
  
  if (result.errors.length > 0) {
    console.log('Errors:');
    result.errors.forEach(err => {
      console.log(`   - ${err.message}`);
    });
  }
}

testMyBroker().catch(console.error);
```

Run:
```bash
npx tsx scripts/test-broker-integration.ts
```

---

## Checklist Summary

- [ ] **Step 1**: Update Prisma schema + migrate
- [ ] **Step 2**: Create provider implementation
- [ ] **Step 3**: Register in factory + add metadata
- [ ] **Step 4**: Configure rate limits
- [ ] **Step 5**: Configure retry policy (optional)
- [ ] **Step 6**: Export provider
- [ ] **Step 7**: Write unit tests
- [ ] **Step 8**: Test integration end-to-end

---

## Common Pitfalls

### 1. Incorrect Date Parsing

**Problem:** Broker returns dates in non-ISO format

**Solution:** Parse dates carefully
```typescript
// ❌ Bad: Assumes ISO format
openedAt: new Date(rawTrade.opened_at)

// ✅ Good: Handle multiple formats
openedAt: this.parseDate(rawTrade.opened_at)

private parseDate(dateStr: string): Date {
  // Try ISO format first
  if (dateStr.includes('T')) {
    return new Date(dateStr);
  }
  // Try YYYYMMDD format
  if (dateStr.length === 8) {
    return new Date(
      parseInt(dateStr.substring(0, 4)),
      parseInt(dateStr.substring(4, 6)) - 1,
      parseInt(dateStr.substring(6, 8))
    );
  }
  return new Date(dateStr);
}
```

### 2. Missing Error Handling

**Problem:** Not all HTTP errors are handled

**Solution:** Handle all error cases
```typescript
// ✅ Good: Comprehensive error handling
if (response.status === 401) {
  throw new BrokerAuthError('Unauthorized');
}
if (response.status === 429) {
  throw new BrokerRateLimitError('Rate limit exceeded');
}
if (response.status >= 500) {
  throw new BrokerApiError('Server error', response.status);
}
if (!response.ok) {
  throw new BrokerApiError('Request failed', response.status);
}
```

### 3. Incorrect Direction Mapping

**Problem:** Broker uses different terminology for buy/sell

**Solution:** Map all variations
```typescript
private mapDirection(side: string): 'LONG' | 'SHORT' {
  const normalized = side.toLowerCase();
  if (['buy', 'long', 'b', 'l'].includes(normalized)) {
    return 'LONG';
  }
  if (['sell', 'short', 's', 'sh'].includes(normalized)) {
    return 'SHORT';
  }
  throw new Error(`Unknown side: ${side}`);
}
```

### 4. Rate Limit Too Aggressive

**Problem:** Hitting broker's rate limit frequently

**Solution:** Use conservative limits (80% of broker's limit)
```typescript
// ❌ Bad: Uses 100% of broker's limit
BROKER_RATE_LIMITS.MY_BROKER = {
  maxRequests: 100, // Broker allows 100/min
  windowMs: 60000,
};

// ✅ Good: Uses 80% of broker's limit
BROKER_RATE_LIMITS.MY_BROKER = {
  maxRequests: 80, // Leave 20% buffer
  windowMs: 60000,
};
```

### 5. Missing Deduplication ID

**Problem:** Trades imported multiple times

**Solution:** Use broker's unique trade ID
```typescript
// ✅ Good: Use broker's unique ID
brokerTradeId: rawTrade.trade_id.toString()

// ❌ Bad: Generate random ID
brokerTradeId: `${Date.now()}-${Math.random()}`
```

---

## Testing Checklist

Before submitting your integration:

- [ ] Unit tests pass (`npm test`)
- [ ] Integration test with demo account succeeds
- [ ] Authentication works (valid + invalid credentials)
- [ ] Trades fetch correctly (with and without date filter)
- [ ] Trade mapping is accurate (all fields)
- [ ] Rate limiting works (doesn't hit broker's limit)
- [ ] Error handling works (auth, rate limit, API errors)
- [ ] Retry logic works (transient failures)
- [ ] Documentation is complete (README updated)

---

## Support

If you encounter issues:

1. Check the [main README](./README.md) for architecture details
2. Review existing providers (Tradovate, IBKR) for examples
3. Enable debug logging: `DEBUG=broker:* npm run dev`
4. Ask in #engineering-broker-sync channel

---

**Last Updated**: 2026-01-17  
**Story**: 3.3 - Broker Sync Architecture
