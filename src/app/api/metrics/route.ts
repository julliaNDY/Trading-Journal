/**
 * Prometheus Metrics Endpoint
 * 
 * GET /api/metrics
 * 
 * Exposes Prometheus-compatible metrics for Grafana scraping.
 * 
 * Security: Should be protected in production or limited to internal network.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMetrics } from '@/lib/metrics/prometheus';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Optional: Add authentication/authorization here
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.METRICS_SECRET_TOKEN}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const metrics = await getMetrics();

    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error retrieving metrics:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve metrics' },
      { status: 500 }
    );
  }
}
