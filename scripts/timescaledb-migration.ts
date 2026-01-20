/**
 * TimescaleDB Migration Script
 * Story 1.6: TimescaleDB Production Migration
 *
 * Migrates tick_data from Supabase PostgreSQL to dedicated TimescaleDB instance.
 *
 * Usage:
 *   npx tsx scripts/timescaledb-migration.ts [--dry-run] [--batch-size=10000] [--verify]
 *
 * Prerequisites:
 *   1. TIMESCALE_DATABASE_URL configured in .env
 *   2. TimescaleDB production setup script has been run
 *   3. Both databases accessible from this machine
 */

import * as dotenv from 'dotenv';
import { Pool, PoolClient } from 'pg';
import * as path from 'path';

// Load .env.local first, then .env as fallback
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// =============================================================================
// Configuration
// =============================================================================

interface MigrationConfig {
  dryRun: boolean;
  batchSize: number;
  verify: boolean;
}

interface MigrationStats {
  totalSourceRows: number;
  migratedRows: number;
  skippedRows: number;
  errorRows: number;
  batches: number;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
}

// Parse CLI arguments
function parseArgs(): MigrationConfig {
  const args = process.argv.slice(2);
  const config: MigrationConfig = {
    dryRun: false,
    batchSize: 10000,
    verify: false,
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg === '--verify') {
      config.verify = true;
    } else if (arg.startsWith('--batch-size=')) {
      config.batchSize = parseInt(arg.split('=')[1], 10);
    }
  }

  return config;
}

// =============================================================================
// Database Connections
// =============================================================================

function getSupabasePool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL not configured (Supabase source)');
  }

  return new Pool({
    connectionString: url,
    max: 5,
    ssl: { rejectUnauthorized: false },
  });
}

function getTimescalePool(): Pool {
  const url = process.env.TIMESCALE_DATABASE_URL;
  if (!url) {
    throw new Error('TIMESCALE_DATABASE_URL not configured (TimescaleDB target)');
  }

  return new Pool({
    connectionString: url,
    max: 10,
    ssl: { rejectUnauthorized: false },
  });
}

// =============================================================================
// Migration Logic
// =============================================================================

async function getSourceRowCount(client: PoolClient): Promise<number> {
  const result = await client.query('SELECT COUNT(*) as count FROM tick_data');
  return parseInt(result.rows[0].count, 10);
}

async function getTargetRowCount(client: PoolClient): Promise<number> {
  try {
    const result = await client.query('SELECT COUNT(*) as count FROM tick_data');
    return parseInt(result.rows[0].count, 10);
  } catch {
    return 0;
  }
}

async function migrateData(
  sourcePool: Pool,
  targetPool: Pool,
  config: MigrationConfig
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalSourceRows: 0,
    migratedRows: 0,
    skippedRows: 0,
    errorRows: 0,
    batches: 0,
    startTime: new Date(),
  };

  const sourceClient = await sourcePool.connect();
  const targetClient = await targetPool.connect();

  try {
    // Get total count
    stats.totalSourceRows = await getSourceRowCount(sourceClient);
    console.log(`\n📊 Source database has ${stats.totalSourceRows.toLocaleString()} rows`);

    if (config.dryRun) {
      console.log('\n🔍 DRY RUN MODE - No data will be written\n');
    }

    // Check existing data in target
    const existingRows = await getTargetRowCount(targetClient);
    if (existingRows > 0) {
      console.log(`⚠️  Target already has ${existingRows.toLocaleString()} rows`);
      console.log('   New inserts will skip duplicates (ON CONFLICT DO NOTHING)\n');
    }

    // Migrate in batches using cursor
    let offset = 0;
    const startTime = Date.now();

    while (offset < stats.totalSourceRows) {
      stats.batches++;

      // Fetch batch from source
      const batchResult = await sourceClient.query(
        `SELECT time, symbol, bid_price, ask_price, last_price, volume, source, trade_id, account_id
         FROM tick_data
         ORDER BY time ASC
         LIMIT $1 OFFSET $2`,
        [config.batchSize, offset]
      );

      const rows = batchResult.rows;
      if (rows.length === 0) break;

      if (!config.dryRun) {
        // Build batch insert
        const values: unknown[] = [];
        const placeholders: string[] = [];

        rows.forEach((row, index) => {
          const i = index * 9;
          placeholders.push(
            `($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6}, $${i + 7}, $${i + 8}, $${i + 9})`
          );
          values.push(
            row.time,
            row.symbol,
            row.bid_price,
            row.ask_price,
            row.last_price,
            row.volume,
            row.source,
            row.trade_id,
            row.account_id
          );
        });

        const insertSql = `
          INSERT INTO tick_data (time, symbol, bid_price, ask_price, last_price, volume, source, trade_id, account_id)
          VALUES ${placeholders.join(', ')}
          ON CONFLICT DO NOTHING
        `;

        try {
          const insertResult = await targetClient.query(insertSql, values);
          stats.migratedRows += insertResult.rowCount || 0;
          stats.skippedRows += rows.length - (insertResult.rowCount || 0);
        } catch (error) {
          console.error(`\n❌ Error in batch ${stats.batches}:`, error);
          stats.errorRows += rows.length;
        }
      } else {
        stats.migratedRows += rows.length;
      }

      offset += rows.length;

      // Progress update
      const progress = ((offset / stats.totalSourceRows) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (offset / ((Date.now() - startTime) / 1000)).toFixed(0);
      process.stdout.write(
        `\r📦 Batch ${stats.batches}: ${offset.toLocaleString()}/${stats.totalSourceRows.toLocaleString()} (${progress}%) - ${rate} rows/sec - ${elapsed}s elapsed`
      );
    }

    console.log('\n');
  } finally {
    sourceClient.release();
    targetClient.release();
  }

  stats.endTime = new Date();
  stats.durationMs = stats.endTime.getTime() - stats.startTime.getTime();

  return stats;
}

async function verifyMigration(
  sourcePool: Pool,
  targetPool: Pool
): Promise<boolean> {
  console.log('\n🔍 Verifying migration...\n');

  const sourceClient = await sourcePool.connect();
  const targetClient = await targetPool.connect();

  try {
    // Compare row counts
    const sourceCount = await getSourceRowCount(sourceClient);
    const targetCount = await getTargetRowCount(targetClient);

    console.log(`   Source rows:  ${sourceCount.toLocaleString()}`);
    console.log(`   Target rows:  ${targetCount.toLocaleString()}`);

    if (sourceCount !== targetCount) {
      console.log(`   ⚠️  Row count mismatch! Difference: ${Math.abs(sourceCount - targetCount)}`);
    } else {
      console.log('   ✅ Row counts match');
    }

    // Compare sample data (first and last rows)
    const sourceFirst = await sourceClient.query(
      'SELECT time, symbol, last_price FROM tick_data ORDER BY time ASC LIMIT 1'
    );
    const targetFirst = await targetClient.query(
      'SELECT time, symbol, last_price FROM tick_data ORDER BY time ASC LIMIT 1'
    );

    const sourceLast = await sourceClient.query(
      'SELECT time, symbol, last_price FROM tick_data ORDER BY time DESC LIMIT 1'
    );
    const targetLast = await targetClient.query(
      'SELECT time, symbol, last_price FROM tick_data ORDER BY time DESC LIMIT 1'
    );

    console.log('\n   First row comparison:');
    console.log(`     Source: ${JSON.stringify(sourceFirst.rows[0])}`);
    console.log(`     Target: ${JSON.stringify(targetFirst.rows[0])}`);

    console.log('\n   Last row comparison:');
    console.log(`     Source: ${JSON.stringify(sourceLast.rows[0])}`);
    console.log(`     Target: ${JSON.stringify(targetLast.rows[0])}`);

    // Verify TimescaleDB features
    console.log('\n   TimescaleDB features:');

    const hypertableCheck = await targetClient.query(
      "SELECT * FROM timescaledb_information.hypertables WHERE hypertable_name = 'tick_data'"
    );
    console.log(`     Hypertable: ${hypertableCheck.rows.length > 0 ? '✅' : '❌'}`);

    const compressionCheck = await targetClient.query(
      "SELECT * FROM timescaledb_information.compression_settings WHERE hypertable_name = 'tick_data'"
    );
    console.log(`     Compression: ${compressionCheck.rows.length > 0 ? '✅' : '❌'}`);

    const aggregatesCheck = await targetClient.query(
      'SELECT COUNT(*) as count FROM timescaledb_information.continuous_aggregates'
    );
    const aggCount = parseInt(aggregatesCheck.rows[0].count, 10);
    console.log(`     Continuous Aggregates: ${aggCount >= 4 ? '✅' : '⚠️'} (${aggCount}/4)`);

    return sourceCount === targetCount;
  } finally {
    sourceClient.release();
    targetClient.release();
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   TimescaleDB Migration Script');
  console.log('   Story 1.6: TimescaleDB Production Migration');
  console.log('═══════════════════════════════════════════════════════════════');

  const config = parseArgs();
  console.log('\n📋 Configuration:');
  console.log(`   Dry Run:     ${config.dryRun}`);
  console.log(`   Batch Size:  ${config.batchSize.toLocaleString()}`);
  console.log(`   Verify:      ${config.verify}`);

  // Initialize pools
  let sourcePool: Pool | null = null;
  let targetPool: Pool | null = null;

  try {
    console.log('\n🔌 Connecting to databases...');

    sourcePool = getSupabasePool();
    targetPool = getTimescalePool();

    // Test connections
    const sourceClient = await sourcePool.connect();
    await sourceClient.query('SELECT 1');
    sourceClient.release();
    console.log('   ✅ Supabase (source) connected');

    const targetClient = await targetPool.connect();
    await targetClient.query('SELECT 1');

    // Verify TimescaleDB
    const tsVersion = await targetClient.query(
      "SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'"
    );
    if (tsVersion.rows.length === 0) {
      console.log('   ⚠️  TimescaleDB extension not found on target!');
      console.log('   Run: scripts/timescaledb-production-setup.sql first');
      process.exit(1);
    }
    console.log(`   ✅ TimescaleDB (target) connected - v${tsVersion.rows[0].extversion}`);
    targetClient.release();

    // Run migration
    const stats = await migrateData(sourcePool, targetPool, config);

    // Print results
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('   Migration Results');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`   Total source rows:  ${stats.totalSourceRows.toLocaleString()}`);
    console.log(`   Migrated rows:      ${stats.migratedRows.toLocaleString()}`);
    console.log(`   Skipped rows:       ${stats.skippedRows.toLocaleString()}`);
    console.log(`   Error rows:         ${stats.errorRows.toLocaleString()}`);
    console.log(`   Batches:            ${stats.batches}`);
    console.log(`   Duration:           ${((stats.durationMs || 0) / 1000).toFixed(2)}s`);
    console.log(
      `   Rate:               ${((stats.migratedRows / ((stats.durationMs || 1) / 1000))).toFixed(0)} rows/sec`
    );

    if (config.dryRun) {
      console.log('\n🔍 DRY RUN - No data was actually written');
    }

    // Verify if requested
    if (config.verify && !config.dryRun) {
      const verified = await verifyMigration(sourcePool, targetPool);
      if (verified) {
        console.log('\n✅ Migration verified successfully!');
      } else {
        console.log('\n⚠️  Migration verification found discrepancies');
        process.exit(1);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   Next Steps');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('   1. Run benchmark: npx tsx scripts/timescaledb-poc/benchmark.ts --target=production');
    console.log('   2. If successful, set USE_TIMESCALEDB=true in .env');
    console.log('   3. Restart application');
    console.log('');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (sourcePool) await sourcePool.end();
    if (targetPool) await targetPool.end();
  }
}

main();
