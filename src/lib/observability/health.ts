/**
 * Health Check Utilities
 * Story 1.9: Production Monitoring & Alerting
 *
 * Provides health check functions for all services.
 */

import { logger } from './logger';

// ============================================================================
// Types
// ============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ServiceHealth {
  name: string;
  status: HealthStatus;
  latencyMs: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  services: ServiceHealth[];
}

// ============================================================================
// Health Check Functions
// ============================================================================

/**
 * Check database connectivity
 */
export async function checkDatabase(): Promise<ServiceHealth> {
  const startTime = performance.now();
  const name = 'database';

  try {
    // Dynamic import to avoid circular dependencies
    const { prisma } = await import('@/lib/prisma');

    // Simple query to check connectivity
    await prisma.$queryRaw`SELECT 1`;

    return {
      name,
      status: 'healthy',
      latencyMs: Math.round(performance.now() - startTime),
    };
  } catch (error) {
    logger.error('Database health check failed', error);

    return {
      name,
      status: 'unhealthy',
      latencyMs: Math.round(performance.now() - startTime),
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Check Redis connectivity
 */
export async function checkRedis(): Promise<ServiceHealth> {
  const startTime = performance.now();
  const name = 'redis';

  try {
    // Dynamic import to avoid issues when Redis is not configured
    const { testRedisConnection, isRedisConfigured } = await import('@/lib/queue/redis');

    if (!isRedisConfigured()) {
      return {
        name,
        status: 'degraded',
        latencyMs: 0,
        message: 'Redis not configured',
      };
    }

    const result = await testRedisConnection();

    return {
      name,
      status: result.success ? 'healthy' : 'unhealthy',
      latencyMs: result.latencyMs,
      message: result.error,
    };
  } catch (error) {
    logger.error('Redis health check failed', error);

    return {
      name,
      status: 'unhealthy',
      latencyMs: Math.round(performance.now() - startTime),
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Check Vector DB (Qdrant) connectivity
 */
export async function checkQdrant(): Promise<ServiceHealth> {
  const startTime = performance.now();
  const name = 'qdrant';

  const qdrantUrl = process.env.QDRANT_URL;

  if (!qdrantUrl) {
    return {
      name,
      status: 'degraded',
      latencyMs: 0,
      message: 'Qdrant not configured',
    };
  }

  try {
    const response = await fetch(`${qdrantUrl}/collections`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.QDRANT_API_KEY && { 'api-key': process.env.QDRANT_API_KEY }),
      },
      signal: AbortSignal.timeout(5000),
    });

    const latencyMs = Math.round(performance.now() - startTime);

    if (response.ok) {
      const data = await response.json();
      return {
        name,
        status: 'healthy',
        latencyMs,
        details: {
          collections: data.result?.collections?.length || 0,
        },
      };
    }

    return {
      name,
      status: 'unhealthy',
      latencyMs,
      message: `HTTP ${response.status}`,
    };
  } catch (error) {
    logger.error('Qdrant health check failed', error);

    return {
      name,
      status: 'unhealthy',
      latencyMs: Math.round(performance.now() - startTime),
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Check TimescaleDB connectivity
 */
export async function checkTimescale(): Promise<ServiceHealth> {
  const startTime = performance.now();
  const name = 'timescaledb';

  const timescaleUrl = process.env.TIMESCALE_DATABASE_URL;

  if (!timescaleUrl || process.env.USE_TIMESCALEDB !== 'true') {
    return {
      name,
      status: 'degraded',
      latencyMs: 0,
      message: 'TimescaleDB not configured or not enabled',
    };
  }

  try {
    // Dynamic import pg
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: timescaleUrl, connectionTimeoutMillis: 5000 });

    const client = await pool.connect();
    const result = await client.query('SELECT 1 as health');
    client.release();
    await pool.end();

    return {
      name,
      status: result.rows.length > 0 ? 'healthy' : 'unhealthy',
      latencyMs: Math.round(performance.now() - startTime),
    };
  } catch (error) {
    logger.error('TimescaleDB health check failed', error);

    return {
      name,
      status: 'unhealthy',
      latencyMs: Math.round(performance.now() - startTime),
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Check external API connectivity (Stripe, OpenAI, etc.)
 */
export async function checkExternalApis(): Promise<ServiceHealth[]> {
  const results: ServiceHealth[] = [];

  // Stripe
  if (process.env.STRIPE_SECRET_KEY) {
    const stripeHealth = await checkStripe();
    results.push(stripeHealth);
  }

  // OpenAI/Gemini - just check if configured
  if (process.env.OPENAI_API_KEY) {
    results.push({
      name: 'openai',
      status: 'healthy',
      latencyMs: 0,
      message: 'API key configured',
    });
  }

  if (process.env.GOOGLE_API_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    results.push({
      name: 'google',
      status: 'healthy',
      latencyMs: 0,
      message: 'API credentials configured',
    });
  }

  return results;
}

/**
 * Check Stripe API connectivity
 */
async function checkStripe(): Promise<ServiceHealth> {
  const startTime = performance.now();
  const name = 'stripe';

  try {
    const response = await fetch('https://api.stripe.com/v1/balance', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    return {
      name,
      status: response.ok ? 'healthy' : 'degraded',
      latencyMs: Math.round(performance.now() - startTime),
      message: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name,
      status: 'degraded',
      latencyMs: Math.round(performance.now() - startTime),
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Aggregate overall health status
 */
export function aggregateHealthStatus(services: ServiceHealth[]): HealthStatus {
  const hasUnhealthy = services.some((s) => s.status === 'unhealthy');
  const hasDegraded = services.some((s) => s.status === 'degraded');

  // Critical services that must be healthy
  const criticalServices = ['database'];
  const criticalUnhealthy = services.some(
    (s) => criticalServices.includes(s.name) && s.status === 'unhealthy'
  );

  if (criticalUnhealthy) return 'unhealthy';
  if (hasUnhealthy) return 'degraded';
  if (hasDegraded) return 'degraded';

  return 'healthy';
}

/**
 * Run all health checks
 */
export async function runHealthChecks(): Promise<HealthCheckResult> {
  const services: ServiceHealth[] = [];

  // Run checks in parallel
  const [database, redis, qdrant, timescale, externalApis] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkQdrant(),
    checkTimescale(),
    checkExternalApis(),
  ]);

  services.push(database, redis, qdrant, timescale, ...externalApis);

  const status = aggregateHealthStatus(services);

  return {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || process.env.npm_package_version || 'dev',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    services,
  };
}
