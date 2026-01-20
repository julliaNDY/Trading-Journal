/**
 * Database Health Check
 * Story 1.9: Production Monitoring & Alerting
 *
 * GET /api/health/db - Check database connectivity
 */

import { NextResponse } from 'next/server';
import { checkDatabase } from '@/lib/observability/health';

export async function GET() {
  const result = await checkDatabase();

  const httpStatus = result.status === 'healthy' ? 200 : 503;

  return NextResponse.json(result, { status: httpStatus });
}
