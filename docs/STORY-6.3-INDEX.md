# 📖 Story 6.3 — Documentation Index

**Story**: 6.3 TradingView Entry/Exit Overlays  
**Epic**: 6 (Replay & Visualization)  
**Phase**: 6  
**Status**: 🟠 **Ready for Development**  
**Created**: 2026-01-24  

---

## 📚 Documents (Start Here)

### 1. **📋 STORY-6.3-ROADMAP.md** (Main Reference)
**Length**: ~400 lines | **Read Time**: 15–20 min  
**Audience**: Developers, Architects, Tech Leads

The **complete implementation plan** with 6 phases, detailed tasks, code examples, testing strategy, and acceptance criteria mapping.

**Contains**:
- Objectif produit + état actuel
- Architecture (3 tiers: Frontend / Backend / Types)
- Phase 1–6 detailed tasks with code snippets
- Testing & performance strategy
- Refinement & documentation
- Dépendances & blockers
- How to use roadmap (Dev, PM, QA, Code Review)

**👉 Start here** if you're:
- Writing the code (full implementation guide)
- Planning the sprint (phase breakdown)
- Doing code review (acceptance criteria per phase)

**Key Decision Points**:
- Charting Library v29 (not Lightweight Charts)
- `createExecutionShape()` API for markers
- Idempotent rendering (clear all → render new list)
- Performance targets: < 2s chart load, Lighthouse ≥ 80

---

### 2. **🎯 STORY-6.3-SPRINT-PLAN.md** (5-Day Timeline)
**Length**: ~250 lines | **Read Time**: 10–15 min  
**Audience**: Dev Lead, Project Manager, Daily Standup Team

The **executable sprint plan** with a proposed 5-day timeline, daily checkpoints, test coverage targets, and sign-off criteria.

**Contains**:
- Proposed timeline (Day 1–5 breakdown, ~33 hours total)
- Daily standup checklist (phase-by-phase progress)
- Implementation checkpoints (blockers + mitigations)
- Test coverage targets (≥ 75% overall)
- AC verification checklist
- Branch strategy + commit conventions
- Dev environment setup (pre-requisites)
- Sign-off checklist (Dev → Reviewer → QA → PM)

**👉 Use this if you're**:
- Running the sprint (5-day plan)
- Doing daily standups (daily checklist)
- Planning QA (test coverage + AC verification)
- Deploying to production (sign-off checklist)

**Day-by-Day Estimate**:
- Day 1: 6h (Types + API scaffold)
- Day 2: 6h (API complete + hook skeleton)
- Day 3: 5h (Component integration + unit tests)
- Day 4: 5h (Integration tests + perf bench)
- Day 5: 4h (Polish + docs)
- **Total**: ~33 hours (1 sprint)

---

### 3. **📊 STORY-6.3-QUICK-VISUAL.md** (One-Pager Visual)
**Length**: ~150 lines | **Read Time**: 5 min  
**Audience**: Everyone (quick reference)

The **visual summary** with ASCII diagrams, architecture layers, phase checklist, key code snippets, and potential gotchas.

**Contains**:
- Visual target (ASCII chart with markers)
- 3-layer architecture diagram
- 6-phase quick checklist (timeline + status)
- Key implementation details (ExecutionMarker interface)
- TradingView API code snippet (the core logic)
- Lifecycle diagram (mount → fetch → render → cleanup)
- Performance targets (hard gates)
- Potential gotchas + solutions
- File references (what to create/modify)
- DoD per phase

**👉 Use this if you want to**:
- Understand the concept in 5 minutes (visual learner)
- Reference code snippets quickly (TradingView API call)
- Check performance targets at a glance
- Know what files to create/modify

---

## 🎯 Quick Navigation

**I want to...**

| Goal | Document | Section |
|------|----------|---------|
| Understand the big picture | ROADMAP | Introduction + Architecture |
| Get the 5-day plan | SPRINT-PLAN | Proposed Timeline |
| See what files to create | QUICK-VISUAL | File References |
| Write Phase 1 (Types) | ROADMAP | Phase 1: Foundation |
| Write Phase 2 (API) | ROADMAP | Phase 2: Backend API |
| Write Phase 3 (Component) | ROADMAP | Phase 3: React Integration |
| Set up tests | ROADMAP + SPRINT-PLAN | Phase 4 + Test Coverage |
| Run the sprint | SPRINT-PLAN | Daily Standup Checklist |
| Do code review | SPRINT-PLAN | Sign-Off Checklist |
| Check performance | SPRINT-PLAN | Checkpoint 3 (Perf Gates) |
| Know what could go wrong | QUICK-VISUAL | Potential Gotchas |

---

## 🔗 Cross-References to Related Docs

| Document | Relevance |
|----------|-----------|
| `docs/stories/6.3.story.md` | **Updated story** (links to roadmap) |
| `docs/chart_example.png` | **Visual target** (what to build) |
| `docs/tradingview_API.md` | **BMAD guide** (integration patterns) |
| `docs/PLAN-GLOBAL-1.1-17.1.md` | **Phase/Epic mapping** (context) |
| `PROJECT_MEMORY.md` | **Entry added 2026-01-24** (changelog) |

---

## 📊 Document Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│ Document Comparison                                             │
├──────────────────┬──────────────┬──────────────┬─────────────────┤
│ Aspect           │ ROADMAP      │ SPRINT-PLAN  │ QUICK-VISUAL    │
├──────────────────┼──────────────┼──────────────┼─────────────────┤
│ Length           │ ~400 lines   │ ~250 lines   │ ~150 lines      │
│ Read Time        │ 15–20 min    │ 10–15 min    │ 5 min           │
│ Detail Level     │ Very detailed│ Moderate     │ High-level      │
│ Code Examples    │ Yes (6)      │ Yes (inline) │ Yes (1 core)    │
│ Timeline         │ Per-phase    │ Day-by-day   │ Overall 7d      │
│ Audience         │ Developers   │ Team/PM      │ Everyone        │
│ Best for         │ Implementation│ Execution   │ Reference       │
│ Format           │ Markdown     │ Markdown     │ ASCII + MD       │
└──────────────────┴──────────────┴──────────────┴─────────────────┘
```

---

## 🚀 Recommended Reading Order

### For Developers (Starting from scratch)
1. **5 min**: Read QUICK-VISUAL (understand target + architecture)
2. **15 min**: Skim ROADMAP Phase 1–3 (understand structure)
3. **20 min**: Deep-dive ROADMAP Phase 1 (start coding)
4. **Repeat**: Move phase-by-phase, revisiting relevant ROADMAP sections

### For Project Managers / Team Leads
1. **5 min**: Read QUICK-VISUAL (overview)
2. **15 min**: Read SPRINT-PLAN "Proposed Timeline" (5-day plan)
3. **5 min**: Bookmark SPRINT-PLAN "Daily Standup Checklist" (for standups)
4. **10 min**: Review SPRINT-PLAN "Sign-Off Checklist" (acceptance gates)

### For QA / Testers
1. **5 min**: Read QUICK-VISUAL (visual target)
2. **10 min**: Review ROADMAP "Phase 4: Testing & Performance"
3. **10 min**: Review SPRINT-PLAN "AC Verification Checklist"
4. **5 min**: Bookmark performance targets in QUICK-VISUAL

### For Code Reviewers
1. **10 min**: Read ROADMAP entire (architecture + decisions)
2. **5 min**: Review SPRINT-PLAN "Sign-Off Checklist"
3. **Ongoing**: Use ROADMAP phase sections during review

---

## 📌 Key Takeaways

✅ **What's Being Built**: TradingView chart overlay showing buy/sell entry/exit markers (flèches)  
✅ **Timeline**: 5–7 days (fits 1 sprint)  
✅ **Tech Stack**: React hook + TradingView v29 + Next.js API route  
✅ **Performance Gates**: < 2s chart load, Lighthouse ≥ 80 (hard requirements)  
✅ **Architecture**: Types → API → Hook/Component → Testing → Refinement  
✅ **Ready?**: Yes, all pre-requisites met (Phase 2 ✅, Broker DB ✅)

---

## 📞 Questions?

| Question | Answer Source |
|----------|---|
| What am I building? | QUICK-VISUAL: Target Visual |
| How do I build Phase 1? | ROADMAP: Phase 1 with code examples |
| What's the 5-day plan? | SPRINT-PLAN: Proposed Timeline |
| What are performance targets? | QUICK-VISUAL: Performance Targets table |
| How do I know when I'm done? | ROADMAP: Acceptance Criteria Mapping |
| What could go wrong? | QUICK-VISUAL: Potential Gotchas |
| When should this be deployed? | SPRINT-PLAN: Checkpoint 4 (Day 5) |

---

**Created**: 2026-01-24  
**Next Step**: Assign developer → Start Day 1 of sprint  
**Contact**: [Architect/Tech Lead Name]
