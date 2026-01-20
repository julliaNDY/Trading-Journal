/**
 * Readiness Check
 * Story 1.9: Production Monitoring & Alerting
 *
 * GET /api/health/ready - Check if all critical services are ready
 *
 * Returns 503 if any critical service is unhealthy.
 * Use this for Kubernetes readiness probes.
 */

import { NextResponse } from 'next/server';
import { runHealthChecks, aggregateHealthStatus } from '@/lib/observability/health';

export async function GET() {
  const result = await runHealthChecks();

  // Determine if service is ready to accept traffic
  const isReady = result.status !== 'unhealthy';

  return NextResponse.json(
    {
      ready: isReady,
      status: result.status,
      timestamp: result.timestamp,
      version: result.version,
      environment: result.environment,
      uptime: result.uptime,
      services: result.services.map((s) => ({
        name: s.name,
        status: s.status,
        latencyMs: s.latencyMs,
        message: s.message,
      })),
    },
    { status: isReady ? 200 : 503 }
  );
}
