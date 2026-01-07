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
      
      // Run sync
      try {
        console.log(`[Scheduler] Syncing connection ${connection.id} (${connection.brokerType}/${connection.brokerAccountName})`);
        
        const syncResult = await syncBrokerTrades(
          connection.id,
          connection.userId,
          'scheduled'
        );
        
        result.connectionsSynced++;
        result.totalTradesImported += syncResult.tradesImported;
        result.totalTradesSkipped += syncResult.tradesSkipped;
        
        console.log(`[Scheduler] Sync complete for ${connection.id}: ${syncResult.tradesImported} imported, ${syncResult.tradesSkipped} skipped`);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        console.error(`[Scheduler] Sync failed for ${connection.id}:`, errorMessage);
        
        result.errors.push({
          connectionId: connection.id,
          brokerType: connection.brokerType,
          brokerAccountName: connection.brokerAccountName,
          error: errorMessage,
        });
      }
    }
    
    result.success = true;
    
  } catch (error) {
    console.error('[Scheduler] Fatal error:', error);
    result.errors.push({
      connectionId: 'scheduler',
      brokerType: 'N/A',
      brokerAccountName: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  
  result.durationMs = Date.now() - startTime;
  
  console.log(`[Scheduler] Completed in ${result.durationMs}ms: ${result.connectionsSynced}/${result.connectionsChecked} synced, ${result.totalTradesImported} trades imported`);
  
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

