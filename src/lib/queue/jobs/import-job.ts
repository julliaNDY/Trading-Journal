/**
 * Import Job
 * Story 1.7: Redis (Upstash) Production Deployment
 *
 * Processes CSV imports asynchronously.
 */

import type { Job } from 'bullmq';
import { logger } from '@/lib/observability';
import { JOB_TYPES } from '../config';

// ============================================================================
// Types
// ============================================================================

export interface ImportJobData {
  /** User ID */
  userId: string;
  /** Account ID to import to */
  accountId: string;
  /** Import profile ID (column mapping) */
  profileId?: string;
  /** File path or storage key */
  filePath: string;
  /** Original filename */
  originalName: string;
  /** File size in bytes */
  fileSize: number;
}

export interface ImportJobResult {
  success: boolean;
  tradesImported: number;
  tradesSkipped: number;
  errors: Array<{ row: number; message: string }>;
  durationMs: number;
}

// ============================================================================
// Job Processor
// ============================================================================

/**
 * Process CSV import job
 * 
 * This integrates with the existing import service but runs asynchronously.
 */
export async function processImportJob(
  job: Job<ImportJobData>
): Promise<ImportJobResult> {
  const startTime = performance.now();
  const { userId, accountId, filePath, originalName, fileSize } = job.data;

  logger.info('Processing import job', {
    jobId: job.id,
    userId,
    accountId,
    originalName,
    fileSize,
  });

  try {
    await job.updateProgress(10);

    // TODO: Integrate with existing import-service.ts
    // 1. Read file from storage
    // 2. Parse CSV with PapaParse
    // 3. Apply column mapping
    // 4. Validate rows
    // 5. Create trades in database
    // 6. Return summary

    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 100));
    await job.updateProgress(50);

    const result: ImportJobResult = {
      success: true,
      tradesImported: 0,
      tradesSkipped: 0,
      errors: [],
      durationMs: Math.round(performance.now() - startTime),
    };

    await job.updateProgress(100);

    logger.info('Import job completed', {
      jobId: job.id,
      result,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Import job failed', error, {
      jobId: job.id,
      userId,
      filePath,
    });

    return {
      success: false,
      tradesImported: 0,
      tradesSkipped: 0,
      errors: [{ row: 0, message: errorMessage }],
      durationMs: Math.round(performance.now() - startTime),
    };
  }
}

// ============================================================================
// Job Names
// ============================================================================

export const IMPORT_JOBS = {
  CSV: JOB_TYPES.IMPORT_CSV,
  VALIDATE: JOB_TYPES.IMPORT_VALIDATE,
} as const;
