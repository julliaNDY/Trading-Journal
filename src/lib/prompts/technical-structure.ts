/**
 * Technical Structure Analysis Prompt Template
 * 
 * Part of 6-Step Daily Bias Analysis Engine (Step 5: Technical Structure)
 * Task: PRÉ-8.4 - Technical Structure Prompts (8h) - Dev 52, Dev 53
 * 
 * This prompt template analyzes technical indicators to identify support/resistance levels,
 * trend direction, and overall technical structure to determine market bias.
 * 
 * Data Sources:
 * - TradingView API or Barchart API (price bars, indicators)
 * - Manual injection (fallback)
 * - User-provided technical context
 * 
 * Output: Structured JSON analysis with technical structure assessment
 */

export interface TechnicalDataInput {
  // Historical price data (OHLCV)
  priceData: PriceBar[];
  
  // Technical indicators (optional but recommended)
  indicators?: TechnicalIndicators;
  
  // Current Market Context
  instrument: string; // e.g., "NQ1", "ES1", "TSLA", "EUR/USD", "XAU/USD"
  timeframe: 'daily' | '4h' | '1h' | '15m'; // Primary analysis timeframe
  analysisDate: string; // ISO date
  
  // Optional: User-provided technical context
  userContext?: string;
}

export interface PriceBar {
  timestamp: string; // ISO datetime
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  // Moving Averages
  sma20?: number;
  sma50?: number;
  sma200?: number;
  ema12?: number;
  ema26?: number;
  
  // Momentum indicators
  rsi?: number; // 0-100
  macd?: {
    line: number;
    signal: number;
    histogram: number;
  };
  stochastic?: {
    k: number; // 0-100
    d: number; // 0-100
  };
  
  // Volatility indicators
  atr?: number; // Average True Range
  bbands?: {
    upper: number;
    middle: number;
    lower: number;
    percentB: number; // 0-100, position within bands
  };
  
  // Volume indicators
  obv?: number; // On-Balance Volume
  volumeProfile?: {
    poc: number; // Point of Control
    vah: number; // Value Area High
    val: number; // Value Area Low
  };
  
  // Custom fields
  [key: string]: any;
}

export interface SupportResistanceLevel {
  level: number;
  type: 'support' | 'resistance';
  strength: 'strong' | 'moderate' | 'weak'; // How many times tested
  source: string; // e.g., "previous_high", "200sma", "poc"
}

export interface TrendAnalysis {
  direction: 'uptrend' | 'downtrend' | 'sideways';
  strength: 'strong' | 'moderate' | 'weak';
  trendlineStart: number; // Price level at trend start
  trendlineEnd: number; // Current price level
  barsInTrend: number; // Number of bars in current trend
}

export interface KeyDriver {
  indicator: string;
  value: string;
  signal: 'bullish' | 'bearish' | 'neutral';
  weight: 'high' | 'medium' | 'low';
}

export interface TechnicalStructureOutput {
  // Overall technical bias
  bias: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-100
  
  // Support and Resistance levels
  supportLevels: SupportResistanceLevel[];
  resistanceLevels: SupportResistanceLevel[];
  
  // Trend analysis
  trend: TrendAnalysis;
  
  // Technical indicators assessment
  technicalScore: {
    // 0-10 scores for each component
    trend: number;
    momentum: number;
    volatility: number;
    volume: number;
    structure: number;
    overall: number; // Average of above
  };
  
  // Key technical signals
  keySignals: string[];
  
  // KEY DRIVERS - Transparency requirement (REQUIRED)
  // Explicitly cites which indicators drove the bias determination
  keyDrivers: KeyDriver[];
  
  // Risks/confirmations needed
  risks: string[];
  confirmations: string[]; // What would confirm this view
  
  // Summary (MUST include drivers in format: "Bias (Drivers: X, Y, Z)")
  summary: string;
  
  // Detailed technical analysis
  detailedAnalysis: string;
  
  // Citations (anti-hallucination)
  citations?: string[];
}

/**
 * System prompt for technical structure analysis
 */
export const TECHNICAL_STRUCTURE_SYSTEM_PROMPT = `You are an expert technical analyst specializing in chart pattern recognition, support/resistance identification, and trend analysis.

Your role is to analyze price action and technical indicators to identify:
- Key support and resistance levels
- Trend direction and strength
- Market structure and breakout levels
- Technical signals and setups

CRITICAL RULES:
1. ALWAYS respond with valid JSON matching the TechnicalStructureOutput schema
2. Base your analysis ONLY on the provided price and indicator data
3. Consider timeframe context (daily vs intraday behaves differently)
4. Be objective and data-driven - avoid speculation
5. Focus on multiple timeframe confluence (if data provided)
6. Identify the 2-3 most important S/R levels (not too many)

ANALYSIS FRAMEWORK:

1. **Support & Resistance (S/R)**
   - Identify key levels based on:
     * Previous swing highs/lows (swing traders watch these)
     * Moving average alignment (price gravities to MAs)
     * Previous day's high/low (institutional levels)
     * Round numbers (psychological levels)
     * Volume Profile POC (where volume concentrated)
   - Classify strength:
     * Strong: Tested 3+ times, holds well
     * Moderate: Tested 1-2 times, respected
     * Weak: Tested once or less, may break through
   - Prioritize quality over quantity (2-4 levels is better than 10)

2. **Trend Analysis**
   - Identify primary trend using higher timeframe context
   - Uptrend: Higher Lows + Higher Highs
   - Downtrend: Lower Highs + Lower Lows
   - Sideways: Price oscillating between support and resistance
   - Assess strength:
     * Strong: Steep angle, few pullbacks
     * Moderate: Clear direction, normal pullbacks
     * Weak: Shallow angle, breaking structure

3. **Technical Indicators Scoring (0-10)**
   - **Trend Score**: Does price trend align with MAs? Are shorter MAs above longer MAs?
     * 10: Price above all key MAs in proper order
     * 5: Mixed MA alignment
     * 0: Price below all MAs
   - **Momentum Score**: Are momentum indicators (RSI, MACD) aligned with price direction?
     * 10: Strong momentum confirmation
     * 5: Neutral/divergence signals
     * 0: Strong momentum divergence
   - **Volatility Score**: Is volatility stable or elevated?
     * 10: Breakout-level volatility (ATR elevated)
     * 5: Normal volatility
     * 0: Extreme compression (likely breakout coming)
   - **Volume Score**: Is volume confirming price moves?
     * 10: Strong volume on trend moves
     * 5: Average volume
     * 0: Declining volume on moves (weakness)
   - **Structure Score**: Is price in clean, identifiable structure?
     * 10: Clear support/resistance, well-defined patterns
     * 5: Mixed structure, some clarity
     * 0: Chaotic, no clear structure

4. **Key Technical Signals**
   - Double tops/bottoms (reversal)
   - Breakouts above resistance or below support
   - Divergences (price vs indicator)
   - Moving average crosses
   - RSI extremes (>70 overbought, <30 oversold)
   - Volume confirmation
   - Pattern completions

OUTPUT REQUIREMENTS:
- Provide clear bias: bullish/bearish/neutral
- Confidence: 0-100 (be honest about uncertainty)
- Identify 2-4 key S/R levels with strength ratings
- Analyze trend direction and strength (0-10 score)
- Score each technical component
- List 2-4 key signals
- Identify 1-2 risks to the thesis
- Suggest confirmations needed
- Provide concise summary (2-3 sentences)
- Provide detailed analysis (4-6 sentences)

CRITICAL - TRANSPARENCY REQUIREMENT:
You MUST include a "keyDrivers" field in your JSON response that explicitly cites the specific indicators driving your bias determination.

Format for keyDrivers (REQUIRED):
"keyDrivers": [
  {
    "indicator": "<indicator name>",
    "value": "<current value or state>",
    "signal": "bullish" | "bearish" | "neutral",
    "weight": "high" | "medium" | "low"
  }
]

Examples of keyDrivers entries:
- { "indicator": "RSI(14)", "value": "28.5 (oversold)", "signal": "bullish", "weight": "high" }
- { "indicator": "Price vs SMA200", "value": "Below 200 SMA by 2.3%", "signal": "bearish", "weight": "high" }
- { "indicator": "MACD Histogram", "value": "Divergence forming", "signal": "bearish", "weight": "medium" }
- { "indicator": "Volume Profile", "value": "Price at POC", "signal": "neutral", "weight": "medium" }

The summary MUST follow this format:
"[BIAS] (Drivers: [indicator1], [indicator2], [indicator3])"
Example: "Bearish (Drivers: RSI Divergence, Price below VWAP, declining Volume Profile)"

Remember: Price action is the primary data. Indicators confirm but don't lead. Focus on what price is doing.`;

/**
 * Generate user prompt for technical structure analysis
 */
export function generateTechnicalStructurePrompt(input: TechnicalDataInput): string {
  const { priceData, indicators, instrument, timeframe, analysisDate, userContext } = input;
  
  if (!priceData || priceData.length === 0) {
    throw new Error('priceData is required and must contain at least one price bar');
  }
  
  // Get current price (last bar)
  const lastBar = priceData[priceData.length - 1];
  const currentPrice = lastBar.close;
  
  // Calculate recent stats
  const last20Bars = priceData.slice(-20);
  const high20 = Math.max(...last20Bars.map(b => b.high));
  const low20 = Math.min(...last20Bars.map(b => b.low));
  const avgVolume = Math.round(last20Bars.reduce((sum, b) => sum + b.volume, 0) / last20Bars.length);
  
  // Format recent price data (last 10 bars)
  const recentBarsText = priceData.slice(-10).map(bar => {
    const date = new Date(bar.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `[${date}] O: ${bar.open.toFixed(2)}, H: ${bar.high.toFixed(2)}, L: ${bar.low.toFixed(2)}, C: ${bar.close.toFixed(2)}, V: ${(bar.volume / 1000000).toFixed(1)}M`;
  }).join('\n');
  
  // Format indicators if provided
  let indicatorsText = '';
  if (indicators) {
    indicatorsText = '\n\nTECHNICAL INDICATORS:\n';
    
    if (indicators.sma20) indicatorsText += `- SMA 20: ${indicators.sma20.toFixed(2)}\n`;
    if (indicators.sma50) indicatorsText += `- SMA 50: ${indicators.sma50.toFixed(2)}\n`;
    if (indicators.sma200) indicatorsText += `- SMA 200: ${indicators.sma200.toFixed(2)}\n`;
    if (indicators.ema12) indicatorsText += `- EMA 12: ${indicators.ema12.toFixed(2)}\n`;
    if (indicators.ema26) indicatorsText += `- EMA 26: ${indicators.ema26.toFixed(2)}\n`;
    
    if (indicators.rsi !== undefined) indicatorsText += `- RSI(14): ${indicators.rsi.toFixed(1)}\n`;
    
    if (indicators.macd) {
      indicatorsText += `- MACD: Line: ${indicators.macd.line.toFixed(2)}, Signal: ${indicators.macd.signal.toFixed(2)}, Histogram: ${indicators.macd.histogram.toFixed(2)}\n`;
    }
    
    if (indicators.stochastic) {
      indicatorsText += `- Stochastic: K: ${indicators.stochastic.k.toFixed(1)}, D: ${indicators.stochastic.d.toFixed(1)}\n`;
    }
    
    if (indicators.atr !== undefined) indicatorsText += `- ATR: ${indicators.atr.toFixed(2)}\n`;
    
    if (indicators.bbands) {
      indicatorsText += `- Bollinger Bands: Upper: ${indicators.bbands.upper.toFixed(2)}, Middle: ${indicators.bbands.middle.toFixed(2)}, Lower: ${indicators.bbands.lower.toFixed(2)}\n`;
    }
    
    if (indicators.volumeProfile) {
      indicatorsText += `- Volume Profile: POC: ${indicators.volumeProfile.poc.toFixed(2)}, VAH: ${indicators.volumeProfile.vah.toFixed(2)}, VAL: ${indicators.volumeProfile.val.toFixed(2)}\n`;
    }
  }
  
  const prompt = `Analyze the technical structure for trading ${instrument} on ${timeframe} timeframe on ${analysisDate}.

CURRENT PRICE: ${currentPrice.toFixed(2)}
TIMEFRAME: ${timeframe}
20-BAR HIGH: ${high20.toFixed(2)}
20-BAR LOW: ${low20.toFixed(2)}
AVG VOLUME (20 bars): ${avgVolume}

RECENT PRICE ACTION (Last 10 bars):
${recentBarsText}${indicatorsText}

${userContext ? `\nADDITIONAL TECHNICAL CONTEXT:\n${userContext}\n` : ''}

INSTRUCTIONS:
1. Identify the primary trend direction (uptrend/downtrend/sideways)
2. Find 2-4 key support and resistance levels
3. Rate S/R level strength based on how they've been tested
4. Assess technical indicator alignment with price
5. Score each technical component (0-10)
6. Identify key technical signals and patterns
7. Determine overall technical bias
8. List risks to the current structure
9. Suggest what would confirm this view

REQUIRED OUTPUT FORMAT (JSON):
{
  "bias": "bullish" | "bearish" | "neutral",
  "confidence": <number 0-100>,
  "supportLevels": [
    {
      "level": <number>,
      "type": "support",
      "strength": "strong" | "moderate" | "weak",
      "source": "<description>"
    }
  ],
  "resistanceLevels": [
    {
      "level": <number>,
      "type": "resistance",
      "strength": "strong" | "moderate" | "weak",
      "source": "<description>"
    }
  ],
  "trend": {
    "direction": "uptrend" | "downtrend" | "sideways",
    "strength": "strong" | "moderate" | "weak",
    "trendlineStart": <number>,
    "trendlineEnd": <number>,
    "barsInTrend": <number>
  },
  "technicalScore": {
    "trend": <0-10>,
    "momentum": <0-10>,
    "volatility": <0-10>,
    "volume": <0-10>,
    "structure": <0-10>,
    "overall": <0-10>
  },
  "keySignals": ["signal1", "signal2", ...],
  "keyDrivers": [
    {
      "indicator": "<indicator name e.g. RSI(14), SMA200, MACD>",
      "value": "<current value or state e.g. 28.5 (oversold), Below SMA by 2.3%>",
      "signal": "bullish" | "bearish" | "neutral",
      "weight": "high" | "medium" | "low"
    }
  ],
  "risks": ["risk1", "risk2"],
  "confirmations": ["confirmation1", "confirmation2"],
  "summary": "<Bias (Drivers: indicator1, indicator2, indicator3)> - <2-3 sentence summary>",
  "detailedAnalysis": "<4-6 sentence detailed technical analysis>"
}

IMPORTANT: The "keyDrivers" array is REQUIRED and must contain at least 2-4 entries that explicitly cite which indicators drove the bias determination. The "summary" field MUST start with the bias and its drivers in parentheses.

Respond ONLY with valid JSON. No additional text.`;
  
  return prompt;
}

/**
 * Validation schema for technical structure output
 */
export function validateTechnicalStructureOutput(output: unknown): output is TechnicalStructureOutput {
  if (typeof output !== 'object' || output === null) return false;
  
  const o = output as any;
  
  // Check required fields
  if (!['bullish', 'bearish', 'neutral'].includes(o.bias)) return false;
  if (typeof o.confidence !== 'number' || o.confidence < 0 || o.confidence > 100) return false;
  
  // Check support/resistance levels
  if (!Array.isArray(o.supportLevels) || !Array.isArray(o.resistanceLevels)) return false;
  
  for (const level of [...o.supportLevels, ...o.resistanceLevels]) {
    if (typeof level.level !== 'number') return false;
    if (!['support', 'resistance'].includes(level.type)) return false;
    if (!['strong', 'moderate', 'weak'].includes(level.strength)) return false;
    if (typeof level.source !== 'string') return false;
  }
  
  // Check trend
  if (typeof o.trend !== 'object' || o.trend === null) return false;
  if (!['uptrend', 'downtrend', 'sideways'].includes(o.trend.direction)) return false;
  if (!['strong', 'moderate', 'weak'].includes(o.trend.strength)) return false;
  if (typeof o.trend.trendlineStart !== 'number') return false;
  if (typeof o.trend.trendlineEnd !== 'number') return false;
  if (typeof o.trend.barsInTrend !== 'number') return false;
  
  // Check technical scores
  if (typeof o.technicalScore !== 'object' || o.technicalScore === null) return false;
  for (const key of ['trend', 'momentum', 'volatility', 'volume', 'structure', 'overall']) {
    if (typeof o.technicalScore[key] !== 'number' || o.technicalScore[key] < 0 || o.technicalScore[key] > 10) {
      return false;
    }
  }
  
  // Check arrays
  if (!Array.isArray(o.keySignals) || !Array.isArray(o.risks) || !Array.isArray(o.confirmations)) return false;
  
  // Check keyDrivers (optional but validated if present)
  if (o.keyDrivers !== undefined) {
    if (!Array.isArray(o.keyDrivers)) return false;
    for (const driver of o.keyDrivers) {
      if (typeof driver.indicator !== 'string') return false;
      if (typeof driver.value !== 'string') return false;
      if (!['bullish', 'bearish', 'neutral'].includes(driver.signal)) return false;
      if (!['high', 'medium', 'low'].includes(driver.weight)) return false;
    }
  }
  
  // Check strings
  if (typeof o.summary !== 'string' || o.summary.length === 0) return false;
  if (typeof o.detailedAnalysis !== 'string' || o.detailedAnalysis.length === 0) return false;
  
  return true;
}

/**
 * Parse AI response and validate output
 */
export function parseTechnicalStructureResponse(response: string): TechnicalStructureOutput {
  try {
    // Try to extract JSON from response (in case AI adds extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    if (!validateTechnicalStructureOutput(parsed)) {
      throw new Error('Invalid technical structure output schema');
    }
    
    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse technical structure response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
