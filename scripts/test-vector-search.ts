/**
 * Test Vector Search Integration
 * PRÉ-10: Vector Search + Embeddings
 * 
 * Usage: npm run test-vector-search
 */

import {
  getQdrantClient,
  ensureCollection,
  generateEmbedding,
  indexDocument,
  searchByText,
  findSimilar,
  getCollectionStats,
  healthCheck,
  VectorDocument,
} from '../src/lib/vector/qdrant-client';

// ============================================================================
// Test Data
// ============================================================================

const testDocuments: VectorDocument[] = [
  {
    id: 'trade-1',
    content: 'Long position on NQ1 futures. Entry at 15500, exit at 15600. Profit of $1000.',
    metadata: {
      type: 'trade',
      symbol: 'NQ1',
      direction: 'LONG',
      profit: 1000,
    },
  },
  {
    id: 'trade-2',
    content: 'Short position on ES1 futures. Entry at 4500, exit at 4400. Profit of $500.',
    metadata: {
      type: 'trade',
      symbol: 'ES1',
      direction: 'SHORT',
      profit: 500,
    },
  },
  {
    id: 'trade-3',
    content: 'Long position on TSLA stock. Entry at 250, exit at 260. Profit of $1000 on 100 shares.',
    metadata: {
      type: 'trade',
      symbol: 'TSLA',
      direction: 'LONG',
      profit: 1000,
    },
  },
  {
    id: 'trade-4',
    content: 'Short position on NQ1 futures. Entry at 15800, exit at 15900. Loss of $1000.',
    metadata: {
      type: 'trade',
      symbol: 'NQ1',
      direction: 'SHORT',
      profit: -1000,
    },
  },
  {
    id: 'analysis-1',
    content: 'Daily bias for NQ1: BULLISH. Strong uptrend with support at 15400. High confidence.',
    metadata: {
      type: 'daily_bias',
      instrument: 'NQ1',
      bias: 'BULLISH',
      confidence: 85,
    },
  },
];

// ============================================================================
// Test Functions
// ============================================================================

async function testHealthCheck() {
  console.log('\n🔍 Test 1: Health Check');
  console.log('─'.repeat(50));

  const isHealthy = await healthCheck();
  console.log(`Qdrant Health: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);

  if (!isHealthy) {
    throw new Error('Qdrant is not healthy. Please check your configuration.');
  }
}

async function testCollectionCreation() {
  console.log('\n📦 Test 2: Collection Creation');
  console.log('─'.repeat(50));

  const collectionName = 'test_trading_knowledge';

  await ensureCollection(collectionName, 1536, 'Cosine');
  console.log(`✅ Collection created: ${collectionName}`);

  const stats = await getCollectionStats(collectionName);
  console.log(`📊 Stats:`, stats);
}

async function testEmbeddingGeneration() {
  console.log('\n🔤 Test 3: Embedding Generation');
  console.log('─'.repeat(50));

  const text = 'Long position on NQ1 futures at 15500';
  console.log(`Input text: "${text}"`);

  const embedding = await generateEmbedding(text);
  console.log(`✅ Embedding generated: ${embedding.length} dimensions`);
  console.log(`First 10 values:`, embedding.slice(0, 10).map((v) => v.toFixed(4)));
}

async function testDocumentIndexing() {
  console.log('\n📝 Test 4: Document Indexing');
  console.log('─'.repeat(50));

  const collectionName = 'test_trading_knowledge';

  for (const doc of testDocuments) {
    console.log(`Indexing: ${doc.id}...`);
    await indexDocument(doc, collectionName);
  }

  console.log(`✅ Indexed ${testDocuments.length} documents`);

  const stats = await getCollectionStats(collectionName);
  console.log(`📊 Collection now has ${stats.pointsCount} documents`);
}

async function testSemanticSearch() {
  console.log('\n🔍 Test 5: Semantic Search');
  console.log('─'.repeat(50));

  const collectionName = 'test_trading_knowledge';

  const testQueries = [
    'profitable NQ1 trades',
    'short positions',
    'TSLA stock trades',
    'bullish market analysis',
  ];

  for (const query of testQueries) {
    console.log(`\n📝 Query: "${query}"`);
    const results = await searchByText(query, 3, undefined, collectionName);

    console.log(`   Found ${results.length} results:`);
    results.forEach((result, index) => {
      console.log(
        `   ${index + 1}. [Score: ${(result.score * 100).toFixed(1)}%] ${result.id}`
      );
      console.log(`      ${result.content.substring(0, 80)}...`);
    });
  }
}

async function testSimilaritySearch() {
  console.log('\n🔗 Test 6: Similarity Search');
  console.log('─'.repeat(50));

  const collectionName = 'test_trading_knowledge';
  const referenceDocId = 'trade-1';

  console.log(`Finding documents similar to: ${referenceDocId}`);

  const results = await findSimilar(referenceDocId, 3, collectionName);

  console.log(`Found ${results.length} similar documents:`);
  results.forEach((result, index) => {
    console.log(
      `${index + 1}. [Score: ${(result.score * 100).toFixed(1)}%] ${result.id}`
    );
    console.log(`   ${result.content.substring(0, 80)}...`);
  });
}

async function testFilteredSearch() {
  console.log('\n🔎 Test 7: Filtered Search');
  console.log('─'.repeat(50));

  const collectionName = 'test_trading_knowledge';

  console.log('Query: "trading position" with filter: type=trade');

  const results = await searchByText(
    'trading position',
    5,
    {
      must: [
        {
          key: 'type',
          match: {
            value: 'trade',
          },
        },
      ],
    },
    collectionName
  );

  console.log(`Found ${results.length} results (filtered):`);
  results.forEach((result, index) => {
    console.log(
      `${index + 1}. [Score: ${(result.score * 100).toFixed(1)}%] ${result.id}`
    );
    console.log(`   Type: ${result.metadata.type}, Symbol: ${result.metadata.symbol}`);
  });
}

async function testPerformance() {
  console.log('\n⚡ Test 8: Performance Benchmark');
  console.log('─'.repeat(50));

  const collectionName = 'test_trading_knowledge';

  // Test search latency
  const queries = [
    'profitable trades',
    'short positions',
    'market analysis',
    'futures trading',
    'stock positions',
  ];

  const latencies: number[] = [];

  for (const query of queries) {
    const startTime = Date.now();
    await searchByText(query, 5, undefined, collectionName);
    const latency = Date.now() - startTime;
    latencies.push(latency);
    console.log(`Query: "${query}" - ${latency}ms`);
  }

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

  console.log(`\n📊 Performance Stats:`);
  console.log(`   Average latency: ${avgLatency.toFixed(0)}ms`);
  console.log(`   p95 latency: ${p95Latency}ms`);
  console.log(`   ${avgLatency < 100 ? '✅ PASS' : '❌ FAIL'} (target: <100ms avg)`);
}

async function cleanup() {
  console.log('\n🧹 Test 9: Cleanup');
  console.log('─'.repeat(50));

  const collectionName = 'test_trading_knowledge';

  try {
    const client = getQdrantClient();
    await client.deleteCollection(collectionName);
    console.log(`✅ Collection deleted: ${collectionName}`);
  } catch (error) {
    console.log('⚠️  Cleanup skipped (collection may not exist)');
  }
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runAllTests() {
  console.log('\n' + '='.repeat(50));
  console.log('🧪 Qdrant Vector Search Integration Tests');
  console.log('PRÉ-10: Vector Search + Embeddings');
  console.log('='.repeat(50));

  try {
    await testHealthCheck();
    await testCollectionCreation();
    await testEmbeddingGeneration();
    await testDocumentIndexing();
    await testSemanticSearch();
    await testSimilaritySearch();
    await testFilteredSearch();
    await testPerformance();
    await cleanup();

    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(50));
  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('❌ TEST FAILED');
    console.error('='.repeat(50));
    console.error(error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('\n✅ Test script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test script failed:', error);
      process.exit(1);
    });
}

export { runAllTests };
