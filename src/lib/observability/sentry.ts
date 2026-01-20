/**
 * Sentry Error Tracking Integration
 * Story 1.9: Production Monitoring & Alerting
 *
 * Wrapper around @sentry/nextjs SDK for consistent API across the app.
 * The SDK is initialized in sentry.*.config.ts files.
 */

import * as Sentry from '@sentry/nextjs';

// ============================================================================
// Types (re-exported for backwards compatibility)
// ============================================================================

export type SeverityLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

export interface SentryUser {
  id?: string;
  email?: string;
  username?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const isDev = process.env.NODE_ENV === 'development';

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if Sentry is configured and enabled
 */
export function isSentryEnabled(): boolean {
  return !!SENTRY_DSN && !isDev;
}

/**
 * Set user context for all events
 */
export function setUser(user: SentryUser | null): void {
  if (user) {
    Sentry.setUser(user);
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Set global context
 */
export function setContext(name: string, context: Record<string, unknown> | null): void {
  Sentry.setContext(name, context);
}

/**
 * Set global tag
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

/**
 * Set multiple tags at once
 */
export function setTags(tags: Record<string, string>): void {
  Sentry.setTags(tags);
}

/**
 * Capture an exception
 */
export function captureException(
  error: Error | unknown,
  context?: Record<string, unknown>
): string | undefined {
  if (isDev) {
    console.error('[Sentry] Would capture exception:', error);
  }

  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message
 */
export function captureMessage(
  message: string,
  level: SeverityLevel = 'info',
  context?: Record<string, unknown>
): string | undefined {
  if (isDev) {
    console.log(`[Sentry] Would capture message (${level}):`, message);
  }

  return Sentry.captureMessage(message, {
    level: level as Sentry.SeverityLevel,
    extra: context,
  });
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: {
  category?: string;
  message?: string;
  level?: SeverityLevel;
  data?: Record<string, unknown>;
}): void {
  Sentry.addBreadcrumb({
    ...breadcrumb,
    level: breadcrumb.level as Sentry.SeverityLevel,
  });
}

/**
 * Start a new span for performance monitoring
 */
export function startSpan<T>(
  options: { name: string; op?: string; attributes?: Record<string, string | number | boolean> },
  callback: () => T
): T {
  return Sentry.startSpan(options, callback);
}

/**
 * Start an inactive span (for manual control)
 */
export function startInactiveSpan(options: {
  name: string;
  op?: string;
  attributes?: Record<string, string | number | boolean>;
}): Sentry.Span | undefined {
  return Sentry.startInactiveSpan(options);
}

/**
 * Wrap a function with Sentry error handling
 */
export function withScope<T>(callback: (scope: Sentry.Scope) => T): T {
  return Sentry.withScope(callback);
}

/**
 * Flush pending events
 */
export async function flush(timeout?: number): Promise<boolean> {
  return Sentry.flush(timeout);
}

/**
 * Close Sentry (for graceful shutdown)
 */
export async function close(timeout?: number): Promise<boolean> {
  return Sentry.close(timeout);
}

// ============================================================================
// Transaction Helpers
// ============================================================================

/**
 * Create a transaction for tracking a specific operation
 */
export function startTransaction(options: {
  name: string;
  op: string;
  data?: Record<string, unknown>;
}): Sentry.Span | undefined {
  return Sentry.startInactiveSpan({
    name: options.name,
    op: options.op,
    attributes: options.data as Record<string, string | number | boolean>,
  });
}

/**
 * Helper to track API route performance
 */
export async function trackApiRoute<T>(
  routeName: string,
  method: string,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      name: routeName,
      op: 'http.server',
      attributes: {
        'http.method': method,
      },
    },
    fn
  );
}

/**
 * Helper to track database operations
 */
export async function trackDbOperation<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      name: `${operation} ${table}`,
      op: 'db.query',
      attributes: {
        'db.operation': operation,
        'db.table': table,
      },
    },
    fn
  );
}
