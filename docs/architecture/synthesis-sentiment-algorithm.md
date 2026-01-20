# Synthesis Sentiment Algorithm

**Story**: 12.11 - Synthesis Text Generation with Sentiment  
**Implementation**: `src/services/ai/synthesis-sentiment.ts`  
**Date**: 2026-01-20

---

## Overview

This document describes the weighted sentiment calculation algorithm used to determine the final trading bias (BULLISH/BEARISH/NEUTRAL) from the 5-step daily bias analysis.

---

## Algorithm Steps

### 1. Input

The algorithm takes 5 analysis step results:

```typescript
interface AnalysisSteps {
  security: { bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL', confidence: number };
  macro: { bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL', confidence: number };
  flux: { bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL', confidence: number };
  mag7: { bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL', confidence: number };
  technical: { bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL', confidence: number };
}
```

### 2. Step Weights

Each analysis step is assigned a weight based on its importance:

| Step | Weight | Rationale |
|------|--------|-----------|
| **Security Analysis** | 20% | Foundation - determines risk tolerance and position sizing |
| **Macro Analysis** | 15% | Economic context - affects longer timeframes |
| **Institutional Flux** | **25%** | **Highest weight** - shows "smart money" positioning |
| **MAG 7 Leaders** | 20% | Tech sentiment - critical for indices (NQ, ES, SPY) |
| **Technical Structure** | 20% | Price action - timing and confirmation |

**Total**: 100% (weights must sum to 1.0)

### 3. Bias to Score Conversion

Each step's bias is converted to a numeric score:

```
BULLISH  → +1
BEARISH  → -1
NEUTRAL  →  0
```

### 4. Weighted Score Calculation

Calculate the weighted sum across all steps:

```
weightedScore = 
  (security.bias × 0.20) +
  (macro.bias × 0.15) +
  (flux.bias × 0.25) +
  (mag7.bias × 0.20) +
  (technical.bias × 0.20)
```

**Range**: -1.0 to +1.0

### 5. Sentiment Decision

Based on the weighted score, determine the final sentiment:

```
if (weightedScore > 0.2)  → BULLISH
if (weightedScore < -0.2) → BEARISH
else                      → NEUTRAL
```

**Thresholds**:
- **BULLISH threshold**: +0.2 (20% net bullish bias)
- **BEARISH threshold**: -0.2 (20% net bearish bias)
- **NEUTRAL zone**: -0.2 to +0.2 (conflicting or weak signals)

---

## Examples

### Example 1: Strong Bullish

| Step | Bias | Score | Weight | Contribution |
|------|------|-------|--------|--------------|
| Security | BULLISH | +1 | 0.20 | +0.20 |
| Macro | BULLISH | +1 | 0.15 | +0.15 |
| Flux | BULLISH | +1 | 0.25 | +0.25 |
| MAG7 | BULLISH | +1 | 0.20 | +0.20 |
| Technical | BULLISH | +1 | 0.20 | +0.20 |

**Weighted Score**: +1.00  
**Final Sentiment**: **BULLISH** ✅

---

### Example 2: Mixed Signals → Neutral

| Step | Bias | Score | Weight | Contribution |
|------|------|-------|--------|--------------|
| Security | NEUTRAL | 0 | 0.20 | 0.00 |
| Macro | BULLISH | +1 | 0.15 | +0.15 |
| Flux | BEARISH | -1 | 0.25 | -0.25 |
| MAG7 | BULLISH | +1 | 0.20 | +0.20 |
| Technical | NEUTRAL | 0 | 0.20 | 0.00 |

**Weighted Score**: +0.10  
**Final Sentiment**: **NEUTRAL** (within -0.2 to +0.2 range) ⚠️

---

### Example 3: Bearish (Flux Drives Decision)

| Step | Bias | Score | Weight | Contribution |
|------|------|-------|--------|--------------|
| Security | NEUTRAL | 0 | 0.20 | 0.00 |
| Macro | BEARISH | -1 | 0.15 | -0.15 |
| Flux | BEARISH | -1 | 0.25 | **-0.25** |
| MAG7 | NEUTRAL | 0 | 0.20 | 0.00 |
| Technical | BULLISH | +1 | 0.20 | +0.20 |

**Weighted Score**: -0.20  
**Final Sentiment**: **BEARISH** (exactly at threshold) 🔴

**Note**: Institutional Flux (25% weight) drives the decision despite Technical being bullish.

---

## Instrument-Specific Weight Adjustments

Different instruments may use custom weights:

### Indices (NQ1, ES1, SPY, QQQ, TQQQ, SQQQ)

MAG 7 leaders have higher correlation with indices:

```typescript
{
  security: 0.15,
  macro: 0.15,
  flux: 0.20,
  mag7: 0.30,      // ⬆️ Higher weight
  technical: 0.20
}
```

### Forex (EUR/USD, XAU/USD)

Macro economic factors dominate forex:

```typescript
{
  security: 0.15,
  macro: 0.35,     // ⬆️ Higher weight
  flux: 0.20,
  mag7: 0.10,      // ⬇️ Lower weight (less relevant)
  technical: 0.20
}
```

### Individual Stocks (TSLA, NVDA, AAPL, etc.)

Security and technical matter more:

```typescript
{
  security: 0.25,  // ⬆️ Higher weight
  macro: 0.10,
  flux: 0.25,
  mag7: 0.15,
  technical: 0.25  // ⬆️ Higher weight
}
```

---

## Agreement Level Calculation

In addition to sentiment, we calculate how much the 5 steps agree:

```typescript
agreementLevel = (majorityVotePercentage) × (averageConfidence)
```

**Range**: 0.0 to 1.0

- **1.0**: Perfect agreement (all steps same bias, high confidence)
- **0.7-0.9**: Strong agreement (most steps align)
- **0.5-0.7**: Moderate agreement (some disagreements)
- **0.3-0.5**: Weak agreement (significant conflicts)
- **0.0-0.3**: No agreement (contradictory signals)

---

## Design Rationale

### Why 25% weight for Institutional Flux?

Institutional order flow is the most reliable short-term signal:
- Shows where "smart money" is positioned
- Harder to fake than price action
- Predicts near-term directional moves

### Why ±0.2 thresholds?

- **Avoids false signals**: Requires at least 20% net bias conviction
- **Neutral zone**: Protects traders from conflicting signals
- **Empirically tested**: 0.2 threshold provides good signal-to-noise ratio

### Why not equal weights?

Equal weights (20% each) ignore that:
- Some signals are more predictive (Flux > Macro)
- Different instruments have different drivers (indices ≠ forex)
- Risk management (Security) is foundational but not directional

---

## Validation

Weights must sum to 1.0:

```typescript
function validateWeights(weights: SentimentWeights): boolean {
  const sum = weights.security + weights.macro + weights.flux + 
              weights.mag7 + weights.technical;
  return Math.abs(sum - 1.0) < 0.01; // 1% tolerance
}
```

---

## Usage Example

```typescript
import { calculateSentiment, DEFAULT_WEIGHTS } from '@/services/ai/synthesis-sentiment';

const analysisSteps = {
  security: { bias: 'NEUTRAL', confidence: 70 },
  macro: { bias: 'BULLISH', confidence: 65 },
  flux: { bias: 'BULLISH', confidence: 80 },
  mag7: { bias: 'BULLISH', confidence: 75 },
  technical: { bias: 'NEUTRAL', confidence: 60 }
};

const result = calculateSentiment(analysisSteps, DEFAULT_WEIGHTS);

console.log(result);
// {
//   sentiment: 'BULLISH',
//   weightedScore: 0.50,
//   stepScores: {
//     security: 0.00,
//     macro: 0.15,
//     flux: 0.25,
//     mag7: 0.20,
//     technical: 0.00
//   },
//   agreementLevel: 0.68
// }
```

---

## References

- **Story 12.11**: Synthesis Text Generation with Sentiment
- **Implementation**: `src/services/ai/synthesis-sentiment.ts`
- **Tests**: `src/services/ai/__tests__/synthesis-sentiment.test.ts`
- **Related**: `docs/stories/12.11.story.md`

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-20 | 1.0 | Initial algorithm design and documentation |
