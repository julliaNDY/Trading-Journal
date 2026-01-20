/**
 * AI Response Validator
 * 
 * Validates AI responses to detect hallucination and ensure citation accuracy.
 * Checks for fabricated data sources, invented URLs, and unverifiable claims.
 * 
 * @module services/ai/response-validator
 * @created 2026-01-20
 * @story 12.10 - AI Citation Enforcement
 */

import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  confidence: number; // 0-1 score of response quality
}

export interface HallucinationCheck {
  pattern: RegExp;
  severity: 'error' | 'warning';
  message: string;
}

// ============================================================================
// Hallucination Detection Patterns
// ============================================================================

/**
 * Patterns that indicate AI hallucination
 */
export const HALLUCINATION_PATTERNS: HallucinationCheck[] = [
  {
    pattern: /https?:\/\/[^\s"']+/gi,
    severity: 'error',
    message: 'AI invented URLs - URLs should not appear in analysis responses'
  },
  {
    pattern: /according to (?!the data provided|provided data)[A-Z][a-zA-Z\s]+ (?:API|service|database)/gi,
    severity: 'error',
    message: 'AI cited external API/service not in allowed sources'
  },
  {
    pattern: /(?:source|sourced from|data from) (?!the provided|provided data)[A-Z][a-zA-Z\s]+ (?:shows|indicates|reports)/gi,
    severity: 'error',
    message: 'AI claimed data from unverified source'
  },
  {
    pattern: /retrieved from|fetched from|pulled from/gi,
    severity: 'warning',
    message: 'AI implied data retrieval (may be hallucination)'
  },
  {
    pattern: /www\.[^\s"']+/gi,
    severity: 'error',
    message: 'AI invented website URLs'
  },
  {
    pattern: /(?:Bloomberg|Reuters|CNBC|MarketWatch) (?:reported|stated|indicated)/gi,
    severity: 'warning',
    message: 'AI cited news source without provided context'
  },
  {
    pattern: /based on (?:recent|latest) (?:news|reports|data)/gi,
    severity: 'warning',
    message: 'AI referenced recent data not provided in context'
  },
  {
    pattern: /\b(?:obviously|clearly|definitely|certainly) [a-z]+ (?:will|should|must)/gi,
    severity: 'warning',
    message: 'AI making overly confident predictions (possible speculation)'
  }
];

/**
 * Allowed source keywords (case-insensitive)
 * These are legitimate sources that can be mentioned
 */
const ALLOWED_SOURCE_KEYWORDS = [
  'provided data',
  'data provided',
  'given data',
  'input data',
  'the data',
  'this data',
  'available data',
  'calculation',
  'calculated',
  'analyzed',
  'analysis'
];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Main validation function
 * Checks AI response for hallucination and citation accuracy
 */
export function validateAIResponse(
  response: string,
  allowedSources: string[],
  options?: {
    strictMode?: boolean; // If true, warnings become errors
    maxErrors?: number; // Max errors before failing
  }
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let confidence = 1.0;
  
  const strictMode = options?.strictMode ?? false;
  const maxErrors = options?.maxErrors ?? 3;
  
  logger.debug('Validating AI response', {
    responseLength: response.length,
    allowedSourcesCount: allowedSources.length,
    strictMode
  });
  
  // 1. Check for hallucination patterns
  for (const check of HALLUCINATION_PATTERNS) {
    const matches = response.match(check.pattern);
    
    if (matches && matches.length > 0) {
      const message = `${check.message} (found ${matches.length} occurrence(s): "${matches[0]}")`;
      
      if (check.severity === 'error' || strictMode) {
        errors.push(message);
        confidence -= 0.15; // Reduce confidence significantly
      } else {
        warnings.push(message);
        confidence -= 0.05; // Slight confidence reduction
      }
      
      logger.warn('Hallucination pattern detected', {
        pattern: check.pattern.source,
        severity: check.severity,
        matches: matches.slice(0, 3), // Log first 3 matches
        message: check.message
      });
    }
  }
  
  // 2. Validate citations against allowed sources
  const citationValidation = validateCitations(response, allowedSources);
  if (!citationValidation.valid) {
    errors.push(...citationValidation.errors);
    confidence -= 0.1 * citationValidation.errors.length;
  }
  
  // 3. Check for empty or suspiciously short responses
  if (response.trim().length < 50) {
    warnings.push('Response is suspiciously short (< 50 characters)');
    confidence -= 0.1;
  }
  
  // 4. Check for JSON validity (if expected to be JSON)
  if (response.trim().startsWith('{') || response.trim().startsWith('[')) {
    try {
      JSON.parse(response.trim());
    } catch {
      errors.push('Response appears to be malformed JSON');
      confidence -= 0.2;
    }
  }
  
  // 5. Ensure confidence stays in bounds
  confidence = Math.max(0, Math.min(1, confidence));
  
  // 6. Determine validity
  const valid = errors.length === 0 || errors.length < maxErrors;
  
  logger.info('AI response validation complete', {
    valid,
    errorCount: errors.length,
    warningCount: warnings.length,
    confidence: confidence.toFixed(2)
  });
  
  return {
    valid,
    errors,
    warnings,
    confidence
  };
}

/**
 * Validate citations in AI response
 * Ensures AI only cites allowed sources
 */
export function validateCitations(
  response: string,
  allowedSources: string[]
): {
  valid: boolean;
  errors: string[];
  citedSources: string[];
} {
  const errors: string[] = [];
  const citedSources: string[] = [];
  
  // Extract potential citations (case-insensitive)
  const citationPatterns = [
    /(?:according to|based on|from|via|using)\s+([A-Z][a-zA-Z\s]{3,30})/gi,
    /(?:source|sourced from|data from):\s*([A-Z][a-zA-Z\s]{3,30})/gi
  ];
  
  for (const pattern of citationPatterns) {
    const matches = [...response.matchAll(pattern)];
    
    for (const match of matches) {
      const citedSource = match[1].trim();
      citedSources.push(citedSource);
      
      // Check if cited source is allowed
      const isAllowed = 
        allowedSources.some(allowed => 
          citedSource.toLowerCase().includes(allowed.toLowerCase()) ||
          allowed.toLowerCase().includes(citedSource.toLowerCase())
        ) ||
        ALLOWED_SOURCE_KEYWORDS.some(keyword =>
          citedSource.toLowerCase().includes(keyword)
        );
      
      if (!isAllowed) {
        errors.push(`AI cited unverified source: "${citedSource}"`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    citedSources: [...new Set(citedSources)] // Remove duplicates
  };
}

/**
 * Extract clean JSON from AI response
 * Removes markdown code blocks and other formatting
 */
export function extractJSON(response: string): string {
  let cleaned = response.trim();
  
  // Remove markdown code blocks
  if (cleaned.startsWith('```')) {
    const firstLineEnd = cleaned.indexOf('\n');
    if (firstLineEnd !== -1) {
      cleaned = cleaned.slice(firstLineEnd + 1);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
  }
  
  // Try to find JSON object if there's extra text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }
  
  return cleaned.trim();
}

/**
 * Retry logic for failed validations
 * Returns updated prompt with stronger anti-hallucination instructions
 */
export function generateRetryPrompt(
  originalPrompt: string,
  validationErrors: string[]
): string {
  const errorSummary = validationErrors.join('\n- ');
  
  return `
🚨 CRITICAL: The previous response contained errors:
${errorSummary}

STRICT INSTRUCTIONS FOR RETRY:
1. DO NOT invent any data, sources, or URLs
2. ONLY use data explicitly provided in the original prompt below
3. If you cannot determine something from provided data, state "unavailable" or "insufficient data"
4. DO NOT cite external sources (APIs, websites, news)
5. Base ALL conclusions on the data provided ONLY

--- ORIGINAL PROMPT ---
${originalPrompt}

Retry with strict adherence to these rules:`;
}

/**
 * Check if response should be retried
 */
export function shouldRetry(validation: ValidationResult, attempt: number, maxRetries: number = 2): boolean {
  if (attempt >= maxRetries) {
    return false;
  }
  
  // Retry if there are errors (but not too many)
  if (validation.errors.length > 0 && validation.errors.length < 5) {
    return true;
  }
  
  // Retry if confidence is very low
  if (validation.confidence < 0.5) {
    return true;
  }
  
  return false;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  validateAIResponse,
  validateCitations,
  extractJSON,
  generateRetryPrompt,
  shouldRetry,
  HALLUCINATION_PATTERNS
};
