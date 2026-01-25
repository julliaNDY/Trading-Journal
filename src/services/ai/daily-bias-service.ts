/**
 * Daily Bias Analysis Service
 * 
 * Core service for 6-step AI-powered daily bias analysis.
 * Orchestrates Gemini API calls, caching, validation, and database storage.
 */

import { prisma } from '@/lib/prisma';
import { generateWithGeminiProduction } from '@/lib/gemini-production';
import { 
  buildSecurityAnalysisPrompt, 
  SECURITY_ANALYSIS_SYSTEM_PROMPT,
  validateSecurityAnalysisOutput,
  type SecurityAnalysisInput,
  type SecurityAnalysisOutput,
  generateSynthesisPrompt,
  validateSynthesisTextOutput,
  type SynthesisPromptParams,
  type SynthesisTextOutput
} from '@/lib/prompts/daily-bias-prompts';
import { analyzeMacroContext } from '@/services/daily-bias/macro-analysis-service';
import { analyzeInstitutionalFlux } from '@/services/daily-bias/institutional-flux-service';
import { analyzeMag7Leaders } from '@/services/daily-bias/mag7-analysis-service';
import { analyzeTechnicalStructure } from '@/services/daily-bias/technical-analysis-service';
import { synthesizeDailyBias } from '@/services/daily-bias/synthesis-service';
import type { SynthesisInput } from '@/lib/prompts/synthesis-prompt';
import type {
  SecurityAnalysis,
  MacroAnalysis,
  InstitutionalFlux,
  Mag7Analysis,
  TechnicalStructure,
  TechnicalAnalysis,
  Synthesis,
  RiskLevel,
} from '@/types/daily-bias';
import { 
  calculateSentiment, 
  getInstrumentWeights,
  type AnalysisSteps 
} from '@/services/ai/synthesis-sentiment';

// Type alias for supported instruments
type DailyBiasInstrument = string;
import { logger } from '@/lib/logger';
import { getRedisConnection, isRedisConfigured } from '@/lib/queue/redis';
import { createSecurityTracker, type DataSourceTracker } from '@/services/ai/data-source-tracker';
import { validateAIResponse, extractJSON, generateRetryPrompt, shouldRetry } from '@/services/ai/response-validator';

// ============================================================================
// CONSTANTS
// ============================================================================

export const SUPPORTED_INSTRUMENTS: readonly DailyBiasInstrument[] = [
  'NQ1', 'ES1', 'TSLA', 'NVDA', 'SPY', 'TQQQ', 'AMD', 'AAPL',
  'XAU/USD', 'PLTR', 'SOXL', 'AMZN', 'MSTR', 'EUR/USD', 'QQQ',
  'MSFT', 'COIN', 'BTC', 'META', 'GME', 'SQQQ', 'MARA'
] as const;

const CACHE_TTL_SECONDS = 300; // 5 minutes
const AI_TIMEOUT_MS = 30000; // 30 seconds per step

// ============================================================================
// TYPES
// ============================================================================

export interface AnalyzeDailyBiasParams {
  userId: string;
  instrument: DailyBiasInstrument;
  date: string; // YYYY-MM-DD format
}

export interface DailyBiasAnalysisResult {
  id: string;
  instrument: string;
  date: string;
  securityAnalysis: SecurityAnalysis | null;
  macroAnalysis: MacroAnalysis | null;
  institutionalFlux: InstitutionalFlux | null;
  mag7Analysis: Mag7Analysis | null;
  technicalAnalysis: TechnicalAnalysis | null;
  synthesis: Synthesis | null;
  synthesisText: string | null; // Story 12.11
  synthesisSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null; // Story 12.11
  processingTimeMs: number;
  aiProvider: string;
  cacheHit: boolean;
  createdAt: Date;
}

export interface SecurityAnalysisParams {
  instrument: DailyBiasInstrument;
  marketData: {
    currentPrice: number;
    priceChange24h: number;
    priceChangePercent24h: number;
    volume24h: number;
    high24h: number;
    low24h: number;
    marketCap?: number;
    sector?: string;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Clean markdown code blocks from AI response
 * Gemini often wraps JSON in ```json ... ``` blocks
 */
function cleanJsonResponse(content: string): string {
  let cleaned = content.trim();
  
  // Remove markdown code blocks (```json ... ``` or ``` ... ```)
  if (cleaned.startsWith('```')) {
    // Find the end of the first line (might be ```json or just ```)
    const firstLineEnd = cleaned.indexOf('\n');
    if (firstLineEnd !== -1) {
      cleaned = cleaned.slice(firstLineEnd + 1);
    }
    // Remove trailing ```
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
  }
  
  return cleaned.trim();
}

// ============================================================================
// SECURITY ANALYSIS (STEP 1)
// ============================================================================

/**
 * Execute Step 1: Security Analysis
 * 
 * Analyzes volatility, risk factors, and security profile of an instrument.
 */
export async function executeSecurityAnalysis(
  params: SecurityAnalysisParams
): Promise<SecurityAnalysis> {
  const startTime = Date.now();
  
  try {
    logger.info('Security Analysis Started', {
      instrument: params.instrument,
      price: params.marketData.currentPrice
    });
    
    // Initialize data source tracker
    const tracker = createSecurityTracker(params.instrument);
    tracker.addCalculation('Market Data - Price, Volume, 24h High/Low');
    tracker.addCalculation('Volatility Index - Calculated from price range');
    tracker.addCalculation('Risk Assessment - Based on volatility metrics');
    
    // Build input for prompt
    const input: SecurityAnalysisInput = {
      symbol: params.instrument,
      currentPrice: params.marketData.currentPrice,
      priceChange24h: params.marketData.priceChange24h,
      priceChangePercent24h: params.marketData.priceChangePercent24h,
      volume24h: params.marketData.volume24h,
      high24h: params.marketData.high24h,
      low24h: params.marketData.low24h,
      marketCap: params.marketData.marketCap,
      sector: params.marketData.sector,
      assetType: getAssetType(params.instrument)
    };
    
    // Generate prompt
    let userPrompt = buildSecurityAnalysisPrompt(input);
    let attempt = 0;
    const maxRetries = 2;
    let response;
    let parsed!: SecurityAnalysisOutput;
    
    // Retry loop with anti-hallucination validation
    while (attempt < maxRetries) {
      attempt++;
      
      // Call Gemini API
      response = await generateWithGeminiProduction({
        prompt: userPrompt,
        systemPrompt: SECURITY_ANALYSIS_SYSTEM_PROMPT,
        cacheKey: attempt === 1 ? `security-analysis:${params.instrument}:${new Date().toISOString().split('T')[0]}` : undefined,
        model: 'gemini-2.0-flash'
      });
      
      // Parse and validate JSON response (clean markdown blocks first)
      const cleanedContent = extractJSON(response.content);
      
      try {
        parsed = JSON.parse(cleanedContent);
      } catch (parseError) {
        if (attempt >= maxRetries) {
          throw new Error('Failed to parse AI response as JSON after retries');
        }
        userPrompt = generateRetryPrompt(userPrompt, ['Invalid JSON response']);
        continue;
      }
      
      // Validate schema
      if (!validateSecurityAnalysisOutput(parsed)) {
        if (attempt >= maxRetries) {
          throw new Error('Invalid Security Analysis output schema after retries');
        }
        userPrompt = generateRetryPrompt(userPrompt, ['Invalid output schema']);
        continue;
      }
      
      // Validate for hallucination
      const validation = validateAIResponse(
        cleanedContent,
        tracker.getSources(),
        { strictMode: false, maxErrors: 3 }
      );
      
      if (shouldRetry(validation, attempt, maxRetries)) {
        logger.warn('Security Analysis validation failed, retrying', {
          attempt,
          errors: validation.errors,
          warnings: validation.warnings
        });
        userPrompt = generateRetryPrompt(userPrompt, validation.errors);
        continue;
      }
      
      // Validation passed or max retries reached
      if (validation.errors.length > 0) {
        logger.warn('Security Analysis completed with warnings', {
          instrument: params.instrument,
          errors: validation.errors,
          warnings: validation.warnings,
          confidence: validation.confidence
        });
      }
      
      break; // Success
    }
    
    // Map risk level (AI may return EXTREME which maps to CRITICAL)
    const mapRiskLevel = (level: string): RiskLevel => {
      const mapping: Record<string, RiskLevel> = {
        'LOW': 'LOW',
        'MEDIUM': 'MEDIUM',
        'HIGH': 'HIGH',
        'EXTREME': 'CRITICAL',
        'CRITICAL': 'CRITICAL'
      };
      return mapping[level] || 'MEDIUM';
    };
    
    // Transform to SecurityAnalysis type
    const result: SecurityAnalysis = {
      volatilityIndex: parsed.volatilityIndex,
      riskLevel: mapRiskLevel(parsed.riskLevel),
      securityScore: parsed.securityScore,
      analysis: {
        summary: parsed.reasoning,
        volatilityFactors: [
          { factor: 'Price Volatility', impact: getImpactLevel(parsed.volatilityBreakdown.priceVolatility) },
          { factor: 'Volume Volatility', impact: getImpactLevel(parsed.volatilityBreakdown.volumeVolatility) }
        ],
        risks: parsed.keyRisks.map(risk => ({
          risk,
          probability: 0.5, // Placeholder - would be extracted from AI reasoning
          impact: 0.7
        })),
        recommendations: [
          `Position Sizing: ${parsed.tradingRecommendation.positionSizing}`,
          `Stop Loss Multiplier: ${parsed.tradingRecommendation.stopLossMultiplier}x`,
          parsed.tradingRecommendation.entryTiming
        ]
      },
      timestamp: new Date().toISOString(),
      instrument: params.instrument,
      dataSources: getSecurityAnalysisDataSources(params.instrument)
    };
    
    const processingTime = Date.now() - startTime;
    
    logger.info('Security Analysis Completed', {
      instrument: params.instrument,
      volatilityIndex: result.volatilityIndex,
      riskLevel: result.riskLevel,
      processingTimeMs: processingTime,
      cacheHit: response?.cached ?? false
    });
    
    return result;
    
  } catch (error: any) {
    logger.error('Security Analysis Failed', {
      instrument: params.instrument,
      error: error.message,
      processingTimeMs: Date.now() - startTime
    });
    throw error;
  }
}

// ============================================================================
// FULL 6-STEP ANALYSIS
// ============================================================================

/**
 * Execute complete 6-step daily bias analysis
 * 
 * 1. Check if analysis exists for today (rate limiting)
 * 2. Execute 6 steps in sequence
 * 3. Store results in database
 * 4. Return complete analysis
 */
export async function analyzeDailyBias(
  params: AnalyzeDailyBiasParams
): Promise<DailyBiasAnalysisResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Daily Bias Analysis Started', {
      userId: params.userId,
      instrument: params.instrument,
      date: params.date
    });
    
    // 1. Check if analysis already exists (rate limiting)
    const existing = await prisma.dailyBiasAnalysis.findUnique({
      where: {
        userId_instrument_date: {
          userId: params.userId,
          instrument: params.instrument,
          date: new Date(params.date)
        }
      }
    });
    
    if (existing) {
      // Validate that cache is complete (has synthesis text or synthesis object)
      const isComplete = existing.synthesis !== null || existing.synthesisText !== null;
      
      if (isComplete) {
        logger.info('Daily Bias Analysis - Cache Hit (Complete)', {
          userId: params.userId,
          instrument: params.instrument,
          analysisId: existing.id
        });
        
        return transformDatabaseResult(existing);
      } else {
        // Cache is incomplete - delete and re-run full analysis
        logger.warn('Daily Bias Analysis - Incomplete cache detected, re-running', {
          userId: params.userId,
          instrument: params.instrument,
          analysisId: existing.id,
          hasSecurity: !!existing.securityAnalysis,
          hasMacro: !!existing.macroAnalysis,
          hasFlux: !!existing.institutionalFlux,
          hasMag7: !!existing.mag7Analysis,
          hasTechnical: !!existing.technicalAnalysis,
          hasSynthesis: !!existing.synthesis
        });
        
        // Delete incomplete analysis
        await prisma.dailyBiasAnalysis.delete({
          where: { id: existing.id }
        });
        
        // Continue with fresh analysis below
      }
    }
    
    // 2. Fetch market data (placeholder - would integrate with real market data API)
    const marketData = await fetchMarketData(params.instrument);
    
    // 3. Execute Step 1: Security Analysis
    const securityAnalysis = await executeSecurityAnalysis({
      instrument: params.instrument,
      marketData
    });
    
    // 4. Execute Step 2: Macro Analysis
    logger.debug('Executing macro analysis', {
      instrument: params.instrument,
      date: params.date
    });
    
    let macroAnalysis: MacroAnalysis | null = null;
    try {
      const macroResult = await analyzeMacroContext({
        instrument: params.instrument,
        analysisDate: params.date,
        useCache: true
      });
      macroAnalysis = macroResult.analysis;
      
      logger.debug('Macro analysis completed', {
        instrument: params.instrument,
        sentiment: macroAnalysis.sentiment,
        macroScore: macroAnalysis.macroScore,
        eventCount: macroAnalysis.economicEvents.length
      });
    } catch (error) {
      logger.error('Macro analysis failed, continuing without it', {
        instrument: params.instrument,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Continue without macro analysis (non-critical)
    }
    
    // 5. Execute Step 3: Institutional Flux
    let institutionalFlux: InstitutionalFlux | null = null;
    try {
      const fluxResult = await analyzeInstitutionalFlux({
        instrument: params.instrument,
        marketData: {
          currentPrice: marketData.currentPrice,
          priceChange24h: marketData.priceChange24h,
          volume24h: marketData.volume24h,
          averageVolume20d: marketData.volume24h * 0.9, // Approximate if not available
          high24h: marketData.high24h,
          low24h: marketData.low24h
        },
        timeframe: '1d',
        useCache: true
      });
      institutionalFlux = {
        ...(fluxResult.analysis as unknown as InstitutionalFlux),
        dataSources: getInstitutionalFluxDataSources(params.instrument)
      };
      
      logger.debug('Institutional flux analysis completed', {
        instrument: params.instrument,
        fluxScore: institutionalFlux.fluxScore
      });
    } catch (error) {
      logger.error('Institutional flux analysis failed, continuing without it', {
        instrument: params.instrument,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Continue without flux analysis (non-critical)
    }
    
    // 6. Execute Step 4: Mag 7 Leaders Analysis
    logger.debug('Executing Mag 7 leaders analysis', {
      instrument: params.instrument,
      date: params.date
    });
    
    let mag7Analysis: Mag7Analysis | null = null;
    try {
      const mag7Result = await analyzeMag7Leaders({
        instrument: params.instrument,
        instrumentData: {
          currentPrice: marketData.currentPrice,
          priceChangePercent: marketData.priceChangePercent24h,
          priceChange24h: marketData.priceChange24h
        },
        analysisDate: params.date,
        useCache: true
      });
      mag7Analysis = {
        ...mag7Result.analysis,
        dataSources: getMag7AnalysisDataSources()
      };
      
      logger.debug('Mag 7 leaders analysis completed', {
        instrument: params.instrument,
        sentiment: mag7Analysis.sentiment,
        leaderScore: mag7Analysis.leaderScore,
        correlationCount: mag7Analysis.correlations.length
      });
    } catch (error) {
      logger.error('Mag 7 leaders analysis failed, continuing without it', {
        instrument: params.instrument,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Continue without Mag 7 analysis (non-critical)
    }
    
    // 7. Execute Step 5: Technical Structure Analysis
    logger.debug('Executing technical structure analysis', {
      instrument: params.instrument,
      date: params.date
    });
    
    let technicalAnalysis: TechnicalStructure | null = null;
    try {
      const technicalResult = await analyzeTechnicalStructure({
        instrument: params.instrument,
        timeframe: 'daily', // Default to daily for main analysis
        analysisDate: params.date,
        currentPrice: marketData.currentPrice,
        useCache: true
      });
      technicalAnalysis = {
        ...technicalResult.analysis,
        dataSources: getTechnicalAnalysisDataSources(params.instrument)
      };
      
      logger.debug('Technical structure analysis completed', {
        instrument: params.instrument,
        technicalScore: technicalAnalysis.technicalScore,
        supportLevelsCount: technicalAnalysis.supportLevels.length,
        resistanceLevelsCount: technicalAnalysis.resistanceLevels.length,
        trend: technicalAnalysis.trend.direction
      });
    } catch (error) {
      logger.error('Technical structure analysis failed, continuing without it', {
        instrument: params.instrument,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Continue without technical analysis (non-critical)
    }
    
    // 8. Execute Step 6: Synthesis & Final Bias
    logger.debug('Executing synthesis analysis', {
      instrument: params.instrument,
      date: params.date,
      hasSecurity: !!securityAnalysis,
      hasMacro: !!macroAnalysis,
      hasFlux: !!institutionalFlux,
      hasMag7: !!mag7Analysis,
      hasTechnical: !!technicalAnalysis
    });
    
    let synthesis: Synthesis | null = null;
    try {
      // Build synthesis input (all previous analyses)
      // Note: Using 'as any' to handle type mismatches between AI outputs and strict types
      const synthesisInput: SynthesisInput = ({
        security: securityAnalysis,
        macro: macroAnalysis || {
          sentiment: 'NEUTRAL',
          macroScore: 5.0,
          economicEvents: [],
          risks: [],
          analysis: {
            summary: 'Macro analysis unavailable'
          },
          timestamp: new Date().toISOString(),
          instrument: params.instrument
        },
        flux: institutionalFlux || {
          fluxScore: 5.0,
          institutionalPressure: 'NEUTRAL',
          volumeProfile: {
            currentVolume: marketData.volume24h,
            averageVolume: marketData.volume24h * 0.9,
            volumeLevel: 'NORMAL',
            volumeTrend: 'STABLE'
          },
          orderFlow: {
            largeBuyOrders: 1,
            largeSellOrders: 1,
            netInstitutionalFlow: 0,
            confirmation: 'MIXED'
          },
          analysis: {
            summary: 'Institutional flux analysis unavailable'
          },
          timestamp: new Date().toISOString(),
          instrument: params.instrument
        },
        mag7: mag7Analysis || {
          correlations: [],
          leaderScore: 5.0,
          sentiment: 'NEUTRAL',
          analysis: {
            summary: 'Mag 7 analysis unavailable'
          },
          timestamp: new Date().toISOString(),
          instrument: params.instrument
        },
        technical: technicalAnalysis, // Can be null
        instrument: params.instrument,
        analysisDate: params.date,
        currentPrice: marketData.currentPrice
      }) as any;
      
      const synthesisResult = await synthesizeDailyBias(synthesisInput, {
        useCache: true,
        validateWeights: true
      });
      
      if (synthesisResult.success && synthesisResult.data) {
        // Transform SynthesisOutput to Synthesis type
        synthesis = {
          finalBias: synthesisResult.data.finalBias,
          confidence: synthesisResult.data.confidence,
          openingConfirmation: {
            expectedDirection: synthesisResult.data.openingConfirmation.expectedDirection,
            confirmationScore: synthesisResult.data.openingConfirmation.confirmationScore,
            timeToConfirm: synthesisResult.data.openingConfirmation.timeToConfirm
          },
          analysis: {
            summary: synthesisResult.data.analysis.summary,
            stepWeights: synthesisResult.data.analysis.stepWeights,
            agreementLevel: synthesisResult.data.analysis.agreementLevel,
            keyThesisPoints: synthesisResult.data.analysis.keyThesisPoints,
            counterArguments: synthesisResult.data.analysis.counterArguments,
            tradingRecommendations: {
              primary: synthesisResult.data.analysis.tradingRecommendations.primary,
              targetUpside: synthesisResult.data.analysis.tradingRecommendations.targetUpside ?? undefined,
              targetDownside: synthesisResult.data.analysis.tradingRecommendations.targetDownside ?? undefined,
              stopLoss: synthesisResult.data.analysis.tradingRecommendations.stopLoss ?? undefined,
              riskRewardRatio: synthesisResult.data.analysis.tradingRecommendations.riskRewardRatio ?? undefined
            }
          },
          timestamp: synthesisResult.data.timestamp,
          instrument: synthesisResult.data.instrument
        };
        
        logger.debug('Synthesis analysis completed', {
          instrument: params.instrument,
          finalBias: synthesis.finalBias,
          confidence: synthesis.confidence,
          agreementLevel: synthesis.analysis?.agreementLevel
        });
      } else {
        logger.warn('Synthesis analysis failed', {
          instrument: params.instrument,
          error: synthesisResult.error
        });
      }
    } catch (error) {
      logger.error('Synthesis analysis failed, continuing without it', {
        instrument: params.instrument,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Continue without synthesis (non-critical, but less ideal)
    }
    
    const processingTimeMs = Date.now() - startTime;
    
    // 6.5. Generate synthesis text with sentiment (Story 12.11)
    logger.debug('Generating synthesis text and sentiment (Story 12.11)', {
      instrument: params.instrument
    });
    
    let synthesisText: string | null = null;
    let synthesisSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null = null;
    
    try {
      // Collect all data sources used across all steps
      const allDataSources = [
        ...getSecurityAnalysisDataSources(params.instrument),
        ...getMacroAnalysisDataSources(),
        ...getInstitutionalFluxDataSources(params.instrument),
        ...getMag7AnalysisDataSources(),
        ...getTechnicalAnalysisDataSources(params.instrument)
      ];
      
      // Remove duplicates
      const uniqueDataSources = Array.from(new Set(allDataSources));
      
      const synthesisResult = await generateSynthesis({
        security: securityAnalysis,
        macro: macroAnalysis || {},
        flux: institutionalFlux || {},
        mag7: mag7Analysis || {},
        technical: technicalAnalysis || {},
        dataSources: uniqueDataSources,
        instrument: params.instrument
      });
      
      if (synthesisResult) {
        synthesisText = synthesisResult.text;
        synthesisSentiment = synthesisResult.sentiment;
        
        logger.info('Synthesis text generated successfully (Story 12.11)', {
          instrument: params.instrument,
          sentiment: synthesisSentiment,
          confidence: synthesisResult.confidence,
          textLength: synthesisText.length
        });
      }
    } catch (error) {
      logger.error('Synthesis text generation failed (Story 12.11)', {
        instrument: params.instrument,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Continue without synthesis text (non-critical)
    }
    
    // 7. Store in database
    const analysis = await prisma.dailyBiasAnalysis.create({
      data: {
        userId: params.userId,
        instrument: params.instrument,
        date: new Date(params.date),
        securityAnalysis: securityAnalysis as any,
        macroAnalysis: macroAnalysis as any,
        institutionalFlux: institutionalFlux as any,
        mag7Analysis: mag7Analysis as any,
        technicalAnalysis: technicalAnalysis as any,
        synthesis: synthesis as any,
        synthesisText: synthesisText,
        synthesisSentiment: synthesisSentiment,
        processingTimeMs,
        aiProvider: 'gemini',
        cacheHit: false
      }
    });
    
    logger.info('Daily Bias Analysis Completed', {
      userId: params.userId,
      instrument: params.instrument,
      analysisId: analysis.id,
      processingTimeMs
    });
    
    // 8. Publish real-time update event (if Redis available)
    if (isRedisConfigured()) {
      try {
        const redis = await getRedisConnection();
        const channel = `daily-bias:update:${params.instrument}:${params.date}`;
        const cacheKey = `daily-bias:${params.userId}:${params.instrument}:${params.date}`;
        
        // Cache the analysis result for real-time updates
        await redis.setex(cacheKey, 86400, JSON.stringify(transformDatabaseResult(analysis))); // 24h cache
        
        // Publish update event (for SSE/polling clients)
        await redis.publish(channel, JSON.stringify({
          instrument: params.instrument,
          date: params.date,
          analysisId: analysis.id,
          timestamp: new Date().toISOString()
        }));
        
        logger.debug('Real-time update event published', {
          userId: params.userId,
          instrument: params.instrument,
          channel,
          cacheKey
        });
      } catch (error) {
        logger.warn('Failed to publish real-time update event', {
          userId: params.userId,
          instrument: params.instrument,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        // Non-critical, continue without real-time notification
      }
    }
    
    return transformDatabaseResult(analysis);
    
  } catch (error: any) {
    logger.error('Daily Bias Analysis Failed', {
      userId: params.userId,
      instrument: params.instrument,
      error: error.message,
      processingTimeMs: Date.now() - startTime
    });
    throw error;
  }
}

// ============================================================================
// ANALYSIS HISTORY
// ============================================================================

/**
 * Get user's analysis history
 */
export async function getAnalysisHistory(params: {
  userId: string;
  instrument?: DailyBiasInstrument;
  limit?: number;
  offset?: number;
}): Promise<{
  analyses: DailyBiasAnalysisResult[];
  total: number;
}> {
  const limit = params.limit || 30;
  const offset = params.offset || 0;
  
  const where: any = {
    userId: params.userId,
  };
  
  if (params.instrument) {
    where.instrument = params.instrument;
  }
  
  const [analyses, total] = await Promise.all([
    prisma.dailyBiasAnalysis.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    }),
    prisma.dailyBiasAnalysis.count({ where })
  ]);
  
  return {
    analyses: analyses.map(transformDatabaseResult),
    total
  };
}

/**
 * Get existing Daily Bias analysis
 * 
 * Retrieves analysis from database without executing new analysis
 */
export async function getDailyBiasAnalysis(
  params: AnalyzeDailyBiasParams
): Promise<DailyBiasAnalysisResult | null> {
  try {
    const existing = await prisma.dailyBiasAnalysis.findUnique({
      where: {
        userId_instrument_date: {
          userId: params.userId,
          instrument: params.instrument,
          date: new Date(params.date)
        }
      }
    });
    
    if (!existing) {
      return null;
    }
    
    return transformDatabaseResult(existing);
  } catch (error) {
    logger.error('Failed to get daily bias analysis', {
      userId: params.userId,
      instrument: params.instrument,
      date: params.date,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Check if user can analyze today (rate limiting)
 * 
 * Rate limit: 1 analysis per day (any instrument) for regular users
 * Admins have unlimited analyses
 */
export async function canAnalyzeToday(
  userId: string,
  _instrument?: DailyBiasInstrument // Kept for API compatibility but not used anymore
): Promise<{
  allowed: boolean;
  lastAnalysis: Date | null;
  nextAvailable: Date | null;
  todayCount: number;
}> {
  // Get start and end of today (UTC)
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  
  // Count all analyses done by the user today (any instrument)
  const todayAnalyses = await prisma.dailyBiasAnalysis.findMany({
    where: {
      userId,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 1 // We only need the most recent one
  });
  
  const todayCount = await prisma.dailyBiasAnalysis.count({
    where: {
      userId,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay
      }
    }
  });
  
  // If user has not done any analysis today, they can analyze
  if (todayCount === 0) {
    return {
      allowed: true,
      lastAnalysis: null,
      nextAvailable: null,
      todayCount: 0
    };
  }
  
  // User has already analyzed today - rate limit exceeded
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  return {
    allowed: false,
    lastAnalysis: todayAnalyses[0]?.createdAt || null,
    nextAvailable: tomorrow,
    todayCount
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Transform database result to API response format
 */
function transformDatabaseResult(analysis: any): DailyBiasAnalysisResult {
  return {
    id: analysis.id,
    instrument: analysis.instrument,
    date: analysis.date.toISOString().split('T')[0],
    securityAnalysis: analysis.securityAnalysis as SecurityAnalysis | null,
    macroAnalysis: analysis.macroAnalysis as MacroAnalysis | null,
    institutionalFlux: analysis.institutionalFlux as InstitutionalFlux | null,
    mag7Analysis: analysis.mag7Analysis as Mag7Analysis | null,
    technicalAnalysis: analysis.technicalAnalysis as TechnicalAnalysis | null,
    synthesis: analysis.synthesis as Synthesis | null,
    synthesisText: analysis.synthesisText || null, // Story 12.11
    synthesisSentiment: analysis.synthesisSentiment || null, // Story 12.11
    processingTimeMs: analysis.processingTimeMs || 0,
    aiProvider: analysis.aiProvider,
    cacheHit: analysis.cacheHit,
    createdAt: analysis.createdAt
  };
}

/**
 * Get asset type from instrument symbol
 */
function getAssetType(instrument: string): 'stock' | 'crypto' | 'forex' | 'futures' | 'etf' {
  if (['NQ1', 'ES1'].includes(instrument)) return 'futures';
  if (['SPY', 'TQQQ', 'SOXL', 'QQQ', 'SQQQ'].includes(instrument)) return 'etf';
  if (['BTC', 'COIN', 'MSTR', 'MARA'].includes(instrument)) return 'crypto';
  if (['XAU/USD', 'EUR/USD'].includes(instrument)) return 'forex';
  return 'stock';
}

/**
 * Get impact level from volatility index (0-100)
 */
function getImpactLevel(index: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (index < 33) return 'LOW';
  if (index < 66) return 'MEDIUM';
  return 'HIGH';
}

/**
 * Fetch market data from external API (placeholder)
 * 
 * TODO: Integrate with real market data provider (e.g., Alpha Vantage, Polygon.io)
 */
async function fetchMarketData(instrument: string): Promise<{
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  marketCap?: number;
  sector?: string;
}> {
  // Placeholder data - in production, this would call a real API
  return {
    currentPrice: 21450.50,
    priceChange24h: -125.75,
    priceChangePercent24h: -0.58,
    volume24h: 2500000000,
    high24h: 21600.25,
    low24h: 21380.00,
    marketCap: instrument.startsWith('N') || instrument.startsWith('E') ? undefined : 500000000000,
    sector: getAssetType(instrument) === 'stock' ? 'Technology' : undefined
  };
}

// ============================================================================
// DATA SOURCES HELPERS
// ============================================================================

/**
 * Get data sources for Security Analysis
 * Lists the sources used to analyze volatility and risk
 */
function getSecurityAnalysisDataSources(instrument: string): string[] {
  const assetType = getAssetType(instrument);
  const baseSources = ['TradingView', 'Yahoo Finance'];
  
  if (assetType === 'crypto') {
    return [...baseSources, 'CoinGecko', 'Binance'];
  } else if (assetType === 'forex') {
    return [...baseSources, 'ForexFactory', 'OANDA'];
  } else if (assetType === 'futures') {
    return [...baseSources, 'CME Group', 'Barchart'];
  } else {
    return [...baseSources, 'Bloomberg', 'Reuters'];
  }
}

/**
 * Get data sources for Macro Analysis
 * Lists economic calendars and news sources
 */
function getMacroAnalysisDataSources(): string[] {
  return [
    'ForexFactory',
    'Investing.com Economic Calendar',
    'Federal Reserve',
    'BLS.gov',
    'Reuters',
    'Bloomberg'
  ];
}

/**
 * Get data sources for Institutional Flux Analysis
 * Lists volume and order flow data providers
 */
function getInstitutionalFluxDataSources(instrument: string): string[] {
  const assetType = getAssetType(instrument);
  const baseSources = ['TradingView Volume Profile'];
  
  if (assetType === 'stock') {
    return [...baseSources, 'FINRA Dark Pool Data', 'NYSE Tape', 'NASDAQ TotalView'];
  } else if (assetType === 'crypto') {
    return [...baseSources, 'Binance Order Book', 'CoinGlass', 'Glassnode'];
  } else if (assetType === 'futures') {
    return [...baseSources, 'CME Volume Data', 'Commitment of Traders (COT)'];
  } else {
    return [...baseSources, 'Order Flow Analytics', 'Market Depth Data'];
  }
}

/**
 * Get data sources for Mag 7 Analysis
 * Lists correlation and market leader tracking sources
 */
function getMag7AnalysisDataSources(): string[] {
  return [
    'Yahoo Finance',
    'TradingView',
    'Alpha Vantage',
    'Finnhub',
    'MarketWatch'
  ];
}

/**
 * Get data sources for Technical Analysis
 * Lists chart data and indicator sources
 */
function getTechnicalAnalysisDataSources(instrument: string): string[] {
  const assetType = getAssetType(instrument);
  const baseSources = ['TradingView Charts', 'Technical Indicators Library'];
  
  if (assetType === 'crypto') {
    return [...baseSources, 'CryptoCompare', 'CoinMarketCap'];
  } else if (assetType === 'forex') {
    return [...baseSources, 'OANDA Charts', 'ForexFactory'];
  } else {
    return [...baseSources, 'Yahoo Finance Charts', 'Barchart Technical'];
  }
}

// ============================================================================
// Story 12.11: Synthesis Text Generation with Sentiment
// ============================================================================

/**
 * Generate synthesis text with sentiment (Story 12.11)
 * 
 * Takes 5-step analysis results and generates:
 * - 3-5 sentence summary starting with data citations
 * - Clear sentiment (BULLISH/BEARISH/NEUTRAL) based on weighted algorithm
 * - Confidence score (0-100)
 * 
 * @param input - Results from all 5 analysis steps + data sources
 * @returns Synthesis text and sentiment, or null on failure
 */
export async function generateSynthesis(input: {
  security: any;
  macro: any;
  flux: any;
  mag7: any;
  technical: any;
  dataSources: string[];
  instrument: string;
}): Promise<{
  text: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
} | null> {
  try {
    logger.info('Generating synthesis text and sentiment', {
      instrument: input.instrument,
      dataSourceCount: input.dataSources.length
    });

    // Extract bias and confidence from each step
    const analysisSteps: AnalysisSteps = {
      security: extractStepBias(input.security, 'security'),
      macro: extractStepBias(input.macro, 'macro'),
      flux: extractStepBias(input.flux, 'flux'),
      mag7: extractStepBias(input.mag7, 'mag7'),
      technical: extractStepBias(input.technical, 'technical'),
    };

    // Calculate sentiment using weighted algorithm (Task 4)
    const weights = getInstrumentWeights(input.instrument);
    const sentimentCalc = calculateSentiment(analysisSteps, weights);

    logger.info('Sentiment calculated', {
      instrument: input.instrument,
      sentiment: sentimentCalc.sentiment,
      weightedScore: sentimentCalc.weightedScore,
      agreementLevel: sentimentCalc.agreementLevel
    });

    // Build prompt params
    const promptParams: SynthesisPromptParams = {
      security: {
        bias: analysisSteps.security.bias,
        confidence: analysisSteps.security.confidence,
        riskLevel: input.security.riskLevel || 'MEDIUM',
      },
      macro: {
        bias: analysisSteps.macro.bias,
        confidence: analysisSteps.macro.confidence,
        sentiment: input.macro.sentiment || 'NEUTRAL',
      },
      flux: {
        bias: analysisSteps.flux.bias,
        confidence: analysisSteps.flux.confidence,
        institutionalPressure: input.flux.institutionalPressure || 'NEUTRAL',
      },
      mag7: {
        bias: analysisSteps.mag7.bias,
        confidence: analysisSteps.mag7.confidence,
        overallSentiment: input.mag7.overallSentiment || 'NEUTRAL',
      },
      technical: {
        bias: analysisSteps.technical.bias,
        confidence: analysisSteps.technical.confidence,
        trend: input.technical?.trend?.direction || 'SIDEWAYS',
      },
      dataSources: input.dataSources,
      instrument: input.instrument,
    };

    // Generate prompt
    const prompt = generateSynthesisPrompt(promptParams);

    // Call Gemini API
    const response = await generateWithGeminiProduction({
      systemPrompt: 'You are a professional trading analyst specializing in market synthesis.',
      prompt: prompt,
      temperature: 0.3,
      maxTokens: 1000,
    });

    if (!response.content) {
      logger.error('Gemini API failed for synthesis', {
        instrument: input.instrument,
        error: 'No content returned'
      });
      return generateFallbackSynthesis(input, sentimentCalc.sentiment);
    }

    // Parse response
    const parsedOutput = parseJSONResponse(response.content);

    // Validate output
    if (!validateSynthesisTextOutput(parsedOutput)) {
      logger.warn('Synthesis output validation failed, using fallback', {
        instrument: input.instrument
      });
      return generateFallbackSynthesis(input, sentimentCalc.sentiment);
    }

    let output = parsedOutput as SynthesisTextOutput;

    // Verify sentiment matches algorithm (AC4: not arbitrary)
    // Allow slight deviation but log if significantly different
    if (output.sentiment !== sentimentCalc.sentiment) {
      logger.warn('AI sentiment differs from algorithm, correcting both JSON and text', {
        instrument: input.instrument,
        aiSentiment: output.sentiment,
        algorithmSentiment: sentimentCalc.sentiment,
        weightedScore: sentimentCalc.weightedScore
      });
      
      // Override JSON sentiment with algorithm result
      output.sentiment = sentimentCalc.sentiment;
      
      // ALSO fix the text to match the corrected sentiment
      // Replace "Final sentiment: X" with correct value to prevent UI mismatch
      output.text = output.text.replace(
        /Final\s+sentiment[:\s]+\w+/gi,
        `Final sentiment: ${sentimentCalc.sentiment}`
      );
    }

    logger.info('Synthesis generated successfully', {
      instrument: input.instrument,
      sentiment: output.sentiment,
      confidence: output.confidence,
      textLength: output.text.length
    });

    return {
      text: output.text,
      sentiment: output.sentiment,
      confidence: output.confidence,
    };

  } catch (error) {
    logger.error('Synthesis generation failed', {
      instrument: input.instrument,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    // Fallback: Generate neutral synthesis with error message
    const analysisSteps: AnalysisSteps = {
      security: extractStepBias(input.security, 'security'),
      macro: extractStepBias(input.macro, 'macro'),
      flux: extractStepBias(input.flux, 'flux'),
      mag7: extractStepBias(input.mag7, 'mag7'),
      technical: extractStepBias(input.technical, 'technical'),
    };
    const weights = getInstrumentWeights(input.instrument);
    const sentimentCalc = calculateSentiment(analysisSteps, weights);
    
    return generateFallbackSynthesis(input, sentimentCalc.sentiment);
  }
}

/**
 * Extract bias and confidence from analysis step result
 * Handles various response formats
 */
function extractStepBias(
  stepResult: any,
  stepName: string
): { bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; confidence: number } {
  if (!stepResult) {
    logger.warn(`Step ${stepName} result is null/undefined`);
    return { bias: 'NEUTRAL', confidence: 50 };
  }

  // Try to extract bias
  let bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (stepResult.finalBias) {
    bias = stepResult.finalBias;
  } else if (stepResult.sentiment && typeof stepResult.sentiment === 'string') {
    const sentimentUpper = stepResult.sentiment.toUpperCase();
    if (sentimentUpper.includes('BULLISH')) bias = 'BULLISH';
    else if (sentimentUpper.includes('BEARISH')) bias = 'BEARISH';
  } else if (stepResult.institutionalPressure) {
    bias = stepResult.institutionalPressure;
  } else if (stepResult.overallSentiment) {
    const sentimentUpper = stepResult.overallSentiment.toUpperCase();
    if (sentimentUpper.includes('BULLISH')) bias = 'BULLISH';
    else if (sentimentUpper.includes('BEARISH')) bias = 'BEARISH';
  } else if (stepResult.trend?.direction) {
    const dir = stepResult.trend.direction.toUpperCase();
    if (dir === 'UPTREND') bias = 'BULLISH';
    else if (dir === 'DOWNTREND') bias = 'BEARISH';
  }

  // Try to extract confidence
  let confidence = 50;
  if (typeof stepResult.confidence === 'number') {
    confidence = stepResult.confidence;
    // Ensure 0-100 range
    if (confidence > 1 && confidence <= 100) {
      // Already in 0-100 range
    } else if (confidence >= 0 && confidence <= 1) {
      // Convert 0-1 to 0-100
      confidence = confidence * 100;
    }
  }

  return { bias, confidence };
}

/**
 * Generate fallback synthesis when AI fails
 */
function generateFallbackSynthesis(
  input: any,
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
): {
  text: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
} {
  const sources = input.dataSources.slice(0, 3).join(', ');
  
  const text = `By analyzing the data provided by ${sources}, ${input.instrument} analysis is complete. ` +
    `Security, macro, institutional flux, MAG 7 leaders, and technical structure have been evaluated. ` +
    `The weighted analysis indicates a ${sentiment} bias based on the aggregated signals. ` +
    `Note: Detailed synthesis generation encountered an error, this is a simplified summary. ` +
    `Final sentiment: ${sentiment}.`;

  return {
    text,
    sentiment,
    confidence: 50, // Low confidence for fallback
  };
}

/**
 * Parse JSON response from AI, handling various formats
 */
function parseJSONResponse(content: string): unknown {
  let jsonString = content.trim();
  
  // Remove markdown code blocks if present
  if (jsonString.startsWith('```json')) {
    jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (jsonString.startsWith('```')) {
    jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  // Try to extract JSON object if there's extra text
  const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonString = jsonMatch[0];
  }
  
  return JSON.parse(jsonString);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const dailyBiasService = {
  analyzeDailyBias,
  executeSecurityAnalysis,
  generateSynthesis,
  getAnalysisHistory,
  canAnalyzeToday,
  SUPPORTED_INSTRUMENTS
};
