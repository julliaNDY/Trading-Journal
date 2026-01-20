# 📊 CSV Format Documentation - Apex Trader Funding (Rithmic)

> **Broker**: Apex Trader Funding  
> **Platform**: Rithmic R|Trader Pro  
> **Format**: CSV (Comma-Separated Values)  
> **Last Updated**: 2026-01-17

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Export Instructions](#export-instructions)
3. [CSV Format Specification](#csv-format-specification)
4. [Import Profile](#import-profile)
5. [Symbol Normalization](#symbol-normalization)
6. [Trade Reconstruction](#trade-reconstruction)
7. [Point Value Mapping](#point-value-mapping)
8. [Validation Rules](#validation-rules)
9. [Troubleshooting](#troubleshooting)
10. [Sample Data](#sample-data)

---

## 1. Overview

### Platform Information

**Rithmic R|Trader Pro** is the desktop trading platform used by Apex Trader Funding and many other prop firms. It provides professional-grade futures trading with CSV export capabilities.

**Key Features**:
- Real-time futures trading
- Advanced charting
- Trade history export (CSV)
- Multiple account support
- Detailed execution reports

### CSV Export Capabilities

- ✅ Full trade history
- ✅ All closed trades
- ✅ Commissions included
- ✅ P/L calculated
- ✅ Millisecond timestamps
- ✅ Multiple accounts
- ❌ No open positions (only closed trades)
- ❌ No order book data

---

## 2. Export Instructions

### Step-by-Step Guide

#### Step 1: Open R|Trader Pro

1. Launch Rithmic R|Trader Pro application
2. Log in with your Apex Trader Funding credentials
3. Wait for platform to connect

![R|Trader Pro Login](../images/rithmic-login.png)

#### Step 2: Navigate to Reports

1. Click on **Window** menu
2. Select **Reports** > **Trade History**
3. Trade History window will open

![Trade History Window](../images/rithmic-trade-history.png)

#### Step 3: Select Date Range

1. In Trade History window, click **Date Range** dropdown
2. Select desired date range:
   - Today
   - Yesterday
   - Last 7 Days
   - Last 30 Days
   - Last 90 Days
   - Custom Range (specify start/end dates)

![Date Range Selection](../images/rithmic-date-range.png)

#### Step 4: Export to CSV

1. Click **Export** button (top right)
2. Select **Export to CSV**
3. Choose save location
4. Click **Save**

![Export Button](../images/rithmic-export.png)

#### Step 5: Verify Export

1. Open exported CSV file in Excel or text editor
2. Verify columns are present
3. Check that trades are listed
4. Confirm date range is correct

---

## 3. CSV Format Specification

### File Structure

**File Extension**: `.csv`  
**Encoding**: UTF-8  
**Delimiter**: Comma (`,`)  
**Line Ending**: CRLF (`\r\n`) or LF (`\n`)  
**Header Row**: Yes (first row contains column names)

### Column Specification

| Column Name | Type | Required | Description | Example |
|-------------|------|----------|-------------|---------|
| `Date` | String | ✅ Yes | Trade date | `01/15/2026` or `2026-01-15` |
| `Time` | String | ✅ Yes | Trade time (local timezone) | `09:30:15.123` |
| `Symbol` | String | ✅ Yes | Futures contract symbol | `ESH26` |
| `Side` | String | ✅ Yes | Buy or Sell | `Buy`, `Sell` |
| `Quantity` | Integer | ✅ Yes | Number of contracts | `1`, `2`, `10` |
| `Price` | Decimal | ✅ Yes | Execution price | `4850.00`, `4852.50` |
| `Commission` | Decimal | ⚠️ Optional | Commission per fill | `2.50`, `5.00` |
| `Net P/L` | Decimal | ⚠️ Optional | Realized profit/loss | `125.00`, `-50.00` |
| `Account` | String | ⚠️ Optional | Account ID | `PA123456`, `PA789012` |
| `Order ID` | String | ⚠️ Optional | Order identifier | `ORD-12345` |
| `Execution ID` | String | ⚠️ Optional | Execution identifier | `EXE-67890` |

### Data Types

**Date Formats** (auto-detected):
- `MM/DD/YYYY` (US format): `01/15/2026`
- `YYYY-MM-DD` (ISO format): `2026-01-15`
- `DD/MM/YYYY` (EU format): `15/01/2026`

**Time Formats**:
- `HH:mm:ss` (24-hour): `09:30:15`
- `HH:mm:ss.SSS` (with milliseconds): `09:30:15.123`
- `hh:mm:ss AM/PM` (12-hour): `09:30:15 AM`

**Symbol Format**:
- Rithmic notation: `ESH26` (root + month code + year)
- Root: 1-3 letters (e.g., `ES`, `NQ`, `YM`, `CL`)
- Month code: Single letter (F, G, H, J, K, M, N, Q, U, V, X, Z)
- Year: 2 digits (e.g., `26` for 2026)

**Side Values**:
- `Buy`, `Long`, `B`, `L` → `LONG`
- `Sell`, `Short`, `S`, `SH` → `SHORT`

---

## 4. Import Profile

### Import Profile JSON

```json
{
  "id": "apex-rithmic-csv",
  "name": "Apex Trader Funding (Rithmic)",
  "brokerType": "APEX_TRADER",
  "fileFormat": "CSV",
  "description": "Import trades from Apex Trader Funding via Rithmic R|Trader Pro CSV export",
  "columnMapping": {
    "date": "Date",
    "time": "Time",
    "symbol": "Symbol",
    "side": "Side",
    "quantity": "Quantity",
    "price": "Price",
    "commission": "Commission",
    "pnl": "Net P/L",
    "account": "Account",
    "orderId": "Order ID",
    "executionId": "Execution ID"
  },
  "transformations": {
    "symbol": {
      "type": "futures_contract",
      "pattern": "^([A-Z]{1,3})([FGHJKMNQUVXZ])([0-9]{2})$",
      "normalize": true
    },
    "side": {
      "type": "enum",
      "mapping": {
        "Buy": "LONG",
        "Sell": "SHORT",
        "Long": "LONG",
        "Short": "SHORT",
        "B": "LONG",
        "S": "SHORT",
        "L": "LONG",
        "SH": "SHORT"
      }
    },
    "datetime": {
      "type": "combine",
      "fields": ["date", "time"],
      "formats": [
        "MM/DD/YYYY HH:mm:ss",
        "YYYY-MM-DD HH:mm:ss",
        "DD/MM/YYYY HH:mm:ss",
        "MM/DD/YYYY HH:mm:ss.SSS",
        "YYYY-MM-DD HH:mm:ss.SSS"
      ],
      "timezone": "America/Chicago"
    }
  },
  "tradeReconstruction": {
    "method": "fill_based",
    "groupBy": ["symbol", "account"],
    "matchLogic": "fifo",
    "calculatePnL": true,
    "includeCommissions": true
  },
  "validation": {
    "requiredColumns": ["Date", "Time", "Symbol", "Side", "Quantity", "Price"],
    "symbolPattern": "^[A-Z]{1,3}[FGHJKMNQUVXZ][0-9]{2}$",
    "quantityMin": 0.01,
    "quantityMax": 1000,
    "priceMin": 0.01,
    "priceMax": 1000000
  }
}
```

---

## 5. Symbol Normalization

### Futures Contract Notation

Rithmic uses standard CME futures notation:

**Format**: `[ROOT][MONTH_CODE][YEAR]`

**Examples**:
- `ESH26` = E-mini S&P 500, March 2026
- `NQM26` = E-mini NASDAQ-100, June 2026
- `YMZ26` = E-mini Dow, December 2026
- `RTYH26` = E-mini Russell 2000, March 2026
- `CLF26` = Crude Oil, January 2026
- `GCG26` = Gold, February 2026

### Month Code Mapping

| Code | Month | Contracts |
|------|-------|-----------|
| `F` | January | All futures |
| `G` | February | All futures |
| `H` | March | All futures |
| `J` | April | All futures |
| `K` | May | All futures |
| `M` | June | All futures |
| `N` | July | All futures |
| `Q` | August | All futures |
| `U` | September | All futures |
| `V` | October | All futures |
| `X` | November | All futures |
| `Z` | December | All futures |

### Common Futures Roots

| Root | Name | Exchange | Point Value | Tick Size |
|------|------|----------|-------------|-----------|
| `ES` | E-mini S&P 500 | CME | $50 | 0.25 |
| `NQ` | E-mini NASDAQ-100 | CME | $20 | 0.25 |
| `YM` | E-mini Dow | CBOT | $5 | 1.0 |
| `RTY` | E-mini Russell 2000 | CME | $50 | 0.1 |
| `CL` | Crude Oil | NYMEX | $1,000 | 0.01 |
| `GC` | Gold | COMEX | $100 | 0.1 |
| `SI` | Silver | COMEX | $5,000 | 0.005 |
| `NG` | Natural Gas | NYMEX | $10,000 | 0.001 |
| `ZB` | 30-Year T-Bond | CBOT | $1,000 | 1/32 |
| `ZN` | 10-Year T-Note | CBOT | $1,000 | 1/64 |
| `ZC` | Corn | CBOT | $50 | 0.25 |
| `ZS` | Soybeans | CBOT | $50 | 0.25 |
| `ZW` | Wheat | CBOT | $50 | 0.25 |
| `HE` | Lean Hogs | CME | $400 | 0.025 |
| `LE` | Live Cattle | CME | $400 | 0.025 |

### Normalization Algorithm

```typescript
function normalizeRithmicSymbol(symbol: string) {
  // Parse: ESH26 → ES, H, 26
  const match = symbol.match(/^([A-Z]{1,3})([FGHJKMNQUVXZ])([0-9]{2})$/);
  if (!match) throw new Error(`Invalid symbol: ${symbol}`);
  
  const [, root, monthCode, yearCode] = match;
  
  // Convert year: 26 → 2026
  const year = 2000 + parseInt(yearCode);
  
  // Convert month code: H → March
  const monthMap = {
    'F': 'Jan', 'G': 'Feb', 'H': 'Mar', 'J': 'Apr',
    'K': 'May', 'M': 'Jun', 'N': 'Jul', 'Q': 'Aug',
    'U': 'Sep', 'V': 'Oct', 'X': 'Nov', 'Z': 'Dec'
  };
  const month = monthMap[monthCode];
  
  // Display name: ES Mar 2026
  return `${root} ${month} ${year}`;
}
```

---

## 6. Trade Reconstruction

### Fill-Based Reconstruction

Rithmic CSV exports individual fills (executions), not complete trades. We must reconstruct trades by matching entry and exit fills.

**Algorithm**: FIFO (First In, First Out)

**Steps**:
1. Sort fills by datetime (ascending)
2. Group by symbol and account
3. Track open positions
4. Match entry/exit fills using FIFO
5. Calculate P/L and commissions

### Example Reconstruction

**CSV Fills**:
```csv
Date,Time,Symbol,Side,Quantity,Price,Commission,Net P/L,Account
01/15/2026,09:30:15,ESH26,Buy,1,4850.00,2.50,0.00,PA123456
01/15/2026,09:35:42,ESH26,Sell,1,4852.50,2.50,125.00,PA123456
01/15/2026,10:15:30,ESH26,Buy,2,4851.00,5.00,0.00,PA123456
01/15/2026,10:45:18,ESH26,Sell,1,4853.00,2.50,100.00,PA123456
01/15/2026,11:20:05,ESH26,Sell,1,4854.00,2.50,150.00,PA123456
```

**Reconstructed Trades**:
```json
[
  {
    "symbol": "ESH26",
    "direction": "LONG",
    "openedAt": "2026-01-15T09:30:15",
    "closedAt": "2026-01-15T09:35:42",
    "entryPrice": 4850.00,
    "exitPrice": 4852.50,
    "quantity": 1,
    "realizedPnlUsd": 125.00,
    "commission": 5.00
  },
  {
    "symbol": "ESH26",
    "direction": "LONG",
    "openedAt": "2026-01-15T10:15:30",
    "closedAt": "2026-01-15T10:45:18",
    "entryPrice": 4851.00,
    "exitPrice": 4853.00,
    "quantity": 1,
    "realizedPnlUsd": 100.00,
    "commission": 7.50
  },
  {
    "symbol": "ESH26",
    "direction": "LONG",
    "openedAt": "2026-01-15T10:15:30",
    "closedAt": "2026-01-15T11:20:05",
    "entryPrice": 4851.00,
    "exitPrice": 4854.00,
    "quantity": 1,
    "realizedPnlUsd": 150.00,
    "commission": 7.50
  }
]
```

### Edge Cases

**Partial Fills**:
- Order for 5 contracts filled in 2 executions (3 + 2)
- Reconstruct as single trade with combined fills

**Multi-Day Positions**:
- Entry on Day 1, exit on Day 2
- Reconstruct as single trade spanning multiple days

**Scalping (Multiple Entries/Exits)**:
- Multiple entries and exits in same symbol
- Use FIFO to match fills correctly

---

## 7. Point Value Mapping

### Point Value Table

Point value is used to calculate P/L from price movement.

**Formula**: `P/L = (Exit Price - Entry Price) × Quantity × Point Value`

| Symbol | Name | Point Value | Tick Size | Example P/L |
|--------|------|-------------|-----------|-------------|
| `ES` | E-mini S&P 500 | $50 | 0.25 | 1 point = $50 |
| `NQ` | E-mini NASDAQ-100 | $20 | 0.25 | 1 point = $20 |
| `YM` | E-mini Dow | $5 | 1.0 | 1 point = $5 |
| `RTY` | E-mini Russell 2000 | $50 | 0.1 | 1 point = $50 |
| `CL` | Crude Oil | $1,000 | 0.01 | 1 point = $1,000 |
| `GC` | Gold | $100 | 0.1 | 1 point = $100 |
| `SI` | Silver | $5,000 | 0.005 | 1 point = $5,000 |
| `NG` | Natural Gas | $10,000 | 0.001 | 1 point = $10,000 |

### P/L Calculation Examples

**Example 1: ES Trade**
- Entry: 4850.00
- Exit: 4852.50
- Quantity: 1
- Point Value: $50
- P/L = (4852.50 - 4850.00) × 1 × $50 = **$125.00**

**Example 2: NQ Trade**
- Entry: 17500.00
- Exit: 17510.00
- Quantity: 2
- Point Value: $20
- P/L = (17510.00 - 17500.00) × 2 × $20 = **$400.00**

**Example 3: CL Trade**
- Entry: 75.50
- Exit: 75.75
- Quantity: 1
- Point Value: $1,000
- P/L = (75.75 - 75.50) × 1 × $1,000 = **$250.00**

---

## 8. Validation Rules

### Pre-Import Validation

**File Validation**:
- ✅ File extension is `.csv`
- ✅ File is not empty
- ✅ File encoding is UTF-8
- ✅ Header row is present

**Column Validation**:
- ✅ Required columns exist: `Date`, `Time`, `Symbol`, `Side`, `Quantity`, `Price`
- ⚠️ Optional columns: `Commission`, `Net P/L`, `Account`

**Data Validation**:
- ✅ Date format is valid
- ✅ Time format is valid
- ✅ Symbol matches pattern: `^[A-Z]{1,3}[FGHJKMNQUVXZ][0-9]{2}$`
- ✅ Side is `Buy` or `Sell`
- ✅ Quantity is positive number
- ✅ Price is positive number
- ✅ Commission is non-negative (if present)

### Post-Import Validation

**Trade Validation**:
- ✅ All trades have entry and exit
- ✅ Entry time < Exit time
- ✅ Quantity matches between entry/exit
- ⚠️ P/L calculation matches CSV (if provided)
- ⚠️ Commission sum matches (if provided)

**Symbol Validation**:
- ✅ Symbol is recognized futures contract
- ⚠️ Point value is known
- ⚠️ Contract expiration is in future (warn if expired)

---

## 9. Troubleshooting

### Common Issues

#### Issue 1: "Invalid Symbol Format"

**Symptoms**: Import fails with symbol validation error

**Causes**:
- Symbol not in Rithmic notation (e.g., `ES` instead of `ESH26`)
- Typo in symbol (e.g., `ESH266` instead of `ESH26`)
- Non-standard symbol format

**Solutions**:
1. Verify symbol format: `[ROOT][MONTH_CODE][YEAR]`
2. Check for extra characters or spaces
3. Ensure year is 2 digits (not 4)
4. Contact support if symbol is not recognized

#### Issue 2: "No Trades Found"

**Symptoms**: CSV imports successfully but no trades created

**Causes**:
- All fills are entry fills (no exits)
- Positions are still open
- Date range doesn't include closed trades

**Solutions**:
1. Verify trades are closed (not open positions)
2. Export longer date range
3. Check if fills are matched correctly
4. Review trade reconstruction log

#### Issue 3: "P/L Mismatch"

**Symptoms**: Calculated P/L doesn't match CSV P/L

**Causes**:
- Point value incorrect
- Commission not included in calculation
- Rounding differences
- Multiple fills combined incorrectly

**Solutions**:
1. Verify point value for symbol
2. Check if commissions are included
3. Review trade reconstruction logic
4. Accept minor rounding differences (<$1)

#### Issue 4: "Duplicate Trades"

**Symptoms**: Same trade appears multiple times

**Causes**:
- CSV exported multiple times
- Deduplication logic failed
- Trade signature collision

**Solutions**:
1. Check for duplicate CSV imports
2. Verify trade signature is unique
3. Manually delete duplicates
4. Report issue to support

---

## 10. Sample Data

### Sample CSV File

```csv
Date,Time,Symbol,Side,Quantity,Price,Commission,Net P/L,Account
01/15/2026,09:30:15.123,ESH26,Buy,1,4850.00,2.50,0.00,PA123456
01/15/2026,09:35:42.456,ESH26,Sell,1,4852.50,2.50,125.00,PA123456
01/15/2026,10:15:30.789,NQH26,Buy,2,17500.00,5.00,0.00,PA123456
01/15/2026,10:45:18.012,NQH26,Sell,2,17510.00,5.00,400.00,PA123456
01/15/2026,11:20:05.345,YMH26,Buy,1,38500,2.50,0.00,PA123456
01/15/2026,11:45:22.678,YMH26,Sell,1,38510,2.50,50.00,PA123456
01/15/2026,14:30:10.901,CLF26,Buy,1,75.50,2.50,0.00,PA123456
01/15/2026,14:55:33.234,CLF26,Sell,1,75.75,2.50,250.00,PA123456
```

### Expected Import Result

**4 trades reconstructed**:

1. **ES Trade**
   - Symbol: ESH26 (E-mini S&P 500 March 2026)
   - Direction: LONG
   - Entry: 4850.00 @ 09:30:15
   - Exit: 4852.50 @ 09:35:42
   - Quantity: 1
   - P/L: $125.00
   - Commission: $5.00

2. **NQ Trade**
   - Symbol: NQH26 (E-mini NASDAQ-100 March 2026)
   - Direction: LONG
   - Entry: 17500.00 @ 10:15:30
   - Exit: 17510.00 @ 10:45:18
   - Quantity: 2
   - P/L: $400.00
   - Commission: $10.00

3. **YM Trade**
   - Symbol: YMH26 (E-mini Dow March 2026)
   - Direction: LONG
   - Entry: 38500 @ 11:20:05
   - Exit: 38510 @ 11:45:22
   - Quantity: 1
   - P/L: $50.00
   - Commission: $5.00

4. **CL Trade**
   - Symbol: CLF26 (Crude Oil January 2026)
   - Direction: LONG
   - Entry: 75.50 @ 14:30:10
   - Exit: 75.75 @ 14:55:33
   - Quantity: 1
   - P/L: $250.00
   - Commission: $5.00

---

## 11. References

### Documentation
- Rithmic R|Trader Pro User Guide: https://yyy3.rithmic.com/?page_id=16
- CME Futures Specifications: https://www.cmegroup.com/markets.html
- Apex Trader Funding Rules: https://www.apextraderfunding.com/rules

### Tools
- CSV Validator: https://csvlint.io/
- Futures Contract Lookup: https://www.cmegroup.com/tools-information/quikstrike.html

---

**Maintained By**: Development Team  
**Last Updated**: 2026-01-17  
**Version**: 1.0
