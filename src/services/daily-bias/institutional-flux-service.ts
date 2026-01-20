/**
 * Institutional Flux Analysis Service
 * 
 * Step 3/6 of Daily Bias Analysis
 * Provides institutional flux analysis using AI prompts
 * 
 * @module services/daily-bias/institutional-flux-service
 * @created 2026-01-17
 * @author Dev 50, Dev 51 (PRÉ-8.3)
 */

import { generateAIResponse, type AIMessage } from '@/lib/ai-provider';
import {
  INSTITUTIONAL_FLUX_SYSTEM_PROMPT,
  generateInstitutionalFluxPrompt,
  generateSimplifiedFluxPrompt,
  validateInstitutionalFluxAnalysis,
  createEmptyFluxAnalysis,
  calculateFluxScore,
  FLUX_ANALYSIS_CACHE_TTL,
  FLUX_ANALYSIS_TIMEOUT,
  type InstitutionalFluxAnalysis,
} from '@/lib/prompts/institutional-flux';
import { logger } from '@/lib/logger';
import { Redis } from '@upstash/redis';

// ============================================================================
// Types
// ============================================================================

export interface FluxAnalysisParams {
  instrument: string;
  marketData: {
    currentPrice: number;
    priceChange24h: number;
    volume24h: number;
    averageVolume20d: number;
    high24h: number;
    low24h: number;
  };
  volumeData?: {
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
  useCache?: boolean;
}

export interface FluxAnalysisResult {
  analysis: InstitutionalFluxAnalysis;
  cached: boolean;
  latencyMs: number;
  provider: string;
  model: string;
}

// ============================================================================
// Redis Cache Setup
// ============================================================================

let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redis) return redis;
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    logger.warn('Redis not configured for institutional flux cache');
    return null;
  }
  
  redis = new Redis({ url, token });
  return redis;
}

function getCacheKey(instrument: string, timeframe: string): string {
  return `flux:${instrument}:${timeframe}:${new Date().toISOString().split('T')[0]}`;
}

// ============================================================================
// Main Service Functions
// ============================================================================

/**
 * Analyze institutional flux for an instrument
 */
export async function analyzeInstitutionalFlux(
  params: FluxAnalysisParams
): Promise<FluxAnalysisResult> {
  const startTime = performance.now();
  const { instrument, useCache = true, timeframe = '1d' } = params;

  try {
    // Check cache first
    if (useCache) {
      const cached = await getCachedAnalysis(instrument, timeframe);
      if (cached) {
        logger.info(`Institutional flux cache HIT for ${instrument}`);
        return {
          analysis: cached,
          cached: true,
          latencyMs: performance.now() - startTime,
          provider: 'cache',
          model: 'cache',
        };
      }
    }

    logger.info(`Generating institutional flux analysis for ${instrument}`);

    // Generate prompt based on available data
    const userPrompt = params.volumeData && params.volumeData.length > 0
      ? generateInstitutionalFluxPrompt(params as any)
      : generateSimplifiedFluxPrompt({
          instrument: params.instrument,
          currentPrice: params.marketData.currentPrice,
          volume24h: params.marketData.volume24h,
          averageVolume20d: params.marketData.averageVolume20d,
          priceChange24h: params.marketData.priceChange24h,
        });

    // Prepare messages
    const messages: AIMessage[] = [
      { role: 'system', content: INSTITUTIONAL_FLUX_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    // Call AI with timeout
    const aiResponse = await Promise.race([
      generateAIResponse(messages, {
        preferredProvider: 'gemini',
        fallbackEnabled: true,
        temperature: 0.3, // Lower temperature for more consistent analysis
        maxTokens: 2000,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Flux analysis timeout')), FLUX_ANALYSIS_TIMEOUT)
      ),
    ]);

    // Parse and validate response
    let analysis: InstitutionalFluxAnalysis;
    try {
      const parsed = JSON.parse(aiResponse.content);
      analysis = validateInstitutionalFluxAnalysis(parsed);
      
      // Calculate flux score if not provided or seems incorrect
      if (!analysis.fluxScore || analysis.fluxScore === 0) {
        analysis.fluxScore = calculateFluxScore(analysis);
      }
    } catch (parseError) {
      logger.error('Failed to parse institutional flux response', { error: parseError });
      throw new Error('Invalid AI response format');
    }

    // Cache the result
    if (useCache) {
      await cacheAnalysis(instrument, timeframe, analysis);
    }

    const latencyMs = performance.now() - startTime;

    logger.info(`Institutional flux analysis completed for ${instrument}`, {
      latencyMs,
      provider: aiResponse.provider,
      fluxScore: analysis.fluxScore,
      bias: analysis.bias,
    });

    return {
      analysis,
      cached: false,
      latencyMs,
      provider: aiResponse.provider,
      model: aiResponse.model,
    };
  } catch (error) {
    logger.error('Institutional flux analysis failed', { error, instrument });

    // Return empty analysis as fallback
    const latencyMs = performance.now() - startTime;
    return {
      analysis: createEmptyFluxAnalysis(instrument),
      cached: false,
      latencyMs,
      provider: 'fallback',
      model: 'none',
    };
  }
}

/**
 * Get cached analysis if available
 */
async function getCachedAnalysis(
  instrument: string,
  timeframe: string
): Promise<InstitutionalFluxAnalysis | null> {
  try {
    const client = getRedisClient();
    if (!client) return null;

    const key = getCacheKey(instrument, timeframe);
    const cached = await client.get<InstitutionalFluxAnalysis>(key);

    if (cached) {
      // Validate cached data
      return validateInstitutionalFluxAnalysis(cached);
    }

    return null;
  } catch (error) {
    logger.warn('Failed to get cached flux analysis', { error });
    return null;
  }
}

/**
 * Cache analysis result
 */
async function cacheAnalysis(
  instrument: string,
  timeframe: string,
  analysis: InstitutionalFluxAnalysis
): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;

    const key = getCacheKey(instrument, timeframe);
    await client.setex(key, FLUX_ANALYSIS_CACHE_TTL, analysis);

    logger.debug(`Cached flux analysis for ${instrument}`, { ttl: FLUX_ANALYSIS_CACHE_TTL });
  } catch (error) {
    logger.warn('Failed to cache flux analysis', { error });
  }
}

/**
 * Invalidate cache for an instrument
 */
export async function invalidateFluxCache(instrument: string): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;

    const timeframes = ['1h', '4h', '1d'];
    const keys = timeframes.map(tf => getCacheKey(instrument, tf));

    await Promise.all(keys.map(key => client.del(key)));

    logger.info(`Invalidated flux cache for ${instrument}`);
  } catch (error) {
    logger.warn('Failed to invalidate flux cache', { error });
  }
}

/**
 * Batch analyze multiple instruments
 */
export async function batchAnalyzeFlux(
  instruments: string[],
  getMarketData: (instrument: string) => Promise<FluxAnalysisParams['marketData']>
): Promise<Map<string, FluxAnalysisResult>> {
  const results = new Map<string, FluxAnalysisResult>();

  // Process in parallel with rate limiting (max 10 concurrent)
  const batchSize = 10;
  for (let i = 0; i < instruments.length; i += batchSize) {
    const batch = instruments.slice(i, i + batchSize);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (instrument) => {
        const marketData = await getMarketData(instrument);
        const result = await analyzeInstitutionalFlux({
          instrument,
          marketData,
          useCache: true,
        });
        return { instrument, result };
      })
    );

    for (const outcome of batchResults) {
      if (outcome.status === 'fulfilled') {
        results.set(outcome.value.instrument, outcome.value.result);
      } else {
        logger.error('Batch flux analysis failed', { error: outcome.reason });
      }
    }

    // Small delay between batches to respect rate limits
    if (i + batchSize < instruments.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get flux analysis summary (for dashboard display)
 */
export function getFluxSummary(analysis: InstitutionalFluxAnalysis): {
  score: number;
  bias: string;
  confidence: number;
  topInsight: string;
  warningLevel: 'LOW' | 'MEDIUM' | 'HIGH';
} {
  const warningLevel = 
    analysis.marketManipulation.manipulationScore >= 7 ? 'HIGH' :
    analysis.marketManipulation.manipulationScore >= 4 ? 'MEDIUM' : 'LOW';

  return {
    score: analysis.fluxScore,
    bias: analysis.bias,
    confidence: analysis.confidence,
    topInsight: analysis.keyInsights[0] || 'No insights available',
    warningLevel,
  };
}

/**
 * Compare flux analysis across multiple timeframes
 */
export function compareFluxAcrossTimeframes(
  analyses: { timeframe: string; analysis: InstitutionalFluxAnalysis }[]
): {
  consensus: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'DIVERGENT';
  strength: number;
  divergences: string[];
} {
  if (analyses.length === 0) {
    return { consensus: 'NEUTRAL', strength: 0, divergences: [] };
  }

  const biases = analyses.map(a => a.analysis.bias);
  const bullishCount = biases.filter(b => b === 'BULLISH').length;
  const bearishCount = biases.filter(b => b === 'BEARISH').length;
  const neutralCount = biases.filter(b => b === 'NEUTRAL').length;

  const total = analyses.length;
  const divergences: string[] = [];

  // Check for consensus
  if (bullishCount === total) {
    return { consensus: 'BULLISH', strength: 10, divergences: [] };
  } else if (bearishCount === total) {
    return { consensus: 'BEARISH', strength: 10, divergences: [] };
  } else if (neutralCount === total) {
    return { consensus: 'NEUTRAL', strength: 5, divergences: [] };
  }

  // Check for majority (need at least 50% for consensus, but if all three types exist, it's divergent)
  const maxCount = Math.max(bullishCount, bearishCount, neutralCount);
  const strength = (maxCount / total) * 10;
  
  // If all three bias types exist (bullish, bearish, neutral), it's divergent
  const typesPresent = [bullishCount > 0, bearishCount > 0, neutralCount > 0].filter(Boolean).length;
  if (typesPresent === 3) {
    divergences.push(`Mixed signals: ${bullishCount} bullish, ${bearishCount} bearish, ${neutralCount} neutral`);
    return { consensus: 'DIVERGENT', strength: 0, divergences };
  }
  
  // If no clear majority (< 50%), it's divergent
  const consensusThreshold = Math.ceil(total / 2); // 50% threshold
  if (maxCount < consensusThreshold) {
    divergences.push(`Mixed signals: ${bullishCount} bullish, ${bearishCount} bearish, ${neutralCount} neutral`);
    return { consensus: 'DIVERGENT', strength: 0, divergences };
  }

  if (bullishCount === maxCount) {
    if (bearishCount > 0) {
      divergences.push(`${bearishCount} timeframe(s) show bearish bias`);
    }
    return { consensus: 'BULLISH', strength, divergences };
  } else if (bearishCount === maxCount) {
    if (bullishCount > 0) {
      divergences.push(`${bullishCount} timeframe(s) show bullish bias`);
    }
    return { consensus: 'BEARISH', strength, divergences };
  }

  // Neutral majority
  return { consensus: 'NEUTRAL', strength, divergences };
}
