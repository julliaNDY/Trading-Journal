/**
 * Broker Sync Metrics API
 * 
 * GET /api/broker/metrics - Get sync metrics for all brokers
 * GET /api/broker/metrics?brokerType=IBKR - Get metrics for specific broker
 * GET /api/broker/metrics?since=2026-01-01 - Get metrics since date
 */

import { NextRequest, NextResponse } from 'next/server';
import { BrokerType } from '@prisma/client';
import {
  calculateBrokerMetrics,
  calculateAllBrokerMetrics,
  getAllBrokerHealthStatus,
  generateSyncReport,
} from '@/services/broker/monitoring';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const brokerType = searchParams.get('brokerType') as BrokerType | null;
    const sinceParam = searchParams.get('since');
    const format = searchParams.get('format') || 'json'; // json or text
    
    const since = sinceParam ? new Date(sinceParam) : undefined;
    
    // Generate text report
    if (format === 'text') {
      const report = await generateSyncReport(since);
      return new NextResponse(report, {
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }
    
    // Get metrics for specific broker
    if (brokerType) {
      const metrics = await calculateBrokerMetrics(brokerType, since);
      return NextResponse.json(metrics);
    }
    
    // Get metrics for all brokers
    const metrics = await calculateAllBrokerMetrics(since);
    const healthStatuses = await getAllBrokerHealthStatus(since);
    
    return NextResponse.json({
      metrics,
      healthStatuses,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Broker Metrics API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch broker metrics' },
      { status: 500 }
    );
  }
}
