/**
 * Broker Sync Scheduler API Endpoint
 * 
 * This endpoint is designed to be called by:
 * 1. A cron job (IONOS Scheduled Task, etc.)
 * 2. Vercel Cron (if deployed on Vercel)
 * 3. GitHub Actions or other CI/CD pipelines
 * 
 * Security:
 * - Requires SCHEDULER_SECRET header to match SCHEDULER_SECRET env var
 * - Or can be called from localhost for development
 * 
 * Usage:
 * curl -X POST https://your-domain.com/api/scheduler/broker-sync \
 *   -H "Authorization: Bearer YOUR_SCHEDULER_SECRET"
 * 
 * Vercel Cron config (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/scheduler/broker-sync",
 *     "schedule": "* /15 * * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { runScheduledSync, getSchedulerStatus } from '@/services/broker/scheduler';
import { brokerLogger } from '@/lib/logger';

// ============================================================================
// AUTH HELPER
// ============================================================================

function validateRequest(request: NextRequest): boolean {
  // Allow localhost in development
  const host = request.headers.get('host') || '';
  if (process.env.NODE_ENV === 'development' && (host.includes('localhost') || host.includes('127.0.0.1'))) {
    return true;
  }
  
  // Check for Vercel Cron secret (Vercel automatically adds this)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || process.env.SCHEDULER_SECRET;
  
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }
  
  // Check for custom header
  const schedulerSecret = request.headers.get('x-scheduler-secret');
  if (schedulerSecret && schedulerSecret === cronSecret) {
    return true;
  }
  
  return false;
}

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * POST /api/scheduler/broker-sync
 * 
 * Triggers the broker sync scheduler.
 * This will sync all eligible broker connections.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Validate request
  if (!validateRequest(request)) {
    brokerLogger.debug('[Scheduler API] Unauthorized request');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  brokerLogger.debug('[Scheduler API] Starting scheduled sync...');
  
  try {
    const result = await runScheduledSync();
    
    return NextResponse.json({
      success: result.success,
      message: `Synced ${result.connectionsSynced}/${result.connectionsChecked} connections`,
      data: {
        connectionsChecked: result.connectionsChecked,
        connectionsSynced: result.connectionsSynced,
        tradesImported: result.totalTradesImported,
        tradesSkipped: result.totalTradesSkipped,
        errors: result.errors.length,
        durationMs: result.durationMs,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
    
  } catch (error) {
    brokerLogger.error('[Scheduler API] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Scheduler failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scheduler/broker-sync
 * 
 * Returns the current status of all broker connections and their sync schedule.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Validate request
  if (!validateRequest(request)) {
    brokerLogger.debug('[Scheduler API] Unauthorized request');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  try {
    const status = await getSchedulerStatus();
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: status,
    });
    
  } catch (error) {
    brokerLogger.error('[Scheduler API] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get scheduler status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// VERCEL CRON CONFIGURATION
// ============================================================================

// Edge runtime configuration for Vercel Cron.
// Run every 15 minutes by default.
// Add to vercel.json:
// {
//   "crons": [{
//     "path": "/api/scheduler/broker-sync",
//     "schedule": "*/15 * * * *"
//   }]
// }

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max for scheduler
