/**
 * Prompt Variants for A/B Testing
 * 
 * Defines variant implementations of prompts for A/B testing
 * 
 * @module lib/prompts/prompt-variants
 * @created 2026-01-18
 */

import type { PromptVariant, PromptType } from './ab-testing';

// ============================================================================
// PROMPT VARIANT BUILDERS
// ============================================================================

/**
 * Build prompt with variant modifications
 * 
 * This function applies variant-specific modifications to base prompts
 */
export function buildVariantPrompt(
  basePrompt: string,
  promptType: PromptType,
  variant: PromptVariant
): string {
  switch (variant) {
    case 'A':
      // Variant A: Verbose (default)
      return basePrompt;
    
    case 'B':
      // Variant B: Concise
      return makeConcise(basePrompt);
    
    case 'C':
      // Variant C: Outcome-focused
      return makeOutcomeFocused(basePrompt, promptType);
    
    default:
      return basePrompt;
  }
}

/**
 * Make prompt more concise
 */
function makeConcise(prompt: string): string {
  // Remove verbose instructions
  let concise = prompt
    // Remove detailed examples
    .replace(/EXAMPLE:[\s\S]*?(?=\n\n|\n[A-Z]{2,})/g, '')
    // Remove repetitive instructions
    .replace(/CRITICAL RULES:[\s\S]*?(?=\n\n)/g, 'CRITICAL: ')
    // Shorten sections
    .replace(/ANALYSIS FRAMEWORK:/g, 'ANALYSIS:')
    .replace(/OUTPUT REQUIREMENTS:/g, 'OUTPUT:')
    // Remove verbose explanations
    .replace(/Remember:[\s\S]*$/g, '')
    .replace(/Note:[\s\S]*$/g, '')
    // Trim extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return concise;
}

/**
 * Make prompt outcome-focused
 */
function makeOutcomeFocused(prompt: string, promptType: PromptType): string {
  // Add outcome-focused instructions at the beginning
  const outcomeInstruction = getOutcomeInstruction(promptType);
  
  // Focus on actionable outputs
  let focused = prompt
    // Emphasize output requirements
    .replace(/OUTPUT REQUIREMENTS:/g, 'ACTIONABLE OUTPUT (CRITICAL):')
    // Remove verbose context
    .replace(/Your role is to[\s\S]*?CRITICAL RULES:/g, 'CRITICAL RULES:')
    // Add outcome focus
    .replace(/CRITICAL RULES:/, `${outcomeInstruction}\n\nCRITICAL RULES:`);
  
  return focused;
}

/**
 * Get outcome instruction for prompt type
 */
function getOutcomeInstruction(promptType: PromptType): string {
  const instructions: Record<PromptType, string> = {
    SECURITY_ANALYSIS: 'Focus on actionable risk assessment: volatility index (0-100), risk level (LOW/MEDIUM/HIGH), and clear position sizing recommendations.',
    MACRO_ANALYSIS: 'Focus on actionable macro signals: economic events impact (high/medium/low), sentiment (BULLISH/BEARISH/NEUTRAL), and clear market implications.',
    INSTITUTIONAL_FLUX: 'Focus on actionable flux signals: volume profile strength, order flow direction (BULLISH/BEARISH), and clear entry/exit timing.',
    MAG7_ANALYSIS: 'Focus on actionable correlation signals: leader score (0-10), overall sentiment (VERY_BULLISH/BULLISH/NEUTRAL/BEARISH/VERY_BEARISH), and clear market direction.',
    TECHNICAL_STRUCTURE: 'Focus on actionable technical levels: key support/resistance prices, trend direction (UPTREND/DOWNTREND/SIDEWAYS), and clear breakout levels.',
    SYNTHESIS: 'Focus on actionable final bias: BULLISH/BEARISH/NEUTRAL with confidence (0-100), opening confirmation, and clear trading recommendations.',
  };
  
  return instructions[promptType];
}

// ============================================================================
// TEMPERATURE & TOKEN OVERRIDES
// ============================================================================

/**
 * Get temperature override for variant
 */
export function getVariantTemperature(
  promptType: PromptType,
  variant: PromptVariant,
  defaultTemp: number = 0.3
): number {
  const variantTemp: Record<PromptVariant, number> = {
    A: defaultTemp, // Verbose: default
    B: defaultTemp, // Concise: default
    C: defaultTemp - 0.1, // Outcome-focused: lower temp for more deterministic
  };
  
  return variantTemp[variant];
}

/**
 * Get max tokens override for variant
 */
export function getVariantMaxTokens(
  promptType: PromptType,
  variant: PromptVariant,
  defaultMaxTokens: number = 2000
): number {
  const variantMaxTokens: Record<PromptVariant, number> = {
    A: defaultMaxTokens, // Verbose: default
    B: Math.floor(defaultMaxTokens * 0.75), // Concise: 25% fewer tokens
    C: Math.floor(defaultMaxTokens * 0.9), // Outcome-focused: 10% fewer tokens
  };
  
  return variantMaxTokens[variant];
}
