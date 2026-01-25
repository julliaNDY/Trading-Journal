/**
 * Technical Structure Analysis Service
 * 
 * Step 5/6 of Daily Bias Analysis
 * Provides technical structure analysis using Polygon.io chart data and AI prompts
 * 
 * @module services/daily-bias/technical-analysis-service
 * @created 2026-01-18
 */

import { generateAIResponse, type AIMessage } from '@/lib/ai-provider';
import {
  TECHNICAL_STRUCTURE_SYSTEM_PROMPT,
  generateTechnicalStructurePrompt,
  validateTechnicalStructureOutput,
  parseTechnicalStructureResponse,
  type TechnicalDataInput,
  type TechnicalStructureOutput,
  type PriceBar,
  type TechnicalIndicators,
} from '@/lib/prompts/technical-structure';
import { PolygonProvider } from '@/services/market-data/polygon-provider';
import { logger } from '@/lib/logger';
import { getRedisConnection, isRedisConfigured } from '@/lib/queue/redis';
import type { TechnicalStructure } from '@/types/daily-bias';
import type { Bar } from '@/services/market-data/types';

// ============================================================================
// Types
// ============================================================================

export interface TechnicalAnalysisParams {
  instrument: string;
  timeframe?: 'daily' | '4h' | '1h' | '15m';
  analysisDate?: string; // ISO date string (YYYY-MM-DD)
  currentPrice?: number; // Optional: current price if available
  userContext?: string;
  useCache?: boolean;
}

export interface TechnicalAnalysisResult {
  analysis: TechnicalStructure;
  cached: boolean;
  latencyMs: number;
  provider: string;
  model: string;
}

const TECHNICAL_ANALYSIS_CACHE_TTL = 300; // 5 minutes
const TECHNICAL_ANALYSIS_TIMEOUT = 30000; // 30 seconds
const REQUIRED_BARS = 20; // Minimum bars needed for technical analysis

// ============================================================================
// Cache Functions
// ============================================================================

function getCacheKey(instrument: string, timeframe: string, date: string): string {
  return `technical:${instrument}:${timeframe}:${date}`;
}

async function getCachedAnalysis(
  instrument: string,
  timeframe: string,
  date: string
): Promise<TechnicalAnalysisResult | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  try {
    const redis = await getRedisConnection();
    const cacheKey = getCacheKey(instrument, timeframe, date);
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      const analysis: TechnicalStructure = JSON.parse(cached);
      return {
        analysis,
        cached: true,
        latencyMs: 0,
        provider: 'cache',
        model: 'cache'
      };
    }
  } catch (error) {
    logger.warn('Failed to get cached technical analysis', {
      instrument,
      timeframe,
      date,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  return null;
}

async function cacheAnalysis(
  instrument: string,
  timeframe: string,
  date: string,
  analysis: TechnicalStructure
): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  try {
    const redis = await getRedisConnection();
    const cacheKey = getCacheKey(instrument, timeframe, date);
    await redis.setex(cacheKey, TECHNICAL_ANALYSIS_CACHE_TTL, JSON.stringify(analysis));
    
    logger.debug('Technical analysis cached', {
      instrument,
      timeframe,
      date,
      cacheKey,
      ttl: TECHNICAL_ANALYSIS_CACHE_TTL
    });
  } catch (error) {
    logger.warn('Failed to cache technical analysis', {
      instrument,
      timeframe,
      date,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// ============================================================================
// Chart Data Fetching
// ============================================================================

/**
 * Fetch historical bars from Polygon.io with automatic lookback fallback
 * 
 * FAIL-SAFE: If today's data returns empty/minimal (e.g., before market open),
 * automatically fallback to fetch previous day's data.
 * NEVER pass empty datasets to the AI.
 */
async function fetchHistoricalBars(
  symbol: string,
  timeframe: 'daily' | '4h' | '1h' | '15m',
  daysBack: number = 30,
  lookbackAttempt: number = 0
): Promise<Bar[]> {
  const MAX_LOOKBACK_ATTEMPTS = 3; // Try up to 3 days back
  const MIN_BARS_THRESHOLD = 10; // Minimum bars to consider data valid
  
  try {
    const polygon = new PolygonProvider();
    
    if (!polygon.isConfigured()) {
      logger.warn('Polygon API key not configured for technical analysis');
      return [];
    }

    // Map timeframe to Polygon format
    const polygonTimeframe: '1day' | '4hour' | '1hour' | '15min' = 
      timeframe === 'daily' ? '1day' :
      timeframe === '4h' ? '4hour' :
      timeframe === '1h' ? '1hour' : '15min';

    // Calculate date range with lookback offset
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - lookbackAttempt); // Apply lookback offset
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - daysBack);

    logger.debug('Fetching historical bars from Polygon', {
      symbol,
      timeframe: polygonTimeframe,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      lookbackAttempt
    });

    const response = await polygon.getBars({
      symbol,
      timeframe: polygonTimeframe,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      limit: REQUIRED_BARS + 10, // Get extra bars for safety
      adjusted: true
    });

    const bars = response.bars || [];
    
    // FAIL-SAFE: If bars are insufficient and we haven't exhausted lookback attempts
    if (bars.length < MIN_BARS_THRESHOLD && lookbackAttempt < MAX_LOOKBACK_ATTEMPTS) {
      logger.warn('Insufficient bars received, attempting lookback fallback', {
        symbol,
        barsReceived: bars.length,
        minRequired: MIN_BARS_THRESHOLD,
        currentAttempt: lookbackAttempt,
        nextAttempt: lookbackAttempt + 1
      });
      
      // Recursive call with incremented lookback
      return fetchHistoricalBars(symbol, timeframe, daysBack, lookbackAttempt + 1);
    }
    
    if (lookbackAttempt > 0 && bars.length >= MIN_BARS_THRESHOLD) {
      logger.info('Lookback fallback successful', {
        symbol,
        lookbackDays: lookbackAttempt,
        barsReceived: bars.length
      });
    }

    return bars;
  } catch (error) {
    logger.error('Failed to fetch historical bars from Polygon', {
      symbol,
      timeframe,
      lookbackAttempt,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // FAIL-SAFE: If error and lookback attempts remain, try again
    if (lookbackAttempt < MAX_LOOKBACK_ATTEMPTS) {
      logger.warn('Retrying with lookback due to error', {
        symbol,
        nextAttempt: lookbackAttempt + 1
      });
      return fetchHistoricalBars(symbol, timeframe, daysBack, lookbackAttempt + 1);
    }
    
    return [];
  }
}

/**
 * Transform Polygon bars to PriceBar format for prompts
 */
function transformBarsToPriceBars(bars: Bar[]): PriceBar[] {
  return bars.map(bar => ({
    timestamp: bar.datetime || new Date(bar.timestamp).toISOString(),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume || 0
  }));
}

/**
 * Calculate basic technical indicators from price bars
 * Simple calculations that don't require external libraries
 */
function calculateBasicIndicators(bars: PriceBar[]): TechnicalIndicators {
  if (bars.length < 20) {
    return {}; // Not enough data
  }

  const closes = bars.map(b => b.close);
  const volumes = bars.map(b => b.volume);
  
  // Simple Moving Averages
  const sma20 = closes.slice(-20).reduce((sum, c) => sum + c, 0) / 20;
  const sma50 = closes.length >= 50 ? closes.slice(-50).reduce((sum, c) => sum + c, 0) / 50 : undefined;
  const sma200 = closes.length >= 200 ? closes.slice(-200).reduce((sum, c) => sum + c, 0) / 200 : undefined;

  // Calculate RSI (simplified, 14-period)
  let rsi: number | undefined;
  if (closes.length >= 15) {
    const gains: number[] = [];
    const losses: number[] = [];
    
    for (let i = closes.length - 14; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) {
        gains.push(change);
        losses.push(0);
      } else {
        gains.push(0);
        losses.push(Math.abs(change));
      }
    }
    
    const avgGain = gains.reduce((sum, g) => sum + g, 0) / 14;
    const avgLoss = losses.reduce((sum, l) => sum + l, 0) / 14;
    
    if (avgLoss > 0) {
      const rs = avgGain / avgLoss;
      rsi = 100 - (100 / (1 + rs));
    }
  }

  // Average True Range (simplified, 14-period)
  let atr: number | undefined;
  if (bars.length >= 15) {
    const trueRanges: number[] = [];
    for (let i = bars.length - 14; i < bars.length; i++) {
      const highLow = bars[i].high - bars[i].low;
      const highPrevClose = Math.abs(bars[i].high - bars[i - 1].close);
      const lowPrevClose = Math.abs(bars[i].low - bars[i - 1].close);
      trueRanges.push(Math.max(highLow, highPrevClose, lowPrevClose));
    }
    atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / 14;
  }

  // Volume average
  const avgVolume = volumes.slice(-20).reduce((sum, v) => sum + v, 0) / 20;

  return {
    sma20,
    sma50,
    sma200,
    rsi,
    atr
  };
}

// ============================================================================
// Main Service Functions
// ============================================================================

/**
 * Analyze technical structure for an instrument
 * 
 * 1. Fetch historical bars from Polygon.io
 * 2. Transform to PriceBar format
 * 3. Calculate basic indicators (optional)
 * 4. Generate AI analysis prompt
 * 5. Call AI API
 * 6. Parse and validate response
 * 7. Transform to TechnicalStructure type
 */
export async function analyzeTechnicalStructure(
  params: TechnicalAnalysisParams
): Promise<TechnicalAnalysisResult> {
  const startTime = Date.now();
  const analysisDate = params.analysisDate || new Date().toISOString().split('T')[0];
  const timeframe = params.timeframe || 'daily';
  const useCache = params.useCache !== false;
  
  logger.info('Starting technical structure analysis', {
    instrument: params.instrument,
    timeframe,
    analysisDate
  });

  try {
    // 1. Check cache
    if (useCache) {
      const cached = await getCachedAnalysis(params.instrument, timeframe, analysisDate);
      if (cached) {
        logger.info('Technical analysis cache hit', {
          instrument: params.instrument,
          timeframe,
          analysisDate
        });
        return {
          ...cached,
          latencyMs: Date.now() - startTime
        };
      }
    }

    // 2. Fetch historical bars from Polygon.io
    logger.debug('Fetching historical bars', {
      instrument: params.instrument,
      timeframe
    });

    const bars = await fetchHistoricalBars(params.instrument, timeframe, 30);
    
    if (bars.length < REQUIRED_BARS) {
      logger.warn('Insufficient historical bars for technical analysis', {
        instrument: params.instrument,
        barsReceived: bars.length,
        required: REQUIRED_BARS
      });
      // Return empty analysis as fallback
      return {
        analysis: createEmptyTechnicalAnalysis(params.instrument, analysisDate),
        cached: false,
        latencyMs: Date.now() - startTime,
        provider: 'fallback',
        model: 'none'
      };
    }

    // 3. Transform bars to PriceBar format
    const priceBars = transformBarsToPriceBars(bars);
    
    // 4. Calculate basic indicators
    const indicators = calculateBasicIndicators(priceBars);

    logger.debug('Historical bars fetched and processed', {
      instrument: params.instrument,
      barCount: priceBars.length,
      hasIndicators: Object.keys(indicators).length > 0
    });

    // 5. Build input for AI prompt
    const technicalInput: TechnicalDataInput = {
      priceData: priceBars,
      indicators: Object.keys(indicators).length > 0 ? indicators : undefined,
      instrument: params.instrument,
      timeframe,
      analysisDate,
      userContext: params.userContext
    };

    // 6. Generate AI prompt
    const userPrompt = generateTechnicalStructurePrompt(technicalInput);
    
    // 7. Call AI API
    logger.debug('Calling AI for technical analysis', {
      instrument: params.instrument,
      barCount: priceBars.length
    });

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: TECHNICAL_STRUCTURE_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: userPrompt
      }
    ];

    const aiResponse = await generateAIResponse(messages, {
      preferredProvider: 'gemini',
      fallbackEnabled: true,
      temperature: 0.4, // Slightly higher for technical interpretation
      maxTokens: 2500,
    });

    logger.info('AI response received for technical analysis', {
      instrument: params.instrument,
      provider: aiResponse.provider,
      model: aiResponse.model,
      latencyMs: aiResponse.latencyMs
    });

    // 8. Parse and validate AI response
    const parsedOutput = parseTechnicalStructureResponse(aiResponse.content);
    
    if (!validateTechnicalStructureOutput(parsedOutput)) {
      throw new Error('Invalid technical structure output from AI');
    }

    // 9. Transform to TechnicalStructure type (include calculated indicators)
    const technicalAnalysis: TechnicalStructure = transformToTechnicalStructure(
      parsedOutput,
      params.instrument,
      analysisDate,
      indicators // Pass calculated indicators to be included in output
    );

    // 10. Cache result
    if (useCache) {
      await cacheAnalysis(params.instrument, timeframe, analysisDate, technicalAnalysis);
    }

    const latencyMs = Date.now() - startTime;

    logger.info('Technical structure analysis completed', {
      instrument: params.instrument,
      timeframe,
      analysisDate,
      latencyMs,
      bias: technicalAnalysis.analysis?.summary || 'neutral',
      technicalScore: technicalAnalysis.technicalScore
    });

    return {
      analysis: technicalAnalysis,
      cached: false,
      latencyMs,
      provider: aiResponse.provider,
      model: aiResponse.model
    };
  } catch (error) {
    logger.error('Technical structure analysis failed', {
      instrument: params.instrument,
      timeframe,
      analysisDate,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startTime
    });
    throw error;
  }
}

// ============================================================================
// Transformation Functions
// ============================================================================

/**
 * Transform TechnicalStructureOutput to TechnicalStructure type
 */
function transformToTechnicalStructure(
  output: TechnicalStructureOutput,
  instrument: string,
  analysisDate: string,
  calculatedIndicators?: TechnicalIndicators
): TechnicalStructure {
  // Transform support levels
  const supportLevels = output.supportLevels.map(level => ({
    price: level.level,
    strength: mapStrengthToNumber(level.strength),
    type: 'SUPPORT' as const,
    testedCount: level.strength === 'strong' ? 3 : level.strength === 'moderate' ? 2 : 1
  }));

  // Transform resistance levels
  const resistanceLevels = output.resistanceLevels.map(level => ({
    price: level.level,
    strength: mapStrengthToNumber(level.strength),
    type: 'RESISTANCE' as const,
    testedCount: level.strength === 'strong' ? 3 : level.strength === 'moderate' ? 2 : 1
  }));

  // Transform trend
  const trendDirection = output.trend.direction === 'uptrend' ? 'UP' :
                        output.trend.direction === 'downtrend' ? 'DOWN' : 'NEUTRAL';
  
  const trend = {
    direction: trendDirection as 'UP' | 'DOWN' | 'NEUTRAL',
    strength: mapStrengthToNumber(output.trend.strength),
    timeframe: '1d' as const, // Default to daily
    maPrices: {
      ma20: undefined, // Can be filled from indicators if available
      ma50: undefined,
      ma200: undefined
    }
  };

  // Calculate overall technical score (average of components)
  const technicalScore = output.technicalScore.overall || 
    (output.technicalScore.trend + output.technicalScore.momentum + 
     output.technicalScore.volatility + output.technicalScore.volume + 
     output.technicalScore.structure) / 5;

  // Build indicators array from calculated indicators for UI display
  const indicatorsArray: Array<{ name: string; value: number; signal?: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL' }> = [];
  
  if (calculatedIndicators) {
    // Add RSI with signal
    if (calculatedIndicators.rsi !== undefined) {
      indicatorsArray.push({
        name: 'RSI(14)',
        value: calculatedIndicators.rsi,
        signal: calculatedIndicators.rsi > 70 ? 'BEARISH_CROSS' : calculatedIndicators.rsi < 30 ? 'BULLISH_CROSS' : 'NEUTRAL'
      });
    }
    
    // Add SMA 20
    if (calculatedIndicators.sma20 !== undefined) {
      indicatorsArray.push({
        name: 'SMA(20)',
        value: calculatedIndicators.sma20,
        signal: 'NEUTRAL'
      });
    }
    
    // Add SMA 50
    if (calculatedIndicators.sma50 !== undefined) {
      indicatorsArray.push({
        name: 'SMA(50)',
        value: calculatedIndicators.sma50,
        signal: 'NEUTRAL'
      });
    }
    
    // Add SMA 200
    if (calculatedIndicators.sma200 !== undefined) {
      indicatorsArray.push({
        name: 'SMA(200)',
        value: calculatedIndicators.sma200,
        signal: 'NEUTRAL'
      });
    }
    
    // Add ATR
    if (calculatedIndicators.atr !== undefined) {
      indicatorsArray.push({
        name: 'ATR(14)',
        value: calculatedIndicators.atr,
        signal: 'NEUTRAL'
      });
    }
  }

  return {
    supportLevels: supportLevels as any,
    resistanceLevels: resistanceLevels as any,
    trend: trend as any,
    technicalScore: Math.round(technicalScore * 10) / 10, // Round to 1 decimal
    analysis: {
      summary: output.summary,
      patterns: output.keySignals.map(signal => ({
        pattern: signal,
        bullish: signal.toLowerCase().includes('bull') || signal.toLowerCase().includes('breakout')
      })),
      rsi: calculatedIndicators?.rsi, // Fill from calculated indicators
      macd: undefined
    },
    // Include calculated indicators for UI display
    indicators: indicatorsArray.length > 0 ? indicatorsArray : undefined,
    // Include keyDrivers if present (Transparency Enhancement)
    keyDrivers: output.keyDrivers || [],
    timestamp: new Date().toISOString(),
    instrument
  };
}

/**
 * Map strength string to number (0-1)
 */
function mapStrengthToNumber(strength: 'strong' | 'moderate' | 'weak'): number {
  switch (strength) {
    case 'strong':
      return 0.8;
    case 'moderate':
      return 0.5;
    case 'weak':
      return 0.3;
    default:
      return 0.5;
  }
}

/**
 * Create empty technical analysis as fallback
 */
function createEmptyTechnicalAnalysis(
  instrument: string,
  date: string
): TechnicalStructure {
  return {
    supportLevels: [],
    resistanceLevels: [],
    trend: {
      direction: 'SIDEWAYS',
      strength: 0.5,
      timeframe: '1d'
    },
    technicalScore: 5.0, // Neutral
    analysis: {
      summary: 'Insufficient historical data for technical analysis. Analysis skipped.'
    },
    timestamp: new Date().toISOString(),
    instrument
  } as unknown as TechnicalStructure;
}
