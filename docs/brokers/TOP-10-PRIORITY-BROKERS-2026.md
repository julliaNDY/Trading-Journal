# 🎯 TOP 10 PRIORITY BROKERS/PROP FIRMS - 2026 Strategic Analysis

> **Document Type**: PM Strategic Decision  
> **Created By**: John (Product Manager)  
> **Date**: 2026-01-17  
> **Status**: Ready for Dev Research  
> **Story**: 3.4 - Broker Sync Integration

---

## 📋 Executive Summary

Based on comprehensive analysis of Gemini's 20-broker report and current market research (January 2026), I've identified the **TOP 10 priority brokers/prop firms** for immediate API integration and file upload validation.

**Selection Criteria**:
1. **Market Share & User Base** (35%)
2. **API Quality & Documentation** (25%)
3. **Integration Feasibility** (20%)
4. **Strategic Value** (15%)
5. **Cost/Benefit Ratio** (5%)

**Key Findings**:
- 8/10 have mature REST APIs available
- 2/10 require hybrid approach (API + CSV)
- Estimated total integration time: 15-20 dev days
- Monthly API costs: $0-$150 (most are free)

---

## 🏆 TOP 10 PRIORITY BROKERS

### Tier 1A: Immediate Implementation (Weeks 1-2)

---

### 1. 🥇 Interactive Brokers (IBKR)

**Priority Score**: 9.8/10

**Why #1**:
- Largest retail broker globally (150+ markets, 33 countries)
- Gold standard API (TWS API + Flex Query + Client Portal API)
- Already partially implemented ✅
- Institutional-grade data quality

**Integration Type**: ✅ API (Flex Query - Already Implemented)

**Key Stats**:
- **Users**: 2.6M+ accounts worldwide
- **Assets**: Stocks, Futures, Options, Forex, Bonds
- **API Cost**: FREE
- **Rate Limits**: Generous (Flex Query: daily refresh)
- **Documentation**: Excellent

**API Details**:
- **Primary Method**: Flex Query Web Service (XML/CSV reports)
- **Auth**: Token-based (1-year validity)
- **Historical Data**: Up to 1 year via API
- **Real-time**: Via TWS API (socket-based)

**Implementation Status**: 
- ✅ Flex Query integration completed
- 🔄 Consider adding TWS API for real-time sync

**Dev Action Required**: 
- Validate existing Flex Query implementation
- Test with multiple account types
- Document edge cases

**References**:
- API Docs: https://www.interactivebrokers.com/campus/ibkr-api-page/flex-web-service/
- Gemini Analysis: Section I.1

---

### 2. 🥈 Alpaca

**Priority Score**: 9.5/10

**Why #2**:
- API-first broker designed for developers
- Cleanest REST API in the industry
- Commission-free trading
- Excellent Python/Node SDKs
- Rising star in algo trading community

**Integration Type**: ✅ API (REST + WebSocket)

**Key Stats**:
- **Users**: 500K+ developers & traders
- **Assets**: US Stocks, ETFs, Crypto
- **API Cost**: FREE (paper trading included)
- **Rate Limits**: 200 req/min (generous)
- **Documentation**: Outstanding (interactive docs)

**API Details**:
- **Endpoints**: 
  - `GET /v2/account` - Account info
  - `GET /v2/orders` - Order history
  - `GET /v2/positions` - Current positions
- **Auth**: API Key + Secret (Bearer token)
- **Historical Data**: Full history available
- **Real-time**: WebSocket streaming

**Strategic Value**:
- Attracts developer/algo trader segment
- Modern, well-documented API
- Strong community support
- Fractional shares support

**Dev Action Required**: 
- 🔍 Research API endpoints for trade history
- 🔍 Test with demo account
- 🔍 Estimate integration time: 2-3 days

**Cost Analysis**:
- API Access: $0/month ✅
- Dev Time: 2-3 days
- Maintenance: Low (stable API)

**Recommendation**: ✅ **APPROVE - High Priority**

**References**:
- API Docs: https://alpaca.markets/docs/
- Web Search: Confirmed as top developer-friendly broker 2026

---

### 3. 🥉 OANDA

**Priority Score**: 9.3/10

**Why #3**:
- Best-in-class Forex API (v20 REST)
- "Developer-friendly" reputation
- Official Python SDK maintained by OANDA
- Transparent pricing & execution

**Integration Type**: ✅ API (REST v20)

**Key Stats**:
- **Users**: 500K+ forex traders
- **Assets**: Forex (70+ pairs), CFDs on indices/commodities
- **API Cost**: FREE
- **Rate Limits**: 120 req/20 sec (very generous)
- **Documentation**: Excellent (interactive sandbox)

**API Details**:
- **Primary Endpoint**: `/accounts/{accountID}/transactions`
- **Auth**: API Token (Bearer)
- **Historical Data**: Full transaction history
- **Granularity**: Tick-by-tick data available
- **Special Feature**: Forensic analysis (margin calls, interest payments)

**Strategic Value**:
- Dominates Forex trader segment
- API is trivial to integrate (best docs in industry)
- Strong user demand from Forex community

**Dev Action Required**: 
- 🔍 Test v20 API with demo account
- 🔍 Map OANDA transaction types to our Trade model
- 🔍 Estimate integration time: 1-2 days

**Cost Analysis**:
- API Access: $0/month ✅
- Dev Time: 1-2 days (easiest integration)
- Maintenance: Very Low

**Recommendation**: ✅ **APPROVE - High Priority**

**References**:
- API Docs: https://developer.oanda.com/rest-live-v20/introduction/
- Gemini Analysis: Section I.5
- Web Search: Confirmed as top Forex API 2026

---

### 4. 🏅 Tradovate

**Priority Score**: 9.0/10

**Why #4**:
- Cloud-native futures platform
- Modern REST + WebSocket API
- TradingView integration (strategic)
- Growing prop firm adoption

**Integration Type**: ✅ API (REST + WebSocket) - Already Implemented

**Key Stats**:
- **Users**: 100K+ futures traders
- **Assets**: Futures (CME, CBOT, NYMEX, etc.)
- **API Cost**: $15-25/month (Add-on) OR Free via prop firms
- **Rate Limits**: Reasonable
- **Documentation**: Good

**API Details**:
- **Endpoints**: REST for account/trades, WebSocket for real-time
- **Auth**: Token-based
- **Historical Data**: Full history via REST
- **Special**: TradingView chart integration

**Implementation Status**: 
- ✅ API integration completed
- 🔄 Validate with multiple prop firms

**Strategic Value**:
- Gateway to prop firm ecosystem
- Many prop firms use Tradovate backend
- TradingView integration = competitive advantage

**Dev Action Required**: 
- Validate existing implementation
- Test with prop firm accounts (TopstepX, MyFundedFutures)
- Document API cost structure

**References**:
- API Docs: https://api.tradovate.com
- Gemini Analysis: Section II (Prop Firms)
- Web Search: Confirmed Tradovate Prop platform 2026

---

### 5. 🎖️ TopstepX (Prop Firm)

**Priority Score**: 8.8/10

**Why #5**:
- Largest prop firm (pioneer since 2012)
- NEW: TopstepX proprietary platform (2024-2025)
- First prop firm with native API ✅
- Strategic: Opens door to prop trader segment

**Integration Type**: ✅ API (TopstepX ProjectX API)

**Key Stats**:
- **Users**: 100K+ prop traders (estimated)
- **Assets**: Futures (NQ, ES, YM, RTY, etc.)
- **API Cost**: FREE (included with TopstepX)
- **Rate Limits**: TBD (new API)
- **Documentation**: Available (ProjectX API)

**API Details**:
- **Type**: REST + WebSocket
- **Auth**: API Token (ProjectX)
- **Historical Data**: Yes
- **Real-time**: WebSocket streaming
- **Limitation**: No sandbox environment ⚠️

**Strategic Value**: 🔥 **CRITICAL**
- Prop trading is exploding market segment
- TopstepX is ONLY prop firm with native API
- Competitive advantage vs TradeZella/Tradervue
- Opens door to 100K+ potential users

**Dev Action Required**: 
- 🔍 Research ProjectX API documentation
- 🔍 Test with TopstepX evaluation account
- 🔍 Understand rate limits & restrictions
- 🔍 Estimate integration time: 3-4 days

**Cost Analysis**:
- API Access: $0/month ✅ (included)
- Dev Time: 3-4 days
- Maintenance: Medium (new API, may have bugs)

**Risks**:
- New API (launched 2024-2025) = potential instability
- No sandbox = must test with real evaluation account
- Topstep is transitioning away from Tradovate/Rithmic

**Recommendation**: ✅ **APPROVE - Strategic Priority**

**References**:
- API Docs: https://help.topstep.com/en/articles/11187768-topstepx-api-access
- Gemini Analysis: Section II.2
- Web Search: Confirmed TopstepX API availability 2026

---

### Tier 1B: High Priority (Weeks 3-4)

---

### 6. 🎯 Charles Schwab (TD Ameritrade)

**Priority Score**: 8.5/10

**Why #6**:
- Massive US retail presence (33M+ accounts)
- Merged TD Ameritrade API (mature)
- thinkorswim platform (beloved by traders)
- Strong brand recognition

**Integration Type**: ✅ API (REST - OAuth 2.0)

**Key Stats**:
- **Users**: 33M+ accounts (Schwab) + 11M (TD Ameritrade)
- **Assets**: Stocks, Options, Futures
- **API Cost**: FREE
- **Rate Limits**: 120 req/min
- **Documentation**: Good (merged TD Ameritrade docs)

**API Details**:
- **Auth**: OAuth 2.0 (requires app registration)
- **Endpoints**: `/accounts/{accountNumber}/orders`
- **Historical Data**: Available
- **Complexity**: Higher (OAuth flow + app approval)

**Strategic Value**:
- Largest US retail broker by accounts
- High user demand expected
- thinkorswim users are active traders

**Challenges**:
- OAuth 2.0 = more complex than API key
- App registration required (approval process)
- API transition from TD Ameritrade still ongoing

**Dev Action Required**: 
- 🔍 Register developer app with Schwab
- 🔍 Research OAuth 2.0 flow
- 🔍 Test with demo account
- 🔍 Estimate integration time: 4-5 days

**Cost Analysis**:
- API Access: $0/month ✅
- Dev Time: 4-5 days (OAuth complexity)
- Maintenance: Medium

**Recommendation**: ✅ **APPROVE - High Priority**
- ⚠️ Note: Requires PM approval for app registration

**References**:
- API Docs: https://developer.schwab.com
- Gemini Analysis: Section I.4
- Web Search: Confirmed Schwab API merger 2026

---

### 7. 🎲 TradeStation

**Priority Score**: 8.3/10

**Why #7**:
- Active trader platform (stocks, options, futures)
- Strong analytics & backtesting tools
- EasyLanguage community
- TradingView integration

**Integration Type**: ✅ API (REST - OAuth 2.0)

**Key Stats**:
- **Users**: 150K+ active traders
- **Assets**: Stocks, Options, Futures, Crypto
- **API Cost**: FREE
- **Rate Limits**: Reasonable
- **Documentation**: Good

**API Details**:
- **Auth**: OAuth 2.0
- **Endpoints**: WebAPI for account/trades
- **Historical Data**: Full history
- **Special**: EasyLanguage strategy export possible

**Strategic Value**:
- Active trader segment (high engagement)
- Analytics-focused users = good fit for journal
- TradingView integration

**Dev Action Required**: 
- 🔍 Research WebAPI documentation
- 🔍 Test OAuth flow
- 🔍 Estimate integration time: 3-4 days

**Cost Analysis**:
- API Access: $0/month ✅
- Dev Time: 3-4 days
- Maintenance: Medium

**Recommendation**: ✅ **APPROVE - High Priority**

**References**:
- API Docs: https://api.tradestation.com
- Gemini Analysis: Section I.6

---

### 8. 📊 Saxo Bank

**Priority Score**: 8.0/10

**Why #8**:
- Premium European broker
- Excellent OpenAPI (modern REST)
- 70,000+ instruments
- Institutional-grade data

**Integration Type**: ✅ API (Saxo OpenAPI - REST)

**Key Stats**:
- **Users**: 1M+ accounts (global)
- **Assets**: Stocks, Forex, Options, Futures, Bonds
- **API Cost**: FREE (for account holders)
- **Rate Limits**: Generous
- **Documentation**: Excellent

**API Details**:
- **Endpoint**: `GET /cs/v1/reports/trades/{ClientKey}`
- **Auth**: OAuth 2.0 / API Token
- **Historical Data**: Full history
- **Special**: Excel add-in available

**Strategic Value**:
- European market expansion
- Premium segment (higher ARPU potential)
- Multi-asset coverage

**Challenges**:
- Higher account minimums ($10K+)
- Smaller user base vs US brokers
- European focus = less US demand

**Dev Action Required**: 
- 🔍 Research OpenAPI documentation
- 🔍 Test with demo account
- 🔍 Estimate integration time: 3-4 days

**Cost Analysis**:
- API Access: $0/month ✅ (for account holders)
- Dev Time: 3-4 days
- Maintenance: Low (mature API)

**Recommendation**: ✅ **APPROVE - Medium Priority**
- Strategic for European expansion

**References**:
- API Docs: https://www.developer.saxo
- Gemini Analysis: Section I.2

---

### 9. 🔧 NinjaTrader (Hybrid Approach)

**Priority Score**: 7.8/10

**Why #9**:
- Dominant futures platform (with Rithmic/CQG)
- Used by many prop firms
- Large community
- C# scripting capability

**Integration Type**: ⚠️ HYBRID (CSV Export + NinjaScript automation)

**Key Stats**:
- **Users**: 500K+ (estimated)
- **Assets**: Futures, Forex
- **API Cost**: N/A (no direct API for retail)
- **CSV Export**: Yes (native)
- **Documentation**: Good (NinjaScript)

**Integration Strategy**:
1. **Primary**: CSV export from NinjaTrader
2. **Advanced**: NinjaScript automation (C# script to auto-export)
3. **Future**: Rithmic R|API+ (expensive, $100+/month)

**Strategic Value**:
- Gateway to prop firm users (Apex, Bulenox, etc.)
- Large futures trader community
- Many users already export CSV manually

**Challenges**:
- No direct REST API for retail
- Rithmic API is expensive
- NinjaScript requires C# knowledge

**Dev Action Required**: 
- 🔍 Research NinjaTrader CSV export format
- 🔍 Create import profile for NinjaTrader CSV
- 🔍 Document NinjaScript automation (optional)
- 🔍 Estimate integration time: 2-3 days (CSV only)

**Cost Analysis**:
- CSV Import: $0 (just file parsing)
- Dev Time: 2-3 days
- Maintenance: Low

**Recommendation**: ✅ **APPROVE - CSV Priority**
- Start with CSV import
- Consider NinjaScript automation later

**References**:
- NinjaScript Docs: https://ninjatrader.com/support/helpGuides/nt8/
- Gemini Analysis: Section II (Prop Firms - Rithmic)

---

### 10. 🌐 IG Group

**Priority Score**: 7.5/10

**Why #10**:
- Largest CFD broker globally
- Strong European/UK presence
- Mature REST API
- 17,000+ markets

**Integration Type**: ✅ API (REST)

**Key Stats**:
- **Users**: 300K+ active accounts
- **Assets**: CFDs on Stocks, Forex, Indices, Commodities
- **API Cost**: FREE
- **Rate Limits**: 40 req/min (moderate)
- **Documentation**: Good

**API Details**:
- **Endpoint**: `/history/activity` for trade history
- **Auth**: OAuth token
- **Historical Data**: Available
- **Community**: Active Python library (ig-markets-api-python-library)

**Strategic Value**:
- European/UK market leader
- CFD trader segment
- Spread betting (UK-specific)

**Challenges**:
- Rate limits are strict (40 req/min)
- CFD focus = different user profile
- Smaller US presence

**Dev Action Required**: 
- 🔍 Research REST API documentation
- 🔍 Test with demo account
- 🔍 Evaluate Python library for integration
- 🔍 Estimate integration time: 3-4 days

**Cost Analysis**:
- API Access: $0/month ✅
- Dev Time: 3-4 days
- Maintenance: Low

**Recommendation**: ✅ **APPROVE - Medium Priority**
- Strategic for European expansion

**References**:
- API Docs: https://labs.ig.com/rest-trading-api-reference
- Gemini Analysis: Section I.3
- Python Library: https://github.com/ig-python/ig-markets-api-python-library

---

## 📊 Priority Matrix

| Rank | Broker | Type | API Available | Integration Time | Cost/Month | Priority | Status |
|------|--------|------|---------------|------------------|------------|----------|--------|
| 1 | Interactive Brokers | Retail | ✅ Flex Query | 0 days | $0 | 🔴 Critical | ✅ Done |
| 2 | Alpaca | Retail | ✅ REST | 2-3 days | $0 | 🔴 Critical | 🔍 Research |
| 3 | OANDA | Forex | ✅ REST v20 | 1-2 days | $0 | 🔴 Critical | 🔍 Research |
| 4 | Tradovate | Futures | ✅ REST | 0 days | $0-25 | 🔴 Critical | ✅ Done |
| 5 | TopstepX | Prop Firm | ✅ ProjectX API | 3-4 days | $0 | 🔴 Critical | 🔍 Research |
| 6 | Charles Schwab | Retail | ✅ REST OAuth | 4-5 days | $0 | 🟠 High | 🔍 Research |
| 7 | TradeStation | Retail | ✅ REST OAuth | 3-4 days | $0 | 🟠 High | 🔍 Research |
| 8 | Saxo Bank | Retail | ✅ OpenAPI | 3-4 days | $0 | 🟡 Medium | 🔍 Research |
| 9 | NinjaTrader | Platform | ⚠️ CSV Only | 2-3 days | $0 | 🟡 Medium | 🔍 Research |
| 10 | IG Group | CFD | ✅ REST | 3-4 days | $0 | 🟡 Medium | 🔍 Research |

**Total Estimated Integration Time**: 18-28 dev days (excluding IBKR & Tradovate already done)

---

## 💰 Cost Analysis Summary

### API Costs (Monthly)

| Broker | API Cost | Notes |
|--------|----------|-------|
| Interactive Brokers | $0 | ✅ Free |
| Alpaca | $0 | ✅ Free |
| OANDA | $0 | ✅ Free |
| Tradovate | $0-25 | Free via prop firms, $15-25 direct |
| TopstepX | $0 | ✅ Free (included) |
| Charles Schwab | $0 | ✅ Free |
| TradeStation | $0 | ✅ Free |
| Saxo Bank | $0 | ✅ Free (for account holders) |
| NinjaTrader | $0 | CSV only |
| IG Group | $0 | ✅ Free |

**Total Monthly API Costs**: $0-25 (only Tradovate if not via prop firm)

### Development Costs

| Phase | Time | Cost Estimate |
|-------|------|---------------|
| Research (8 brokers) | 8-10 days | $4,000-5,000 |
| Implementation (8 APIs + 1 CSV) | 18-28 days | $9,000-14,000 |
| Testing & QA | 5-7 days | $2,500-3,500 |
| Documentation | 3-4 days | $1,500-2,000 |
| **Total** | **34-49 days** | **$17,000-24,500** |

*(Assuming $500/day developer rate)*

---

## 🎯 Strategic Recommendations

### Phase 1: Immediate (Weeks 1-2)
**Goal**: Validate 3 new integrations

1. ✅ **Alpaca** (2-3 days)
   - Easiest integration
   - Developer-friendly
   - Quick win

2. ✅ **OANDA** (1-2 days)
   - Forex market coverage
   - Best API documentation
   - Fastest integration

3. ✅ **TopstepX** (3-4 days)
   - Strategic prop firm entry
   - Unique competitive advantage
   - High user demand

**Total Phase 1**: 6-9 dev days

### Phase 2: High Priority (Weeks 3-4)
**Goal**: Major retail brokers

4. ✅ **Charles Schwab** (4-5 days)
   - Largest US broker
   - OAuth complexity

5. ✅ **TradeStation** (3-4 days)
   - Active trader segment

**Total Phase 2**: 7-9 dev days

### Phase 3: Expansion (Weeks 5-6)
**Goal**: European & specialized

6. ✅ **Saxo Bank** (3-4 days)
   - European expansion

7. ✅ **IG Group** (3-4 days)
   - CFD market

8. ✅ **NinjaTrader CSV** (2-3 days)
   - Prop firm support

**Total Phase 3**: 8-11 dev days

---

## 🚨 Risk Assessment

### High Risks

1. **TopstepX API Stability**
   - **Risk**: New API (2024-2025) may have bugs
   - **Mitigation**: Start with small test group, extensive testing
   - **Impact**: Medium

2. **Schwab OAuth Complexity**
   - **Risk**: App registration may be rejected/delayed
   - **Mitigation**: Apply early, have backup plan (CSV import)
   - **Impact**: Low

3. **Rate Limits**
   - **Risk**: IG Group (40 req/min) may be insufficient for large users
   - **Mitigation**: Implement intelligent caching, batch requests
   - **Impact**: Low

### Medium Risks

4. **Tradovate API Costs**
   - **Risk**: $15-25/month per user if not via prop firm
   - **Mitigation**: Partner with prop firms, document cost clearly
   - **Impact**: Low (most users via prop firms)

5. **Documentation Quality**
   - **Risk**: Some APIs may have outdated docs
   - **Mitigation**: Community research, test thoroughly
   - **Impact**: Low

---

## 📋 Developer Action Items

### Immediate Actions (This Week)

**For @dev Team**:

1. **Alpaca Integration** 🔴 HIGH PRIORITY
   - [ ] Research Alpaca API documentation
   - [ ] Create developer account + API keys
   - [ ] Test with paper trading account
   - [ ] Create `docs/brokers/api-research/alpaca.md`
   - [ ] Notify PM with findings

2. **OANDA Integration** 🔴 HIGH PRIORITY
   - [ ] Research OANDA v20 API documentation
   - [ ] Create demo account + API token
   - [ ] Test transaction history endpoint
   - [ ] Create `docs/brokers/api-research/oanda.md`
   - [ ] Notify PM with findings

3. **TopstepX Integration** 🔴 HIGH PRIORITY
   - [ ] Research ProjectX API documentation
   - [ ] Contact TopstepX for API access
   - [ ] Test with evaluation account (if possible)
   - [ ] Create `docs/brokers/api-research/topstepx.md`
   - [ ] Notify PM with findings + cost analysis

4. **NinjaTrader CSV** 🟠 MEDIUM PRIORITY
   - [ ] Research NinjaTrader CSV export format
   - [ ] Obtain sample CSV files
   - [ ] Create import profile
   - [ ] Create `docs/brokers/csv-formats/ninjatrader.md`
   - [ ] Test with sample data

### Next Week Actions

5. **Charles Schwab** 🟠 HIGH PRIORITY
   - [ ] Register developer app with Schwab
   - [ ] Research OAuth 2.0 flow
   - [ ] Create `docs/brokers/api-research/schwab.md`
   - [ ] Notify PM with app registration status

6. **TradeStation** 🟠 HIGH PRIORITY
   - [ ] Research WebAPI documentation
   - [ ] Create developer account
   - [ ] Create `docs/brokers/api-research/tradestation.md`
   - [ ] Notify PM with findings

### Future Actions

7. **Saxo Bank** 🟡 MEDIUM PRIORITY
8. **IG Group** 🟡 MEDIUM PRIORITY

---

## 📚 References & Sources

### Primary Sources
1. **Gemini Analysis Report** (20 brokers/prop firms)
   - File: `docs/brokers/gemini_analysis.md`
   - Comprehensive analysis of APIs, costs, integration methods

2. **Web Research (January 2026)**
   - Broker API rankings
   - TopstepX API confirmation
   - IBKR Flex Query updates
   - Alpaca market position

### API Documentation Links
- Interactive Brokers: https://www.interactivebrokers.com/campus/ibkr-api-page/
- Alpaca: https://alpaca.markets/docs/
- OANDA: https://developer.oanda.com/rest-live-v20/
- Tradovate: https://api.tradovate.com
- TopstepX: https://help.topstep.com/en/articles/11187768-topstepx-api-access
- Charles Schwab: https://developer.schwab.com
- TradeStation: https://api.tradestation.com
- Saxo Bank: https://www.developer.saxo
- NinjaTrader: https://ninjatrader.com/support/helpGuides/nt8/
- IG Group: https://labs.ig.com/rest-trading-api-reference

---

## 🎯 Success Metrics

### Integration Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| API Integration Success Rate | > 95% | Successful syncs / total syncs |
| Average Sync Time | < 30 seconds | Time to complete full sync |
| Error Rate | < 5% | Failed syncs / total syncs |
| User Adoption | > 60% | Users with broker connected |
| Support Tickets | < 10/week | Broker-related support tickets |

### Business Impact

| Metric | Target | Timeline |
|--------|--------|----------|
| New User Signups | +40% | 3 months post-launch |
| User Retention | +25% | 6 months post-launch |
| Premium Conversions | +30% | 3 months post-launch |
| Competitive Advantage | Top 3 in broker coverage | 6 months |

---

## 📞 PM Decision Required

### Approval Needed For:

1. ✅ **Alpaca Integration** - Approve to proceed?
2. ✅ **OANDA Integration** - Approve to proceed?
3. ✅ **TopstepX Integration** - Approve to proceed? (Strategic priority)
4. ✅ **Charles Schwab** - Approve developer app registration?
5. ✅ **TradeStation** - Approve to proceed?
6. ⏸️ **Saxo Bank** - Approve for Phase 3?
7. ⏸️ **IG Group** - Approve for Phase 3?
8. ✅ **NinjaTrader CSV** - Approve CSV import (no API)?

### Budget Approval

- **Development Cost**: $17,000-24,500 (34-49 dev days)
- **Monthly API Costs**: $0-25/month
- **Total Phase 1-3 Cost**: ~$20,000

**Approve budget?** ⏸️ Awaiting PM response

---

## 📝 Next Steps

### This Week (2026-01-17 to 2026-01-24)

1. **PM Reviews This Document**
   - Approve/reject each broker
   - Approve budget
   - Prioritize Phase 1 brokers

2. **Dev Team Starts Research**
   - Alpaca API research
   - OANDA API research
   - TopstepX API research
   - NinjaTrader CSV format research

3. **PM Notifications**
   - Dev team sends PM notifications for each broker
   - Use template from `docs/brokers/pm-notification-process.md`

### Next Week (2026-01-24 to 2026-01-31)

4. **Implementation Begins**
   - Start with Alpaca (easiest)
   - Then OANDA
   - Then TopstepX

5. **Weekly Status Report**
   - Send to PM every Friday
   - Track progress vs timeline

---

**Document Status**: ✅ Ready for PM Review  
**Action Required**: PM Approval + Dev Team Notification  
**Timeline**: 6-8 weeks for all 10 brokers  
**Budget**: ~$20,000 + $0-25/month ongoing

---

**Prepared By**: John (Product Manager)  
**Date**: 2026-01-17  
**Version**: 1.0  
**Review Date**: 2026-01-24
