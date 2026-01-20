# Macro Economic Analysis Prompt Guide

> **Task**: PRÉ-8.2 - Macro Prompts (8h) - Dev 48, Dev 49  
> **Date**: 2026-01-17  
> **Status**: ✅ COMPLETED  
> **Part of**: 6-Step Daily Bias Analysis Engine (Step 2: Macro)

---

## Overview

The Macro Analysis Prompt Template is a comprehensive prompt engineering framework designed to analyze macroeconomic indicators and determine their impact on financial instruments. This is Step 2 of the 6-Step Daily Bias Analysis Engine.

### Purpose

- Analyze economic calendar events (GDP, inflation, employment, central bank policy)
- Determine macro bias (bullish/bearish/neutral) for specific instruments
- Provide structured, data-driven analysis with confidence levels
- Support multiple instrument types (equities, forex, commodities)

### Data Sources

1. **ForexFactory API** (primary): Economic calendar events with forecasts, actuals, and previous values
2. **Manual injection** (fallback): User-provided economic data
3. **User context** (optional): Additional context or specific concerns

---

## Architecture

### File Structure

```
src/lib/prompts/
├── macro-analysis-prompt.ts          # Main prompt template
└── __tests__/
    └── macro-analysis-prompt.test.ts # Unit tests (100% coverage)

docs/prompts/
└── MACRO-ANALYSIS-PROMPT-GUIDE.md    # This file
```

### Key Components

1. **System Prompt** (`MACRO_ANALYSIS_SYSTEM_PROMPT`)
   - Expert macroeconomic analyst persona
   - Analysis framework (GDP, inflation, rates, employment, central bank)
   - Instrument-specific considerations
   - Output format requirements

2. **Prompt Generator** (`generateMacroAnalysisPrompt`)
   - Takes economic events + instrument + date
   - Sorts events by impact (high → medium → low)
   - Formats data for AI consumption
   - Includes JSON schema requirements

3. **Validation** (`validateMacroAnalysisOutput`)
   - Validates AI response against schema
   - Ensures all required fields present
   - Checks value constraints (e.g., confidence 0-100)

4. **Parser** (`parseMacroAnalysisResponse`)
   - Extracts JSON from AI response
   - Validates schema
   - Returns typed output

5. **Examples** (`MACRO_PROMPT_EXAMPLES`)
   - 4 real-world scenarios with expected outputs
   - Covers different instruments and macro conditions

---

## Usage

### Basic Usage

```typescript
import {
  generateMacroAnalysisPrompt,
  parseMacroAnalysisResponse,
  MACRO_ANALYSIS_SYSTEM_PROMPT,
  type MacroDataInput,
  type MacroAnalysisOutput
} from '@/lib/prompts/macro-analysis-prompt';
import { generateAIResponse } from '@/lib/ai-provider';

// 1. Prepare input data
const input: MacroDataInput = {
  economicEvents: [
    {
      title: 'Non-Farm Payrolls',
      country: 'USD',
      impact: 'high',
      forecast: '180K',
      previous: '150K',
      actual: '220K',
      time: '2026-01-17T13:30:00Z',
      category: 'Employment'
    }
  ],
  instrument: 'NQ1',
  analysisDate: '2026-01-17',
  userContext: 'Fed Chair Powell speech expected later today'
};

// 2. Generate prompt
const userPrompt = generateMacroAnalysisPrompt(input);

// 3. Call AI (Google Gemini preferred)
const aiResponse = await generateAIResponse({
  messages: [
    { role: 'system', content: MACRO_ANALYSIS_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ],
  temperature: 0.3, // Lower temperature for consistent analysis
  maxTokens: 1000
});

// 4. Parse and validate response
const analysis: MacroAnalysisOutput = parseMacroAnalysisResponse(aiResponse.content);

// 5. Use the analysis
console.log(`Macro Bias: ${analysis.bias} (${analysis.confidence}% confidence)`);
console.log(`Key Drivers: ${analysis.keyDrivers.join(', ')}`);
console.log(`Summary: ${analysis.summary}`);
```

### With ForexFactory Integration

```typescript
import { fetchForexFactoryEvents } from '@/services/data/forexfactory-service';

// Fetch events from ForexFactory API
const events = await fetchForexFactoryEvents({
  startDate: '2026-01-17',
  endDate: '2026-01-18',
  minImpact: 'medium' // Only medium/high impact events
});

// Convert to MacroDataInput format
const input: MacroDataInput = {
  economicEvents: events.map(event => ({
    title: event.title,
    country: event.currency,
    impact: event.impact,
    forecast: event.forecast,
    previous: event.previous,
    actual: event.actual,
    time: event.datetime,
    category: event.category
  })),
  instrument: 'NQ1',
  analysisDate: new Date().toISOString().split('T')[0]
};

// Generate and run analysis
const prompt = generateMacroAnalysisPrompt(input);
// ... (continue as above)
```

---

## Analysis Framework

### Economic Indicators

#### 1. GDP (Gross Domestic Product)

**Positive GDP**:
- Strong growth supports risk assets (equities, commodities)
- May pressure safe havens (bonds, gold)
- Currency strength depends on rate implications

**Negative GDP**:
- Weak growth pressures risk assets
- Supports safe havens
- May prompt central bank easing

**Instrument Impact**:
- Equities: Positive GDP = bullish (growth)
- Forex: Depends on rate differentials
- Gold: Negative GDP = bullish (safe haven)

#### 2. Inflation (CPI, PPI, PCE)

**Rising Inflation**:
- May pressure equities if forces central bank tightening
- Currency strength if central bank responds hawkishly
- Bullish for gold/commodities (inflation hedge)

**Falling Inflation**:
- Generally positive for equities (less tightening pressure)
- May weaken currency (less need for rate hikes)
- Mixed for gold (less inflation hedge need, but dovish policy support)

**Instrument Impact**:
- Tech stocks: Very sensitive (high duration) - prefer low inflation
- Gold: Benefits from inflation concerns
- Forex: Rate differential implications

#### 3. Interest Rates & Central Bank Policy

**Hawkish (Rate Hikes)**:
- Strengthens currency
- Pressures equities (higher discount rate)
- Mixed for bonds (higher yields but duration risk)

**Dovish (Rate Cuts)**:
- Weakens currency
- Supports equities (lower discount rate)
- Bullish for bonds

**Instrument Impact**:
- NQ1/Tech: Highly sensitive to rates (prefer dovish)
- EUR/USD: Rate differentials drive direction
- XAU/USD: Benefits from dovish policy (opportunity cost)

#### 4. Employment (NFP, Unemployment, Jobless Claims)

**Strong Employment**:
- Supports risk assets (economic strength)
- May signal hawkish Fed (economy can handle higher rates)
- Currency strength

**Weak Employment**:
- Pressures risk assets (recession fears)
- May prompt central bank easing
- Currency weakness

**Goldilocks Scenario**:
- Strong but not too strong (no forced tightening)
- Best for equities

#### 5. Central Bank Statements & Minutes

**Key Factors**:
- Forward guidance (future policy path)
- Policy shifts (pivot signals)
- Market expectations vs actual stance
- Dissenting votes (policy uncertainty)

**Instrument Impact**:
- All instruments highly sensitive
- Forex: Rate differential expectations
- Equities: Liquidity and discount rate implications

---

## Instrument-Specific Considerations

### Equity Indices (NQ1, ES1, SPY, QQQ)

**Bullish Factors**:
- Dovish central bank policy
- Strong but not overheating growth
- Falling inflation (Goldilocks)
- Positive earnings outlook

**Bearish Factors**:
- Hawkish policy / rate hikes
- Recession fears
- Inflation spikes forcing tightening
- Weak corporate earnings

**Sensitivity**:
- NQ1 (Nasdaq): Highest rate sensitivity (tech/growth)
- ES1 (S&P 500): Moderate sensitivity (diversified)

### Forex Pairs (EUR/USD, GBP/USD, etc.)

**Key Drivers**:
- Interest rate differentials (primary)
- Economic growth differentials
- Central bank policy divergence
- Safe haven flows (risk-on/risk-off)

**Example: EUR/USD**:
- Hawkish ECB + Dovish Fed = Bullish EUR/USD
- Strong US data + Weak EU data = Bearish EUR/USD

### Tech Stocks (NVDA, TSLA, AAPL, AMD, MSFT)

**Characteristics**:
- Long duration (cash flows far in future)
- Highly sensitive to interest rates
- Growth-oriented (benefit from low rates)

**Bullish Factors**:
- Dovish Fed / rate cuts
- Low inflation
- Strong growth (but not forcing tightening)

**Bearish Factors**:
- Hawkish Fed / rate hikes
- High inflation
- Recession fears

### Commodities (XAU/USD Gold, Oil)

**Gold (XAU/USD)**:
- Inflation hedge (bullish on rising inflation)
- Safe haven (bullish on risk-off)
- Inverse USD correlation
- Dovish policy support (low opportunity cost)

**Oil**:
- Supply/demand fundamentals
- Economic growth proxy
- Geopolitical risks

---

## Output Schema

### MacroAnalysisOutput

```typescript
interface MacroAnalysisOutput {
  // Overall macro bias
  bias: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-100
  
  // Key drivers (2-5 items)
  keyDrivers: string[];
  
  // Economic indicators assessment
  indicators: {
    gdp: 'positive' | 'negative' | 'neutral' | 'unknown';
    inflation: 'rising' | 'falling' | 'stable' | 'unknown';
    interestRates: 'hawkish' | 'dovish' | 'neutral' | 'unknown';
    employment: 'strong' | 'weak' | 'stable' | 'unknown';
    centralBankPolicy: 'tightening' | 'easing' | 'neutral' | 'unknown';
  };
  
  // Risk factors (1-3 items)
  risks: string[];
  
  // Summary (2-3 sentences)
  summary: string;
  
  // Detailed analysis (4-6 sentences)
  detailedAnalysis: string;
}
```

### Bias Determination Rules

**Bullish** (60%+ confidence):
- Macro factors clearly support upside
- Multiple positive indicators align
- Limited downside risks

**Bearish** (60%+ confidence):
- Macro factors clearly support downside
- Multiple negative indicators align
- Significant downside risks

**Neutral** (<60% confidence either way):
- Mixed signals
- Conflicting indicators
- High uncertainty
- Insufficient data

---

## Examples

### Example 1: Strong NFP → Bearish for Tech

**Scenario**: Non-Farm Payrolls beat expectations (220K vs 180K forecast), unemployment falls to 3.9%

**Input**:
```typescript
{
  economicEvents: [
    { title: 'Non-Farm Payrolls', actual: '220K', forecast: '180K', impact: 'high' },
    { title: 'Unemployment Rate', actual: '3.9%', forecast: '4.0%', impact: 'high' }
  ],
  instrument: 'NQ1',
  analysisDate: '2026-01-17'
}
```

**Expected Output**:
```typescript
{
  bias: 'bearish',
  confidence: 75,
  keyDrivers: [
    'Strong employment data suggests Fed may keep rates higher for longer',
    'Tight labor market increases inflation risk',
    'Tech stocks highly sensitive to rate expectations'
  ],
  indicators: {
    gdp: 'positive',
    inflation: 'neutral', // Strong jobs = potential inflation pressure
    interestRates: 'hawkish', // Fed less likely to cut
    employment: 'strong',
    centralBankPolicy: 'neutral' // No immediate change but less dovish
  },
  risks: [
    'Fed may delay rate cuts',
    'Higher-for-longer rate environment'
  ],
  summary: 'Strong employment data reduces likelihood of near-term Fed rate cuts, creating headwinds for rate-sensitive tech stocks.',
  detailedAnalysis: 'The stronger-than-expected NFP print (220K vs 180K) and falling unemployment (3.9% vs 4.0%) suggest a resilient labor market. This reduces urgency for Fed rate cuts and may even prompt concerns about reaccelerating inflation. Tech stocks, with their long duration characteristics, are particularly vulnerable to a higher-for-longer rate environment. The macro backdrop has shifted more hawkish, creating near-term pressure on NQ1.'
}
```

### Example 2: Dovish Fed Pivot → Bullish for Tech

**Scenario**: Fed signals dovish pivot, CPI falls to 2.3%

**Input**:
```typescript
{
  economicEvents: [
    { title: 'FOMC Statement', actual: 'Dovish pivot - considering rate cuts', impact: 'high' },
    { title: 'CPI', actual: '2.3%', forecast: '2.5%', previous: '3.0%', impact: 'high' }
  ],
  instrument: 'NQ1',
  analysisDate: '2026-01-17'
}
```

**Expected Output**:
```typescript
{
  bias: 'bullish',
  confidence: 85,
  keyDrivers: [
    'Fed dovish pivot signals potential rate cuts',
    'Falling inflation removes tightening pressure',
    'Tech stocks benefit from lower rate environment'
  ],
  indicators: {
    gdp: 'neutral',
    inflation: 'falling',
    interestRates: 'dovish',
    employment: 'neutral',
    centralBankPolicy: 'easing'
  },
  risks: [
    'Economic weakness could offset dovish benefits',
    'Market may have already priced in rate cuts'
  ],
  summary: 'Dovish Fed pivot combined with falling inflation creates highly favorable conditions for rate-sensitive tech stocks.',
  detailedAnalysis: 'The Fed\'s dovish pivot, signaling consideration of rate cuts, represents a major policy shift. Combined with CPI falling to 2.3% (below forecast), this removes the primary headwind for tech stocks. Lower rates reduce the discount rate for future cash flows, particularly benefiting long-duration growth stocks like those in the Nasdaq. The macro backdrop has turned decisively supportive for NQ1, though traders should monitor economic data to ensure the dovish pivot isn\'t driven by recession fears.'
}
```

### Example 3: Mixed Signals → Neutral

**Scenario**: Weak GDP but strong retail sales

**Input**:
```typescript
{
  economicEvents: [
    { title: 'GDP Growth', actual: '1.5%', forecast: '2.0%', impact: 'high' },
    { title: 'Retail Sales', actual: '0.8%', forecast: '0.3%', impact: 'medium' }
  ],
  instrument: 'ES1',
  analysisDate: '2026-01-17'
}
```

**Expected Output**:
```typescript
{
  bias: 'neutral',
  confidence: 45,
  keyDrivers: [
    'Conflicting signals: weak GDP but strong consumer spending',
    'Uncertainty about economic trajectory',
    'Mixed implications for Fed policy'
  ],
  indicators: {
    gdp: 'negative',
    inflation: 'unknown',
    interestRates: 'neutral',
    employment: 'unknown',
    centralBankPolicy: 'neutral'
  },
  risks: [
    'GDP weakness could accelerate',
    'Strong retail may not be sustainable',
    'Fed policy uncertainty'
  ],
  summary: 'Conflicting economic signals create uncertainty, with weak GDP offset by strong consumer spending.',
  detailedAnalysis: 'The macro picture is mixed. GDP growth disappointed at 1.5% vs 2.0% forecast, suggesting economic weakness. However, retail sales surged 0.8% vs 0.3% forecast, indicating resilient consumer spending. This creates uncertainty about the true state of the economy and Fed policy direction. The weak GDP argues for dovish policy (supportive for equities), but strong retail suggests the consumer remains healthy (less urgency for cuts). Given these conflicting signals, a neutral bias is appropriate until more data clarifies the economic trajectory.'
}
```

### Example 4: Rising Inflation → Bullish for Gold

**Scenario**: CPI and PPI both exceed expectations

**Input**:
```typescript
{
  economicEvents: [
    { title: 'CPI', actual: '3.5%', forecast: '3.0%', previous: '2.5%', impact: 'high' },
    { title: 'PPI', actual: '2.5%', forecast: '2.0%', previous: '1.8%', impact: 'medium' }
  ],
  instrument: 'XAU/USD',
  analysisDate: '2026-01-17'
}
```

**Expected Output**:
```typescript
{
  bias: 'bullish',
  confidence: 80,
  keyDrivers: [
    'Rising inflation supports gold as inflation hedge',
    'CPI and PPI both exceed expectations',
    'May prompt dovish Fed response if growth weakens'
  ],
  indicators: {
    gdp: 'unknown',
    inflation: 'rising',
    interestRates: 'neutral', // Depends on Fed response
    employment: 'unknown',
    centralBankPolicy: 'neutral'
  },
  risks: [
    'Hawkish Fed response could pressure gold short-term',
    'Strong USD from rate hikes would be headwind'
  ],
  summary: 'Rising inflation across CPI and PPI supports gold\'s role as an inflation hedge.',
  detailedAnalysis: 'Both CPI (3.5% vs 3.0%) and PPI (2.5% vs 2.0%) exceeded expectations, signaling reaccelerating inflation. Gold traditionally benefits from inflation concerns as a store of value. While a hawkish Fed response (rate hikes) could create short-term pressure via USD strength, the longer-term inflation narrative supports gold. Additionally, if inflation persists while growth weakens (stagflation), gold would benefit from both inflation hedge demand and safe haven flows. The macro backdrop is constructive for XAU/USD.'
}
```

---

## Testing

### Unit Tests

Run tests:
```bash
npm run test src/lib/prompts/__tests__/macro-analysis-prompt.test.ts
```

### Test Coverage

- ✅ Prompt generation with events
- ✅ Event sorting by impact
- ✅ Empty events handling
- ✅ User context inclusion
- ✅ Output validation (all fields)
- ✅ Invalid schema rejection
- ✅ Response parsing (clean JSON)
- ✅ Response parsing (JSON with extra text)
- ✅ Error handling
- ✅ Example scenarios (4 cases)

**Coverage**: 100% (all functions, branches, lines)

### A/B Testing Recommendations

1. **Temperature Comparison**:
   - Test temperature 0.2 vs 0.3 vs 0.5
   - Measure consistency vs creativity
   - Recommendation: 0.3 (balanced)

2. **Prompt Variations**:
   - Test with/without instrument-specific guidance
   - Test with/without examples in prompt
   - Measure accuracy and confidence calibration

3. **Provider Comparison**:
   - Google Gemini (preferred) vs OpenAI GPT-4o
   - Measure latency, cost, quality
   - Track which provider gives better macro analysis

4. **Output Format**:
   - JSON vs structured text
   - Measure parsing success rate
   - Recommendation: JSON (validated schema)

---

## Integration with 6-Step Analysis

### Position in Pipeline

```
Step 1: Security Analysis (market structure, price action)
Step 2: Macro Analysis ← THIS PROMPT
Step 3: Institutional Flux (smart money, order flow)
Step 4: Mag 7 Leaders (tech leadership)
Step 5: Technical Structure (support/resistance, patterns)
Step 6: Synthesis (combine all steps → final bias)
```

### Data Flow

```typescript
// 1. Fetch economic events (ForexFactory or manual)
const events = await fetchForexFactoryEvents(date);

// 2. Generate macro analysis
const macroInput: MacroDataInput = {
  economicEvents: events,
  instrument: 'NQ1',
  analysisDate: date
};

const macroPrompt = generateMacroAnalysisPrompt(macroInput);
const macroResponse = await generateAIResponse({
  messages: [
    { role: 'system', content: MACRO_ANALYSIS_SYSTEM_PROMPT },
    { role: 'user', content: macroPrompt }
  ]
});

const macroAnalysis = parseMacroAnalysisResponse(macroResponse.content);

// 3. Store in database
await prisma.dailyBiasAnalysis.create({
  data: {
    userId,
    instrument,
    date,
    macroAnalysis: macroAnalysis, // JSON field
    // ... other steps
  }
});

// 4. Use in synthesis step (Step 6)
const synthesisPrompt = generateSynthesisPrompt({
  security: securityAnalysis,
  macro: macroAnalysis, // ← Used here
  institutional: institutionalAnalysis,
  mag7: mag7Analysis,
  technical: technicalAnalysis
});
```

---

## Performance Considerations

### Latency

- **Prompt generation**: <1ms (pure TypeScript)
- **AI call**: 2-5 seconds (Google Gemini)
- **Response parsing**: <1ms
- **Total**: ~2-5 seconds

### Cost

- **Google Gemini Flash**: ~$0.001 per analysis
- **OpenAI GPT-4o**: ~$0.01 per analysis
- **Recommendation**: Use Gemini (10x cheaper)

### Caching

```typescript
// Cache macro analysis for 1 hour (economic data doesn't change frequently)
const cacheKey = `macro:${instrument}:${date}:${eventsHash}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const analysis = await runMacroAnalysis(input);
await redis.setex(cacheKey, 3600, JSON.stringify(analysis)); // 1 hour TTL

return analysis;
```

---

## Maintenance & Iteration

### Version History

- **v1.0** (2026-01-17): Initial implementation (PRÉ-8.2)
  - 5 indicator categories
  - 4 instrument types
  - 4 example scenarios
  - 100% test coverage

### Future Enhancements

1. **Additional Indicators**:
   - Consumer confidence
   - Manufacturing PMI
   - Trade balance
   - Housing data

2. **More Instruments**:
   - Crypto (BTC, ETH)
   - Bonds (TLT, IEF)
   - Sector ETFs (XLF, XLE, XLK)

3. **Multi-Timeframe**:
   - Intraday impact (0-24h)
   - Short-term (1-7 days)
   - Medium-term (1-4 weeks)

4. **Historical Context**:
   - Compare current data to historical averages
   - Identify regime changes
   - Detect anomalies

5. **Confidence Calibration**:
   - Track prediction accuracy
   - Adjust confidence scoring
   - Learn from outcomes

---

## Troubleshooting

### Issue: AI returns invalid JSON

**Solution**:
```typescript
try {
  const analysis = parseMacroAnalysisResponse(response);
} catch (error) {
  // Retry with more explicit JSON instruction
  const retryPrompt = userPrompt + '\n\nREMINDER: Respond with ONLY valid JSON. No additional text.';
  const retryResponse = await generateAIResponse({
    messages: [
      { role: 'system', content: MACRO_ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: retryPrompt }
    ]
  });
  
  const analysis = parseMacroAnalysisResponse(retryResponse.content);
}
```

### Issue: Low confidence scores

**Possible causes**:
- Insufficient economic data
- Conflicting signals
- Unclear instrument sensitivity

**Solution**: Accept neutral bias when confidence <60%

### Issue: Bias doesn't match market reaction

**Remember**:
- Markets are forward-looking (may have priced in data)
- Other factors matter (technical, sentiment, flows)
- Macro is just Step 2 of 6 (synthesis combines all)

---

## References

### Economic Data Sources

- **ForexFactory**: https://www.forexfactory.com/calendar
- **Trading Economics**: https://tradingeconomics.com/calendar
- **Investing.com**: https://www.investing.com/economic-calendar/

### Central Banks

- **Federal Reserve**: https://www.federalreserve.gov/
- **ECB**: https://www.ecb.europa.eu/
- **Bank of England**: https://www.bankofengland.co.uk/

### Market Data

- **TradingView**: https://www.tradingview.com/
- **Bloomberg**: https://www.bloomberg.com/markets/economic-calendar

---

## Contact & Support

**Developers**: Dev 48, Dev 49  
**Task**: PRÉ-8.2 - Macro Prompts  
**Completion Date**: 2026-01-17  
**Status**: ✅ READY FOR INTEGRATION

For questions or issues, contact the Phase 11 AI Infrastructure team (Team 2B).
