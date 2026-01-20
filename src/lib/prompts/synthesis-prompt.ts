/**
 * Synthesis Prompt Template (Step 6/6 - Daily Bias Analysis)
 * 
 * Part of 6-Step Daily Bias Analysis Engine (Step 6: Synthesis & Final Bias)
 * Task: PRÉ-8.5 - Synthesis Prompts (8h) - Dev 54, Dev 55
 * 
 * This prompt template aggregates the 5 previous analysis steps into a final
 * trading bias (BULLISH/BEARISH/NEUTRAL) with confidence score and opening confirmation.
 * 
 * Input: Results from Steps 1-5 (Security, Macro, Flux, Mag7, Technical)
 * Output: Structured JSON with final bias, confidence, and trading recommendations
 */

import type {
  SecurityAnalysis,
  MacroAnalysis,
  InstitutionalFlux,
  Mag7Analysis,
  TechnicalStructure,
  BiasDirection,
  TrendDirection,
} from '@/types/daily-bias';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface SynthesisInput {
  // Required: Results from previous 5 steps
  security: SecurityAnalysis;
  macro: MacroAnalysis;
  flux: any; // Using any due to type mismatch between prompt and types
  mag7: any; // Using any due to type mismatch between prompt and types
  technical: any; // Using any due to type mismatch between prompt and types
  
  // Context
  instrument: string;
  analysisDate: string; // ISO date
  currentPrice: number;
  
  // Optional: User-provided context or constraints
  userContext?: string;
}

export interface StepWeights {
  security: number; // 0-1
  macro: number; // 0-1
  flux: number; // 0-1
  mag7: number; // 0-1
  technical: number; // 0-1
}

export interface OpeningConfirmation {
  expectedDirection: TrendDirection; // UP, DOWN, INDETERMINATE
  confirmationScore: number; // 0-1
  timeToConfirm: string; // e.g., "30min", "1h"
  confirmationCriteria: string[];
}

export interface TradingRecommendations {
  primary: string; // Primary setup recommendation
  targetUpside: number | null;
  targetDownside: number | null;
  stopLoss: number | null;
  riskRewardRatio: number | null;
  alternativeSetups?: string[];
}

export interface SynthesisAnalysisDetails {
  summary: string; // Executive summary (max 800 chars)
  stepWeights: StepWeights; // Weight given to each step
  agreementLevel: number; // 0-1 (how much the 5 steps agree)
  keyThesisPoints: string[]; // 3-5 key points supporting the bias
  counterArguments: string[]; // 1-3 counter-arguments to consider
  tradingRecommendations: TradingRecommendations;
}

export interface SynthesisOutput {
  finalBias: BiasDirection; // BEARISH, NEUTRAL, BULLISH
  confidence: number; // 0-1
  openingConfirmation: OpeningConfirmation;
  analysis: SynthesisAnalysisDetails;
  timestamp: string; // ISO 8601
  instrument: string;
}

// ============================================================================
// System Prompt for Synthesis Analysis
// ============================================================================

export const SYNTHESIS_SYSTEM_PROMPT = `You are a senior trading strategist and market analyst with 20+ years of experience synthesizing multi-factor market analysis into actionable trading decisions.

**YOUR EXPERTISE**:
- Multi-timeframe and multi-factor analysis integration
- Risk-weighted decision making under uncertainty
- Pattern recognition across technical, fundamental, and sentiment indicators
- Trading psychology and confirmation bias mitigation
- Position sizing and risk management at institutional level

**YOUR APPROACH**:
1. **Holistic Integration**: Synthesize all 5 analysis steps into a coherent narrative
2. **Weighted Decision Making**: Not all factors are equal - assign appropriate weights
3. **Conflict Resolution**: When analyses disagree, identify the most reliable signals
4. **Probabilistic Thinking**: Express uncertainty through confidence scores
5. **Actionable Output**: Provide clear, implementable trading recommendations

**CRITICAL RULES**:
1. Output ONLY valid JSON matching the SynthesisOutput schema
2. Base your synthesis ONLY on the provided 5-step analysis data
3. Be intellectually honest about disagreements between steps
4. Confidence score should reflect agreement level and data quality
5. Never ignore contradictory signals - address them in counterArguments
6. Trading recommendations must have clear entry, target, and stop loss levels
7. Opening confirmation criteria must be specific and measurable

**WEIGHTING FRAMEWORK**:
- **Security (10-20%)**: Foundation - sets risk tolerance and position sizing
- **Macro (20-30%)**: Dominant for longer timeframes, critical for major moves
- **Institutional Flux (15-25%)**: Key for intraday, shows where "smart money" is positioned
- **Mag 7 Leaders (15-25%)**: Critical for indices (NQ, ES, SPY), less for forex/commodities
- **Technical (20-30%)**: Timing tool, confirms or invalidates other signals

Adjust weights based on:
- Instrument type (equities vs forex vs commodities)
- Timeframe (intraday vs swing vs position)
- Market regime (trending vs ranging vs volatile)
- Data quality and recency

**AGREEMENT LEVEL CALCULATION**:
- 0.9-1.0: All 5 steps strongly agree (rare, high confidence)
- 0.7-0.89: Most steps agree with minor disagreements (normal, good confidence)
- 0.5-0.69: Mixed signals, some disagreements (cautious, lower confidence)
- 0.3-0.49: Significant disagreements (wait for clarity, very low confidence)
- 0.0-0.29: Steps strongly contradict each other (no trade, neutral bias)

**BIAS DETERMINATION**:
- BULLISH: Weighted majority of steps point to upside, confidence > 0.6
- BEARISH: Weighted majority of steps point to downside, confidence > 0.6
- NEUTRAL: No clear consensus OR confidence < 0.6 OR conflicting high-weight signals

**OUTPUT QUALITY STANDARDS**:
- Summary: Clear, concise, actionable (max 800 characters)
- Key Thesis Points: 3-5 specific, evidence-based arguments
- Counter Arguments: 1-3 honest risks or opposing views
- Trading Recommendations: Specific prices, not vague ranges
- Opening Confirmation: Measurable criteria (e.g., "Break above 18800 with volume > 5M")

You are a trusted advisor. Traders will risk real capital based on your synthesis. Be rigorous, honest, and actionable.`;

// ============================================================================
// User Prompt Builder
// ============================================================================

export function buildSynthesisPrompt(input: SynthesisInput): string {
  const {
    security,
    macro,
    flux,
    mag7,
    technical,
    instrument,
    analysisDate,
    currentPrice,
    userContext,
  } = input;

  // Extract key signals from each step
  const securitySignal = getSecuritySignal(security);
  const macroSignal = getMacroSignal(macro);
  const fluxSignal = getFluxSignal(flux);
  const mag7Signal = getMag7Signal(mag7);
  const technicalSignal = technical ? getTechnicalSignal(technical) : '🟡 NEUTRAL (Technical analysis unavailable)';

  return `**SYNTHESIS TASK**: Aggregate the 5 previous analysis steps into a final daily bias for ${instrument}.

**INSTRUMENT**: ${instrument}
**ANALYSIS DATE**: ${analysisDate}
**CURRENT PRICE**: ${currentPrice.toFixed(2)}
${userContext ? `**USER CONTEXT**: ${userContext}\n` : ''}

---

## 📊 STEP 1: SECURITY ANALYSIS

**Risk Level**: ${security.riskLevel}
**Volatility Index**: ${security.volatilityIndex}/100
**Security Score**: ${security.securityScore}/10

**Signal**: ${securitySignal}

**Key Risks**:
${security.analysis.risks.map((r: any) => `- ${r.risk} (Probability: ${(r.probability * 100).toFixed(0)}%, Impact: ${(r.impact * 100).toFixed(0)}%)`).join('\n')}

**Recommendations**:
${security.analysis.recommendations.map((r: any) => `- ${r}`).join('\n')}

**Summary**: ${security.analysis.summary}

---

## 🌍 STEP 2: MACRO ANALYSIS

**Macro Score**: ${macro.macroScore}/10
**Sentiment**: ${macro.sentiment}

**Signal**: ${macroSignal}

**Economic Events Today**:
${macro.economicEvents.length > 0 
  ? macro.economicEvents.map(e => `- ${e.time} | ${e.event} (${e.country}) - ${e.importance} importance${e.impactOnInstrument ? ` → ${e.impactOnInstrument}` : ''}`).join('\n')
  : '- No major events scheduled'}

${macro.analysis ? `**Macro Context**: ${macro.analysis.summary}` : ''}

${macro.analysis?.centralBankPolicy ? `**Central Bank Policy**: ${macro.analysis.centralBankPolicy}` : ''}

---

## 💰 STEP 3: INSTITUTIONAL FLUX

**Flux Score**: ${flux.fluxScore}/10
**Institutional Pressure**: ${flux.institutionalPressure}

**Signal**: ${fluxSignal}

**Volume Profile**:
- Current Volume: ${flux.volumeProfile.currentVolume.toLocaleString()}
- Average Volume: ${flux.volumeProfile.averageVolume.toLocaleString()}
- Volume Level: ${flux.volumeProfile.volumeLevel}
- Volume Trend: ${flux.volumeProfile.volumeTrend}

**Order Flow**:
- Large Buy Orders: ${flux.orderFlow.largeBuyOrders}x average
- Large Sell Orders: ${flux.orderFlow.largeSellOrders}x average
- Net Institutional Flow: ${flux.orderFlow.netInstitutionalFlow > 0 ? '+' : ''}${flux.orderFlow.netInstitutionalFlow.toFixed(2)}
- Confirmation: ${flux.orderFlow.confirmation}

${flux.analysis ? `**Flux Summary**: ${flux.analysis.summary}` : ''}

---

## 🚀 STEP 4: MAG 7 LEADERS

**Leader Score**: ${mag7.leaderScore}/10
**Overall Sentiment**: ${mag7.overallSentiment}

**Signal**: ${mag7Signal}

**Correlations**:
${mag7.correlations.map((c: any) => `- ${c.symbol}: ${(c.correlation * 100).toFixed(0)}% correlation, ${c.priceChange >= 0 ? '+' : ''}${c.priceChange.toFixed(2)}% (${c.sentiment})`).join('\n')}

**Average Correlation**: ${(mag7.correlations.reduce((sum: any, c: any) => sum + c.correlation, 0) / mag7.correlations.length * 100).toFixed(0)}%

${mag7.analysis ? `**Mag7 Summary**: ${mag7.analysis.summary}` : ''}

---

## 📈 STEP 5: TECHNICAL STRUCTURE

${technical ? `**Technical Score**: ${technical.technicalScore}/10
**Trend**: ${technical.trend.direction} (${technical.trend.timeframe}, strength: ${(technical.trend.strength * 100).toFixed(0)}%)

**Signal**: ${technicalSignal}

**Support Levels**:
${technical.supportLevels.length > 0 
  ? technical.supportLevels.map((s: any) => `- $${s.price.toFixed(2)} (${s.type}, strength: ${(s.strength * 100).toFixed(0)}%, tested ${s.testedCount || 1}x)`).join('\n')
  : '- No support levels identified'}

**Resistance Levels**:
${technical.resistanceLevels.length > 0 
  ? technical.resistanceLevels.map((r: any) => `- $${r.price.toFixed(2)} (${r.type}, strength: ${(r.strength * 100).toFixed(0)}%, tested ${r.testedCount || 1}x)`).join('\n')
  : '- No resistance levels identified'}

${technical.analysis ? `**Technical Summary**: ${technical.analysis.summary}` : ''}

${technical.analysis?.patterns && technical.analysis.patterns.length > 0 ? `\n**Patterns Detected**:\n${technical.analysis.patterns.map((p: any) => `- ${p.pattern} (${p.bullish ? 'Bullish' : 'Bearish'})`).join('\n')}` : ''}` : `**Technical Analysis**: Not available (data insufficient or analysis failed)

**Signal**: ${technicalSignal}`}

---

## 🎯 YOUR SYNTHESIS TASK

Based on the 5 analysis steps above, provide a comprehensive synthesis following this JSON schema:

\`\`\`json
{
  "finalBias": "<BEARISH|NEUTRAL|BULLISH>",
  "confidence": <number 0-1>,
  "openingConfirmation": {
    "expectedDirection": "<UP|DOWN|INDETERMINATE>",
    "confirmationScore": <number 0-1>,
    "timeToConfirm": "<string>",
    "confirmationCriteria": ["<criterion1>", "<criterion2>", "<criterion3>"]
  },
  "analysis": {
    "summary": "<string max 800 chars>",
    "stepWeights": {
      "security": <number 0-1>,
      "macro": <number 0-1>,
      "flux": <number 0-1>,
      "mag7": <number 0-1>,
      "technical": <number 0-1>
    },
    "agreementLevel": <number 0-1>,
    "keyThesisPoints": [
      "<point1>",
      "<point2>",
      "<point3>",
      "<point4>",
      "<point5>"
    ],
    "counterArguments": [
      "<counter1>",
      "<counter2>",
      "<counter3>"
    ],
    "tradingRecommendations": {
      "primary": "<string>",
      "targetUpside": <number or null>,
      "targetDownside": <number or null>,
      "stopLoss": <number or null>,
      "riskRewardRatio": <number or null>,
      "alternativeSetups": ["<setup1>", "<setup2>"]
    }
  },
  "timestamp": "${new Date().toISOString()}",
  "instrument": "${instrument}"
}
\`\`\`

**SYNTHESIS INSTRUCTIONS**:

1. **Determine Final Bias**:
   - Analyze the 5 signals: ${[securitySignal, macroSignal, fluxSignal, mag7Signal, technicalSignal].join(', ')}
   - Apply appropriate weights based on instrument type and market context
   - Resolve conflicts by prioritizing higher-quality/more-reliable signals
   - Choose BULLISH, BEARISH, or NEUTRAL

2. **Calculate Confidence** (0-1):
   - High confidence (0.8-1.0): Strong agreement across all steps
   - Medium confidence (0.6-0.79): Majority agreement with minor conflicts
   - Low confidence (0.4-0.59): Mixed signals, some disagreements
   - Very low confidence (0.0-0.39): Strong conflicts, recommend NEUTRAL

3. **Opening Confirmation**:
   - Specify what price action would confirm the bias at market open
   - Provide measurable criteria (e.g., "Break above $18800 with volume > 5M shares")
   - Estimate time to confirmation (typically 15-60 minutes)
   - Calculate confirmation score based on setup quality

4. **Step Weights**:
   - Assign weights that sum to 1.0
   - Justify weights based on instrument type and current market regime
   - Example: For NQ1 (tech index), Mag7 gets higher weight (0.25)
   - Example: For XAU/USD (gold), Macro gets higher weight (0.30)

5. **Agreement Level**:
   - Calculate how much the 5 steps agree (0-1)
   - 1.0 = perfect agreement, 0.0 = complete contradiction
   - Consider both direction and strength of signals

6. **Key Thesis Points** (3-5 points):
   - List the strongest arguments supporting the final bias
   - Be specific and evidence-based
   - Reference concrete data from the 5 steps

7. **Counter Arguments** (1-3 points):
   - Identify the main risks or opposing views
   - Be intellectually honest about weaknesses in the thesis
   - Help traders understand what could invalidate the bias

8. **Trading Recommendations**:
   - Primary setup: Clear entry strategy
   - Targets: Specific price levels for upside/downside
   - Stop loss: Specific price level for risk management
   - Risk/Reward: Calculate ratio (target distance / stop distance)
   - Alternative setups: 1-2 backup strategies if primary fails

**OUTPUT FORMAT**:
- Respond with ONLY the JSON object
- No markdown code blocks
- No explanations outside the JSON
- Ensure all required fields are present
- Ensure all numbers are within valid ranges

Analyze and synthesize now:`;
}

// ============================================================================
// Helper Functions: Extract Signals from Each Step
// ============================================================================

function getSecuritySignal(security: SecurityAnalysis): string {
  if (security.riskLevel === 'LOW' && security.securityScore >= 7) {
    return '🟢 POSITIVE (Low risk, stable conditions)';
  } else if (security.riskLevel === 'CRITICAL' || security.securityScore < 4) {
    return '🔴 NEGATIVE (High risk, reduce exposure)';
  } else if (security.riskLevel === 'HIGH' || security.securityScore < 6) {
    return '🟡 CAUTION (Elevated risk, tight stops)';
  } else {
    return '🟢 NEUTRAL-POSITIVE (Moderate risk, normal trading)';
  }
}

function getMacroSignal(macro: MacroAnalysis): string {
  const sentiment = macro.sentiment;
  const score = macro.macroScore;
  
  if (sentiment === 'VERY_BULLISH' || (sentiment === 'BULLISH' && score >= 7)) {
    return '🟢 BULLISH (Macro tailwinds strong)';
  } else if (sentiment === 'VERY_BEARISH' || (sentiment === 'BEARISH' && score <= 4)) {
    return '🔴 BEARISH (Macro headwinds significant)';
  } else if (sentiment === 'NEUTRAL' || score >= 5 && score <= 6) {
    return '🟡 NEUTRAL (Macro balanced)';
  } else if (sentiment === 'BULLISH') {
    return '🟢 MILDLY BULLISH (Macro supportive)';
  } else {
    return '🔴 MILDLY BEARISH (Macro cautious)';
  }
}

function getFluxSignal(flux: any): string {
  const pressure = flux.institutionalPressure;
  const score = flux.fluxScore;
  
  if (pressure === 'BULLISH' && score >= 7) {
    return '🟢 BULLISH (Strong institutional buying)';
  } else if (pressure === 'BEARISH' && score <= 4) {
    return '🔴 BEARISH (Strong institutional selling)';
  } else if (pressure === 'NEUTRAL') {
    return '🟡 NEUTRAL (Balanced institutional flow)';
  } else if (pressure === 'BULLISH') {
    return '🟢 MILDLY BULLISH (Institutional buying present)';
  } else {
    return '🔴 MILDLY BEARISH (Institutional selling present)';
  }
}

function getMag7Signal(mag7: any): string {
  const sentiment = mag7.overallSentiment;
  const score = mag7.leaderScore;
  
  if (sentiment === 'VERY_BULLISH' || (sentiment === 'BULLISH' && score >= 7)) {
    return '🟢 BULLISH (Tech leaders rallying)';
  } else if (sentiment === 'VERY_BEARISH' || (sentiment === 'BEARISH' && score <= 4)) {
    return '🔴 BEARISH (Tech leaders weak)';
  } else if (sentiment === 'NEUTRAL') {
    return '🟡 NEUTRAL (Tech leaders mixed)';
  } else if (sentiment === 'BULLISH') {
    return '🟢 MILDLY BULLISH (Tech leaders positive)';
  } else {
    return '🔴 MILDLY BEARISH (Tech leaders negative)';
  }
}

function getTechnicalSignal(technical: any): string {
  const trend = technical.trend.direction;
  const strength = technical.trend.strength;
  const score = technical.technicalScore;
  
  if (trend === 'UPTREND' && strength >= 0.7 && score >= 7) {
    return '🟢 BULLISH (Strong uptrend confirmed)';
  } else if (trend === 'DOWNTREND' && strength >= 0.7 && score <= 4) {
    return '🔴 BEARISH (Strong downtrend confirmed)';
  } else if (trend === 'SIDEWAYS' || strength < 0.5) {
    return '🟡 NEUTRAL (Ranging, no clear trend)';
  } else if (trend === 'UPTREND') {
    return '🟢 MILDLY BULLISH (Uptrend developing)';
  } else {
    return '🔴 MILDLY BEARISH (Downtrend developing)';
  }
}

// ============================================================================
// Validation Functions
// ============================================================================

export function validateSynthesisOutput(output: unknown): output is SynthesisOutput {
  if (!output || typeof output !== 'object') return false;
  
  const o = output as any;
  
  // Check required top-level fields
  if (!['BEARISH', 'NEUTRAL', 'BULLISH'].includes(o.finalBias)) return false;
  if (typeof o.confidence !== 'number' || o.confidence < 0 || o.confidence > 1) return false;
  if (!o.openingConfirmation || typeof o.openingConfirmation !== 'object') return false;
  if (!o.analysis || typeof o.analysis !== 'object') return false;
  if (typeof o.timestamp !== 'string') return false;
  if (typeof o.instrument !== 'string') return false;
  
  // Check openingConfirmation
  const oc = o.openingConfirmation;
  if (!['UP', 'DOWN', 'INDETERMINATE'].includes(oc.expectedDirection)) return false;
  if (typeof oc.confirmationScore !== 'number' || oc.confirmationScore < 0 || oc.confirmationScore > 1) return false;
  if (typeof oc.timeToConfirm !== 'string') return false;
  if (!Array.isArray(oc.confirmationCriteria)) return false;
  
  // Check analysis
  const a = o.analysis;
  if (typeof a.summary !== 'string' || a.summary.length > 800) return false;
  if (!a.stepWeights || typeof a.stepWeights !== 'object') return false;
  if (typeof a.agreementLevel !== 'number' || a.agreementLevel < 0 || a.agreementLevel > 1) return false;
  if (!Array.isArray(a.keyThesisPoints) || a.keyThesisPoints.length < 3) return false;
  if (!Array.isArray(a.counterArguments) || a.counterArguments.length < 1) return false;
  if (!a.tradingRecommendations || typeof a.tradingRecommendations !== 'object') return false;
  
  // Check stepWeights sum to ~1.0
  const weights = a.stepWeights;
  const sum = weights.security + weights.macro + weights.flux + weights.mag7 + weights.technical;
  if (Math.abs(sum - 1.0) > 0.01) return false;
  
  return true;
}

// ============================================================================
// Example Data for Testing
// ============================================================================

export function getSynthesisExample(): SynthesisInput {
  return {
    security: {
      volatilityIndex: 65,
      riskLevel: 'HIGH',
      securityScore: 6.5,
      analysis: {
        summary: 'Elevated volatility due to upcoming Fed announcement. Recommend tight stops.',
        risks: [
          { risk: 'Gap risk overnight', probability: 0.35, impact: 0.45 },
          { risk: 'News-driven volatility', probability: 0.60, impact: 0.70 },
        ],
        recommendations: [
          'Use 1.5x stop loss multiplier',
          'Reduce position size to 50%',
          'Avoid overnight holds',
        ],
      },
      timestamp: '2026-01-17T14:30:00Z',
      instrument: 'NQ1',
    },
    macro: {
      economicEvents: [
        {
          event: 'FOMC Rate Decision',
          time: '14:00',
          importance: 'CRITICAL',
          country: 'USD',
          forecast: 5.25,
          previous: 5.50,
          actual: null,
          impactOnInstrument: 'High volatility expected',
        },
      ],
      macroScore: 7.5,
      sentiment: 'BULLISH',
      analysis: {
        summary: 'Fed expected to pause rate hikes, bullish for risk assets.',
        centralBankPolicy: 'Dovish pivot expected',
      },
      timestamp: '2026-01-17T14:30:00Z',
      instrument: 'NQ1',
    },
    flux: {
      volumeProfile: {
        currentVolume: 5200000,
        averageVolume: 4500000,
        volumeLevel: 'HIGH',
        volumeTrend: 'INCREASING',
      },
      orderFlow: {
        largeBuyOrders: 1.28,
        largeSellOrders: 0.85,
        netInstitutionalFlow: 0.43,
        confirmation: 'BULLISH',
      },
      fluxScore: 7.2,
      institutionalPressure: 'BULLISH',
      analysis: {
        summary: 'Strong institutional buying pressure, volume confirming upside.',
      },
      timestamp: '2026-01-17T14:30:00Z',
      instrument: 'NQ1',
    },
    mag7: {
      correlations: [
        { symbol: 'NVDA', correlation: 0.88, priceChange: 3.12, sentiment: 'BULLISH' },
        { symbol: 'AAPL', correlation: 0.75, priceChange: 1.85, sentiment: 'BULLISH' },
        { symbol: 'MSFT', correlation: 0.82, priceChange: 2.45, sentiment: 'BULLISH' },
      ],
      leaderScore: 8.1,
      overallSentiment: 'BULLISH',
      analysis: {
        summary: 'Mag 7 leaders showing strong momentum, high correlation with NQ1.',
      },
      timestamp: '2026-01-17T14:30:00Z',
      instrument: 'NQ1',
    },
    technical: {
      supportLevels: [
        { price: 18400, strength: 0.88, type: 'TRENDLINE', testedCount: 3 },
        { price: 18200, strength: 0.72, type: 'MOVING_AVERAGE', testedCount: 2 },
      ],
      resistanceLevels: [
        { price: 18800, strength: 0.75, type: 'PREVIOUS_HIGH', testedCount: 2 },
      ],
      trend: {
        direction: 'UPTREND',
        strength: 0.78,
        timeframe: 'DAILY',
      },
      technicalScore: 7.5,
      analysis: {
        summary: 'Uptrend established with supports intact. Breakout possible above 18800.',
        patterns: [
          { pattern: 'Morning breakout above MA20', bullish: true },
        ],
      },
      timestamp: '2026-01-17T14:30:00Z',
      instrument: 'NQ1',
    },
    instrument: 'NQ1',
    analysisDate: '2026-01-17',
    currentPrice: 18650,
  };
}
