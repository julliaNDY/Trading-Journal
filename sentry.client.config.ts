/**
 * Sentry Client Configuration
 * Story 1.9: Production Monitoring & Alerting
 *
 * This file configures Sentry for the browser (client-side).
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production' && !!SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% of transactions for performance
  tracePropagationTargets: [
    'localhost',
    /^https:\/\/.*\.vercel\.app/,
    /^https:\/\/tradingpath\.app/,
  ],

  // Session Replay (optional - can be expensive)
  replaysSessionSampleRate: 0.01, // 1% of sessions
  replaysOnErrorSampleRate: 0.1, // 10% when an error occurs

  // Release tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'development',

  // Ignore common browser errors
  ignoreErrors: [
    // Browser extensions
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    // ResizeObserver errors (benign)
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    // Network errors
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    // User navigation
    'AbortError',
    'The operation was aborted',
  ],

  // Filter out PII from breadcrumbs
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'xhr' || breadcrumb.category === 'fetch') {
      // Don't log request bodies
      if (breadcrumb.data?.body) {
        breadcrumb.data.body = '[FILTERED]';
      }
    }
    return breadcrumb;
  },

  // Scrub sensitive data from events
  beforeSend(event) {
    // Remove sensitive query params
    if (event.request?.query_string) {
      const sensitiveParams = ['token', 'key', 'password', 'secret', 'auth'];
      const params = new URLSearchParams(event.request.query_string);
      sensitiveParams.forEach((param) => {
        if (params.has(param)) {
          params.set(param, '[FILTERED]');
        }
      });
      event.request.query_string = params.toString();
    }
    return event;
  },

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
