/**
 * A/B Testing Wrapper for Daily Bias Analysis Services
 * 
 * Wraps analysis services to record A/B test results
 * 
 * @module services/daily-bias/ab-test-wrapper
 * @created 2026-01-18
 */

import { 
  selectPromptVariant, 
  recordABTestResult, 
  getPromptVariant,
  type PromptType,
  type PromptVariant,
  type ABTestResult
} from '@/lib/prompts/ab-testing';
import { logger } from '@/lib/logger';

// ============================================================================
// A/B TEST WRAPPER
// ============================================================================

/**
 * Wrap an analysis function with A/B testing
 */
export async function withABTesting<T>(
  promptType: PromptType,
  userId: string,
  instrument: string,
  analysisFn: (variant: PromptVariant) => Promise<T>,
  options: {
    useConsistent?: boolean;
    recordResults?: boolean;
  } = {}
): Promise<{ result: T; variant: PromptVariant }> {
  const { useConsistent = true, recordResults = true } = options;
  
  // Select variant
  const variant = selectPromptVariant(userId, promptType, useConsistent);
  
  logger.debug('A/B Test variant selected', {
    promptType,
    variant,
    userId,
    instrument,
    useConsistent
  });
  
  // Execute analysis with variant
  const startTime = Date.now();
  let result: T;
  let isValidJSON = true;
  let errorOccurred = false;
  let errorMessage: string | undefined;
  let tokenCount: number | undefined;
  
  try {
    result = await analysisFn(variant);
    const responseTime = Date.now() - startTime;
    
    // Record A/B test result (success)
    if (recordResults) {
      const testResult: ABTestResult = {
        promptType,
        variant,
        timestamp: new Date(),
        userId,
        instrument,
        responseTime,
        tokenCount,
        qualityScore: undefined, // Would be set by user feedback or automated scoring
        isValidJSON,
        errorOccurred: false,
      };
      
      await recordABTestResult(testResult);
    }
    
    return { result, variant };
  } catch (error) {
    errorOccurred = true;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('A/B Test analysis failed', {
      promptType,
      variant,
      userId,
      instrument,
      error: errorMessage,
    });
    
    // Record A/B test result (error)
    if (recordResults) {
      const responseTime = Date.now() - startTime;
      const testResult: ABTestResult = {
        promptType,
        variant,
        timestamp: new Date(),
        userId,
        instrument,
        responseTime,
        tokenCount,
        qualityScore: 0,
        isValidJSON: false,
        errorOccurred: true,
        errorMessage,
      };
      
      await recordABTestResult(testResult);
    }
    
    throw error;
  }
}

/**
 * Get A/B test variant config for a prompt type
 */
export function getVariantConfig(
  promptType: PromptType,
  userId: string,
  useConsistent: boolean = true
): { variant: PromptVariant; config: ReturnType<typeof getPromptVariant> } {
  const variant = selectPromptVariant(userId, promptType, useConsistent);
  const config = getPromptVariant(promptType, variant);
  
  return { variant, config };
}
