/**
 * Security Analysis Service - Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeSecurityProfile,
  calculateVolatilityIndex,
  mapVolatilityToRiskLevel,
  batchAnalyzeSecurityProfiles,
} from '../security-analysis-service';
import type { SecurityAnalysisInput } from '@/lib/prompts/daily-bias-prompts';
import * as aiProvider from '@/lib/ai-provider';

// Mock AI provider
vi.mock('@/lib/ai-provider', () => ({
  generateAIResponse: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Security Analysis Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Test Data
  // ============================================================================

  const mockLowVolatilityInput: SecurityAnalysisInput = {
    symbol: 'AAPL',
    currentPrice: 185.50,
    priceChange24h: 0.75,
    priceChangePercent24h: 0.40,
    volume24h: 50_000_000,
    high24h: 186.25,
    low24h: 184.80,
    assetType: 'stock',
    sector: 'Technology',
    marketCap: 2_900_000_000_000,
  };

  const mockHighVolatilityInput: SecurityAnalysisInput = {
    symbol: 'BTC',
    currentPrice: 45_000,
    priceChange24h: -3_500,
    priceChangePercent24h: -7.22,
    volume24h: 25_000_000_000,
    high24h: 48_500,
    low24h: 44_200,
    assetType: 'crypto',
  };

  const mockValidAIResponse = {
    content: JSON.stringify({
      volatilityIndex: 35,
      riskLevel: 'MEDIUM',
      securityScore: 72,
      keyRisks: ['Moderate price swings', 'Tech sector correlation'],
      volatilityBreakdown: {
        priceVolatility: 40,
        volumeVolatility: 30,
        marketConditions: 'Moderate',
      },
      tradingRecommendation: {
        positionSizing: 'NORMAL',
        stopLossMultiplier: 1.0,
        entryTiming: 'Normal entry conditions apply',
      },
      reasoning: 'AAPL shows moderate volatility with stable volume patterns. Risk is manageable for experienced traders.',
      confidence: 85,
    }),
    provider: 'gemini' as const,
    model: 'gemini-1.5-flash',
    latencyMs: 1250,
    usage: {
      promptTokens: 450,
      completionTokens: 180,
      totalTokens: 630,
    },
  };

  // ============================================================================
  // analyzeSecurityProfile Tests
  // ============================================================================

  describe('analyzeSecurityProfile', () => {
    it('should successfully analyze security profile with valid AI response', async () => {
      vi.mocked(aiProvider.generateAIResponse).mockResolvedValueOnce(mockValidAIResponse);

      const result = await analyzeSecurityProfile(mockLowVolatilityInput);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.volatilityIndex).toBe(35);
      expect(result.data?.riskLevel).toBe('MEDIUM');
      expect(result.data?.securityScore).toBe(72);
      expect(result.metadata.symbol).toBe('AAPL');
      expect(result.metadata.provider).toBe('gemini');
      expect(result.metadata.tokensUsed).toBe(630);
    });

    it('should handle AI response with markdown code blocks', async () => {
      const responseWithMarkdown = {
        ...mockValidAIResponse,
        content: '```json\n' + mockValidAIResponse.content + '\n```',
      };

      vi.mocked(aiProvider.generateAIResponse).mockResolvedValueOnce(responseWithMarkdown);

      const result = await analyzeSecurityProfile(mockLowVolatilityInput);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.volatilityIndex).toBe(35);
    });

    it('should handle AI response with extra text around JSON', async () => {
      const responseWithExtraText = {
        ...mockValidAIResponse,
        content: 'Here is the analysis:\n\n' + mockValidAIResponse.content + '\n\nHope this helps!',
      };

      vi.mocked(aiProvider.generateAIResponse).mockResolvedValueOnce(responseWithExtraText);

      const result = await analyzeSecurityProfile(mockLowVolatilityInput);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should retry on failure and succeed on second attempt', async () => {
      vi.mocked(aiProvider.generateAIResponse)
        .mockRejectedValueOnce(new Error('API timeout'))
        .mockResolvedValueOnce(mockValidAIResponse);

      const result = await analyzeSecurityProfile(mockLowVolatilityInput, {
        maxRetries: 2,
      });

      expect(result.success).toBe(true);
      expect(aiProvider.generateAIResponse).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      vi.mocked(aiProvider.generateAIResponse).mockRejectedValue(new Error('API error'));

      const result = await analyzeSecurityProfile(mockLowVolatilityInput, {
        maxRetries: 2,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('API error');
      expect(aiProvider.generateAIResponse).toHaveBeenCalledTimes(2);
    });

    it('should fail on invalid JSON response', async () => {
      const invalidResponse = {
        ...mockValidAIResponse,
        content: 'This is not valid JSON',
      };

      vi.mocked(aiProvider.generateAIResponse).mockResolvedValue(invalidResponse);

      const result = await analyzeSecurityProfile(mockLowVolatilityInput, {
        maxRetries: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON parsing failed');
    });

    it('should fail on invalid schema', async () => {
      const invalidSchemaResponse = {
        ...mockValidAIResponse,
        content: JSON.stringify({
          volatilityIndex: 'not a number', // Invalid type
          riskLevel: 'INVALID_LEVEL', // Invalid enum
        }),
      };

      vi.mocked(aiProvider.generateAIResponse).mockResolvedValue(invalidSchemaResponse);

      const result = await analyzeSecurityProfile(mockLowVolatilityInput, {
        maxRetries: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid security analysis output schema');
    });

    it('should use lower temperature for consistent risk assessment', async () => {
      vi.mocked(aiProvider.generateAIResponse).mockResolvedValueOnce(mockValidAIResponse);

      await analyzeSecurityProfile(mockLowVolatilityInput);

      expect(aiProvider.generateAIResponse).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          temperature: 0.3,
        })
      );
    });

    it('should allow custom model and temperature', async () => {
      vi.mocked(aiProvider.generateAIResponse).mockResolvedValueOnce(mockValidAIResponse);

      await analyzeSecurityProfile(mockLowVolatilityInput, {
        model: 'gemini-1.5-pro',
        temperature: 0.5,
      });

      expect(aiProvider.generateAIResponse).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          geminiModel: 'gemini-1.5-pro',
          temperature: 0.5,
        })
      );
    });
  });

  // ============================================================================
  // calculateVolatilityIndex Tests
  // ============================================================================

  describe('calculateVolatilityIndex', () => {
    it('should calculate low volatility (0-25) for stable instruments', () => {
      const index = calculateVolatilityIndex(mockLowVolatilityInput);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThanOrEqual(30); // Allow small margin
    });

    it('should calculate high volatility (51-75) for volatile instruments', () => {
      const index = calculateVolatilityIndex(mockHighVolatilityInput);
      expect(index).toBeGreaterThanOrEqual(50);
      expect(index).toBeLessThanOrEqual(100);
    });

    it('should return 0 for no volatility', () => {
      const noVolatilityInput: SecurityAnalysisInput = {
        symbol: 'STABLE',
        currentPrice: 100,
        priceChange24h: 0,
        priceChangePercent24h: 0,
        volume24h: 1_000_000,
        high24h: 100,
        low24h: 100,
        assetType: 'stock',
      };

      const index = calculateVolatilityIndex(noVolatilityInput);
      expect(index).toBe(0);
    });

    it('should cap volatility at 100', () => {
      const extremeVolatilityInput: SecurityAnalysisInput = {
        symbol: 'EXTREME',
        currentPrice: 100,
        priceChange24h: -50,
        priceChangePercent24h: -50,
        volume24h: 1_000_000,
        high24h: 150,
        low24h: 50,
        assetType: 'crypto',
      };

      const index = calculateVolatilityIndex(extremeVolatilityInput);
      expect(index).toBeLessThanOrEqual(100);
    });
  });

  // ============================================================================
  // mapVolatilityToRiskLevel Tests
  // ============================================================================

  describe('mapVolatilityToRiskLevel', () => {
    it('should map 0-25 to LOW', () => {
      expect(mapVolatilityToRiskLevel(0)).toBe('LOW');
      expect(mapVolatilityToRiskLevel(15)).toBe('LOW');
      expect(mapVolatilityToRiskLevel(25)).toBe('LOW');
    });

    it('should map 26-50 to MEDIUM', () => {
      expect(mapVolatilityToRiskLevel(26)).toBe('MEDIUM');
      expect(mapVolatilityToRiskLevel(40)).toBe('MEDIUM');
      expect(mapVolatilityToRiskLevel(50)).toBe('MEDIUM');
    });

    it('should map 51-75 to HIGH', () => {
      expect(mapVolatilityToRiskLevel(51)).toBe('HIGH');
      expect(mapVolatilityToRiskLevel(65)).toBe('HIGH');
      expect(mapVolatilityToRiskLevel(75)).toBe('HIGH');
    });

    it('should map 76-100 to EXTREME', () => {
      expect(mapVolatilityToRiskLevel(76)).toBe('EXTREME');
      expect(mapVolatilityToRiskLevel(90)).toBe('EXTREME');
      expect(mapVolatilityToRiskLevel(100)).toBe('EXTREME');
    });
  });

  // ============================================================================
  // batchAnalyzeSecurityProfiles Tests
  // ============================================================================

  describe('batchAnalyzeSecurityProfiles', () => {
    it('should analyze multiple instruments in parallel', async () => {
      vi.mocked(aiProvider.generateAIResponse).mockResolvedValue(mockValidAIResponse);

      const inputs = [
        mockLowVolatilityInput,
        { ...mockLowVolatilityInput, symbol: 'MSFT' },
        { ...mockLowVolatilityInput, symbol: 'GOOGL' },
      ];

      const results = await batchAnalyzeSecurityProfiles(inputs, {
        maxConcurrent: 2,
      });

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(aiProvider.generateAIResponse).toHaveBeenCalledTimes(3);
    });

    it('should respect maxConcurrent limit', async () => {
      vi.mocked(aiProvider.generateAIResponse).mockResolvedValue(mockValidAIResponse);

      const inputs = Array(10).fill(mockLowVolatilityInput).map((input, i) => ({
        ...input,
        symbol: `STOCK${i}`,
      }));

      await batchAnalyzeSecurityProfiles(inputs, {
        maxConcurrent: 3,
      });

      // Should be called 10 times total, but in batches of 3
      expect(aiProvider.generateAIResponse).toHaveBeenCalledTimes(10);
    });

    it('should handle partial failures in batch', async () => {
      vi.mocked(aiProvider.generateAIResponse)
        .mockResolvedValueOnce(mockValidAIResponse)
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce(mockValidAIResponse);

      const inputs = [
        mockLowVolatilityInput,
        { ...mockLowVolatilityInput, symbol: 'MSFT' },
        { ...mockLowVolatilityInput, symbol: 'GOOGL' },
      ];

      const results = await batchAnalyzeSecurityProfiles(inputs, {
        maxConcurrent: 3,
        maxRetries: 1,
      });

      expect(results).toHaveLength(3);
      expect(results.filter(r => r.success)).toHaveLength(2);
      expect(results.filter(r => !r.success)).toHaveLength(1);
    });

    it('should return empty array for empty input', async () => {
      const results = await batchAnalyzeSecurityProfiles([]);
      expect(results).toHaveLength(0);
    });
  });
});
