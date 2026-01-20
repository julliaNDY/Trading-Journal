/**
 * Web Vitals Monitoring
 * Story 1.9: Production Monitoring & Alerting
 *
 * Tracks Core Web Vitals and reports to analytics.
 * Uses Vercel Analytics when available, falls back to custom reporting.
 *
 * Usage in _app.tsx or layout.tsx:
 *   import { reportWebVitals } from '@/lib/observability/web-vitals';
 *   export { reportWebVitals };
 */

import { recordMetric } from './metrics';

// ============================================================================
// Types
// ============================================================================

export interface WebVitalsMetric {
  id: string;
  name: 'CLS' | 'FCP' | 'FID' | 'INP' | 'LCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  navigationType: 'navigate' | 'reload' | 'back-forward' | 'prerender';
}

export interface WebVitalsThresholds {
  CLS: [number, number]; // [good, poor]
  FCP: [number, number];
  FID: [number, number];
  INP: [number, number];
  LCP: [number, number];
  TTFB: [number, number];
}

// ============================================================================
// Thresholds (Based on Google's Core Web Vitals)
// ============================================================================

export const WEB_VITALS_THRESHOLDS: WebVitalsThresholds = {
  CLS: [0.1, 0.25], // Cumulative Layout Shift
  FCP: [1800, 3000], // First Contentful Paint (ms)
  FID: [100, 300], // First Input Delay (ms)
  INP: [200, 500], // Interaction to Next Paint (ms)
  LCP: [2500, 4000], // Largest Contentful Paint (ms)
  TTFB: [800, 1800], // Time to First Byte (ms)
};

// ============================================================================
// Rating Functions
// ============================================================================

/**
 * Get rating for a web vitals metric
 */
export function getWebVitalsRating(
  name: WebVitalsMetric['name'],
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const [good, poor] = WEB_VITALS_THRESHOLDS[name];

  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

// ============================================================================
// Reporter
// ============================================================================

/**
 * Report Web Vitals to analytics
 * Call this from your Next.js app to track Core Web Vitals
 */
export function reportWebVitals(metric: WebVitalsMetric): void {
  const { name, value, rating, id } = metric;

  // Record to internal metrics
  recordMetric(`web-vitals.${name.toLowerCase()}`, value, 'ms', {
    rating,
    id,
  });

  // Log in development
  if (process.env.NODE_ENV === 'development') {
    const color =
      rating === 'good'
        ? '\x1b[32m'
        : rating === 'needs-improvement'
          ? '\x1b[33m'
          : '\x1b[31m';
    console.log(`${color}[Web Vitals] ${name}: ${value.toFixed(2)} (${rating})\x1b[0m`);
  }

  // Send to Vercel Analytics (if available)
  if (typeof window !== 'undefined' && 'va' in window) {
    // Vercel Analytics handles this automatically via @vercel/analytics
  }

  // Send to external analytics (optional)
  if (process.env.NEXT_PUBLIC_ANALYTICS_ID) {
    sendToAnalytics(metric);
  }
}

/**
 * Send web vitals to external analytics service
 */
function sendToAnalytics(metric: WebVitalsMetric): void {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
    timestamp: Date.now(),
  });

  // Use sendBeacon if available (doesn't block page unload)
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/web-vitals', body);
  } else {
    fetch('/api/analytics/web-vitals', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {
      // Silently fail
    });
  }
}

// ============================================================================
// Performance Budget Checker
// ============================================================================

/**
 * Check if web vitals meet performance budgets
 */
export function checkPerformanceBudget(
  metrics: Partial<Record<WebVitalsMetric['name'], number>>
): {
  passed: boolean;
  results: Array<{
    name: string;
    value: number;
    budget: number;
    passed: boolean;
  }>;
} {
  const results: Array<{
    name: string;
    value: number;
    budget: number;
    passed: boolean;
  }> = [];

  for (const [name, value] of Object.entries(metrics)) {
    const thresholds = WEB_VITALS_THRESHOLDS[name as WebVitalsMetric['name']];
    if (thresholds) {
      const [good] = thresholds;
      results.push({
        name,
        value,
        budget: good,
        passed: value <= good,
      });
    }
  }

  return {
    passed: results.every((r) => r.passed),
    results,
  };
}
