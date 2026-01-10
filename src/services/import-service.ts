import Papa from 'papaparse';
import type { Direction } from '@prisma/client';
import type { CreateTradeInput } from './trade-service';

export interface CsvMapping {
  symbol: string;
  date: string;
  openedAt?: string;
  closedAt?: string;
  direction?: string;
  entryPrice: string;
  exitPrice: string;
  quantity: string;
  realizedPnlUsd: string;
  floatingRunupUsd?: string;
  floatingDrawdownUsd?: string;
}

export type DateFormat = 'iso' | 'us' | 'eu';

export interface ParsedCsvRow {
  [key: string]: string;
}

export interface ImportPreview {
  headers: string[];
  rows: ParsedCsvRow[];
  totalRows: number;
  detectedDelimiter: string;
}

export interface ImportResult {
  trades: Omit<CreateTradeInput, 'userId'>[];
  errors: { row: number; message: string }[];
}

// Fixed mapping for the expected CSV format (DT, Symbol, Quantity, Entry, Exit, ProfitLoss)
export const FIXED_MAPPING: CsvMapping = {
  symbol: 'Symbol',
  date: 'DT',
  entryPrice: 'Entry',
  exitPrice: 'Exit',
  quantity: 'Quantity',
  realizedPnlUsd: 'ProfitLoss',
};

export function parseCsv(content: string): ImportPreview {
  // Detect delimiter (semicolon or comma)
  const firstLine = content.split('\n')[0];
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  const result = Papa.parse<ParsedCsvRow>(content, {
    header: true,
    skipEmptyLines: true,
    delimiter,
    transformHeader: (header) => header.trim(),
  });

  return {
    headers: result.meta.fields || [],
    rows: result.data.slice(0, 20), // Preview first 20 rows
    totalRows: result.data.length,
    detectedDelimiter: delimiter,
  };
}

export function parseCsvFull(content: string, delimiter: string = ';'): ParsedCsvRow[] {
  const result = Papa.parse<ParsedCsvRow>(content, {
    header: true,
    skipEmptyLines: true,
    delimiter,
    transformHeader: (header) => header.trim(),
  });

  return result.data;
}

function parseDate(value: string, format: DateFormat): Date | null {
  if (!value) return null;

  const trimmed = value.trim();

  // Try ISO format first (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
  if (format === 'iso' || trimmed.match(/^\d{4}-\d{2}-\d{2}/)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) return date;
  }

  // US format: MM/DD/YYYY or MM-DD-YYYY
  if (format === 'us') {
    const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
      const [, month, day, year] = match;
      const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      const date = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        timeMatch ? parseInt(timeMatch[1]) : 0,
        timeMatch ? parseInt(timeMatch[2]) : 0,
        timeMatch && timeMatch[3] ? parseInt(timeMatch[3]) : 0
      );
      if (!isNaN(date.getTime())) return date;
    }
  }

  // EU format: DD/MM/YYYY or DD-MM-YYYY
  if (format === 'eu') {
    const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      const date = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        timeMatch ? parseInt(timeMatch[1]) : 0,
        timeMatch ? parseInt(timeMatch[2]) : 0,
        timeMatch && timeMatch[3] ? parseInt(timeMatch[3]) : 0
      );
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Fallback: try native Date parsing
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) return date;

  return null;
}

function parseNumber(value: string): number | null {
  if (!value) return null;

  // Remove common formatting
  const cleaned = value
    .replace(/[,$€£]/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '.');

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function inferDirection(quantity: number): Direction {
  // If quantity is negative, it's SHORT
  if (quantity < 0) return 'SHORT';
  return 'LONG';
}

function parseDirection(value: string | undefined): Direction | null {
  if (!value) return null;

  const upper = value.toUpperCase().trim();

  if (['LONG', 'BUY', 'L', 'ACHAT', '1'].includes(upper)) return 'LONG';
  if (['SHORT', 'SELL', 'S', 'VENTE', '-1'].includes(upper)) return 'SHORT';

  return null;
}

export function detectDateFormat(rows: ParsedCsvRow[], dateColumn: string): DateFormat {
  for (const row of rows.slice(0, 10)) {
    const value = row[dateColumn];
    if (!value) continue;

    // Check for ISO format
    if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return 'iso';
    }

    // Check for ambiguous format (could be US or EU)
    const match = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
      const first = parseInt(match[1]);
      const second = parseInt(match[2]);

      // If first number > 12, it must be day (EU format)
      if (first > 12) return 'eu';
      // If second number > 12, it must be day (US format)
      if (second > 12) return 'us';
    }
  }

  // Default to ISO if can't determine
  return 'iso';
}

export function processImport(
  rows: ParsedCsvRow[],
  mapping: CsvMapping = FIXED_MAPPING,
  dateFormat: DateFormat = 'iso'
): ImportResult {
  const trades: Omit<CreateTradeInput, 'userId'>[] = [];
  const errors: { row: number; message: string }[] = [];

  // Track row index for generating unique timestamps when only date is provided
  let tradeIndexForDay = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 for 1-indexed and header row

    try {
      // Parse required fields
      const symbol = row[mapping.symbol]?.trim().toUpperCase();
      if (!symbol) {
        errors.push({ row: rowNum, message: 'Symbol manquant' });
        continue;
      }

      // Parse date - either from single date field or separate openedAt/closedAt
      let openedAt: Date | null = null;
      let closedAt: Date | null = null;

      if (mapping.date) {
        // Single date field - use it for both opened and closed
        const dateValue = row[mapping.date];
        const baseDate = parseDate(dateValue, dateFormat);
        
        if (!baseDate) {
          errors.push({ row: rowNum, message: 'Date invalide' });
          continue;
        }

        // Generate unique timestamps for trades on the same day
        const dateKey = baseDate.toISOString().split('T')[0];
        const tradeIndex = tradeIndexForDay.get(dateKey) || 0;
        tradeIndexForDay.set(dateKey, tradeIndex + 1);

        // Add seconds to make each trade unique
        openedAt = new Date(baseDate);
        openedAt.setHours(9, 0, tradeIndex); // Start at 9:00:00, increment seconds
        
        closedAt = new Date(baseDate);
        closedAt.setHours(9, 0, tradeIndex, 500); // 500ms later
      } else {
        // Separate openedAt and closedAt fields
        if (mapping.openedAt) {
          openedAt = parseDate(row[mapping.openedAt], dateFormat);
        }
        if (mapping.closedAt) {
          closedAt = parseDate(row[mapping.closedAt], dateFormat);
        }
      }

      if (!openedAt) {
        errors.push({ row: rowNum, message: 'Date d\'ouverture invalide' });
        continue;
      }

      if (!closedAt) {
        // If no close date, use same as open date
        closedAt = new Date(openedAt.getTime() + 1000);
      }

      const entryPrice = parseNumber(row[mapping.entryPrice]);
      if (entryPrice === null) {
        errors.push({ row: rowNum, message: 'Prix d\'entrée invalide' });
        continue;
      }

      const exitPrice = parseNumber(row[mapping.exitPrice]);
      if (exitPrice === null) {
        errors.push({ row: rowNum, message: 'Prix de sortie invalide' });
        continue;
      }

      const quantity = parseNumber(row[mapping.quantity]);
      if (quantity === null) {
        errors.push({ row: rowNum, message: 'Quantité invalide' });
        continue;
      }

      const realizedPnlUsd = parseNumber(row[mapping.realizedPnlUsd]);
      if (realizedPnlUsd === null) {
        errors.push({ row: rowNum, message: 'PnL invalide' });
        continue;
      }

      // Parse direction - from column or infer from quantity
      let direction: Direction;
      if (mapping.direction) {
        const parsedDir = parseDirection(row[mapping.direction]);
        direction = parsedDir || inferDirection(quantity);
      } else {
        direction = inferDirection(quantity);
      }

      // Parse optional fields
      const floatingRunupUsd = mapping.floatingRunupUsd
        ? parseNumber(row[mapping.floatingRunupUsd])
        : null;

      const floatingDrawdownUsd = mapping.floatingDrawdownUsd
        ? parseNumber(row[mapping.floatingDrawdownUsd])
        : null;

      trades.push({
        symbol,
        direction,
        openedAt,
        closedAt,
        entryPrice,
        exitPrice,
        quantity: Math.abs(quantity),
        realizedPnlUsd,
        floatingRunupUsd,
        floatingDrawdownUsd,
      });
    } catch (error) {
      errors.push({ row: rowNum, message: `Error: ${error}` });
    }
  }

  return { trades, errors };
}
