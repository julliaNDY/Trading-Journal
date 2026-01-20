# 📄 CSV Import Formats - Broker-Specific Mappings

> **Purpose**: Document CSV export formats for brokers without API  
> **Story**: 3.4 - Broker Sync Integration (Task 3)  
> **Last Updated**: 2026-01-17

---

## 📋 Overview

This directory contains CSV format documentation and import profiles for brokers that don't have API access or where CSV import is the primary method.

---

## 🎯 Supported Formats

### Tier 1 Brokers (High Priority)

| Broker | CSV Support | Format Documented | Import Profile | Notes |
|--------|-------------|-------------------|----------------|-------|
| NinjaTrader | ✅ Yes | ✅ Yes | ✅ Yes | Execution report export |
| Fidelity | ✅ Yes | 📋 Planned | 📋 Planned | Trade history CSV |
| Robinhood | ✅ Yes | 📋 Planned | 📋 Planned | Account statements |
| Webull | ✅ Yes | 📋 Planned | 📋 Planned | Trade history export |

### Tier 2+ Brokers

| Broker | CSV Support | Format Documented | Import Profile | Notes |
|--------|-------------|-------------------|----------------|-------|
| Merrill Edge | ✅ Yes | 📋 Planned | 📋 Planned | CSV export only |
| Ally Invest | ✅ Yes | 📋 Planned | 📋 Planned | Trade history |
| Vanguard | ✅ Yes | 📋 Planned | 📋 Planned | CSV export only |
| M1 Finance | ✅ Yes | 📋 Planned | 📋 Planned | CSV export only |
| Public.com | ✅ Yes | 📋 Planned | 📋 Planned | CSV export only |

---

## 📁 Directory Structure

```
csv-formats/
├── README.md (this file)
├── ninjatrader.md
├── fidelity.md
├── robinhood.md
├── webull.md
├── templates/
│   ├── ninjatrader-import-profile.json
│   ├── fidelity-import-profile.json
│   └── ...
└── examples/
    ├── ninjatrader-sample.csv
    ├── fidelity-sample.csv
    └── ...
```

---

## 🔧 Import Profile Format

Import profiles define how to map broker CSV columns to our internal Trade model.

### JSON Schema

```json
{
  "name": "Broker Name - Trade History",
  "brokerName": "BROKER_NAME",
  "version": "1.0",
  "description": "Import profile for [Broker] trade history CSV",
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
      "column": "Side",
      "mapping": {
        "Buy": "LONG",
        "Sell": "SHORT"
      }
    },
    "openedAt": {
      "column": "Entry Time",
      "format": "MM/dd/yyyy HH:mm:ss"
    },
    "closedAt": {
      "column": "Exit Time",
      "format": "MM/dd/yyyy HH:mm:ss"
    },
    "entryPrice": "Entry Price",
    "exitPrice": "Exit Price",
    "quantity": "Quantity",
    "realizedPnlUsd": "P&L",
    "fees": "Commission"
  },
  "transformations": {
    "symbol": "uppercase",
    "quantity": "abs"
  },
  "validation": {
    "requiredColumns": ["Instrument", "Entry Time", "Exit Time", "Entry Price", "Exit Price", "Quantity"],
    "dateRange": {
      "min": "2000-01-01",
      "max": "now"
    }
  }
}
```

---

## 📝 Creating a New Import Profile

### Step 1: Get Sample CSV

1. Export trades from broker platform
2. Save sample CSV file
3. Document export steps (screenshots recommended)

### Step 2: Analyze CSV Structure

1. Identify column names
2. Identify data types
3. Identify date/time formats
4. Note any special formatting

### Step 3: Create Import Profile

1. Copy template from `templates/template-import-profile.json`
2. Fill in broker-specific details
3. Define column mappings
4. Add transformations if needed
5. Define validation rules

### Step 4: Test Import Profile

1. Use sample CSV to test import
2. Verify all fields map correctly
3. Check date/time parsing
4. Validate trade data accuracy

### Step 5: Document Format

1. Create `[broker].md` file
2. Document CSV structure
3. Include export instructions
4. Add screenshots
5. List known issues/limitations

---

## 🧪 Testing Import Profiles

### Manual Testing

```bash
# Test import profile with sample CSV
npx tsx scripts/test-import-profile.ts \
  --profile docs/brokers/csv-formats/templates/ninjatrader-import-profile.json \
  --csv docs/brokers/csv-formats/examples/ninjatrader-sample.csv
```

### Automated Testing

```typescript
import { testImportProfile } from '@/services/import-service';

const result = await testImportProfile({
  profilePath: 'ninjatrader-import-profile.json',
  csvPath: 'ninjatrader-sample.csv',
});

console.log(`Parsed ${result.trades.length} trades`);
console.log(`Errors: ${result.errors.length}`);
```

---

## 📊 Import Profile Statistics

| Profile | Version | Tested | Success Rate | Last Updated |
|---------|---------|--------|--------------|--------------|
| NinjaTrader | 1.0 | ✅ Yes | 100% | 2026-01-17 |
| Fidelity | - | ⏸️ Pending | - | - |
| Robinhood | - | ⏸️ Pending | - | - |
| Webull | - | ⏸️ Pending | - | - |

---

## 🚀 Quick Start (For Users)

### Importing Trades from CSV

1. **Export trades from your broker**:
   - Follow broker-specific instructions in `[broker].md`
   - Save CSV file to your computer

2. **Go to Import page**:
   - Navigate to `/importer` in the app
   - Click "Upload CSV"

3. **Select import profile**:
   - Choose your broker from the dropdown
   - Or select "Custom" to create your own mapping

4. **Upload CSV file**:
   - Drag & drop or click to browse
   - Preview first 20 rows

5. **Verify mapping**:
   - Check column mappings are correct
   - Adjust if needed

6. **Import trades**:
   - Click "Import"
   - Wait for completion
   - Review imported trades

---

## 🔗 References

- **Import Service**: `src/services/import-service.ts`
- **Import Profiles Model**: `prisma/schema.prisma` (ImportProfile)
- **Story 3.4**: `docs/stories/3.4.story.md`
- **Story 3.7**: `docs/stories/3.7.story.md` (Import Profiles)

---

## 📋 Checklist for New Broker CSV Format

- [ ] Get sample CSV export from broker
- [ ] Document export steps (with screenshots)
- [ ] Analyze CSV structure
- [ ] Create import profile JSON
- [ ] Test with sample data
- [ ] Document format in `[broker].md`
- [ ] Add to this README
- [ ] Update broker priority list
- [ ] Notify users (if requested broker)

---

**Maintained By**: Development Team  
**Last Updated**: 2026-01-17
