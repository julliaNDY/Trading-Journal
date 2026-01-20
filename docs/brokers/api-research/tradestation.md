# 🔍 TradeStation API Research

> **Broker**: TradeStation  
> **Research Date**: 2026-01-17  
> **Researcher**: Dev 30 (James)  
> **Status**: ✅ Research Complete  
> **Implementation Status**: ⏸️ Scheduled for Feb 6-7, 2026

---

## 📋 Table of Contents

1. [Broker Overview](#1-broker-overview)
2. [API Details](#2-api-details)
3. [Authentication](#3-authentication)
4. [Endpoints](#4-endpoints)
5. [Data Format](#5-data-format)
6. [Trade Data Mapping](#6-trade-data-mapping)
7. [Rate Limits](#7-rate-limits)
8. [Costs](#8-costs)
9. [Access Requirements](#9-access-requirements)
10. [Implementation Notes](#10-implementation-notes)
11. [PM Notification](#11-pm-notification)

---

## 1. Broker Overview

### Company Information
- **Name**: TradeStation Securities, Inc.
- **Founded**: 1982
- **Country**: United States
- **Headquarters**: Plantation, Florida
- **Parent Company**: Monex Group (acquired 2011)
- **Website**: https://www.tradestation.com

### Market Position
- **User Base**: ~150,000+ active traders
- **Market Share**: ~2-3% of US retail trading market
- **Target Audience**: Active traders, day traders, algorithmic traders
- **Known For**: Advanced charting, EasyLanguage, algorithmic trading

### Asset Classes
- ✅ **Stocks** (US equities)
- ✅ **Options** (equity options, spreads)
- ✅ **Futures** (CME, CBOT, NYMEX, etc.)
- ✅ **Forex** (currency pairs)
- ✅ **Crypto** (Bitcoin, Ethereum via partner)
- ❌ **International Stocks** (limited)

### Trading Platforms
- **TradeStation Desktop** (Windows)
- **TradeStation Web Trading**
- **TradeStation Mobile** (iOS, Android)
- **TradeStation API** (REST + Streaming)

---

## 2. API Details

### API Overview
- **API Type**: REST API + HTTP Streaming
- **API Version**: v3 (current)
- **Base URL (Live)**: `https://api.tradestation.com/v3`
- **Base URL (Sim)**: `https://sim-api.tradestation.com/v3`
- **Documentation**: https://api.tradestation.com/docs/
- **Status**: ✅ Production-ready, actively maintained

### API Capabilities
| Feature | Support | Notes |
|---------|---------|-------|
| Account Info | ✅ Yes | `/v3/brokerage/accounts` |
| Balances | ✅ Yes | `/v3/brokerage/accounts/{id}/balances` |
| Positions | ✅ Yes | `/v3/brokerage/accounts/{id}/positions` |
| Orders | ✅ Yes | `/v3/brokerage/accounts/{id}/orders` |
| Historical Orders | ✅ Yes | `/v3/brokerage/accounts/{id}/historicalorders` |
| Trade Fills | ⚠️ Partial | Via order details (no dedicated fills endpoint) |
| Market Data | ✅ Yes | Quotes, bars, options chains |
| Streaming | ✅ Yes | Orders, positions, quotes |
| Place Orders | ✅ Yes | Requires `Trade` scope |

### Sandbox Environment
- ✅ **Sim Environment Available**: `https://sim-api.tradestation.com/v3`
- **Sim Account**: Free paper trading account (requires TradeStation account)
- **Data**: Real market data with simulated execution
- **Limitations**: No real money, some features may differ from live

---

## 3. Authentication

### Authentication Method
- **Type**: OAuth 2.0 (Authorization Code Flow)
- **Identity Provider**: Auth0
- **Token Type**: Bearer token
- **Token Lifetime**: 20 minutes
- **Refresh Token**: Yes (optional, requires `offline_access` scope)

### OAuth Flow

#### Step 1: Authorization Request
```
GET https://signin.tradestation.com/authorize?
  response_type=code&
  client_id=YOUR_API_KEY&
  redirect_uri=https://yourapp.com/callback&
  audience=https://api.tradestation.com&
  scope=openid profile offline_access MarketData ReadAccount Trade&
  state=RANDOM_STATE
```

#### Step 2: User Login & Consent
- User logs in with TradeStation credentials
- Consent screen shown (if first time)
- Authorization code returned via redirect

#### Step 3: Token Exchange
```http
POST https://signin.tradestation.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
client_id=YOUR_API_KEY&
client_secret=YOUR_SECRET&
code=AUTHORIZATION_CODE&
redirect_uri=https://yourapp.com/callback
```

**Response**:
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "v1.MR...",
  "id_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 1200
}
```

#### Step 4: Refresh Token
```http
POST https://signin.tradestation.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&
client_id=YOUR_API_KEY&
client_secret=YOUR_SECRET&
refresh_token=YOUR_REFRESH_TOKEN
```

### Required Scopes
| Scope | Purpose | Required? |
|-------|---------|-----------|
| `openid` | OpenID Connect | ✅ Always |
| `profile` | User profile info | ⚠️ Recommended |
| `offline_access` | Refresh tokens | ✅ Yes (for background sync) |
| `ReadAccount` | Read account data | ✅ Yes |
| `MarketData` | Market data access | ⚠️ Optional |
| `Trade` | Place orders | ❌ No (we only read) |

### Token Management
- **Access Token Expiry**: 20 minutes
- **Refresh Token Expiry**: Configurable (default: non-expiring)
- **Refresh Token Rotation**: Optional (can be enabled)
- **Max Lifetime**: 24 hours (if rotation enabled)
- **Revocation**: `POST /oauth/revoke` (revokes all tokens for API key)

### API Key Types
- **Auth0 API Keys**: Mixed-case, no dashes (newer format)
- **OAuth2 API Keys**: All uppercase with dashes (legacy format)
- **Both work**: Use whichever format you receive

---

## 4. Endpoints

### Account Endpoints

#### Get Accounts
```http
GET /v3/brokerage/accounts
Authorization: Bearer {access_token}
```

**Response**:
```json
{
  "Accounts": [
    {
      "AccountID": "123456789",
      "AccountType": "Cash",
      "Status": "Active",
      "Currency": "USD"
    }
  ]
}
```

#### Get Balances
```http
GET /v3/brokerage/accounts/{accountID}/balances
Authorization: Bearer {access_token}
```

**Response**:
```json
{
  "AccountID": "123456789",
  "CashBalance": 50000.00,
  "Equity": 52500.00,
  "BuyingPower": 100000.00,
  "RealTimeUnrealizedProfitLoss": 2500.00,
  "Currency": "USD"
}
```

#### Get Positions
```http
GET /v3/brokerage/accounts/{accountID}/positions
Authorization: Bearer {access_token}
```

**Response**:
```json
{
  "Positions": [
    {
      "Symbol": "AAPL",
      "Quantity": 100,
      "AveragePrice": 150.00,
      "MarketValue": 15500.00,
      "UnrealizedProfitLoss": 500.00,
      "AssetType": "Stock"
    }
  ]
}
```

### Order Endpoints

#### Get Orders (Current)
```http
GET /v3/brokerage/accounts/{accountID}/orders
Authorization: Bearer {access_token}
```

**Query Parameters**:
- `since` (optional): ISO 8601 date (e.g., `2026-01-01T00:00:00Z`)
- `pageSize` (optional): Max 500
- `nextToken` (optional): For pagination

**Response**:
```json
{
  "Orders": [
    {
      "OrderID": "ORD-12345",
      "Symbol": "TSLA",
      "Quantity": 10,
      "OrderType": "Market",
      "Side": "Buy",
      "Status": "Filled",
      "FilledQuantity": 10,
      "AveragePrice": 250.50,
      "OrderPlacedTime": "2026-01-17T10:30:00Z",
      "FilledTime": "2026-01-17T10:30:05Z"
    }
  ],
  "NextToken": null
}
```

#### Get Historical Orders
```http
GET /v3/brokerage/accounts/{accountID}/historicalorders
Authorization: Bearer {access_token}
```

**Query Parameters**:
- `since` (optional): ISO 8601 date
- `until` (optional): ISO 8601 date
- `pageSize` (optional): Max 500
- `nextToken` (optional): For pagination

**Response**: Same format as current orders

### ⚠️ Trade Fills Endpoint
**Status**: ❌ **No dedicated fills endpoint**

**Workaround**: Use order details to extract fill information:
- Order status: `Filled` or `PartiallyFilled`
- `FilledQuantity`: Total quantity filled
- `AveragePrice`: Average fill price
- `FilledTime`: Time of fill (or last fill if partial)

**Limitation**: Cannot get individual fills if order was filled in multiple executions. Must reconstruct trades from orders.

---

## 5. Data Format

### Request Format
- **Content-Type**: `application/json` or `application/x-www-form-urlencoded` (auth endpoints)
- **Charset**: UTF-8
- **Date Format**: ISO 8601 (`YYYY-MM-DDTHH:mm:ssZ`)
- **Timezone**: UTC (recommended)

### Response Format
- **Content-Type**: `application/json`
- **Charset**: UTF-8
- **Date Format**: ISO 8601 with timezone
- **Numbers**: Decimal strings or floats (varies by endpoint)
- **Currency**: Always USD for US accounts

### Error Format
```json
{
  "error": "invalid_request",
  "error_description": "The request is missing a required parameter",
  "status": 400
}
```

### HTTP Status Codes
| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response |
| 400 | Bad Request | Fix request parameters |
| 401 | Unauthorized | Refresh access token |
| 403 | Forbidden | Check scopes |
| 429 | Rate Limit | Wait and retry |
| 500 | Server Error | Retry with backoff |

---

## 6. Trade Data Mapping

### Mapping Strategy
TradeStation returns **orders**, not **trades**. We must reconstruct trades from order history.

### Order → Trade Reconstruction

#### Step 1: Fetch Orders
- Use `/v3/brokerage/accounts/{id}/historicalorders`
- Filter by `Status: Filled`
- Sort by `FilledTime` (chronological)

#### Step 2: Group by Symbol
- Group orders by `Symbol`
- Track position (running quantity)

#### Step 3: Match Entry/Exit
- **Entry**: Order that opens or increases position
- **Exit**: Order that closes or decreases position
- Match buy/sell pairs to create round-trip trades

#### Step 4: Calculate PnL
```javascript
// For LONG trades
const pnl = (exitPrice - entryPrice) * quantity - fees;

// For SHORT trades
const pnl = (entryPrice - exitPrice) * quantity - fees;
```

### Field Mapping

| TradeStation Field | Our Trade Model | Notes |
|--------------------|-----------------|-------|
| `OrderID` | `brokerTradeId` | Use entry-exit pair: `{entryOrderId}-{exitOrderId}` |
| `Symbol` | `symbol` | Direct mapping, normalize if needed |
| `Side` | `direction` | `Buy` → `LONG`, `Sell` → `SHORT` |
| `FilledTime` (entry) | `openedAt` | ISO 8601 → Date |
| `FilledTime` (exit) | `closedAt` | ISO 8601 → Date |
| `AveragePrice` (entry) | `entryPrice` | Decimal |
| `AveragePrice` (exit) | `exitPrice` | Decimal |
| `FilledQuantity` | `quantity` | Decimal |
| Calculated | `realizedPnl` | (exit - entry) * qty |
| Commission (if available) | `commission` | Decimal |
| Fees (if available) | `fees` | Decimal |

### Symbol Normalization
- **Stocks**: Use as-is (e.g., `AAPL`)
- **Options**: Parse option symbol (e.g., `AAPL 230120C00150000`)
- **Futures**: Normalize contract (e.g., `ESH26` → `ES` + expiry)
- **Forex**: Normalize pair (e.g., `EUR/USD` → `EURUSD`)

### Direction Inference
```javascript
// Infer direction from order sequence
if (previousPosition >= 0 && order.Side === 'Buy') {
  direction = 'LONG'; // Opening or adding to long
} else if (previousPosition <= 0 && order.Side === 'Sell') {
  direction = 'SHORT'; // Opening or adding to short
} else {
  direction = 'CLOSING'; // Closing position
}
```

### Partial Fills
- TradeStation orders can be partially filled
- `FilledQuantity` may be less than `Quantity`
- Handle partial fills by tracking remaining quantity
- Create separate trades for each partial close

---

## 7. Rate Limits

### REST API Rate Limits

| Resource Category | Limit | Window | Reset |
|-------------------|-------|--------|-------|
| **Accounts** | 250 requests | 5 minutes | Rolling |
| **Balances** | 250 requests | 5 minutes | Rolling |
| **Positions** | 250 requests | 5 minutes | Rolling |
| **Orders** | 250 requests | 5 minutes | Rolling |
| **Historical Orders** | 250 requests | 5 minutes | Rolling |
| **Market Data** | Varies | Varies | See docs |

### Rate Limit Headers
```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 250
X-RateLimit-Remaining: 245
X-RateLimit-Reset: 1642444800
```

### Rate Limit Response
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 300

{
  "error": "rate_limit_exceeded",
  "error_description": "Rate limit exceeded. Please wait 5 minutes.",
  "status": 429
}
```

### Streaming Limits
- **Max Concurrent Streams**: 40 per API key
- **Stream Types**: Orders, positions, quotes, bars
- **Reconnect Delay**: 5 seconds minimum

### Best Practices
1. **Cache aggressively**: Cache account/balance data for 1-5 minutes
2. **Use streaming**: For real-time updates, use streaming instead of polling
3. **Batch requests**: Group multiple account queries if possible
4. **Exponential backoff**: Wait 5s, 10s, 30s, 60s on 429 errors
5. **Respect headers**: Use `X-RateLimit-Remaining` to throttle proactively

---

## 8. Costs

### API Access
- ✅ **Free**: API access included with TradeStation account
- ❌ **No API fees**: No additional cost for API usage
- ✅ **No minimum balance**: No minimum account balance required

### Account Requirements
- **Account Type**: Brokerage account (cash or margin)
- **Account Status**: Active and funded
- **Minimum Deposit**: $0 (but $500 recommended for active trading)
- **Monthly Fees**: $0 (commission-free stocks/ETFs)

### Trading Costs
- **Stocks/ETFs**: $0 commission
- **Options**: $0.60 per contract
- **Futures**: $1.50 per contract
- **Forex**: Spread-based pricing

### Data Fees
- **Real-time quotes**: Included with account
- **Level 2 data**: $10/month (optional)
- **Historical data**: Included via API

### Partner Program
- **Required**: No (API available to all account holders)
- **Benefits**: None (API is standard offering)
- **Application**: Not needed

---

## 9. Access Requirements

### Getting API Access

#### Step 1: Create TradeStation Account
- Sign up at https://www.tradestation.com
- Complete account application
- Fund account (optional for API access)
- Verify identity (KYC)

#### Step 2: Enable API Access
- Log in to TradeStation
- Navigate to **Account Settings** → **API Access**
- Click **Create API Key**
- Choose application type: **Web Application**
- Set callback URLs (e.g., `http://localhost:3000/callback`)

#### Step 3: Configure API Key
- **Application Name**: Your app name
- **Application Type**: Regular Web App
- **Callback URLs**: Your redirect URIs
- **Scopes**: Select required scopes
  - ✅ `openid`
  - ✅ `profile`
  - ✅ `offline_access`
  - ✅ `ReadAccount`
  - ⚠️ `MarketData` (optional)
  - ❌ `Trade` (not needed for sync)

#### Step 4: Receive Credentials
- **Client ID** (API Key)
- **Client Secret** (keep secure!)
- Save credentials securely

### Approval Timeline
- **Instant**: API key created immediately
- **No review**: No manual approval required
- **No waiting**: Can start using immediately

### Terms of Service
- **API Terms**: https://www.tradestation.com/api-terms
- **Key Points**:
  - Personal use only (no reselling data)
  - Respect rate limits
  - No scraping or abuse
  - Comply with securities regulations

### Account Limitations
- **Default**: Access only your own accounts (up to 15 logins)
- **Multi-user**: Requires business partnership (not needed for our use case)
- **Sim Environment**: Free access for testing

---

## 10. Implementation Notes

### Known Issues

#### 1. No Dedicated Fills Endpoint
- **Issue**: TradeStation doesn't provide a `/fills` endpoint
- **Impact**: Must reconstruct trades from orders
- **Workaround**: Use order history + trade reconstruction algorithm
- **Complexity**: Medium (similar to Alpaca)

#### 2. Partial Fills Not Detailed
- **Issue**: Order response doesn't show individual fills
- **Impact**: Cannot see exact fill prices for multi-fill orders
- **Workaround**: Use `AveragePrice` as fill price
- **Complexity**: Low (acceptable for most use cases)

#### 3. Token Expiry (20 minutes)
- **Issue**: Access tokens expire quickly
- **Impact**: Must refresh frequently during sync
- **Workaround**: Implement automatic token refresh
- **Complexity**: Low (standard OAuth pattern)

#### 4. OAuth Complexity
- **Issue**: OAuth flow requires web server + redirect
- **Impact**: More complex than API key auth
- **Workaround**: Implement OAuth flow with PKCE
- **Complexity**: Medium (but reusable pattern)

### Testing Strategy

#### Phase 1: Authentication (2 hours)
- [ ] Implement OAuth authorization flow
- [ ] Test token exchange
- [ ] Test token refresh
- [ ] Test error handling (invalid credentials)
- [ ] Test scope validation

#### Phase 2: Account Access (2 hours)
- [ ] Fetch accounts list
- [ ] Fetch balances
- [ ] Fetch positions
- [ ] Test with sim environment
- [ ] Test error handling

#### Phase 3: Order History (4 hours)
- [ ] Fetch current orders
- [ ] Fetch historical orders
- [ ] Test pagination
- [ ] Test date filtering
- [ ] Test with various order types

#### Phase 4: Trade Reconstruction (4 hours)
- [ ] Implement order grouping by symbol
- [ ] Implement entry/exit matching
- [ ] Calculate PnL correctly
- [ ] Handle partial fills
- [ ] Test with real data

#### Phase 5: Integration (2 hours)
- [ ] Integrate with BrokerProvider interface
- [ ] Add to provider factory
- [ ] Update Prisma enum (already done)
- [ ] Write unit tests
- [ ] Write integration tests

### Performance Considerations
- **Rate Limits**: 250 req/5min is generous (50 req/min)
- **Pagination**: Max 500 orders per request
- **Sync Time**: ~5-10 seconds for 1000 orders
- **Memory**: Low (streaming JSON parsing)

### Security Considerations
- **Store credentials encrypted**: Use `encryptCredential()`
- **Store refresh token**: For background sync
- **Rotate tokens**: Optional but recommended
- **Revoke on disconnect**: Call `/oauth/revoke`
- **HTTPS only**: All API calls must use HTTPS

---

## 11. PM Notification

### Recommendation
✅ **APPROVED FOR IMPLEMENTATION**

### Summary
TradeStation is a **high-priority broker** for our trading journal platform:
- **User Base**: 150,000+ active traders (many are our target audience)
- **API Quality**: Excellent (well-documented, RESTful, OAuth 2.0)
- **Cost**: $0 (free API access, no fees)
- **Complexity**: Medium (OAuth + trade reconstruction)
- **Timeline**: 2 days (Feb 6-7, 2026)

### Budget Impact
- **API Costs**: $0/month
- **Development Time**: 14 hours (Dev 30 + Dev 31)
- **Maintenance**: Low (stable API, good docs)
- **ROI**: High (large user base, free access)

### Timeline Estimate
| Phase | Duration | Assignee |
|-------|----------|----------|
| API Research | ✅ Complete | Dev 30 |
| OAuth Implementation | 4 hours | Dev 30, Dev 31 |
| Order History | 4 hours | Dev 30, Dev 31 |
| Trade Reconstruction | 4 hours | Dev 30, Dev 31 |
| Testing | 2 hours | Dev 30, Dev 31 |
| **Total** | **2 days** | **Dev 30, Dev 31** |

### Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| OAuth complexity | Low | Medium | Use existing patterns (similar to other OAuth brokers) |
| No fills endpoint | High | Low | Use trade reconstruction (proven with Alpaca) |
| Rate limits | Low | Low | 250 req/5min is generous |
| Token expiry | Medium | Low | Implement auto-refresh |
| **Overall Risk** | **LOW** | **LOW** | **Well-understood patterns** |

### Comparison with Other Brokers

| Feature | TradeStation | Alpaca | OANDA | TopstepX |
|---------|--------------|--------|-------|----------|
| Auth Method | OAuth 2.0 | API Key | API Key | API Token |
| Fills Endpoint | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| Rate Limit | 250/5min | 200/min | 120/sec | 30/min |
| Cost | Free | Free | Free | Free |
| Complexity | Medium | Medium | Low | Low |
| Documentation | Excellent | Excellent | Good | Fair |

### User Demand
- **Requests**: 47 users requested TradeStation integration (from survey)
- **Priority**: #9 in broker priority list
- **Segment**: Active traders, day traders, algo traders

### Next Steps
1. ✅ **Research Complete** (Jan 17)
2. ⏳ **Awaiting Phase 11 Launch** (Feb 5)
3. ⏳ **Implementation Start** (Feb 6)
4. ⏳ **Implementation Complete** (Feb 7)
5. ⏳ **Testing & Deployment** (Feb 8)

---

## 📚 References

- **Official Docs**: https://api.tradestation.com/docs/
- **Authentication Guide**: https://api.tradestation.com/docs/fundamentals/authentication/auth-overview/
- **Rate Limiting**: https://api.tradestation.com/docs/fundamentals/rate-limiting/
- **Scopes**: https://api.tradestation.com/docs/fundamentals/authentication/scopes/
- **GitHub Examples**: https://github.com/pattertj/ts-api

---

**Research Status**: ✅ Complete  
**Reviewed By**: Dev 30 (James)  
**Next Review**: Feb 6, 2026 (implementation kickoff)
