/**
 * Security Analysis Service
 * 
 * Step 1/6 of Daily Bias Analysis
 * Provides volatility assessment and risk profiling for trading instruments
 */

import { generateAIResponse } from '@/lib/ai-provider';
import type { AIMessage } from '@/lib/ai-provider';
import {
  buildSecurityAnalysisPrompt,
  SECURITY_ANALYSIS_SYSTEM_PROMPT,
  validateSecurityAnalysisOutput,
  type SecurityAnalysisInput,
  type SecurityAnalysisOutput,
} from '@/lib/prompts/daily-bias-prompts';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface SecurityAnalysisResult {
  success: boolean;
  data?: SecurityAnalysisOutput;
  error?: string;
  metadata: {
    symbol: string;
    provider: string;
    model: string;
    latencyMs: number;
    tokensUsed?: number;
    timestamp: Date;
  };
}

// ============================================================================
// Main Service Function
// ============================================================================

/**
 * Analyze security profile and volatility for a trading instrument
 * 
 * @param input - Instrument data (price, volume, etc.)
 * @param options - Optional configuration (model, temperature, etc.)
 * @returns Security analysis result with risk assessment
 */
export async function analyzeSecurityProfile(
  input: SecurityAnalysisInput,
  options?: {
    model?: string;
    temperature?: number;
    maxRetries?: number;
  }
): Promise<SecurityAnalysisResult> {
  const startTime = Date.now();
  const maxRetries = options?.maxRetries ?? 2;
  
  logger.info('Starting security analysis', {
    symbol: input.symbol,
    assetType: input.assetType,
  });
  
  let lastError: Error | null = null;
  
  // Retry loop (in case of JSON parsing errors or API failures)
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Build messages for AI
      const messages: AIMessage[] = [
        {
          role: 'system',
          content: SECURITY_ANALYSIS_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: buildSecurityAnalysisPrompt(input),
        },
      ];
      
      // Generate AI response
      const response = await generateAIResponse(messages, {
        preferredProvider: 'gemini',
        fallbackEnabled: true,
        geminiModel: options?.model,
        temperature: options?.temperature ?? 0.3, // Lower temperature for consistent risk assessment
        maxTokens: 1500,
      });
      
      logger.info('AI response received', {
        symbol: input.symbol,
        provider: response.provider,
        model: response.model,
        latencyMs: response.latencyMs,
        attempt,
      });
      
      // Parse JSON response
      const parsedOutput = parseSecurityAnalysisResponse(response.content);
      
      // Validate output
      if (!validateSecurityAnalysisOutput(parsedOutput)) {
        throw new Error('Invalid security analysis output schema');
      }
      
      const totalLatency = Date.now() - startTime;
      
      logger.info('Security analysis completed successfully', {
        symbol: input.symbol,
        riskLevel: parsedOutput.riskLevel,
        volatilityIndex: parsedOutput.volatilityIndex,
        securityScore: parsedOutput.securityScore,
        totalLatencyMs: totalLatency,
      });
      
      return {
        success: true,
        data: parsedOutput,
        metadata: {
          symbol: input.symbol,
          provider: response.provider,
          model: response.model,
          latencyMs: totalLatency,
          tokensUsed: response.usage?.totalTokens,
          timestamp: new Date(),
        },
      };
      
    } catch (error) {
      lastError = error as Error;
      
      logger.warn('Security analysis attempt failed', {
        symbol: input.symbol,
        attempt,
        maxRetries,
        error: lastError.message,
      });
      
      // If this was the last attempt, break
      if (attempt === maxRetries) {
        break;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  // All retries failed
  const totalLatency = Date.now() - startTime;
  
  logger.error('Security analysis failed after all retries', {
    symbol: input.symbol,
    maxRetries,
    error: lastError?.message,
    totalLatencyMs: totalLatency,
  });
  
  return {
    success: false,
    error: lastError?.message || 'Unknown error during security analysis',
    metadata: {
      symbol: input.symbol,
      provider: 'unknown',
      model: 'unknown',
      latencyMs: totalLatency,
      timestamp: new Date(),
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse AI response and extract JSON
 * Handles cases where AI returns markdown code blocks or extra text
 */
function parseSecurityAnalysisResponse(content: string): SecurityAnalysisOutput {
  let jsonString = content.trim();
  
  // Remove markdown code blocks if present
  if (jsonString.startsWith('```json')) {
    jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (jsonString.startsWith('```')) {
    jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  // Try to find JSON object if there's extra text
  const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonString = jsonMatch[0];
  }
  
  try {
    const parsed = JSON.parse(jsonString);
    return parsed as SecurityAnalysisOutput;
  } catch (error) {
    logger.error('Failed to parse security analysis JSON', {
      error: (error as Error).message,
      content: content.substring(0, 200), // Log first 200 chars
    });
    throw new Error(`JSON parsing failed: ${(error as Error).message}`);
  }
}

/**
 * Calculate a simple volatility index based on price data
 * Used as a fallback or validation against AI output
 */
export function calculateVolatilityIndex(input: SecurityAnalysisInput): number {
  const priceRange = input.high24h - input.low24h;
  const priceRangePercent = (priceRange / input.low24h) * 100;
  const absPriceChangePercent = Math.abs(input.priceChangePercent24h);
  
  // Combine price range and price change for volatility estimate
  // 0-2% range = low volatility (0-25)
  // 2-5% range = moderate volatility (26-50)
  // 5-10% range = high volatility (51-75)
  // 10%+ range = extreme volatility (76-100)
  
  let volatilityIndex = 0;
  
  if (priceRangePercent <= 2) {
    volatilityIndex = (priceRangePercent / 2) * 25;
  } else if (priceRangePercent <= 5) {
    volatilityIndex = 25 + ((priceRangePercent - 2) / 3) * 25;
  } else if (priceRangePercent <= 10) {
    volatilityIndex = 50 + ((priceRangePercent - 5) / 5) * 25;
  } else {
    volatilityIndex = 75 + Math.min((priceRangePercent - 10) / 10 * 25, 25);
  }
  
  // Adjust for absolute price change
  const changeBoost = (absPriceChangePercent / 10) * 10; // Up to +10 points
  volatilityIndex = Math.min(volatilityIndex + changeBoost, 100);
  
  return Math.round(volatilityIndex);
}

/**
 * Map volatility index to risk level
 */
export function mapVolatilityToRiskLevel(volatilityIndex: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
  if (volatilityIndex <= 25) return 'LOW';
  if (volatilityIndex <= 50) return 'MEDIUM';
  if (volatilityIndex <= 75) return 'HIGH';
  return 'EXTREME';
}

// ============================================================================
// Batch Analysis
// ============================================================================

/**
 * Analyze multiple instruments in parallel
 * Useful for analyzing a watchlist or portfolio
 */
export async function batchAnalyzeSecurityProfiles(
  inputs: SecurityAnalysisInput[],
  options?: {
    model?: string;
    temperature?: number;
    maxConcurrent?: number;
  }
): Promise<SecurityAnalysisResult[]> {
  const maxConcurrent = options?.maxConcurrent ?? 3; // Limit concurrent requests
  const results: SecurityAnalysisResult[] = [];
  
  logger.info('Starting batch security analysis', {
    count: inputs.length,
    maxConcurrent,
  });
  
  // Process in batches to avoid rate limits
  for (let i = 0; i < inputs.length; i += maxConcurrent) {
    const batch = inputs.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map(input => analyzeSecurityProfile(input, options))
    );
    results.push(...batchResults);
    
    // Small delay between batches
    if (i + maxConcurrent < inputs.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  logger.info('Batch security analysis completed', {
    total: inputs.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
  });
  
  return results;
}
