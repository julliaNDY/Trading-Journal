# 🔌 WORKSTREAM 1: BROKER INTEGRATION GUIDE
## Detailed Implementation Guide for 35 Developers

> **Workstream Lead**: [Name TBD] - Lead Broker Integration Engineer  
> **Team Size**: 35 developers (5 sub-teams)  
> **Timeline**: Jan 20 - Feb 7 (2.5 weeks)  
> **Critical Path**: YES ✅ (blocks Phase 11 launch)

---

## 📊 WORKSTREAM OVERVIEW

### Mission
Integrate 6-10 Tier 1 brokers to enable multi-source trade data collection for Phase 11 Daily Bias Analysis.

### Success Criteria
- **6/10 brokers** operational by Jan 31 (minimum for Phase 11)
- **10/10 brokers** operational by Feb 7 (full Tier 1)
- **95%+ sync success rate** across all brokers
- **< 5 min sync time** for 90 days of trade history
- **Zero data integrity issues** in QA validation

---

## 🎯 BROKER PRIORITY LIST

| Priority | Broker | Type | ETA | Team | Critical? |
|----------|--------|------|-----|------|-----------|
| **P0** | Alpaca | API | Jan 28-29 | 1A (8 devs) | ✅ YES |
| **P0** | OANDA | API | Jan 30 | 1B (8 devs) | ✅ YES |
| **P1** | TopstepX | API | Feb 1-2 | 1C (7 devs) | 🟡 Backup |
| **P2** | Charles Schwab | OAuth2 | Feb 3-5 | 1D (6 devs) | ❌ Post-launch OK |
| **P2** | TradeStation | API | Feb 6-7 | 1E (6 devs) | ❌ Post-launch OK |

**Already Complete** ✅:
- Interactive Brokers (IBKR)
- Tradovate
- NinjaTrader (CSV)
- Binance

---

## 👥 TEAM 1A: ALPACA INTEGRATION (8 DEVS)

### Timeline
**Start**: Jan 20 (Monday)  
**End**: Jan 29 (Wednesday)  
**Duration**: 2 days (with buffer)

### Team Structure

| Role | Developer | Responsibilities | Hours |
|------|-----------|------------------|-------|
| **Team Lead** | Dev 1 | Overall coordination, code review | 16h |
| **1A-1: API Research** | Dev 2, Dev 3 | API docs, auth flow, rate limits | 12h |
| **1A-2: Authentication** | Dev 4, Dev 5, Dev 6 | OAuth 2.0, token management | 16h |
| **1A-3: Data Sync** | Dev 7, Dev 8 | Trade history, reconciliation | 14h |
| **1A-4: Testing** | Dev 1 (lead) | Unit + integration tests | 8h |

---

### TASK BREAKDOWN

#### **Task 1A-1: API Research & Documentation** (12 hours)
**Assigned**: Dev 2, Dev 3  
**Duration**: 1.5 days

**Deliverables**:
- [ ] Alpaca API documentation reviewed
  - Trading API: https://alpaca.markets/docs/api-references/trading-api/
  - Market Data API: https://alpaca.markets/docs/api-references/market-data-api/
- [ ] Authentication flow documented (OAuth 2.0)
- [ ] Rate limits identified (200 req/min)
- [ ] Data models mapped (Position, Order, Trade)
- [ ] Error codes documented

**Output**: `docs/brokers/api-research/alpaca-integration-spec.md`

**Checklist**:
```markdown
## Alpaca API Research Checklist

### Authentication
- [ ] OAuth 2.0 flow documented
- [ ] API key vs OAuth comparison
- [ ] Token refresh mechanism
- [ ] Multi-account support confirmed

### Endpoints Required
- [ ] GET /v2/account (account info)
- [ ] GET /v2/positions (current positions)
- [ ] GET /v2/orders (order history)
- [ ] GET /v2/account/activities (trade history)

### Rate Limits
- [ ] 200 requests/minute documented
- [ ] Retry-After header handling
- [ ] Rate limit strategy defined

### Data Models
- [ ] Trade schema mapped to Prisma
- [ ] Position schema mapped
- [ ] Account schema mapped

### Error Handling
- [ ] 401 Unauthorized (token expired)
- [ ] 429 Rate Limit (backoff strategy)
- [ ] 500 Server Error (retry logic)
```

---

#### **Task 1A-2: OAuth 2.0 Authentication** (16 hours)
**Assigned**: Dev 4, Dev 5, Dev 6  
**Duration**: 2 days

**Deliverables**:
- [ ] OAuth 2.0 flow implemented
- [ ] Token storage (encrypted in DB)
- [ ] Token refresh logic
- [ ] Multi-account support (3+ accounts)
- [ ] Error handling (401, token expiry)

**Implementation**:

```typescript
// src/services/broker/alpaca-provider.ts

import { BrokerProvider, BrokerConnection } from './types';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/crypto';

export class AlpacaProvider implements BrokerProvider {
  async connect(userId: string, credentials: AlpacaCredentials): Promise<BrokerConnection> {
    // 1. Exchange authorization code for access token
    const tokenResponse = await fetch('https://api.alpaca.markets/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: credentials.authCode,
        client_id: process.env.ALPACA_CLIENT_ID,
        client_secret: process.env.ALPACA_CLIENT_SECRET,
        redirect_uri: process.env.ALPACA_REDIRECT_URI,
      }),
    });

    const tokens = await tokenResponse.json();

    // 2. Store encrypted tokens in database
    const connection = await prisma.brokerConnection.create({
      data: {
        userId,
        brokerType: 'ALPACA',
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        status: 'CONNECTED',
      },
    });

    return connection;
  }

  async refreshToken(connectionId: string): Promise<void> {
    const connection = await prisma.brokerConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) throw new Error('Connection not found');

    const refreshToken = decrypt(connection.refreshToken);

    const tokenResponse = await fetch('https://api.alpaca.markets/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.ALPACA_CLIENT_ID,
        client_secret: process.env.ALPACA_CLIENT_SECRET,
      }),
    });

    const tokens = await tokenResponse.json();

    await prisma.brokerConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });
  }
}
```

**Checklist**:
```markdown
## OAuth 2.0 Implementation Checklist

### Authorization Flow
- [ ] Authorization URL generated
- [ ] Redirect URI configured
- [ ] Authorization code exchanged for token
- [ ] State parameter validated (CSRF protection)

### Token Management
- [ ] Access token stored (encrypted)
- [ ] Refresh token stored (encrypted)
- [ ] Token expiry tracked
- [ ] Automatic refresh before expiry

### Multi-Account Support
- [ ] Multiple connections per user
- [ ] Account switching logic
- [ ] Connection status tracking

### Error Handling
- [ ] Invalid authorization code
- [ ] Token refresh failure
- [ ] Network errors (retry logic)
```

---

#### **Task 1A-3: Trade Data Sync** (14 hours)
**Assigned**: Dev 7, Dev 8  
**Duration**: 2 days

**Deliverables**:
- [ ] Trade history sync (last 90 days)
- [ ] Position sync (current positions)
- [ ] Order sync (pending orders)
- [ ] Data reconciliation (deduplication)
- [ ] Incremental sync (daily updates)

**Implementation**:

```typescript
// src/services/broker/alpaca-provider.ts (continued)

export class AlpacaProvider implements BrokerProvider {
  async syncTrades(connectionId: string, startDate: Date, endDate: Date): Promise<Trade[]> {
    const connection = await this.getConnection(connectionId);
    const accessToken = decrypt(connection.accessToken);

    // 1. Fetch account activities (trades)
    const activities = await this.fetchActivities(accessToken, startDate, endDate);

    // 2. Transform to internal Trade model
    const trades = activities
      .filter((a) => a.activity_type === 'FILL')
      .map((activity) => this.transformToTrade(activity, connection.userId));

    // 3. Deduplicate (check for existing trades)
    const newTrades = await this.deduplicateTrades(trades);

    // 4. Save to database
    await prisma.trade.createMany({
      data: newTrades,
      skipDuplicates: true,
    });

    return newTrades;
  }

  private async fetchActivities(
    accessToken: string,
    startDate: Date,
    endDate: Date
  ): Promise<AlpacaActivity[]> {
    const response = await fetch(
      `https://api.alpaca.markets/v2/account/activities?` +
        `activity_types=FILL&` +
        `date=${startDate.toISOString().split('T')[0]}&` +
        `until=${endDate.toISOString().split('T')[0]}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Alpaca API error: ${response.statusText}`);
    }

    return response.json();
  }

  private transformToTrade(activity: AlpacaActivity, userId: string): Prisma.TradeCreateInput {
    return {
      userId,
      brokerType: 'ALPACA',
      symbol: activity.symbol,
      direction: activity.side === 'buy' ? 'LONG' : 'SHORT',
      entryPrice: parseFloat(activity.price),
      exitPrice: null, // Will be updated when position closes
      quantity: parseFloat(activity.qty),
      openedAt: new Date(activity.transaction_time),
      closedAt: null,
      realizedPnlUsd: 0, // Calculate when position closes
      status: 'OPEN',
    };
  }

  private async deduplicateTrades(trades: Prisma.TradeCreateInput[]): Promise<Prisma.TradeCreateInput[]> {
    // Check for existing trades by (userId, symbol, openedAt, quantity)
    const existingTrades = await prisma.trade.findMany({
      where: {
        OR: trades.map((t) => ({
          userId: t.userId,
          symbol: t.symbol,
          openedAt: t.openedAt,
          quantity: t.quantity,
        })),
      },
    });

    const existingKeys = new Set(
      existingTrades.map((t) => `${t.userId}-${t.symbol}-${t.openedAt.toISOString()}-${t.quantity}`)
    );

    return trades.filter(
      (t) => !existingKeys.has(`${t.userId}-${t.symbol}-${t.openedAt.toISOString()}-${t.quantity}`)
    );
  }
}
```

**Checklist**:
```markdown
## Trade Data Sync Checklist

### Data Fetching
- [ ] Account activities API called
- [ ] Date range filtering (90 days)
- [ ] Pagination handled (if > 100 records)
- [ ] Rate limiting respected

### Data Transformation
- [ ] Alpaca Activity → Prisma Trade model
- [ ] Direction mapped (buy → LONG, sell → SHORT)
- [ ] Prices parsed (string → decimal)
- [ ] Timestamps converted (ISO → Date)

### Deduplication
- [ ] Existing trades checked
- [ ] Composite key: (userId, symbol, openedAt, quantity)
- [ ] Skip duplicates on insert

### Reconciliation
- [ ] Trade count matches Alpaca
- [ ] PnL calculated correctly
- [ ] No missing trades
```

---

#### **Task 1A-4: Testing & Deployment** (8 hours)
**Assigned**: Dev 1 (Team Lead)  
**Duration**: 1 day

**Deliverables**:
- [ ] Unit tests (95%+ coverage)
- [ ] Integration tests (E2E flow)
- [ ] Manual testing (3+ accounts)
- [ ] Staging deployment
- [ ] QA sign-off

**Test Cases**:

```typescript
// src/services/broker/__tests__/alpaca-provider.test.ts

import { AlpacaProvider } from '../alpaca-provider';
import { prisma } from '@/lib/prisma';

describe('AlpacaProvider', () => {
  let provider: AlpacaProvider;

  beforeEach(() => {
    provider = new AlpacaProvider();
  });

  describe('connect', () => {
    it('should exchange authorization code for access token', async () => {
      const connection = await provider.connect('user-123', {
        authCode: 'test-auth-code',
      });

      expect(connection.brokerType).toBe('ALPACA');
      expect(connection.status).toBe('CONNECTED');
      expect(connection.accessToken).toBeDefined();
    });

    it('should handle invalid authorization code', async () => {
      await expect(
        provider.connect('user-123', { authCode: 'invalid' })
      ).rejects.toThrow('Invalid authorization code');
    });
  });

  describe('syncTrades', () => {
    it('should sync trades from last 90 days', async () => {
      const connectionId = 'connection-123';
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-17');

      const trades = await provider.syncTrades(connectionId, startDate, endDate);

      expect(trades.length).toBeGreaterThan(0);
      expect(trades[0].brokerType).toBe('ALPACA');
    });

    it('should deduplicate existing trades', async () => {
      // Create existing trade
      await prisma.trade.create({
        data: {
          userId: 'user-123',
          symbol: 'AAPL',
          openedAt: new Date('2026-01-15'),
          quantity: 100,
        },
      });

      const trades = await provider.syncTrades('connection-123', new Date('2026-01-01'), new Date('2026-01-17'));

      // Should not include duplicate
      const duplicate = trades.find((t) => t.symbol === 'AAPL' && t.quantity === 100);
      expect(duplicate).toBeUndefined();
    });
  });

  describe('refreshToken', () => {
    it('should refresh expired token', async () => {
      const connectionId = 'connection-123';

      await provider.refreshToken(connectionId);

      const connection = await prisma.brokerConnection.findUnique({
        where: { id: connectionId },
      });

      expect(connection.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
```

**Checklist**:
```markdown
## Testing Checklist

### Unit Tests
- [ ] OAuth 2.0 flow tested
- [ ] Token refresh tested
- [ ] Trade sync tested
- [ ] Deduplication tested
- [ ] Error handling tested

### Integration Tests
- [ ] E2E: Connect → Sync → Verify data
- [ ] Multi-account tested (3+ accounts)
- [ ] Rate limit handling tested
- [ ] Network error recovery tested

### Manual Testing
- [ ] Real Alpaca account connected
- [ ] Trades synced successfully
- [ ] Data integrity verified
- [ ] Performance acceptable (< 5 min)

### Deployment
- [ ] Deployed to staging
- [ ] Environment variables configured
- [ ] Monitoring dashboards setup
- [ ] QA sign-off received
```

---

### TEAM 1A DAILY STANDUP

**Time**: 10:00am (30 min)  
**Format**: Slack async + Zoom sync (if blockers)

**Template**:
```
🔹 TEAM 1A - ALPACA - STANDUP [DATE]

👤 Dev 1 (Lead)
✅ Yesterday: [Task completed]
🎯 Today: [Task in progress]
🚧 Blockers: [None / List]
📊 Progress: [X%]

👤 Dev 2 (API Research)
✅ Yesterday: Reviewed Alpaca API docs
🎯 Today: Document authentication flow
🚧 Blockers: None
📊 Progress: 40%

[Repeat for all 8 devs]
```

---

### TEAM 1A SUCCESS METRICS

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| OAuth 2.0 Implementation | 100% | TBD | ⏳ |
| Trade Sync Working | 100% | TBD | ⏳ |
| Test Coverage | 95%+ | TBD | ⏳ |
| Multi-Account Support | 3+ accounts | TBD | ⏳ |
| Deployment | Staging ✅ | TBD | ⏳ |

---

## 👥 TEAM 1B: OANDA INTEGRATION (8 DEVS)

### Timeline
**Start**: Jan 28 (Tuesday)  
**End**: Jan 30 (Thursday)  
**Duration**: 1 day (leveraging Team 1A patterns)

### Team Structure

| Role | Developer | Responsibilities | Hours |
|------|-----------|------------------|-------|
| **Team Lead** | Dev 9 | Overall coordination, code review | 8h |
| **1B-1: API Research** | Dev 10, Dev 11 | API v20 docs, fxTrade vs fxPractice | 8h |
| **1B-2: Multi-Account** | Dev 12, Dev 13, Dev 14 | Account linking, sub-accounts | 8h |
| **1B-3: Data Sync** | Dev 15, Dev 16 | Forex trades, position tracking | 8h |
| **1B-4: Testing** | Dev 9 (lead) | Unit + integration tests | 4h |

---

### TASK BREAKDOWN

#### **Task 1B-1: API Research** (8 hours)
**Assigned**: Dev 10, Dev 11  
**Duration**: 1 day

**Deliverables**:
- [ ] OANDA v20 API documentation reviewed
- [ ] fxTrade vs fxPractice differences documented
- [ ] Authentication (API key) documented
- [ ] Rate limits identified
- [ ] Data models mapped

**Output**: `docs/brokers/api-research/oanda-integration-spec.md`

**Key Differences from Alpaca**:
- API Key authentication (not OAuth 2.0)
- Forex-specific data (currency pairs, pips)
- fxTrade (live) vs fxPractice (demo) environments

---

#### **Task 1B-2: Multi-Account Handling** (8 hours)
**Assigned**: Dev 12, Dev 13, Dev 14  
**Duration**: 1 day

**Deliverables**:
- [ ] API key storage (encrypted)
- [ ] fxTrade + fxPractice support
- [ ] Multi-account switching
- [ ] Sub-account handling (if applicable)

**Implementation**:

```typescript
// src/services/broker/oanda-provider.ts

export class OandaProvider implements BrokerProvider {
  async connect(userId: string, credentials: OandaCredentials): Promise<BrokerConnection> {
    // 1. Validate API key
    const accountInfo = await this.fetchAccountInfo(credentials.apiKey, credentials.environment);

    // 2. Store encrypted API key
    const connection = await prisma.brokerConnection.create({
      data: {
        userId,
        brokerType: 'OANDA',
        apiKey: encrypt(credentials.apiKey),
        environment: credentials.environment, // 'fxTrade' or 'fxPractice'
        accountId: accountInfo.account.id,
        status: 'CONNECTED',
      },
    });

    return connection;
  }

  private async fetchAccountInfo(apiKey: string, environment: string): Promise<OandaAccountInfo> {
    const baseUrl = environment === 'fxTrade'
      ? 'https://api-fxtrade.oanda.com'
      : 'https://api-fxpractice.oanda.com';

    const response = await fetch(`${baseUrl}/v3/accounts`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`OANDA API error: ${response.statusText}`);
    }

    return response.json();
  }
}
```

---

#### **Task 1B-3: Forex Trade Sync** (8 hours)
**Assigned**: Dev 15, Dev 16  
**Duration**: 1 day

**Deliverables**:
- [ ] Forex trade history sync
- [ ] Currency pair mapping (EUR/USD → EURUSD)
- [ ] Pip calculation
- [ ] Position tracking

**Key Forex Considerations**:
- Currency pairs (not stocks)
- Pips vs dollars (conversion needed)
- Leverage (1:50, 1:100, etc.)
- Swap fees (overnight interest)

---

#### **Task 1B-4: Testing & Deployment** (4 hours)
**Assigned**: Dev 9 (Team Lead)  
**Duration**: 0.5 day

**Deliverables**:
- [ ] Unit tests (95%+ coverage)
- [ ] Integration tests (fxTrade + fxPractice)
- [ ] Staging deployment
- [ ] QA sign-off

---

### TEAM 1B SUCCESS METRICS

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| API Key Authentication | 100% | TBD | ⏳ |
| Forex Trade Sync | 100% | TBD | ⏳ |
| fxTrade + fxPractice Support | 100% | TBD | ⏳ |
| Test Coverage | 95%+ | TBD | ⏳ |
| Deployment | Staging ✅ | TBD | ⏳ |

---

## 👥 TEAM 1C: TOPSTEPX INTEGRATION (7 DEVS)

### Timeline
**Start**: Jan 31 (Friday)  
**End**: Feb 2 (Sunday)  
**Duration**: 2 days

### Team Structure

| Role | Developer | Responsibilities | Hours |
|------|-----------|------------------|-------|
| **Team Lead** | Dev 17 | Overall coordination | 8h |
| **1C-1: API Research** | Dev 18, Dev 19 | Futures-specific API | 8h |
| **1C-2: Futures Logic** | Dev 20, Dev 21 | Micro/E-mini contracts | 8h |
| **1C-3: Data Sync** | Dev 22, Dev 23 | Trade sync, positions | 8h |
| **1C-4: Deployment** | Dev 17 (lead) | Testing & deployment | 4h |

---

### TASK BREAKDOWN

#### **Task 1C-1: Futures API Research** (8 hours)
**Assigned**: Dev 18, Dev 19  
**Duration**: 1 day

**Deliverables**:
- [ ] TopstepX API documentation reviewed
- [ ] Futures contract specs (ES, NQ, YM, etc.)
- [ ] Rollover handling documented
- [ ] Margin requirements understood

**Key Futures Considerations**:
- Contract multipliers (ES = $50/point)
- Micro vs E-mini contracts (MES = $5/point)
- Rollover dates (quarterly)
- Tick size (0.25 for ES)

---

#### **Task 1C-2: Futures-Specific Logic** (8 hours)
**Assigned**: Dev 20, Dev 21  
**Duration**: 1 day

**Deliverables**:
- [ ] Contract multiplier mapping
- [ ] Tick size handling
- [ ] Rollover logic
- [ ] Margin calculation

**Implementation**:

```typescript
// src/services/broker/topstepx-provider.ts

export class TopstepXProvider implements BrokerProvider {
  private contractMultipliers: Record<string, number> = {
    ES: 50,   // E-mini S&P 500
    MES: 5,   // Micro E-mini S&P 500
    NQ: 20,   // E-mini Nasdaq
    MNQ: 2,   // Micro E-mini Nasdaq
    YM: 5,    // E-mini Dow
    MYM: 0.5, // Micro E-mini Dow
  };

  private transformToTrade(fill: TopstepXFill, userId: string): Prisma.TradeCreateInput {
    const symbol = this.normalizeSymbol(fill.instrument);
    const multiplier = this.contractMultipliers[symbol] || 1;

    return {
      userId,
      brokerType: 'TOPSTEPX',
      symbol,
      direction: fill.side === 'BUY' ? 'LONG' : 'SHORT',
      entryPrice: parseFloat(fill.price),
      exitPrice: null,
      quantity: fill.quantity,
      openedAt: new Date(fill.timestamp),
      closedAt: null,
      realizedPnlUsd: 0,
      contractMultiplier: multiplier,
      status: 'OPEN',
    };
  }

  private normalizeSymbol(instrument: string): string {
    // Remove month/year suffix (e.g., "ESH26" → "ES")
    return instrument.replace(/[A-Z]\d{2}$/, '');
  }
}
```

---

#### **Task 1C-3: Data Sync** (8 hours)
**Assigned**: Dev 22, Dev 23  
**Duration**: 1 day

**Deliverables**:
- [ ] Trade history sync
- [ ] Position sync
- [ ] PnL calculation (with multipliers)
- [ ] Deduplication

---

#### **Task 1C-4: Testing & Deployment** (4 hours)
**Assigned**: Dev 17 (Team Lead)  
**Duration**: 0.5 day

**Deliverables**:
- [ ] Unit tests (futures-specific logic)
- [ ] Integration tests
- [ ] Staging deployment
- [ ] QA sign-off

---

### TEAM 1C SUCCESS METRICS

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Futures Contract Logic | 100% | TBD | ⏳ |
| Trade Sync Working | 100% | TBD | ⏳ |
| PnL Calculation Accurate | 100% | TBD | ⏳ |
| Test Coverage | 95%+ | TBD | ⏳ |
| Deployment | Staging ✅ | TBD | ⏳ |

---

## 👥 TEAM 1D: CHARLES SCHWAB (6 DEVS) - POST-LAUNCH

### Timeline
**Start**: Feb 3 (Monday)  
**End**: Feb 5 (Wednesday)  
**Duration**: 3 days

**Note**: Can complete after Phase 11 launch (not critical path)

---

## 👥 TEAM 1E: TRADESTATION (6 DEVS) - POST-LAUNCH

### Timeline
**Start**: Feb 6 (Thursday)  
**End**: Feb 7 (Friday)  
**Duration**: 2 days

**Note**: Can complete after Phase 11 launch (not critical path)

---

## 📊 WORKSTREAM 1 DASHBOARD

### Real-Time Metrics (Updated Daily)

| Broker | Status | Progress | ETA | Blockers |
|--------|--------|----------|-----|----------|
| Alpaca | 🟡 In Progress | 0% | Jan 29 | None |
| OANDA | ⏳ Not Started | 0% | Jan 30 | Waiting for Alpaca |
| TopstepX | ⏳ Not Started | 0% | Feb 2 | Waiting for OANDA |
| Charles Schwab | ⏳ Not Started | 0% | Feb 5 | Post-launch |
| TradeStation | ⏳ Not Started | 0% | Feb 7 | Post-launch |

### Overall WS1 Progress
- **Current**: 0% (4/10 brokers already done)
- **Target**: 60% by Jan 31 (6/10 brokers)
- **Stretch**: 100% by Feb 7 (10/10 brokers)

---

## 🚨 ESCALATION PROTOCOL

### Level 1: Team Lead (15 min)
- Blocker identified → Post in `#ws1-blockers`
- Team lead triages within 15 minutes

### Level 2: Workstream Lead (30 min)
- Cannot resolve → Escalate to workstream lead
- Workstream lead decides: reallocate resources / adjust timeline / escalate

### Level 3: PM (1 hour)
- Critical blocker → Escalate to PM (John)
- PM decision: approve delay / reallocate teams / adjust scope

---

## 📞 COMMUNICATION CHANNELS

- **Slack**: `#ws1-broker-integration` (general)
- **Slack**: `#ws1-team-1a-alpaca` (Team 1A)
- **Slack**: `#ws1-team-1b-oanda` (Team 1B)
- **Slack**: `#ws1-team-1c-topstepx` (Team 1C)
- **Slack**: `#ws1-blockers` (escalations)
- **Jira**: Epic "WS1: Broker Integration" (task tracking)

---

## 🎯 FINAL CHECKLIST (Before Phase 11 Launch)

- [ ] 6/10 brokers operational (Alpaca + OANDA critical)
- [ ] 95%+ sync success rate
- [ ] < 5 min sync time (90 days)
- [ ] Zero data integrity issues
- [ ] All tests passing (95%+ coverage)
- [ ] Staging deployment complete
- [ ] QA sign-off received
- [ ] Documentation complete

---

**Workstream Status**: 🟢 READY TO START  
**Lead**: [Name TBD]  
**Last Updated**: 2026-01-17  
**Next Review**: Jan 20 (Kickoff)

---

🚀 **Let's integrate 6 brokers in 2 weeks!**
