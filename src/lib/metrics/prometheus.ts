/**
 * Prometheus Metrics for Gemini API Monitoring
 * 
 * Exposes metrics for Grafana dashboards:
 * - Request rate
 * - Error rate
 * - Response time (p50, p95, p99)
 * - Circuit breaker state
 * - Cache hit rate
 * - Fallback usage
 * - Token consumption
 * - Rate limit status
 */

import { Counter, Gauge, Histogram, Registry } from 'prom-client';

// Create a Registry to register the metrics
export const register = new Registry();

/**
 * Total number of Gemini API requests
 */
export const geminiRequestsTotal = new Counter({
  name: 'gemini_api_requests_total',
  help: 'Total number of Gemini API requests',
  labelNames: ['status', 'method', 'endpoint'],
  registers: [register],
});

/**
 * Total number of Gemini API errors
 */
export const geminiErrorsTotal = new Counter({
  name: 'gemini_api_errors_total',
  help: 'Total number of Gemini API errors',
  labelNames: ['error_type', 'status_code'],
  registers: [register],
});

/**
 * Gemini API request duration (histogram for percentiles)
 */
export const geminiDurationSeconds = new Histogram({
  name: 'gemini_api_duration_seconds',
  help: 'Gemini API request duration in seconds',
  labelNames: ['method', 'endpoint'],
  buckets: [0.1, 0.5, 1, 1.5, 2, 3, 5, 10], // buckets in seconds
  registers: [register],
});

/**
 * Circuit breaker state
 * 0 = CLOSED (healthy)
 * 1 = OPEN (unhealthy, blocking requests)
 * 2 = HALF_OPEN (testing recovery)
 */
export const circuitBreakerState = new Gauge({
  name: 'gemini_circuit_breaker_state',
  help: 'Current state of the circuit breaker (0=CLOSED, 1=OPEN, 2=HALF_OPEN)',
  registers: [register],
});

/**
 * Cache hits
 */
export const cacheHitsTotal = new Counter({
  name: 'gemini_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type'],
  registers: [register],
});

/**
 * Cache misses
 */
export const cacheMissesTotal = new Counter({
  name: 'gemini_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type'],
  registers: [register],
});

/**
 * Fallback usage (OpenAI)
 */
export const fallbackUsageTotal = new Counter({
  name: 'gemini_fallback_usage_total',
  help: 'Total number of times OpenAI fallback was used',
  labelNames: ['reason'],
  registers: [register],
});

/**
 * Token consumption
 */
export const tokensConsumedTotal = new Counter({
  name: 'gemini_tokens_consumed_total',
  help: 'Total number of tokens consumed',
  labelNames: ['model', 'type'], // type: prompt or completion
  registers: [register],
});

/**
 * Rate limit remaining
 */
export const rateLimitRemaining = new Gauge({
  name: 'gemini_rate_limit_remaining',
  help: 'Remaining rate limit quota',
  labelNames: ['window', 'user_id'], // window: second, minute, hour, day
  registers: [register],
});

/**
 * Rate limit exceeded counter
 */
export const rateLimitExceededTotal = new Counter({
  name: 'gemini_rate_limit_exceeded_total',
  help: 'Total number of rate limit exceeded events',
  labelNames: ['window', 'user_id'],
  registers: [register],
});

/**
 * Retry attempts
 */
export const retryAttemptsTotal = new Counter({
  name: 'gemini_retry_attempts_total',
  help: 'Total number of retry attempts',
  labelNames: ['attempt', 'success'],
  registers: [register],
});

/**
 * Active connections
 */
export const activeConnections = new Gauge({
  name: 'gemini_active_connections',
  help: 'Number of active connections to Gemini API',
  registers: [register],
});

/**
 * Queue size (for rate limiting)
 */
export const queueSize = new Gauge({
  name: 'gemini_queue_size',
  help: 'Number of requests waiting in rate limit queue',
  registers: [register],
});

/**
 * Helper functions to record metrics
 */

export function recordRequest(status: string, method: string, endpoint: string) {
  geminiRequestsTotal.inc({ status, method, endpoint });
}

export function recordError(errorType: string, statusCode: number) {
  geminiErrorsTotal.inc({ error_type: errorType, status_code: statusCode.toString() });
}

export function recordDuration(method: string, endpoint: string, durationSeconds: number) {
  geminiDurationSeconds.observe({ method, endpoint }, durationSeconds);
}

export function setCircuitBreakerState(state: 'CLOSED' | 'OPEN' | 'HALF_OPEN') {
  const stateValue = state === 'CLOSED' ? 0 : state === 'OPEN' ? 1 : 2;
  circuitBreakerState.set(stateValue);
}

export function recordCacheHit(cacheType: string = 'redis') {
  cacheHitsTotal.inc({ cache_type: cacheType });
}

export function recordCacheMiss(cacheType: string = 'redis') {
  cacheMissesTotal.inc({ cache_type: cacheType });
}

export function recordFallbackUsage(reason: string) {
  fallbackUsageTotal.inc({ reason });
}

export function recordTokensConsumed(model: string, type: 'prompt' | 'completion', tokens: number) {
  tokensConsumedTotal.inc({ model, type }, tokens);
}

export function setRateLimitRemaining(window: string, userId: string, remaining: number) {
  rateLimitRemaining.set({ window, user_id: userId }, remaining);
}

export function recordRateLimitExceeded(window: string, userId: string) {
  rateLimitExceededTotal.inc({ window, user_id: userId });
}

export function recordRetryAttempt(attempt: number, success: boolean) {
  retryAttemptsTotal.inc({ attempt: attempt.toString(), success: success.toString() });
}

export function setActiveConnections(count: number) {
  activeConnections.set(count);
}

export function setQueueSize(size: number) {
  queueSize.set(size);
}

/**
 * Get all metrics as Prometheus text format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Reset all metrics (for testing)
 */
export function resetMetrics(): void {
  register.resetMetrics();
}
