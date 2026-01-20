/**
 * Sentry Edge Runtime Configuration
 * Story 1.9: Production Monitoring & Alerting
 *
 * This file configures Sentry for Edge Runtime (middleware, edge API routes).
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production' && !!SENTRY_DSN,

  // Lower sample rate for edge - high traffic
  tracesSampleRate: 0.01, // 1% of transactions

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
});
