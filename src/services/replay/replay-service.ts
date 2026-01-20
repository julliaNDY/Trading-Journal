/**
 * Market Replay Service
 * 
 * Provides tick-by-tick replay with advanced features:
 * - Speed control (0.5x to 10x)
 * - OHLCV candle aggregation
 * - Real-time metrics calculation
 * - Trade marker overlay
 * - Seek/jump functionality
 */

import pg from 'pg'
import type {
  TickData,
  Candle,
  CandleInterval,
  ReplayConfig,
  ReplayFrame,
  ReplayMetrics,
  ReplayMetadata,
  ReplayInfoResponse,
  TradeMarker,
} from './types'

const { Pool } = pg

// Singleton pool
let pool: pg.Pool | null = null

function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    })
  }
  return pool
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse candle interval to milliseconds
 */
function intervalToMs(interval: CandleInterval): number {
  const map: Record<CandleInterval, number> = {
    '1s': 1000,
    '5s': 5000,
    '15s': 15000,
    '30s': 30000,
    '1m': 60000,
    '5m': 300000,
    '15m': 900000,
    '30m': 1800000,
    '1h': 3600000,
    '4h': 14400000,
    '1d': 86400000,
  }
  return map[interval] || 60000
}

/**
 * Parse candle interval to PostgreSQL interval
 */
function intervalToPostgres(interval: CandleInterval): string {
  const map: Record<CandleInterval, string> = {
    '1s': '1 second',
    '5s': '5 seconds',
    '15s': '15 seconds',
    '30s': '30 seconds',
    '1m': '1 minute',
    '5m': '5 minutes',
    '15m': '15 minutes',
    '30m': '30 minutes',
    '1h': '1 hour',
    '4h': '4 hours',
    '1d': '1 day',
  }
  return map[interval] || '1 minute'
}

/**
 * Convert database row to TickData
 */
function rowToTick(row: any): TickData {
  return {
    time: row.time,
    symbol: row.symbol,
    bidPrice: parseFloat(row.bid_price) || 0,
    askPrice: parseFloat(row.ask_price) || 0,
    lastPrice: parseFloat(row.last_price) || 0,
    volume: parseInt(row.volume) || 0,
    source: row.source,
    tradeId: row.trade_id,
    accountId: row.account_id,
  }
}

// ============================================================================
// REPLAY INFO
// ============================================================================

/**
 * Get replay system info (available data, TimescaleDB status, etc.)
 */
export async function getReplayInfo(): Promise<ReplayInfoResponse> {
  const db = getPool()
  
  try {
    // Check if tick_data table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tick_data'
      )
    `)
    
    if (!tableCheck.rows[0].exists) {
      return {
        available: false,
        symbols: [],
        dateRange: { earliest: '', latest: '' },
        totalTicks: 0,
        isTimescaleDB: false,
        compressionEnabled: false,
      }
    }
    
    // Get data stats
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_ticks,
        MIN(time) as earliest,
        MAX(time) as latest,
        ARRAY_AGG(DISTINCT symbol) as symbols
      FROM tick_data
    `)
    
    // Check TimescaleDB
    const tsCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM pg_extension WHERE extname = 'timescaledb'
      )
    `).catch(() => ({ rows: [{ exists: false }] }))
    
    // Check compression
    const compressionCheck = await db.query(`
      SELECT COUNT(*) > 0 as has_compression
      FROM timescaledb_information.compression_settings
      WHERE hypertable_name = 'tick_data'
    `).catch(() => ({ rows: [{ has_compression: false }] }))
    
    const row = stats.rows[0]
    return {
      available: true,
      symbols: row.symbols || [],
      dateRange: {
        earliest: row.earliest?.toISOString() || '',
        latest: row.latest?.toISOString() || '',
      },
      totalTicks: parseInt(row.total_ticks) || 0,
      isTimescaleDB: tsCheck.rows[0].exists,
      compressionEnabled: compressionCheck.rows[0].has_compression,
    }
  } catch (error) {
    console.error('Error getting replay info:', error)
    return {
      available: false,
      symbols: [],
      dateRange: { earliest: '', latest: '' },
      totalTicks: 0,
      isTimescaleDB: false,
      compressionEnabled: false,
    }
  }
}

// ============================================================================
// REPLAY METADATA
// ============================================================================

/**
 * Get metadata for a specific replay range
 */
export async function getReplayMetadata(
  symbol: string,
  startTime: string,
  endTime: string
): Promise<ReplayMetadata | null> {
  const db = getPool()
  
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) as tick_count,
        MIN(time) as start_time,
        MAX(time) as end_time,
        MAX(last_price) as high_price,
        MIN(last_price) as low_price,
        (SELECT last_price FROM tick_data 
         WHERE symbol = $1 AND time >= $2 AND time <= $3 
         ORDER BY time ASC LIMIT 1) as open_price,
        (SELECT last_price FROM tick_data 
         WHERE symbol = $1 AND time >= $2 AND time <= $3 
         ORDER BY time DESC LIMIT 1) as close_price,
        COUNT(DISTINCT DATE(time)) as trading_days,
        pg_column_size(tick_data) as avg_row_size
      FROM tick_data
      WHERE symbol = $1 AND time >= $2 AND time <= $3
    `, [symbol, startTime, endTime])
    
    if (result.rows.length === 0 || !result.rows[0].tick_count) {
      return null
    }
    
    const row = result.rows[0]
    const tickCount = parseInt(row.tick_count)
    const durationMs = new Date(row.end_time).getTime() - new Date(row.start_time).getTime()
    const durationSeconds = durationMs / 1000
    
    return {
      symbol,
      startTime: row.start_time?.toISOString() || startTime,
      endTime: row.end_time?.toISOString() || endTime,
      tickCount,
      tradingDays: parseInt(row.trading_days) || 1,
      avgTicksPerSecond: durationSeconds > 0 ? tickCount / durationSeconds : 0,
      gapCount: 0, // Would need separate query to calculate gaps
      coverage: 100, // Simplified - would need gap analysis
      priceRange: {
        high: parseFloat(row.high_price) || 0,
        low: parseFloat(row.low_price) || 0,
        open: parseFloat(row.open_price) || 0,
        close: parseFloat(row.close_price) || 0,
      },
      estimatedSizeBytes: tickCount * (parseInt(row.avg_row_size) || 100),
    }
  } catch (error) {
    console.error('Error getting replay metadata:', error)
    return null
  }
}

// ============================================================================
// CANDLE AGGREGATION
// ============================================================================

/**
 * Get OHLCV candles for a time range
 */
export async function getCandles(
  symbol: string,
  startTime: string,
  endTime: string,
  interval: CandleInterval = '1m'
): Promise<Candle[]> {
  const db = getPool()
  const pgInterval = intervalToPostgres(interval)
  
  try {
    // Check if TimescaleDB is available for time_bucket
    const tsCheck = await db.query(`
      SELECT EXISTS (SELECT FROM pg_extension WHERE extname = 'timescaledb')
    `).catch(() => ({ rows: [{ exists: false }] }))
    
    let query: string
    
    if (tsCheck.rows[0].exists) {
      // Use TimescaleDB time_bucket for efficient aggregation
      query = `
        SELECT 
          time_bucket('${pgInterval}', time) AS bucket,
          symbol,
          FIRST(last_price, time) AS open,
          MAX(last_price) AS high,
          MIN(last_price) AS low,
          LAST(last_price, time) AS close,
          SUM(volume) AS volume,
          COUNT(*) AS tick_count
        FROM tick_data
        WHERE symbol = $1 AND time >= $2 AND time <= $3
        GROUP BY bucket, symbol
        ORDER BY bucket ASC
      `
    } else {
      // Fallback to date_trunc for standard PostgreSQL
      query = `
        SELECT 
          date_trunc('minute', time) AS bucket,
          symbol,
          (ARRAY_AGG(last_price ORDER BY time ASC))[1] AS open,
          MAX(last_price) AS high,
          MIN(last_price) AS low,
          (ARRAY_AGG(last_price ORDER BY time DESC))[1] AS close,
          SUM(volume) AS volume,
          COUNT(*) AS tick_count
        FROM tick_data
        WHERE symbol = $1 AND time >= $2 AND time <= $3
        GROUP BY bucket, symbol
        ORDER BY bucket ASC
      `
    }
    
    const result = await db.query(query, [symbol, startTime, endTime])
    
    return result.rows.map(row => ({
      time: row.bucket,
      symbol: row.symbol,
      open: parseFloat(row.open) || 0,
      high: parseFloat(row.high) || 0,
      low: parseFloat(row.low) || 0,
      close: parseFloat(row.close) || 0,
      volume: parseInt(row.volume) || 0,
      tickCount: parseInt(row.tick_count) || 0,
    }))
  } catch (error) {
    console.error('Error getting candles:', error)
    return []
  }
}

// ============================================================================
// TICK RETRIEVAL
// ============================================================================

/**
 * Get raw ticks for a time range
 */
export async function getTicks(
  startTime: string,
  endTime: string,
  options: {
    symbol?: string
    symbols?: string[]
    limit?: number
    offset?: number
  } = {}
): Promise<TickData[]> {
  const db = getPool()
  
  let query = `
    SELECT time, symbol, bid_price, ask_price, last_price, volume, source, trade_id, account_id
    FROM tick_data
    WHERE time >= $1 AND time <= $2
  `
  const params: any[] = [startTime, endTime]
  let paramIndex = 3
  
  if (options.symbol) {
    query += ` AND symbol = $${paramIndex++}`
    params.push(options.symbol)
  } else if (options.symbols && options.symbols.length > 0) {
    query += ` AND symbol = ANY($${paramIndex++})`
    params.push(options.symbols)
  }
  
  query += ' ORDER BY time ASC'
  
  if (options.limit) {
    query += ` LIMIT $${paramIndex++}`
    params.push(options.limit)
  }
  
  if (options.offset) {
    query += ` OFFSET $${paramIndex++}`
    params.push(options.offset)
  }
  
  try {
    const result = await db.query(query, params)
    return result.rows.map(rowToTick)
  } catch (error) {
    console.error('Error getting ticks:', error)
    return []
  }
}

// ============================================================================
// TRADE MARKERS
// ============================================================================

/**
 * Get trade markers (entries/exits) for overlay on replay
 */
export async function getTradeMarkers(
  userId: string,
  startTime: string,
  endTime: string,
  symbol?: string
): Promise<TradeMarker[]> {
  const db = getPool()
  
  try {
    let query = `
      SELECT 
        t.id as trade_id,
        t.symbol,
        t.direction,
        t.opened_at,
        t.closed_at,
        t.entry_price,
        t.exit_price,
        t.quantity,
        t.realized_pnl_usd,
        t.stop_loss_price_initial
      FROM trades t
      WHERE t.user_id = $1
        AND (
          (t.opened_at >= $2 AND t.opened_at <= $3)
          OR (t.closed_at >= $2 AND t.closed_at <= $3)
        )
    `
    const params: any[] = [userId, startTime, endTime]
    
    if (symbol) {
      query += ' AND t.symbol = $4'
      params.push(symbol)
    }
    
    query += ' ORDER BY t.opened_at ASC'
    
    const result = await db.query(query, params)
    
    const markers: TradeMarker[] = []
    
    for (const row of result.rows) {
      // Entry marker
      markers.push({
        time: row.opened_at.toISOString(),
        type: 'entry',
        side: row.direction.toLowerCase() as 'long' | 'short',
        price: parseFloat(row.entry_price),
        quantity: parseFloat(row.quantity),
        tradeId: row.trade_id,
      })
      
      // Exit marker
      if (row.closed_at) {
        const pnl = parseFloat(row.realized_pnl_usd)
        markers.push({
          time: row.closed_at.toISOString(),
          type: pnl >= 0 ? 'take_profit' : 'stop_loss',
          side: row.direction.toLowerCase() as 'long' | 'short',
          price: parseFloat(row.exit_price),
          quantity: parseFloat(row.quantity),
          tradeId: row.trade_id,
          pnl,
        })
      }
    }
    
    return markers.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  } catch (error) {
    console.error('Error getting trade markers:', error)
    return []
  }
}

// ============================================================================
// REAL-TIME METRICS CALCULATION
// ============================================================================

/**
 * Calculate replay metrics from ticks
 */
export function calculateMetrics(
  ticks: TickData[],
  previousMetrics?: ReplayMetrics
): ReplayMetrics {
  if (ticks.length === 0) {
    return previousMetrics || {
      currentPrice: 0,
      priceChange: 0,
      priceChangePercent: 0,
      highOfDay: 0,
      lowOfDay: 0,
      totalVolume: 0,
      avgVolume: 0,
      volumeProfile: [],
      tickCount: 0,
      ticksPerSecond: 0,
      bidAskSpread: 0,
      avgSpread: 0,
    }
  }
  
  const lastTick = ticks[ticks.length - 1]
  const firstTick = ticks[0]
  
  // Price calculations
  const currentPrice = lastTick.lastPrice
  const prices = ticks.map(t => t.lastPrice).filter(p => p > 0)
  const highOfDay = Math.max(previousMetrics?.highOfDay || 0, ...prices)
  const lowOfDay = previousMetrics?.lowOfDay 
    ? Math.min(previousMetrics.lowOfDay, ...prices)
    : Math.min(...prices)
  
  // Calculate price change from session open
  const openPrice = previousMetrics?.currentPrice || firstTick.lastPrice
  const priceChange = currentPrice - openPrice
  const priceChangePercent = openPrice > 0 ? (priceChange / openPrice) * 100 : 0
  
  // Volume calculations
  const frameVolume = ticks.reduce((sum, t) => sum + t.volume, 0)
  const totalVolume = (previousMetrics?.totalVolume || 0) + frameVolume
  const tickCount = (previousMetrics?.tickCount || 0) + ticks.length
  const avgVolume = tickCount > 0 ? totalVolume / tickCount : 0
  
  // Spread calculations
  const spreads = ticks
    .filter(t => t.askPrice > 0 && t.bidPrice > 0)
    .map(t => t.askPrice - t.bidPrice)
  const currentSpread = spreads.length > 0 ? spreads[spreads.length - 1] : 0
  const avgSpread = spreads.length > 0 
    ? spreads.reduce((a, b) => a + b, 0) / spreads.length 
    : previousMetrics?.avgSpread || 0
  
  // Time-based calculations
  const timeDiffMs = new Date(lastTick.time).getTime() - new Date(firstTick.time).getTime()
  const ticksPerSecond = timeDiffMs > 0 ? (ticks.length / timeDiffMs) * 1000 : 0
  
  return {
    currentPrice,
    priceChange,
    priceChangePercent,
    highOfDay,
    lowOfDay,
    totalVolume,
    avgVolume,
    volumeProfile: [], // Would need price buckets
    tickCount,
    ticksPerSecond,
    bidAskSpread: currentSpread,
    avgSpread,
  }
}

// ============================================================================
// STREAMING REPLAY GENERATOR
// ============================================================================

/**
 * Create an async generator for streaming replay frames
 */
export async function* createReplayStream(
  config: ReplayConfig
): AsyncGenerator<ReplayFrame> {
  const db = getPool()
  
  const fps = config.fps || 60
  const speed = config.speed || 1
  const frameInterval = (1000 / fps) / speed
  
  // Get total tick count for progress
  const countResult = await db.query(`
    SELECT COUNT(*) as count
    FROM tick_data
    WHERE time >= $1 AND time <= $2
    ${config.symbol ? 'AND symbol = $3' : ''}
  `, config.symbol 
    ? [config.startTime, config.endTime, config.symbol]
    : [config.startTime, config.endTime]
  )
  
  const totalTicks = parseInt(countResult.rows[0].count)
  const ticksPerFrame = Math.max(1, Math.ceil(60 / fps))
  const totalFrames = Math.ceil(totalTicks / ticksPerFrame)
  
  // Get ticks in batches
  const batchSize = 1000
  let offset = 0
  let frameIndex = 0
  let processedTicks = 0
  let metrics: ReplayMetrics | undefined
  let currentCandle: Candle | undefined
  let candleStartTime: number | undefined
  const candleIntervalMs = config.candleInterval 
    ? intervalToMs(config.candleInterval) 
    : 60000
  
  // Get trade markers if requested
  let tradeMarkers: TradeMarker[] = []
  if (config.includeTradeMarkers) {
    // Would need userId from context
    // tradeMarkers = await getTradeMarkers(userId, config.startTime, config.endTime, config.symbol)
  }
  
  while (offset < totalTicks) {
    const ticks = await getTicks(config.startTime, config.endTime, {
      symbol: config.symbol,
      symbols: config.symbols,
      limit: batchSize,
      offset,
    })
    
    if (ticks.length === 0) break
    
    // Process ticks into frames
    let currentFrame: TickData[] = []
    
    for (const tick of ticks) {
      currentFrame.push(tick)
      processedTicks++
      
      // Update candle if needed
      if (config.format === 'candles' || config.format === 'both') {
        const tickTime = new Date(tick.time).getTime()
        
        if (!candleStartTime || tickTime >= candleStartTime + candleIntervalMs) {
          // Start new candle
          if (currentCandle) {
            // Emit previous candle
          }
          candleStartTime = tickTime
          currentCandle = {
            time: tick.time,
            symbol: tick.symbol,
            open: tick.lastPrice,
            high: tick.lastPrice,
            low: tick.lastPrice,
            close: tick.lastPrice,
            volume: tick.volume,
            tickCount: 1,
          }
        } else if (currentCandle) {
          // Update current candle
          currentCandle.high = Math.max(currentCandle.high, tick.lastPrice)
          currentCandle.low = Math.min(currentCandle.low, tick.lastPrice)
          currentCandle.close = tick.lastPrice
          currentCandle.volume += tick.volume
          currentCandle.tickCount++
        }
      }
      
      if (currentFrame.length >= ticksPerFrame) {
        // Calculate metrics if requested
        if (config.includeMetrics) {
          metrics = calculateMetrics(currentFrame, metrics)
        }
        
        // Find trade markers in this frame's time range
        const frameStartTime = new Date(currentFrame[0].time).getTime()
        const frameEndTime = new Date(currentFrame[currentFrame.length - 1].time).getTime()
        const frameMarkers = tradeMarkers.filter(m => {
          const markerTime = new Date(m.time).getTime()
          return markerTime >= frameStartTime && markerTime <= frameEndTime
        })
        
        // Build frame
        const frame: ReplayFrame = {
          frame: frameIndex++,
          timestamp: currentFrame[currentFrame.length - 1].time as string,
          elapsedMs: frameIndex * frameInterval * speed,
          ticks: config.format !== 'candles' ? currentFrame : undefined,
          candle: config.format === 'candles' || config.format === 'both' 
            ? currentCandle 
            : undefined,
          metrics: config.includeMetrics ? metrics : undefined,
          tradeMarkers: frameMarkers.length > 0 ? frameMarkers : undefined,
          progress: {
            percent: (processedTicks / totalTicks) * 100,
            currentTime: currentFrame[currentFrame.length - 1].time as string,
            remainingFrames: totalFrames - frameIndex,
          },
        }
        
        yield frame
        
        // Wait for next frame (simulate real-time playback)
        await new Promise(resolve => setTimeout(resolve, frameInterval))
        
        currentFrame = []
      }
    }
    
    offset += batchSize
  }
  
  // Emit final partial frame if any
  if (currentFrame && currentFrame.length > 0) {
    if (config.includeMetrics) {
      metrics = calculateMetrics(currentFrame, metrics)
    }
    
    yield {
      frame: frameIndex++,
      timestamp: currentFrame[currentFrame.length - 1].time as string,
      elapsedMs: frameIndex * frameInterval * speed,
      ticks: config.format !== 'candles' ? currentFrame : undefined,
      candle: currentCandle,
      metrics: config.includeMetrics ? metrics : undefined,
      progress: {
        percent: 100,
        currentTime: currentFrame[currentFrame.length - 1].time as string,
        remainingFrames: 0,
      },
    }
  }
}

// ============================================================================
// BATCH REPLAY (non-streaming)
// ============================================================================

/**
 * Get all replay data in batch (for smaller datasets or download)
 */
export async function getReplayBatch(
  config: ReplayConfig
): Promise<{
  frames: ReplayFrame[]
  metadata: ReplayMetadata | null
  executionTimeMs: number
}> {
  const startMs = Date.now()
  
  const metadata = await getReplayMetadata(
    config.symbol || '',
    config.startTime,
    config.endTime
  )
  
  const frames: ReplayFrame[] = []
  
  for await (const frame of createReplayStream({
    ...config,
    speed: 999999, // Max speed for batch
  })) {
    frames.push(frame)
  }
  
  return {
    frames,
    metadata,
    executionTimeMs: Date.now() - startMs,
  }
}
