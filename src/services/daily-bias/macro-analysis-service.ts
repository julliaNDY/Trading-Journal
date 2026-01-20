/**
 * Macro Analysis Service
 * 
 * Step 2/6 of Daily Bias Analysis
 * Provides macroeconomic analysis using ForexFactory events and AI prompts
 * 
 * @module services/daily-bias/macro-analysis-service
 * @created 2026-01-18
 */

import { generateAIResponse, type AIMessage } from '@/lib/ai-provider';
import {
  MACRO_ANALYSIS_SYSTEM_PROMPT,
  generateMacroAnalysisPrompt,
  validateMacroAnalysisOutput,
  parseMacroAnalysisResponse,
  type MacroDataInput,
  type EconomicEvent,
  type MacroAnalysisOutput,
} from '@/lib/prompts/macro-analysis-prompt';
import {
  fetchForexFactoryEvents,
  filterEventsByDateRange,
  filterEventsByImportance,
  filterEventsByInstrument,
} from '@/services/forexfactory/forexfactory-service';
import { logger } from '@/lib/logger';
import { getRedisConnection, isRedisConfigured } from '@/lib/queue/redis';
import type { MacroAnalysis } from '@/types/daily-bias';

// ============================================================================
// Types
// ============================================================================

export interface MacroAnalysisParams {
  instrument: string;
  analysisDate?: string; // ISO date string (YYYY-MM-DD)
  timeframe?: '1h' | '4h' | '1d';
  userContext?: string;
  useCache?: boolean;
}

export interface MacroAnalysisResult {
  analysis: MacroAnalysis;
  cached: boolean;
  latencyMs: number;
  provider: string;
  model: string;
}

const MACRO_ANALYSIS_CACHE_TTL = 300; // 5 minutes
const MACRO_ANALYSIS_TIMEOUT = 30000; // 30 seconds

// ============================================================================
// Redis Cache Setup
// ============================================================================

function getCacheKey(instrument: string, date: string): string {
  return `macro:${instrument}:${date}`;
}

// ============================================================================
// Main Service Functions
// ============================================================================

/**
 * Analyze macroeconomic context for an instrument
 * 
 * 1. Fetch economic events from ForexFactory
 * 2. Filter events relevant to instrument
 * 3. Generate AI analysis prompt
 * 4. Call AI API
 * 5. Parse and validate response
 * 6. Transform to MacroAnalysis type
 */
export async function analyzeMacroContext(
  params: MacroAnalysisParams
): Promise<MacroAnalysisResult> {
  const startTime = Date.now();
  const analysisDate = params.analysisDate || new Date().toISOString().split('T')[0];
  const useCache = params.useCache !== false;
  
  logger.info('Starting macro analysis', {
    instrument: params.instrument,
    analysisDate,
    timeframe: params.timeframe || '1d'
  });

  try {
    // 1. Check cache
    if (useCache) {
      const cached = await getCachedAnalysis(params.instrument, analysisDate);
      if (cached) {
        logger.info('Macro analysis cache hit', {
          instrument: params.instrument,
          analysisDate
        });
        return {
          ...cached,
          cached: true,
          latencyMs: Date.now() - startTime
        };
      }
    }

    // 2. Fetch economic events from ForexFactory
    logger.debug('Fetching ForexFactory events', {
      instrument: params.instrument
    });

    const allEvents = await fetchForexFactoryEvents();
    
    // 3. Filter events relevant to instrument
    const instrumentEvents = filterEventsByInstrument(allEvents, params.instrument);
    
    // 4. Filter by date range (include current week events - past 3 days to next 48 hours)
    const startDate = new Date(analysisDate);
    // Look back 3 days for recent events + forward 48 hours for upcoming
    const lookBackHours = 72; // 3 days back
    const lookAheadHours = params.timeframe === '1h' ? 24 : params.timeframe === '4h' ? 36 : 48;
    const rangeStart = new Date(startDate.getTime() - lookBackHours * 60 * 60 * 1000);
    const rangeEnd = new Date(startDate.getTime() + lookAheadHours * 60 * 60 * 1000);
    
    // Custom filter for extended date range
    const relevantEvents = instrumentEvents.filter(event => {
      try {
        const eventDate = new Date(event.time);
        return eventDate >= rangeStart && eventDate <= rangeEnd;
      } catch {
        return false;
      }
    });
    
    // 5. Filter by importance (at least medium impact)
    const importantEvents = filterEventsByImportance(relevantEvents, 'medium');
    
    logger.debug('Filtered economic events', {
      instrument: params.instrument,
      totalEvents: allEvents.length,
      instrumentEvents: instrumentEvents.length,
      relevantEvents: relevantEvents.length,
      importantEvents: importantEvents.length
    });

    // 6. Build input for AI prompt
    const macroInput: MacroDataInput = {
      economicEvents: importantEvents.map(transformToPromptEvent),
      instrument: params.instrument,
      analysisDate,
      userContext: params.userContext
    };

    // 7. Generate AI prompt
    const userPrompt = generateMacroAnalysisPrompt(macroInput);
    
    // 8. Call AI API
    logger.debug('Calling AI for macro analysis', {
      instrument: params.instrument,
      eventCount: importantEvents.length
    });

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: MACRO_ANALYSIS_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: userPrompt
      }
    ];

    const aiResponse = await generateAIResponse(messages, {
      preferredProvider: 'gemini',
      fallbackEnabled: true,
      temperature: 0.4, // Slightly higher for macro context interpretation
      maxTokens: 2000,
    });

    logger.info('AI response received for macro analysis', {
      instrument: params.instrument,
      provider: aiResponse.provider,
      model: aiResponse.model,
      latencyMs: aiResponse.latencyMs
    });

    // 9. Parse and validate AI response
    const parsedOutput = parseMacroAnalysisResponse(aiResponse.content);
    
    if (!validateMacroAnalysisOutput(parsedOutput)) {
      throw new Error('Invalid macro analysis output from AI');
    }

    // 10. Transform to MacroAnalysis type
    const macroAnalysis: MacroAnalysis = transformToMacroAnalysis(
      parsedOutput,
      importantEvents,
      params.instrument,
      analysisDate
    );

    // 11. Cache result
    if (useCache) {
      await cacheAnalysis(params.instrument, analysisDate, macroAnalysis);
    }

    const latencyMs = Date.now() - startTime;

    logger.info('Macro analysis completed', {
      instrument: params.instrument,
      analysisDate,
      latencyMs,
      sentiment: macroAnalysis.sentiment,
      macroScore: macroAnalysis.macroScore
    });

    return {
      analysis: macroAnalysis,
      cached: false,
      latencyMs,
      provider: aiResponse.provider,
      model: aiResponse.model
    };
  } catch (error) {
    logger.error('Macro analysis failed', {
      instrument: params.instrument,
      analysisDate,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startTime
    });
    throw error;
  }
}

// ============================================================================
// Cache Functions
// ============================================================================

async function getCachedAnalysis(
  instrument: string,
  date: string
): Promise<MacroAnalysisResult | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  try {
    const redis = await getRedisConnection();
    const cacheKey = getCacheKey(instrument, date);
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      const analysis: MacroAnalysis = JSON.parse(cached);
      return {
        analysis,
        cached: true,
        latencyMs: 0,
        provider: 'cache',
        model: 'cache'
      };
    }
  } catch (error) {
    logger.warn('Failed to get cached macro analysis', {
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
  analysis: MacroAnalysis
): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  try {
    const redis = await getRedisConnection();
    const cacheKey = getCacheKey(instrument, date);
    await redis.setex(cacheKey, MACRO_ANALYSIS_CACHE_TTL, JSON.stringify(analysis));
    
    logger.debug('Macro analysis cached', {
      instrument,
      date,
      cacheKey,
      ttl: MACRO_ANALYSIS_CACHE_TTL
    });
  } catch (error) {
    logger.warn('Failed to cache macro analysis', {
      instrument,
      date,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// ============================================================================
// Transformation Functions
// ============================================================================

/**
 * Transform EconomicEvent to prompt format
 */
function transformToPromptEvent(event: EconomicEvent): EconomicEvent {
  return {
    title: event.title,
    country: event.country,
    impact: event.impact,
    forecast: event.forecast,
    previous: event.previous,
    actual: event.actual,
    time: event.time,
    category: event.category
  };
}

/**
 * Transform MacroAnalysisOutput to MacroAnalysis type
 */
function transformToMacroAnalysis(
  output: MacroAnalysisOutput,
  events: EconomicEvent[],
  instrument: string,
  analysisDate: string
): MacroAnalysis {
  // Transform sentiment
  const sentiment = mapBiasToSentiment(output.bias);
  
  // Transform macro score (0-100 -> 0-10)
  const macroScore = Math.round(output.confidence / 10);
  
  // Transform economic events to MacroAnalysis format
  const economicEvents = events.map(event => ({
    event: event.title,
    time: event.time,
    importance: mapImpactToImportance(event.impact),
    country: event.country,
    forecast: event.forecast ?? null,
    previous: event.previous ?? null,
    actual: event.actual ?? null,
    impactOnInstrument: undefined // Will be determined by AI in analysis
  }));

  return {
    economicEvents: economicEvents as any,
    macroScore,
    sentiment,
    analysis: {
      summary: output.summary,
      centralBankPolicy: output.indicators.centralBankPolicy !== 'unknown' 
        ? output.indicators.centralBankPolicy 
        : undefined,
      economicCycle: mapIndicatorToCycle(output.indicators),
      keyThemes: output.keyDrivers
    },
    timestamp: new Date().toISOString(),
    instrument
  } as any;
}

/**
 * Map bias (bullish/bearish/neutral) to SentimentLevel
 */
function mapBiasToSentiment(bias: 'bullish' | 'bearish' | 'neutral'): 
  'VERY_BEARISH' | 'BEARISH' | 'NEUTRAL' | 'BULLISH' | 'VERY_BULLISH' {
  switch (bias) {
    case 'bullish':
      return 'BULLISH';
    case 'bearish':
      return 'BEARISH';
    case 'neutral':
    default:
      return 'NEUTRAL';
  }
}

/**
 * Map impact (high/medium/low) to EconomicImportance
 */
function mapImpactToImportance(impact: 'high' | 'medium' | 'low'): 
  'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  switch (impact) {
    case 'high':
      return 'HIGH';
    case 'medium':
      return 'MEDIUM';
    case 'low':
    default:
      return 'LOW';
  }
}

/**
 * Map indicators to MacroEconomicCycle
 */
function mapIndicatorToCycle(indicators: MacroAnalysisOutput['indicators']): 
  'EXPANSION' | 'PEAK' | 'CONTRACTION' | 'TROUGH' | undefined {
  // Simple heuristic based on GDP and inflation
  if (indicators.gdp === 'positive' && indicators.inflation === 'stable') {
    return 'EXPANSION';
  }
  if (indicators.gdp === 'positive' && indicators.inflation === 'rising') {
    return 'PEAK';
  }
  if (indicators.gdp === 'negative') {
    return 'CONTRACTION';
  }
  return undefined; // Unknown or insufficient data
}
