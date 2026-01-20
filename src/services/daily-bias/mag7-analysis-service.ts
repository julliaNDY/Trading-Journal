/**
 * Mag 7 Leaders Analysis Service
 * 
 * Step 4/6 of Daily Bias Analysis
 * Provides Mag 7 leaders correlation analysis using Polygon.io stock data and AI prompts
 * 
 * @module services/daily-bias/mag7-analysis-service
 * @created 2026-01-18
 */

import { generateAIResponse, type AIMessage } from '@/lib/ai-provider';
import {
  MAG7_ANALYSIS_SYSTEM_PROMPT,
  generateMag7AnalysisPrompt,
  validateMag7AnalysisOutput,
  parseMag7AnalysisResponse,
  type Mag7DataInput,
  type Mag7AnalysisOutput,
} from '@/lib/prompts/mag7-analysis-prompt';
import {
  fetchMag7StockData,
  calculateMag7Correlation,
} from '@/services/stock/stock-service';
import { logger } from '@/lib/logger';
import { getRedisConnection, isRedisConfigured } from '@/lib/queue/redis';
import type { Mag7Analysis } from '@/types/daily-bias';
import { MAG7_SYMBOLS } from '@/types/daily-bias';

// ============================================================================
// Types
// ============================================================================

export interface Mag7AnalysisParams {
  instrument: string;
  instrumentData: {
    currentPrice: number;
    priceChangePercent: number;
    priceChange24h: number;
  };
  analysisDate?: string; // ISO date string (YYYY-MM-DD)
  userContext?: string;
  useCache?: boolean;
}

export interface Mag7AnalysisResult {
  analysis: Mag7Analysis;
  cached: boolean;
  latencyMs: number;
  provider: string;
  model: string;
}

const MAG7_ANALYSIS_CACHE_TTL = 300; // 5 minutes
const MAG7_ANALYSIS_TIMEOUT = 30000; // 30 seconds

// ============================================================================
// Cache Functions
// ============================================================================

function getCacheKey(instrument: string, date: string): string {
  return `mag7:${instrument}:${date}`;
}

async function getCachedAnalysis(
  instrument: string,
  date: string
): Promise<Mag7AnalysisResult | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  try {
    const redis = await getRedisConnection();
    const cacheKey = getCacheKey(instrument, date);
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      const analysis: Mag7Analysis = JSON.parse(cached);
      return {
        analysis,
        cached: true,
        latencyMs: 0,
        provider: 'cache',
        model: 'cache'
      };
    }
  } catch (error) {
    logger.warn('Failed to get cached Mag 7 analysis', {
      instrument,
      date,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  return null;
}

async function cacheAnalysis(
  instrument: string,
  date: string,
  analysis: Mag7Analysis
): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  try {
    const redis = await getRedisConnection();
    const cacheKey = getCacheKey(instrument, date);
    await redis.setex(cacheKey, MAG7_ANALYSIS_CACHE_TTL, JSON.stringify(analysis));
    
    logger.debug('Mag 7 analysis cached', {
      instrument,
      date,
      cacheKey,
      ttl: MAG7_ANALYSIS_CACHE_TTL
    });
  } catch (error) {
    logger.warn('Failed to cache Mag 7 analysis', {
      instrument,
      date,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// ============================================================================
// Main Service Functions
// ============================================================================

/**
 * Analyze Mag 7 leaders correlation for an instrument
 * 
 * 1. Fetch Mag 7 stock data from Polygon.io
 * 2. Calculate correlations
 * 3. Generate AI analysis prompt
 * 4. Call AI API
 * 5. Parse and validate response
 * 6. Transform to Mag7Analysis type
 */
export async function analyzeMag7Leaders(
  params: Mag7AnalysisParams
): Promise<Mag7AnalysisResult> {
  const startTime = Date.now();
  const analysisDate = params.analysisDate || new Date().toISOString().split('T')[0];
  const useCache = params.useCache !== false;
  
  logger.info('Starting Mag 7 leaders analysis', {
    instrument: params.instrument,
    analysisDate
  });

  try {
    // 1. Check cache
    if (useCache) {
      const cached = await getCachedAnalysis(params.instrument, analysisDate);
      if (cached) {
        logger.info('Mag 7 analysis cache hit', {
          instrument: params.instrument,
          analysisDate
        });
        return {
          ...cached,
          latencyMs: Date.now() - startTime
        };
      }
    }

    // 2. Fetch Mag 7 stock data from Polygon.io
    logger.debug('Fetching Mag 7 stock data', {
      instrument: params.instrument
    });

    const mag7StockData = await fetchMag7StockData();
    
    logger.info('Mag 7 stock data fetch result', {
      instrument: params.instrument,
      dataLength: mag7StockData.length,
      firstStock: mag7StockData[0] ? {
        symbol: mag7StockData[0].symbol,
        price: mag7StockData[0].currentPrice
      } : null
    });
    
    if (mag7StockData.length === 0) {
      logger.warn('No Mag 7 stock data available - using fallback', {
        instrument: params.instrument,
        reason: 'fetchMag7StockData returned empty array'
      });
      // Return empty analysis as fallback
      return {
        analysis: createEmptyMag7Analysis(params.instrument, analysisDate),
        cached: false,
        latencyMs: Date.now() - startTime,
        provider: 'fallback',
        model: 'none'
      };
    }

    // 3. Calculate correlations (simple calculation)
    const correlations = calculateMag7Correlation(
      {
        priceChangePercent: params.instrumentData.priceChangePercent,
        currentPrice: params.instrumentData.currentPrice
      },
      mag7StockData
    );

    logger.debug('Mag 7 stock data fetched', {
      instrument: params.instrument,
      mag7Count: mag7StockData.length,
      correlationsCount: correlations.length
    });

    // 4. Build input for AI prompt
    const mag7Input: Mag7DataInput = {
      instrument: params.instrument,
      instrumentData: params.instrumentData,
      mag7Data: mag7StockData.map(leader => ({
        symbol: leader.symbol,
        currentPrice: leader.currentPrice,
        priceChange: leader.priceChange,
        priceChangePercent: leader.priceChangePercent,
        volume: leader.volume,
        high: leader.high,
        low: leader.low,
        timestamp: leader.timestamp
      })),
      analysisDate,
      userContext: params.userContext
    };

    // 5. Generate AI prompt
    const userPrompt = generateMag7AnalysisPrompt(mag7Input);
    
    // 6. Call AI API
    logger.debug('Calling AI for Mag 7 analysis', {
      instrument: params.instrument,
      mag7Count: mag7StockData.length
    });

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: MAG7_ANALYSIS_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: userPrompt
      }
    ];

    const aiResponse = await generateAIResponse(messages, {
      preferredProvider: 'gemini',
      fallbackEnabled: true,
      temperature: 0.4, // Slightly higher for correlation interpretation
      maxTokens: 2000,
      timeout: MAG7_ANALYSIS_TIMEOUT
    });

    logger.info('AI response received for Mag 7 analysis', {
      instrument: params.instrument,
      provider: aiResponse.provider,
      model: aiResponse.model,
      latencyMs: aiResponse.latencyMs
    });

    // 7. Parse and validate AI response
    const parsedOutput = parseMag7AnalysisResponse(aiResponse.content);
    
    if (!validateMag7AnalysisOutput(parsedOutput)) {
      throw new Error('Invalid Mag 7 analysis output from AI');
    }

    // 8. Transform to Mag7Analysis type
    const mag7Analysis: Mag7Analysis = transformToMag7Analysis(
      parsedOutput,
      correlations,
      params.instrument,
      analysisDate
    );

    // 9. Cache result
    if (useCache) {
      await cacheAnalysis(params.instrument, analysisDate, mag7Analysis);
    }

    const latencyMs = Date.now() - startTime;

    logger.info('Mag 7 analysis completed', {
      instrument: params.instrument,
      analysisDate,
      latencyMs,
      sentiment: mag7Analysis.sentiment,
      leaderScore: mag7Analysis.leaderScore
    });

    return {
      analysis: mag7Analysis,
      cached: false,
      latencyMs,
      provider: aiResponse.provider,
      model: aiResponse.model
    };
  } catch (error) {
    logger.error('Mag 7 analysis failed', {
      instrument: params.instrument,
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
 * Transform Mag7AnalysisOutput to Mag7Analysis type
 */
function transformToMag7Analysis(
  output: Mag7AnalysisOutput,
  calculatedCorrelations: Array<{
    symbol: string;
    correlation: number;
    trend: 'UP' | 'DOWN' | 'INDETERMINATE';
    performancePercent: number;
    strength: number;
  }>,
  instrument: string,
  analysisDate: string
): Mag7Analysis {
  // Use AI output correlations (more refined) or fallback to calculated
  const correlations = output.correlations.map(aiCorr => {
    // Find matching calculated correlation
    const calcCorr = calculatedCorrelations.find(c => c.symbol === aiCorr.symbol);
    
    return {
      symbol: aiCorr.symbol,
      correlation: aiCorr.correlation,
      trend: aiCorr.trend,
      performancePercent: aiCorr.performancePercent,
      strength: aiCorr.strength
    };
  });

  return {
    correlations,
    leaderScore: Math.round(output.leaderScore * 10) / 10, // Round to 1 decimal
    sentiment: output.overallSentiment,
    analysis: {
      summary: output.summary,
      leaderDynamics: output.detailedAnalysis,
      groupSentiment: output.groupSentiments?.map(gs => ({
        category: gs.category,
        sentiment: gs.sentiment
      }))
    },
    timestamp: new Date().toISOString(),
    instrument
  };
}

/**
 * Create empty Mag 7 analysis as fallback
 */
function createEmptyMag7Analysis(
  instrument: string,
  date: string
): Mag7Analysis {
  return {
    correlations: MAG7_SYMBOLS.map(symbol => ({
      symbol,
      correlation: 0,
      trend: 'INDETERMINATE' as const,
      strength: 0
    })),
    leaderScore: 5.0, // Neutral
    sentiment: 'NEUTRAL',
    analysis: {
      summary: 'No Mag 7 data available. Analysis skipped.'
    },
    timestamp: new Date().toISOString(),
    instrument
  };
}
