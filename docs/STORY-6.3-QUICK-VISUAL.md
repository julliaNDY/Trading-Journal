# 📊 Story 6.3 — Quick Visual Summary

**Objectif**: Afficher les points d'entrée/sortie (buy/sell) sur TradingView comme dans `chart_example.png`

---

## 🎯 Cible Visuelle

```
TradingView Chart (MES, 1m timeframe)
┌──────────────────────────────────────────────┐
│  Price                        Indicators     │
│  5352 ├─────────────────────────────────────│ ↑ ← Exit (flèche rouge ⊗)
│  5351 │      ╱╲                            │   @ 5352.00
│  5350 │     ╱  ╲                           │
│  5349 │    ╱    ╲─────                     │
│  5348 │   ╱          ╲                     │
│  5347 │  ╱            ╱╲  Entry (flèche bleue ↓)
│  5346 │                ╲│   @ 5347.25
│  5345 │                 ╲─────             │
│────────┼────────────────────────────────────┤
│ Time: 08:00  08:15  08:30  08:45  09:00    │
│                                             │
│ Tooltips (on hover):                       │
│ - BUY: 1 @ 5347.25, Time: 08:47 AM        │
│ - P&L: +150.50 USD                        │
│ - R:R: 2.5                                 │
└──────────────────────────────────────────────┘
```

---

## 🏗️ Architecture - 3 Couches

```
┌─ FRONTEND ──────────────────────────────────┐
│                                             │
│  TradingViewChart Component                 │
│  ├─ useTradingViewExecutions Hook          │
│  │  ├─ fetchExecutions() — API call        │
│  │  ├─ updateExecutions() — idempotent     │
│  │  └─ clearExecutions() — cleanup         │
│  └─ Renders: chart + markers               │
│                                             │
├─ BACKEND ──────────────────────────────────┤
│                                             │
│  GET /api/trades/executions                │
│  ├─ Params: symbol, from, to               │
│  ├─ Query DB trades table                  │
│  ├─ Map to ExecutionMarker[]               │
│  └─ Response: 200ms avg                    │
│                                             │
├─ TYPES ────────────────────────────────────┤
│                                             │
│  ExecutionMarker                           │
│  ├─ id, symbol, time, price, side         │
│  ├─ qty, pnl, rratio (optional)           │
│  ├─ tooltip, text, colors                 │
│  └─ Maps to TradingView marker API        │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 📋 6 Phases — Quick Checklist

| Phase | Tasks | Estimated | Status |
|-------|-------|-----------|--------|
| **1** — **Types** | ExecutionMarker + styling | 1 day | 🟠 |
| **2** — **API** | Executions endpoint + validation | 1.5 days | 🟠 |
| **3** — **Component** | Hook + React integration | 1.5 days | 🟠 |
| **4** — **Testing** | Unit/integration + perf bench | 1.5 days | 🟠 |
| **5** — **Polish** | Filters, interactivity, mobile | 1 day | 🟠 |
| **6** — **Docs** | Update story, JSDoc, memory | 0.5 day | 🟠 |
| **TOTAL** | | **~7 days** | 🟠 |

---

## 🔑 Key Implementation Details

### ExecutionMarker Interface
```ts
{
  id: string;           // tradeId
  symbol: string;       // MES, AAPL, etc.
  time: number;         // unix seconds
  price: number;        // 5347.25
  side: 'buy' | 'sell'; // entry or exit
  qty?: number;
  pnlUsd?: number;      // +150.50
  riskRewardRatio?: number; // 2.5
  tooltip?: string;     // multi-line
  arrowColor?: string;  // #2962FF (blue) or #F23645 (red)
}
```

### TradingView API Call (Key Code)
```ts
// After onChartReady()
const chart = widget.activeChart();
const exec = await chart.createExecutionShape();

exec
  .setTime(marker.time)          // unix seconds
  .setPrice(marker.price)        // 5347.25
  .setDirection(marker.side)     // 'buy' or 'sell'
  .setText(buildLabel(marker))   // "Entry @ 5347.25 (+150.50)"
  .setTooltip(buildTooltip(marker)) // "BUY: 1 @ 5347.25\n..."
  .setArrowColor(marker.arrowColor); // #2962FF or #F23645
```

### Lifecycle Management
```
Component Mount
  → widget.onChartReady()
    → fetchExecutions() [API call]
      → updateExecutions(markers) [idempotent clear + render]

Symbol/Timeframe Change
  → fetchExecutions() triggered via useEffect
    → clearExecutions() [remove all markers]
    → updateExecutions(newMarkers) [render new]

Component Unmount
  → clearExecutions() [cleanup]
  → widget.remove()
```

---

## 📈 Performance Targets (Hard Gates)

| Metric | Target | Tool |
|--------|--------|------|
| Chart init time | < 2.0s | Lighthouse |
| API response | < 500ms | Network tab |
| Marker render (50 markers) | < 300ms | Performance timeline |
| Memory usage | < 5MB per chart | DevTools |
| Lighthouse score | ≥ 80 | Lighthouse audit |
| First Contentful Paint | < 2s | Lighthouse |

---

## 🚨 Potential Gotchas

| Issue | Solution |
|-------|----------|
| createExecutionShape() not available | Verify TradingView bundle includes "Trading primitives" (may require certain license tier) |
| Marker timestamp not on bar | TradingView auto-snaps to nearest bar; ensure time precision (unix seconds) |
| Memory leak on unmount | Always call `exec.remove()` in cleanup; use Map to track adapters |
| API timeout for 1000+ trades | Add pagination/filtering (date range, symbol list); cache results |
| Mobile tooltips clipped | Reposition tooltip logic; test on actual devices |

---

## 🔗 File References

```
docs/
├── STORY-6.3-ROADMAP.md          ← FULL ROADMAP (this summary references it)
├── stories/6.3.story.md           ← Updated story with roadmap link
├── chart_example.png              ← Visual target
├── tradingview_API.md             ← BMAD integration guide
└── PLAN-GLOBAL-1.1-17.1.md       ← Epic/Phase mapping

src/
├── lib/types/execution.ts         ← TO CREATE
├── components/charts/
│   ├── tradingview-chart.tsx      ← TO MODIFY
│   ├── hooks/useTradingViewExecutions.ts ← TO CREATE
│   └── utils/execution-markers.ts ← TO CREATE
└── app/api/trades/executions/route.ts ← TO CREATE

tests/
├── execution-markers.test.ts      ← TO CREATE
└── api/executions.test.ts         ← TO CREATE
```

---

## ✅ Definition of Done (per phase)

**Phase 1 ✅**: ExecutionMarker compiles, no runtime errors, aligned with API response  
**Phase 2 ✅**: Endpoint returns valid data, < 500ms, secure, error cases handled  
**Phase 3 ✅**: Hook no memory leaks, lifecycle correct, renders markers on chart  
**Phase 4 ✅**: 80%+ test coverage, all perf targets met, Lighthouse ≥ 80  
**Phase 5 ✅**: Filters work, mobile responsive, interactions smooth  
**Phase 6 ✅**: Story AC updated, JSDoc added, PROJECT_MEMORY documented  

---

**Created**: 2026-01-24  
**Phase**: 6 (Replay & Visualization)  
**Epic**: 6 (Entry/Exit Overlays)  
**Ready for**: Sprint Planning
