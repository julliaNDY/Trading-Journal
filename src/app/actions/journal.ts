'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { getUser } from '@/lib/auth';
import { updateStopLoss, serializeTrades, serializeTrade } from '@/services/trade-service';
import { storage, isValidImageType, isValidFileSize } from '@/services/storage-service';

/**
 * Get trades for a specific date in the user's timezone
 * @param dateStr - Date in YYYY-MM-DD format (user's local date)
 * @param timezoneOffset - User's timezone offset in minutes (from getTimezoneOffset())
 *                         e.g., UTC+1 = -60, UTC-5 = 300
 */
export async function getTradesForDate(dateStr: string, timezoneOffset: number = 0) {
  const user = await getUser();
  if (!user) return [];

  // Parse date string in YYYY-MM-DD format
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Create UTC timestamps for start and end of day in user's timezone
  // timezoneOffset is in minutes, negative for east of UTC (e.g., UTC+1 = -60)
  // To get UTC time for midnight in user's timezone:
  // If user is UTC+1 (offset=-60), midnight local = 23:00 UTC previous day
  // So we need to ADD the offset to convert local to UTC
  const startOfDayUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  startOfDayUTC.setUTCMinutes(startOfDayUTC.getUTCMinutes() + timezoneOffset);
  
  const endOfDayUTC = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  endOfDayUTC.setUTCMinutes(endOfDayUTC.getUTCMinutes() + timezoneOffset);

  const trades = await prisma.trade.findMany({
    where: {
      userId: user.id,
      closedAt: {
        gte: startOfDayUTC,
        lte: endOfDayUTC,
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
      screenshots: {
        select: {
          id: true,
          filePath: true,
          originalName: true,
        },
      },
    },
    orderBy: { closedAt: 'asc' },
  });

  return serializeTrades(trades);
}

/**
 * Get day journal for a specific date in the user's timezone
 * @param dateStr - Date in YYYY-MM-DD format (user's local date)
 * @param timezoneOffset - User's timezone offset in minutes (unused for @db.Date fields)
 */
export async function getDayJournal(dateStr: string, timezoneOffset: number = 0) {
  const user = await getUser();
  if (!user) return null;

  // Parse date string - for @db.Date fields, we use UTC midnight without timezone adjustment
  // because MySQL DATE type only stores the date part
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  return prisma.dayJournal.findUnique({
    where: {
      userId_date: {
        userId: user.id,
        date,
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
      screenshots: {
        select: {
          id: true,
          filePath: true,
          originalName: true,
        },
      },
      voiceNotes: {
        select: {
          id: true,
          dayJournalId: true,
          filePath: true,
          duration: true,
          transcription: true,
          transcriptionHash: true,
          summary: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });
}

export async function saveDayNote(dateStr: string, note: string, timezoneOffset: number = 0) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  // Parse date string - for @db.Date fields, we use UTC midnight without timezone adjustment
  // because MySQL DATE type only stores the date part
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  await prisma.dayJournal.upsert({
    where: {
      userId_date: {
        userId: user.id,
        date,
      },
    },
    create: {
      userId: user.id,
      date,
      note,
    },
    update: {
      note,
    },
  });

  revalidatePath('/journal');
}

export async function saveDayYoutubeUrl(dateStr: string, youtubeUrl: string | null, timezoneOffset: number = 0) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  // Parse date string - for @db.Date fields, we use UTC midnight without timezone adjustment
  // because MySQL DATE type only stores the date part
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  await prisma.dayJournal.upsert({
    where: {
      userId_date: {
        userId: user.id,
        date,
      },
    },
    create: {
      userId: user.id,
      date,
      youtubeUrl,
    },
    update: {
      youtubeUrl,
    },
  });

  revalidatePath('/journal');
}

export async function updateTradeStopLoss(tradeId: string, stopLossPrice: number | null) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  await updateStopLoss(tradeId, user.id, stopLossPrice);

  revalidatePath('/journal');
  revalidatePath('/dashboard');
  revalidatePath('/statistiques');
}

// Trade times management
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

  console.log('[updateTradeTimes] Updating trade:', tradeId);
  console.log('[updateTradeTimes] openedAt received:', openedAt, 'parsed:', parsedOpenedAt);
  console.log('[updateTradeTimes] closedAt received:', closedAt, 'parsed:', parsedClosedAt);

  const result = await prisma.trade.update({
    where: { id: tradeId },
    data: { 
      openedAt: parsedOpenedAt, 
      closedAt: parsedClosedAt, 
      timesManuallySet: true 
    },
  });

  console.log('[updateTradeTimes] Update result - timesManuallySet:', result.timesManuallySet, 'openedAt:', result.openedAt, 'closedAt:', result.closedAt);

  revalidatePath('/journal');
  revalidatePath('/dashboard');
  revalidatePath('/statistiques');
  revalidatePath('/calendrier');
  revalidatePath('/trades');
  revalidatePath(`/trades/${tradeId}`);
  
  return result;
}

// Trade note management
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

  revalidatePath('/journal');
  revalidatePath('/trades');
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

  revalidatePath('/journal');
  revalidatePath('/trades');
}

// Trade rating management
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

  revalidatePath('/journal');
  revalidatePath('/trades');
  revalidatePath(`/trades/${tradeId}`);
}

// Trade profit target management
export async function updateTradeProfitTarget(tradeId: string, profitTarget: number | null) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId: user.id },
  });

  if (!trade) throw new Error('Trade not found');

  await prisma.trade.update({
    where: { id: tradeId },
    data: { profitTarget },
  });

  revalidatePath('/journal');
  revalidatePath('/trades');
  revalidatePath(`/trades/${tradeId}`);
}

// Get single trade by ID
export async function getTradeById(tradeId: string) {
  const user = await getUser();
  if (!user) return null;

  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId: user.id },
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
      screenshots: {
        select: {
          id: true,
          filePath: true,
          originalName: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      tradePlaybooks: {
        include: {
          playbook: true,
          checkedPrerequisites: true,
        },
      },
      account: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
    },
  });

  if (!trade) return null;
  return serializeTrade(trade);
}

// Trade deletion
export async function deleteTrade(tradeId: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId: user.id },
    include: { screenshots: true },
  });

  if (!trade) throw new Error('Trade not found');

  // Delete associated screenshots from storage
  for (const screenshot of trade.screenshots) {
    await storage.delete(screenshot.filePath);
  }

  await prisma.trade.delete({
    where: { id: tradeId },
  });

  revalidatePath('/journal');
  revalidatePath('/dashboard');
  revalidatePath('/statistiques');
  revalidatePath('/calendrier');
}

export async function deleteTrades(tradeIds: string[]) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  // Get all trades with screenshots
  const trades = await prisma.trade.findMany({
    where: { 
      id: { in: tradeIds },
      userId: user.id,
    },
    include: { screenshots: true },
  });

  // Delete associated screenshots from storage
  for (const trade of trades) {
    for (const screenshot of trade.screenshots) {
      await storage.delete(screenshot.filePath);
    }
  }

  const result = await prisma.trade.deleteMany({
    where: {
      id: { in: tradeIds },
      userId: user.id,
    },
  });

  revalidatePath('/journal');
  revalidatePath('/dashboard');
  revalidatePath('/statistiques');
  revalidatePath('/calendrier');

  return result.count;
}

export async function deleteAllTrades() {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  // Get all trades with screenshots
  const trades = await prisma.trade.findMany({
    where: { userId: user.id },
    include: { screenshots: true },
  });

  // Delete associated screenshots from storage
  for (const trade of trades) {
    for (const screenshot of trade.screenshots) {
      await storage.delete(screenshot.filePath);
    }
  }

  const result = await prisma.trade.deleteMany({
    where: { userId: user.id },
  });

  revalidatePath('/journal');
  revalidatePath('/dashboard');
  revalidatePath('/statistiques');
  revalidatePath('/calendrier');

  return result.count;
}

// Screenshot management for trades
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

  revalidatePath('/journal');
  revalidatePath('/trades');
  
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

  revalidatePath('/journal');
}

// Screenshot management for day journal
export async function uploadDayScreenshot(dateStr: string, formData: FormData, timezoneOffset: number = 0) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  // Parse date string - for @db.Date fields, we use UTC midnight without timezone adjustment
  // because MySQL DATE type only stores the date part
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  // Get or create day journal
  let dayJournal = await prisma.dayJournal.findUnique({
    where: {
      userId_date: {
        userId: user.id,
        date,
      },
    },
  });

  if (!dayJournal) {
    dayJournal = await prisma.dayJournal.create({
      data: {
        userId: user.id,
        date,
      },
    });
  }

  const file = formData.get('file') as File;
  if (!file) throw new Error('No file provided');

  if (!isValidImageType(file)) {
    throw new Error('Invalid file type. Only images are allowed.');
  }

  if (!isValidFileSize(file)) {
    throw new Error('File too large. Maximum size is 10MB.');
  }

  const filePath = await storage.save(file, `days/${dayJournal.id}`);

  const screenshot = await prisma.screenshot.create({
    data: {
      userId: user.id,
      dayJournalId: dayJournal.id,
      filePath,
      originalName: file.name,
    },
    select: {
      id: true,
      filePath: true,
      originalName: true,
    },
  });

  revalidatePath('/journal');
  
  return screenshot;
}

// Tag management
export async function createTag(name: string, color: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  return prisma.tag.create({
    data: {
      userId: user.id,
      name,
      color,
    },
  });
}

export async function deleteTag(tagId: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  await prisma.tag.delete({
    where: {
      id: tagId,
      userId: user.id,
    },
  });

  revalidatePath('/journal');
}

export async function addTagToTrade(tradeId: string, tagId: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId: user.id },
  });

  if (!trade) throw new Error('Trade not found');

  await prisma.tradeTag.create({
    data: { tradeId, tagId },
  });

  revalidatePath('/journal');
}

export async function removeTagFromTrade(tradeId: string, tagId: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  await prisma.tradeTag.delete({
    where: {
      tradeId_tagId: { tradeId, tagId },
    },
  });

  revalidatePath('/journal');
}

// Get daily PnL for calendar
/**
 * Get daily PnL map for calendar display
 * @param timezoneOffset - User's timezone offset in minutes
 */
export async function getDailyPnlMap(timezoneOffset: number = 0) {
  const user = await getUser();
  if (!user) return {};

  const trades = await prisma.trade.findMany({
    where: { userId: user.id },
    select: {
      closedAt: true,
      realizedPnlUsd: true,
    },
  });

  const pnlMap: Record<string, number> = {};
  
  for (const trade of trades) {
    // Convert UTC time to user's local time
    const utcDate = new Date(trade.closedAt);
    // Subtract offset to convert from UTC to local (offset is negative for east of UTC)
    const localDate = new Date(utcDate.getTime() - timezoneOffset * 60 * 1000);
    
    const year = localDate.getUTCFullYear();
    const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(localDate.getUTCDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    pnlMap[dateKey] = (pnlMap[dateKey] || 0) + Number(trade.realizedPnlUsd);
  }

  return pnlMap;
}
