/**
 * Benchmark script for TimescaleDB POC / Production
 * 
 * Tests query performance and replay streaming capabilities
 * 
 * Usage:
 *   # Test against Supabase (development)
 *   npx tsx scripts/timescaledb-poc/benchmark.ts
 * 
 *   # Test against TimescaleDB (production)
 *   npx tsx scripts/timescaledb-poc/benchmark.ts --target=production
 * 
 * Environment variables:
 *   - DATABASE_URL: Supabase PostgreSQL connection string
 *   - TIMESCALE_DATABASE_URL: TimescaleDB production connection string
 */

import { config } from 'dotenv'
import pg from 'pg'

config({ path: '.env.local' })
config({ path: '.env' }) // Also load .env for TIMESCALE_DATABASE_URL

const { Pool } = pg

// Parse CLI arguments
const args = process.argv.slice(2)
const isProduction = args.includes('--target=production')

const DATABASE_URL = isProduction 
  ? process.env.TIMESCALE_DATABASE_URL 
  : process.env.DATABASE_URL

const TARGET_NAME = isProduction ? 'TimescaleDB (Production)' : 'Supabase (Development)'

// Production targets (stricter than development)
const LATENCY_TARGET_MS = isProduction ? 100 : 200
const FPS_TARGET = 60

if (!DATABASE_URL) {
  const envVar = isProduction ? 'TIMESCALE_DATABASE_URL' : 'DATABASE_URL'
  console.error(`❌ ${envVar} environment variable is not set`)
  process.exit(1)
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  ssl: { rejectUnauthorized: false },
})

interface BenchmarkResult {
  name: string
  duration: number
  rowCount: number
  throughput: number // rows per second
}

/**
 * Measure query performance
 */
async function benchmarkQuery(name: string, query: string, params: any[] = []): Promise<BenchmarkResult> {
  const start = Date.now()
  const result = await pool.query(query, params)
  const duration = Date.now() - start
  const rowCount = result.rows.length
  const throughput = rowCount > 0 ? (rowCount / duration) * 1000 : 0

  return {
    name,
    duration,
    rowCount,
    throughput,
  }
}

/**
 * Test time-window query (AC4: < 200ms)
 */
async function testTimeWindowQuery() {
  console.log('\n📊 Testing Time Window Query Performance...')

  // Get min/max times from table
  const timeRange = await pool.query(`
    SELECT MIN(time) as min_time, MAX(time) as max_time
    FROM tick_data
  `)

  if (!timeRange.rows[0].min_time) {
    console.log('⚠️  No data in tick_data table. Generate sample data first.')
    return
  }

  const minTime = new Date(timeRange.rows[0].min_time)
  const maxTime = new Date(timeRange.rows[0].max_time)

  // Test different window sizes
  const windows = [
    { name: '1 hour', duration: 60 * 60 * 1000 },
    { name: '6 hours', duration: 6 * 60 * 60 * 1000 },
    { name: '12 hours', duration: 12 * 60 * 60 * 1000 },
    { name: '1 day', duration: 24 * 60 * 60 * 1000 },
  ]

  const results: BenchmarkResult[] = []

  for (const window of windows) {
    const startTime = minTime
    const endTime = new Date(startTime.getTime() + window.duration)

    if (endTime > maxTime) continue

    const result = await benchmarkQuery(
      `Query ${window.name} window`,
      `
        SELECT time, symbol, bid_price, ask_price, last_price, volume
        FROM tick_data
        WHERE time >= $1 AND time <= $2
        ORDER BY time ASC
      `,
      [startTime.toISOString(), endTime.toISOString()]
    )

    results.push(result)

    console.log(`   ${result.name}:`)
    console.log(`      Duration: ${result.duration}ms`)
    console.log(`      Rows: ${result.rowCount.toLocaleString()}`)
    console.log(`      Throughput: ${result.throughput.toFixed(0)} rows/sec`)
    console.log(`      Status: ${result.duration < LATENCY_TARGET_MS ? '✅ PASS' : '❌ FAIL'} (< ${LATENCY_TARGET_MS}ms target)`)
  }

  return results
}

/**
 * Test streaming replay (AC5: 60fps for 1 day)
 */
async function testStreamingReplay() {
  console.log('\n🎬 Testing Streaming Replay Performance...')

  // Get 1 day of data
  const timeRange = await pool.query(`
    SELECT MIN(time) as min_time, MAX(time) as max_time
    FROM tick_data
  `)

  if (!timeRange.rows[0].min_time) {
    console.log('⚠️  No data in tick_data table. Generate sample data first.')
    return
  }

  const startTime = new Date(timeRange.rows[0].min_time)
  const endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000) // 1 day

  // Target: 60fps means 60 ticks per second
  // For 1 day at 250ms interval, we have 345,600 ticks
  // At 60fps, replay should take: 345,600 / 60 = 5,760 seconds = 96 minutes

  // Simulate streaming by fetching in batches
  const batchSize = 60 // 60 ticks per batch (1 second at 60fps)
  const totalTicks = await pool.query(`
    SELECT COUNT(*) as count
    FROM tick_data
    WHERE time >= $1 AND time <= $2
  `, [startTime.toISOString(), endTime.toISOString()])

  const tickCount = parseInt(totalTicks.rows[0].count)
  const totalBatches = Math.ceil(tickCount / batchSize)

  console.log(`   Total ticks: ${tickCount.toLocaleString()}`)
  console.log(`   Batch size: ${batchSize} ticks (60fps = 60 ticks/sec)`)
  console.log(`   Total batches: ${totalBatches.toLocaleString()}`)

  const start = Date.now()
  let processedTicks = 0

  for (let offset = 0; offset < tickCount; offset += batchSize) {
    const batchResult = await pool.query(`
      SELECT time, symbol, bid_price, ask_price, last_price, volume
      FROM tick_data
      WHERE time >= $1 AND time <= $2
      ORDER BY time ASC
      LIMIT $3 OFFSET $4
    `, [startTime.toISOString(), endTime.toISOString(), batchSize, offset])

    processedTicks += batchResult.rows.length

    // Simulate frame processing (16.67ms per frame at 60fps)
    // In real implementation, this would be streaming to client
    const elapsed = Date.now() - start
    const fps = (processedTicks / elapsed) * 1000 / batchSize

    if (offset % (batchSize * 10) === 0 || offset + batchSize >= tickCount) {
      process.stdout.write(`\r   Progress: ${((processedTicks / tickCount) * 100).toFixed(1)}% - FPS: ${fps.toFixed(1)}`)
    }
  }

  const duration = Date.now() - start
  const avgFPS = (processedTicks / duration) * 1000 / batchSize

  console.log(`\n   Duration: ${(duration / 1000).toFixed(1)}s`)
  console.log(`   Average FPS: ${avgFPS.toFixed(1)}`)
  console.log(`   Status: ${avgFPS >= FPS_TARGET ? '✅ PASS' : '❌ FAIL'} (≥ ${FPS_TARGET}fps target)`)

  return {
    duration,
    avgFPS,
    tickCount,
  }
}

/**
 * Get table statistics
 */
async function getTableStats() {
  console.log('\n📈 Table Statistics...')

  const stats = await pool.query(`
    SELECT 
      COUNT(*) as tick_count,
      MIN(time) as min_time,
      MAX(time) as max_time,
      COUNT(DISTINCT symbol) as symbol_count,
      pg_size_pretty(pg_total_relation_size('tick_data')) AS total_size,
      pg_size_pretty(pg_relation_size('tick_data')) AS table_size
    FROM tick_data
  `)

  const row = stats.rows[0]
  console.log(`   Tick count: ${parseInt(row.tick_count).toLocaleString()}`)
  console.log(`   Time range: ${new Date(row.min_time).toISOString()} to ${new Date(row.max_time).toISOString()}`)
  console.log(`   Symbols: ${row.symbol_count}`)
  console.log(`   Total size: ${row.total_size}`)
  console.log(`   Table size: ${row.table_size}`)

  // Check TimescaleDB stats if available
  const hypertableCheck = await pool.query(`
    SELECT 
      hypertable_name,
      num_dimensions,
      compression_status
    FROM timescaledb_information.hypertables
    WHERE hypertable_name = 'tick_data'
  `).catch(() => ({ rows: [] }))

  if (hypertableCheck.rows.length > 0) {
    console.log(`   Hypertable: ✅ Yes`)
    console.log(`   Compression: ${hypertableCheck.rows[0].compression_status || 'N/A'}`)
  } else {
    console.log(`   Hypertable: ❌ No (TimescaleDB not enabled)`)
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log(`TimescaleDB Benchmark: ${TARGET_NAME}`)
  console.log('='.repeat(60))
  console.log(`   Latency target: < ${LATENCY_TARGET_MS}ms`)
  console.log(`   FPS target: ≥ ${FPS_TARGET}fps`)

  try {
    await pool.query('SELECT 1') // Test connection
    console.log(`\n✅ Connected to ${TARGET_NAME}`)

    // Get table stats
    await getTableStats()

    // Test time window queries
    await testTimeWindowQuery()

    // Test streaming replay
    await testStreamingReplay()

    console.log('\n✅ Benchmark complete!')
  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
