/**
 * Performance Metrics Collection
 * Story 1.4: Observability Baseline
 *
 * Lightweight metrics collection for tracking:
 * - API response times
 * - Database query durations
 * - Queue job processing times
 * - Custom business metrics
 *
 * Integrates with Vercel Analytics for Web Vitals.
 */

import { logger } from './logger';

// ============================================================================
// Types
// ============================================================================

export interface Metric {
  name: string;
  value: number;
  unit: 'ms' | 'count' | 'bytes' | 'percent';
  tags?: Record<string, string>;
  timestamp: number;
}

export interface TimerResult {
  durationMs: number;
  success: boolean;
  error?: string;
}

// ============================================================================
// In-Memory Metrics Buffer
// ============================================================================

const metricsBuffer: Metric[] = [];
const MAX_BUFFER_SIZE = 100;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Record a metric
 */
export function recordMetric(
  name: string,
  value: number,
  unit: Metric['unit'] = 'count',
  tags?: Record<string, string>
): void {
  const metric: Metric = {
    name,
    value,
    unit,
    tags,
    timestamp: Date.now(),
  };

  // Add to buffer
  metricsBuffer.push(metric);

  // Prevent buffer overflow
  if (metricsBuffer.length > MAX_BUFFER_SIZE) {
    metricsBuffer.shift();
  }

  // Log in development
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`[Metric] ${name}: ${value}${unit}`, tags);
  }
}

/**
 * Record a timing metric
 */
export function recordTiming(name: string, durationMs: number, tags?: Record<string, string>): void {
  recordMetric(name, durationMs, 'ms', tags);
}

/**
 * Create a timer for measuring duration
 */
export function createTimer(name: string, tags?: Record<string, string>): () => TimerResult {
  const start = performance.now();
  let ended = false;

  return () => {
    if (ended) {
      return { durationMs: 0, success: false, error: 'Timer already ended' };
    }
    ended = true;

    const durationMs = Math.round(performance.now() - start);
    recordTiming(name, durationMs, tags);

    return { durationMs, success: true };
  };
}

/**
 * Measure an async operation
 */
export async function measure<T>(
  name: string,
  fn: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const end = createTimer(name, tags);

  try {
    const result = await fn();
    const { durationMs } = end();
    recordMetric(`${name}.success`, 1, 'count', { ...tags, durationMs: String(durationMs) });
    return result;
  } catch (error) {
    const { durationMs } = end();
    recordMetric(`${name}.error`, 1, 'count', { ...tags, durationMs: String(durationMs) });
    throw error;
  }
}

// ============================================================================
// Specific Metric Helpers
// ============================================================================

/**
 * Record API response time
 */
export function recordApiTiming(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number
): void {
  recordTiming('api.response_time', durationMs, {
    method,
    path,
    status: String(statusCode),
  });

  // Track error rates
  if (statusCode >= 400) {
    recordMetric('api.errors', 1, 'count', {
      method,
      path,
      status: String(statusCode),
    });
  }
}

/**
 * Record database query time
 */
export function recordDbTiming(operation: string, table: string, durationMs: number): void {
  recordTiming('db.query_time', durationMs, {
    operation,
    table,
  });
}

/**
 * Record queue job metrics
 */
export function recordJobMetric(
  queue: string,
  job: string,
  status: 'started' | 'completed' | 'failed',
  durationMs?: number
): void {
  recordMetric(`queue.job.${status}`, 1, 'count', { queue, job });

  if (durationMs !== undefined && status !== 'started') {
    recordTiming('queue.job.duration', durationMs, { queue, job, status });
  }
}

// ============================================================================
// Aggregation
// ============================================================================

/**
 * Get recent metrics from buffer
 */
export function getRecentMetrics(since?: number): Metric[] {
  if (since) {
    return metricsBuffer.filter((m) => m.timestamp >= since);
  }
  return [...metricsBuffer];
}

/**
 * Get aggregated stats for a metric
 */
export function getMetricStats(
  name: string,
  since?: number
): { count: number; min: number; max: number; avg: number; p95: number } | null {
  const metrics = getRecentMetrics(since).filter((m) => m.name === name);

  if (metrics.length === 0) {
    return null;
  }

  const values = metrics.map((m) => m.value).sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const p95Index = Math.floor(values.length * 0.95);

  return {
    count: values.length,
    min: values[0],
    max: values[values.length - 1],
    avg: Math.round(sum / values.length),
    p95: values[p95Index] || values[values.length - 1],
  };
}

/**
 * Clear metrics buffer
 */
export function clearMetrics(): void {
  metricsBuffer.length = 0;
}
