/**
 * Qdrant Backup Cron Job
 * 
 * GET /api/cron/qdrant-backup
 * 
 * Creates snapshots for all Qdrant collections.
 * Called daily by Vercel Cron or external scheduler.
 * 
 * Security: Protected by CRON_SECRET or SCHEDULER_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getQdrantClient,
  COLLECTIONS,
  type CollectionName,
} from '@/lib/qdrant';
import { logger } from '@/lib/observability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Security check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || process.env.SCHEDULER_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = getQdrantClient();
    
    // Check connection
    const healthy = await client.isHealthy();
    if (!healthy) {
      logger.error('Qdrant backup failed: not healthy');
      return NextResponse.json({ error: 'Qdrant not healthy' }, { status: 503 });
    }

    const collections = Object.values(COLLECTIONS);
    const snapshots: Array<{ collection: string; name: string }> = [];

    // Create snapshots for all collections
    for (const collection of collections) {
      try {
        const snapshot = await client.createSnapshot(collection as CollectionName);
        snapshots.push({ collection, name: snapshot.name });
        logger.info('Qdrant snapshot created', { collection, snapshot: snapshot.name });
      } catch (error) {
        logger.error('Failed to create snapshot', {
          collection,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const duration = Date.now() - startTime;

    // Cleanup old snapshots (keep last 7 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    let deletedCount = 0;

    for (const collection of collections) {
      try {
        const allSnapshots = await client.listSnapshots(collection as CollectionName);
        for (const snapshot of allSnapshots) {
          const snapshotDate = new Date(snapshot.creation_time);
          if (snapshotDate < cutoffDate) {
            await client.deleteSnapshot(collection as CollectionName, snapshot.name);
            deletedCount++;
          }
        }
      } catch (error) {
        logger.warn('Failed to cleanup snapshots', {
          collection,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Qdrant backup completed', {
      snapshotsCreated: snapshots.length,
      snapshotsDeleted: deletedCount,
      duration,
    });

    return NextResponse.json({
      success: true,
      snapshotsCreated: snapshots.length,
      snapshotsDeleted: deletedCount,
      snapshots: snapshots.map(s => ({ collection: s.collection, name: s.name })),
      duration,
    });
  } catch (error) {
    logger.error('Qdrant backup failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Backup failed' },
      { status: 500 }
    );
  }
}
