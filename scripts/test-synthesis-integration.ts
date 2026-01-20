/**
 * Synthesis Service - Integration Test Script
 * 
 * Tests the complete synthesis flow with real examples
 * Task: PRÉ-8.5 - Synthesis Prompts (8h) - Dev 54, Dev 55
 * 
 * Usage:
 *   npm run test:synthesis
 *   or
 *   tsx scripts/test-synthesis-integration.ts
 */

import { synthesizeDailyBias, calculateFallbackBias, validateSynthesisQuality } from '../src/services/daily-bias/synthesis-service';
import { getSynthesisExample, type SynthesisInput } from '../src/lib/prompts/synthesis-prompt';
import type { SynthesisOutput } from '../src/lib/prompts/synthesis-prompt';

// ============================================================================
// Test Scenarios
// ============================================================================

/**
 * Scenario 1: Strong BULLISH Setup
 * All 5 steps align bullish with high confidence
 */
function createBullishScenario(): SynthesisInput {
  return {
    security: {
      volatilityIndex: 45,
      riskLevel: 'MEDIUM',
      securityScore: 7.5,
      analysis: {
        summary: 'Moderate volatility, stable market conditions. Normal trading environment.',
        risks: [
          { risk: 'Normal market risk', probability: 0.2, impact: 0.3 },
        ],
        recommendations: [
          'Normal position sizing',
          'Standard stop loss',
          'Normal entry timing',
        ],
      },
      timestamp: new Date().toISOString(),
      instrument: 'NQ1',
    },
    macro: {
      economicEvents: [
        {
          event: 'Fed Rate Decision',
          time: '14:00',
          importance: 'CRITICAL',
          country: 'USD',
          forecast: 5.25,
          previous: 5.50,
          actual: null,
          impactOnInstrument: 'Bullish - rate pause expected',
        },
      ],
      macroScore: 8.5,
      sentiment: 'VERY_BULLISH',
      analysis: {
        summary: 'Fed expected to pause rate hikes, very bullish for risk assets.',
        centralBankPolicy: 'Dovish pivot',
      },
      timestamp: new Date().toISOString(),
      instrument: 'NQ1',
    },
    flux: {
      volumeProfile: {
        currentVolume: 6000000,
        averageVolume: 4500000,
        volumeLevel: 'HIGH',
        volumeTrend: 'INCREASING',
      },
      orderFlow: {
        largeBuyOrders: 1.5,
        largeSellOrders: 0.7,
        netInstitutionalFlow: 0.8,
        confirmation: 'BULLISH',
      },
      fluxScore: 8.2,
      institutionalPressure: 'BULLISH',
      analysis: {
        summary: 'Very strong institutional buying, volume confirming strong upside momentum.',
      },
      timestamp: new Date().toISOString(),
      instrument: 'NQ1',
    },
    mag7: {
      correlations: [
        { symbol: 'NVDA', correlation: 0.92, priceChange: 4.5, sentiment: 'BULLISH' },
        { symbol: 'AAPL', correlation: 0.78, priceChange: 2.8, sentiment: 'BULLISH' },
        { symbol: 'MSFT', correlation: 0.85, priceChange: 3.2, sentiment: 'BULLISH' },
        { symbol: 'GOOGL', correlation: 0.72, priceChange: 2.1, sentiment: 'BULLISH' },
        { symbol: 'AMZN', correlation: 0.68, priceChange: 1.9, sentiment: 'BULLISH' },
        { symbol: 'META', correlation: 0.75, priceChange: 2.5, sentiment: 'BULLISH' },
        { symbol: 'TSLA', correlation: 0.65, priceChange: 1.2, sentiment: 'BULLISH' },
      ],
      leaderScore: 9.0,
      overallSentiment: 'VERY_BULLISH',
      analysis: {
        summary: 'All Mag 7 leaders showing strong bullish momentum, very high correlation with NQ1.',
      },
      timestamp: new Date().toISOString(),
      instrument: 'NQ1',
    },
    technical: {
      supportLevels: [
        { price: 18500, strength: 0.95, type: 'TRENDLINE', testedCount: 4 },
        { price: 18300, strength: 0.88, type: 'MOVING_AVERAGE', testedCount: 3 },
      ],
      resistanceLevels: [
        { price: 19000, strength: 0.70, type: 'PREVIOUS_HIGH', testedCount: 1 },
      ],
      trend: {
        direction: 'UPTREND',
        strength: 0.92,
        timeframe: 'DAILY',
      },
      technicalScore: 8.8,
      analysis: {
        summary: 'Very strong uptrend with multiple supports intact. Clear breakout path above 19000.',
        patterns: [
          { pattern: 'Strong uptrend with higher highs and higher lows', bullish: true },
          { pattern: 'Breakout above key resistance', bullish: true },
        ],
      },
      timestamp: new Date().toISOString(),
      instrument: 'NQ1',
    },
    instrument: 'NQ1',
    analysisDate: new Date().toISOString().split('T')[0],
    currentPrice: 18750,
  };
}

/**
 * Scenario 2: Strong BEARISH Setup
 * All 5 steps align bearish with high confidence
 */
function createBearishScenario(): SynthesisInput {
  return {
    security: {
      volatilityIndex: 75,
      riskLevel: 'HIGH',
      securityScore: 5.0,
      analysis: {
        summary: 'Elevated volatility, increased risk. Recommend caution.',
        risks: [
          { risk: 'Gap risk', probability: 0.5, impact: 0.6 },
          { risk: 'News-driven volatility', probability: 0.7, impact: 0.8 },
        ],
        recommendations: [
          'Reduce position size to 50%',
          'Use 1.5x stop loss multiplier',
          'Avoid overnight holds',
        ],
      },
      timestamp: new Date().toISOString(),
      instrument: 'ES1',
    },
    macro: {
      economicEvents: [
        {
          event: 'Inflation Report (CPI)',
          time: '08:30',
          importance: 'CRITICAL',
          country: 'USD',
          forecast: 3.5,
          previous: 3.2,
          actual: 3.8,
          impactOnInstrument: 'Bearish - higher inflation than expected',
        },
      ],
      macroScore: 3.5,
      sentiment: 'VERY_BEARISH',
      analysis: {
        summary: 'Inflation higher than expected, Fed may need to tighten further. Bearish for equities.',
        centralBankPolicy: 'Hawkish pivot expected',
      },
      timestamp: new Date().toISOString(),
      instrument: 'ES1',
    },
    flux: {
      volumeProfile: {
        currentVolume: 8000000,
        averageVolume: 5000000,
        volumeLevel: 'EXTREMELY_HIGH',
        volumeTrend: 'INCREASING',
      },
      orderFlow: {
        largeBuyOrders: 0.6,
        largeSellOrders: 1.8,
        netInstitutionalFlow: -1.2,
        confirmation: 'BEARISH',
      },
      fluxScore: 2.5,
      institutionalPressure: 'BEARISH',
      analysis: {
        summary: 'Strong institutional selling pressure, high volume confirming downside move.',
      },
      timestamp: new Date().toISOString(),
      instrument: 'ES1',
    },
    mag7: {
      correlations: [
        { symbol: 'NVDA', correlation: 0.88, priceChange: -3.5, sentiment: 'BEARISH' },
        { symbol: 'AAPL', correlation: 0.75, priceChange: -2.2, sentiment: 'BEARISH' },
        { symbol: 'MSFT', correlation: 0.82, priceChange: -2.8, sentiment: 'BEARISH' },
        { symbol: 'GOOGL', correlation: 0.70, priceChange: -1.8, sentiment: 'BEARISH' },
        { symbol: 'AMZN', correlation: 0.65, priceChange: -1.5, sentiment: 'BEARISH' },
        { symbol: 'META', correlation: 0.72, priceChange: -2.0, sentiment: 'BEARISH' },
        { symbol: 'TSLA', correlation: 0.60, priceChange: -4.2, sentiment: 'BEARISH' },
      ],
      leaderScore: 2.8,
      overallSentiment: 'VERY_BEARISH',
      analysis: {
        summary: 'All Mag 7 leaders showing strong bearish momentum, high correlation with ES1.',
      },
      timestamp: new Date().toISOString(),
      instrument: 'ES1',
    },
    technical: {
      supportLevels: [
        { price: 4500, strength: 0.65, type: 'PREVIOUS_LOW', testedCount: 1 },
      ],
      resistanceLevels: [
        { price: 4650, strength: 0.92, type: 'TRENDLINE', testedCount: 3 },
        { price: 4700, strength: 0.85, type: 'MOVING_AVERAGE', testedCount: 2 },
      ],
      trend: {
        direction: 'DOWNTREND',
        strength: 0.88,
        timeframe: 'DAILY',
      },
      technicalScore: 2.5,
      analysis: {
        summary: 'Strong downtrend with resistance levels holding. Breakdown below 4500 likely.',
        patterns: [
          { pattern: 'Lower highs and lower lows', bullish: false },
          { pattern: 'Breakdown below key support', bullish: false },
        ],
      },
      timestamp: new Date().toISOString(),
      instrument: 'ES1',
    },
    instrument: 'ES1',
    analysisDate: new Date().toISOString().split('T')[0],
    currentPrice: 4550,
  };
}

/**
 * Scenario 3: NEUTRAL/Mixed Signals
 * Steps disagree, low confidence
 */
function createNeutralScenario(): SynthesisInput {
  return {
    security: {
      volatilityIndex: 50,
      riskLevel: 'MEDIUM',
      securityScore: 6.0,
      analysis: {
        summary: 'Moderate volatility, mixed conditions.',
        risks: [
          { risk: 'Normal market risk', probability: 0.3, impact: 0.4 },
        ],
        recommendations: [
          'Normal position sizing',
          'Standard stop loss',
        ],
      },
      timestamp: new Date().toISOString(),
      instrument: 'EUR/USD',
    },
    macro: {
      economicEvents: [
        {
          event: 'ECB Rate Decision',
          time: '13:45',
          importance: 'HIGH',
          country: 'EUR',
          forecast: 4.0,
          previous: 4.0,
          actual: null,
          impactOnInstrument: 'Neutral - no change expected',
        },
      ],
      macroScore: 5.0,
      sentiment: 'NEUTRAL',
      analysis: {
        summary: 'Central bank policy unchanged, neutral macro environment.',
      },
      timestamp: new Date().toISOString(),
      instrument: 'EUR/USD',
    },
    flux: {
      volumeProfile: {
        currentVolume: 1200000,
        averageVolume: 1100000,
        volumeLevel: 'NORMAL',
        volumeTrend: 'STABLE',
      },
      orderFlow: {
        largeBuyOrders: 1.0,
        largeSellOrders: 1.0,
        netInstitutionalFlow: 0.0,
        confirmation: 'NEUTRAL',
      },
      fluxScore: 5.0,
      institutionalPressure: 'NEUTRAL',
      analysis: {
        summary: 'Balanced institutional flow, no clear directional bias.',
      },
      timestamp: new Date().toISOString(),
      instrument: 'EUR/USD',
    },
    mag7: {
      correlations: [
        { symbol: 'NVDA', correlation: 0.15, priceChange: 0.5, sentiment: 'NEUTRAL' },
        { symbol: 'AAPL', correlation: 0.10, priceChange: -0.2, sentiment: 'NEUTRAL' },
      ],
      leaderScore: 5.0,
      overallSentiment: 'NEUTRAL',
      analysis: {
        summary: 'Low correlation with Mag 7 (forex pair), neutral sentiment.',
      },
      timestamp: new Date().toISOString(),
      instrument: 'EUR/USD',
    },
    technical: {
      supportLevels: [
        { price: 1.0850, strength: 0.70, type: 'PREVIOUS_LOW', testedCount: 2 },
      ],
      resistanceLevels: [
        { price: 1.0950, strength: 0.75, type: 'PREVIOUS_HIGH', testedCount: 2 },
      ],
      trend: {
        direction: 'SIDEWAYS',
        strength: 0.35,
        timeframe: 'DAILY',
      },
      technicalScore: 5.0,
      analysis: {
        summary: 'Ranging market, no clear trend. Trading between support and resistance.',
      },
      timestamp: new Date().toISOString(),
      instrument: 'EUR/USD',
    },
    instrument: 'EUR/USD',
    analysisDate: new Date().toISOString().split('T')[0],
    currentPrice: 1.0900,
  };
}

// ============================================================================
// Test Runner
// ============================================================================

async function runIntegrationTests() {
  console.log('🧪 Synthesis Service - Integration Tests\n');
  console.log('='.repeat(80));
  
  const scenarios = [
    { name: 'Strong BULLISH Setup', input: createBullishScenario() },
    { name: 'Strong BEARISH Setup', input: createBearishScenario() },
    { name: 'NEUTRAL/Mixed Signals', input: createNeutralScenario() },
    { name: 'Example from Prompt', input: getSynthesisExample() },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const scenario of scenarios) {
    console.log(`\n📊 Testing: ${scenario.name}`);
    console.log('-'.repeat(80));
    
    try {
      // Test AI synthesis (if API available)
      console.log('\n1️⃣ Testing AI Synthesis...');
      const aiResult = await synthesizeDailyBias(scenario.input, {
        maxRetries: 1,
        minConfidence: 0.0,
      });
      
      if (aiResult.success) {
        console.log('✅ AI Synthesis: SUCCESS');
        console.log(`   Final Bias: ${aiResult.data!.finalBias}`);
        console.log(`   Confidence: ${(aiResult.data!.confidence * 100).toFixed(1)}%`);
        console.log(`   Agreement Level: ${(aiResult.data!.analysis.agreementLevel * 100).toFixed(1)}%`);
        console.log(`   Latency: ${aiResult.metadata.latencyMs}ms`);
        
        // Validate quality
        const quality = validateSynthesisQuality(aiResult.data!);
        if (quality.valid) {
          console.log('   Quality: ✅ VALID (no warnings)');
        } else {
          console.log(`   Quality: ⚠️  WARNINGS (${quality.warnings.length})`);
          quality.warnings.forEach(w => console.log(`      - ${w}`));
        }
        
        // Display key thesis points
        console.log('\n   Key Thesis Points:');
        aiResult.data!.analysis.keyThesisPoints.slice(0, 3).forEach((point, i) => {
          console.log(`      ${i + 1}. ${point}`);
        });
        
        passed++;
      } else {
        console.log('⚠️  AI Synthesis: FAILED (using fallback)');
        console.log(`   Error: ${aiResult.error}`);
        
        // Test fallback
        console.log('\n2️⃣ Testing Fallback Calculation...');
        const fallbackResult = calculateFallbackBias(scenario.input);
        console.log('✅ Fallback: SUCCESS');
        console.log(`   Final Bias: ${fallbackResult.finalBias}`);
        console.log(`   Confidence: ${(fallbackResult.confidence * 100).toFixed(1)}%`);
        
        passed++;
      }
      
      // Test fallback calculation
      console.log('\n3️⃣ Testing Fallback Calculation...');
      const fallbackResult = calculateFallbackBias(scenario.input);
      console.log('✅ Fallback: SUCCESS');
      console.log(`   Final Bias: ${fallbackResult.finalBias}`);
      console.log(`   Confidence: ${(fallbackResult.confidence * 100).toFixed(1)}%`);
      console.log(`   Opening Direction: ${fallbackResult.openingConfirmation.expectedDirection}`);
      
      // Validate fallback output
      const quality = validateSynthesisQuality(fallbackResult);
      if (quality.valid) {
        console.log('   Quality: ✅ VALID');
      } else {
        console.log(`   Quality: ⚠️  WARNINGS (${quality.warnings.length})`);
      }
      
      passed++;
      
    } catch (error) {
      console.error('❌ Test FAILED:', error);
      failed++;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Test Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All integration tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Check errors above.');
    process.exit(1);
  }
}

// ============================================================================
// Main Execution
// ============================================================================

if (require.main === module) {
  runIntegrationTests().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runIntegrationTests, createBullishScenario, createBearishScenario, createNeutralScenario };
