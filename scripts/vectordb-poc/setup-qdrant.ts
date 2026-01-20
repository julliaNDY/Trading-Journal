/**
 * Qdrant Vector DB Setup Script
 * 
 * This script sets up a Qdrant collection for storing trade embeddings.
 * 
 * Prerequisites:
 *   - Qdrant running locally: docker run -p 6333:6333 qdrant/qdrant
 *   - Or use Qdrant Cloud: https://cloud.qdrant.io
 * 
 * Usage:
 *   npx tsx scripts/vectordb-poc/setup-qdrant.ts
 * 
 * Environment variables:
 *   - QDRANT_URL: Qdrant server URL (default: http://localhost:6333)
 *   - QDRANT_API_KEY: Qdrant API key (optional for local, required for cloud)
 */

import { config } from 'dotenv'

config({ path: '.env.local' })

// Qdrant configuration
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333'
const QDRANT_API_KEY = process.env.QDRANT_API_KEY

// Collection configuration
const COLLECTION_NAME = 'trade_embeddings'
// Vector size depends on embedding model:
// - OpenAI text-embedding-3-small: 1536
// - Google Gemini text-embedding-004: 768
const VECTOR_SIZE = parseInt(process.env.VECTOR_SIZE || '768') // Default to Gemini (768)

interface QdrantCollection {
  name: string
  vectors_count: number
  points_count: number
}

interface QdrantResponse<T> {
  result: T
  status: string
  time: number
}

/**
 * Make a request to Qdrant API
 */
async function qdrantRequest<T>(
  method: string,
  path: string,
  body?: object
): Promise<QdrantResponse<T>> {
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
 * Check Qdrant connection
 */
async function checkConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${QDRANT_URL}/`, {
      headers: QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {},
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * List existing collections
 */
async function listCollections(): Promise<string[]> {
  const response = await qdrantRequest<{ collections: { name: string }[] }>(
    'GET',
    '/collections'
  )
  return response.result.collections.map((c) => c.name)
}

/**
 * Create trade_embeddings collection
 */
async function createCollection(): Promise<void> {
  console.log(`\n📦 Creating collection "${COLLECTION_NAME}"...`)

  await qdrantRequest('PUT', `/collections/${COLLECTION_NAME}`, {
    vectors: {
      size: VECTOR_SIZE,
      distance: 'Cosine', // Best for semantic similarity
    },
    optimizers_config: {
      default_segment_number: 2,
    },
    replication_factor: 1,
  })

  console.log(`   ✅ Collection created with vector size ${VECTOR_SIZE}`)
}

/**
 * Create payload indexes for filtering
 */
async function createPayloadIndexes(): Promise<void> {
  console.log('\n🔍 Creating payload indexes...')

  const indexes = [
    { field: 'user_id', type: 'keyword' },
    { field: 'trade_id', type: 'keyword' },
    { field: 'symbol', type: 'keyword' },
    { field: 'direction', type: 'keyword' },
    { field: 'pnl', type: 'float' },
    { field: 'created_at', type: 'datetime' },
  ]

  for (const index of indexes) {
    try {
      await qdrantRequest(
        'PUT',
        `/collections/${COLLECTION_NAME}/index`,
        {
          field_name: index.field,
          field_schema: index.type,
        }
      )
      console.log(`   ✅ Index created: ${index.field} (${index.type})`)
    } catch (error) {
      console.log(`   ⚠️  Index ${index.field} may already exist`)
    }
  }
}

/**
 * Get collection info
 */
async function getCollectionInfo(): Promise<void> {
  console.log('\n📊 Collection Info:')

  const response = await qdrantRequest<{
    status: string
    vectors_count: number
    points_count: number
    config: {
      params: {
        vectors: {
          size: number
          distance: string
        }
      }
    }
  }>('GET', `/collections/${COLLECTION_NAME}`)

  const info = response.result
  console.log(`   Status: ${info.status}`)
  console.log(`   Vectors: ${info.vectors_count}`)
  console.log(`   Points: ${info.points_count}`)
  console.log(`   Vector size: ${info.config.params.vectors.size}`)
  console.log(`   Distance: ${info.config.params.vectors.distance}`)
}

async function main() {
  console.log('='.repeat(60))
  console.log('Qdrant Vector DB Setup - POC')
  console.log('='.repeat(60))

  console.log(`\n🔗 Qdrant URL: ${QDRANT_URL}`)
  console.log(`   API Key: ${QDRANT_API_KEY ? '***' : 'Not set (local mode)'}`)

  // Check connection
  console.log('\n🔌 Checking connection...')
  const connected = await checkConnection()

  if (!connected) {
    console.error('\n❌ Cannot connect to Qdrant!')
    console.error('\nTo run Qdrant locally with Docker:')
    console.error('   docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant')
    console.error('\nOr set QDRANT_URL to your Qdrant Cloud instance.')
    process.exit(1)
  }

  console.log('   ✅ Connected to Qdrant')

  // List existing collections
  const collections = await listCollections()
  console.log(`\n📋 Existing collections: ${collections.length > 0 ? collections.join(', ') : 'None'}`)

  // Check if collection exists
  if (collections.includes(COLLECTION_NAME)) {
    console.log(`\n⚠️  Collection "${COLLECTION_NAME}" already exists.`)
    const recreate = process.argv.includes('--recreate')
    
    if (recreate) {
      console.log('   Recreating collection (--recreate flag)...')
      await qdrantRequest('DELETE', `/collections/${COLLECTION_NAME}`)
      await createCollection()
      await createPayloadIndexes()
    } else {
      console.log('   Skipping creation. Use --recreate to recreate.')
    }
  } else {
    await createCollection()
    await createPayloadIndexes()
  }

  // Get collection info
  await getCollectionInfo()

  console.log('\n✅ Setup complete!')
  console.log('\nNext steps:')
  console.log('   1. Generate embeddings: npx tsx scripts/vectordb-poc/embeddings-pipeline.ts')
  console.log('   2. Run benchmark: npx tsx scripts/vectordb-poc/benchmark.ts')
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message)
  process.exit(1)
})
