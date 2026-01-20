# 🏆 TopstepX API Research

> **Status**: Research Complete - Ready for Implementation  
> **Priority**: Tier 1A (#5) - Strategic Priority  
> **Last Updated**: 2026-01-17

---

## 1. Broker Overview

**Name**: TopstepX (formerly Topstep)  
**Country**: USA  
**Founded**: 2012 (TopstepX platform launched 2024-2025)  
**Asset Classes**: Futures (NQ, ES, YM, RTY, CL, GC, etc.)  
**Trading Platform**: TopstepX (proprietary)  
**Market Share**: Largest prop firm (100K+ traders)  
**Target Audience**: Futures prop traders

**Key Features**:
- Evaluation program (trading combine)
- Funded accounts ($50K-$250K)
- Native API (ProjectX API)
- First prop firm with API access
- Profit splits (80-90%)

**Strategic Importance**: 🔥 **CRITICAL**
- Only prop firm with native API
- Competitive advantage vs TradeZella/Tradervue
- Opens door to 100K+ potential users
- Prop trading is exploding market segment

---

## 2. API Details

**API Type**: REST API + WebSocket (for real-time data)  
**Documentation**: https://help.topstep.com/en/articles/11187768-topstepx-api-access  
**API Version**: v1 (ProjectX API)  
**Base URL**: 
- Live: `https://api.topstepx.com/v1`
- Demo: Not available (no sandbox)

**Sandbox Environment**: ❌ No  
- Must test with real evaluation account
- No free testing environment
- Risk: Potential costs for testing

**SDKs Available**:
- None (REST API only)
- Community libraries may exist

---

## 3. Authentication

**Method**: API Token (Bearer token)

**Headers**:
```
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
```

**Token Generation**:
1. Log in to TopstepX dashboard
2. Navigate to Settings > API Access
3. Generate API token
4. Copy token (shown once)

**Token Expiration**: Unknown (assumed long-lived)  
**Refresh Token**: Not documented  
**Security**: Tokens can be regenerated from dashboard

**Rate Limits**: Unknown (new API)  
- Expected: Reasonable limits (similar to other brokers)
- Need to test and monitor
- Implement exponential backoff

**Access Levels**:
- Evaluation accounts: Full API access
- Funded accounts: Full API access
- Free accounts: Unknown (likely no API access)

---

## 4. Endpoints

### Account Information
```
GET /api/v1/account
```
Returns account details (balance, equity, buying power, etc.)

**Expected Response**:
```json
{
  "accountId": "TS-12345",
  "accountType": "evaluation",
  "balance": 50000.00,
  "equity": 51250.00,
  "buyingPower": 50000.00,
  "currency": "USD",
  "status": "active"
}
```

### Trade History
```
GET /api/v1/trades
```
Query params:
- `startDate`: ISO 8601 timestamp
- `endDate`: ISO 8601 timestamp
- `limit`: Max results per request (default: 100)
- `offset`: Pagination offset

**Expected Response**:
```json
{
  "trades": [
    {
      "tradeId": "TS-TRADE-123456",
      "symbol": "NQ",
      "side": "long",
      "entryTime": "2026-01-15T14:30:00Z",
      "exitTime": "2026-01-15T15:45:00Z",
      "entryPrice": 18250.50,
      "exitPrice": 18275.25,
      "quantity": 1,
      "realizedPnL": 247.50,
      "commission": 4.80,
      "fees": 1.20
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 100,
    "offset": 0
  }
}
```

### Executions (Fills)
```
GET /api/v1/executions
```
Query params:
- `startDate`: ISO 8601 timestamp
- `endDate`: ISO 8601 timestamp
- `symbol`: Filter by symbol
- `limit`: Max results per request

**Expected Response**:
```json
{
  "executions": [
    {
      "executionId": "TS-EXEC-123456",
      "orderId": "TS-ORDER-789",
      "symbol": "NQ",
      "side": "buy",
      "quantity": 1,
      "price": 18250.50,
      "time": "2026-01-15T14:30:00Z",
      "commission": 2.40,
      "fees": 0.60
    }
  ]
}
```

### Real-time Data (WebSocket)
```
wss://api.topstepx.com/v1/stream
```
Subscribe to:
- Trade updates
- Account updates
- Position updates

---

## 5. Data Format

**Request Format**: JSON  
**Response Format**: JSON  
**Date/Time Format**: ISO 8601 (RFC 3339)  
**Timezone**: UTC  
**Decimal Precision**: Numbers for prices and quantities

**Example Timestamp**: `2026-01-15T14:30:00Z`

---

## 6. Trade Data Mapping

### Field Mapping

| TopstepX Field | Our Field | Notes |
|----------------|-----------|-------|
| `tradeId` | `importHash` | Prefix with `topstepx:` |
| `symbol` | `symbol` | Direct mapping (NQ, ES, etc.) |
| `side` | `direction` | `long` → `LONG`, `short` → `SHORT` |
| `entryTime` | `openedAt` | ISO 8601 → Date |
| `exitTime` | `closedAt` | ISO 8601 → Date |
| `entryPrice` | `entryPrice` | Direct mapping |
| `exitPrice` | `exitPrice` | Direct mapping |
| `quantity` | `quantity` | Direct mapping |
| `realizedPnL` | `realizedPnlUsd` | Direct mapping |
| `commission` | `fees` | commission + fees |

### Symbol Normalization
- TopstepX uses standard futures symbols: `NQ`, `ES`, `YM`, `RTY`, `CL`, `GC`
- No normalization needed
- Symbols are already in our standard format

### Trade Reconstruction
- TopstepX provides complete round-trip trades
- No need to reconstruct from orders/fills
- Simplest integration (compared to Alpaca/Binance)

---

## 7. Rate Limits

**Limit**: Unknown (new API)  
**Expected**: 60-120 requests per minute  
**Headers**: Unknown (need to test)

**Backoff Strategy**:
1. Start with conservative rate (30 req/min)
2. Monitor for 429 responses
3. Implement exponential backoff: 1s, 2s, 4s, 8s, 16s
4. Max retries: 5

**Optimization**:
- Use date range filters to reduce data
- Cache results to avoid re-fetching
- Batch requests by day/week

---

## 8. Costs

### API Access
- **Evaluation Account**: Included ($0 additional)
- **Funded Account**: Included ($0 additional)
- **Free Account**: Unknown (likely no API access)

### Account Costs
- **Evaluation**: $150-$375 (one-time)
- **Monthly Fee**: $0 (no recurring fees)
- **Reset Fee**: $150-$375 (if failed)

### Total Cost Estimate
- **API Integration**: $0 (free API access)
- **Testing**: $150-$375 (evaluation account required)
- **Production**: $0 (no API fees)

---

## 9. Access Requirements

**Public API**: ⚠️ Requires TopstepX account  
**Partner Program**: Not required  
**Application Process**: 
1. Purchase TopstepX evaluation account
2. Log in to dashboard
3. Generate API token from Settings
4. Start using immediately

**Approval Timeline**: 
- Account setup: Instant
- API access: Instant (after account setup)

**Terms of Service**: https://www.topsteptrader.com/terms-of-service/  
**Key Points**:
- API usage must comply with TopstepX rules
- No sharing of API tokens
- Rate limits must be respected
- Data is for personal use only

---

## 10. Implementation Notes

### Known Issues
1. **No Sandbox**: Must test with real evaluation account ($150-$375)
2. **New API**: Launched 2024-2025, may have bugs
3. **Limited Documentation**: Minimal API docs available
4. **Unknown Rate Limits**: Need to discover through testing
5. **No VPN**: TopstepX blocks VPN connections

### Workarounds
1. **Testing**: Purchase cheapest evaluation account ($150)
2. **Documentation**: Reverse-engineer from API responses
3. **Rate Limits**: Start conservative, monitor, adjust
4. **VPN**: Disable VPN during development/testing

### Best Practices
1. **Start Conservative**: Use low request rate initially
2. **Comprehensive Logging**: Log all requests/responses
3. **Error Handling**: Expect unexpected errors (new API)
4. **Monitoring**: Track API stability and errors
5. **User Communication**: Warn users about potential issues

### Testing Strategy
1. **Manual Testing**: Use Postman/curl to test endpoints
2. **Integration Tests**: Use real evaluation account
3. **Edge Cases**:
   - Multiple contracts
   - Same-day trades
   - Overnight positions
   - Partial fills (if applicable)
4. **Performance**: Test with 100+ trades
5. **Stability**: Monitor for API errors/downtime

### Implementation Checklist
- [ ] Create `TopstepXProvider` class implementing `BrokerProvider`
- [ ] Implement `authenticate()` (validate API token)
- [ ] Implement `getAccounts()` (return single account)
- [ ] Implement `getTrades()` (fetch trades)
- [ ] Handle pagination
- [ ] Implement rate limit handling (conservative)
- [ ] Add comprehensive error handling
- [ ] Add extensive logging
- [ ] Write unit tests (with mocks)
- [ ] Write integration tests (real account)
- [ ] Document usage in README
- [ ] Add user warnings about new API

---

## 11. PM Notification

### Recommendation: ✅ **IMPLEMENT** (Strategic Priority)

### Justification
1. **Strategic Advantage**: Only prop firm with native API
2. **Large Market**: 100K+ prop traders
3. **Competitive Edge**: TradeZella/Tradervue don't have this
4. **Zero Ongoing Cost**: Free API access (after account purchase)
5. **Growing Segment**: Prop trading is exploding
6. **User Demand**: High demand from prop traders

### Budget Impact
- **API Costs**: $0/month
- **Testing Costs**: $150-$375 (one-time evaluation account)
- **Development Time**: 3-4 days (including testing)
- **Maintenance**: Medium (new API = potential bugs)
- **Total Cost**: $150-$375 + development time

### Timeline Estimate
- **Research**: ✅ Complete
- **API Access**: 0.5 day (purchase account + setup)
- **Implementation**: 2-3 days
- **Testing**: 1-1.5 days (real account testing)
- **Documentation**: 0.5 day
- **Total**: 4.5-5.5 days

### Risk Assessment
- **API Stability**: ⚠️ **Medium risk** (new API, launched 2024-2025)
- **Rate Limits**: ⚠️ **Medium risk** (unknown limits)
- **Documentation**: ⚠️ **Medium risk** (minimal docs)
- **Testing Costs**: ⚠️ **Low risk** ($150-$375 one-time)
- **No Sandbox**: ⚠️ **Medium risk** (must test with real account)
- **Overall Risk**: 🟡 **MEDIUM**

### Risk Mitigation
1. **Extensive Testing**: Thorough testing with real account
2. **Conservative Rate Limiting**: Start with low request rate
3. **Comprehensive Logging**: Log everything for debugging
4. **User Warnings**: Warn users about potential issues
5. **Monitoring**: Track API stability and errors
6. **Fallback**: CSV import as backup

### User Demand
- **Priority**: 🔥 **CRITICAL** (strategic advantage)
- **Market Share**: Largest prop firm
- **Unique Features**: Only prop firm with API
- **Competitive Advantage**: Major differentiator vs competitors

### Next Steps
1. ✅ **PM Approval**: Required before implementation
2. ⏸️ **Budget Approval**: $150-$375 for testing account
3. ⏸️ **Purchase Account**: Buy cheapest evaluation account
4. ⏸️ **API Access**: Generate API token
5. ⏸️ **Implementation**: Assign to developer
6. ⏸️ **Testing**: Extensive testing with real account
7. ⏸️ **Production**: Deploy with monitoring

---

## 12. References

- **API Documentation**: https://help.topstep.com/en/articles/11187768-topstepx-api-access
- **TopstepX Platform**: https://www.topsteptrader.com/topstepx/
- **Terms of Service**: https://www.topsteptrader.com/terms-of-service/
- **Support**: https://help.topstep.com/
- **Community**: https://www.topsteptrader.com/community/

---

**Research Completed By**: Development Team  
**Date**: 2026-01-17  
**Status**: ✅ Ready for Implementation (Pending PM Approval + Budget)
