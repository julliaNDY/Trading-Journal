# 🎯 Story 6.3 — Sprint Implementation Plan

**Status**: Ready for Development  
**Created**: 2026-01-24  
**Target Sprint**: Week of 2026-01-27 (5–7 days)  
**Owner**: [TO ASSIGN]  
**Reviewers**: [TO ASSIGN]

---

## 📌 Sprint Scope

Implement TradingView entry/exit overlays for trade visualization, following `docs/STORY-6.3-ROADMAP.md`.

**Out of Scope** (Phase 5+):
- Advanced filters beyond date range
- Mobile-specific optimizations (placeholder support only)
- Clustering, heat maps, export features

---

## 🗓️ Proposed Timeline

```
Day 1 (Mon 1/27)
  ├─ [2h] Phase 1 — Types & constants
  ├─ [2h] Phase 2.1 — API endpoint scaffold + test data
  └─ [2h] Review, merge to dev branch

Day 2 (Tue 1/28)
  ├─ [3h] Phase 2.2 — API validation + error handling
  ├─ [2h] Phase 3.1 — useTradingViewExecutions hook
  └─ [1h] Code review checkpoint

Day 3 (Wed 1/29)
  ├─ [2h] Phase 3.2 — Component integration
  ├─ [2h] Phase 4.1 — Unit tests (helpers)
  ├─ [1h] Manual smoke test on local
  └─ [1h] Buffer

Day 4 (Thu 1/30)
  ├─ [2h] Phase 4.2 — Integration tests (API)
  ├─ [1.5h] Phase 4.3 — Performance benchmarks
  ├─ [1.5h] Lighthouse audit + fixes if needed
  └─ [1h] Code review

Day 5 (Fri 1/31)
  ├─ [1h] Phase 5 — Toggle/filter UI (basic)
  ├─ [1h] Mobile responsiveness check (placeholder)
  ├─ [1.5h] Phase 6 — Documentation + JSDoc
  ├─ [0.5h] Update PROJECT_MEMORY
  └─ [1h] Final QA + merge to main

Total: ~33 hours (fits in 1 sprint with some buffer)
```

---

## 📋 Daily Standup Checklist

### Day 1 — Foundation
- [ ] Phase 1.1: ExecutionMarker interface created + exported
- [ ] Phase 1.2: Styling constants + helpers (buildLabel, buildTooltip) tested
- [ ] Phase 2.1: API endpoint `/api/trades/executions` returns mock data
- [ ] All files committed to feature branch
- **Goal**: Types + constants compile, no blockers

### Day 2 — Backend Complete
- [ ] Phase 2.2: Validation (from < to, symbol required, auth check)
- [ ] Phase 2.2: Error handling (400/401/404/500 cases)
- [ ] Phase 3.1: useTradingViewExecutions hook created + compiles
- [ ] API tested manually with curl/Postman (response < 500ms)
- **Goal**: Backend 100% done, hook structure ready

### Day 3 — Component Integration
- [ ] Phase 3.2: TradingViewChart component imports + uses hook
- [ ] Widget onChartReady() → executions fetch
- [ ] Markers visible on chart (visual test)
- [ ] Phase 4.1: Unit tests for helpers (100% coverage)
- [ ] Smoke test on local dev server
- **Goal**: Markers rendering, tests passing

### Day 4 — Testing & Performance
- [ ] Phase 4.2: API integration tests (success + error cases)
- [ ] Phase 4.3: Benchmark results documented:
  - [ ] Chart load time recorded
  - [ ] API response time (50 trades)
  - [ ] Marker render time (50 markers)
  - [ ] Lighthouse score captured
- [ ] All benchmarks meet targets (< 2s, Lighthouse ≥ 80)
- **Goal**: Tests passing, perf gates met

### Day 5 — Polish & Delivery
- [ ] Phase 5: Toggle "Show Entries/Exits" UI added
- [ ] Mobile test: chart loads on tablet/phone (legible, no crashes)
- [ ] Phase 6: JSDoc added to all components/hooks
- [ ] PROJECT_MEMORY.md updated with completion entry
- [ ] Final QA: All AC criteria met
- [ ] Merged to main, tagged release
- **Goal**: Story complete, ready for QA/Production

---

## 🔧 Dev Environment Setup (Pre-requisite)

Before starting, ensure:

- [ ] Node.js v18–22 installed
- [ ] `npm ci` run successfully
- [ ] Prisma schema up-to-date (`prisma generate`)
- [ ] Local dev server running (`npm run dev`)
- [ ] Database seeded with test trades (≥ 50 sample trades with MES symbol)
- [ ] TradingView Charting Library bundle present in `public/charting_library/`

**Validation**:
```bash
curl "http://localhost:3000/api/trades/executions?symbol=MES&from=1706092800&to=1706179200"
# Should return: { "status": "ok", "data": [] } (empty if no trades)
```

---

## 🚀 Implementation Checkpoints

### Checkpoint 1: End of Day 2 (Types + API Skeleton)
**Criteria**:
- [ ] Phase 1 types compile, exported from `src/lib/types/execution.ts`
- [ ] Phase 2 API endpoint responds with 200 (mock data)
- [ ] API validation logic in place (400 on missing params)
- [ ] Phase 3.1 hook structure complete (no integration yet)

**Action if blocked**:
- TradingView bundle missing? Copy from CDN or project assets
- DB connection issue? Run migrations: `prisma migrate deploy`
- Type errors? Check TypeScript strict mode settings

---

### Checkpoint 2: End of Day 3 (Markers Rendering)
**Criteria**:
- [ ] Component renders on chart page
- [ ] At least 1 marker visible on chart (manual test)
- [ ] Tooltip appears on hover
- [ ] Unit tests passing (helpers)

**Action if blocked**:
- Marker not visible? Check: time format (unix seconds), price in chart range, widget.activeChart() not null
- Tooltip empty? Verify buildTooltip() called with correct marker data
- Test failures? Debug assertion errors; ensure mock data structure matches interface

---

### Checkpoint 3: End of Day 4 (Perf Gates)
**Criteria**:
- [ ] All tests passing (unit + integration)
- [ ] Chart load time: **< 2.0s** ✅
- [ ] API response: **< 500ms** ✅
- [ ] Marker render (50 markers): **< 300ms** ✅
- [ ] Lighthouse score: **≥ 80** ✅

**Action if blocked**:
- Chart load > 2s? Profile with DevTools; check datafeed efficiency
- API > 500ms? Add DB index on (userId, symbol, closedAt); paginate results
- Markers render slow? Check loop efficiency; consider debouncing if needed
- Lighthouse < 80? Address warnings: minify CSS/JS, optimize images, fix CLS

---

### Checkpoint 4: End of Day 5 (Story Complete)
**Criteria**:
- [ ] All 6 ACs met ✅
- [ ] Filters/toggles working
- [ ] Mobile responsive (basic)
- [ ] Documentation complete
- [ ] Merge to main successful

---

## 🧪 Test Coverage Target

| Module | File | Coverage Target |
|--------|------|---|
| Helpers | `execution-markers.ts` | 100% |
| API | `executions/route.ts` | ≥ 80% |
| Hook | `useTradingViewExecutions.ts` | ≥ 80% |
| Component | `tradingview-chart.tsx` (hooks part) | ≥ 70% |
| **Overall** | | **≥ 75%** |

---

## 🎯 Acceptance Criteria Verification

Before closing story, verify each AC:

| AC | Test Method | Status |
|----|-------------|--------|
| **AC1** | Widget initialized, chart visible | 🟠 |
| **AC2** | Entry marker (blue ↓) + exit marker (red ⊗) visible on chart | 🟠 |
| **AC3** | Marker visible on hover; price/timestamp shown | 🟠 |
| **AC4** | Tooltip multi-line (BUY, price, time, P&L, R:R) shows on hover | 🟠 |
| **AC5** | Chart symbol = trade.symbol; auto-zoom on trade period (openedAt→closedAt) | 🟠 |
| **AC6** | Lighthouse ≥ 80; chart load < 2s; markers render < 300ms | 🟠 |

---

## 📚 Resources & Links

| Resource | Location |
|----------|----------|
| Full Roadmap | `docs/STORY-6.3-ROADMAP.md` |
| Visual Summary | `docs/STORY-6.3-QUICK-VISUAL.md` |
| Target Image | `docs/chart_example.png` |
| TradingView BMAD Guide | `docs/tradingview_API.md` |
| TradingView v29 Docs | [https://www.tradingview.com/charting-library-docs/latest/api/](https://www.tradingview.com/charting-library-docs/latest/api/) |
| Story (Original) | `docs/stories/6.3.story.md` |

---

## 🐛 Known Issues / Mitigations

| Issue | Likelihood | Mitigation |
|-------|------------|-----------|
| createExecutionShape() unavailable | Low | Check TradingView bundle; fallback to createShape() if needed |
| Marker timestamp not on bar | Medium | Ensure time format is unix seconds; test with known trade times |
| DB query slow (1000+ trades) | Medium | Add pagination; filter by date range in API |
| Mobile tooltip overflow | Low | Test on real devices; adjust positioning logic if needed |
| Memory leak on re-renders | Low | Track all exec adapters in Map; call remove() in cleanup |

---

## 🔗 Branch Strategy

```
feature/story-6.3-tradingview-overlays
  ├─ Day 1–2: dev sub-branch (types + API)
  ├─ Day 3–4: integrate + test sub-branch
  ├─ Day 5: final polish → merge to main
  └─ Tag: v0.Y.Z (release tagging)
```

**Commit Convention**:
```
feat(story-6.3): Add ExecutionMarker types and styling constants
feat(story-6.3): Implement GET /api/trades/executions endpoint
feat(story-6.3): Create useTradingViewExecutions hook
feat(story-6.3): Integrate markers into TradingViewChart component
test(story-6.3): Add unit tests for execution helpers
test(story-6.3): Add integration tests for executions API
test(story-6.3): Performance benchmarks and Lighthouse audit
docs(story-6.3): Update story AC, add JSDoc, update PROJECT_MEMORY
```

---

## ✅ Sign-Off Checklist

**Developer** (before code review):
- [ ] All code reviewed locally (lint, types, tests)
- [ ] Branch pushed, PR created
- [ ] Commit messages clear + conventional
- [ ] No console.log or debug code left

**Code Reviewer** (before merge):
- [ ] Architecture reviewed (types, API, hook, component)
- [ ] No memory leaks, proper lifecycle
- [ ] Tests meaningful and passing
- [ ] Performance benchmarks met
- [ ] Documentation complete

**QA** (before production):
- [ ] All AC criteria verified on staging
- [ ] Regression testing: no other features broken
- [ ] Mobile responsive check
- [ ] Performance verified in production-like environment

**PM** (before release):
- [ ] Story marked done in tracking system
- [ ] Release notes updated
- [ ] Dependencies documented (TradingView bundle version, etc.)
- [ ] Deployed to production

---

**Sprint Owner**: [TO ASSIGN]  
**Sprint Dates**: 2026-01-27 to 2026-01-31  
**Expected Delivery**: 2026-01-31 (EOD Friday)

---

*Last Updated: 2026-01-24 by Senior Architect*
