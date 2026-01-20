/**
 * Institutional Flux Service Tests
 * 
 * @module services/daily-bias/__tests__/institutional-flux-service.test.ts
 * @created 2026-01-17
 * @author Dev 50, Dev 51 (PRÉ-8.3)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeInstitutionalFlux,
  batchAnalyzeFlux,
  invalidateFluxCache,
  getFluxSummary,
  compareFluxAcrossTimeframes,
  type FluxAnalysisParams,
} from '../institutional-flux-service';
import {
  validateInstitutionalFluxAnalysis,
  createEmptyFluxAnalysis,
  calculateFluxScore,
  type InstitutionalFluxAnalysis,
} from '@/lib/prompts/institutional-flux';

// Mock dependencies
vi.mock('@/lib/ai-provider', () => ({
  generateAIResponse: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(() => ({
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
  })),
}));

// ============================================================================
// Test Data
// ============================================================================

const mockMarketData: FluxAnalysisParams['marketData'] = {
  currentPrice: 450.25,
  priceChange24h: 2.5,
  volume24h: 5_000_000,
  averageVolume20d: 3_500_000,
  high24h: 455.00,
  low24h: 445.00,
};

const mockVolumeData: FluxAnalysisParams['volumeData'] = [
  {
    timestamp: '2026-01-17T09:30:00Z',
    volume: 500_000,
    price: 448.50,
    buyVolume: 300_000,
    sellVolume: 200_000,
  },
  {
    timestamp: '2026-01-17T10:00:00Z',
    volume: 750_000,
    price: 450.00,
    buyVolume: 500_000,
    sellVolume: 250_000,
  },
  {
    timestamp: '2026-01-17T10:30:00Z',
    volume: 600_000,
    price: 451.25,
    buyVolume: 400_000,
    sellVolume: 200_000,
  },
];

const mockOrderBookData: FluxAnalysisParams['orderBookData'] = {
  bids: [
    { price: 450.20, size: 1000 },
    { price: 450.15, size: 1500 },
    { price: 450.10, size: 2000 },
    { price: 450.05, size: 2500 },
    { price: 450.00, size: 3000 },
  ],
  asks: [
    { price: 450.30, size: 1200 },
    { price: 450.35, size: 1800 },
    { price: 450.40, size: 2200 },
    { price: 450.45, size: 2800 },
    { price: 450.50, size: 3500 },
  ],
  timestamp: '2026-01-17T11:00:00Z',
};

const mockDarkPoolData: FluxAnalysisParams['darkPoolData'] = {
  volume: 500_000,
  percentage: 10,
  trades: [
    { timestamp: '2026-01-17T09:45:00Z', size: 100_000, price: 449.00 },
    { timestamp: '2026-01-17T10:15:00Z', size: 150_000, price: 450.50 },
    { timestamp: '2026-01-17T10:45:00Z', size: 250_000, price: 451.00 },
  ],
};

const mockFluxAnalysis: InstitutionalFluxAnalysis = {
  instrument: 'NQ1',
  timestamp: '2026-01-17T12:00:00Z',
  volumeProfile: {
    totalVolume: 5_000_000,
    averageVolume: 3_500_000,
    volumeRatio: 1.43,
    volumeTrend: 'INCREASING',
    volumeSpikes: [
      {
        timestamp: '2026-01-17T10:00:00Z',
        volume: 750_000,
        priceChange: 0.5,
      },
    ],
    volumeByPriceLevel: [
      { priceLevel: 450.00, volume: 1_000_000, percentage: 20 },
      { priceLevel: 451.00, volume: 800_000, percentage: 16 },
      { priceLevel: 449.00, volume: 700_000, percentage: 14 },
    ],
  },
  orderFlow: {
    buyVolume: 3_000_000,
    sellVolume: 2_000_000,
    buyVsSellRatio: 1.5,
    netOrderFlow: 1_000_000,
    orderFlowTrend: 'BULLISH',
    largeOrders: [
      {
        timestamp: '2026-01-17T10:15:00Z',
        side: 'BUY',
        size: 150_000,
        price: 450.50,
        impact: 'HIGH',
      },
    ],
    aggressiveness: 7,
  },
  institutionalActivity: {
    darkPoolActivity: {
      volume: 500_000,
      percentage: 10,
      trend: 'INCREASING',
    },
    blockTrades: [
      {
        timestamp: '2026-01-17T10:45:00Z',
        size: 250_000,
        price: 451.00,
        type: 'ACCUMULATION',
      },
    ],
    smartMoneyIndex: 6,
    institutionalSentiment: 'BULLISH',
    confidence: 75,
  },
  marketManipulation: {
    spoofingDetected: false,
    washTrading: false,
    stopHunting: false,
    manipulationScore: 2,
    manipulationDetails: 'No significant manipulation detected',
  },
  fluxScore: 7.5,
  bias: 'BULLISH',
  confidence: 75,
  keyInsights: [
    'Strong buying pressure with 1.5:1 buy/sell ratio',
    'Institutional accumulation detected in dark pools',
    'Volume 43% above 20-day average indicates increased interest',
  ],
  warnings: [],
  nextUpdate: '2026-01-17T12:05:00Z',
};

// ============================================================================
// Validation Tests
// ============================================================================

describe('Institutional Flux Validation', () => {
  it('should validate correct flux analysis', () => {
    expect(() => validateInstitutionalFluxAnalysis(mockFluxAnalysis)).not.toThrow();
  });

  it('should reject invalid flux analysis - missing required fields', () => {
    const invalid = { ...mockFluxAnalysis };
    delete (invalid as any).fluxScore;

    expect(() => validateInstitutionalFluxAnalysis(invalid)).toThrow();
  });

  it('should reject invalid flux analysis - out of range scores', () => {
    const invalid = { ...mockFluxAnalysis, fluxScore: 15 };

    expect(() => validateInstitutionalFluxAnalysis(invalid)).toThrow();
  });

  it('should reject invalid flux analysis - invalid enum', () => {
    const invalid = { ...mockFluxAnalysis, bias: 'INVALID' };

    expect(() => validateInstitutionalFluxAnalysis(invalid)).toThrow();
  });

  it('should create valid empty flux analysis', () => {
    const empty = createEmptyFluxAnalysis('TSLA');

    expect(empty.instrument).toBe('TSLA');
    expect(empty.fluxScore).toBe(0);
    expect(empty.bias).toBe('NEUTRAL');
    expect(empty.confidence).toBe(0);
    expect(empty.warnings.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Flux Score Calculation Tests
// ============================================================================

describe('Flux Score Calculation', () => {
  it('should calculate flux score from analysis components', () => {
    const score = calculateFluxScore(mockFluxAnalysis);

    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(10);
  });

  it('should return 0 for incomplete analysis', () => {
    const incomplete = {
      volumeProfile: mockFluxAnalysis.volumeProfile,
    };

    const score = calculateFluxScore(incomplete);
    expect(score).toBe(0);
  });

  it('should handle high volume ratio', () => {
    const highVolume = {
      ...mockFluxAnalysis,
      volumeProfile: {
        ...mockFluxAnalysis.volumeProfile,
        volumeRatio: 3.0, // 3x average volume
      },
    };

    const score = calculateFluxScore(highVolume);
    expect(score).toBeGreaterThan(5);
  });

  it('should handle aggressive order flow', () => {
    const aggressive = {
      ...mockFluxAnalysis,
      orderFlow: {
        ...mockFluxAnalysis.orderFlow,
        aggressiveness: 10,
      },
    };

    const score = calculateFluxScore(aggressive);
    expect(score).toBeGreaterThan(5);
  });

  it('should cap flux score at 10', () => {
    const extreme = {
      ...mockFluxAnalysis,
      volumeProfile: {
        ...mockFluxAnalysis.volumeProfile,
        volumeRatio: 10.0,
      },
      orderFlow: {
        ...mockFluxAnalysis.orderFlow,
        aggressiveness: 10,
      },
      institutionalActivity: {
        ...mockFluxAnalysis.institutionalActivity,
        smartMoneyIndex: 10,
      },
    };

    const score = calculateFluxScore(extreme);
    expect(score).toBeLessThanOrEqual(10);
  });
});

// ============================================================================
// Service Function Tests
// ============================================================================

describe('Institutional Flux Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should analyze institutional flux with full data', async () => {
    const { generateAIResponse } = await import('@/lib/ai-provider');
    vi.mocked(generateAIResponse).mockResolvedValue({
      content: JSON.stringify(mockFluxAnalysis),
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      latencyMs: 1500,
    });

    const result = await analyzeInstitutionalFlux({
      instrument: 'NQ1',
      marketData: mockMarketData,
      volumeData: mockVolumeData,
      orderBookData: mockOrderBookData,
      darkPoolData: mockDarkPoolData,
      useCache: false,
    });

    expect(result.analysis.instrument).toBe('NQ1');
    expect(result.analysis.fluxScore).toBeGreaterThan(0);
    expect(result.cached).toBe(false);
    expect(result.provider).toBe('gemini');
  });

  it('should handle simplified analysis with limited data', async () => {
    const { generateAIResponse } = await import('@/lib/ai-provider');
    vi.mocked(generateAIResponse).mockResolvedValue({
      content: JSON.stringify({
        ...mockFluxAnalysis,
        confidence: 40, // Lower confidence for limited data
      }),
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      latencyMs: 1200,
    });

    const result = await analyzeInstitutionalFlux({
      instrument: 'TSLA',
      marketData: mockMarketData,
      useCache: false,
    });

    expect(result.analysis.instrument).toBe('NQ1'); // From mock
    expect(result.analysis.confidence).toBeLessThanOrEqual(60);
  });

  it('should return fallback analysis on AI failure', async () => {
    const { generateAIResponse } = await import('@/lib/ai-provider');
    vi.mocked(generateAIResponse).mockRejectedValue(new Error('AI service unavailable'));

    const result = await analyzeInstitutionalFlux({
      instrument: 'AAPL',
      marketData: mockMarketData,
      useCache: false,
    });

    expect(result.analysis.instrument).toBe('AAPL');
    expect(result.analysis.fluxScore).toBe(0);
    expect(result.analysis.confidence).toBe(0);
    expect(result.provider).toBe('fallback');
    expect(result.analysis.warnings.length).toBeGreaterThan(0);
  });

  it('should respect timeout constraint (3s)', async () => {
    const { generateAIResponse } = await import('@/lib/ai-provider');
    vi.mocked(generateAIResponse).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 5000))
    );

    const startTime = performance.now();
    const result = await analyzeInstitutionalFlux({
      instrument: 'SPY',
      marketData: mockMarketData,
      useCache: false,
    });
    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(4000); // Should timeout before 4s
    expect(result.provider).toBe('fallback'); // Should fallback on timeout
  });
});

// ============================================================================
// Batch Analysis Tests
// ============================================================================

describe('Batch Flux Analysis', () => {
  it('should analyze multiple instruments in parallel', async () => {
    const { generateAIResponse } = await import('@/lib/ai-provider');
    vi.mocked(generateAIResponse).mockResolvedValue({
      content: JSON.stringify(mockFluxAnalysis),
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      latencyMs: 1500,
    });

    const instruments = ['NQ1', 'ES1', 'TSLA'];
    const getMarketData = async (instrument: string) => ({
      ...mockMarketData,
      currentPrice: 100 + instruments.indexOf(instrument) * 10,
    });

    const results = await batchAnalyzeFlux(instruments, getMarketData);

    expect(results.size).toBe(3);
    expect(results.has('NQ1')).toBe(true);
    expect(results.has('ES1')).toBe(true);
    expect(results.has('TSLA')).toBe(true);
  });

  it('should handle partial failures in batch', async () => {
    const { generateAIResponse } = await import('@/lib/ai-provider');
    let callCount = 0;
    vi.mocked(generateAIResponse).mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        throw new Error('AI failure for second instrument');
      }
      return {
        content: JSON.stringify(mockFluxAnalysis),
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        latencyMs: 1500,
      };
    });

    const instruments = ['NQ1', 'ES1', 'TSLA'];
    const getMarketData = async () => mockMarketData;

    const results = await batchAnalyzeFlux(instruments, getMarketData);

    // Should have results for instruments that succeeded
    expect(results.size).toBeGreaterThan(0);
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Flux Summary', () => {
  it('should generate flux summary', () => {
    const summary = getFluxSummary(mockFluxAnalysis);

    expect(summary.score).toBe(7.5);
    expect(summary.bias).toBe('BULLISH');
    expect(summary.confidence).toBe(75);
    expect(summary.topInsight).toBeTruthy();
    expect(summary.warningLevel).toBe('LOW');
  });

  it('should detect high manipulation warning', () => {
    const highManipulation = {
      ...mockFluxAnalysis,
      marketManipulation: {
        ...mockFluxAnalysis.marketManipulation,
        manipulationScore: 8,
      },
    };

    const summary = getFluxSummary(highManipulation);
    expect(summary.warningLevel).toBe('HIGH');
  });

  it('should detect medium manipulation warning', () => {
    const mediumManipulation = {
      ...mockFluxAnalysis,
      marketManipulation: {
        ...mockFluxAnalysis.marketManipulation,
        manipulationScore: 5,
      },
    };

    const summary = getFluxSummary(mediumManipulation);
    expect(summary.warningLevel).toBe('MEDIUM');
  });
});

describe('Timeframe Comparison', () => {
  it('should detect bullish consensus', () => {
    const analyses = [
      { timeframe: '1h', analysis: { ...mockFluxAnalysis, bias: 'BULLISH' as const } },
      { timeframe: '4h', analysis: { ...mockFluxAnalysis, bias: 'BULLISH' as const } },
      { timeframe: '1d', analysis: { ...mockFluxAnalysis, bias: 'BULLISH' as const } },
    ];

    const comparison = compareFluxAcrossTimeframes(analyses);

    expect(comparison.consensus).toBe('BULLISH');
    expect(comparison.strength).toBe(10);
    expect(comparison.divergences.length).toBe(0);
  });

  it('should detect bearish consensus', () => {
    const analyses = [
      { timeframe: '1h', analysis: { ...mockFluxAnalysis, bias: 'BEARISH' as const } },
      { timeframe: '4h', analysis: { ...mockFluxAnalysis, bias: 'BEARISH' as const } },
      { timeframe: '1d', analysis: { ...mockFluxAnalysis, bias: 'BEARISH' as const } },
    ];

    const comparison = compareFluxAcrossTimeframes(analyses);

    expect(comparison.consensus).toBe('BEARISH');
    expect(comparison.strength).toBe(10);
  });

  it('should detect divergent signals', () => {
    const analyses = [
      { timeframe: '1h', analysis: { ...mockFluxAnalysis, bias: 'BULLISH' as const } },
      { timeframe: '4h', analysis: { ...mockFluxAnalysis, bias: 'BEARISH' as const } },
      { timeframe: '1d', analysis: { ...mockFluxAnalysis, bias: 'NEUTRAL' as const } },
    ];

    const comparison = compareFluxAcrossTimeframes(analyses);

    expect(comparison.consensus).toBe('DIVERGENT');
    expect(comparison.strength).toBe(0);
    expect(comparison.divergences.length).toBeGreaterThan(0);
  });

  it('should handle majority consensus', () => {
    const analyses = [
      { timeframe: '1h', analysis: { ...mockFluxAnalysis, bias: 'BULLISH' as const } },
      { timeframe: '4h', analysis: { ...mockFluxAnalysis, bias: 'BULLISH' as const } },
      { timeframe: '1d', analysis: { ...mockFluxAnalysis, bias: 'BEARISH' as const } },
    ];

    const comparison = compareFluxAcrossTimeframes(analyses);

    expect(comparison.consensus).toBe('BULLISH');
    expect(comparison.strength).toBeGreaterThan(5);
    expect(comparison.strength).toBeLessThan(10);
    expect(comparison.divergences.length).toBeGreaterThan(0);
  });

  it('should handle empty analysis array', () => {
    const comparison = compareFluxAcrossTimeframes([]);

    expect(comparison.consensus).toBe('NEUTRAL');
    expect(comparison.strength).toBe(0);
  });
});
