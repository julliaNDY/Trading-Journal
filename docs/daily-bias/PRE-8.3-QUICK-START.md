# PRÉ-8.3: Institutional Flux - Quick Start Guide

> **Quick Reference** for developers integrating institutional flux analysis  
> **Created**: 2026-01-17  
> **Team**: Dev 50, Dev 51

---

## 🚀 Quick Start (5 minutes)

### 1. Basic Usage

```typescript
import { analyzeInstitutionalFlux } from '@/services/daily-bias/institutional-flux-service';

// Analyze institutional flux
const result = await analyzeInstitutionalFlux({
  instrument: 'NQ1',
  marketData: {
    currentPrice: 450.25,
    priceChange24h: 2.5,
    volume24h: 5_000_000,
    averageVolume20d: 3_500_000,
    high24h: 455.00,
    low24h: 445.00,
  },
});

console.log(`Flux Score: ${result.analysis.fluxScore}/10`);
console.log(`Bias: ${result.analysis.bias}`); // BULLISH/BEARISH/NEUTRAL
console.log(`Confidence: ${result.analysis.confidence}%`);
console.log(`Insights: ${result.analysis.keyInsights.join(', ')}`);
```

### 2. API Usage (Frontend)

```typescript
const response = await fetch('/api/daily-bias/flux', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    instrument: 'NQ1',
    marketData: { /* ... */ },
    timeframe: '1d',
    useCache: true,
  }),
});

const { data, meta } = await response.json();
console.log(`Flux Score: ${data.fluxScore}/10`);
console.log(`Cached: ${meta.cached}`);
```

---

## 📊 Output Schema

```typescript
{
  instrument: "NQ1",
  timestamp: "2026-01-17T12:00:00Z",
  
  // Volume Profile
  volumeProfile: {
    totalVolume: 5000000,
    averageVolume: 3500000,
    volumeRatio: 1.43,
    volumeTrend: "INCREASING",
    volumeSpikes: [...],
    volumeByPriceLevel: [...], // VPOC analysis
  },
  
  // Order Flow
  orderFlow: {
    buyVolume: 3000000,
    sellVolume: 2000000,
    buyVsSellRatio: 1.5,
    netOrderFlow: 1000000,
    orderFlowTrend: "BULLISH",
    largeOrders: [...],
    aggressiveness: 7, // 0-10
  },
  
  // Institutional Activity
  institutionalActivity: {
    darkPoolActivity: { volume, percentage, trend },
    blockTrades: [...],
    smartMoneyIndex: 6, // -10 to +10
    institutionalSentiment: "BULLISH",
    confidence: 75,
  },
  
  // Market Manipulation
  marketManipulation: {
    spoofingDetected: false,
    washTrading: false,
    stopHunting: false,
    manipulationScore: 2, // 0-10
    manipulationDetails: "...",
  },
  
  // Summary
  fluxScore: 7.5, // 0-10
  bias: "BULLISH", // BULLISH/BEARISH/NEUTRAL
  confidence: 75, // 0-100
  keyInsights: ["...", "...", "..."],
  warnings: [],
  nextUpdate: "2026-01-17T12:05:00Z",
}
```

---

## 🔑 Key Concepts

### Flux Score (0-10)
- **0-3**: Low institutional activity
- **4-6**: Moderate institutional activity
- **7-10**: High institutional activity

**Calculation**: Weighted average
- Volume (30%): Based on volume ratio vs 20-day average
- Order Flow (40%): Based on aggressiveness score
- Institutional (30%): Based on smart money index

### Smart Money Index (-10 to +10)
- **+7 to +10**: Strong institutional buying (accumulation)
- **+3 to +6**: Moderate institutional buying
- **-3 to +3**: Neutral/balanced
- **-6 to -3**: Moderate institutional selling
- **-10 to -7**: Strong institutional selling (distribution)

### Manipulation Score (0-10)
- **0-3**: LOW risk (normal market behavior)
- **4-6**: MEDIUM risk (some unusual patterns)
- **7-10**: HIGH risk (significant manipulation detected)

### Bias Determination
- **BULLISH**: Net buying + accumulation + positive smart money
- **BEARISH**: Net selling + distribution + negative smart money
- **NEUTRAL**: Balanced flow or insufficient data

---

## ⚡ Performance

- **Latency (p95)**: < 3s (with AI), < 100ms (cached)
- **Cache TTL**: 5 minutes
- **Rate Limit**: 10 requests/minute per user
- **Timeout**: 3 seconds max
- **Batch Size**: 10 concurrent requests

---

## 🛠️ Advanced Usage

### Batch Analysis

```typescript
import { batchAnalyzeFlux } from '@/services/daily-bias/institutional-flux-service';

const instruments = ['NQ1', 'ES1', 'TSLA', 'NVDA'];
const results = await batchAnalyzeFlux(instruments, getMarketData);

for (const [instrument, result] of results) {
  console.log(`${instrument}: ${result.analysis.bias}`);
}
```

### Multi-Timeframe Comparison

```typescript
import { compareFluxAcrossTimeframes } from '@/services/daily-bias/institutional-flux-service';

const analyses = [
  { timeframe: '1h', analysis: await analyzeFlux({ timeframe: '1h', ... }) },
  { timeframe: '4h', analysis: await analyzeFlux({ timeframe: '4h', ... }) },
  { timeframe: '1d', analysis: await analyzeFlux({ timeframe: '1d', ... }) },
];

const comparison = compareFluxAcrossTimeframes(analyses);
console.log(`Consensus: ${comparison.consensus}`); // BULLISH/BEARISH/NEUTRAL/DIVERGENT
console.log(`Strength: ${comparison.strength}/10`);
```

### Dashboard Summary

```typescript
import { getFluxSummary } from '@/services/daily-bias/institutional-flux-service';

const summary = getFluxSummary(analysis);
console.log(summary);
// {
//   score: 7.5,
//   bias: "BULLISH",
//   confidence: 75,
//   topInsight: "Strong buying pressure...",
//   warningLevel: "LOW" // LOW/MEDIUM/HIGH
// }
```

### Cache Invalidation

```typescript
import { invalidateFluxCache } from '@/services/daily-bias/institutional-flux-service';

// Invalidate cache after significant market event
await invalidateFluxCache('NQ1');
```

---

## 🧪 Testing

```bash
# Run institutional flux tests
npm test -- src/services/daily-bias/__tests__/institutional-flux-service.test.ts

# Expected: 24/24 tests passing ✅
```

---

## 📁 File Locations

```
src/
├── lib/prompts/
│   └── institutional-flux.ts          # Prompt templates + types
├── services/daily-bias/
│   ├── institutional-flux-service.ts  # Main service
│   └── __tests__/
│       └── institutional-flux-service.test.ts
└── app/api/daily-bias/flux/
    └── route.ts                       # API endpoint

docs/daily-bias/
├── PRE-8.3-INSTITUTIONAL-FLUX-IMPLEMENTATION.md  # Full docs
└── PRE-8.3-QUICK-START.md                        # This file
```

---

## 🔗 Integration Points

### Story 12.4 (Institutional Flux UI)
- Display flux score gauge (0-10)
- Show bias badge (BULLISH/BEARISH/NEUTRAL)
- List key insights (3-5 bullets)
- Display manipulation warnings (if any)
- Show volume profile chart
- Show order flow chart

### Story 12.7 (Synthesis)
- Aggregate flux analysis with other steps
- Weight institutional flux in final bias
- Include flux insights in synthesis

---

## ❓ Common Issues

### Issue: "Rate limit exceeded"
**Solution**: Wait 60 seconds or use caching (`useCache: true`)

### Issue: "Timeout error"
**Solution**: Analysis takes > 3s, fallback analysis returned automatically

### Issue: "Low confidence score"
**Solution**: Provide more data (volumeData, orderBookData, darkPoolData)

### Issue: "DIVERGENT consensus"
**Solution**: Normal when timeframes disagree, check individual timeframe analyses

---

## 📞 Support

- **Technical Questions**: @Dev50, @Dev51 in `#ws2-ai-infrastructure`
- **Integration Help**: See full docs (`PRE-8.3-INSTITUTIONAL-FLUX-IMPLEMENTATION.md`)
- **Bug Reports**: Create Jira issue (PHASE-11-PRE-8.3)

---

**Status**: ✅ Production Ready  
**Last Updated**: 2026-01-17  
**Version**: 1.0
