/**
 * Health Check Endpoint
 * Story 1.9: Production Monitoring & Alerting
 *
 * GET /api/observability/health - Basic health check
 * POST /api/observability/health - Test error tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  logger,
  captureException,
  captureMessage,
  isSentryEnabled,
  recordMetric,
  getMetricStats,
} from '@/lib/observability';
import { runHealthChecks, type HealthStatus } from '@/lib/observability/health';

export async function GET(request: NextRequest) {
  const startTime = performance.now();

  // Check if full health check is requested
  const searchParams = request.nextUrl.searchParams;
  const full = searchParams.get('full') === 'true';

  // Log health check
  logger.debug('Health check requested', { full });

  // Record metric
  recordMetric('health.check', 1, 'count');

  if (full) {
    // Run full health checks on all services
    const healthResult = await runHealthChecks();
    healthResult.services.push({
      name: 'observability',
      status: 'healthy',
      latencyMs: 0,
      details: {
        sentry: isSentryEnabled() ? 'enabled' : 'disabled',
        axiom: process.env.AXIOM_TOKEN ? 'configured' : 'not configured',
      },
    });

    const httpStatus = getHttpStatusForHealth(healthResult.status);

    return NextResponse.json(
      {
        ...healthResult,
        latencyMs: Math.round(performance.now() - startTime),
      },
      { status: httpStatus }
    );
  }

  // Basic health check (fast, for load balancers)
  const healthStats = getMetricStats('health.check');
  const apiStats = getMetricStats('api.response_time');

  const response = {
    status: 'healthy' as HealthStatus,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || process.env.npm_package_version || 'dev',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    observability: {
      sentry: {
        enabled: isSentryEnabled(),
        dsn: process.env.SENTRY_DSN ? 'configured' : 'not configured',
      },
      logging: {
        axiom: process.env.AXIOM_TOKEN ? 'configured' : 'not configured',
        logtail: process.env.LOGTAIL_TOKEN ? 'configured' : 'not configured',
      },
      vercelAnalytics: {
        enabled: !!process.env.VERCEL,
      },
    },
    metrics: {
      healthChecks: healthStats,
      apiResponseTime: apiStats,
    },
    latencyMs: Math.round(performance.now() - startTime),
  };

  return NextResponse.json(response);
}

function getHttpStatusForHealth(status: HealthStatus): number {
  switch (status) {
    case 'healthy':
      return 200;
    case 'degraded':
      return 200; // Still return 200 for degraded (service available but with issues)
    case 'unhealthy':
      return 503; // Service Unavailable
    default:
      return 200;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'test-error': {
        // Test error tracking
        const testError = new Error('Test error from observability endpoint');
        const eventId = captureException(testError, { test: true, source: 'health-endpoint' });

        logger.error('Test error captured', testError, { eventId });

        return NextResponse.json({
          success: true,
          action: 'test-error',
          eventId,
          message: 'Error captured and sent to Sentry (if configured)',
        });
      }

      case 'test-message': {
        // Test message capture
        const eventId = captureMessage('Test message from observability endpoint', 'info', {
          test: true,
          source: 'health-endpoint',
        });

        logger.info('Test message sent', { eventId });

        return NextResponse.json({
          success: true,
          action: 'test-message',
          eventId,
          message: 'Message captured and sent to Sentry (if configured)',
        });
      }

      case 'test-log': {
        // Test different log levels
        logger.debug('Debug log test');
        logger.info('Info log test');
        logger.warn('Warning log test');
        logger.error('Error log test');

        return NextResponse.json({
          success: true,
          action: 'test-log',
          message: 'Logs sent at all levels (debug, info, warn, error)',
        });
      }

      default:
        return NextResponse.json(
          {
            error: 'Unknown action',
            availableActions: ['test-error', 'test-message', 'test-log'],
          },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Error in observability test endpoint', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
