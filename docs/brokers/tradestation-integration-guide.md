# 🚀 TradeStation Integration Guide

> **Implementation Team**: Team 1E (Dev 30-35)  
> **Timeline**: Feb 6-7, 2026 (2 days)  
> **Status**: ⏸️ Scheduled (POST-LAUNCH)  
> **Dependencies**: Phase 11 launched

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Implementation Tasks](#implementation-tasks)
4. [Code Structure](#code-structure)
5. [Testing Strategy](#testing-strategy)
6. [Deployment](#deployment)
7. [Rollback Plan](#rollback-plan)

---

## Overview

### Goal
Implement TradeStation broker integration to allow users to sync their trading history automatically.

### Scope
- OAuth 2.0 authentication flow
- Account fetching
- Order history retrieval
- Trade reconstruction (orders → trades)
- Integration with existing broker sync infrastructure

### Success Criteria
- [ ] Users can connect TradeStation accounts via OAuth
- [ ] Historical trades sync correctly
- [ ] 95%+ sync success rate
- [ ] < 10s sync time for 1000 orders
- [ ] All tests passing (unit + integration)

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     TradeStation Integration                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ├─ OAuth Flow
                              │  ├─ Authorization URL
                              │  ├─ Token Exchange
                              │  └─ Token Refresh
                              │
                              ├─ API Calls
                              │  ├─ GET /v3/brokerage/accounts
                              │  ├─ GET /v3/brokerage/accounts/{id}/balances
                              │  └─ GET /v3/brokerage/accounts/{id}/historicalorders
                              │
                              ├─ Trade Reconstruction
                              │  ├─ Group orders by symbol
                              │  ├─ Match entry/exit pairs
                              │  └─ Calculate PnL
                              │
                              └─ BrokerProvider Interface
                                 ├─ authenticate()
                                 ├─ getAccounts()
                                 └─ getTrades()
```

### Data Flow

```
User → OAuth Consent → Authorization Code → Token Exchange → Access Token
                                                                    │
                                                                    ├─ GET Accounts
                                                                    ├─ GET Orders
                                                                    └─ Reconstruct Trades
                                                                           │
                                                                           └─ Save to DB
```

---

## Implementation Tasks

### PRÉ-6.1: API Integration (10h) - Dev 30, Dev 31

#### Task Breakdown

##### 1. OAuth Implementation (4h) - Dev 30
- [ ] Create `tradestation-provider.ts` file
- [ ] Implement `authenticate()` method
  - [ ] Build authorization URL
  - [ ] Handle redirect callback
  - [ ] Exchange code for tokens
  - [ ] Store access token + refresh token
- [ ] Implement `refreshToken()` method
  - [ ] Check token expiry
  - [ ] Call refresh endpoint
  - [ ] Update stored tokens
- [ ] Add error handling
  - [ ] Invalid credentials
  - [ ] Expired tokens
  - [ ] Rate limits

**Files to Create/Modify**:
- `src/services/broker/tradestation-provider.ts` (new)
- `src/services/broker/types.ts` (add TradeStationCredentials interface)

##### 2. Account & Orders API (4h) - Dev 31
- [ ] Implement `getAccounts()` method
  - [ ] Call `/v3/brokerage/accounts`
  - [ ] Map response to BrokerAccount[]
  - [ ] Handle pagination (if needed)
- [ ] Implement `getOrders()` helper
  - [ ] Call `/v3/brokerage/accounts/{id}/historicalorders`
  - [ ] Handle pagination (500 orders per page)
  - [ ] Filter by date (since parameter)
  - [ ] Parse response

**Files to Create/Modify**:
- `src/services/broker/tradestation-provider.ts` (continue)

##### 3. Trade Reconstruction (4h) - Dev 30
- [ ] Implement `getTrades()` method
  - [ ] Fetch orders via `getOrders()`
  - [ ] Group orders by symbol
  - [ ] Track position (running quantity)
  - [ ] Match entry/exit pairs
  - [ ] Calculate PnL
  - [ ] Handle partial fills
- [ ] Add symbol normalization
  - [ ] Stocks: as-is
  - [ ] Options: parse option symbol
  - [ ] Futures: normalize contract
- [ ] Map to BrokerTrade format

**Files to Create/Modify**:
- `src/services/broker/tradestation-provider.ts` (continue)

##### 4. Provider Registration (2h) - Dev 31
- [ ] Register provider in factory
  - [ ] Add to `provider-factory.ts`
  - [ ] Set metadata (name, capabilities, rate limits)
  - [ ] Add to supported brokers list
- [ ] Update exports
  - [ ] Export from `index.ts`
  - [ ] Update type definitions

**Files to Create/Modify**:
- `src/services/broker/provider-factory.ts`
- `src/services/broker/index.ts`

---

### PRÉ-6.2: Account Linking (8h) - Dev 32, Dev 33

#### Task Breakdown

##### 1. OAuth UI Flow (4h) - Dev 32
- [ ] Create OAuth callback route
  - [ ] `src/app/api/broker/tradestation/callback/route.ts`
  - [ ] Handle authorization code
  - [ ] Exchange for tokens
  - [ ] Save to database
  - [ ] Redirect to success page
- [ ] Add "Connect TradeStation" button
  - [ ] Update broker connection UI
  - [ ] Add TradeStation logo
  - [ ] Handle OAuth redirect

**Files to Create/Modify**:
- `src/app/api/broker/tradestation/callback/route.ts` (new)
- `src/app/(dashboard)/comptes/brokers/brokers-content.tsx`

##### 2. Account Selection (4h) - Dev 33
- [ ] Fetch accounts after OAuth
  - [ ] Call `getAccounts()`
  - [ ] Display account list
  - [ ] Allow user to select accounts
- [ ] Save selected accounts
  - [ ] Create BrokerConnection records
  - [ ] Link to user
  - [ ] Set status to CONNECTED

**Files to Create/Modify**:
- `src/app/actions/broker.ts` (add TradeStation actions)
- `src/app/(dashboard)/comptes/brokers/brokers-content.tsx`

---

### PRÉ-6.3: Testing (6h) - Dev 34, Dev 35

#### Task Breakdown

##### 1. Unit Tests (3h) - Dev 34
- [ ] Test OAuth flow
  - [ ] Test `authenticate()` success
  - [ ] Test `authenticate()` failure
  - [ ] Test `refreshToken()` success
  - [ ] Test `refreshToken()` failure
- [ ] Test API calls
  - [ ] Test `getAccounts()` success
  - [ ] Test `getAccounts()` empty
  - [ ] Test `getOrders()` pagination
  - [ ] Test rate limit handling
- [ ] Test trade reconstruction
  - [ ] Test simple LONG trade
  - [ ] Test simple SHORT trade
  - [ ] Test partial fills
  - [ ] Test multiple symbols

**Files to Create**:
- `src/services/broker/__tests__/tradestation-provider.test.ts`

##### 2. Integration Tests (3h) - Dev 35
- [ ] Test end-to-end sync
  - [ ] Connect account (manual OAuth)
  - [ ] Sync trades
  - [ ] Verify trades in database
  - [ ] Check deduplication
- [ ] Test error scenarios
  - [ ] Invalid credentials
  - [ ] Expired token
  - [ ] Rate limit exceeded
  - [ ] Network error
- [ ] Performance test
  - [ ] Sync 1000 orders
  - [ ] Measure time (< 10s)
  - [ ] Check memory usage

**Files to Create**:
- `scripts/test-tradestation-integration.ts`

---

## Code Structure

### File Organization

```
src/services/broker/
├── tradestation-provider.ts          # Main provider implementation
├── types.ts                           # Add TradeStationCredentials
├── provider-factory.ts                # Register provider
├── index.ts                           # Export provider
└── __tests__/
    └── tradestation-provider.test.ts  # Unit tests

src/app/api/broker/tradestation/
└── callback/
    └── route.ts                       # OAuth callback handler

src/app/actions/
└── broker.ts                          # Add TradeStation actions

src/app/(dashboard)/comptes/brokers/
└── brokers-content.tsx                # Add TradeStation UI

scripts/
└── test-tradestation-integration.ts   # Integration test script
```

### Provider Implementation Template

```typescript
// src/services/broker/tradestation-provider.ts

import { BrokerType, Direction } from '@prisma/client';
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

// ============================================================================
// TRADESTATION API TYPES
// ============================================================================

interface TradeStationAccount {
  AccountID: string;
  AccountType: string;
  Status: string;
  Currency: string;
}

interface TradeStationOrder {
  OrderID: string;
  Symbol: string;
  Quantity: number;
  Side: 'Buy' | 'Sell';
  Status: string;
  FilledQuantity: number;
  AveragePrice: number;
  OrderPlacedTime: string;
  FilledTime: string;
}

interface TradeStationCredentials extends BrokerCredentials {
  // apiKey = not used (OAuth only)
  // apiSecret = not used (OAuth only)
  environment?: 'sim' | 'live';
}

// ============================================================================
// TRADESTATION PROVIDER
// ============================================================================

const TRADESTATION_API_BASE = {
  sim: 'https://sim-api.tradestation.com/v3',
  live: 'https://api.tradestation.com/v3',
};

const TRADESTATION_AUTH_BASE = 'https://signin.tradestation.com';

export class TradeStationProvider implements BrokerProvider {
  readonly brokerType = 'TRADESTATION' as BrokerType;
  
  private environment: 'sim' | 'live';
  
  constructor(environment: 'sim' | 'live' = 'live') {
    this.environment = environment;
  }
  
  private get baseUrl(): string {
    return TRADESTATION_API_BASE[this.environment];
  }
  
  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================
  
  async authenticate(credentials: BrokerCredentials): Promise<AuthResult> {
    // OAuth implementation
    // See full implementation in actual file
  }
  
  async refreshToken(accessToken: string): Promise<AuthResult | null> {
    // Token refresh implementation
    // See full implementation in actual file
  }
  
  // ==========================================================================
  // ACCOUNTS
  // ==========================================================================
  
  async getAccounts(accessToken: string): Promise<BrokerAccount[]> {
    // Account fetching implementation
    // See full implementation in actual file
  }
  
  // ==========================================================================
  // TRADES
  // ==========================================================================
  
  async getTrades(
    accessToken: string,
    accountId: string,
    since?: Date
  ): Promise<BrokerTrade[]> {
    // Trade fetching + reconstruction implementation
    // See full implementation in actual file
  }
  
  // ==========================================================================
  // HELPERS
  // ==========================================================================
  
  private async apiRequest<T>(
    accessToken: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // API request helper
    // See full implementation in actual file
  }
  
  private reconstructTrades(orders: TradeStationOrder[]): BrokerTrade[] {
    // Trade reconstruction logic
    // See full implementation in actual file
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createTradeStationProvider(
  environment: 'sim' | 'live' = 'live'
): TradeStationProvider {
  return new TradeStationProvider(environment);
}
```

---

## Testing Strategy

### Unit Tests

#### Test Cases
1. **OAuth Flow**
   - ✅ Successful authentication
   - ✅ Invalid credentials
   - ✅ Token refresh success
   - ✅ Token refresh failure

2. **API Calls**
   - ✅ Get accounts success
   - ✅ Get accounts empty
   - ✅ Get orders pagination
   - ✅ Rate limit handling
   - ✅ Network error handling

3. **Trade Reconstruction**
   - ✅ Simple LONG trade (buy → sell)
   - ✅ Simple SHORT trade (sell → buy)
   - ✅ Multiple trades same symbol
   - ✅ Partial fills
   - ✅ PnL calculation

#### Running Tests
```bash
npm run test -- tradestation-provider.test.ts
```

### Integration Tests

#### Test Scenarios
1. **End-to-End Sync**
   - Connect TradeStation account (manual OAuth)
   - Sync trades from last 30 days
   - Verify trades in database
   - Check deduplication (re-sync same trades)

2. **Error Handling**
   - Invalid credentials → show error message
   - Expired token → auto-refresh
   - Rate limit → retry with backoff
   - Network error → retry 3 times

3. **Performance**
   - Sync 1000 orders in < 10 seconds
   - Memory usage < 100MB
   - No memory leaks

#### Running Integration Tests
```bash
npm run tsx scripts/test-tradestation-integration.ts
```

---

## Deployment

### Pre-Deployment Checklist
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Code reviewed by Dev 31
- [ ] Documentation complete
- [ ] Environment variables set
- [ ] OAuth callback URL configured

### Environment Variables
```bash
# TradeStation OAuth (production)
TRADESTATION_CLIENT_ID=your_client_id
TRADESTATION_CLIENT_SECRET=your_client_secret
TRADESTATION_REDIRECT_URI=https://yourapp.com/api/broker/tradestation/callback

# TradeStation OAuth (development)
TRADESTATION_CLIENT_ID_DEV=your_dev_client_id
TRADESTATION_CLIENT_SECRET_DEV=your_dev_client_secret
TRADESTATION_REDIRECT_URI_DEV=http://localhost:3000/api/broker/tradestation/callback
```

### Deployment Steps
1. **Merge to main** (after code review)
2. **Deploy to staging**
   - Test OAuth flow
   - Test sync with real account
   - Verify no regressions
3. **Deploy to production**
   - Monitor logs
   - Check error rates
   - Verify sync success rate

### Monitoring
- **Metrics to Track**:
  - Sync success rate (target: 95%+)
  - Sync duration (target: < 10s for 1000 orders)
  - Error rate (target: < 5%)
  - Token refresh failures (target: < 1%)

- **Alerts**:
  - Sync success rate < 90%
  - Error rate > 10%
  - Token refresh failures > 5%

---

## Rollback Plan

### Rollback Triggers
- Sync success rate < 80%
- Critical bugs affecting other brokers
- Security vulnerability discovered

### Rollback Steps
1. **Disable TradeStation in UI**
   - Hide "Connect TradeStation" button
   - Show maintenance message

2. **Stop background syncs**
   - Disable TradeStation in scheduler
   - Cancel in-progress syncs

3. **Revert code**
   - Git revert to previous commit
   - Redeploy previous version

4. **Notify users**
   - Email users with connected TradeStation accounts
   - Explain issue and ETA for fix

### Recovery Plan
1. **Fix issue** (identify root cause)
2. **Test fix** (staging environment)
3. **Gradual rollout** (10% → 50% → 100%)
4. **Monitor closely** (first 24 hours)

---

## Timeline

### Day 1: Feb 6, 2026

| Time | Task | Assignee | Status |
|------|------|----------|--------|
| 9:00am | Kickoff meeting | All | ⏳ |
| 9:30am | OAuth implementation | Dev 30 | ⏳ |
| 9:30am | Account/Orders API | Dev 31 | ⏳ |
| 1:30pm | Trade reconstruction | Dev 30 | ⏳ |
| 1:30pm | Provider registration | Dev 31 | ⏳ |
| 3:30pm | OAuth UI flow | Dev 32 | ⏳ |
| 3:30pm | Account selection | Dev 33 | ⏳ |
| 5:30pm | End of Day 1 | All | ⏳ |

### Day 2: Feb 7, 2026

| Time | Task | Assignee | Status |
|------|------|----------|--------|
| 9:00am | Unit tests | Dev 34 | ⏳ |
| 9:00am | Integration tests | Dev 35 | ⏳ |
| 12:00pm | Code review | Dev 30, Dev 31 | ⏳ |
| 2:00pm | Fix issues | All | ⏳ |
| 4:00pm | Final testing | All | ⏳ |
| 5:00pm | Merge & Deploy | Dev 30 | ⏳ |
| 5:30pm | Completion | All | ⏳ |

---

## Success Metrics

### Technical Metrics
- [ ] 100% unit test coverage
- [ ] 95%+ sync success rate
- [ ] < 10s sync time (1000 orders)
- [ ] < 5% error rate
- [ ] Zero security vulnerabilities

### User Metrics
- [ ] 10+ users connect TradeStation (first week)
- [ ] 90%+ user satisfaction
- [ ] < 5 support tickets (first week)

---

## References

- [TradeStation API Research](./api-research/tradestation.md)
- [Alpaca Provider](../../src/services/broker/alpaca-provider.ts) (similar pattern)
- [OANDA Provider](../../src/services/broker/oanda-provider.ts) (reference)
- [Broker Sync Service](../../src/services/broker/broker-sync-service.ts)

---

**Status**: ⏸️ Ready for Implementation (Feb 6, 2026)  
**Owner**: Dev 30 (James)  
**Team**: Team 1E (Dev 30-35)
