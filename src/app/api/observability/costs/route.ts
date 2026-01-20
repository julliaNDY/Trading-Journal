/**
 * Cost Monitoring API Endpoint
 * Story 1.9: Production Monitoring & Alerting
 *
 * GET /api/observability/costs - Get cost summary
 * POST /api/observability/costs - Track API usage
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCostSummary,
  trackGeminiUsage,
  trackOpenAIUsage,
  trackStripeUsage,
  trackVisionUsage,
  COST_ESTIMATES,
} from '@/lib/observability/cost-tracking';
import { logger } from '@/lib/observability';

// Allow access with API key (for internal services)
const METRICS_API_KEY = process.env.METRICS_API_KEY;

function isAuthorized(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key');
  if (METRICS_API_KEY && apiKey === METRICS_API_KEY) {
    return true;
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && METRICS_API_KEY) {
    const token = authHeader.slice(7);
    if (token === METRICS_API_KEY) {
      return true;
    }
  }

  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Valid API key required' },
      { status: 401 }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const hoursBack = parseInt(searchParams.get('hours') || '24', 10);
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const summary = getCostSummary(since);

    return NextResponse.json({
      success: true,
      summary,
      costEstimates: COST_ESTIMATES,
      meta: {
        hoursBack,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error generating cost summary', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate cost summary',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Valid API key required' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { service, operation, userId, ...params } = body;

    if (!service || !operation) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'service and operation are required' },
        { status: 400 }
      );
    }

    switch (service) {
      case 'gemini':
        trackGeminiUsage(
          operation,
          params.inputTokens || 0,
          params.outputTokens || 0,
          userId
        );
        break;
      case 'openai':
        trackOpenAIUsage(operation, params.durationSeconds || 0, userId);
        break;
      case 'stripe':
        trackStripeUsage(operation, userId);
        break;
      case 'vision':
        trackVisionUsage(operation, params.imageCount || 1, userId);
        break;
      default:
        return NextResponse.json(
          { error: 'Unknown service', availableServices: ['gemini', 'openai', 'stripe', 'vision'] },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      tracked: { service, operation, userId, ...params },
    });
  } catch (error) {
    logger.error('Error tracking cost', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to track cost',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
