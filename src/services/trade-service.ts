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

// Serialized partial exit for client
interface SerializedPartialExit {
  id: string;
  exitPrice: number;
  quantity: number;
  exitedAt: Date;
  pnl: number;
}

// Serialize a single trade for client components
export function serializeTrade<T extends Trade & { partialExits?: { id: string; exitPrice: Decimal; quantity: Decimal; exitedAt: Date; pnl: Decimal }[] }>(trade: T): T & {
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
  partialExits: SerializedPartialExit[];
} {
  // Serialize partial exits if present
  const serializedPartialExits: SerializedPartialExit[] = trade.partialExits?.map(exit => ({
    id: exit.id,
    exitPrice: Number(exit.exitPrice),
    quantity: Number(exit.quantity),
    exitedAt: exit.exitedAt,
    pnl: Number(exit.pnl),
  })) || [];

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
    partialExits: serializedPartialExits,
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

// Simple hash function used by both signature types
function simpleHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Calculate FLEXIBLE trade signature for merge/matching
 * Based on: userId, accountId, symbol, DATE(openedAt), entryPrice (rounded to 2 decimals)
 * 
 * This signature is STABLE even if:
 * - Times change (CSV import without times vs OCR with times)
 * - Exit price changes (partial exits)
 * - PnL changes (partial exits)
 * - closedAt changes (last exit time)
 * 
 * IMPORTANT: accountId is included to prevent cross-account false duplicates
 */
export function calculateTradeSignature(trade: {
  userId: string;
  accountId?: string | null;
  symbol: string;
  openedAt: Date;
  entryPrice: number;
}): string {
  // Extract just the date part (YYYY-MM-DD) for matching
  const dateOnly = trade.openedAt.toISOString().split('T')[0];
  
  // Round entry price to 2 decimals for fuzzy matching
  // This handles minor OCR errors like 25717.25 vs 25717.24
  const entryPriceRounded = Math.round(trade.entryPrice * 100) / 100;
  
  const data = [
    trade.userId,
    trade.accountId || 'no-account', // Include accountId to prevent cross-account duplicates
    trade.symbol.toUpperCase().trim(),
    dateOnly,
    entryPriceRounded.toFixed(2),
  ].join('|');

  return 'sig_' + simpleHash(data);
}

/**
 * Calculate STRICT import hash for exact deduplication (legacy)
 * Based on: userId, symbol, openedAt (full), closedAt (full), entryPrice, exitPrice, realizedPnlUsd
 * 
 * Used to prevent exact duplicate imports
 */
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

  return simpleHash(data);
}

/**
 * Find existing trade by flexible signature
 * Returns the trade if found, null otherwise
 * 
 * IMPORTANT: accountId is required to prevent cross-account false duplicates
 */
export async function findTradeBySignature(
  userId: string,
  symbol: string,
  openedAt: Date,
  entryPrice: number,
  accountId?: string | null
): Promise<Trade | null> {
  const signature = calculateTradeSignature({ userId, accountId, symbol, openedAt, entryPrice });
  
  // First try exact signature match
  const exactMatch = await prisma.trade.findFirst({
    where: {
      userId,
      tradeSignature: signature,
    },
    include: {
      partialExits: true,
    },
  });
  
  if (exactMatch) return exactMatch;
  
  // Fallback: fuzzy match by date + entry price range (for trades without signature)
  // MUST respect accountId boundary to prevent cross-account duplicates
  const dateStart = new Date(openedAt);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(openedAt);
  dateEnd.setHours(23, 59, 59, 999);
  
  const fuzzyMatch = await prisma.trade.findFirst({
    where: {
      userId,
      // Respect account boundary - only match within same account
      accountId: accountId || null,
      symbol: symbol.toUpperCase().trim(),
      openedAt: {
        gte: dateStart,
        lte: dateEnd,
      },
      // Entry price within 0.5% tolerance for OCR errors
      entryPrice: {
        gte: entryPrice * 0.995,
        lte: entryPrice * 1.005,
      },
    },
    include: {
      partialExits: true,
    },
  });
  
  return fuzzyMatch;
}

/**
 * Input data for a partial exit
 */
export interface PartialExitInput {
  exitedAt: Date;
  exitPrice: number;
  quantity: number;
  pnl: number;
}

/**
 * Input for merging trade data (from OCR or enrichment)
 */
export interface MergeTradeInput {
  userId: string;
  symbol: string;
  direction: Direction;
  openedAt: Date;
  closedAt: Date;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  realizedPnlUsd: number;
  accountId?: string | null;
  partialExits?: PartialExitInput[];
  timesManuallySet?: boolean;
  // Drawdown/Runup (MAE/MFE) from OCR
  floatingDrawdownUsd?: number | null;
  floatingRunupUsd?: number | null;
}

/**
 * Result of a merge operation
 */
export interface MergeResult {
  action: 'created' | 'updated' | 'skipped';
  trade: Trade;
  message?: string;
}

/**
 * Calculate exit signature for deduplication of partial exits
 */
function calculateExitSignature(exit: { exitedAt: Date; exitPrice: number; quantity: number }): string {
  const data = [
    exit.exitedAt.toISOString(),
    exit.exitPrice.toFixed(4),
    exit.quantity.toFixed(4),
  ].join('|');
  return simpleHash(data);
}

/**
 * Check if time A is more precise than time B
 * "More precise" means it has actual hours/minutes/seconds instead of 00:00:00 or 09:00:XX (placeholder times)
 */
function isTimePrecise(date: Date): boolean {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  
  // Consider precise if not midnight and not placeholder 09:00:XX
  if (hours === 0 && minutes === 0) return false;
  if (hours === 9 && minutes === 0 && seconds < 60) return false; // Placeholder from CSV import
  return true;
}

/**
 * Merge new trade data with existing trade
 * Handles:
 * - Time enrichment (if new times are more precise)
 * - Partial exits (adds new exits, recalculates totals)
 * - Account assignment (if existing has none)
 */
export async function mergeTradeData(
  existingTrade: Trade & { partialExits?: { id: string; exitedAt: Date; exitPrice: Decimal; quantity: Decimal; pnl: Decimal }[] },
  newData: MergeTradeInput
): Promise<MergeResult> {
  const updates: Record<string, unknown> = {};
  let needsUpdate = false;
  
  // 1. Check if times should be updated
  const existingOpenPrecise = existingTrade.timesManuallySet || isTimePrecise(existingTrade.openedAt);
  const newOpenPrecise = newData.timesManuallySet || isTimePrecise(newData.openedAt);
  
  if (!existingOpenPrecise && newOpenPrecise) {
    updates.openedAt = newData.openedAt;
    updates.timesManuallySet = true;
    needsUpdate = true;
  }
  
  // 2. Handle partial exits
  const existingExits = existingTrade.partialExits || [];
  const newExits = newData.partialExits || [];
  
  if (newExits.length > 0) {
    // Calculate signatures for existing exits
    const existingExitSignatures = new Set(
      existingExits.map(e => calculateExitSignature({
        exitedAt: e.exitedAt,
        exitPrice: Number(e.exitPrice),
        quantity: Number(e.quantity),
      }))
    );
    
    // Find new exits that don't exist yet
    const exitsToAdd: PartialExitInput[] = [];
    for (const exit of newExits) {
      const sig = calculateExitSignature(exit);
      if (!existingExitSignatures.has(sig)) {
        exitsToAdd.push(exit);
      }
    }
    
    // Add new exits
    if (exitsToAdd.length > 0) {
      for (const exit of exitsToAdd) {
        await prisma.tradeExit.create({
          data: {
            tradeId: existingTrade.id,
            exitedAt: exit.exitedAt,
            exitPrice: exit.exitPrice,
            quantity: exit.quantity,
            pnl: exit.pnl,
          },
        });
      }
      
      // Recalculate trade totals from all exits
      const allExits = await prisma.tradeExit.findMany({
        where: { tradeId: existingTrade.id },
        orderBy: { exitedAt: 'asc' },
      });
      
      if (allExits.length > 0) {
        // Calculate weighted average exit price
        const totalQty = allExits.reduce((sum, e) => sum + Number(e.quantity), 0);
        const weightedPrice = allExits.reduce((sum, e) => sum + Number(e.exitPrice) * Number(e.quantity), 0) / totalQty;
        const totalPnl = allExits.reduce((sum, e) => sum + Number(e.pnl), 0);
        const lastExitTime = allExits[allExits.length - 1].exitedAt;
        
        updates.exitPrice = Math.round(weightedPrice * 100000000) / 100000000; // 8 decimals
        updates.realizedPnlUsd = Math.round(totalPnl * 100) / 100; // 2 decimals
        updates.closedAt = lastExitTime;
        updates.quantity = totalQty;
        updates.hasPartialExits = allExits.length > 1;
        
        // Recalculate fees and gross PnL
        const fees = calculateTradeFees(existingTrade.symbol, totalQty);
        updates.fees = fees;
        updates.grossPnlUsd = calculateGrossPnl(totalPnl, fees);
        
        needsUpdate = true;
      }
    }
  } else if (!existingTrade.hasPartialExits) {
    // No partial exits in new data, but check if closedAt should be updated
    const existingClosePrecise = existingTrade.timesManuallySet || isTimePrecise(existingTrade.closedAt);
    const newClosePrecise = newData.timesManuallySet || isTimePrecise(newData.closedAt);
    
    if (!existingClosePrecise && newClosePrecise) {
      updates.closedAt = newData.closedAt;
      updates.timesManuallySet = true;
      needsUpdate = true;
    }
  }
  
  // 3. Account assignment (only if existing has none and new has one)
  if (!existingTrade.accountId && newData.accountId) {
    updates.accountId = newData.accountId;
    needsUpdate = true;
  }
  
  // 4. Drawdown/Runup enrichment (only if existing has none and new has values)
  if (existingTrade.floatingDrawdownUsd === null && newData.floatingDrawdownUsd !== undefined && newData.floatingDrawdownUsd !== null) {
    updates.floatingDrawdownUsd = newData.floatingDrawdownUsd;
    needsUpdate = true;
  }
  if (existingTrade.floatingRunupUsd === null && newData.floatingRunupUsd !== undefined && newData.floatingRunupUsd !== null) {
    updates.floatingRunupUsd = newData.floatingRunupUsd;
    needsUpdate = true;
  }
  
  // 5. Apply updates if needed
  if (needsUpdate) {
    const updatedTrade = await prisma.trade.update({
      where: { id: existingTrade.id },
      data: updates,
    });
    
    return {
      action: 'updated',
      trade: updatedTrade,
      message: `Trade enrichi avec ${Object.keys(updates).length} champ(s)`,
    };
  }
  
  return {
    action: 'skipped',
    trade: existingTrade,
    message: 'Trade identique, aucune mise à jour nécessaire',
  };
}

/**
 * Create or merge a trade (idempotent operation)
 * If a matching trade exists (by signature), merge the data
 * Otherwise, create a new trade
 */
export async function createOrMergeTrade(input: MergeTradeInput): Promise<MergeResult> {
  const symbol = input.symbol.toUpperCase().trim();
  
  // Try to find existing trade by signature (including accountId)
  const existingTrade = await findTradeBySignature(
    input.userId,
    symbol,
    input.openedAt,
    input.entryPrice,
    input.accountId
  );
  
  if (existingTrade) {
    // Merge with existing trade
    return mergeTradeData(
      existingTrade as Trade & { partialExits?: { id: string; exitedAt: Date; exitPrice: Decimal; quantity: Decimal; pnl: Decimal }[] },
      { ...input, symbol }
    );
  }
  
  // Create new trade
  const tradeSignature = calculateTradeSignature({
    userId: input.userId,
    accountId: input.accountId,
    symbol,
    openedAt: input.openedAt,
    entryPrice: input.entryPrice,
  });
  
  const quantity = Math.abs(input.quantity);
  const fees = calculateTradeFees(symbol, quantity);
  const grossPnlUsd = calculateGrossPnl(input.realizedPnlUsd, fees);
  
  const newTrade = await prisma.trade.create({
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
      tradeSignature,
      timesManuallySet: input.timesManuallySet ?? false,
      hasPartialExits: (input.partialExits?.length ?? 0) > 1,
      // Drawdown/Runup from OCR (MAE/MFE)
      floatingDrawdownUsd: input.floatingDrawdownUsd,
      floatingRunupUsd: input.floatingRunupUsd,
    },
  });
  
  // Create partial exits if provided
  if (input.partialExits && input.partialExits.length > 0) {
    for (const exit of input.partialExits) {
      await prisma.tradeExit.create({
        data: {
          tradeId: newTrade.id,
          exitedAt: exit.exitedAt,
          exitPrice: exit.exitPrice,
          quantity: exit.quantity,
          pnl: exit.pnl,
        },
      });
    }
  }
  
  return {
    action: 'created',
    trade: newTrade,
    message: 'Nouveau trade créé',
  };
}

export async function createTrade(input: CreateTradeInput): Promise<Trade> {
  const importHash = input.importHash || calculateImportHash(input);
  const symbol = input.symbol.toUpperCase().trim();
  const quantity = Math.abs(input.quantity);
  
  // Calculate flexible trade signature for future merge matching
  const tradeSignature = calculateTradeSignature({
    userId: input.userId,
    accountId: input.accountId,
    symbol,
    openedAt: input.openedAt,
    entryPrice: input.entryPrice,
  });
  
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
      tradeSignature,
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

