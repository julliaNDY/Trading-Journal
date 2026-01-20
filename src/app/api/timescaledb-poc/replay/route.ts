/**
 * TimescaleDB POC: Enhanced Replay Streaming API
 * 
 * Features:
 * - Streaming replay with Server-Sent Events (60fps)
 * - Speed control (0.5x to 10x)
 * - OHLCV candle aggregation (1s to 1d intervals)
 * - Real-time metrics calculation
 * - Trade marker overlay
 * - Seek/jump functionality
 * - Progress tracking
 * 
 * Query parameters:
 *   - startTime: ISO timestamp (required)
 *   - endTime: ISO timestamp (required)
 *   - symbol: Symbol to replay (optional)
 *   - fps: Frames per second (default: 60)
 *   - speed: Playback speed multiplier (default: 1)
 *   - format: 'ticks' | 'candles' | 'both' (default: 'ticks')
 *   - candleInterval: '1s' | '5s' | '1m' | '5m' | '15m' | '1h' | '4h' | '1d' (default: '1m')
 *   - includeMetrics: 'true' | 'false' (default: 'false')
 *   - seekTo: ISO timestamp to jump to (optional)
 *   - batch: 'true' for non-streaming batch response (default: 'false')
 * 
 * Examples:
 *   # Basic streaming replay
 *   GET /api/timescaledb-poc/replay?startTime=2026-01-16T00:00:00Z&endTime=2026-01-17T00:00:00Z&symbol=AAPL
 * 
 *   # Fast forward at 4x speed with candles
 *   GET /api/timescaledb-poc/replay?startTime=...&endTime=...&speed=4&format=candles&candleInterval=5m
 * 
 *   # With metrics and seek
 *   GET /api/timescaledb-poc/replay?startTime=...&endTime=...&includeMetrics=true&seekTo=2026-01-16T09:30:00Z
 */

import { NextRequest } from 'next/server'
import { 
  createReplayStream, 
  getReplayBatch,
  type ReplayConfig,
  type CandleInterval,
} from '@/services/replay'

/**
 * Stream tick data for replay (GET - Server-Sent Events)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  
  // Parse required parameters
  const startTime = searchParams.get('startTime')
  const endTime = searchParams.get('endTime')
  
  if (!startTime || !endTime) {
    return new Response(
      JSON.stringify({ 
        error: 'Missing required parameters',
        message: 'startTime and endTime are required',
        example: '/api/timescaledb-poc/replay?startTime=2026-01-16T00:00:00Z&endTime=2026-01-17T00:00:00Z'
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
  
  // Parse optional parameters
  const config: ReplayConfig = {
    startTime,
    endTime,
    symbol: searchParams.get('symbol') || undefined,
    fps: parseInt(searchParams.get('fps') || '60'),
    speed: parseFloat(searchParams.get('speed') || '1'),
    format: (searchParams.get('format') as 'ticks' | 'candles' | 'both') || 'ticks',
    candleInterval: (searchParams.get('candleInterval') as CandleInterval) || '1m',
    includeMetrics: searchParams.get('includeMetrics') === 'true',
    seekTo: searchParams.get('seekTo') || undefined,
  }
  
  // Validate speed
  if (config.speed && (config.speed < 0.1 || config.speed > 100)) {
    return new Response(
      JSON.stringify({ 
        error: 'Invalid speed',
        message: 'Speed must be between 0.1 and 100',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
  
  // Validate fps
  if (config.fps && (config.fps < 1 || config.fps > 120)) {
    return new Response(
      JSON.stringify({ 
        error: 'Invalid fps',
        message: 'FPS must be between 1 and 120',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
  
  // Batch mode (non-streaming)
  if (searchParams.get('batch') === 'true') {
    try {
      const result = await getReplayBatch(config)
      return new Response(
        JSON.stringify({
          success: true,
          config,
          ...result,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (error) {
      console.error('Batch replay error:', error)
      return new Response(
        JSON.stringify({ error: 'Batch replay failed', details: String(error) }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }

  // Streaming mode (Server-Sent Events)
  try {
    const encoder = new TextEncoder()
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial config
          controller.enqueue(
            encoder.encode(`event: config\ndata: ${JSON.stringify(config)}\n\n`)
          )
          
          // Stream frames
          for await (const frame of createReplayStream(config)) {
            const frameData = JSON.stringify(frame)
            controller.enqueue(
              encoder.encode(`event: frame\ndata: ${frameData}\n\n`)
            )
          }
          
          // Send completion
          controller.enqueue(
            encoder.encode(`event: complete\ndata: {"done": true}\n\n`)
          )
          controller.close()
        } catch (error) {
          console.error('Replay streaming error:', error)
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`)
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    })
  } catch (error) {
    console.error('Replay API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
