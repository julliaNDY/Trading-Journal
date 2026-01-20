# 🔧 AMP Futures Integration Guide

> **Broker**: AMP Futures  
> **Status**: Completed  
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

---

## 1. Overview

### Broker Information
- **Name**: AMP Futures (AMP Global Clearing)
- **Website**: https://www.ampfutures.com
- **Asset Classes**: Futures, Options on Futures
- **API Type**: CSV Import (No direct API)
- **API Documentation**: N/A (CSV export from trading platforms)

### Integration Type
- [x] File Upload (CSV from CQG, Rithmic, NinjaTrader)
- [ ] API Integration (not available for retail)
- [ ] Hybrid (N/A)

### Features Supported
- [x] Historical data import (unlimited)
- [x] Multi-platform support (CQG, Rithmic, NinjaTrader)
- [x] Trade reconstruction from fills
- [x] Symbol normalization
- [x] Point value auto-assignment
- [ ] Real-time sync (not available)
- [ ] Position tracking (via CSV only)
- [ ] Order history (via CSV only)

---

## 2. Prerequisites

### For Users

**Account Requirements**:
- Active AMP Futures account
- Access to one of the supported trading platforms:
  - CQG Desktop
  - CQG QTrader
  - Rithmic Trader Pro
  - NinjaTrader 8
  - TradingView (via AMP)

**Platform Access**:
- Platform subscription included with AMP account
- No additional API fees
- No special permissions required

**Costs**:
- AMP Account: $0 minimum deposit (varies by platform)
- Platform Fees: $0-150/month (varies by platform)
- Data Fees: $0-100/month (varies by markets)
- CSV Export: FREE ✅
- Import to Trading Journal: FREE ✅

### For Developers

**Development Environment**:
- Node.js 18+
- TypeScript 5+
- Prisma 5+

**Dependencies**:
```bash
# Already included in project
npm install papaparse
npm install @types/papaparse
```

**Environment Variables**:
```env
# No environment variables needed for CSV import
```

---

## 3. Setup Instructions

### Step 1: Export CSV from Trading Platform

#### Option A: CQG Desktop

1. Open CQG Desktop
2. Navigate to **Orders & Positions** tab
3. Click on **Fills** sub-tab
4. Select date range:
   - Click date picker
   - Select "Custom Range" or "All"
5. Right-click on the fills table
6. Select **Export to CSV**
7. Save file (e.g., `amp-trades-2026-01.csv`)

**Screenshot**: [CQG Desktop Export]

#### Option B: CQG QTrader

1. Log in to CQG QTrader (web interface)
2. Navigate to **Trade History**
3. Select date range
4. Click **Export** button
5. Select **CSV** format
6. Save file

**Screenshot**: [CQG QTrader Export]

#### Option C: Rithmic Trader Pro

1. Open Rithmic Trader Pro
2. Navigate to **Fill History** tab
3. Select date range
4. Click **Export** button
5. Choose **CSV** format
6. Save file

**Screenshot**: [Rithmic Export]

#### Option D: NinjaTrader 8

1. Open NinjaTrader 8
2. Go to **Control Center**
3. Click **Orders** tab
4. Right-click → **Export**
5. Save as CSV

**Screenshot**: [NinjaTrader Export]

*Note: NinjaTrader CSV format is already supported. See [NinjaTrader CSV documentation](./csv-formats/ninjatrader.md).*

### Step 2: Import CSV to Trading Journal

1. Navigate to `/importer` in the app
2. Click **"Import Trades"** button
3. Select **"AMP Futures"** from broker dropdown
4. Select platform:
   - CQG Desktop
   - CQG QTrader
   - Rithmic Trader Pro
   - NinjaTrader 8
5. Drag & drop CSV file or click to browse
6. Click **"Preview Import"**

### Step 3: Review & Confirm

1. Review the preview (first 20 trades)
2. Verify:
   - Symbols are normalized correctly (ESH26 → ES)
   - Dates/times are correct
   - P&L matches your records
   - Commissions are included
3. Select target account (or create new)
4. Click **"Import Trades"**

### Step 4: Verify Import

1. Wait for import to complete
2. Review import summary:
   - Trades imported: X
   - Trades skipped (duplicates): Y
   - Errors: Z
3. Navigate to **Trades** page
4. Filter by date range
5. Verify trades are correct

---

## 4. Configuration

### Import Settings

**Platform Selection**:
- **CQG Desktop**: For CQG Integrated Client exports
- **CQG QTrader**: For CQG web platform exports
- **Rithmic Trader Pro**: For Rithmic desktop exports
- **NinjaTrader 8**: For NinjaTrader exports

**Date Range**:
- Import all history: Select "All" in platform export
- Import specific range: Select date range in platform

**Account Mapping**:
- Map to existing account: Select from dropdown
- Create new account: Click "Create New Account"
- Account name suggestion: "AMP Futures - [Platform]"

### Advanced Settings

**Trade Reconstruction**:
- Method: FIFO (First In, First Out)
- Match by: Symbol (normalized)
- Handle partial fills: Yes (automatic)

**Symbol Normalization**:
- CQG format (ESH26) → Root symbol (ES)
- Rithmic format (ES 03-26) → Root symbol (ES)
- Preserve contract month: Optional (for analytics)

**Point Value Assignment**:
- Auto-assign from symbol table: Yes
- Override point value: Manual (if needed)
- Unknown symbols: Default to $1

**Duplicate Detection**:
- Method: Trade signature (symbol + openedAt + closedAt + price + quantity)
- Skip duplicates: Yes (default)
- Update existing: No (default)

---

## 5. Testing

### Test with Demo Data

1. Download sample CSV files:
   - [CQG Desktop Sample](./csv-formats/samples/cqg-desktop-amp-sample.csv)
   - [Rithmic Sample](./csv-formats/samples/rithmic-trader-pro-amp-sample.csv)
2. Import sample file
3. Verify 10 trades imported
4. Verify P&L calculations
5. Delete test trades

### Test Cases

#### TC1: CQG Desktop Import
- [x] Import CQG Desktop CSV with 10 trades
- [x] Verify all trades imported correctly
- [x] Verify P&L calculations match
- [x] Verify commissions are correct
- [x] Verify symbols normalized (ESH26 → ES)

#### TC2: Rithmic Trader Pro Import
- [x] Import Rithmic CSV with 10 trades
- [x] Verify all trades imported correctly
- [x] Verify P&L calculations match
- [x] Verify symbols normalized (ES 03-26 → ES)
- [x] Verify exchange data preserved

#### TC3: Trade Reconstruction
- [x] Test with simple buy-sell pairs
- [x] Test with multiple contracts (quantity > 1)
- [x] Test with partial fills
- [x] Test with mixed symbols (ES, NQ, YM)
- [x] Verify FIFO matching is correct

#### TC4: Duplicate Detection
- [x] Import same CSV twice
- [x] Verify duplicates are skipped
- [x] Verify no duplicate trades in database

#### TC5: Symbol Normalization
- [x] Test ESH26 → ES
- [x] Test ES 03-26 → ES
- [x] Test NQH26 → NQ
- [x] Test CL 02-26 → CL
- [x] Test unknown symbols (pass-through)

---

## 6. Troubleshooting

### Common Issues

#### Issue 1: "Invalid CSV Format"

**Symptoms**: Import fails with format error

**Causes**:
- Wrong platform selected
- CSV file corrupted
- Incorrect delimiter (semicolon instead of comma)

**Solutions**:
1. Verify correct platform selected (CQG vs Rithmic)
2. Re-export CSV from platform
3. Open CSV in text editor to verify format
4. Check for special characters in symbol names

#### Issue 2: "No Trades Found"

**Symptoms**: Import completes but 0 trades imported

**Causes**:
- Empty CSV file
- CSV contains only open positions (no closed trades)
- Date range filter excludes all trades

**Solutions**:
1. Verify CSV file has data (open in Excel/text editor)
2. Ensure trades are closed (not open positions)
3. Check date range in export
4. Verify CSV has both Buy and Sell fills

#### Issue 3: "Symbol Not Recognized"

**Symptoms**: Import warning about unknown symbols

**Causes**:
- Exotic futures contract not in symbol table
- Custom symbol format

**Solutions**:
1. Check symbol normalization in preview
2. Manually edit symbol after import
3. Contact support to add symbol to table
4. Override point value if needed

#### Issue 4: "P&L Mismatch"

**Symptoms**: Imported P&L doesn't match platform

**Causes**:
- Commission handling difference
- Point value incorrect
- FIFO vs LIFO accounting method

**Solutions**:
1. Verify commissions are included in CSV
2. Check point value for symbol
3. Manually adjust P&L if needed
4. Use manual trade entry for complex cases

#### Issue 5: "Duplicate Trades"

**Symptoms**: Same trade appears multiple times

**Causes**:
- Imported same CSV twice
- Trade signature collision (rare)

**Solutions**:
1. Check import history
2. Delete duplicate trades manually
3. Re-import with "Skip duplicates" enabled

#### Issue 6: "Trade Reconstruction Error"

**Symptoms**: Trades not matching correctly (open/close)

**Causes**:
- FIFO algorithm doesn't match user's accounting
- Partial fills not handled correctly
- Mixed symbols in same CSV

**Solutions**:
1. Verify FIFO is correct accounting method
2. Manually edit trades after import
3. Contact support for LIFO option
4. Split CSV by symbol if needed

---

## 7. API Reference

### CSV Import Endpoint

**Note**: AMP Futures uses CSV import, not a direct API. The import process uses our existing CSV import infrastructure.

### Import Profile: CQG Desktop

```json
{
  "id": "cqg-desktop-amp",
  "name": "CQG Desktop (AMP Futures)",
  "broker": "AMP_FUTURES",
  "version": "1.0.0",
  "fileFormat": "csv",
  "delimiter": ",",
  "hasHeader": true,
  "encoding": "utf-8",
  "dateFormat": "MM/DD/YYYY",
  "timeFormat": "HH:mm:ss",
  "columnMapping": {
    "symbol": "Symbol",
    "side": "Side",
    "quantity": "Quantity",
    "price": "Price",
    "commission": "Commission",
    "pnl": "Net P/L",
    "date": "Date",
    "time": "Time"
  }
}
```

### Import Profile: Rithmic Trader Pro

```json
{
  "id": "rithmic-trader-pro-amp",
  "name": "Rithmic Trader Pro (AMP Futures)",
  "broker": "AMP_FUTURES",
  "version": "1.0.0",
  "fileFormat": "csv",
  "delimiter": ",",
  "hasHeader": true,
  "encoding": "utf-8",
  "dateFormat": "YYYY-MM-DD",
  "timeFormat": "HH:mm:ss",
  "columnMapping": {
    "symbol": "Symbol",
    "side": "B/S",
    "quantity": "Qty",
    "price": "Price",
    "commission": "Commission",
    "pnl": "P&L",
    "time": "Time",
    "exchange": "Exch"
  }
}
```

---

## 8. Known Issues

### Current Issues

1. **Issue**: Manual CSV export required
   - **Impact**: Medium (no auto-sync)
   - **Workaround**: Export CSV regularly
   - **ETA**: Future (consider NinjaScript automation)

2. **Issue**: FIFO accounting only
   - **Impact**: Low (most traders use FIFO)
   - **Workaround**: Manual trade editing
   - **ETA**: Q2 2026 (add LIFO option)

3. **Issue**: Some exotic symbols not in table
   - **Impact**: Low (rare)
   - **Workaround**: Manual point value entry
   - **ETA**: Ongoing (add symbols as requested)

### Resolved Issues

None yet (new integration)

---

## 9. Support

### Getting Help

**AMP Futures Support**:
- Phone: 1-312-884-1222
- Email: support@ampfutures.com
- Live Chat: https://www.ampfutures.com
- Hours: 24/7

**CQG Support**:
- Phone: 1-800-525-7082
- Email: cqgsupport@cqg.com
- Hours: 24/5 (Mon-Fri)

**Rithmic Support**:
- Email: support@rithmic.com
- Documentation: https://yyy3.rithmic.com

**Trading Journal Support**:
- Email: support@tradingjournal.com
- Discord: [Link]
- GitHub Issues: [Link]

**Reporting Issues**:
1. Check [Known Issues](#known-issues) first
2. Try [Troubleshooting](#troubleshooting) steps
3. Contact support with:
   - Broker name: AMP Futures
   - Platform: CQG/Rithmic/NinjaTrader
   - Error message
   - Sample CSV file (anonymized)
   - Steps to reproduce
   - Screenshots (if applicable)

---

## 10. Developer Notes

### Implementation Details

**Integration Type**: CSV Import (File Upload)  
**Provider Class**: Not applicable (CSV import uses ImportService)  
**Import Profiles**: 
- `cqg-desktop-amp`
- `cqg-qtrader-amp`
- `rithmic-trader-pro-amp`

**Key Features**:
- Trade reconstruction from fills (FIFO)
- Symbol normalization (ESH26 → ES, ES 03-26 → ES)
- Point value auto-assignment
- Duplicate detection via trade signature

**Files Modified**:
- `prisma/schema.prisma` - Added AMP_FUTURES to BrokerType enum
- `src/services/broker/provider-factory.ts` - Added AMP_FUTURES metadata
- `prisma/seed-import-profiles.ts` - Added import profiles

**Files Created**:
- `docs/brokers/api-research/amp-futures.md` - API research
- `docs/brokers/csv-formats/amp-futures.md` - CSV format docs
- `docs/brokers/amp-futures-integration-guide.md` - This file

### Trade Reconstruction Algorithm

```typescript
// Simplified pseudocode
function reconstructTrades(fills: Fill[]): Trade[] {
  const openPositions: Map<string, Fill[]> = new Map();
  const completedTrades: Trade[] = [];

  for (const fill of fills.sort(byTimestamp)) {
    const symbol = normalizeSymbol(fill.symbol);
    
    if (fill.side === 'Buy') {
      openPositions.get(symbol)?.push(fill) || openPositions.set(symbol, [fill]);
    } else {
      const opens = openPositions.get(symbol);
      if (opens?.length > 0) {
        const openFill = opens.shift()!; // FIFO
        completedTrades.push(createTrade(openFill, fill));
      }
    }
  }

  return completedTrades;
}
```

### Symbol Normalization

```typescript
function normalizeSymbol(symbol: string): string {
  // CQG format: ESH26 → ES
  if (/^[A-Z]+[A-Z]\d{2}$/.test(symbol)) {
    return symbol.match(/^([A-Z]+)[A-Z]\d{2}$/)![1];
  }
  
  // Rithmic format: ES 03-26 → ES
  if (/^[A-Z]+\s+\d{2}-\d{2}$/.test(symbol)) {
    return symbol.match(/^([A-Z]+)\s+\d{2}-\d{2}$/)![1];
  }
  
  return symbol.trim().toUpperCase();
}
```

### Point Value Mapping

```typescript
const POINT_VALUES: Record<string, number> = {
  ES: 50,    // E-mini S&P 500
  NQ: 20,    // E-mini NASDAQ-100
  YM: 5,     // E-mini Dow Jones
  RTY: 50,   // E-mini Russell 2000
  CL: 1000,  // Crude Oil
  GC: 100,   // Gold
  SI: 5000,  // Silver
  NG: 10000, // Natural Gas
  ZB: 1000,  // 30-Year T-Bond
  ZN: 1000,  // 10-Year T-Note
  // ... more symbols
};
```

---

## 11. Future Enhancements

### Phase 2: Enhanced CSV Import

- [ ] Auto-detect platform from CSV format
- [ ] Support TradingView CSV export
- [ ] Support Sierra Chart CSV export
- [ ] LIFO accounting option
- [ ] Manual trade matching (override FIFO)

### Phase 3: Platform Integration

- [ ] NinjaScript automation (auto-export CSV)
- [ ] CQG API integration (if cost-effective)
- [ ] Rithmic API integration (if cost-effective)
- [ ] Real-time sync via platform API

### Phase 4: Advanced Features

- [ ] Multi-leg trade support (spreads, straddles)
- [ ] Options on futures support
- [ ] Commission analysis
- [ ] Platform-specific analytics

---

## 12. Success Metrics

### Integration Success Criteria

| Metric | Target | Current |
|--------|--------|---------|
| Import Success Rate | > 95% | TBD |
| Trade Reconstruction Accuracy | > 99% | TBD |
| Symbol Normalization Accuracy | > 98% | TBD |
| User Satisfaction | > 4.0/5.0 | TBD |
| Support Tickets | < 5/week | TBD |

### Business Impact

| Metric | Target | Timeline |
|--------|--------|----------|
| New User Signups (AMP traders) | +5% | 3 months |
| User Retention (AMP users) | > 80% | 6 months |
| CSV Import Usage | > 60% | 3 months |

---

## 13. References & Resources

### Official Documentation

- **AMP Futures**: https://www.ampfutures.com
- **CQG Desktop**: https://www.cqg.com/products/cqg-desktop
- **CQG QTrader**: https://www.cqg.com/products/cqg-qtrader
- **Rithmic**: https://rithmic.com
- **NinjaTrader**: https://ninjatrader.com

### Community Resources

- **Elite Trader Forum**: https://www.elitetrader.com/et/forums/futures.4/
- **Futures.io**: https://futures.io
- **r/FuturesTrading**: https://reddit.com/r/FuturesTrading

### Internal Documentation

- **API Research**: `docs/brokers/api-research/amp-futures.md`
- **CSV Format**: `docs/brokers/csv-formats/amp-futures.md`
- **Integration Tracker**: `docs/brokers/broker-integration-tracker.md`
- **Story 3.8**: `docs/stories/3.8.story.md`

---

**Maintained By**: Development Team  
**Last Updated**: 2026-01-17  
**Version**: 1.0  
**Status**: ✅ Complete & Ready for Use
