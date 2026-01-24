# 📋 Story 6.3 Roadmap — Full TradingView Advanced Charts Integration

> **Objectif**: Intégrer **TradingView Advanced Charts Library v29** avec toutes les fonctionnalités natives (toolbar, header, drawings, indicators) + overlay des exécutions de trades (buy/sell markers).  
> **Basé sur**: `docs/tradingview_API.md` + [TradingView Charting Library Docs v29](https://www.tradingview.com/charting-library-docs/latest/api/)  
> **Visual Reference**: `docs/chart_example.png` (toolbar gauche, header avec timeframes, indicateurs volume)  
> **Status**: 🟠 Ready to Dev (Phase 6, Epic 6)  
> **Date**: 2026-01-24  
> **Scope**: Full Advanced Charts (NOT Lightweight)

---

## 🎯 Objectif Produit

Fournir une **expérience TradingView complète "Chartist-ready"** permettant aux traders de:
- ✅ **Dessiner** sur le chart (Trend Lines, Fibonacci, Horizontal Lines, Rectangles, Text)
- ✅ **Changer de timeframe** via le header (1m, 5m, 15m, 1H, 4H, D, W)
- ✅ **Ajouter des indicateurs** (Volume, SMA, EMA, RSI, MACD)
- ✅ **Visualiser leurs exécutions** (entry/exit markers via `createExecutionShape`)
- ✅ **Tooltips détaillées** (price, time, PnL, R:R)
- ✅ **Performance** < 2s load time
- ✅ **Theme Dark** aligné avec l'app

---

## 📊 État Actuel de l'Intégration TradingView

### ✅ Pré-requis à Vérifier
- [ ] Vérifier composant existant `src/components/charts/tradingview-chart.tsx`
- [ ] Vérifier l'existence d'un service datafeed
- [ ] Auditer les dépendances TradingView chargées
- [ ] Confirmer bundle = **Advanced Charts** (not Lightweight)

### ⏳ À Développer (Cette Roadmap)
- [ ] **Widget Constructor** avec `enabled_features` (toolbar, header, drawings)
- [ ] Interface `ExecutionMarker` + mapping BUY/SELL
- [ ] Fonction idempotente `updateExecutions(markers)` avec clear/render
- [ ] Lifecycle management (onChartReady, unmount, symbol change)
- [ ] API endpoint `GET /api/trades/executions`
- [ ] Tests de rendu + performance

### 🔮 Out of Scope v1 (Story 6.4)
- [ ] Drawing persistence (save/load user drawings to DB)

---

## 🏗️ Architecture Cible

```
┌──────────────────────────────────────────────────────────────────┐
│ Component: TradingView Advanced Charts (Full Integration)        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TradingView Widget (Advanced Charts Library v29)                │
│  ├── Left Toolbar (Drawing Tools: TrendLine, Fib, HLine, etc.)   │
│  ├── Header Widget (Timeframes, Indicators, Chart Type, etc.)    │
│  ├── Main Chart (Candlesticks + Studies + Drawings)             │
│  └── Execution Markers (via createExecutionShape)                │
│                                                                  │
│  src/components/charts/                                          │
│  ├── tradingview-chart.tsx              ← Main component         │
│  │   └── Widget Constructor config      ← enabled_features       │
│  ├── hooks/                                                      │
│  │   └── useTradingViewExecutions.ts    ← Execution marker hook  │
│  └── utils/                                                      │
│      └── execution-markers.ts           ← Mapping + styling      │
│                                                                  │
│  src/lib/                                                        │
│  ├── types/execution.ts                 ← ExecutionMarker interface│
│  └── services/                                                   │
│      └── chart-service.ts               ← Chart state management │
│                                                                  │
│  src/app/api/trades/                                             │
│  └── executions/route.ts                ← GET /api/trades/executions│
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📝 Phase 1: Foundation (Contracts & Types)

### Task 1.1: Define ExecutionMarker Interface
**Files**: `src/lib/types/execution.ts` (create)

```ts
export interface ExecutionMarker {
  id: string;                  // tradeId (stable, unique)
  symbol: string;              // ex: 'AAPL', 'BTC/USD', 'ES'
  time: number;                // unix timestamp (seconds)
  price: number;               // entry or exit price
  side: 'buy' | 'sell';        // direction
  qty?: number;                // quantity (optional, for label)
  entryPrice?: number;         // for exit markers, ref entry price
  exitPrice?: number;          // for exit markers
  pnlUsd?: number;             // realized P&L (optional)
  riskRewardRatio?: number;    // R:R ratio (optional)
  text?: string;               // label short (ex: "Entry", "Exit @5351.25")
  tooltip?: string;            // multi-line tooltip
  arrowColor?: string;         // override color (hex or rgba)
  textColor?: string;          // override text color
}

export interface ChartState {
  symbol: string;
  timeframe: string;
  executionsById: Map<string, any>;  // adapter reference
}
```

**Acceptance**: ✅ Types exported, no runtime errors

---

### Task 1.2: Define Execution Styling Constants
**Files**: `src/components/charts/utils/execution-markers.ts` (create)

```ts
export const EXECUTION_STYLES = {
  buy: {
    arrowColor: '#2962FF',     // blue
    textColor: '#FFFFFF',
    label: 'Entry',
  },
  sell: {
    arrowColor: '#F23645',     // red
    textColor: '#FFFFFF',
    label: 'Exit',
  },
};

export function buildExecutionLabel(marker: ExecutionMarker): string {
  const price = marker.price.toFixed(2);
  if (marker.pnlUsd !== undefined) {
    const pnlStr = marker.pnlUsd >= 0 ? `+${marker.pnlUsd}` : `${marker.pnlUsd}`;
    return `${marker.text ?? EXECUTION_STYLES[marker.side].label} @ ${price} (${pnlStr})`;
  }
  return `${marker.text ?? EXECUTION_STYLES[marker.side].label} @ ${price}`;
}

export function buildExecutionTooltip(marker: ExecutionMarker): string {
  const lines = [];
  lines.push(`${marker.side.toUpperCase()}: ${marker.qty ?? '?'} @ ${marker.price.toFixed(2)}`);
  lines.push(`Time: ${new Date(marker.time * 1000).toLocaleTimeString()}`);
  if (marker.pnlUsd !== undefined) {
    lines.push(`P&L: ${marker.pnlUsd >= 0 ? '+' : ''}${marker.pnlUsd.toFixed(2)} USD`);
  }
  if (marker.riskRewardRatio !== undefined) {
    lines.push(`R:R: ${marker.riskRewardRatio.toFixed(2)}`);
  }
  return lines.join('\n');
}
```

**Acceptance**: ✅ Styling constants exported, helper functions tested

---

## 🛠️ Phase 2: Widget Configuration (Full Advanced Charts)

### Task 2.1: Configure Widget Constructor
**Files**: `src/components/charts/tradingview-chart.tsx` (modify)

**Critical Configuration** — enables full toolbar, header, and drawing tools:

```ts
const widget = new (window as any).TradingView.widget({
  // Core
  container: chartContainerRef.current,
  library_path: '/charting_library/',
  datafeed: getDatafeed(),
  symbol,
  interval: timeframe,
  timezone: 'Etc/UTC',
  theme: 'dark',
  autosize: true,
  
  // ✅ REQUIRED: Enable full Advanced Charts features
  enabled_features: [
    // Left Toolbar (Drawing Tools)
    'left_toolbar',
    'drawing_templates',
    
    // Header Widget
    'header_widget',
    'header_indicators',
    'header_symbol_search',
    'header_resolutions',
    'header_chart_type',
    'header_settings',
    'header_screenshot',
    'header_fullscreen_button',
    'header_compare',
    
    // Studies/Indicators
    'study_templates',
    'show_interval_dialog_on_key_press',
    
    // UX
    'use_localstorage_for_settings',
    'save_chart_properties_to_local_storage',
  ],
  
  // Disable features that conflict with our UX
  disabled_features: [
    'header_undo_redo', // optional: disable undo/redo
  ],
  
  // Toolbar & Drawings — enable ALL tools
  drawings_access: {
    type: 'black',  // blacklist mode (empty = all allowed)
    tools: [],      // no tools blacklisted
  },
  
  // Default studies (indicators)
  studies_overrides: {
    'volume.volume.color.0': '#F23645',  // down volume red
    'volume.volume.color.1': '#26A69A',  // up volume green
  },
  
  // Overrides for styling
  overrides: {
    'mainSeriesProperties.candleStyle.upColor': '#26A69A',
    'mainSeriesProperties.candleStyle.downColor': '#F23645',
    'mainSeriesProperties.candleStyle.borderUpColor': '#26A69A',
    'mainSeriesProperties.candleStyle.borderDownColor': '#F23645',
    'mainSeriesProperties.candleStyle.wickUpColor': '#26A69A',
    'mainSeriesProperties.candleStyle.wickDownColor': '#F23645',
  },
});
```

**Acceptance Criteria**:
- [ ] Left toolbar visible with drawing tools (Trend Line, Horizontal Line, Fibonacci, Rectangle, Text)
- [ ] Header widget visible with: symbol search, timeframe selector, indicators button, chart type, settings
- [ ] Drawings can be created and manipulated on the chart
- [ ] Dark theme applied correctly

---

### Task 2.2: Verify Toolbar Functionality
**Files**: Same as 2.1

**Manual Verification Checklist**:
- [ ] Click "Trend Line" tool → draw on chart → works
- [ ] Click "Fibonacci Retracement" tool → draw on chart → works
- [ ] Click "Horizontal Line" tool → draw on chart → works
- [ ] Click "Rectangle" tool → draw on chart → works
- [ ] Click "Text" tool → add text annotation → works

**Acceptance**: ✅ All drawing tools functional

---

### Task 2.3: Verify Header Functionality
**Files**: Same as 2.1

**Manual Verification Checklist**:
- [ ] Timeframe selector → change from 1m to 5m, 15m, 1H, 4H, D, W → works
- [ ] Indicators button → open panel → add Volume, SMA, EMA, RSI, MACD → works
- [ ] Chart type selector → switch to Candlestick, Line, Bar → works
- [ ] Settings button → opens settings dialog → works
- [ ] Screenshot button → captures chart image → works
- [ ] Fullscreen button → toggles fullscreen → works

**Acceptance**: ✅ All header controls functional

---

### Task 2.4: Verify Indicators Panel
**Files**: Same as 2.1

**Manual Verification Checklist**:
- [ ] Add Volume indicator → displays in separate pane → works
- [ ] Add SMA(20) → displays on main chart → works
- [ ] Add EMA(50) → displays on main chart → works
- [ ] Add RSI(14) → displays in separate pane → works
- [ ] Add MACD → displays in separate pane → works
- [ ] Remove indicators → works
- [ ] Configure indicator parameters → works

**Acceptance**: ✅ Indicators panel fully operational

---

## 📡 Phase 3: Backend API (Data Provider)

### Task 3.1: Create Executions Endpoint
**Files**: `src/app/api/trades/executions/route.ts` (create)

**Query Params**:
- `symbol`: string (required)
- `from`: unix timestamp seconds (required)
- `to`: unix timestamp seconds (required)
- `tradeIds`: comma-separated IDs (optional, for filtering)

**Response**:
```json
{
  "status": "ok",
  "data": [
    {
      "id": "trade-uuid-1",
      "symbol": "MES",
      "time": 1706092800,
      "price": 5435.25,
      "side": "buy",
      "qty": 1,
      "pnlUsd": 150.50,
      "riskRewardRatio": 2.5,
      "text": "Entry",
      "tooltip": "BUY: 1 @ 5435.25\nTime: 09:00 AM\nP&L: +150.50 USD\nR:R: 2.5"
    }
  ]
}
```

**Implementation**:
- [ ] Query trades table filtered by:
  - `symbol` (case-insensitive, normalized)
  - `closedAt BETWEEN from AND to`
  - Optional: `tradeIds` IN (...)
- [ ] Map each trade to `ExecutionMarker`:
  - Entry marker: `{ time: openedAt, price: entryPrice, side: 'buy' }`
  - Exit marker: `{ time: closedAt, price: exitPrice, side: 'sell' }`
- [ ] Calculate tooltip via helper `buildExecutionTooltip()`
- [ ] Return sorted by `time` ascending
- [ ] Rate limit: 100 requests/min per user

**Acceptance**: ✅ Endpoint returns valid ExecutionMarker[], sorted, < 500ms response

---

### Task 3.2: Add Validation & Error Handling
**Files**: Same as 3.1

- [ ] Validate `from < to` (reject invalid ranges)
- [ ] Validate `symbol` non-empty
- [ ] Return 400 for missing required params
- [ ] Return 401 if user not authenticated
- [ ] Return 404 if symbol not found in user's trades
- [ ] Catch DB errors, return 500 with generic message

**Acceptance**: ✅ All edge cases handled gracefully

---

## 🎨 Phase 4: React Component & Hooks (Execution Markers)

### Task 4.1: Create useTradingViewExecutions Hook
**Files**: `src/components/charts/hooks/useTradingViewExecutions.ts` (create)

```ts
export function useTradingViewExecutions(
  widget: any | null,
  symbol: string,
  timeframe: string,
  tradeIds?: string[]
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const executionsById = useRef(new Map());

  // Fetch executions from API
  const fetchExecutions = useCallback(async () => {
    if (!widget) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('symbol', symbol);
      params.append('from', Math.floor(Date.now() / 1000) - 86400 * 30); // 30d back
      params.append('to', Math.floor(Date.now() / 1000));
      if (tradeIds?.length) params.append('tradeIds', tradeIds.join(','));

      const res = await fetch(`/api/trades/executions?${params}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const { data } = await res.json();
      await updateExecutions(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [widget, symbol, tradeIds]);

  // Clear all markers
  const clearExecutions = useCallback(() => {
    for (const exec of executionsById.current.values()) {
      exec.remove();
    }
    executionsById.current.clear();
  }, []);

  // Render markers idempotently
  const updateExecutions = useCallback(async (markers: ExecutionMarker[]) => {
    if (!widget) return;

    const chart = widget.activeChart();
    if (!chart) return;

    clearExecutions();

    for (const m of markers) {
      try {
        const exec = await chart.createExecutionShape();
        if (!exec) continue;

        exec
          .setTime(m.time)
          .setPrice(m.price)
          .setDirection(m.side)
          .setText(buildExecutionLabel(m))
          .setTooltip(m.tooltip ?? buildExecutionTooltip(m));

        // Apply style
        if (m.arrowColor) exec.setArrowColor(m.arrowColor);
        if (m.textColor) exec.setTextColor(m.textColor);

        executionsById.current.set(m.id, exec);
      } catch (e) {
        console.warn(`Failed to create execution marker ${m.id}:`, e);
      }
    }
  }, [widget, clearExecutions]);

  // Refresh on symbol/timeframe change
  useEffect(() => {
    fetchExecutions();
  }, [symbol, timeframe, fetchExecutions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearExecutions();
  }, [clearExecutions]);

  return { loading, error, clearExecutions, updateExecutions, fetchExecutions };
}
```

**Acceptance**: ✅ Hook compiles, manages lifecycle, no memory leaks

---

### Task 4.2: Integrate Hook into TradingView Chart Component
**Files**: `src/components/charts/tradingview-chart.tsx` (modify)

```ts
export function TradingViewChart({
  symbol,
  timeframe,
  tradeIds,
  showExecutions = true,
}: {
  symbol: string;
  timeframe: string;
  tradeIds?: string[];
  showExecutions?: boolean;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  // Hook call
  const { loading: execLoading, error: execError, fetchExecutions } =
    useTradingViewExecutions(widgetRef.current, symbol, timeframe, tradeIds);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initialize widget
    const widget = new (window as any).TradingView.widget({
      autosize: true,
      symbol,
      interval: timeframe,
      timezone: 'Etc/UTC',
      theme: 'dark',
      container_id: chartContainerRef.current.id,
      library_path: '/charting_library/',
      datafeed: getDatafeed(), // existing datafeed
      // ... other options
    });

    widgetRef.current = widget;

    // After chart ready, load executions
    widget.onChartReady(() => {
      if (showExecutions) {
        fetchExecutions();
      }
    });

    return () => {
      if (widgetRef.current) {
        widgetRef.current.remove();
        widgetRef.current = null;
      }
    };
  }, [symbol, timeframe, showExecutions, fetchExecutions]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={chartContainerRef}
        id="tradingview-chart"
        className="w-full h-full"
      />
      {execLoading && <div className="absolute top-2 right-2 text-sm">Loading executions...</div>}
      {execError && <div className="absolute top-2 right-2 text-red-500 text-sm">Error: {execError.message}</div>}
    </div>
  );
}
```

**Acceptance**: ✅ Component renders chart + executions, handles state

---

## 🧪 Phase 5: Testing & Performance

### Task 5.1: Unit Tests - ExecutionMarker Helpers
**Files**: `src/components/charts/utils/__tests__/execution-markers.test.ts` (create)

- [ ] Test `buildExecutionLabel()`: format price + PnL correctly
- [ ] Test `buildExecutionTooltip()`: multi-line format correct
- [ ] Test styling constant values (colors valid hex/rgba)
- [ ] Edge cases: missing optional fields, zero PnL, null values

**Acceptance**: ✅ All helpers tested, 100% coverage

---

### Task 5.2: Integration Tests - Executions Endpoint
**Files**: `src/app/api/trades/executions/__tests__/route.test.ts` (create)

- [ ] Mock trade data in DB
- [ ] Test `GET /api/trades/executions?symbol=MES&from=X&to=Y`
- [ ] Validate response structure
- [ ] Test filtering by `tradeIds`
- [ ] Test error cases (missing params, auth, etc.)
- [ ] Performance: response < 500ms for 100 trades

**Acceptance**: ✅ API tested, fast, secure

---

### Task 5.3: Performance Benchmarking
**Files**: `docs/STORY-6.3-PERF-RESULTS.md` (create)

**Metrics to measure**:
- [ ] Chart initialization time (widget creation)
- [ ] Executions API response time
- [ ] Marker rendering time (N markers)
- [ ] Memory usage (executionsById map)
- [ ] Re-render on symbol change (cleanup + render)

**Target**:
- Chart load: < 2000ms
- API response: < 500ms
- Marker render (50 markers): < 300ms
- Memory: < 5MB per chart

**Lighthouse audit**:
- [ ] Run Lighthouse on chart page
- [ ] Performance score ≥ 80
- [ ] First Contentful Paint < 2s

**Acceptance**: ✅ All benchmarks met, results documented

---

## 🔧 Phase 6: Refinement & UX

### Task 6.1: Add Toggle & Filters
**Files**: `src/components/charts/tradingview-chart.tsx` (modify)

```ts
type ExecutionFilter = {
  showExecutions: boolean;
  showEntries: boolean;
  showExits: boolean;
  dateRangeStart: Date;
  dateRangeEnd: Date;
};

// Export filter state to props
<TradingViewChart
  symbol="MES"
  timeframe="1"
  filter={{
    showExecutions: true,
    showEntries: true,
    showExits: true,
    dateRangeStart: new Date(Date.now() - 30 * 86400000),
    dateRangeEnd: new Date(),
  }}
/>
```

**Changes**:
- [ ] Add UI controls (toggle entries/exits, date range picker)
- [ ] Pass filter to `fetchExecutions()`
- [ ] Update API endpoint to accept `side` filter param
- [ ] Re-fetch on filter change

**Acceptance**: ✅ Filters work, re-render on change

---

### Task 6.2: Hover/Click Interactivity
**Files**: `src/components/charts/hooks/useTradingViewExecutions.ts` (enhance)

- [ ] On hover over marker: highlight trade detail in sidebar
- [ ] On click marker: open trade details modal
- [ ] Show/hide related drawings (e.g., lines for entry/exit)
- [ ] Keyboard: Esc to deselect

**Acceptance**: ✅ Interactions smooth, no lag

---

### Task 6.3: Responsive Mobile
**Files**: `src/components/charts/tradingview-chart.tsx` (enhance)

- [ ] Test chart on tablet (iPad), phone (iPhone/Android)
- [ ] Adjust marker size/label for small screens
- [ ] Touch interactions (tap for details, swipe for timeframe)
- [ ] Tooltip positioning on small screens

**Acceptance**: ✅ Mobile responsive, legible

---

## 📋 Phase 7: Documentation & Delivery

### Task 7.1: Update Story AC
**Files**: `docs/stories/6.3.story.md` (update)

- [ ] Update AC1–AC6 with completion status
- [ ] Link to implementation (components, hooks, API)
- [ ] Add performance metrics from Phase 4

---

### Task 7.2: Component Documentation
**Files**: `src/components/charts/tradingview-chart.tsx` (add JSDoc)

```ts
/**
 * TradingViewChart - Embedded TradingView chart with trade execution overlay
 *
 * Features:
 * - Real-time price data via configured datafeed
 * - Trade entry/exit markers (buy/sell arrows)
 * - Tooltips with P&L, R:R, time
 * - Filter: symbol, timeframe, date range, side (entry/exit)
 *
 * @example
 * <TradingViewChart
 *   symbol="MES"
 *   timeframe="1"
 *   tradeIds={["trade-1", "trade-2"]}
 *   showExecutions={true}
 * />
 */
```

---

### Task 7.3: Update PROJECT_MEMORY.md
**Files**: `PROJECT_MEMORY.md` (add entry)

```md
## [2026-01-24 HH:MM] - Story 6.3: TradingView Entry/Exit Overlays - Roadmap
### 📝 Demande utilisateur
> Créer une roadmap complète pour développer Story 6.3 en supprimant toute implémentation existante et recommencer depuis les specs TradingView Charting Library v29.
### 🔧 Modifications techniques
- **Fichiers créés :**
  - `docs/STORY-6.3-ROADMAP.md` — Roadmap phase par phase
  - `src/lib/types/execution.ts` — Types ExecutionMarker
  - `src/components/charts/utils/execution-markers.ts` — Styling + helpers
  - `src/components/charts/hooks/useTradingViewExecutions.ts` — Hook lifecycle
  - `src/app/api/trades/executions/route.ts` — API endpoint
  - Tests + documentation

### 💡 Pourquoi (Raison du changement)
Story 6.3 nécessite une intégration propre TradingView avec executions overlay. La roadmap suit l'architecture BMAD (Brief, Minimal, Actionable, Design-first) et s'aligne sur TradingView Charting Library v29.

### 🔗 Contexte additionnel
- Phase 6, Epic 6 (Replay & Visualization)
- Dépend de: Phase 2 (Market Replay Infra), Phase 5 (Analytics)
- Timeline estimée: 5-7 jours de dev
- Visual target: `docs/chart_example.png`
```

---

## 🎯 Dépendances & Priorités

### Must-Have (Critical Path)
1. ✅ **Widget Configuration** (Task 2.1) — enables toolbar, header, drawings
2. ✅ **ExecutionMarker interface** (Task 1.1)
3. ✅ **Executions API endpoint** (Task 3.1 → 3.2)
4. ✅ **useTradingViewExecutions hook** (Task 4.1)
5. ✅ **Component integration** (Task 4.2)
6. ✅ **Performance validation** (Task 5.3)

### Nice-to-Have (if time permits)
- [ ] Advanced filters (by strategy, session, account)
- [ ] Marker clustering (for dense entry/exit zones)
- [ ] Heat map of profitability by time/region
- [ ] Export chart as image + overlays

### Out of Scope v1 (Story 6.4)
- [ ] **Drawing persistence** — save/load user drawings to DB

### Blockers
- None identified. All dependencies met from Phase 2 (Broker DB ✅, Market Replay POC ✅)
- **CRITICAL**: Verify TradingView bundle is **Advanced Charts** (not Lightweight)

---

## 📈 Acceptance Criteria Mapping

| AC | Description | Task(s) | Status |
|----|-------------|---------|--------|
| **Core Chart Features** ||||
| AC1 | Advanced Charts Library v29 integrated | 2.1 | 🟠 To Do |
| AC2 | Left Toolbar enabled (drawing tools) | 2.1, 2.2 | 🟠 To Do |
| AC3 | Header Widget enabled (timeframes, indicators) | 2.1, 2.3 | 🟠 To Do |
| AC4 | Indicators Panel accessible | 2.1, 2.4 | 🟠 To Do |
| AC5 | Dark theme + symbol/timeframe sync | 2.1, 4.2 | 🟠 To Do |
| **Execution Markers** ||||
| AC6 | Entry markers (buy arrows) | 1.1, 1.2, 4.1, 4.2 | 🟠 To Do |
| AC7 | Exit markers (sell arrows) | 1.1, 1.2, 4.1, 4.2 | 🟠 To Do |
| AC8 | Tooltips on markers | 1.2, 4.1 | 🟠 To Do |
| AC9 | Auto-zoom on trade period | 4.2 | 🟠 To Do |
| **Performance & UX** ||||
| AC10 | Performance < 2s, Lighthouse ≥ 80 | 5.3 | 🟠 To Do |
| AC11 | Mobile responsive | 6.3 | 🟠 To Do |
| **Out of Scope v1** ||||
| AC12 | Drawing persistence (Story 6.4) | — | ⏸️ Deferred |

---

## 🚀 How to Use This Roadmap

### For Developers
1. **Phase 1**: Define types, constants → no blocker
2. **Phase 2 (CRITICAL)**: Configure Widget Constructor with `enabled_features` — verify toolbar + header
3. **Phase 3**: Create API endpoint (can be mocked in tests)
4. **Phase 4**: Integrate hook + component, inject execution markers
5. **Phase 5**: Write tests (as you build), verify performance
6. **Phase 6–7**: Refine UX, document

### For PM/QA
- Use **Task checklist** to track progress per phase
- **Visual QA (Phase 2)**: Toolbar visible? Header visible? Drawings work?
- **Acceptance Criteria** in Phase 5 define "Done"
- **Benchmarks** in Phase 5.3 are hard gates (< 2s, ≥80 Lighthouse)

### For Code Review
- Validate **Phase 1 types** (no runtime errors, aligned with API response)
- Validate **Phase 2 Widget Config** (`enabled_features` correct, no missing features)
- Validate **Phase 3 API** (secure, performant, error handling)
- Validate **Phase 4 hook** (no memory leaks, lifecycle correct)
- Validate **Phase 5 tests** (coverage ≥ 80%, perf targets met)

---

## 🔮 Next Step: Story 6.4 — Drawing Persistence

**Out of Scope for Story 6.3** (tracked separately):

Story 6.4 will add **drawing persistence** — allowing users to save and load their drawings (trend lines, fibonacci, etc.) across sessions.

**Planned Approach**:
- Use TradingView's `save()` / `load()` API methods
- Store chart state (drawings JSON) in DB per user/symbol
- Auto-save on drawing change (debounced)
- Load on chart init if saved state exists

**API Contract (Draft)**:
```ts
// Save drawings
POST /api/charts/drawings
{ symbol: 'MES', state: { /* TradingView save() JSON */ } }

// Load drawings
GET /api/charts/drawings?symbol=MES
→ { state: { /* TradingView load() JSON */ } }
```

**Note**: This is deferred to keep Story 6.3 focused on core integration + execution markers.

---

## 📚 References

- [TradingView Charting Library v29 Docs](https://www.tradingview.com/charting-library-docs/latest/api/)
- [Widget Constructor Options](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ChartingLibraryWidgetOptions/)
- [`docs/tradingview_API.md`](./tradingview_API.md) — BMAD guide (entries/exits)
- [`docs/chart_example.png`](./chart_example.png) — Visual reference (toolbar + header)
- [`docs/stories/6.3.story.md`](./stories/6.3.story.md) — Story with updated AC
- [`docs/PLAN-GLOBAL-1.1-17.1.md`](./PLAN-GLOBAL-1.1-17.1.md) — Phase/Epic mapping

---

**Roadmap créée**: 2026-01-24  
**Mise à jour**: 2026-01-24 (Scope expanded: Full Advanced Charts)  
**Auteur**: Senior Architect  
**Status**: 🟠 Ready for Development Sprint Planning
