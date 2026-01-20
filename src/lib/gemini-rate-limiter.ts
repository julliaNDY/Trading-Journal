/**
 * Google Gemini API Rate Limiter
 * PRÉ-7.2: Rate Limiting (12h) - Phase 11
 * 
 * Provides Redis-based rate limiting for Google Gemini API calls:
 * - Per-user and global rate limits
 * - Sliding window algorithm
 * - Respects Gemini API limits (10 req/sec max)
 * - Redis caching for responses (5 min TTL)
 * - In-memory fallback when Redis unavailable
 * - Automatic retry with exponential backoff
 * 
 * Gemini API Limits (Free Tier):
 * - 15 RPM (requests per minute)
 * - 1 million TPM (tokens per minute)
 * - 1,500 RPD (requests per day)
 * 
 * Gemini API Limits (Paid Tier):
 * - 360 RPM (requests per minute) = 6 RPS
 * - 4 million TPM (tokens per minute)
 * - 10,000 RPD (requests per day)
 * 
 * Our Conservative Limits (Production):
 * - 10 RPS (600 RPM) - well below paid tier
 * - Per-user: 100 requests per hour
 * - Global: 500 requests per hour
 */

import { getRedisConnection, isRedisConfigured } from '@/lib/queue/redis';
import { logger } from '@/lib/observability';
import { cacheGet, cacheSet } from '@/lib/cache';

// ============================================================================
// RATE LIMIT CONFIGURATION
// ============================================================================

export interface GeminiRateLimitConfig {
  maxRequestsPerSecond: number;
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  maxTokensPerMinute: number;
}

/**
 * Gemini API rate limits (conservative production settings)
 */
export const GEMINI_RATE_LIMITS = {
  // Global limits (across all users)
  GLOBAL: {
    maxRequestsPerSecond: 10, // 10 RPS max
    maxRequestsPerMinute: 600, // 600 RPM (conservative)
    maxRequestsPerHour: 10000, // 10k per hour
    maxRequestsPerDay: 100000, // 100k per day
    maxTokensPerMinute: 2000000, // 2M tokens/min
  } as GeminiRateLimitConfig,

  // Per-user limits (prevent single user abuse)
  PER_USER: {
    maxRequestsPerSecond: 2, // 2 RPS per user
    maxRequestsPerMinute: 60, // 60 RPM per user
    maxRequestsPerHour: 500, // 500 per hour per user
    maxRequestsPerDay: 2000, // 2k per day per user
    maxTokensPerMinute: 100000, // 100k tokens/min per user
  } as GeminiRateLimitConfig,
} as const;

/**
 * Cache TTL for Gemini responses (5 minutes)
 */
export const GEMINI_CACHE_TTL = 300; // 5 minutes in seconds

/**
 * Retry configuration
 */
export const GEMINI_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 10000, // 10 seconds
  backoffMultiplier: 2,
} as const;

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class GeminiRateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs: number,
    public readonly limitType: 'global' | 'user' | 'token'
  ) {
    super(message);
    this.name = 'GeminiRateLimitError';
  }
}

export class GeminiQuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiQuotaExceededError';
  }
}

// ============================================================================
// RATE LIMITER CLASS
// ============================================================================

export class GeminiRateLimiter {
  private readonly keyPrefix: string;
  private readonly config: GeminiRateLimitConfig;
  private readonly userId?: string;
  private inMemoryFallback: Map<string, number[]> = new Map();
  private inMemoryTokens: Map<string, { tokens: number; timestamp: number }[]> = new Map();

  constructor(userId?: string) {
    this.userId = userId;
    this.config = userId ? GEMINI_RATE_LIMITS.PER_USER : GEMINI_RATE_LIMITS.GLOBAL;
    this.keyPrefix = userId ? `gemini:ratelimit:user:${userId}` : 'gemini:ratelimit:global';

    logger.debug('[Gemini] Rate limiter initialized', {
      userId,
      config: this.config,
      keyPrefix: this.keyPrefix,
    });
  }

  /**
   * Check if a request can be made, and consume a token if so
   * @throws GeminiRateLimitError if rate limit exceeded
   */
  async checkLimit(estimatedTokens: number = 1000): Promise<void> {
    const now = Date.now();

    try {
      // Use Redis if configured
      if (isRedisConfigured()) {
        await this.checkLimitRedis(now, estimatedTokens);
      } else {
        // Fall back to in-memory (not distributed, but works for single instance)
        this.checkLimitInMemory(now, estimatedTokens);
      }
    } catch (error) {
      if (error instanceof GeminiRateLimitError || error instanceof GeminiQuotaExceededError) {
        throw error;
      }
      // If Redis fails, fall back to in-memory
      logger.warn('[Gemini] Redis rate limit check failed, falling back to in-memory', { error });
      this.checkLimitInMemory(now, estimatedTokens);
    }
  }

  /**
   * Redis-based rate limiting (sliding window)
   */
  private async checkLimitRedis(now: number, estimatedTokens: number): Promise<void> {
    const redis = await getRedisConnection();

    // Check multiple time windows
    const checks = [
      { window: 1000, max: this.config.maxRequestsPerSecond, label: 'second' },
      { window: 60000, max: this.config.maxRequestsPerMinute, label: 'minute' },
      { window: 3600000, max: this.config.maxRequestsPerHour, label: 'hour' },
      { window: 86400000, max: this.config.maxRequestsPerDay, label: 'day' },
    ];

    for (const { window, max, label } of checks) {
      const key = `${this.keyPrefix}:${label}`;
      const windowStart = now - window;

      // Remove old entries outside the window
      await redis.zremrangebyscore(key, 0, windowStart);

      // Count current requests in window
      const count = await redis.zcard(key);

      if (count >= max) {
        // Get oldest entry to calculate retry-after
        const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
        const oldestTimestamp = oldest.length > 1 ? parseInt(oldest[1]) : now;
        const retryAfterMs = Math.max(0, oldestTimestamp + window - now);

        logger.warn(`[Gemini] Rate limit exceeded (${label})`, {
          userId: this.userId,
          count,
          max,
          retryAfterMs,
          window,
        });

        throw new GeminiRateLimitError(
          `Gemini rate limit exceeded: ${count}/${max} requests per ${label}`,
          retryAfterMs,
          this.userId ? 'user' : 'global'
        );
      }

      // Add current request
      const requestId = `${now}-${Math.random()}`;
      await redis.zadd(key, now, requestId);

      // Set expiry on the key (cleanup)
      await redis.expire(key, Math.ceil(window / 1000) + 10);
    }

    // Check token limit (per minute)
    const tokenKey = `${this.keyPrefix}:tokens:minute`;
    const tokenWindowStart = now - 60000; // 1 minute

    // Get token usage in current window
    const tokenEntries = await redis.zrangebyscore(tokenKey, tokenWindowStart, now);
    const currentTokens = tokenEntries.reduce((sum, entry) => {
      const tokens = parseInt(entry.split(':')[1] || '0');
      return sum + tokens;
    }, 0);

    if (currentTokens + estimatedTokens > this.config.maxTokensPerMinute) {
      const oldest = await redis.zrange(tokenKey, 0, 0, 'WITHSCORES');
      const oldestTimestamp = oldest.length > 1 ? parseInt(oldest[1]) : now;
      const retryAfterMs = Math.max(0, oldestTimestamp + 60000 - now);

      logger.warn('[Gemini] Token limit exceeded', {
        userId: this.userId,
        currentTokens,
        estimatedTokens,
        max: this.config.maxTokensPerMinute,
        retryAfterMs,
      });

      throw new GeminiRateLimitError(
        `Gemini token limit exceeded: ${currentTokens + estimatedTokens}/${this.config.maxTokensPerMinute} tokens per minute`,
        retryAfterMs,
        'token'
      );
    }

    // Record token usage
    await redis.zadd(tokenKey, now, `${now}:${estimatedTokens}`);
    await redis.expire(tokenKey, 70); // 1 minute + 10 seconds buffer

    logger.debug('[Gemini] Rate limit check passed', {
      userId: this.userId,
      estimatedTokens,
      currentTokens,
    });
  }

  /**
   * In-memory rate limiting (fallback)
   */
  private checkLimitInMemory(now: number, estimatedTokens: number): void {
    const checks = [
      { window: 1000, max: this.config.maxRequestsPerSecond, label: 'second' },
      { window: 60000, max: this.config.maxRequestsPerMinute, label: 'minute' },
      { window: 3600000, max: this.config.maxRequestsPerHour, label: 'hour' },
      { window: 86400000, max: this.config.maxRequestsPerDay, label: 'day' },
    ];

    for (const { window, max, label } of checks) {
      const key = `${this.keyPrefix}:${label}`;
      const windowStart = now - window;

      // Get or create request timestamps array
      let timestamps = this.inMemoryFallback.get(key) || [];

      // Remove old timestamps outside the window
      timestamps = timestamps.filter((ts) => ts > windowStart);

      if (timestamps.length >= max) {
        const oldestTimestamp = timestamps[0] || now;
        const retryAfterMs = Math.max(0, oldestTimestamp + window - now);

        logger.warn(`[Gemini] Rate limit exceeded (in-memory, ${label})`, {
          userId: this.userId,
          count: timestamps.length,
          max,
          retryAfterMs,
        });

        throw new GeminiRateLimitError(
          `Gemini rate limit exceeded: ${timestamps.length}/${max} requests per ${label}`,
          retryAfterMs,
          this.userId ? 'user' : 'global'
        );
      }

      // Add current request
      timestamps.push(now);
      this.inMemoryFallback.set(key, timestamps);
    }

    // Check token limit (per minute)
    const tokenKey = `${this.keyPrefix}:tokens:minute`;
    const tokenWindowStart = now - 60000;

    let tokenEntries = this.inMemoryTokens.get(tokenKey) || [];
    tokenEntries = tokenEntries.filter((entry) => entry.timestamp > tokenWindowStart);

    const currentTokens = tokenEntries.reduce((sum, entry) => sum + entry.tokens, 0);

    if (currentTokens + estimatedTokens > this.config.maxTokensPerMinute) {
      const oldestTimestamp = tokenEntries[0]?.timestamp || now;
      const retryAfterMs = Math.max(0, oldestTimestamp + 60000 - now);

      logger.warn('[Gemini] Token limit exceeded (in-memory)', {
        userId: this.userId,
        currentTokens,
        estimatedTokens,
        max: this.config.maxTokensPerMinute,
        retryAfterMs,
      });

      throw new GeminiRateLimitError(
        `Gemini token limit exceeded: ${currentTokens + estimatedTokens}/${this.config.maxTokensPerMinute} tokens per minute`,
        retryAfterMs,
        'token'
      );
    }

    // Record token usage
    tokenEntries.push({ tokens: estimatedTokens, timestamp: now });
    this.inMemoryTokens.set(tokenKey, tokenEntries);

    logger.debug('[Gemini] Rate limit check passed (in-memory)', {
      userId: this.userId,
      estimatedTokens,
      currentTokens,
    });
  }

  /**
   * Get current rate limit status
   */
  async getStatus(): Promise<{
    second: { current: number; max: number; resetAt: Date };
    minute: { current: number; max: number; resetAt: Date };
    hour: { current: number; max: number; resetAt: Date };
    day: { current: number; max: number; resetAt: Date };
    tokens: { current: number; max: number; resetAt: Date };
  }> {
    const now = Date.now();

    const getWindowStatus = async (
      window: number,
      max: number,
      label: string
    ): Promise<{ current: number; max: number; resetAt: Date }> => {
      try {
        if (isRedisConfigured()) {
          const redis = await getRedisConnection();
          const key = `${this.keyPrefix}:${label}`;
          const windowStart = now - window;

          await redis.zremrangebyscore(key, 0, windowStart);
          const count = await redis.zcard(key);

          const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
          const oldestTimestamp = oldest.length > 1 ? parseInt(oldest[1]) : now;
          const resetAt = new Date(oldestTimestamp + window);

          return { current: count, max, resetAt };
        } else {
          // In-memory fallback
          const key = `${this.keyPrefix}:${label}`;
          const windowStart = now - window;
          let timestamps = this.inMemoryFallback.get(key) || [];
          timestamps = timestamps.filter((ts) => ts > windowStart);

          const oldestTimestamp = timestamps[0] || now;
          const resetAt = new Date(oldestTimestamp + window);

          return { current: timestamps.length, max, resetAt };
        }
      } catch (error) {
        logger.error('[Gemini] Failed to get rate limit status', { label, error });
        return { current: 0, max, resetAt: new Date(now + window) };
      }
    };

    const [second, minute, hour, day] = await Promise.all([
      getWindowStatus(1000, this.config.maxRequestsPerSecond, 'second'),
      getWindowStatus(60000, this.config.maxRequestsPerMinute, 'minute'),
      getWindowStatus(3600000, this.config.maxRequestsPerHour, 'hour'),
      getWindowStatus(86400000, this.config.maxRequestsPerDay, 'day'),
    ]);

    // Get token status
    let tokenCurrent = 0;
    let tokenResetAt = new Date(now + 60000);

    try {
      if (isRedisConfigured()) {
        const redis = await getRedisConnection();
        const tokenKey = `${this.keyPrefix}:tokens:minute`;
        const tokenWindowStart = now - 60000;

        const tokenEntries = await redis.zrangebyscore(tokenKey, tokenWindowStart, now);
        tokenCurrent = tokenEntries.reduce((sum, entry) => {
          const tokens = parseInt(entry.split(':')[1] || '0');
          return sum + tokens;
        }, 0);

        const oldest = await redis.zrange(tokenKey, 0, 0, 'WITHSCORES');
        const oldestTimestamp = oldest.length > 1 ? parseInt(oldest[1]) : now;
        tokenResetAt = new Date(oldestTimestamp + 60000);
      } else {
        const tokenKey = `${this.keyPrefix}:tokens:minute`;
        const tokenWindowStart = now - 60000;
        let tokenEntries = this.inMemoryTokens.get(tokenKey) || [];
        tokenEntries = tokenEntries.filter((entry) => entry.timestamp > tokenWindowStart);

        tokenCurrent = tokenEntries.reduce((sum, entry) => sum + entry.tokens, 0);
        const oldestTimestamp = tokenEntries[0]?.timestamp || now;
        tokenResetAt = new Date(oldestTimestamp + 60000);
      }
    } catch (error) {
      logger.error('[Gemini] Failed to get token status', { error });
    }

    return {
      second,
      minute,
      hour,
      day,
      tokens: {
        current: tokenCurrent,
        max: this.config.maxTokensPerMinute,
        resetAt: tokenResetAt,
      },
    };
  }

  /**
   * Reset rate limit (for testing or manual intervention)
   */
  async reset(): Promise<void> {
    try {
      if (isRedisConfigured()) {
        const redis = await getRedisConnection();
        const keys = await redis.keys(`${this.keyPrefix}:*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }
      this.inMemoryFallback.clear();
      this.inMemoryTokens.clear();
      logger.info('[Gemini] Rate limit reset', { userId: this.userId, keyPrefix: this.keyPrefix });
    } catch (error) {
      logger.error('[Gemini] Failed to reset rate limit', { error });
    }
  }
}

// ============================================================================
// FACTORY & UTILITIES
// ============================================================================

/**
 * Create a rate limiter for a specific user (or global)
 */
export function createGeminiRateLimiter(userId?: string): GeminiRateLimiter {
  return new GeminiRateLimiter(userId);
}

/**
 * Execute a function with rate limiting and caching
 */
export async function withGeminiRateLimit<T>(
  fn: () => Promise<T>,
  options: {
    userId?: string;
    cacheKey?: string;
    cacheTTL?: number;
    estimatedTokens?: number;
    skipCache?: boolean;
  } = {}
): Promise<T> {
  const { userId, cacheKey, cacheTTL = GEMINI_CACHE_TTL, estimatedTokens = 1000, skipCache = false } = options;

  // Check cache first (if enabled and key provided)
  if (!skipCache && cacheKey) {
    const cached = await cacheGet<T>(cacheKey);
    if (cached !== null) {
      logger.debug('[Gemini] Cache hit', { cacheKey, userId });
      return cached;
    }
  }

  // Check rate limits
  const globalLimiter = createGeminiRateLimiter();
  await globalLimiter.checkLimit(estimatedTokens);

  if (userId) {
    const userLimiter = createGeminiRateLimiter(userId);
    await userLimiter.checkLimit(estimatedTokens);
  }

  // Execute function
  const result = await fn();

  // Cache result (if enabled and key provided)
  if (!skipCache && cacheKey) {
    await cacheSet(cacheKey, result, { ttl: cacheTTL });
    logger.debug('[Gemini] Response cached', { cacheKey, userId, ttl: cacheTTL });
  }

  return result;
}

/**
 * Execute a function with automatic retry on rate limit errors
 */
export async function withGeminiRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = GEMINI_RETRY_CONFIG.maxRetries,
    initialDelayMs = GEMINI_RETRY_CONFIG.initialDelayMs,
    maxDelayMs = GEMINI_RETRY_CONFIG.maxDelayMs,
    backoffMultiplier = GEMINI_RETRY_CONFIG.backoffMultiplier,
  } = options;

  let lastError: Error | null = null;
  let delayMs = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on quota exceeded (permanent failure)
      if (error instanceof GeminiQuotaExceededError) {
        throw error;
      }

      // Retry on rate limit errors
      if (error instanceof GeminiRateLimitError) {
        if (attempt < maxRetries) {
          // Use retry-after from error, or exponential backoff
          const waitMs = Math.min(error.retryAfterMs || delayMs, maxDelayMs);

          logger.warn('[Gemini] Rate limit hit, retrying', {
            attempt: attempt + 1,
            maxRetries,
            waitMs,
            limitType: error.limitType,
          });

          await new Promise((resolve) => setTimeout(resolve, waitMs));
          delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
          continue;
        }
      }

      // Don't retry on other errors
      throw error;
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Get rate limit status for all scopes
 */
export async function getGeminiRateLimitStatus(userId?: string): Promise<{
  global: Awaited<ReturnType<GeminiRateLimiter['getStatus']>>;
  user?: Awaited<ReturnType<GeminiRateLimiter['getStatus']>>;
}> {
  const globalLimiter = createGeminiRateLimiter();
  const globalStatus = await globalLimiter.getStatus();

  if (userId) {
    const userLimiter = createGeminiRateLimiter(userId);
    const userStatus = await userLimiter.getStatus();
    return { global: globalStatus, user: userStatus };
  }

  return { global: globalStatus };
}
