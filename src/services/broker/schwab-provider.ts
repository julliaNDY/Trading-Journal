/**
 * Charles Schwab Broker Provider
 * 
 * Implementation of the BrokerProvider interface for Charles Schwab API.
 * 
 * Schwab API Documentation: https://developer.schwab.com
 * 
 * Key endpoints used:
 * - GET /trader/v1/accounts - Get account information
 * - GET /trader/v1/accounts/accountNumbers - Get account hashes
 * - GET /trader/v1/accounts/{accountHash}/transactions - Get trade history
 * 
 * Authentication: OAuth 2.0 (Authorization Code Flow)
 * - Access Token: Valid ~30 minutes
 * - Refresh Token: Valid ~7 days (hard limit)
 * 
 * @author Dev 26
 * @date 2026-01-17
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
// SCHWAB API TYPES
// ============================================================================

interface SchwabAccount {
  securitiesAccount: {
    accountNumber: string;
    accountHash: string;
    type: string;
    roundTrips: number;
    isDayTrader: boolean;
    isClosingOnlyRestricted: boolean;
    currentBalances: {
      liquidationValue: number;
      cashBalance: number;
      equity: number;
    };
  };
}

interface SchwabAccountNumber {
  accountNumber: string;
  hashValue: string;
}

interface SchwabTransaction {
  activityId: number;
  time: string;
  type: string;
  status: string;
  netAmount: number;
  activityType: string;
  executionLegs?: SchwabExecutionLeg[];
  orderRemainingQuantity: number;
  instrument: {
    symbol: string;
    cusip?: string;
    description?: string;
    instrumentId: number;
    netChange?: number;
  };
  positionEffect?: 'OPENING' | 'CLOSING';
  transferItems?: SchwabTransferItem[];
}

interface SchwabExecutionLeg {
  legId: number;
  quantity: number;
  price: number;
  time: string;
}

interface SchwabTransferItem {
  instrument: {
    symbol: string;
    cusip?: string;
  };
  amount: number;
  cost: number;
  price: number;
  positionEffect?: 'OPENING' | 'CLOSING';
}

interface SchwabCredentials extends BrokerCredentials {
  // OAuth 2.0 credentials
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  // For initial auth, we'll receive an authorization code
  authorizationCode?: string;
}

interface SchwabTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// ============================================================================
// SCHWAB PROVIDER
// ============================================================================

const SCHWAB_API_BASE = 'https://api.schwabapi.com';
const SCHWAB_OAUTH_BASE = 'https://api.schwabapi.com/v1/oauth';

export class SchwabProvider implements BrokerProvider {
  readonly brokerType = 'SCHWAB' as BrokerType; // Will need to add to Prisma enum
  
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  
  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }
  
  // ==========================================================================
  // OAUTH 2.0 HELPERS
  // ==========================================================================
  
  /**
   * Generate authorization URL for user to login
   * User should be redirected to this URL to start OAuth flow
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'api',
    });
    
    if (state) {
      params.append('state', state);
    }
    
    return `${SCHWAB_OAUTH_BASE}/authorize?${params.toString()}`;
  }
  
  /**
   * Exchange authorization code for access + refresh tokens
   */
  private async exchangeCodeForTokens(authorizationCode: string): Promise<SchwabTokens> {
    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    const response = await fetch(`${SCHWAB_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authorizationCode,
        redirect_uri: this.redirectUri,
      }).toString(),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new BrokerAuthError(
        `Failed to exchange authorization code: ${errorText}`
      );
    }
    
    return response.json();
  }
  
  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(refreshToken: string): Promise<SchwabTokens> {
    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    const response = await fetch(`${SCHWAB_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new BrokerAuthError(
        `Failed to refresh access token: ${errorText}`
      );
    }
    
    return response.json();
  }
  
  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================
  
  async authenticate(credentials: BrokerCredentials): Promise<AuthResult> {
    const schwabCredentials = credentials as SchwabCredentials;
    
    if (!schwabCredentials.authorizationCode) {
      throw new BrokerAuthError(
        'Authorization code is required. User must complete OAuth flow first.'
      );
    }
    
    try {
      const tokens = await this.exchangeCodeForTokens(
        schwabCredentials.authorizationCode
      );
      
      // Store both access and refresh tokens in accessToken as JSON
      // This is necessary because Schwab requires both for token refresh
      const accessToken = JSON.stringify({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      });
      
      // Refresh token expires after 7 days
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      return {
        accessToken,
        expiresAt,
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
        `Failed to authenticate with Schwab: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  /**
   * Refresh token if needed
   * Called automatically when access token expires
   */
  async refreshToken(accessToken: string): Promise<AuthResult | null> {
    try {
      const { refreshToken, expiresAt } = this.parseAccessToken(accessToken);
      
      // Check if access token is still valid
      if (Date.now() < expiresAt) {
        return null; // No refresh needed
      }
      
      // Refresh access token
      const tokens = await this.refreshAccessToken(refreshToken);
      
      // Store new tokens
      const newAccessToken = JSON.stringify({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      });
      
      // Refresh token still expires after 7 days from original auth
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      return {
        accessToken: newAccessToken,
        expiresAt: newExpiresAt,
      };
    } catch (error) {
      if (error instanceof BrokerAuthError) {
        throw error;
      }
      throw new BrokerAuthError(
        `Failed to refresh Schwab token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  // ==========================================================================
  // ACCOUNTS
  // ==========================================================================
  
  async getAccounts(accessToken: string): Promise<BrokerAccount[]> {
    // Parse credentials from accessToken
    const { accessToken: token } = this.parseAccessToken(accessToken);
    
    // Fetch accounts
    const accounts = await this.apiRequest<SchwabAccount[]>(
      token,
      '/trader/v1/accounts'
    );
    
    return accounts.map(account => ({
      id: account.securitiesAccount.accountHash,
      name: `Schwab ${account.securitiesAccount.accountNumber} (${account.securitiesAccount.type})`,
      balance: account.securitiesAccount.currentBalances.equity,
      currency: 'USD', // Schwab is US-only
    }));
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
    const { accessToken: token } = this.parseAccessToken(accessToken);
    
    return this.getTradesWithCredentials(token, accountId, since);
  }
  
  /**
   * Internal method to get trades with full credentials
   */
  private async getTradesWithCredentials(
    accessToken: string,
    accountHash: string,
    since?: Date
  ): Promise<BrokerTrade[]> {
    // Build query parameters
    const params = new URLSearchParams({
      types: 'TRADE', // Only fetch trades (not dividends, etc.)
    });
    
    // Schwab API has 60-day limit by default
    // If since is older than 60 days, use 60 days ago
    const maxHistoryDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const startDate = since && since > maxHistoryDate ? since : maxHistoryDate;
    
    params.append('startDate', startDate.toISOString().split('T')[0]); // YYYY-MM-DD
    params.append('endDate', new Date().toISOString().split('T')[0]); // Today
    
    // Fetch transactions
    const transactions = await this.apiRequest<SchwabTransaction[]>(
      accessToken,
      `/trader/v1/accounts/${accountHash}/transactions?${params.toString()}`
    );
    
    // Filter to only valid trades
    const validTrades = transactions.filter(
      tx => tx.type === 'TRADE' && tx.status === 'VALID' && tx.executionLegs && tx.executionLegs.length > 0
    );
    
    // Reconstruct trades from transactions
    const trades = this.reconstructTrades(validTrades);
    
    return trades;
  }
  
  /**
   * Reconstructs trades from Schwab transactions.
   * 
   * Schwab returns transactions (individual orders), not trades.
   * We need to match buy/sell pairs to create complete round-trip trades.
   */
  private reconstructTrades(transactions: SchwabTransaction[]): BrokerTrade[] {
    const trades: BrokerTrade[] = [];
    
    // Group transactions by symbol
    const txsBySymbol = new Map<string, SchwabTransaction[]>();
    for (const tx of transactions) {
      const symbol = tx.instrument.symbol;
      const existing = txsBySymbol.get(symbol) || [];
      existing.push(tx);
      txsBySymbol.set(symbol, existing);
    }
    
    // Process each symbol's transactions
    for (const [symbol, symbolTxs] of txsBySymbol) {
      // Sort by time (oldest first)
      symbolTxs.sort((a, b) => {
        const timeA = new Date(a.time).getTime();
        const timeB = new Date(b.time).getTime();
        return timeA - timeB;
      });
      
      // Track position and match transactions
      let position = 0;
      const entryTxs: SchwabTransaction[] = [];
      
      for (const tx of symbolTxs) {
        const qty = tx.executionLegs![0].quantity;
        const side = tx.netAmount < 0 ? 'BUY' : 'SELL'; // Negative = debit = buy
        const qtyChange = side === 'BUY' ? qty : -qty;
        const previousPosition = position;
        position += qtyChange;
        
        // Check if this transaction is opening or closing
        const isOpening =
          (previousPosition >= 0 && qtyChange > 0) ||
          (previousPosition <= 0 && qtyChange < 0);
        
        if (isOpening) {
          // Opening transaction
          entryTxs.push(tx);
        } else {
          // Closing transaction - create trade
          if (entryTxs.length > 0) {
            const trade = this.createTradeFromTransactions(symbol, entryTxs, tx);
            if (trade) {
              trades.push(trade);
            }
            
            // Clear entry transactions if position is flat
            if (position === 0) {
              entryTxs.length = 0;
            }
          }
        }
      }
    }
    
    return trades;
  }
  
  private createTradeFromTransactions(
    symbol: string,
    entryTxs: SchwabTransaction[],
    exitTx: SchwabTransaction
  ): BrokerTrade | null {
    if (entryTxs.length === 0) return null;
    
    // Calculate weighted average entry price
    const totalQty = entryTxs.reduce(
      (sum, tx) => sum + tx.executionLegs![0].quantity,
      0
    );
    const weightedEntryPrice = entryTxs.reduce(
      (sum, tx) => {
        const qty = tx.executionLegs![0].quantity;
        const price = tx.executionLegs![0].price;
        return sum + price * qty;
      },
      0
    ) / totalQty;
    
    const firstEntry = entryTxs[0];
    const direction: Direction = firstEntry.netAmount < 0 ? 'LONG' : 'SHORT';
    const entryPrice = weightedEntryPrice;
    const exitPrice = exitTx.executionLegs![0].price;
    const quantity = Math.min(totalQty, exitTx.executionLegs![0].quantity);
    
    // Calculate PnL
    const priceDiff = direction === 'LONG' 
      ? exitPrice - entryPrice 
      : entryPrice - exitPrice;
    const realizedPnl = priceDiff * quantity;
    
    return {
      brokerTradeId: `${firstEntry.activityId}-${exitTx.activityId}`,
      symbol,
      direction,
      openedAt: new Date(firstEntry.time),
      closedAt: new Date(exitTx.time),
      entryPrice,
      exitPrice,
      quantity,
      realizedPnl,
      metadata: {
        entryTransactionIds: entryTxs.map(tx => tx.activityId),
        exitTransactionId: exitTx.activityId,
        accountType: 'SCHWAB',
      },
    };
  }
  
  // ==========================================================================
  // HELPERS
  // ==========================================================================
  
  /**
   * Parse credentials from accessToken
   * The accessToken is a JSON string containing accessToken, refreshToken, and expiresAt
   */
  private parseAccessToken(accessToken: string): {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
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
    accessToken: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${SCHWAB_API_BASE}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new BrokerAuthError('Schwab access token invalid or expired');
      }
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const retryAfterMs = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
        throw new BrokerRateLimitError(
          'Schwab rate limit exceeded',
          retryAfterMs
        );
      }
      
      const errorText = await response.text();
      throw new BrokerApiError(
        `Schwab API error: ${errorText}`,
        response.status
      );
    }
    
    return response.json();
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createSchwabProvider(
  clientId: string,
  clientSecret: string,
  redirectUri: string
): SchwabProvider {
  return new SchwabProvider(clientId, clientSecret, redirectUri);
}
