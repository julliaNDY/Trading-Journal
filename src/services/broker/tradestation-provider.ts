/**
 * TradeStation Broker Provider
 * 
 * Implements OAuth 2.0 authentication and trade sync for TradeStation.
 * 
 * @see docs/brokers/api-research/tradestation.md
 * @see docs/brokers/tradestation-integration-guide.md
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
// TRADESTATION API TYPES
// ============================================================================

interface TradeStationAccount {
  AccountID: string;
  AccountType: string;
  Status: string;
  Currency: string;
}

interface TradeStationOrder {
  OrderID: string;
  Symbol: string;
  Quantity: number;
  Side: 'Buy' | 'Sell';
  Status: string;
  FilledQuantity: number;
  AveragePrice: number;
  OrderPlacedTime: string;
  FilledTime: string;
  Commission?: number;
}

interface TradeStationOrdersResponse {
  Orders: TradeStationOrder[];
  NextToken: string | null;
}

export interface TradeStationCredentials extends BrokerCredentials {
  // For OAuth, we don't use apiKey/apiSecret in the traditional sense
  // Instead, we store the authorization code or refresh token
  // apiKey = clientId (from env)
  // apiSecret = clientSecret (from env)
  environment?: 'sim' | 'live';
  authorizationCode?: string; // Used during initial OAuth flow
  refreshToken?: string; // Stored for token refresh
}

// ============================================================================
// TRADESTATION PROVIDER
// ============================================================================

const TRADESTATION_API_BASE = {
  sim: 'https://sim-api.tradestation.com/v3',
  live: 'https://api.tradestation.com/v3',
};

const TRADESTATION_AUTH_BASE = 'https://signin.tradestation.com';

export class TradeStationProvider implements BrokerProvider {
  readonly brokerType = 'TRADESTATION' as BrokerType;
  
  private environment: 'sim' | 'live';
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  
  constructor(
    environment: 'sim' | 'live' = 'live',
    clientId?: string,
    clientSecret?: string,
    redirectUri?: string
  ) {
    this.environment = environment;
    this.clientId = clientId || process.env.TRADESTATION_CLIENT_ID || '';
    this.clientSecret = clientSecret || process.env.TRADESTATION_CLIENT_SECRET || '';
    this.redirectUri = redirectUri || process.env.TRADESTATION_REDIRECT_URI || '';
    
    if (!this.clientId || !this.clientSecret) {
      throw new Error('TradeStation OAuth credentials not configured');
    }
  }
  
  private get baseUrl(): string {
    return TRADESTATION_API_BASE[this.environment];
  }
  
  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================
  
  /**
   * Generate OAuth authorization URL
   * User will be redirected to this URL to authorize the app
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      audience: 'https://api.tradestation.com',
      scope: 'openid profile offline_access ReadAccount',
      state,
    });
    
    return `${TRADESTATION_AUTH_BASE}/authorize?${params.toString()}`;
  }
  
  /**
   * Exchange authorization code for access token
   * Called after user authorizes the app and is redirected back
   */
  async authenticate(credentials: BrokerCredentials): Promise<AuthResult> {
    const tsCredentials = credentials as TradeStationCredentials;
    
    if (!tsCredentials.authorizationCode) {
      throw new BrokerAuthError('Authorization code is required');
    }
    
    try {
      const response = await fetch(`${TRADESTATION_AUTH_BASE}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: tsCredentials.authorizationCode,
          redirect_uri: this.redirectUri,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new BrokerAuthError(
          error.error_description || 'Authentication failed',
          error
        );
      }
      
      const data = await response.json();
      
      // Calculate token expiry (expires_in is in seconds)
      const expiresAt = new Date(Date.now() + data.expires_in * 1000);
      
      return {
        accessToken: data.access_token,
        expiresAt,
        userId: data.id_token, // Optional: decode JWT to get user ID
      };
    } catch (error) {
      if (error instanceof BrokerAuthError) {
        throw error;
      }
      throw new BrokerAuthError(
        'Failed to exchange authorization code',
        error
      );
    }
  }
  
  /**
   * Refresh access token using refresh token
   * TradeStation access tokens expire after 20 minutes
   */
  async refreshToken(refreshToken: string): Promise<AuthResult | null> {
    try {
      const response = await fetch(`${TRADESTATION_AUTH_BASE}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new BrokerAuthError(
          error.error_description || 'Token refresh failed',
          error
        );
      }
      
      const data = await response.json();
      
      const expiresAt = new Date(Date.now() + data.expires_in * 1000);
      
      return {
        accessToken: data.access_token,
        expiresAt,
      };
    } catch (error) {
      if (error instanceof BrokerAuthError) {
        throw error;
      }
      // Return null if refresh fails (user needs to re-authenticate)
      return null;
    }
  }
  
  // ==========================================================================
  // ACCOUNTS
  // ==========================================================================
  
  async getAccounts(accessToken: string): Promise<BrokerAccount[]> {
    try {
      const data = await this.apiRequest<{ Accounts: TradeStationAccount[] }>(
        accessToken,
        '/brokerage/accounts'
      );
      
      return data.Accounts.map((account) => ({
        id: account.AccountID,
        name: `${account.AccountType} (${account.AccountID})`,
        currency: account.Currency,
      }));
    } catch (error) {
      throw new BrokerApiError(
        'Failed to fetch accounts',
        undefined,
        error
      );
    }
  }
  
  // ==========================================================================
  // TRADES
  // ==========================================================================
  
  async getTrades(
    accessToken: string,
    accountId: string,
    since?: Date
  ): Promise<BrokerTrade[]> {
    try {
      // Fetch all orders (paginated)
      const orders = await this.fetchAllOrders(accessToken, accountId, since);
      
      // Filter only filled orders
      const filledOrders = orders.filter(
        (order) => order.Status === 'Filled' && order.FilledQuantity > 0
      );
      
      // Reconstruct trades from orders
      const trades = this.reconstructTrades(filledOrders);
      
      return trades;
    } catch (error) {
      throw new BrokerApiError(
        'Failed to fetch trades',
        undefined,
        error
      );
    }
  }
  
  /**
   * Fetch all orders with pagination
   */
  private async fetchAllOrders(
    accessToken: string,
    accountId: string,
    since?: Date
  ): Promise<TradeStationOrder[]> {
    const allOrders: TradeStationOrder[] = [];
    let nextToken: string | null = null;
    
    do {
      const params = new URLSearchParams({
        pageSize: '500',
      });
      
      if (since) {
        params.append('since', since.toISOString());
      }
      
      if (nextToken) {
        params.append('nextToken', nextToken);
      }
      
      const data = await this.apiRequest<TradeStationOrdersResponse>(
        accessToken,
        `/brokerage/accounts/${accountId}/historicalorders?${params.toString()}`
      );
      
      allOrders.push(...data.Orders);
      nextToken = data.NextToken;
    } while (nextToken);
    
    return allOrders;
  }
  
  /**
   * Reconstruct trades from orders
   * 
   * TradeStation doesn't have a fills endpoint, so we must reconstruct
   * trades by matching buy/sell orders.
   */
  private reconstructTrades(orders: TradeStationOrder[]): BrokerTrade[] {
    const trades: BrokerTrade[] = [];
    
    // Sort orders by filled time
    const sortedOrders = orders.sort((a, b) => 
      new Date(a.FilledTime).getTime() - new Date(b.FilledTime).getTime()
    );
    
    // Group orders by symbol
    const ordersBySymbol = new Map<string, TradeStationOrder[]>();
    for (const order of sortedOrders) {
      const symbol = this.normalizeSymbol(order.Symbol);
      if (!ordersBySymbol.has(symbol)) {
        ordersBySymbol.set(symbol, []);
      }
      ordersBySymbol.get(symbol)!.push(order);
    }
    
    // Reconstruct trades for each symbol
    for (const [symbol, symbolOrders] of ordersBySymbol) {
      const symbolTrades = this.reconstructTradesForSymbol(symbol, symbolOrders);
      trades.push(...symbolTrades);
    }
    
    return trades;
  }
  
  /**
   * Reconstruct trades for a single symbol
   */
  private reconstructTradesForSymbol(
    symbol: string,
    orders: TradeStationOrder[]
  ): BrokerTrade[] {
    const trades: BrokerTrade[] = [];
    let position = 0; // Running position
    const openOrders: TradeStationOrder[] = []; // Orders that opened position
    
    for (const order of orders) {
      const quantity = order.FilledQuantity;
      const isBuy = order.Side === 'Buy';
      
      // Determine if this order opens or closes position
      if (position === 0) {
        // Opening new position
        openOrders.push(order);
        position = isBuy ? quantity : -quantity;
      } else if ((position > 0 && isBuy) || (position < 0 && !isBuy)) {
        // Adding to existing position
        openOrders.push(order);
        position += isBuy ? quantity : -quantity;
      } else {
        // Closing position (fully or partially)
        const closeQuantity = Math.min(Math.abs(position), quantity);
        
        // Match with open orders (FIFO)
        let remainingClose = closeQuantity;
        while (remainingClose > 0 && openOrders.length > 0) {
          const openOrder = openOrders[0];
          const openQuantity = openOrder.FilledQuantity;
          const matchQuantity = Math.min(remainingClose, openQuantity);
          
          // Create trade
          const direction = openOrder.Side === 'Buy' ? Direction.LONG : Direction.SHORT;
          const entryPrice = openOrder.AveragePrice;
          const exitPrice = order.AveragePrice;
          
          // Calculate PnL
          const pnl = direction === Direction.LONG
            ? (exitPrice - entryPrice) * matchQuantity
            : (entryPrice - exitPrice) * matchQuantity;
          
          // Calculate fees
          const entryFees = (openOrder.Commission || 0) * (matchQuantity / openQuantity);
          const exitFees = (order.Commission || 0) * (matchQuantity / quantity);
          const totalFees = entryFees + exitFees;
          
          trades.push({
            brokerTradeId: `${openOrder.OrderID}-${order.OrderID}`,
            symbol,
            direction,
            openedAt: new Date(openOrder.FilledTime),
            closedAt: new Date(order.FilledTime),
            entryPrice,
            exitPrice,
            quantity: matchQuantity,
            realizedPnl: pnl - totalFees,
            fees: totalFees,
            commission: totalFees,
            metadata: {
              entryOrderId: openOrder.OrderID,
              exitOrderId: order.OrderID,
            },
          });
          
          // Update open order quantity
          if (matchQuantity >= openQuantity) {
            openOrders.shift(); // Fully closed
          } else {
            openOrder.FilledQuantity -= matchQuantity; // Partially closed
          }
          
          remainingClose -= matchQuantity;
        }
        
        // Update position
        position += isBuy ? quantity : -quantity;
        
        // If there's remaining quantity, it opens a new position
        if (remainingClose < quantity) {
          const newPosition = quantity - remainingClose;
          const newOrder = { ...order, FilledQuantity: newPosition };
          openOrders.push(newOrder);
        }
      }
    }
    
    return trades;
  }
  
  /**
   * Normalize symbol (stocks, options, futures, forex)
   */
  private normalizeSymbol(symbol: string): string {
    // For now, just trim and uppercase
    // TODO: Handle options, futures, forex normalization
    return symbol.trim().toUpperCase();
  }
  
  // ==========================================================================
  // HELPERS
  // ==========================================================================
  
  private async apiRequest<T>(
    accessToken: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const retryAfterMs = retryAfter ? parseInt(retryAfter) * 1000 : 300000; // Default 5 min
      throw new BrokerRateLimitError(
        'Rate limit exceeded',
        retryAfterMs
      );
    }
    
    // Handle auth errors
    if (response.status === 401) {
      throw new BrokerAuthError('Access token expired or invalid');
    }
    
    // Handle other errors
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new BrokerApiError(
        error.error_description || `API request failed: ${response.statusText}`,
        response.status,
        error
      );
    }
    
    return response.json();
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createTradeStationProvider(
  environment: 'sim' | 'live' = 'live',
  clientId?: string,
  clientSecret?: string,
  redirectUri?: string
): TradeStationProvider {
  return new TradeStationProvider(environment, clientId, clientSecret, redirectUri);
}
