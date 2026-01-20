/**
 * Tests for Synthesis Sentiment Algorithm (Story 12.11)
 * 
 * Validates weighted sentiment calculation and agreement level logic
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSentiment,
  calculateAgreementLevel,
  validateWeights,
  getInstrumentWeights,
  DEFAULT_WEIGHTS,
  BULLISH_THRESHOLD,
  BEARISH_THRESHOLD,
  type AnalysisSteps,
  type SentimentWeights,
} from '../synthesis-sentiment';

describe('Synthesis Sentiment Algorithm', () => {
  // ============================================================================
  // Scenario 1: All Bullish → BULLISH
  // ============================================================================
  it('should return BULLISH when all steps are bullish', () => {
    const steps: AnalysisSteps = {
      security: { bias: 'BULLISH', confidence: 80 },
      macro: { bias: 'BULLISH', confidence: 75 },
      flux: { bias: 'BULLISH', confidence: 85 },
      mag7: { bias: 'BULLISH', confidence: 90 },
      technical: { bias: 'BULLISH', confidence: 70 },
    };

    const result = calculateSentiment(steps, DEFAULT_WEIGHTS);

    expect(result.sentiment).toBe('BULLISH');
    expect(result.weightedScore).toBe(1.0);
    expect(result.agreementLevel).toBeGreaterThan(0.7);
  });

  // ============================================================================
  // Scenario 2: All Bearish → BEARISH
  // ============================================================================
  it('should return BEARISH when all steps are bearish', () => {
    const steps: AnalysisSteps = {
      security: { bias: 'BEARISH', confidence: 75 },
      macro: { bias: 'BEARISH', confidence: 80 },
      flux: { bias: 'BEARISH', confidence: 85 },
      mag7: { bias: 'BEARISH', confidence: 70 },
      technical: { bias: 'BEARISH', confidence: 90 },
    };

    const result = calculateSentiment(steps, DEFAULT_WEIGHTS);

    expect(result.sentiment).toBe('BEARISH');
    expect(result.weightedScore).toBe(-1.0);
    expect(result.agreementLevel).toBeGreaterThan(0.7);
  });

  // ============================================================================
  // Scenario 3: All Neutral → NEUTRAL
  // ============================================================================
  it('should return NEUTRAL when all steps are neutral', () => {
    const steps: AnalysisSteps = {
      security: { bias: 'NEUTRAL', confidence: 60 },
      macro: { bias: 'NEUTRAL', confidence: 65 },
      flux: { bias: 'NEUTRAL', confidence: 70 },
      mag7: { bias: 'NEUTRAL', confidence: 55 },
      technical: { bias: 'NEUTRAL', confidence: 60 },
    };

    const result = calculateSentiment(steps, DEFAULT_WEIGHTS);

    expect(result.sentiment).toBe('NEUTRAL');
    expect(result.weightedScore).toBe(0.0);
    expect(result.agreementLevel).toBeGreaterThan(0.5);
  });

  // ============================================================================
  // Scenario 4: Mixed Signals with Flux Driving Bullish
  // ============================================================================
  it('should be BULLISH when flux (25% weight) is bullish despite some neutral steps', () => {
    const steps: AnalysisSteps = {
      security: { bias: 'NEUTRAL', confidence: 60 },
      macro: { bias: 'BULLISH', confidence: 65 },
      flux: { bias: 'BULLISH', confidence: 80 }, // 25% weight
      mag7: { bias: 'BULLISH', confidence: 70 },
      technical: { bias: 'NEUTRAL', confidence: 55 },
    };

    const result = calculateSentiment(steps, DEFAULT_WEIGHTS);

    // Weighted score: 0 + 0.15 + 0.25 + 0.20 + 0 = 0.60
    expect(result.weightedScore).toBeCloseTo(0.60, 2);
    expect(result.sentiment).toBe('BULLISH');
  });

  // ============================================================================
  // Scenario 5: Flux Drives Bearish Decision
  // ============================================================================
  it('should be BEARISH when flux (25%) is bearish, overriding some bullish steps', () => {
    const steps: AnalysisSteps = {
      security: { bias: 'BEARISH', confidence: 60 }, // Changed to BEARISH
      macro: { bias: 'BEARISH', confidence: 65 },
      flux: { bias: 'BEARISH', confidence: 85 }, // 25% weight
      mag7: { bias: 'NEUTRAL', confidence: 55 },
      technical: { bias: 'BULLISH', confidence: 70 },
    };

    const result = calculateSentiment(steps, DEFAULT_WEIGHTS);

    // Weighted score: -0.20 - 0.15 - 0.25 + 0 + 0.20 = -0.40
    expect(result.weightedScore).toBeCloseTo(-0.40, 2);
    expect(result.sentiment).toBe('BEARISH');
  });

  // ============================================================================
  // Scenario 5b: Exactly at BEARISH Threshold → NEUTRAL
  // ============================================================================
  it('should be NEUTRAL when weighted score is exactly -0.2 (at threshold)', () => {
    const steps: AnalysisSteps = {
      security: { bias: 'NEUTRAL', confidence: 60 },
      macro: { bias: 'BEARISH', confidence: 65 },
      flux: { bias: 'BEARISH', confidence: 85 }, // 25% weight
      mag7: { bias: 'NEUTRAL', confidence: 55 },
      technical: { bias: 'BULLISH', confidence: 70 },
    };

    const result = calculateSentiment(steps, DEFAULT_WEIGHTS);

    // Weighted score: 0 - 0.15 - 0.25 + 0 + 0.20 = -0.20 (exactly at threshold)
    expect(result.weightedScore).toBeCloseTo(-0.20, 2);
    expect(result.sentiment).toBe('NEUTRAL'); // < -0.2 required for BEARISH
  });

  // ============================================================================
  // Scenario 6: Exactly at BULLISH Threshold → NEUTRAL
  // ============================================================================
  it('should be NEUTRAL when weighted score is exactly +0.2 (at threshold)', () => {
    const steps: AnalysisSteps = {
      security: { bias: 'BULLISH', confidence: 70 }, // +0.20
      macro: { bias: 'NEUTRAL', confidence: 60 },    // 0.00
      flux: { bias: 'NEUTRAL', confidence: 65 },     // 0.00
      mag7: { bias: 'NEUTRAL', confidence: 55 },     // 0.00
      technical: { bias: 'NEUTRAL', confidence: 60 }, // 0.00
    };

    const result = calculateSentiment(steps, DEFAULT_WEIGHTS);

    expect(result.weightedScore).toBeCloseTo(0.20, 2);
    expect(result.sentiment).toBe('NEUTRAL'); // > 0.2 for BULLISH, so 0.2 is NEUTRAL
  });

  // ============================================================================
  // Scenario 7: Just Above BULLISH Threshold
  // ============================================================================
  it('should be BULLISH when weighted score is just above +0.2', () => {
    const steps: AnalysisSteps = {
      security: { bias: 'BULLISH', confidence: 70 }, // +0.20
      macro: { bias: 'BULLISH', confidence: 60 },    // +0.15
      flux: { bias: 'NEUTRAL', confidence: 65 },     // 0.00
      mag7: { bias: 'NEUTRAL', confidence: 55 },     // 0.00
      technical: { bias: 'NEUTRAL', confidence: 60 }, // 0.00
    };

    const result = calculateSentiment(steps, DEFAULT_WEIGHTS);

    expect(result.weightedScore).toBeCloseTo(0.35, 2);
    expect(result.sentiment).toBe('BULLISH');
  });

  // ============================================================================
  // Scenario 8: Within Neutral Zone (-0.2 to +0.2)
  // ============================================================================
  it('should be NEUTRAL when weighted score is between -0.2 and +0.2', () => {
    const steps: AnalysisSteps = {
      security: { bias: 'NEUTRAL', confidence: 60 },  // 0.00
      macro: { bias: 'BULLISH', confidence: 65 },     // +0.15
      flux: { bias: 'NEUTRAL', confidence: 70 },      // 0.00
      mag7: { bias: 'NEUTRAL', confidence: 55 },      // 0.00
      technical: { bias: 'NEUTRAL', confidence: 60 }, // 0.00
    };

    const result = calculateSentiment(steps, DEFAULT_WEIGHTS);

    expect(result.weightedScore).toBeCloseTo(0.15, 2);
    expect(result.sentiment).toBe('NEUTRAL');
  });

  // ============================================================================
  // Scenario 9: Conflicting Signals → NEUTRAL
  // ============================================================================
  it('should be NEUTRAL when signals conflict (2 bullish, 2 bearish, 1 neutral)', () => {
    const steps: AnalysisSteps = {
      security: { bias: 'BULLISH', confidence: 70 },  // +0.20
      macro: { bias: 'BEARISH', confidence: 65 },     // -0.15
      flux: { bias: 'BEARISH', confidence: 75 },      // -0.25
      mag7: { bias: 'BULLISH', confidence: 70 },      // +0.20
      technical: { bias: 'NEUTRAL', confidence: 60 }, // 0.00
    };

    const result = calculateSentiment(steps, DEFAULT_WEIGHTS);

    // Weighted: 0.20 - 0.15 - 0.25 + 0.20 + 0 = 0.00
    expect(result.weightedScore).toBeCloseTo(0.00, 2);
    expect(result.sentiment).toBe('NEUTRAL');
  });

  // ============================================================================
  // Scenario 10: Strong Disagreement → Low Agreement Level
  // ============================================================================
  it('should have low agreement level when steps strongly disagree', () => {
    const steps: AnalysisSteps = {
      security: { bias: 'BULLISH', confidence: 80 },
      macro: { bias: 'BEARISH', confidence: 75 },
      flux: { bias: 'BULLISH', confidence: 70 },
      mag7: { bias: 'BEARISH', confidence: 85 },
      technical: { bias: 'NEUTRAL', confidence: 60 },
    };

    const result = calculateSentiment(steps, DEFAULT_WEIGHTS);

    // No clear majority (2 bullish, 2 bearish, 1 neutral)
    expect(result.agreementLevel).toBeLessThan(0.6);
  });
});

describe('Agreement Level Calculation', () => {
  it('should return high agreement when all steps agree', () => {
    const steps: AnalysisSteps = {
      security: { bias: 'BULLISH', confidence: 85 },
      macro: { bias: 'BULLISH', confidence: 80 },
      flux: { bias: 'BULLISH', confidence: 90 },
      mag7: { bias: 'BULLISH', confidence: 75 },
      technical: { bias: 'BULLISH', confidence: 85 },
    };

    const agreementLevel = calculateAgreementLevel(steps);

    // 5/5 agree (100%) × average confidence (~83%) ≈ 0.83
    expect(agreementLevel).toBeGreaterThan(0.75);
    expect(agreementLevel).toBeLessThanOrEqual(1.0);
  });

  it('should return medium agreement when majority agrees', () => {
    const steps: AnalysisSteps = {
      security: { bias: 'BULLISH', confidence: 70 },
      macro: { bias: 'BULLISH', confidence: 75 },
      flux: { bias: 'BULLISH', confidence: 80 },
      mag7: { bias: 'NEUTRAL', confidence: 60 },
      technical: { bias: 'BEARISH', confidence: 65 },
    };

    const agreementLevel = calculateAgreementLevel(steps);

    // 3/5 agree (60%) × average confidence (~70%) ≈ 0.42
    expect(agreementLevel).toBeGreaterThan(0.3);
    expect(agreementLevel).toBeLessThan(0.6);
  });

  it('should return low agreement when steps are split', () => {
    const steps: AnalysisSteps = {
      security: { bias: 'BULLISH', confidence: 60 },
      macro: { bias: 'BEARISH', confidence: 65 },
      flux: { bias: 'NEUTRAL', confidence: 55 },
      mag7: { bias: 'BULLISH', confidence: 70 },
      technical: { bias: 'BEARISH', confidence: 60 },
    };

    const agreementLevel = calculateAgreementLevel(steps);

    // 2/5 agree (40%) × average confidence (~62%) ≈ 0.25
    expect(agreementLevel).toBeLessThan(0.4);
  });
});

describe('Weight Validation', () => {
  it('should validate default weights sum to 1.0', () => {
    expect(validateWeights(DEFAULT_WEIGHTS)).toBe(true);
  });

  it('should reject weights that do not sum to 1.0', () => {
    const badWeights: SentimentWeights = {
      security: 0.25,
      macro: 0.25,
      flux: 0.25,
      mag7: 0.25,
      technical: 0.10, // Total = 1.10 ❌
    };

    expect(validateWeights(badWeights)).toBe(false);
  });

  it('should allow weights within 1% tolerance', () => {
    const slightlyOff: SentimentWeights = {
      security: 0.20,
      macro: 0.15,
      flux: 0.25,
      mag7: 0.20,
      technical: 0.199, // Total = 0.999 (within 1% tolerance)
    };

    expect(validateWeights(slightlyOff)).toBe(true);
  });
});

describe('Instrument-Specific Weights', () => {
  it('should return higher MAG7 weight for indices (NQ1)', () => {
    const weights = getInstrumentWeights('NQ1');

    expect(weights.mag7).toBe(0.30); // Higher for indices
    expect(weights.mag7).toBeGreaterThan(DEFAULT_WEIGHTS.mag7);
    expect(validateWeights(weights)).toBe(true);
  });

  it('should return higher macro weight for forex (EUR/USD)', () => {
    const weights = getInstrumentWeights('EUR/USD');

    expect(weights.macro).toBe(0.35); // Higher for forex
    expect(weights.macro).toBeGreaterThan(DEFAULT_WEIGHTS.macro);
    expect(weights.mag7).toBeLessThan(DEFAULT_WEIGHTS.mag7); // Lower for forex
    expect(validateWeights(weights)).toBe(true);
  });

  it('should return higher security/technical weight for stocks (TSLA)', () => {
    const weights = getInstrumentWeights('TSLA');

    expect(weights.security).toBe(0.25);
    expect(weights.technical).toBe(0.25);
    expect(weights.security).toBeGreaterThan(DEFAULT_WEIGHTS.security);
    expect(validateWeights(weights)).toBe(true);
  });

  it('should return default weights for unknown instruments', () => {
    const weights = getInstrumentWeights('UNKNOWN_SYMBOL');

    expect(weights.security).toBe(0.25); // Stock-like default
    expect(validateWeights(weights)).toBe(true);
  });
});

describe('Edge Cases', () => {
  it('should handle all neutral steps', () => {
    const steps: AnalysisSteps = {
      security: { bias: 'NEUTRAL', confidence: 50 },
      macro: { bias: 'NEUTRAL', confidence: 50 },
      flux: { bias: 'NEUTRAL', confidence: 50 },
      mag7: { bias: 'NEUTRAL', confidence: 50 },
      technical: { bias: 'NEUTRAL', confidence: 50 },
    };

    const result = calculateSentiment(steps, DEFAULT_WEIGHTS);

    expect(result.sentiment).toBe('NEUTRAL');
    expect(result.weightedScore).toBe(0.0);
  });

  it('should handle low confidence across all steps', () => {
    const steps: AnalysisSteps = {
      security: { bias: 'BULLISH', confidence: 10 },
      macro: { bias: 'BULLISH', confidence: 15 },
      flux: { bias: 'BULLISH', confidence: 20 },
      mag7: { bias: 'BULLISH', confidence: 25 },
      technical: { bias: 'BULLISH', confidence: 30 },
    };

    const result = calculateSentiment(steps, DEFAULT_WEIGHTS);

    expect(result.sentiment).toBe('BULLISH'); // Still bullish
    expect(result.agreementLevel).toBeLessThan(0.3); // Low confidence reflected
  });

  it('should handle high confidence with disagreement', () => {
    const steps: AnalysisSteps = {
      security: { bias: 'BULLISH', confidence: 95 },
      macro: { bias: 'BEARISH', confidence: 90 },
      flux: { bias: 'BULLISH', confidence: 92 },
      mag7: { bias: 'BEARISH', confidence: 88 },
      technical: { bias: 'NEUTRAL', confidence: 85 },
    };

    const result = calculateSentiment(steps, DEFAULT_WEIGHTS);

    // High confidence but split signals → Medium agreement
    expect(result.agreementLevel).toBeGreaterThan(0.3);
    expect(result.agreementLevel).toBeLessThan(0.6);
  });
});

describe('Step Scores Breakdown', () => {
  it('should correctly calculate individual step scores', () => {
    const steps: AnalysisSteps = {
      security: { bias: 'BULLISH', confidence: 70 },
      macro: { bias: 'BEARISH', confidence: 65 },
      flux: { bias: 'BULLISH', confidence: 80 },
      mag7: { bias: 'NEUTRAL', confidence: 55 },
      technical: { bias: 'BULLISH', confidence: 75 },
    };

    const result = calculateSentiment(steps, DEFAULT_WEIGHTS);

    expect(result.stepScores.security).toBeCloseTo(0.20, 2); // +1 × 0.20
    expect(result.stepScores.macro).toBeCloseTo(-0.15, 2);   // -1 × 0.15
    expect(result.stepScores.flux).toBeCloseTo(0.25, 2);     // +1 × 0.25
    expect(result.stepScores.mag7).toBeCloseTo(0.00, 2);     // 0 × 0.20
    expect(result.stepScores.technical).toBeCloseTo(0.20, 2); // +1 × 0.20

    // Total: 0.20 - 0.15 + 0.25 + 0.00 + 0.20 = 0.50
    expect(result.weightedScore).toBeCloseTo(0.50, 2);
  });
});
