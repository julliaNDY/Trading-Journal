/**
 * Unit tests for Macro Analysis Prompt Template
 * Task: PRÉ-8.2 - Macro Prompts Testing
 */

import { describe, it, expect } from 'vitest';
import {
  generateMacroAnalysisPrompt,
  validateMacroAnalysisOutput,
  parseMacroAnalysisResponse,
  MACRO_ANALYSIS_SYSTEM_PROMPT,
  MACRO_PROMPT_EXAMPLES,
  type MacroDataInput,
  type MacroAnalysisOutput,
  type EconomicEvent
} from '../macro-analysis-prompt';

describe('Macro Analysis Prompt Template', () => {
  describe('generateMacroAnalysisPrompt', () => {
    it('should generate prompt with economic events', () => {
      const input: MacroDataInput = {
        economicEvents: [
          {
            title: 'Non-Farm Payrolls',
            country: 'USD',
            impact: 'high',
            forecast: '180K',
            previous: '150K',
            actual: '220K',
            time: '2026-01-17T13:30:00Z',
            category: 'Employment'
          }
        ],
        instrument: 'NQ1',
        analysisDate: '2026-01-17'
      };

      const prompt = generateMacroAnalysisPrompt(input);

      expect(prompt).toContain('NQ1');
      expect(prompt).toContain('2026-01-17');
      expect(prompt).toContain('Non-Farm Payrolls');
      expect(prompt).toContain('Actual: 220K');
      expect(prompt).toContain('Forecast: 180K');
      expect(prompt).toContain('Previous: 150K');
      expect(prompt).toContain('Employment');
      expect(prompt).toContain('HIGH impact');
    });

    it('should handle multiple events and sort by impact', () => {
      const input: MacroDataInput = {
        economicEvents: [
          {
            title: 'Retail Sales',
            country: 'USD',
            impact: 'medium',
            time: '2026-01-17T13:30:00Z',
            category: 'GDP'
          },
          {
            title: 'FOMC Meeting',
            country: 'USD',
            impact: 'high',
            time: '2026-01-17T19:00:00Z',
            category: 'Central Bank'
          },
          {
            title: 'Housing Starts',
            country: 'USD',
            impact: 'low',
            time: '2026-01-17T08:30:00Z',
            category: 'GDP'
          }
        ],
        instrument: 'ES1',
        analysisDate: '2026-01-17'
      };

      const prompt = generateMacroAnalysisPrompt(input);

      // High impact event should appear first
      const fomcIndex = prompt.indexOf('FOMC Meeting');
      const retailIndex = prompt.indexOf('Retail Sales');
      const housingIndex = prompt.indexOf('Housing Starts');

      expect(fomcIndex).toBeLessThan(retailIndex);
      expect(retailIndex).toBeLessThan(housingIndex);
    });

    it('should handle empty events array', () => {
      const input: MacroDataInput = {
        economicEvents: [],
        instrument: 'EUR/USD',
        analysisDate: '2026-01-17'
      };

      const prompt = generateMacroAnalysisPrompt(input);

      expect(prompt).toContain('EUR/USD');
      expect(prompt).toContain('No major economic events scheduled');
    });

    it('should include user context when provided', () => {
      const input: MacroDataInput = {
        economicEvents: [],
        instrument: 'XAU/USD',
        analysisDate: '2026-01-17',
        userContext: 'Fed Chair Powell speech expected to be dovish'
      };

      const prompt = generateMacroAnalysisPrompt(input);

      expect(prompt).toContain('ADDITIONAL CONTEXT');
      expect(prompt).toContain('Fed Chair Powell speech expected to be dovish');
    });

    it('should include JSON output format requirements', () => {
      const input: MacroDataInput = {
        economicEvents: [],
        instrument: 'NQ1',
        analysisDate: '2026-01-17'
      };

      const prompt = generateMacroAnalysisPrompt(input);

      expect(prompt).toContain('REQUIRED OUTPUT FORMAT (JSON)');
      expect(prompt).toContain('"bias"');
      expect(prompt).toContain('"confidence"');
      expect(prompt).toContain('"keyDrivers"');
      expect(prompt).toContain('"indicators"');
      expect(prompt).toContain('"risks"');
      expect(prompt).toContain('"summary"');
      expect(prompt).toContain('"detailedAnalysis"');
    });
  });

  describe('validateMacroAnalysisOutput', () => {
    it('should validate correct output', () => {
      const output: MacroAnalysisOutput = {
        bias: 'bullish',
        confidence: 75,
        keyDrivers: ['Dovish Fed', 'Falling inflation'],
        indicators: {
          gdp: 'positive',
          inflation: 'falling',
          interestRates: 'dovish',
          employment: 'strong',
          centralBankPolicy: 'easing'
        },
        risks: ['Unexpected hawkish pivot'],
        summary: 'Macro conditions support risk assets.',
        detailedAnalysis: 'Falling inflation combined with dovish Fed policy creates favorable conditions for equities.'
      };

      expect(validateMacroAnalysisOutput(output)).toBe(true);
    });

    it('should reject invalid bias', () => {
      const output = {
        bias: 'invalid',
        confidence: 75,
        keyDrivers: ['test'],
        indicators: {
          gdp: 'positive',
          inflation: 'falling',
          interestRates: 'dovish',
          employment: 'strong',
          centralBankPolicy: 'easing'
        },
        risks: [],
        summary: 'Test',
        detailedAnalysis: 'Test'
      };

      expect(validateMacroAnalysisOutput(output)).toBe(false);
    });

    it('should reject invalid confidence range', () => {
      const output = {
        bias: 'bullish',
        confidence: 150, // Invalid: > 100
        keyDrivers: ['test'],
        indicators: {
          gdp: 'positive',
          inflation: 'falling',
          interestRates: 'dovish',
          employment: 'strong',
          centralBankPolicy: 'easing'
        },
        risks: [],
        summary: 'Test',
        detailedAnalysis: 'Test'
      };

      expect(validateMacroAnalysisOutput(output)).toBe(false);
    });

    it('should reject empty keyDrivers', () => {
      const output = {
        bias: 'bullish',
        confidence: 75,
        keyDrivers: [], // Invalid: empty
        indicators: {
          gdp: 'positive',
          inflation: 'falling',
          interestRates: 'dovish',
          employment: 'strong',
          centralBankPolicy: 'easing'
        },
        risks: [],
        summary: 'Test',
        detailedAnalysis: 'Test'
      };

      expect(validateMacroAnalysisOutput(output)).toBe(false);
    });

    it('should reject invalid indicator values', () => {
      const output = {
        bias: 'bullish',
        confidence: 75,
        keyDrivers: ['test'],
        indicators: {
          gdp: 'invalid', // Invalid value
          inflation: 'falling',
          interestRates: 'dovish',
          employment: 'strong',
          centralBankPolicy: 'easing'
        },
        risks: [],
        summary: 'Test',
        detailedAnalysis: 'Test'
      };

      expect(validateMacroAnalysisOutput(output)).toBe(false);
    });

    it('should reject missing required fields', () => {
      const output = {
        bias: 'bullish',
        confidence: 75,
        // Missing keyDrivers
        indicators: {
          gdp: 'positive',
          inflation: 'falling',
          interestRates: 'dovish',
          employment: 'strong',
          centralBankPolicy: 'easing'
        },
        risks: [],
        summary: 'Test',
        detailedAnalysis: 'Test'
      };

      expect(validateMacroAnalysisOutput(output)).toBe(false);
    });
  });

  describe('parseMacroAnalysisResponse', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        bias: 'bullish',
        confidence: 80,
        keyDrivers: ['Strong GDP', 'Dovish Fed'],
        indicators: {
          gdp: 'positive',
          inflation: 'falling',
          interestRates: 'dovish',
          employment: 'strong',
          centralBankPolicy: 'easing'
        },
        risks: ['Unexpected data'],
        summary: 'Macro supports upside.',
        detailedAnalysis: 'Strong economic data combined with dovish policy.'
      });

      const parsed = parseMacroAnalysisResponse(response);

      expect(parsed.bias).toBe('bullish');
      expect(parsed.confidence).toBe(80);
      expect(parsed.keyDrivers).toHaveLength(2);
    });

    it('should extract JSON from response with extra text', () => {
      const response = `Here is the analysis:

${JSON.stringify({
  bias: 'bearish',
  confidence: 65,
  keyDrivers: ['Hawkish Fed'],
  indicators: {
    gdp: 'negative',
    inflation: 'rising',
    interestRates: 'hawkish',
    employment: 'weak',
    centralBankPolicy: 'tightening'
  },
  risks: ['Recession'],
  summary: 'Macro pressures downside.',
  detailedAnalysis: 'Hawkish policy and weak growth create headwinds.'
})}

Hope this helps!`;

      const parsed = parseMacroAnalysisResponse(response);

      expect(parsed.bias).toBe('bearish');
      expect(parsed.confidence).toBe(65);
    });

    it('should throw error for invalid JSON', () => {
      const response = 'This is not JSON';

      expect(() => parseMacroAnalysisResponse(response)).toThrow('No JSON found in response');
    });

    it('should throw error for invalid schema', () => {
      const response = JSON.stringify({
        bias: 'invalid', // Invalid bias
        confidence: 80,
        keyDrivers: ['test']
      });

      expect(() => parseMacroAnalysisResponse(response)).toThrow('Invalid macro analysis output schema');
    });
  });

  describe('MACRO_ANALYSIS_SYSTEM_PROMPT', () => {
    it('should contain key analysis framework elements', () => {
      expect(MACRO_ANALYSIS_SYSTEM_PROMPT).toContain('GDP');
      expect(MACRO_ANALYSIS_SYSTEM_PROMPT).toContain('Inflation');
      expect(MACRO_ANALYSIS_SYSTEM_PROMPT).toContain('Interest Rates');
      expect(MACRO_ANALYSIS_SYSTEM_PROMPT).toContain('Employment');
      expect(MACRO_ANALYSIS_SYSTEM_PROMPT).toContain('Central Bank');
    });

    it('should contain instrument-specific guidance', () => {
      expect(MACRO_ANALYSIS_SYSTEM_PROMPT).toContain('Equity Indices');
      expect(MACRO_ANALYSIS_SYSTEM_PROMPT).toContain('Forex');
      expect(MACRO_ANALYSIS_SYSTEM_PROMPT).toContain('Tech Stocks');
      expect(MACRO_ANALYSIS_SYSTEM_PROMPT).toContain('Commodities');
    });

    it('should contain bias determination rules', () => {
      expect(MACRO_ANALYSIS_SYSTEM_PROMPT).toContain('Bullish');
      expect(MACRO_ANALYSIS_SYSTEM_PROMPT).toContain('Bearish');
      expect(MACRO_ANALYSIS_SYSTEM_PROMPT).toContain('Neutral');
      expect(MACRO_ANALYSIS_SYSTEM_PROMPT).toContain('confidence');
    });

    it('should emphasize JSON output requirement', () => {
      expect(MACRO_ANALYSIS_SYSTEM_PROMPT).toContain('JSON');
      expect(MACRO_ANALYSIS_SYSTEM_PROMPT).toContain('MacroAnalysisOutput');
    });
  });

  describe('MACRO_PROMPT_EXAMPLES', () => {
    it('should have example 1: NFP data (bearish for tech)', () => {
      const example = MACRO_PROMPT_EXAMPLES.example1;

      expect(example.input.instrument).toBe('NQ1');
      expect(example.expectedBias).toBe('bearish');
      expect(example.input.economicEvents).toHaveLength(2);
      expect(example.input.economicEvents[0].title).toBe('Non-Farm Payrolls');
    });

    it('should have example 2: Dovish Fed (bullish for tech)', () => {
      const example = MACRO_PROMPT_EXAMPLES.example2;

      expect(example.input.instrument).toBe('NQ1');
      expect(example.expectedBias).toBe('bullish');
      expect(example.rationale.toLowerCase()).toContain('dovish');
    });

    it('should have example 3: Mixed signals (neutral)', () => {
      const example = MACRO_PROMPT_EXAMPLES.example3;

      expect(example.input.instrument).toBe('ES1');
      expect(example.expectedBias).toBe('neutral');
      const lowerRationale = example.rationale.toLowerCase();
      expect(lowerRationale.includes('mixed') || lowerRationale.includes('conflicting')).toBe(true);
    });

    it('should have example 4: Gold with inflation (bullish)', () => {
      const example = MACRO_PROMPT_EXAMPLES.example4;

      expect(example.input.instrument).toBe('XAU/USD');
      expect(example.expectedBias).toBe('bullish');
      expect(example.rationale).toContain('inflation');
    });

    it('should cover different instrument types', () => {
      const instruments = [
        MACRO_PROMPT_EXAMPLES.example1.input.instrument,
        MACRO_PROMPT_EXAMPLES.example2.input.instrument,
        MACRO_PROMPT_EXAMPLES.example3.input.instrument,
        MACRO_PROMPT_EXAMPLES.example4.input.instrument
      ];

      expect(instruments).toContain('NQ1'); // Tech index
      expect(instruments).toContain('ES1'); // Equity index
      expect(instruments).toContain('XAU/USD'); // Commodity/forex
    });
  });

  describe('Integration: Full prompt generation flow', () => {
    it('should generate complete prompt for NFP scenario', () => {
      const input = MACRO_PROMPT_EXAMPLES.example1.input;
      const prompt = generateMacroAnalysisPrompt(input);

      // Should contain instrument
      expect(prompt).toContain('NQ1');

      // Should contain events
      expect(prompt).toContain('Non-Farm Payrolls');
      expect(prompt).toContain('Unemployment Rate');

      // Should contain data points
      expect(prompt).toContain('220K');
      expect(prompt).toContain('3.9%');

      // Should contain instructions
      expect(prompt).toContain('INSTRUCTIONS');
      expect(prompt).toContain('REQUIRED OUTPUT FORMAT');

      // Should specify JSON-only response
      expect(prompt).toContain('Respond ONLY with valid JSON');
    });

    it('should handle forex pair analysis', () => {
      const input: MacroDataInput = {
        economicEvents: [
          {
            title: 'ECB Interest Rate Decision',
            country: 'EUR',
            impact: 'high',
            time: '2026-01-17T12:45:00Z',
            category: 'Central Bank',
            actual: '4.00%'
          },
          {
            title: 'Fed Interest Rate Decision',
            country: 'USD',
            impact: 'high',
            time: '2026-01-17T19:00:00Z',
            category: 'Central Bank',
            actual: '5.25%'
          }
        ],
        instrument: 'EUR/USD',
        analysisDate: '2026-01-17'
      };

      const prompt = generateMacroAnalysisPrompt(input);

      expect(prompt).toContain('EUR/USD');
      expect(prompt).toContain('ECB');
      expect(prompt).toContain('Fed');
      // System prompt contains rate differentials guidance, not the user prompt
      expect(MACRO_ANALYSIS_SYSTEM_PROMPT).toContain('rate differentials');
    });
  });
});
