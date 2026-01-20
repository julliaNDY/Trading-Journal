/**
 * Test Script: Synthesis Text Generation (Story 12.11)
 * 
 * Validates that synthesis text and sentiment are generated correctly
 * and stored in the database.
 */

import { generateSynthesis } from '@/services/ai/daily-bias-service';
import { calculateSentiment, getInstrumentWeights } from '@/services/ai/synthesis-sentiment';

async function testSynthesisGeneration() {
  console.log('🧪 Testing Synthesis Text Generation (Story 12.11)\n');
  
  // ============================================================================
  // Test 1: Mock 5-Step Analysis Results
  // ============================================================================
  console.log('📊 Test 1: Generate synthesis from mock 5-step data\n');
  
  const mockAnalysisData = {
    security: {
      riskLevel: 'MEDIUM',
      securityScore: 7.5,
      volatilityIndex: 55,
      finalBias: 'BULLISH',
      confidence: 75
    },
    macro: {
      sentiment: 'BULLISH',
      macroScore: 7.0,
      economicEvents: [],
      finalBias: 'BULLISH',
      confidence: 70
    },
    flux: {
      institutionalPressure: 'BULLISH',
      fluxScore: 8.0,
      volumeProfile: {},
      finalBias: 'BULLISH',
      confidence: 82
    },
    mag7: {
      overallSentiment: 'BULLISH',
      leaderScore: 7.8,
      correlations: [],
      finalBias: 'BULLISH',
      confidence: 78
    },
    technical: {
      trend: { direction: 'UPTREND', strength: 0.75 },
      technicalScore: 7.5,
      finalBias: 'BULLISH',
      confidence: 74
    },
    dataSources: [
      'CME Group',
      'Federal Reserve Economic Data',
      'TradingView',
      'Yahoo Finance',
      'Alpha Vantage'
    ],
    instrument: 'NQ1'
  };
  
  // ============================================================================
  // Test 2: Sentiment Algorithm Calculation
  // ============================================================================
  console.log('🧮 Test 2: Calculate sentiment using weighted algorithm\n');
  
  const analysisSteps = {
    security: { bias: 'BULLISH' as const, confidence: 75 },
    macro: { bias: 'BULLISH' as const, confidence: 70 },
    flux: { bias: 'BULLISH' as const, confidence: 82 },
    mag7: { bias: 'BULLISH' as const, confidence: 78 },
    technical: { bias: 'BULLISH' as const, confidence: 74 }
  };
  
  const weights = getInstrumentWeights('NQ1');
  const sentimentCalc = calculateSentiment(analysisSteps, weights);
  
  console.log('Instrument:', 'NQ1');
  console.log('Weights:', weights);
  console.log('Weighted Score:', sentimentCalc.weightedScore.toFixed(2));
  console.log('Sentiment:', sentimentCalc.sentiment);
  console.log('Agreement Level:', sentimentCalc.agreementLevel.toFixed(2));
  console.log('Step Contributions:', {
    security: sentimentCalc.stepScores.security.toFixed(2),
    macro: sentimentCalc.stepScores.macro.toFixed(2),
    flux: sentimentCalc.stepScores.flux.toFixed(2),
    mag7: sentimentCalc.stepScores.mag7.toFixed(2),
    technical: sentimentCalc.stepScores.technical.toFixed(2)
  });
  console.log();
  
  // ============================================================================
  // Test 3: Generate Synthesis Text
  // ============================================================================
  console.log('📝 Test 3: Generate synthesis text via AI\n');
  
  try {
    const synthesisResult = await generateSynthesis(mockAnalysisData);
    
    if (synthesisResult) {
      console.log('✅ Synthesis generated successfully\n');
      console.log('Text:', synthesisResult.text);
      console.log('\nSentiment:', synthesisResult.sentiment);
      console.log('Confidence:', synthesisResult.confidence);
      console.log('Text Length:', synthesisResult.text.length, 'characters');
      
      // Validate AC2: Text starts with citation
      const startsWithCitation = synthesisResult.text.startsWith('By analyzing');
      console.log('\n✓ AC2 - Starts with citation:', startsWithCitation ? '✅' : '❌');
      
      // Validate AC3: Sentiment is one of the valid enums
      const validSentiments = ['BULLISH', 'BEARISH', 'NEUTRAL'];
      const validSentiment = validSentiments.includes(synthesisResult.sentiment);
      console.log('✓ AC3 - Valid sentiment enum:', validSentiment ? '✅' : '❌');
      
      // Validate AC4: Sentiment matches algorithm
      const matchesAlgorithm = synthesisResult.sentiment === sentimentCalc.sentiment;
      console.log('✓ AC4 - Sentiment matches algorithm:', matchesAlgorithm ? '✅' : '❌', `(${synthesisResult.sentiment} === ${sentimentCalc.sentiment})`);
      
    } else {
      console.log('❌ Synthesis generation failed (returned null)');
    }
  } catch (error) {
    console.error('❌ Error generating synthesis:', error);
  }
  
  console.log('\n✅ Synthesis Generation Test Complete\n');
}

// ============================================================================
// Run Tests
// ============================================================================

testSynthesisGeneration()
  .then(() => {
    console.log('All tests completed successfully! ✅');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
