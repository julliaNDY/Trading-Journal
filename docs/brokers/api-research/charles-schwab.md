# Charles Schwab API Research

> **Status**: Research Complete - Ready for Implementation  
> **Broker**: Charles Schwab (TD Ameritrade merged)  
> **Assignee**: Dev 26  
> **Date**: 2026-01-17  
> **Priority**: 🟠 HIGH (POST-LAUNCH - Feb 3-5)

---

## 📋 Executive Summary

Charles Schwab offers a **Trader API – Individual** product with OAuth 2.0 authentication. The API replaced the legacy TD Ameritrade API (shut down May 10, 2024). This integration will provide access to 33M+ Schwab accounts and 11M+ former TD Ameritrade accounts.

**Key Findings**:
- ✅ REST API available (OAuth 2.0)
- ✅ Free API access (no monthly fees)
- ✅ Transaction history endpoint available
- ⚠️ Manual app approval required (1-3 days)
- ⚠️ 60-day default history limit
- ⚠️ 7-day refresh token validity (requires re-auth)

**Integration Complexity**: **MEDIUM-HIGH** (OAuth 2.0 + approval process)

**Estimated Integration Time**: **4-5 days**

---

## 🔑 API Overview

### Base URLs

```
Authorization: https://api.schwabapi.com/v1/oauth/authorize
Token:         https://api.schwabapi.com/v1/oauth/token
API Base:      https://api.schwabapi.com/trader/v1
```

### Authentication Method

**OAuth 2.0** (Authorization Code Flow)

- **Access Token**: Valid ~30 minutes
- **Refresh Token**: Valid ~7 days (hard limit)
- **Re-authentication**: Required after 7 days

### Rate Limits

- **Not officially documented**
- Community reports: Generous limits (similar to TDA: 120 req/min)
- **Recommendation**: Implement conservative rate limiting (60 req/min)

### API Costs

- **FREE** ✅
- No monthly fees
- No per-request charges

---

## 🚀 OAuth 2.0 Flow

### Step 1: Register Developer App

**Prerequisites**:
1. Schwab brokerage account (required)
2. Register at Schwab Developer Portal
3. Create application
4. Wait for manual approval (1-3 days)
5. Receive App Key (Client ID) + Client Secret

**Callback URI Requirements**:
- Must be HTTPS (except localhost for dev)
- Must match exactly (including path)
- Example: `https://tradingpathjournal.com/api/broker/schwab/callback`

### Step 2: Authorization URL

```
GET https://api.schwabapi.com/v1/oauth/authorize
  ?client_id={CLIENT_ID}
  &redirect_uri={CALLBACK_URI}
  &response_type=code
  &scope=api
```

**Parameters**:
- `client_id`: App Key from developer portal
- `redirect_uri`: Registered callback URI (must match exactly)
- `response_type`: Always `code`
- `scope`: Always `api` (single scope)

### Step 3: User Login & Consent

User is redirected to Schwab login page:
1. Enter Schwab credentials
2. Complete MFA (if enabled)
3. Grant app permissions
4. Schwab redirects to callback URI with `code` parameter

**Example callback**:
```
https://tradingpathjournal.com/api/broker/schwab/callback?code=ABC123XYZ
```

### Step 4: Exchange Code for Tokens

```http
POST https://api.schwabapi.com/v1/oauth/token
Authorization: Basic {base64(client_id:client_secret)}
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code={AUTHORIZATION_CODE}
&redirect_uri={CALLBACK_URI}
```

**Response**:
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "v1.abc123...",
  "expires_in": 1800,
  "token_type": "Bearer",
  "scope": "api"
}
```

**Notes**:
- `expires_in`: 1800 seconds (30 minutes)
- `refresh_token`: Valid for 7 days
- Authorization code expires quickly (use immediately)

### Step 5: Refresh Access Token

```http
POST https://api.schwabapi.com/v1/oauth/token
Authorization: Basic {base64(client_id:client_secret)}
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token={REFRESH_TOKEN}
```

**Response**: Same format as Step 4

**Important**: After 7 days, refresh token expires and user must re-authenticate (full OAuth flow).

---

## 📊 API Endpoints

### 1. Get Accounts

```http
GET https://api.schwabapi.com/trader/v1/accounts
Authorization: Bearer {ACCESS_TOKEN}
```

**Response**:
```json
[
  {
    "securitiesAccount": {
      "accountNumber": "12345678",
      "accountHash": "abc123hash",
      "type": "MARGIN",
      "roundTrips": 0,
      "isDayTrader": false,
      "isClosingOnlyRestricted": false,
      "currentBalances": {
        "liquidationValue": 50000.00,
        "cashBalance": 10000.00,
        "equity": 50000.00
      }
    }
  }
]
```

**Key Fields**:
- `accountNumber`: Raw account number (8 digits)
- `accountHash`: Hashed account ID (use for API calls)
- `currentBalances.equity`: Account balance

### 2. Get Account Numbers (Hashes)

```http
GET https://api.schwabapi.com/trader/v1/accounts/accountNumbers
Authorization: Bearer {ACCESS_TOKEN}
```

**Response**:
```json
[
  {
    "accountNumber": "12345678",
    "hashValue": "abc123hash"
  }
]
```

**Note**: Use `hashValue` for subsequent API calls (not raw account number).

### 3. Get Transactions (Trade History)

```http
GET https://api.schwabapi.com/trader/v1/accounts/{accountHash}/transactions
  ?startDate={ISO8601_DATE}
  &endDate={ISO8601_DATE}
  &types={TRANSACTION_TYPES}
  &symbol={SYMBOL}
Authorization: Bearer {ACCESS_TOKEN}
```

**Parameters**:
- `accountHash`: From `/accounts/accountNumbers` endpoint
- `startDate`: ISO8601 format (YYYY-MM-DD) - **Max 60 days ago**
- `endDate`: ISO8601 format (YYYY-MM-DD)
- `types`: Optional filter (TRADE, RECEIVE_AND_DELIVER, DIVIDEND, etc.)
- `symbol`: Optional symbol filter

**Default Behavior**: If no dates specified, returns last 60 days.

**Response**:
```json
[
  {
    "activityId": 123456789,
    "time": "2026-01-15T14:30:00Z",
    "type": "TRADE",
    "status": "VALID",
    "netAmount": -1500.50,
    "activityType": "EXECUTION",
    "executionLegs": [
      {
        "legId": 1,
        "quantity": 10,
        "price": 150.05,
        "time": "2026-01-15T14:30:00Z"
      }
    ],
    "orderRemainingQuantity": 0,
    "instrument": {
      "symbol": "AAPL",
      "cusip": "037833100",
      "description": "Apple Inc.",
      "instrumentId": 123456,
      "netChange": 2.50
    },
    "positionEffect": "OPENING",
    "transferItems": [
      {
        "instrument": {
          "symbol": "AAPL",
          "cusip": "037833100"
        },
        "amount": 1500.50,
        "cost": 1500.50,
        "price": 150.05,
        "positionEffect": "OPENING"
      }
    ]
  }
]
```

**Key Fields**:
- `activityId`: Unique transaction ID
- `time`: Transaction timestamp (ISO8601)
- `type`: TRADE, DIVIDEND, etc.
- `netAmount`: Total cost (negative = debit, positive = credit)
- `executionLegs`: Order fill details
- `instrument.symbol`: Ticker symbol
- `positionEffect`: OPENING or CLOSING

### 4. Get Single Transaction

```http
GET https://api.schwabapi.com/trader/v1/accounts/{accountHash}/transactions/{transactionId}
Authorization: Bearer {ACCESS_TOKEN}
```

**Response**: Same format as single transaction from list endpoint.

---

## 🔄 Trade Reconstruction Logic

### Challenge

Schwab API returns **transactions** (individual orders), not **round-trip trades**. We need to reconstruct trades by matching opening and closing orders.

### Strategy

Similar to Alpaca provider:

1. **Fetch all transactions** (type=TRADE)
2. **Group by symbol**
3. **Sort by time** (oldest first)
4. **Track position** for each symbol
5. **Match opening/closing orders**
6. **Calculate PnL**

### Position Tracking

```typescript
let position = 0;

for (const transaction of transactions) {
  const qty = transaction.executionLegs[0].quantity;
  const side = transaction.netAmount < 0 ? 'BUY' : 'SELL';
  const qtyChange = side === 'BUY' ? qty : -qty;
  
  const previousPosition = position;
  position += qtyChange;
  
  const isOpening = 
    (previousPosition >= 0 && qtyChange > 0) ||
    (previousPosition <= 0 && qtyChange < 0);
  
  if (isOpening) {
    // Store as entry order
  } else {
    // Match with entry order(s) and create trade
  }
}
```

### PnL Calculation

```typescript
const direction = entryOrder.netAmount < 0 ? 'LONG' : 'SHORT';
const entryPrice = Math.abs(entryOrder.netAmount) / entryOrder.quantity;
const exitPrice = Math.abs(exitOrder.netAmount) / exitOrder.quantity;

const priceDiff = direction === 'LONG'
  ? exitPrice - entryPrice
  : entryPrice - exitPrice;

const realizedPnl = priceDiff * quantity;
```

---

## ⚠️ Limitations & Challenges

### 1. 60-Day History Limit

**Problem**: API only returns last 60 days by default.

**Solutions**:
- **Initial sync**: Prompt user to export CSV for older trades
- **Ongoing sync**: API is sufficient (daily/weekly sync)
- **Historical data**: Offer CSV import as fallback

### 2. 7-Day Refresh Token Expiry

**Problem**: Refresh token expires after 7 days (hard limit).

**Solutions**:
- **Weekly re-auth prompt**: Email user before expiry
- **Auto-refresh**: Attempt refresh every 6 days
- **Graceful degradation**: Show "Re-connect Schwab" button

### 3. Manual App Approval

**Problem**: Schwab manually reviews apps (1-3 days).

**Solutions**:
- **Pre-register**: Submit app early (before Feb 3)
- **Status tracking**: Monitor approval status
- **Fallback**: CSV import available during approval

### 4. Callback URI Must Match Exactly

**Problem**: Even small differences cause OAuth errors.

**Solutions**:
- **Strict validation**: Verify URI in code matches portal
- **Environment variables**: Store callback URI in env vars
- **Testing**: Test with exact production URL

### 5. No Sandbox Environment

**Problem**: Must test with real Schwab account.

**Solutions**:
- **Paper trading account**: Use Schwab paper trading (if available)
- **Small test trades**: Use minimal positions for testing
- **Extensive logging**: Log all API calls for debugging

---

## 🧪 Testing Strategy

### Phase 1: OAuth Flow Testing

1. **Register dev app** with Schwab (DONE before Feb 3)
2. **Test authorization URL** (redirect to Schwab login)
3. **Test callback** (receive authorization code)
4. **Test token exchange** (get access + refresh tokens)
5. **Test token refresh** (refresh access token)

### Phase 2: API Endpoint Testing

1. **Test `/accounts`** (list accounts)
2. **Test `/accounts/accountNumbers`** (get account hashes)
3. **Test `/transactions`** (fetch trade history)
4. **Test date range filtering** (60-day limit)
5. **Test symbol filtering**

### Phase 3: Trade Reconstruction Testing

1. **Test with simple trades** (single buy + sell)
2. **Test with multiple entries** (scale in/out)
3. **Test with different symbols** (stocks, options, futures)
4. **Test with partial fills**
5. **Validate PnL calculations**

### Phase 4: Integration Testing

1. **Test full sync flow** (OAuth → accounts → trades → database)
2. **Test error handling** (expired tokens, rate limits)
3. **Test duplicate detection** (re-sync same trades)
4. **Test with multiple accounts**

---

## 📦 Implementation Plan

### Task PRÉ-5.1: OAuth 2.0 Implementation (12h)

**Assignees**: Dev 24, Dev 25

**Subtasks**:
1. Create Schwab OAuth service (`src/lib/schwab-oauth.ts`)
2. Implement authorization URL generation
3. Implement callback handler
4. Implement token exchange
5. Implement token refresh
6. Add token storage (database)
7. Add error handling
8. Write unit tests

**Deliverables**:
- OAuth service with full flow
- Database schema for tokens
- Unit tests (8+ tests)

### Task PRÉ-5.2: API Integration (10h)

**Assignees**: Dev 26 (ME!), Dev 27

**Subtasks**:
1. Create Schwab provider (`src/services/broker/schwab-provider.ts`)
2. Implement `authenticate()` method
3. Implement `getAccounts()` method
4. Implement `getTrades()` method
5. Implement trade reconstruction logic
6. Add rate limiting
7. Add error handling
8. Write unit tests

**Deliverables**:
- Schwab provider implementing `BrokerProvider` interface
- Trade reconstruction algorithm
- Unit tests (10+ tests)

### Task PRÉ-5.3: Testing & Documentation (6h)

**Assignees**: Dev 28, Dev 29

**Subtasks**:
1. End-to-end testing with real Schwab account
2. Test OAuth flow
3. Test trade sync
4. Test error scenarios
5. Document setup guide
6. Document troubleshooting

**Deliverables**:
- E2E test suite
- Setup documentation
- Troubleshooting guide

---

## 🔐 Security Considerations

### 1. Client Secret Storage

**Risk**: Client secret must be kept secure.

**Mitigation**:
- Store in environment variables (never in code)
- Use secrets manager in production (AWS Secrets Manager, etc.)
- Rotate secrets periodically

### 2. Token Storage

**Risk**: Access/refresh tokens grant account access.

**Mitigation**:
- Encrypt tokens in database
- Use secure session storage
- Implement token rotation
- Clear tokens on logout

### 3. Callback URI Validation

**Risk**: OAuth redirect attacks.

**Mitigation**:
- Validate callback URI matches registered URI
- Use HTTPS only (except localhost dev)
- Implement CSRF protection (state parameter)

### 4. Rate Limiting

**Risk**: API abuse or accidental overuse.

**Mitigation**:
- Implement client-side rate limiting (60 req/min)
- Add exponential backoff
- Cache responses (5 min TTL)

---

## 📊 Success Metrics

### Integration Success

- [ ] OAuth flow works end-to-end
- [ ] Accounts fetched successfully
- [ ] Trades synced correctly
- [ ] PnL calculations match Schwab
- [ ] 95%+ sync success rate
- [ ] < 30s average sync time

### User Experience

- [ ] Clear OAuth instructions
- [ ] Helpful error messages
- [ ] Re-auth prompts before expiry
- [ ] CSV fallback for older trades

---

## 📚 References

### Official Documentation

- **Schwab Developer Portal**: https://developer.schwab.com
- **OAuth 2.0 Spec**: https://oauth.net/2/
- **schwab-py Library**: https://schwab-py.readthedocs.io/

### Community Resources

- **Reddit r/Schwab**: OAuth discussions and troubleshooting
- **GitHub schwab-api**: TypeScript wrapper library
- **GitHub schwab-py**: Python wrapper library

### Related Documents

- `docs/brokers/TOP-10-PRIORITY-BROKERS-2026.md` - Strategic analysis
- `src/services/broker/types.ts` - BrokerProvider interface
- `src/services/broker/alpaca-provider.ts` - Reference implementation
- `src/services/broker/oanda-provider.ts` - Reference implementation

---

## 🚦 Next Steps

### Immediate Actions (Before Feb 3)

1. **Register Schwab developer app** (Dev 26 + PM)
   - Create developer account
   - Submit app for approval
   - Wait 1-3 days for approval
   - Receive App Key + Client Secret

2. **Set up development environment**
   - Add Schwab credentials to `.env`
   - Configure callback URI (localhost for dev)
   - Test OAuth flow with personal account

3. **Research edge cases**
   - Options transactions format
   - Futures transactions format
   - Dividend/interest transactions
   - Corporate actions (splits, mergers)

### Implementation (Feb 3-5)

1. **Day 1 (Feb 3)**: OAuth implementation (PRÉ-5.1)
2. **Day 2 (Feb 4)**: API integration (PRÉ-5.2)
3. **Day 3 (Feb 5)**: Testing & documentation (PRÉ-5.3)

---

## ✅ Approval Checklist

### PM Approval Required

- [ ] **Budget approved**: $0/month API costs ✅
- [ ] **Dev time approved**: 4-5 days (Dev 24-29)
- [ ] **App registration approved**: Schwab developer account
- [ ] **Callback URI approved**: Production URL
- [ ] **Priority confirmed**: POST-LAUNCH (Feb 3-5)

### Technical Lead Approval

- [ ] **Architecture reviewed**: OAuth flow + provider pattern
- [ ] **Security reviewed**: Token storage + encryption
- [ ] **Testing plan approved**: E2E + unit tests
- [ ] **Documentation plan approved**: Setup + troubleshooting

---

**Document Status**: ✅ Research Complete  
**Next Action**: Register Schwab developer app (before Feb 3)  
**Assignee**: Dev 26 (Charles Schwab API Integration)  
**Timeline**: Feb 3-5, 2026 (3 days)

---

**Created By**: Dev 26  
**Date**: 2026-01-17  
**Last Updated**: 2026-01-17  
**Version**: 1.0
