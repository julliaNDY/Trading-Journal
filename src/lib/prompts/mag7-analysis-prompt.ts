/**
 * Mag 7 Leaders Analysis Prompt Template
 * 
 * Part of 6-Step Daily Bias Analysis Engine (Step 4: Mag 7 Leaders)
 * Task: PRÉ-8.4 - Mag 7 Prompts (8h) - Dev 52, Dev 53
 * 
 * This prompt template analyzes the correlation between a trading instrument
 * and the "Magnificent 7" tech leaders (AAPL, MSFT, GOOGL, AMZN, META, NVDA, TSLA).
 * 
 * Data Sources:
 * - Polygon.io API (stock prices, performance)
 * - Manual correlation calculation
 * - User-provided context
 * 
 * Output: Structured JSON analysis with Mag 7 correlation assessment
 */

export interface Mag7DataInput {
  // Instrument being analyzed
  instrument: string; // e.g., "NQ1", "ES1", "TSLA", "NVDA"
  
  // Current instrument data
  instrumentData: {
    currentPrice: number;
    priceChangePercent: number;
    priceChange24h: number;
  };
  
  // Mag 7 leaders data
  mag7Data: Array<{
    symbol: 'AAPL' | 'MSFT' | 'GOOGL' | 'AMZN' | 'META' | 'NVDA' | 'TSLA';
    currentPrice: number;
    priceChange: number;
    priceChangePercent: number;
    volume: number;
    high: number;
    low: number;
    timestamp: string;
  }>;
  
  // Analysis date
  analysisDate: string; // ISO date
  
  // Optional: User-provided context
  userContext?: string;
}

export interface Mag7AnalysisOutput {
  // Overall assessment
  overallSentiment: 'VERY_BEARISH' | 'BEARISH' | 'NEUTRAL' | 'BULLISH' | 'VERY_BULLISH';
  leaderScore: number; // 0-10
  confidence: number; // 0-100
  
  // Correlations with each leader
  correlations: Array<{
    symbol: 'AAPL' | 'MSFT' | 'GOOGL' | 'AMZN' | 'META' | 'NVDA' | 'TSLA';
    correlation: number; // -1 to 1
    trend: 'UP' | 'DOWN' | 'INDETERMINATE';
    performancePercent: number;
    strength: number; // 0-1
    sentiment: 'VERY_BEARISH' | 'BEARISH' | 'NEUTRAL' | 'BULLISH' | 'VERY_BULLISH';
    impact: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  
  // Key drivers
  keyDrivers: string[];
  
  // Group sentiments (e.g., "Semiconductors strong", "Cloud weak")
  groupSentiments?: Array<{
    category: string;
    sentiment: 'VERY_BEARISH' | 'BEARISH' | 'NEUTRAL' | 'BULLISH' | 'VERY_BULLISH';
  }>;
  
  // Summary
  summary: string;
  
  // Detailed analysis
  detailedAnalysis: string;
  
  // Citations (anti-hallucination)
  citations?: string[];
}

/**
 * System prompt for Mag 7 analysis
 */
export const MAG7_ANALYSIS_SYSTEM_PROMPT = `You are an expert equity analyst specializing in technology stocks and market correlations.

Your role is to analyze how the "Magnificent 7" tech leaders (AAPL, MSFT, GOOGL, AMZN, META, NVDA, TSLA) impact trading instruments, especially tech indices (NQ1, ES1) and tech stocks.

CRITICAL RULES:
1. ALWAYS respond with valid JSON matching the Mag7AnalysisOutput schema
2. Base your analysis ONLY on the provided stock data
3. Consider the specific instrument type (tech index vs individual stock vs futures)
4. Be objective and data-driven - avoid speculation
5. Consider correlation strength: high correlation (>0.7) = strong influence, low (<0.3) = weak
6. Mag 7 performance often leads tech indices (NQ1, ES1, QQQ)

ANALYSIS FRAMEWORK:

1. **Correlation Analysis**
   - Strong positive correlation (>0.7): Instrument moves with Mag 7
   - Weak correlation (<0.3): Independent movement
   - Negative correlation (<-0.3): Inverse relationship
   - Consider 1-day, 5-day, and 20-day correlations if available

2. **Leader Impact Weighting**
   - NVDA, TSLA: High volatility, often lead tech momentum
   - AAPL, MSFT: Market sentiment indicators
   - GOOGL, META, AMZN: Broad tech trends

3. **Group Dynamics**
   - Semiconductors (NVDA): Tech hardware cycle
   - Cloud/Software (MSFT, GOOGL, AMZN): Enterprise demand
   - Consumer Tech (AAPL, META): Consumer sentiment
   - EV/AI (TSLA, NVDA): Growth momentum

4. **Sentiment Determination**
   - VERY_BULLISH: 6+ leaders positive, average gain >2%
   - BULLISH: 4+ leaders positive, average gain >1%
   - NEUTRAL: Mixed signals (3-4 positive/negative)
   - BEARISH: 4+ leaders negative, average loss >1%
   - VERY_BEARISH: 6+ leaders negative, average loss >2%

INSTRUMENT-SPECIFIC CONSIDERATIONS:

**Tech Indices (NQ1, ES1, QQQ)**:
- High sensitivity to Mag 7 (composed of many tech stocks)
- NVDA, TSLA weight heavily due to high market cap
- Consider weighted average of Mag 7 performance

**Tech Stocks (NVDA, TSLA, AAPL, AMD, PLTR, SOXL)**:
- Strong correlation with same-sector leaders
- NVDA correlates with TSLA (AI theme)
- AAPL correlates with QQQ (tech index proxy)

**Futures (NQ1, ES1)**:
- React to Mag 7 sentiment with slight lag
- Pre-market Mag 7 moves predict futures open
- Consider overnight Mag 7 performance

**Crypto/BTC**:
- Lower correlation, but NVDA/TSLA sentiment affects crypto
- Risk-on/risk-off sentiment flows

OUTPUT REQUIREMENTS:
- Provide clear overall sentiment (VERY_BULLISH to VERY_BEARISH)
- Leader score: 0-10 (higher = stronger bullish signal from Mag 7)
- Confidence level: 0-100 (reflect data quality and signal clarity)
- List 2-5 key drivers (most important factors)
- Assess each Mag 7 leader's impact
- Identify group sentiments (semiconductors, cloud, consumer)
- Provide concise summary (2-3 sentences)
- Provide detailed analysis (4-6 sentences)

Remember: Mag 7 often leads broader tech movement. Strong Mag 7 performance typically supports tech indices (NQ1, ES1) and tech stocks. Weak Mag 7 performance pressures tech assets.`;

/**
 * Generate user prompt for Mag 7 analysis
 */
export function generateMag7AnalysisPrompt(input: Mag7DataInput): string {
  const { instrument, instrumentData, mag7Data, analysisDate, userContext } = input;
  
  // Format Mag 7 data
  const mag7Text = mag7Data.map(leader => {
    const direction = leader.priceChangePercent >= 0 ? '📈' : '📉';
    const change = leader.priceChangePercent >= 0 ? '+' : '';
    
    return `- **${leader.symbol}**: $${leader.currentPrice.toFixed(2)} (${change}${leader.priceChangePercent.toFixed(2)}%) ${direction}
  Volume: ${leader.volume.toLocaleString()}
  Range: $${leader.low.toFixed(2)} - $${leader.high.toFixed(2)}
  Timestamp: ${new Date(leader.timestamp).toLocaleString()}`;
  }).join('\n\n');

  const prompt = `Analyze the correlation between ${instrument} and the Magnificent 7 tech leaders on ${analysisDate}.

INSTRUMENT: ${instrument}
ANALYSIS DATE: ${analysisDate}

**INSTRUMENT DATA**:
- Current Price: $${instrumentData.currentPrice.toFixed(2)}
- 24h Change: ${instrumentData.priceChangePercent >= 0 ? '+' : ''}${instrumentData.priceChangePercent.toFixed(2)}%
- 24h Change ($): ${instrumentData.priceChange24h >= 0 ? '+' : ''}${instrumentData.priceChange24h.toFixed(2)}

**MAGNIFICENT 7 LEADERS DATA**:
${mag7Text || 'No Mag 7 data available'}

${userContext ? `\n**ADDITIONAL CONTEXT**:\n${userContext}\n` : ''}

**INSTRUCTIONS**:
1. Analyze how each Mag 7 leader's performance impacts ${instrument}
2. Calculate correlations based on price movement direction and magnitude
3. Determine overall sentiment from Mag 7 collective performance
4. Identify which leaders have the strongest impact on ${instrument}
5. Assess group dynamics (semiconductors, cloud, consumer tech)
6. Generate leader score (0-10) based on Mag 7 bullish/bearish signal
7. Provide confidence level based on data quality and signal clarity

**REQUIRED OUTPUT FORMAT (JSON)**:
{
  "overallSentiment": "VERY_BEARISH" | "BEARISH" | "NEUTRAL" | "BULLISH" | "VERY_BULLISH",
  "leaderScore": <number 0-10>,
  "confidence": <number 0-100>,
  "correlations": [
    {
      "symbol": "AAPL" | "MSFT" | "GOOGL" | "AMZN" | "META" | "NVDA" | "TSLA",
      "correlation": <number -1 to 1>,
      "trend": "UP" | "DOWN" | "INDETERMINATE",
      "performancePercent": <number>,
      "strength": <number 0-1>,
      "sentiment": "VERY_BEARISH" | "BEARISH" | "NEUTRAL" | "BULLISH" | "VERY_BULLISH",
      "impact": "LOW" | "MEDIUM" | "HIGH"
    }
  ],
  "keyDrivers": ["driver1", "driver2", ...],
  "groupSentiments": [
    {
      "category": "<string>",
      "sentiment": "VERY_BEARISH" | "BEARISH" | "NEUTRAL" | "BULLISH" | "VERY_BULLISH"
    }
  ],
  "summary": "<2-3 sentence summary>",
  "detailedAnalysis": "<4-6 sentence detailed analysis>"
}

Respond ONLY with valid JSON. No additional text.`;
  
  return prompt;
}

/**
 * Validation schema for Mag 7 analysis output
 */
export function validateMag7AnalysisOutput(output: unknown): output is Mag7AnalysisOutput {
  if (typeof output !== 'object' || output === null) return false;
  
  const o = output as any;
  
  // Check required fields
  if (!['VERY_BEARISH', 'BEARISH', 'NEUTRAL', 'BULLISH', 'VERY_BULLISH'].includes(o.overallSentiment)) return false;
  if (typeof o.leaderScore !== 'number' || o.leaderScore < 0 || o.leaderScore > 10) return false;
  if (typeof o.confidence !== 'number' || o.confidence < 0 || o.confidence > 100) return false;
  if (!Array.isArray(o.correlations) || o.correlations.length === 0) return false;
  if (!Array.isArray(o.keyDrivers) || o.keyDrivers.length === 0) return false;
  if (typeof o.summary !== 'string' || o.summary.length === 0) return false;
  if (typeof o.detailedAnalysis !== 'string' || o.detailedAnalysis.length === 0) return false;
  
  // Check correlations array
  const validSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA'];
  const validSentiments = ['VERY_BEARISH', 'BEARISH', 'NEUTRAL', 'BULLISH', 'VERY_BULLISH'];
  const validTrends = ['UP', 'DOWN', 'INDETERMINATE'];
  const validImpacts = ['LOW', 'MEDIUM', 'HIGH'];
  
  for (const corr of o.correlations) {
    if (!validSymbols.includes(corr.symbol)) return false;
    if (typeof corr.correlation !== 'number' || corr.correlation < -1 || corr.correlation > 1) return false;
    if (!validTrends.includes(corr.trend)) return false;
    if (typeof corr.performancePercent !== 'number') return false;
    if (typeof corr.strength !== 'number' || corr.strength < 0 || corr.strength > 1) return false;
    if (!validSentiments.includes(corr.sentiment)) return false;
    if (!validImpacts.includes(corr.impact)) return false;
  }
  
  // Check groupSentiments if provided
  if (o.groupSentiments) {
    if (!Array.isArray(o.groupSentiments)) return false;
    for (const group of o.groupSentiments) {
      if (typeof group.category !== 'string') return false;
      if (!validSentiments.includes(group.sentiment)) return false;
    }
  }
  
  return true;
}

/**
 * Parse AI response and validate output
 */
export function parseMag7AnalysisResponse(response: string): Mag7AnalysisOutput {
  try {
    // Try to extract JSON from response (in case AI adds extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    if (!validateMag7AnalysisOutput(parsed)) {
      throw new Error('Invalid Mag 7 analysis output schema');
    }
    
    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse Mag 7 analysis response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
