/**
 * Redis Health Check
 * Story 1.9: Production Monitoring & Alerting
 *
 * GET /api/health/redis - Check Redis connectivity
 */

import { NextResponse } from 'next/server';
import { checkRedis } from '@/lib/observability/health';

export async function GET() {
  const result = await checkRedis();

  // Return 200 for healthy or degraded (not configured is acceptable)
  const httpStatus = result.status === 'unhealthy' ? 503 : 200;

  return NextResponse.json(result, { status: httpStatus });
}
