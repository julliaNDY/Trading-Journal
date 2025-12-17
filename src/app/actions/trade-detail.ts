'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { getUser } from '@/lib/auth';
import { storage, isValidImageType, isValidFileSize } from '@/services/storage-service';
import { calculateTradeFees, calculateGrossPnl } from '@/lib/utils';

export async function updateTradeDetails(
  tradeId: string,
  data: {
    stopLossPriceInitial?: number | null;
    profitTarget?: number | null;
  }
) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId: user.id },
  });

  if (!trade) throw new Error('Trade not found');

  // Calculate R multiples if we have stop loss and profit target
  let plannedRMultiple = null;
  let realizedRMultiple = null;

  const entryPrice = Number(trade.entryPrice);
  const exitPrice = Number(trade.exitPrice);
  const stopLoss = data.stopLossPriceInitial ?? (trade.stopLossPriceInitial ? Number(trade.stopLossPriceInitial) : null);
  const profitTarget = data.profitTarget ?? (trade.profitTarget ? Number(trade.profitTarget) : null);

  if (stopLoss && profitTarget) {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(profitTarget - entryPrice);
    if (risk > 0) {
      plannedRMultiple = reward / risk;
    }
  }

  if (stopLoss) {
    const risk = Math.abs(entryPrice - stopLoss);
    const actualMove = trade.direction === 'LONG' 
      ? exitPrice - entryPrice 
      : entryPrice - exitPrice;
    if (risk > 0) {
      realizedRMultiple = actualMove / risk;
    }
  }

  await prisma.trade.update({
    where: { id: tradeId },
    data: {
      stopLossPriceInitial: data.stopLossPriceInitial,
      profitTarget: data.profitTarget,
      plannedRMultiple,
      realizedRMultiple,
    },
  });

  revalidatePath(`/trades/${tradeId}`);
  revalidatePath('/trades');
  revalidatePath('/journal');
}

export async function updateTradeNote(tradeId: string, note: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId: user.id },
  });

  if (!trade) throw new Error('Trade not found');

  await prisma.trade.update({
    where: { id: tradeId },
    data: { note },
  });

  revalidatePath(`/trades/${tradeId}`);
  revalidatePath('/trades');
  revalidatePath('/journal');
}

export async function updateTradeYoutubeUrl(tradeId: string, youtubeUrl: string | null) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId: user.id },
  });

  if (!trade) throw new Error('Trade not found');

  await prisma.trade.update({
    where: { id: tradeId },
    data: { youtubeUrl },
  });

  revalidatePath(`/trades/${tradeId}`);
  revalidatePath('/trades');
}

export async function updateTradeRating(tradeId: string, rating: number | null) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId: user.id },
  });

  if (!trade) throw new Error('Trade not found');

  await prisma.trade.update({
    where: { id: tradeId },
    data: { rating },
  });

  revalidatePath(`/trades/${tradeId}`);
  revalidatePath('/trades');
}

export async function uploadTradeScreenshot(tradeId: string, formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId: user.id },
  });

  if (!trade) throw new Error('Trade not found');

  const file = formData.get('file') as File;
  if (!file) throw new Error('No file provided');

  if (!isValidImageType(file)) {
    throw new Error('Invalid file type. Only images are allowed.');
  }

  if (!isValidFileSize(file)) {
    throw new Error('File too large. Maximum size is 10MB.');
  }

  const filePath = await storage.save(file, `trades/${tradeId}`);

  const screenshot = await prisma.screenshot.create({
    data: {
      userId: user.id,
      tradeId,
      filePath,
      originalName: file.name,
    },
    select: {
      id: true,
      filePath: true,
      originalName: true,
    },
  });

  revalidatePath(`/trades/${tradeId}`);
  revalidatePath('/trades');
  revalidatePath('/journal');

  return screenshot;
}

export async function deleteScreenshot(screenshotId: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  const screenshot = await prisma.screenshot.findFirst({
    where: { id: screenshotId, userId: user.id },
  });

  if (!screenshot) throw new Error('Screenshot not found');

  await storage.delete(screenshot.filePath);

  await prisma.screenshot.delete({
    where: { id: screenshotId },
  });

  revalidatePath('/trades');
  revalidatePath('/journal');
}

export async function updateTradeTimes(tradeId: string, openedAt: Date, closedAt: Date) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId: user.id },
  });

  if (!trade) throw new Error('Trade not found');

  // Ensure dates are proper Date objects (they might come as strings from client)
  const parsedOpenedAt = new Date(openedAt);
  const parsedClosedAt = new Date(closedAt);

  console.log('[trade-detail updateTradeTimes] Updating trade:', tradeId);
  console.log('[trade-detail updateTradeTimes] openedAt received:', openedAt, '-> parsed:', parsedOpenedAt.toISOString());
  console.log('[trade-detail updateTradeTimes] closedAt received:', closedAt, '-> parsed:', parsedClosedAt.toISOString());

  const result = await prisma.trade.update({
    where: { id: tradeId },
    data: { 
      openedAt: parsedOpenedAt, 
      closedAt: parsedClosedAt, 
      timesManuallySet: true 
    },
  });

  console.log('[trade-detail updateTradeTimes] Result - timesManuallySet:', result.timesManuallySet);

  revalidatePath(`/trades/${tradeId}`);
  revalidatePath('/trades');
  revalidatePath('/journal');
  revalidatePath('/statistiques');
  revalidatePath('/dashboard');
  
  return result;
}

// Recalculate fees for all trades of a user
export async function recalculateAllTradeFees() {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  const trades = await prisma.trade.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      symbol: true,
      quantity: true,
      realizedPnlUsd: true,
    },
  });

  let updated = 0;
  for (const trade of trades) {
    const quantity = Number(trade.quantity);
    const netPnl = Number(trade.realizedPnlUsd);
    const fees = calculateTradeFees(trade.symbol, quantity);
    const grossPnlUsd = calculateGrossPnl(netPnl, fees);

    await prisma.trade.update({
      where: { id: trade.id },
      data: { fees, grossPnlUsd },
    });
    updated++;
  }

  revalidatePath('/trades');
  revalidatePath('/journal');
  revalidatePath('/dashboard');
  revalidatePath('/statistiques');

  return { updated };
}

