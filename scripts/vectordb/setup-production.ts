/**
 * Qdrant Vector DB Production Setup Script
 * 
 * Creates all production collections with proper indexes.
 * 
 * Usage:
 *   npx tsx scripts/vectordb/setup-production.ts
 *   npx tsx scripts/vectordb/setup-production.ts --recreate  # Recreate all collections
 * 
 * Environment variables:
 *   - QDRANT_URL: Qdrant server URL (required)
 *   - QDRANT_API_KEY: Qdrant API key (required for Qdrant Cloud)
 */

import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

// Must import after loading env
import {
  getQdrantClient,
  isQdrantConfigured,
  COLLECTIONS,
  COLLECTION_CONFIGS,
  createAllCollections,
  recreateCollection,
  getCollectionStats,
  type CollectionName,
} from '../../src/lib/qdrant';

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('Qdrant Vector DB Production Setup');
  console.log('='.repeat(60));

  // Check configuration
  const qdrantUrl = process.env.QDRANT_URL;
  const qdrantApiKey = process.env.QDRANT_API_KEY;

  if (!qdrantUrl) {
    console.error('\n❌ QDRANT_URL environment variable is not set!');
    console.error('\nPlease configure:');
    console.error('  QDRANT_URL=https://your-cluster.qdrant.io:6333');
    console.error('  QDRANT_API_KEY=your-api-key');
    process.exit(1);
  }

  // Create client with explicit config
  const { QdrantClient } = await import('../../src/lib/qdrant');
  const client = new QdrantClient(qdrantUrl, qdrantApiKey);

  console.log(`\n🔗 Qdrant URL: ${qdrantUrl}`);
  console.log(`   API Key: ${qdrantApiKey ? '***configured***' : 'Not set (local mode)'}`);

  // Check connection
  console.log('\n🔌 Checking connection...');
  const healthy = await client.isHealthy();

  if (!healthy) {
    console.error('\n❌ Cannot connect to Qdrant!');
    console.error('\nTroubleshooting:');
    console.error('  1. Check if QDRANT_URL is correct');
    console.error('  2. Check if QDRANT_API_KEY is valid (for Qdrant Cloud)');
    console.error('  3. Check firewall/network settings');
    console.error('\nFor local development:');
    console.error('  docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant');
    process.exit(1);
  }

  // Get version info
  try {
    const info = await client.getInfo();
    console.log(`   ✅ Connected to Qdrant v${info.version}`);
  } catch {
    console.log('   ✅ Connected to Qdrant');
  }

  // Check for --recreate flag
  const recreate = process.argv.includes('--recreate');

  // Get current collections
  const existingCollections = await client.listCollections();
  console.log(`\n📋 Existing collections: ${existingCollections.length > 0 ? existingCollections.join(', ') : 'None'}`);

  // Create or recreate collections
  const collectionNames = Object.values(COLLECTIONS);

  if (recreate) {
    console.log('\n⚠️  Recreating all collections (--recreate flag)...');
    for (const name of collectionNames) {
      console.log(`\n   Recreating ${name}...`);
      await recreateCollection(name as CollectionName);
      console.log(`   ✅ ${name} recreated`);
    }
  } else {
    console.log('\n📦 Creating collections...');
    await createAllCollections();
  }

  // Show collection configurations
  console.log('\n📊 Collection Configurations:');
  console.log('─'.repeat(60));

  for (const [name, config] of Object.entries(COLLECTION_CONFIGS)) {
    console.log(`\n   ${name}:`);
    console.log(`     Vector size: ${config.vectorSize}`);
    console.log(`     Distance: ${config.distance}`);
    console.log(`     Indexes: ${config.payloadIndexes.map(i => i.field).join(', ')}`);
  }

  // Get final stats
  console.log('\n📈 Collection Stats:');
  console.log('─'.repeat(60));

  const stats = await getCollectionStats();
  for (const [name, stat] of Object.entries(stats)) {
    console.log(`   ${name}: ${stat.exists ? `${stat.pointsCount} points` : '❌ Not created'}`);
  }

  console.log('\n✅ Production setup complete!');
  console.log('\n📖 Next steps:');
  console.log('   1. Set QDRANT_URL and QDRANT_API_KEY in production environment');
  console.log('   2. Run embedding pipeline for existing data:');
  console.log('      - Use VectorSearchService.embedUserTrades() for each user');
  console.log('   3. Configure backup snapshots (see Task 5 in story)');
  console.log('\n🔗 API endpoints:');
  console.log('   GET /api/vectordb/health - Check Qdrant health');
  console.log('   GET /api/vectordb/stats  - Get collection stats');
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
