# 🏦 Broker Priority List - 50+ Priority Brokers

> **Status**: Draft  
> **Last Updated**: 2026-01-17  
> **Story**: 3.4 - Broker Sync Integration

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Priority Tiers](#priority-tiers)
3. [Broker List](#broker-list)
4. [Integration Status Legend](#integration-status-legend)
5. [API Research Status](#api-research-status)
6. [Next Steps](#next-steps)

---

## Overview

This document lists 50+ priority brokers for integration into Trading Path Journal. Brokers are prioritized based on:

- **Market Share**: Number of active traders
- **Geographic Coverage**: Global vs regional
- **Asset Classes**: Stocks, Futures, Forex, Crypto, Options
- **API Availability**: Public API vs File Upload only
- **User Demand**: Requests from beta users

**🆕 UPDATE 2026-01-17**: PM has completed strategic analysis of Top 10 priority brokers based on Gemini analysis and market research. See:
- **Strategic Analysis**: `docs/brokers/TOP-10-PRIORITY-BROKERS-2026.md`
- **Dev Notification**: `docs/brokers/DEV-NOTIFICATION-TOP-10-BROKERS.md`

---

## Priority Tiers

| Tier | Description | Target Integration |
|------|-------------|-------------------|
| **Tier 1** | Top 10 brokers - Highest priority | API Integration (Completed/In Progress) |
| **Tier 2** | Next 20 brokers - High priority | API Integration (Planned) |
| **Tier 3** | Next 20 brokers - Medium priority | File Upload + API (if available) |
| **Tier 4** | Remaining brokers | File Upload only |

---

## Broker List

### Tier 1 - Top 10 Priority Brokers (API Integration)

**🆕 PM STRATEGIC ANALYSIS COMPLETED (2026-01-17)**

| # | Broker | Country | Asset Classes | Integration Status | API Status | Priority Score | Notes |
|---|--------|---------|---------------|-------------------|------------|----------------|-------|
| 1 | **Interactive Brokers (IBKR)** | USA | Stocks, Futures, Options, Forex | ✅ Completed | ✅ API Available | 9.8/10 | Flex Query API implemented |
| 2 | **Alpaca** | USA | Stocks, Crypto | 🔍 Research | ✅ API Available | 9.5/10 | 🔴 Phase 1 - API-first broker |
| 3 | **OANDA** | USA/UK | Forex, CFDs | 🔍 Research | ✅ API Available | 9.3/10 | 🔴 Phase 1 - Best Forex API |
| 4 | **Tradovate** | USA | Futures | ✅ Completed | ✅ API Available | 9.0/10 | REST API implemented |
| 5 | **TopstepX** | USA | Futures (Prop) | 🔍 Research | ✅ API Available | 8.8/10 | 🔴 Phase 1 - Strategic prop firm |
| 6 | **Charles Schwab** | USA | Stocks, Options, Futures | 🔍 Research | ✅ API Available | 8.5/10 | 🟠 Phase 2 - OAuth 2.0 |
| 7 | **TradeStation** | USA | Stocks, Options, Futures | 🔍 Research | ✅ API Available | 8.3/10 | 🟠 Phase 2 - REST API |
| 8 | **Saxo Bank** | Denmark | Stocks, Forex, Options | 🔍 Research | ✅ API Available | 8.0/10 | 🟡 Phase 3 - European |
| 9 | **NinjaTrader** | USA | Futures, Forex | 🔍 Research | ⚠️ CSV Only | 7.8/10 | 🔴 Phase 1 - CSV import |
| 10 | **IG Group** | UK | Stocks, Forex, CFDs | 🔍 Research | ✅ API Available | 7.5/10 | 🟡 Phase 3 - CFD leader |

### Tier 2 - Next 20 Priority Brokers (High Priority)

| # | Broker | Country | Asset Classes | Integration Status | API Status | Notes |
|---|--------|---------|---------------|-------------------|------------|-------|
| 11 | **Fidelity** | USA | Stocks, Options, Mutual Funds | 🔍 Research | ⚠️ Limited API | CSV export available |
| 12 | **Charles Schwab** | USA | Stocks, Options, Futures | 🔍 Research | ✅ API Available | TD Ameritrade API merger |
| 13 | **Tastyworks** | USA | Options, Futures | 🔍 Research | ✅ API Available | Options-focused broker |
| 14 | **AMP Futures** | USA | Futures | 🔍 Research | ⚠️ Limited API | CQG/Rithmic integration |
| 15 | **TopstepX** | USA | Futures (Prop) | 🔍 Research | ⚠️ Limited API | Prop trading platform |
| 16 | **OANDA** | USA/UK | Forex | 🔍 Research | ✅ API Available | Forex specialist |
| 17 | **FOREX.com** | USA | Forex, CFDs | 🔍 Research | ✅ API Available | Forex specialist |
| 18 | **IG Group** | UK | Stocks, Forex, CFDs | 🔍 Research | ✅ API Available | Global CFD broker |
| 19 | **Saxo Bank** | Denmark | Stocks, Forex, Options | 🔍 Research | ✅ API Available | European broker |
| 20 | **Binance** | Global | Crypto | ✅ Implemented | ✅ API Available | Largest crypto exchange - Spot & Futures |
| 21 | **Coinbase** | USA | Crypto | 🔍 Research | ✅ API Available | Coinbase Pro API |
| 22 | **Kraken** | USA | Crypto | 🔍 Research | ✅ API Available | Crypto exchange |
| 23 | **Bybit** | Global | Crypto | 🔍 Research | ✅ API Available | Crypto derivatives |
| 24 | **OKX** | Global | Crypto | 🔍 Research | ✅ API Available | Crypto exchange |
| 25 | **Bitfinex** | Hong Kong | Crypto | 🔍 Research | ✅ API Available | Crypto exchange |
| 26 | **Deribit** | Netherlands | Crypto Options | 🔍 Research | ✅ API Available | Crypto options specialist |
| 27 | **CME Group** | USA | Futures | 🔍 Research | ✅ API Available | Largest futures exchange |
| 28 | **Rithmic** | USA | Futures | 🔍 Research | ✅ API Available | Professional trading platform |
| 29 | **CQG** | USA | Futures | 🔍 Research | ✅ API Available | Professional trading platform |
| 30 | **Sierra Chart** | USA | Futures, Stocks | 🔍 Research | ✅ API Available | Charting + trading platform |

### Tier 3 - Next 20 Priority Brokers (Medium Priority)

| # | Broker | Country | Asset Classes | Integration Status | API Status | Notes |
|---|--------|---------|---------------|-------------------|------------|-------|
| 31 | **Lightspeed** | USA | Stocks, Options | 📋 Backlog | ✅ API Available | Professional trading |
| 32 | **Centerpoint Securities** | USA | Stocks, Options | 📋 Backlog | ⚠️ Limited API | Professional trading |
| 33 | **SpeedTrader** | USA | Stocks, Options | 📋 Backlog | ⚠️ Limited API | Day trading focused |
| 34 | **CMEG** | St. Vincent | Stocks | 📋 Backlog | ⚠️ Limited API | Offshore broker |
| 35 | **TradeZero** | Bahamas | Stocks | 📋 Backlog | ⚠️ Limited API | Commission-free |
| 36 | **Questrade** | Canada | Stocks, Options | 📋 Backlog | ✅ API Available | Canadian broker |
| 37 | **Interactive Brokers Canada** | Canada | Stocks, Futures, Options | 📋 Backlog | ✅ API Available | IBKR Canadian entity |
| 38 | **Degiro** | Netherlands | Stocks, Options | 📋 Backlog | ⚠️ Limited API | European discount broker |
| 39 | **Trading 212** | UK | Stocks, CFDs | 📋 Backlog | ⚠️ Limited API | European broker |
| 40 | **Plus500** | Israel | CFDs | 📋 Backlog | ⚠️ Limited API | CFD specialist |
| 41 | **eToro** | Israel | Stocks, Crypto, CFDs | 📋 Backlog | ⚠️ Limited API | Social trading |
| 42 | **XTB** | Poland | Stocks, Forex, CFDs | 📋 Backlog | ✅ API Available | European broker |
| 43 | **Admiral Markets** | Estonia | Forex, CFDs | 📋 Backlog | ✅ API Available | European broker |
| 44 | **Pepperstone** | Australia | Forex, CFDs | 📋 Backlog | ✅ API Available | Australian broker |
| 45 | **IC Markets** | Australia | Forex, CFDs | 📋 Backlog | ✅ API Available | Australian broker |
| 46 | **FP Markets** | Australia | Forex, CFDs | 📋 Backlog | ✅ API Available | Australian broker |
| 47 | **CMC Markets** | UK | Stocks, Forex, CFDs | 📋 Backlog | ✅ API Available | UK broker |
| 48 | **City Index** | UK | Forex, CFDs | 📋 Backlog | ✅ API Available | UK broker |
| 49 | **Swissquote** | Switzerland | Stocks, Forex, Options | 📋 Backlog | ✅ API Available | Swiss broker |
| 50 | **Exante** | Malta | Stocks, Futures, Options | 📋 Backlog | ✅ API Available | European broker |

### Additional Brokers (Tier 4 - File Upload Only)

| # | Broker | Country | Asset Classes | Integration Status | API Status | Notes |
|---|--------|---------|---------------|-------------------|------------|-------|
| 51 | **Merrill Edge** | USA | Stocks, Options | 📋 Backlog | ❌ No API | CSV export only |
| 52 | **Ally Invest** | USA | Stocks, Options | 📋 Backlog | ⚠️ Limited API | CSV export available |
| 53 | **Vanguard** | USA | Stocks, Mutual Funds | 📋 Backlog | ❌ No API | CSV export only |
| 54 | **M1 Finance** | USA | Stocks, ETFs | 📋 Backlog | ❌ No API | CSV export only |
| 55 | **Public.com** | USA | Stocks, Crypto | 📋 Backlog | ❌ No API | CSV export only |

---

## Integration Status Legend

| Status | Description |
|--------|-------------|
| ✅ **Completed** | API integration completed and tested |
| 🚧 **In Progress** | Currently implementing API integration |
| 🔍 **Research** | Researching API documentation and requirements |
| 📋 **Backlog** | Planned for future implementation |
| ⏸️ **On Hold** | Waiting for API access or PM approval |
| ❌ **Not Planned** | No API available, file upload only |

## API Status Legend

| Status | Description |
|--------|-------------|
| ✅ **API Available** | Public API with documentation |
| ⚠️ **Limited API** | API exists but limited access or unofficial |
| ❌ **No API** | No API available, CSV/file export only |

---

## API Research Status

### Completed Research (2 brokers)

1. **Interactive Brokers (IBKR)** - ✅ Implemented
   - API: Flex Query API (XML reports)
   - Documentation: https://www.interactivebrokers.com/en/software/am/am/reports/flex_web_service_version_3.htm
   - Auth: Token + Query ID
   - Status: Production ready

2. **Tradovate** - ✅ Implemented
   - API: REST API
   - Documentation: https://api.tradovate.com
   - Auth: API Key + Secret
   - Status: Production ready

### In Research (10 brokers)

3. **TD Ameritrade** - 🔍 Research Required
   - API: REST API (transitioning to Schwab)
   - Documentation: https://developer.tdameritrade.com
   - Auth: OAuth 2.0
   - ⚠️ **PM NOTIFICATION REQUIRED**: API transition to Schwab in progress

4. **NinjaTrader** - 🔍 Research Required
   - API: NinjaTrader 8 API
   - Documentation: https://ninjatrader.com/support/helpGuides/nt8/
   - Auth: API Key
   - ⚠️ **PM NOTIFICATION REQUIRED**: Research costs and access requirements

5. **TradeStation** - 🔍 Research Required
   - API: REST API
   - Documentation: https://api.tradestation.com
   - Auth: OAuth 2.0
   - ⚠️ **PM NOTIFICATION REQUIRED**: Research costs and access requirements

6. **Thinkorswim (Schwab)** - 🔍 Research Required
   - API: Part of TD Ameritrade/Schwab API
   - Documentation: https://developer.schwab.com
   - Auth: OAuth 2.0
   - ⚠️ **PM NOTIFICATION REQUIRED**: Schwab API migration status

7. **E*TRADE** - 🔍 Research Required
   - API: REST API
   - Documentation: https://developer.etrade.com
   - Auth: OAuth 1.0a
   - ⚠️ **PM NOTIFICATION REQUIRED**: Research costs and access requirements

8. **Robinhood** - 🔍 Research Required
   - API: Unofficial API (no official public API)
   - Documentation: Community-maintained
   - Auth: Username/Password (unofficial)
   - ⚠️ **PM NOTIFICATION REQUIRED**: Risk assessment for unofficial API

9. **Webull** - 🔍 Research Required
   - API: Limited/unofficial API
   - Documentation: Community-maintained
   - Auth: API Key (unofficial)
   - ⚠️ **PM NOTIFICATION REQUIRED**: Risk assessment + CSV fallback

10. **Alpaca** - 🔍 Research Required
    - API: REST API
    - Documentation: https://alpaca.markets/docs/
    - Auth: API Key + Secret
    - ⚠️ **PM NOTIFICATION REQUIRED**: Research costs and access requirements

11. **Fidelity** - 🔍 Research Required
    - API: Limited API access
    - Documentation: Not publicly available
    - Auth: Unknown
    - ⚠️ **PM NOTIFICATION REQUIRED**: API access requirements

12. **Charles Schwab** - 🔍 Research Required
    - API: REST API (merged with TD Ameritrade)
    - Documentation: https://developer.schwab.com
    - Auth: OAuth 2.0
    - ⚠️ **PM NOTIFICATION REQUIRED**: Research costs and access requirements

---

## Next Steps

### Immediate Actions (Story 3.4)

1. **Task 1: Complete Research for Top 10 Brokers** (Priority: 🔴 HIGH)
   - Research API documentation for brokers #3-10
   - Document authentication methods
   - Document rate limits and costs
   - Notify PM for each broker with cost/access requirements

2. **Task 2: Implement 3-5 High-Priority Brokers** (Priority: 🔴 HIGH)
   - Select 3-5 brokers from Tier 1 with best API documentation
   - Implement BrokerProvider for each
   - Test with staging accounts
   - Document integration process

3. **Task 3: Enhance File Upload Integration** (Priority: 🟠 MEDIUM)
   - Improve CSV mapping UI
   - Add Excel support
   - Add JSON/XML support for broker exports
   - Create broker-specific import profiles

4. **Task 4: PM Notification Process** (Priority: 🔴 HIGH)
   - Create PM notification template
   - Document notification process
   - Set up notification tracking system

5. **Task 5: Monitoring & Success Rate** (Priority: 🟠 MEDIUM)
   - Implement sync success rate tracking
   - Set up alerts for success rate < 95%
   - Create dashboard for broker sync metrics

### Future Work (Story 3.8)

- Expand to 240+ brokers database
- Create public-facing broker list page
- Add broker comparison features
- Community voting for broker priority

---

## PM Notification Template

**Subject**: [BROKER INTEGRATION] API Research Completed - [Broker Name]

**Broker**: [Broker Name]  
**API Documentation**: [URL]  
**Authentication Method**: [OAuth 2.0 / API Key / etc.]  
**Rate Limits**: [X requests/minute]  
**Costs**: [Free / $X/month / etc.]  
**Access Requirements**: [Public / Partner / etc.]  
**Data Coverage**: [Historical data availability]  
**Recommendation**: [Implement / On Hold / Alternative]

**Next Steps**:
- [ ] PM approval for implementation
- [ ] Budget approval (if costs involved)
- [ ] API access request (if partner program)
- [ ] Implementation timeline

---

## References

- **Story 3.4**: Broker Sync - Integration 50+ Priority Brokers
- **Story 3.8**: Broker List - 240+ Supported Brokers Database
- **Roadmap**: Phase 2 - Multi-Compte & Broker Sync 240+
- **Epic 3**: Multi-Compte Illimité & Broker Sync 240+

---

**Last Updated**: 2026-01-17  
**Maintained By**: Development Team  
**Review Frequency**: Monthly
