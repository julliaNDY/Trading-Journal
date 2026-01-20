/**
 * Observability Module
 * Story 1.9: Production Monitoring & Alerting
 *
 * Centralized exports for logging, error tracking, and metrics.
 */

// Logger
export {
  logger,
  Logger,
  authLogger,
  tradeLogger,
  importLogger,
  brokerLogger,
  stripeLogger,
  ocrLogger,
  voiceLogger,
  coachLogger,
  queueLogger,
  apiLogger,
  generateRequestId,
  withRequestId,
  withUserContext,
  flushLogs,
  logApiRequest,
  type LogLevel,
  type LogContext,
  type LogEntry,
} from './logger';

// Sentry
export {
  captureException,
  captureMessage,
  setUser,
  setContext,
  setTag,
  setTags,
  addBreadcrumb,
  startSpan,
  startInactiveSpan,
  withScope,
  startTransaction,
  trackApiRoute,
  trackDbOperation,
  isSentryEnabled,
  flush as flushSentry,
  close as closeSentry,
  type SeverityLevel,
  type SentryUser,
} from './sentry';

// Metrics
export {
  recordMetric,
  recordTiming,
  createTimer,
  measure,
  recordApiTiming,
  recordDbTiming,
  recordJobMetric,
  getRecentMetrics,
  getMetricStats,
  clearMetrics,
  type Metric,
} from './metrics';

// Dashboards
export {
  getDashboardMetrics,
  checkAlertThresholds,
  DEFAULT_THRESHOLDS,
  AXIOM_DASHBOARD_QUERIES,
  SENTRY_DASHBOARD_CONFIG,
  type DashboardMetrics,
  type AlertThresholds,
} from './dashboards';

// Alerts
export {
  checkMetricRule,
  getAlertHistory,
  getActiveAlerts,
  acknowledgeAlert,
  sendTestAlert,
  clearAlertHistory,
  DEFAULT_ALERT_RULES,
  type Alert,
  type AlertRule,
  type AlertLevel,
  type AlertChannel,
} from './alerts';

// Health
export {
  checkDatabase,
  checkRedis,
  checkQdrant,
  checkTimescale,
  checkExternalApis,
  runHealthChecks,
  aggregateHealthStatus,
  type HealthStatus,
  type ServiceHealth,
  type HealthCheckResult,
} from './health';

// Web Vitals
export {
  reportWebVitals,
  getWebVitalsRating,
  checkPerformanceBudget,
  WEB_VITALS_THRESHOLDS,
  type WebVitalsMetric,
  type WebVitalsThresholds,
} from './web-vitals';

// Cost Tracking
export {
  trackGeminiUsage,
  trackOpenAIUsage,
  trackStripeUsage,
  trackVisionUsage,
  trackSupabaseUsage,
  getCostSummary,
  flushBuffer as flushCostBuffer,
  checkCostAlerts,
  COST_ESTIMATES,
  COST_ALERT_RULES,
  type ApiUsage,
  type CostSummary,
} from './cost-tracking';
