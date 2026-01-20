/**
 * Sentry Server Configuration
 * Story 1.9: Production Monitoring & Alerting
 *
 * This file configures Sentry for the Node.js server.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production' && !!SENTRY_DSN,

  // Performance Monitoring - lower rate for server to reduce costs
  tracesSampleRate: 0.05, // 5% of transactions

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',

  // Profile a percentage of transactions
  profilesSampleRate: 0.01, // 1% for profiling

  // Server-side error filtering
  ignoreErrors: [
    // Known operational errors
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    // Prisma connection errors (transient)
    'PrismaClientKnownRequestError',
    // Rate limiting responses
    'Too Many Requests',
  ],

  // Scrub sensitive data
  beforeSend(event) {
    // Remove sensitive headers
    if (event.request?.headers) {
      const sensitiveHeaders = [
        'authorization',
        'cookie',
        'x-api-key',
        'x-auth-token',
      ];
      sensitiveHeaders.forEach((header) => {
        if (event.request?.headers?.[header]) {
          event.request.headers[header] = '[FILTERED]';
        }
      });
    }

    // Remove env vars from extra context
    if (event.extra) {
      delete event.extra.DATABASE_URL;
      delete event.extra.SUPABASE_SERVICE_ROLE_KEY;
      delete event.extra.STRIPE_SECRET_KEY;
      delete event.extra.OPENAI_API_KEY;
    }

    return event;
  },

  // Add server context
  initialScope: {
    tags: {
      runtime: 'node',
      vercel: process.env.VERCEL ? 'true' : 'false',
      region: process.env.VERCEL_REGION || 'unknown',
    },
  },
});
