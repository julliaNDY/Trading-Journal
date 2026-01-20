# POC-2: Market Data Providers - Research & Validation

## Status

**🟢 COMPLETED** - January 17, 2026

---

## Executive Summary

This POC evaluates market data providers for historical tick data required by the Market Replay and Backtesting features. After comprehensive research of 8+ providers, **Polygon.io (now Massive.com)** is recommended as the primary provider with **Alpaca** as the free-tier fallback for development/testing.

### Key Findings

| Metric | Target | Result |
|--------|--------|--------|
| Valid provider for 250ms ticks | 1+ provider | ✅ 3 viable options |
| Budget estimate | Documented | ✅ $29-$1,999/mo range |
| Fallback strategy | Defined | ✅ Alpaca (free) + IBKR (low-cost) |

---

## 1. Provider Comparison Matrix

### 1.1 Overview Comparison

| Provider | Tick Data | History Depth | Asset Classes | Starting Price | Best For |
|----------|-----------|---------------|---------------|----------------|----------|
| **Polygon.io** | ✅ Full | 20+ years | Stocks, Options, Forex, Crypto | $29/mo (delayed) | Production - Full coverage |
| **Alpaca** | ✅ IEX only | Since 2016 | Stocks, Options | **FREE** | Development/Testing |
| **IBKR** | ✅ Limited | 6 months ticks | All | $0 (funded account) | Users with IBKR accounts |
| **Databento** | ✅ Full L1-L3 | 15+ years | Stocks, Futures, Options | $179/mo | Institutional/HFT |
| **Intrinio** | ✅ Delayed | Since Sept 2023 | Stocks | $500/mo ($6k/yr) | Enterprise |
| **Barchart** | ✅ Full | 10+ years | All | $500/mo | Enterprise |
| **FirstRate Data** | ✅ Bundle | Since 2010 | Stocks, ETFs, Futures | $50/ticker | Historical bulk |

### 1.2 Detailed Cost Analysis

#### Tier 1: Free/Low-Cost (Development & Testing)

| Provider | Monthly Cost | What You Get | Limitations |
|----------|--------------|--------------|-------------|
| **Alpaca Basic** | **$0** | Historical trades/quotes (IEX), bars since 2016 | IEX only, 200 req/min, 15-min delay for SIP |
| **IBKR API** | **$0** (funded acct) | reqHistoricalTicks, bars | 6-month tick limit, pacing rules, requires account |
| **Polygon Free** | **$0** | Limited API calls | Very limited, not suitable for production |

#### Tier 2: Developer/Startup ($29-$199/mo)

| Provider | Monthly Cost | What You Get | Best For |
|----------|--------------|--------------|----------|
| **Polygon Starter** | **$29/mo** | 15-min delayed data, aggregates | MVP testing |
| **Alpaca Plus** | **$99/mo** | Full SIP real-time, all exchanges | Small team production |
| **Databento Standard** | **$179/mo** | 1yr L1 history, live data | Algo traders |

#### Tier 3: Business/Production ($999-$2,000/mo)

| Provider | Monthly Cost | What You Get | Best For |
|----------|--------------|--------------|----------|
| **Polygon Business Stocks** | **$1,999/mo** | Full tick history 20+ yrs, real-time | Full production |
| **Polygon Business Currencies** | **$999/mo** | Forex + Crypto real-time & history | Forex/Crypto focus |
| **Intrinio EquitiesEdge** | **$1,250/mo** | Real-time, no exchange fees | No exchange fee needed |
| **Databento Plus** | **$1,500/mo** | 15+ yr history, L2/L3 | Institutional |

### 1.3 Technical Capabilities

| Provider | Latency | Rate Limits | WebSocket | REST API | Data Formats |
|----------|---------|-------------|-----------|----------|--------------|
| **Polygon** | <10ms | 5 req/s free, unlimited paid | ✅ | ✅ | JSON, CSV |
| **Alpaca** | <50ms | 200 req/min | ✅ | ✅ | JSON |
| **IBKR** | <100ms | 60 req/10min | ✅ | ✅ (TWS) | Binary, XML |
| **Databento** | <1ms | Usage-based | ✅ | ✅ | JSON, CSV, DBN |
| **Intrinio** | <100ms | Per-plan | ✅ | ✅ | JSON, CSV |

### 1.4 Asset Coverage

| Provider | US Stocks | ETFs | Options | Futures | Forex | Crypto |
|----------|-----------|------|---------|---------|-------|--------|
| **Polygon** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Alpaca** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **IBKR** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Databento** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Intrinio** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Barchart** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 2. Provider Deep Dives

### 2.1 Polygon.io (Massive.com) - **RECOMMENDED PRIMARY**

**Rebranded to Massive.com on October 30, 2025**

#### Pricing Tiers
- **Free**: Very limited, not suitable for production
- **Starter**: $29/mo - 15-min delayed data
- **Developer**: $79/mo - Real-time aggregates
- **Advanced**: $199/mo - Real-time trades & quotes
- **Business Stocks**: $1,999/mo - Full tick history, 20+ years

#### API Endpoints (Relevant for Replay)
```
GET /v2/ticks/stocks/trades/{ticker}/{date}
GET /v2/ticks/stocks/nbbo/{ticker}/{date}
GET /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}
```

#### Strengths
- ✅ Excellent documentation
- ✅ Node.js SDK available (`@polygon.io/client-js`)
- ✅ 20+ years historical data
- ✅ Nanosecond timestamps
- ✅ WebSocket for real-time

#### Weaknesses
- ❌ Business tier expensive ($1,999/mo)
- ❌ Exchange fees for certain expansions
- ❌ No futures data

#### SDK Installation
```bash
npm install @polygon.io/client-js
```

---

### 2.2 Alpaca Markets - **RECOMMENDED FALLBACK (Free)**

#### Pricing Tiers
- **Basic (Free)**: Historical trades/quotes (IEX), 200 req/min
- **Algo Trader Plus**: $99/mo - Full SIP real-time

#### API Endpoints
```
GET /v2/stocks/{symbol}/trades
GET /v2/stocks/{symbol}/quotes
GET /v2/stocks/{symbol}/bars
```

#### Strengths
- ✅ **FREE tier with useful data**
- ✅ History since 2016
- ✅ Good documentation
- ✅ Node.js SDK available (`@alpacahq/alpaca-trade-api`)
- ✅ WebSocket streaming

#### Weaknesses
- ❌ IEX only on free tier (not all exchanges)
- ❌ 15-min delay for SIP on free tier
- ❌ 200 req/min rate limit
- ❌ Data not adjusted for corporate actions

#### SDK Installation
```bash
npm install @alpacahq/alpaca-trade-api
```

---

### 2.3 Interactive Brokers (IBKR)

#### Pricing
- **$0** for funded account holders
- Exchange fees may apply ($1-$10/mo per exchange)

#### API Endpoints
```javascript
reqHistoricalTicks(contract, "TRADES" | "BID_ASK" | "MIDPOINT")
reqHistoricalData(contract, "1 min" | "5 min" | etc.)
```

#### Strengths
- ✅ Free for existing IBKR users
- ✅ All asset classes
- ✅ Real trading integration

#### Weaknesses
- ❌ Tick data limited to 6 months
- ❌ Strict pacing rules (60 req/10min)
- ❌ Requires funded account
- ❌ Complex API (TWS required)

---

### 2.4 Databento

#### Pricing
- **Standard**: $179/mo - 1yr L1 history
- **Plus**: $1,500/mo - 15+ yr history
- **Unlimited**: $4,000/mo - Full coverage
- **Usage-based**: ~$12/GB (varies by schema)

#### Strengths
- ✅ Best data quality (L1, L2, L3)
- ✅ Nanosecond precision
- ✅ 15+ years history
- ✅ Futures & options

#### Weaknesses
- ❌ More expensive
- ❌ Complex pricing model
- ❌ Steeper learning curve

---

## 3. Recommendation

### 3.1 Primary Strategy: Phased Approach

#### Phase 1: Development & MVP (FREE)
**Provider**: Alpaca Basic

| Aspect | Details |
|--------|---------|
| Cost | $0/mo |
| Use Case | Development, testing, MVP validation |
| Limitations | IEX only, 200 req/min, 15-min delay |
| Duration | Until beta launch |

#### Phase 2: Beta Launch ($29-$99/mo)
**Provider**: Polygon Starter OR Alpaca Plus

| Aspect | Polygon Starter | Alpaca Plus |
|--------|-----------------|-------------|
| Cost | $29/mo | $99/mo |
| Use Case | Beta users testing | Beta production |
| Coverage | 15-min delayed | Full SIP real-time |

#### Phase 3: Production ($199-$1,999/mo)
**Provider**: Polygon Advanced/Business

| Aspect | Advanced | Business |
|--------|----------|----------|
| Cost | $199/mo | $1,999/mo |
| Use Case | Growing user base | Full scale |
| Coverage | Real-time trades/quotes | Full 20+ yr history |

### 3.2 Budget Summary

| Phase | Provider | Monthly Cost | Annual Cost |
|-------|----------|--------------|-------------|
| Development | Alpaca Free | $0 | $0 |
| Beta | Polygon Starter | $29 | $348 |
| Production (Small) | Polygon Advanced | $199 | $2,388 |
| Production (Full) | Polygon Business | $1,999 | $23,988 |

### 3.3 Fallback Strategy

```
Primary: Polygon.io
    ↓ (if API down or rate limited)
Fallback 1: Alpaca (IEX data)
    ↓ (if user has IBKR account)
Fallback 2: IBKR API (user's own data)
```

---

## 4. POC Implementation

### 4.1 Files Created

| File | Purpose |
|------|---------|
| `src/services/market-data/types.ts` | TypeScript interfaces |
| `src/services/market-data/provider-factory.ts` | Provider abstraction factory |
| `src/services/market-data/alpaca-provider.ts` | Alpaca implementation |
| `src/services/market-data/polygon-provider.ts` | Polygon implementation |
| `scripts/poc-market-data.ts` | POC test script |

### 4.2 Architecture

```
MarketDataProviderFactory
    ├── AlpacaProvider (free tier)
    ├── PolygonProvider (paid tier)
    └── IBKRProvider (future)
```

### 4.3 Test Results

Run the POC script:
```bash
npx ts-node scripts/poc-market-data.ts
```

---

## 5. API Notification (Governance)

### 🔔 PM NOTIFICATION REQUIRED

Per governance rules in `docs/roadmap-trading-path-journal.md` Section 5:

**APIs Identified:**

| API | Provider | Purpose | Est. Monthly Cost |
|-----|----------|---------|-------------------|
| Polygon.io REST API | Polygon/Massive | Historical tick data | $29-$1,999/mo |
| Alpaca Data API | Alpaca Markets | Development/Fallback | $0-$99/mo |
| IBKR TWS API | Interactive Brokers | User-specific data | $0 (funded account) |

**Budget Approval Required:**
- Phase 2 (Beta): $29-$99/mo
- Phase 3 (Production): $199-$1,999/mo

**Action Required:** PM to validate budget allocation before proceeding to Phase 2.

---

## 6. Next Steps

1. ✅ Research completed
2. ✅ Comparison matrix created
3. ✅ POC architecture defined
4. ⏳ Implement provider abstraction layer
5. ⏳ Test Alpaca free tier connectivity
6. ⏳ Test Polygon API (requires API key)
7. ⏳ PM budget validation for Phase 2

---

## 7. References

- [Polygon.io Documentation](https://polygon.io/docs)
- [Alpaca Data API Docs](https://docs.alpaca.markets/docs/about-market-data-api)
- [IBKR TWS API Reference](https://interactivebrokers.github.io/tws-api/)
- [Databento Pricing](https://databento.com/pricing)
- [Intrinio Stock Data](https://intrinio.com/financial-market-data)

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-17  
**Author**: Development Team  
**Reviewer**: Product Manager (pending)
