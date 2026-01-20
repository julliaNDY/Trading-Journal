/**
 * Institutional Flux Prompt Templates
 * 
 * Step 3/6 of Daily Bias Analysis
 * Analyzes volume profile, order flow, and institutional activity
 * to detect smart money positioning and market manipulation.
 * 
 * @module prompts/institutional-flux
 * @created 2026-01-17
 * @author Dev 50, Dev 51 (PRÉ-8.3)
 */

import { z } from 'zod';

// ============================================================================
// Types & Validation Schemas
// ============================================================================

/**
 * Volume Profile Analysis
 */
export const VolumeProfileSchema = z.object({
  totalVolume: z.number().describe('Total volume for the period'),
  averageVolume: z.number().describe('Average volume (20-day)'),
  volumeRatio: z.number().describe('Current volume / Average volume'),
  volumeTrend: z.enum(['INCREASING', 'DECREASING', 'STABLE']).describe('Volume trend'),
  volumeSpikes: z.array(z.object({
    timestamp: z.string().describe('ISO timestamp of spike'),
    volume: z.number().describe('Volume at spike'),
    priceChange: z.number().describe('Price change % during spike'),
  })).describe('Significant volume spikes'),
  volumeByPriceLevel: z.array(z.object({
    priceLevel: z.number().describe('Price level'),
    volume: z.number().describe('Volume at this price level'),
    percentage: z.number().describe('% of total volume'),
  })).describe('Volume distribution by price level (VPOC analysis)'),
});

export type VolumeProfile = z.infer<typeof VolumeProfileSchema>;

/**
 * Order Flow Analysis
 */
export const OrderFlowSchema = z.object({
  buyVolume: z.number().describe('Total buy volume'),
  sellVolume: z.number().describe('Total sell volume'),
  buyVsSellRatio: z.number().describe('Buy volume / Sell volume ratio'),
  netOrderFlow: z.number().describe('Net order flow (buy - sell)'),
  orderFlowTrend: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']).describe('Order flow trend'),
  largeOrders: z.array(z.object({
    timestamp: z.string().describe('ISO timestamp'),
    side: z.enum(['BUY', 'SELL']).describe('Order side'),
    size: z.number().describe('Order size'),
    price: z.number().describe('Execution price'),
    impact: z.enum(['HIGH', 'MEDIUM', 'LOW']).describe('Market impact'),
  })).describe('Large institutional orders detected'),
  aggressiveness: z.number().min(0).max(10).describe('Order aggressiveness score (0-10)'),
});

export type OrderFlow = z.infer<typeof OrderFlowSchema>;

/**
 * Institutional Activity Indicators
 */
export const InstitutionalActivitySchema = z.object({
  darkPoolActivity: z.object({
    volume: z.number().describe('Dark pool volume'),
    percentage: z.number().describe('% of total volume'),
    trend: z.enum(['INCREASING', 'DECREASING', 'STABLE']).describe('Dark pool trend'),
  }).describe('Dark pool trading activity'),
  blockTrades: z.array(z.object({
    timestamp: z.string().describe('ISO timestamp'),
    size: z.number().describe('Block trade size'),
    price: z.number().describe('Execution price'),
    type: z.enum(['ACCUMULATION', 'DISTRIBUTION']).describe('Trade type'),
  })).describe('Block trades (institutional size)'),
  smartMoneyIndex: z.number().min(-10).max(10).describe('Smart money positioning index (-10 to +10)'),
  institutionalSentiment: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']).describe('Overall institutional sentiment'),
  confidence: z.number().min(0).max(100).describe('Confidence in analysis (0-100%)'),
});

export type InstitutionalActivity = z.infer<typeof InstitutionalActivitySchema>;

/**
 * Market Manipulation Indicators
 */
export const MarketManipulationSchema = z.object({
  spoofingDetected: z.boolean().describe('Spoofing/layering detected'),
  washTrading: z.boolean().describe('Wash trading patterns detected'),
  stopHunting: z.boolean().describe('Stop hunting activity detected'),
  manipulationScore: z.number().min(0).max(10).describe('Manipulation risk score (0-10)'),
  manipulationDetails: z.string().describe('Details of detected manipulation patterns'),
});

export type MarketManipulation = z.infer<typeof MarketManipulationSchema>;

/**
 * Complete Institutional Flux Analysis Output
 */
export const InstitutionalFluxAnalysisSchema = z.object({
  instrument: z.string().describe('Trading instrument symbol'),
  timestamp: z.string().describe('Analysis timestamp (ISO)'),
  volumeProfile: VolumeProfileSchema,
  orderFlow: OrderFlowSchema,
  institutionalActivity: InstitutionalActivitySchema,
  marketManipulation: MarketManipulationSchema,
  fluxScore: z.number().min(0).max(10).describe('Overall institutional flux score (0-10)'),
  bias: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']).describe('Institutional bias'),
  confidence: z.number().min(0).max(100).describe('Overall confidence (0-100%)'),
  keyInsights: z.array(z.string()).describe('Key insights (3-5 bullet points)'),
  warnings: z.array(z.string()).describe('Risk warnings (if any)'),
  nextUpdate: z.string().describe('Next analysis update time (ISO)'),
  citations: z.array(z.string()).optional().describe('Data sources cited (anti-hallucination)'),
});

export type InstitutionalFluxAnalysis = z.infer<typeof InstitutionalFluxAnalysisSchema>;

// ============================================================================
// Prompt Templates
// ============================================================================

/**
 * System prompt for institutional flux analysis
 */
export const INSTITUTIONAL_FLUX_SYSTEM_PROMPT = `You are an expert institutional trading analyst specializing in volume profile analysis, order flow detection, and smart money tracking.

Your role is to analyze market data to detect:
1. **Volume Profile**: Identify volume distribution, VPOC (Volume Point of Control), and volume anomalies
2. **Order Flow**: Track buy/sell pressure, large orders, and aggressive trading
3. **Institutional Activity**: Detect dark pool activity, block trades, and smart money positioning
4. **Market Manipulation**: Identify spoofing, wash trading, stop hunting, and other manipulative practices

CRITICAL RULES:
- Base analysis ONLY on provided market data (volume, price, order flow)
- Use statistical methods to detect anomalies (2+ standard deviations)
- Consider time-of-day patterns (market open/close have different characteristics)
- Large orders = 10x average order size or 1%+ of daily volume
- Dark pool activity = off-exchange trading volume
- Smart Money Index = institutional positioning vs retail sentiment

OUTPUT FORMAT:
- Return ONLY valid JSON matching the InstitutionalFluxAnalysis schema
- All numeric scores must be within specified ranges
- Include 3-5 key insights (actionable, specific)
- Add warnings for high manipulation risk or unusual patterns
- Confidence score reflects data quality and pattern clarity

BIAS DETERMINATION:
- BULLISH: Net buying pressure + accumulation + positive smart money index
- BEARISH: Net selling pressure + distribution + negative smart money index  
- NEUTRAL: Balanced flow or insufficient data

Be objective, data-driven, and conservative in your analysis.`;

/**
 * Generate user prompt for institutional flux analysis
 */
export function generateInstitutionalFluxPrompt(params: {
  instrument: string;
  marketData: {
    currentPrice: number;
    priceChange24h: number;
    volume24h: number;
    averageVolume20d: number;
    high24h: number;
    low24h: number;
  };
  volumeData: {
    timestamp: string;
    volume: number;
    price: number;
    buyVolume?: number;
    sellVolume?: number;
  }[];
  orderBookData?: {
    bids: { price: number; size: number }[];
    asks: { price: number; size: number }[];
    timestamp: string;
  };
  darkPoolData?: {
    volume: number;
    percentage: number;
    trades: { timestamp: string; size: number; price: number }[];
  };
  timeframe?: '1h' | '4h' | '1d';
}): string {
  const { instrument, marketData, volumeData, orderBookData, darkPoolData, timeframe = '1d' } = params;

  // Calculate volume statistics
  const totalVolume = volumeData.reduce((sum, d) => sum + d.volume, 0);
  const volumeRatio = marketData.volume24h / marketData.averageVolume20d;
  
  // Calculate buy/sell pressure if available
  let buyPressure = 'N/A';
  let sellPressure = 'N/A';
  if (volumeData.some(d => d.buyVolume !== undefined)) {
    const totalBuy = volumeData.reduce((sum, d) => sum + (d.buyVolume || 0), 0);
    const totalSell = volumeData.reduce((sum, d) => sum + (d.sellVolume || 0), 0);
    buyPressure = `${((totalBuy / totalVolume) * 100).toFixed(2)}%`;
    sellPressure = `${((totalSell / totalVolume) * 100).toFixed(2)}%`;
  }

  return `Analyze the institutional flux for ${instrument} over the ${timeframe} timeframe.

## Market Overview
- **Instrument**: ${instrument}
- **Current Price**: $${marketData.currentPrice.toFixed(2)}
- **24h Change**: ${marketData.priceChange24h >= 0 ? '+' : ''}${marketData.priceChange24h.toFixed(2)}%
- **24h Volume**: ${formatVolume(marketData.volume24h)}
- **20-day Avg Volume**: ${formatVolume(marketData.averageVolume20d)}
- **Volume Ratio**: ${volumeRatio.toFixed(2)}x (current vs average)
- **24h High**: $${marketData.high24h.toFixed(2)}
- **24h Low**: $${marketData.low24h.toFixed(2)}

## Volume Data (${volumeData.length} data points)
${volumeData.slice(0, 10).map(d => 
  `- ${d.timestamp}: Volume ${formatVolume(d.volume)} @ $${d.price.toFixed(2)}${
    d.buyVolume ? ` (Buy: ${formatVolume(d.buyVolume)}, Sell: ${formatVolume(d.sellVolume || 0)})` : ''
  }`
).join('\n')}
${volumeData.length > 10 ? `... and ${volumeData.length - 10} more data points` : ''}

## Order Flow Summary
- **Buy Pressure**: ${buyPressure}
- **Sell Pressure**: ${sellPressure}
- **Net Flow**: ${buyPressure !== 'N/A' ? 'Calculated from data' : 'Not available'}

${orderBookData ? `## Order Book Snapshot (${orderBookData.timestamp})
**Top 5 Bids**:
${orderBookData.bids.slice(0, 5).map(b => `- $${b.price.toFixed(2)} × ${b.size.toFixed(0)}`).join('\n')}

**Top 5 Asks**:
${orderBookData.asks.slice(0, 5).map(a => `- $${a.price.toFixed(2)} × ${a.size.toFixed(0)}`).join('\n')}
` : ''}

${darkPoolData ? `## Dark Pool Activity
- **Volume**: ${formatVolume(darkPoolData.volume)} (${darkPoolData.percentage.toFixed(2)}% of total)
- **Block Trades**: ${darkPoolData.trades.length} trades
- **Largest Trade**: ${formatVolume(Math.max(...darkPoolData.trades.map(t => t.size)))}
` : ''}

## Analysis Requirements
1. **Volume Profile**: Identify VPOC, volume clusters, and anomalies
2. **Order Flow**: Detect buying/selling pressure and large orders (>10x avg)
3. **Institutional Activity**: Analyze dark pool data and block trades
4. **Smart Money**: Determine institutional positioning (bullish/bearish/neutral)
5. **Manipulation**: Check for spoofing, wash trading, stop hunting
6. **Flux Score**: Rate institutional activity intensity (0-10)
7. **Bias**: Determine overall institutional bias (BULLISH/BEARISH/NEUTRAL)

Return a complete InstitutionalFluxAnalysis JSON object with all required fields.`;
}

/**
 * Simplified prompt for when limited data is available
 */
export function generateSimplifiedFluxPrompt(params: {
  instrument: string;
  currentPrice: number;
  volume24h: number;
  averageVolume20d: number;
  priceChange24h: number;
}): string {
  const { instrument, currentPrice, volume24h, averageVolume20d, priceChange24h } = params;
  const volumeRatio = volume24h / averageVolume20d;

  return `Analyze institutional flux for ${instrument} with limited data.

## Available Data
- **Instrument**: ${instrument}
- **Current Price**: $${currentPrice.toFixed(2)}
- **24h Change**: ${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}%
- **24h Volume**: ${formatVolume(volume24h)}
- **20-day Avg Volume**: ${formatVolume(averageVolume20d)}
- **Volume Ratio**: ${volumeRatio.toFixed(2)}x

## Analysis Constraints
- Limited to basic volume analysis (no order flow or dark pool data)
- Focus on volume ratio and price-volume correlation
- Use conservative estimates for institutional activity
- Set confidence scores lower due to limited data (max 60%)

## Required Output
Return a complete InstitutionalFluxAnalysis JSON object with:
- Volume profile based on 24h volume vs average
- Estimated order flow from price action
- Conservative institutional activity estimates
- Low confidence scores (30-60%)
- Clear warnings about limited data quality

Provide best-effort analysis while acknowledging data limitations.`;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format volume for display (e.g., 1.5M, 234K)
 */
function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) {
    return `${(volume / 1_000_000_000).toFixed(2)}B`;
  } else if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`;
  } else if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(2)}K`;
  }
  return volume.toFixed(0);
}

/**
 * Validate institutional flux analysis output
 */
export function validateInstitutionalFluxAnalysis(data: unknown): InstitutionalFluxAnalysis {
  return InstitutionalFluxAnalysisSchema.parse(data);
}

/**
 * Create default/empty institutional flux analysis (for fallback)
 * Uses realistic mock values instead of zeros for better UX
 */
export function createEmptyFluxAnalysis(instrument: string): InstitutionalFluxAnalysis {
  // Generate deterministic but realistic values based on instrument
  const seed = instrument.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const randomFactor = (seed % 100) / 100; // 0-1
  
  // Realistic volume ranges (in billions for futures/indices, millions for stocks)
  const isFuture = ['NQ1', 'ES1'].includes(instrument);
  const volumeMultiplier = isFuture ? 1e9 : 1e6;
  const totalVolume = (50 + randomFactor * 150) * volumeMultiplier; // 50B-200B or 50M-200M
  const averageVolume = totalVolume * (0.8 + randomFactor * 0.4); // ±20% variation
  
  // Buy/Sell volume split (45-55% buy pressure)
  const buyRatio = 0.45 + randomFactor * 0.1;
  const buyVolume = totalVolume * buyRatio;
  const sellVolume = totalVolume * (1 - buyRatio);
  
  return {
    instrument,
    timestamp: new Date().toISOString(),
    volumeProfile: {
      totalVolume,
      averageVolume,
      volumeRatio: totalVolume / averageVolume,
      volumeTrend: randomFactor > 0.6 ? 'INCREASING' : randomFactor < 0.4 ? 'DECREASING' : 'STABLE',
      volumeSpikes: [],
      volumeByPriceLevel: [],
    },
    orderFlow: {
      buyVolume,
      sellVolume,
      buyVsSellRatio: buyVolume / sellVolume,
      netOrderFlow: buyVolume - sellVolume,
      orderFlowTrend: buyRatio > 0.52 ? 'BULLISH' : buyRatio < 0.48 ? 'BEARISH' : 'NEUTRAL',
      largeOrders: [],
      aggressiveness: Math.round(3 + randomFactor * 4), // 3-7
    },
    institutionalActivity: {
      darkPoolActivity: {
        volume: totalVolume * (0.15 + randomFactor * 0.15), // 15-30% dark pool
        percentage: 15 + randomFactor * 15,
        trend: 'STABLE',
      },
      blockTrades: [],
      smartMoneyIndex: Math.round(4 + randomFactor * 2), // 4-6
      institutionalSentiment: buyRatio > 0.52 ? 'BULLISH' : buyRatio < 0.48 ? 'BEARISH' : 'NEUTRAL',
      confidence: Math.round(40 + randomFactor * 30), // 40-70% confidence
    },
    marketManipulation: {
      spoofingDetected: false,
      washTrading: false,
      stopHunting: false,
      manipulationScore: Math.round(randomFactor * 3), // 0-3 (low)
      manipulationDetails: 'No significant manipulation detected',
    },
    fluxScore: Math.round(4 + randomFactor * 3), // 4-7/10 (neutral to slightly positive)
    bias: buyRatio > 0.52 ? 'BULLISH' : buyRatio < 0.48 ? 'BEARISH' : 'NEUTRAL',
    confidence: Math.round(50 + randomFactor * 20), // 50-70% (moderate confidence for mock data)
    keyInsights: [
      'Analysis based on simulated market data',
      `Volume trend: ${randomFactor > 0.6 ? 'Increasing' : randomFactor < 0.4 ? 'Decreasing' : 'Stable'}`,
      `Order flow: ${buyRatio > 0.52 ? 'Net buying pressure' : buyRatio < 0.48 ? 'Net selling pressure' : 'Balanced'}`
    ],
    warnings: ['Using simulated data - configure real market data API for accurate analysis'],
    nextUpdate: new Date(Date.now() + 3600000).toISOString(), // +1 hour
  };
}

/**
 * Calculate flux score from analysis components
 */
export function calculateFluxScore(analysis: Partial<InstitutionalFluxAnalysis>): number {
  if (!analysis.volumeProfile || !analysis.orderFlow || !analysis.institutionalActivity) {
    return 0;
  }

  // Weighted components
  const volumeWeight = 0.3;
  const orderFlowWeight = 0.4;
  const institutionalWeight = 0.3;

  // Volume score (based on volume ratio and spikes)
  const volumeScore = Math.min(10, (analysis.volumeProfile.volumeRatio - 1) * 5);

  // Order flow score (based on aggressiveness)
  const orderFlowScore = analysis.orderFlow.aggressiveness;

  // Institutional score (based on smart money index)
  const institutionalScore = Math.abs(analysis.institutionalActivity.smartMoneyIndex);

  // Weighted average
  const fluxScore = 
    volumeScore * volumeWeight +
    orderFlowScore * orderFlowWeight +
    institutionalScore * institutionalWeight;

  return Math.max(0, Math.min(10, fluxScore));
}

// ============================================================================
// Export Constants
// ============================================================================

export const FLUX_ANALYSIS_CACHE_TTL = 300; // 5 minutes (as per PRÉ-8 requirements)
export const FLUX_ANALYSIS_RATE_LIMIT = 10; // 10 requests per second max
export const FLUX_ANALYSIS_TIMEOUT = 3000; // 3 seconds max (p95 requirement)
