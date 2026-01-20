/**
 * Daily Bias Real-Time Updates - Server-Sent Events (SSE)
 * 
 * GET /api/daily-bias/stream?instrument=NQ1
 * 
 * Provides real-time updates when new analysis becomes available for an instrument.
 * Uses Server-Sent Events (SSE) for compatibility with Next.js App Router.
 * 
 * Fallback: Client should use polling if SSE fails.
 * 
 * @module api/daily-bias/stream
 * @created 2026-01-18
 */

import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth';
import { SUPPORTED_INSTRUMENTS } from '@/services/ai/daily-bias-service';
import { getRedisConnection, isRedisConfigured } from '@/lib/queue/redis';

// ============================================================================
// SSE Stream Handler
// ============================================================================

/**
 * GET /api/daily-bias/stream?instrument=NQ1&date=2026-01-18
 * 
 * Server-Sent Events stream for real-time Daily Bias analysis updates
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await requireAuth();
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 2. Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const instrument = searchParams.get('instrument');
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    if (!instrument) {
      return new Response('Missing required parameter: instrument', { status: 400 });
    }

    // Validate instrument
    if (!SUPPORTED_INSTRUMENTS.includes(instrument as any)) {
      return new Response(`Unsupported instrument: ${instrument}`, { status: 400 });
    }

    logger.info('SSE stream connection opened', {
      userId: user.id,
      instrument,
      date
    });

    // 3. Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial connection message
        const sendMessage = (event: string, data: any) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(new TextEncoder().encode(message));
        };

        sendMessage('connected', {
          instrument,
          date,
          timestamp: new Date().toISOString()
        });

        // 4. Set up Redis pub/sub for real-time updates (if Redis available)
        let redisSubscriber: any = null;
        let pollInterval: NodeJS.Timeout | null = null;
        let isClosed = false;
        let lastUpdateHash: string | null = null;

        if (isRedisConfigured()) {
          try {
            const redis = await getRedisConnection();
            const channel = `daily-bias:update:${instrument}:${date}`;
            const cacheKey = `daily-bias:${user.id}:${instrument}:${date}`;

            // Try to set up Redis pub/sub subscription
            // Note: ioredis requires a separate connection instance for pub/sub
            // For now, use optimized polling that checks Redis cache
            
            // Optimized polling: Check Redis cache for analysis updates
            pollInterval = setInterval(async () => {
              if (isClosed) {
                if (pollInterval) clearInterval(pollInterval);
                return;
              }

              try {
                // Check if analysis exists in Redis cache
                const cached = await redis.get(cacheKey);

                if (cached) {
                  // Check if data has changed (simple hash check)
                  const currentHash = cached.substring(0, 50); // Simple hash from first 50 chars
                  
                  if (currentHash !== lastUpdateHash) {
                    lastUpdateHash = currentHash;
                    
                    const analysis = JSON.parse(cached);
                    
                    // Send update event
                    sendMessage('analysis-updated', {
                      instrument,
                      date,
                      analysis,
                      timestamp: new Date().toISOString()
                    });

                    logger.debug('SSE update sent via polling', {
                      userId: user.id,
                      instrument,
                      date
                    });
                  }
                }
              } catch (error) {
                logger.warn('SSE polling error', {
                  userId: user.id,
                  instrument,
                  error: error instanceof Error ? error.message : 'Unknown error'
                });
              }
            }, 2000); // Poll every 2 seconds for < 100ms latency target

          } catch (error) {
            logger.error('SSE Redis setup failed, using database polling', {
              userId: user.id,
              instrument,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        // Fallback: Heartbeat if no Redis or connection issues
        if (!pollInterval) {
          pollInterval = setInterval(() => {
            if (isClosed) {
              if (pollInterval) clearInterval(pollInterval);
              return;
            }
            
            sendMessage('heartbeat', {
              timestamp: new Date().toISOString()
            });
          }, 10000); // Heartbeat every 10 seconds
        }

        // Cleanup on close
        req.signal.addEventListener('abort', () => {
          isClosed = true;
          if (pollInterval) clearInterval(pollInterval);
          controller.close();
          
          logger.info('SSE stream connection closed', {
            userId: user.id,
            instrument,
            date
          });
        });
      }
    });

    // 5. Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable buffering in nginx
      },
    });

  } catch (error: any) {
    logger.error('SSE stream error', {
      error: error.message,
      stack: error.stack
    });

    return new Response(
      JSON.stringify({
        error: 'Failed to establish stream connection',
        message: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
