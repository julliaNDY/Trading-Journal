/**
 * Basic Health Check
 * Story 1.9: Production Monitoring & Alerting
 *
 * GET /api/health - Basic liveness probe
 *
 * Simple endpoint for load balancers and uptime monitors.
 * Does NOT check external dependencies (use /api/health/ready for that).
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
