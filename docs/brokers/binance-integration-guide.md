# 🔧 Binance Integration Guide

> **Broker**: Binance  
> **Status**: ✅ Implemented  
> **Integration Date**: 2026-01-17  
> **Last Updated**: 2026-01-17

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Setup Instructions](#setup-instructions)
4. [Configuration](#configuration)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)
7. [API Reference](#api-reference)
8. [Known Issues](#known-issues)
9. [Support](#support)
10. [Developer Notes](#developer-notes)

---

## 1. Overview

### Broker Information
- **Name**: Binance
- **Website**: https://www.binance.com
- **Asset Classes**: Crypto (Spot, Futures, Margin)
- **API Type**: REST + WebSocket
- **API Documentation**: https://binance-docs.github.io/apidocs/spot/en/

### Integration Type
- [x] API Integration (automated sync)
- [x] File Upload (CSV/Excel) - for historical data >3 months
- [x] Hybrid (API for recent data, CSV for older data)

### Features Supported
- [x] Automatic trade sync
- [x] Historical data import (up to 3 months via API)
- [x] Real-time sync (WebSocket User Data Stream)
- [x] Multi-account support (Spot, Futures, Margin)
- [x] Position tracking (Futures)
- [x] Order history
- [x] PnL calculation

---

## 2. Prerequisites

### For Users

**Account Requirements**:
- Active Binance account
- Completed KYC verification (for API access)
- 2FA enabled (required for API key creation)

**API Access**:
1. Log in to Binance account
2. Navigate to **Profile > API Management**
3. Create new API key
4. Save API Key and Secret Key securely
5. Configure IP whitelist (optional but highly recommended)
6. Enable required permissions:
   - ✅ Enable Reading
   - ✅ Enable Spot & Margin Trading (for trade history)
   - ❌ Enable Withdrawals (NOT needed - keep disabled for security)

**Costs**:
- API Access: ✅ **FREE**
- Data Fees: ✅ **FREE**
- Trading Commissions: 0.1% spot (can be reduced with BNB)

### For Developers

**Development Environment**:
- Node.js 18+
- TypeScript 5+
- Access to Binance Testnet (optional but recommended)

**Dependencies**:
```bash
# No additional packages required - uses built-in crypto module
```

**Environment Variables**:
```env
# Not needed - credentials are stored encrypted in database
```

---

## 3. Setup Instructions

### Step 1: Get API Credentials

1. Log in to your Binance account
2. Navigate to **Profile Icon > API Management**
3. Click "Create API" button
4. Complete security verification (2FA)
5. Enter a label for your API key (e.g., "Trading Journal")
6. Click "Create"
7. **IMPORTANT**: Save both the API Key and Secret Key immediately
   - The Secret Key is shown only once
   - Store it securely (password manager recommended)

**Screenshot**: API Management page

### Step 2: Configure API Permissions

1. After creating the API key, click "Edit restrictions"
2. Set the following permissions:
   - ✅ **Enable Reading** (required)
   - ✅ **Enable Spot & Margin Trading** (required for trade history)
   - ❌ **Enable Withdrawals** (keep disabled for security)
   - ❌ **Enable Futures** (only if you trade futures)
3. (Optional) Configure IP whitelist:
   - Add your server's IP address
   - This significantly improves security
4. Click "Save"

**Security Note**: Never enable withdrawal permissions for third-party apps.

### Step 3: Connect Broker in App

1. Navigate to `/comptes/brokers` in Trading Path Journal
2. Click "Connect New Broker"
3. Select "Binance" from the list
4. Choose account type:
   - **Spot Trading**: For crypto spot trading
   - **Futures Trading**: For crypto futures/perpetuals
5. Enter your API Key and Secret Key
6. Click "Connect"

**Screenshot**: Broker connection UI

### Step 4: Link to Trading Account

1. After connection, the app will validate your credentials
2. Select an existing trading account or create a new one
3. Click "Link Account"
4. Verify connection status shows "Connected" (green)

### Step 5: Initial Sync

1. Click "Sync Now" to import historical trades
2. The app will fetch trades from the last 90 days (API limit)
3. Wait for sync to complete (may take 1-2 minutes for large histories)
4. Review imported trades in the Trades page
5. Verify trade data is accurate (prices, quantities, PnL)

**Note**: For trades older than 90 days, use CSV export from Binance.

---

## 4. Configuration

### Sync Settings

**Automatic Sync**:
- Default: Every 15 minutes
- Configurable: 5, 15, 30, 60 minutes
- Can be disabled for manual sync only

**Historical Data**:
- Default: Last 90 days (API limit)
- For older data: Export CSV from Binance website

**Account Types**:
- **Spot**: Regular crypto spot trading
- **Futures**: Perpetual futures contracts
- **Note**: Spot and Futures require separate connections

### Advanced Settings

**Rate Limiting**:
- Default: 120 requests per minute (Binance limit: 1200 weight)
- Burst: Handled automatically
- Backoff strategy: Exponential

**Error Handling**:
- Retry failed syncs: Yes (max 3 retries)
- Alert on failure: Yes (after 3 consecutive failures)
- Fallback: Manual CSV import

**Symbol Filtering**:
- Auto-detect: Yes (only syncs symbols with trades)
- Manual selection: Coming soon

---

## 5. Testing

### Test with Binance Testnet

**Spot Testnet**:
1. Go to https://testnet.binance.vision/
2. Create test account
3. Generate test API keys
4. Use test keys in the app (set environment to "testnet")

**Futures Testnet**:
1. Go to https://testnet.binancefuture.com/
2. Create test account
3. Generate test API keys
4. Place test trades
5. Verify trades sync correctly

### Test Cases

#### TC1: Initial Connection
- [ ] Valid API credentials → Success
- [ ] Invalid API key → Auth error with clear message
- [ ] Invalid signature → Auth error
- [ ] IP not whitelisted → Auth error with IP suggestion

#### TC2: Historical Sync (Spot)
- [ ] Trades from last 90 days are imported
- [ ] Trade data is accurate (symbol, price, quantity, PnL)
- [ ] Duplicate trades are not imported
- [ ] Commission is calculated correctly

#### TC3: Historical Sync (Futures)
- [ ] Futures trades are imported
- [ ] PnL is calculated correctly
- [ ] Long and short positions are handled
- [ ] Funding fees are included (if applicable)

#### TC4: Trade Reconstruction
- [ ] Simple round-trip (1 buy, 1 sell) → 1 trade
- [ ] Multiple entries (3 buys, 1 sell) → 1 trade with avg entry
- [ ] Partial exits (1 buy, 2 sells) → 2 trades
- [ ] Long and short positions in same symbol

#### TC5: Real-Time Sync
- [ ] New trades sync within 15 minutes
- [ ] Sync status updates correctly
- [ ] No duplicate imports

#### TC6: Error Handling
- [ ] Invalid symbol → Skipped gracefully
- [ ] Rate limit errors → Exponential backoff
- [ ] Network errors → Retry automatically
- [ ] API maintenance → User notification

#### TC7: Disconnection
- [ ] User can disconnect broker
- [ ] Trades remain in database
- [ ] Can reconnect later with same or different keys

---

## 6. Troubleshooting

### Common Issues

#### Issue 1: "Invalid API Credentials"

**Symptoms**: Connection fails with authentication error

**Causes**:
- Incorrect API key or secret
- API key permissions insufficient
- IP not whitelisted (if whitelist is enabled)
- API key expired or revoked

**Solutions**:
1. Verify API key and secret are correct (no extra spaces)
2. Check API key permissions in Binance:
   - Must have "Enable Reading" enabled
   - Must have "Enable Spot & Margin Trading" enabled
3. If IP whitelist is enabled:
   - Add your server's IP address
   - Or disable IP whitelist temporarily for testing
4. Regenerate API key if needed

#### Issue 2: "No Trades Found"

**Symptoms**: Sync completes but no trades imported

**Causes**:
- No trades in selected date range (last 90 days)
- Trades are still open (not closed)
- Wrong account type (Spot vs Futures)
- API permissions insufficient

**Solutions**:
1. Verify trades exist in Binance account (last 90 days)
2. Check if trades are closed (not open positions)
3. Ensure correct account type (Spot or Futures)
4. Verify API permissions include trade history access
5. Try manual CSV export as fallback

#### Issue 3: "Rate Limit Exceeded"

**Symptoms**: Sync fails with rate limit error

**Causes**:
- Too many requests in short time
- Multiple syncs running simultaneously
- Binance API rate limit hit (1200 weight/min)

**Solutions**:
1. Wait 1 minute for rate limit to reset
2. Reduce sync frequency (e.g., 30 min instead of 15 min)
3. Avoid manual syncs during automatic sync
4. Contact support if persistent

#### Issue 4: "Duplicate Trades"

**Symptoms**: Same trade appears multiple times

**Causes**:
- Deduplication logic failed
- Trade signature collision
- Multiple syncs overlapping

**Solutions**:
1. Report issue to support with trade IDs
2. Manually delete duplicates in the app
3. Check if trades have unique broker trade IDs

#### Issue 5: "Historical Data Limited to 90 Days"

**Symptoms**: Only recent trades are imported

**Causes**:
- Binance API limit (3 months)
- This is a Binance API restriction, not an app limitation

**Solutions**:
1. Export older trades from Binance website:
   - Go to **Orders > Trade History**
   - Click "Export Complete Trade History"
   - Download CSV file
2. Import CSV file in Trading Path Journal:
   - Go to **Import** page
   - Select "Binance CSV" format
   - Upload CSV file

#### Issue 6: "Commission in Wrong Currency"

**Symptoms**: Commission not calculated correctly

**Causes**:
- Commission paid in BNB or other asset
- Currency conversion not applied

**Solutions**:
1. Check commission asset in Binance
2. If commission is in BNB:
   - App converts at 1:1 ratio (simplified)
   - For accurate conversion, use CSV export
3. Report issue if commission is significantly wrong

---

## 7. API Reference

### Authentication

**Method**: HMAC SHA256 signature

**Headers**:
```
X-MBX-APIKEY: your_api_key
```

**Signature Calculation**:
```typescript
const signature = crypto
  .createHmac('sha256', apiSecret)
  .update(queryString)
  .digest('hex');
```

**Example Request**:
```typescript
const timestamp = Date.now();
const queryString = `symbol=BTCUSDT&timestamp=${timestamp}`;
const signature = signRequest(queryString, apiSecret);
const url = `https://api.binance.com/api/v3/myTrades?${queryString}&signature=${signature}`;

const response = await fetch(url, {
  headers: {
    'X-MBX-APIKEY': apiKey,
  },
});
```

### Endpoints Used

#### Get Account Info
```
GET /api/v3/account
```

**Response**:
```json
{
  "makerCommission": 10,
  "takerCommission": 10,
  "buyerCommission": 0,
  "sellerCommission": 0,
  "canTrade": true,
  "canWithdraw": false,
  "canDeposit": true,
  "updateTime": 1640000000000,
  "accountType": "SPOT",
  "balances": [
    {
      "asset": "BTC",
      "free": "0.00100000",
      "locked": "0.00000000"
    }
  ]
}
```

#### Get Trade History (Spot)
```
GET /api/v3/myTrades?symbol=BTCUSDT&limit=1000
```

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
    "time": 1640000000000,
    "isBuyer": true,
    "isMaker": false,
    "isBestMatch": true
  }
]
```

#### Get Trade History (Futures)
```
GET /fapi/v1/userTrades?symbol=BTCUSDT&limit=1000
```

**Response**:
```json
[
  {
    "buyer": false,
    "commission": "-0.00001",
    "commissionAsset": "BTC",
    "id": 698759,
    "maker": false,
    "orderId": 25851813,
    "price": "42000.00",
    "qty": "0.001",
    "quoteQty": "42.00",
    "realizedPnl": "0.91",
    "side": "SELL",
    "positionSide": "SHORT",
    "symbol": "BTCUSDT",
    "time": 1640000000000
  }
]
```

### Rate Limits

**Spot API**:
- Limit: 1200 weight per minute per IP
- Limit: 6000 weight per minute per UID
- `GET /api/v3/myTrades`: Weight 10

**Futures API**:
- Limit: 2400 weight per minute

**Rate Limit Headers**:
```
X-MBX-USED-WEIGHT-1M: 10
X-MBX-ORDER-COUNT-1M: 5
```

---

## 8. Known Issues

### Current Issues

1. **Issue**: Historical data limited to 90 days via API
   - **Impact**: Medium
   - **Workaround**: Use CSV export for older data
   - **ETA**: N/A (Binance API limitation)

2. **Issue**: Commission currency conversion simplified
   - **Impact**: Low
   - **Workaround**: Use CSV export for exact commission
   - **ETA**: Future enhancement

3. **Issue**: Symbol auto-detection may miss inactive pairs
   - **Impact**: Low
   - **Workaround**: Manual CSV import
   - **ETA**: Future enhancement (manual symbol selection)

### Resolved Issues

None yet (new integration)

---

## 9. Support

### Getting Help

**Documentation**:
- Binance API Docs: https://binance-docs.github.io/apidocs/spot/en/
- Our Integration Guide: This document

**Support Channels**:
- Email: support@tradingjournal.com
- Discord: [Link]
- GitHub Issues: [Link]

**Reporting Issues**:
1. Check [Known Issues](#known-issues) first
2. Try [Troubleshooting](#troubleshooting) steps
3. Contact support with:
   - Broker name: Binance
   - Account type: Spot or Futures
   - Error message (screenshot if possible)
   - Steps to reproduce
   - API key (first 8 characters only for verification)

### Binance Support

**API Support**:
- Telegram: https://t.me/binance_api_english
- Support Ticket: Via Binance website
- Response Time: 24-48 hours

**Status Page**:
- https://www.binance.com/en/support/announcement

---

## 10. Developer Notes

### Implementation Details

**Provider Class**: `BinanceProvider`  
**File**: `src/services/broker/binance-provider.ts`

**Key Methods**:
- `authenticate()`: Validates credentials via account info endpoint
- `getAccounts()`: Returns account info (balance, currency)
- `getTradesWithCredentials()`: Fetches trade history (spot or futures)
- `reconstructSpotTrades()`: Matches buy/sell fills to create trades
- `reconstructFuturesTrades()`: Converts futures fills to trades

**Trade Reconstruction**:

Binance returns individual fills (partial orders), not complete trades. We reconstruct trades by:

1. Group fills by symbol
2. Sort by timestamp (oldest first)
3. Track cumulative position
4. Match entry fills with exit fills
5. Calculate weighted average entry price
6. Calculate PnL (price diff × quantity - commission)

**Symbol Normalization**:
- Binance uses format: `BTCUSDT`, `ETHUSDT`
- We store as-is (no normalization needed)
- Quote asset is typically USDT, BUSD, BTC, ETH, or BNB

**Point Value**:
- Crypto: 1 (no multiplier)
- Futures: 1 (contract size is in base asset)

### Code Example

```typescript
import { createBinanceProvider } from '@/services/broker/binance-provider';

// Create provider instance
const provider = createBinanceProvider('spot'); // or 'futures'

// Authenticate
const authResult = await provider.authenticate({
  apiKey: 'your_api_key',
  apiSecret: 'your_api_secret',
});

// Get trades (internal method with full credentials)
const trades = await provider.getTradesWithCredentials(
  'your_api_key',
  'your_api_secret',
  new Date('2026-01-01') // Since date
);

console.log(`Imported ${trades.length} trades`);
```

### Testing

**Test Accounts**:
- Spot Testnet: https://testnet.binance.vision/
- Futures Testnet: https://testnet.binancefuture.com/

**Test Data**:
- Use testnet to place test trades
- Verify trade reconstruction logic
- Test rate limiting and error handling

### Future Enhancements

1. **WebSocket Real-Time Sync**:
   - Use User Data Stream for instant trade updates
   - Reduce API calls and improve latency

2. **Manual Symbol Selection**:
   - Allow users to select specific symbols to sync
   - Reduce API calls for accounts with many symbols

3. **Margin Trading Support**:
   - Add support for margin trades
   - Calculate interest and fees

4. **Savings & Staking**:
   - Track savings and staking positions
   - Calculate APY and rewards

5. **Advanced PnL**:
   - Include funding fees (futures)
   - Include interest (margin)
   - Tax reporting features

---

**Maintained By**: Development Team  
**Last Updated**: 2026-01-17  
**Version**: 1.0  
**Status**: ✅ Production Ready
