/**
 * Cache Service
 * Story 3.1: Unlimited Accounts - Redis Cache Layer
 *
 * Provides Redis-based caching for frequently accessed data.
 * Supports TTL, cache invalidation, and automatic serialization.
 *
 * Cache Strategy:
 * - Account data: 5 minutes TTL
 * - Account stats: 5 minutes TTL
 * - Account list: 2 minutes TTL (shorter due to frequent updates)
 * - Aggregate views: 5 minutes TTL
 */

import { getRedisConnection, isRedisConfigured } from '@/lib/queue/redis';
import { logger } from '@/lib/observability';

// ============================================================================
// Types
// ============================================================================

export interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 300 = 5 minutes)
  prefix?: string; // Cache key prefix
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

// ============================================================================
// Cache Keys
// ============================================================================

const CACHE_PREFIXES = {
  ACCOUNT: 'account',
  ACCOUNT_LIST: 'account:list',
  ACCOUNT_STATS: 'account:stats',
  ACCOUNT_COUNT: 'account:count',
  ACCOUNT_BROKERS: 'account:brokers',
  AGGREGATE_VIEW: 'aggregate:view',
} as const;

/**
 * Generate cache key
 */
function getCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(':')}`;
}

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Get value from cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  try {
    const redis = await getRedisConnection();
    const value = await redis.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch (error) {
    logger.error('Cache get error', { key, error });
    return null;
  }
}

/**
 * Set value in cache
 */
export async function cacheSet(
  key: string,
  value: unknown,
  options: CacheOptions = {}
): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  const { ttl = 300 } = options; // Default 5 minutes

  try {
    const redis = await getRedisConnection();
    const serialized = JSON.stringify(value);
    await redis.setex(key, ttl, serialized);
  } catch (error) {
    logger.error('Cache set error', { key, error });
  }
}

/**
 * Delete value from cache
 */
export async function cacheDelete(key: string): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  try {
    const redis = await getRedisConnection();
    await redis.del(key);
  } catch (error) {
    logger.error('Cache delete error', { key, error });
  }
}

/**
 * Delete multiple keys matching pattern
 */
export async function cacheDeletePattern(pattern: string): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  try {
    const redis = await getRedisConnection();
    const keys = await redis.keys(pattern);

    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info('Cache keys deleted', { pattern, count: keys.length });
    }
  } catch (error) {
    logger.error('Cache delete pattern error', { pattern, error });
  }
}

/**
 * Check if key exists in cache
 */
export async function cacheExists(key: string): Promise<boolean> {
  if (!isRedisConfigured()) {
    return false;
  }

  try {
    const redis = await getRedisConnection();
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    logger.error('Cache exists error', { key, error });
    return false;
  }
}

/**
 * Get cache TTL (time to live)
 */
export async function cacheTTL(key: string): Promise<number> {
  if (!isRedisConfigured()) {
    return -1;
  }

  try {
    const redis = await getRedisConnection();
    return await redis.ttl(key);
  } catch (error) {
    logger.error('Cache TTL error', { key, error });
    return -1;
  }
}

// ============================================================================
// Account-Specific Cache Operations
// ============================================================================

/**
 * Get account from cache
 */
export async function getCachedAccount(accountId: string, userId: string) {
  const key = getCacheKey(CACHE_PREFIXES.ACCOUNT, userId, accountId);
  return cacheGet(key);
}

/**
 * Set account in cache
 */
export async function setCachedAccount(
  accountId: string,
  userId: string,
  account: unknown
): Promise<void> {
  const key = getCacheKey(CACHE_PREFIXES.ACCOUNT, userId, accountId);
  await cacheSet(key, account, { ttl: 300 }); // 5 minutes
}

/**
 * Delete account from cache
 */
export async function deleteCachedAccount(accountId: string, userId: string): Promise<void> {
  const key = getCacheKey(CACHE_PREFIXES.ACCOUNT, userId, accountId);
  await cacheDelete(key);
}

/**
 * Get account list from cache
 */
export async function getCachedAccountList(
  userId: string,
  filterKey: string = 'default'
) {
  const key = getCacheKey(CACHE_PREFIXES.ACCOUNT_LIST, userId, filterKey);
  return cacheGet(key);
}

/**
 * Set account list in cache
 */
export async function setCachedAccountList(
  userId: string,
  filterKey: string = 'default',
  accounts: unknown
): Promise<void> {
  const key = getCacheKey(CACHE_PREFIXES.ACCOUNT_LIST, userId, filterKey);
  await cacheSet(key, accounts, { ttl: 120 }); // 2 minutes (shorter TTL)
}

/**
 * Get account stats from cache
 */
export async function getCachedAccountStats(accountId: string, userId: string) {
  const key = getCacheKey(CACHE_PREFIXES.ACCOUNT_STATS, userId, accountId);
  return cacheGet(key);
}

/**
 * Set account stats in cache
 */
export async function setCachedAccountStats(
  accountId: string,
  userId: string,
  stats: unknown
): Promise<void> {
  const key = getCacheKey(CACHE_PREFIXES.ACCOUNT_STATS, userId, accountId);
  await cacheSet(key, stats, { ttl: 300 }); // 5 minutes
}

/**
 * Get account count from cache
 */
export async function getCachedAccountCount(userId: string) {
  const key = getCacheKey(CACHE_PREFIXES.ACCOUNT_COUNT, userId);
  return cacheGet<number>(key);
}

/**
 * Set account count in cache
 */
export async function setCachedAccountCount(userId: string, count: number): Promise<void> {
  const key = getCacheKey(CACHE_PREFIXES.ACCOUNT_COUNT, userId);
  await cacheSet(key, count, { ttl: 300 }); // 5 minutes
}

/**
 * Get user brokers from cache
 */
export async function getCachedUserBrokers(userId: string) {
  const key = getCacheKey(CACHE_PREFIXES.ACCOUNT_BROKERS, userId);
  return cacheGet<string[]>(key);
}

/**
 * Set user brokers in cache
 */
export async function setCachedUserBrokers(userId: string, brokers: string[]): Promise<void> {
  const key = getCacheKey(CACHE_PREFIXES.ACCOUNT_BROKERS, userId);
  await cacheSet(key, brokers, { ttl: 300 }); // 5 minutes
}

/**
 * Get aggregate view from cache
 */
export async function getCachedAggregateView(userId: string, viewKey: string = 'default') {
  const key = getCacheKey(CACHE_PREFIXES.AGGREGATE_VIEW, userId, viewKey);
  return cacheGet(key);
}

/**
 * Set aggregate view in cache
 */
export async function setCachedAggregateView(
  userId: string,
  viewKey: string = 'default',
  view: unknown
): Promise<void> {
  const key = getCacheKey(CACHE_PREFIXES.AGGREGATE_VIEW, userId, viewKey);
  await cacheSet(key, view, { ttl: 300 }); // 5 minutes
}

// ============================================================================
// Cache Invalidation
// ============================================================================

/**
 * Invalidate all account caches for a user
 * Call this when accounts are created, updated, or deleted
 */
export async function invalidateUserAccountCache(userId: string): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  try {
    // Delete all account-related caches for this user
    await Promise.all([
      cacheDeletePattern(`${CACHE_PREFIXES.ACCOUNT}:${userId}:*`),
      cacheDeletePattern(`${CACHE_PREFIXES.ACCOUNT_LIST}:${userId}:*`),
      cacheDeletePattern(`${CACHE_PREFIXES.ACCOUNT_STATS}:${userId}:*`),
      cacheDeletePattern(`${CACHE_PREFIXES.ACCOUNT_COUNT}:${userId}`),
      cacheDeletePattern(`${CACHE_PREFIXES.ACCOUNT_BROKERS}:${userId}`),
      cacheDeletePattern(`${CACHE_PREFIXES.AGGREGATE_VIEW}:${userId}:*`),
    ]);

    logger.info('User account cache invalidated', { userId });
  } catch (error) {
    logger.error('Failed to invalidate user account cache', { userId, error });
  }
}

/**
 * Invalidate specific account cache
 */
export async function invalidateAccountCache(accountId: string, userId: string): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  try {
    await Promise.all([
      deleteCachedAccount(accountId, userId),
      cacheDeletePattern(`${CACHE_PREFIXES.ACCOUNT_STATS}:${userId}:${accountId}`),
      // Also invalidate list caches as they may include this account
      cacheDeletePattern(`${CACHE_PREFIXES.ACCOUNT_LIST}:${userId}:*`),
      cacheDeletePattern(`${CACHE_PREFIXES.AGGREGATE_VIEW}:${userId}:*`),
    ]);

    logger.info('Account cache invalidated', { accountId, userId });
  } catch (error) {
    logger.error('Failed to invalidate account cache', { accountId, userId, error });
  }
}

/**
 * Invalidate account stats cache (when trades change)
 */
export async function invalidateAccountStatsCache(
  accountId: string,
  userId: string
): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  try {
    await Promise.all([
      cacheDelete(getCacheKey(CACHE_PREFIXES.ACCOUNT_STATS, userId, accountId)),
      cacheDeletePattern(`${CACHE_PREFIXES.AGGREGATE_VIEW}:${userId}:*`),
    ]);

    logger.info('Account stats cache invalidated', { accountId, userId });
  } catch (error) {
    logger.error('Failed to invalidate account stats cache', { accountId, userId, error });
  }
}

// ============================================================================
// Cache Warming
// ============================================================================

/**
 * Warm cache with frequently accessed data
 * Can be called on user login or periodically
 */
export async function warmAccountCache(
  userId: string,
  accounts: unknown[]
): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  try {
    // Cache the account list
    await setCachedAccountList(userId, 'default', accounts);

    logger.info('Account cache warmed', { userId, count: accounts.length });
  } catch (error) {
    logger.error('Failed to warm account cache', { userId, error });
  }
}

// ============================================================================
// Cache Statistics
// ============================================================================

let cacheHits = 0;
let cacheMisses = 0;

/**
 * Record cache hit
 */
export function recordCacheHit(): void {
  cacheHits++;
}

/**
 * Record cache miss
 */
export function recordCacheMiss(): void {
  cacheMisses++;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  const total = cacheHits + cacheMisses;
  const hitRate = total > 0 ? cacheHits / total : 0;

  return {
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: Math.round(hitRate * 100) / 100,
  };
}

/**
 * Reset cache statistics
 */
export function resetCacheStats(): void {
  cacheHits = 0;
  cacheMisses = 0;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get or set cache (cache-aside pattern)
 */
export async function getOrSetCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try to get from cache
  const cached = await cacheGet<T>(key);

  if (cached !== null) {
    recordCacheHit();
    return cached;
  }

  // Cache miss - fetch data
  recordCacheMiss();
  const data = await fetcher();

  // Store in cache
  await cacheSet(key, data, options);

  return data;
}

/**
 * Flush all cache (use with caution)
 */
export async function flushCache(): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  try {
    const redis = await getRedisConnection();
    await redis.flushdb();
    logger.warn('Cache flushed');
  } catch (error) {
    logger.error('Failed to flush cache', error);
  }
}
