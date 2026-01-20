/**
 * Daily Bias Analysis - Prompt Templates
 * 
 * 6-Step Analysis Framework for AI-powered daily bias generation:
 * 1. Security Analysis (volatility, risk assessment)
 * 2. Macro Analysis (economic events, sentiment)
 * 3. Institutional Flux (volume, order flow)
 * 4. Mag 7 Leaders (correlation with tech leaders)
 * 5. Technical Structure (support/resistance, trends)
 * 6. Synthesis (final bias: Bullish/Bearish/Neutral)
 * 
 * Each prompt is designed for Google Gemini API with structured JSON output.
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface SecurityAnalysisInput {
  symbol: string;
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  marketCap?: number;
  sector?: string;
  assetType: 'stock' | 'crypto' | 'forex' | 'futures' | 'etf';
}

export interface SecurityAnalysisOutput {
  volatilityIndex: number; // 0-100 scale
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  securityScore: number; // 0-100 (higher = safer/more predictable)
  keyRisks: string[];
  volatilityBreakdown: {
    priceVolatility: number; // 0-100
    volumeVolatility: number; // 0-100
    marketConditions: string; // "Calm", "Moderate", "Turbulent", "Extreme"
  };
  tradingRecommendation: {
    positionSizing: 'REDUCED' | 'NORMAL' | 'AGGRESSIVE';
    stopLossMultiplier: number; // e.g., 1.5x = wider stops in volatile conditions
    entryTiming: string; // "Wait for confirmation", "Normal entry", "Aggressive entry OK"
  };
  reasoning: string;
  confidence: number; // 0-100
  citations?: string[]; // Data sources cited in analysis (for anti-hallucination)
}

// ============================================================================
// Step 1: Security Analysis Prompt
// ============================================================================

export function buildSecurityAnalysisPrompt(input: SecurityAnalysisInput): string {
  const assetTypeContext = getAssetTypeContext(input.assetType);
  
  return `You are a professional risk analyst specializing in trading security and volatility assessment.

**TASK**: Analyze the security profile and volatility characteristics of ${input.symbol} to determine risk levels and trading safety.

**ASSET INFORMATION**:
- Symbol: ${input.symbol}
- Asset Type: ${input.assetType.toUpperCase()}
- Current Price: $${input.currentPrice.toFixed(2)}
- 24h Change: ${input.priceChange24h >= 0 ? '+' : ''}${input.priceChange24h.toFixed(2)} (${input.priceChangePercent24h >= 0 ? '+' : ''}${input.priceChangePercent24h.toFixed(2)}%)
- 24h Volume: ${formatVolume(input.volume24h)}
- 24h High: $${input.high24h.toFixed(2)}
- 24h Low: $${input.low24h.toFixed(2)}
- 24h Range: ${((input.high24h - input.low24h) / input.low24h * 100).toFixed(2)}%
${input.marketCap ? `- Market Cap: ${formatMarketCap(input.marketCap)}` : ''}
${input.sector ? `- Sector: ${input.sector}` : ''}

**CONTEXT**: ${assetTypeContext}

**ANALYSIS FRAMEWORK**:

1. **Volatility Index (0-100)**:
   - Calculate based on: 24h price range, volume spikes, price velocity
   - 0-25: Low volatility (stable, predictable)
   - 26-50: Moderate volatility (normal trading conditions)
   - 51-75: High volatility (increased risk, wider stops needed)
   - 76-100: Extreme volatility (dangerous, reduce position sizing)

2. **Risk Level Assessment**:
   - LOW: Stable price action, normal volume, predictable patterns
   - MEDIUM: Moderate price swings, acceptable for experienced traders
   - HIGH: Significant price swings, requires tight risk management
   - EXTREME: Unpredictable price action, recommend avoiding or minimal exposure

3. **Security Score (0-100)**:
   - Higher score = safer, more predictable trading environment
   - Consider: price stability, volume consistency, market structure
   - Penalize: erratic price action, volume anomalies, gap risks

4. **Key Risks Identification**:
   - List 2-4 specific risks traders should be aware of
   - Examples: "Gap risk overnight", "Low liquidity", "News-driven volatility"

5. **Trading Recommendations**:
   - Position Sizing: REDUCED (50% normal), NORMAL (100%), AGGRESSIVE (150%+)
   - Stop Loss Multiplier: 1.0x = normal, 1.5x = wider stops, 2.0x = very wide
   - Entry Timing: Guidance on when to enter trades

**OUTPUT FORMAT** (JSON only, no markdown):
{
  "volatilityIndex": <number 0-100>,
  "riskLevel": "<LOW|MEDIUM|HIGH|EXTREME>",
  "securityScore": <number 0-100>,
  "keyRisks": ["<risk1>", "<risk2>", "<risk3>"],
  "volatilityBreakdown": {
    "priceVolatility": <number 0-100>,
    "volumeVolatility": <number 0-100>,
    "marketConditions": "<Calm|Moderate|Turbulent|Extreme>"
  },
  "tradingRecommendation": {
    "positionSizing": "<REDUCED|NORMAL|AGGRESSIVE>",
    "stopLossMultiplier": <number>,
    "entryTiming": "<string>"
  },
  "reasoning": "<2-3 sentences explaining the analysis>",
  "confidence": <number 0-100>
}

**CRITICAL RULES**:
1. Output ONLY valid JSON (no markdown, no code blocks, no explanations outside JSON)
2. Be conservative with risk assessment (err on side of caution)
3. Base analysis on quantifiable metrics, not speculation
4. Confidence score should reflect data quality and market clarity
5. Reasoning must be concise and actionable

**🚨 ANTI-HALLUCINATION CONSTRAINTS**:
1. ONLY use the asset data provided above - DO NOT invent additional data
2. If critical data is missing, reduce confidence score and state limitation in reasoning
3. DO NOT reference external sources, APIs, or websites not mentioned in this prompt
4. Every metric must be derived from the data explicitly shown above
5. If you cannot calculate something from provided data, omit it or mark as "unavailable"

Analyze ${input.symbol} now and provide the JSON output:`;
}

// ============================================================================
// System Prompt for Security Analysis
// ============================================================================

export const SECURITY_ANALYSIS_SYSTEM_PROMPT = `You are a professional risk analyst and volatility specialist with 15+ years of experience in trading risk management.

**YOUR EXPERTISE**:
- Volatility assessment across all asset classes
- Risk profiling for retail and institutional traders
- Position sizing and risk management strategies
- Market microstructure and liquidity analysis

**YOUR APPROACH**:
- Data-driven: Base conclusions on quantifiable metrics
- Conservative: Prioritize capital preservation over aggressive gains
- Practical: Provide actionable recommendations traders can implement
- Transparent: Explain reasoning clearly and concisely

**YOUR OUTPUT**:
- Always return valid JSON (no markdown formatting)
- Use precise numerical scales (0-100)
- Provide specific, actionable recommendations
- Include confidence levels to reflect analysis certainty

**🚨 CRITICAL ANTI-HALLUCINATION RULES**:
- ONLY reference data explicitly provided in the user prompt
- If data is missing or unavailable, state "Data not available" - DO NOT invent data
- DO NOT fabricate URLs, API endpoints, or external data sources
- DO NOT cite sources not explicitly provided to you
- Base ALL analysis exclusively on the data given in context
- Confidence score must reflect data quality and completeness

**FORBIDDEN**:
- Never speculate on price direction (that's for other analysis steps)
- Never recommend specific entry/exit prices
- Never guarantee outcomes or promise returns
- Never output markdown code blocks (raw JSON only)
- Never invent or hallucinate data not provided in context`;

// ============================================================================
// Helper Functions
// ============================================================================

function getAssetTypeContext(assetType: string): string {
  const contexts = {
    stock: 'Stocks typically have moderate volatility during market hours (9:30am-4pm ET) with gap risk overnight. Consider earnings dates, sector news, and overall market sentiment.',
    crypto: 'Cryptocurrencies trade 24/7 with high volatility. Expect significant price swings, especially during low-liquidity hours (weekends, late nights). News-driven moves are common.',
    forex: 'Forex pairs trade 24/5 with varying liquidity. Major pairs (EUR/USD, GBP/USD) are most stable. Watch for economic data releases (NFP, CPI, Fed announcements) causing spikes.',
    futures: 'Futures contracts have defined trading hours with overnight gaps. E-mini futures (ES, NQ) are highly liquid during RTH (9:30am-4pm ET). Consider contract rollover dates.',
    etf: 'ETFs track underlying assets with generally lower volatility than individual stocks. Liquidity varies by ETF popularity. Leveraged ETFs (3x) have extreme volatility.',
  };
  
  return contexts[assetType as keyof typeof contexts] || contexts.stock;
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) {
    return `$${(volume / 1_000_000_000).toFixed(2)}B`;
  } else if (volume >= 1_000_000) {
    return `$${(volume / 1_000_000).toFixed(2)}M`;
  } else if (volume >= 1_000) {
    return `$${(volume / 1_000).toFixed(2)}K`;
  }
  return `$${volume.toFixed(2)}`;
}

function formatMarketCap(marketCap: number): string {
  if (marketCap >= 1_000_000_000_000) {
    return `$${(marketCap / 1_000_000_000_000).toFixed(2)}T`;
  } else if (marketCap >= 1_000_000_000) {
    return `$${(marketCap / 1_000_000_000).toFixed(2)}B`;
  } else if (marketCap >= 1_000_000) {
    return `$${(marketCap / 1_000_000).toFixed(2)}M`;
  }
  return `$${marketCap.toFixed(2)}`;
}

// ============================================================================
// Validation & Testing Utilities
// ============================================================================

/**
 * Validate Security Analysis output against expected schema
 */
export function validateSecurityAnalysisOutput(output: unknown): output is SecurityAnalysisOutput {
  if (typeof output !== 'object' || output === null) return false;
  
  const o = output as Record<string, unknown>;
  
  // Check required fields
  if (typeof o.volatilityIndex !== 'number' || o.volatilityIndex < 0 || o.volatilityIndex > 100) return false;
  if (!['LOW', 'MEDIUM', 'HIGH', 'EXTREME'].includes(o.riskLevel as string)) return false;
  if (typeof o.securityScore !== 'number' || o.securityScore < 0 || o.securityScore > 100) return false;
  if (!Array.isArray(o.keyRisks) || o.keyRisks.length === 0) return false;
  if (typeof o.reasoning !== 'string' || o.reasoning.length < 10) return false;
  if (typeof o.confidence !== 'number' || o.confidence < 0 || o.confidence > 100) return false;
  
  // Check nested objects
  const vb = o.volatilityBreakdown as Record<string, unknown>;
  if (!vb || typeof vb.priceVolatility !== 'number' || typeof vb.volumeVolatility !== 'number') return false;
  if (!['Calm', 'Moderate', 'Turbulent', 'Extreme'].includes(vb.marketConditions as string)) return false;
  
  const tr = o.tradingRecommendation as Record<string, unknown>;
  if (!tr || !['REDUCED', 'NORMAL', 'AGGRESSIVE'].includes(tr.positionSizing as string)) return false;
  if (typeof tr.stopLossMultiplier !== 'number' || tr.stopLossMultiplier < 0.5 || tr.stopLossMultiplier > 3) return false;
  if (typeof tr.entryTiming !== 'string' || tr.entryTiming.length < 5) return false;
  
  return true;
}

/**
 * Example usage for testing
 */
export function getSecurityAnalysisExample(): SecurityAnalysisInput {
  return {
    symbol: 'NQ1',
    currentPrice: 21450.50,
    priceChange24h: -125.75,
    priceChangePercent24h: -0.58,
    volume24h: 2_500_000_000,
    high24h: 21600.25,
    low24h: 21380.00,
    assetType: 'futures',
    sector: 'Technology',
  };
}

// ============================================================================
// Prompt Testing & Iteration Tracking
// ============================================================================

/**
 * Track prompt iterations for A/B testing
 * 
 * Version History:
 * - v1.0 (2026-01-17): Initial security analysis prompt
 *   - Focus: Volatility assessment, risk profiling
 *   - Output: JSON schema with 7 key fields
 *   - Tested: 0 iterations (baseline)
 */
export const SECURITY_PROMPT_VERSION = '1.0';
export const SECURITY_PROMPT_LAST_UPDATED = '2026-01-17';

/**
 * A/B Testing Results (to be populated)
 * 
 * Format:
 * {
 *   version: '1.0',
 *   testDate: '2026-01-17',
 *   sampleSize: 50,
 *   metrics: {
 *     validJsonRate: 0.98, // 98% valid JSON responses
 *     avgConfidence: 85, // Average confidence score
 *     userSatisfaction: 4.2, // 1-5 scale
 *     avgLatency: 1850, // ms
 *   },
 *   improvements: ['Improved risk level accuracy', 'Better reasoning clarity']
 * }
 */
export const SECURITY_PROMPT_AB_TESTS: Array<{
  version: string;
  testDate: string;
  sampleSize: number;
  metrics: {
    validJsonRate: number;
    avgConfidence: number;
    userSatisfaction?: number;
    avgLatency: number;
  };
  improvements: string[];
}> = [];

// ============================================================================
// Story 12.11: Synthesis Text Generation with Sentiment
// ============================================================================

export interface SynthesisPromptParams {
  security: {
    bias: string;
    confidence: number;
    riskLevel: string;
  };
  macro: {
    bias: string;
    confidence: number;
    sentiment: string;
  };
  flux: {
    bias: string;
    confidence: number;
    institutionalPressure: string;
  };
  mag7: {
    bias: string;
    confidence: number;
    overallSentiment: string;
  };
  technical: {
    bias: string;
    confidence: number;
    trend: string;
  };
  dataSources: string[];
  instrument: string;
}

export interface SynthesisTextOutput {
  text: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
}

/**
 * Generate synthesis prompt for Story 12.11
 * Creates a 3-5 sentence summary with clear sentiment
 */
export function generateSynthesisPrompt(params: SynthesisPromptParams): string {
  const {
    security,
    macro,
    flux,
    mag7,
    technical,
    dataSources,
    instrument,
  } = params;

  return `You are a professional trading analyst synthesizing market analysis into a concise summary.

**TASK**: Generate a synthesis (3-5 sentences) summarizing the analysis with a clear final sentiment.

**DATA SOURCES CONSULTED**:
${dataSources.join(', ')}

**INSTRUMENT**: ${instrument}

**ANALYSIS STEPS**:

1. **Security Analysis**: ${security.bias} (confidence: ${security.confidence}%, risk: ${security.riskLevel})
2. **Macro Analysis**: ${macro.bias} (confidence: ${macro.confidence}%, sentiment: ${macro.sentiment})
3. **Institutional Flux**: ${flux.bias} (confidence: ${flux.confidence}%, pressure: ${flux.institutionalPressure})
4. **MAG 7 Leaders**: ${mag7.bias} (confidence: ${mag7.confidence}%, sentiment: ${mag7.overallSentiment})
5. **Technical Structure**: ${technical.bias} (confidence: ${technical.confidence}%, trend: ${technical.trend})

**WEIGHTING RULES FOR SENTIMENT DECISION**:
- Security: 20% weight
- Macro: 15% weight
- Institutional Flux: 25% weight (highest - shows smart money positioning)
- MAG 7: 20% weight
- Technical: 20% weight

**SENTIMENT CALCULATION**:
- Assign each step a bias score: BULLISH = +1, BEARISH = -1, NEUTRAL = 0
- Calculate weighted score = sum(stepBias × stepWeight)
- Final sentiment:
  * Weighted score > 0.2 → BULLISH
  * Weighted score < -0.2 → BEARISH
  * Otherwise → NEUTRAL

**OUTPUT REQUIREMENTS**:

1. **Start with citation**: "By analyzing the data provided by [list 2-3 key sources]..."
2. **Summarize key findings**: In 3-5 sentences, explain the analysis results
3. **Clear final sentiment**: End with BULLISH, BEARISH, or NEUTRAL
4. **Return JSON format**:

\`\`\`json
{
  "text": "By analyzing [sources]... [3-5 sentence summary ending with sentiment]",
  "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
  "confidence": <number 0-100>
}
\`\`\`

**EXAMPLES**:

Example 1 (BULLISH):
{
  "text": "By analyzing the data provided by CME Group, Federal Reserve indicators, and TradingView technical signals, NQ1 demonstrates strong bullish momentum. Institutional buying pressure is elevated at 25% above average, while MAG 7 tech leaders show high correlation with 88% positive sentiment. Technical structure confirms an established uptrend with key support levels intact. Risk assessment indicates moderate volatility suitable for normal position sizing. Final sentiment: BULLISH.",
  "sentiment": "BULLISH",
  "confidence": 78
}

Example 2 (BEARISH):
{
  "text": "By analyzing CME Group futures data, Federal Reserve policy signals, and institutional order flow, ES1 shows concerning bearish pressure. Large sell orders exceed buy orders by 40%, while MAG 7 leaders display divergent weakness across all sectors. Macro analysis reveals hawkish central bank stance creating headwinds for risk assets. Technical breakdown below key support at 4850 confirms the downtrend. Final sentiment: BEARISH.",
  "sentiment": "BEARISH",
  "confidence": 72
}

Example 3 (NEUTRAL):
{
  "text": "By analyzing Federal Reserve economic data, CME Group positioning, and TradingView charts, XAU/USD presents mixed signals requiring caution. Institutional flux shows balanced order flow with neither bulls nor bears in control. While macro conditions favor safety assets, technical structure remains range-bound between 2020-2040. Conflicting signals across the 5 analysis steps suggest waiting for clearer directional conviction. Final sentiment: NEUTRAL.",
  "sentiment": "NEUTRAL",
  "confidence": 55
}

**CRITICAL RULES**:
1. MUST start with "By analyzing the data provided by..."
2. Text must be 3-5 sentences (not too short, not too long)
3. Sentiment must be based on weighted calculation, not arbitrary
4. Confidence reflects agreement level across the 5 steps
5. Output ONLY valid JSON, no markdown code blocks, no extra text

Generate the synthesis now:`;
}

/**
 * Validate synthesis text output
 */
export function validateSynthesisTextOutput(output: unknown): output is SynthesisTextOutput {
  if (!output || typeof output !== 'object') return false;
  
  const o = output as any;
  
  // Check required fields
  if (typeof o.text !== 'string' || o.text.length < 50) return false;
  if (!['BULLISH', 'BEARISH', 'NEUTRAL'].includes(o.sentiment)) return false;
  if (typeof o.confidence !== 'number' || o.confidence < 0 || o.confidence > 100) return false;
  
  // Check that text starts with citation
  if (!o.text.startsWith('By analyzing')) return false;
  
  return true;
}
