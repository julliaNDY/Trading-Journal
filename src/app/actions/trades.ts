'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { getUser } from '@/lib/auth';
import { 
  serializeTrades, 
  serializeTrade, 
  createOrMergeTrade,
  type PartialExitInput 
} from '@/services/trade-service';
import { calculateTradeFees, calculateGrossPnl } from '@/lib/utils';
import type { Direction, Trade } from '@prisma/client';
import { tradeLogger, ocrLogger } from '@/lib/logger';

export interface CreateManualTradeInput {
  symbol: string;
  direction: Direction;
  openedAt: Date;
  closedAt: Date;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  realizedPnlUsd: number;
  accountId?: string | null;
  stopLossPriceInitial?: number | null;
  profitTarget?: number | null;
}

// Create a trade manually
export async function createManualTrade(input: CreateManualTradeInput) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  const symbol = input.symbol.toUpperCase().trim();
  const quantity = Math.abs(input.quantity);
  
  // Calculate fees based on symbol and quantity
  const fees = calculateTradeFees(symbol, quantity);
  
  // Calculate gross PnL (net PnL + fees)
  const grossPnlUsd = calculateGrossPnl(input.realizedPnlUsd, fees);

  // Calculate R multiples if we have stop loss and profit target
  let plannedRMultiple: number | null = null;
  let realizedRMultiple: number | null = null;

  if (input.stopLossPriceInitial) {
    const risk = Math.abs(input.entryPrice - input.stopLossPriceInitial);
    
    if (risk > 0) {
      // Realized R multiple
      const actualMove = input.direction === 'LONG' 
        ? input.exitPrice - input.entryPrice 
        : input.entryPrice - input.exitPrice;
      realizedRMultiple = actualMove / risk;

      // Planned R multiple (if profit target is set)
      if (input.profitTarget) {
        const reward = Math.abs(input.profitTarget - input.entryPrice);
        plannedRMultiple = reward / risk;
      }
    }
  }

  const trade = await prisma.trade.create({
    data: {
      userId: user.id,
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
      stopLossPriceInitial: input.stopLossPriceInitial,
      profitTarget: input.profitTarget,
      plannedRMultiple,
      realizedRMultiple,
      timesManuallySet: true,
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
      screenshots: {
        select: {
          id: true,
          filePath: true,
          originalName: true,
        },
      },
      tradePlaybooks: {
        include: {
          playbook: {
            select: {
              id: true,
              name: true,
            },
          },
          checkedPrerequisites: true,
        },
      },
    },
  });

  revalidatePath('/trades');
  revalidatePath('/dashboard');
  revalidatePath('/statistiques');
  revalidatePath('/calendrier');
  revalidatePath('/journal');

  return serializeTrade(trade);
}

// Get all trades with playbooks
export async function getAllTrades() {
  const user = await getUser();
  if (!user) return [];

  const trades = await prisma.trade.findMany({
    where: { userId: user.id },
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
      screenshots: {
        select: {
          id: true,
          filePath: true,
          originalName: true,
        },
      },
      tradePlaybooks: {
        include: {
          playbook: {
            select: {
              id: true,
              name: true,
            },
          },
          checkedPrerequisites: true,
        },
      },
    },
    orderBy: { closedAt: 'desc' },
  });

  return serializeTrades(trades);
}

// Get all playbooks for selection
export async function getPlaybooksForSelection() {
  const user = await getUser();
  if (!user) return [];

  return prisma.playbook.findMany({
    where: { userId: user.id },
    include: {
      groups: {
        include: {
          prerequisites: {
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });
}

// Toggle trade reviewed status
export async function toggleTradeReviewed(tradeId: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  const trade = await prisma.trade.findUnique({
    where: { id: tradeId, userId: user.id },
  });

  if (!trade) throw new Error('Trade not found');

  const updatedTrade = await prisma.trade.update({
    where: { id: tradeId },
    data: { reviewed: !trade.reviewed },
  });

  revalidatePath('/trades');
  revalidatePath(`/trades/${tradeId}`);

  return { reviewed: updatedTrade.reviewed };
}

// Import types from centralized OCR service
import { 
  type PartialExitData, 
  type OcrTradeData,
  parseOcrDateTime as parseOcrDate 
} from '@/services/ocr-service';

// Re-export types for backwards compatibility
export type { PartialExitData, OcrTradeData };

/**
 * Create or merge trades from OCR data
 * Uses the new signature-based matching for intelligent merge
 * 
 * Flow:
 * 1. Try to find existing trade by signature (date + entry price)
 * 2. If found: MERGE (enrich with times, partial exits)
 * 3. If not found: CREATE new trade
 */
export async function createTradesFromOcr(
  ocrData: OcrTradeData[], 
  symbol: string, 
  accountId: string | null
) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  let createdCount = 0;
  let skippedCount = 0;
  let updatedCount = 0;
  const errors: string[] = [];

  for (const data of ocrData) {
    try {
      const openedAt = parseOcrDate(data.entryDt);
      const closedAt = parseOcrDate(data.exitDt);

      if (!openedAt || !closedAt) {
        errors.push(`Could not parse dates: ${data.entryDt} - ${data.exitDt}`);
        continue;
      }

      // Determine direction based on entry/exit prices and PnL
      const priceMove = data.exitPrice - data.entryPrice;
      const isProfit = data.profitLoss > 0;
      const direction: Direction = (priceMove > 0 && isProfit) || (priceMove < 0 && !isProfit) 
        ? 'LONG' 
        : 'SHORT';

      // Calculate quantity from PnL and price difference if not provided
      let quantity = data.quantity || 1;
      
      if (!data.quantity) {
        const pointDiff = Math.abs(data.exitPrice - data.entryPrice);
        if (pointDiff > 0 && data.profitLoss !== 0) {
          // Estimate point value based on price range
          let pointValue = 1;
          if (data.entryPrice > 15000) {
            // NQ (~$20/pt) or MNQ (~$2/pt)
            pointValue = Math.abs(data.profitLoss / pointDiff) > 10 ? 20 : 2;
          } else if (data.entryPrice > 4000) {
            // ES (~$50/pt) or MES (~$5/pt)
            pointValue = Math.abs(data.profitLoss / pointDiff) > 25 ? 50 : 5;
          }
          quantity = Math.max(1, Math.round(Math.abs(data.profitLoss) / (pointDiff * pointValue)));
        }
      }

      // Convert partial exits to the expected format
      let partialExits: PartialExitInput[] | undefined;
      if (data.partialExits && data.partialExits.length > 0) {
        partialExits = [];
        for (const exit of data.partialExits) {
          const exitedAt = parseOcrDate(exit.exitDt);
          if (exitedAt) {
            partialExits.push({
              exitedAt,
              exitPrice: exit.exitPrice,
              quantity: exit.quantity,
              pnl: exit.pnl,
            });
          }
        }
      }

      // Use the new createOrMergeTrade function
      const result = await createOrMergeTrade({
        userId: user.id,
        symbol,
        direction,
        openedAt,
        closedAt,
        entryPrice: data.entryPrice,
        exitPrice: data.exitPrice,
        quantity,
        realizedPnlUsd: data.profitLoss,
        accountId,
        partialExits,
        timesManuallySet: true,
        // Pass Drawdown/Runup (MAE/MFE) if extracted from OCR
        floatingDrawdownUsd: data.drawdown ?? null,
        floatingRunupUsd: data.runup ?? null,
      });

      // Update counters based on result
      switch (result.action) {
        case 'created':
          createdCount++;
          break;
        case 'updated':
          updatedCount++;
          break;
        case 'skipped':
          skippedCount++;
          break;
      }
    } catch (error) {
      ocrLogger.error('Error processing OCR trade:', error);
      errors.push(`Failed to process trade: ${data.entryDt}`);
    }
  }

  revalidatePath('/trades');
  revalidatePath('/dashboard');
  revalidatePath('/statistiques');
  revalidatePath('/calendrier');
  revalidatePath('/journal');

  return { createdCount, skippedCount, updatedCount, errors };
}

// Update existing trade times from OCR data (for trades already imported via CSV)
export async function updateTradesFromOcr(ocrData: OcrTradeData[]) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  let updatedCount = 0;

  for (const data of ocrData) {
    const openedAt = parseOcrDate(data.entryDt);
    const closedAt = parseOcrDate(data.exitDt);

    if (!openedAt || !closedAt) {
      ocrLogger.debug('Could not parse dates:', data.entryDt, data.exitDt);
      continue;
    }

    // Find matching trade by date and approximate price
    const startOfDay = new Date(openedAt);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(openedAt);
    endOfDay.setHours(23, 59, 59, 999);

    const trades = await prisma.trade.findMany({
      where: {
        userId: user.id,
        closedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Find the best matching trade by entry price and PnL
    for (const trade of trades) {
      const entryPriceDiff = Math.abs(Number(trade.entryPrice) - data.entryPrice);
      const exitPriceDiff = Math.abs(Number(trade.exitPrice) - data.exitPrice);
      const pnlDiff = Math.abs(Number(trade.realizedPnlUsd) - data.profitLoss);

      // Match if prices are close (within 2 points) OR if PnL is very close (within $5)
      const priceMatch = entryPriceDiff < 2 && exitPriceDiff < 2;
      const pnlMatch = pnlDiff < 5;
      
      if (priceMatch || (pnlMatch && entryPriceDiff < 5)) {
        await prisma.trade.update({
          where: { id: trade.id },
          data: {
            openedAt,
            closedAt,
            timesManuallySet: true,
          },
        });
        updatedCount++;
        break;
      }
    }
  }

  revalidatePath('/trades');
  revalidatePath('/dashboard');
  revalidatePath('/statistiques');
  revalidatePath('/calendrier');
  revalidatePath('/journal');

  return { updatedCount };
}

// ============================================================================
// FUZZY MATCHING CONFIGURATION
// ============================================================================

/** Time tolerance in hours for matching trades (±12h to handle timezone issues) */
const TIME_TOLERANCE_HOURS = 12;

/** Tick size by instrument for price tolerance */
const TICK_SIZES: Record<string, number> = {
  NQ: 0.25, MNQ: 0.25,  // Nasdaq futures
  ES: 0.25, MES: 0.25,  // S&P 500 futures
  YM: 1.0, MYM: 1.0,    // Dow futures
  RTY: 0.10,            // Russell 2000
  CL: 0.01,             // Crude Oil
  GC: 0.10,             // Gold
  DEFAULT: 0.01,        // Default (forex, etc)
};

/** Get tick size for a symbol */
function getTickSize(symbol: string): number {
  const upper = symbol.toUpperCase().trim();
  for (const [key, value] of Object.entries(TICK_SIZES)) {
    if (upper.startsWith(key)) return value;
  }
  return TICK_SIZES.DEFAULT;
}

/** Normalize symbol for matching (removes contract month codes, special chars) */
function normalizeSymbol(symbol: string): string {
  return symbol
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '') // Remove spaces
    .replace(/[^A-Z0-9]/g, '') // Remove special chars
    .replace(/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{2}$/i, '') // Remove month codes like "MAR25"
    .replace(/\d{2}$/, ''); // Remove trailing 2-digit year
}

/** Check if two symbols match (fuzzy) */
function symbolsMatch(ocrSymbol: string, dbSymbol: string): boolean {
  const normOcr = normalizeSymbol(ocrSymbol);
  const normDb = normalizeSymbol(dbSymbol);
  
  // Exact match after normalization
  if (normOcr === normDb) return true;
  
  // One is prefix of the other (e.g., "MNQ" matches "MNQH25")
  if (normOcr.startsWith(normDb) || normDb.startsWith(normOcr)) return true;
  
  // Base symbol match (first 2-4 chars)
  const baseOcr = normOcr.slice(0, Math.min(normOcr.length, 4));
  const baseDb = normDb.slice(0, Math.min(normDb.length, 4));
  if (baseOcr === baseDb && baseOcr.length >= 2) return true;
  
  return false;
}

interface MatchScore {
  trade: Trade;
  score: number;
  reasons: string[];
}

/**
 * Enrich existing trades from OCR data - UPDATE ONLY, NO CREATION
 * 
 * This function uses FUZZY MATCHING to find the best matching trade:
 * - Time tolerance: ±12 hours to handle timezone differences
 * - Price tolerance: Within 10 ticks or 0.1% (whichever is larger)
 * - PnL tolerance: Within 10% or $10 (whichever is larger)
 * - Symbol: Fuzzy match (handles contract month codes)
 * - Direction: Used as scoring factor, not strict filter
 * 
 * Fields updated: entry_timestamp, exit_timestamp, drawdown, runup
 * 
 * @param ocrData - Parsed OCR data from screenshot
 * @param symbol - Symbol to match trades against
 * @param accountId - Optional account ID to restrict matching
 * @returns Count of enriched trades and not found trades
 */
export async function enrichTradesFromOcr(
  ocrData: OcrTradeData[], 
  symbol: string, 
  accountId: string | null
) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  let enrichedCount = 0;
  let notFoundCount = 0;
  const errors: string[] = [];
  const debugLogs: string[] = [];
  const usedTradeIds = new Set<string>(); // Prevent matching same trade twice

  // Normalize the input symbol for matching
  const normalizedInputSymbol = normalizeSymbol(symbol);
  const tickSize = getTickSize(symbol);

  debugLogs.push(`[OCR Enrichment] Starting with ${ocrData.length} OCR trades, symbol: ${symbol} (normalized: ${normalizedInputSymbol}), tickSize: ${tickSize}`);

  for (let ocrIndex = 0; ocrIndex < ocrData.length; ocrIndex++) {
    const data = ocrData[ocrIndex];
    
    try {
      const ocrOpenedAt = parseOcrDate(data.entryDt);
      const ocrClosedAt = parseOcrDate(data.exitDt);

      if (!ocrOpenedAt || !ocrClosedAt) {
        const reason = `OCR Trade #${ocrIndex + 1}: Could not parse dates - entry: "${data.entryDt}", exit: "${data.exitDt}"`;
        debugLogs.push(reason);
        errors.push(reason);
        notFoundCount++;
        continue;
      }

      // Infer direction from OCR data (used as scoring factor, not filter)
      const priceMove = data.exitPrice - data.entryPrice;
      const isProfit = data.profitLoss > 0;
      const ocrDirection: Direction = (priceMove > 0 && isProfit) || (priceMove < 0 && !isProfit) 
        ? 'LONG' 
        : 'SHORT';

      debugLogs.push(`[OCR Trade #${ocrIndex + 1}] Entry: ${data.entryDt}, Exit: ${data.exitDt}, Prices: ${data.entryPrice} -> ${data.exitPrice}, PnL: $${data.profitLoss}, Direction: ${ocrDirection}`);

      // =========================================================================
      // STEP 1: FIND ALL CANDIDATE TRADES (wide time window)
      // =========================================================================
      
      // Use ±12 hour window to handle timezone differences
      const searchStart = new Date(ocrOpenedAt.getTime() - TIME_TOLERANCE_HOURS * 60 * 60 * 1000);
      const searchEnd = new Date(ocrOpenedAt.getTime() + TIME_TOLERANCE_HOURS * 60 * 60 * 1000);

      // Build where clause - DO NOT filter by direction yet (use for scoring)
      const whereClause: {
        userId: string;
        openedAt: { gte: Date; lte: Date };
        accountId?: string | null;
      } = {
        userId: user.id,
        openedAt: {
          gte: searchStart,
          lte: searchEnd,
        },
      };

      // If accountId is provided, restrict to that account
      if (accountId) {
        whereClause.accountId = accountId;
      }

      const candidateTrades = await prisma.trade.findMany({
        where: whereClause,
        orderBy: { openedAt: 'asc' },
      });

      debugLogs.push(`  Found ${candidateTrades.length} candidate trades in time window (${searchStart.toISOString()} - ${searchEnd.toISOString()})`);

      if (candidateTrades.length === 0) {
        const reason = `OCR Trade #${ocrIndex + 1}: No trades found in ±${TIME_TOLERANCE_HOURS}h window around ${ocrOpenedAt.toISOString()}`;
        debugLogs.push(`  ❌ ${reason}`);
        errors.push(reason);
        notFoundCount++;
        continue;
      }

      // =========================================================================
      // STEP 2: SCORE EACH CANDIDATE
      // =========================================================================
      
      const scoredCandidates: MatchScore[] = [];

      for (const trade of candidateTrades) {
        // Skip already matched trades
        if (usedTradeIds.has(trade.id)) continue;

        let score = 0;
        const reasons: string[] = [];
        const tradeEntryPrice = Number(trade.entryPrice);
        const tradeExitPrice = Number(trade.exitPrice);
        const tradePnl = Number(trade.realizedPnlUsd);

        // -----------------------------------------------------------------------
        // SYMBOL MATCHING (Critical: +100 if match, 0 if not)
        // -----------------------------------------------------------------------
        if (symbolsMatch(symbol, trade.symbol)) {
          score += 100;
          reasons.push(`✓ Symbol match (${symbol} ≈ ${trade.symbol})`);
        } else {
          reasons.push(`✗ Symbol mismatch (${symbol} ≠ ${trade.symbol})`);
          continue; // Skip non-matching symbols entirely
        }

        // -----------------------------------------------------------------------
        // TIME MATCHING (+50 if within 5 min, +30 if within 1h, +10 if within 12h)
        // -----------------------------------------------------------------------
        const timeDiffMs = Math.abs(ocrOpenedAt.getTime() - trade.openedAt.getTime());
        const timeDiffMinutes = timeDiffMs / (60 * 1000);
        
        if (timeDiffMinutes <= 5) {
          score += 50;
          reasons.push(`✓ Time match (within ${Math.round(timeDiffMinutes)}min)`);
        } else if (timeDiffMinutes <= 60) {
          score += 30;
          reasons.push(`~ Time close (${Math.round(timeDiffMinutes)}min diff)`);
        } else if (timeDiffMinutes <= TIME_TOLERANCE_HOURS * 60) {
          score += 10;
          reasons.push(`? Time within tolerance (${Math.round(timeDiffMinutes / 60)}h diff - possible timezone)`);
        }

        // -----------------------------------------------------------------------
        // ENTRY PRICE MATCHING (+40 if within 2 ticks, +20 if within 10 ticks)
        // -----------------------------------------------------------------------
        const entryPriceDiff = Math.abs(tradeEntryPrice - data.entryPrice);
        const ticksDiff = entryPriceDiff / tickSize;
        const percentDiff = (entryPriceDiff / tradeEntryPrice) * 100;

        if (ticksDiff <= 2 || percentDiff <= 0.01) {
          score += 40;
          reasons.push(`✓ Entry price match (diff: ${entryPriceDiff.toFixed(2)}, ${ticksDiff.toFixed(1)} ticks)`);
        } else if (ticksDiff <= 10 || percentDiff <= 0.1) {
          score += 20;
          reasons.push(`~ Entry price close (diff: ${entryPriceDiff.toFixed(2)}, ${ticksDiff.toFixed(1)} ticks)`);
        } else {
          reasons.push(`✗ Entry price mismatch (diff: ${entryPriceDiff.toFixed(2)}, ${ticksDiff.toFixed(1)} ticks)`);
        }

        // -----------------------------------------------------------------------
        // EXIT PRICE MATCHING (+20 if within 5 ticks, +10 if within 15 ticks)
        // -----------------------------------------------------------------------
        const exitPriceDiff = Math.abs(tradeExitPrice - data.exitPrice);
        const exitTicksDiff = exitPriceDiff / tickSize;

        if (exitTicksDiff <= 5 || (exitPriceDiff / tradeExitPrice) * 100 <= 0.05) {
          score += 20;
          reasons.push(`✓ Exit price match (diff: ${exitPriceDiff.toFixed(2)})`);
        } else if (exitTicksDiff <= 15 || (exitPriceDiff / tradeExitPrice) * 100 <= 0.15) {
          score += 10;
          reasons.push(`~ Exit price close (diff: ${exitPriceDiff.toFixed(2)})`);
        }

        // -----------------------------------------------------------------------
        // PNL MATCHING (+30 if within $5 or 5%, +15 if within $20 or 15%)
        // -----------------------------------------------------------------------
        const pnlDiff = Math.abs(tradePnl - data.profitLoss);
        const pnlPercentDiff = tradePnl !== 0 ? (pnlDiff / Math.abs(tradePnl)) * 100 : (pnlDiff === 0 ? 0 : 100);

        if (pnlDiff <= 5 || pnlPercentDiff <= 5) {
          score += 30;
          reasons.push(`✓ PnL match (diff: $${pnlDiff.toFixed(2)}, ${pnlPercentDiff.toFixed(1)}%)`);
        } else if (pnlDiff <= 20 || pnlPercentDiff <= 15) {
          score += 15;
          reasons.push(`~ PnL close (diff: $${pnlDiff.toFixed(2)}, ${pnlPercentDiff.toFixed(1)}%)`);
        } else {
          reasons.push(`✗ PnL mismatch (diff: $${pnlDiff.toFixed(2)}, ${pnlPercentDiff.toFixed(1)}%)`);
        }

        // -----------------------------------------------------------------------
        // DIRECTION MATCHING (+20 if same, 0 if different)
        // -----------------------------------------------------------------------
        if (trade.direction === ocrDirection) {
          score += 20;
          reasons.push(`✓ Direction match (${trade.direction})`);
        } else {
          reasons.push(`? Direction differs (DB: ${trade.direction}, OCR: ${ocrDirection})`);
        }

        // -----------------------------------------------------------------------
        // QUANTITY MATCHING (bonus +10 if same)
        // -----------------------------------------------------------------------
        if (data.quantity && Number(trade.quantity) === data.quantity) {
          score += 10;
          reasons.push(`✓ Quantity match (${data.quantity})`);
        }

        scoredCandidates.push({ trade, score, reasons });
      }

      // =========================================================================
      // STEP 3: SELECT BEST MATCH
      // =========================================================================
      
      // Sort by score descending
      scoredCandidates.sort((a, b) => b.score - a.score);

      // Log top 3 candidates for debugging
      for (let i = 0; i < Math.min(3, scoredCandidates.length); i++) {
        const c = scoredCandidates[i];
        debugLogs.push(`  Candidate #${i + 1}: score=${c.score}, id=${c.trade.id.slice(0, 8)}..., ${c.reasons.join(', ')}`);
      }

      // Minimum score threshold to accept a match (symbol match + at least one other factor)
      const MIN_MATCH_SCORE = 120;
      
      const bestMatch = scoredCandidates[0];
      
      if (!bestMatch || bestMatch.score < MIN_MATCH_SCORE) {
        const reason = `OCR Trade #${ocrIndex + 1}: No match found. Best score: ${bestMatch?.score ?? 0} (min: ${MIN_MATCH_SCORE})`;
        debugLogs.push(`  ❌ ${reason}`);
        errors.push(reason);
        notFoundCount++;
        continue;
      }

      debugLogs.push(`  ✅ Matched with score ${bestMatch.score}: trade ${bestMatch.trade.id.slice(0, 8)}...`);
      usedTradeIds.add(bestMatch.trade.id);

      // =========================================================================
      // STEP 4: UPDATE MATCHED TRADE
      // =========================================================================
      
      const trade = bestMatch.trade;
      const updateData: {
        openedAt?: Date;
        closedAt?: Date;
        floatingDrawdownUsd?: number;
        floatingRunupUsd?: number;
        timesManuallySet?: boolean;
      } = {};

      // Check if existing times are placeholders
      const existingOpenTime = trade.openedAt;
      const existingCloseTime = trade.closedAt;
      const existingOpenHours = existingOpenTime.getHours();
      const existingOpenMinutes = existingOpenTime.getMinutes();
      const existingCloseHours = existingCloseTime.getHours();
      const existingCloseMinutes = existingCloseTime.getMinutes();
      
      const isOpenPlaceholder = (existingOpenHours === 0 && existingOpenMinutes === 0) ||
                                (existingOpenHours === 9 && existingOpenMinutes === 0);
      const isClosePlaceholder = (existingCloseHours === 0 && existingCloseMinutes === 0) ||
                                 (existingCloseHours === 9 && existingCloseMinutes === 0);

      // Check if new times are precise
      const newOpenHours = ocrOpenedAt.getHours();
      const newOpenMinutes = ocrOpenedAt.getMinutes();
      const newCloseHours = ocrClosedAt.getHours();
      const newCloseMinutes = ocrClosedAt.getMinutes();
      
      const isNewOpenPrecise = !(newOpenHours === 0 && newOpenMinutes === 0) &&
                               !(newOpenHours === 9 && newOpenMinutes === 0);
      const isNewClosePrecise = !(newCloseHours === 0 && newCloseMinutes === 0) &&
                                !(newCloseHours === 9 && newCloseMinutes === 0);

      if (isOpenPlaceholder && isNewOpenPrecise) {
        updateData.openedAt = ocrOpenedAt;
        updateData.timesManuallySet = true;
      }

      if (isClosePlaceholder && isNewClosePrecise) {
        updateData.closedAt = ocrClosedAt;
        updateData.timesManuallySet = true;
      }

      // Update drawdown if provided and existing is null
      if (data.drawdown !== undefined && data.drawdown !== null && trade.floatingDrawdownUsd === null) {
        updateData.floatingDrawdownUsd = data.drawdown;
      }

      // Update runup if provided and existing is null
      if (data.runup !== undefined && data.runup !== null && trade.floatingRunupUsd === null) {
        updateData.floatingRunupUsd = data.runup;
      }

      // Apply update if there's something to update
      if (Object.keys(updateData).length > 0) {
        await prisma.trade.update({
          where: { id: trade.id },
          data: updateData,
        });
        enrichedCount++;
        debugLogs.push(`  Updated fields: ${Object.keys(updateData).join(', ')}`);
      } else {
        // Trade matched but already has all data - count as success
        enrichedCount++;
        debugLogs.push(`  Trade already has all data, nothing to update`);
      }

    } catch (error) {
      ocrLogger.error('Error enriching OCR trade:', error);
      errors.push(`Failed to process OCR trade #${ocrIndex + 1}: ${error}`);
      notFoundCount++;
    }
  }

  // Log summary
  ocrLogger.debug(`[OCR Enrichment Summary] Enriched: ${enrichedCount}, Not Found: ${notFoundCount}, Errors: ${errors.length}`);
  ocrLogger.debug(debugLogs.join('\n'));

  revalidatePath('/trades');
  revalidatePath('/dashboard');
  revalidatePath('/statistiques');
  revalidatePath('/calendrier');
  revalidatePath('/journal');

  return { enrichedCount, notFoundCount, errors, debugLogs };
}






