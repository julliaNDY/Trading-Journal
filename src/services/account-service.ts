/**
 * Account Service
 * Story 3.1: Unlimited Accounts - Data Model & Optimizations
 *
 * Provides optimized queries for managing unlimited accounts per user.
 * Supports pagination, filtering, and efficient data retrieval.
 *
 * Performance Requirements:
 * - Support 100+ accounts per user
 * - Query latency < 500ms (p95)
 * - Efficient pagination with cursor-based approach
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/observability';
import type { Account, Prisma } from '@prisma/client';
import {
  getCachedAccount,
  setCachedAccount,
  getCachedAccountList,
  setCachedAccountList,
  getCachedAccountStats,
  setCachedAccountStats,
  getCachedAccountCount,
  setCachedAccountCount,
  getCachedUserBrokers,
  setCachedUserBrokers,
  invalidateUserAccountCache,
  invalidateAccountCache,
  invalidateAccountStatsCache,
} from '@/lib/cache';

// ============================================================================
// Types
// ============================================================================

export interface AccountFilters {
  userId: string;
  broker?: string;
  search?: string; // Search by name
}

export interface PaginationOptions {
  limit?: number; // Default: 50, Max: 100
  cursor?: string; // Account ID for cursor-based pagination
  orderBy?: 'createdAt' | 'name' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
}

export interface PaginatedAccounts {
  accounts: Account[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

export interface AccountWithStats extends Account {
  tradeCount: number;
  totalPnl: number;
  lastTradeDate: Date | null;
}

// ============================================================================
// Account Queries
// ============================================================================

/**
 * Get accounts with pagination and filtering
 * Optimized for large datasets (100+ accounts)
 * Uses Redis cache for frequently accessed data
 */
export async function getAccounts(
  filters: AccountFilters,
  options: PaginationOptions = {}
): Promise<PaginatedAccounts> {
  const startTime = performance.now();
  const {
    limit = 50,
    cursor,
    orderBy = 'createdAt',
    orderDirection = 'desc',
  } = options;

  // Enforce max limit
  const effectiveLimit = Math.min(limit, 100);

  try {
    // Generate cache key based on filters and options
    const filterKey = `${filters.broker || 'all'}_${filters.search || 'all'}_${orderBy}_${orderDirection}_${cursor || 'start'}_${effectiveLimit}`;

    // Try to get from cache (only for first page without search)
    if (!cursor && !filters.search) {
      const cached = await getCachedAccountList(filters.userId, filterKey);
      if (cached) {
        logger.info('Accounts fetched from cache', {
          userId: filters.userId,
          filterKey,
        });
        return cached as PaginatedAccounts;
      }
    }

    // Build where clause
    const where: Prisma.AccountWhereInput = {
      userId: filters.userId,
      ...(filters.broker && { broker: filters.broker }),
      ...(filters.search && {
        name: {
          contains: filters.search,
          mode: 'insensitive',
        },
      }),
    };

    // Build orderBy clause
    const orderByClause: Prisma.AccountOrderByWithRelationInput = {
      [orderBy]: orderDirection,
    };

    // Get total count (try cache first)
    let total = await getCachedAccountCount(filters.userId);
    if (total === null) {
      total = await prisma.account.count({ where });
      await setCachedAccountCount(filters.userId, total);
    }

    // Get accounts with cursor-based pagination
    const accounts = await prisma.account.findMany({
      where,
      orderBy: orderByClause,
      take: effectiveLimit + 1, // Fetch one extra to check if there's more
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // Skip the cursor itself
      }),
      // Select only necessary fields for performance
      select: {
        id: true,
        userId: true,
        name: true,
        broker: true,
        description: true,
        color: true,
        initialBalance: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Check if there are more results
    const hasMore = accounts.length > effectiveLimit;
    const accountsToReturn = hasMore ? accounts.slice(0, effectiveLimit) : accounts;
    const nextCursor = hasMore ? accountsToReturn[accountsToReturn.length - 1].id : null;

    const result = {
      accounts: accountsToReturn as Account[],
      nextCursor,
      hasMore,
      total,
    };

    // Cache the result (only for first page without search)
    if (!cursor && !filters.search) {
      await setCachedAccountList(filters.userId, filterKey, result);
    }

    const duration = performance.now() - startTime;
    logger.info('Accounts fetched from database', {
      userId: filters.userId,
      count: accountsToReturn.length,
      total,
      hasMore,
      durationMs: Math.round(duration),
    });

    return result;
  } catch (error) {
    logger.error('Failed to fetch accounts', error);
    throw error;
  }
}

/**
 * Get account by ID with validation
 * Uses Redis cache
 */
export async function getAccountById(
  accountId: string,
  userId: string
): Promise<Account | null> {
  try {
    // Try cache first
    const cached = await getCachedAccount(accountId, userId);
    if (cached) {
      return cached as Account;
    }

    // Fetch from database
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        userId, // Ensure user owns the account
      },
    });

    // Cache the result
    if (account) {
      await setCachedAccount(accountId, userId, account);
    }

    return account;
  } catch (error) {
    logger.error('Failed to fetch account by ID', error);
    throw error;
  }
}

/**
 * Get accounts with trade statistics
 * More expensive query - use with pagination
 */
export async function getAccountsWithStats(
  filters: AccountFilters,
  options: PaginationOptions = {}
): Promise<{
  accounts: AccountWithStats[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}> {
  const startTime = performance.now();
  const {
    limit = 50,
    cursor,
    orderBy = 'createdAt',
    orderDirection = 'desc',
  } = options;

  const effectiveLimit = Math.min(limit, 100);

  try {
    // Build where clause
    const where: Prisma.AccountWhereInput = {
      userId: filters.userId,
      ...(filters.broker && { broker: filters.broker }),
      ...(filters.search && {
        name: {
          contains: filters.search,
          mode: 'insensitive',
        },
      }),
    };

    // Get total count
    const total = await prisma.account.count({ where });

    // Get accounts with aggregated trade stats
    const accounts = await prisma.account.findMany({
      where,
      orderBy: { [orderBy]: orderDirection },
      take: effectiveLimit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      include: {
        _count: {
          select: { trades: true },
        },
        trades: {
          select: {
            realizedPnlUsd: true,
            closedAt: true,
          },
          orderBy: {
            closedAt: 'desc',
          },
          take: 1, // Only get last trade for date
        },
      },
    });

    // Check if there are more results
    const hasMore = accounts.length > effectiveLimit;
    const accountsToReturn = hasMore ? accounts.slice(0, effectiveLimit) : accounts;
    const nextCursor = hasMore ? accountsToReturn[accountsToReturn.length - 1].id : null;

    // Transform to AccountWithStats
    const accountsWithStats: AccountWithStats[] = accountsToReturn.map((account) => {
      const { _count, trades, ...accountData } = account;

      return {
        ...accountData,
        tradeCount: _count.trades,
        totalPnl: 0, // Will be calculated separately for performance
        lastTradeDate: trades[0]?.closedAt || null,
      };
    });

    const duration = performance.now() - startTime;
    logger.info('Accounts with stats fetched', {
      userId: filters.userId,
      count: accountsWithStats.length,
      total,
      durationMs: Math.round(duration),
    });

    return {
      accounts: accountsWithStats,
      nextCursor,
      hasMore,
      total,
    };
  } catch (error) {
    logger.error('Failed to fetch accounts with stats', error);
    throw error;
  }
}

/**
 * Get account statistics (PnL, trade count)
 * Optimized query for single account with Redis cache
 */
export async function getAccountStats(accountId: string, userId: string) {
  try {
    // Try cache first
    const cached = await getCachedAccountStats(accountId, userId);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const stats = await prisma.trade.aggregate({
      where: {
        accountId,
        userId, // Security check
      },
      _sum: {
        realizedPnlUsd: true,
      },
      _count: true,
      _max: {
        closedAt: true,
      },
    });

    const result = {
      tradeCount: stats._count,
      totalPnl: Number(stats._sum.realizedPnlUsd || 0),
      lastTradeDate: stats._max.closedAt,
    };

    // Cache the result
    await setCachedAccountStats(accountId, userId, result);

    return result;
  } catch (error) {
    logger.error('Failed to fetch account stats', error);
    throw error;
  }
}

/**
 * Get all brokers used by user (for filtering)
 * Uses Redis cache
 */
export async function getUserBrokers(userId: string): Promise<string[]> {
  try {
    // Try cache first
    const cached = await getCachedUserBrokers(userId);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const accounts = await prisma.account.findMany({
      where: {
        userId,
        broker: { not: null },
      },
      select: {
        broker: true,
      },
      distinct: ['broker'],
    });

    const brokers = accounts
      .map((a) => a.broker)
      .filter((b): b is string => b !== null)
      .sort();

    // Cache the result
    await setCachedUserBrokers(userId, brokers);

    return brokers;
  } catch (error) {
    logger.error('Failed to fetch user brokers', error);
    throw error;
  }
}

/**
 * Create account
 * Invalidates cache after creation
 */
export async function createAccount(
  userId: string,
  data: {
    name: string;
    broker?: string;
    description?: string;
    color?: string;
    initialBalance?: number;
  }
): Promise<Account> {
  try {
    const account = await prisma.account.create({
      data: {
        userId,
        name: data.name,
        broker: data.broker,
        description: data.description,
        color: data.color || '#6366f1',
        initialBalance: data.initialBalance,
      },
    });

    // Invalidate cache
    await invalidateUserAccountCache(userId);

    logger.info('Account created', {
      accountId: account.id,
      userId,
      name: account.name,
    });

    return account;
  } catch (error) {
    logger.error('Failed to create account', error);
    throw error;
  }
}

/**
 * Update account
 * Invalidates cache after update
 */
export async function updateAccount(
  accountId: string,
  userId: string,
  data: Partial<{
    name: string;
    broker: string;
    description: string;
    color: string;
    initialBalance: number;
  }>
): Promise<Account> {
  try {
    const account = await prisma.account.update({
      where: {
        id: accountId,
        userId, // Ensure user owns the account
      },
      data,
    });

    // Invalidate cache
    await invalidateAccountCache(accountId, userId);

    logger.info('Account updated', {
      accountId: account.id,
      userId,
    });

    return account;
  } catch (error) {
    logger.error('Failed to update account', error);
    throw error;
  }
}

/**
 * Delete account
 * Invalidates cache after deletion
 */
export async function deleteAccount(accountId: string, userId: string): Promise<void> {
  try {
    await prisma.account.delete({
      where: {
        id: accountId,
        userId, // Ensure user owns the account
      },
    });

    // Invalidate cache
    await invalidateUserAccountCache(userId);

    logger.info('Account deleted', {
      accountId,
      userId,
    });
  } catch (error) {
    logger.error('Failed to delete account', error);
    throw error;
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Get multiple accounts by IDs (for bulk operations)
 */
export async function getAccountsByIds(
  accountIds: string[],
  userId: string
): Promise<Account[]> {
  try {
    const accounts = await prisma.account.findMany({
      where: {
        id: { in: accountIds },
        userId, // Security check
      },
    });

    return accounts;
  } catch (error) {
    logger.error('Failed to fetch accounts by IDs', error);
    throw error;
  }
}

/**
 * Get account count for user
 */
export async function getAccountCount(userId: string): Promise<number> {
  try {
    const count = await prisma.account.count({
      where: { userId },
    });

    return count;
  } catch (error) {
    logger.error('Failed to get account count', error);
    throw error;
  }
}
