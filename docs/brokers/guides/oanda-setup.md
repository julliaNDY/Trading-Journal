# 🌐 OANDA Setup Guide

Complete guide to connecting your OANDA account to Trading Path Journal.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Getting Your API Key](#getting-your-api-key)
4. [Connecting to Trading Path Journal](#connecting-to-trading-path-journal)
5. [Testing Your Connection](#testing-your-connection)
6. [Troubleshooting](#troubleshooting)
7. [FAQ](#faq)

---

## Overview

OANDA is a leading forex and CFD broker with excellent API support. This guide will help you:
- Create an OANDA account (practice or live)
- Generate API credentials
- Connect your account to Trading Path Journal
- Sync your trades automatically

**Time Required**: 5-10 minutes  
**Difficulty**: Easy  
**Cost**: Free (practice account) or funded account (live)

---

## Prerequisites

### For Practice Trading (Recommended for Testing)
- Email address
- No funding required
- Instant setup

### For Live Trading
- Email address
- Government-issued ID (for KYC)
- Minimum deposit: None (OANDA has no minimum)
- Approval time: 1-2 business days

---

## Getting Your API Key

### Step 1: Create an OANDA Account

**Practice Account (Recommended for Testing)**:
1. Go to https://www.oanda.com/demo-account/
2. Fill out the registration form
3. Verify your email
4. Your practice account is created instantly with $100,000 virtual funds

**Live Account**:
1. Go to https://www.oanda.com/register/
2. Complete the registration form
3. Submit identity verification documents
4. Wait for approval (1-2 business days)
5. Fund your account

### Step 2: Generate API Key

1. **Log in** to your OANDA account
2. Go to **Manage API Access** (or **My Services** → **Manage API Access**)
3. Click **Generate** to create a new Personal Access Token
4. **Copy the token** immediately (you won't be able to see it again)
5. **Store it securely** (password manager recommended)

**Important Notes**:
- Practice and Live accounts have different API keys
- Each key is tied to one environment (practice or live)
- You can revoke and regenerate keys at any time
- Keep your API key secret (treat it like a password)

### Step 3: Note Your Account ID

Your account ID is visible in your OANDA dashboard. It looks like:
```
001-004-1234567-001
```

You'll need this when connecting to Trading Path Journal.

---

## Connecting to Trading Path Journal

### Option 1: Web Interface (Recommended)

1. **Log in** to Trading Path Journal
2. Go to **Settings** → **Broker Connections**
3. Click **Add Broker**
4. Select **OANDA** from the list
5. Fill in the connection form:
   - **Environment**: Choose `Practice` or `Live`
   - **API Key**: Paste your Personal Access Token
   - **Account ID**: Enter your account ID (e.g., `001-004-1234567-001`)
6. Click **Connect**
7. Wait for validation (usually instant)
8. You'll see "✅ Connected" when successful

### Option 2: API (For Developers)

```typescript
import { createOandaProvider } from '@/services/broker/oanda-provider';

const provider = createOandaProvider('practice'); // or 'live'

const authResult = await provider.authenticate({
  apiKey: 'your-api-key-here',
  apiSecret: '', // OANDA doesn't use API secret
});

const accounts = await provider.getAccounts(authResult.accessToken);
console.log('Connected accounts:', accounts);
```

---

## Testing Your Connection

### Step 1: Verify Connection Status

1. Go to **Settings** → **Broker Connections**
2. You should see your OANDA account with status "✅ Connected"
3. Account balance should be displayed

### Step 2: Sync Trades

1. Go to **Dashboard** or **Trades**
2. Click **Sync Now** (or wait for automatic sync)
3. Your trades should appear within seconds

### Step 3: Verify Trade Data

Check that your trades have:
- ✅ Correct symbols (e.g., EURUSD, GBPUSD)
- ✅ Correct direction (LONG/SHORT)
- ✅ Correct entry/exit prices
- ✅ Correct PnL
- ✅ Correct timestamps

---

## Troubleshooting

### "Invalid API Key" Error

**Causes**:
- Wrong API key copied
- Using practice key with live environment (or vice versa)
- API key was revoked

**Solutions**:
1. Double-check you copied the entire key (no spaces)
2. Verify environment matches (practice vs live)
3. Generate a new API key in OANDA dashboard
4. Try again with the new key

### "No Accounts Found" Error

**Causes**:
- API key doesn't have access to any accounts
- Account was closed or suspended

**Solutions**:
1. Log in to OANDA and verify your account is active
2. Check that the API key was generated for the correct account
3. Contact OANDA support if issue persists

### Trades Not Syncing

**Causes**:
- No trades in the selected time period
- Connection lost
- Rate limit exceeded (rare)

**Solutions**:
1. Verify you have trades in your OANDA account
2. Check connection status (should be "Connected")
3. Try manual sync: Click "Sync Now"
4. Check date range filter (expand to see older trades)
5. Wait 1 minute and try again (in case of rate limit)

### Wrong Trade Data

**Causes**:
- Partial closes not handled correctly
- Hedged positions (multiple positions same instrument)
- Time zone issues

**Solutions**:
1. Check original trade in OANDA platform
2. Report issue to support with trade ID
3. Manual adjustment may be needed for complex scenarios

---

## FAQ

### Q: Is my API key secure?

**A**: Yes, if you follow best practices:
- ✅ Never share your API key
- ✅ Store it in a password manager
- ✅ Use practice account for testing
- ✅ Revoke keys you're not using
- ✅ Regenerate keys if compromised

### Q: Can I use multiple OANDA accounts?

**A**: Yes! You can connect multiple OANDA accounts:
- Multiple practice accounts
- Multiple live accounts
- Mix of practice and live accounts

Each account needs its own API key.

### Q: What's the difference between practice and live?

**Practice**:
- ✅ Virtual money ($100,000)
- ✅ Real market data
- ✅ No risk
- ✅ Instant setup
- ✅ Perfect for testing

**Live**:
- 💰 Real money
- 💰 Real trading
- ⚠️ Real risk
- ⏰ KYC required
- ⏰ Funding required

### Q: How often do trades sync?

**A**: Trades sync automatically:
- Every 15 minutes (default)
- On demand (click "Sync Now")
- Real-time (if you have premium plan)

### Q: What instruments are supported?

**A**: All OANDA instruments:
- ✅ Major forex pairs (EUR/USD, GBP/USD, etc.)
- ✅ Minor forex pairs
- ✅ Exotic forex pairs
- ✅ Commodities (Gold, Silver, Oil)
- ✅ Indices (US30, SPX500, etc.)
- ✅ Bonds

### Q: Are there any fees?

**A**: No fees from Trading Path Journal:
- ✅ Free API access
- ✅ Free practice account
- ✅ Free trade sync

OANDA charges:
- Spreads (variable, typically 0.8-1.2 pips for EUR/USD)
- Overnight financing (swap fees)
- No commissions (spread-only pricing)

### Q: Can I disconnect my account?

**A**: Yes, anytime:
1. Go to **Settings** → **Broker Connections**
2. Find your OANDA account
3. Click **Disconnect**
4. Confirm

Your historical trades will remain in Trading Path Journal.

### Q: What happens if I revoke my API key?

**A**: If you revoke your API key in OANDA:
- ❌ Trade sync will stop
- ❌ Connection status will show "Error"
- ✅ Historical trades remain intact

To fix: Generate a new API key and update your connection.

---

## Support

### OANDA Support
- **Website**: https://www.oanda.com/contact/
- **Email**: support@oanda.com
- **Phone**: Available on website (varies by region)
- **Live Chat**: Available 24/5

### Trading Path Journal Support
- **Email**: support@tradingpathjournal.com
- **Discord**: [Join our community](https://discord.gg/tradingpath)
- **Documentation**: https://docs.tradingpathjournal.com

---

## Next Steps

After connecting your OANDA account:

1. ✅ **Verify trades synced correctly**
2. ✅ **Set up automatic sync schedule**
3. ✅ **Explore analytics and statistics**
4. ✅ **Add tags and notes to trades**
5. ✅ **Set up performance alerts**

Happy trading! 🚀

---

**Last Updated**: 2026-01-17  
**Version**: 1.0
