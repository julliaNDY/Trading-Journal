'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { getUser } from '@/lib/auth';

// Get all accounts for user with stats
export async function getAccounts() {
  const user = await getUser();
  if (!user) return [];

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    include: {
      _count: {
        select: { trades: true },
      },
      trades: {
        select: {
          realizedPnlUsd: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return accounts.map((account) => {
    const totalPnl = account.trades.reduce((sum, t) => sum + Number(t.realizedPnlUsd), 0);
    const initialBalance = account.initialBalance ? Number(account.initialBalance) : null;
    const currentBalance = initialBalance !== null ? initialBalance + totalPnl : null;
    const roi = initialBalance !== null && initialBalance > 0 ? (totalPnl / initialBalance) * 100 : null;
    
    return {
      id: account.id,
      name: account.name,
      broker: account.broker,
      description: account.description,
      color: account.color,
      initialBalance,
      currentBalance,
      createdAt: account.createdAt,
      tradesCount: account._count.trades,
      totalPnl,
      roi,
    };
  });
}

// Get accounts for selection (simple list)
export async function getAccountsForSelection() {
  const user = await getUser();
  if (!user) return [];

  return prisma.account.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      broker: true,
      color: true,
    },
    orderBy: { name: 'asc' },
  });
}

// Create account
export async function createAccount(
  name: string,
  broker?: string,
  description?: string,
  color?: string,
  initialBalance?: number
) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  const account = await prisma.account.create({
    data: {
      userId: user.id,
      name,
      broker,
      description,
      color: color || '#6366f1',
      initialBalance: initialBalance ?? null,
    },
  });

  revalidatePath('/comptes');
  revalidatePath('/importer');
  return account;
}

// Update account
export async function updateAccount(
  accountId: string,
  name: string,
  broker?: string,
  description?: string,
  color?: string,
  initialBalance?: number
) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  await prisma.account.update({
    where: { id: accountId, userId: user.id },
    data: { 
      name, 
      broker, 
      description, 
      color,
      initialBalance: initialBalance ?? null,
    },
  });

  revalidatePath('/comptes');
}

// Delete account and its trades
export async function deleteAccount(accountId: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  // First delete all trades associated with this account
  await prisma.trade.deleteMany({
    where: { 
      accountId,
      userId: user.id,
    },
  });

  // Then delete the account
  await prisma.account.delete({
    where: { id: accountId, userId: user.id },
  });

  revalidatePath('/comptes');
  revalidatePath('/trades');
  revalidatePath('/journal');
  revalidatePath('/dashboard');
  revalidatePath('/statistiques');
  revalidatePath('/calendrier');
}

// Delete all trades for an account
export async function deleteAccountTrades(accountId: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  // Verify account belongs to user
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId: user.id },
  });

  if (!account) throw new Error('Account not found');

  // Delete all trades for this account
  const result = await prisma.trade.deleteMany({
    where: { 
      accountId,
      userId: user.id,
    },
  });

  revalidatePath('/comptes');
  revalidatePath('/trades');
  revalidatePath('/journal');
  revalidatePath('/dashboard');
  revalidatePath('/statistiques');

  return result.count;
}

// Hide account (soft hide)
export async function hideAccount(accountId: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  const account = await prisma.account.findFirst({
    where: { id: accountId, userId: user.id },
  });

  if (!account) throw new Error('Account not found');

  // Add [HIDDEN] prefix to hide the account
  if (!account.name.startsWith('[HIDDEN]')) {
    await prisma.account.update({
      where: { id: accountId },
      data: {
        name: `[HIDDEN] ${account.name}`,
      },
    });
  }

  revalidatePath('/comptes');
}

// Unhide account
export async function unhideAccount(accountId: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  const account = await prisma.account.findFirst({
    where: { id: accountId, userId: user.id },
  });

  if (!account) throw new Error('Account not found');

  // Remove [HIDDEN] prefix
  if (account.name.startsWith('[HIDDEN]')) {
    await prisma.account.update({
      where: { id: accountId },
      data: {
        name: account.name.replace('[HIDDEN] ', ''),
      },
    });
  }

  revalidatePath('/comptes');
}
