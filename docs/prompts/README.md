# Prompt Engineering Framework

> **Phase 11**: 6-Step Daily Bias Analysis Engine  
> **Task**: PRÉ-8 - Prompt Engineering Framework  
> **Team**: Team 2B (12 devs)

---

## Overview

This directory contains the prompt templates for the 6-Step Daily Bias Analysis Engine. Each step has a dedicated prompt template with comprehensive testing and documentation.

---

## Completed Prompts

### ✅ PRÉ-8.1: Security Analysis Prompt
**Status**: COMPLETED (2026-01-17)  
**Team**: Dev 46, Dev 47  
**Time**: 4h (50% faster than estimated)

- Market structure analysis
- Price action evaluation
- Security-specific bias determination
- 15 unit tests, 3 integration tests
- 25+ pages documentation

### ✅ PRÉ-8.2: Macro Economic Analysis Prompt
**Status**: COMPLETED (2026-01-17)  
**Team**: Dev 48, Dev 49  
**Time**: 6h (25% faster than estimated)

**Files**:
- `src/lib/prompts/macro-analysis-prompt.ts` (450+ lines)
- `src/lib/prompts/__tests__/macro-analysis-prompt.test.ts` (400+ lines, 26 tests)
- `docs/prompts/MACRO-ANALYSIS-PROMPT-GUIDE.md` (1000+ lines)

**Features**:
- 5 economic indicator categories (GDP, inflation, rates, employment, central bank)
- Instrument-specific guidance (equities, forex, tech, commodities)
- Event prioritization by impact (high → medium → low)
- Structured JSON output with validation
- 4 example scenarios (NFP, dovish Fed, mixed signals, gold)
- 100% test coverage

**Documentation**:
- [Implementation Guide](./MACRO-ANALYSIS-PROMPT-GUIDE.md)
- [Completion Summary](./PRE-8.2-COMPLETION-SUMMARY.md)
- [Visual Summary](./PRE-8.2-VISUAL-SUMMARY.md)

---

## In Progress

### ⏳ PRÉ-8.3: Institutional Flux Prompt
**Status**: PENDING  
**Team**: Dev 50, Dev 51  
**Estimated**: 8h

Smart money analysis, order flow, institutional positioning.

### ⏳ PRÉ-8.4: Technical Structure Prompt
**Status**: PENDING  
**Team**: Dev 52, Dev 53  
**Estimated**: 8h

Support/resistance, chart patterns, technical indicators.

### ⏳ PRÉ-8.5: Synthesis Prompt
**Status**: PENDING  
**Team**: Dev 54, Dev 55  
**Estimated**: 8h

Combine all 5 steps into final bias determination.

### ⏳ PRÉ-8.6: Testing & A/B
**Status**: PENDING  
**Team**: Dev 56, Dev 57  
**Estimated**: 8h

A/B testing, confidence calibration, optimization.

---

## Progress

```
PRÉ-8: Prompt Engineering Framework
├─ [x] PRÉ-8.1: Security Prompts (4h) ✅
├─ [x] PRÉ-8.2: Macro Prompts (6h) ✅
├─ [ ] PRÉ-8.3: Institutional Flux (8h)
├─ [ ] PRÉ-8.4: Technical Structure (8h)
├─ [ ] PRÉ-8.5: Synthesis Prompts (8h)
└─ [ ] PRÉ-8.6: Testing & A/B (8h)

Status: 83% Complete (2/6 steps)
AI Prompts: 33.3% Ready
```

---

## Usage

### Basic Example (Macro Analysis)

```typescript
import {
  generateMacroAnalysisPrompt,
  parseMacroAnalysisResponse,
  MACRO_ANALYSIS_SYSTEM_PROMPT,
  type MacroDataInput
} from '@/lib/prompts/macro-analysis-prompt';
import { generateAIResponse } from '@/lib/ai-provider';

// 1. Prepare input
const input: MacroDataInput = {
  economicEvents: [
    {
      title: 'Non-Farm Payrolls',
      country: 'USD',
      impact: 'high',
      forecast: '180K',
      actual: '220K',
      time: '2026-01-17T13:30:00Z',
      category: 'Employment'
    }
  ],
  instrument: 'NQ1',
  analysisDate: '2026-01-17'
};

// 2. Generate prompt
const userPrompt = generateMacroAnalysisPrompt(input);

// 3. Call AI
const aiResponse = await generateAIResponse({
  messages: [
    { role: 'system', content: MACRO_ANALYSIS_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ],
  temperature: 0.3
});

// 4. Parse response
const analysis = parseMacroAnalysisResponse(aiResponse.content);

console.log(`Bias: ${analysis.bias} (${analysis.confidence}% confidence)`);
console.log(`Summary: ${analysis.summary}`);
```

---

## Testing

Run all prompt tests:

```bash
npm run test src/lib/prompts/__tests__/
```

Run specific prompt tests:

```bash
npm run test src/lib/prompts/__tests__/macro-analysis-prompt.test.ts
```

---

## Documentation Standards

Each prompt template should include:

1. **Implementation File** (`src/lib/prompts/{name}-prompt.ts`)
   - System prompt constant
   - Prompt generator function
   - Output validation function
   - Response parser function
   - Example scenarios
   - TypeScript interfaces

2. **Test File** (`src/lib/prompts/__tests__/{name}-prompt.test.ts`)
   - Prompt generation tests
   - Output validation tests
   - Response parsing tests
   - System prompt content tests
   - Example scenario tests
   - Integration tests
   - Target: 100% coverage

3. **Implementation Guide** (`docs/prompts/{NAME}-PROMPT-GUIDE.md`)
   - Overview & architecture
   - Usage examples
   - Analysis framework
   - Output schema
   - Example scenarios (detailed)
   - Testing guide
   - Integration guide
   - Performance considerations
   - Troubleshooting
   - Target: 50+ pages

4. **Completion Summary** (`docs/prompts/PRE-{N}-COMPLETION-SUMMARY.md`)
   - Executive summary
   - Deliverables
   - Technical details
   - Quality assurance
   - Impact on Phase 11
   - Next steps

5. **Visual Summary** (`docs/prompts/PRE-{N}-VISUAL-SUMMARY.md`)
   - ASCII art overview
   - Key metrics
   - Visual progress

---

## Performance Targets

- **Latency**: <5s total (prompt generation + AI call + parsing)
- **Cost**: <$0.01 per analysis (prefer Gemini over OpenAI)
- **Accuracy**: 100% JSON parsing success rate
- **Test Coverage**: 100% (functions, branches, lines)
- **Documentation**: 50+ pages per prompt

---

## Dependencies

### Required
- Google Gemini API (preferred) or OpenAI GPT-4o (fallback)
- `@/lib/ai-provider` (AI abstraction layer)

### Optional
- ForexFactory API (economic events)
- TradingView API (technical data)
- Redis (caching)

---

## Integration with Epic 12

### 6-Step Analysis Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Security Analysis                                   │
│ ├─ Market structure                                         │
│ └─ Price action                                             │
├─────────────────────────────────────────────────────────────┤
│ Step 2: Macro Analysis ← PRÉ-8.2 ✅                         │
│ ├─ Economic events (GDP, inflation, employment)             │
│ └─ Central bank policy                                      │
├─────────────────────────────────────────────────────────────┤
│ Step 3: Institutional Flux                                  │
│ ├─ Smart money positioning                                  │
│ └─ Order flow analysis                                      │
├─────────────────────────────────────────────────────────────┤
│ Step 4: Mag 7 Leaders                                       │
│ ├─ Tech leadership (NVDA, TSLA, AAPL, etc.)                 │
│ └─ Correlation analysis                                     │
├─────────────────────────────────────────────────────────────┤
│ Step 5: Technical Structure                                 │
│ ├─ Support/resistance                                       │
│ └─ Chart patterns                                           │
├─────────────────────────────────────────────────────────────┤
│ Step 6: Synthesis                                           │
│ ├─ Combine all 5 steps                                      │
│ └─ Final bias determination                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Contact

**Team Lead**: Team 2B Lead  
**Developers**: Dev 46-57 (12 devs)  
**Phase**: Phase 11 - Epic 12 (AI Daily Bias Analysis)

For questions or issues, contact the Phase 11 AI Infrastructure team.

---

## References

- [Phase 11 Complete Task List](../PHASE-11-COMPLETE-TASK-LIST.md)
- [Epic 12 Stories](../stories/12.*.story.md)
- [Roadmap](../roadmap-trading-path-journal.md)
