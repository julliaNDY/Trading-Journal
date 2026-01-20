/**
 * Broker Sync Job
 * Story 1.7: Redis (Upstash) Production Deployment
 *
 * Fetches trades from broker APIs and syncs them to the database.
 */

import type { Job } from 'bullmq';
import { logger } from '@/lib/observability';
import { JOB_TYPES } from '../config';

// ============================================================================
// Types
// ============================================================================

export interface BrokerSyncJobData {
  /** Broker connection ID */
  connectionId: string;
  /** User ID */
  userId: string;
  /** Sync type: full or incremental */
  syncType: 'full' | 'incremental';
  /** Optional date range for sync */
  dateRange?: {
    from: string; // ISO date
    to: string; // ISO date
  };
}

export interface BrokerSyncJobResult {
  success: boolean;
  tradesImported: number;
  tradesSkipped: number;
  tradesUpdated: number;
  errors?: string[];
  durationMs: number;
}

// ============================================================================
// Job Processor
// ============================================================================

/**
 * Process broker sync job
 * 
 * Integrates with broker sync service to fetch and import trades.
 * Story 3.5: Broker Sync - Scheduler & Auto-Sync
 */
export async function processBrokerSyncJob(
  job: Job<BrokerSyncJobData>
): Promise<BrokerSyncJobResult> {
  const startTime = performance.now();
  const { connectionId, userId, syncType } = job.data;

  logger.info('Processing broker sync job', {
    jobId: job.id,
    connectionId,
    userId,
    syncType,
  });

  try {
    // Update progress: starting
    await job.updateProgress(10);

    // Import broker sync service dynamically to avoid circular dependencies
    const { syncBrokerTrades } = await import('@/services/broker/broker-sync-service');

    // Update progress: syncing
    await job.updateProgress(30);

    // Execute sync (scheduled type for automatic syncs)
    const syncResult = await syncBrokerTrades(
      connectionId,
      userId,
      'scheduled'
    );

    // Update progress: complete
    await job.updateProgress(100);

    const result: BrokerSyncJobResult = {
      success: syncResult.success,
      tradesImported: syncResult.tradesImported,
      tradesSkipped: syncResult.tradesSkipped,
      tradesUpdated: syncResult.tradesUpdated,
      errors: syncResult.errors.map(e => e.message),
      durationMs: Math.round(performance.now() - startTime),
    };

    logger.info('Broker sync job completed', {
      jobId: job.id,
      result,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Broker sync job failed', error, {
      jobId: job.id,
      connectionId,
      userId,
    });

    return {
      success: false,
      tradesImported: 0,
      tradesSkipped: 0,
      tradesUpdated: 0,
      errors: [errorMessage],
      durationMs: Math.round(performance.now() - startTime),
    };
  }
}

// ============================================================================
// Job Names
// ============================================================================

export const BROKER_SYNC_JOBS = {
  FETCH: JOB_TYPES.BROKER_SYNC_FETCH,
  SCHEDULED: JOB_TYPES.BROKER_SYNC_SCHEDULED,
} as const;
