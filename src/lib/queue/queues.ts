/**
 * BullMQ Queue Definitions
 * Story 1.7: Redis (Upstash) Production Deployment
 *
 * Production-ready queues with configuration from config.ts.
 */

import { Queue, QueueEvents, type ConnectionOptions } from 'bullmq';
import { createBullMQConnection, isRedisConfigured } from './redis';
import { logger } from '@/lib/observability';
import {
  QUEUE_NAMES,
  QUEUE_CONFIGS,
  buildQueueOptions,
  getDLQName,
  DLQ_CONFIG,
  type QueueName,
} from './config';

// Cast helper for Redis connection (BullMQ has its own ioredis bundled)
function getConnection(): ConnectionOptions {
  return createBullMQConnection() as unknown as ConnectionOptions;
}

// Re-export for backwards compatibility
export { QUEUE_NAMES, type QueueName } from './config';

// ============================================================================
// Queue Instances
// ============================================================================

const queues: Map<QueueName, Queue> = new Map();
const queueEvents: Map<QueueName, QueueEvents> = new Map();
const dlqQueues: Map<string, Queue> = new Map();

/**
 * Get or create a queue instance
 */
export function getQueue(name: QueueName): Queue | null {
  if (!isRedisConfigured()) {
    logger.warn('Queue requested but Redis not configured', { queue: name });
    return null;
  }

  let queue = queues.get(name);

  if (!queue) {
    const connection = getConnection();
    const options = buildQueueOptions(name);

    queue = new Queue(name, {
      ...options,
      connection,
    });

    // Set up event listeners
    queue.on('error', (error) => {
      logger.error(`Queue error: ${name}`, error);
    });

    queues.set(name, queue);
    logger.info(`Queue initialized: ${name}`, {
      config: QUEUE_CONFIGS[name],
    });
  }

  return queue;
}

/**
 * Get or create DLQ (Dead Letter Queue) for a queue
 */
export function getDLQ(name: QueueName): Queue | null {
  if (!isRedisConfigured()) {
    return null;
  }

  const dlqName = getDLQName(name);
  let dlq = dlqQueues.get(dlqName);

  if (!dlq) {
    const connection = getConnection();

    dlq = new Queue(dlqName, {
      connection,
      defaultJobOptions: {
        removeOnComplete: {
          age: DLQ_CONFIG.maxAge,
          count: DLQ_CONFIG.maxCount,
        },
      },
    });

    dlqQueues.set(dlqName, dlq);
    logger.info(`DLQ initialized: ${dlqName}`);
  }

  return dlq;
}

/**
 * Get queue events for a queue (for monitoring)
 */
export function getQueueEvents(name: QueueName): QueueEvents | null {
  if (!isRedisConfigured()) {
    return null;
  }

  let events = queueEvents.get(name);

  if (!events) {
    const connection = getConnection();
    events = new QueueEvents(name, { connection });
    queueEvents.set(name, events);
  }

  return events;
}

/**
 * Add a job to a queue
 */
export async function addJob<T>(
  queueName: QueueName,
  jobName: string,
  data: T,
  options?: {
    delay?: number;
    priority?: number;
    attempts?: number;
    backoff?: { type: 'fixed' | 'exponential'; delay: number };
    jobId?: string;
  }
): Promise<string | null> {
  const queue = getQueue(queueName);

  if (!queue) {
    logger.warn('Cannot add job - queue not available', { queueName, jobName });
    return null;
  }

  try {
    const job = await queue.add(jobName, data, {
      delay: options?.delay,
      priority: options?.priority,
      attempts: options?.attempts,
      backoff: options?.backoff,
      jobId: options?.jobId,
    });

    logger.debug('Job added', {
      queue: queueName,
      job: jobName,
      jobId: job.id,
      delay: options?.delay,
      priority: options?.priority,
    });

    return job.id || null;
  } catch (error) {
    logger.error('Failed to add job', error, { queueName, jobName });
    return null;
  }
}

/**
 * Add a job to be processed at a specific time
 */
export async function addScheduledJob<T>(
  queueName: QueueName,
  jobName: string,
  data: T,
  processAt: Date
): Promise<string | null> {
  const delay = processAt.getTime() - Date.now();
  
  if (delay < 0) {
    logger.warn('Scheduled job time is in the past, processing immediately', {
      queueName,
      jobName,
      processAt,
    });
  }

  return addJob(queueName, jobName, data, {
    delay: Math.max(0, delay),
  });
}

/**
 * Add a repeating job
 */
export async function addRepeatingJob<T>(
  queueName: QueueName,
  jobName: string,
  data: T,
  pattern: string, // Cron pattern
  options?: {
    jobId?: string;
    tz?: string;
  }
): Promise<string | null> {
  const queue = getQueue(queueName);

  if (!queue) {
    logger.warn('Cannot add repeating job - queue not available', { queueName, jobName });
    return null;
  }

  try {
    const job = await queue.add(jobName, data, {
      repeat: {
        pattern,
        tz: options?.tz || 'UTC',
      },
      jobId: options?.jobId,
    });

    logger.info('Repeating job added', {
      queue: queueName,
      job: jobName,
      jobId: job.id,
      pattern,
    });

    return job.id || null;
  } catch (error) {
    logger.error('Failed to add repeating job', error, { queueName, jobName, pattern });
    return null;
  }
}

/**
 * Move failed job to DLQ
 */
export async function moveToDLQ<T>(
  queueName: QueueName,
  jobId: string,
  jobName: string,
  data: T,
  error: string
): Promise<string | null> {
  const dlq = getDLQ(queueName);

  if (!dlq) {
    logger.warn('Cannot move to DLQ - DLQ not available', { queueName, jobId });
    return null;
  }

  try {
    const dlqJob = await dlq.add(`dlq:${jobName}`, {
      originalJobId: jobId,
      originalQueue: queueName,
      originalJobName: jobName,
      data,
      error,
      failedAt: new Date().toISOString(),
    });

    logger.info('Job moved to DLQ', {
      queue: queueName,
      originalJobId: jobId,
      dlqJobId: dlqJob.id,
    });

    return dlqJob.id || null;
  } catch (dlqError) {
    logger.error('Failed to move job to DLQ', dlqError, { queueName, jobId });
    return null;
  }
}

/**
 * Get queue stats
 */
export async function getQueueStats(queueName: QueueName): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
} | null> {
  const queue = getQueue(queueName);

  if (!queue) {
    return null;
  }

  try {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused().then(p => p ? 1 : 0),
    ]);

    return { waiting, active, completed, failed, delayed, paused };
  } catch (error) {
    logger.error('Failed to get queue stats', error, { queueName });
    return null;
  }
}

/**
 * Get all queue stats
 */
export async function getAllQueueStats(): Promise<Record<QueueName, {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
} | null>> {
  const stats: Record<string, {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  } | null> = {};

  for (const name of Object.values(QUEUE_NAMES)) {
    stats[name] = await getQueueStats(name);
  }

  return stats as Record<QueueName, {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  } | null>;
}

/**
 * Pause a queue
 */
export async function pauseQueue(queueName: QueueName): Promise<boolean> {
  const queue = getQueue(queueName);
  
  if (!queue) return false;

  try {
    await queue.pause();
    logger.info(`Queue paused: ${queueName}`);
    return true;
  } catch (error) {
    logger.error(`Failed to pause queue: ${queueName}`, error);
    return false;
  }
}

/**
 * Resume a queue
 */
export async function resumeQueue(queueName: QueueName): Promise<boolean> {
  const queue = getQueue(queueName);
  
  if (!queue) return false;

  try {
    await queue.resume();
    logger.info(`Queue resumed: ${queueName}`);
    return true;
  } catch (error) {
    logger.error(`Failed to resume queue: ${queueName}`, error);
    return false;
  }
}

/**
 * Close all queues
 */
export async function closeAllQueues(): Promise<void> {
  // Close main queues
  for (const [name, queue] of queues) {
    try {
      await queue.close();
      logger.info(`Queue closed: ${name}`);
    } catch (error) {
      logger.error(`Failed to close queue: ${name}`, error);
    }
  }
  queues.clear();

  // Close DLQ queues
  for (const [name, queue] of dlqQueues) {
    try {
      await queue.close();
      logger.info(`DLQ closed: ${name}`);
    } catch (error) {
      logger.error(`Failed to close DLQ: ${name}`, error);
    }
  }
  dlqQueues.clear();

  // Close queue events
  for (const [name, events] of queueEvents) {
    try {
      await events.close();
      logger.info(`QueueEvents closed: ${name}`);
    } catch (error) {
      logger.error(`Failed to close QueueEvents: ${name}`, error);
    }
  }
  queueEvents.clear();
}
