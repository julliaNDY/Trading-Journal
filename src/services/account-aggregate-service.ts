/**
 * Account Aggregate Service
 * Story 3.1: Unlimited Accounts - Aggregate View
 *
 * Provides unified views across all user accounts.
 * Aggregates metrics from multiple accounts for dashboard display.
 *
 * Features:
 * - Cross-account PnL aggregation
 * - Unified win rate calculation
 * - Combined equity curve
 * - Multi-account statistics
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/observability';
import {
  getCachedAggregateView,
  setCachedAggregateView,
  invalidateAccountStatsCache,
} from '@/lib/cache';
import type { Prisma } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface AggregateFilters {
  userId: string;
  accountIds?: string[]; // Filter by specific accounts
  startDate?: Date;
  endDate?: Date;
  broker?: string;
}

export interface AggregateMetrics {
  // Account Summary
  totalAccounts: number;
  accountsByBroker: Record<string, number>;

  // Trade Summary
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;

  // PnL Metrics
  totalPnl: number;
  totalGrossProfit: number;
  totalGrossLoss: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  averageRR: number;

  // Best/Worst
  bestAccount: {
    id: string;
    name: string;
    pnl: number;
  } | null;
  worstAccount: {
    id: string;
    name: string;
    pnl: number;
  } | null;

  // Account Details
  accounts: Array<{
    id: string;
    name: string;
    broker: string | null;
    tradeCount: number;
    pnl: number;
    winRate: number;
  }>;
}

export interface EquityCurvePoint {
  date: Date;
  cumulativePnl: number;
  accountId?: string; // Optional for per-account breakdown
  accountName?: string;
}

export interface AggregateEquityCurve {
  combined: EquityCurvePoint[];
  byAccount: Record<string, EquityCurvePoint[]>;
}

// ============================================================================
// Aggregate Metrics
// ============================================================================

/**
 * Get aggregate metrics across all accounts
 * Cached for 5 minutes
 */
export async function getAggregateMetrics(
  filters: AggregateFilters
): Promise<AggregateMetrics> {
  const startTime = performance.now();

  try {
    // Generate cache key
    const cacheKey = `metrics_${filters.accountIds?.join(',') || 'all'}_${filters.startDate?.toISOString() || 'all'}_${filters.endDate?.toISOString() || 'all'}_${filters.broker || 'all'}`;

    // Try cache first
    const cached = await getCachedAggregateView(filters.userId, cacheKey);
    if (cached) {
      logger.info('Aggregate metrics fetched from cache', { userId: filters.userId });
      return cached as AggregateMetrics;
    }

    // Build account where clause
    const accountWhere: Prisma.AccountWhereInput = {
      userId: filters.userId,
      ...(filters.accountIds && { id: { in: filters.accountIds } }),
      ...(filters.broker && { broker: filters.broker }),
    };

    // Build trade where clause
    const tradeWhere: Prisma.TradeWhereInput = {
      userId: filters.userId,
      ...(filters.accountIds && { accountId: { in: filters.accountIds } }),
      ...(filters.startDate && { closedAt: { gte: filters.startDate } }),
      ...(filters.endDate && { closedAt: { lte: filters.endDate } }),
    };

    // Get accounts
    const accounts = await prisma.account.findMany({
      where: accountWhere,
      select: {
        id: true,
        name: true,
        broker: true,
      },
    });

    // Get trade aggregates per account
    const accountStats = await Promise.all(
      accounts.map(async (account) => {
        const trades = await prisma.trade.findMany({
          where: {
            ...tradeWhere,
            accountId: account.id,
          },
          select: {
            realizedPnlUsd: true,
            riskRewardRatio: true,
          },
        });

        const tradeCount = trades.length;
        const pnl = trades.reduce((sum, t) => sum + Number(t.realizedPnlUsd), 0);
        const winningTrades = trades.filter((t) => Number(t.realizedPnlUsd) > 0);
        const winRate = tradeCount > 0 ? (winningTrades.length / tradeCount) * 100 : 0;

        return {
          id: account.id,
          name: account.name,
          broker: account.broker,
          tradeCount,
          pnl,
          winRate: Math.round(winRate * 100) / 100,
        };
      })
    );

    // Get global trade stats
    const allTrades = await prisma.trade.findMany({
      where: tradeWhere,
      select: {
        realizedPnlUsd: true,
        riskRewardRatio: true,
      },
    });

    const totalTrades = allTrades.length;
    const winningTrades = allTrades.filter((t) => Number(t.realizedPnlUsd) > 0);
    const losingTrades = allTrades.filter((t) => Number(t.realizedPnlUsd) < 0);

    const totalPnl = allTrades.reduce((sum, t) => sum + Number(t.realizedPnlUsd), 0);
    const totalGrossProfit = winningTrades.reduce(
      (sum, t) => sum + Number(t.realizedPnlUsd),
      0
    );
    const totalGrossLoss = Math.abs(
      losingTrades.reduce((sum, t) => sum + Number(t.realizedPnlUsd), 0)
    );

    const profitFactor =
      totalGrossLoss > 0 ? totalGrossProfit / totalGrossLoss : totalGrossProfit > 0 ? 999 : 0;

    const averageWin =
      winningTrades.length > 0
        ? totalGrossProfit / winningTrades.length
        : 0;

    const averageLoss =
      losingTrades.length > 0
        ? totalGrossLoss / losingTrades.length
        : 0;

    // Calculate average RR
    const tradesWithRR = allTrades.filter((t) => t.riskRewardRatio !== null);
    const averageRR =
      tradesWithRR.length > 0
        ? tradesWithRR.reduce((sum, t) => sum + Number(t.riskRewardRatio), 0) /
          tradesWithRR.length
        : 0;

    // Get accounts by broker
    const accountsByBroker = accounts.reduce(
      (acc, account) => {
        const broker = account.broker || 'Unknown';
        acc[broker] = (acc[broker] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Find best and worst accounts
    const sortedByPnl = [...accountStats].sort((a, b) => b.pnl - a.pnl);
    const bestAccount = sortedByPnl[0] || null;
    const worstAccount = sortedByPnl[sortedByPnl.length - 1] || null;

    const metrics: AggregateMetrics = {
      totalAccounts: accounts.length,
      accountsByBroker,
      totalTrades,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0,
      totalPnl: Math.round(totalPnl * 100) / 100,
      totalGrossProfit: Math.round(totalGrossProfit * 100) / 100,
      totalGrossLoss: Math.round(totalGrossLoss * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      averageWin: Math.round(averageWin * 100) / 100,
      averageLoss: Math.round(averageLoss * 100) / 100,
      averageRR: Math.round(averageRR * 100) / 100,
      bestAccount: bestAccount
        ? {
            id: bestAccount.id,
            name: bestAccount.name,
            pnl: Math.round(bestAccount.pnl * 100) / 100,
          }
        : null,
      worstAccount: worstAccount
        ? {
            id: worstAccount.id,
            name: worstAccount.name,
            pnl: Math.round(worstAccount.pnl * 100) / 100,
          }
        : null,
      accounts: accountStats,
    };

    // Cache the result
    await setCachedAggregateView(filters.userId, cacheKey, metrics);

    const duration = performance.now() - startTime;
    logger.info('Aggregate metrics calculated', {
      userId: filters.userId,
      totalAccounts: metrics.totalAccounts,
      totalTrades: metrics.totalTrades,
      durationMs: Math.round(duration),
    });

    return metrics;
  } catch (error) {
    logger.error('Failed to get aggregate metrics', error);
    throw error;
  }
}

/**
 * Get combined equity curve across all accounts
 * Cached for 5 minutes
 */
export async function getAggregateEquityCurve(
  filters: AggregateFilters
): Promise<AggregateEquityCurve> {
  const startTime = performance.now();

  try {
    // Generate cache key
    const cacheKey = `equity_${filters.accountIds?.join(',') || 'all'}_${filters.startDate?.toISOString() || 'all'}_${filters.endDate?.toISOString() || 'all'}_${filters.broker || 'all'}`;

    // Try cache first
    const cached = await getCachedAggregateView(filters.userId, cacheKey);
    if (cached) {
      logger.info('Aggregate equity curve fetched from cache', { userId: filters.userId });
      return cached as AggregateEquityCurve;
    }

    // Build trade where clause
    const tradeWhere: Prisma.TradeWhereInput = {
      userId: filters.userId,
      ...(filters.accountIds && { accountId: { in: filters.accountIds } }),
      ...(filters.startDate && { closedAt: { gte: filters.startDate } }),
      ...(filters.endDate && { closedAt: { lte: filters.endDate } }),
    };

    // Get all trades sorted by closedAt
    const trades = await prisma.trade.findMany({
      where: tradeWhere,
      select: {
        closedAt: true,
        realizedPnlUsd: true,
        accountId: true,
        account: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        closedAt: 'asc',
      },
    });

    // Calculate combined equity curve
    let cumulativePnl = 0;
    const combined: EquityCurvePoint[] = trades.map((trade) => {
      cumulativePnl += Number(trade.realizedPnlUsd);
      return {
        date: trade.closedAt,
        cumulativePnl: Math.round(cumulativePnl * 100) / 100,
      };
    });

    // Calculate per-account equity curves
    const byAccount: Record<string, EquityCurvePoint[]> = {};

    // Group trades by account
    const tradesByAccount = trades.reduce(
      (acc, trade) => {
        if (!trade.accountId) return acc;
        if (!acc[trade.accountId]) {
          acc[trade.accountId] = [];
        }
        acc[trade.accountId].push(trade);
        return acc;
      },
      {} as Record<string, typeof trades>
    );

    // Calculate equity curve for each account
    Object.entries(tradesByAccount).forEach(([accountId, accountTrades]) => {
      let accountCumulativePnl = 0;
      byAccount[accountId] = accountTrades.map((trade) => {
        accountCumulativePnl += Number(trade.realizedPnlUsd);
        return {
          date: trade.closedAt,
          cumulativePnl: Math.round(accountCumulativePnl * 100) / 100,
          accountId,
          accountName: trade.account?.name || 'Unknown',
        };
      });
    });

    const result: AggregateEquityCurve = {
      combined,
      byAccount,
    };

    // Cache the result
    await setCachedAggregateView(filters.userId, cacheKey, result);

    const duration = performance.now() - startTime;
    logger.info('Aggregate equity curve calculated', {
      userId: filters.userId,
      totalPoints: combined.length,
      accounts: Object.keys(byAccount).length,
      durationMs: Math.round(duration),
    });

    return result;
  } catch (error) {
    logger.error('Failed to get aggregate equity curve', error);
    throw error;
  }
}

/**
 * Get account comparison metrics
 * Compare performance across accounts
 */
export async function getAccountComparison(
  userId: string,
  accountIds: string[]
): Promise<
  Array<{
    accountId: string;
    accountName: string;
    broker: string | null;
    totalTrades: number;
    totalPnl: number;
    winRate: number;
    profitFactor: number;
    averageWin: number;
    averageLoss: number;
    bestTrade: number;
    worstTrade: number;
  }>
> {
  try {
    const accounts = await prisma.account.findMany({
      where: {
        id: { in: accountIds },
        userId,
      },
      select: {
        id: true,
        name: true,
        broker: true,
      },
    });

    const comparison = await Promise.all(
      accounts.map(async (account) => {
        const trades = await prisma.trade.findMany({
          where: {
            accountId: account.id,
            userId,
          },
          select: {
            realizedPnlUsd: true,
          },
        });

        const totalTrades = trades.length;
        const totalPnl = trades.reduce((sum, t) => sum + Number(t.realizedPnlUsd), 0);
        const winningTrades = trades.filter((t) => Number(t.realizedPnlUsd) > 0);
        const losingTrades = trades.filter((t) => Number(t.realizedPnlUsd) < 0);

        const grossProfit = winningTrades.reduce((sum, t) => sum + Number(t.realizedPnlUsd), 0);
        const grossLoss = Math.abs(
          losingTrades.reduce((sum, t) => sum + Number(t.realizedPnlUsd), 0)
        );

        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
        const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
        const averageWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
        const averageLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;

        const pnls = trades.map((t) => Number(t.realizedPnlUsd));
        const bestTrade = pnls.length > 0 ? Math.max(...pnls) : 0;
        const worstTrade = pnls.length > 0 ? Math.min(...pnls) : 0;

        return {
          accountId: account.id,
          accountName: account.name,
          broker: account.broker,
          totalTrades,
          totalPnl: Math.round(totalPnl * 100) / 100,
          winRate: Math.round(winRate * 100) / 100,
          profitFactor: Math.round(profitFactor * 100) / 100,
          averageWin: Math.round(averageWin * 100) / 100,
          averageLoss: Math.round(averageLoss * 100) / 100,
          bestTrade: Math.round(bestTrade * 100) / 100,
          worstTrade: Math.round(worstTrade * 100) / 100,
        };
      })
    );

    return comparison;
  } catch (error) {
    logger.error('Failed to get account comparison', error);
    throw error;
  }
}

/**
 * Invalidate aggregate cache when trades change
 * Call this after trade import, creation, update, or deletion
 */
export async function invalidateAggregateCache(userId: string, accountId?: string): Promise<void> {
  try {
    // Invalidate all aggregate views for this user
    await setCachedAggregateView(userId, 'metrics_*', null);
    await setCachedAggregateView(userId, 'equity_*', null);

    // Also invalidate account stats if accountId provided
    if (accountId) {
      await invalidateAccountStatsCache(accountId, userId);
    }

    logger.info('Aggregate cache invalidated', { userId, accountId });
  } catch (error) {
    logger.error('Failed to invalidate aggregate cache', { userId, accountId, error });
  }
}
