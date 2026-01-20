/**
 * Queue Test Endpoint
 * Story 1.2: Redis + BullMQ Setup
 *
 * GET /api/queue/test - Get queue status
 * POST /api/queue/test - Add a test job
 */

import { NextResponse } from 'next/server';
import {
  testRedisConnection,
  isRedisConfigured,
  getRedisInfo,
  QUEUE_NAMES,
  getQueueStats,
  addJob,
  getQueue,
  createWorker,
  processTestJob,
  TEST_JOB_NAME,
  type TestJobData,
} from '@/lib/queue';
import { logger } from '@/lib/observability';

export async function GET() {
  const startTime = performance.now();

  // Check Redis connection
  const redisTest = await testRedisConnection();
  const redisInfo = await getRedisInfo();

  // Get queue stats
  const queueStats: Record<string, unknown> = {};
  for (const queueName of Object.values(QUEUE_NAMES)) {
    const stats = await getQueueStats(queueName);
    if (stats) {
      queueStats[queueName] = stats;
    }
  }

  const response = {
    status: redisTest.success ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    redis: {
      configured: isRedisConfigured(),
      connected: redisTest.success,
      latencyMs: redisTest.latencyMs,
      error: redisTest.error,
      info: redisInfo,
    },
    queues: queueStats,
    latencyMs: Math.round(performance.now() - startTime),
  };

  return NextResponse.json(response);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, message, delay, shouldFail } = body;

    switch (action) {
      case 'add-job': {
        // Add a test job
        const jobData: TestJobData = {
          message: message || 'Test job from API',
          delay: delay || 0,
          shouldFail: shouldFail || false,
        };

        const jobId = await addJob(QUEUE_NAMES.DEFAULT, TEST_JOB_NAME, jobData, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        });

        if (!jobId) {
          return NextResponse.json(
            { error: 'Failed to add job - Redis not configured or unavailable' },
            { status: 503 }
          );
        }

        logger.info('Test job added via API', { jobId, message });

        return NextResponse.json({
          success: true,
          action: 'add-job',
          jobId,
          message: 'Job added to queue',
        });
      }

      case 'start-worker': {
        // Start the test worker
        const queue = getQueue(QUEUE_NAMES.DEFAULT);
        if (!queue) {
          return NextResponse.json(
            { error: 'Cannot start worker - Redis not configured' },
            { status: 503 }
          );
        }

        const worker = createWorker(QUEUE_NAMES.DEFAULT, processTestJob);

        if (!worker) {
          return NextResponse.json(
            { error: 'Failed to create worker' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          action: 'start-worker',
          message: 'Worker started for default queue',
        });
      }

      case 'process-next': {
        // Process next job immediately (for testing)
        const queue = getQueue(QUEUE_NAMES.DEFAULT);
        if (!queue) {
          return NextResponse.json(
            { error: 'Queue not available' },
            { status: 503 }
          );
        }

        // Get next waiting job
        const jobs = await queue.getWaiting(0, 0);
        if (jobs.length === 0) {
          return NextResponse.json({
            success: false,
            message: 'No jobs waiting in queue',
          });
        }

        const job = jobs[0];
        logger.info('Processing job manually', { jobId: job.id });

        try {
          const result = await processTestJob(job);
          await job.moveToCompleted(result, job.token || '', false);

          return NextResponse.json({
            success: true,
            action: 'process-next',
            jobId: job.id,
            result,
          });
        } catch (error) {
          await job.moveToFailed(error as Error, job.token || '', false);
          return NextResponse.json({
            success: false,
            action: 'process-next',
            jobId: job.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      default:
        return NextResponse.json(
          {
            error: 'Unknown action',
            availableActions: ['add-job', 'start-worker', 'process-next'],
          },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Error in queue test endpoint', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
