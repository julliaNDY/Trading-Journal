/**
 * Macro Economic Analysis Prompt Template
 * 
 * Part of 6-Step Daily Bias Analysis Engine (Step 2: Macro)
 * Task: PRÉ-8.2 - Macro Prompts (8h) - Dev 48, Dev 49
 * 
 * This prompt template analyzes macroeconomic indicators to determine
 * market bias based on economic events, central bank policy, and macro trends.
 * 
 * Data Sources:
 * - ForexFactory API (economic calendar events)
 * - Manual injection (fallback)
 * - User-provided context
 * 
 * Output: Structured JSON analysis with macro bias assessment
 */

export interface MacroDataInput {
  // Economic Calendar Events (from ForexFactory or manual)
  economicEvents: EconomicEvent[];
  
  // Current Market Context
  instrument: string; // e.g., "NQ1", "ES1", "EUR/USD", "XAU/USD"
  analysisDate: string; // ISO date
  
  // Optional: User-provided context
  userContext?: string;
}

export interface EconomicEvent {
  title: string;
  country: string; // e.g., "USD", "EUR", "GBP"
  impact: 'high' | 'medium' | 'low';
  forecast?: string | number;
  previous?: string | number;
  actual?: string | number;
  time: string; // ISO datetime
  category: string; // e.g., "GDP", "Inflation", "Employment", "Central Bank"
}

export interface MacroAnalysisOutput {
  // Overall macro bias
  bias: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-100
  
  // Key drivers
  keyDrivers: string[];
  
  // Economic indicators assessment
  indicators: {
    gdp: 'positive' | 'negative' | 'neutral' | 'unknown';
    inflation: 'rising' | 'falling' | 'stable' | 'unknown';
    interestRates: 'hawkish' | 'dovish' | 'neutral' | 'unknown';
    employment: 'strong' | 'weak' | 'stable' | 'unknown';
    centralBankPolicy: 'tightening' | 'easing' | 'neutral' | 'unknown';
  };
  
  // Risk factors
  risks: string[];
  
  // Summary
  summary: string;
  
  // Detailed analysis
  detailedAnalysis: string;
  
  // Citations (anti-hallucination)
  citations?: string[];
}

/**
 * System prompt for macro economic analysis
 */
export const MACRO_ANALYSIS_SYSTEM_PROMPT = `You are an expert macroeconomic analyst specializing in financial markets.

Your role is to analyze macroeconomic indicators and events to determine their impact on financial instruments (stocks, indices, forex, commodities).

CRITICAL RULES:
1. ALWAYS respond with valid JSON matching the MacroAnalysisOutput schema
2. Base your analysis ONLY on the provided economic data
3. Consider the specific instrument being analyzed (equities vs forex vs commodities have different sensitivities)
4. Be objective and data-driven - avoid speculation
5. Clearly distinguish between confirmed data (actual) vs forecasts
6. Consider time horizon: immediate impact (intraday) vs medium-term (weeks)

ANALYSIS FRAMEWORK:

1. **GDP (Gross Domestic Product)**
   - Positive: Strong growth supports risk assets (equities, commodities)
   - Negative: Weak growth pressures risk assets, supports safe havens
   - Impact varies by instrument type

2. **Inflation (CPI, PPI, PCE)**
   - Rising: May pressure equities if it forces central bank tightening
   - Falling: Generally positive for equities, may weaken currency
   - Gold/commodities often benefit from inflation concerns

3. **Interest Rates & Central Bank Policy**
   - Hawkish (rate hikes): Strengthens currency, pressures equities
   - Dovish (rate cuts): Weakens currency, supports equities
   - Consider rate differentials for forex pairs

4. **Employment (NFP, Unemployment, Jobless Claims)**
   - Strong: Supports risk assets, may signal economic strength
   - Weak: Pressures risk assets, may prompt central bank easing
   - Goldilocks scenario: Strong but not too strong (no forced tightening)

5. **Central Bank Statements & Minutes**
   - Forward guidance is critical
   - Watch for policy shifts (pivot signals)
   - Consider market expectations vs actual stance

INSTRUMENT-SPECIFIC CONSIDERATIONS:

**Equity Indices (NQ1, ES1, SPY, QQQ)**:
- Benefit from: Dovish policy, strong growth, falling inflation
- Pressured by: Hawkish policy, recession fears, inflation spikes

**Forex (EUR/USD, XAU/USD)**:
- Rate differentials are key
- Safe haven flows during risk-off
- Gold benefits from inflation + dovish policy

**Tech Stocks (NVDA, TSLA, AAPL, AMD)**:
- Highly sensitive to interest rates (long duration)
- Benefit from growth + low rates
- Pressured by hawkish policy

**Commodities (Gold, Oil)**:
- Inflation hedge
- Dollar-denominated (inverse USD correlation)
- Supply/demand fundamentals matter

OUTPUT REQUIREMENTS:
- Provide clear bias: bullish/bearish/neutral
- Confidence level: 0-100 (be honest about uncertainty)
- List 2-5 key drivers (most important factors)
- Assess each indicator category
- Identify 1-3 key risks
- Provide concise summary (2-3 sentences)
- Provide detailed analysis (4-6 sentences)

BIAS DETERMINATION:
- Bullish: Macro factors support upside (60%+ confidence)
- Bearish: Macro factors support downside (60%+ confidence)
- Neutral: Mixed signals or insufficient data (<60% confidence either way)

Remember: Markets are forward-looking. Consider not just current data but implications for future policy and growth.`;

/**
 * Generate user prompt for macro analysis
 */
export function generateMacroAnalysisPrompt(input: MacroDataInput): string {
  const { economicEvents, instrument, analysisDate, userContext } = input;
  
  // Sort events by impact (high first) and time
  const sortedEvents = [...economicEvents].sort((a, b) => {
    const impactWeight = { high: 3, medium: 2, low: 1 };
    const impactDiff = impactWeight[b.impact] - impactWeight[a.impact];
    if (impactDiff !== 0) return impactDiff;
    return new Date(a.time).getTime() - new Date(b.time).getTime();
  });
  
  // Format events for prompt
  const eventsText = sortedEvents.map(event => {
    const actualText = event.actual !== undefined ? `Actual: ${event.actual}` : '';
    const forecastText = event.forecast !== undefined ? `Forecast: ${event.forecast}` : '';
    const previousText = event.previous !== undefined ? `Previous: ${event.previous}` : '';
    
    const dataPoints = [actualText, forecastText, previousText].filter(Boolean).join(', ');
    
    return `- ${event.title} (${event.country}, ${event.impact.toUpperCase()} impact)
  Time: ${new Date(event.time).toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC
  Category: ${event.category}
  ${dataPoints || 'No data available yet'}`;
  }).join('\n\n');
  
  const prompt = `Analyze the macroeconomic context for trading ${instrument} on ${analysisDate}.

INSTRUMENT: ${instrument}
ANALYSIS DATE: ${analysisDate}

ECONOMIC EVENTS (Next 24-48 hours):
${eventsText || 'No major economic events scheduled'}

${userContext ? `\nADDITIONAL CONTEXT:\n${userContext}\n` : ''}

INSTRUCTIONS:
1. Analyze how these economic events will impact ${instrument}
2. Consider the instrument's specific sensitivities (see system prompt)
3. Assess each macroeconomic indicator category
4. Determine overall macro bias (bullish/bearish/neutral)
5. Identify key drivers and risks
6. Provide confidence level based on data quality and clarity

REQUIRED OUTPUT FORMAT (JSON):
{
  "bias": "bullish" | "bearish" | "neutral",
  "confidence": <number 0-100>,
  "keyDrivers": ["driver1", "driver2", ...],
  "indicators": {
    "gdp": "positive" | "negative" | "neutral" | "unknown",
    "inflation": "rising" | "falling" | "stable" | "unknown",
    "interestRates": "hawkish" | "dovish" | "neutral" | "unknown",
    "employment": "strong" | "weak" | "stable" | "unknown",
    "centralBankPolicy": "tightening" | "easing" | "neutral" | "unknown"
  },
  "risks": ["risk1", "risk2", ...],
  "summary": "<2-3 sentence summary>",
  "detailedAnalysis": "<4-6 sentence detailed analysis>"
}

Respond ONLY with valid JSON. No additional text.`;
  
  return prompt;
}

/**
 * Example usage and test cases
 */
export const MACRO_PROMPT_EXAMPLES = {
  // Example 1: High-impact NFP data
  example1: {
    input: {
      economicEvents: [
        {
          title: 'Non-Farm Payrolls',
          country: 'USD',
          impact: 'high' as const,
          forecast: '180K',
          previous: '150K',
          actual: '220K',
          time: '2026-01-17T13:30:00Z',
          category: 'Employment'
        },
        {
          title: 'Unemployment Rate',
          country: 'USD',
          impact: 'high' as const,
          forecast: '4.0%',
          previous: '4.1%',
          actual: '3.9%',
          time: '2026-01-17T13:30:00Z',
          category: 'Employment'
        }
      ],
      instrument: 'NQ1',
      analysisDate: '2026-01-17'
    },
    expectedBias: 'bearish', // Strong jobs = hawkish Fed = pressure on tech
    rationale: 'Strong employment data suggests Fed may keep rates higher for longer, pressuring tech stocks'
  },
  
  // Example 2: Dovish Fed pivot
  example2: {
    input: {
      economicEvents: [
        {
          title: 'FOMC Meeting Statement',
          country: 'USD',
          impact: 'high' as const,
          time: '2026-01-17T19:00:00Z',
          category: 'Central Bank',
          actual: 'Dovish pivot - considering rate cuts'
        },
        {
          title: 'CPI (Consumer Price Index)',
          country: 'USD',
          impact: 'high' as const,
          forecast: '2.5%',
          previous: '3.0%',
          actual: '2.3%',
          time: '2026-01-15T13:30:00Z',
          category: 'Inflation'
        }
      ],
      instrument: 'NQ1',
      analysisDate: '2026-01-17'
    },
    expectedBias: 'bullish', // Dovish Fed + falling inflation = bullish for tech
    rationale: 'Falling inflation + dovish Fed pivot supports risk assets, especially rate-sensitive tech'
  },
  
  // Example 3: Mixed signals
  example3: {
    input: {
      economicEvents: [
        {
          title: 'GDP Growth Rate',
          country: 'USD',
          impact: 'high' as const,
          forecast: '2.0%',
          previous: '2.5%',
          actual: '1.5%',
          time: '2026-01-17T13:30:00Z',
          category: 'GDP'
        },
        {
          title: 'Retail Sales',
          country: 'USD',
          impact: 'medium' as const,
          forecast: '0.3%',
          previous: '0.5%',
          actual: '0.8%',
          time: '2026-01-16T13:30:00Z',
          category: 'GDP'
        }
      ],
      instrument: 'ES1',
      analysisDate: '2026-01-17'
    },
    expectedBias: 'neutral', // Mixed signals: weak GDP but strong retail
    rationale: 'Conflicting signals (weak GDP but strong retail) create uncertainty'
  },
  
  // Example 4: Gold with inflation concerns
  example4: {
    input: {
      economicEvents: [
        {
          title: 'CPI (Consumer Price Index)',
          country: 'USD',
          impact: 'high' as const,
          forecast: '3.0%',
          previous: '2.5%',
          actual: '3.5%',
          time: '2026-01-17T13:30:00Z',
          category: 'Inflation'
        },
        {
          title: 'PPI (Producer Price Index)',
          country: 'USD',
          impact: 'medium' as const,
          forecast: '2.0%',
          previous: '1.8%',
          actual: '2.5%',
          time: '2026-01-16T13:30:00Z',
          category: 'Inflation'
        }
      ],
      instrument: 'XAU/USD',
      analysisDate: '2026-01-17'
    },
    expectedBias: 'bullish', // Rising inflation = bullish for gold
    rationale: 'Rising inflation supports gold as inflation hedge'
  }
};

/**
 * Validation schema for macro analysis output
 */
export function validateMacroAnalysisOutput(output: unknown): output is MacroAnalysisOutput {
  if (typeof output !== 'object' || output === null) return false;
  
  const o = output as any;
  
  // Check required fields
  if (!['bullish', 'bearish', 'neutral'].includes(o.bias)) return false;
  if (typeof o.confidence !== 'number' || o.confidence < 0 || o.confidence > 100) return false;
  if (!Array.isArray(o.keyDrivers)) return false; // Allow empty array when no events
  if (!Array.isArray(o.risks)) return false;
  if (typeof o.summary !== 'string' || o.summary.length === 0) return false;
  // Allow missing detailedAnalysis when no events
  if (o.detailedAnalysis !== undefined && typeof o.detailedAnalysis !== 'string') return false;
  
  // Check indicators object
  if (typeof o.indicators !== 'object' || o.indicators === null) return false;
  
  const validIndicatorValues = ['positive', 'negative', 'neutral', 'unknown', 'rising', 'falling', 'stable', 'hawkish', 'dovish', 'strong', 'weak', 'tightening', 'easing'];
  
  if (!validIndicatorValues.includes(o.indicators.gdp)) return false;
  if (!validIndicatorValues.includes(o.indicators.inflation)) return false;
  if (!validIndicatorValues.includes(o.indicators.interestRates)) return false;
  if (!validIndicatorValues.includes(o.indicators.employment)) return false;
  if (!validIndicatorValues.includes(o.indicators.centralBankPolicy)) return false;
  
  return true;
}

/**
 * Parse AI response and validate output
 */
export function parseMacroAnalysisResponse(response: string): MacroAnalysisOutput {
  try {
    // Try to extract JSON from response (in case AI adds extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    if (!validateMacroAnalysisOutput(parsed)) {
      throw new Error('Invalid macro analysis output schema');
    }
    
    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse macro analysis response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
