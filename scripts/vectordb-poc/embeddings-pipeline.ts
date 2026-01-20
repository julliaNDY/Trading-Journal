/**
 * Embeddings Pipeline Script
 * 
 * This script demonstrates:
 * 1. Generating embeddings from trade data using OpenAI/Gemini
 * 2. Storing embeddings in Qdrant
 * 3. Querying for similar trades
 * 
 * Usage:
 *   npx tsx scripts/vectordb-poc/embeddings-pipeline.ts
 * 
 * Environment variables:
 *   - OPENAI_API_KEY: OpenAI API key (for embeddings)
 *   - GOOGLE_AI_API_KEY: Google Gemini API key (alternative)
 *   - QDRANT_URL: Qdrant server URL (default: http://localhost:6333)
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

// Embedding provider configuration
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

// Sample trade data for POC
interface Trade {
  id: string
  symbol: string
  direction: 'LONG' | 'SHORT'
  entryPrice: number
  exitPrice: number
  pnl: number
  notes: string
  tags: string[]
}

const sampleTrades: Trade[] = [
  {
    id: 'trade-001',
    symbol: 'AAPL',
    direction: 'LONG',
    entryPrice: 150.25,
    exitPrice: 155.50,
    pnl: 525,
    notes: 'Breakout above resistance with strong volume. Perfect execution on the entry.',
    tags: ['breakout', 'volume', 'winner'],
  },
  {
    id: 'trade-002',
    symbol: 'TSLA',
    direction: 'SHORT',
    entryPrice: 245.00,
    exitPrice: 252.00,
    pnl: -700,
    notes: 'Shorted too early before confirmation. Should have waited for the breakdown.',
    tags: ['premature-entry', 'loser', 'lesson'],
  },
  {
    id: 'trade-003',
    symbol: 'NVDA',
    direction: 'LONG',
    entryPrice: 480.00,
    exitPrice: 510.00,
    pnl: 3000,
    notes: 'Strong momentum play after earnings. Held through pullback with conviction.',
    tags: ['momentum', 'earnings', 'winner', 'conviction'],
  },
  {
    id: 'trade-004',
    symbol: 'AMD',
    direction: 'LONG',
    entryPrice: 165.00,
    exitPrice: 162.50,
    pnl: -250,
    notes: 'Bought the dip but it kept dipping. No clear support level.',
    tags: ['dip-buy', 'loser', 'no-plan'],
  },
  {
    id: 'trade-005',
    symbol: 'MSFT',
    direction: 'LONG',
    entryPrice: 380.00,
    exitPrice: 395.00,
    pnl: 1500,
    notes: 'Clean break of consolidation pattern. Textbook setup execution.',
    tags: ['consolidation', 'breakout', 'winner', 'textbook'],
  },
  {
    id: 'trade-006',
    symbol: 'META',
    direction: 'SHORT',
    entryPrice: 350.00,
    exitPrice: 340.00,
    pnl: 1000,
    notes: 'Shorted after failed breakout. Great read on the rejection.',
    tags: ['failed-breakout', 'rejection', 'winner'],
  },
  {
    id: 'trade-007',
    symbol: 'GOOGL',
    direction: 'LONG',
    entryPrice: 140.00,
    exitPrice: 138.00,
    pnl: -200,
    notes: 'FOMO entry without proper setup. Chased the move too late.',
    tags: ['fomo', 'chase', 'loser', 'mistake'],
  },
  {
    id: 'trade-008',
    symbol: 'SPY',
    direction: 'LONG',
    entryPrice: 450.00,
    exitPrice: 455.00,
    pnl: 500,
    notes: 'Trend following trade. Rode the wave with proper risk management.',
    tags: ['trend', 'risk-management', 'winner'],
  },
]

/**
 * Generate embedding using OpenAI
 */
async function generateOpenAIEmbedding(text: string): Promise<number[]> {
  if (!openai) throw new Error('OpenAI client not initialized')
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  
  return response.data[0].embedding
}

/**
 * Generate embedding using Google Gemini
 * Note: Gemini's embedding model may have different dimensions
 */
async function generateGeminiEmbedding(text: string): Promise<number[]> {
  if (!gemini) throw new Error('Gemini client not initialized')
  
  const model = gemini.getGenerativeModel({ model: 'text-embedding-004' })
  const result = await model.embedContent(text)
  
  return result.embedding.values
}

/**
 * Generate embedding using available provider
 * Prefers Gemini (as per roadmap directive) for cost efficiency
 */
async function generateEmbedding(text: string): Promise<{ embedding: number[]; provider: string }> {
  // Try Gemini first (preferred as per roadmap, lower cost)
  if (gemini) {
    const embedding = await generateGeminiEmbedding(text)
    return { embedding, provider: 'gemini' }
  }
  
  // Fallback to OpenAI
  if (openai) {
    const embedding = await generateOpenAIEmbedding(text)
    return { embedding, provider: 'openai' }
  }
  
  throw new Error('No embedding provider configured. Set GOOGLE_AI_API_KEY or OPENAI_API_KEY.')
}

/**
 * Convert trade to text for embedding
 */
function tradeToText(trade: Trade): string {
  return `
Trade: ${trade.symbol} ${trade.direction}
Entry: $${trade.entryPrice.toFixed(2)} | Exit: $${trade.exitPrice.toFixed(2)}
P&L: ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}
Notes: ${trade.notes}
Tags: ${trade.tags.join(', ')}
`.trim()
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
    throw new Error(`Qdrant API error: ${response.status} - ${error}`)
  }
  
  return response.json()
}

/**
 * Insert trade embedding into Qdrant
 */
async function insertTradeEmbedding(
  trade: Trade,
  embedding: number[],
  userId: string = 'demo-user'
): Promise<void> {
  await qdrantRequest('PUT', `/collections/${COLLECTION_NAME}/points`, {
    points: [
      {
        id: trade.id,
        vector: embedding,
        payload: {
          user_id: userId,
          trade_id: trade.id,
          symbol: trade.symbol,
          direction: trade.direction,
          entry_price: trade.entryPrice,
          exit_price: trade.exitPrice,
          pnl: trade.pnl,
          notes: trade.notes,
          tags: trade.tags,
          created_at: new Date().toISOString(),
        },
      },
    ],
  })
}

/**
 * Search for similar trades
 */
async function searchSimilarTrades(
  queryEmbedding: number[],
  limit: number = 5,
  filter?: { symbol?: string; direction?: string }
): Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>> {
  const filterConditions: object[] = []
  
  if (filter?.symbol) {
    filterConditions.push({
      key: 'symbol',
      match: { value: filter.symbol },
    })
  }
  
  if (filter?.direction) {
    filterConditions.push({
      key: 'direction',
      match: { value: filter.direction },
    })
  }
  
  const response = await qdrantRequest<{
    result: Array<{ id: string; score: number; payload: Record<string, unknown> }>
  }>('POST', `/collections/${COLLECTION_NAME}/points/search`, {
    vector: queryEmbedding,
    limit,
    with_payload: true,
    filter: filterConditions.length > 0 ? { must: filterConditions } : undefined,
  })
  
  return response.result
}

async function main() {
  console.log('='.repeat(60))
  console.log('Embeddings Pipeline POC')
  console.log('='.repeat(60))
  
  // Check provider availability
  console.log('\n🔧 Configuration:')
  console.log(`   Qdrant URL: ${QDRANT_URL}`)
  console.log(`   OpenAI: ${OPENAI_API_KEY ? '✅ Available' : '❌ Not configured'}`)
  console.log(`   Gemini: ${GOOGLE_AI_API_KEY ? '✅ Available' : '❌ Not configured'}`)
  
  if (!OPENAI_API_KEY && !GOOGLE_AI_API_KEY) {
    console.error('\n❌ No embedding provider configured!')
    console.error('   Set OPENAI_API_KEY or GOOGLE_AI_API_KEY in .env.local')
    process.exit(1)
  }
  
  // Generate and store embeddings for sample trades
  console.log(`\n📊 Processing ${sampleTrades.length} sample trades...`)
  
  let provider = ''
  const startTime = Date.now()
  
  for (const trade of sampleTrades) {
    const text = tradeToText(trade)
    const { embedding, provider: usedProvider } = await generateEmbedding(text)
    provider = usedProvider
    
    await insertTradeEmbedding(trade, embedding)
    console.log(`   ✅ ${trade.id}: ${trade.symbol} ${trade.direction} (${embedding.length}d)`)
  }
  
  const insertDuration = Date.now() - startTime
  console.log(`\n⏱️  Insert completed in ${insertDuration}ms (${(insertDuration / sampleTrades.length).toFixed(0)}ms/trade)`)
  console.log(`   Provider: ${provider}`)
  
  // Test similarity search
  console.log('\n🔍 Testing similarity search...')
  
  const searchQuery = 'breakout trade with strong momentum and good volume'
  console.log(`   Query: "${searchQuery}"`)
  
  const searchStart = Date.now()
  const { embedding: queryEmbedding } = await generateEmbedding(searchQuery)
  const results = await searchSimilarTrades(queryEmbedding, 3)
  const searchDuration = Date.now() - searchStart
  
  console.log(`\n   Results (in ${searchDuration}ms):`)
  for (const result of results) {
    const payload = result.payload as { symbol: string; direction: string; pnl: number; notes: string }
    console.log(`   ${result.id}: ${payload.symbol} ${payload.direction}`)
    console.log(`      Score: ${(result.score * 100).toFixed(1)}%`)
    console.log(`      P&L: $${payload.pnl}`)
    console.log(`      Notes: ${payload.notes.substring(0, 50)}...`)
  }
  
  // Test filtered search
  console.log('\n🔍 Testing filtered search (LONG trades only)...')
  const filteredResults = await searchSimilarTrades(queryEmbedding, 3, { direction: 'LONG' })
  
  console.log('   Results:')
  for (const result of filteredResults) {
    const payload = result.payload as { symbol: string; direction: string }
    console.log(`   ${result.id}: ${payload.symbol} ${payload.direction} (score: ${(result.score * 100).toFixed(1)}%)`)
  }
  
  console.log('\n✅ Embeddings pipeline POC complete!')
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message)
  process.exit(1)
})
