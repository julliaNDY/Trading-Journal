/**
 * Configure Qdrant Cloud Connection
 * 
 * Sets up QDRANT_URL and QDRANT_API_KEY for Qdrant Cloud.
 * Tests connection and creates collections.
 * 
 * Usage:
 *   npx tsx scripts/vectordb/configure-qdrant.ts
 */

import { config } from 'dotenv';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load existing .env.local if it exists
const envLocalPath = join(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
}
config({ path: '.env' });

// Qdrant Cloud configuration
const QDRANT_CLUSTER_ENDPOINT = 'https://40099ca1-43df-4699-9f49-f13b3a16bb48.europe-west3-0.gcp.cloud.qdrant.io';
const QDRANT_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.XeQ06c2VJaVE0g31rkwfVJNhoIvNP6mdzujMNAwf65E';
const QDRANT_URL = `${QDRANT_CLUSTER_ENDPOINT}:6333`;
// GOOGLE_API_KEY is loaded from .env.local - do NOT hardcode API keys
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';

async function main() {
  console.log('='.repeat(60));
  console.log('Qdrant Cloud Configuration');
  console.log('='.repeat(60));

  // Read existing .env.local or create new
  let envContent = '';
  if (existsSync(envLocalPath)) {
    envContent = require('fs').readFileSync(envLocalPath, 'utf-8');
    console.log('\n📄 Found existing .env.local');
  } else {
    console.log('\n📄 Creating new .env.local');
  }

  // Update or add QDRANT_URL
  if (envContent.includes('QDRANT_URL=')) {
    envContent = envContent.replace(/QDRANT_URL=.*/g, `QDRANT_URL="${QDRANT_URL}"`);
    console.log('   ✅ Updated QDRANT_URL');
  } else {
    envContent += `\n# Qdrant Cloud\nQDRANT_URL="${QDRANT_URL}"\n`;
    console.log('   ✅ Added QDRANT_URL');
  }

  // Update or add QDRANT_API_KEY
  if (envContent.includes('QDRANT_API_KEY=')) {
    envContent = envContent.replace(/QDRANT_API_KEY=.*/g, `QDRANT_API_KEY="${QDRANT_API_KEY}"`);
    console.log('   ✅ Updated QDRANT_API_KEY');
  } else {
    envContent += `QDRANT_API_KEY="${QDRANT_API_KEY}"\n`;
    console.log('   ✅ Added QDRANT_API_KEY');
  }

  // Update or add GOOGLE_API_KEY
  if (envContent.includes('GOOGLE_API_KEY=')) {
    envContent = envContent.replace(/GOOGLE_API_KEY=.*/g, `GOOGLE_API_KEY="${GOOGLE_API_KEY}"`);
    console.log('   ✅ Updated GOOGLE_API_KEY');
  } else {
    envContent += `\n# Google Gemini (for embeddings)\nGOOGLE_API_KEY="${GOOGLE_API_KEY}"\n`;
    console.log('   ✅ Added GOOGLE_API_KEY');
  }

  // Write .env.local
  writeFileSync(envLocalPath, envContent.trim() + '\n');
  console.log(`\n💾 Saved to ${envLocalPath}`);

  // Reload environment
  process.env.QDRANT_URL = QDRANT_URL;
  process.env.QDRANT_API_KEY = QDRANT_API_KEY;
  process.env.GOOGLE_API_KEY = GOOGLE_API_KEY;

  // Test connection
  console.log('\n🔌 Testing Qdrant connection...');
  console.log(`   URL: ${QDRANT_URL}`);
  console.log(`   API Key: ${QDRANT_API_KEY.substring(0, 20)}...`);

  try {
    // Import after setting env vars
    const { getQdrantClient } = await import('../../src/lib/qdrant');
    const client = getQdrantClient();

    const healthy = await client.isHealthy();
    if (!healthy) {
      throw new Error('Connection failed');
    }

    const info = await client.getInfo();
    console.log(`   ✅ Connected to Qdrant v${info.version || 'unknown'}`);

    // List existing collections
    const collections = await client.listCollections();
    console.log(`\n📋 Existing collections: ${collections.length > 0 ? collections.join(', ') : 'None'}`);

    // Ask to create collections
    console.log('\n📦 Next step: Create collections');
    console.log('   Run: npx tsx scripts/vectordb/setup-production.ts');

    console.log('\n✅ Configuration complete!');
  } catch (error) {
    console.error('\n❌ Connection test failed:', error instanceof Error ? error.message : String(error));
    console.error('\nTroubleshooting:');
    console.error('  1. Verify QDRANT_CLUSTER_ENDPOINT is correct');
    console.error('  2. Verify QDRANT_API_KEY is valid');
    console.error('  3. Check firewall/network settings');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
