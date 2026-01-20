/**
 * AI POC Benchmark Script
 * 
 * Story 1.5: AI Architecture POC
 * 
 * This script benchmarks the AI providers (Google Gemini vs OpenAI) to measure:
 * - Latency (p50, p95, p99)
 * - Token usage
 * - Estimated costs
 * - Embedding performance
 * 
 * Usage:
 *   npx tsx scripts/ai-poc-benchmark.ts
 * 
 * Requirements:
 *   - GOOGLE_GEMINI_API_KEY in .env
 *   - OPENAI_API_KEY in .env (optional, for comparison)
 */

import * as dotenv from 'dotenv';
dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const BENCHMARK_CONFIG = {
  // Number of iterations for each test
  iterations: 10,
  
  // Sample trading context for coach tests
  sampleContext: {
    totalTrades: 150,
    winRate: 58.5,
    profitFactor: 1.85,
    totalPnl: 12450.50,
    averageWin: 185.25,
    averageLoss: -95.10,
    averageRR: 2.15,
    tradedSymbols: ['ES', 'NQ', 'CL', 'GC'],
  },
  
  // Sample prompts for testing
  prompts: {
    short: 'What is my win rate?',
    medium: 'Analyze my trading performance and suggest 3 specific improvements I should focus on.',
    long: `I've been struggling with my trading lately. My win rate dropped from 65% to 58% over the last month. 
I think I'm overtrading and taking trades that don't fit my setup. I also notice I tend to exit winners too early.
Can you analyze my statistics and give me a detailed action plan to get back on track? 
Please include specific rules I should follow and how to measure my progress.`,
  },
  
  // Sample texts for embedding tests
  embeddingTexts: [
    'LONG trade on ES winning trade with profit of $250.00 risk-reward ratio of 2.5',
    'SHORT trade on NQ losing trade with loss of $150.00 duration 15 minutes',
    'LONG trade on CL breakeven trade risk-reward ratio of 1.0 tags: scalp, trend-following',
  ],
};

// ============================================================================
// Types
// ============================================================================

interface BenchmarkResult {
  provider: string;
  model: string;
  testName: string;
  iterations: number;
  latencies: number[];
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  estimatedCostPerRequest: number;
  errors: number;
}

interface EmbeddingBenchmarkResult {
  provider: string;
  model: string;
  testName: string;
  iterations: number;
  latencies: number[];
  p50: number;
  p95: number;
  mean: number;
  dimension: number;
  errors: number;
}

// ============================================================================
// Statistics Helpers
// ============================================================================

function calculatePercentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
}

function calculateMean(array: number[]): number {
  if (array.length === 0) return 0;
  return array.reduce((a, b) => a + b, 0) / array.length;
}

// ============================================================================
// Benchmark Functions
// ============================================================================

async function benchmarkChatCompletion(
  provider: 'gemini' | 'openai',
  promptType: 'short' | 'medium' | 'long'
): Promise<BenchmarkResult> {
  // Dynamic import to avoid issues with module resolution
  const { generateAIResponse, estimateCost } = await import('../src/lib/ai-provider');
  const { isGeminiConfigured } = await import('../src/lib/google-gemini');
  const { isOpenAIConfigured } = await import('../src/lib/openai');
  
  // Check if provider is configured
  if (provider === 'gemini' && !isGeminiConfigured()) {
    console.log(`⚠️  Skipping Gemini benchmark - GOOGLE_GEMINI_API_KEY not configured`);
    return createEmptyResult(provider, promptType);
  }
  
  if (provider === 'openai' && !isOpenAIConfigured()) {
    console.log(`⚠️  Skipping OpenAI benchmark - OPENAI_API_KEY not configured`);
    return createEmptyResult(provider, promptType);
  }
  
  const prompt = BENCHMARK_CONFIG.prompts[promptType];
  const context = BENCHMARK_CONFIG.sampleContext;
  
  const latencies: number[] = [];
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCost = 0;
  let errors = 0;
  let model = '';
  
  console.log(`\n🔄 Running ${provider} benchmark (${promptType} prompt, ${BENCHMARK_CONFIG.iterations} iterations)...`);
  
  for (let i = 0; i < BENCHMARK_CONFIG.iterations; i++) {
    try {
      const messages = [
        { 
          role: 'system' as const, 
          content: `You are a trading coach. User stats: Win Rate: ${context.winRate}%, Profit Factor: ${context.profitFactor}, Total PnL: $${context.totalPnl}, Symbols: ${context.tradedSymbols.join(', ')}` 
        },
        { role: 'user' as const, content: prompt },
      ];
      
      const response = await generateAIResponse(messages, {
        preferredProvider: provider,
        fallbackEnabled: false,
      });
      
      latencies.push(response.latencyMs);
      model = response.model;
      
      if (response.usage) {
        totalPromptTokens += response.usage.promptTokens;
        totalCompletionTokens += response.usage.completionTokens;
      }
      
      const cost = estimateCost(response);
      totalCost += cost.totalCost;
      
      process.stdout.write(`  Iteration ${i + 1}: ${response.latencyMs.toFixed(0)}ms\r`);
      
      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      errors++;
      console.error(`  Error in iteration ${i + 1}:`, (error as Error).message);
    }
  }
  
  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  
  return {
    provider,
    model,
    testName: `chat-${promptType}`,
    iterations: BENCHMARK_CONFIG.iterations,
    latencies,
    p50: calculatePercentile(sortedLatencies, 50),
    p95: calculatePercentile(sortedLatencies, 95),
    p99: calculatePercentile(sortedLatencies, 99),
    mean: calculateMean(latencies),
    min: Math.min(...latencies),
    max: Math.max(...latencies),
    tokensUsed: {
      prompt: Math.round(totalPromptTokens / Math.max(latencies.length, 1)),
      completion: Math.round(totalCompletionTokens / Math.max(latencies.length, 1)),
      total: Math.round((totalPromptTokens + totalCompletionTokens) / Math.max(latencies.length, 1)),
    },
    estimatedCostPerRequest: totalCost / Math.max(latencies.length, 1),
    errors,
  };
}

async function benchmarkEmbeddings(
  provider: 'gemini' | 'openai'
): Promise<EmbeddingBenchmarkResult> {
  const { generateEmbeddings } = await import('../src/lib/ai-provider');
  const { isGeminiConfigured } = await import('../src/lib/google-gemini');
  const { isOpenAIConfigured } = await import('../src/lib/openai');
  
  // Check if provider is configured
  if (provider === 'gemini' && !isGeminiConfigured()) {
    console.log(`⚠️  Skipping Gemini embeddings - GOOGLE_GEMINI_API_KEY not configured`);
    return createEmptyEmbeddingResult(provider);
  }
  
  if (provider === 'openai' && !isOpenAIConfigured()) {
    console.log(`⚠️  Skipping OpenAI embeddings - OPENAI_API_KEY not configured`);
    return createEmptyEmbeddingResult(provider);
  }
  
  const texts = BENCHMARK_CONFIG.embeddingTexts;
  const latencies: number[] = [];
  let dimension = 0;
  let model = '';
  let errors = 0;
  
  console.log(`\n🔄 Running ${provider} embeddings benchmark (${BENCHMARK_CONFIG.iterations} iterations)...`);
  
  for (let i = 0; i < BENCHMARK_CONFIG.iterations; i++) {
    try {
      const response = await generateEmbeddings(texts, {
        preferredProvider: provider,
        fallbackEnabled: false,
      });
      
      latencies.push(response.latencyMs);
      dimension = response.dimension;
      model = response.model;
      
      process.stdout.write(`  Iteration ${i + 1}: ${response.latencyMs.toFixed(0)}ms\r`);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      errors++;
      console.error(`  Error in iteration ${i + 1}:`, (error as Error).message);
    }
  }
  
  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  
  return {
    provider,
    model,
    testName: 'embeddings',
    iterations: BENCHMARK_CONFIG.iterations,
    latencies,
    p50: calculatePercentile(sortedLatencies, 50),
    p95: calculatePercentile(sortedLatencies, 95),
    mean: calculateMean(latencies),
    dimension,
    errors,
  };
}

function createEmptyResult(provider: string, promptType: string): BenchmarkResult {
  return {
    provider,
    model: 'N/A',
    testName: `chat-${promptType}`,
    iterations: 0,
    latencies: [],
    p50: 0,
    p95: 0,
    p99: 0,
    mean: 0,
    min: 0,
    max: 0,
    tokensUsed: { prompt: 0, completion: 0, total: 0 },
    estimatedCostPerRequest: 0,
    errors: 0,
  };
}

function createEmptyEmbeddingResult(provider: string): EmbeddingBenchmarkResult {
  return {
    provider,
    model: 'N/A',
    testName: 'embeddings',
    iterations: 0,
    latencies: [],
    p50: 0,
    p95: 0,
    mean: 0,
    dimension: 0,
    errors: 0,
  };
}

// ============================================================================
// Report Generation
// ============================================================================

function generateReport(
  chatResults: BenchmarkResult[],
  embeddingResults: EmbeddingBenchmarkResult[]
): string {
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('           AI POC BENCHMARK REPORT - Story 1.5');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`Date: ${new Date().toISOString()}`);
  lines.push(`Iterations per test: ${BENCHMARK_CONFIG.iterations}`);
  lines.push('');
  
  // Chat Completion Results
  lines.push('┌─────────────────────────────────────────────────────────────────┐');
  lines.push('│                    CHAT COMPLETION RESULTS                       │');
  lines.push('├─────────────────────────────────────────────────────────────────┤');
  
  for (const result of chatResults) {
    if (result.iterations === 0) continue;
    
    lines.push(`│ Provider: ${result.provider.padEnd(15)} Model: ${result.model.padEnd(20)}│`);
    lines.push(`│ Test: ${result.testName.padEnd(58)}│`);
    lines.push('│                                                                 │');
    lines.push(`│   Latency (ms):                                                 │`);
    lines.push(`│     p50: ${result.p50.toFixed(0).padStart(6)}   p95: ${result.p95.toFixed(0).padStart(6)}   p99: ${result.p99.toFixed(0).padStart(6)}             │`);
    lines.push(`│     mean: ${result.mean.toFixed(0).padStart(5)}   min: ${result.min.toFixed(0).padStart(5)}   max: ${result.max.toFixed(0).padStart(6)}             │`);
    lines.push('│                                                                 │');
    lines.push(`│   Tokens (avg): prompt=${result.tokensUsed.prompt}, completion=${result.tokensUsed.completion}, total=${result.tokensUsed.total}`.padEnd(66) + '│');
    lines.push(`│   Est. Cost/Request: $${result.estimatedCostPerRequest.toFixed(6)}                              │`);
    lines.push(`│   Errors: ${result.errors}/${result.iterations}                                                  │`);
    lines.push('├─────────────────────────────────────────────────────────────────┤');
  }
  
  // Embedding Results
  lines.push('│                    EMBEDDING RESULTS                              │');
  lines.push('├─────────────────────────────────────────────────────────────────┤');
  
  for (const result of embeddingResults) {
    if (result.iterations === 0) continue;
    
    lines.push(`│ Provider: ${result.provider.padEnd(15)} Model: ${result.model.padEnd(20)}│`);
    lines.push(`│ Dimension: ${result.dimension}                                                  │`);
    lines.push('│                                                                 │');
    lines.push(`│   Latency (ms):                                                 │`);
    lines.push(`│     p50: ${result.p50.toFixed(0).padStart(6)}   p95: ${result.p95.toFixed(0).padStart(6)}   mean: ${result.mean.toFixed(0).padStart(6)}              │`);
    lines.push(`│   Errors: ${result.errors}/${result.iterations}                                                  │`);
    lines.push('├─────────────────────────────────────────────────────────────────┤');
  }
  
  // Summary & Recommendation
  lines.push('│                    SUMMARY & RECOMMENDATION                       │');
  lines.push('├─────────────────────────────────────────────────────────────────┤');
  
  const geminiChatMedium = chatResults.find(r => r.provider === 'gemini' && r.testName === 'chat-medium');
  const openaiChatMedium = chatResults.find(r => r.provider === 'openai' && r.testName === 'chat-medium');
  
  if (geminiChatMedium && geminiChatMedium.iterations > 0) {
    const meets2sTarget = geminiChatMedium.p95 < 2000;
    lines.push(`│ ✅ Gemini p95 Latency: ${geminiChatMedium.p95.toFixed(0)}ms ${meets2sTarget ? '(MEETS <2s target)' : '(EXCEEDS 2s target)'}`.padEnd(66) + '│');
  }
  
  if (openaiChatMedium && openaiChatMedium.iterations > 0) {
    lines.push(`│ 📊 OpenAI p95 Latency: ${openaiChatMedium.p95.toFixed(0)}ms (for comparison)`.padEnd(66) + '│');
  }
  
  // Cost comparison
  if (geminiChatMedium && geminiChatMedium.iterations > 0 && openaiChatMedium && openaiChatMedium.iterations > 0) {
    const costRatio = openaiChatMedium.estimatedCostPerRequest / geminiChatMedium.estimatedCostPerRequest;
    lines.push(`│ 💰 Cost: Gemini is ${costRatio.toFixed(1)}x cheaper than OpenAI`.padEnd(66) + '│');
  }
  
  lines.push('│                                                                 │');
  lines.push('│ RECOMMENDATION:                                                  │');
  
  if (geminiChatMedium && geminiChatMedium.iterations > 0 && geminiChatMedium.p95 < 2000) {
    lines.push('│ ✅ USE GOOGLE GEMINI as primary AI provider                     │');
    lines.push('│    - Meets <2s p95 latency requirement                          │');
    lines.push('│    - Lower cost per request                                     │');
    lines.push('│    - Keep OpenAI as fallback                                    │');
  } else if (openaiChatMedium && openaiChatMedium.iterations > 0 && openaiChatMedium.p95 < 2000) {
    lines.push('│ ⚠️  USE OPENAI as primary (Gemini not meeting targets)          │');
  } else {
    lines.push('│ ⚠️  Neither provider meets <2s p95 target                       │');
    lines.push('│    Consider: caching, async processing, or different models    │');
  }
  
  lines.push('└─────────────────────────────────────────────────────────────────┘');
  
  return lines.join('\n');
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🚀 Starting AI POC Benchmark (Story 1.5)\n');
  console.log('This benchmark tests Google Gemini and OpenAI providers.');
  console.log('Make sure you have the required API keys in your .env file:\n');
  console.log('  - GOOGLE_GEMINI_API_KEY (required)');
  console.log('  - OPENAI_API_KEY (optional, for comparison)');
  console.log('');
  
  const chatResults: BenchmarkResult[] = [];
  const embeddingResults: EmbeddingBenchmarkResult[] = [];
  
  // Run chat benchmarks for both providers
  for (const provider of ['gemini', 'openai'] as const) {
    for (const promptType of ['short', 'medium', 'long'] as const) {
      const result = await benchmarkChatCompletion(provider, promptType);
      chatResults.push(result);
    }
  }
  
  // Run embedding benchmarks
  for (const provider of ['gemini', 'openai'] as const) {
    const result = await benchmarkEmbeddings(provider);
    embeddingResults.push(result);
  }
  
  // Generate and print report
  console.log('\n');
  const report = generateReport(chatResults, embeddingResults);
  console.log(report);
  
  // Save report to file
  const fs = await import('fs');
  const reportPath = './docs/specs/ai-poc-benchmark-report.md';
  const markdownReport = `# AI POC Benchmark Report\n\n\`\`\`\n${report}\n\`\`\`\n\nGenerated: ${new Date().toISOString()}\n`;
  fs.writeFileSync(reportPath, markdownReport);
  console.log(`\n📄 Report saved to: ${reportPath}`);
}

main().catch(console.error);
