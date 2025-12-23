'use server';

import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/auth';
import { createManyTrades, calculateImportHash, type CreateTradeInput } from '@/services/trade-service';
import prisma from '@/lib/prisma';

/**
 * Check for potential duplicates before importing
 * Returns the number of trades that would be skipped as duplicates
 */
export async function checkDuplicates(
  trades: Omit<CreateTradeInput, 'userId' | 'accountId'>[]
): Promise<{ duplicateCount: number; newCount: number; duplicateDetails: { symbol: string; date: string }[] }> {
  const user = await getUser();

  if (!user) {
    return { duplicateCount: 0, newCount: 0, duplicateDetails: [] };
  }

  const duplicateDetails: { symbol: string; date: string }[] = [];
  let duplicateCount = 0;

  // Calculate import hashes for all trades and check against database
  for (const trade of trades) {
    const importHash = calculateImportHash({
      userId: user.id,
      symbol: trade.symbol,
      openedAt: trade.openedAt,
      closedAt: trade.closedAt,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      realizedPnlUsd: trade.realizedPnlUsd,
    });

    const existing = await prisma.trade.findUnique({
      where: { importHash },
      select: { id: true },
    });

    if (existing) {
      duplicateCount++;
      // Add to details (limit to first 10 for display)
      if (duplicateDetails.length < 10) {
        duplicateDetails.push({
          symbol: trade.symbol,
          date: trade.closedAt.toISOString().split('T')[0],
        });
      }
    }
  }

  return {
    duplicateCount,
    newCount: trades.length - duplicateCount,
    duplicateDetails,
  };
}

export async function commitImport(
  trades: Omit<CreateTradeInput, 'userId' | 'accountId'>[],
  accountId?: string
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const user = await getUser();

  if (!user) {
    return { imported: 0, skipped: 0, errors: ['Non authentifié'] };
  }

  try {
    // Add userId and accountId to all trades
    const tradesWithUser: CreateTradeInput[] = trades.map((trade) => ({
      ...trade,
      userId: user.id,
      accountId: accountId || null,
    }));

    const result = await createManyTrades(tradesWithUser);

    // Revalidate dashboard and other pages
    revalidatePath('/dashboard');
    revalidatePath('/journal');
    revalidatePath('/calendrier');
    revalidatePath('/statistiques');
    revalidatePath('/trades');
    revalidatePath('/comptes');

    return result;
  } catch (error) {
    console.error('Import error:', error);
    return {
      imported: 0,
      skipped: 0,
      errors: [`Erreur lors de l'import: ${error}`],
    };
  }
}
