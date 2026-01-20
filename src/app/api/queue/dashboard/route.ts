/**
 * Queue Dashboard API
 * Story 1.7: Redis (Upstash) Production Deployment
 *
 * Provides queue monitoring data for admin dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getDashboardData,
  getQueueHealthCheck,
  exportPrometheusMetrics,
  checkQueueAlerts,
} from '@/lib/queue/dashboard';
import { isRedisConfigured } from '@/lib/queue/redis';

// ============================================================================
// GET /api/queue/dashboard
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role (for now, check if user has admin access via email domain or specific check)
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true },
    });

    // Simple admin check - in production, use a proper role system
    const isAdmin = dbUser?.email?.includes('admin') || 
                    process.env.ADMIN_EMAILS?.split(',').includes(dbUser?.email || '');

    if (!isAdmin && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if Redis is configured
    if (!isRedisConfigured()) {
      return NextResponse.json({
        configured: false,
        message: 'Redis not configured. Set REDIS_URL environment variable.',
      });
    }

    // Get requested format
    const format = request.nextUrl.searchParams.get('format');

    // Prometheus format
    if (format === 'prometheus') {
      const metrics = await exportPrometheusMetrics();
      return new NextResponse(metrics, {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Health check format
    if (format === 'health') {
      const health = await getQueueHealthCheck();
      return NextResponse.json(health, {
        status: health.healthy ? 200 : 503,
      });
    }

    // Alerts only
    if (format === 'alerts') {
      const alerts = await checkQueueAlerts();
      return NextResponse.json({
        alerts,
        hasAlerts: alerts.length > 0,
        criticalCount: alerts.filter((a) => a.level === 'critical').length,
        warningCount: alerts.filter((a) => a.level === 'warning').length,
      });
    }

    // Default: full dashboard data
    const data = await getDashboardData();
    const alerts = await checkQueueAlerts();

    return NextResponse.json({
      ...data,
      alerts,
      configured: true,
    });
  } catch (error) {
    console.error('Queue dashboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
