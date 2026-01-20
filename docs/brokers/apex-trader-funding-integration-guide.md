# 🔧 Broker Integration Guide - Apex Trader Funding (Rithmic)

> **Broker**: Apex Trader Funding  
> **Platform**: Rithmic R|Trader Pro  
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
9. [Support](#support)
10. [Developer Notes](#developer-notes)

---

## 1. Overview

### Broker Information

- **Name**: Apex Trader Funding
- **Website**: https://www.apextraderfunding.com
- **Asset Classes**: Futures (ES, NQ, YM, RTY, CL, GC, etc.)
- **Platform**: Rithmic R|Trader Pro
- **API Type**: CSV Export (no public API)

### Integration Type

- ✅ File Upload (CSV export from Rithmic)
- ❌ API Integration (no public API available)
- ⚠️ Hybrid (possible with Rithmic R|API+ - expensive)

### Features Supported

- ✅ Historical data import (CSV)
- ✅ Trade reconstruction from fills
- ✅ Futures contract normalization
- ✅ Point value calculations
- ✅ Commission tracking
- ❌ Real-time sync (manual export required)
- ❌ Automatic sync (CSV export only)

---

## 2. Prerequisites

### For Users

**Account Requirements**:
- Active Apex Trader Funding account (evaluation or funded)
- Access to Rithmic R|Trader Pro platform
- Completed trades (closed positions)

**Platform Access**:
- Rithmic R|Trader Pro installed (Windows only)
- Login credentials from Apex Trader Funding
- Trades executed and closed

**Costs**:
- API Access: N/A (no API)
- CSV Export: FREE ✅
- Platform Access: Included with Apex account

### For Developers

**Development Environment**:
- Node.js 18+
- TypeScript 5+
- Sample Rithmic CSV files

**Dependencies**:
```bash
# Already included in project
npm install papaparse
npm install @prisma/client
```

**Environment Variables**:
```env
# No special env vars required for CSV import
DATABASE_URL=your_database_url
```

---

## 3. Setup Instructions

### Step 1: Export CSV from Rithmic

1. **Open R|Trader Pro**
   - Launch Rithmic R|Trader Pro application
   - Log in with your Apex credentials

2. **Navigate to Trade History**
   - Click **Window** menu
   - Select **Reports** > **Trade History**

3. **Select Date Range**
   - Choose date range (Today, Last 7 Days, Last 30 Days, Custom)
   - Ensure range includes your closed trades

4. **Export to CSV**
   - Click **Export** button (top right)
   - Select **Export to CSV**
   - Choose save location
   - Save file (e.g., `apex-trades-2026-01.csv`)

5. **Verify Export**
   - Open CSV in Excel or text editor
   - Verify columns: Date, Time, Symbol, Side, Quantity, Price
   - Check that trades are listed

### Step 2: Import to Trading Path Journal

1. **Navigate to Import Page**
   - Go to `/importer` in the app
   - Click "Import Trades"

2. **Select Broker**
   - Choose "Apex Trader Funding (Rithmic)" from dropdown
   - Or let auto-detection identify the broker

3. **Upload CSV**
   - Drag & drop CSV file or click to browse
   - Wait for file upload and preview

4. **Review Preview**
   - Check first 20 rows
   - Verify column mapping is correct
   - Confirm symbol normalization (ESH26 → ES Mar 2026)

5. **Confirm Import**
   - Click "Import Trades"
   - Wait for processing (may take a few seconds)
   - Review import report (trades imported, skipped, errors)

6. **Verify Trades**
   - Navigate to `/trades` page
   - Check that trades are listed
   - Verify P/L calculations are correct
   - Confirm commissions are included

---

## 4. Configuration

### Import Profile

The Apex Trader Funding (Rithmic) import profile is pre-configured with:

**Column Mapping**:
- `Date` → Trade date
- `Time` → Trade time
- `Symbol` → Futures contract (ESH26, NQM26, etc.)
- `Side` → Buy/Sell (LONG/SHORT)
- `Quantity` → Number of contracts
- `Price` → Execution price
- `Commission` → Commission per fill
- `Net P/L` → Realized profit/loss
- `Account` → Apex account ID

**Symbol Normalization**:
- `ESH26` → E-mini S&P 500 March 2026
- `NQM26` → E-mini NASDAQ-100 June 2026
- `YMZ26` → E-mini Dow December 2026
- `RTYH26` → E-mini Russell 2000 March 2026
- `CLF26` → Crude Oil January 2026
- `GCG26` → Gold February 2026

**Point Values** (for P/L calculation):
- ES: $50/point
- NQ: $20/point
- YM: $5/point
- RTY: $50/point
- CL: $1,000/point
- GC: $100/point
- SI: $5,000/point
- NG: $10,000/point

**Trade Reconstruction**:
- Method: Fill-based (FIFO)
- Grouping: By symbol and account
- P/L: Calculated from fills
- Commissions: Summed from entry/exit

### Advanced Settings

**Date Format Detection**:
- Supports: MM/DD/YYYY, YYYY-MM-DD, DD/MM/YYYY
- Auto-detects format from CSV

**Timezone**:
- Default: America/Chicago (CME timezone)
- Can be overridden in user settings

**Deduplication**:
- Enabled by default
- Uses trade signature: (userId, symbol, openedAt, closedAt, entryPrice, exitPrice, realizedPnlUsd)
- Prevents duplicate imports

---

## 5. Testing

### Test with Demo Account

1. **Create Demo Account**
   - Sign up for Rithmic demo: https://yyy3.rithmic.com/
   - Or use Apex demo account

2. **Place Test Trades**
   - Open R|Trader Pro with demo account
   - Place and close a few test trades (ES, NQ, etc.)
   - Wait for trades to settle

3. **Export Test CSV**
   - Export trade history as CSV
   - Verify CSV format matches expected structure

4. **Import Test CSV**
   - Upload CSV to Trading Path Journal
   - Verify trades import correctly
   - Check P/L calculations

### Test Cases

#### TC1: Single Trade Import
- **Setup**: CSV with 1 complete trade (entry + exit)
- **Expected**: 1 trade created with correct P/L
- **Verify**: Entry price, exit price, quantity, P/L, commission

#### TC2: Multiple Trades Import
- **Setup**: CSV with 10 trades (various symbols)
- **Expected**: 10 trades created
- **Verify**: All trades have correct data, no duplicates

#### TC3: Scalping (Multiple Entries/Exits)
- **Setup**: CSV with 5 entries and 5 exits in same symbol
- **Expected**: 5 trades reconstructed using FIFO
- **Verify**: Trades match correctly, P/L is accurate

#### TC4: Multi-Day Position
- **Setup**: CSV with entry on Day 1, exit on Day 2
- **Expected**: 1 trade spanning 2 days
- **Verify**: Dates are correct, P/L is accurate

#### TC5: Partial Fills
- **Setup**: CSV with order filled in 3 executions (2+2+1 contracts)
- **Expected**: 1 trade with quantity 5
- **Verify**: Average price, total P/L, total commission

#### TC6: Symbol Normalization
- **Setup**: CSV with various futures symbols (ESH26, NQM26, YMZ26)
- **Expected**: All symbols normalized correctly
- **Verify**: Display names show "ES Mar 2026", "NQ Jun 2026", etc.

#### TC7: Duplicate Import Prevention
- **Setup**: Import same CSV twice
- **Expected**: Second import skips all trades (duplicates detected)
- **Verify**: No duplicate trades created

---

## 6. Troubleshooting

### Common Issues

#### Issue 1: "Invalid CSV Format"

**Symptoms**: Import fails with CSV format error

**Causes**:
- CSV exported from wrong platform (not Rithmic)
- CSV corrupted or incomplete
- Wrong file encoding

**Solutions**:
1. Verify CSV is from Rithmic R|Trader Pro
2. Open CSV in text editor, check for corruption
3. Ensure file encoding is UTF-8
4. Re-export CSV from Rithmic

#### Issue 2: "Symbol Not Recognized"

**Symptoms**: Import warns about unknown symbols

**Causes**:
- Exotic futures contract not in point value table
- Symbol format doesn't match Rithmic notation
- Typo in symbol

**Solutions**:
1. Check symbol format: should be `[ROOT][MONTH_CODE][YEAR]`
2. Verify symbol is a valid CME futures contract
3. Contact support to add new symbol to point value table
4. Override point value manually in trade edit

#### Issue 3: "No Trades Found"

**Symptoms**: CSV imports but no trades created

**Causes**:
- All fills are entry fills (no exits)
- Positions are still open
- Date range doesn't include closed trades

**Solutions**:
1. Verify trades are closed (not open positions)
2. Export longer date range
3. Check if fills are matched correctly (review import log)
4. Ensure CSV has both Buy and Sell fills

#### Issue 4: "P/L Mismatch"

**Symptoms**: Calculated P/L doesn't match CSV P/L

**Causes**:
- Point value incorrect
- Commission not included in calculation
- Rounding differences
- Multiple fills combined incorrectly

**Solutions**:
1. Verify point value for symbol (ES=$50, NQ=$20, etc.)
2. Check if commissions are included
3. Accept minor rounding differences (<$1)
4. Review trade reconstruction logic (contact support if needed)

#### Issue 5: "Duplicate Trades"

**Symptoms**: Same trade appears multiple times

**Causes**:
- CSV imported multiple times
- Deduplication logic failed
- Trade signature collision (rare)

**Solutions**:
1. Check import history (avoid re-importing same CSV)
2. Manually delete duplicates from `/trades` page
3. Report issue to support if deduplication fails

#### Issue 6: "Commission Missing"

**Symptoms**: Trades imported but commission is $0

**Causes**:
- CSV doesn't include Commission column
- Commission column is empty
- Rithmic export settings exclude commission

**Solutions**:
1. Check CSV for Commission column
2. Re-export from Rithmic with commission included
3. Manually add commission to trades after import

---

## 7. API Reference

### CSV Format Specification

**File Format**: CSV (Comma-Separated Values)

**Encoding**: UTF-8

**Delimiter**: Comma (`,`)

**Header Row**: Yes (first row)

**Required Columns**:
- `Date` (MM/DD/YYYY or YYYY-MM-DD)
- `Time` (HH:MM:SS or HH:MM:SS.SSS)
- `Symbol` (ESH26, NQM26, etc.)
- `Side` (Buy, Sell)
- `Quantity` (integer)
- `Price` (decimal)

**Optional Columns**:
- `Commission` (decimal)
- `Net P/L` (decimal)
- `Account` (string)
- `Order ID` (string)
- `Execution ID` (string)

**Example CSV**:
```csv
Date,Time,Symbol,Side,Quantity,Price,Commission,Net P/L,Account
01/15/2026,09:30:15,ESH26,Buy,1,4850.00,2.50,0.00,PA123456
01/15/2026,09:35:42,ESH26,Sell,1,4852.50,2.50,125.00,PA123456
```

### Import Profile JSON

See `prisma/seed-import-profiles.ts` for full configuration.

**Key Settings**:
- `brokerType`: `apex_rithmic`
- `fileFormat`: `CSV`
- `tradeReconstruction.method`: `fill_based`
- `tradeReconstruction.matchLogic`: `fifo`
- `transformations.symbol.type`: `futures_contract`

---

## 8. Known Issues

### Current Issues

1. **Issue**: Real-time sync not available
   - **Impact**: Medium (manual export required)
   - **Workaround**: Export CSV after each trading session
   - **ETA**: No ETA (requires Rithmic R|API+ subscription)

2. **Issue**: Windows-only platform (Rithmic)
   - **Impact**: Low (most futures traders use Windows)
   - **Workaround**: Use Windows VM or dual-boot
   - **ETA**: N/A (Rithmic limitation)

3. **Issue**: Exotic futures contracts may not have point values
   - **Impact**: Low (rare contracts)
   - **Workaround**: Manually set point value in trade edit
   - **ETA**: Ongoing (add new contracts as requested)

### Resolved Issues

None yet (new integration)

---

## 9. Support

### Getting Help

**Documentation**:
- Rithmic R|Trader Pro Docs: https://yyy3.rithmic.com/?page_id=16
- Apex Trader Funding Rules: https://www.apextraderfunding.com/rules
- Our Integration Guide: This document
- CSV Format Docs: `/docs/brokers/csv-formats/apex-rithmic.md`

**Support Channels**:
- Email: support@tradingjournal.com
- Discord: [Link to Discord]
- GitHub Issues: [Link to GitHub]

**Reporting Issues**:
1. Check [Known Issues](#known-issues) first
2. Try [Troubleshooting](#troubleshooting) steps
3. Contact support with:
   - Broker name: Apex Trader Funding (Rithmic)
   - Error message (if any)
   - Steps to reproduce
   - Sample CSV file (remove sensitive data)
   - Screenshots (if applicable)

**Community Resources**:
- Apex Trader Funding Discord
- Futures.io forums
- Elite Trader forums

---

## 10. Developer Notes

### Implementation Details

**Provider Class**: N/A (CSV import only)

**Import Profile**: `apex_rithmic` in `broker-detection-service.ts`

**Key Files**:
- `src/services/broker-detection-service.ts` - Auto-detection pattern
- `src/services/import-service.ts` - CSV parsing and trade reconstruction
- `prisma/seed-import-profiles.ts` - Import profile configuration
- `docs/brokers/csv-formats/apex-rithmic.md` - CSV format documentation

**Trade Reconstruction Algorithm**:
1. Sort fills by datetime (ascending)
2. Group by symbol and account
3. Track open positions (FIFO queue)
4. Match entry/exit fills
5. Calculate P/L from price difference × quantity × point value
6. Sum commissions from entry and exit fills

**Symbol Normalization**:
- Parse Rithmic notation: `ESH26` → `ES` (root), `H` (March), `26` (2026)
- Look up contract specs (point value, tick size)
- Generate display name: "E-mini S&P 500 March 2026"

**Point Value Lookup**:
- Hardcoded table for common futures (ES, NQ, YM, RTY, CL, GC, etc.)
- Fallback: $1/point (with warning)
- User can override in trade edit

### Code Example

```typescript
import { detectBrokerFromHeaders, getBrokerPattern } from '@/services/broker-detection-service';

// Auto-detect Apex/Rithmic CSV
const headers = ['Date', 'Time', 'Symbol', 'Side', 'Quantity', 'Price', 'Commission', 'Net P/L', 'Account'];
const pattern = detectBrokerFromHeaders(headers);
console.log(pattern?.brokerName); // 'apex_rithmic'

// Get import profile
const profile = getBrokerPattern('apex_rithmic');
console.log(profile?.displayName); // 'Apex Trader Funding (Rithmic)'
```

### Testing

**Unit Tests**:
- `src/services/__tests__/broker-detection-service.test.ts`
- `src/services/__tests__/import-service.test.ts`

**Integration Tests**:
- `src/services/__tests__/apex-rithmic-import.test.ts` (to be created)

**Sample Data**:
- `docs/brokers/csv-formats/samples/apex-rithmic-sample.csv` (to be added)

---

## 11. Future Enhancements

### Planned Features

1. **Rithmic R|API+ Integration** (Advanced)
   - Real-time trade sync
   - WebSocket streaming
   - Automatic import
   - **Cost**: $100-500/month per user
   - **Timeline**: TBD (based on user demand)

2. **NinjaScript Automation**
   - Auto-export CSV from NinjaTrader
   - Scheduled exports
   - **Timeline**: Q2 2026

3. **Point Value Auto-Detection**
   - Fetch point values from CME API
   - Auto-update contract specs
   - **Timeline**: Q2 2026

4. **Multi-Account Support**
   - Import multiple Apex accounts in one CSV
   - Auto-detect account from CSV
   - **Timeline**: Q1 2026

### User Feedback

**Most Requested**:
1. Real-time sync (requires R|API+)
2. Automatic daily export
3. Mobile app support (iOS/Android)

**Under Consideration**:
- Integration with other prop firms using Rithmic (TopstepX, Bulenox, etc.)
- Support for other Rithmic platforms (R|Trader, R|Pro, etc.)
- Advanced analytics for prop traders (drawdown tracking, consistency score, etc.)

---

## 12. Changelog

### Version 1.0 (2026-01-17)

**Initial Release**:
- ✅ CSV import from Rithmic R|Trader Pro
- ✅ Auto-detection of Apex/Rithmic CSV format
- ✅ Futures symbol normalization (ESH26, NQM26, etc.)
- ✅ Point value mapping for common futures
- ✅ Trade reconstruction from fills (FIFO)
- ✅ Commission tracking
- ✅ Deduplication
- ✅ Comprehensive documentation

**Known Limitations**:
- No real-time sync (manual export required)
- Windows-only platform (Rithmic limitation)
- Exotic futures may require manual point value entry

---

**Maintained By**: Development Team  
**Last Updated**: 2026-01-17  
**Version**: 1.0  
**Status**: Production Ready ✅
