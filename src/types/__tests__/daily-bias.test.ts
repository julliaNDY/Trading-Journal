/**
 * Unit Tests for Daily Bias TypeScript Types and Utilities
 * PRÉ-9.2: TypeScript Types
 * 
 * Tests cover:
 * - Type guards
 * - Helper functions
 * - Utility functions
 * - Mock data creation
 * - State management utilities
 */

import { describe, it, expect } from 'vitest';
import * as DailyBias from '../daily-bias';

describe('Daily Bias Types - Type Guards', () => {
  describe('isBiasDirection', () => {
    it('should return true for valid bias directions', () => {
      expect(DailyBias.isBiasDirection('BEARISH')).toBe(true);
      expect(DailyBias.isBiasDirection('NEUTRAL')).toBe(true);
      expect(DailyBias.isBiasDirection('BULLISH')).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(DailyBias.isBiasDirection('INVALID')).toBe(false);
      expect(DailyBias.isBiasDirection('')).toBe(false);
      expect(DailyBias.isBiasDirection(null)).toBe(false);
      expect(DailyBias.isBiasDirection(undefined)).toBe(false);
      expect(DailyBias.isBiasDirection(123)).toBe(false);
    });
  });

  describe('isRiskLevel', () => {
    it('should return true for valid risk levels', () => {
      expect(DailyBias.isRiskLevel('LOW')).toBe(true);
      expect(DailyBias.isRiskLevel('MEDIUM')).toBe(true);
      expect(DailyBias.isRiskLevel('HIGH')).toBe(true);
      expect(DailyBias.isRiskLevel('CRITICAL')).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(DailyBias.isRiskLevel('INVALID')).toBe(false);
      expect(DailyBias.isRiskLevel('')).toBe(false);
    });
  });

  describe('isSentimentLevel', () => {
    it('should return true for valid sentiment levels', () => {
      expect(DailyBias.isSentimentLevel('VERY_BEARISH')).toBe(true);
      expect(DailyBias.isSentimentLevel('BEARISH')).toBe(true);
      expect(DailyBias.isSentimentLevel('NEUTRAL')).toBe(true);
      expect(DailyBias.isSentimentLevel('BULLISH')).toBe(true);
      expect(DailyBias.isSentimentLevel('VERY_BULLISH')).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(DailyBias.isSentimentLevel('INVALID')).toBe(false);
    });
  });

  describe('isMag7Symbol', () => {
    it('should return true for valid Mag7 symbols', () => {
      DailyBias.MAG7_SYMBOLS.forEach((symbol) => {
        expect(DailyBias.isMag7Symbol(symbol)).toBe(true);
      });
    });

    it('should return false for invalid symbols', () => {
      expect(DailyBias.isMag7Symbol('INVALID')).toBe(false);
      expect(DailyBias.isMag7Symbol('SPY')).toBe(false);
    });
  });

  describe('isDailyBiasAnalysisResponse', () => {
    it('should return true for valid response', () => {
      const response = DailyBias.createMockAnalysisResponse('NQ1');
      expect(DailyBias.isDailyBiasAnalysisResponse(response)).toBe(true);
    });

    it('should return false for invalid response', () => {
      expect(DailyBias.isDailyBiasAnalysisResponse({})).toBe(false);
      expect(DailyBias.isDailyBiasAnalysisResponse(null)).toBe(false);
      expect(DailyBias.isDailyBiasAnalysisResponse({ instrument: 'NQ1' })).toBe(false);
    });
  });

  describe('isErrorResponse', () => {
    it('should return true for valid error response', () => {
      const error = DailyBias.createMockErrorResponse();
      expect(DailyBias.isErrorResponse(error)).toBe(true);
    });

    it('should return false for invalid error response', () => {
      expect(DailyBias.isErrorResponse({})).toBe(false);
      expect(DailyBias.isErrorResponse(null)).toBe(false);
    });
  });
});

describe('Daily Bias Types - Helper Functions', () => {
  describe('isValidInstrument', () => {
    it('should return true for valid instruments', () => {
      expect(DailyBias.isValidInstrument('NQ1')).toBe(true);
      expect(DailyBias.isValidInstrument('ES1')).toBe(true);
      expect(DailyBias.isValidInstrument('TSLA')).toBe(true);
      expect(DailyBias.isValidInstrument('XAU/USD')).toBe(true);
    });

    it('should return false for invalid instruments', () => {
      expect(DailyBias.isValidInstrument('INVALID')).toBe(false);
      expect(DailyBias.isValidInstrument('')).toBe(false);
    });
  });

  describe('getStepDisplayName', () => {
    it('should return correct display names', () => {
      expect(DailyBias.getStepDisplayName('security')).toBe('Security Analysis');
      expect(DailyBias.getStepDisplayName('macro')).toBe('Macro Analysis');
      expect(DailyBias.getStepDisplayName('flux')).toBe('Institutional Flux');
      expect(DailyBias.getStepDisplayName('mag7')).toBe('Mag 7 Leaders');
      expect(DailyBias.getStepDisplayName('technical')).toBe('Technical Structure');
      expect(DailyBias.getStepDisplayName('synthesis')).toBe('Synthesis & Final Bias');
    });
  });

  describe('extractScores', () => {
    it('should extract all scores from analysis steps', () => {
      const response = DailyBias.createMockAnalysisResponse('NQ1');
      const scores = DailyBias.extractScores(response.steps);

      expect(scores).toHaveProperty('security');
      expect(scores).toHaveProperty('macro');
      expect(scores).toHaveProperty('flux');
      expect(scores).toHaveProperty('mag7');
      expect(scores).toHaveProperty('technical');
      expect(scores).toHaveProperty('synthesis');

      expect(typeof scores.security).toBe('number');
      expect(typeof scores.macro).toBe('number');
      expect(typeof scores.flux).toBe('number');
      expect(typeof scores.mag7).toBe('number');
      expect(typeof scores.technical).toBe('number');
      expect(typeof scores.synthesis).toBe('number');
    });
  });

  describe('calculateAverageScore', () => {
    it('should calculate correct average score', () => {
      const response = DailyBias.createMockAnalysisResponse('NQ1');
      const avgScore = DailyBias.calculateAverageScore(response.steps);

      expect(typeof avgScore).toBe('number');
      expect(avgScore).toBeGreaterThanOrEqual(0);
      expect(avgScore).toBeLessThanOrEqual(10);
    });

    it('should return 5 for mock data with all scores at 5', () => {
      const response = DailyBias.createMockAnalysisResponse('NQ1');
      const avgScore = DailyBias.calculateAverageScore(response.steps);

      expect(avgScore).toBe(5);
    });
  });

  describe('getAnalysisSentiment', () => {
    it('should return the final bias', () => {
      const response = DailyBias.createMockAnalysisResponse('NQ1', { finalBias: 'BULLISH' });
      expect(DailyBias.getAnalysisSentiment(response)).toBe('BULLISH');
    });
  });

  describe('getConfidencePercentage', () => {
    it('should convert confidence to percentage', () => {
      const synthesis: DailyBias.Synthesis = {
        finalBias: 'BULLISH',
        confidence: 0.75,
        openingConfirmation: {
          expectedDirection: 'UP',
          confirmationScore: 0.8,
        },
        timestamp: new Date().toISOString(),
        instrument: 'NQ1',
      };

      expect(DailyBias.getConfidencePercentage(synthesis)).toBe(75);
    });

    it('should round to nearest integer', () => {
      const synthesis: DailyBias.Synthesis = {
        finalBias: 'BULLISH',
        confidence: 0.856,
        openingConfirmation: {
          expectedDirection: 'UP',
          confirmationScore: 0.8,
        },
        timestamp: new Date().toISOString(),
        instrument: 'NQ1',
      };

      expect(DailyBias.getConfidencePercentage(synthesis)).toBe(86);
    });
  });

  describe('isCachedAnalysis', () => {
    it('should return true when cached', () => {
      const response = DailyBias.createMockAnalysisResponse('NQ1', {
        metadata: { cached: true },
      });
      expect(DailyBias.isCachedAnalysis(response)).toBe(true);
    });

    it('should return false when not cached', () => {
      const response = DailyBias.createMockAnalysisResponse('NQ1', {
        metadata: { cached: false },
      });
      expect(DailyBias.isCachedAnalysis(response)).toBe(false);
    });
  });

  describe('wasFallbackUsed', () => {
    it('should return true when fallback was used', () => {
      const response = DailyBias.createMockAnalysisResponse('NQ1', {
        metadata: { fallbackUsed: true },
      });
      expect(DailyBias.wasFallbackUsed(response)).toBe(true);
    });

    it('should return false when fallback was not used', () => {
      const response = DailyBias.createMockAnalysisResponse('NQ1', {
        metadata: { fallbackUsed: false },
      });
      expect(DailyBias.wasFallbackUsed(response)).toBe(false);
    });
  });

  describe('formatAnalysisTimestamp', () => {
    it('should format timestamp to locale string', () => {
      const timestamp = '2026-01-17T12:00:00.000Z';
      const formatted = DailyBias.formatAnalysisTimestamp(timestamp);

      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('getTimeSinceAnalysis', () => {
    it('should return time difference in milliseconds', () => {
      const timestamp = new Date(Date.now() - 5000).toISOString(); // 5 seconds ago
      const timeSince = DailyBias.getTimeSinceAnalysis(timestamp);

      expect(timeSince).toBeGreaterThanOrEqual(4900);
      expect(timeSince).toBeLessThanOrEqual(5100);
    });
  });

  describe('isAnalysisStale', () => {
    it('should return true for stale analysis', () => {
      const timestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
      expect(DailyBias.isAnalysisStale(timestamp)).toBe(true);
    });

    it('should return false for fresh analysis', () => {
      const timestamp = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 minutes ago
      expect(DailyBias.isAnalysisStale(timestamp)).toBe(false);
    });

    it('should respect custom TTL', () => {
      const timestamp = new Date(Date.now() - 3 * 60 * 1000).toISOString(); // 3 minutes ago
      expect(DailyBias.isAnalysisStale(timestamp, 2 * 60 * 1000)).toBe(true); // 2 min TTL
      expect(DailyBias.isAnalysisStale(timestamp, 5 * 60 * 1000)).toBe(false); // 5 min TTL
    });
  });
});

describe('Daily Bias Types - State Management', () => {
  describe('createEmptyAsyncState', () => {
    it('should create empty state', () => {
      const state = DailyBias.createEmptyAsyncState();

      expect(state.data).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.timestamp).toBeNull();
    });
  });

  describe('createLoadingState', () => {
    it('should create loading state', () => {
      const state = DailyBias.createLoadingState();

      expect(state.data).toBeNull();
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
      expect(state.timestamp).toBeNull();
    });
  });

  describe('createSuccessState', () => {
    it('should create success state', () => {
      const data = DailyBias.createMockAnalysisResponse('NQ1');
      const state = DailyBias.createSuccessState(data);

      expect(state.data).toBe(data);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.timestamp).toBeTruthy();
    });
  });

  describe('createErrorState', () => {
    it('should create error state', () => {
      const error = DailyBias.createMockErrorResponse();
      const state = DailyBias.createErrorState(error);

      expect(state.data).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBe(error);
      expect(state.timestamp).toBeTruthy();
    });
  });
});

describe('Daily Bias Types - Step Management', () => {
  describe('mergeAnalysisSteps', () => {
    it('should merge partial steps', () => {
      const existing: DailyBias.PartialAnalysisSteps = {
        security: DailyBias.createMockAnalysisResponse('NQ1').steps.security,
      };

      const updates: DailyBias.PartialAnalysisSteps = {
        macro: DailyBias.createMockAnalysisResponse('NQ1').steps.macro,
      };

      const merged = DailyBias.mergeAnalysisSteps(existing, updates);

      expect(merged.security).toBeTruthy();
      expect(merged.macro).toBeTruthy();
    });

    it('should override existing steps', () => {
      const existing: DailyBias.PartialAnalysisSteps = {
        security: DailyBias.createMockAnalysisResponse('NQ1').steps.security,
      };

      const newSecurity = DailyBias.createMockAnalysisResponse('ES1').steps.security;
      const updates: DailyBias.PartialAnalysisSteps = {
        security: newSecurity,
      };

      const merged = DailyBias.mergeAnalysisSteps(existing, updates);

      expect(merged.security).toBe(newSecurity);
    });
  });

  describe('areAllStepsCompleted', () => {
    it('should return true when all steps completed', () => {
      const steps = DailyBias.createMockAnalysisResponse('NQ1').steps;
      expect(DailyBias.areAllStepsCompleted(steps)).toBe(true);
    });

    it('should return false when steps are missing', () => {
      const steps: DailyBias.PartialAnalysisSteps = {
        security: DailyBias.createMockAnalysisResponse('NQ1').steps.security,
        macro: DailyBias.createMockAnalysisResponse('NQ1').steps.macro,
      };
      expect(DailyBias.areAllStepsCompleted(steps)).toBe(false);
    });
  });

  describe('getCompletedSteps', () => {
    it('should return array of completed step names', () => {
      const steps: DailyBias.PartialAnalysisSteps = {
        security: DailyBias.createMockAnalysisResponse('NQ1').steps.security,
        macro: DailyBias.createMockAnalysisResponse('NQ1').steps.macro,
      };

      const completed = DailyBias.getCompletedSteps(steps);

      expect(completed).toContain('security');
      expect(completed).toContain('macro');
      expect(completed).toHaveLength(2);
    });

    it('should return empty array when no steps completed', () => {
      const steps: DailyBias.PartialAnalysisSteps = {};
      const completed = DailyBias.getCompletedSteps(steps);

      expect(completed).toHaveLength(0);
    });
  });

  describe('getPendingSteps', () => {
    it('should return array of pending step names', () => {
      const steps: DailyBias.PartialAnalysisSteps = {
        security: DailyBias.createMockAnalysisResponse('NQ1').steps.security,
        macro: DailyBias.createMockAnalysisResponse('NQ1').steps.macro,
      };

      const pending = DailyBias.getPendingSteps(steps);

      expect(pending).toContain('flux');
      expect(pending).toContain('mag7');
      expect(pending).toContain('technical');
      expect(pending).toContain('synthesis');
      expect(pending).toHaveLength(4);
    });

    it('should return empty array when all steps completed', () => {
      const steps = DailyBias.createMockAnalysisResponse('NQ1').steps;
      const pending = DailyBias.getPendingSteps(steps);

      expect(pending).toHaveLength(0);
    });
  });

  describe('calculateCompletionPercentage', () => {
    it('should calculate correct percentage', () => {
      const steps: DailyBias.PartialAnalysisSteps = {
        security: DailyBias.createMockAnalysisResponse('NQ1').steps.security,
        macro: DailyBias.createMockAnalysisResponse('NQ1').steps.macro,
        flux: DailyBias.createMockAnalysisResponse('NQ1').steps.flux,
      };

      const percentage = DailyBias.calculateCompletionPercentage(steps);

      expect(percentage).toBe(50); // 3 out of 6 steps = 50%
    });

    it('should return 0 for no completed steps', () => {
      const steps: DailyBias.PartialAnalysisSteps = {};
      const percentage = DailyBias.calculateCompletionPercentage(steps);

      expect(percentage).toBe(0);
    });

    it('should return 100 for all completed steps', () => {
      const steps = DailyBias.createMockAnalysisResponse('NQ1').steps;
      const percentage = DailyBias.calculateCompletionPercentage(steps);

      expect(percentage).toBe(100);
    });
  });
});

describe('Daily Bias Types - Mock Data', () => {
  describe('createMockAnalysisResponse', () => {
    it('should create valid mock response', () => {
      const response = DailyBias.createMockAnalysisResponse('NQ1');

      expect(response.instrument).toBe('NQ1');
      expect(response.finalBias).toBe('NEUTRAL');
      expect(response.steps).toBeTruthy();
      expect(response.steps.security).toBeTruthy();
      expect(response.steps.macro).toBeTruthy();
      expect(response.steps.flux).toBeTruthy();
      expect(response.steps.mag7).toBeTruthy();
      expect(response.steps.technical).toBeTruthy();
      expect(response.steps.synthesis).toBeTruthy();
    });

    it('should apply overrides', () => {
      const response = DailyBias.createMockAnalysisResponse('NQ1', {
        finalBias: 'BULLISH',
      });

      expect(response.finalBias).toBe('BULLISH');
    });

    it('should create valid timestamps', () => {
      const response = DailyBias.createMockAnalysisResponse('NQ1');

      expect(() => new Date(response.timestamp)).not.toThrow();
      expect(() => new Date(response.steps.security.timestamp)).not.toThrow();
    });
  });

  describe('createMockErrorResponse', () => {
    it('should create valid error response', () => {
      const error = DailyBias.createMockErrorResponse();

      expect(error.error).toBeTruthy();
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.timestamp).toBeTruthy();
    });

    it('should accept custom code and message', () => {
      const error = DailyBias.createMockErrorResponse('RATE_LIMIT', 'Rate limit exceeded');

      expect(error.error).toBe('Rate limit exceeded');
      expect(error.code).toBe('RATE_LIMIT');
    });
  });
});

describe('Daily Bias Types - Constants', () => {
  it('should have correct number of valid instruments', () => {
    expect(DailyBias.VALID_INSTRUMENTS).toHaveLength(22);
  });

  it('should have correct number of Mag7 symbols', () => {
    expect(DailyBias.MAG7_SYMBOLS).toHaveLength(7);
  });

  it('should have correct number of step names', () => {
    expect(Object.keys(DailyBias.STEP_NAMES)).toHaveLength(6);
  });

  it('should have correct cache TTL', () => {
    expect(DailyBias.DEFAULT_CACHE_TTL).toBe(5 * 60 * 1000);
  });

  it('should have correct analysis timeout', () => {
    expect(DailyBias.DEFAULT_ANALYSIS_TIMEOUT).toBe(10 * 1000);
  });
});
