/**
 * Next.js Instrumentation
 * Story 1.9: Production Monitoring & Alerting
 *
 * This file is used to initialize Sentry on the server side.
 * It runs once when the server starts.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = async (
  err: Error,
  request: {
    path: string;
    method: string;
    headers: Record<string, string>;
  },
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'render' | 'route' | 'action' | 'middleware';
    revalidateReason?: 'on-demand' | 'stale';
  }
) => {
  // Only import Sentry when needed (lazy load)
  const Sentry = await import('@sentry/nextjs');

  Sentry.captureException(err, {
    tags: {
      routerKind: context.routerKind,
      routeType: context.routeType,
      routePath: context.routePath,
    },
    extra: {
      method: request.method,
      path: request.path,
      revalidateReason: context.revalidateReason,
    },
  });
};
