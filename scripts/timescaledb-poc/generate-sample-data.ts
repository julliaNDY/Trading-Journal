/**
 * Script to generate sample tick data for TimescaleDB POC
 * 
 * Generates 1 day of tick data with 250ms precision (345,600 ticks per day)
 * 
 * Usage:
 *   npx tsx scripts/timescaledb-poc/generate-sample-data.ts
 * 
 * Environment variables:
 *   - DATABASE_URL: PostgreSQL connection string
 */

import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import pg from 'pg'

config({ path: '.env.local' })

const { Pool } = pg

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set')
  process.exit(1)
}

// Parse DATABASE_URL and create a pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
})

const prisma = new PrismaClient()

/**
 * Get or create a test account for POC data
 */
async function getOrCreateTestAccount(): Promise<string> {
  const accounts = await prisma.account.findMany({ take: 1 })
  if (accounts.length > 0) {
    return accounts[0].id
  }
  
  // If no account exists, get first user and create one
  const users = await prisma.user.findMany({ take: 1 })
  if (users.length === 0) {
    throw new Error('No users found. Please create a user account first.')
  }
  
  const account = await prisma.account.create({
    data: {
      userId: users[0].id,
      name: 'POC Test Account',
      broker: 'TEST',
      color: '#6366f1',
    },
  })
  
  return account.id
}

/**
 * Generate sample tick data for 1 day with 250ms precision
 * @param symbol Symbol to generate data for (default: 'AAPL')
 * @param startTime Start time (default: yesterday 00:00:00)
 * @param intervalMs Interval between ticks in milliseconds (default: 250ms)
 * @param accountId Account ID to use (if not provided, will get/create one)
 */
async function generateSampleTicks(
  symbol: string = 'AAPL',
  startTime: Date = new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
  intervalMs: number = 250,
  accountId?: string
) {
  // Get or create account if not provided
  const testAccountId = accountId || await getOrCreateTestAccount()
  
  console.log(`🚀 Generating sample tick data for ${symbol}...`)
  console.log(`   Start time: ${startTime.toISOString()}`)
  console.log(`   Interval: ${intervalMs}ms`)
  console.log(`   Account ID: ${testAccountId}`)

  // Calculate total ticks (1 day = 86400000ms / 250ms = 345,600 ticks)
  const totalTicks = Math.floor((24 * 60 * 60 * 1000) / intervalMs)
  console.log(`   Total ticks: ${totalTicks.toLocaleString()}`)

  // Base price (simulate stock price around $150)
  const basePrice = 150.0
  let currentPrice = basePrice
  let volume = 100

  // Prepare batch insert query
  const batchSize = 1000
  let tickCount = 0
  let currentTime = new Date(startTime)

  console.log(`\n📊 Inserting ticks in batches of ${batchSize}...`)

  for (let batchStart = 0; batchStart < totalTicks; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, totalTicks)
    const values: (string | number | null)[] = []
    const placeholders: string[] = []

    let paramIndex = 1
    for (let i = batchStart; i < batchEnd; i++) {
      // Simulate price movement (random walk with slight upward bias)
      const change = (Math.random() - 0.49) * 0.1 // Small random change
      currentPrice = Math.max(1.0, currentPrice + change)
      volume = Math.floor(100 + Math.random() * 900) // Random volume 100-1000

      const bidPrice = currentPrice - 0.01
      const askPrice = currentPrice + 0.01
      const lastPrice = currentPrice

      placeholders.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
      )

      values.push(
        currentTime.toISOString(),
        symbol,
        testAccountId, // account_id (required for PK)
        bidPrice.toFixed(8),
        askPrice.toFixed(8),
        lastPrice.toFixed(8),
        volume,
        'sample' // source
      )

      // Move to next tick time
      currentTime = new Date(currentTime.getTime() + intervalMs)
    }

    // Insert batch
    const query = `
      INSERT INTO tick_data (time, symbol, account_id, bid_price, ask_price, last_price, volume, source)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (time, symbol, account_id) DO NOTHING
    `

    await pool.query(query, values)

    tickCount += batchEnd - batchStart
    const progress = ((batchEnd / totalTicks) * 100).toFixed(1)
    process.stdout.write(`\r   Progress: ${progress}% (${tickCount.toLocaleString()} / ${totalTicks.toLocaleString()} ticks)`)
  }

  console.log(`\n✅ Successfully generated ${tickCount.toLocaleString()} ticks for ${symbol}`)

  // Get table size
  const sizeQuery = await pool.query(`
    SELECT 
      pg_size_pretty(pg_total_relation_size('tick_data')) AS total_size,
      pg_size_pretty(pg_relation_size('tick_data')) AS table_size,
      (SELECT COUNT(*) FROM tick_data) AS tick_count
  `)

  console.log(`\n📊 Table Statistics:`)
  console.log(`   Total size: ${sizeQuery.rows[0].total_size}`)
  console.log(`   Table size: ${sizeQuery.rows[0].table_size}`)
  console.log(`   Tick count: ${sizeQuery.rows[0].tick_count.toLocaleString()}`)

  // Check if TimescaleDB compression is active
  const compressionQuery = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE compression_status = 'Compressed') AS compressed_chunks,
      COUNT(*) AS total_chunks
    FROM timescaledb_information.chunks
    WHERE hypertable_name = 'tick_data'
  `).catch(() => ({ rows: [{ compressed_chunks: 0, total_chunks: 0 }] }))

  if (compressionQuery.rows[0].compressed_chunks > 0) {
    console.log(`   Compressed chunks: ${compressionQuery.rows[0].compressed_chunks} / ${compressionQuery.rows[0].total_chunks}`)
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('TimescaleDB POC: Sample Tick Data Generator')
  console.log('='.repeat(60))

  try {
    await pool.query('SELECT 1') // Test connection
    console.log('✅ Connected to database\n')

    // Check if tick_data table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tick_data'
      )
    `)

    if (!tableCheck.rows[0].exists) {
      console.error('❌ tick_data table does not exist. Please run the migration first:')
      console.error('   npx prisma migrate deploy')
      process.exit(1)
    }

    // Check if TimescaleDB extension is available
    const extCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_extension WHERE extname = 'timescaledb'
      )
    `)

    if (extCheck.rows[0].exists) {
      console.log('✅ TimescaleDB extension is available\n')
    } else {
      console.log('⚠️  TimescaleDB extension not found. Data will be stored in regular PostgreSQL table.\n')
    }

    // Generate sample data
    const symbol = process.argv[2] || 'AAPL'
    await generateSampleTicks(symbol)

    console.log('\n✅ Sample data generation complete!')
  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  } finally {
    await pool.end()
    await prisma.$disconnect()
  }
}

main()
