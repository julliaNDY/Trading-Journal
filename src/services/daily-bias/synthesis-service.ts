/**
 * Synthesis Service (Step 6/6 - Daily Bias Analysis)
 * 
 * Aggregates the 5 previous analysis steps into a final trading bias
 * with confidence score, opening confirmation, and trading recommendations.
 * 
 * Task: PRÉ-8.5 - Synthesis Prompts (8h) - Dev 54, Dev 55
 */

import { generateAIResponse } from '@/lib/ai-provider';
import type { AIMessage } from '@/lib/ai-provider';
import {
  buildSynthesisPrompt,
  SYNTHESIS_SYSTEM_PROMPT,
  validateSynthesisOutput,
  type SynthesisInput,
  type SynthesisOutput,
} from '@/lib/prompts/synthesis-prompt';
import { logger } from '@/lib/logger';
import { getRedisConnection, isRedisConfigured } from '@/lib/queue/redis';
import { z } from 'zod';

// ============================================================================
// Zod Validation Schemas
// ============================================================================

const StepWeightsSchema = z.object({
  security: z.number().min(0).max(1),
  macro: z.number().min(0).max(1),
  flux: z.number().min(0).max(1),
  mag7: z.number().min(0).max(1),
  technical: z.number().min(0).max(1), // May be 0 if technical analysis unavailable
}).refine(
  (weights) => {
    const sum = weights.security + weights.macro + weights.flux + weights.mag7 + weights.technical;
    return Math.abs(sum - 1.0) < 0.01; // Allow 1% tolerance
  },
  { message: 'Step weights must sum to 1.0' }
);

const OpeningConfirmationSchema = z.object({
  expectedDirection: z.enum(['UP', 'DOWN', 'INDETERMINATE']),
  confirmationScore: z.number().min(0).max(1),
  timeToConfirm: z.string().min(1),
  confirmationCriteria: z.array(z.string()).min(1),
});

const TradingRecommendationsSchema = z.object({
  primary: z.string().min(1),
  targetUpside: z.number().nullable(),
  targetDownside: z.number().nullable(),
  stopLoss: z.number().nullable(),
  riskRewardRatio: z.number().nullable(),
  alternativeSetups: z.array(z.string()).optional(),
});

const SynthesisAnalysisDetailsSchema = z.object({
  summary: z.string().min(1).max(800),
  stepWeights: StepWeightsSchema,
  agreementLevel: z.number().min(0).max(1),
  keyThesisPoints: z.array(z.string()).min(3).max(7),
  counterArguments: z.array(z.string()).min(1).max(5),
  tradingRecommendations: TradingRecommendationsSchema,
});

const SynthesisOutputSchema = z.object({
  finalBias: z.enum(['BEARISH', 'NEUTRAL', 'BULLISH']),
  confidence: z.number().min(0).max(1),
  openingConfirmation: OpeningConfirmationSchema,
  analysis: SynthesisAnalysisDetailsSchema,
  timestamp: z.string(),
  instrument: z.string(),
});

// ============================================================================
// Types
// ============================================================================

export interface SynthesisResult {
  success: boolean;
  data?: SynthesisOutput;
  error?: string;
  metadata: {
    instrument: string;
    provider: string;
    model: string;
    latencyMs: number;
    tokensUsed?: number;
    timestamp: Date;
    agreementLevel?: number;
    confidence?: number;
  };
}

export interface SynthesisOptions {
  model?: string;
  temperature?: number;
  maxRetries?: number;
  validateWeights?: boolean; // Validate that step weights sum to 1.0
  minConfidence?: number; // Minimum confidence threshold (default: 0.0)
  useCache?: boolean; // Enable Redis cache (default: true)
}

const SYNTHESIS_CACHE_TTL = 300; // 5 minutes
const SYNTHESIS_TIMEOUT = 30000; // 30 seconds

// ============================================================================
// Main Service Function
// ============================================================================

/**
 * Synthesize 5-step analysis into final daily bias
 * 
 * @param input - Results from 5 previous analysis steps
 * @param options - Optional configuration (model, temperature, etc.)
 * @returns Synthesis result with final bias and recommendations
 */
// ============================================================================
// Cache Functions
// ============================================================================

function getCacheKey(instrument: string, date: string): string {
  return `synthesis:${instrument}:${date}`;
}

async function getCachedSynthesis(
  instrument: string,
  date: string
): Promise<SynthesisOutput | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  try {
    const redis = await getRedisConnection();
    const cacheKey = getCacheKey(instrument, date);
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      const synthesis: SynthesisOutput = JSON.parse(cached);
      logger.debug('Synthesis cache hit', {
        instrument,
        date,
        cacheKey
      });
      return synthesis;
    }
  } catch (error) {
    logger.warn('Failed to get cached synthesis', {
      instrument,
      date,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  return null;
}

async function cacheSynthesis(
  instrument: string,
  date: string,
  synthesis: SynthesisOutput
): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  try {
    const redis = await getRedisConnection();
    const cacheKey = getCacheKey(instrument, date);
    await redis.setex(cacheKey, SYNTHESIS_CACHE_TTL, JSON.stringify(synthesis));
    
    logger.debug('Synthesis cached', {
      instrument,
      date,
      cacheKey,
      ttl: SYNTHESIS_CACHE_TTL
    });
  } catch (error) {
    logger.warn('Failed to cache synthesis', {
      instrument,
      date,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// ============================================================================
// Main Service Functions
// ============================================================================

export async function synthesizeDailyBias(
  input: SynthesisInput,
  options?: SynthesisOptions
): Promise<SynthesisResult> {
  const startTime = Date.now();
  const maxRetries = options?.maxRetries ?? 2;
  const useCache = options?.useCache !== false;
  
  logger.info('Starting synthesis analysis', {
    instrument: input.instrument,
    analysisDate: input.analysisDate,
    currentPrice: input.currentPrice,
    hasTechnical: !!input.technical,
  });
  
  // 1. Check cache
  if (useCache) {
    const cached = await getCachedSynthesis(input.instrument, input.analysisDate);
    if (cached) {
      logger.info('Synthesis cache hit', {
        instrument: input.instrument,
        analysisDate: input.analysisDate
      });
      return {
        success: true,
        data: cached,
        metadata: {
          instrument: input.instrument,
          provider: 'cache',
          model: 'cache',
          latencyMs: Date.now() - startTime,
          timestamp: new Date(),
          agreementLevel: cached.analysis.agreementLevel,
          confidence: cached.confidence
        }
      };
    }
  }
  
  let lastError: Error | null = null;
  
  // Retry loop (in case of JSON parsing errors or API failures)
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Build messages for AI
      const messages: AIMessage[] = [
        {
          role: 'system',
          content: SYNTHESIS_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: buildSynthesisPrompt(input),
        },
      ];
      
      // Generate AI response
      const response = await generateAIResponse(messages, {
        preferredProvider: 'gemini',
        fallbackEnabled: true,
        geminiModel: options?.model,
        temperature: options?.temperature ?? 0.4, // Slightly higher for creative synthesis
        maxTokens: 2500, // Synthesis requires more tokens
        timeout: SYNTHESIS_TIMEOUT
      });
      
      logger.info('AI response received', {
        instrument: input.instrument,
        provider: response.provider,
        model: response.model,
        latencyMs: response.latencyMs,
        attempt,
      });
      
      // Parse JSON response
      const parsedOutput = parseSynthesisResponse(response.content);
      
      // Validate output structure
      if (!validateSynthesisOutput(parsedOutput)) {
        throw new Error('AI response does not match expected schema');
      }
      
      // Validate with Zod for stricter checks
      const validatedOutput = SynthesisOutputSchema.parse(parsedOutput);
      
      // Optional: Check minimum confidence threshold
      if (options?.minConfidence && validatedOutput.confidence < options.minConfidence) {
        logger.warn('Synthesis confidence below threshold', {
          instrument: input.instrument,
          confidence: validatedOutput.confidence,
          minConfidence: options.minConfidence,
        });
      }
      
      // Optional: Validate step weights
      if (options?.validateWeights !== false) {
        const weights = validatedOutput.analysis.stepWeights;
        const sum = weights.security + weights.macro + weights.flux + weights.mag7 + weights.technical;
        if (Math.abs(sum - 1.0) > 0.01) {
          logger.warn('Step weights do not sum to 1.0', {
            instrument: input.instrument,
            sum,
            weights,
          });
        }
        
        // If technical analysis is unavailable, technical weight should be 0 or very low
        if (!input.technical && weights.technical > 0.1) {
          logger.warn('Technical weight is high but technical analysis is unavailable', {
            instrument: input.instrument,
            technicalWeight: weights.technical
          });
        }
      }
      
      const latencyMs = Date.now() - startTime;
      
      // Cache result
      if (useCache) {
        await cacheSynthesis(input.instrument, input.analysisDate, validatedOutput);
      }
      
      logger.info('Synthesis analysis completed successfully', {
        instrument: input.instrument,
        finalBias: validatedOutput.finalBias,
        confidence: validatedOutput.confidence,
        agreementLevel: validatedOutput.analysis.agreementLevel,
        latencyMs,
      });
      
      return {
        success: true,
        data: validatedOutput,
        metadata: {
          instrument: input.instrument,
          provider: response.provider,
          model: response.model,
          latencyMs,
          tokensUsed: response.tokensUsed,
          timestamp: new Date(),
          agreementLevel: validatedOutput.analysis.agreementLevel,
          confidence: validatedOutput.confidence,
        },
      };
      
    } catch (error) {
      lastError = error as Error;
      
      logger.error('Synthesis analysis attempt failed', {
        instrument: input.instrument,
        attempt,
        maxRetries,
        error: lastError.message,
      });
      
      // If this is not the last attempt, retry
      if (attempt < maxRetries) {
        logger.info('Retrying synthesis analysis', {
          instrument: input.instrument,
          nextAttempt: attempt + 1,
        });
        continue;
      }
    }
  }
  
  // All retries failed
  const latencyMs = Date.now() - startTime;
  
  logger.error('Synthesis analysis failed after all retries', {
    instrument: input.instrument,
    maxRetries,
    error: lastError?.message,
    latencyMs,
  });
  
  return {
    success: false,
    error: lastError?.message ?? 'Unknown error during synthesis',
    metadata: {
      instrument: input.instrument,
      provider: 'unknown',
      model: 'unknown',
      latencyMs,
      timestamp: new Date(),
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse AI response and extract JSON
 * Handles markdown code blocks and extra text
 */
function parseSynthesisResponse(content: string): SynthesisOutput {
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
  
  try {
    return JSON.parse(jsonString) as SynthesisOutput;
  } catch (error) {
    logger.error('Failed to parse synthesis JSON', {
      error: (error as Error).message,
      content: jsonString.substring(0, 200), // Log first 200 chars
    });
    throw new Error(`Invalid JSON response: ${(error as Error).message}`);
  }
}

/**
 * Calculate simple bias from 5-step results (fallback if AI fails)
 */
export function calculateFallbackBias(input: SynthesisInput): SynthesisOutput {
  logger.info('Calculating fallback bias', {
    instrument: input.instrument,
  });
  
  // Simple scoring: +1 for bullish signals, -1 for bearish, 0 for neutral
  let score = 0;
  let count = 0;
  
  // Security: Higher score = safer (neutral to slightly bullish)
  if (input.security.securityScore >= 7) {
    score += 0.5;
  } else if (input.security.securityScore <= 4) {
    score -= 0.5;
  }
  count++;
  
  // Macro: Sentiment
  if (input.macro.sentiment === 'VERY_BULLISH') score += 1;
  else if (input.macro.sentiment === 'BULLISH') score += 0.5;
  else if (input.macro.sentiment === 'BEARISH') score -= 0.5;
  else if (input.macro.sentiment === 'VERY_BEARISH') score -= 1;
  count++;
  
  // Flux: Institutional pressure
  if (input.flux.institutionalPressure === 'BULLISH') score += 1;
  else if (input.flux.institutionalPressure === 'BEARISH') score -= 1;
  count++;
  
  // Mag7: Sentiment
  if (input.mag7.overallSentiment === 'VERY_BULLISH') score += 1;
  else if (input.mag7.overallSentiment === 'BULLISH') score += 0.5;
  else if (input.mag7.overallSentiment === 'BEARISH') score -= 0.5;
  else if (input.mag7.overallSentiment === 'VERY_BEARISH') score -= 1;
  count++;
  
  // Technical: Trend direction
  if (input.technical.trend.direction === 'UPTREND' && input.technical.trend.strength > 0.6) {
    score += 1;
  } else if (input.technical.trend.direction === 'DOWNTREND' && input.technical.trend.strength > 0.6) {
    score -= 1;
  } else if (input.technical.trend.direction === 'UPTREND') {
    score += 0.5;
  } else if (input.technical.trend.direction === 'DOWNTREND') {
    score -= 0.5;
  }
  count++;
  
  // Determine final bias
  const avgScore = score / count;
  let finalBias: 'BEARISH' | 'NEUTRAL' | 'BULLISH';
  let confidence: number;
  
  if (avgScore > 0.3) {
    finalBias = 'BULLISH';
    confidence = Math.min(0.7, 0.5 + avgScore * 0.3);
  } else if (avgScore < -0.3) {
    finalBias = 'BEARISH';
    confidence = Math.min(0.7, 0.5 + Math.abs(avgScore) * 0.3);
  } else {
    finalBias = 'NEUTRAL';
    confidence = 0.5;
  }
  
  // Build fallback output
  return {
    finalBias,
    confidence,
    openingConfirmation: {
      expectedDirection: finalBias === 'BULLISH' ? 'UP' : finalBias === 'BEARISH' ? 'DOWN' : 'INDETERMINATE',
      confirmationScore: confidence * 0.8,
      timeToConfirm: '30min',
      confirmationCriteria: [
        'Price action confirms bias direction',
        'Volume supports the move',
        'Key levels hold or break as expected',
      ],
    },
    analysis: {
      summary: `Fallback synthesis: ${finalBias} bias with ${(confidence * 100).toFixed(0)}% confidence based on simple aggregation of 5-step analysis.`,
      stepWeights: {
        security: 0.15,
        macro: 0.25,
        flux: 0.20,
        mag7: 0.20,
        technical: 0.20,
      },
      agreementLevel: confidence,
      keyThesisPoints: [
        `Security score: ${input.security.securityScore}/10`,
        `Macro sentiment: ${input.macro.sentiment}`,
        `Institutional pressure: ${input.flux.institutionalPressure}`,
        `Mag7 sentiment: ${input.mag7.overallSentiment}`,
        `Technical trend: ${input.technical.trend.direction}`,
      ],
      counterArguments: [
        'Fallback calculation - AI synthesis unavailable',
        'Simple aggregation may miss nuanced signals',
      ],
      tradingRecommendations: {
        primary: `${finalBias} bias - wait for confirmation before entry`,
        targetUpside: finalBias === 'BULLISH' ? input.currentPrice * 1.02 : null,
        targetDownside: finalBias === 'BEARISH' ? input.currentPrice * 0.98 : null,
        stopLoss: finalBias === 'BULLISH' 
          ? input.currentPrice * 0.99 
          : finalBias === 'BEARISH' 
            ? input.currentPrice * 1.01 
            : null,
        riskRewardRatio: 2.0,
        alternativeSetups: ['Wait for clearer signals'],
      },
    },
    timestamp: new Date().toISOString(),
    instrument: input.instrument,
  };
}

/**
 * Batch synthesis for multiple instruments
 * Processes sequentially to avoid overwhelming the AI API
 */
export async function batchSynthesizeDailyBias(
  inputs: SynthesisInput[],
  options?: SynthesisOptions & {
    maxConcurrent?: number;
  }
): Promise<SynthesisResult[]> {
  const maxConcurrent = options?.maxConcurrent ?? 2; // Conservative default
  const results: SynthesisResult[] = [];
  
  logger.info('Starting batch synthesis', {
    count: inputs.length,
    maxConcurrent,
  });
  
  // Process in batches
  for (let i = 0; i < inputs.length; i += maxConcurrent) {
    const batch = inputs.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map(input => synthesizeDailyBias(input, options))
    );
    results.push(...batchResults);
    
    logger.info('Batch synthesis progress', {
      completed: results.length,
      total: inputs.length,
    });
  }
  
  logger.info('Batch synthesis completed', {
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
  });
  
  return results;
}

/**
 * Validate synthesis output quality
 * Returns warnings if output seems unreliable
 */
export function validateSynthesisQuality(output: SynthesisOutput): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  // Check confidence vs agreement level consistency
  if (output.confidence > 0.8 && output.analysis.agreementLevel < 0.6) {
    warnings.push('High confidence but low agreement level - inconsistent');
  }
  
  // Check if bias matches expected direction
  if (output.finalBias === 'BULLISH' && output.openingConfirmation.expectedDirection === 'DOWN') {
    warnings.push('Bullish bias but expecting down opening - contradictory');
  }
  if (output.finalBias === 'BEARISH' && output.openingConfirmation.expectedDirection === 'UP') {
    warnings.push('Bearish bias but expecting up opening - contradictory');
  }
  
  // Check trading recommendations consistency
  const rec = output.analysis.tradingRecommendations;
  if (output.finalBias === 'BULLISH' && rec.targetUpside === null) {
    warnings.push('Bullish bias but no upside target provided');
  }
  if (output.finalBias === 'BEARISH' && rec.targetDownside === null) {
    warnings.push('Bearish bias but no downside target provided');
  }
  
  // Check risk/reward ratio
  if (rec.riskRewardRatio !== null && rec.riskRewardRatio < 1.5) {
    warnings.push('Risk/reward ratio below 1.5 - suboptimal setup');
  }
  
  // Check summary length
  if (output.analysis.summary.length < 100) {
    warnings.push('Summary too short - may lack detail');
  }
  
  // Check key thesis points
  if (output.analysis.keyThesisPoints.length < 3) {
    warnings.push('Insufficient key thesis points - weak argument');
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
  };
}
