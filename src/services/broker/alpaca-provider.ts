/**
 * Alpaca Broker Provider
 * 
 * Implementation of the BrokerProvider interface for Alpaca API.
 * 
 * Alpaca API Documentation: https://alpaca.markets/docs/
 * 
 * Key endpoints used:
 * - GET /v2/account - Get account information
 * - GET /v2/orders - Get order history
 * - GET /v2/account/activities - Get trade fills
 */

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
// ALPACA API TYPES
// ============================================================================

interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  cash: string;
  portfolio_value: string;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  transfers_blocked: boolean;
  account_blocked: boolean;
  created_at: string;
  trade_suspended_by_user: boolean;
  multiplier: string;
  shorting_enabled: boolean;
  equity: string;
  last_equity: string;
  long_market_value: string;
  short_market_value: string;
  initial_margin: string;
  maintenance_margin: string;
  last_maintenance_margin: string;
  sma: string;
  daytrade_count: number;
}

interface AlpacaOrder {
  id: string;
  client_order_id: string;
  created_at: string;
  updated_at: string;
  submitted_at: string;
  filled_at: string | null;
  expired_at: string | null;
  canceled_at: string | null;
  failed_at: string | null;
  replaced_at: string | null;
  replaced_by: string | null;
  replaces: string | null;
  asset_id: string;
  symbol: string;
  asset_class: string;
  notional: string | null;
  qty: string;
  filled_qty: string;
  filled_avg_price: string | null;
  order_class: string;
  order_type: string;
  type: string;
  side: 'buy' | 'sell';
  time_in_force: string;
  limit_price: string | null;
  stop_price: string | null;
  status: string;
  extended_hours: boolean;
  legs: AlpacaOrder[] | null;
  trail_percent: string | null;
  trail_price: string | null;
  hwm: string | null;
  commission: number;
}

interface AlpacaActivity {
  id: string;
  account_id: string;
  activity_type: 'FILL';
  transaction_time: string;
  type: 'fill' | 'partial_fill';
  price: string;
  qty: string;
  side: 'buy' | 'sell';
  symbol: string;
  leaves_qty: string;
  order_id: string;
  cum_qty: string;
  order_status: string;
}

interface AlpacaCredentials extends BrokerCredentials {
  environment?: 'paper' | 'live';
}

// ============================================================================
// ALPACA PROVIDER
// ============================================================================

const ALPACA_API_BASE = {
  paper: 'https://paper-api.alpaca.markets',
  live: 'https://api.alpaca.markets',
};

export class AlpacaProvider implements BrokerProvider {
  readonly brokerType = 'ALPACA' as BrokerType; // Will need to add to Prisma enum
  
  private environment: 'paper' | 'live';
  
  constructor(environment: 'paper' | 'live' = 'live') {
    this.environment = environment;
  }
  
  private get baseUrl(): string {
    return ALPACA_API_BASE[this.environment];
  }
  
  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================
  
  async authenticate(credentials: BrokerCredentials): Promise<AuthResult> {
    const alpacaCredentials = credentials as AlpacaCredentials;
    
    // Use the specified environment or default
    if (alpacaCredentials.environment) {
      this.environment = alpacaCredentials.environment;
    }
    
    // Validate credentials by fetching account info
    try {
      const account = await this.apiRequest<AlpacaAccount>(
        credentials.apiKey,
        credentials.apiSecret,
        '/v2/account'
      );
      
      // Store both API key and secret in accessToken as JSON
      // This is necessary because Alpaca requires both for every request
      const accessToken = JSON.stringify({
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
        environment: this.environment,
      });
      
      // Alpaca API keys don't expire
      return {
        accessToken,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        userId: account.id,
      };
    } catch (error) {
      if (
        error instanceof BrokerAuthError || 
        error instanceof BrokerApiError ||
        error instanceof BrokerRateLimitError
      ) {
        throw error;
      }
      throw new BrokerAuthError(
        `Failed to authenticate with Alpaca: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  // ==========================================================================
  // ACCOUNTS
  // ==========================================================================
  
  async getAccounts(accessToken: string): Promise<BrokerAccount[]> {
    // Parse credentials from accessToken
    const { apiKey, apiSecret, environment } = this.parseAccessToken(accessToken);
    
    // Update environment if specified
    if (environment) {
      this.environment = environment;
    }
    
    const account = await this.apiRequest<AlpacaAccount>(
      apiKey,
      apiSecret,
      '/v2/account'
    );
    
    return [{
      id: account.account_number,
      name: `Alpaca ${account.account_number} (${this.environment})`,
      balance: parseFloat(account.equity),
      currency: account.currency,
    }];
  }
  
  // ==========================================================================
  // TRADES
  // ==========================================================================
  
  async getTrades(
    accessToken: string,
    accountId: string,
    since?: Date
  ): Promise<BrokerTrade[]> {
    // Parse credentials from accessToken
    const { apiKey, apiSecret, environment } = this.parseAccessToken(accessToken);
    
    // Update environment if specified
    if (environment) {
      this.environment = environment;
    }
    
    return this.getTradesWithCredentials(apiKey, apiSecret, since);
  }
  
  /**
   * Internal method to get trades with full credentials
   */
  private async getTradesWithCredentials(
    apiKey: string,
    apiSecret: string,
    since?: Date
  ): Promise<BrokerTrade[]> {
    // Get filled orders
    const params = new URLSearchParams({
      status: 'closed',
      limit: '500',
      direction: 'desc',
    });
    
    if (since) {
      params.append('after', since.toISOString());
    }
    
    const orders = await this.apiRequest<AlpacaOrder[]>(
      apiKey,
      apiSecret,
      `/v2/orders?${params.toString()}`
    );
    
    // Filter to only filled orders
    const filledOrders = orders.filter(
      order => order.status === 'filled' && order.filled_at
    );
    
    // Reconstruct trades from orders
    const trades = this.reconstructTrades(filledOrders);
    
    return trades;
  }
  
  /**
   * Reconstructs trades from Alpaca orders.
   * 
   * Alpaca returns orders, not trades. We need to match buy/sell pairs
   * to create complete round-trip trades.
   */
  private reconstructTrades(orders: AlpacaOrder[]): BrokerTrade[] {
    const trades: BrokerTrade[] = [];
    
    // Group orders by symbol
    const ordersBySymbol = new Map<string, AlpacaOrder[]>();
    for (const order of orders) {
      const existing = ordersBySymbol.get(order.symbol) || [];
      existing.push(order);
      ordersBySymbol.set(order.symbol, existing);
    }
    
    // Process each symbol's orders
    for (const [symbol, symbolOrders] of ordersBySymbol) {
      // Sort by filled_at (oldest first)
      symbolOrders.sort((a, b) => {
        const timeA = new Date(a.filled_at!).getTime();
        const timeB = new Date(b.filled_at!).getTime();
        return timeA - timeB;
      });
      
      // Track position and match orders
      let position = 0;
      const entryOrders: AlpacaOrder[] = [];
      
      for (const order of symbolOrders) {
        const qty = parseFloat(order.filled_qty);
        const qtyChange = order.side === 'buy' ? qty : -qty;
        const previousPosition = position;
        position += qtyChange;
        
        // Check if this order is opening or closing
        const isOpening =
          (previousPosition >= 0 && qtyChange > 0) ||
          (previousPosition <= 0 && qtyChange < 0);
        
        if (isOpening) {
          // Opening order
          entryOrders.push(order);
        } else {
          // Closing order - create trade
          if (entryOrders.length > 0) {
            const trade = this.createTradeFromOrders(symbol, entryOrders, order);
            if (trade) {
              trades.push(trade);
            }
            
            // Clear entry orders if position is flat
            if (position === 0) {
              entryOrders.length = 0;
            }
          }
        }
      }
    }
    
    return trades;
  }
  
  private createTradeFromOrders(
    symbol: string,
    entryOrders: AlpacaOrder[],
    exitOrder: AlpacaOrder
  ): BrokerTrade | null {
    if (entryOrders.length === 0) return null;
    
    // Calculate weighted average entry price
    const totalQty = entryOrders.reduce(
      (sum, order) => sum + parseFloat(order.filled_qty),
      0
    );
    const weightedEntryPrice = entryOrders.reduce(
      (sum, order) =>
        sum + parseFloat(order.filled_avg_price!) * parseFloat(order.filled_qty),
      0
    ) / totalQty;
    
    const direction: Direction = entryOrders[0].side === 'buy' ? 'LONG' : 'SHORT';
    const entryPrice = weightedEntryPrice;
    const exitPrice = parseFloat(exitOrder.filled_avg_price!);
    const quantity = Math.min(totalQty, parseFloat(exitOrder.filled_qty));
    
    // Calculate PnL
    const priceDiff = direction === 'LONG' 
      ? exitPrice - entryPrice 
      : entryPrice - exitPrice;
    const realizedPnl = priceDiff * quantity;
    
    // Calculate total commission
    const totalCommission = entryOrders.reduce(
      (sum, order) => sum + (order.commission || 0),
      0
    ) + (exitOrder.commission || 0);
    
    const firstEntry = entryOrders[0];
    
    return {
      brokerTradeId: `${firstEntry.id}-${exitOrder.id}`,
      symbol,
      direction,
      openedAt: new Date(firstEntry.filled_at!),
      closedAt: new Date(exitOrder.filled_at!),
      entryPrice,
      exitPrice,
      quantity,
      realizedPnl,
      commission: totalCommission,
      metadata: {
        entryOrderIds: entryOrders.map(o => o.id),
        exitOrderId: exitOrder.id,
        assetClass: firstEntry.asset_class,
      },
    };
  }
  
  // ==========================================================================
  // HELPERS
  // ==========================================================================
  
  /**
   * Parse credentials from accessToken
   * The accessToken is a JSON string containing apiKey, apiSecret, and environment
   */
  private parseAccessToken(accessToken: string): {
    apiKey: string;
    apiSecret: string;
    environment?: 'paper' | 'live';
  } {
    try {
      return JSON.parse(accessToken);
    } catch (error) {
      throw new BrokerAuthError('Invalid access token format');
    }
  }
  
  // ==========================================================================
  // API HELPERS
  // ==========================================================================
  
  private async apiRequest<T>(
    apiKey: string,
    apiSecret: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });
    
    // Check rate limit headers
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
    const rateLimitReset = response.headers.get('X-RateLimit-Reset');
    
    if (rateLimitRemaining && parseInt(rateLimitRemaining) < 10) {
      console.warn(`[Alpaca] Rate limit warning: ${rateLimitRemaining} requests remaining`);
    }
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new BrokerAuthError('Alpaca API key invalid or unauthorized');
      }
      if (response.status === 429) {
        const retryAfter = rateLimitReset 
          ? parseInt(rateLimitReset) * 1000 - Date.now()
          : 60000;
        throw new BrokerRateLimitError(
          'Alpaca rate limit exceeded',
          retryAfter
        );
      }
      
      const errorText = await response.text();
      throw new BrokerApiError(
        `Alpaca API error: ${errorText}`,
        response.status
      );
    }
    
    return response.json();
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createAlpacaProvider(
  environment: 'paper' | 'live' = 'live'
): AlpacaProvider {
  return new AlpacaProvider(environment);
}
