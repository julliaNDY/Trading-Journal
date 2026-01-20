/**
 * TimescaleDB POC: Replay System Info API
 * 
 * Returns information about the replay system:
 * - Available data (symbols, date range)
 * - TimescaleDB status
 * - Compression status
 * 
 * Example:
 *   GET /api/timescaledb-poc/info
 */

import { NextRequest } from 'next/server'
import { getReplayInfo } from '@/services/replay'

export async function GET(request: NextRequest) {
  try {
    const info = await getReplayInfo()
    
    return new Response(
      JSON.stringify({
        success: true,
        ...info,
        capabilities: {
          streaming: true,
          batch: true,
          candles: true,
          metrics: true,
          tradeMarkers: true,
          speedControl: { min: 0.1, max: 100 },
          fpsControl: { min: 1, max: 120 },
          candleIntervals: ['1s', '5s', '15s', '30s', '1m', '5m', '15m', '30m', '1h', '4h', '1d'],
        },
        endpoints: {
          info: '/api/timescaledb-poc/info',
          metadata: '/api/timescaledb-poc/metadata',
          replay: '/api/timescaledb-poc/replay',
          candles: '/api/timescaledb-poc/candles',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Info API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
