/**
 * Check Qdrant Status
 * 
 * Vérifie l'état des collections (embeddings) et des backups (snapshots).
 * 
 * Usage:
 *   npx tsx scripts/vectordb/check-status.ts
 */

import { config } from 'dotenv';
import https from 'https';
import http from 'http';

config({ path: '.env.local' });
config({ path: '.env' });

// ============================================================================
// Configuration
// ============================================================================

const QDRANT_URL = process.env.QDRANT_URL!;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY!;

const COLLECTIONS = ['trades', 'playbooks', 'journal_entries', 'coach_history'];

// ============================================================================
// Helper Functions
// ============================================================================

function makeJsonRequest(url: string, headers: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers,
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
          reject(new Error(`Invalid JSON: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// ============================================================================
// Status Check
// ============================================================================

async function checkCollectionStatus(collectionName: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (QDRANT_API_KEY) {
    headers['api-key'] = QDRANT_API_KEY;
  }

  const url = `${QDRANT_URL}/collections/${collectionName}`;
  
  try {
    const info = await makeJsonRequest(url, headers);
    return {
      name: collectionName,
      exists: true,
      pointsCount: info.result?.points_count || 0,
      vectorsCount: info.result?.vectors_count || 0,
      indexedVectorsCount: info.result?.indexed_vectors_count || 0,
      config: info.result?.config,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      return {
        name: collectionName,
        exists: false,
        pointsCount: 0,
        error: 'Collection not found',
      };
    }
    return {
      name: collectionName,
      exists: false,
      pointsCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkSnapshots(collectionName: string) {
  const headers: Record<string, string> = {};
  if (QDRANT_API_KEY) {
    headers['api-key'] = QDRANT_API_KEY;
  }

  const url = `${QDRANT_URL}/collections/${collectionName}/snapshots`;
  
  try {
    const response = await makeJsonRequest(url, headers);
    // Qdrant returns { result: { snapshots: [...] } } or { result: [...] }
    const snapshots = response.result?.snapshots || response.result || [];
    
    return snapshots.map((snapshot: any) => ({
      name: snapshot.name,
      size: snapshot.size,
      creationTime: snapshot.creation_time || snapshot.creationTime,
    }));
  } catch (error) {
    // If collection doesn't exist, return empty array
    if (error instanceof Error && error.message.includes('404')) {
      return [];
    }
    // Log other errors but continue
    console.error(`      ⚠️  Error checking snapshots for ${collectionName}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('🔍 Qdrant Status Check');
  console.log('='.repeat(70));
  console.log(`\n📡 QDRANT_URL: ${QDRANT_URL}`);
  console.log(`🔑 API Key: ${QDRANT_API_KEY ? '✅ Configured' : '❌ Missing'}\n`);

  // Check collections
  console.log('📦 Collections Status:');
  console.log('-'.repeat(70));

  const collectionStats = [];
  let totalPoints = 0;

  for (const collection of COLLECTIONS) {
    const status = await checkCollectionStatus(collection);
    collectionStats.push(status);
    totalPoints += status.pointsCount || 0;

    const statusIcon = status.exists ? '✅' : '❌';
    const pointsInfo = status.exists 
      ? `${status.pointsCount.toLocaleString()} points`
      : (status.error || 'Not found');

    console.log(`   ${statusIcon} ${collection.padEnd(20)} ${pointsInfo}`);
  }

  console.log('-'.repeat(70));
  console.log(`   📊 Total embeddings: ${totalPoints.toLocaleString()} points\n`);

  // Check snapshots
  console.log('💾 Snapshots Status:');
  console.log('-'.repeat(70));

  for (const collection of COLLECTIONS) {
    const snapshots = await checkSnapshots(collection);
    
    if (snapshots.length === 0) {
      console.log(`   ⚠️  ${collection.padEnd(20)} No snapshots`);
    } else {
      console.log(`   ✅ ${collection.padEnd(20)} ${snapshots.length} snapshot(s)`);
      
      // Show latest snapshot
      const latest = snapshots.sort((a: any, b: any) => 
        new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime()
      )[0];
      
      const date = new Date(latest.creationTime);
      const sizeMB = (latest.size / 1024 / 1024).toFixed(2);
      console.log(`      └─ Latest: ${latest.name} (${sizeMB} MB) - ${date.toLocaleString()}`);
    }
  }

  console.log('-'.repeat(70));

  // Summary
  console.log('\n📋 Summary:');
  console.log('='.repeat(70));
  
  const collectionsExist = collectionStats.filter(c => c.exists).length;
  const collectionsWithData = collectionStats.filter(c => c.exists && c.pointsCount > 0).length;
  const totalSnapshots = (await Promise.all(COLLECTIONS.map(c => checkSnapshots(c)))).flat().length;

  console.log(`   Collections:      ${collectionsExist}/${COLLECTIONS.length} exist`);
  console.log(`   With embeddings:  ${collectionsWithData}/${COLLECTIONS.length} have data`);
  console.log(`   Total embeddings: ${totalPoints.toLocaleString()}`);
  console.log(`   Snapshots:        ${totalSnapshots} total`);

  // Status indicators
  console.log('\n✅ Status:');
  const step2Status = totalPoints > 0 ? '✅ COMPLETE' : '⏭️  PENDING';
  const step3Status = totalSnapshots >= COLLECTIONS.length ? '✅ COMPLETE' : '⏭️  PENDING';
  
  console.log(`   Étape 2 (Embeddings):     ${step2Status}`);
  console.log(`   Étape 3 (Backups):        ${step3Status}`);

  if (step2Status === '✅ COMPLETE' && step3Status === '✅ COMPLETE') {
    console.log('\n🎉 Toutes les étapes sont complètes!');
  } else {
    console.log('\n⚠️  Actions nécessaires:');
    if (step2Status === '⏭️  PENDING') {
      console.log('   - Exécuter: npx tsx scripts/vectordb/generate-all-embeddings.ts');
    }
    if (step3Status === '⏭️  PENDING') {
      console.log('   - Exécuter: npx tsx scripts/vectordb/backup-collections.ts');
    }
  }

  console.log('='.repeat(70));
}

main().catch((error) => {
  console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
