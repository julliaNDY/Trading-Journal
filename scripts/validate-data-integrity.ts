/**
 * Data Integrity Validation Script
 * Story 1.10: Data Migration & Backup Strategy
 *
 * Validates data integrity across all data stores:
 * - Supabase PostgreSQL (main database)
 * - TimescaleDB (tick data)
 * - Qdrant (embeddings)
 *
 * Usage:
 *   npx tsx scripts/validate-data-integrity.ts
 *   npx tsx scripts/validate-data-integrity.ts --verbose
 *   npx tsx scripts/validate-data-integrity.ts --fix  # Attempt to fix issues
 */

import { config } from 'dotenv';
import { join } from 'path';
import { Pool } from 'pg';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

// ============================================================================
// Types
// ============================================================================

interface ValidationResult {
  check: string;
  passed: boolean;
  expected?: number | string;
  actual?: number | string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

interface ValidationReport {
  timestamp: string;
  duration: number;
  passed: boolean;
  results: ValidationResult[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    errors: number;
  };
}

// ============================================================================
// Configuration
// ============================================================================

const VERBOSE = process.argv.includes('--verbose');
const FIX_MODE = process.argv.includes('--fix');

// ============================================================================
// Database Connections
// ============================================================================

function getSupabasePool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not configured');
  return new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
}

function getTimescalePool(): Pool | null {
  const url = process.env.TIMESCALE_DATABASE_URL;
  if (!url) return null;
  return new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
}

// ============================================================================
// Validation Checks
// ============================================================================

async function checkSupabaseConnection(pool: Pool): Promise<ValidationResult> {
  try {
    const result = await pool.query('SELECT 1 as check');
    return {
      check: 'Supabase Connection',
      passed: result.rows[0].check === 1,
      message: 'Supabase PostgreSQL is accessible',
      severity: 'info',
    };
  } catch (error) {
    return {
      check: 'Supabase Connection',
      passed: false,
      message: `Connection failed: ${(error as Error).message}`,
      severity: 'error',
    };
  }
}

async function checkTimescaleConnection(pool: Pool | null): Promise<ValidationResult> {
  if (!pool) {
    return {
      check: 'TimescaleDB Connection',
      passed: true,
      message: 'TimescaleDB not configured (optional)',
      severity: 'info',
    };
  }

  try {
    const result = await pool.query("SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'");
    return {
      check: 'TimescaleDB Connection',
      passed: result.rows.length > 0,
      actual: result.rows[0]?.extversion || 'Not installed',
      message: `TimescaleDB version: ${result.rows[0]?.extversion || 'Not installed'}`,
      severity: result.rows.length > 0 ? 'info' : 'warning',
    };
  } catch (error) {
    return {
      check: 'TimescaleDB Connection',
      passed: false,
      message: `Connection failed: ${(error as Error).message}`,
      severity: 'error',
    };
  }
}

async function checkUserCount(pool: Pool): Promise<ValidationResult> {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM users');
    const count = parseInt(result.rows[0].count);
    return {
      check: 'User Count',
      passed: count >= 0,
      actual: count,
      message: `Found ${count} users`,
      severity: 'info',
    };
  } catch (error) {
    return {
      check: 'User Count',
      passed: false,
      message: `Query failed: ${(error as Error).message}`,
      severity: 'error',
    };
  }
}

async function checkTradeCount(pool: Pool): Promise<ValidationResult> {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM trades');
    const count = parseInt(result.rows[0].count);
    return {
      check: 'Trade Count',
      passed: count >= 0,
      actual: count,
      message: `Found ${count} trades`,
      severity: 'info',
    };
  } catch (error) {
    return {
      check: 'Trade Count',
      passed: false,
      message: `Query failed: ${(error as Error).message}`,
      severity: 'error',
    };
  }
}

async function checkTickDataCount(pool: Pool | null): Promise<ValidationResult> {
  if (!pool) {
    return {
      check: 'Tick Data Count',
      passed: true,
      message: 'TimescaleDB not configured',
      severity: 'info',
    };
  }

  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM tick_data');
    const count = parseInt(result.rows[0].count);
    return {
      check: 'Tick Data Count',
      passed: count >= 0,
      actual: count,
      message: `Found ${count.toLocaleString()} ticks`,
      severity: 'info',
    };
  } catch (error) {
    return {
      check: 'Tick Data Count',
      passed: false,
      message: `Query failed: ${(error as Error).message}`,
      severity: 'error',
    };
  }
}

async function checkForeignKeyConsistency(pool: Pool): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Check trades -> users FK
  try {
    const orphanTrades = await pool.query(`
      SELECT COUNT(*) as count FROM trades t
      LEFT JOIN users u ON t."userId" = u.id
      WHERE u.id IS NULL
    `);
    const count = parseInt(orphanTrades.rows[0].count);
    results.push({
      check: 'Trades -> Users FK',
      passed: count === 0,
      expected: 0,
      actual: count,
      message: count === 0 ? 'All trades have valid users' : `${count} orphan trades found`,
      severity: count === 0 ? 'info' : 'error',
    });
  } catch (error) {
    results.push({
      check: 'Trades -> Users FK',
      passed: false,
      message: `Query failed: ${(error as Error).message}`,
      severity: 'error',
    });
  }

  // Check day_journals -> users FK
  try {
    const orphanJournals = await pool.query(`
      SELECT COUNT(*) as count FROM day_journals dj
      LEFT JOIN users u ON dj."userId" = u.id
      WHERE u.id IS NULL
    `);
    const count = parseInt(orphanJournals.rows[0].count);
    results.push({
      check: 'DayJournals -> Users FK',
      passed: count === 0,
      expected: 0,
      actual: count,
      message: count === 0 ? 'All journals have valid users' : `${count} orphan journals found`,
      severity: count === 0 ? 'info' : 'error',
    });
  } catch (error) {
    results.push({
      check: 'DayJournals -> Users FK',
      passed: false,
      message: `Query failed: ${(error as Error).message}`,
      severity: 'error',
    });
  }

  // Check tags -> users FK
  try {
    const orphanTags = await pool.query(`
      SELECT COUNT(*) as count FROM tags t
      LEFT JOIN users u ON t."userId" = u.id
      WHERE u.id IS NULL
    `);
    const count = parseInt(orphanTags.rows[0].count);
    results.push({
      check: 'Tags -> Users FK',
      passed: count === 0,
      expected: 0,
      actual: count,
      message: count === 0 ? 'All tags have valid users' : `${count} orphan tags found`,
      severity: count === 0 ? 'info' : 'error',
    });
  } catch (error) {
    results.push({
      check: 'Tags -> Users FK',
      passed: false,
      message: `Query failed: ${(error as Error).message}`,
      severity: 'error',
    });
  }

  return results;
}

async function checkTimescaleDBFeatures(pool: Pool | null): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  if (!pool) {
    results.push({
      check: 'TimescaleDB Features',
      passed: true,
      message: 'TimescaleDB not configured',
      severity: 'info',
    });
    return results;
  }

  // Check hypertable
  try {
    const hypertable = await pool.query(`
      SELECT hypertable_name, compression_enabled 
      FROM timescaledb_information.hypertables 
      WHERE hypertable_name = 'tick_data'
    `);
    results.push({
      check: 'Hypertable tick_data',
      passed: hypertable.rows.length > 0,
      message: hypertable.rows.length > 0 
        ? `Hypertable exists, compression: ${hypertable.rows[0].compression_enabled}`
        : 'Hypertable not found',
      severity: hypertable.rows.length > 0 ? 'info' : 'warning',
    });
  } catch (error) {
    results.push({
      check: 'Hypertable tick_data',
      passed: false,
      message: `Query failed: ${(error as Error).message}`,
      severity: 'error',
    });
  }

  // Check continuous aggregates
  try {
    const aggregates = await pool.query(`
      SELECT view_name FROM timescaledb_information.continuous_aggregates
    `);
    const expectedAggregates = ['candle_1m', 'candle_5m', 'candle_15m', 'candle_1h'];
    const foundAggregates = aggregates.rows.map(r => r.view_name);
    const missing = expectedAggregates.filter(a => !foundAggregates.includes(a));
    
    results.push({
      check: 'Continuous Aggregates',
      passed: missing.length === 0,
      expected: expectedAggregates.length,
      actual: foundAggregates.length,
      message: missing.length === 0 
        ? `All ${expectedAggregates.length} aggregates present`
        : `Missing: ${missing.join(', ')}`,
      severity: missing.length === 0 ? 'info' : 'warning',
    });
  } catch (error) {
    results.push({
      check: 'Continuous Aggregates',
      passed: false,
      message: `Query failed: ${(error as Error).message}`,
      severity: 'error',
    });
  }

  // Check compression policy
  try {
    const compression = await pool.query(`
      SELECT * FROM timescaledb_information.jobs 
      WHERE proc_name = 'policy_compression'
    `);
    results.push({
      check: 'Compression Policy',
      passed: compression.rows.length > 0,
      message: compression.rows.length > 0 
        ? 'Compression policy active'
        : 'No compression policy found',
      severity: compression.rows.length > 0 ? 'info' : 'warning',
    });
  } catch (error) {
    results.push({
      check: 'Compression Policy',
      passed: false,
      message: `Query failed: ${(error as Error).message}`,
      severity: 'error',
    });
  }

  return results;
}

async function checkQdrantEmbeddings(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  
  const qdrantUrl = process.env.QDRANT_URL;
  const qdrantApiKey = process.env.QDRANT_API_KEY;

  if (!qdrantUrl) {
    results.push({
      check: 'Qdrant Connection',
      passed: true,
      message: 'Qdrant not configured',
      severity: 'info',
    });
    return results;
  }

  try {
    const response = await fetch(`${qdrantUrl}/collections`, {
      headers: qdrantApiKey ? { 'api-key': qdrantApiKey } : {},
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as { result: { collections: Array<{ name: string }> } };
    const collections = data.result.collections.map(c => c.name);
    const expectedCollections = ['trades', 'playbooks', 'journal_entries', 'coach_history'];
    const missing = expectedCollections.filter(c => !collections.includes(c));

    results.push({
      check: 'Qdrant Collections',
      passed: missing.length === 0,
      expected: expectedCollections.length,
      actual: collections.length,
      message: missing.length === 0 
        ? `All ${expectedCollections.length} collections present`
        : `Missing: ${missing.join(', ')}`,
      severity: missing.length === 0 ? 'info' : 'warning',
    });

    // Check each collection's point count
    for (const collection of expectedCollections) {
      if (collections.includes(collection)) {
        try {
          const infoResponse = await fetch(`${qdrantUrl}/collections/${collection}`, {
            headers: qdrantApiKey ? { 'api-key': qdrantApiKey } : {},
          });
          const infoData = await infoResponse.json() as { result: { points_count: number } };
          const pointCount = infoData.result.points_count;
          
          results.push({
            check: `Qdrant ${collection} Points`,
            passed: true,
            actual: pointCount,
            message: `${pointCount.toLocaleString()} embeddings`,
            severity: 'info',
          });
        } catch {
          // Skip if can't get info
        }
      }
    }
  } catch (error) {
    results.push({
      check: 'Qdrant Connection',
      passed: false,
      message: `Connection failed: ${(error as Error).message}`,
      severity: 'error',
    });
  }

  return results;
}

async function checkRedisConnection(): Promise<ValidationResult> {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    return {
      check: 'Redis Connection',
      passed: true,
      message: 'Redis not configured',
      severity: 'info',
    };
  }

  try {
    // Use REST API if available
    const restUrl = process.env.UPSTASH_REDIS_REST_URL;
    const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (restUrl && restToken) {
      const response = await fetch(`${restUrl}/ping`, {
        headers: { 'Authorization': `Bearer ${restToken}` },
      });
      const data = await response.json() as { result: string };
      
      return {
        check: 'Redis Connection',
        passed: data.result === 'PONG',
        message: data.result === 'PONG' ? 'Redis is accessible' : 'Unexpected response',
        severity: data.result === 'PONG' ? 'info' : 'error',
      };
    }

    return {
      check: 'Redis Connection',
      passed: true,
      message: 'Redis URL configured (not tested)',
      severity: 'info',
    };
  } catch (error) {
    return {
      check: 'Redis Connection',
      passed: false,
      message: `Connection failed: ${(error as Error).message}`,
      severity: 'error',
    };
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Data Integrity Validation');
  console.log('   Story 1.10: Data Migration & Backup Strategy');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const startTime = Date.now();
  const results: ValidationResult[] = [];

  // Initialize pools
  const supabasePool = getSupabasePool();
  const timescalePool = getTimescalePool();

  try {
    // Connection checks
    console.log('🔌 Checking connections...');
    results.push(await checkSupabaseConnection(supabasePool));
    results.push(await checkTimescaleConnection(timescalePool));
    results.push(await checkRedisConnection());

    // Data counts
    console.log('📊 Checking data counts...');
    results.push(await checkUserCount(supabasePool));
    results.push(await checkTradeCount(supabasePool));
    results.push(await checkTickDataCount(timescalePool));

    // Foreign key consistency
    console.log('🔗 Checking foreign key consistency...');
    results.push(...await checkForeignKeyConsistency(supabasePool));

    // TimescaleDB features
    console.log('⏱️  Checking TimescaleDB features...');
    results.push(...await checkTimescaleDBFeatures(timescalePool));

    // Qdrant embeddings
    console.log('🧠 Checking Qdrant embeddings...');
    results.push(...await checkQdrantEmbeddings());

  } finally {
    await supabasePool.end();
    if (timescalePool) await timescalePool.end();
  }

  // Generate report
  const duration = Date.now() - startTime;
  const summary = {
    total: results.length,
    passed: results.filter(r => r.passed).length,
    warnings: results.filter(r => r.severity === 'warning').length,
    errors: results.filter(r => r.severity === 'error').length,
  };

  const report: ValidationReport = {
    timestamp: new Date().toISOString(),
    duration,
    passed: summary.errors === 0,
    results,
    summary,
  };

  // Print results
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Results');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  for (const result of results) {
    const icon = result.passed 
      ? (result.severity === 'warning' ? '⚠️' : '✅')
      : '❌';
    const extra = result.actual !== undefined ? ` (${result.actual})` : '';
    console.log(`   ${icon} ${result.check}: ${result.message}${extra}`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Summary');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Total checks:  ${summary.total}`);
  console.log(`   Passed:        ${summary.passed}`);
  console.log(`   Warnings:      ${summary.warnings}`);
  console.log(`   Errors:        ${summary.errors}`);
  console.log(`   Duration:      ${duration}ms`);
  console.log('');

  if (report.passed) {
    console.log('🎉 All critical checks passed!');
  } else {
    console.log('❌ Some checks failed. Review the results above.');
    process.exit(1);
  }
}

main().catch(console.error);
