/**
 * Binance Broker Provider
 * 
 * Implementation of the BrokerProvider interface for Binance API.
 * 
 * Binance API Documentation: https://binance-docs.github.io/apidocs/spot/en/
 * 
 * Key endpoints used:
 * - GET /api/v3/account - Get account information
 * - GET /api/v3/myTrades - Get trade history (spot)
 * - GET /fapi/v1/userTrades - Get trade history (futures)
 */

import crypto from 'crypto';
import { BrokerType, Direction } from '@prisma/client';
import {
  BrokerProvider,
  BrokerCredentials,
  BrokerAccount,
  BrokerTrade,
  AuthResult,
  BrokerAuthError,
  BrokerApiError,
  BrokerRateLimitError,
} from './types';

// ============================================================================
// BINANCE API TYPES
// ============================================================================

interface BinanceAccount {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: number;
  accountType: string;
  balances: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
  permissions: string[];
}

interface BinanceTrade {
  symbol: string;
  id: number;
  orderId: number;
  orderListId: number;
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
  isMaker: boolean;
  isBestMatch: boolean;
}

interface BinanceFuturesTrade {
  buyer: boolean;
  commission: string;
  commissionAsset: string;
  id: number;
  maker: boolean;
  orderId: number;
  price: string;
  qty: string;
  quoteQty: string;
  realizedPnl: string;
  side: 'BUY' | 'SELL';
  positionSide: 'BOTH' | 'LONG' | 'SHORT';
  symbol: string;
  time: number;
}

interface BinanceCredentials extends BrokerCredentials {
  accountType?: 'spot' | 'futures';
}

// ============================================================================
// BINANCE PROVIDER
// ============================================================================

const BINANCE_API_BASE = {
  spot: 'https://api.binance.com',
  futures: 'https://fapi.binance.com',
};

export class BinanceProvider implements BrokerProvider {
  readonly brokerType = 'BINANCE' as BrokerType;
  
  private accountType: 'spot' | 'futures';
  
  constructor(accountType: 'spot' | 'futures' = 'spot') {
    this.accountType = accountType;
  }
  
  private get baseUrl(): string {
    return BINANCE_API_BASE[this.accountType];
  }
  
  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================
  
  async authenticate(credentials: BrokerCredentials): Promise<AuthResult> {
    const binanceCredentials = credentials as BinanceCredentials;
    
    // Use the specified account type or default
    if (binanceCredentials.accountType) {
      this.accountType = binanceCredentials.accountType;
    }
    
    // Validate credentials by fetching account info
    try {
      const account = await this.apiRequest<BinanceAccount>(
        credentials.apiKey,
        credentials.apiSecret,
        '/api/v3/account'
      );
      
      // Binance API keys don't expire (unless manually revoked)
      return {
        accessToken: credentials.apiKey, // Store API key as "access token"
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        userId: account.accountType,
      };
    } catch (error) {
      if (error instanceof BrokerAuthError || error instanceof BrokerApiError) {
        throw error;
      }
      throw new BrokerAuthError(
        `Failed to authenticate with Binance: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  // ==========================================================================
  // ACCOUNTS
  // ==========================================================================
  
  async getAccounts(accessToken: string): Promise<BrokerAccount[]> {
    // Note: accessToken is actually the API key (we store it as accessToken)
    // We need the API secret too, but we don't have it here
    // This is a limitation of the current architecture
    // For now, we'll throw an error - this method should be called during initial auth only
    throw new Error('getAccounts should only be called during initial authentication');
  }
  
  private async getAccount(apiKey: string, apiSecret: string): Promise<BrokerAccount> {
    const account = await this.apiRequest<BinanceAccount>(
      apiKey,
      apiSecret,
      '/api/v3/account'
    );
    
    // Calculate total balance in USDT equivalent
    const usdtBalance = account.balances.find(b => b.asset === 'USDT');
    const balance = usdtBalance ? parseFloat(usdtBalance.free) + parseFloat(usdtBalance.locked) : 0;
    
    return {
      id: account.accountType,
      name: `Binance ${this.accountType === 'spot' ? 'Spot' : 'Futures'}`,
      balance,
      currency: 'USDT',
    };
  }
  
  // ==========================================================================
  // TRADES
  // ==========================================================================
  
  async getTrades(
    accessToken: string,
    accountId: string,
    since?: Date
  ): Promise<BrokerTrade[]> {
    // Note: We need both API key and secret for requests
    // accessToken is the API key, but we don't have the secret
    // This is a limitation - we'll need to refactor to pass credentials differently
    
    throw new Error('getTrades requires API secret - architecture needs refactoring');
  }
  
  /**
   * Internal method to get trades with full credentials
   * This is what should be called from the broker sync service
   */
  async getTradesWithCredentials(
    apiKey: string,
    apiSecret: string,
    since?: Date
  ): Promise<BrokerTrade[]> {
    if (this.accountType === 'futures') {
      return this.getFuturesTrades(apiKey, apiSecret, since);
    } else {
      return this.getSpotTrades(apiKey, apiSecret, since);
    }
  }
  
  /**
   * Get spot trading history
   */
  private async getSpotTrades(
    apiKey: string,
    apiSecret: string,
    since?: Date
  ): Promise<BrokerTrade[]> {
    // First, get all trading symbols from account
    const account = await this.apiRequest<BinanceAccount>(
      apiKey,
      apiSecret,
      '/api/v3/account'
    );
    
    // Get symbols with non-zero balances
    const activeAssets = account.balances
      .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map(b => b.asset);
    
    // Common quote assets
    const quoteAssets = ['USDT', 'BUSD', 'BTC', 'ETH', 'BNB'];
    
    // Generate trading pairs (e.g., BTCUSDT, ETHUSDT)
    const symbols: string[] = [];
    for (const base of activeAssets) {
      for (const quote of quoteAssets) {
        if (base !== quote) {
          symbols.push(`${base}${quote}`);
        }
      }
    }
    
    // Fetch trades for each symbol
    const allTrades: BinanceTrade[] = [];
    for (const symbol of symbols) {
      try {
        const trades = await this.getSymbolTrades(apiKey, apiSecret, symbol, since);
        allTrades.push(...trades);
      } catch (error) {
        // Symbol might not exist or have no trades - skip
        continue;
      }
    }
    
    // Reconstruct trades from fills
    const reconstructedTrades = this.reconstructSpotTrades(allTrades);
    
    return reconstructedTrades;
  }
  
  /**
   * Get trades for a specific symbol
   */
  private async getSymbolTrades(
    apiKey: string,
    apiSecret: string,
    symbol: string,
    since?: Date
  ): Promise<BinanceTrade[]> {
    const params: Record<string, string> = {
      symbol,
      limit: '1000',
    };
    
    if (since) {
      params.startTime = since.getTime().toString();
    }
    
    return this.apiRequest<BinanceTrade[]>(
      apiKey,
      apiSecret,
      '/api/v3/myTrades',
      params
    );
  }
  
  /**
   * Get futures trading history
   */
  private async getFuturesTrades(
    apiKey: string,
    apiSecret: string,
    since?: Date
  ): Promise<BrokerTrade[]> {
    // For futures, we need to query each symbol separately
    // This is a simplified implementation - in production, you'd want to:
    // 1. Get list of all traded symbols from account
    // 2. Query each symbol
    // 3. Aggregate results
    
    // For now, we'll query common futures symbols
    const commonSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
    
    const allTrades: BinanceFuturesTrade[] = [];
    for (const symbol of commonSymbols) {
      try {
        const params: Record<string, string> = {
          symbol,
          limit: '1000',
        };
        
        if (since) {
          params.startTime = since.getTime().toString();
        }
        
        const trades = await this.apiRequest<BinanceFuturesTrade[]>(
          apiKey,
          apiSecret,
          '/fapi/v1/userTrades',
          params
        );
        
        allTrades.push(...trades);
      } catch (error) {
        // Symbol might not have trades - skip
        continue;
      }
    }
    
    // Convert futures trades to our format
    return this.reconstructFuturesTrades(allTrades);
  }
  
  /**
   * Reconstructs trades from Binance spot fills.
   * 
   * Binance returns individual fills, not trades. We need to match buy/sell pairs
   * to create complete round-trip trades.
   */
  private reconstructSpotTrades(fills: BinanceTrade[]): BrokerTrade[] {
    const trades: BrokerTrade[] = [];
    
    // Group fills by symbol
    const fillsBySymbol = new Map<string, BinanceTrade[]>();
    for (const fill of fills) {
      const existing = fillsBySymbol.get(fill.symbol) || [];
      existing.push(fill);
      fillsBySymbol.set(fill.symbol, existing);
    }
    
    // Process each symbol's fills
    for (const [symbol, symbolFills] of fillsBySymbol) {
      // Sort by time (oldest first)
      symbolFills.sort((a, b) => a.time - b.time);
      
      // Track position and match fills
      let position = 0;
      const entryFills: BinanceTrade[] = [];
      
      for (const fill of symbolFills) {
        const qty = parseFloat(fill.qty);
        const qtyChange = fill.isBuyer ? qty : -qty;
        const previousPosition = position;
        position += qtyChange;
        
        // Check if this fill is opening or closing
        const isOpening =
          (previousPosition >= 0 && qtyChange > 0) ||
          (previousPosition <= 0 && qtyChange < 0);
        
        if (isOpening) {
          // Opening fill
          entryFills.push(fill);
        } else {
          // Closing fill - create trade
          if (entryFills.length > 0) {
            const trade = this.createTradeFromSpotFills(symbol, entryFills, fill);
            if (trade) {
              trades.push(trade);
            }
            
            // Clear entry fills if position is flat
            if (position === 0) {
              entryFills.length = 0;
            }
          }
        }
      }
    }
    
    return trades;
  }
  
  private createTradeFromSpotFills(
    symbol: string,
    entryFills: BinanceTrade[],
    exitFill: BinanceTrade
  ): BrokerTrade | null {
    if (entryFills.length === 0) return null;
    
    // Calculate weighted average entry price
    const totalQty = entryFills.reduce(
      (sum, fill) => sum + parseFloat(fill.qty),
      0
    );
    const weightedEntryPrice = entryFills.reduce(
      (sum, fill) =>
        sum + parseFloat(fill.price) * parseFloat(fill.qty),
      0
    ) / totalQty;
    
    const direction: Direction = entryFills[0].isBuyer ? 'LONG' : 'SHORT';
    const entryPrice = weightedEntryPrice;
    const exitPrice = parseFloat(exitFill.price);
    const quantity = Math.min(totalQty, parseFloat(exitFill.qty));
    
    // Calculate PnL
    const priceDiff = direction === 'LONG' 
      ? exitPrice - entryPrice 
      : entryPrice - exitPrice;
    const realizedPnl = priceDiff * quantity;
    
    // Calculate total commission (convert to USDT if needed)
    const totalCommission = this.calculateTotalCommission(entryFills, exitFill);
    
    const firstEntry = entryFills[0];
    
    return {
      brokerTradeId: `${firstEntry.id}-${exitFill.id}`,
      symbol,
      direction,
      openedAt: new Date(firstEntry.time),
      closedAt: new Date(exitFill.time),
      entryPrice,
      exitPrice,
      quantity,
      realizedPnl: realizedPnl - totalCommission, // Subtract commission from PnL
      commission: totalCommission,
      metadata: {
        entryFillIds: entryFills.map(f => f.id),
        exitFillId: exitFill.id,
        isMaker: firstEntry.isMaker,
      },
    };
  }
  
  /**
   * Reconstructs trades from Binance futures fills.
   * Futures trades already include PnL, making reconstruction simpler.
   */
  private reconstructFuturesTrades(fills: BinanceFuturesTrade[]): BrokerTrade[] {
    const trades: BrokerTrade[] = [];
    
    // Group fills by symbol
    const fillsBySymbol = new Map<string, BinanceFuturesTrade[]>();
    for (const fill of fills) {
      const existing = fillsBySymbol.get(fill.symbol) || [];
      existing.push(fill);
      fillsBySymbol.set(fill.symbol, existing);
    }
    
    // Process each symbol
    for (const [symbol, symbolFills] of fillsBySymbol) {
      // Sort by time
      symbolFills.sort((a, b) => a.time - b.time);
      
      // Track position
      let position = 0;
      const entryFills: BinanceFuturesTrade[] = [];
      
      for (const fill of symbolFills) {
        const qty = parseFloat(fill.qty);
        const qtyChange = fill.side === 'BUY' ? qty : -qty;
        const previousPosition = position;
        position += qtyChange;
        
        const isOpening =
          (previousPosition >= 0 && qtyChange > 0) ||
          (previousPosition <= 0 && qtyChange < 0);
        
        if (isOpening) {
          entryFills.push(fill);
        } else {
          if (entryFills.length > 0) {
            const trade = this.createTradeFromFuturesFills(symbol, entryFills, fill);
            if (trade) {
              trades.push(trade);
            }
            
            if (position === 0) {
              entryFills.length = 0;
            }
          }
        }
      }
    }
    
    return trades;
  }
  
  private createTradeFromFuturesFills(
    symbol: string,
    entryFills: BinanceFuturesTrade[],
    exitFill: BinanceFuturesTrade
  ): BrokerTrade | null {
    if (entryFills.length === 0) return null;
    
    // Calculate weighted average entry price
    const totalQty = entryFills.reduce(
      (sum, fill) => sum + parseFloat(fill.qty),
      0
    );
    const weightedEntryPrice = entryFills.reduce(
      (sum, fill) =>
        sum + parseFloat(fill.price) * parseFloat(fill.qty),
      0
    ) / totalQty;
    
    const direction: Direction = entryFills[0].side === 'BUY' ? 'LONG' : 'SHORT';
    const entryPrice = weightedEntryPrice;
    const exitPrice = parseFloat(exitFill.price);
    const quantity = Math.min(totalQty, parseFloat(exitFill.qty));
    
    // Use Binance's realized PnL (more accurate for futures)
    const realizedPnl = parseFloat(exitFill.realizedPnl);
    
    // Calculate total commission
    const totalCommission = entryFills.reduce(
      (sum, fill) => sum + parseFloat(fill.commission),
      0
    ) + parseFloat(exitFill.commission);
    
    const firstEntry = entryFills[0];
    
    return {
      brokerTradeId: `${firstEntry.id}-${exitFill.id}`,
      symbol,
      direction,
      openedAt: new Date(firstEntry.time),
      closedAt: new Date(exitFill.time),
      entryPrice,
      exitPrice,
      quantity,
      realizedPnl,
      commission: totalCommission,
      metadata: {
        entryFillIds: entryFills.map(f => f.id),
        exitFillId: exitFill.id,
        positionSide: exitFill.positionSide,
      },
    };
  }
  
  /**
   * Calculate total commission in USDT
   */
  private calculateTotalCommission(
    entryFills: BinanceTrade[],
    exitFill: BinanceTrade
  ): number {
    // Sum all commissions
    // Note: Commission might be in different assets (BNB, USDT, etc.)
    // For simplicity, we'll assume USDT or convert at 1:1 ratio
    // In production, you'd want to convert to USDT using current prices
    
    const totalCommission = entryFills.reduce(
      (sum, fill) => sum + parseFloat(fill.commission),
      0
    ) + parseFloat(exitFill.commission);
    
    return totalCommission;
  }
  
  // ==========================================================================
  // API HELPERS
  // ==========================================================================
  
  /**
   * Sign request with HMAC SHA256
   */
  private signRequest(queryString: string, apiSecret: string): string {
    return crypto
      .createHmac('sha256', apiSecret)
      .update(queryString)
      .digest('hex');
  }
  
  /**
   * Make authenticated API request to Binance
   */
  private async apiRequest<T>(
    apiKey: string,
    apiSecret: string,
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    // Add timestamp
    const timestamp = Date.now();
    const queryParams = {
      ...params,
      timestamp: timestamp.toString(),
    };
    
    // Create query string
    const queryString = new URLSearchParams(queryParams).toString();
    
    // Sign request
    const signature = this.signRequest(queryString, apiSecret);
    
    // Build URL
    const url = `${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`;
    
    // Make request
    const response = await fetch(url, {
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/json',
      },
    });
    
    // Check rate limit headers
    const rateLimitUsed = response.headers.get('X-MBX-USED-WEIGHT-1M');
    const orderCount = response.headers.get('X-MBX-ORDER-COUNT-1M');
    
    if (rateLimitUsed && parseInt(rateLimitUsed) > 1000) {
      console.warn(`[Binance] Rate limit warning: ${rateLimitUsed}/1200 weight used`);
    }
    
    // Handle errors
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new BrokerAuthError('Binance API key invalid or unauthorized');
      }
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        throw new BrokerRateLimitError(
          'Binance rate limit exceeded',
          retryAfter * 1000
        );
      }
      
      const errorText = await response.text();
      let errorMessage = `Binance API error: ${errorText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = `Binance API error: ${errorJson.msg || errorText}`;
      } catch {
        // Not JSON, use text
      }
      
      throw new BrokerApiError(errorMessage, response.status);
    }
    
    return response.json();
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createBinanceProvider(
  accountType: 'spot' | 'futures' = 'spot'
): BinanceProvider {
  return new BinanceProvider(accountType);
}
