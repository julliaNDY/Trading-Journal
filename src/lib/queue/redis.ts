/**
 * Redis Connection
 * Story 1.2: Redis + BullMQ Setup
 *
 * Provides Redis connection for BullMQ job queues.
 * Supports both Upstash (serverless) and standard Redis.
 *
 * Environment Variables:
 * - REDIS_URL: Full Redis connection URL (recommended for Upstash)
 * - REDIS_HOST: Redis host (default: localhost)
 * - REDIS_PORT: Redis port (default: 6379)
 * - REDIS_PASSWORD: Redis password (optional)
 * - REDIS_TLS: Enable TLS (default: false, auto-enabled for Upstash)
 */

import IORedis, { Redis, RedisOptions } from 'ioredis';
import { logger } from '@/lib/observability';

// ============================================================================
// Configuration
// ============================================================================

function getRedisConfig(): RedisOptions {
  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;

  // If we have a full URL, parse it
  if (redisUrl) {
    try {
      const url = new URL(redisUrl);

      // Upstash uses rediss:// for TLS
      const useTls = url.protocol === 'rediss:' || process.env.REDIS_TLS === 'true';

      return {
        host: url.hostname,
        port: parseInt(url.port, 10) || 6379,
        password: url.password || undefined,
        username: url.username || undefined,
        tls: useTls ? {} : undefined,
        maxRetriesPerRequest: null, // Required for BullMQ
        enableReadyCheck: false, // Faster startup
        lazyConnect: true, // Don't connect immediately
      };
    } catch (error) {
      logger.warn('Failed to parse REDIS_URL, falling back to individual env vars', { error });
    }
  }

  // Fall back to individual environment variables
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
  };
}

// ============================================================================
// Connection Management
// ============================================================================

let redisConnection: Redis | null = null;
let connectionPromise: Promise<Redis> | null = null;

/**
 * Get or create Redis connection
 */
export async function getRedisConnection(): Promise<Redis> {
  // Return existing connection if healthy
  if (redisConnection && redisConnection.status === 'ready') {
    return redisConnection;
  }

  // Wait for pending connection
  if (connectionPromise) {
    return connectionPromise;
  }

  // Create new connection
  connectionPromise = createConnection();
  return connectionPromise;
}

async function createConnection(): Promise<Redis> {
  const config = getRedisConfig();
  const redis = new IORedis(config);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      redis.disconnect();
      reject(new Error('Redis connection timeout (10s)'));
    }, 10000);

    redis.on('connect', () => {
      logger.info('Redis connected', {
        host: config.host,
        port: config.port,
        tls: !!config.tls,
      });
    });

    redis.on('ready', () => {
      clearTimeout(timeout);
      redisConnection = redis;
      connectionPromise = null;
      resolve(redis);
    });

    redis.on('error', (error) => {
      logger.error('Redis error', error);
      clearTimeout(timeout);
      connectionPromise = null;
      reject(error);
    });

    redis.on('close', () => {
      logger.info('Redis connection closed');
      redisConnection = null;
    });

    // Initiate connection
    redis.connect().catch((error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * Check if Redis is configured
 */
export function isRedisConfigured(): boolean {
  return !!(
    process.env.REDIS_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.REDIS_HOST
  );
}

/**
 * Test Redis connection
 */
export async function testRedisConnection(): Promise<{
  success: boolean;
  latencyMs: number;
  error?: string;
}> {
  if (!isRedisConfigured()) {
    return {
      success: false,
      latencyMs: 0,
      error: 'Redis not configured',
    };
  }

  const startTime = performance.now();

  try {
    const redis = await getRedisConnection();
    const pong = await redis.ping();
    const latencyMs = Math.round(performance.now() - startTime);

    return {
      success: pong === 'PONG',
      latencyMs,
    };
  } catch (error) {
    return {
      success: false,
      latencyMs: Math.round(performance.now() - startTime),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get Redis connection for BullMQ (creates new connection each time)
 * BullMQ requires separate connections for Queue and Worker
 */
export function createBullMQConnection(): Redis {
  const config = getRedisConfig();
  return new IORedis(config);
}

/**
 * Disconnect Redis
 */
export async function disconnectRedis(): Promise<void> {
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}

/**
 * Get Redis info
 */
export async function getRedisInfo(): Promise<{
  configured: boolean;
  connected: boolean;
  memory?: string;
  clients?: number;
  uptime?: number;
}> {
  if (!isRedisConfigured()) {
    return { configured: false, connected: false };
  }

  try {
    const redis = await getRedisConnection();
    const info = await redis.info();

    // Parse info string
    const memoryMatch = info.match(/used_memory_human:(\S+)/);
    const clientsMatch = info.match(/connected_clients:(\d+)/);
    const uptimeMatch = info.match(/uptime_in_seconds:(\d+)/);

    return {
      configured: true,
      connected: true,
      memory: memoryMatch?.[1],
      clients: clientsMatch ? parseInt(clientsMatch[1], 10) : undefined,
      uptime: uptimeMatch ? parseInt(uptimeMatch[1], 10) : undefined,
    };
  } catch {
    return {
      configured: true,
      connected: false,
    };
  }
}
