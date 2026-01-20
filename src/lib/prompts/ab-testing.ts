/**
 * A/B Testing Framework for Daily Bias Prompts
 * 
 * Framework for testing prompt variations and measuring performance
 * 
 * @module lib/prompts/ab-testing
 * @created 2026-01-18
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export type PromptVariant = 'A' | 'B' | 'C';
export type PromptType = 
  | 'SECURITY_ANALYSIS'
  | 'MACRO_ANALYSIS'
  | 'INSTITUTIONAL_FLUX'
  | 'MAG7_ANALYSIS'
  | 'TECHNICAL_STRUCTURE'
  | 'SYNTHESIS';

export interface ABTestConfig {
  promptType: PromptType;
  variant: PromptVariant;
  promptVersion: string; // e.g., "v1", "v2", "concise", "verbose"
  description: string;
  systemPrompt?: string;
  userPromptBuilder?: (input: any) => string;
  temperature?: number;
  maxTokens?: number;
}

export interface ABTestResult {
  promptType: PromptType;
  variant: PromptVariant;
  timestamp: Date;
  userId: string;
  instrument: string;
  responseTime: number; // ms
  tokenCount?: number;
  qualityScore?: number; // 0-10 (user feedback or automated)
  isValidJSON: boolean;
  errorOccurred: boolean;
  errorMessage?: string;
}

export interface ABTestMetrics {
  promptType: PromptType;
  variant: PromptVariant;
  totalTests: number;
  averageResponseTime: number;
  averageQualityScore: number;
  validJSONRate: number; // 0-1
  errorRate: number; // 0-1
  totalTokens: number;
  periodStart: Date;
  periodEnd: Date;
}

// ============================================================================
// A/B TEST RECORDING
// ============================================================================

/**
 * Record A/B test result
 */
export async function recordABTestResult(result: ABTestResult): Promise<void> {
  try {
    // Store in database (would need new table or use existing logging)
    // For now, log to structured logs that can be analyzed
    
    logger.info('A/B Test Result Recorded', {
      promptType: result.promptType,
      variant: result.variant,
      userId: result.userId,
      instrument: result.instrument,
      responseTime: result.responseTime,
      qualityScore: result.qualityScore,
      isValidJSON: result.isValidJSON,
      errorOccurred: result.errorOccurred,
      timestamp: result.timestamp.toISOString(),
    });
    
    // TODO: Store in dedicated A/B test results table
    // For now, we'll use logging + metrics aggregation
  } catch (error) {
    logger.error('Failed to record A/B test result', {
      error: error instanceof Error ? error.message : 'Unknown error',
      result
    });
  }
}

/**
 * Get A/B test metrics for a prompt type and variant
 */
export async function getABTestMetrics(
  promptType: PromptType,
  variant: PromptVariant,
  startDate: Date,
  endDate: Date
): Promise<ABTestMetrics | null> {
  try {
    // Query A/B test results from logs/database
    // For now, return structured metrics based on available data
    
    // TODO: Implement actual aggregation from A/B test results table
    // This would aggregate:
    // - Total tests in period
    // - Average response time
    // - Average quality score
    // - Valid JSON rate
    // - Error rate
    // - Total tokens consumed
    
    logger.debug('A/B Test Metrics Requested', {
      promptType,
      variant,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
    
    // Placeholder - would query actual results
    return {
      promptType,
      variant,
      totalTests: 0,
      averageResponseTime: 0,
      averageQualityScore: 0,
      validJSONRate: 0,
      errorRate: 0,
      totalTokens: 0,
      periodStart: startDate,
      periodEnd: endDate,
    };
  } catch (error) {
    logger.error('Failed to get A/B test metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      promptType,
      variant,
    });
    return null;
  }
}

/**
 * Compare two prompt variants
 */
export async function compareVariants(
  promptType: PromptType,
  variantA: PromptVariant,
  variantB: PromptVariant,
  startDate: Date,
  endDate: Date
): Promise<{
  winner: PromptVariant | 'TIE';
  metricsA: ABTestMetrics;
  metricsB: ABTestMetrics;
  significance: number; // 0-1 (statistical significance)
}> {
  const metricsA = await getABTestMetrics(promptType, variantA, startDate, endDate);
  const metricsB = await getABTestMetrics(promptType, variantB, startDate, endDate);
  
  if (!metricsA || !metricsB) {
    throw new Error('Metrics not available for comparison');
  }
  
  // Determine winner based on quality score, error rate, and response time
  let winner: PromptVariant | 'TIE' = 'TIE';
  let significance = 0;
  
  // Quality score comparison (weighted 60%)
  const qualityDiff = metricsA.averageQualityScore - metricsB.averageQualityScore;
  
  // Error rate comparison (weighted 30%)
  const errorDiff = metricsB.errorRate - metricsA.errorRate; // Lower is better
  
  // Response time comparison (weighted 10%)
  const speedDiff = metricsB.averageResponseTime - metricsA.averageResponseTime; // Lower is better
  
  // Weighted score
  const scoreA = 
    (metricsA.averageQualityScore * 0.6) +
    ((1 - metricsA.errorRate) * 30 * 0.3) +
    ((1 / (1 + metricsA.averageResponseTime / 1000)) * 10 * 0.1);
  
  const scoreB = 
    (metricsB.averageQualityScore * 0.6) +
    ((1 - metricsB.errorRate) * 30 * 0.3) +
    ((1 / (1 + metricsB.averageResponseTime / 1000)) * 10 * 0.1);
  
  // Simple significance calculation (would use proper statistical test in production)
  const sampleSize = Math.min(metricsA.totalTests, metricsB.totalTests);
  if (sampleSize > 30) {
    significance = Math.min(1, sampleSize / 100); // Rough approximation
  }
  
  if (scoreA > scoreB * 1.05) { // 5% threshold
    winner = variantA;
  } else if (scoreB > scoreA * 1.05) {
    winner = variantB;
  } else {
    winner = 'TIE';
  }
  
  return {
    winner,
    metricsA,
    metricsB,
    significance,
  };
}

// ============================================================================
// VARIANT SELECTION
// ============================================================================

/**
 * Select prompt variant for user (A/B testing)
 * 
 * Uses consistent hashing to ensure same user gets same variant
 * for consistency, or random for true A/B testing
 */
export function selectPromptVariant(
  userId: string,
  promptType: PromptType,
  useConsistent: boolean = true
): PromptVariant {
  if (!useConsistent) {
    // Random selection for true A/B testing
    const variants: PromptVariant[] = ['A', 'B', 'C'];
    return variants[Math.floor(Math.random() * variants.length)];
  }
  
  // Consistent hashing based on userId + promptType
  // Same user will always get same variant (for consistency)
  const hash = simpleHash(`${userId}:${promptType}`);
  const variants: PromptVariant[] = ['A', 'B', 'C'];
  return variants[hash % variants.length];
}

/**
 * Simple hash function for consistent variant selection
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// ============================================================================
// PROMPT VARIANT REGISTRY
// ============================================================================

/**
 * Registry of prompt variants for A/B testing
 */
export const PROMPT_VARIANTS: Record<PromptType, Record<PromptVariant, ABTestConfig>> = {
  SECURITY_ANALYSIS: {
    A: {
      promptType: 'SECURITY_ANALYSIS',
      variant: 'A',
      promptVersion: 'v1-verbose',
      description: 'Verbose security analysis prompt (default)',
      temperature: 0.3,
      maxTokens: 2000,
    },
    B: {
      promptType: 'SECURITY_ANALYSIS',
      variant: 'B',
      promptVersion: 'v2-concise',
      description: 'Concise security analysis prompt',
      temperature: 0.3,
      maxTokens: 1500,
    },
    C: {
      promptType: 'SECURITY_ANALYSIS',
      variant: 'C',
      promptVersion: 'v3-focused',
      description: 'Focused security analysis prompt (outcome-focused)',
      temperature: 0.2,
      maxTokens: 1800,
    },
  },
  MACRO_ANALYSIS: {
    A: {
      promptType: 'MACRO_ANALYSIS',
      variant: 'A',
      promptVersion: 'v1-verbose',
      description: 'Verbose macro analysis prompt (default)',
      temperature: 0.3,
      maxTokens: 2500,
    },
    B: {
      promptType: 'MACRO_ANALYSIS',
      variant: 'B',
      promptVersion: 'v2-concise',
      description: 'Concise macro analysis prompt',
      temperature: 0.3,
      maxTokens: 2000,
    },
    C: {
      promptType: 'MACRO_ANALYSIS',
      variant: 'C',
      promptVersion: 'v3-focused',
      description: 'Focused macro analysis prompt',
      temperature: 0.2,
      maxTokens: 2200,
    },
  },
  INSTITUTIONAL_FLUX: {
    A: {
      promptType: 'INSTITUTIONAL_FLUX',
      variant: 'A',
      promptVersion: 'v1-verbose',
      description: 'Verbose institutional flux prompt (default)',
      temperature: 0.3,
      maxTokens: 2000,
    },
    B: {
      promptType: 'INSTITUTIONAL_FLUX',
      variant: 'B',
      promptVersion: 'v2-concise',
      description: 'Concise institutional flux prompt',
      temperature: 0.3,
      maxTokens: 1500,
    },
    C: {
      promptType: 'INSTITUTIONAL_FLUX',
      variant: 'C',
      promptVersion: 'v3-focused',
      description: 'Focused institutional flux prompt',
      temperature: 0.2,
      maxTokens: 1800,
    },
  },
  MAG7_ANALYSIS: {
    A: {
      promptType: 'MAG7_ANALYSIS',
      variant: 'A',
      promptVersion: 'v1-verbose',
      description: 'Verbose Mag 7 analysis prompt (default)',
      temperature: 0.3,
      maxTokens: 2000,
    },
    B: {
      promptType: 'MAG7_ANALYSIS',
      variant: 'B',
      promptVersion: 'v2-concise',
      description: 'Concise Mag 7 analysis prompt',
      temperature: 0.3,
      maxTokens: 1500,
    },
    C: {
      promptType: 'MAG7_ANALYSIS',
      variant: 'C',
      promptVersion: 'v3-focused',
      description: 'Focused Mag 7 analysis prompt',
      temperature: 0.2,
      maxTokens: 1800,
    },
  },
  TECHNICAL_STRUCTURE: {
    A: {
      promptType: 'TECHNICAL_STRUCTURE',
      variant: 'A',
      promptVersion: 'v1-verbose',
      description: 'Verbose technical structure prompt (default)',
      temperature: 0.3,
      maxTokens: 2500,
    },
    B: {
      promptType: 'TECHNICAL_STRUCTURE',
      variant: 'B',
      promptVersion: 'v2-concise',
      description: 'Concise technical structure prompt',
      temperature: 0.3,
      maxTokens: 2000,
    },
    C: {
      promptType: 'TECHNICAL_STRUCTURE',
      variant: 'C',
      promptVersion: 'v3-focused',
      description: 'Focused technical structure prompt',
      temperature: 0.2,
      maxTokens: 2200,
    },
  },
  SYNTHESIS: {
    A: {
      promptType: 'SYNTHESIS',
      variant: 'A',
      promptVersion: 'v1-verbose',
      description: 'Verbose synthesis prompt (default)',
      temperature: 0.3,
      maxTokens: 3000,
    },
    B: {
      promptType: 'SYNTHESIS',
      variant: 'B',
      promptVersion: 'v2-concise',
      description: 'Concise synthesis prompt',
      temperature: 0.3,
      maxTokens: 2500,
    },
    C: {
      promptType: 'SYNTHESIS',
      variant: 'C',
      promptVersion: 'v3-focused',
      description: 'Focused synthesis prompt',
      temperature: 0.2,
      maxTokens: 2700,
    },
  },
};

/**
 * Get prompt variant config
 */
export function getPromptVariant(
  promptType: PromptType,
  variant: PromptVariant
): ABTestConfig {
  return PROMPT_VARIANTS[promptType][variant];
}

/**
 * Get all variants for a prompt type
 */
export function getAllVariants(promptType: PromptType): ABTestConfig[] {
  return Object.values(PROMPT_VARIANTS[promptType]);
}
