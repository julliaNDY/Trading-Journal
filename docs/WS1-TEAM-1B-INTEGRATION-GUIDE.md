# 🌐 WS1 - TEAM 1B INTEGRATION GUIDE
## OANDA Broker Integration - Developer Reference

**Team**: 1B - OANDA Integration  
**Workstream**: WS1 - Broker Integration  
**Status**: ✅ Complete  
**Last Updated**: 2026-01-17

---

## 📋 TABLE OF CONTENTS

1. [Quick Start](#quick-start)
2. [Authentication](#authentication)
3. [Account Management](#account-management)
4. [Trade Data Sync](#trade-data-sync)
5. [Testing](#testing)
6. [Common Issues](#common-issues)
7. [References](#references)

---

## 🚀 QUICK START

### Prerequisites
- OANDA account (practice or live)
- API key generated from account dashboard
- Node.js 20+ installed

### Setup (5 minutes)

```bash
# 1. Get OANDA API key
# - Practice: https://www.oanda.com/demo-account/
# - Live: https://www.oanda.com/account/login/

# 2. Generate API key
# Dashboard → Manage API Access → Generate

# 3. Test the integration
OANDA_API_KEY=your-api-key npm run test:oanda
```

### Basic Usage

```typescript
import { OandaProvider } from '@/services/broker/oanda-provider';

// Create provider (practice or live)
const provider = new OandaProvider('practice'); // or 'live'

// Authenticate
const authResult = await provider.authenticate({
  apiKey: process.env.OANDA_API_KEY!,
  apiSecret: '', // Not used
});

// Get accounts
const accounts = await provider.getAccounts(authResult.accessToken);

// Get trades (last 90 days)
const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
const trades = await provider.getTrades(
  authResult.accessToken,
  accounts[0].id,
  since
);
```

---

## 🔐 AUTHENTICATION

### Overview
OANDA uses **Bearer token** authentication (API Key), not OAuth 2.0.

### Implementation

```typescript
async authenticate(credentials: BrokerCredentials): Promise<AuthResult> {
  // 1. Validate API key by fetching accounts
  const accountsResponse = await this.apiRequest<OandaAccountsResponse>(
    credentials.apiKey,
    '/v3/accounts'
  );
  
  // 2. Check accounts exist
  if (!accountsResponse.accounts || accountsResponse.accounts.length === 0) {
    throw new BrokerAuthError('No OANDA accounts found');
  }
  
  // 3. Return auth result (API key as access token)
  return {
    accessToken: credentials.apiKey,
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    userId: accountsResponse.accounts[0].id,
  };
}
```

### Key Points
- ✅ **No expiration**: OANDA API keys don't expire
- ✅ **No refresh token**: Not needed
- ✅ **Simple validation**: Just fetch accounts to verify
- ✅ **Environment switching**: Support practice and live

### Error Handling

```typescript
try {
  const auth = await provider.authenticate({ apiKey });
} catch (error) {
  if (error instanceof BrokerAuthError) {
    // Invalid API key or no accounts
  } else if (error instanceof BrokerRateLimitError) {
    // Rate limit exceeded (429)
  } else if (error instanceof BrokerApiError) {
    // Other API errors
  }
}
```

---

## 👥 ACCOUNT MANAGEMENT

### Fetching Accounts

```typescript
async getAccounts(accessToken: string): Promise<BrokerAccount[]> {
  // 1. Get account IDs
  const accountsResponse = await this.apiRequest<OandaAccountsResponse>(
    accessToken,
    '/v3/accounts'
  );
  
  // 2. Fetch details for each account
  const accounts: BrokerAccount[] = [];
  for (const account of accountsResponse.accounts) {
    const details = await this.apiRequest<OandaAccountDetails>(
      accessToken,
      `/v3/accounts/${account.id}`
    );
    
    accounts.push({
      id: details.account.id,
      name: details.account.alias || `OANDA ${details.account.id}`,
      balance: parseFloat(details.account.balance),
      currency: details.account.currency,
    });
  }
  
  return accounts;
}
```

### Multi-Account Support

OANDA supports multiple accounts per API key:
- **Practice accounts**: Separate from live
- **Live accounts**: Can have multiple
- **Account switching**: Via environment parameter

```typescript
// Practice environment
const practiceProvider = new OandaProvider('practice');
const practiceAccounts = await practiceProvider.getAccounts(apiKey);

// Live environment
const liveProvider = new OandaProvider('live');
const liveAccounts = await liveProvider.getAccounts(apiKey);
```

---

## 📊 TRADE DATA SYNC

### Overview
OANDA provides **transactions** (ORDER_FILL) instead of complete trades. We reconstruct trades by:
1. Tracking trade opens via `tradeOpened`
2. Matching closes via `tradesClosed` or `tradeReduced`
3. Calculating exit price from realized PnL

### Fetching Trades

```typescript
async getTrades(
  accessToken: string,
  accountId: string,
  since?: Date
): Promise<BrokerTrade[]> {
  // 1. Build query params
  const params = new URLSearchParams({
    type: 'ORDER_FILL', // Only order fill transactions
  });
  if (since) {
    params.append('from', since.toISOString());
  }
  
  // 2. Fetch transactions
  const response = await this.apiRequest<OandaTransactionsResponse>(
    accessToken,
    `/v3/accounts/${accountId}/transactions?${params.toString()}`
  );
  
  // 3. Reconstruct trades
  return this.reconstructTrades(response.transactions);
}
```

### Trade Reconstruction Algorithm

```typescript
private reconstructTrades(transactions: OandaTransaction[]): BrokerTrade[] {
  const trades: BrokerTrade[] = [];
  const openTrades = new Map<string, OpenTradeInfo>();
  
  for (const tx of transactions) {
    if (tx.type !== 'ORDER_FILL') continue;
    
    // Handle trade opened
    if (tx.tradeOpened) {
      openTrades.set(tx.tradeOpened.tradeID, {
        tradeId: tx.tradeOpened.tradeID,
        instrument: tx.instrument!,
        units: parseFloat(tx.tradeOpened.units),
        entryPrice: parseFloat(tx.tradeOpened.price),
        openTime: new Date(tx.time),
        financing: 0,
      });
    }
    
    // Handle trades closed
    if (tx.tradesClosed && tx.tradesClosed.length > 0) {
      for (const closedTrade of tx.tradesClosed) {
        const openTrade = openTrades.get(closedTrade.tradeID);
        if (!openTrade) continue;
        
        // Calculate exit price from PnL
        const closedUnits = Math.abs(parseFloat(closedTrade.units));
        const realizedPL = parseFloat(closedTrade.realizedPL);
        const direction: Direction = openTrade.units > 0 ? 'LONG' : 'SHORT';
        
        const pnlPerUnit = realizedPL / closedUnits;
        const exitPrice = direction === 'LONG'
          ? openTrade.entryPrice + pnlPerUnit
          : openTrade.entryPrice - pnlPerUnit;
        
        // Create trade record
        trades.push({
          brokerTradeId: closedTrade.tradeID,
          symbol: this.normalizeSymbol(openTrade.instrument),
          direction,
          openedAt: openTrade.openTime,
          closedAt: new Date(tx.time),
          entryPrice: openTrade.entryPrice,
          exitPrice,
          quantity: closedUnits,
          realizedPnl: realizedPL,
          commission: parseFloat(closedTrade.guaranteedExecutionFee || '0'),
          fees: parseFloat(closedTrade.financing || '0'),
        });
        
        // Remove or update open trade
        if (Math.abs(openTrade.units) === closedUnits) {
          openTrades.delete(closedTrade.tradeID);
        } else {
          openTrade.units = openTrade.units > 0
            ? openTrade.units - closedUnits
            : openTrade.units + closedUnits;
        }
      }
    }
    
    // Handle trade reduced (partial close)
    if (tx.tradeReduced) {
      // Similar logic to tradesClosed
      // Create separate trade record for partial close
      // Update remaining units
    }
  }
  
  return trades;
}
```

### Symbol Normalization

OANDA uses `EUR_USD` format, we normalize to `EURUSD`:

```typescript
private normalizeSymbol(instrument: string): string {
  return instrument.replace(/_/g, '');
}

// Examples:
// 'EUR_USD' → 'EURUSD'
// 'GBP_USD' → 'GBPUSD'
// 'USD_JPY' → 'USDJPY'
// 'XAU_USD' → 'XAUUSD' (Gold)
```

### Handling Edge Cases

#### 1. Partial Closes
```typescript
// OANDA allows partial position closes
// Example: Open 10,000 units, close 5,000, then close 5,000
// We create separate trade records for each close

if (tx.tradeReduced) {
  const partialTradeId = `${tx.tradeReduced.tradeID}-partial-${tx.id}`;
  trades.push({
    brokerTradeId: partialTradeId,
    // ... rest of trade data
    metadata: { isPartialClose: true },
  });
}
```

#### 2. Hedged Positions
```typescript
// OANDA supports hedging (multiple positions same instrument)
// Track each trade separately by trade ID
// Don't aggregate by instrument

openTrades.set(tradeID, tradeInfo); // Use trade ID as key
```

#### 3. Same-Day Trades
```typescript
// Trades opened and closed same day
// Ensure chronological processing
// Match opens to closes correctly

transactions.sort((a, b) => 
  new Date(a.time).getTime() - new Date(b.time).getTime()
);
```

---

## 🧪 TESTING

### Unit Tests

```bash
# Run all OANDA tests
npm test oanda-provider

# Run specific test
npm test -- oanda-provider -t "should authenticate"
```

### Test Coverage

```
✓ Authentication (3 tests)
  - Valid credentials
  - Invalid credentials
  - No accounts found
✓ Account fetching (1 test)
✓ Trade reconstruction (3 tests)
  - Basic trades
  - SHORT trades
  - Partial closes
✓ Error handling (2 tests)
  - Rate limit errors
  - API errors
✓ Symbol normalization (1 test)

Total: 10/10 tests passing ✅
```

### Integration Testing

```bash
# Test with practice account
OANDA_API_KEY=your-practice-key npm run test:oanda-integration

# Test with live account (careful!)
OANDA_API_KEY=your-live-key OANDA_ENV=live npm run test:oanda-integration
```

### Mock Data

```typescript
// Mock transaction for testing
const mockTransaction: OandaTransaction = {
  id: '1',
  time: '2024-01-01T12:00:00.000000000Z',
  type: 'ORDER_FILL',
  instrument: 'EUR_USD',
  units: '10000',
  price: '1.1234',
  pl: '123.45',
  tradeOpened: {
    tradeID: '12346',
    units: '10000',
    price: '1.1234',
    guaranteedExecutionFee: '0',
    halfSpreadCost: '0.50',
    initialMarginRequired: '100.00',
  },
};
```

---

## 🔧 COMMON ISSUES

### Issue 1: Authentication Fails

**Symptom**: `BrokerAuthError: Invalid API key`

**Solutions**:
1. ✅ Verify API key is correct (copy/paste carefully)
2. ✅ Check environment (practice vs live)
3. ✅ Ensure account has been created
4. ✅ Regenerate API key if needed

```typescript
// Debug authentication
try {
  const auth = await provider.authenticate({ apiKey });
  console.log('Auth successful:', auth);
} catch (error) {
  console.error('Auth failed:', error.message);
  // Check: Is API key correct?
  // Check: Is environment correct (practice/live)?
}
```

### Issue 2: No Trades Returned

**Symptom**: `getTrades()` returns empty array

**Solutions**:
1. ✅ Check date range (use wider range)
2. ✅ Verify account has trades
3. ✅ Check transaction type filter
4. ✅ Ensure account ID is correct

```typescript
// Debug trade fetching
const since = new Date('2020-01-01'); // Wide date range
const trades = await provider.getTrades(accessToken, accountId, since);
console.log(`Found ${trades.length} trades`);

// If still empty, check transactions directly
const response = await provider.apiRequest(
  accessToken,
  `/v3/accounts/${accountId}/transactions?type=ORDER_FILL`
);
console.log('Transactions:', response.transactions.length);
```

### Issue 3: Symbol Format Issues

**Symptom**: Symbols not matching expected format

**Solutions**:
1. ✅ Use `normalizeSymbol()` method
2. ✅ Check instrument format in OANDA response
3. ✅ Handle special cases (XAU_USD, etc.)

```typescript
// Debug symbol normalization
const instrument = 'EUR_USD';
const normalized = this.normalizeSymbol(instrument);
console.log(`${instrument} → ${normalized}`); // EUR_USD → EURUSD
```

### Issue 4: Rate Limit Exceeded

**Symptom**: `BrokerRateLimitError: Rate limit exceeded`

**Solutions**:
1. ✅ Implement exponential backoff
2. ✅ Check rate limit headers
3. ✅ Reduce request frequency
4. ✅ Use pagination for large datasets

```typescript
// Handle rate limits
try {
  const trades = await provider.getTrades(accessToken, accountId);
} catch (error) {
  if (error instanceof BrokerRateLimitError) {
    const retryAfter = error.retryAfter || 60000;
    console.log(`Rate limited, retry after ${retryAfter}ms`);
    await new Promise(resolve => setTimeout(resolve, retryAfter));
    // Retry request
  }
}
```

### Issue 5: Partial Close Handling

**Symptom**: Duplicate trades or incorrect quantities

**Solutions**:
1. ✅ Check for `tradeReduced` field
2. ✅ Create separate records for partial closes
3. ✅ Update remaining units correctly
4. ✅ Use unique IDs for partial closes

```typescript
// Handle partial closes
if (tx.tradeReduced) {
  const partialId = `${tx.tradeReduced.tradeID}-partial-${tx.id}`;
  trades.push({
    brokerTradeId: partialId, // Unique ID
    quantity: reducedUnits, // Only closed units
    metadata: { isPartialClose: true },
  });
  
  // Update remaining units
  openTrade.units -= reducedUnits;
}
```

---

## 📚 REFERENCES

### Official Documentation
- **OANDA API Docs**: https://developer.oanda.com/rest-live-v20/introduction/
- **Account Endpoints**: https://developer.oanda.com/rest-live-v20/account-ep/
- **Transaction Endpoints**: https://developer.oanda.com/rest-live-v20/transaction-ep/
- **Rate Limits**: https://developer.oanda.com/rest-live-v20/troubleshooting-errors/

### Internal Documentation
- **API Research**: `docs/brokers/api-research/oanda.md`
- **User Guide**: `docs/brokers/guides/oanda-setup.md`
- **Implementation Summary**: `docs/brokers/OANDA-IMPLEMENTATION.md`
- **Completion Report**: `OANDA-COMPLETION-SUMMARY.md`

### Code References
- **Provider**: `src/services/broker/oanda-provider.ts`
- **Tests**: `src/services/broker/__tests__/oanda-provider.test.ts`
- **Integration Test**: `scripts/test-oanda-integration.ts`
- **Types**: `src/services/broker/types.ts`

### Support
- **OANDA Support**: https://www.oanda.com/contact/
- **Community Forum**: https://www.oanda.com/forex-trading/community/
- **Practice Account**: https://www.oanda.com/demo-account/

---

## 🎯 QUICK REFERENCE

### API Endpoints
```
GET /v3/accounts                           # List accounts
GET /v3/accounts/{accountID}               # Account details
GET /v3/accounts/{accountID}/transactions  # Transaction history
```

### Rate Limits
- **Limit**: 120 requests/second (7,200/minute)
- **Headers**: `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Response**: 429 on exceeded

### Environment URLs
- **Practice**: `https://api-fxpractice.oanda.com`
- **Live**: `https://api-fxtrade.oanda.com`

### Common Symbols
```
EUR_USD → EURUSD  (Euro/US Dollar)
GBP_USD → GBPUSD  (British Pound/US Dollar)
USD_JPY → USDJPY  (US Dollar/Japanese Yen)
XAU_USD → XAUUSD  (Gold/US Dollar)
```

### Error Codes
- **401/403**: Invalid API key → `BrokerAuthError`
- **429**: Rate limit → `BrokerRateLimitError`
- **500**: Server error → `BrokerApiError`

---

**Guide Status**: ✅ Complete  
**Last Updated**: 2026-01-17  
**Maintained By**: Team 1B

🌐 **OANDA Integration: Production Ready!**
