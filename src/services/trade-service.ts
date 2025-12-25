import { Decimal } from '@prisma/client/runtime/library';
import prisma from '@/lib/prisma';
import type { Direction, Trade } from '@prisma/client';
import { calculateTradeFees, calculateGrossPnl } from '@/lib/utils';

export interface TradeWithTags extends Trade {
  tags: { tag: { id: string; name: string; color: string } }[];
}

// Serialized trade type for client components (Decimal -> number)
export interface SerializedTrade {
  id: string;
  userId: string;
  symbol: string;
  direction: Direction;
  openedAt: Date;
  closedAt: Date;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  realizedPnlUsd: number;
  floatingRunupUsd: number | null;
  floatingDrawdownUsd: number | null;
  stopLossPriceInitial: number | null;
  riskRewardRatio: number | null;
  pointValue: number;
  importHash: string | null;
  createdAt: Date;
  updatedAt: Date;
  accountId: string | null;
  fees: number | null;
  grossPnlUsd: number | null;
  note: string | null;
  plannedRMultiple: number | null;
  points: number | null;
  profitTarget: number | null;
  rating: number | null;
  realizedRMultiple: number | null;
  ticksPerContract: number | null;
  youtubeUrl: string | null;
  timesManuallySet: boolean;
  tags: { tag: { id: string; name: string; color: string } }[];
}

// Helper to convert Decimal to number
function decimalToNumber(value: Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

// Serialize a single trade for client components
export function serializeTrade<T extends Trade>(trade: T): T & {
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  realizedPnlUsd: number;
  floatingRunupUsd: number | null;
  floatingDrawdownUsd: number | null;
  stopLossPriceInitial: number | null;
  riskRewardRatio: number | null;
  pointValue: number;
  fees: number | null;
  grossPnlUsd: number | null;
  plannedRMultiple: number | null;
  points: number | null;
  profitTarget: number | null;
  realizedRMultiple: number | null;
  ticksPerContract: number | null;
} {
  return {
    ...trade,
    entryPrice: Number(trade.entryPrice),
    exitPrice: Number(trade.exitPrice),
    quantity: Number(trade.quantity),
    realizedPnlUsd: Number(trade.realizedPnlUsd),
    floatingRunupUsd: decimalToNumber(trade.floatingRunupUsd),
    floatingDrawdownUsd: decimalToNumber(trade.floatingDrawdownUsd),
    stopLossPriceInitial: decimalToNumber(trade.stopLossPriceInitial),
    riskRewardRatio: decimalToNumber(trade.riskRewardRatio),
    pointValue: Number(trade.pointValue),
    fees: decimalToNumber(trade.fees),
    grossPnlUsd: decimalToNumber(trade.grossPnlUsd),
    plannedRMultiple: decimalToNumber(trade.plannedRMultiple),
    points: decimalToNumber(trade.points),
    profitTarget: decimalToNumber(trade.profitTarget),
    realizedRMultiple: decimalToNumber(trade.realizedRMultiple),
    ticksPerContract: decimalToNumber(trade.ticksPerContract),
  };
}

// Serialize an array of trades for client components
export function serializeTrades<T extends Trade>(trades: T[]): ReturnType<typeof serializeTrade<T>>[] {
  return trades.map(serializeTrade);
}

export interface TradeFilters {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  symbol?: string;
  tagIds?: string[];
}

export interface CreateTradeInput {
  userId: string;
  accountId?: string | null;
  symbol: string;
  direction: Direction;
  openedAt: Date;
  closedAt: Date;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  realizedPnlUsd: number;
  floatingRunupUsd?: number | null;
  floatingDrawdownUsd?: number | null;
  importHash?: string;
}

// Calculate import hash for deduplication
export function calculateImportHash(trade: {
  userId: string;
  symbol: string;
  openedAt: Date;
  closedAt: Date;
  entryPrice: number;
  exitPrice: number;
  realizedPnlUsd: number;
}): string {
  const data = [
    trade.userId,
    trade.symbol.toUpperCase().trim(),
    trade.openedAt.toISOString(),
    trade.closedAt.toISOString(),
    trade.entryPrice.toFixed(8),
    trade.exitPrice.toFixed(8),
    trade.realizedPnlUsd.toFixed(2),
  ].join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export async function createTrade(input: CreateTradeInput): Promise<Trade> {
  const importHash = input.importHash || calculateImportHash(input);
  const symbol = input.symbol.toUpperCase().trim();
  const quantity = Math.abs(input.quantity);
  
  // Calculate fees based on symbol and quantity
  const fees = calculateTradeFees(symbol, quantity);
  
  // Calculate gross PnL (net PnL + fees)
  const grossPnlUsd = calculateGrossPnl(input.realizedPnlUsd, fees);

  return prisma.trade.create({
    data: {
      userId: input.userId,
      accountId: input.accountId,
      symbol,
      direction: input.direction,
      openedAt: input.openedAt,
      closedAt: input.closedAt,
      entryPrice: input.entryPrice,
      exitPrice: input.exitPrice,
      quantity,
      realizedPnlUsd: input.realizedPnlUsd,
      grossPnlUsd,
      fees,
      floatingRunupUsd: input.floatingRunupUsd,
      floatingDrawdownUsd: input.floatingDrawdownUsd,
      importHash,
    },
  });
}

export async function createManyTrades(
  inputs: CreateTradeInput[]
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const results = { imported: 0, skipped: 0, errors: [] as string[] };

  for (const input of inputs) {
    try {
      const importHash = input.importHash || calculateImportHash(input);

      // Check for duplicate
      const existing = await prisma.trade.findUnique({
        where: { importHash },
      });

      if (existing) {
        results.skipped++;
        continue;
      }

      await createTrade({ ...input, importHash });
      results.imported++;
    } catch (error) {
      results.errors.push(`Error importing trade: ${error}`);
    }
  }

  return results;
}

export async function getTrades(filters: TradeFilters): Promise<TradeWithTags[]> {
  const where: Record<string, unknown> = {
    userId: filters.userId,
  };

  if (filters.startDate || filters.endDate) {
    where.closedAt = {};
    if (filters.startDate) {
      (where.closedAt as Record<string, Date>).gte = filters.startDate;
    }
    if (filters.endDate) {
      (where.closedAt as Record<string, Date>).lte = filters.endDate;
    }
  }

  if (filters.symbol) {
    where.symbol = filters.symbol.toUpperCase();
  }

  if (filters.tagIds && filters.tagIds.length > 0) {
    where.tags = {
      some: {
        tagId: { in: filters.tagIds },
      },
    };
  }

  return prisma.trade.findMany({
    where,
    include: {
      tags: {
        include: {
          tag: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      },
    },
    orderBy: { closedAt: 'asc' },
  }) as Promise<TradeWithTags[]>;
}

export async function getTradesByDate(
  userId: string,
  date: Date
): Promise<TradeWithTags[]> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return prisma.trade.findMany({
    where: {
      userId,
      closedAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    include: {
      tags: {
        include: {
          tag: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      },
    },
    orderBy: { closedAt: 'asc' },
  }) as Promise<TradeWithTags[]>;
}

export async function updateStopLoss(
  tradeId: string,
  userId: string,
  stopLossPrice: number | null
): Promise<Trade> {
  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId },
  });

  if (!trade) {
    throw new Error('Trade not found');
  }

  let riskRewardRatio: Decimal | null = null;

  if (stopLossPrice !== null) {
    const entryPrice = Number(trade.entryPrice);
    const exitPrice = Number(trade.exitPrice);
    const quantity = Number(trade.quantity);
    const pointValue = Number(trade.pointValue);

    const riskUsd = Math.abs(entryPrice - stopLossPrice) * quantity * pointValue;

    if (riskUsd > 0) {
      const rewardUsd = Math.abs(Number(trade.realizedPnlUsd));
      riskRewardRatio = new Decimal(rewardUsd / riskUsd);
    }
  }

  return prisma.trade.update({
    where: { id: tradeId },
    data: {
      stopLossPriceInitial: stopLossPrice,
      riskRewardRatio,
    },
  });
}

export async function addTagToTrade(
  tradeId: string,
  tagId: string,
  userId: string
): Promise<void> {
  // Verify ownership
  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId },
  });

  if (!trade) {
    throw new Error('Trade not found');
  }

  await prisma.tradeTag.create({
    data: { tradeId, tagId },
  });
}

export async function removeTagFromTrade(
  tradeId: string,
  tagId: string,
  userId: string
): Promise<void> {
  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId },
  });

  if (!trade) {
    throw new Error('Trade not found');
  }

  await prisma.tradeTag.delete({
    where: {
      tradeId_tagId: { tradeId, tagId },
    },
  });
}

export async function getUniqueSymbols(userId: string): Promise<string[]> {
  const symbols = await prisma.trade.findMany({
    where: { userId },
    select: { symbol: true },
    distinct: ['symbol'],
    orderBy: { symbol: 'asc' },
  });

  return symbols.map((s) => s.symbol);
}

