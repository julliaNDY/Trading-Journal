/**
 * Broker Sync Scheduler
 * 
 * Handles automatic synchronization of broker trades at configurable intervals.
 * 
 * This scheduler is designed to be triggered by:
 * 1. A cron job calling the /api/scheduler/broker-sync endpoint
 * 2. A Vercel Cron (if deployed on Vercel)
 * 3. An external service like GitHub Actions or IONOS Scheduled Tasks
 * 
 * The scheduler:
 * - Finds all broker connections with sync enabled
 * - Checks if enough time has passed since last sync (based on syncIntervalMin)
 * - Runs sync for connections that are due
 * - Logs all operations for monitoring
 */

import prisma from '@/lib/prisma';
import { syncBrokerTrades } from './broker-sync-service';
import { brokerLogger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface SchedulerResult {
  success: boolean;
  connectionsChecked: number;
  connectionsSynced: number;
  totalTradesImported: number;
  totalTradesSkipped: number;
  errors: SchedulerError[];
  durationMs: number;
}

export interface SchedulerError {
  connectionId: string;
  brokerType: string;
  brokerAccountName: string | null;
  error: string;
}

// ============================================================================
// SCHEDULER
// ============================================================================

/**
 * Runs the scheduled sync for all eligible broker connections.
 * 
 * A connection is eligible if:
 * - status is 'CONNECTED'
 * - syncEnabled is true
 * - lastSyncAt is null OR enough time has passed based on syncIntervalMin
 */
export async function runScheduledSync(): Promise<SchedulerResult> {
  const startTime = Date.now();
  
  const result: SchedulerResult = {
    success: false,
    connectionsChecked: 0,
    connectionsSynced: 0,
    totalTradesImported: 0,
    totalTradesSkipped: 0,
    errors: [],
    durationMs: 0,
  };
  
  try {
    // Find all connections that need to be synced
    const connections = await prisma.brokerConnection.findMany({
      where: {
        status: 'CONNECTED',
        syncEnabled: true,
      },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });
    
    result.connectionsChecked = connections.length;
    
    const now = new Date();
    
    for (const connection of connections) {
      // Check if sync is due
      const isDue = isSyncDue(connection.lastSyncAt, connection.syncIntervalMin, now);
      
      if (!isDue) {
        continue;
      }
      
      // Run sync with retry logic
      try {
        brokerLogger.debug(`[Scheduler] Syncing connection ${connection.id} (${connection.brokerType}/${connection.brokerAccountName})`);
        
        const syncResult = await syncWithRetry(
          connection.id,
          connection.userId,
          connection.brokerType,
          connection.brokerAccountName
        );
        
        result.connectionsSynced++;
        result.totalTradesImported += syncResult.tradesImported;
        result.totalTradesSkipped += syncResult.tradesSkipped;
        
        brokerLogger.debug(`[Scheduler] Sync complete for ${connection.id}: ${syncResult.tradesImported} imported, ${syncResult.tradesSkipped} skipped`);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        brokerLogger.error(`[Scheduler] Sync failed after retries for ${connection.id}:`, errorMessage);
        
        result.errors.push({
          connectionId: connection.id,
          brokerType: connection.brokerType,
          brokerAccountName: connection.brokerAccountName,
          error: errorMessage,
        });
        
        // Mark connection as ERROR after max retries
        await prisma.brokerConnection.update({
          where: { id: connection.id },
          data: {
            status: 'ERROR',
            lastSyncError: `Max retries exceeded: ${errorMessage}`,
          },
        });
      }
    }
    
    result.success = true;
    
  } catch (error) {
    brokerLogger.error('[Scheduler] Fatal error:', error);
    result.errors.push({
      connectionId: 'scheduler',
      brokerType: 'N/A',
      brokerAccountName: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  
  result.durationMs = Date.now() - startTime;
  
  brokerLogger.debug(`[Scheduler] Completed in ${result.durationMs}ms: ${result.connectionsSynced}/${result.connectionsChecked} synced, ${result.totalTradesImported} trades imported`);
  
  return result;
}

/**
 * Checks if a sync is due based on last sync time and interval.
 */
function isSyncDue(
  lastSyncAt: Date | null,
  intervalMinutes: number,
  now: Date = new Date()
): boolean {
  if (!lastSyncAt) {
    // Never synced - sync is due
    return true;
  }
  
  const lastSyncTime = lastSyncAt.getTime();
  const intervalMs = intervalMinutes * 60 * 1000;
  const nextSyncTime = lastSyncTime + intervalMs;
  
  return now.getTime() >= nextSyncTime;
}

/**
 * Sync with retry logic (max 3 retries with exponential backoff)
 * Story 3.5: AC4 - Retry automatique en cas d'erreur
 */
async function syncWithRetry(
  connectionId: string,
  userId: string,
  brokerType: string,
  brokerAccountName: string | null,
  maxRetries: number = 3
): Promise<{ tradesImported: number; tradesSkipped: number; tradesUpdated: number }> {
  const backoffDelays = [60000, 300000, 900000]; // 1min, 5min, 15min
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      brokerLogger.debug(`[Scheduler] Sync attempt ${attempt}/${maxRetries} for ${connectionId}`);
      
      const syncResult = await syncBrokerTrades(
        connectionId,
        userId,
        'scheduled'
      );
      
      // Success - return result
      return {
        tradesImported: syncResult.tradesImported,
        tradesSkipped: syncResult.tradesSkipped,
        tradesUpdated: syncResult.tradesUpdated,
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      brokerLogger.warn(
        `[Scheduler] Sync attempt ${attempt}/${maxRetries} failed for ${connectionId} (${brokerType}/${brokerAccountName}): ${errorMessage}`
      );
      
      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = backoffDelays[attempt - 1] || 60000;
      brokerLogger.debug(`[Scheduler] Waiting ${delay}ms before retry ${attempt + 1}...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Should never reach here, but TypeScript needs a return
  throw new Error('Max retries exceeded');
}

/**
 * Gets the status of all broker connections for monitoring.
 */
export async function getSchedulerStatus(): Promise<{
  connections: Array<{
    id: string;
    brokerType: string;
    brokerAccountName: string | null;
    status: string;
    syncEnabled: boolean;
    syncIntervalMin: number;
    lastSyncAt: Date | null;
    nextSyncDue: Date | null;
    isDue: boolean;
  }>;
}> {
  const connections = await prisma.brokerConnection.findMany({
    where: { status: 'CONNECTED' },
    orderBy: { createdAt: 'desc' },
  });
  
  const now = new Date();
  
  return {
    connections: connections.map((conn) => {
      const nextSyncDue = conn.lastSyncAt 
        ? new Date(conn.lastSyncAt.getTime() + conn.syncIntervalMin * 60 * 1000)
        : null;
      
      return {
        id: conn.id,
        brokerType: conn.brokerType,
        brokerAccountName: conn.brokerAccountName,
        status: conn.status,
        syncEnabled: conn.syncEnabled,
        syncIntervalMin: conn.syncIntervalMin,
        lastSyncAt: conn.lastSyncAt,
        nextSyncDue,
        isDue: conn.syncEnabled && isSyncDue(conn.lastSyncAt, conn.syncIntervalMin, now),
      };
    }),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { isSyncDue };

