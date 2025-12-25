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






