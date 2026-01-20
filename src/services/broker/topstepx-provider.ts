/**
 * TopstepX Broker Provider
 * 
 * Implementation of the BrokerProvider interface for TopstepX ProjectX API.
 * 
 * TopstepX API Documentation: https://help.topstep.com/en/articles/11187768-topstepx-api-access
 * 
 * Key endpoints used:
 * - GET /api/v1/account - Get account information
 * - GET /api/v1/trades - Get trade history
 * - GET /api/v1/executions - Get execution fills
 * 
 * IMPORTANT NOTES:
 * - New API (launched 2024-2025) - may have bugs
 * - No sandbox environment - must test with real evaluation account
 * - Rate limits unknown - using conservative approach
 * - No VPN support - TopstepX blocks VPN connections
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
// TOPSTEPX API TYPES
// ============================================================================

interface TopstepXAccount {
  accountId: string;
  accountType: 'evaluation' | 'funded' | 'trial';
  balance: number;
  equity: number;
  buyingPower: number;
  currency: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
}

interface TopstepXTrade {
  tradeId: string;
  symbol: string;
  side: 'long' | 'short';
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  realizedPnL: number;
  commission: number;
  fees: number;
  metadata?: {
    orderId?: string;
    executionIds?: string[];
    [key: string]: unknown;
  };
}

interface TopstepXExecution {
  executionId: string;
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  time: string;
  commission: number;
  fees: number;
}

interface TopstepXTradesResponse {
  trades: TopstepXTrade[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore?: boolean;
  };
}

interface TopstepXExecutionsResponse {
  executions: TopstepXExecution[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore?: boolean;
  };
}

interface TopstepXCredentials extends BrokerCredentials {
  // apiKey = API Token (Bearer token)
  // apiSecret = not used (TopstepX uses single token)
}

// ============================================================================
// TOPSTEPX PROVIDER
// ============================================================================

const TOPSTEPX_API_BASE = 'https://api.topstepx.com/v1';

// Conservative rate limiting (unknown actual limits)
const RATE_LIMIT_REQUESTS_PER_MINUTE = 30;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

export class TopstepXProvider implements BrokerProvider {
  readonly brokerType = 'TOPSTEPX' as BrokerType; // Will need to add to Prisma enum
  
  private requestTimestamps: number[] = [];
  
  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================
  
  async authenticate(credentials: BrokerCredentials): Promise<AuthResult> {
    const { apiKey } = credentials;
    
    if (!apiKey) {
      throw new BrokerAuthError('TopstepX API token is required');
    }
    
    // Validate credentials by fetching account info
    try {
      const account = await this.apiRequest<TopstepXAccount>(
        apiKey,
        '/account'
      );
      
      // TopstepX API tokens don't expire (assumed)
      return {
        accessToken: apiKey,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        userId: account.accountId,
      };
    } catch (error) {
      if (error instanceof BrokerAuthError || error instanceof BrokerApiError) {
        throw error;
      }
      throw new BrokerAuthError(
        `Failed to authenticate with TopstepX: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  // ==========================================================================
  // ACCOUNTS
  // ==========================================================================
  
  async getAccounts(accessToken: string): Promise<BrokerAccount[]> {
    const account = await this.apiRequest<TopstepXAccount>(
      accessToken,
      '/account'
    );
    
    return [{
      id: account.accountId,
      name: `TopstepX ${account.accountType} (${account.accountId})`,
      balance: account.equity,
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
    const allTrades: BrokerTrade[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    
    // Build query params
    const params = new URLSearchParams({
      limit: limit.toString(),
    });
    
    if (since) {
      params.append('startDate', since.toISOString());
    }
    
    // Fetch all pages
    while (hasMore) {
      params.set('offset', offset.toString());
      
      const response = await this.apiRequest<TopstepXTradesResponse>(
        accessToken,
        `/trades?${params.toString()}`
      );
      
      // Map TopstepX trades to our format
      const trades = response.trades.map(trade => this._mapTrade(trade));
      allTrades.push(...trades);
      
      // Check if there are more pages
      hasMore = response.pagination?.hasMore ?? false;
      offset += limit;
      
      // Safety check to prevent infinite loops
      if (offset > 10000) {
        console.warn('[TopstepX] Reached maximum offset (10000), stopping pagination');
        break;
      }
    }
    
    return allTrades;
  }
  
  /**
   * Maps TopstepX trade to our standard format
   */
  private _mapTrade(trade: TopstepXTrade): BrokerTrade {
    // Map side to direction
    const direction: Direction = trade.side === 'long' ? 'LONG' : 'SHORT';
    
    // Calculate total fees (commission + fees)
    const totalFees = trade.commission + trade.fees;
    
    return {
      brokerTradeId: trade.tradeId,
      symbol: trade.symbol,
      direction,
      openedAt: new Date(trade.entryTime),
      closedAt: new Date(trade.exitTime),
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      quantity: trade.quantity,
      realizedPnl: trade.realizedPnL,
      fees: totalFees,
      commission: trade.commission,
      metadata: {
        ...trade.metadata,
        topstepxTradeId: trade.tradeId,
      },
    };
  }
  
  // ==========================================================================
  // EXECUTIONS (OPTIONAL - FOR DEBUGGING)
  // ==========================================================================
  
  /**
   * Fetches individual executions (fills) from TopstepX.
   * This is useful for debugging or reconstructing trades if needed.
   */
  async getExecutions(
    accessToken: string,
    since?: Date
  ): Promise<TopstepXExecution[]> {
    const allExecutions: TopstepXExecution[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    
    // Build query params
    const params = new URLSearchParams({
      limit: limit.toString(),
    });
    
    if (since) {
      params.append('startDate', since.toISOString());
    }
    
    // Fetch all pages
    while (hasMore) {
      params.set('offset', offset.toString());
      
      const response = await this.apiRequest<TopstepXExecutionsResponse>(
        accessToken,
        `/executions?${params.toString()}`
      );
      
      allExecutions.push(...response.executions);
      
      // Check if there are more pages
      hasMore = response.pagination?.hasMore ?? false;
      offset += limit;
      
      // Safety check
      if (offset > 10000) {
        console.warn('[TopstepX] Reached maximum offset (10000), stopping pagination');
        break;
      }
    }
    
    return allExecutions;
  }
  
  // ==========================================================================
  // API HELPERS
  // ==========================================================================
  
  /**
   * Makes an API request to TopstepX with rate limiting and error handling
   */
  private async apiRequest<T>(
    apiToken: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Rate limiting: Wait if we've exceeded the limit
    await this.enforceRateLimit();
    
    const url = `${TOPSTEPX_API_BASE}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
      });
      
      // Track request timestamp for rate limiting
      this.requestTimestamps.push(Date.now());
      
      // Handle errors
      if (!response.ok) {
        await this.handleErrorResponse(response);
      }
      
      // Parse and return response
      return await response.json();
    } catch (error) {
      // Re-throw broker errors
      if (
        error instanceof BrokerAuthError ||
        error instanceof BrokerApiError ||
        error instanceof BrokerRateLimitError
      ) {
        throw error;
      }
      
      // Wrap other errors
      throw new BrokerApiError(
        `TopstepX API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      );
    }
  }
  
  /**
   * Handles error responses from TopstepX API
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    const status = response.status;
    
    // Try to parse error message
    let errorMessage = 'Unknown error';
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
    } catch {
      errorMessage = await response.text();
    }
    
    // Handle specific error codes
    if (status === 401 || status === 403) {
      throw new BrokerAuthError(
        `TopstepX API authentication failed: ${errorMessage}`
      );
    }
    
    if (status === 429) {
      // Rate limit exceeded
      // Try to get retry-after header
      const retryAfter = response.headers.get('Retry-After');
      const retryAfterMs = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
      
      throw new BrokerRateLimitError(
        `TopstepX rate limit exceeded: ${errorMessage}`,
        retryAfterMs
      );
    }
    
    // Generic API error
    throw new BrokerApiError(
      `TopstepX API error (${status}): ${errorMessage}`,
      status
    );
  }
  
  /**
   * Enforces rate limiting by waiting if necessary
   */
  private async enforceRateLimit(): Promise<void> {
    // Clean up old timestamps (outside the window)
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > windowStart);
    
    // Check if we've exceeded the limit
    if (this.requestTimestamps.length >= RATE_LIMIT_REQUESTS_PER_MINUTE) {
      // Calculate how long to wait
      const oldestTimestamp = this.requestTimestamps[0];
      const waitMs = RATE_LIMIT_WINDOW_MS - (now - oldestTimestamp);
      
      if (waitMs > 0) {
        console.warn(
          `[TopstepX] Rate limit reached (${RATE_LIMIT_REQUESTS_PER_MINUTE} req/min), waiting ${waitMs}ms`
        );
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createTopstepXProvider(): TopstepXProvider {
  return new TopstepXProvider();
}
