/**
 * Synthesis Service - Unit Tests
 * 
 * Tests for Step 6/6 (Synthesis & Final Bias) of Daily Bias Analysis
 * Task: PRÉ-8.5 - Synthesis Prompts (8h) - Dev 54, Dev 55
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  synthesizeDailyBias,
  calculateFallbackBias,
  batchSynthesizeDailyBias,
  validateSynthesisQuality,
  type SynthesisResult,
} from '../synthesis-service';
import { getSynthesisExample, type SynthesisInput, type SynthesisOutput } from '@/lib/prompts/synthesis-prompt';
import * as aiProvider from '@/lib/ai-provider';

// Mock AI provider
vi.mock('@/lib/ai-provider');

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ============================================================================
// Test Data
// ============================================================================

const mockSynthesisInput: SynthesisInput = getSynthesisExample();

const mockValidSynthesisOutput: SynthesisOutput = {
  finalBias: 'BULLISH',
  confidence: 0.82,
  openingConfirmation: {
    expectedDirection: 'UP',
    confirmationScore: 0.76,
    timeToConfirm: '30min',
    confirmationCriteria: [
      'Break above $18800 with volume > 5M',
      'Mag 7 leaders continue upward momentum',
      'Support at $18400 holds',
    ],
  },
  analysis: {
    summary: 'Strong BULLISH bias supported by multi-factor agreement. Macro bullish (Fed pause), Mag 7 momentum strong, technical breakout confirmed. Confidence 82% for opening UP.',
    stepWeights: {
      security: 0.15,
      macro: 0.25,
      flux: 0.20,
      mag7: 0.20,
      technical: 0.20,
    },
    agreementLevel: 0.88,
    keyThesisPoints: [
      'Macro context bullish (Fed pause expectations)',
      'Mag 7 leaders strong momentum (NVDA +3.12%)',
      'Technical breakout confirmed above MA20',
      'Institutional buying pressure (large buy orders 1.28x)',
      'Support levels intact and holding',
    ],
    counterArguments: [
      'High security score suggests volatility caution',
      'Elevated gap risk due to macro events',
    ],
    tradingRecommendations: {
      primary: 'Long on breakout above $18800',
      targetUpside: 19200,
      targetDownside: 18400,
      stopLoss: 18200,
      riskRewardRatio: 2.5,
      alternativeSetups: [
        'Wait for pullback to $18400 support',
        'Scale in on confirmation at $18800',
      ],
    },
  },
  timestamp: '2026-01-17T14:30:00Z',
  instrument: 'NQ1',
};

// ============================================================================
// Test Suite: Successful Synthesis
// ============================================================================

describe('synthesizeDailyBias - Successful Analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully synthesize daily bias with valid AI response', async () => {
    // Mock AI response
    vi.mocked(aiProvider.generateAIResponse).mockResolvedValue({
      content: JSON.stringify(mockValidSynthesisOutput),
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      latencyMs: 1800,
      tokensUsed: 2200,
    });

    const result = await synthesizeDailyBias(mockSynthesisInput);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.finalBias).toBe('BULLISH');
    expect(result.data?.confidence).toBe(0.82);
    expect(result.data?.instrument).toBe('NQ1');
    expect(result.metadata.provider).toBe('gemini');
    expect(result.metadata.latencyMs).toBeGreaterThan(0);
  });

  it('should handle markdown code blocks in AI response', async () => {
    const markdownResponse = `\`\`\`json
${JSON.stringify(mockValidSynthesisOutput)}
\`\`\``;

    vi.mocked(aiProvider.generateAIResponse).mockResolvedValue({
      content: markdownResponse,
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      latencyMs: 1900,
    });

    const result = await synthesizeDailyBias(mockSynthesisInput);

    expect(result.success).toBe(true);
    expect(result.data?.finalBias).toBe('BULLISH');
  });

  it('should handle extra text before/after JSON', async () => {
    const extraTextResponse = `Here is the synthesis analysis:

${JSON.stringify(mockValidSynthesisOutput)}

Hope this helps!`;

    vi.mocked(aiProvider.generateAIResponse).mockResolvedValue({
      content: extraTextResponse,
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      latencyMs: 1850,
    });

    const result = await synthesizeDailyBias(mockSynthesisInput);

    expect(result.success).toBe(true);
    expect(result.data?.finalBias).toBe('BULLISH');
  });

  it('should validate step weights sum to 1.0', async () => {
    vi.mocked(aiProvider.generateAIResponse).mockResolvedValue({
      content: JSON.stringify(mockValidSynthesisOutput),
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      latencyMs: 1800,
    });

    const result = await synthesizeDailyBias(mockSynthesisInput, {
      validateWeights: true,
    });

    expect(result.success).toBe(true);
    const weights = result.data!.analysis.stepWeights;
    const sum = weights.security + weights.macro + weights.flux + weights.mag7 + weights.technical;
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
  });
});

// ============================================================================
// Test Suite: Different Bias Scenarios
// ============================================================================

describe('synthesizeDailyBias - Bias Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle BEARISH bias correctly', async () => {
    const bearishOutput: SynthesisOutput = {
      ...mockValidSynthesisOutput,
      finalBias: 'BEARISH',
      confidence: 0.75,
      openingConfirmation: {
        expectedDirection: 'DOWN',
        confirmationScore: 0.70,
        timeToConfirm: '30min',
        confirmationCriteria: ['Break below $18400', 'Volume confirms selling'],
      },
    };

    vi.mocked(aiProvider.generateAIResponse).mockResolvedValue({
      content: JSON.stringify(bearishOutput),
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      latencyMs: 1800,
    });

    const result = await synthesizeDailyBias(mockSynthesisInput);

    expect(result.success).toBe(true);
    expect(result.data?.finalBias).toBe('BEARISH');
    expect(result.data?.openingConfirmation.expectedDirection).toBe('DOWN');
  });

  it('should handle NEUTRAL bias correctly', async () => {
    const neutralOutput: SynthesisOutput = {
      ...mockValidSynthesisOutput,
      finalBias: 'NEUTRAL',
      confidence: 0.50,
      openingConfirmation: {
        expectedDirection: 'INDETERMINATE',
        confirmationScore: 0.45,
        timeToConfirm: '1h',
        confirmationCriteria: ['Wait for clearer signals', 'Monitor key levels'],
      },
    };

    vi.mocked(aiProvider.generateAIResponse).mockResolvedValue({
      content: JSON.stringify(neutralOutput),
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      latencyMs: 1800,
    });

    const result = await synthesizeDailyBias(mockSynthesisInput);

    expect(result.success).toBe(true);
    expect(result.data?.finalBias).toBe('NEUTRAL');
    expect(result.data?.openingConfirmation.expectedDirection).toBe('INDETERMINATE');
  });

  it('should handle high confidence BULLISH bias', async () => {
    const highConfidenceOutput: SynthesisOutput = {
      ...mockValidSynthesisOutput,
      confidence: 0.95,
      analysis: {
        ...mockValidSynthesisOutput.analysis,
        agreementLevel: 0.95,
      },
    };

    vi.mocked(aiProvider.generateAIResponse).mockResolvedValue({
      content: JSON.stringify(highConfidenceOutput),
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      latencyMs: 1800,
    });

    const result = await synthesizeDailyBias(mockSynthesisInput);

    expect(result.success).toBe(true);
    expect(result.data?.confidence).toBe(0.95);
    expect(result.data?.analysis.agreementLevel).toBe(0.95);
  });

  it('should handle low confidence scenario', async () => {
    const lowConfidenceOutput: SynthesisOutput = {
      ...mockValidSynthesisOutput,
      finalBias: 'NEUTRAL',
      confidence: 0.35,
      analysis: {
        ...mockValidSynthesisOutput.analysis,
        agreementLevel: 0.40,
      },
    };

    vi.mocked(aiProvider.generateAIResponse).mockResolvedValue({
      content: JSON.stringify(lowConfidenceOutput),
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      latencyMs: 1800,
    });

    const result = await synthesizeDailyBias(mockSynthesisInput, {
      minConfidence: 0.5,
    });

    expect(result.success).toBe(true);
    expect(result.data?.confidence).toBeLessThan(0.5);
  });
});

// ============================================================================
// Test Suite: Error Handling
// ============================================================================

describe('synthesizeDailyBias - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retry on JSON parse error', async () => {
    vi.mocked(aiProvider.generateAIResponse)
      .mockResolvedValueOnce({
        content: 'Invalid JSON response',
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        latencyMs: 1800,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify(mockValidSynthesisOutput),
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        latencyMs: 1900,
      });

    const result = await synthesizeDailyBias(mockSynthesisInput, {
      maxRetries: 2,
    });

    expect(result.success).toBe(true);
    expect(aiProvider.generateAIResponse).toHaveBeenCalledTimes(2);
  });

  it('should fail after max retries', async () => {
    vi.mocked(aiProvider.generateAIResponse).mockResolvedValue({
      content: 'Invalid JSON response',
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      latencyMs: 1800,
    });

    const result = await synthesizeDailyBias(mockSynthesisInput, {
      maxRetries: 2,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(aiProvider.generateAIResponse).toHaveBeenCalledTimes(2);
  });

  it('should handle invalid schema response', async () => {
    const invalidOutput = {
      finalBias: 'INVALID_BIAS', // Invalid enum value
      confidence: 0.82,
      // Missing required fields
    };

    vi.mocked(aiProvider.generateAIResponse).mockResolvedValue({
      content: JSON.stringify(invalidOutput),
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      latencyMs: 1800,
    });

    const result = await synthesizeDailyBias(mockSynthesisInput, {
      maxRetries: 1,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle API error', async () => {
    vi.mocked(aiProvider.generateAIResponse).mockRejectedValue(
      new Error('API rate limit exceeded')
    );

    const result = await synthesizeDailyBias(mockSynthesisInput, {
      maxRetries: 1,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('API rate limit exceeded');
  });
});

// ============================================================================
// Test Suite: Configuration Options
// ============================================================================

describe('synthesizeDailyBias - Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use custom model', async () => {
    vi.mocked(aiProvider.generateAIResponse).mockResolvedValue({
      content: JSON.stringify(mockValidSynthesisOutput),
      provider: 'gemini',
      model: 'gemini-1.5-pro',
      latencyMs: 2200,
    });

    const result = await synthesizeDailyBias(mockSynthesisInput, {
      model: 'gemini-1.5-pro',
    });

    expect(result.success).toBe(true);
    expect(result.metadata.model).toBe('gemini-1.5-pro');
  });

  it('should use custom temperature', async () => {
    vi.mocked(aiProvider.generateAIResponse).mockResolvedValue({
      content: JSON.stringify(mockValidSynthesisOutput),
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      latencyMs: 1800,
    });

    await synthesizeDailyBias(mockSynthesisInput, {
      temperature: 0.6,
    });

    expect(aiProvider.generateAIResponse).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        temperature: 0.6,
      })
    );
  });

  it('should disable weight validation', async () => {
    const invalidWeightsOutput: SynthesisOutput = {
      ...mockValidSynthesisOutput,
      analysis: {
        ...mockValidSynthesisOutput.analysis,
        stepWeights: {
          security: 0.5, // Sum > 1.0
          macro: 0.3,
          flux: 0.3,
          mag7: 0.3,
          technical: 0.3,
        },
      },
    };

    vi.mocked(aiProvider.generateAIResponse).mockResolvedValue({
      content: JSON.stringify(invalidWeightsOutput),
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      latencyMs: 1800,
    });

    const result = await synthesizeDailyBias(mockSynthesisInput, {
      validateWeights: false,
    });

    // Should fail Zod validation even with validateWeights: false
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Test Suite: Fallback Bias Calculation
// ============================================================================

describe('calculateFallbackBias', () => {
  it('should calculate BULLISH bias from strong bullish signals', () => {
    const result = calculateFallbackBias(mockSynthesisInput);

    expect(result.finalBias).toBe('BULLISH');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.openingConfirmation.expectedDirection).toBe('UP');
  });

  it('should calculate BEARISH bias from strong bearish signals', () => {
    const bearishInput: SynthesisInput = {
      ...mockSynthesisInput,
      macro: {
        ...mockSynthesisInput.macro,
        sentiment: 'VERY_BEARISH',
      },
      flux: {
        ...mockSynthesisInput.flux,
        institutionalPressure: 'BEARISH',
      },
      mag7: {
        ...mockSynthesisInput.mag7,
        overallSentiment: 'VERY_BEARISH',
      },
      technical: {
        ...mockSynthesisInput.technical,
        trend: {
          direction: 'DOWNTREND',
          strength: 0.85,
          timeframe: 'DAILY',
        },
      },
    };

    const result = calculateFallbackBias(bearishInput);

    expect(result.finalBias).toBe('BEARISH');
    expect(result.openingConfirmation.expectedDirection).toBe('DOWN');
  });

  it('should calculate NEUTRAL bias from mixed signals', () => {
    const neutralInput: SynthesisInput = {
      ...mockSynthesisInput,
      macro: {
        ...mockSynthesisInput.macro,
        sentiment: 'NEUTRAL',
      },
      flux: {
        ...mockSynthesisInput.flux,
        institutionalPressure: 'NEUTRAL',
      },
      technical: {
        ...mockSynthesisInput.technical,
        trend: {
          direction: 'SIDEWAYS',
          strength: 0.3,
          timeframe: 'DAILY',
        },
      },
    };

    const result = calculateFallbackBias(neutralInput);

    expect(result.finalBias).toBe('NEUTRAL');
    expect(result.openingConfirmation.expectedDirection).toBe('INDETERMINATE');
  });
});

// ============================================================================
// Test Suite: Batch Synthesis
// ============================================================================

describe('batchSynthesizeDailyBias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process multiple instruments in parallel', async () => {
    vi.mocked(aiProvider.generateAIResponse).mockResolvedValue({
      content: JSON.stringify(mockValidSynthesisOutput),
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      latencyMs: 1800,
    });

    const inputs = [
      mockSynthesisInput,
      { ...mockSynthesisInput, instrument: 'ES1' },
      { ...mockSynthesisInput, instrument: 'TSLA' },
    ];

    const results = await batchSynthesizeDailyBias(inputs, {
      maxConcurrent: 2,
    });

    expect(results).toHaveLength(3);
    expect(results.every(r => r.success)).toBe(true);
  });

  it('should handle partial failures in batch', async () => {
    vi.mocked(aiProvider.generateAIResponse)
      .mockResolvedValueOnce({
        content: JSON.stringify(mockValidSynthesisOutput),
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        latencyMs: 1800,
      })
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce({
        content: JSON.stringify(mockValidSynthesisOutput),
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        latencyMs: 1800,
      });

    const inputs = [
      mockSynthesisInput,
      { ...mockSynthesisInput, instrument: 'ES1' },
      { ...mockSynthesisInput, instrument: 'TSLA' },
    ];

    const results = await batchSynthesizeDailyBias(inputs, {
      maxConcurrent: 1,
      maxRetries: 1,
    });

    expect(results).toHaveLength(3);
    expect(results.filter(r => r.success)).toHaveLength(2);
    expect(results.filter(r => !r.success)).toHaveLength(1);
  });

  it('should respect maxConcurrent limit', async () => {
    vi.mocked(aiProvider.generateAIResponse).mockResolvedValue({
      content: JSON.stringify(mockValidSynthesisOutput),
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      latencyMs: 1800,
    });

    const inputs = Array(5).fill(mockSynthesisInput);

    await batchSynthesizeDailyBias(inputs, {
      maxConcurrent: 2,
    });

    // Should make 3 batches: 2+2+1
    expect(aiProvider.generateAIResponse).toHaveBeenCalledTimes(5);
  });
});

// ============================================================================
// Test Suite: Quality Validation
// ============================================================================

describe('validateSynthesisQuality', () => {
  it('should pass validation for high-quality output', () => {
    const result = validateSynthesisQuality(mockValidSynthesisOutput);

    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('should warn on inconsistent confidence and agreement', () => {
    const inconsistentOutput: SynthesisOutput = {
      ...mockValidSynthesisOutput,
      confidence: 0.85,
      analysis: {
        ...mockValidSynthesisOutput.analysis,
        agreementLevel: 0.45,
      },
    };

    const result = validateSynthesisQuality(inconsistentOutput);

    expect(result.valid).toBe(false);
    expect(result.warnings).toContain(
      'High confidence but low agreement level - inconsistent'
    );
  });

  it('should warn on contradictory bias and direction', () => {
    const contradictoryOutput: SynthesisOutput = {
      ...mockValidSynthesisOutput,
      finalBias: 'BULLISH',
      openingConfirmation: {
        ...mockValidSynthesisOutput.openingConfirmation,
        expectedDirection: 'DOWN',
      },
    };

    const result = validateSynthesisQuality(contradictoryOutput);

    expect(result.valid).toBe(false);
    expect(result.warnings).toContain(
      'Bullish bias but expecting down opening - contradictory'
    );
  });

  it('should warn on missing targets', () => {
    const missingTargetsOutput: SynthesisOutput = {
      ...mockValidSynthesisOutput,
      finalBias: 'BULLISH',
      analysis: {
        ...mockValidSynthesisOutput.analysis,
        tradingRecommendations: {
          ...mockValidSynthesisOutput.analysis.tradingRecommendations,
          targetUpside: null,
        },
      },
    };

    const result = validateSynthesisQuality(missingTargetsOutput);

    expect(result.valid).toBe(false);
    expect(result.warnings).toContain(
      'Bullish bias but no upside target provided'
    );
  });

  it('should warn on poor risk/reward ratio', () => {
    const poorRROutput: SynthesisOutput = {
      ...mockValidSynthesisOutput,
      analysis: {
        ...mockValidSynthesisOutput.analysis,
        tradingRecommendations: {
          ...mockValidSynthesisOutput.analysis.tradingRecommendations,
          riskRewardRatio: 1.2,
        },
      },
    };

    const result = validateSynthesisQuality(poorRROutput);

    expect(result.valid).toBe(false);
    expect(result.warnings).toContain(
      'Risk/reward ratio below 1.5 - suboptimal setup'
    );
  });

  it('should warn on insufficient thesis points', () => {
    const insufficientThesisOutput: SynthesisOutput = {
      ...mockValidSynthesisOutput,
      analysis: {
        ...mockValidSynthesisOutput.analysis,
        keyThesisPoints: ['Only one point', 'And another'],
      },
    };

    const result = validateSynthesisQuality(insufficientThesisOutput);

    expect(result.valid).toBe(false);
    expect(result.warnings).toContain(
      'Insufficient key thesis points - weak argument'
    );
  });
});
