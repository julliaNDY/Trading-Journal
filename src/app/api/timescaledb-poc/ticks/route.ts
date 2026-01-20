/**
 * TimescaleDB POC: Raw Ticks API
 * 
 * Returns raw tick data for a time range (non-streaming).
 * Supports pagination for large datasets.
 * 
 * Query parameters:
 *   - startTime: ISO timestamp (required)
 *   - endTime: ISO timestamp (required)
 *   - symbol: Symbol filter (optional)
 *   - limit: Max ticks to return (default: 10000, max: 100000)
 *   - offset: Pagination offset (default: 0)
 * 
 * Examples:
 *   # Get first 10000 ticks
 *   GET /api/timescaledb-poc/ticks?symbol=AAPL&startTime=...&endTime=...
 * 
 *   # Pagination (next page)
 *   GET /api/timescaledb-poc/ticks?symbol=AAPL&startTime=...&endTime=...&offset=10000
 */

import { NextRequest } from 'next/server'
import { getTicks, getReplayMetadata } from '@/services/replay'

const MAX_LIMIT = 100000
const DEFAULT_LIMIT = 10000

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  
  const startTime = searchParams.get('startTime')
  const endTime = searchParams.get('endTime')
  const symbol = searchParams.get('symbol') || undefined
  const limit = Math.min(parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT)), MAX_LIMIT)
  const offset = parseInt(searchParams.get('offset') || '0')
  
  // Validate required params
  if (!startTime || !endTime) {
    return new Response(
      JSON.stringify({ 
        error: 'Missing required parameters',
        message: 'startTime and endTime are required',
        example: '/api/timescaledb-poc/ticks?startTime=2026-01-16T09:30:00Z&endTime=2026-01-16T10:00:00Z&symbol=AAPL'
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  try {
    const startMs = Date.now()
    
    // Get ticks
    const ticks = await getTicks(startTime, endTime, { symbol, limit, offset })
    
    // Get metadata for total count
    const metadata = symbol ? await getReplayMetadata(symbol, startTime, endTime) : null
    const totalTicks = metadata?.tickCount || ticks.length
    
    const executionTimeMs = Date.now() - startMs
    
    if (ticks.length === 0 && offset === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No data found',
          message: `No tick data found ${symbol ? `for ${symbol} ` : ''}between ${startTime} and ${endTime}`,
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
        query: {
          startTime,
          endTime,
          symbol: symbol || 'all',
          limit,
          offset,
        },
        pagination: {
          returned: ticks.length,
          total: totalTicks,
          hasMore: offset + ticks.length < totalTicks,
          nextOffset: offset + ticks.length < totalTicks ? offset + limit : null,
        },
        executionTimeMs,
        ticks,
      }),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    console.error('Ticks API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
