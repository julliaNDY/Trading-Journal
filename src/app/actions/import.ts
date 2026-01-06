'use server';

import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/auth';
import { 
  findTradeBySignature,
  createOrMergeTrade,
  type CreateTradeInput 
} from '@/services/trade-service';

/**
 * Check for potential duplicates/merges before importing
 * Uses signature-based matching for intelligent detection
 * Returns:
 * - exactDuplicates: Trades that are exact matches (will be skipped)
 * - mergeCandidates: Trades that can be merged (enriched)
 * - newTrades: Trades that will be created fresh
 * 
 * @param accountId - Required to check duplicates within the correct account
 */
export async function checkDuplicates(
  trades: Omit<CreateTradeInput, 'userId' | 'accountId'>[],
  accountId?: string
): Promise<{ 
  duplicateCount: number; 
  mergeCount: number;
  newCount: number; 
  duplicateDetails: { symbol: string; date: string; action: 'skip' | 'merge' }[] 
}> {
  const user = await getUser();

  if (!user) {
    return { duplicateCount: 0, mergeCount: 0, newCount: 0, duplicateDetails: [] };
  }

  const duplicateDetails: { symbol: string; date: string; action: 'skip' | 'merge' }[] = [];
  let duplicateCount = 0;
  let mergeCount = 0;

  // Use signature-based matching (with accountId to prevent cross-account duplicates)
  for (const trade of trades) {
    const existingTrade = await findTradeBySignature(
      user.id,
      trade.symbol,
      trade.openedAt,
      trade.entryPrice,
      accountId
    );

    if (existingTrade) {
      // Check if it would be an actual merge or just a skip
      // Times from CSV are usually imprecise (00:00:00 or 09:00:00)
      const isTimePrecise = (date: Date) => {
        const h = date.getHours();
        const m = date.getMinutes();
        return !(h === 0 && m === 0) && !(h === 9 && m === 0);
      };

      const existingHasPreciseTimes = existingTrade.timesManuallySet || isTimePrecise(existingTrade.openedAt);
      const newHasPreciseTimes = isTimePrecise(trade.openedAt);

      if (existingHasPreciseTimes && !newHasPreciseTimes) {
        // Existing has better data, this would be skipped
        duplicateCount++;
        if (duplicateDetails.length < 10) {
          duplicateDetails.push({
            symbol: trade.symbol,
            date: trade.closedAt.toISOString().split('T')[0],
            action: 'skip',
          });
        }
      } else if (!existingHasPreciseTimes && newHasPreciseTimes) {
        // New data can enrich existing, will be merged
        mergeCount++;
        if (duplicateDetails.length < 10) {
          duplicateDetails.push({
            symbol: trade.symbol,
            date: trade.closedAt.toISOString().split('T')[0],
            action: 'merge',
          });
        }
      } else {
        // Same precision, skip
        duplicateCount++;
        if (duplicateDetails.length < 10) {
          duplicateDetails.push({
            symbol: trade.symbol,
            date: trade.closedAt.toISOString().split('T')[0],
            action: 'skip',
          });
        }
      }
    }
  }

  return {
    duplicateCount,
    mergeCount,
    newCount: trades.length - duplicateCount - mergeCount,
    duplicateDetails,
  };
}

/**
 * Commit import with intelligent merge
 * Uses createOrMergeTrade for each trade
 */
export async function commitImport(
  trades: Omit<CreateTradeInput, 'userId' | 'accountId'>[],
  accountId?: string
): Promise<{ imported: number; merged: number; skipped: number; errors: string[] }> {
  const user = await getUser();

  if (!user) {
    return { imported: 0, merged: 0, skipped: 0, errors: ['Non authentifié'] };
  }

  const results = { imported: 0, merged: 0, skipped: 0, errors: [] as string[] };

  for (const trade of trades) {
    try {
      const result = await createOrMergeTrade({
        userId: user.id,
        symbol: trade.symbol,
        direction: trade.direction,
        openedAt: trade.openedAt,
        closedAt: trade.closedAt,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        quantity: trade.quantity,
        realizedPnlUsd: trade.realizedPnlUsd,
        accountId: accountId || null,
        // CSV imports typically don't have precise times
        timesManuallySet: false,
      });

      switch (result.action) {
        case 'created':
          results.imported++;
          break;
        case 'updated':
          results.merged++;
          break;
        case 'skipped':
          results.skipped++;
          break;
      }
    } catch (error) {
      console.error('Error importing trade:', error);
      results.errors.push(`Erreur pour ${trade.symbol} le ${trade.openedAt.toISOString().split('T')[0]}`);
    }
  }

  // Revalidate all pages
  revalidatePath('/dashboard');
  revalidatePath('/journal');
  revalidatePath('/calendrier');
  revalidatePath('/statistiques');
  revalidatePath('/trades');
  revalidatePath('/comptes');

  return results;
}
