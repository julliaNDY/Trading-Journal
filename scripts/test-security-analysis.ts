#!/usr/bin/env tsx
/**
 * Security Analysis Integration Test
 * 
 * Tests the security analysis prompt with real Gemini API
 * Usage: npx tsx scripts/test-security-analysis.ts
 */

import { analyzeSecurityProfile, batchAnalyzeSecurityProfiles } from '../src/services/daily-bias/security-analysis-service';
import type { SecurityAnalysisInput } from '../src/lib/prompts/daily-bias-prompts';
import { isGeminiConfigured } from '../src/lib/google-gemini';

// ============================================================================
// Test Data - Real Market Instruments
// ============================================================================

const TEST_INSTRUMENTS: SecurityAnalysisInput[] = [
  {
    symbol: 'NQ1',
    currentPrice: 21450.50,
    priceChange24h: -125.75,
    priceChangePercent24h: -0.58,
    volume24h: 2_500_000_000,
    high24h: 21600.25,
    low24h: 21380.00,
    assetType: 'futures',
    sector: 'Technology',
  },
  {
    symbol: 'ES1',
    currentPrice: 5950.25,
    priceChange24h: 15.50,
    priceChangePercent24h: 0.26,
    volume24h: 1_800_000_000,
    high24h: 5965.00,
    low24h: 5935.75,
    assetType: 'futures',
    sector: 'Broad Market',
  },
  {
    symbol: 'TSLA',
    currentPrice: 385.25,
    priceChange24h: -12.50,
    priceChangePercent24h: -3.14,
    volume24h: 125_000_000,
    high24h: 398.75,
    low24h: 382.00,
    marketCap: 1_220_000_000_000,
    assetType: 'stock',
    sector: 'Automotive/Technology',
  },
  {
    symbol: 'NVDA',
    currentPrice: 875.50,
    priceChange24h: 22.75,
    priceChangePercent24h: 2.67,
    volume24h: 85_000_000,
    high24h: 880.25,
    low24h: 852.00,
    marketCap: 2_150_000_000_000,
    assetType: 'stock',
    sector: 'Technology/Semiconductors',
  },
  {
    symbol: 'BTC',
    currentPrice: 102_500,
    priceChange24h: -3_200,
    priceChangePercent24h: -3.03,
    volume24h: 28_000_000_000,
    high24h: 105_800,
    low24h: 101_200,
    assetType: 'crypto',
  },
  {
    symbol: 'EUR/USD',
    currentPrice: 1.0875,
    priceChange24h: 0.0025,
    priceChangePercent24h: 0.23,
    volume24h: 150_000_000_000,
    high24h: 1.0895,
    low24h: 1.0850,
    assetType: 'forex',
  },
];

// ============================================================================
// Test Functions
// ============================================================================

async function testSingleAnalysis() {
  console.log('\n🔍 TEST 1: Single Instrument Analysis');
  console.log('=====================================\n');

  const instrument = TEST_INSTRUMENTS[0]; // NQ1
  console.log(`Analyzing: ${instrument.symbol} (${instrument.assetType})`);
  console.log(`Price: $${instrument.currentPrice} (${instrument.priceChangePercent24h >= 0 ? '+' : ''}${instrument.priceChangePercent24h}%)`);
  console.log(`24h Range: $${instrument.low24h} - $${instrument.high24h}\n`);

  const startTime = Date.now();
  const result = await analyzeSecurityProfile(instrument);
  const duration = Date.now() - startTime;

  if (result.success && result.data) {
    console.log('✅ Analysis Successful!\n');
    console.log('📊 Results:');
    console.log(`  Volatility Index: ${result.data.volatilityIndex}/100`);
    console.log(`  Risk Level: ${result.data.riskLevel}`);
    console.log(`  Security Score: ${result.data.securityScore}/100`);
    console.log(`  Market Conditions: ${result.data.volatilityBreakdown.marketConditions}`);
    console.log(`  Position Sizing: ${result.data.tradingRecommendation.positionSizing}`);
    console.log(`  Stop Loss Multiplier: ${result.data.tradingRecommendation.stopLossMultiplier}x`);
    console.log(`  Confidence: ${result.data.confidence}%\n`);
    console.log('🔑 Key Risks:');
    result.data.keyRisks.forEach((risk, i) => {
      console.log(`  ${i + 1}. ${risk}`);
    });
    console.log(`\n💡 Reasoning: ${result.data.reasoning}\n`);
    console.log('📈 Metadata:');
    console.log(`  Provider: ${result.metadata.provider}`);
    console.log(`  Model: ${result.metadata.model}`);
    console.log(`  Latency: ${result.metadata.latencyMs}ms`);
    console.log(`  Tokens Used: ${result.metadata.tokensUsed || 'N/A'}`);
    console.log(`  Duration: ${duration}ms\n`);
  } else {
    console.log('❌ Analysis Failed!');
    console.log(`Error: ${result.error}\n`);
  }

  return result.success;
}

async function testBatchAnalysis() {
  console.log('\n🔍 TEST 2: Batch Analysis (6 Instruments)');
  console.log('==========================================\n');

  console.log('Analyzing instruments:');
  TEST_INSTRUMENTS.forEach((inst, i) => {
    console.log(`  ${i + 1}. ${inst.symbol} (${inst.assetType})`);
  });
  console.log('');

  const startTime = Date.now();
  const results = await batchAnalyzeSecurityProfiles(TEST_INSTRUMENTS, {
    maxConcurrent: 3,
  });
  const duration = Date.now() - startTime;

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`✅ Completed: ${successful}/${TEST_INSTRUMENTS.length} successful`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}/${TEST_INSTRUMENTS.length}\n`);
  } else {
    console.log('');
  }

  console.log('📊 Results Summary:\n');
  console.log('Symbol      | Risk Level | Volatility | Security | Confidence');
  console.log('------------|------------|------------|----------|------------');
  
  results.forEach((result, i) => {
    const symbol = TEST_INSTRUMENTS[i].symbol.padEnd(11);
    if (result.success && result.data) {
      const risk = result.data.riskLevel.padEnd(10);
      const vol = `${result.data.volatilityIndex}/100`.padEnd(10);
      const sec = `${result.data.securityScore}/100`.padEnd(8);
      const conf = `${result.data.confidence}%`;
      console.log(`${symbol} | ${risk} | ${vol} | ${sec} | ${conf}`);
    } else {
      console.log(`${symbol} | FAILED     | -          | -        | -`);
    }
  });

  console.log(`\n⏱️  Total Duration: ${duration}ms`);
  console.log(`📊 Average per instrument: ${Math.round(duration / TEST_INSTRUMENTS.length)}ms\n`);

  // Detailed results for each instrument
  console.log('📋 Detailed Results:\n');
  results.forEach((result, i) => {
    const inst = TEST_INSTRUMENTS[i];
    console.log(`${i + 1}. ${inst.symbol} (${inst.assetType})`);
    
    if (result.success && result.data) {
      console.log(`   Risk: ${result.data.riskLevel} | Volatility: ${result.data.volatilityIndex}/100`);
      console.log(`   Position Sizing: ${result.data.tradingRecommendation.positionSizing}`);
      console.log(`   Key Risks: ${result.data.keyRisks.slice(0, 2).join(', ')}`);
      console.log(`   Reasoning: ${result.data.reasoning.substring(0, 100)}...`);
    } else {
      console.log(`   ❌ Error: ${result.error}`);
    }
    console.log('');
  });

  return successful === TEST_INSTRUMENTS.length;
}

async function testPromptIteration() {
  console.log('\n🔍 TEST 3: Prompt Quality Metrics');
  console.log('==================================\n');

  const iterations = 5;
  const testInstrument = TEST_INSTRUMENTS[0]; // NQ1
  
  console.log(`Running ${iterations} iterations on ${testInstrument.symbol}...\n`);

  const results = [];
  const latencies = [];
  let validJsonCount = 0;
  let confidenceSum = 0;

  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();
    const result = await analyzeSecurityProfile(testInstrument);
    const latency = Date.now() - startTime;
    
    latencies.push(latency);
    
    if (result.success && result.data) {
      validJsonCount++;
      confidenceSum += result.data.confidence;
      results.push(result.data);
      console.log(`  Iteration ${i + 1}: ✅ Success (${latency}ms, confidence: ${result.data.confidence}%)`);
    } else {
      console.log(`  Iteration ${i + 1}: ❌ Failed (${latency}ms)`);
    }
    
    // Small delay between iterations
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n📊 Quality Metrics:\n');
  console.log(`  Valid JSON Rate: ${validJsonCount}/${iterations} (${(validJsonCount / iterations * 100).toFixed(1)}%)`);
  console.log(`  Average Confidence: ${(confidenceSum / validJsonCount).toFixed(1)}%`);
  console.log(`  Average Latency: ${Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)}ms`);
  console.log(`  Min Latency: ${Math.min(...latencies)}ms`);
  console.log(`  Max Latency: ${Math.max(...latencies)}ms`);

  if (results.length > 1) {
    console.log('\n🔄 Consistency Analysis:\n');
    
    // Check volatility index consistency
    const volatilities = results.map(r => r.volatilityIndex);
    const avgVol = volatilities.reduce((a, b) => a + b, 0) / volatilities.length;
    const volStdDev = Math.sqrt(
      volatilities.reduce((sum, val) => sum + Math.pow(val - avgVol, 2), 0) / volatilities.length
    );
    
    console.log(`  Volatility Index: ${avgVol.toFixed(1)} ± ${volStdDev.toFixed(1)}`);
    
    // Check risk level consistency
    const riskLevels = results.map(r => r.riskLevel);
    const uniqueRiskLevels = [...new Set(riskLevels)];
    console.log(`  Risk Levels: ${uniqueRiskLevels.join(', ')} (${uniqueRiskLevels.length} unique)`);
    
    // Check position sizing consistency
    const positionSizings = results.map(r => r.tradingRecommendation.positionSizing);
    const uniqueSizings = [...new Set(positionSizings)];
    console.log(`  Position Sizings: ${uniqueSizings.join(', ')} (${uniqueSizings.length} unique)`);
  }

  console.log('');
  return validJsonCount === iterations;
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function main() {
  console.log('🚀 Security Analysis - Integration Tests');
  console.log('=========================================');
  
  // Check Gemini configuration
  if (!isGeminiConfigured()) {
    console.log('\n❌ ERROR: GOOGLE_GEMINI_API_KEY not configured');
    console.log('Please set GOOGLE_GEMINI_API_KEY in your .env file\n');
    process.exit(1);
  }
  
  console.log('✅ Gemini API configured\n');
  console.log('Starting tests...\n');

  const results = {
    test1: false,
    test2: false,
    test3: false,
  };

  try {
    // Test 1: Single analysis
    results.test1 = await testSingleAnalysis();
    
    // Test 2: Batch analysis
    results.test2 = await testBatchAnalysis();
    
    // Test 3: Prompt quality metrics
    results.test3 = await testPromptIteration();
    
  } catch (error) {
    console.error('\n❌ Test suite failed with error:');
    console.error(error);
    process.exit(1);
  }

  // Summary
  console.log('\n📊 Test Summary');
  console.log('===============\n');
  console.log(`  Test 1 (Single Analysis): ${results.test1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Test 2 (Batch Analysis): ${results.test2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Test 3 (Prompt Quality): ${results.test3 ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(r => r);
  
  if (allPassed) {
    console.log('\n🎉 All tests passed!\n');
    console.log('✅ Security Analysis (PRÉ-8.1) is ready for production\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Review results above.\n');
    process.exit(1);
  }
}

// Run tests
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
