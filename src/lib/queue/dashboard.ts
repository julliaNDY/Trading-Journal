/**
 * Queue Dashboard & Monitoring
 * Story 1.7: Redis (Upstash) Production Deployment
 *
 * Provides queue monitoring and metrics export.
 * Note: Bull Board requires a separate Express server or Next.js route handler.
 */

import { logger } from '@/lib/observability';
import { QUEUE_NAMES, type QueueName } from './config';
import { getQueue, getAllQueueStats } from './queues';
import { getWorkerStatus } from './worker';
import { getRedisInfo, testRedisConnection } from './redis';

// ============================================================================
// Types
// ============================================================================

export interface QueueMetrics {
  name: QueueName;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface DashboardData {
  redis: {
    connected: boolean;
    latencyMs?: number;
    memory?: string;
    uptime?: number;
  };
  queues: QueueMetrics[];
  workers: {
    name: string;
    running: boolean;
    paused: boolean;
  }[];
  summary: {
    totalWaiting: number;
    totalActive: number;
    totalFailed: number;
    workersRunning: number;
  };
  timestamp: string;
}

// ============================================================================
// Dashboard Data
// ============================================================================

/**
 * Get complete dashboard data
 */
export async function getDashboardData(): Promise<DashboardData> {
  const startTime = performance.now();

  try {
    // Get Redis status
    const [redisTest, redisInfo] = await Promise.all([
      testRedisConnection(),
      getRedisInfo(),
    ]);

    // Get queue stats
    const queueStats = await getAllQueueStats();

    // Get worker status
    const workers = getWorkerStatus();

    // Build metrics array
    const queues: QueueMetrics[] = Object.values(QUEUE_NAMES).map((name) => {
      const stats = queueStats[name];
      return {
        name,
        waiting: stats?.waiting ?? 0,
        active: stats?.active ?? 0,
        completed: stats?.completed ?? 0,
        failed: stats?.failed ?? 0,
        delayed: stats?.delayed ?? 0,
        paused: stats?.paused ?? 0,
      };
    });

    // Calculate summary
    const summary = {
      totalWaiting: queues.reduce((sum, q) => sum + q.waiting, 0),
      totalActive: queues.reduce((sum, q) => sum + q.active, 0),
      totalFailed: queues.reduce((sum, q) => sum + q.failed, 0),
      workersRunning: workers.filter((w) => w.running).length,
    };

    const data: DashboardData = {
      redis: {
        connected: redisTest.success,
        latencyMs: redisTest.latencyMs,
        memory: redisInfo.memory,
        uptime: redisInfo.uptime,
      },
      queues,
      workers,
      summary,
      timestamp: new Date().toISOString(),
    };

    logger.debug('Dashboard data fetched', {
      durationMs: Math.round(performance.now() - startTime),
      summary,
    });

    return data;
  } catch (error) {
    logger.error('Failed to get dashboard data', error);

    // Return minimal data on error
    return {
      redis: { connected: false },
      queues: [],
      workers: [],
      summary: {
        totalWaiting: 0,
        totalActive: 0,
        totalFailed: 0,
        workersRunning: 0,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Health Check
// ============================================================================

export interface QueueHealthCheck {
  healthy: boolean;
  redis: {
    connected: boolean;
    latencyMs: number;
  };
  queues: {
    name: string;
    healthy: boolean;
    issue?: string;
  }[];
  workers: {
    name: string;
    running: boolean;
  }[];
  timestamp: string;
}

/**
 * Perform queue health check
 */
export async function getQueueHealthCheck(): Promise<QueueHealthCheck> {
  const redisTest = await testRedisConnection();
  const workers = getWorkerStatus();

  const queueHealths: QueueHealthCheck['queues'] = [];

  // Check each queue
  for (const name of Object.values(QUEUE_NAMES)) {
    const queue = getQueue(name);
    
    if (!queue) {
      queueHealths.push({
        name,
        healthy: false,
        issue: 'Queue not initialized',
      });
      continue;
    }

    try {
      const [waiting, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getFailedCount(),
      ]);

      // Queue is unhealthy if too many waiting or failed jobs
      const waitingThreshold = 1000;
      const failedThreshold = 100;

      if (waiting > waitingThreshold) {
        queueHealths.push({
          name,
          healthy: false,
          issue: `High backlog: ${waiting} waiting jobs`,
        });
      } else if (failed > failedThreshold) {
        queueHealths.push({
          name,
          healthy: false,
          issue: `High failure rate: ${failed} failed jobs`,
        });
      } else {
        queueHealths.push({
          name,
          healthy: true,
        });
      }
    } catch (error) {
      queueHealths.push({
        name,
        healthy: false,
        issue: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const healthy =
    redisTest.success &&
    queueHealths.every((q) => q.healthy) &&
    workers.some((w) => w.running);

  return {
    healthy,
    redis: {
      connected: redisTest.success,
      latencyMs: redisTest.latencyMs,
    },
    queues: queueHealths,
    workers: workers.map((w) => ({
      name: w.name,
      running: w.running,
    })),
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Metrics Export
// ============================================================================

/**
 * Export metrics in Prometheus format
 */
export async function exportPrometheusMetrics(): Promise<string> {
  const data = await getDashboardData();
  const lines: string[] = [];

  // Redis metrics
  lines.push('# HELP redis_connected Redis connection status');
  lines.push('# TYPE redis_connected gauge');
  lines.push(`redis_connected ${data.redis.connected ? 1 : 0}`);

  if (data.redis.latencyMs !== undefined) {
    lines.push('# HELP redis_latency_ms Redis latency in milliseconds');
    lines.push('# TYPE redis_latency_ms gauge');
    lines.push(`redis_latency_ms ${data.redis.latencyMs}`);
  }

  // Queue metrics
  lines.push('# HELP queue_jobs_waiting Number of waiting jobs');
  lines.push('# TYPE queue_jobs_waiting gauge');
  for (const queue of data.queues) {
    lines.push(`queue_jobs_waiting{queue="${queue.name}"} ${queue.waiting}`);
  }

  lines.push('# HELP queue_jobs_active Number of active jobs');
  lines.push('# TYPE queue_jobs_active gauge');
  for (const queue of data.queues) {
    lines.push(`queue_jobs_active{queue="${queue.name}"} ${queue.active}`);
  }

  lines.push('# HELP queue_jobs_failed Number of failed jobs');
  lines.push('# TYPE queue_jobs_failed gauge');
  for (const queue of data.queues) {
    lines.push(`queue_jobs_failed{queue="${queue.name}"} ${queue.failed}`);
  }

  lines.push('# HELP queue_jobs_completed Number of completed jobs');
  lines.push('# TYPE queue_jobs_completed gauge');
  for (const queue of data.queues) {
    lines.push(`queue_jobs_completed{queue="${queue.name}"} ${queue.completed}`);
  }

  // Worker metrics
  lines.push('# HELP workers_running Number of running workers');
  lines.push('# TYPE workers_running gauge');
  lines.push(`workers_running ${data.summary.workersRunning}`);

  return lines.join('\n');
}

// ============================================================================
// Alerting
// ============================================================================

export interface QueueAlert {
  level: 'warning' | 'critical';
  queue: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
}

const ALERT_THRESHOLDS = {
  waitingWarning: 100,
  waitingCritical: 500,
  failedWarning: 10,
  failedCritical: 50,
  delayedWarning: 100,
};

/**
 * Check for queue alerts
 */
export async function checkQueueAlerts(): Promise<QueueAlert[]> {
  const data = await getDashboardData();
  const alerts: QueueAlert[] = [];

  for (const queue of data.queues) {
    // Waiting jobs alerts
    if (queue.waiting >= ALERT_THRESHOLDS.waitingCritical) {
      alerts.push({
        level: 'critical',
        queue: queue.name,
        message: `Critical backlog: ${queue.waiting} waiting jobs`,
        value: queue.waiting,
        threshold: ALERT_THRESHOLDS.waitingCritical,
        timestamp: new Date().toISOString(),
      });
    } else if (queue.waiting >= ALERT_THRESHOLDS.waitingWarning) {
      alerts.push({
        level: 'warning',
        queue: queue.name,
        message: `High backlog: ${queue.waiting} waiting jobs`,
        value: queue.waiting,
        threshold: ALERT_THRESHOLDS.waitingWarning,
        timestamp: new Date().toISOString(),
      });
    }

    // Failed jobs alerts
    if (queue.failed >= ALERT_THRESHOLDS.failedCritical) {
      alerts.push({
        level: 'critical',
        queue: queue.name,
        message: `High failure count: ${queue.failed} failed jobs`,
        value: queue.failed,
        threshold: ALERT_THRESHOLDS.failedCritical,
        timestamp: new Date().toISOString(),
      });
    } else if (queue.failed >= ALERT_THRESHOLDS.failedWarning) {
      alerts.push({
        level: 'warning',
        queue: queue.name,
        message: `Elevated failures: ${queue.failed} failed jobs`,
        value: queue.failed,
        threshold: ALERT_THRESHOLDS.failedWarning,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Log alerts
  for (const alert of alerts) {
    const alertContext = {
      level: alert.level,
      queue: alert.queue,
      message: alert.message,
      value: alert.value,
      threshold: alert.threshold,
    };
    if (alert.level === 'critical') {
      logger.error('Queue alert: CRITICAL', undefined, alertContext);
    } else {
      logger.warn('Queue alert: WARNING', alertContext);
    }
  }

  return alerts;
}
