/**
 * Create Qdrant Collections Directly
 * 
 * Uses direct HTTP calls to create collections, bypassing fetch issues
 */

import { config } from 'dotenv';
import https from 'https';
import http from 'http';

config({ path: '.env.local' });
config({ path: '.env' });

const QDRANT_URL = process.env.QDRANT_URL!;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY!;

const COLLECTIONS = {
  trades: {
    vectors: { size: 768, distance: 'Cosine' },
    payloadIndexes: [
      { field: 'user_id', type: 'keyword' },
      { field: 'trade_id', type: 'keyword' },
      { field: 'symbol', type: 'keyword' },
      { field: 'direction', type: 'keyword' },
      { field: 'pnl_positive', type: 'bool' },
      { field: 'closed_at', type: 'datetime' },
    ],
  },
  playbooks: {
    vectors: { size: 768, distance: 'Cosine' },
    payloadIndexes: [
      { field: 'user_id', type: 'keyword' },
      { field: 'playbook_id', type: 'keyword' },
      { field: 'name', type: 'text' },
      { field: 'is_public', type: 'bool' },
    ],
  },
  journal_entries: {
    vectors: { size: 768, distance: 'Cosine' },
    payloadIndexes: [
      { field: 'user_id', type: 'keyword' },
      { field: 'journal_id', type: 'keyword' },
      { field: 'date', type: 'datetime' },
    ],
  },
  coach_history: {
    vectors: { size: 768, distance: 'Cosine' },
    payloadIndexes: [
      { field: 'user_id', type: 'keyword' },
      { field: 'conversation_id', type: 'keyword' },
      { field: 'message_id', type: 'keyword' },
      { field: 'role', type: 'keyword' },
      { field: 'created_at', type: 'datetime' },
    ],
  },
};

function makeRequest(url: string, options: { method: string; headers: Record<string, string>; body?: string }): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method,
      headers: options.headers,
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } catch {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function createCollection(name: string, config: any): Promise<void> {
  console.log(`\n📦 Creating collection "${name}"...`);
  
  const url = `${QDRANT_URL}/collections/${name}`;
  const body = JSON.stringify({
    vectors: config.vectors,
    optimizers_config: {
      default_segment_number: 2,
    },
    replication_factor: 1,
  });

  try {
    await makeRequest(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'api-key': QDRANT_API_KEY,
      },
      body,
    });
    console.log(`   ✅ Collection "${name}" created`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log(`   ⚠️  Collection "${name}" already exists`);
    } else {
      throw error;
    }
  }

  // Create indexes
  for (const index of config.payloadIndexes) {
    try {
      const indexUrl = `${QDRANT_URL}/collections/${name}/index`;
      await makeRequest(indexUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'api-key': QDRANT_API_KEY,
        },
        body: JSON.stringify({
          field_name: index.field,
          field_schema: index.type,
        }),
      });
      console.log(`   ✅ Index created: ${index.field} (${index.type})`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log(`   ⚠️  Index ${index.field} already exists`);
      } else {
        console.log(`   ⚠️  Index ${index.field} creation failed (may already exist)`);
      }
    }
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Qdrant Collections Setup (Direct HTTP)');
  console.log('='.repeat(60));
  console.log(`\n🔗 Qdrant URL: ${QDRANT_URL}`);

  for (const [name, config] of Object.entries(COLLECTIONS)) {
    await createCollection(name, config);
  }

  console.log('\n✅ All collections created!');
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
