/**
 * Alerts API Endpoint
 * Story 1.9: Production Monitoring & Alerting
 *
 * GET /api/observability/alerts - Get alert history
 * POST /api/observability/alerts - Acknowledge an alert or send test alert
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAlertHistory,
  getActiveAlerts,
  acknowledgeAlert,
  sendTestAlert,
  DEFAULT_ALERT_RULES,
  type AlertChannel,
} from '@/lib/observability/alerts';
import { logger } from '@/lib/observability';

// Allow access with API key (for external monitoring tools)
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

  try {
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('active') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const alerts = activeOnly ? getActiveAlerts() : getAlertHistory(limit);

    return NextResponse.json({
      success: true,
      alerts,
      rules: DEFAULT_ALERT_RULES,
      meta: {
        total: alerts.length,
        activeOnly,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error fetching alerts', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch alerts',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

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
    const { action, alertId, acknowledgedBy, channels } = body;

    switch (action) {
      case 'acknowledge': {
        if (!alertId || !acknowledgedBy) {
          return NextResponse.json(
            { error: 'Invalid request', message: 'alertId and acknowledgedBy are required' },
            { status: 400 }
          );
        }

        const success = acknowledgeAlert(alertId, acknowledgedBy);

        return NextResponse.json({
          success,
          message: success ? 'Alert acknowledged' : 'Alert not found',
        });
      }

      case 'test': {
        const testChannels: AlertChannel[] = channels || ['slack', 'discord'];
        await sendTestAlert(testChannels);

        return NextResponse.json({
          success: true,
          message: `Test alert sent to: ${testChannels.join(', ')}`,
        });
      }

      default:
        return NextResponse.json(
          {
            error: 'Unknown action',
            availableActions: ['acknowledge', 'test'],
          },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Error processing alert action', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process action',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
