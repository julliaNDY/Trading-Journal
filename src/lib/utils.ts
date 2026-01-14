import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function formatDate(date: Date | string, locale: string = 'fr-FR'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function formatDateTime(date: Date | string, locale: string = 'fr-FR'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatTime(date: Date | string, locale: string = 'fr-FR'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function getDurationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

export function getDurationSeconds(start: Date, end: Date): number {
  const startTime = start.getTime();
  const endTime = end.getTime();
  const durationMs = endTime - startTime;
  const durationSeconds = Math.round(durationMs / 1000);
  
  // #region agent log
  if (durationSeconds < 0 || durationSeconds === 0) {
    fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/lib/utils.ts:68',message:'getDurationSeconds - invalid duration detected',data:{start:start.toISOString(),end:end.toISOString(),startTime,endTime,durationMs,durationSeconds,isNegative:durationSeconds<0,isZero:durationSeconds===0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  }
  // #endregion
  
  return durationSeconds;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

export function formatDurationWithSeconds(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    if (minutes === 0 && seconds === 0) {
      return `${hours}h`;
    }
    if (seconds === 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  
  if (seconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

// Round-trip fees per contract by symbol
export const FEES_PER_CONTRACT: Record<string, number> = {
  'NQ': 4.58,
  'MNQ': 1.74,
  'ES': 4.58,
  'MES': 1.74,
};

/**
 * Calculate round-trip fees for a trade based on symbol and quantity
 * @param symbol - The trading symbol (e.g., NQ, MNQ, ES, MES)
 * @param quantity - Number of contracts traded
 * @returns Total fees in USD
 */
export function calculateTradeFees(symbol: string, quantity: number): number {
  // Normalize symbol (remove any suffix like /contracts, etc.)
  const normalizedSymbol = symbol.toUpperCase().trim().split(/[^A-Z]/)[0];
  
  const feePerContract = FEES_PER_CONTRACT[normalizedSymbol];
  
  if (feePerContract === undefined) {
    return 0; // Unknown symbol, no fees calculated
  }
  
  return feePerContract * Math.abs(quantity);
}

/**
 * Calculate gross PnL from net PnL by adding back fees
 * @param netPnl - Net PnL (after fees)
 * @param fees - Total fees
 * @returns Gross PnL (before fees)
 */
export function calculateGrossPnl(netPnl: number, fees: number): number {
  return netPnl + fees;
}

