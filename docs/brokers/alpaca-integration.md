# 🦙 Alpaca Integration Guide

## Overview

Alpaca is a commission-free stock and crypto trading platform with a powerful REST API. This integration allows users to automatically sync their trades from Alpaca to the Trading Journal.

**Status**: ✅ Implemented  
**Broker Type**: `ALPACA`  
**API Version**: v2  
**Supported Environments**: Paper Trading & Live Trading

---

## Features

- ✅ **Authentication**: API Key + Secret authentication
- ✅ **Account Access**: Fetch account details and balance
- ✅ **Trade History**: Automatic trade reconstruction from orders
- ✅ **Paper Trading**: Full support for paper trading environment
- ✅ **Rate Limiting**: Built-in rate limit handling (200 req/min)
- ✅ **Error Handling**: Comprehensive error handling and retry logic

---

## Getting Started

### 1. Get API Credentials

#### Paper Trading (Recommended for Testing)
1. Sign up at [Alpaca](https://alpaca.markets)
2. Go to [Paper Trading Dashboard](https://app.alpaca.markets/paper/dashboard/overview)
3. Navigate to "API Keys" section
4. Generate new API key pair
5. Save both **API Key ID** and **Secret Key**

#### Live Trading
1. Complete KYC verification (1-2 business days)
2. Fund your account
3. Go to [Live Trading Dashboard](https://app.alpaca.markets/brokerage/dashboard/overview)
4. Navigate to "API Keys" section
5. Generate new API key pair

⚠️ **Important**: Keep your Secret Key secure. Never commit it to version control.

---

## Configuration

### Environment Variables

```bash
# For testing/development
ALPACA_API_KEY=your_paper_api_key
ALPACA_API_SECRET=your_paper_api_secret
```

### In the App

1. Go to **Settings** → **Broker Connections**
2. Click **Connect Broker**
3. Select **Alpaca**
4. Enter your credentials:
   - **API Key**: Your API Key ID
   - **API Secret**: Your Secret Key
   - **Environment**: Choose `paper` or `live`
5. Click **Connect**

---

## How It Works

### Trade Reconstruction

Alpaca's API returns **orders**, not complete **trades**. Our integration automatically reconstructs trades by:

1. Fetching all closed orders
2. Grouping orders by symbol
3. Tracking position changes (buy/sell)
4. Matching entry and exit orders
5. Calculating PnL

**Example**:
```
Order 1: Buy 100 AAPL @ $150  → Position: +100
Order 2: Sell 100 AAPL @ $155 → Position: 0
→ Trade: LONG AAPL, Entry $150, Exit $155, PnL = $500
```

### Supported Trade Types

- ✅ **Long Trades**: Buy → Sell
- ✅ **Short Trades**: Sell → Buy
- ✅ **Multiple Entries**: Weighted average entry price
- ✅ **Partial Exits**: Handled automatically
- ✅ **Same-Day Trades**: Multiple trades per day
- ✅ **Multi-Day Trades**: Overnight positions

### Data Mapping

| Alpaca Field | Our Field | Notes |
|--------------|-----------|-------|
| `id` | `brokerTradeId` | Composite: `entry-id-exit-id` |
| `symbol` | `symbol` | Direct mapping |
| `side` | `direction` | `buy` → `LONG`, `sell` → `SHORT` |
| `filled_at` | `openedAt` / `closedAt` | Based on order type |
| `filled_avg_price` | `entryPrice` / `exitPrice` | Based on order type |
| `filled_qty` | `quantity` | Direct mapping |
| `commission` | `commission` | Always $0 for Alpaca |

---

## Rate Limits

**Alpaca Rate Limits**:
- 200 requests per minute
- 5000 requests per hour (for some endpoints)

**Our Handling**:
- Automatic rate limit detection via headers
- Warning when < 10 requests remaining
- Exponential backoff on 429 errors
- Retry logic with configurable attempts

**Headers Monitored**:
- `X-RateLimit-Limit`: Total limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

---

## Testing

### Unit Tests

```bash
npm test src/services/broker/__tests__/alpaca-provider.test.ts
```

### Integration Tests

```bash
# Set your paper trading credentials
export ALPACA_API_KEY=your_paper_key
export ALPACA_API_SECRET=your_paper_secret

# Run integration test
tsx scripts/test-alpaca-integration.ts
```

**What it tests**:
1. Authentication with paper trading API
2. Account information retrieval
3. Trade history fetching (last 30 days)
4. Trade reconstruction logic
5. Error handling

---

## Troubleshooting

### Authentication Failed

**Error**: `401 Unauthorized`

**Solutions**:
- Verify API Key and Secret are correct
- Check you're using the right environment (paper vs live)
- Regenerate API keys if needed
- Ensure account is active

### Rate Limit Exceeded

**Error**: `429 Rate Limit Exceeded`

**Solutions**:
- Wait for rate limit to reset (shown in error message)
- Reduce sync frequency
- Use manual sync instead of scheduled sync
- Contact support if limits are too restrictive

### No Trades Found

**Possible Causes**:
1. No trades executed in the time period
2. Using paper trading with no test trades
3. Wrong account selected
4. Date filter too restrictive

**Solutions**:
- Place some paper trades for testing
- Extend date range (remove `since` filter)
- Verify correct account is connected
- Check Alpaca dashboard for trade history

### Trade Reconstruction Issues

**Symptoms**:
- Missing trades
- Incorrect PnL
- Duplicate trades

**Solutions**:
- Check for partial fills (multiple orders per trade)
- Verify all orders are closed/filled
- Look for multi-leg orders (options spreads)
- Contact support with specific trade IDs

---

## API Documentation

**Official Docs**: https://alpaca.markets/docs/

**Key Endpoints Used**:
- `GET /v2/account` - Account information
- `GET /v2/orders` - Order history
- `GET /v2/positions` - Current positions (not used)
- `GET /v2/account/activities` - Trade fills (alternative)

**Base URLs**:
- Paper: `https://paper-api.alpaca.markets`
- Live: `https://api.alpaca.markets`

---

## Limitations

### Current Limitations

1. **No Real-Time Sync**: Trades are synced on-demand or scheduled
2. **No Webhooks**: Must poll API for new trades
3. **90-Day History**: API limits historical data to ~90 days for some endpoints
4. **Order-Based**: Must reconstruct trades from orders
5. **No Options Support**: Options trades not yet supported

### Future Enhancements

- [ ] WebSocket support for real-time updates
- [ ] Options trade support
- [ ] Crypto trade support
- [ ] Advanced order types (brackets, OCO, etc.)
- [ ] Position tracking for open trades

---

## Security

### Credential Storage

- API Keys are encrypted using `BROKER_ENCRYPTION_KEY`
- Secrets never exposed to client-side code
- Stored in database with encryption at rest
- Access tokens contain both key and secret (encrypted)

### Best Practices

1. **Use Paper Trading**: Test thoroughly before connecting live account
2. **Read-Only Keys**: Use read-only API keys when possible
3. **Regular Rotation**: Rotate API keys periodically
4. **Monitor Access**: Check API access logs in Alpaca dashboard
5. **Revoke Unused Keys**: Delete old/unused API keys

---

## Support

### Getting Help

1. **Check Logs**: Look for error messages in sync logs
2. **Test Integration**: Run `scripts/test-alpaca-integration.ts`
3. **Check Alpaca Status**: https://status.alpaca.markets/
4. **Review API Docs**: https://alpaca.markets/docs/
5. **Contact Support**: support@alpaca.markets

### Common Questions

**Q: Can I use the same API keys for multiple apps?**  
A: Yes, but it's recommended to create separate keys for each integration.

**Q: Do I need a funded account?**  
A: No for paper trading. Yes for live trading (no minimum deposit).

**Q: Are there any fees?**  
A: No API fees. No trading commissions. Regulatory fees apply to live trading.

**Q: How often should I sync?**  
A: Manual sync after trading. Scheduled sync once per day is sufficient.

**Q: Can I sync historical trades?**  
A: Yes, but limited to ~90 days for some endpoints. Use manual CSV export for older trades.

---

## Developer Notes

### Implementation Details

**File**: `src/services/broker/alpaca-provider.ts`

**Key Methods**:
- `authenticate()`: Validates credentials and returns access token
- `getAccounts()`: Fetches account information
- `getTrades()`: Reconstructs trades from orders
- `reconstructTrades()`: Matches buy/sell pairs
- `createTradeFromOrders()`: Calculates PnL and metadata

**Access Token Format**:
```json
{
  "apiKey": "string",
  "apiSecret": "string",
  "environment": "paper" | "live"
}
```

The access token is a JSON string containing both API key and secret. This is necessary because Alpaca requires both for every API request (unlike OAuth-based brokers).

### Testing Strategy

1. **Unit Tests**: Mock all API responses
2. **Integration Tests**: Use paper trading API
3. **Edge Cases**: Partial fills, multi-leg orders, same-day trades
4. **Performance**: Test with 500+ orders

### Maintenance

- **API Changes**: Monitor Alpaca changelog
- **Rate Limits**: Adjust if Alpaca changes limits
- **Error Handling**: Update error codes as needed
- **Trade Logic**: Refine reconstruction algorithm based on user feedback

---

## Changelog

### 2026-01-17 - Initial Implementation
- ✅ Basic authentication
- ✅ Account information
- ✅ Trade history fetching
- ✅ Trade reconstruction logic
- ✅ Rate limit handling
- ✅ Error handling
- ✅ Unit tests
- ✅ Integration tests
- ✅ Documentation

---

**Last Updated**: 2026-01-17  
**Version**: 1.0.0  
**Status**: Production Ready
