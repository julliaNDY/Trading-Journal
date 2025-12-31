'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { getUser } from '@/lib/auth';
import { serializeTrades, serializeTrade } from '@/services/trade-service';
import { calculateTradeFees, calculateGrossPnl } from '@/lib/utils';
import type { Direction } from '@prisma/client';

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

// OCR trade data from screenshot
export interface OcrTradeData {
  entryDt: string; // "12/30/2025 10:09:48 AM"
  exitDt: string;  // "12/30/2025 10:12:05 AM"
  entryPrice: number;
  exitPrice: number;
  profitLoss: number;
}

// Parse dates from OCR format: "12/30/2025 10:09:48 AM"
function parseOcrDate(dateStr: string): Date | null {
  try {
    // Format: MM/DD/YYYY HH:MM:SS AM/PM (AM/PM might be missing or partial)
    const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*([AP]M?)?/i);
    if (!match) return null;
    
    const [, month, day, year, hours, minutes, seconds, ampm] = match;
    let hour = parseInt(hours);
    
    // Handle AM/PM if present
    if (ampm) {
      const ampmUpper = ampm.toUpperCase();
      if ((ampmUpper === 'PM' || ampmUpper === 'P') && hour !== 12) hour += 12;
      if ((ampmUpper === 'AM' || ampmUpper === 'A') && hour === 12) hour = 0;
    }
    
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      hour,
      parseInt(minutes),
      parseInt(seconds)
    );
  } catch {
    return null;
  }
}

// Create new trades from OCR data
export async function createTradesFromOcr(
  ocrData: OcrTradeData[], 
  symbol: string, 
  accountId: string | null
) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  let createdCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (const data of ocrData) {
    const openedAt = parseOcrDate(data.entryDt);
    const closedAt = parseOcrDate(data.exitDt);

    if (!openedAt || !closedAt) {
      errors.push(`Could not parse dates: ${data.entryDt} - ${data.exitDt}`);
      continue;
    }

    // Check for duplicates - same user, same times, same prices
    const existingTrade = await prisma.trade.findFirst({
      where: {
        userId: user.id,
        openedAt,
        closedAt,
        entryPrice: data.entryPrice,
        exitPrice: data.exitPrice,
      },
    });

    if (existingTrade) {
      skippedCount++;
      continue; // Skip duplicate
    }

    // Determine direction based on entry/exit prices and PnL
    // If profit when exit > entry, it's LONG; if profit when exit < entry, it's SHORT
    const priceMove = data.exitPrice - data.entryPrice;
    const isProfit = data.profitLoss > 0;
    const direction: Direction = (priceMove > 0 && isProfit) || (priceMove < 0 && !isProfit) 
      ? 'LONG' 
      : 'SHORT';

    // Calculate quantity from PnL and price difference
    // For futures, PnL = points * quantity * pointValue
    // We'll estimate quantity assuming standard point values
    const pointDiff = Math.abs(data.exitPrice - data.entryPrice);
    let quantity = 1;
    
    if (pointDiff > 0 && data.profitLoss !== 0) {
      // Try to determine point value based on price range (NQ ~20000, ES ~5000, MNQ/MES similar)
      let pointValue = 1;
      if (data.entryPrice > 15000) {
        // Likely NQ - $20 per point, or MNQ - $2 per point
        pointValue = Math.abs(data.profitLoss / pointDiff) > 10 ? 20 : 2;
      } else if (data.entryPrice > 4000) {
        // Likely ES - $50 per point, or MES - $5 per point
        pointValue = Math.abs(data.profitLoss / pointDiff) > 25 ? 50 : 5;
      }
      
      quantity = Math.round(Math.abs(data.profitLoss) / (pointDiff * pointValue));
      if (quantity < 1) quantity = 1;
    }

    // Calculate fees
    const fees = calculateTradeFees(symbol, quantity);
    const grossPnlUsd = calculateGrossPnl(data.profitLoss, fees);

    try {
      await prisma.trade.create({
        data: {
          userId: user.id,
          accountId,
          symbol: symbol.toUpperCase(),
          direction,
          openedAt,
          closedAt,
          entryPrice: data.entryPrice,
          exitPrice: data.exitPrice,
          quantity,
          realizedPnlUsd: data.profitLoss,
          grossPnlUsd,
          fees,
          timesManuallySet: true,
        },
      });
      createdCount++;
    } catch (error) {
      console.error('Error creating trade:', error);
      errors.push(`Failed to create trade: ${data.entryDt}`);
    }
  }

  revalidatePath('/trades');
  revalidatePath('/dashboard');
  revalidatePath('/statistiques');
  revalidatePath('/calendrier');
  revalidatePath('/journal');

  return { createdCount, skippedCount, errors };
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
      console.log('Could not parse dates:', data.entryDt, data.exitDt);
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






