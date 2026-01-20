/**
 * TimescaleDB POC: OHLCV Candles API
 * 
 * Returns aggregated OHLCV candles for a time range.
 * Uses TimescaleDB continuous aggregates for optimal performance.
 * 
 * Query parameters:
 *   - symbol: Symbol to get candles for (required)
 *   - startTime: ISO timestamp (required)
 *   - endTime: ISO timestamp (required)
 *   - interval: Candle interval (default: '1m')
 *              Options: '1s', '5s', '15s', '30s', '1m', '5m', '15m', '30m', '1h', '4h', '1d'
 * 
 * Examples:
 *   # 1-minute candles
 *   GET /api/timescaledb-poc/candles?symbol=AAPL&startTime=...&endTime=...&interval=1m
 * 
 *   # 5-minute candles
 *   GET /api/timescaledb-poc/candles?symbol=AAPL&startTime=...&endTime=...&interval=5m
 */

import { NextRequest } from 'next/server'
import { getCandles, type CandleInterval } from '@/services/replay'

const VALID_INTERVALS: CandleInterval[] = [
  '1s', '5s', '15s', '30s', '1m', '5m', '15m', '30m', '1h', '4h', '1d'
]

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  
  const symbol = searchParams.get('symbol')
  const startTime = searchParams.get('startTime')
  const endTime = searchParams.get('endTime')
  const interval = (searchParams.get('interval') || '1m') as CandleInterval
  
  // Validate required params
  if (!symbol || !startTime || !endTime) {
    return new Response(
      JSON.stringify({ 
        error: 'Missing required parameters',
        message: 'symbol, startTime, and endTime are required',
        example: '/api/timescaledb-poc/candles?symbol=AAPL&startTime=2026-01-16T09:30:00Z&endTime=2026-01-16T16:00:00Z&interval=5m'
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
  
  // Validate interval
  if (!VALID_INTERVALS.includes(interval)) {
    return new Response(
      JSON.stringify({ 
        error: 'Invalid interval',
        message: `Interval must be one of: ${VALID_INTERVALS.join(', ')}`,
        provided: interval,
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  try {
    const startMs = Date.now()
    const candles = await getCandles(symbol, startTime, endTime, interval)
    const executionTimeMs = Date.now() - startMs
    
    if (candles.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No data found',
          message: `No candle data found for ${symbol} between ${startTime} and ${endTime}`,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
    
    // Calculate summary stats
    const prices = candles.map(c => c.close)
    const volumes = candles.map(c => c.volume)
    
    return new Response(
      JSON.stringify({
        success: true,
        symbol,
        interval,
        startTime,
        endTime,
        candleCount: candles.length,
        executionTimeMs,
        summary: {
          open: candles[0].open,
          high: Math.max(...candles.map(c => c.high)),
          low: Math.min(...candles.map(c => c.low)),
          close: candles[candles.length - 1].close,
          totalVolume: volumes.reduce((a, b) => a + b, 0),
          avgVolume: volumes.reduce((a, b) => a + b, 0) / volumes.length,
          priceChange: candles[candles.length - 1].close - candles[0].open,
          priceChangePercent: ((candles[candles.length - 1].close - candles[0].open) / candles[0].open) * 100,
        },
        candles,
      }),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60', // Cache for 1 minute
        },
      }
    )
  } catch (error) {
    console.error('Candles API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
