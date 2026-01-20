/**
 * TimescaleDB Client Singleton
 *
 * Dedicated client for time-series data (tick_data, market replay, backtesting).
 * Uses native pg driver for optimal performance with TimescaleDB features.
 *
 * DO NOT use Prisma for tick data - Prisma doesn't support TimescaleDB features
 * like hypertables, compression, and continuous aggregates.
 */

import { Pool, PoolClient, QueryResult } from 'pg';

// =============================================================================
// Types
// =============================================================================

export interface TickData {
  time: Date;
  symbol: string;
  bid_price: number | null;
  ask_price: number | null;
  last_price: number | null;
  volume: number | null;
  source: string | null;
  trade_id: string | null;
  account_id: string | null;
}

export interface CandleData {
  bucket: Date;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TimescaleDBStats {
  hypertables: number;
  continuousAggregates: number;
  compressionEnabled: boolean;
  retentionEnabled: boolean;
  totalChunks: number;
  compressedChunks: number;
}

export interface ConnectionTestResult {
  connected: boolean;
  timescaleVersion: string | null;
  postgresVersion: string | null;
  latencyMs: number;
  error?: string;
}

// =============================================================================
// Configuration
// =============================================================================

const TIMESCALE_DATABASE_URL = process.env.TIMESCALE_DATABASE_URL;
const USE_TIMESCALEDB = process.env.USE_TIMESCALEDB === 'true';

// Pool configuration optimized for time-series workloads
const POOL_CONFIG = {
  max: 20, // Max connections in pool
  min: 2, // Min connections to keep alive
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Timeout for acquiring connection
  allowExitOnIdle: false, // Keep pool alive
};

// =============================================================================
// Singleton Pool
// =============================================================================

let pool: Pool | null = null;

/**
 * Get or create the TimescaleDB connection pool
 */
export function getTimescalePool(): Pool {
  if (!TIMESCALE_DATABASE_URL) {
    throw new Error(
      'TIMESCALE_DATABASE_URL is not configured. ' +
        'Please set it in your .env file. ' +
        'See: https://console.cloud.timescale.com/'
    );
  }

  if (!pool) {
    pool = new Pool({
      connectionString: TIMESCALE_DATABASE_URL,
      ...POOL_CONFIG,
      ssl: {
        rejectUnauthorized: false, // Required for most cloud providers
      },
    });

    // Error handling for pool
    pool.on('error', (err) => {
      console.error('[TimescaleDB] Pool error:', err.message);
    });

    pool.on('connect', () => {
      console.log('[TimescaleDB] New client connected to pool');
    });
  }

  return pool;
}

/**
 * Check if TimescaleDB is configured and should be used
 */
export function isTimescaleConfigured(): boolean {
  return !!TIMESCALE_DATABASE_URL;
}

/**
 * Check if TimescaleDB is enabled via feature flag
 */
export function isTimescaleEnabled(): boolean {
  return USE_TIMESCALEDB && isTimescaleConfigured();
}

// =============================================================================
// Connection Testing
// =============================================================================

/**
 * Test connection and verify TimescaleDB features
 */
export async function testConnection(): Promise<ConnectionTestResult> {
  const startTime = Date.now();

  if (!isTimescaleConfigured()) {
    return {
      connected: false,
      timescaleVersion: null,
      postgresVersion: null,
      latencyMs: 0,
      error: 'TIMESCALE_DATABASE_URL not configured',
    };
  }

  let client: PoolClient | null = null;

  try {
    const poolInstance = getTimescalePool();
    client = await poolInstance.connect();

    // Test basic connectivity
    await client.query('SELECT 1');

    // Get PostgreSQL version
    const pgVersionResult = await client.query('SHOW server_version');
    const postgresVersion = pgVersionResult.rows[0]?.server_version || null;

    // Get TimescaleDB version
    let timescaleVersion: string | null = null;
    try {
      const tsVersionResult = await client.query(
        "SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'"
      );
      timescaleVersion = tsVersionResult.rows[0]?.extversion || null;
    } catch {
      // TimescaleDB extension might not be installed
      timescaleVersion = null;
    }

    const latencyMs = Date.now() - startTime;

    return {
      connected: true,
      timescaleVersion,
      postgresVersion,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return {
      connected: false,
      timescaleVersion: null,
      postgresVersion: null,
      latencyMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Get TimescaleDB statistics (hypertables, aggregates, compression status)
 */
export async function getTimescaleStats(): Promise<TimescaleDBStats | null> {
  if (!isTimescaleConfigured()) {
    return null;
  }

  let client: PoolClient | null = null;

  try {
    const poolInstance = getTimescalePool();
    client = await poolInstance.connect();

    // Count hypertables
    const hypertablesResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM timescaledb_information.hypertables
    `);
    const hypertables = parseInt(hypertablesResult.rows[0]?.count || '0', 10);

    // Count continuous aggregates
    const aggregatesResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM timescaledb_information.continuous_aggregates
    `);
    const continuousAggregates = parseInt(aggregatesResult.rows[0]?.count || '0', 10);

    // Check compression policy
    const compressionResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM timescaledb_information.jobs 
      WHERE proc_name = 'policy_compression'
    `);
    const compressionEnabled = parseInt(compressionResult.rows[0]?.count || '0', 10) > 0;

    // Check retention policy
    const retentionResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM timescaledb_information.jobs 
      WHERE proc_name = 'policy_retention'
    `);
    const retentionEnabled = parseInt(retentionResult.rows[0]?.count || '0', 10) > 0;

    // Count chunks
    const chunksResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_compressed = true) as compressed
      FROM timescaledb_information.chunks
    `);
    const totalChunks = parseInt(chunksResult.rows[0]?.total || '0', 10);
    const compressedChunks = parseInt(chunksResult.rows[0]?.compressed || '0', 10);

    return {
      hypertables,
      continuousAggregates,
      compressionEnabled,
      retentionEnabled,
      totalChunks,
      compressedChunks,
    };
  } catch (error) {
    console.error('[TimescaleDB] Error getting stats:', error);
    return null;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// =============================================================================
// Query Helpers
// =============================================================================

/**
 * Execute a query on TimescaleDB
 */
export async function query<T extends Record<string, any> = Record<string, any>>(
  sql: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const poolInstance = getTimescalePool();
  return poolInstance.query<T>(sql, params);
}

/**
 * Execute a query with a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const poolInstance = getTimescalePool();
  const client = await poolInstance.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// =============================================================================
// Tick Data Operations
// =============================================================================

/**
 * Insert tick data (batch insert for performance)
 */
export async function insertTicks(ticks: TickData[]): Promise<number> {
  if (ticks.length === 0) return 0;

  const values: unknown[] = [];
  const placeholders: string[] = [];

  ticks.forEach((tick, index) => {
    const offset = index * 9;
    placeholders.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`
    );
    values.push(
      tick.time,
      tick.symbol,
      tick.bid_price,
      tick.ask_price,
      tick.last_price,
      tick.volume,
      tick.source,
      tick.trade_id,
      tick.account_id
    );
  });

  const sql = `
    INSERT INTO tick_data (time, symbol, bid_price, ask_price, last_price, volume, source, trade_id, account_id)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT DO NOTHING
  `;

  const result = await query(sql, values);
  return result.rowCount || 0;
}

/**
 * Query ticks for a time window (optimized for replay)
 */
export async function queryTicks(
  symbol: string,
  startTime: Date,
  endTime: Date,
  limit?: number
): Promise<TickData[]> {
  const sql = `
    SELECT time, symbol, bid_price, ask_price, last_price, volume, source, trade_id, account_id
    FROM tick_data
    WHERE symbol = $1 AND time >= $2 AND time <= $3
    ORDER BY time ASC
    ${limit ? `LIMIT ${limit}` : ''}
  `;

  const result = await query<TickData>(sql, [symbol, startTime, endTime]);
  return result.rows;
}

/**
 * Query candles from continuous aggregate
 */
export async function queryCandles(
  symbol: string,
  startTime: Date,
  endTime: Date,
  interval: '1m' | '5m' | '15m' | '1h'
): Promise<CandleData[]> {
  const viewName = `candle_${interval}`;

  const sql = `
    SELECT bucket, symbol, open, high, low, close, volume
    FROM ${viewName}
    WHERE symbol = $1 AND bucket >= $2 AND bucket <= $3
    ORDER BY bucket ASC
  `;

  const result = await query<CandleData>(sql, [symbol, startTime, endTime]);
  return result.rows;
}

/**
 * Get tick count for a symbol
 */
export async function getTickCount(symbol?: string): Promise<number> {
  const sql = symbol
    ? 'SELECT COUNT(*) as count FROM tick_data WHERE symbol = $1'
    : 'SELECT COUNT(*) as count FROM tick_data';

  const result = await query<{ count: string }>(sql, symbol ? [symbol] : []);
  return parseInt(result.rows[0]?.count || '0', 10);
}

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Close the connection pool (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[TimescaleDB] Connection pool closed');
  }
}

// Handle process termination
if (typeof process !== 'undefined') {
  process.on('SIGINT', closePool);
  process.on('SIGTERM', closePool);
}
