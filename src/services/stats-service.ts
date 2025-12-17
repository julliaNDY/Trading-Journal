import type { Trade } from '@prisma/client';
import { getDurationSeconds } from '@/lib/utils';

// Extended Trade type with timesManuallySet
interface TradeWithTimes extends Trade {
  timesManuallySet?: boolean;
}

export interface GlobalStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number;
  totalPnl: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  profitFactorIndex: number;
  averageWin: number;
  averageLoss: number;
  averageRR: number | null;
  bestDay: { date: string; pnl: number } | null;
  worstDay: { date: string; pnl: number } | null;
  averageDurationSeconds: number | null;
}

export interface FiveMinuteStats {
  timeSlot: string; // "HH:MM" format
  hour: number;
  minute: number;
  trades: number;
  totalPnl: number;
  avgPnl: number;
  winRate: number;
}

export interface EquityPoint {
  date: string;
  cumPnl: number;
  pnl: number;
}

export interface HourlyStats {
  hour: number;
  trades: number;
  totalPnl: number;
  avgPnl: number;
  winRate: number;
}

export interface DailyPnl {
  date: string;
  pnl: number;
  tradesCount: number;
}

// Profit Factor Index: maps PF to 0-10 scale
// PF of 3 = index of 10 (very good)
const PF_MAX = 3;

export function calculateProfitFactorIndex(pf: number): number {
  if (!isFinite(pf) || pf < 0) return 0;
  return Math.min(10, (pf / PF_MAX) * 10);
}

export function calculateGlobalStats(trades: TradeWithTimes[]): GlobalStats {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      breakevenTrades: 0,
      winRate: 0,
      totalPnl: 0,
      grossProfit: 0,
      grossLoss: 0,
      profitFactor: 0,
      profitFactorIndex: 0,
      averageWin: 0,
      averageLoss: 0,
      averageRR: null,
      bestDay: null,
      worstDay: null,
      averageDurationSeconds: null,
    };
  }

  const winningTrades = trades.filter((t) => Number(t.realizedPnlUsd) > 0);
  const losingTrades = trades.filter((t) => Number(t.realizedPnlUsd) < 0);
  const breakevenTrades = trades.filter((t) => Number(t.realizedPnlUsd) === 0);

  const grossProfit = winningTrades.reduce(
    (sum, t) => sum + Number(t.realizedPnlUsd),
    0
  );
  const grossLoss = Math.abs(
    losingTrades.reduce((sum, t) => sum + Number(t.realizedPnlUsd), 0)
  );

  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const profitFactorIndex = calculateProfitFactorIndex(profitFactor);

  const averageWin =
    winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
  const averageLoss =
    losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;

  // Average RR - only from trades with stopLoss set (use realizedRMultiple)
  const tradesWithRR = trades.filter((t) => t.realizedRMultiple !== null && t.stopLossPriceInitial !== null);
  const averageRR =
    tradesWithRR.length > 0
      ? tradesWithRR.reduce((sum, t) => sum + Number(t.realizedRMultiple), 0) /
        tradesWithRR.length
      : null;

  // Daily PnL for best/worst day
  const dailyPnlMap = new Map<string, number>();
  for (const trade of trades) {
    const dateKey = new Date(trade.closedAt).toISOString().split('T')[0];
    const current = dailyPnlMap.get(dateKey) || 0;
    dailyPnlMap.set(dateKey, current + Number(trade.realizedPnlUsd));
  }

  let bestDay: { date: string; pnl: number } | null = null;
  let worstDay: { date: string; pnl: number } | null = null;

  for (const [date, pnl] of dailyPnlMap) {
    if (!bestDay || pnl > bestDay.pnl) {
      bestDay = { date, pnl };
    }
    if (!worstDay || pnl < worstDay.pnl) {
      worstDay = { date, pnl };
    }
  }

  // Average duration in seconds - only for trades with manually set times
  const tradesWithTimes = trades.filter((t) => t.timesManuallySet === true);
  let averageDurationSeconds: number | null = null;
  
  if (tradesWithTimes.length > 0) {
    const totalDurationSeconds = tradesWithTimes.reduce((sum, t) => {
      return sum + getDurationSeconds(new Date(t.openedAt), new Date(t.closedAt));
    }, 0);
    averageDurationSeconds = Math.round(totalDurationSeconds / tradesWithTimes.length);
  }

  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    breakevenTrades: breakevenTrades.length,
    winRate: (winningTrades.length / trades.length) * 100,
    totalPnl: trades.reduce((sum, t) => sum + Number(t.realizedPnlUsd), 0),
    grossProfit,
    grossLoss,
    profitFactor: isFinite(profitFactor) ? profitFactor : 0,
    profitFactorIndex,
    averageWin,
    averageLoss,
    averageRR,
    bestDay,
    worstDay,
    averageDurationSeconds,
  };
}

export function calculateEquityCurve(trades: Trade[]): EquityPoint[] {
  if (trades.length === 0) return [];

  // Sort by closedAt
  const sorted = [...trades].sort(
    (a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime()
  );

  // Group by date
  const dailyMap = new Map<string, number>();
  for (const trade of sorted) {
    const dateKey = new Date(trade.closedAt).toISOString().split('T')[0];
    const current = dailyMap.get(dateKey) || 0;
    dailyMap.set(dateKey, current + Number(trade.realizedPnlUsd));
  }

  // Build cumulative curve
  const result: EquityPoint[] = [];
  let cumPnl = 0;

  const sortedDates = Array.from(dailyMap.keys()).sort();
  for (const date of sortedDates) {
    const pnl = dailyMap.get(date)!;
    cumPnl += pnl;
    result.push({ date, cumPnl, pnl });
  }

  return result;
}

export function calculateHourlyStats(trades: TradeWithTimes[]): HourlyStats[] {
  // Only include trades with manually set times
  const tradesWithTimes = trades.filter((t) => t.timesManuallySet === true);
  
  const hourlyMap = new Map<number, TradeWithTimes[]>();

  // Initialize all hours
  for (let h = 0; h < 24; h++) {
    hourlyMap.set(h, []);
  }

  // Group trades by opening hour
  for (const trade of tradesWithTimes) {
    const hour = new Date(trade.openedAt).getHours();
    hourlyMap.get(hour)!.push(trade);
  }

  const result: HourlyStats[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const hourTrades = hourlyMap.get(hour)!;
    const totalPnl = hourTrades.reduce(
      (sum, t) => sum + Number(t.realizedPnlUsd),
      0
    );
    const winningCount = hourTrades.filter(
      (t) => Number(t.realizedPnlUsd) > 0
    ).length;

    result.push({
      hour,
      trades: hourTrades.length,
      totalPnl,
      avgPnl: hourTrades.length > 0 ? totalPnl / hourTrades.length : 0,
      winRate: hourTrades.length > 0 ? (winningCount / hourTrades.length) * 100 : 0,
    });
  }

  return result;
}

// New function: Calculate stats by 5-minute intervals
export function calculateFiveMinuteStats(trades: TradeWithTimes[]): FiveMinuteStats[] {
  // Only include trades with manually set times
  const tradesWithTimes = trades.filter((t) => t.timesManuallySet === true);
  
  const fiveMinuteMap = new Map<string, TradeWithTimes[]>();

  // Group trades by 5-minute slot based on opening time
  for (const trade of tradesWithTimes) {
    const openedAt = new Date(trade.openedAt);
    const hour = openedAt.getHours();
    const minute = Math.floor(openedAt.getMinutes() / 5) * 5;
    const timeSlot = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    
    if (!fiveMinuteMap.has(timeSlot)) {
      fiveMinuteMap.set(timeSlot, []);
    }
    fiveMinuteMap.get(timeSlot)!.push(trade);
  }

  const result: FiveMinuteStats[] = [];

  // Sort time slots and create stats
  const sortedSlots = Array.from(fiveMinuteMap.keys()).sort();
  
  for (const timeSlot of sortedSlots) {
    const slotTrades = fiveMinuteMap.get(timeSlot)!;
    const [hourStr, minuteStr] = timeSlot.split(':');
    const hour = parseInt(hourStr);
    const minute = parseInt(minuteStr);
    
    const totalPnl = slotTrades.reduce(
      (sum, t) => sum + Number(t.realizedPnlUsd),
      0
    );
    const winningCount = slotTrades.filter(
      (t) => Number(t.realizedPnlUsd) > 0
    ).length;

    result.push({
      timeSlot,
      hour,
      minute,
      trades: slotTrades.length,
      totalPnl,
      avgPnl: slotTrades.length > 0 ? totalPnl / slotTrades.length : 0,
      winRate: slotTrades.length > 0 ? (winningCount / slotTrades.length) * 100 : 0,
    });
  }

  return result;
}

export function calculateDailyPnl(trades: Trade[]): DailyPnl[] {
  const dailyMap = new Map<string, { pnl: number; count: number }>();

  for (const trade of trades) {
    const dateKey = new Date(trade.closedAt).toISOString().split('T')[0];
    const current = dailyMap.get(dateKey) || { pnl: 0, count: 0 };
    dailyMap.set(dateKey, {
      pnl: current.pnl + Number(trade.realizedPnlUsd),
      count: current.count + 1,
    });
  }

  return Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      pnl: data.pnl,
      tradesCount: data.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function calculateMonthlyEquityCurve(
  trades: Trade[],
  year: number,
  month: number
): EquityPoint[] {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const filtered = trades.filter((t) => {
    const closedAt = new Date(t.closedAt);
    return closedAt >= startDate && closedAt <= endDate;
  });

  return calculateEquityCurve(filtered);
}

export function calculateWeeklyEquityCurve(
  trades: Trade[],
  weekStart: Date
): EquityPoint[] {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const filtered = trades.filter((t) => {
    const closedAt = new Date(t.closedAt);
    return closedAt >= weekStart && closedAt <= weekEnd;
  });

  return calculateEquityCurve(filtered);
}

export function getDistribution(trades: Trade[]): {
  wins: number;
  losses: number;
  breakeven: number;
} {
  let wins = 0;
  let losses = 0;
  let breakeven = 0;

  for (const trade of trades) {
    const pnl = Number(trade.realizedPnlUsd);
    if (pnl > 0) wins++;
    else if (pnl < 0) losses++;
    else breakeven++;
  }

  return { wins, losses, breakeven };
}

