/**
 * Unified Backup Script
 * Story 1.10: Data Migration & Backup Strategy
 *
 * Creates backups for all data stores:
 * - Supabase PostgreSQL (pg_dump)
 * - TimescaleDB (pg_dump)
 * - Qdrant (snapshots)
 *
 * Usage:
 *   npx tsx scripts/backup-all.ts                    # Full backup
 *   npx tsx scripts/backup-all.ts --supabase         # Supabase only
 *   npx tsx scripts/backup-all.ts --timescale        # TimescaleDB only
 *   npx tsx scripts/backup-all.ts --qdrant           # Qdrant only
 *   npx tsx scripts/backup-all.ts --cleanup          # Cleanup old backups
 */

import { config } from 'dotenv';
import { join } from 'path';
import { mkdirSync, existsSync, readdirSync, unlinkSync, statSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';
import http from 'http';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const execAsync = promisify(exec);

// ============================================================================
// Configuration
// ============================================================================

const BACKUP_DIR = process.env.BACKUP_DIR || 'backups';
const RETENTION_DAYS = 30;

const BACKUP_SUPABASE = process.argv.includes('--supabase') || !process.argv.slice(2).some(a => a.startsWith('--') && a !== '--cleanup');
const BACKUP_TIMESCALE = process.argv.includes('--timescale') || !process.argv.slice(2).some(a => a.startsWith('--') && a !== '--cleanup');
const BACKUP_QDRANT = process.argv.includes('--qdrant') || !process.argv.slice(2).some(a => a.startsWith('--') && a !== '--cleanup');
const CLEANUP_ONLY = process.argv.includes('--cleanup');

// ============================================================================
// Helper Functions
// ============================================================================

function getDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function makeRequest(url: string, options: { method: string; headers: Record<string, string> }): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const req = client.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method,
      headers: options.headers,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// ============================================================================
// Backup Functions
// ============================================================================

interface BackupResult {
  store: string;
  success: boolean;
  file?: string;
  size?: number;
  duration: number;
  error?: string;
}

async function backupSupabase(): Promise<BackupResult> {
  const startTime = Date.now();
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return {
      store: 'Supabase',
      success: false,
      duration: Date.now() - startTime,
      error: 'DATABASE_URL not configured',
    };
  }

  const backupDir = join(BACKUP_DIR, 'supabase');
  ensureDir(backupDir);

  const filename = `supabase-${getTimestamp()}.sql`;
  const filepath = join(backupDir, filename);

  try {
    // Use pg_dump
    const command = `pg_dump "${databaseUrl}" --no-owner --no-acl -f "${filepath}"`;
    await execAsync(command, { timeout: 300000 }); // 5 min timeout

    const stats = statSync(filepath);
    
    return {
      store: 'Supabase',
      success: true,
      file: filepath,
      size: stats.size,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      store: 'Supabase',
      success: false,
      duration: Date.now() - startTime,
      error: (error as Error).message,
    };
  }
}

async function backupTimescale(): Promise<BackupResult> {
  const startTime = Date.now();
  const databaseUrl = process.env.TIMESCALE_DATABASE_URL;

  if (!databaseUrl) {
    return {
      store: 'TimescaleDB',
      success: true,
      duration: Date.now() - startTime,
      error: 'TIMESCALE_DATABASE_URL not configured (skipped)',
    };
  }

  const backupDir = join(BACKUP_DIR, 'timescale');
  ensureDir(backupDir);

  const filename = `timescale-${getTimestamp()}.sql`;
  const filepath = join(backupDir, filename);

  try {
    // Use pg_dump with TimescaleDB-specific options
    const command = `pg_dump "${databaseUrl}" --no-owner --no-acl -f "${filepath}"`;
    await execAsync(command, { timeout: 600000 }); // 10 min timeout

    const stats = statSync(filepath);
    
    return {
      store: 'TimescaleDB',
      success: true,
      file: filepath,
      size: stats.size,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      store: 'TimescaleDB',
      success: false,
      duration: Date.now() - startTime,
      error: (error as Error).message,
    };
  }
}

async function backupQdrant(): Promise<BackupResult> {
  const startTime = Date.now();
  const qdrantUrl = process.env.QDRANT_URL;
  const qdrantApiKey = process.env.QDRANT_API_KEY;

  if (!qdrantUrl) {
    return {
      store: 'Qdrant',
      success: true,
      duration: Date.now() - startTime,
      error: 'QDRANT_URL not configured (skipped)',
    };
  }

  const collections = ['trades', 'playbooks', 'journal_entries', 'coach_history'];
  const snapshots: string[] = [];

  try {
    for (const collection of collections) {
      try {
        // Create snapshot
        const response = await makeRequest(
          `${qdrantUrl}/collections/${collection}/snapshots`,
          {
            method: 'POST',
            headers: qdrantApiKey ? { 'api-key': qdrantApiKey } : {},
          }
        );

        if (response.result?.name) {
          snapshots.push(`${collection}:${response.result.name}`);
        }
      } catch (error) {
        console.log(`   ⚠️  Snapshot failed for ${collection}: ${(error as Error).message}`);
      }
    }

    return {
      store: 'Qdrant',
      success: snapshots.length > 0,
      file: snapshots.join(', '),
      duration: Date.now() - startTime,
      error: snapshots.length === 0 ? 'No snapshots created' : undefined,
    };
  } catch (error) {
    return {
      store: 'Qdrant',
      success: false,
      duration: Date.now() - startTime,
      error: (error as Error).message,
    };
  }
}

// ============================================================================
// Cleanup Functions
// ============================================================================

function cleanupOldBackups(dir: string, retentionDays: number): number {
  if (!existsSync(dir)) return 0;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  let deleted = 0;
  const files = readdirSync(dir);

  for (const file of files) {
    const filepath = join(dir, file);
    const stats = statSync(filepath);

    if (stats.isFile() && stats.mtime < cutoffDate) {
      unlinkSync(filepath);
      deleted++;
    }
  }

  return deleted;
}

async function cleanupAllBackups(): Promise<void> {
  console.log('🧹 Cleaning up old backups...');
  console.log(`   Retention: ${RETENTION_DAYS} days`);
  console.log('');

  const dirs = ['supabase', 'timescale', 'qdrant'];
  let totalDeleted = 0;

  for (const dir of dirs) {
    const fullPath = join(BACKUP_DIR, dir);
    const deleted = cleanupOldBackups(fullPath, RETENTION_DAYS);
    if (deleted > 0) {
      console.log(`   ${dir}: ${deleted} files deleted`);
      totalDeleted += deleted;
    }
  }

  if (totalDeleted === 0) {
    console.log('   No old backups to delete');
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Unified Backup Script');
  console.log('   Story 1.10: Data Migration & Backup Strategy');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`📅 Date: ${getDateString()}`);
  console.log(`📁 Backup directory: ${BACKUP_DIR}`);
  console.log('');

  if (CLEANUP_ONLY) {
    await cleanupAllBackups();
    return;
  }

  ensureDir(BACKUP_DIR);

  const results: BackupResult[] = [];

  // Supabase backup
  if (BACKUP_SUPABASE) {
    console.log('📦 Backing up Supabase...');
    const result = await backupSupabase();
    results.push(result);
    if (result.success && result.file) {
      console.log(`   ✅ ${result.file} (${(result.size! / 1024 / 1024).toFixed(2)} MB)`);
    } else {
      console.log(`   ❌ ${result.error}`);
    }
  }

  // TimescaleDB backup
  if (BACKUP_TIMESCALE) {
    console.log('📦 Backing up TimescaleDB...');
    const result = await backupTimescale();
    results.push(result);
    if (result.success && result.file) {
      console.log(`   ✅ ${result.file} (${(result.size! / 1024 / 1024).toFixed(2)} MB)`);
    } else if (result.error?.includes('skipped')) {
      console.log(`   ⏭️  ${result.error}`);
    } else {
      console.log(`   ❌ ${result.error}`);
    }
  }

  // Qdrant backup
  if (BACKUP_QDRANT) {
    console.log('📦 Backing up Qdrant...');
    const result = await backupQdrant();
    results.push(result);
    if (result.success && result.file) {
      console.log(`   ✅ Snapshots: ${result.file}`);
    } else if (result.error?.includes('skipped')) {
      console.log(`   ⏭️  ${result.error}`);
    } else {
      console.log(`   ❌ ${result.error}`);
    }
  }

  // Cleanup old backups
  console.log('');
  await cleanupAllBackups();

  // Summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Summary');
  console.log('═══════════════════════════════════════════════════════════════');

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success && !r.error?.includes('skipped')).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`   Total backups:     ${results.length}`);
  console.log(`   Successful:        ${successful}`);
  console.log(`   Failed:            ${failed}`);
  console.log(`   Total duration:    ${(totalDuration / 1000).toFixed(2)}s`);
  console.log('');

  if (failed > 0) {
    console.log('❌ Some backups failed. Check the errors above.');
    process.exit(1);
  } else {
    console.log('✅ All backups completed successfully!');
  }
}

main().catch(console.error);
