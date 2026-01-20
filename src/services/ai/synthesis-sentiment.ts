/**
 * Synthesis Sentiment Calculation (Story 12.11)
 * 
 * Weighted algorithm for determining final sentiment based on 5-step analysis.
 * Algorithm documented in: docs/architecture/synthesis-sentiment-algorithm.md
 */

// ============================================================================
// Types
// ============================================================================

export type SynthesisSentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface AnalysisStepBias {
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number; // 0-100
}

export interface AnalysisSteps {
  security: AnalysisStepBias;
  macro: AnalysisStepBias;
  flux: AnalysisStepBias;
  mag7: AnalysisStepBias;
  technical: AnalysisStepBias;
}

export interface SentimentWeights {
  security: number;
  macro: number;
  flux: number;
  mag7: number;
  technical: number;
}

export interface SentimentCalculationResult {
  sentiment: SynthesisSentiment;
  weightedScore: number;
  stepScores: {
    security: number;
    macro: number;
    flux: number;
    mag7: number;
    technical: number;
  };
  agreementLevel: number; // 0-1, how much steps agree
}

// ============================================================================
// Constants (Story 12.11 Spec)
// ============================================================================

/**
 * Step weights for sentiment calculation
 * 
 * - Security (20%): Foundation - risk tolerance and position sizing
 * - Macro (15%): Economic context
 * - Flux (25%): Highest weight - institutional "smart money" positioning
 * - Mag7 (20%): Tech leader sentiment (critical for indices)
 * - Technical (20%): Price action and structure
 */
export const DEFAULT_WEIGHTS: SentimentWeights = {
  security: 0.20,
  macro: 0.15,
  flux: 0.25,    // Highest weight - institutional positioning
  mag7: 0.20,
  technical: 0.20,
};

/**
 * Sentiment decision thresholds
 * 
 * - Score > 0.2 → BULLISH
 * - Score < -0.2 → BEARISH
 * - Otherwise → NEUTRAL
 */
export const BULLISH_THRESHOLD = 0.2;
export const BEARISH_THRESHOLD = -0.2;

// ============================================================================
// Main Algorithm
// ============================================================================

/**
 * Calculate sentiment from 5-step analysis using weighted voting
 * 
 * Algorithm:
 * 1. Convert each step bias to numeric score: BULLISH=+1, BEARISH=-1, NEUTRAL=0
 * 2. Apply step weights: security (20%), macro (15%), flux (25%), mag7 (20%), technical (20%)
 * 3. Calculate weighted score = sum(stepBias × stepWeight)
 * 4. Determine sentiment:
 *    - Score > 0.2 → BULLISH
 *    - Score < -0.2 → BEARISH
 *    - Otherwise → NEUTRAL
 * 
 * @param steps - Analysis results from 5 steps
 * @param weights - Optional custom weights (defaults to DEFAULT_WEIGHTS)
 * @returns Sentiment calculation result with metadata
 */
export function calculateSentiment(
  steps: AnalysisSteps,
  weights: SentimentWeights = DEFAULT_WEIGHTS
): SentimentCalculationResult {
  // Convert bias to numeric score
  const biasToScore = (bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL'): number => {
    switch (bias) {
      case 'BULLISH': return 1;
      case 'BEARISH': return -1;
      case 'NEUTRAL': return 0;
    }
  };
  
  // Calculate individual step scores (bias × weight)
  const stepScores = {
    security: biasToScore(steps.security.bias) * weights.security,
    macro: biasToScore(steps.macro.bias) * weights.macro,
    flux: biasToScore(steps.flux.bias) * weights.flux,
    mag7: biasToScore(steps.mag7.bias) * weights.mag7,
    technical: biasToScore(steps.technical.bias) * weights.technical,
  };
  
  // Calculate weighted total score
  const weightedScore = 
    stepScores.security +
    stepScores.macro +
    stepScores.flux +
    stepScores.mag7 +
    stepScores.technical;
  
  // Determine final sentiment based on thresholds
  let sentiment: SynthesisSentiment;
  if (weightedScore > BULLISH_THRESHOLD) {
    sentiment = 'BULLISH';
  } else if (weightedScore < BEARISH_THRESHOLD) {
    sentiment = 'BEARISH';
  } else {
    sentiment = 'NEUTRAL';
  }
  
  // Calculate agreement level (how much steps agree)
  const agreementLevel = calculateAgreementLevel(steps);
  
  return {
    sentiment,
    weightedScore,
    stepScores,
    agreementLevel,
  };
}

/**
 * Calculate agreement level across 5 steps
 * 
 * Returns 0-1 score indicating how much the steps agree:
 * - 1.0 = Perfect agreement (all same bias)
 * - 0.5 = Mixed signals
 * - 0.0 = Complete disagreement
 * 
 * Algorithm:
 * 1. Count bullish, bearish, neutral votes
 * 2. Calculate majority percentage
 * 3. Weight by confidence scores
 */
export function calculateAgreementLevel(steps: AnalysisSteps): number {
  const biases = [
    steps.security.bias,
    steps.macro.bias,
    steps.flux.bias,
    steps.mag7.bias,
    steps.technical.bias,
  ];
  
  const confidences = [
    steps.security.confidence / 100,
    steps.macro.confidence / 100,
    steps.flux.confidence / 100,
    steps.mag7.confidence / 100,
    steps.technical.confidence / 100,
  ];
  
  // Count votes
  const votes = {
    BULLISH: 0,
    BEARISH: 0,
    NEUTRAL: 0,
  };
  
  biases.forEach((bias) => {
    votes[bias]++;
  });
  
  // Find majority vote count
  const maxVotes = Math.max(votes.BULLISH, votes.BEARISH, votes.NEUTRAL);
  const majorityPercentage = maxVotes / biases.length;
  
  // Weight by average confidence
  const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  
  // Combine majority strength with confidence
  const agreementLevel = majorityPercentage * avgConfidence;
  
  return Math.max(0, Math.min(1, agreementLevel));
}

/**
 * Validate step weights sum to 1.0
 */
export function validateWeights(weights: SentimentWeights): boolean {
  const sum = weights.security + weights.macro + weights.flux + weights.mag7 + weights.technical;
  return Math.abs(sum - 1.0) < 0.01; // Allow 1% tolerance
}

/**
 * Get custom weights based on instrument type
 * 
 * Different instruments should weight factors differently:
 * - Indices (NQ, ES, SPY): Higher weight to MAG7 and Technical
 * - Forex (EUR/USD, XAU/USD): Higher weight to Macro
 * - Individual stocks: Higher weight to Security and Technical
 */
export function getInstrumentWeights(instrument: string): SentimentWeights {
  const upper = instrument.toUpperCase();
  
  // Indices - tech leaders matter more
  if (['NQ1', 'ES1', 'SPY', 'QQQ', 'TQQQ', 'SQQQ'].includes(upper)) {
    return {
      security: 0.15,
      macro: 0.15,
      flux: 0.20,
      mag7: 0.30,  // Higher for indices
      technical: 0.20,
    };
  }
  
  // Forex - macro matters more
  if (upper.includes('/') || upper.includes('USD') || upper === 'XAU/USD') {
    return {
      security: 0.15,
      macro: 0.35,  // Higher for forex
      flux: 0.20,
      mag7: 0.10,   // Lower for forex
      technical: 0.20,
    };
  }
  
  // Individual stocks - security and technical matter more
  return {
    security: 0.25,  // Higher for individual stocks
    macro: 0.10,
    flux: 0.25,
    mag7: 0.15,
    technical: 0.25,  // Higher for individual stocks
  };
}
