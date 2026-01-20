# 🔧 Binance API Research

> **Broker**: Binance  
> **Status**: ✅ Research Complete  
> **Integration Date**: 2026-01-17  
> **Last Updated**: 2026-01-17  
> **Priority**: High (Tier 2 - Top 20)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [API Documentation](#api-documentation)
3. [Authentication](#authentication)
4. [Endpoints](#endpoints)
5. [Rate Limits](#rate-limits)
6. [Data Coverage](#data-coverage)
7. [Cost Analysis](#cost-analysis)
8. [Integration Estimate](#integration-estimate)
9. [Risk Assessment](#risk-assessment)
10. [Recommendation](#recommendation)
11. [Code Examples](#code-examples)

---

## 1. Overview

### Broker Information
- **Name**: Binance
- **Website**: https://www.binance.com
- **Asset Classes**: Crypto (Spot, Futures, Margin)
- **API Type**: REST + WebSocket
- **API Documentation**: https://binance-docs.github.io/apidocs/spot/en/

### Market Position
- **Users**: 150M+ registered users worldwide
- **Trading Volume**: Largest crypto exchange by volume
- **Markets**: 600+ trading pairs
- **Regions**: Global (restrictions in some countries)

### Integration Type
- [x] API Integration (automated sync)
- [x] Historical data import
- [x] Real-time sync (WebSocket)
- [x] Multi-account support (Spot, Futures, Margin)

### Features Supported
- [x] Automatic trade sync
- [x] Historical data import (up to 3 months via API)
- [x] Real-time sync (WebSocket User Data Stream)
- [x] Multi-account support (Spot, Futures, Margin)
- [x] Position tracking (Futures)
- [x] Order history
- [x] PnL calculation

---

## 2. API Documentation

### Official Documentation
- **Main Docs**: https://binance-docs.github.io/apidocs/spot/en/
- **Spot Trading**: https://binance-docs.github.io/apidocs/spot/en/#spot-account-trade
- **Futures Trading**: https://binance-docs.github.io/apidocs/futures/en/
- **API Libraries**: Official connectors for Python, Java, Node.js
- **Changelog**: https://binance-docs.github.io/apidocs/spot/en/#change-log

### API Versions
- **Spot API**: v3 (current)
- **Futures API**: v1 (current)
- **WebSocket**: Stable

### Documentation Quality
- **Rating**: ⭐⭐⭐⭐⭐ (5/5)
- **Completeness**: Excellent (comprehensive examples)
- **Code Examples**: Yes (multiple languages)
- **Interactive Docs**: No (but well-structured)
- **Community Support**: Excellent (large community)

---

## 3. Authentication

### Authentication Method
- **Type**: API Key + Secret (HMAC SHA256 signature)
- **Complexity**: Medium (requires request signing)
- **Token Expiry**: Never (unless manually revoked)

### API Key Creation
1. Log in to Binance account
2. Navigate to **API Management** (Profile > API Management)
3. Create new API key
4. Save API Key and Secret Key securely
5. Configure IP whitelist (optional but recommended)
6. Enable required permissions:
   - ✅ Enable Reading
   - ✅ Enable Spot & Margin Trading (for trade history)
   - ❌ Enable Withdrawals (NOT needed)

### Security Features
- **IP Whitelist**: Supported (highly recommended)
- **Permissions**: Granular (Read, Trade, Withdraw)
- **2FA**: Required for API key creation
- **Key Restrictions**: Can restrict to specific IPs and permissions

### Authentication Flow
```typescript
// Request signature calculation
const signature = crypto
  .createHmac('sha256', apiSecret)
  .update(queryString)
  .digest('hex');

// Add to request
const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;
```

---

## 4. Endpoints

### Key Endpoints for Trade History

#### 4.1 Spot Trading - My Trades
```
GET /api/v3/myTrades
```

**Parameters**:
- `symbol` (required): Trading pair (e.g., BTCUSDT)
- `startTime` (optional): Timestamp in ms
- `endTime` (optional): Timestamp in ms
- `limit` (optional): Max 1000, default 500
- `recvWindow` (optional): Request validity window

**Response**:
```json
[
  {
    "symbol": "BTCUSDT",
    "id": 28457,
    "orderId": 100234,
    "price": "42000.00",
    "qty": "0.001",
    "quoteQty": "42.00",
    "commission": "0.042",
    "commissionAsset": "USDT",
    "time": 1499865549590,
    "isBuyer": true,
    "isMaker": false,
    "isBestMatch": true
  }
]
```

#### 4.2 Spot Trading - All Orders
```
GET /api/v3/allOrders
```

**Parameters**:
- `symbol` (required)
- `orderId` (optional)
- `startTime` (optional)
- `endTime` (optional)
- `limit` (optional): Max 1000

**Response**: Order history with status

#### 4.3 Futures Trading - User Trades
```
GET /fapi/v1/userTrades
```

**Parameters**: Similar to spot
**Response**: Futures trade history with PnL

#### 4.4 Account Information
```
GET /api/v3/account
```

**Response**: Balances, permissions, account status

### Trade Reconstruction Strategy

**Binance provides individual fills, not round-trip trades.**

We need to reconstruct trades by:
1. Fetch all trades (fills) for each symbol
2. Group by symbol
3. Sort by timestamp
4. Track position (cumulative quantity)
5. Match entry/exit fills to create round-trip trades

**Example**:
- Buy 0.1 BTC @ $40,000 → Entry
- Sell 0.1 BTC @ $42,000 → Exit (creates 1 trade)

---

## 5. Rate Limits

### Spot API Rate Limits

**Request Weight System**:
- Each endpoint has a "weight"
- Limit: 1200 weight per minute per IP
- Limit: 6000 weight per minute per UID

**Example Weights**:
- `GET /api/v3/myTrades`: Weight 10
- `GET /api/v3/account`: Weight 10
- `GET /api/v3/allOrders`: Weight 10

**Calculation**:
- 1200 weight/min ÷ 10 weight/request = 120 requests/min
- **Effective Rate**: ~2 requests/second

### Futures API Rate Limits
- Similar weight system
- Limit: 2400 weight per minute

### Rate Limit Headers
```
X-MBX-USED-WEIGHT-1M: 10
X-MBX-ORDER-COUNT-1M: 5
```

### Recommendations
- Implement exponential backoff
- Cache account data (refresh every 5 minutes)
- Batch symbol requests
- Use WebSocket for real-time updates (no rate limits)

---

## 6. Data Coverage

### Historical Data Availability

**Spot Trading**:
- **Via API**: Last 7 days (default), up to 3 months with pagination
- **Full History**: Export via Binance website (CSV)
- **Granularity**: Individual fills (millisecond precision)

**Futures Trading**:
- **Via API**: Last 7 days, up to 3 months
- **Full History**: Export via website
- **PnL Data**: Included in API response

### Data Quality
- **Completeness**: ⭐⭐⭐⭐⭐ (5/5)
- **Accuracy**: ⭐⭐⭐⭐⭐ (5/5)
- **Timeliness**: Real-time via WebSocket

### Data Fields Available
- ✅ Symbol
- ✅ Price
- ✅ Quantity
- ✅ Timestamp (millisecond precision)
- ✅ Commission
- ✅ Commission Asset
- ✅ Side (buy/sell)
- ✅ Order ID
- ✅ Trade ID
- ✅ Maker/Taker flag
- ✅ PnL (Futures only)

### Limitations
- **Historical Limit**: 3 months via API (use CSV export for older data)
- **Pagination**: Required for large datasets
- **Symbol-specific**: Must query each symbol separately

---

## 7. Cost Analysis

### API Access Costs
- **API Access**: ✅ **FREE**
- **Data Fees**: ✅ **FREE**
- **Rate Limits**: ✅ **FREE** (generous limits)

### Trading Costs (for reference)
- **Spot Trading**: 0.1% maker/taker (can be reduced with BNB)
- **Futures Trading**: 0.02% maker / 0.04% taker
- **VIP Tiers**: Lower fees for high volume

### Integration Costs
- **Development**: 3-4 days (estimated)
- **Maintenance**: Low (stable API)
- **Infrastructure**: $0/month (no additional costs)

### Total Cost
- **Monthly API Cost**: $0 ✅
- **One-time Dev Cost**: 3-4 days
- **Ongoing Maintenance**: Low

---

## 8. Integration Estimate

### Development Timeline

**Phase 1: Spot Trading (2-3 days)**
- Day 1: Authentication + Account info
- Day 2: Trade history fetching + reconstruction
- Day 3: Testing + edge cases

**Phase 2: Futures Trading (1-2 days)**
- Day 1: Futures API integration
- Day 2: PnL calculation + testing

**Total Estimate**: 3-4 days

### Complexity Assessment
- **Authentication**: Medium (HMAC signature required)
- **Trade Reconstruction**: Medium (need to match fills)
- **Rate Limiting**: Low (generous limits)
- **Error Handling**: Low (well-documented errors)
- **Testing**: Medium (need test accounts for Spot + Futures)

### Technical Challenges
1. **Request Signing**: HMAC SHA256 signature for every request
2. **Trade Reconstruction**: Match buy/sell fills to create round-trip trades
3. **Multi-Account**: Support Spot, Futures, Margin separately
4. **Symbol Pagination**: Must query each symbol separately
5. **Historical Data**: Limited to 3 months via API

### Mitigation Strategies
1. Use crypto library for HMAC signing (built-in Node.js)
2. Implement trade reconstruction algorithm (similar to Alpaca)
3. Create separate provider instances for Spot/Futures
4. Fetch active symbols from account, then query each
5. Provide CSV import for older data

---

## 9. Risk Assessment

### Overall Risk: 🟡 **MEDIUM**

### Risk Breakdown

#### 1. API Stability
- **Risk**: Low
- **Reason**: Mature API (5+ years), large user base
- **Mitigation**: Binance has excellent uptime and stability

#### 2. Rate Limits
- **Risk**: Low
- **Reason**: Generous limits (120 req/min)
- **Mitigation**: Implement caching and backoff

#### 3. Authentication Complexity
- **Risk**: Medium
- **Reason**: HMAC signature required for every request
- **Mitigation**: Use well-tested crypto libraries

#### 4. Trade Reconstruction
- **Risk**: Medium
- **Reason**: Need to match fills to create round-trip trades
- **Mitigation**: Similar to Alpaca (proven approach)

#### 5. Regulatory Changes
- **Risk**: Medium
- **Reason**: Crypto regulations vary by country
- **Mitigation**: Binance operates globally, API unlikely to change

#### 6. Historical Data Limit
- **Risk**: Low
- **Reason**: Only 3 months via API
- **Mitigation**: Provide CSV import for older data

### Risk Mitigation Plan
1. Implement robust error handling
2. Add retry logic with exponential backoff
3. Cache account data to reduce API calls
4. Provide CSV import fallback
5. Monitor Binance API changelog for breaking changes

---

## 10. Recommendation

### ✅ **APPROVE - High Priority**

### Rationale

**Pros**:
1. **Largest Crypto Exchange**: 150M+ users, massive market share
2. **Free API**: No costs, generous rate limits
3. **Excellent Documentation**: Comprehensive, well-maintained
4. **Stable API**: Mature, proven reliability
5. **High User Demand**: Crypto traders need this integration
6. **Competitive Advantage**: Essential for crypto market coverage

**Cons**:
1. **HMAC Signing**: Adds authentication complexity
2. **Trade Reconstruction**: Need to match fills (medium complexity)
3. **Historical Limit**: Only 3 months via API (CSV fallback needed)
4. **Regulatory Risk**: Crypto regulations vary by country

### Strategic Value
- **Market Coverage**: Essential for crypto traders
- **User Acquisition**: Attracts crypto trading community
- **Competitive Parity**: Competitors (TradeZella, Edgewonk) support Binance
- **Revenue Impact**: High (crypto traders are active users)

### Implementation Priority
- **Tier**: 2 (High Priority)
- **Urgency**: High
- **User Demand**: Very High
- **Competitive Necessity**: High

### Next Steps
1. ✅ PM approval for implementation
2. Create Binance test account (Spot + Futures testnet)
3. Generate API keys
4. Implement BinanceProvider class
5. Test with sample trades
6. Document integration guide
7. Deploy to staging
8. Beta test with real users

---

## 11. Code Examples

### 11.1 Authentication

```typescript
import crypto from 'crypto';

function signRequest(queryString: string, apiSecret: string): string {
  return crypto
    .createHmac('sha256', apiSecret)
    .update(queryString)
    .digest('hex');
}

async function authenticatedRequest(
  apiKey: string,
  apiSecret: string,
  endpoint: string,
  params: Record<string, string> = {}
): Promise<any> {
  const timestamp = Date.now();
  const queryString = new URLSearchParams({
    ...params,
    timestamp: timestamp.toString(),
  }).toString();
  
  const signature = signRequest(queryString, apiSecret);
  const url = `https://api.binance.com${endpoint}?${queryString}&signature=${signature}`;
  
  const response = await fetch(url, {
    headers: {
      'X-MBX-APIKEY': apiKey,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.statusText}`);
  }
  
  return response.json();
}
```

### 11.2 Get Account Info

```typescript
const accountInfo = await authenticatedRequest(
  apiKey,
  apiSecret,
  '/api/v3/account'
);

console.log('Balances:', accountInfo.balances);
```

### 11.3 Get Trade History

```typescript
async function getTradeHistory(
  apiKey: string,
  apiSecret: string,
  symbol: string,
  startTime?: number
): Promise<any[]> {
  const params: Record<string, string> = {
    symbol,
    limit: '1000',
  };
  
  if (startTime) {
    params.startTime = startTime.toString();
  }
  
  return authenticatedRequest(
    apiKey,
    apiSecret,
    '/api/v3/myTrades',
    params
  );
}

// Example usage
const trades = await getTradeHistory(
  apiKey,
  apiSecret,
  'BTCUSDT',
  Date.now() - 30 * 24 * 60 * 60 * 1000 // Last 30 days
);
```

### 11.4 Trade Reconstruction

```typescript
interface BinanceTrade {
  symbol: string;
  id: number;
  orderId: number;
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
  isMaker: boolean;
}

function reconstructTrades(fills: BinanceTrade[]): BrokerTrade[] {
  const trades: BrokerTrade[] = [];
  
  // Group by symbol
  const fillsBySymbol = new Map<string, BinanceTrade[]>();
  for (const fill of fills) {
    const existing = fillsBySymbol.get(fill.symbol) || [];
    existing.push(fill);
    fillsBySymbol.set(fill.symbol, existing);
  }
  
  // Process each symbol
  for (const [symbol, symbolFills] of fillsBySymbol) {
    // Sort by time
    symbolFills.sort((a, b) => a.time - b.time);
    
    // Track position
    let position = 0;
    const entryFills: BinanceTrade[] = [];
    
    for (const fill of symbolFills) {
      const qty = parseFloat(fill.qty);
      const qtyChange = fill.isBuyer ? qty : -qty;
      const previousPosition = position;
      position += qtyChange;
      
      // Check if opening or closing
      const isOpening =
        (previousPosition >= 0 && qtyChange > 0) ||
        (previousPosition <= 0 && qtyChange < 0);
      
      if (isOpening) {
        entryFills.push(fill);
      } else {
        // Closing - create trade
        if (entryFills.length > 0) {
          const trade = createTradeFromFills(symbol, entryFills, fill);
          trades.push(trade);
          
          if (position === 0) {
            entryFills.length = 0;
          }
        }
      }
    }
  }
  
  return trades;
}
```

### 11.5 Rate Limit Handling

```typescript
async function apiRequestWithRetry(
  apiKey: string,
  apiSecret: string,
  endpoint: string,
  params: Record<string, string> = {},
  maxRetries = 3
): Promise<any> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await authenticatedRequest(apiKey, apiSecret, endpoint, params);
    } catch (error: any) {
      // Check if rate limit error
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
        console.warn(`Rate limit hit, retrying after ${retryAfter}s`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      
      // Other errors - throw
      throw error;
    }
  }
  
  throw new Error('Max retries exceeded');
}
```

---

## 12. Testing Plan

### Test Accounts
1. **Binance Testnet (Spot)**: https://testnet.binance.vision/
2. **Binance Futures Testnet**: https://testnet.binancefuture.com/

### Test Cases

#### TC1: Authentication
- [ ] Valid API key/secret → Success
- [ ] Invalid API key → Auth error
- [ ] Invalid signature → Auth error
- [ ] IP not whitelisted → Auth error

#### TC2: Account Info
- [ ] Fetch account balances
- [ ] Verify balance accuracy
- [ ] Check account permissions

#### TC3: Trade History (Spot)
- [ ] Fetch trades for single symbol
- [ ] Fetch trades for multiple symbols
- [ ] Fetch trades with date range
- [ ] Pagination (>1000 trades)

#### TC4: Trade Reconstruction
- [ ] Simple round-trip (1 buy, 1 sell)
- [ ] Multiple entries (3 buys, 1 sell)
- [ ] Partial exits (1 buy, 2 sells)
- [ ] Long and short positions

#### TC5: Rate Limiting
- [ ] Handle 429 errors gracefully
- [ ] Exponential backoff works
- [ ] Retry logic succeeds

#### TC6: Error Handling
- [ ] Invalid symbol → Error message
- [ ] Network timeout → Retry
- [ ] API maintenance → User notification

---

## 13. Support Resources

### Official Resources
- **API Docs**: https://binance-docs.github.io/apidocs/spot/en/
- **API Telegram**: https://t.me/binance_api_english
- **Status Page**: https://www.binance.com/en/support/announcement
- **GitHub**: https://github.com/binance

### Community Resources
- **Stack Overflow**: `[binance-api]` tag
- **Reddit**: r/BinanceExchange
- **Discord**: Binance API community

### Support Channels
- **API Support**: Via Binance support ticket
- **Response Time**: 24-48 hours
- **Quality**: Good (large support team)

---

## 14. Conclusion

Binance is a **high-priority integration** for Trading Path Journal:

✅ **Largest crypto exchange** (150M+ users)  
✅ **Free API** with generous rate limits  
✅ **Excellent documentation** and community support  
✅ **Stable API** with proven reliability  
✅ **High user demand** from crypto traders  
✅ **Competitive necessity** (competitors support Binance)

**Recommendation**: ✅ **APPROVE for immediate implementation**

**Timeline**: 3-4 days development + 1-2 days testing

**Cost**: $0/month (free API)

**Risk**: 🟡 Medium (HMAC signing + trade reconstruction)

**Strategic Value**: 🔥 **CRITICAL** for crypto market coverage

---

**Prepared By**: Development Team  
**Date**: 2026-01-17  
**Status**: ✅ Research Complete - Ready for Implementation  
**Next Step**: PM Approval → Implementation
