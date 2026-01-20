# 🚨 DEV TEAM NOTIFICATION - Top 10 Priority Brokers Research

> **From**: John (Product Manager)  
> **To**: @dev Team  
> **Date**: 2026-01-17  
> **Priority**: 🔴 HIGH  
> **Story**: 3.4 - Broker Sync Integration

---

## 📢 Action Required

I've completed the strategic analysis of broker/prop firm priorities based on Gemini's comprehensive report and current market research. I need the dev team to begin **API research** for the top 10 priority brokers.

**Primary Document**: `docs/brokers/TOP-10-PRIORITY-BROKERS-2026.md`

---

## 🎯 Top 10 Priority Brokers (In Order)

### ✅ Already Implemented
1. **Interactive Brokers (IBKR)** - Flex Query API ✅
2. **Tradovate** - REST API ✅

### 🔍 Research Required (Priority Order)

#### Phase 1: Immediate (This Week)

3. **Alpaca** 🔴 CRITICAL
   - API-first broker, cleanest REST API
   - FREE API, excellent documentation
   - Estimated integration: 2-3 days
   - **Action**: Research REST API for trade history

4. **OANDA** 🔴 CRITICAL
   - Best Forex API (v20 REST)
   - FREE API, official Python SDK
   - Estimated integration: 1-2 days (easiest!)
   - **Action**: Research v20 API transaction endpoints

5. **TopstepX** 🔴 CRITICAL (Strategic)
   - First prop firm with native API
   - Opens door to 100K+ prop traders
   - Estimated integration: 3-4 days
   - **Action**: Research ProjectX API, test with evaluation account

6. **NinjaTrader** 🟠 HIGH (CSV Priority)
   - No direct API, CSV export only
   - Used by many prop firms
   - Estimated integration: 2-3 days
   - **Action**: Research CSV export format, create import profile

#### Phase 2: Next Week

7. **Charles Schwab (TD Ameritrade)** 🟠 HIGH
   - Largest US broker (33M+ accounts)
   - OAuth 2.0 complexity
   - Estimated integration: 4-5 days
   - **Action**: Register developer app, research OAuth flow

8. **TradeStation** 🟠 HIGH
   - Active trader platform
   - REST API with OAuth
   - Estimated integration: 3-4 days
   - **Action**: Research WebAPI documentation

#### Phase 3: Future (Weeks 3-4)

9. **Saxo Bank** 🟡 MEDIUM
   - European premium broker
   - Excellent OpenAPI
   - Estimated integration: 3-4 days

10. **IG Group** 🟡 MEDIUM
    - Largest CFD broker
    - REST API with Python library
    - Estimated integration: 3-4 days

---

## 📋 Research Tasks (This Week)

### Task 1: Alpaca API Research 🔴 HIGH PRIORITY

**Assigned To**: [Dev Name]  
**Deadline**: 2026-01-20 (3 days)  
**Estimated Time**: 4-6 hours

**Research Checklist**:
- [ ] Create Alpaca developer account: https://alpaca.markets/
- [ ] Generate API keys (paper trading)
- [ ] Test authentication
- [ ] Research endpoints:
  - [ ] `GET /v2/account` - Account info
  - [ ] `GET /v2/orders` - Order history
  - [ ] `GET /v2/positions` - Positions
- [ ] Document rate limits (200 req/min expected)
- [ ] Test with sample trades
- [ ] Evaluate Python/Node SDKs
- [ ] Create research document: `docs/brokers/api-research/alpaca.md`
- [ ] **Notify PM with findings** (use template below)

**Key Questions**:
1. Can we retrieve full trade history?
2. What's the historical data limit?
3. Are commissions included in trade data?
4. How are fractional shares handled?
5. WebSocket for real-time sync?

**Expected Outcome**: 
- Research document completed
- Demo account tested
- Integration feasibility confirmed
- Cost: $0/month ✅

---

### Task 2: OANDA v20 API Research 🔴 HIGH PRIORITY

**Assigned To**: [Dev Name]  
**Deadline**: 2026-01-20 (3 days)  
**Estimated Time**: 3-5 hours

**Research Checklist**:
- [ ] Create OANDA demo account: https://www.oanda.com/
- [ ] Generate API token
- [ ] Test authentication (Bearer token)
- [ ] Research v20 API:
  - [ ] `/accounts/{accountID}/transactions` endpoint
  - [ ] Transaction types (trade, margin call, interest, etc.)
  - [ ] Historical data availability
- [ ] Test official Python SDK: `v20-python`
- [ ] Document rate limits (120 req/20 sec)
- [ ] Create research document: `docs/brokers/api-research/oanda.md`
- [ ] **Notify PM with findings**

**Key Questions**:
1. Can we retrieve full transaction history?
2. How are Forex trades structured (open/close)?
3. Are swap/interest payments included?
4. How to map OANDA instruments to our symbols?
5. Real-time streaming available?

**Expected Outcome**: 
- Research document completed
- Demo account tested
- Integration confirmed as easiest (1-2 days)
- Cost: $0/month ✅

---

### Task 3: TopstepX ProjectX API Research 🔴 CRITICAL (Strategic)

**Assigned To**: [Dev Name]  
**Deadline**: 2026-01-22 (5 days)  
**Estimated Time**: 6-8 hours

**Research Checklist**:
- [ ] Review TopstepX API docs: https://help.topstep.com/en/articles/11187768-topstepx-api-access
- [ ] Contact TopstepX support for API access
- [ ] Understand API token generation (ProjectX)
- [ ] Research endpoints:
  - [ ] Account info
  - [ ] Trade history
  - [ ] Real-time data (WebSocket)
- [ ] Test with evaluation account (if possible)
- [ ] Document rate limits (unknown - new API)
- [ ] Document restrictions (no VPN, no sandbox)
- [ ] Create research document: `docs/brokers/api-research/topstepx.md`
- [ ] **Notify PM with findings + risk assessment**

**Key Questions**:
1. How to obtain API access? (automatic or approval required?)
2. What's the cost? (expected: FREE)
3. Can we test without paying for evaluation?
4. What are the rate limits?
5. How stable is the API? (launched 2024-2025)
6. How to handle Topstep's transition from Tradovate/Rithmic?

**Expected Outcome**: 
- Research document completed
- API access confirmed
- Risk assessment (new API = potential bugs)
- Integration plan: 3-4 days
- Cost: $0/month ✅

**⚠️ Strategic Note**: This is the ONLY prop firm with native API. Critical competitive advantage vs TradeZella/Tradervue.

---

### Task 4: NinjaTrader CSV Format Research 🟠 HIGH PRIORITY

**Assigned To**: [Dev Name]  
**Deadline**: 2026-01-22 (5 days)  
**Estimated Time**: 4-6 hours

**Research Checklist**:
- [ ] Download NinjaTrader 8 (free): https://ninjatrader.com/
- [ ] Create demo account (Rithmic or CQG)
- [ ] Place test trades in simulator
- [ ] Export trade history to CSV:
  - [ ] Window > Order History > Export
- [ ] Analyze CSV format:
  - [ ] Column headers
  - [ ] Date/time format
  - [ ] Symbol format (ES 03-26, NQ 03-26, etc.)
  - [ ] Entry/exit prices
  - [ ] PnL calculation
- [ ] Obtain multiple CSV samples (different instruments)
- [ ] Create import profile for NinjaTrader
- [ ] Document in: `docs/brokers/csv-formats/ninjatrader.md`
- [ ] **Notify PM with findings**

**Key Questions**:
1. What's the exact CSV format?
2. How are futures contracts named? (ES 03-26 vs ESH26?)
3. Are commissions included?
4. How to handle multi-fill orders?
5. Can we auto-detect NinjaTrader CSV format?

**Expected Outcome**: 
- CSV format documented
- Import profile created
- Sample CSV files saved
- Integration: 2-3 days
- Cost: $0 (CSV only) ✅

**Note**: This is a CSV-only integration (no API). Future: Consider NinjaScript automation.

---

## 📧 PM Notification Template

After completing research for each broker, send notification using this template:

```
Subject: [BROKER INTEGRATION] API Research Completed - [Broker Name]

Hi John,

I've completed the API research for [Broker Name] integration. Here's the summary:

**Broker**: [Broker Name]
**Priority Tier**: [Tier 1A/1B/etc.]
**API Documentation**: [URL]

**Key Findings**:
- Authentication: [OAuth 2.0 / API Key / etc.]
- Rate Limits: [X requests/minute]
- Costs: [Free / $X/month]
- Access: [Public / Partner Program / etc.]
- Data Coverage: [Historical data availability]

**Technical Details**:
- Endpoints tested: [List]
- Sample data retrieved: [Yes/No]
- SDK available: [Yes/No - Language]
- Real-time sync: [Yes/No - Method]

**Integration Estimate**:
- Development Time: [X] days
- Complexity: [Low/Medium/High]
- Maintenance: [Low/Medium/High]

**Cost Breakdown**:
- API Access: $[X]/month (or Free)
- Development Time: [X] days
- Total Estimated Cost: $[X]/month + [Y] days dev time

**Recommendation**: [Implement / On Hold / Alternative Approach]

**Risk Assessment**: [Low / Medium / High]
- [Key risks and mitigations]

**User Demand**: [High / Medium / Low]
- [Market share, user base, competitive advantage]

**Next Steps**:
- [ ] PM approval for implementation
- [ ] Budget approval (if costs involved)
- [ ] API access request (if partner program)
- [ ] Implementation timeline

**Full Research Document**: docs/brokers/api-research/[broker-name].md

Please review and let me know if you approve moving forward with implementation.

Thanks,
[Your Name]
```

---

## 📊 Research Document Template

Use this template for each broker research document:

**Location**: `docs/brokers/api-research/[broker-name].md`

**Template**: See `docs/brokers/api-research/README.md`

**Required Sections**:
1. Overview
2. API Documentation
3. Authentication
4. Endpoints
5. Rate Limits
6. Data Coverage
7. Cost Analysis
8. Integration Estimate
9. Risk Assessment
10. Recommendation
11. Code Examples

---

## 🎯 Success Criteria

### For Each Broker Research

- [ ] Research document completed (all 11 sections)
- [ ] Demo/sandbox account tested
- [ ] API authentication successful
- [ ] Sample trade data retrieved
- [ ] Rate limits documented
- [ ] Cost analysis completed
- [ ] Integration estimate provided
- [ ] Risk assessment completed
- [ ] PM notification sent
- [ ] Tracking system updated

### Phase 1 Success (This Week)

- [ ] Alpaca research completed
- [ ] OANDA research completed
- [ ] TopstepX research completed
- [ ] NinjaTrader CSV format documented
- [ ] All PM notifications sent
- [ ] Ready to start implementation next week

---

## 📅 Timeline

### Week 1 (2026-01-17 to 2026-01-24)
- **Mon-Wed**: Alpaca + OANDA research
- **Thu-Fri**: TopstepX + NinjaTrader research
- **Fri**: Send PM notifications + weekly report

### Week 2 (2026-01-24 to 2026-01-31)
- **Mon**: PM approvals received
- **Tue-Fri**: Start implementation (Alpaca first)

### Week 3-4 (Phase 2)
- Charles Schwab research + implementation
- TradeStation research + implementation

### Week 5-6 (Phase 3)
- Saxo Bank + IG Group research + implementation

---

## 💰 Budget Summary

### Phase 1 (This Week - Research Only)

| Broker | Research Time | Cost |
|--------|---------------|------|
| Alpaca | 4-6 hours | ~$200-300 |
| OANDA | 3-5 hours | ~$150-250 |
| TopstepX | 6-8 hours | ~$300-400 |
| NinjaTrader | 4-6 hours | ~$200-300 |
| **Total** | **17-25 hours** | **~$850-1,250** |

### Total Project (All 10 Brokers)

- **Research**: 8-10 days (~$4,000-5,000)
- **Implementation**: 18-28 days (~$9,000-14,000)
- **Testing**: 5-7 days (~$2,500-3,500)
- **Documentation**: 3-4 days (~$1,500-2,000)
- **Total**: 34-49 days (~$17,000-24,500)

**Monthly API Costs**: $0-25/month (only Tradovate if not via prop firm)

---

## 🚨 Important Notes

### Critical Points

1. **TopstepX is Strategic Priority** 🔥
   - Only prop firm with native API
   - Competitive advantage
   - 100K+ potential users
   - Must validate API stability (new API)

2. **OANDA is Easiest Integration**
   - Start here for quick win
   - Best API documentation
   - 1-2 days integration

3. **NinjaTrader is CSV Only**
   - No REST API for retail
   - CSV import is acceptable
   - Used by many prop firms

4. **Schwab Requires App Registration**
   - OAuth 2.0 complexity
   - May take time to get approved
   - Start registration early

### Risk Mitigation

- **TopstepX**: New API = extensive testing required
- **Schwab**: OAuth = more complex, may need fallback (CSV)
- **Rate Limits**: IG Group (40 req/min) = implement caching

---

## 📞 Questions?

If you have questions about:
- **Priorities**: Contact John (PM)
- **Technical**: Discuss in #broker-integrations Slack
- **Budget**: Contact John (PM)
- **Timeline**: Discuss in weekly sync

---

## 📋 Checklist (Dev Team)

### Before Starting Research

- [ ] Read this notification document
- [ ] Read `docs/brokers/TOP-10-PRIORITY-BROKERS-2026.md`
- [ ] Review `docs/brokers/pm-notification-process.md`
- [ ] Understand PM notification requirements
- [ ] Assign tasks to team members

### During Research

- [ ] Create demo/sandbox accounts
- [ ] Test API authentication
- [ ] Document all findings
- [ ] Take screenshots for documentation
- [ ] Save sample data/CSV files

### After Research

- [ ] Complete research documents
- [ ] Send PM notifications (use template)
- [ ] Update tracking system
- [ ] Update PROJECT_MEMORY.md
- [ ] Prepare for implementation

---

## 🔗 Key Documents

1. **Strategic Analysis**: `docs/brokers/TOP-10-PRIORITY-BROKERS-2026.md`
2. **PM Notification Process**: `docs/brokers/pm-notification-process.md`
3. **Broker Priority List**: `docs/brokers/broker-priority-list.md`
4. **Integration Tracker**: `docs/brokers/broker-integration-tracker.md`
5. **Gemini Analysis**: `docs/brokers/gemini_analysis.md`

---

## 📊 Weekly Reporting

Send weekly status report every Friday:

```
Subject: [WEEKLY] Broker Integration Status - Week of [Date]

**Completed This Week**:
- [Broker Name]: Research completed, PM notified
- [Broker Name]: Implementation started

**Awaiting PM Approval**:
- [Broker Name]: Notified on [Date], awaiting decision

**In Progress**:
- [Broker Name]: Research 50% complete

**Blockers**:
- [Broker Name]: Waiting for API access

**Next Week Plan**:
- Complete [Broker Name] research
- Start [Broker Name] implementation
```

---

## 🎯 Expected Outcomes

### End of Week 1 (2026-01-24)

- ✅ 4 brokers researched (Alpaca, OANDA, TopstepX, NinjaTrader)
- ✅ 4 research documents completed
- ✅ 4 PM notifications sent
- ✅ Ready to start implementation

### End of Phase 1 (2026-01-31)

- ✅ 3 APIs implemented (Alpaca, OANDA, TopstepX)
- ✅ 1 CSV import (NinjaTrader)
- ✅ All tested and documented

### End of Project (6-8 weeks)

- ✅ 10 brokers/prop firms integrated
- ✅ 8 API integrations + 2 CSV imports
- ✅ Full documentation
- ✅ Competitive advantage achieved

---

**Action Required**: Start research this week (2026-01-17)  
**Priority**: 🔴 HIGH  
**Questions**: Contact John (PM)

---

**Prepared By**: John (Product Manager)  
**Date**: 2026-01-17  
**Version**: 1.0
