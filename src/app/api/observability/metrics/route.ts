/**
 * Metrics Dashboard API Endpoint
 * Story 1.9: Production Monitoring & Alerting
 *
 * GET /api/observability/metrics - Get aggregated dashboard metrics
 *
 * Protected endpoint - requires admin access or valid API key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDashboardMetrics, checkAlertThresholds, DEFAULT_THRESHOLDS } from '@/lib/observability/dashboards';
import { logger } from '@/lib/observability';

// Allow metrics access with API key (for external monitoring tools)
const METRICS_API_KEY = process.env.METRICS_API_KEY;

function isAuthorized(request: NextRequest): boolean {
  // Check for API key in header
  const apiKey = request.headers.get('x-api-key');
  if (METRICS_API_KEY && apiKey === METRICS_API_KEY) {
    return true;
  }

  // Check for Bearer token
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && METRICS_API_KEY) {
    const token = authHeader.slice(7);
    if (token === METRICS_API_KEY) {
      return true;
    }
  }

  // In development, allow access without auth
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  // Check authorization
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Valid API key required' },
      { status: 401 }
    );
  }

  const startTime = performance.now();

  try {
    // Get period from query params (default 60 minutes)
    const searchParams = request.nextUrl.searchParams;
    const period = parseInt(searchParams.get('period') || '60', 10);

    // Validate period (max 24 hours)
    const validPeriod = Math.min(Math.max(period, 1), 1440);

    // Get metrics
    const metrics = getDashboardMetrics(validPeriod);

    // Check for alerts
    const alerts = checkAlertThresholds(metrics, DEFAULT_THRESHOLDS);

    const response = {
      success: true,
      metrics,
      alerts,
      thresholds: DEFAULT_THRESHOLDS,
      meta: {
        periodMinutes: validPeriod,
        generatedAt: new Date().toISOString(),
        latencyMs: Math.round(performance.now() - startTime),
      },
    };

    logger.debug('Metrics endpoint accessed', { period: validPeriod, alertCount: alerts.length });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error generating metrics', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/observability/metrics
 *
 * Record a custom metric (for external services or edge functions)
 */
export async function POST(request: NextRequest) {
  // Check authorization
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Valid API key required' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { name, value, unit, tags } = body;

    // Validate required fields
    if (!name || typeof value !== 'number') {
      return NextResponse.json(
        { error: 'Invalid request', message: 'name and value (number) are required' },
        { status: 400 }
      );
    }

    // Import dynamically to avoid circular dependencies
    const { recordMetric } = await import('@/lib/observability/metrics');

    recordMetric(name, value, unit || 'count', tags);

    return NextResponse.json({
      success: true,
      recorded: { name, value, unit: unit || 'count', tags },
    });
  } catch (error) {
    logger.error('Error recording metric', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to record metric',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
