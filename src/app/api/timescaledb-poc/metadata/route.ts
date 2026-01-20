/**
 * TimescaleDB POC: Replay Metadata API
 * 
 * Returns metadata for a specific symbol and time range:
 * - Tick count
 * - Price range (OHLC)
 * - Data quality metrics
 * - Estimated size
 * 
 * Query parameters:
 *   - symbol: Symbol to get metadata for (required)
 *   - startTime: ISO timestamp (required)
 *   - endTime: ISO timestamp (required)
 * 
 * Example:
 *   GET /api/timescaledb-poc/metadata?symbol=AAPL&startTime=2026-01-16T00:00:00Z&endTime=2026-01-17T00:00:00Z
 */

import { NextRequest } from 'next/server'
import { getReplayMetadata } from '@/services/replay'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  
  const symbol = searchParams.get('symbol')
  const startTime = searchParams.get('startTime')
  const endTime = searchParams.get('endTime')
  
  if (!symbol || !startTime || !endTime) {
    return new Response(
      JSON.stringify({ 
        error: 'Missing required parameters',
        message: 'symbol, startTime, and endTime are required',
        example: '/api/timescaledb-poc/metadata?symbol=AAPL&startTime=2026-01-16T00:00:00Z&endTime=2026-01-17T00:00:00Z'
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  try {
    const metadata = await getReplayMetadata(symbol, startTime, endTime)
    
    if (!metadata) {
      return new Response(
        JSON.stringify({ 
          error: 'No data found',
          message: `No tick data found for ${symbol} between ${startTime} and ${endTime}`,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        metadata,
        // Helpful info for client
        estimatedReplayDuration: {
          '1x': `${Math.round(metadata.tickCount / 60)} seconds`,
          '2x': `${Math.round(metadata.tickCount / 120)} seconds`,
          '4x': `${Math.round(metadata.tickCount / 240)} seconds`,
          '10x': `${Math.round(metadata.tickCount / 600)} seconds`,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Metadata API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
