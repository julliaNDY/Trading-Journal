/**
 * Test Job
 * Story 1.2: Redis + BullMQ Setup
 *
 * A simple test job to validate the queue infrastructure.
 */

import { Job } from 'bullmq';
import { logger } from '@/lib/observability';

// ============================================================================
// Job Types
// ============================================================================

export interface TestJobData {
  message: string;
  delay?: number;
  shouldFail?: boolean;
}

export interface TestJobResult {
  processed: boolean;
  timestamp: string;
  originalMessage: string;
}

// ============================================================================
// Job Processor
// ============================================================================

export async function processTestJob(job: Job<TestJobData>): Promise<TestJobResult> {
  const { message, delay = 0, shouldFail = false } = job.data;

  logger.info('Processing test job', {
    jobId: job.id,
    message,
    delay,
    shouldFail,
  });

  // Simulate processing time
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // Simulate failure for testing retry
  if (shouldFail) {
    throw new Error(`Test job intentionally failed: ${message}`);
  }

  // Update progress
  await job.updateProgress(100);

  return {
    processed: true,
    timestamp: new Date().toISOString(),
    originalMessage: message,
  };
}

// ============================================================================
// Job Registration
// ============================================================================

export const TEST_JOB_NAME = 'test-job';
