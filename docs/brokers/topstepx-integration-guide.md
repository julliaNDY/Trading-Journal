# 🏆 TopstepX Integration Guide

> **Integration Type**: API (ProjectX API)  
> **Status**: ✅ Implemented  
> **Priority**: Tier 1A (#5) - Strategic Priority  
> **Last Updated**: 2026-01-17

---

## 📋 Overview

TopstepX is the **first prop firm with native API access**, making it a strategic integration for our trading journal. This guide covers how to connect TopstepX accounts and sync trades automatically.

**Key Features**:
- ✅ Automatic trade sync via API
- ✅ Real-time account data
- ✅ Complete trade history
- ✅ Futures trading support (NQ, ES, YM, RTY, CL, GC, etc.)
- ✅ Evaluation & funded accounts supported

---

## 🚀 Quick Start

### 1. Get TopstepX API Token

1. Log in to your TopstepX account: https://www.topsteptrader.com/topstepx/
2. Navigate to **Settings** > **API Access**
3. Click **Generate API Token**
4. Copy the token (shown once only)
5. Store it securely

**Important**: 
- The token is shown only once. If lost, you must regenerate it.
- Regenerating invalidates the previous token.
- No VPN: TopstepX blocks VPN connections.

### 2. Connect in Trading Journal

1. Go to **Settings** > **Broker Connections**
2. Click **Connect Broker**
3. Select **TopstepX**
4. Enter your API token
5. Click **Connect**

The system will:
- Validate your credentials
- Fetch your account information
- Start syncing trades automatically

---

## 🔧 Configuration

### API Token

TopstepX uses a single API token for authentication. No API secret is required.

**Format**:
```
API Token: TS-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
```

### Account Types Supported

- ✅ **Evaluation Accounts**: Full API access
- ✅ **Funded Accounts**: Full API access
- ❌ **Free Accounts**: No API access (must purchase evaluation)

### Sync Settings

**Default Sync Frequency**: Every 15 minutes  
**Historical Data**: Up to 365 days  
**Rate Limit**: 30 requests per minute (conservative)

---

## 📊 Data Synced

### Trade Data

TopstepX provides complete round-trip trades (no reconstruction needed):

| Field | Description |
|-------|-------------|
| Trade ID | Unique identifier from TopstepX |
| Symbol | Futures contract (NQ, ES, etc.) |
| Direction | LONG or SHORT |
| Entry Time | When position was opened (UTC) |
| Exit Time | When position was closed (UTC) |
| Entry Price | Average entry price |
| Exit Price | Average exit price |
| Quantity | Number of contracts |
| Realized PnL | Profit/loss in USD |
| Commission | Trading commissions |
| Fees | Exchange fees |

### Account Data

- Account ID
- Account type (evaluation/funded)
- Balance
- Equity
- Buying power
- Account status

---

## 🔄 Sync Process

### Automatic Sync

1. **Initial Sync**: Fetches all trades from the last 90 days
2. **Incremental Sync**: Fetches only new trades every 15 minutes
3. **Deduplication**: Prevents duplicate trades using unique trade IDs

### Manual Sync

You can trigger a manual sync anytime:
1. Go to **Settings** > **Broker Connections**
2. Find your TopstepX connection
3. Click **Sync Now**

---

## ⚠️ Important Notes

### API Limitations

1. **No Sandbox**: TopstepX has no test/demo API environment
2. **New API**: Launched 2024-2025, may have occasional issues
3. **Rate Limits**: Unknown exact limits, using conservative approach
4. **No VPN**: TopstepX blocks VPN connections

### Account Requirements

- Must have active TopstepX evaluation or funded account
- Free accounts do not have API access
- Minimum account cost: $150 (evaluation)

### Supported Instruments

TopstepX supports futures contracts:
- **Micro E-mini**: MNQ, MES, MYM, M2K
- **E-mini**: NQ, ES, YM, RTY
- **Commodities**: CL, GC, NG, ZC, ZS
- **Currencies**: 6E, 6J, 6B
- **Bonds**: ZN, ZB, ZF

---

## 🐛 Troubleshooting

### Connection Failed

**Error**: "Failed to authenticate with TopstepX"

**Solutions**:
1. Verify API token is correct (copy-paste carefully)
2. Check if token was regenerated (old token becomes invalid)
3. Ensure account is active (not suspended)
4. Disable VPN if enabled

### No Trades Syncing

**Error**: "No trades found" or trades not appearing

**Solutions**:
1. Verify you have closed trades in TopstepX
2. Check date range (default: last 90 days)
3. Trigger manual sync
4. Check sync logs for errors

### Rate Limit Exceeded

**Error**: "TopstepX rate limit exceeded"

**Solutions**:
1. Wait 1 minute and try again
2. Reduce sync frequency in settings
3. Contact support if persistent

### API Token Expired

**Error**: "API token invalid or expired"

**Solutions**:
1. Regenerate API token in TopstepX dashboard
2. Update token in Trading Journal settings
3. Reconnect broker connection

---

## 📈 Best Practices

### 1. Secure Token Storage

- Never share your API token
- Don't commit tokens to version control
- Regenerate if compromised

### 2. Sync Frequency

- Default (15 min) is recommended for most users
- Increase frequency for active traders
- Decrease frequency to reduce API usage

### 3. Historical Data

- Initial sync fetches last 90 days
- For older data, use CSV import
- Manual sync available anytime

### 4. Monitoring

- Check sync status regularly
- Review sync logs for errors
- Contact support if issues persist

---

## 🔐 Security

### Data Encryption

- API tokens encrypted at rest
- TLS/HTTPS for all API communication
- No plain-text storage

### Access Control

- Tokens tied to your account only
- Revoke access by regenerating token
- Automatic disconnect on errors

---

## 📞 Support

### TopstepX Support

- Help Center: https://help.topstep.com/
- Email: support@topstep.com
- Community: https://www.topsteptrader.com/community/

### Trading Journal Support

- Check sync logs in Settings
- Review error messages
- Contact our support team

---

## 🚀 Next Steps

After connecting TopstepX:

1. ✅ Verify trades are syncing correctly
2. ✅ Review imported trades in Journal
3. ✅ Add tags and notes to trades
4. ✅ Analyze performance in Dashboard
5. ✅ Set up automatic sync schedule

---

## 📚 Additional Resources

- **API Documentation**: https://help.topstep.com/en/articles/11187768-topstepx-api-access
- **TopstepX Platform**: https://www.topsteptrader.com/topstepx/
- **API Research**: `docs/brokers/api-research/topstepx.md`
- **Provider Code**: `src/services/broker/topstepx-provider.ts`

---

**Last Updated**: 2026-01-17  
**Integration Status**: ✅ Production Ready  
**Strategic Priority**: 🔥 Critical (First prop firm with API)
