/**
 * Vector DB Health Check API
 * 
 * GET /api/vectordb/health
 * Returns Qdrant connection status and collection stats
 */

import { NextResponse } from 'next/server';
import {
  getQdrantClient,
  isQdrantConfigured,
  getCollectionStats,
} from '@/lib/qdrant';
import { logger } from '@/lib/observability';

export async function GET() {
  const startTime = Date.now();

  try {
    // Check if configured
    if (!isQdrantConfigured()) {
      return NextResponse.json({
        status: 'not_configured',
        message: 'QDRANT_URL not set',
        configured: false,
        healthy: false,
      }, { status: 503 });
    }

    // Check health
    const client = getQdrantClient();
    const healthy = await client.isHealthy();

    if (!healthy) {
      return NextResponse.json({
        status: 'unhealthy',
        message: 'Cannot connect to Qdrant',
        configured: true,
        healthy: false,
      }, { status: 503 });
    }

    // Get collection stats
    const stats = await getCollectionStats();
    const latency = Date.now() - startTime;

    logger.debug('Qdrant health check', { healthy: true, latency });

    return NextResponse.json({
      status: 'healthy',
      configured: true,
      healthy: true,
      latencyMs: latency,
      collections: stats,
    });
  } catch (error) {
    logger.error('Qdrant health check failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      configured: isQdrantConfigured(),
      healthy: false,
    }, { status: 500 });
  }
}
