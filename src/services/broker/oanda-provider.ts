/**
 * OANDA Broker Provider
 * 
 * Implementation of the BrokerProvider interface for OANDA v20 API.
 * 
 * OANDA v20 API Documentation: https://developer.oanda.com/rest-live-v20/introduction/
 * 
 * Key endpoints used:
 * - GET /v3/accounts - Get list of accounts
 * - GET /v3/accounts/{accountID} - Get account details
 * - GET /v3/accounts/{accountID}/transactions - Get transaction history
 * 
 * Authentication: Bearer token (API key)
 * Rate Limits: 120 requests per second
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
// OANDA API TYPES
// ============================================================================

interface OandaAccountsResponse {
  accounts: Array<{
    id: string;
    tags: string[];
  }>;
}

interface OandaAccountDetails {
  account: {
    id: string;
    alias: string;
    currency: string;
    balance: string;
    createdByUserID: number;
    createdTime: string;
    guaranteedStopLossOrderMode: string;
    pl: string;
    resettablePL: string;
    resettablePLTime: string;
    financing: string;
    commission: string;
    guaranteedExecutionFees: string;
    marginRate: string;
    marginCallEnterTime: string | null;
    marginCallExtensionCount: number;
    lastMarginCallExtensionTime: string | null;
    openTradeCount: number;
    openPositionCount: number;
    pendingOrderCount: number;
    hedgingEnabled: boolean;
    lastTransactionID: string;
    trades: OandaTrade[];
    positions: OandaPosition[];
    orders: OandaOrder[];
  };
  lastTransactionID: string;
}

interface OandaTrade {
  id: string;
  instrument: string;
  price: string;
  openTime: string;
  state: string;
  initialUnits: string;
  initialMarginRequired: string;
  currentUnits: string;
  realizedPL: string;
  unrealizedPL: string;
  marginUsed: string;
  averageClosePrice: string;
  closingTransactionIDs: string[];
  financing: string;
  closeTime: string;
  clientExtensions?: {
    id?: string;
    tag?: string;
    comment?: string;
  };
  takeProfitOrder?: {
    id: string;
    price: string;
  };
  stopLossOrder?: {
    id: string;
    price: string;
    distance?: string;
  };
  trailingStopLossOrder?: {
    id: string;
    distance: string;
  };
}

interface OandaPosition {
  instrument: string;
  long: {
    units: string;
    averagePrice: string;
    pl: string;
    resettablePL: string;
    financing: string;
    guaranteedExecutionFees: string;
    tradeIDs: string[];
    unrealizedPL: string;
  };
  short: {
    units: string;
    averagePrice: string;
    pl: string;
    resettablePL: string;
    financing: string;
    guaranteedExecutionFees: string;
    tradeIDs: string[];
    unrealizedPL: string;
  };
  pl: string;
  resettablePL: string;
  financing: string;
  commission: string;
  guaranteedExecutionFees: string;
  unrealizedPL: string;
  marginUsed: string;
}

interface OandaOrder {
  id: string;
  createTime: string;
  state: string;
  type: string;
}

interface OandaTransaction {
  id: string;
  time: string;
  userID: number;
  accountID: string;
  batchID: string;
  requestID: string;
  type: string;
  instrument?: string;
  units?: string;
  price?: string;
  pl?: string;
  financing?: string;
  commission?: string;
  accountBalance?: string;
  tradeOpened?: {
    tradeID: string;
    units: string;
    price: string;
    guaranteedExecutionFee: string;
    halfSpreadCost: string;
    initialMarginRequired: string;
  };
  tradesClosed?: Array<{
    tradeID: string;
    units: string;
    realizedPL: string;
    financing: string;
    guaranteedExecutionFee: string;
    halfSpreadCost: string;
  }>;
  tradeReduced?: {
    tradeID: string;
    units: string;
    realizedPL: string;
    financing: string;
    guaranteedExecutionFee: string;
    halfSpreadCost: string;
  };
  reason?: string;
  clientOrderID?: string;
  timeInForce?: string;
  positionFill?: string;
}

interface OandaTransactionsResponse {
  transactions: OandaTransaction[];
  lastTransactionID: string;
}

interface OandaCredentials extends BrokerCredentials {
  environment?: 'practice' | 'live';
  accountId?: string;
}

// ============================================================================
// OANDA PROVIDER
// ============================================================================

const OANDA_API_BASE = {
  practice: 'https://api-fxpractice.oanda.com',
  live: 'https://api-fxtrade.oanda.com',
};

export class OandaProvider implements BrokerProvider {
  readonly brokerType = 'OANDA' as BrokerType;
  
  private environment: 'practice' | 'live';
  
  constructor(environment: 'practice' | 'live' = 'live') {
    this.environment = environment;
  }
  
  private get baseUrl(): string {
    return OANDA_API_BASE[this.environment];
  }
  
  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================
  
  async authenticate(credentials: BrokerCredentials): Promise<AuthResult> {
    const oandaCredentials = credentials as OandaCredentials;
    
    // Use the specified environment or default
    if (oandaCredentials.environment) {
      this.environment = oandaCredentials.environment;
    }
    
    // Validate credentials by fetching accounts
    try {
      const accountsResponse = await this.apiRequest<OandaAccountsResponse>(
        credentials.apiKey,
        '/v3/accounts'
      );
      
      if (!accountsResponse.accounts || accountsResponse.accounts.length === 0) {
        throw new BrokerAuthError('No OANDA accounts found for this API key');
      }
      
      // OANDA API keys don't expire
      return {
        accessToken: credentials.apiKey, // Store API key as "access token"
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        userId: accountsResponse.accounts[0].id,
      };
    } catch (error) {
      if (error instanceof BrokerAuthError || error instanceof BrokerApiError || error instanceof BrokerRateLimitError) {
        throw error;
      }
      throw new BrokerAuthError(
        `Failed to authenticate with OANDA: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  // ==========================================================================
  // ACCOUNTS
  // ==========================================================================
  
  async getAccounts(accessToken: string): Promise<BrokerAccount[]> {
    const accountsResponse = await this.apiRequest<OandaAccountsResponse>(
      accessToken,
      '/v3/accounts'
    );
    
    const accounts: BrokerAccount[] = [];
    
    for (const account of accountsResponse.accounts) {
      const details = await this.apiRequest<OandaAccountDetails>(
        accessToken,
        `/v3/accounts/${account.id}`
      );
      
      accounts.push({
        id: details.account.id,
        name: details.account.alias || `OANDA ${details.account.id}`,
        balance: parseFloat(details.account.balance),
        currency: details.account.currency,
      });
    }
    
    return accounts;
  }
  
  // ==========================================================================
  // TRADES
  // ==========================================================================
  
  async getTrades(
    accessToken: string,
    accountId: string,
    since?: Date
  ): Promise<BrokerTrade[]> {
    // Get transactions (which include trade opens and closes)
    const params = new URLSearchParams({
      type: 'ORDER_FILL', // Only get order fill transactions
    });
    
    if (since) {
      params.append('from', since.toISOString());
    }
    
    const transactionsResponse = await this.apiRequest<OandaTransactionsResponse>(
      accessToken,
      `/v3/accounts/${accountId}/transactions?${params.toString()}`
    );
    
    // Reconstruct trades from transactions
    const trades = this.reconstructTrades(transactionsResponse.transactions);
    
    return trades;
  }
  
  /**
   * Reconstructs trades from OANDA transactions.
   * 
   * OANDA transactions include:
   * - ORDER_FILL: When an order is filled (can open or close trades)
   * - tradeOpened: New trade opened
   * - tradesClosed: Trades closed by this fill
   * - tradeReduced: Trade partially closed
   */
  private reconstructTrades(transactions: OandaTransaction[]): BrokerTrade[] {
    const trades: BrokerTrade[] = [];
    const openTrades = new Map<string, {
      tradeId: string;
      instrument: string;
      units: number;
      entryPrice: number;
      openTime: Date;
      financing: number;
    }>();
    
    // Process transactions chronologically
    for (const tx of transactions) {
      if (tx.type !== 'ORDER_FILL') continue;
      
      // Handle trade opened
      if (tx.tradeOpened) {
        const units = parseFloat(tx.tradeOpened.units);
        openTrades.set(tx.tradeOpened.tradeID, {
          tradeId: tx.tradeOpened.tradeID,
          instrument: tx.instrument!,
          units,
          entryPrice: parseFloat(tx.tradeOpened.price),
          openTime: new Date(tx.time),
          financing: 0,
        });
      }
      
      // Handle trades closed
      if (tx.tradesClosed && tx.tradesClosed.length > 0) {
        for (const closedTrade of tx.tradesClosed) {
          const openTrade = openTrades.get(closedTrade.tradeID);
          if (!openTrade) continue;
          
          const closedUnits = Math.abs(parseFloat(closedTrade.units));
          const realizedPL = parseFloat(closedTrade.realizedPL);
          const financing = parseFloat(closedTrade.financing || '0');
          const commission = parseFloat(closedTrade.guaranteedExecutionFee || '0') +
                           parseFloat(closedTrade.halfSpreadCost || '0');
          
          // Determine direction
          const direction: Direction = openTrade.units > 0 ? 'LONG' : 'SHORT';
          
          // Calculate exit price from PnL
          // For LONG: PnL = (exitPrice - entryPrice) * units
          // For SHORT: PnL = (entryPrice - exitPrice) * units
          // exitPrice = entryPrice + (PnL / units) for LONG
          // exitPrice = entryPrice - (PnL / units) for SHORT
          const pnlPerUnit = realizedPL / closedUnits;
          const exitPrice = direction === 'LONG'
            ? openTrade.entryPrice + pnlPerUnit
            : openTrade.entryPrice - pnlPerUnit;
          
          trades.push({
            brokerTradeId: closedTrade.tradeID,
            symbol: this.normalizeSymbol(openTrade.instrument),
            direction,
            openedAt: openTrade.openTime,
            closedAt: new Date(tx.time),
            entryPrice: openTrade.entryPrice,
            exitPrice,
            quantity: closedUnits,
            realizedPnl: realizedPL,
            commission,
            fees: financing,
            metadata: {
              instrument: openTrade.instrument,
              transactionId: tx.id,
              financing,
              halfSpreadCost: closedTrade.halfSpreadCost,
              guaranteedExecutionFee: closedTrade.guaranteedExecutionFee,
            },
          });
          
          // If trade fully closed, remove from open trades
          if (Math.abs(openTrade.units) === closedUnits) {
            openTrades.delete(closedTrade.tradeID);
          } else {
            // Partially closed, update units
            openTrade.units = openTrade.units > 0
              ? openTrade.units - closedUnits
              : openTrade.units + closedUnits;
          }
        }
      }
      
      // Handle trade reduced (partial close)
      if (tx.tradeReduced) {
        const openTrade = openTrades.get(tx.tradeReduced.tradeID);
        if (!openTrade) continue;
        
        const reducedUnits = Math.abs(parseFloat(tx.tradeReduced.units));
        const realizedPL = parseFloat(tx.tradeReduced.realizedPL);
        const financing = parseFloat(tx.tradeReduced.financing || '0');
        const commission = parseFloat(tx.tradeReduced.guaranteedExecutionFee || '0') +
                         parseFloat(tx.tradeReduced.halfSpreadCost || '0');
        
        const direction: Direction = openTrade.units > 0 ? 'LONG' : 'SHORT';
        
        // Calculate exit price from PnL
        const pnlPerUnit = realizedPL / reducedUnits;
        const exitPrice = direction === 'LONG'
          ? openTrade.entryPrice + pnlPerUnit
          : openTrade.entryPrice - pnlPerUnit;
        
        trades.push({
          brokerTradeId: `${tx.tradeReduced.tradeID}-partial-${tx.id}`,
          symbol: this.normalizeSymbol(openTrade.instrument),
          direction,
          openedAt: openTrade.openTime,
          closedAt: new Date(tx.time),
          entryPrice: openTrade.entryPrice,
          exitPrice,
          quantity: reducedUnits,
          realizedPnl: realizedPL,
          commission,
          fees: financing,
          metadata: {
            instrument: openTrade.instrument,
            transactionId: tx.id,
            financing,
            halfSpreadCost: tx.tradeReduced.halfSpreadCost,
            guaranteedExecutionFee: tx.tradeReduced.guaranteedExecutionFee,
            isPartialClose: true,
          },
        });
        
        // Update remaining units
        openTrade.units = openTrade.units > 0
          ? openTrade.units - reducedUnits
          : openTrade.units + reducedUnits;
      }
    }
    
    return trades;
  }
  
  /**
   * Normalize OANDA instrument names to standard symbols
   * OANDA uses format like "EUR_USD", we convert to "EURUSD"
   */
  private normalizeSymbol(instrument: string): string {
    return instrument.replace(/_/g, '');
  }
  
  // ==========================================================================
  // API HELPERS
  // ==========================================================================
  
  private async apiRequest<T>(
    apiKey: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Datetime-Format': 'RFC3339', // Use RFC3339 format for timestamps
        ...options.headers,
      },
    });
    
    // Check rate limit headers
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
    const rateLimitReset = response.headers.get('X-RateLimit-Reset');
    
    if (rateLimitRemaining && parseInt(rateLimitRemaining) < 10) {
      console.warn(`[OANDA] Rate limit warning: ${rateLimitRemaining} requests remaining`);
    }
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new BrokerAuthError('OANDA API key invalid or unauthorized');
      }
      if (response.status === 429) {
        const retryAfter = rateLimitReset 
          ? parseInt(rateLimitReset) * 1000 - Date.now()
          : 60000;
        throw new BrokerRateLimitError(
          'OANDA rate limit exceeded',
          retryAfter
        );
      }
      
      const errorText = await response.text();
      let errorMessage = `OANDA API error: ${errorText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = `OANDA API error: ${errorJson.errorMessage || errorText}`;
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

export function createOandaProvider(
  environment: 'practice' | 'live' = 'live'
): OandaProvider {
  return new OandaProvider(environment);
}
