/**
 * Broker Rate Limiter
 * Story 3.3: Broker Sync Architecture - Rate Limiting
 * 
 * Provides Redis-based rate limiting for broker API calls:
 * - Per-broker rate limits
 * - Sliding window algorithm
 * - Respects broker-specific limits
 * - Queue management when limits reached
 */

import { getRedisConnection, isRedisConfigured } from '@/lib/queue/redis';
import { brokerLogger } from '@/lib/logger';
import { BrokerType } from '@prisma/client';
import { BrokerRateLimitError } from './types';

// ============================================================================
// RATE LIMIT CONFIGURATION
// ============================================================================

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  brokerType: BrokerType;
}

/**
 * Broker-specific rate limits
 * These are conservative estimates - adjust based on actual broker documentation
 */
export const BROKER_RATE_LIMITS: Record<BrokerType, RateLimitConfig> = {
  TRADOVATE: {
    maxRequests: 100,
    windowMs: 60000, // 100 requests per minute
    brokerType: 'TRADOVATE',
  },
  IBKR: {
    maxRequests: 50,
    windowMs: 60000, // 50 requests per minute (conservative)
    brokerType: 'IBKR',
  },
  // Add more brokers as they are integrated
};

// ============================================================================
// RATE LIMITER CLASS
// ============================================================================

export class BrokerRateLimiter {
  private readonly config: RateLimitConfig;
  private readonly keyPrefix: string;
  private inMemoryFallback: Map<string, number[]> = new Map();

  constructor(brokerType: BrokerType, accountId?: string) {
    this.config = BROKER_RATE_LIMITS[brokerType] || {
      maxRequests: 60,
      windowMs: 60000,
      brokerType,
    };

    // Create unique key for this broker + account combination
    this.keyPrefix = accountId
      ? `broker:ratelimit:${brokerType}:${accountId}`
      : `broker:ratelimit:${brokerType}`;

    brokerLogger.debug(
      `[${brokerType}] Rate limiter initialized: ${this.config.maxRequests} requests per ${this.config.windowMs}ms`,
      { accountId, keyPrefix: this.keyPrefix }
    );
  }

  /**
   * Check if a request can be made, and consume a token if so
   * @throws BrokerRateLimitError if rate limit exceeded
   */
  async checkLimit(): Promise<void> {
    const now = Date.now();

    try {
      // Use Redis if configured
      if (isRedisConfigured()) {
        await this.checkLimitRedis(now);
      } else {
        // Fall back to in-memory (not distributed, but works for single instance)
        this.checkLimitInMemory(now);
      }
    } catch (error) {
      if (error instanceof BrokerRateLimitError) {
        throw error;
      }
      // If Redis fails, fall back to in-memory
      brokerLogger.warn('Redis rate limit check failed, falling back to in-memory', { error });
      this.checkLimitInMemory(now);
    }
  }

  /**
   * Redis-based rate limiting (sliding window)
   */
  private async checkLimitRedis(now: number): Promise<void> {
    const redis = await getRedisConnection();
    const key = this.keyPrefix;
    const windowStart = now - this.config.windowMs;

    // Use Redis sorted set for sliding window
    // Score = timestamp, Value = unique ID

    // Remove old entries outside the window
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count current requests in window
    const count = await redis.zcard(key);

    if (count >= this.config.maxRequests) {
      // Get oldest entry to calculate retry-after
      const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const oldestTimestamp = oldest.length > 1 ? parseInt(oldest[1]) : now;
      const retryAfterMs = Math.max(0, oldestTimestamp + this.config.windowMs - now);

      brokerLogger.warn(
        `[${this.config.brokerType}] Rate limit exceeded: ${count}/${this.config.maxRequests}`,
        { retryAfterMs, windowMs: this.config.windowMs }
      );

      throw new BrokerRateLimitError(
        `Rate limit exceeded for ${this.config.brokerType}: ${count}/${this.config.maxRequests} requests in ${this.config.windowMs}ms`,
        retryAfterMs
      );
    }

    // Add current request
    const requestId = `${now}-${Math.random()}`;
    await redis.zadd(key, now, requestId);

    // Set expiry on the key (cleanup)
    await redis.expire(key, Math.ceil(this.config.windowMs / 1000) + 10);

    brokerLogger.debug(
      `[${this.config.brokerType}] Rate limit check passed: ${count + 1}/${this.config.maxRequests}`,
      { windowMs: this.config.windowMs }
    );
  }

  /**
   * In-memory rate limiting (fallback)
   */
  private checkLimitInMemory(now: number): void {
    const key = this.keyPrefix;
    const windowStart = now - this.config.windowMs;

    // Get or create request timestamps array
    let timestamps = this.inMemoryFallback.get(key) || [];

    // Remove old timestamps outside the window
    timestamps = timestamps.filter((ts) => ts > windowStart);

    if (timestamps.length >= this.config.maxRequests) {
      const oldestTimestamp = timestamps[0] || now;
      const retryAfterMs = Math.max(0, oldestTimestamp + this.config.windowMs - now);

      brokerLogger.warn(
        `[${this.config.brokerType}] Rate limit exceeded (in-memory): ${timestamps.length}/${this.config.maxRequests}`,
        { retryAfterMs }
      );

      throw new BrokerRateLimitError(
        `Rate limit exceeded for ${this.config.brokerType}: ${timestamps.length}/${this.config.maxRequests} requests in ${this.config.windowMs}ms`,
        retryAfterMs
      );
    }

    // Add current request
    timestamps.push(now);
    this.inMemoryFallback.set(key, timestamps);

    brokerLogger.debug(
      `[${this.config.brokerType}] Rate limit check passed (in-memory): ${timestamps.length}/${this.config.maxRequests}`
    );
  }

  /**
   * Get current rate limit status
   */
  async getStatus(): Promise<{
    current: number;
    max: number;
    windowMs: number;
    resetAt: Date;
  }> {
    const now = Date.now();

    try {
      if (isRedisConfigured()) {
        const redis = await getRedisConnection();
        const key = this.keyPrefix;
        const windowStart = now - this.config.windowMs;

        await redis.zremrangebyscore(key, 0, windowStart);
        const count = await redis.zcard(key);

        // Get oldest entry for reset time
        const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
        const oldestTimestamp = oldest.length > 1 ? parseInt(oldest[1]) : now;
        const resetAt = new Date(oldestTimestamp + this.config.windowMs);

        return {
          current: count,
          max: this.config.maxRequests,
          windowMs: this.config.windowMs,
          resetAt,
        };
      } else {
        // In-memory fallback
        const key = this.keyPrefix;
        const windowStart = now - this.config.windowMs;
        let timestamps = this.inMemoryFallback.get(key) || [];
        timestamps = timestamps.filter((ts) => ts > windowStart);

        const oldestTimestamp = timestamps[0] || now;
        const resetAt = new Date(oldestTimestamp + this.config.windowMs);

        return {
          current: timestamps.length,
          max: this.config.maxRequests,
          windowMs: this.config.windowMs,
          resetAt,
        };
      }
    } catch (error) {
      brokerLogger.error('Failed to get rate limit status', error);
      return {
        current: 0,
        max: this.config.maxRequests,
        windowMs: this.config.windowMs,
        resetAt: new Date(now + this.config.windowMs),
      };
    }
  }

  /**
   * Reset rate limit (for testing or manual intervention)
   */
  async reset(): Promise<void> {
    try {
      if (isRedisConfigured()) {
        const redis = await getRedisConnection();
        await redis.del(this.keyPrefix);
      }
      this.inMemoryFallback.delete(this.keyPrefix);
      brokerLogger.info(`[${this.config.brokerType}] Rate limit reset`, {
        keyPrefix: this.keyPrefix,
      });
    } catch (error) {
      brokerLogger.error('Failed to reset rate limit', error);
    }
  }
}

// ============================================================================
// FACTORY & UTILITIES
// ============================================================================

/**
 * Create a rate limiter for a specific broker and account
 */
export function createRateLimiter(
  brokerType: BrokerType,
  accountId?: string
): BrokerRateLimiter {
  return new BrokerRateLimiter(brokerType, accountId);
}

/**
 * Execute a function with rate limiting
 */
export async function withRateLimit<T>(
  brokerType: BrokerType,
  fn: () => Promise<T>,
  accountId?: string
): Promise<T> {
  const limiter = createRateLimiter(brokerType, accountId);
  await limiter.checkLimit();
  return fn();
}

/**
 * Get rate limit status for all brokers
 */
export async function getAllRateLimitStatus(): Promise<
  Record<
    BrokerType,
    {
      current: number;
      max: number;
      windowMs: number;
      resetAt: Date;
    }
  >
> {
  const statuses: Partial<
    Record<
      BrokerType,
      {
        current: number;
        max: number;
        windowMs: number;
        resetAt: Date;
      }
    >
  > = {};

  for (const brokerType of Object.keys(BROKER_RATE_LIMITS) as BrokerType[]) {
    const limiter = createRateLimiter(brokerType);
    statuses[brokerType] = await limiter.getStatus();
  }

  return statuses as Record<
    BrokerType,
    {
      current: number;
      max: number;
      windowMs: number;
      resetAt: Date;
    }
  >;
}
