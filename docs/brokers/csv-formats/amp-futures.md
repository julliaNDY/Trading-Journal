# 📊 AMP Futures - CSV Format Documentation

> **Broker**: AMP Futures  
> **Platforms**: CQG Desktop, CQG QTrader, Rithmic Trader Pro  
> **Last Updated**: 2026-01-17  
> **Status**: Documented & Ready for Implementation

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Supported Platforms](#supported-platforms)
3. [CQG Desktop Format](#cqg-desktop-format)
4. [CQG QTrader Format](#cqg-qtrader-format)
5. [Rithmic Trader Pro Format](#rithmic-trader-pro-format)
6. [Trade Reconstruction](#trade-reconstruction)
7. [Symbol Normalization](#symbol-normalization)
8. [Point Value Mapping](#point-value-mapping)
9. [Import Profiles](#import-profiles)
10. [Testing](#testing)

---

## 1. Overview

AMP Futures does not provide a direct API for retail traders. Instead, users export trade data from their trading platform (CQG, Rithmic, TradingView, etc.) and import the CSV file into our application.

### Supported Export Methods

| Platform | Export Method | Complexity | Recommended |
|----------|---------------|------------|-------------|
| **CQG Desktop** | Orders & Positions → Fills → Export CSV | Low | ✅ **YES** |
| **CQG QTrader** | Trade History → Export CSV | Low | ✅ **YES** |
| **Rithmic Trader Pro** | Fill History → Export CSV | Low | ✅ **YES** |
| **NinjaTrader 8** | Order History → Export | Low | ✅ **YES** (reuse existing) |
| **TradingView** | Order History → Export CSV | Low | ⏸️ Future |

---

## 2. Supported Platforms

### CQG Desktop

**Platform**: CQG Integrated Client (Desktop)  
**Version**: All versions  
**Cost**: Included with AMP account (varies by plan)

**Export Location**:
```
Orders & Positions → Fills → Right-click → Export to CSV
```

**File Format**: CSV (comma-separated)  
**Encoding**: UTF-8  
**Date Format**: MM/DD/YYYY  
**Time Format**: HH:mm:ss

### CQG QTrader

**Platform**: CQG QTrader (Web-based)  
**Version**: All versions  
**Cost**: Included with AMP account

**Export Location**:
```
Trade History → Export → CSV
```

**File Format**: CSV (comma-separated)  
**Encoding**: UTF-8  
**Date Format**: YYYY-MM-DD (ISO)  
**Time Format**: HH:MM:SS (24-hour)

### Rithmic Trader Pro

**Platform**: Rithmic Trader Pro (Desktop)  
**Version**: All versions  
**Cost**: Included with AMP Rithmic account

**Export Location**:
```
Fill History → Export → CSV
```

**File Format**: CSV (comma-separated)  
**Encoding**: UTF-8  
**Date Format**: YYYY-MM-DD  
**Time Format**: HH:mm:ss

---

## 3. CQG Desktop Format

### Export Instructions

1. Open CQG Desktop
2. Navigate to **Orders & Positions** tab
3. Click on **Fills** sub-tab
4. Select date range (or "All")
5. Right-click on the fills table
6. Select **Export to CSV**
7. Save file (e.g., `cqg-fills-2026-01.csv`)

### CSV Structure

```csv
Account,Date,Time,Symbol,Side,Quantity,Price,Commission,Net P/L
12345678,01/15/2026,09:30:15,ESH26,Buy,1,4850.00,0.85,0.00
12345678,01/15/2026,09:35:42,ESH26,Sell,1,4852.50,0.85,125.00
12345678,01/15/2026,10:15:30,NQH26,Buy,2,17500.00,0.85,0.00
12345678,01/15/2026,10:22:18,NQH26,Sell,2,17525.00,0.85,200.00
12345678,01/15/2026,14:05:12,YMH26,Buy,1,38500,0.85,0.00
12345678,01/15/2026,14:12:45,YMH26,Sell,1,38520,0.85,100.00
```

### Column Definitions

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| **Account** | String | AMP account number | 12345678 |
| **Date** | Date | Fill date (MM/DD/YYYY) | 01/15/2026 |
| **Time** | Time | Fill time (HH:mm:ss) | 09:30:15 |
| **Symbol** | String | Futures contract symbol | ESH26 |
| **Side** | String | Buy or Sell | Buy, Sell |
| **Quantity** | Integer | Number of contracts | 1, 2, 10 |
| **Price** | Decimal | Fill price | 4850.00 |
| **Commission** | Decimal | Commission per fill | 0.85 |
| **Net P/L** | Decimal | Realized P&L (USD) | 125.00, -50.00 |

### Symbol Format

**Pattern**: `{ROOT}{MONTH}{YEAR}`

Examples:
- `ESH26` = E-mini S&P 500, March 2026
- `NQH26` = E-mini NASDAQ-100, March 2026
- `YMH26` = E-mini Dow Jones, March 2026
- `CLG26` = Crude Oil, February 2026

**Month Codes**:
- F = January
- G = February
- H = March
- J = April
- K = May
- M = June
- N = July
- Q = August
- U = September
- V = October
- X = November
- Z = December

### Sample Data

```csv
Account,Date,Time,Symbol,Side,Quantity,Price,Commission,Net P/L
12345678,01/15/2026,09:30:15,ESH26,Buy,1,4850.00,0.85,0.00
12345678,01/15/2026,09:35:42,ESH26,Sell,1,4852.50,0.85,125.00
12345678,01/15/2026,10:15:30,NQH26,Buy,2,17500.00,1.70,0.00
12345678,01/15/2026,10:22:18,NQH26,Sell,2,17525.00,1.70,200.00
12345678,01/15/2026,11:45:22,CLG26,Buy,1,75.50,2.50,0.00
12345678,01/15/2026,12:05:18,CLG26,Sell,1,75.80,2.50,300.00
12345678,01/15/2026,14:05:12,YMH26,Buy,1,38500,0.85,0.00
12345678,01/15/2026,14:12:45,YMH26,Sell,1,38520,0.85,100.00
12345678,01/15/2026,15:30:00,GCG26,Buy,1,2050.50,2.50,0.00
12345678,01/15/2026,15:45:30,GCG26,Sell,1,2048.00,2.50,-250.00
```

---

## 4. CQG QTrader Format

### Export Instructions

1. Log in to CQG QTrader (web interface)
2. Navigate to **Trade History**
3. Select date range
4. Click **Export** button
5. Select **CSV** format
6. Save file

### CSV Structure

**Similar to CQG Desktop** with these differences:

```csv
Account,Date,Time,Symbol,Side,Quantity,Price,Commission,P&L
12345678,2026-01-15,09:30:15,ESH26,Buy,1,4850.00,0.85,0.00
12345678,2026-01-15,09:35:42,ESH26,Sell,1,4852.50,0.85,125.00
```

### Key Differences from CQG Desktop

| Feature | CQG Desktop | CQG QTrader |
|---------|-------------|-------------|
| Date Format | MM/DD/YYYY | YYYY-MM-DD |
| Column Name | "Net P/L" | "P&L" |
| Encoding | UTF-8 | UTF-8 |
| Symbol Format | Same | Same |

---

## 5. Rithmic Trader Pro Format

### Export Instructions

1. Open Rithmic Trader Pro
2. Navigate to **Fill History**
3. Select date range
4. Click **Export** button
5. Save as CSV

### CSV Structure

```csv
Time,Account,Symbol,B/S,Qty,Price,Exch,P&L,Commission
09:30:15,12345,ES 03-26,B,1,4850.00,CME,0.00,0.85
09:35:42,12345,ES 03-26,S,1,4852.50,CME,125.00,0.85
10:15:30,12345,NQ 03-26,B,2,17500.00,CME,0.00,1.70
10:22:18,12345,NQ 03-26,S,2,17525.00,CME,200.00,1.70
```

### Column Definitions

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| **Time** | Time | Fill time (HH:mm:ss) | 09:30:15 |
| **Account** | String | AMP account number | 12345 |
| **Symbol** | String | Futures contract (space-separated) | ES 03-26 |
| **B/S** | String | Buy (B) or Sell (S) | B, S |
| **Qty** | Integer | Number of contracts | 1, 2, 10 |
| **Price** | Decimal | Fill price | 4850.00 |
| **Exch** | String | Exchange code | CME, CBOT, NYMEX |
| **P&L** | Decimal | Realized P&L (USD) | 125.00, -50.00 |
| **Commission** | Decimal | Commission per fill | 0.85 |

### Symbol Format

**Pattern**: `{ROOT} {MONTH}-{YEAR}`

Examples:
- `ES 03-26` = E-mini S&P 500, March 2026
- `NQ 03-26` = E-mini NASDAQ-100, March 2026
- `YM 03-26` = E-mini Dow Jones, March 2026
- `CL 02-26` = Crude Oil, February 2026

**Key Difference**: Space-separated format instead of concatenated

### Exchange Codes

| Code | Exchange |
|------|----------|
| CME | Chicago Mercantile Exchange |
| CBOT | Chicago Board of Trade |
| NYMEX | New York Mercantile Exchange |
| COMEX | Commodity Exchange |
| ICE | Intercontinental Exchange |
| EUREX | Eurex (European Exchange) |

### Sample Data

```csv
Time,Account,Symbol,B/S,Qty,Price,Exch,P&L,Commission
09:30:15,12345,ES 03-26,B,1,4850.00,CME,0.00,0.85
09:35:42,12345,ES 03-26,S,1,4852.50,CME,125.00,0.85
10:15:30,12345,NQ 03-26,B,2,17500.00,CME,0.00,1.70
10:22:18,12345,NQ 03-26,S,2,17525.00,CME,200.00,1.70
11:45:22,12345,CL 02-26,B,1,75.50,NYMEX,0.00,2.50
12:05:18,12345,CL 02-26,S,1,75.80,NYMEX,300.00,2.50
14:05:12,12345,YM 03-26,B,1,38500,CBOT,0.00,0.85
14:12:45,12345,YM 03-26,S,1,38520,CBOT,100.00,0.85
15:30:00,12345,GC 02-26,B,1,2050.50,COMEX,0.00,2.50
15:45:30,12345,GC 02-26,S,1,2048.00,COMEX,-250.00,2.50
```

---

## 6. Trade Reconstruction

### Challenge

CSV exports contain **individual fills**, not complete trades. We need to reconstruct trades by matching buy/sell fills.

### FIFO Algorithm

**First In, First Out** - Match the oldest open position with the newest closing position.

```typescript
interface Fill {
  timestamp: Date;
  symbol: string;
  side: 'Buy' | 'Sell';
  quantity: number;
  price: number;
  commission: number;
  pnl: number;
}

interface Trade {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  openedAt: Date;
  closedAt: Date;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  realizedPnlUsd: number;
  fees: number;
}

function reconstructTrades(fills: Fill[]): Trade[] {
  // Sort fills by timestamp
  fills.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const openPositions: Map<string, Fill[]> = new Map();
  const completedTrades: Trade[] = [];

  for (const fill of fills) {
    const key = normalizeSymbol(fill.symbol); // ES, NQ, YM, etc.

    if (fill.side === 'Buy') {
      // Opening LONG position
      const opens = openPositions.get(key) || [];
      opens.push(fill);
      openPositions.set(key, opens);
    } else {
      // Closing LONG position (FIFO)
      const opens = openPositions.get(key);
      if (opens && opens.length > 0) {
        const openFill = opens.shift()!; // FIFO
        
        const trade: Trade = {
          symbol: key,
          direction: 'LONG',
          openedAt: openFill.timestamp,
          closedAt: fill.timestamp,
          entryPrice: openFill.price,
          exitPrice: fill.price,
          quantity: Math.min(openFill.quantity, fill.quantity),
          realizedPnlUsd: fill.pnl,
          fees: openFill.commission + fill.commission,
        };

        completedTrades.push(trade);
      }
    }
  }

  return completedTrades;
}
```

### Handling Multiple Contracts

If a fill has `quantity > 1`, treat it as multiple individual fills:

```typescript
function expandFills(fills: Fill[]): Fill[] {
  const expanded: Fill[] = [];

  for (const fill of fills) {
    for (let i = 0; i < fill.quantity; i++) {
      expanded.push({
        ...fill,
        quantity: 1,
        commission: fill.commission / fill.quantity,
        pnl: fill.pnl / fill.quantity,
      });
    }
  }

  return expanded;
}
```

### Handling Partial Fills

If an order is partially filled multiple times:

```csv
09:30:15,ES 03-26,B,1,4850.00,0.85,0.00
09:30:16,ES 03-26,B,1,4850.25,0.85,0.00
09:35:42,ES 03-26,S,2,4852.50,1.70,250.00
```

Reconstruct as:
1. Trade 1: Buy @ 4850.00, Sell @ 4852.50 (FIFO)
2. Trade 2: Buy @ 4850.25, Sell @ 4852.50 (FIFO)

---

## 7. Symbol Normalization

### Goal

Convert platform-specific symbols to our standard format.

### Symbol Mapping

| Platform Symbol | Normalized | Description |
|----------------|------------|-------------|
| ESH26 | ES | E-mini S&P 500 |
| ES 03-26 | ES | E-mini S&P 500 |
| NQH26 | NQ | E-mini NASDAQ-100 |
| NQ 03-26 | NQ | E-mini NASDAQ-100 |
| YMH26 | YM | E-mini Dow Jones |
| YM 03-26 | YM | E-mini Dow Jones |
| RTYM26 | RTY | E-mini Russell 2000 |
| RTY 06-26 | RTY | E-mini Russell 2000 |
| CLG26 | CL | Crude Oil |
| CL 02-26 | CL | Crude Oil |
| GCG26 | GC | Gold |
| GC 02-26 | GC | Gold |

### Normalization Functions

```typescript
function normalizeSymbol(symbol: string): string {
  // CQG Desktop format: ESH26, NQH26, etc.
  const cqgMatch = symbol.match(/^([A-Z]+)[A-Z]\d{2}$/);
  if (cqgMatch) {
    return cqgMatch[1]; // Extract root symbol
  }

  // Rithmic format: ES 03-26, NQ 03-26, etc.
  const rithmicMatch = symbol.match(/^([A-Z]+)\s+\d{2}-\d{2}$/);
  if (rithmicMatch) {
    return rithmicMatch[1]; // Extract root symbol
  }

  // Unknown format - return as-is
  return symbol.trim().toUpperCase();
}
```

### Contract Month Extraction

If we want to preserve contract month (for analytics):

```typescript
interface NormalizedSymbol {
  root: string;       // ES, NQ, YM
  month: string;      // H (March), M (June), etc.
  year: string;       // 26 (2026)
  full: string;       // ESH26
}

function parseSymbol(symbol: string): NormalizedSymbol {
  // CQG format: ESH26
  const cqgMatch = symbol.match(/^([A-Z]+)([A-Z])(\d{2})$/);
  if (cqgMatch) {
    return {
      root: cqgMatch[1],
      month: cqgMatch[2],
      year: cqgMatch[3],
      full: symbol,
    };
  }

  // Rithmic format: ES 03-26
  const rithmicMatch = symbol.match(/^([A-Z]+)\s+(\d{2})-(\d{2})$/);
  if (rithmicMatch) {
    const monthCode = getMonthCode(parseInt(rithmicMatch[2]));
    return {
      root: rithmicMatch[1],
      month: monthCode,
      year: rithmicMatch[3],
      full: `${rithmicMatch[1]}${monthCode}${rithmicMatch[3]}`,
    };
  }

  throw new Error(`Unknown symbol format: ${symbol}`);
}

function getMonthCode(month: number): string {
  const codes = ['F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z'];
  return codes[month - 1];
}
```

---

## 8. Point Value Mapping

### Why Point Values Matter

Futures contracts have different point values (tick size × value per tick).

Example:
- **ES** (E-mini S&P 500): 1 point = $50
- **NQ** (E-mini NASDAQ-100): 1 point = $20
- **YM** (E-mini Dow Jones): 1 point = $5
- **CL** (Crude Oil): 1 point = $1,000

### Point Value Table

| Symbol | Name | Point Value | Tick Size | Tick Value |
|--------|------|-------------|-----------|------------|
| ES | E-mini S&P 500 | $50 | 0.25 | $12.50 |
| NQ | E-mini NASDAQ-100 | $20 | 0.25 | $5.00 |
| YM | E-mini Dow Jones | $5 | 1.00 | $5.00 |
| RTY | E-mini Russell 2000 | $50 | 0.10 | $5.00 |
| CL | Crude Oil | $1,000 | 0.01 | $10.00 |
| GC | Gold | $100 | 0.10 | $10.00 |
| SI | Silver | $5,000 | 0.005 | $25.00 |
| NG | Natural Gas | $10,000 | 0.001 | $10.00 |
| ZB | 30-Year T-Bond | $1,000 | 1/32 | $31.25 |
| ZN | 10-Year T-Note | $1,000 | 1/64 | $15.625 |

### Auto-Assign Point Values

```typescript
const POINT_VALUES: Record<string, number> = {
  ES: 50,
  NQ: 20,
  YM: 5,
  RTY: 50,
  CL: 1000,
  GC: 100,
  SI: 5000,
  NG: 10000,
  ZB: 1000,
  ZN: 1000,
  // Add more as needed
};

function getPointValue(symbol: string): number {
  const normalized = normalizeSymbol(symbol);
  return POINT_VALUES[normalized] || 1; // Default to 1 if unknown
}
```

---

## 9. Import Profiles

### CQG Desktop Import Profile

**File**: `prisma/seed-import-profiles.ts` (add to existing)

```typescript
{
  id: 'cqg-desktop-amp',
  name: 'CQG Desktop (AMP Futures)',
  broker: 'AMP_FUTURES',
  description: 'Import trade history from CQG Desktop platform',
  fileFormat: 'CSV',
  delimiter: ',',
  hasHeader: true,
  dateFormat: 'MM/DD/YYYY',
  timeFormat: 'HH:mm:ss',
  columnMapping: {
    symbol: 'Symbol',
    side: 'Side',
    quantity: 'Quantity',
    price: 'Price',
    commission: 'Commission',
    pnl: 'Net P/L',
    date: 'Date',
    time: 'Time',
  },
  transformations: {
    symbol: {
      type: 'regex',
      pattern: '^([A-Z]+)[A-Z]\\d{2}$',
      replacement: '$1',
    },
    side: {
      type: 'map',
      mapping: {
        Buy: 'LONG',
        Sell: 'SHORT',
      },
    },
    datetime: {
      type: 'combine',
      fields: ['date', 'time'],
      format: 'MM/DD/YYYY HH:mm:ss',
    },
  },
  sampleData: 'Account,Date,Time,Symbol,Side,Quantity,Price,Commission,Net P/L\n12345678,01/15/2026,09:30:15,ESH26,Buy,1,4850.00,0.85,0.00',
  instructions: '1. Open CQG Desktop\n2. Go to Orders & Positions → Fills\n3. Right-click → Export to CSV\n4. Upload the CSV file here',
}
```

### Rithmic Trader Pro Import Profile

```typescript
{
  id: 'rithmic-trader-pro-amp',
  name: 'Rithmic Trader Pro (AMP Futures)',
  broker: 'AMP_FUTURES',
  description: 'Import fill history from Rithmic Trader Pro',
  fileFormat: 'CSV',
  delimiter: ',',
  hasHeader: true,
  dateFormat: 'YYYY-MM-DD',
  timeFormat: 'HH:mm:ss',
  columnMapping: {
    symbol: 'Symbol',
    side: 'B/S',
    quantity: 'Qty',
    price: 'Price',
    commission: 'Commission',
    pnl: 'P&L',
    time: 'Time',
    exchange: 'Exch',
  },
  transformations: {
    symbol: {
      type: 'regex',
      pattern: '^([A-Z]+)\\s+\\d{2}-\\d{2}$',
      replacement: '$1',
    },
    side: {
      type: 'map',
      mapping: {
        B: 'LONG',
        S: 'SHORT',
      },
    },
  },
  sampleData: 'Time,Account,Symbol,B/S,Qty,Price,Exch,P&L,Commission\n09:30:15,12345,ES 03-26,B,1,4850.00,CME,0.00,0.85',
  instructions: '1. Open Rithmic Trader Pro\n2. Go to Fill History\n3. Click Export → CSV\n4. Upload the CSV file here',
}
```

---

## 10. Testing

### Test Cases

#### TC1: CQG Desktop Import
- [ ] Import CQG Desktop CSV with 10 trades
- [ ] Verify all trades imported correctly
- [ ] Verify P&L calculations match
- [ ] Verify commissions are correct
- [ ] Verify symbols normalized (ESH26 → ES)

#### TC2: Rithmic Trader Pro Import
- [ ] Import Rithmic CSV with 10 trades
- [ ] Verify all trades imported correctly
- [ ] Verify P&L calculations match
- [ ] Verify symbols normalized (ES 03-26 → ES)
- [ ] Verify exchange data preserved

#### TC3: Trade Reconstruction (FIFO)
- [ ] Test with simple buy-sell pairs
- [ ] Test with multiple contracts (quantity > 1)
- [ ] Test with partial fills
- [ ] Test with mixed symbols (ES, NQ, YM)
- [ ] Verify FIFO matching is correct

#### TC4: Symbol Normalization
- [ ] Test ESH26 → ES
- [ ] Test ES 03-26 → ES
- [ ] Test NQH26 → NQ
- [ ] Test CL 02-26 → CL
- [ ] Test unknown symbols (pass-through)

#### TC5: Point Value Assignment
- [ ] Verify ES = $50
- [ ] Verify NQ = $20
- [ ] Verify YM = $5
- [ ] Verify CL = $1000
- [ ] Verify unknown symbols default to $1

### Sample Test Data

**File**: `docs/brokers/csv-formats/samples/cqg-desktop-amp-sample.csv`

```csv
Account,Date,Time,Symbol,Side,Quantity,Price,Commission,Net P/L
12345678,01/15/2026,09:30:15,ESH26,Buy,1,4850.00,0.85,0.00
12345678,01/15/2026,09:35:42,ESH26,Sell,1,4852.50,0.85,125.00
12345678,01/15/2026,10:15:30,NQH26,Buy,2,17500.00,1.70,0.00
12345678,01/15/2026,10:22:18,NQH26,Sell,2,17525.00,1.70,200.00
12345678,01/15/2026,11:45:22,CLG26,Buy,1,75.50,2.50,0.00
12345678,01/15/2026,12:05:18,CLG26,Sell,1,75.80,2.50,300.00
12345678,01/15/2026,14:05:12,YMH26,Buy,1,38500,0.85,0.00
12345678,01/15/2026,14:12:45,YMH26,Sell,1,38520,0.85,100.00
12345678,01/15/2026,15:30:00,GCG26,Buy,1,2050.50,2.50,0.00
12345678,01/15/2026,15:45:30,GCG26,Sell,1,2048.00,2.50,-250.00
```

**File**: `docs/brokers/csv-formats/samples/rithmic-trader-pro-amp-sample.csv`

```csv
Time,Account,Symbol,B/S,Qty,Price,Exch,P&L,Commission
09:30:15,12345,ES 03-26,B,1,4850.00,CME,0.00,0.85
09:35:42,12345,ES 03-26,S,1,4852.50,CME,125.00,0.85
10:15:30,12345,NQ 03-26,B,2,17500.00,CME,0.00,1.70
10:22:18,12345,NQ 03-26,S,2,17525.00,CME,200.00,1.70
11:45:22,12345,CL 02-26,B,1,75.50,NYMEX,0.00,2.50
12:05:18,12345,CL 02-26,S,1,75.80,NYMEX,300.00,2.50
```

---

## 11. Known Issues & Limitations

### Issue 1: No Real-time Sync
**Impact**: Users must manually export and import CSV files  
**Workaround**: Provide clear instructions and one-click import  
**Future**: Consider NinjaScript automation or platform API

### Issue 2: FIFO Assumption
**Impact**: If user uses LIFO accounting, trades may not match  
**Workaround**: Allow manual trade editing  
**Future**: Support LIFO option

### Issue 3: Symbol Variations
**Impact**: Some symbols may not normalize correctly  
**Workaround**: Comprehensive symbol mapping table  
**Future**: Allow user to override symbol normalization

### Issue 4: Point Value Defaults
**Impact**: Unknown symbols default to $1 point value  
**Workaround**: Extensive point value table  
**Future**: Allow user to manually set point value

---

## 12. References

### Official Documentation
- **AMP Futures**: https://www.ampfutures.com
- **CQG Desktop**: https://www.cqg.com/products/cqg-desktop
- **Rithmic**: https://rithmic.com

### Community Resources
- **Elite Trader**: https://www.elitetrader.com/et/forums/futures.4/
- **Futures.io**: https://futures.io

---

**Document Status**: ✅ Complete  
**Ready for Implementation**: ✅ YES  
**Estimated Development Time**: 3-5 days

---

**Prepared By**: Development Team  
**Date**: 2026-01-17  
**Version**: 1.0
