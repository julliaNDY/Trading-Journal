/**
 * Dashboard Metrics Collection
 * Story 1.9: Production Monitoring & Alerting
 *
 * Provides aggregated metrics for dashboards.
 * Data is exposed via /api/observability/metrics endpoint.
 */

import { getMetricStats, getRecentMetrics, type Metric } from './metrics';

// ============================================================================
// Types
// ============================================================================

export interface DashboardMetrics {
  timestamp: string;
  period: {
    start: string;
    end: string;
  };
  api: {
    latency: {
      p50: number;
      p95: number;
      p99: number;
      avg: number;
    };
    requests: {
      total: number;
      success: number;
      errors: number;
      errorRate: number;
    };
    topEndpoints: Array<{
      path: string;
      count: number;
      avgLatency: number;
    }>;
  };
  database: {
    queries: {
      total: number;
      avgDuration: number;
    };
    slowQueries: number;
    connectionPoolUsage: number;
  };
  queue: {
    depth: {
      total: number;
      byQueue: Record<string, number>;
    };
    jobs: {
      completed: number;
      failed: number;
      failureRate: number;
    };
    processingTime: {
      avg: number;
      p95: number;
    };
  };
  users: {
    activeToday: number;
    tradesImported: number;
    aiRequests: number;
  };
  costs: {
    geminiCalls: number;
    geminiTokens: number;
    stripeCalls: number;
    estimatedCost: number;
  };
}

export interface AlertThresholds {
  apiLatencyWarning: number;
  apiLatencyCritical: number;
  errorRateWarning: number;
  errorRateCritical: number;
  queueDepthWarning: number;
  queueDepthCritical: number;
  dbConnectionWarning: number;
  dbConnectionCritical: number;
  aiFailuresWarning: number;
  aiFailuresCritical: number;
}

// ============================================================================
// Default Thresholds
// ============================================================================

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  apiLatencyWarning: 1000, // 1s
  apiLatencyCritical: 2000, // 2s
  errorRateWarning: 0.5, // 0.5%
  errorRateCritical: 1.0, // 1%
  queueDepthWarning: 50,
  queueDepthCritical: 100,
  dbConnectionWarning: 80, // 80%
  dbConnectionCritical: 95, // 95%
  aiFailuresWarning: 3, // per minute
  aiFailuresCritical: 5, // per minute
};

// ============================================================================
// Metrics Collection
// ============================================================================

/**
 * Get aggregated dashboard metrics
 */
export function getDashboardMetrics(periodMinutes: number = 60): DashboardMetrics {
  const now = Date.now();
  const since = now - periodMinutes * 60 * 1000;

  // Get recent metrics
  const recentMetrics = getRecentMetrics(since);

  // API Latency
  const apiLatencyStats = getMetricStats('api.response_time', since);
  const apiErrors = recentMetrics.filter((m) => m.name === 'api.errors');
  const apiRequests = recentMetrics.filter((m) => m.name.startsWith('api.'));

  // Database
  const dbStats = getMetricStats('db.query_time', since);
  const slowQueries = recentMetrics.filter(
    (m) => m.name === 'db.query_time' && m.value > 100
  ).length;

  // Queue
  const queueCompleted = recentMetrics.filter(
    (m) => m.name === 'queue.job.completed'
  ).length;
  const queueFailed = recentMetrics.filter((m) => m.name === 'queue.job.failed').length;
  const queueDuration = getMetricStats('queue.job.duration', since);

  // Business metrics
  const tradesImported = recentMetrics.filter(
    (m) => m.name === 'import.trades.success'
  ).length;
  const aiRequests = recentMetrics.filter((m) => m.name === 'ai.request').length;

  // Cost tracking
  const geminiCalls = recentMetrics.filter((m) => m.name === 'cost.gemini.call').length;
  const geminiTokens = recentMetrics
    .filter((m) => m.name === 'cost.gemini.tokens')
    .reduce((sum, m) => sum + m.value, 0);
  const stripeCalls = recentMetrics.filter((m) => m.name === 'cost.stripe.call').length;

  // Calculate endpoint stats
  const endpointMap = new Map<string, { count: number; totalLatency: number }>();
  recentMetrics
    .filter((m) => m.name === 'api.response_time' && m.tags?.path)
    .forEach((m) => {
      const path = m.tags!.path;
      const existing = endpointMap.get(path) || { count: 0, totalLatency: 0 };
      existing.count++;
      existing.totalLatency += m.value;
      endpointMap.set(path, existing);
    });

  const topEndpoints = Array.from(endpointMap.entries())
    .map(([path, stats]) => ({
      path,
      count: stats.count,
      avgLatency: Math.round(stats.totalLatency / stats.count),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    timestamp: new Date().toISOString(),
    period: {
      start: new Date(since).toISOString(),
      end: new Date(now).toISOString(),
    },
    api: {
      latency: {
        p50: apiLatencyStats?.avg || 0,
        p95: apiLatencyStats?.p95 || 0,
        p99: apiLatencyStats?.max || 0,
        avg: apiLatencyStats?.avg || 0,
      },
      requests: {
        total: apiRequests.length,
        success: apiRequests.length - apiErrors.length,
        errors: apiErrors.length,
        errorRate:
          apiRequests.length > 0
            ? Math.round((apiErrors.length / apiRequests.length) * 10000) / 100
            : 0,
      },
      topEndpoints,
    },
    database: {
      queries: {
        total: dbStats?.count || 0,
        avgDuration: dbStats?.avg || 0,
      },
      slowQueries,
      connectionPoolUsage: 0, // Would need DB-specific integration
    },
    queue: {
      depth: {
        total: 0, // Requires Redis connection
        byQueue: {},
      },
      jobs: {
        completed: queueCompleted,
        failed: queueFailed,
        failureRate:
          queueCompleted + queueFailed > 0
            ? Math.round((queueFailed / (queueCompleted + queueFailed)) * 10000) / 100
            : 0,
      },
      processingTime: {
        avg: queueDuration?.avg || 0,
        p95: queueDuration?.p95 || 0,
      },
    },
    users: {
      activeToday: 0, // Would need auth tracking
      tradesImported,
      aiRequests,
    },
    costs: {
      geminiCalls,
      geminiTokens,
      stripeCalls,
      // Rough estimate: $0.001 per Gemini call + $0.0001 per 1k tokens
      estimatedCost: Math.round((geminiCalls * 0.001 + (geminiTokens / 1000) * 0.0001) * 100) / 100,
    },
  };
}

/**
 * Check metrics against alert thresholds
 */
export function checkAlertThresholds(
  metrics: DashboardMetrics,
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS
): Array<{
  name: string;
  level: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
}> {
  const alerts: Array<{
    name: string;
    level: 'warning' | 'critical';
    message: string;
    value: number;
    threshold: number;
  }> = [];

  // API Latency
  if (metrics.api.latency.p95 > thresholds.apiLatencyCritical) {
    alerts.push({
      name: 'api_latency',
      level: 'critical',
      message: `API p95 latency (${metrics.api.latency.p95}ms) exceeds critical threshold (${thresholds.apiLatencyCritical}ms)`,
      value: metrics.api.latency.p95,
      threshold: thresholds.apiLatencyCritical,
    });
  } else if (metrics.api.latency.p95 > thresholds.apiLatencyWarning) {
    alerts.push({
      name: 'api_latency',
      level: 'warning',
      message: `API p95 latency (${metrics.api.latency.p95}ms) exceeds warning threshold (${thresholds.apiLatencyWarning}ms)`,
      value: metrics.api.latency.p95,
      threshold: thresholds.apiLatencyWarning,
    });
  }

  // Error Rate
  if (metrics.api.requests.errorRate > thresholds.errorRateCritical) {
    alerts.push({
      name: 'error_rate',
      level: 'critical',
      message: `Error rate (${metrics.api.requests.errorRate}%) exceeds critical threshold (${thresholds.errorRateCritical}%)`,
      value: metrics.api.requests.errorRate,
      threshold: thresholds.errorRateCritical,
    });
  } else if (metrics.api.requests.errorRate > thresholds.errorRateWarning) {
    alerts.push({
      name: 'error_rate',
      level: 'warning',
      message: `Error rate (${metrics.api.requests.errorRate}%) exceeds warning threshold (${thresholds.errorRateWarning}%)`,
      value: metrics.api.requests.errorRate,
      threshold: thresholds.errorRateWarning,
    });
  }

  // Queue Depth
  if (metrics.queue.depth.total > thresholds.queueDepthCritical) {
    alerts.push({
      name: 'queue_depth',
      level: 'critical',
      message: `Queue depth (${metrics.queue.depth.total}) exceeds critical threshold (${thresholds.queueDepthCritical})`,
      value: metrics.queue.depth.total,
      threshold: thresholds.queueDepthCritical,
    });
  } else if (metrics.queue.depth.total > thresholds.queueDepthWarning) {
    alerts.push({
      name: 'queue_depth',
      level: 'warning',
      message: `Queue depth (${metrics.queue.depth.total}) exceeds warning threshold (${thresholds.queueDepthWarning})`,
      value: metrics.queue.depth.total,
      threshold: thresholds.queueDepthWarning,
    });
  }

  return alerts;
}

// ============================================================================
// Dashboard Configuration Templates
// ============================================================================

/**
 * Axiom dashboard query templates
 * Use these in Axiom's dashboard builder
 */
export const AXIOM_DASHBOARD_QUERIES = {
  // API Latency Over Time
  apiLatency: `
    ['trading-journal']
    | where _time > ago(1h)
    | where level == 'info' and path != ''
    | summarize 
        p50 = percentile(durationMs, 50),
        p95 = percentile(durationMs, 95),
        p99 = percentile(durationMs, 99)
      by bin_auto(_time)
  `,

  // Error Rate
  errorRate: `
    ['trading-journal']
    | where _time > ago(1h)
    | where level in ['error', 'warn']
    | summarize errors = count() by bin_auto(_time)
  `,

  // Top Endpoints by Request Count
  topEndpoints: `
    ['trading-journal']
    | where _time > ago(1h)
    | where path != ''
    | summarize count = count() by path
    | order by count desc
    | limit 10
  `,

  // Slow Queries
  slowQueries: `
    ['trading-journal']
    | where _time > ago(1h)
    | where service contains 'db'
    | where durationMs > 100
    | summarize count = count() by bin_auto(_time)
  `,

  // User Activity
  userActivity: `
    ['trading-journal']
    | where _time > ago(24h)
    | where userId != ''
    | summarize uniqueUsers = dcount(userId) by bin(1h, _time)
  `,
};

/**
 * Sentry dashboard configuration
 * Configure these in Sentry's Dashboards section
 */
export const SENTRY_DASHBOARD_CONFIG = {
  widgets: [
    {
      title: 'Error Rate',
      displayType: 'line',
      queries: [
        {
          name: 'Errors',
          fields: ['count()'],
          conditions: 'event.type:error',
          orderby: '-count()',
        },
      ],
    },
    {
      title: 'Transaction Duration',
      displayType: 'line',
      queries: [
        {
          name: 'p95',
          fields: ['p95(transaction.duration)'],
          conditions: 'event.type:transaction',
          orderby: '-p95(transaction.duration)',
        },
      ],
    },
    {
      title: 'Top Errors',
      displayType: 'table',
      queries: [
        {
          name: 'Errors',
          fields: ['count()', 'issue', 'title'],
          conditions: 'event.type:error',
          orderby: '-count()',
        },
      ],
    },
  ],
};
