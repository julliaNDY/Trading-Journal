/**
 * Vector DB Benchmark Script
 * 
 * Tests Qdrant performance for:
 * 1. Embedding generation latency
 * 2. Insert latency
 * 3. Search latency (AC3: < 300ms)
 * 4. Filtered search latency
 * 
 * Usage:
 *   npx tsx scripts/vectordb-poc/benchmark.ts
 * 
 * Environment variables:
 *   - OPENAI_API_KEY: OpenAI API key
 *   - GOOGLE_AI_API_KEY: Google Gemini API key (alternative)
 *   - QDRANT_URL: Qdrant server URL
 *   - QDRANT_API_KEY: Qdrant API key (optional)
 */

import { config } from 'dotenv'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

config({ path: '.env.local' })

// Configuration
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333'
const QDRANT_API_KEY = process.env.QDRANT_API_KEY
const COLLECTION_NAME = 'trade_embeddings'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY

// Initialize clients
let openai: OpenAI | null = null
let gemini: GoogleGenerativeAI | null = null

if (OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY })
}
if (GOOGLE_AI_API_KEY) {
  gemini = new GoogleGenerativeAI(GOOGLE_AI_API_KEY)
}

interface BenchmarkResult {
  name: string
  iterations: number
  minMs: number
  maxMs: number
  avgMs: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
  pass: boolean
  target?: number
}

/**
 * Calculate percentile from sorted array
 */
function percentile(arr: number[], p: number): number {
  const index = Math.ceil((p / 100) * arr.length) - 1
  return arr[Math.max(0, index)]
}

/**
 * Run benchmark and collect statistics
 */
async function runBenchmark(
  name: string,
  fn: () => Promise<void>,
  iterations: number,
  targetMs?: number
): Promise<BenchmarkResult> {
  const durations: number[] = []
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now()
    await fn()
    durations.push(Date.now() - start)
  }
  
  durations.sort((a, b) => a - b)
  
  const sum = durations.reduce((a, b) => a + b, 0)
  
  const result: BenchmarkResult = {
    name,
    iterations,
    minMs: durations[0],
    maxMs: durations[durations.length - 1],
    avgMs: Math.round(sum / iterations),
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    pass: targetMs ? percentile(durations, 95) <= targetMs : true,
    target: targetMs,
  }
  
  return result
}

/**
 * Generate embedding using OpenAI
 */
async function generateOpenAIEmbedding(text: string): Promise<number[]> {
  if (!openai) throw new Error('OpenAI not configured')
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  
  return response.data[0].embedding
}

/**
 * Generate embedding using Gemini
 */
async function generateGeminiEmbedding(text: string): Promise<number[]> {
  if (!gemini) throw new Error('Gemini not configured')
  
  const model = gemini.getGenerativeModel({ model: 'text-embedding-004' })
  const result = await model.embedContent(text)
  
  return result.embedding.values
}

/**
 * Generate embedding with available provider
 * Prefers Gemini (as per roadmap directive)
 */
async function generateEmbedding(text: string): Promise<number[]> {
  // Prefer Gemini (lower cost, as per roadmap)
  if (gemini) {
    return generateGeminiEmbedding(text)
  }
  if (openai) {
    return generateOpenAIEmbedding(text)
  }
  throw new Error('No embedding provider configured')
}

/**
 * Make request to Qdrant API
 */
async function qdrantRequest<T>(method: string, path: string, body?: object): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  if (QDRANT_API_KEY) {
    headers['api-key'] = QDRANT_API_KEY
  }
  
  const response = await fetch(`${QDRANT_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Qdrant error: ${response.status} - ${error}`)
  }
  
  return response.json()
}

/**
 * Check Qdrant connection and collection
 */
async function checkQdrant(): Promise<{ connected: boolean; pointCount: number }> {
  try {
    const response = await qdrantRequest<{
      result: { points_count: number }
    }>('GET', `/collections/${COLLECTION_NAME}`)
    
    return {
      connected: true,
      pointCount: response.result.points_count,
    }
  } catch {
    return { connected: false, pointCount: 0 }
  }
}

/**
 * Search for similar vectors
 */
async function searchVectors(embedding: number[], limit: number = 5): Promise<void> {
  await qdrantRequest('POST', `/collections/${COLLECTION_NAME}/points/search`, {
    vector: embedding,
    limit,
    with_payload: true,
  })
}

/**
 * Search with filter
 */
async function searchVectorsFiltered(
  embedding: number[],
  filter: object,
  limit: number = 5
): Promise<void> {
  await qdrantRequest('POST', `/collections/${COLLECTION_NAME}/points/search`, {
    vector: embedding,
    limit,
    with_payload: true,
    filter,
  })
}

/**
 * Print benchmark result
 */
function printResult(result: BenchmarkResult): void {
  const status = result.pass ? '✅ PASS' : '❌ FAIL'
  const target = result.target ? ` (target: ${result.target}ms)` : ''
  
  console.log(`\n📊 ${result.name}${target}`)
  console.log(`   Iterations: ${result.iterations}`)
  console.log(`   Min: ${result.minMs}ms | Max: ${result.maxMs}ms | Avg: ${result.avgMs}ms`)
  console.log(`   p50: ${result.p50Ms}ms | p95: ${result.p95Ms}ms | p99: ${result.p99Ms}ms`)
  console.log(`   Status: ${status}`)
}

async function main() {
  console.log('='.repeat(60))
  console.log('Vector DB Benchmark - POC')
  console.log('='.repeat(60))
  
  // Check configuration
  console.log('\n🔧 Configuration:')
  console.log(`   Qdrant URL: ${QDRANT_URL}`)
  console.log(`   OpenAI: ${OPENAI_API_KEY ? '✅' : '❌'}`)
  console.log(`   Gemini: ${GOOGLE_AI_API_KEY ? '✅' : '❌'}`)
  
  if (!OPENAI_API_KEY && !GOOGLE_AI_API_KEY) {
    console.error('\n❌ No embedding provider configured!')
    process.exit(1)
  }
  
  // Check Qdrant
  console.log('\n🔌 Checking Qdrant...')
  const qdrantStatus = await checkQdrant()
  
  if (!qdrantStatus.connected) {
    console.error('❌ Cannot connect to Qdrant!')
    console.error('   Run: npx tsx scripts/vectordb-poc/setup-qdrant.ts')
    process.exit(1)
  }
  
  console.log(`   ✅ Connected (${qdrantStatus.pointCount} points in collection)`)
  
  if (qdrantStatus.pointCount === 0) {
    console.error('⚠️  No data in collection!')
    console.error('   Run: npx tsx scripts/vectordb-poc/embeddings-pipeline.ts')
    process.exit(1)
  }
  
  const results: BenchmarkResult[] = []
  
  // Test 1: Embedding generation latency
  console.log('\n🧪 Running benchmarks...')
  
  const testTexts = [
    'Breakout trade with strong volume confirmation',
    'FOMO entry without proper setup',
    'Perfect execution on the pullback',
    'Held through the drawdown with conviction',
    'Cut losses quickly when thesis was invalidated',
  ]
  
  console.log('\n   Test 1: Embedding Generation...')
  let cachedEmbedding: number[] = []
  
  results.push(
    await runBenchmark(
      'Embedding Generation',
      async () => {
        const text = testTexts[Math.floor(Math.random() * testTexts.length)]
        cachedEmbedding = await generateEmbedding(text)
      },
      10,
      1000 // Target: 1s per embedding
    )
  )
  
  // Test 2: Vector search latency (AC3: < 300ms)
  console.log('   Test 2: Vector Search...')
  
  results.push(
    await runBenchmark(
      'Vector Search',
      async () => {
        await searchVectors(cachedEmbedding, 5)
      },
      20,
      300 // AC3: < 300ms
    )
  )
  
  // Test 3: Filtered search latency
  console.log('   Test 3: Filtered Search...')
  
  results.push(
    await runBenchmark(
      'Filtered Search (by direction)',
      async () => {
        await searchVectorsFiltered(
          cachedEmbedding,
          { must: [{ key: 'direction', match: { value: 'LONG' } }] },
          5
        )
      },
      20,
      300
    )
  )
  
  // Test 4: Multi-filter search
  console.log('   Test 4: Multi-filter Search...')
  
  results.push(
    await runBenchmark(
      'Multi-filter Search',
      async () => {
        await searchVectorsFiltered(
          cachedEmbedding,
          {
            must: [
              { key: 'direction', match: { value: 'LONG' } },
              { key: 'pnl', range: { gte: 0 } },
            ],
          },
          5
        )
      },
      20,
      300
    )
  )
  
  // Print results
  console.log('\n' + '='.repeat(60))
  console.log('BENCHMARK RESULTS')
  console.log('='.repeat(60))
  
  for (const result of results) {
    printResult(result)
  }
  
  // Summary
  const allPassed = results.every((r) => r.pass)
  
  console.log('\n' + '='.repeat(60))
  console.log(`SUMMARY: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`)
  console.log('='.repeat(60))
  
  // AC3 validation
  const searchResult = results.find((r) => r.name === 'Vector Search')
  if (searchResult) {
    console.log('\n📋 AC3 Validation (Latency < 300ms):')
    console.log(`   p95 Latency: ${searchResult.p95Ms}ms`)
    console.log(`   Status: ${searchResult.p95Ms < 300 ? '✅ PASS' : '❌ FAIL'}`)
  }
  
  // Exit code
  process.exit(allPassed ? 0 : 1)
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message)
  process.exit(1)
})
