# 🥷 NinjaTrader API Research

> **Status**: Research Complete - Awaiting PM Approval  
> **Priority**: Tier 1 (#4)  
> **Last Updated**: 2026-01-17

---

## 1. Broker Overview

**Name**: NinjaTrader LLC  
**Country**: USA  
**Founded**: 2003  
**Asset Classes**: Futures, Forex  
**Trading Platform**: NinjaTrader 8 (desktop application)  
**Market Share**: Large (popular futures platform)  
**Target Audience**: Active traders, futures traders, algo traders

**Key Features**:
- Advanced charting and analysis
- Automated trading strategies
- Market replay
- Free platform (brokerage optional)
- Extensive ecosystem (indicators, strategies, addons)

---

## 2. API Details

**API Type**: C# .NET API (NinjaScript) + HTTP REST API (limited)  
**Documentation**: https://ninjatrader.com/support/helpGuides/nt8/  
**API Version**: NinjaTrader 8  
**Platform**: Windows only (desktop application required)

**API Architecture**:
1. **NinjaScript API**: C# API for strategies/indicators (runs inside NT8)
2. **ATI (Automated Trading Interface)**: External applications can connect
3. **HTTP REST API**: Limited endpoints for account/order data
4. **Database Access**: Direct SQL Server access (advanced)

**Sandbox Environment**: ✅ Yes (Simulated Data Feed)  
- Free simulated data
- No real money
- Full platform functionality
- Playback historical data

**SDKs Available**:
- C# (official - NinjaScript)
- .NET (official - ATI)
- HTTP REST (limited)

---

## 3. Authentication

### Option 1: NinjaScript API (Embedded)
**Method**: No authentication (runs inside NT8 platform)  
**Access**: Full access to account, orders, positions, executions  
**Limitation**: Must run inside NinjaTrader 8 application

### Option 2: ATI (Automated Trading Interface)
**Method**: TCP/IP connection to NT8 instance  
**Port**: Configurable (default: 36973)  
**Authentication**: Optional password protection  
**Access**: Send orders, get account info, subscribe to market data

### Option 3: HTTP REST API (NinjaTrader Brokerage)
**Method**: API Key + Secret (HTTP Headers)  
**Documentation**: Limited (not publicly documented)  
**Access**: Account info, order history (limited endpoints)  
**Availability**: Only for NinjaTrader Brokerage accounts

**Rate Limits**: Not publicly documented (estimated 60 req/min)

---

## 4. Endpoints

### NinjaScript API (C# - Embedded)

#### Get Executions (Fills)
```csharp
Account account = Account.All.FirstOrDefault(a => a.Name == "Sim101");
List<Execution> executions = account.Executions.ToList();

foreach (Execution execution in executions)
{
    string instrument = execution.Instrument.FullName;
    double price = execution.Price;
    int quantity = execution.Quantity;
    DateTime time = execution.Time;
    MarketPosition side = execution.MarketPosition; // Long, Short, Flat
    string orderId = execution.OrderId;
}
```

#### Get Account Info
```csharp
Account account = Account.All.FirstOrDefault(a => a.Name == "Sim101");
double cashValue = account.Get(AccountItem.CashValue, Currency.UsDollar);
double realizedPnL = account.Get(AccountItem.RealizedProfitLoss, Currency.UsDollar);
```

### ATI (Automated Trading Interface)

**Connection**:
```
CONNECT <password>
```

**Get Account Value**:
```
ACCOUNTVALUE <account>
```

**Get Orders**:
```
ORDERS <account>
```

**Response Format**: Pipe-delimited strings

### HTTP REST API (Limited)

⚠️ **Note**: Not officially documented. Reverse-engineered from web interface.

**Base URL**: `https://api.ninjatrader.com` (hypothetical)

**Endpoints** (estimated):
- `GET /api/accounts` - Get account list
- `GET /api/accounts/{id}/orders` - Get order history
- `GET /api/accounts/{id}/executions` - Get execution history

---

## 5. Data Format

### NinjaScript API
**Format**: C# objects (strongly typed)  
**Date/Time**: .NET DateTime (local timezone)  
**Decimal**: .NET double (floating point)

### ATI
**Format**: Pipe-delimited strings  
**Date/Time**: `yyyyMMddHHmmss` format  
**Decimal**: String representation

**Example ATI Response**:
```
ORDER|Sim101|ES 03-24|Buy|1|Filled|2024-01-15 09:30:00|4500.00|1|0
```

### HTTP REST API
**Format**: JSON (estimated)  
**Date/Time**: ISO 8601 (estimated)  
**Decimal**: String (estimated)

---

## 6. Trade Data Mapping

### Mapping Strategy

NinjaTrader provides **Executions** (fills), not complete trades. Similar to Tradovate, we need to:
1. Fetch all executions for an account
2. Group by instrument
3. Track position and match entry/exit fills
4. Calculate PnL from fill prices

### Field Mapping (NinjaScript API)

| NinjaTrader Field | Our Field | Notes |
|-------------------|-----------|-------|
| `execution.OrderId` + `execution.ExecutionId` | `importHash` | Prefix with `ninjatrader:` |
| `execution.Instrument.FullName` | `symbol` | e.g., "ES 03-24" → "ES" |
| `execution.MarketPosition` | `direction` | `Long` → `LONG`, `Short` → `SHORT` |
| `execution.Time` | `openedAt` / `closedAt` | Depends on entry/exit |
| `execution.Price` | `entryPrice` / `exitPrice` | Depends on entry/exit |
| `execution.Quantity` | `quantity` | Direct mapping |
| Calculated | `realizedPnlUsd` | Calculate from entry/exit |
| `execution.Commission` | `fees` | Commission per fill |

### Symbol Normalization

NinjaTrader uses contract notation:
- `ES 03-24` → Emini S&P 500 March 2024
- `NQ 06-24` → Emini NASDAQ June 2024
- `CL 12-24` → Crude Oil December 2024

**Normalization**:
- Extract root symbol: `ES 03-24` → `ES`
- Or keep full contract: `ES 03-24` (recommended for futures)

### Trade Reconstruction

1. **Fetch all executions** for date range
2. **Group by instrument**
3. **Sort by time**
4. **Track position**: Start at 0
   - Buy execution: position += quantity
   - Sell execution: position -= quantity
5. **Detect round trip**: When position returns to 0
6. **Calculate PnL**: 
   - Futures: `(exitPrice - entryPrice) * quantity * pointValue`
   - Point value varies by contract (e.g., ES = $50/point)

**Example**:
```
Execution 1: Buy 1 ES @ 4500.00 (position: +1)
Execution 2: Sell 1 ES @ 4510.00 (position: 0)
→ Trade: LONG, entry 4500, exit 4510, qty 1
→ PnL = (4510 - 4500) * 1 * $50 = $500
```

---

## 7. Rate Limits

### NinjaScript API
**Limit**: None (runs locally inside NT8)  
**Performance**: Limited by local machine resources

### ATI
**Limit**: Not documented (estimated 100 req/min)  
**Connection**: Single TCP connection per client

### HTTP REST API
**Limit**: Not documented (estimated 60 req/min)  
**Backoff**: Standard exponential backoff recommended

---

## 8. Costs

### NinjaTrader Platform
- **Free**: Lifetime license for basic features
- **Lease**: $60/month for advanced features (Market Replay, etc.)
- **Lifetime**: $1,099 one-time for advanced features

### Brokerage Costs (NinjaTrader Brokerage)
- **Commissions**: $0.53 - $1.09 per contract (varies by plan)
- **Data Fees**: $50-100/month (CME, ICE, etc.)
- **Minimum Deposit**: $400 (futures), $50 (forex)

### API Access
- **NinjaScript API**: Free (included with platform)
- **ATI**: Free (included with platform)
- **HTTP REST API**: Unknown (may require brokerage account)

### Total Cost Estimate
- **Platform**: $0 (free version) or $60/month (lease)
- **API Access**: $0 (NinjaScript/ATI)
- **Development**: Requires C# knowledge
- **Testing**: $0 (simulated data feed)
- **Production**: Varies (depends on brokerage choice)

**Note**: Users can use NinjaTrader platform with other brokerages (Interactive Brokers, TD Ameritrade, etc.), so API access doesn't require NinjaTrader Brokerage account.

---

## 9. Access Requirements

### NinjaScript API
**Requirements**:
- NinjaTrader 8 installed (Windows)
- C# development knowledge
- NinjaScript addon development

**Process**:
1. Download NT8 from https://ninjatrader.com
2. Install platform
3. Enable simulated data feed (free)
4. Develop NinjaScript addon
5. Export data to external system

### ATI
**Requirements**:
- NinjaTrader 8 running
- Enable ATI in platform settings
- TCP/IP connection

**Process**:
1. Open NT8
2. Tools → Options → Automated Trading Interface
3. Enable ATI
4. Set port and password
5. Connect from external application

### HTTP REST API
**Requirements**: Unknown (not publicly documented)  
**Estimated**: NinjaTrader Brokerage account required

---

## 10. Implementation Notes

### Known Issues
1. **Windows Only**: NT8 is Windows-only (no Mac/Linux)
2. **Desktop Required**: Must have NT8 running for API access
3. **No Cloud API**: No cloud-based REST API (except limited brokerage API)
4. **Complex Setup**: Requires C# development or ATI integration
5. **Point Values**: Must maintain point value mapping per contract

### Workarounds
1. **NinjaScript Addon**: Develop addon to export data to our system
2. **ATI Integration**: Connect via TCP/IP to running NT8 instance
3. **Database Access**: Direct SQL Server access (advanced)
4. **CSV Export**: Manual export from NT8 (fallback)
5. **File Upload**: Users export trades manually

### Recommended Approach

**Option A: NinjaScript Addon (Best for Power Users)**
- Develop C# addon that runs inside NT8
- Export executions to JSON/CSV file
- User uploads file to our platform
- **Pros**: Full access to all data, reliable
- **Cons**: Requires NT8 running, Windows only

**Option B: ATI Integration (Best for Automation)**
- Connect to NT8 via TCP/IP
- Fetch executions on demand
- **Pros**: Real-time sync possible
- **Cons**: Requires NT8 running, complex setup

**Option C: CSV Import (Simplest)**
- User exports executions from NT8 to CSV
- Upload CSV to our platform
- **Pros**: Simple, no API needed
- **Cons**: Manual process, not automated

**Recommendation**: Start with **Option C** (CSV Import), then develop **Option A** (NinjaScript Addon) for advanced users.

### Best Practices
1. **Point Value Mapping**: Maintain database of contract point values
2. **Symbol Normalization**: Handle contract notation (e.g., "ES 03-24")
3. **Timezone Handling**: NT8 uses local timezone, convert to UTC
4. **Commission Handling**: Track commission per fill
5. **Multi-Leg Orders**: Handle spread orders (e.g., calendar spreads)

### Testing Strategy
1. **Unit Tests**: Mock execution data
2. **Integration Tests**: Use NT8 simulated data feed
3. **Edge Cases**:
   - Multi-leg orders (spreads)
   - Partial fills
   - Same-day trades
   - Overnight positions
   - Rollover (contract expiration)
4. **Performance**: Test with 1000+ executions

### Implementation Checklist

**Phase 1: CSV Import (MVP)**
- [ ] Create import profile for NT8 CSV format
- [ ] Handle NT8-specific columns (Instrument, Quantity, Avg fill price, etc.)
- [ ] Implement symbol normalization (contract notation)
- [ ] Add point value mapping for common contracts
- [ ] Test with sample NT8 exports

**Phase 2: NinjaScript Addon (Advanced)**
- [ ] Develop C# addon for NT8
- [ ] Export executions to JSON format
- [ ] Add auto-upload feature (optional)
- [ ] Publish addon on NinjaTrader Ecosystem
- [ ] Document installation process

**Phase 3: ATI Integration (Future)**
- [ ] Implement TCP/IP client for ATI
- [ ] Handle ATI protocol (pipe-delimited)
- [ ] Add real-time sync capability
- [ ] Test with running NT8 instance

---

## 11. PM Notification

### Recommendation: ⚠️ **IMPLEMENT (CSV Import First)**

### Justification
1. **Large User Base**: Popular futures platform
2. **Futures Focus**: Complements existing brokers (IBKR, Tradovate)
3. **Free Platform**: Users can test without brokerage account
4. **Ecosystem**: Large community of traders
5. **Complexity**: API integration is complex (Windows-only, desktop required)

### Budget Impact
- **API Costs**: $0 (free API access)
- **Development Time**: 
  - CSV Import: 1-2 days
  - NinjaScript Addon: 5-7 days (C# development)
  - ATI Integration: 7-10 days (complex)
- **Maintenance**: Medium (point value updates, contract rollover handling)
- **Total Cost**: Development time only

### Timeline Estimate
- **Phase 1 (CSV Import)**: 1-2 days
- **Phase 2 (NinjaScript Addon)**: 5-7 days
- **Phase 3 (ATI Integration)**: 7-10 days (future)
- **Total (MVP)**: 1-2 days

### Risk Assessment
- **API Stability**: ✅ Low risk (mature platform)
- **Complexity**: ⚠️ High risk (Windows-only, desktop required, C# development)
- **Data Quality**: ✅ Low risk (reliable data)
- **User Adoption**: ✅ Low risk (large user base)
- **Overall Risk**: 🟡 **MEDIUM** (due to complexity)

### User Demand
- **Priority**: High (popular futures platform)
- **Market Share**: Large (top 3 futures platforms)
- **Unique Features**: Advanced charting, market replay
- **Competitive Advantage**: Futures trader community

### Phased Approach

**Phase 1: CSV Import (Immediate)**
- Low complexity
- Quick implementation
- Covers majority of users
- No API integration needed

**Phase 2: NinjaScript Addon (3-6 months)**
- Requires C# developer
- Advanced users benefit
- Automated export
- Published on NT Ecosystem

**Phase 3: ATI Integration (Future)**
- Real-time sync
- Advanced automation
- Complex implementation
- Evaluate user demand first

### Next Steps
1. ✅ **PM Approval**: Required for Phase 1 (CSV Import)
2. ⏸️ **Budget Approval**: Not needed ($0 cost)
3. ⏸️ **Implementation**: Start with CSV import
4. ⏸️ **Testing**: Use NT8 simulated data
5. ⏸️ **Phase 2 Decision**: Evaluate after Phase 1 adoption

---

## 12. References

- **Official Docs**: https://ninjatrader.com/support/helpGuides/nt8/
- **NinjaScript API**: https://ninjatrader.com/support/helpGuides/nt8/NT%20HelpGuide%20English.html?ninjascript_overview.htm
- **ATI Documentation**: https://ninjatrader.com/support/helpGuides/nt8/automated_trading_interface_at.htm
- **Ecosystem**: https://ninjatraderecosystem.com/
- **Forum**: https://ninjatrader.com/support/forum/
- **GitHub**: https://github.com/NinjaTrader (unofficial)

---

## 13. CSV Export Format (Reference)

NinjaTrader exports executions in the following format:

```csv
Instrument,Quantity,Avg fill price,Time,Commission,Rate,Account,Order Id,Name
ES 03-24,1,4500.00,1/15/2024 9:30:00 AM,2.12,Buy,Sim101,abc123,Entry
ES 03-24,-1,4510.00,1/15/2024 10:15:00 AM,2.12,Sell,Sim101,def456,Exit
```

**Columns**:
- `Instrument`: Contract name (e.g., "ES 03-24")
- `Quantity`: Number of contracts (positive for all, direction in Rate)
- `Avg fill price`: Fill price
- `Time`: Local time (format varies)
- `Commission`: Commission per fill
- `Rate`: "Buy" or "Sell"
- `Account`: Account name
- `Order Id`: Order identifier
- `Name`: Order name/label

---

**Research Completed By**: Development Team  
**Date**: 2026-01-17  
**Status**: ⏸️ Awaiting PM Approval (Phase 1: CSV Import)
