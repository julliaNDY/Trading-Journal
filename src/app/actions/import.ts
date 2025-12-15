'use server';

import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/auth';
import { createManyTrades, type CreateTradeInput } from '@/services/trade-service';

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
