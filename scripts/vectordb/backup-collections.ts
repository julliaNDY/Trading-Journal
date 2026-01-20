/**
 * Qdrant Collections Backup Script
 * 
 * Creates snapshots for all collections and optionally downloads them.
 * 
 * Usage:
 *   npx tsx scripts/vectordb/backup-collections.ts                    # Create snapshots
 *   npx tsx scripts/vectordb/backup-collections.ts --download          # Create + download
 *   npx tsx scripts/vectordb/backup-collections.ts --cleanup           # Delete old snapshots (keep last 7 days)
 */

import { config } from 'dotenv';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import https from 'https';
import http from 'http';

config({ path: '.env.local' });
config({ path: '.env' });

// ============================================================================
// Configuration
// ============================================================================

const QDRANT_URL = process.env.QDRANT_URL!;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY!;
const BACKUP_DIR = process.env.BACKUP_DIR || 'backups/qdrant';
const SNAPSHOT_RETENTION_DAYS = 7;

const COLLECTIONS = ['trades', 'playbooks', 'journal_entries', 'coach_history'];

// ============================================================================
// Helper Functions
// ============================================================================

function makeJsonRequest(url: string, options: { method: string; headers: Record<string, string>; body?: string }): Promise<any> {
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

function makeBinaryRequest(url: string, options: { method: string; headers: Record<string, string> }): Promise<Buffer> {
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

    const chunks: Buffer[] = [];
    const req = client.request(requestOptions, (res) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      } else {
        reject(new Error(`HTTP ${res.statusCode}`));
      }
    });

    req.on('error', reject);
    req.end();
  });
}

// ============================================================================
// Backup Functions
// ============================================================================

async function createSnapshot(collection: string): Promise<string> {
  console.log(`   📸 Creating snapshot for "${collection}"...`);
  
  const url = `${QDRANT_URL}/collections/${collection}/snapshots`;
  const result = await makeJsonRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': QDRANT_API_KEY,
    },
  });
  
  const snapshotName = result.result.name;
  console.log(`      ✅ Snapshot created: ${snapshotName}`);
  
  return snapshotName;
}

async function downloadSnapshot(
  collection: string,
  snapshotName: string,
  outputPath: string
): Promise<void> {
  const url = `${QDRANT_URL}/collections/${collection}/snapshots/${snapshotName}`;
  
  console.log(`   ⬇️  Downloading snapshot "${snapshotName}"...`);
  
  const data = await makeBinaryRequest(url, {
    method: 'GET',
    headers: {
      'api-key': QDRANT_API_KEY,
    },
  });
  
  writeFileSync(outputPath, data);
  const sizeMB = (data.length / (1024 * 1024)).toFixed(2);
  console.log(`      ✅ Downloaded: ${sizeMB} MB -> ${outputPath}`);
}

async function listSnapshots(collection: string): Promise<Array<{ name: string; creation_time: string }>> {
  const url = `${QDRANT_URL}/collections/${collection}/snapshots`;
  const result = await makeJsonRequest(url, {
    method: 'GET',
    headers: {
      'api-key': QDRANT_API_KEY,
    },
  });
  return result.result || [];
}

async function deleteSnapshot(collection: string, snapshotName: string): Promise<void> {
  const url = `${QDRANT_URL}/collections/${collection}/snapshots/${snapshotName}`;
  await makeJsonRequest(url, {
    method: 'DELETE',
    headers: {
      'api-key': QDRANT_API_KEY,
    },
  });
  console.log(`      🗑️  Deleted: ${snapshotName}`);
}

async function cleanupOldSnapshots(collection: string): Promise<number> {
  const snapshots = await listSnapshots(collection);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - SNAPSHOT_RETENTION_DAYS);
  
  let deleted = 0;
  
  for (const snapshot of snapshots) {
    const snapshotDate = new Date(snapshot.creation_time);
    if (snapshotDate < cutoffDate) {
      await deleteSnapshot(collection, snapshot.name);
      deleted++;
    }
  }
  
  return deleted;
}

async function testConnection(): Promise<boolean> {
  try {
    const url = `${QDRANT_URL}/`;
    await makeJsonRequest(url, {
      method: 'GET',
      headers: { 'api-key': QDRANT_API_KEY },
    });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('Qdrant Collections Backup');
  console.log('='.repeat(60));

  const args = process.argv.slice(2);
  const download = args.includes('--download');
  const cleanup = args.includes('--cleanup');

  console.log(`\n🔗 Qdrant URL: ${QDRANT_URL}`);

  // Test connection
  const connected = await testConnection();
  if (!connected) {
    console.error('\n❌ Cannot connect to Qdrant!');
    process.exit(1);
  }
  console.log('   ✅ Connected to Qdrant');

  const timestamp = new Date().toISOString().split('T')[0];
  const backupPath = join(process.cwd(), BACKUP_DIR, timestamp);
  
  if (download && !existsSync(backupPath)) {
    mkdirSync(backupPath, { recursive: true });
  }
  
  const snapshots: Array<{ collection: string; name: string }> = [];

  // Create snapshots
  console.log('\n📸 Creating snapshots...');
  for (const collection of COLLECTIONS) {
    try {
      const snapshotName = await createSnapshot(collection);
      snapshots.push({ collection, name: snapshotName });
    } catch (error) {
      console.error(`   ❌ Failed to create snapshot for ${collection}:`, error instanceof Error ? error.message : String(error));
    }
  }

  // Download snapshots if requested
  if (download && snapshots.length > 0) {
    console.log('\n⬇️  Downloading snapshots...');
    for (const snapshot of snapshots) {
      try {
        const outputPath = join(backupPath, `${snapshot.collection}-${snapshot.name}`);
        await downloadSnapshot(snapshot.collection, snapshot.name, outputPath);
      } catch (error) {
        console.error(`   ❌ Failed to download ${snapshot.name}:`, error instanceof Error ? error.message : String(error));
      }
    }
    console.log(`\n💾 Snapshots saved to: ${backupPath}`);
  }

  // Cleanup old snapshots if requested
  if (cleanup) {
    console.log('\n🧹 Cleaning up old snapshots (keeping last 7 days)...');
    let totalDeleted = 0;
    for (const collection of COLLECTIONS) {
      try {
        const deleted = await cleanupOldSnapshots(collection);
        totalDeleted += deleted;
      } catch (error) {
        console.error(`   ❌ Failed to cleanup ${collection}:`, error instanceof Error ? error.message : String(error));
      }
    }
    console.log(`   ✅ Deleted ${totalDeleted} old snapshots`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ Backup Complete!');
  console.log('='.repeat(60));
  console.log(`\n📊 Created ${snapshots.length} snapshots:`);
  snapshots.forEach(s => console.log(`   - ${s.collection}: ${s.name}`));
  
  if (download) {
    console.log(`\n💾 Downloaded to: ${backupPath}`);
  }
  
  console.log('\n📖 Next steps:');
  console.log('   - Schedule daily backups with cron:');
  console.log(`     0 2 * * * cd ${process.cwd()} && npx tsx scripts/vectordb/backup-collections.ts --cleanup`);
  console.log('   - Or use Vercel Cron: /api/cron/qdrant-backup');
}

main().catch((error) => {
  console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
