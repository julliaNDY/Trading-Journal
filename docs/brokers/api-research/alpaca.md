# 🦙 Alpaca API Research

> **Status**: Research Complete - Awaiting PM Approval  
> **Priority**: Tier 1 (#10)  
> **Last Updated**: 2026-01-17

---

## 1. Broker Overview

**Name**: Alpaca Markets LLC  
**Country**: USA  
**Founded**: 2015  
**Asset Classes**: Stocks, Crypto  
**Trading Platform**: API-first (no proprietary platform)  
**Market Share**: Growing (popular with algo traders)  
**Target Audience**: Algorithmic traders, developers, fintech apps

**Key Features**:
- Commission-free trading
- API-first approach (no GUI)
- Paper trading (sandbox)
- Real-time market data
- Crypto trading support

---

## 2. API Details

**API Type**: REST API + WebSocket (for real-time data)  
**Documentation**: https://alpaca.markets/docs/  
**API Version**: v2 (current), v1 (deprecated)  
**Base URL**: 
- Live: `https://api.alpaca.markets`
- Paper: `https://paper-api.alpaca.markets`

**Sandbox Environment**: ✅ Yes (Paper Trading)  
- Full functionality
- Fake money
- Real market data
- No account funding required

**SDKs Available**:
- Python (official)
- JavaScript/TypeScript (official)
- Go (official)
- C# (community)

---

## 3. Authentication

**Method**: API Key + Secret (HTTP Headers)

**Headers**:
```
APCA-API-KEY-ID: <API_KEY>
APCA-API-SECRET-KEY: <API_SECRET>
```

**Token Expiration**: No expiration (keys are long-lived)  
**Refresh Token**: Not needed  
**Security**: Keys can be regenerated from dashboard

**Rate Limits**:
- 200 requests per minute (per API key)
- Burst: Up to 200 requests in quick succession
- Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

**Access Levels**:
- Free: Paper trading + limited market data
- Live: Requires funded account (no minimum)
- Market Data: Separate subscription (IEX free, SIP paid)

---

## 4. Endpoints

### Account Information
```
GET /v2/account
```
Returns account details (buying power, equity, cash, etc.)

### Trade History (Orders)
```
GET /v2/orders
```
Query params:
- `status`: `closed` (for filled orders)
- `limit`: Max 500 per request
- `until`: ISO 8601 timestamp
- `after`: ISO 8601 timestamp
- `direction`: `asc` or `desc`
- `nested`: Include legs for multi-leg orders

**Response**:
```json
[
  {
    "id": "904837e3-3b76-47ec-b432-046db621571b",
    "client_order_id": "904837e3-3b76-47ec-b432-046db621571b",
    "created_at": "2021-03-16T18:38:01.942282Z",
    "updated_at": "2021-03-16T18:38:01.942282Z",
    "submitted_at": "2021-03-16T18:38:01.937734Z",
    "filled_at": "2021-03-16T18:38:01.937734Z",
    "expired_at": null,
    "canceled_at": null,
    "failed_at": null,
    "replaced_at": null,
    "replaced_by": null,
    "replaces": null,
    "asset_id": "904837e3-3b76-47ec-b432-046db621571b",
    "symbol": "AAPL",
    "asset_class": "us_equity",
    "notional": null,
    "qty": "15",
    "filled_qty": "15",
    "filled_avg_price": "106.00",
    "order_class": "",
    "order_type": "market",
    "type": "market",
    "side": "buy",
    "time_in_force": "day",
    "limit_price": null,
    "stop_price": null,
    "status": "filled",
    "extended_hours": false,
    "legs": null,
    "trail_percent": null,
    "trail_price": null,
    "hwm": null,
    "commission": 0
  }
]
```

### Positions (Current)
```
GET /v2/positions
```
Returns current open positions (not needed for historical trades)

### Account Activities (Trade Confirmations)
```
GET /v2/account/activities
```
Query params:
- `activity_types`: `FILL` (for trade fills)
- `date`: YYYY-MM-DD (specific date)
- `until`: ISO 8601 timestamp
- `after`: ISO 8601 timestamp
- `direction`: `asc` or `desc`
- `page_size`: Max 100 per request
- `page_token`: For pagination

**Response**:
```json
[
  {
    "id": "20190801011955195::8efc7b9a-8b2b-4000-9955-d36e7db0df74",
    "account_id": "1d5493c9-ea39-4377-aa94-340734c368ae",
    "activity_type": "FILL",
    "transaction_time": "2019-08-01T07:16:59Z",
    "type": "fill",
    "price": "1.63",
    "qty": "1",
    "side": "buy",
    "symbol": "LPCN",
    "leaves_qty": "0",
    "order_id": "6a6e5f4c-b2b6-4f4d-b2b6-4f4d6a6e5f4c",
    "cum_qty": "1",
    "order_status": "filled"
  }
]
```

---

## 5. Data Format

**Request Format**: JSON (for POST/PUT), Query params (for GET)  
**Response Format**: JSON  
**Date/Time Format**: ISO 8601 (RFC 3339)  
**Timezone**: UTC  
**Decimal Precision**: Strings for prices (to avoid floating point issues)

**Example Timestamp**: `2021-03-16T18:38:01.942282Z`

---

## 6. Trade Data Mapping

### Mapping Strategy

Alpaca returns **orders**, not **trades**. A single order can have multiple fills. We need to:
1. Fetch closed orders with `status=filled`
2. Group orders by symbol and match buy/sell pairs
3. Calculate PnL from entry/exit prices

**Alternative**: Use `/v2/account/activities?activity_types=FILL` for individual fills.

### Field Mapping

| Alpaca Field | Our Field | Notes |
|--------------|-----------|-------|
| `id` | `importHash` | Prefix with `alpaca:` |
| `symbol` | `symbol` | Direct mapping |
| `side` | `direction` | `buy` → `LONG`, `sell` → `SHORT` (need pairing) |
| `filled_at` | `openedAt` / `closedAt` | Depends on order type |
| `filled_avg_price` | `entryPrice` / `exitPrice` | Depends on order type |
| `filled_qty` | `quantity` | Direct mapping |
| N/A | `realizedPnlUsd` | Calculate from entry/exit |
| `commission` | `fees` | Always 0 for Alpaca |

### Trade Reconstruction

Since Alpaca doesn't provide "trades" (round trips), we need to:

1. **Fetch all filled orders** for a date range
2. **Group by symbol**
3. **Track position**: Start at 0, add/subtract qty based on side
4. **Match entry/exit**: When position goes from non-zero to zero, create trade
5. **Calculate PnL**: `(exitPrice - entryPrice) * qty` for LONG, `(entryPrice - exitPrice) * qty` for SHORT

**Example**:
```
Order 1: Buy 100 AAPL @ $150 (position: +100)
Order 2: Sell 100 AAPL @ $155 (position: 0)
→ Trade: LONG, entry $150, exit $155, qty 100, PnL = $500
```

### Symbol Normalization
- Alpaca uses standard ticker symbols (e.g., `AAPL`, `TSLA`)
- No normalization needed for US equities
- Crypto: Alpaca uses `BTCUSD`, `ETHUSD` format

---

## 7. Rate Limits

**Limit**: 200 requests per minute  
**Burst**: Up to 200 requests in quick succession  
**Headers**:
- `X-RateLimit-Limit`: Total limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets

**HTTP 429 Response**:
```json
{
  "code": 42900000,
  "message": "rate limit exceeded"
}
```

**Backoff Strategy**:
1. Check `X-RateLimit-Remaining` before each request
2. If < 10, wait until `X-RateLimit-Reset`
3. On 429, exponential backoff: 1s, 2s, 4s, 8s, 16s
4. Max retries: 5

**Optimization**:
- Use `page_size=100` for activities (max allowed)
- Use `limit=500` for orders (max allowed)
- Batch requests by date range
- Cache results to avoid re-fetching

---

## 8. Costs

### API Access
- **Free**: Paper trading (unlimited)
- **Live**: Free with funded account (no minimum deposit)

### Market Data
- **IEX**: Free (15-minute delayed for free accounts)
- **SIP (Consolidated)**: $9/month (real-time)
- **Crypto**: Free (real-time)

### Trading Costs
- **Commissions**: $0 (commission-free)
- **Regulatory Fees**: Pass-through (SEC, FINRA, etc.)
- **Crypto Fees**: 0.25% maker, 0.30% taker

### Total Cost Estimate
- **API Integration**: $0 (free API access)
- **Testing**: $0 (paper trading)
- **Production**: $0 (no API fees)
- **Optional**: $9/month for real-time market data (not required for trade sync)

---

## 9. Access Requirements

**Public API**: ✅ Yes  
**Partner Program**: Not required  
**Application Process**: 
1. Sign up at https://alpaca.markets
2. Complete KYC (for live trading)
3. Generate API keys from dashboard
4. Start using immediately

**Approval Timeline**: 
- Paper trading: Instant
- Live trading: 1-2 business days (KYC)

**Terms of Service**: https://alpaca.markets/docs/terms/  
**Key Points**:
- API usage must comply with SEC regulations
- No scraping or abuse
- Rate limits must be respected
- Data cannot be redistributed

---

## 10. Implementation Notes

### Known Issues
1. **No "Trade" Endpoint**: Must reconstruct trades from orders/fills
2. **Partial Fills**: Orders can be partially filled (need to aggregate)
3. **Multi-Leg Orders**: Options spreads have nested legs
4. **Crypto vs Stocks**: Different endpoints and data formats

### Workarounds
1. **Use Account Activities API**: `/v2/account/activities?activity_types=FILL` provides individual fills
2. **Aggregate Fills**: Group fills by order ID, then match orders
3. **Position Tracking**: Maintain running position to detect round trips
4. **Separate Crypto**: Handle crypto trades separately (different fee structure)

### Best Practices
1. **Use Paper Trading**: Test thoroughly before live integration
2. **Handle Pagination**: Activities API returns max 100 per page
3. **Cache Symbols**: Reduce API calls by caching symbol info
4. **Respect Rate Limits**: Implement exponential backoff
5. **Log Everything**: Comprehensive logging for debugging

### Testing Strategy
1. **Unit Tests**: Mock API responses
2. **Integration Tests**: Use paper trading account
3. **Edge Cases**:
   - Partial fills
   - Multi-leg orders
   - Same-day trades
   - Overnight positions
   - Crypto trades
4. **Performance**: Test with 1000+ orders

### Implementation Checklist
- [ ] Create `AlpacaProvider` class implementing `BrokerProvider`
- [ ] Implement `authenticate()` (validate API keys)
- [ ] Implement `getAccounts()` (return single account)
- [ ] Implement `getTrades()` (fetch and reconstruct trades)
- [ ] Add trade reconstruction logic (match buy/sell pairs)
- [ ] Handle pagination for activities API
- [ ] Implement rate limit handling
- [ ] Add comprehensive error handling
- [ ] Write unit tests
- [ ] Write integration tests (paper trading)
- [ ] Document usage in README

---

## 11. PM Notification

### Recommendation: ✅ **IMPLEMENT** (High Priority)

### Justification
1. **Zero Cost**: Free API access, no fees
2. **Easy Integration**: Well-documented REST API
3. **Paper Trading**: Free testing environment
4. **Growing User Base**: Popular with algo traders
5. **Commission-Free**: Attractive for users
6. **Good Documentation**: Comprehensive API docs + SDKs

### Budget Impact
- **API Costs**: $0/month
- **Development Time**: 2-3 days (including testing)
- **Maintenance**: Low (stable API)
- **Total Cost**: $0 (development time only)

### Timeline Estimate
- **Research**: ✅ Complete
- **Implementation**: 2-3 days
- **Testing**: 1 day (paper trading)
- **Documentation**: 0.5 day
- **Total**: 3.5-4.5 days

### Risk Assessment
- **API Stability**: ✅ Low risk (stable API, good uptime)
- **Rate Limits**: ✅ Low risk (200 req/min sufficient)
- **Data Quality**: ✅ Low risk (reliable data)
- **Complexity**: ⚠️ Medium risk (need to reconstruct trades from orders)
- **Overall Risk**: 🟢 **LOW**

### User Demand
- **Priority**: High (popular with algo traders)
- **Market Share**: Growing
- **Unique Features**: API-first, commission-free
- **Competitive Advantage**: Easy integration for tech-savvy users

### Next Steps
1. ✅ **PM Approval**: Required before implementation
2. ⏸️ **Budget Approval**: Not needed ($0 cost)
3. ⏸️ **API Access**: Sign up for paper trading account
4. ⏸️ **Implementation**: Assign to developer
5. ⏸️ **Testing**: Use paper trading for validation
6. ⏸️ **Production**: Deploy after testing

---

## 12. References

- **Official Docs**: https://alpaca.markets/docs/
- **API Reference**: https://alpaca.markets/docs/api-references/trading-api/
- **Paper Trading**: https://alpaca.markets/docs/trading/paper-trading/
- **Rate Limits**: https://alpaca.markets/docs/api-references/trading-api/#rate-limit
- **GitHub**: https://github.com/alpacahq
- **Community**: https://forum.alpaca.markets/

---

**Research Completed By**: Development Team  
**Date**: 2026-01-17  
**Status**: ⏸️ Awaiting PM Approval
