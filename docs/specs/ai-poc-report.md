# POC-3: AI Architecture Report

> **Story**: 1.5 - AI Architecture POC  
> **Status**: ✅ Implemented  
> **Date**: 2026-01-17  
> **Owner**: Engineering Team

---

## 1. Executive Summary

This POC validates the AI architecture for Trading Path Journal using **Google Gemini API** as the preferred provider with **OpenAI** as fallback. The implementation provides:

- ✅ Unified AI provider abstraction layer
- ✅ Google Gemini integration (chat + embeddings)
- ✅ OpenAI fallback support
- ✅ Coach service v2 with multi-provider support
- ✅ Embeddings service for Vector DB integration
- ✅ Benchmark script for latency measurement
- ✅ Cost estimation utilities

**Recommendation**: Use **Google Gemini** as primary AI provider due to lower cost and comparable performance.

---

## 2. Architecture Overview

### 2.1 Files Created

| File | Description |
|------|-------------|
| `src/lib/google-gemini.ts` | Google Gemini API wrapper |
| `src/lib/ai-provider.ts` | Unified AI provider abstraction |
| `src/lib/embeddings.ts` | Embeddings service with utilities |
| `src/services/coach-service-v2.ts` | Updated coach service with multi-provider |
| `src/app/api/ai-poc/test/route.ts` | API endpoint for POC testing |
| `scripts/ai-poc-benchmark.ts` | Benchmark script for latency tests |

### 2.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  (Coach Service v2, Actions, Components)                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│               AI Provider Abstraction Layer                  │
│              (src/lib/ai-provider.ts)                       │
│                                                              │
│  ┌──────────────────┐     ┌──────────────────┐             │
│  │  generateAIResponse    │  generateEmbeddings             │
│  │  estimateCost         │  getEmbeddingDimension          │
│  │  getAvailableProviders │                                 │
│  └──────────────────┘     └──────────────────┘             │
└───────────────────────┬─────────────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          │                           │
┌─────────▼─────────┐       ┌─────────▼─────────┐
│   Google Gemini   │       │      OpenAI       │
│  (PREFERRED)      │       │   (FALLBACK)      │
│                   │       │                   │
│  gemini-1.5-flash │       │   gpt-4o-mini    │
│  text-embedding-  │       │   text-embedding- │
│  004 (768 dims)   │       │   3-large (3072)  │
└───────────────────┘       └───────────────────┘
```

---

## 3. Provider Comparison

### 3.1 Models Used

| Provider | Chat Model | Embedding Model | Embedding Dims |
|----------|------------|-----------------|----------------|
| **Google Gemini** | gemini-1.5-flash | text-embedding-004 | 768 |
| **OpenAI** | gpt-4o-mini | text-embedding-3-large | 3072 |

### 3.2 Pricing Comparison (January 2026)

| Provider | Model | Input (per 1M tokens) | Output (per 1M tokens) |
|----------|-------|----------------------|------------------------|
| **Gemini** | gemini-1.5-flash | $0.075 | $0.30 |
| **Gemini** | gemini-1.5-pro | $1.25 | $5.00 |
| **OpenAI** | gpt-4o-mini | $0.15 | $0.60 |
| **OpenAI** | gpt-4o | $2.50 | $10.00 |

**Cost Analysis**:
- Gemini 1.5-flash is **2x cheaper** than GPT-4o-mini
- For 10,000 coach requests/month (avg 500 input + 300 output tokens):
  - **Gemini**: $0.075 × 5 + $0.30 × 3 = ~$1.28/month
  - **OpenAI**: $0.15 × 5 + $0.60 × 3 = ~$2.55/month

### 3.3 Embedding Costs

| Provider | Model | Cost per 1M tokens |
|----------|-------|-------------------|
| **Gemini** | text-embedding-004 | FREE (during preview) |
| **OpenAI** | text-embedding-3-large | $0.13 |

---

## 4. Latency Analysis

### 4.1 Expected Performance

Based on provider specifications and typical network conditions:

| Metric | Target | Gemini Expected | OpenAI Expected |
|--------|--------|-----------------|-----------------|
| **p50 Latency** | < 1.5s | ~800-1200ms | ~900-1400ms |
| **p95 Latency** | < 2.0s | ~1200-1800ms | ~1400-2000ms |
| **p99 Latency** | < 3.0s | ~1500-2500ms | ~1800-2800ms |

### 4.2 Benchmark Script

Run the benchmark to get actual measurements:

```bash
# Set API keys in .env
echo "GOOGLE_GEMINI_API_KEY=your-key" >> .env
echo "OPENAI_API_KEY=your-key" >> .env  # Optional

# Run benchmark
npx tsx scripts/ai-poc-benchmark.ts
```

### 4.3 API Test Endpoint

Test the AI providers via API:

```bash
# GET - Check available providers
curl http://localhost:3000/api/ai-poc/test

# POST - Test chat completion
curl -X POST http://localhost:3000/api/ai-poc/test \
  -H "Content-Type: application/json" \
  -d '{"provider": "gemini", "testEmbeddings": true}'
```

---

## 5. Implementation Details

### 5.1 AI Provider Abstraction (`src/lib/ai-provider.ts`)

```typescript
// Key exports:
export function generateAIResponse(messages, config): Promise<AIResponse>
export function generateEmbeddings(text, config): Promise<AIEmbeddingResponse>
export function getAvailableProviders(): AIProvider[]
export function getPreferredProvider(): AIProvider | null
export function estimateCost(response): CostEstimate
```

### 5.2 Coach Service v2 (`src/services/coach-service-v2.ts`)

```typescript
// Enhanced coach service with multi-provider support
export function generateCoachResponseV2(
  messages: ChatMessage[],
  context: CoachContext,
  options?: { preferredProvider?: AIProvider }
): Promise<CoachResponseV2>

// Response includes:
// - content, provider, model
// - usage tokens
// - latencyMs
// - estimatedCost
```

### 5.3 Embeddings Service (`src/lib/embeddings.ts`)

```typescript
// Generate embeddings for Vector DB integration
export function generateEmbedding(text, config): Promise<EmbeddingResult>
export function generateBatchEmbeddings(texts, config): Promise<BatchEmbeddingResult>

// Trade-specific utilities
export function tradeToEmbeddingText(trade): string
export function generateTradeEmbedding(trade, config): Promise<EmbeddingResult>

// Similarity functions
export function cosineSimilarity(a, b): number
export function findMostSimilar(query, candidates, metric): { index, score }
```

---

## 6. Configuration

### 6.1 Environment Variables

```env
# Required (at least one)
GOOGLE_GEMINI_API_KEY=your-gemini-api-key

# Optional (for fallback)
OPENAI_API_KEY=your-openai-api-key
```

### 6.2 Getting API Keys

**Google Gemini**:
1. Go to https://aistudio.google.com/app/apikey
2. Create a new API key
3. Add to `.env` as `GOOGLE_GEMINI_API_KEY`

**OpenAI** (optional fallback):
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Add to `.env` as `OPENAI_API_KEY`

---

## 7. Success Criteria Validation

| Criteria | Target | Status | Notes |
|----------|--------|--------|-------|
| **AC1**: Gemini API configured | ✅ | ✅ PASS | `src/lib/google-gemini.ts` |
| **AC2**: Feedback latency < 2s (p95) | ✅ | 🔄 PENDING | Run benchmark to validate |
| **AC3**: Embeddings generated | ✅ | ✅ PASS | `src/lib/embeddings.ts` |
| **AC4**: Costs documented | ✅ | ✅ PASS | See Section 3.2 |
| **AC5**: Recommendation documented | ✅ | ✅ PASS | See Section 8 |

---

## 8. Recommendation

### Primary Choice: **Google Gemini**

**Rationale**:
1. **Cost**: 2x cheaper than OpenAI for equivalent models
2. **Performance**: Comparable latency, expected to meet <2s p95 target
3. **Embeddings**: Free during preview period
4. **Quality**: Gemini 1.5-flash provides high-quality responses

### Fallback: **OpenAI**

OpenAI should be kept as fallback for:
- Gemini API outages
- Rate limiting scenarios
- Specific use cases requiring OpenAI's capabilities

### Configuration

```typescript
// In ai-provider.ts, the default is already set to prefer Gemini:
const DEFAULT_CONFIG: AIProviderConfig = {
  preferredProvider: 'gemini',
  fallbackEnabled: true,
  // ...
};
```

---

## 9. Next Steps

1. **[ ] Run Benchmark**: Execute `npx tsx scripts/ai-poc-benchmark.ts` with production API keys
2. **[ ] Validate p95 < 2s**: Confirm latency meets acceptance criteria
3. **[ ] Integrate with Vector DB**: Use embeddings service with Story 1.3 (Vector DB POC)
4. **[ ] Migrate Coach Component**: Update UI to use `coach-service-v2.ts`
5. **[ ] Monitor Costs**: Set up cost tracking in production

---

## 10. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Gemini latency > 2s | Low | Medium | OpenAI fallback, caching |
| Gemini API changes | Low | Medium | Abstraction layer isolates changes |
| Cost overruns | Low | Low | Cost estimation + monitoring |
| Embedding dimension mismatch | Medium | High | Normalize to single dimension in Vector DB |

---

## 11. References

- **Story**: `docs/stories/1.5.story.md`
- **POC Plan**: `docs/specs/phase-0-poc-plan.md` (POC-3)
- **Execution Plan**: `docs/specs/phase-0-execution-plan.md`
- **Roadmap**: `docs/roadmap-trading-path-journal.md` (Phase 0)
- **Architecture**: `docs/architecture-trading-path-journal.md` (Section 2.3.4)

---

**Document Status**: ✅ Complete  
**Last Updated**: 2026-01-17
