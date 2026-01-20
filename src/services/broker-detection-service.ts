import type { CsvMapping } from './import-service';

export interface BrokerPattern {
  brokerName: string;
  displayName: string;
  // Column patterns to match (case-insensitive)
  requiredColumns: string[];
  // Optional columns that increase confidence
  optionalColumns?: string[];
  // Mapping for this broker
  mapping: CsvMapping;
}

/**
 * Broker patterns for auto-detection
 * Each broker has characteristic column names
 */
export const BROKER_PATTERNS: BrokerPattern[] = [
  // Tradovate
  {
    brokerName: 'tradovate',
    displayName: 'Tradovate',
    requiredColumns: ['contract', 'buy/sell', 'qty', 'price', 'p/l'],
    optionalColumns: ['time', 'exec id'],
    mapping: {
      symbol: 'Contract',
      date: 'Time',
      direction: 'Buy/Sell',
      entryPrice: 'Price',
      exitPrice: 'Price',
      quantity: 'Qty',
      realizedPnlUsd: 'P/L',
    },
  },
  // Interactive Brokers
  {
    brokerName: 'ibkr',
    displayName: 'Interactive Brokers (IBKR)',
    requiredColumns: ['symbol', 'date/time', 'quantity', 'proceeds', 'realized p/l'],
    optionalColumns: ['comm/fee', 'basis'],
    mapping: {
      symbol: 'Symbol',
      date: 'Date/Time',
      entryPrice: 'T. Price',
      exitPrice: 'T. Price',
      quantity: 'Quantity',
      realizedPnlUsd: 'Realized P/L',
    },
  },
  // MetaTrader 4
  {
    brokerName: 'mt4',
    displayName: 'MetaTrader 4',
    requiredColumns: ['ticket', 'symbol', 'type', 'volume', 'profit'],
    optionalColumns: ['open time', 'close time', 'open price', 'close price'],
    mapping: {
      symbol: 'Symbol',
      date: 'Open Time',
      openedAt: 'Open Time',
      closedAt: 'Close Time',
      direction: 'Type',
      entryPrice: 'Open Price',
      exitPrice: 'Close Price',
      quantity: 'Volume',
      realizedPnlUsd: 'Profit',
    },
  },
  // MetaTrader 5
  {
    brokerName: 'mt5',
    displayName: 'MetaTrader 5',
    requiredColumns: ['deal', 'symbol', 'type', 'volume', 'profit'],
    optionalColumns: ['time', 'price', 'commission', 'swap'],
    mapping: {
      symbol: 'Symbol',
      date: 'Time',
      direction: 'Type',
      entryPrice: 'Price',
      exitPrice: 'Price',
      quantity: 'Volume',
      realizedPnlUsd: 'Profit',
    },
  },
  // NinjaTrader
  {
    brokerName: 'ninjatrader',
    displayName: 'NinjaTrader',
    requiredColumns: ['instrument', 'quantity', 'avg fill price', 'time', 'rate'],
    optionalColumns: ['commission', 'account', 'order id', 'name'],
    mapping: {
      symbol: 'Instrument',
      date: 'Time',
      openedAt: 'Time',
      closedAt: 'Time',
      direction: 'Rate',
      entryPrice: 'Avg fill price',
      exitPrice: 'Avg fill price',
      quantity: 'Quantity',
      realizedPnlUsd: 'Profit',
    },
  },
  // TradeStation
  {
    brokerName: 'tradestation',
    displayName: 'TradeStation',
    requiredColumns: ['symbol', 'qty', 'price', 'net p&l'],
    optionalColumns: ['time', 'side'],
    mapping: {
      symbol: 'Symbol',
      date: 'Time',
      direction: 'Side',
      entryPrice: 'Price',
      exitPrice: 'Price',
      quantity: 'Qty',
      realizedPnlUsd: 'Net P&L',
    },
  },
  // TD Ameritrade / Thinkorswim
  {
    brokerName: 'thinkorswim',
    displayName: 'Thinkorswim (TD Ameritrade)',
    requiredColumns: ['symbol', 'qty', 'exec time', 'price', 'net price'],
    optionalColumns: ['side', 'pos effect'],
    mapping: {
      symbol: 'Symbol',
      date: 'Exec Time',
      direction: 'Side',
      entryPrice: 'Price',
      exitPrice: 'Price',
      quantity: 'Qty',
      realizedPnlUsd: 'Net Price',
    },
  },
  // E*TRADE
  {
    brokerName: 'etrade',
    displayName: 'E*TRADE',
    requiredColumns: ['symbol', 'quantity', 'price', 'amount'],
    optionalColumns: ['transaction date', 'action'],
    mapping: {
      symbol: 'Symbol',
      date: 'Transaction Date',
      direction: 'Action',
      entryPrice: 'Price',
      exitPrice: 'Price',
      quantity: 'Quantity',
      realizedPnlUsd: 'Amount',
    },
  },
  // Robinhood
  {
    brokerName: 'robinhood',
    displayName: 'Robinhood',
    requiredColumns: ['symbol', 'quantity', 'price', 'proceeds'],
    optionalColumns: ['trans date', 'side'],
    mapping: {
      symbol: 'Symbol',
      date: 'Trans Date',
      direction: 'Side',
      entryPrice: 'Price',
      exitPrice: 'Price',
      quantity: 'Quantity',
      realizedPnlUsd: 'Proceeds',
    },
  },
  // Webull
  {
    brokerName: 'webull',
    displayName: 'Webull',
    requiredColumns: ['symbol', 'quantity', 'filled price', 'profit/loss'],
    optionalColumns: ['time', 'side'],
    mapping: {
      symbol: 'Symbol',
      date: 'Time',
      direction: 'Side',
      entryPrice: 'Filled Price',
      exitPrice: 'Filled Price',
      quantity: 'Quantity',
      realizedPnlUsd: 'Profit/Loss',
    },
  },
  // Binance (Crypto)
  {
    brokerName: 'binance',
    displayName: 'Binance',
    requiredColumns: ['symbol', 'side', 'executed', 'price', 'realized profit'],
    optionalColumns: ['time', 'fee'],
    mapping: {
      symbol: 'Symbol',
      date: 'Time',
      direction: 'Side',
      entryPrice: 'Price',
      exitPrice: 'Price',
      quantity: 'Executed',
      realizedPnlUsd: 'Realized Profit',
    },
  },
  // Coinbase (Crypto)
  {
    brokerName: 'coinbase',
    displayName: 'Coinbase',
    requiredColumns: ['asset', 'quantity', 'price', 'total'],
    optionalColumns: ['timestamp', 'transaction type'],
    mapping: {
      symbol: 'Asset',
      date: 'Timestamp',
      direction: 'Transaction Type',
      entryPrice: 'Price',
      exitPrice: 'Price',
      quantity: 'Quantity',
      realizedPnlUsd: 'Total',
    },
  },
  // Kraken (Crypto)
  {
    brokerName: 'kraken',
    displayName: 'Kraken',
    requiredColumns: ['pair', 'type', 'vol', 'price', 'cost'],
    optionalColumns: ['time', 'fee'],
    mapping: {
      symbol: 'Pair',
      date: 'Time',
      direction: 'Type',
      entryPrice: 'Price',
      exitPrice: 'Price',
      quantity: 'Vol',
      realizedPnlUsd: 'Cost',
    },
  },
  // Bybit (Crypto)
  {
    brokerName: 'bybit',
    displayName: 'Bybit',
    requiredColumns: ['symbol', 'side', 'qty', 'price', 'closed pnl'],
    optionalColumns: ['time', 'order type'],
    mapping: {
      symbol: 'Symbol',
      date: 'Time',
      direction: 'Side',
      entryPrice: 'Price',
      exitPrice: 'Price',
      quantity: 'Qty',
      realizedPnlUsd: 'Closed PnL',
    },
  },
  // Apex Trader Funding (Rithmic)
  {
    brokerName: 'apex_rithmic',
    displayName: 'Apex Trader Funding (Rithmic)',
    requiredColumns: ['date', 'time', 'symbol', 'side', 'quantity', 'price'],
    optionalColumns: ['commission', 'net p/l', 'account', 'order id', 'execution id'],
    mapping: {
      symbol: 'Symbol',
      date: 'Date',
      openedAt: 'Time',
      closedAt: 'Time',
      direction: 'Side',
      entryPrice: 'Price',
      exitPrice: 'Price',
      quantity: 'Quantity',
      realizedPnlUsd: 'Net P/L',
    },
  },
  // Generic format (fallback)
  {
    brokerName: 'generic',
    displayName: 'Format générique',
    requiredColumns: ['symbol', 'quantity', 'entry', 'exit', 'pnl'],
    optionalColumns: ['date', 'direction'],
    mapping: {
      symbol: 'Symbol',
      date: 'Date',
      direction: 'Direction',
      entryPrice: 'Entry',
      exitPrice: 'Exit',
      quantity: 'Quantity',
      realizedPnlUsd: 'PnL',
    },
  },
];

/**
 * Normalize column name for comparison
 */
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[_\s-]+/g, ' ') // Replace underscores, spaces, dashes with single space
    .replace(/[^\w\s]/g, ''); // Remove special characters except word chars and spaces
}

/**
 * Check if a column matches a pattern
 */
function columnMatches(csvColumn: string, patternColumn: string): boolean {
  const normalized = normalizeColumnName(csvColumn);
  const pattern = normalizeColumnName(patternColumn);
  
  // Exact match
  if (normalized === pattern) return true;
  
  // Contains match (for partial matches)
  if (normalized.includes(pattern) || pattern.includes(normalized)) return true;
  
  return false;
}

/**
 * Calculate match score for a broker pattern
 */
function calculateMatchScore(csvHeaders: string[], pattern: BrokerPattern): number {
  let score = 0;
  let requiredMatches = 0;
  
  // Check required columns (must match all)
  for (const required of pattern.requiredColumns) {
    const found = csvHeaders.some((header) => columnMatches(header, required));
    if (found) {
      requiredMatches++;
      score += 10; // High weight for required columns
    }
  }
  
  // If not all required columns match, return 0
  if (requiredMatches < pattern.requiredColumns.length) {
    return 0;
  }
  
  // Check optional columns (bonus points)
  if (pattern.optionalColumns) {
    for (const optional of pattern.optionalColumns) {
      const found = csvHeaders.some((header) => columnMatches(header, optional));
      if (found) {
        score += 2; // Lower weight for optional columns
      }
    }
  }
  
  return score;
}

/**
 * Detect broker from CSV headers
 * Returns the best matching broker pattern or null
 */
export function detectBrokerFromHeaders(csvHeaders: string[]): BrokerPattern | null {
  let bestMatch: BrokerPattern | null = null;
  let bestScore = 0;
  
  for (const pattern of BROKER_PATTERNS) {
    const score = calculateMatchScore(csvHeaders, pattern);
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = pattern;
    }
  }
  
  // Require minimum score to avoid false positives
  // Skip generic pattern unless it's the only match
  if (bestScore >= 10 && bestMatch && bestMatch.brokerName !== 'generic') {
    return bestMatch;
  }
  
  return null;
}

/**
 * Get all supported brokers
 */
export function getSupportedBrokers(): Array<{ brokerName: string; displayName: string }> {
  return BROKER_PATTERNS.map((p) => ({
    brokerName: p.brokerName,
    displayName: p.displayName,
  }));
}

/**
 * Get broker pattern by name
 */
export function getBrokerPattern(brokerName: string): BrokerPattern | null {
  return BROKER_PATTERNS.find((p) => p.brokerName === brokerName) || null;
}
