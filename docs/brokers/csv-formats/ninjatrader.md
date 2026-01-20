# 🥷 NinjaTrader CSV Import Format

> **Broker**: NinjaTrader LLC  
> **Status**: Completed  
> **Integration Date**: 2026-01-17  
> **Last Updated**: 2026-01-17

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Export Instructions](#export-instructions)
4. [CSV Format Specification](#csv-format-specification)
5. [Import Profile](#import-profile)
6. [Trade Reconstruction](#trade-reconstruction)
7. [Symbol Normalization](#symbol-normalization)
8. [Point Value Mapping](#point-value-mapping)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)

---

## 1. Overview

### Broker Information
- **Name**: NinjaTrader LLC
- **Website**: https://ninjatrader.com
- **Asset Classes**: Futures, Forex
- **Platform**: NinjaTrader 8 (Windows desktop application)
- **Integration Type**: CSV File Upload (executions export)

### Why CSV Import?

NinjaTrader doesn't provide a simple REST API for retail users. The available options are:
1. **NinjaScript API** (C# - runs inside NT8)
2. **ATI** (Automated Trading Interface - TCP/IP)
3. **CSV Export** (simplest, recommended for MVP)

We're implementing **CSV Export** as Phase 1 because:
- ✅ Simple and reliable
- ✅ No API costs
- ✅ Works for all users
- ✅ No Windows/desktop requirements for our app

---

## 2. Prerequisites

### For Users

**Account Requirements**:
- NinjaTrader 8 installed (Windows)
- Active trading account (or simulated account for testing)
- Executed trades in NinjaTrader

**No API Access Required**: CSV export is built into NinjaTrader 8

**Costs**:
- CSV Export: Free (built-in feature)
- NinjaTrader Platform: Free (basic version)
- Data Fees: Varies by data provider

---

## 3. Export Instructions

### Step 1: Open NinjaTrader 8

1. Launch NinjaTrader 8 on Windows
2. Log in to your account

### Step 2: Open Executions Window

1. Click **Control Center** (main window)
2. Go to **Tools** → **Account Performance**
3. Or press `Ctrl + E` for Executions

### Step 3: Select Date Range

1. In the Executions window, click **Date Range**
2. Select:
   - **From**: Start date (e.g., 2026-01-01)
   - **To**: End date (e.g., 2026-01-17)
3. Click **Apply**

### Step 4: Export to CSV

1. Right-click in the Executions table
2. Select **Export** → **Export to CSV**
3. Choose save location
4. Save file (e.g., `ninjatrader-executions-2026-01-17.csv`)

### Step 5: Upload to Trading Journal

1. Go to `/importer` in Trading Path Journal
2. Click **Upload CSV**
3. Select **NinjaTrader** from broker dropdown
4. Upload the exported CSV file
5. Review and import trades

---

## 4. CSV Format Specification

### Standard NinjaTrader Export Format

NinjaTrader exports executions (fills) in the following format:

```csv
Instrument,Quantity,Avg fill price,Time,Commission,Rate,Account,Order Id,Name
ES 03-24,1,4500.00,1/15/2024 9:30:00 AM,2.12,Buy,Sim101,abc123,Entry
ES 03-24,-1,4510.00,1/15/2024 10:15:00 AM,2.12,Sell,Sim101,def456,Exit
NQ 03-24,2,15000.00,1/15/2024 11:00:00 AM,4.24,Buy,Sim101,ghi789,Long
NQ 03-24,-2,15050.00,1/15/2024 11:30:00 AM,4.24,Sell,Sim101,jkl012,Close
```

### Column Definitions

| Column | Description | Example | Required |
|--------|-------------|---------|----------|
| `Instrument` | Contract name | `ES 03-24` | ✅ Yes |
| `Quantity` | Number of contracts (always positive) | `1` | ✅ Yes |
| `Avg fill price` | Fill price | `4500.00` | ✅ Yes |
| `Time` | Execution time (local timezone) | `1/15/2024 9:30:00 AM` | ✅ Yes |
| `Commission` | Commission per fill | `2.12` | ⚠️ Optional |
| `Rate` | Buy or Sell | `Buy`, `Sell` | ✅ Yes |
| `Account` | Account name | `Sim101` | ⚠️ Optional |
| `Order Id` | Order identifier | `abc123` | ⚠️ Optional |
| `Name` | Order name/label | `Entry`, `Exit` | ⚠️ Optional |

### Important Notes

1. **Executions, Not Trades**: NinjaTrader exports individual fills (executions), not complete round-trip trades
2. **Quantity Always Positive**: Direction is indicated by `Rate` column (`Buy` or `Sell`)
3. **Local Timezone**: Times are in the user's local timezone (not UTC)
4. **Contract Notation**: Futures use contract notation (e.g., `ES 03-24` = Emini S&P 500 March 2024)

---

## 5. Import Profile

### JSON Import Profile

```json
{
  "name": "NinjaTrader - Executions Export",
  "brokerName": "ninjatrader",
  "version": "1.0",
  "description": "Import profile for NinjaTrader 8 executions CSV export",
  "fileFormat": {
    "type": "csv",
    "delimiter": ",",
    "encoding": "utf-8",
    "hasHeader": true,
    "skipRows": 0
  },
  "columnMapping": {
    "symbol": "Instrument",
    "direction": {
      "column": "Rate",
      "mapping": {
        "Buy": "LONG",
        "Sell": "SHORT"
      }
    },
    "openedAt": {
      "column": "Time",
      "format": "M/d/yyyy h:mm:ss a"
    },
    "closedAt": {
      "column": "Time",
      "format": "M/d/yyyy h:mm:ss a"
    },
    "entryPrice": "Avg fill price",
    "exitPrice": "Avg fill price",
    "quantity": "Quantity",
    "fees": "Commission"
  },
  "transformations": {
    "symbol": "extractRootSymbol",
    "quantity": "abs"
  },
  "validation": {
    "requiredColumns": ["Instrument", "Quantity", "Avg fill price", "Time", "Rate"],
    "dateRange": {
      "min": "2000-01-01",
      "max": "now"
    }
  },
  "tradeReconstruction": {
    "method": "positionTracking",
    "groupBy": "symbol",
    "sortBy": "time",
    "calculatePnL": true
  }
}
```

---

## 6. Trade Reconstruction

### Challenge: Executions → Trades

NinjaTrader exports **executions** (individual fills), not complete trades. We need to reconstruct round-trip trades from fills.

### Algorithm

```typescript
// Pseudo-code for trade reconstruction
function reconstructTrades(executions: Execution[]): Trade[] {
  const trades: Trade[] = [];
  const positionsBySymbol = new Map<string, Position>();

  // Sort by time
  executions.sort((a, b) => a.time - b.time);

  for (const exec of executions) {
    const symbol = normalizeSymbol(exec.instrument);
    let position = positionsBySymbol.get(symbol) || createNewPosition(symbol);

    // Update position
    if (exec.rate === 'Buy') {
      position.quantity += exec.quantity;
      position.entryFills.push(exec);
    } else {
      position.quantity -= exec.quantity;
      position.exitFills.push(exec);
    }

    // Check if position is closed (flat)
    if (position.quantity === 0) {
      // Create trade from position
      const trade = createTradeFromPosition(position);
      trades.push(trade);
      
      // Reset position
      positionsBySymbol.delete(symbol);
    } else {
      positionsBySymbol.set(symbol, position);
    }
  }

  return trades;
}
```

### Example

**Executions**:
```
1. Buy 1 ES @ 4500.00 (position: +1)
2. Sell 1 ES @ 4510.00 (position: 0) → Trade closed
```

**Reconstructed Trade**:
- Symbol: `ES`
- Direction: `LONG`
- Entry: `4500.00`
- Exit: `4510.00`
- Quantity: `1`
- PnL: `(4510 - 4500) * 1 * $50 = $500`

---

## 7. Symbol Normalization

### Futures Contract Notation

NinjaTrader uses contract notation for futures:

| NinjaTrader Format | Root Symbol | Description | Expiration |
|--------------------|-------------|-------------|------------|
| `ES 03-24` | `ES` | Emini S&P 500 | March 2024 |
| `NQ 06-24` | `NQ` | Emini NASDAQ | June 2024 |
| `YM 12-24` | `YM` | Emini Dow | December 2024 |
| `CL 09-24` | `CL` | Crude Oil | September 2024 |
| `GC 12-24` | `GC` | Gold | December 2024 |

### Normalization Strategy

**Option 1: Extract Root Symbol** (Recommended)
```typescript
function extractRootSymbol(instrument: string): string {
  // "ES 03-24" → "ES"
  return instrument.split(' ')[0].trim().toUpperCase();
}
```

**Option 2: Keep Full Contract**
```typescript
function normalizeContract(instrument: string): string {
  // "ES 03-24" → "ES_MAR24"
  const [root, month, year] = instrument.split(' ');
  return `${root}_${month}${year}`.toUpperCase();
}
```

**Recommendation**: Use **Option 1** (root symbol) for simplicity. Users can add contract details in tags/notes if needed.

---

## 8. Point Value Mapping

### Challenge: Calculate PnL

Futures contracts have different point values. To calculate PnL:

```
PnL = (exitPrice - entryPrice) * quantity * pointValue
```

### Common Futures Point Values

| Symbol | Contract | Point Value | Example |
|--------|----------|-------------|---------|
| `ES` | Emini S&P 500 | $50 | 1 point = $50 |
| `NQ` | Emini NASDAQ | $20 | 1 point = $20 |
| `YM` | Emini Dow | $5 | 1 point = $5 |
| `RTY` | Emini Russell 2000 | $50 | 1 point = $50 |
| `CL` | Crude Oil | $1,000 | 1 point = $1,000 |
| `GC` | Gold | $100 | 1 point = $100 |
| `SI` | Silver | $5,000 | 1 point = $5,000 |
| `6E` | Euro FX | $12,500 | 1 point = $12,500 |

### Implementation

```typescript
const POINT_VALUES: Record<string, number> = {
  ES: 50,
  NQ: 20,
  YM: 5,
  RTY: 50,
  CL: 1000,
  GC: 100,
  SI: 5000,
  '6E': 12500,
  // ... add more as needed
};

function calculatePnL(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  symbol: string
): number {
  const pointValue = POINT_VALUES[symbol] || 1; // Default to 1 if unknown
  return (exitPrice - entryPrice) * quantity * pointValue;
}
```

**Note**: For unknown contracts, default to point value of 1 and warn user to verify PnL.

---

## 9. Testing

### Test with Demo Account

1. **Create Simulated Account**:
   - Open NinjaTrader 8
   - Tools → Options → Simulated Data Feed
   - Enable simulated data (free)

2. **Place Test Trades**:
   - Open a chart (e.g., ES)
   - Place buy and sell orders
   - Execute trades

3. **Export Executions**:
   - Follow export instructions above
   - Save CSV file

4. **Test Import**:
   - Upload CSV to Trading Path Journal
   - Verify trades are reconstructed correctly
   - Check PnL calculations

### Test Cases

#### TC1: Simple Round Trip
```csv
Instrument,Quantity,Avg fill price,Time,Commission,Rate,Account,Order Id,Name
ES 03-24,1,4500.00,1/15/2024 9:30:00 AM,2.12,Buy,Sim101,1,Entry
ES 03-24,1,4510.00,1/15/2024 10:15:00 AM,2.12,Sell,Sim101,2,Exit
```

**Expected**:
- 1 trade: LONG ES, entry 4500, exit 4510, qty 1, PnL $500

#### TC2: Multiple Contracts
```csv
Instrument,Quantity,Avg fill price,Time,Commission,Rate,Account,Order Id,Name
NQ 03-24,2,15000.00,1/15/2024 11:00:00 AM,4.24,Buy,Sim101,3,Long
NQ 03-24,2,15050.00,1/15/2024 11:30:00 AM,4.24,Sell,Sim101,4,Close
```

**Expected**:
- 1 trade: LONG NQ, entry 15000, exit 15050, qty 2, PnL $2000

#### TC3: Partial Fills
```csv
Instrument,Quantity,Avg fill price,Time,Commission,Rate,Account,Order Id,Name
ES 03-24,1,4500.00,1/15/2024 9:30:00 AM,2.12,Buy,Sim101,5,Entry1
ES 03-24,1,4501.00,1/15/2024 9:31:00 AM,2.12,Buy,Sim101,5,Entry2
ES 03-24,2,4510.00,1/15/2024 10:15:00 AM,4.24,Sell,Sim101,6,Exit
```

**Expected**:
- 1 trade: LONG ES, entry 4500.50 (avg), exit 4510, qty 2, PnL $950

#### TC4: Short Trade
```csv
Instrument,Quantity,Avg fill price,Time,Commission,Rate,Account,Order Id,Name
CL 03-24,1,75.50,1/15/2024 14:00:00 PM,2.12,Sell,Sim101,7,Short
CL 03-24,1,75.00,1/15/2024 15:00:00 PM,2.12,Buy,Sim101,8,Cover
```

**Expected**:
- 1 trade: SHORT CL, entry 75.50, exit 75.00, qty 1, PnL $500

---

## 10. Troubleshooting

### Common Issues

#### Issue 1: "No Trades Found"

**Symptoms**: CSV uploads but no trades imported

**Causes**:
- Only open positions (not closed)
- Incorrect date format
- Missing required columns

**Solutions**:
1. Ensure trades are closed (position = 0)
2. Check date range includes closed trades
3. Verify CSV has all required columns

#### Issue 2: "Incorrect PnL"

**Symptoms**: PnL doesn't match NinjaTrader

**Causes**:
- Point value not mapped
- Commission not included
- Partial fills not averaged

**Solutions**:
1. Check point value mapping for your contract
2. Verify commission is included in CSV
3. Report issue if persistent

#### Issue 3: "Symbol Not Recognized"

**Symptoms**: Symbol shows as unknown

**Causes**:
- Non-standard contract notation
- Forex pair format
- Custom instrument

**Solutions**:
1. Manually edit symbol after import
2. Report issue with sample CSV
3. Create custom import profile

#### Issue 4: "Duplicate Trades"

**Symptoms**: Same trade appears multiple times

**Causes**:
- Re-importing same CSV
- Deduplication failed

**Solutions**:
1. Check import history
2. Delete duplicates manually
3. Use date range filter to avoid overlap

---

## 11. Known Limitations

### Current Limitations

1. **Point Values**: Limited to common contracts (ES, NQ, YM, CL, GC, etc.)
   - **Workaround**: Add custom point values on request
   - **Future**: User-configurable point value mapping

2. **Timezone**: Assumes local timezone
   - **Workaround**: Manual adjustment if needed
   - **Future**: Timezone selection in import settings

3. **Multi-Leg Orders**: Spreads not supported
   - **Workaround**: Import legs separately
   - **Future**: Spread detection and grouping

4. **Rollover**: Contract rollover not detected
   - **Workaround**: Treat as separate positions
   - **Future**: Rollover detection

---

## 12. Future Enhancements

### Phase 2: NinjaScript Addon

**Goal**: Automate export from NinjaTrader

**Features**:
- C# addon for NT8
- Auto-export to JSON
- Direct upload to Trading Path Journal
- Real-time sync (optional)

**Timeline**: 3-6 months (based on user demand)

### Phase 3: ATI Integration

**Goal**: Real-time sync via TCP/IP

**Features**:
- Connect to running NT8 instance
- Real-time execution sync
- No manual export needed

**Timeline**: 6-12 months (based on user demand)

---

## 13. Support

### Getting Help

**Documentation**:
- NinjaTrader Docs: https://ninjatrader.com/support/helpGuides/nt8/
- This Guide: `docs/brokers/csv-formats/ninjatrader.md`

**Support Channels**:
- Email: support@tradingjournal.com
- Discord: [Link]
- GitHub Issues: [Link]

**Reporting Issues**:
1. Check [Troubleshooting](#troubleshooting) first
2. Attach sample CSV (anonymized)
3. Include:
   - NinjaTrader version
   - Error message
   - Expected vs actual result

---

## 14. Developer Notes

### Implementation Files

- **Broker Detection**: `src/services/broker-detection-service.ts`
- **Import Service**: `src/services/import-service.ts`
- **Import Profile Seed**: `prisma/seed-import-profiles.ts`

### Trade Reconstruction Logic

Located in `src/services/import-service.ts`:

```typescript
function reconstructTradesFromExecutions(
  executions: Execution[],
  symbol: string
): Trade[] {
  // Implementation details in import-service.ts
  // Uses position tracking algorithm
}
```

### Symbol Normalization

```typescript
function normalizeNinjaTraderSymbol(instrument: string): string {
  // "ES 03-24" → "ES"
  return instrument.split(' ')[0].trim().toUpperCase();
}
```

---

**Maintained By**: Development Team  
**Last Updated**: 2026-01-17  
**Version**: 1.0  
**Status**: ✅ Complete
