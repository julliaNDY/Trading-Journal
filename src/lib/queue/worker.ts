/**
 * BullMQ Worker Infrastructure
 * Story 1.7: Redis (Upstash) Production Deployment
 *
 * Production-ready workers with graceful shutdown,
 * DLQ handling, and proper error management.
 */

import { Worker, Job, Processor, type ConnectionOptions } from 'bullmq';
import { createBullMQConnection, isRedisConfigured } from './redis';
import { logger, recordJobMetric } from '@/lib/observability';
import { buildWorkerOptions, QUEUE_CONFIGS, type QueueName } from './config';
import { moveToDLQ } from './queues';

// Cast helper for Redis connection (BullMQ has its own ioredis bundled)
function getConnection(): ConnectionOptions {
  return createBullMQConnection() as unknown as ConnectionOptions;
}

// ============================================================================
// Types
// ============================================================================

export interface JobResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export type JobProcessor<T, R> = (job: Job<T>) => Promise<R>;

// ============================================================================
// Worker Registry
// ============================================================================

const workers: Map<string, Worker> = new Map();
let isShuttingDown = false;

// ============================================================================
// Worker Creation
// ============================================================================

/**
 * Create a production worker for a queue
 */
export function createWorker<T, R>(
  queueName: QueueName,
  processor: JobProcessor<T, R>,
  options?: {
    name?: string;
    moveFailedToDLQ?: boolean;
  }
): Worker<T, R> | null {
  if (!isRedisConfigured()) {
    logger.warn('Cannot create worker - Redis not configured', { queue: queueName });
    return null;
  }

  if (isShuttingDown) {
    logger.warn('Cannot create worker - shutdown in progress', { queue: queueName });
    return null;
  }

  const workerName = options?.name || `${queueName}-worker`;
  const moveFailedToDLQ = options?.moveFailedToDLQ ?? true;

  // Close existing worker if any
  const existingWorker = workers.get(workerName);
  if (existingWorker) {
    existingWorker.close();
    workers.delete(workerName);
  }

  const connection = getConnection();
  const workerOptions = buildWorkerOptions(queueName);
  const config = QUEUE_CONFIGS[queueName];

  const wrappedProcessor: Processor<T, R> = async (job: Job<T>) => {
    const startTime = performance.now();
    const isLastAttempt = job.attemptsMade >= (config.defaultJobOptions.attempts || 3) - 1;

    // Log job start
    logger.info(`Job started: ${job.name}`, {
      queue: queueName,
      jobId: job.id,
      attempt: job.attemptsMade + 1,
      maxAttempts: config.defaultJobOptions.attempts,
    });

    recordJobMetric(queueName, job.name, 'started');

    try {
      const result = await processor(job);
      const durationMs = Math.round(performance.now() - startTime);

      logger.info(`Job completed: ${job.name}`, {
        queue: queueName,
        jobId: job.id,
        durationMs,
      });

      recordJobMetric(queueName, job.name, 'completed', durationMs);

      return result;
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(`Job failed: ${job.name}`, error, {
        queue: queueName,
        jobId: job.id,
        attempt: job.attemptsMade + 1,
        isLastAttempt,
        durationMs,
      });

      recordJobMetric(queueName, job.name, 'failed', durationMs);

      // Move to DLQ if this is the last attempt
      if (isLastAttempt && moveFailedToDLQ) {
        await moveToDLQ(queueName, job.id || '', job.name, job.data, errorMessage);
      }

      throw error;
    }
  };

  const worker = new Worker<T, R>(queueName, wrappedProcessor, {
    connection,
    ...workerOptions,
  });

  // Set up event listeners
  worker.on('ready', () => {
    logger.info(`Worker ready: ${workerName}`, {
      queue: queueName,
      concurrency: workerOptions.concurrency,
      limiter: workerOptions.limiter,
    });
  });

  worker.on('completed', (job) => {
    logger.debug(`Worker completed job: ${job.name}`, { jobId: job.id });
  });

  worker.on('failed', (job, error) => {
    if (job) {
      logger.error(`Worker job failed: ${job.name}`, error, {
        jobId: job.id,
        attempts: job.attemptsMade,
      });
    }
  });

  worker.on('error', (error) => {
    logger.error(`Worker error: ${workerName}`, error);
  });

  worker.on('stalled', (jobId) => {
    logger.warn(`Job stalled: ${jobId}`, { queue: queueName, worker: workerName });
  });

  workers.set(workerName, worker as Worker);
  logger.info(`Worker created: ${workerName}`, {
    queue: queueName,
    concurrency: workerOptions.concurrency,
  });

  return worker;
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

/**
 * Graceful shutdown of all workers
 * Waits for active jobs to complete before closing
 */
export async function gracefulShutdown(timeoutMs: number = 30000): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  logger.info('Graceful shutdown initiated', { workerCount: workers.size, timeoutMs });

  const shutdownPromises: Promise<void>[] = [];

  for (const [name, worker] of workers) {
    shutdownPromises.push(
      worker
        .close()
        .then(() => {
          logger.info(`Worker closed: ${name}`);
        })
        .catch((error) => {
          logger.error(`Failed to close worker: ${name}`, error);
        })
    );
  }

  // Wait for all workers to close with timeout
  const timeoutPromise = new Promise<void>((_, reject) => {
    setTimeout(() => reject(new Error('Shutdown timeout')), timeoutMs);
  });

  try {
    await Promise.race([Promise.all(shutdownPromises), timeoutPromise]);
    logger.info('All workers closed successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Shutdown timeout') {
      logger.warn('Shutdown timeout - some workers may not have closed cleanly');
    } else {
      logger.error('Error during shutdown', error);
    }
  }

  workers.clear();
  isShuttingDown = false;
}

/**
 * Close all workers (alias for gracefulShutdown for backwards compatibility)
 */
export async function closeAllWorkers(): Promise<void> {
  return gracefulShutdown();
}

// ============================================================================
// Signal Handlers
// ============================================================================

let signalHandlersRegistered = false;

/**
 * Register process signal handlers for graceful shutdown
 */
export function registerShutdownHandlers(): void {
  if (signalHandlersRegistered) {
    return;
  }

  const handleSignal = async (signal: string) => {
    logger.info(`Received ${signal}, initiating graceful shutdown...`);
    await gracefulShutdown();
    process.exit(0);
  };

  process.on('SIGTERM', () => handleSignal('SIGTERM'));
  process.on('SIGINT', () => handleSignal('SIGINT'));

  signalHandlersRegistered = true;
  logger.info('Shutdown signal handlers registered');
}

// ============================================================================
// Worker Status
// ============================================================================

/**
 * Get worker status
 */
export function getWorkerStatus(): {
  name: string;
  running: boolean;
  paused: boolean;
}[] {
  return Array.from(workers.entries()).map(([name, worker]) => ({
    name,
    running: worker.isRunning(),
    paused: worker.isPaused(),
  }));
}

/**
 * Check if workers are running
 */
export function hasRunningWorkers(): boolean {
  return workers.size > 0 && Array.from(workers.values()).some((w) => w.isRunning());
}

/**
 * Get worker by name
 */
export function getWorker(name: string): Worker | undefined {
  return workers.get(name);
}

/**
 * Pause a worker
 */
export async function pauseWorker(name: string): Promise<boolean> {
  const worker = workers.get(name);
  if (!worker) return false;

  try {
    await worker.pause();
    logger.info(`Worker paused: ${name}`);
    return true;
  } catch (error) {
    logger.error(`Failed to pause worker: ${name}`, error);
    return false;
  }
}

/**
 * Resume a worker
 */
export async function resumeWorker(name: string): Promise<boolean> {
  const worker = workers.get(name);
  if (!worker) return false;

  try {
    worker.resume();
    logger.info(`Worker resumed: ${name}`);
    return true;
  } catch (error) {
    logger.error(`Failed to resume worker: ${name}`, error);
    return false;
  }
}
