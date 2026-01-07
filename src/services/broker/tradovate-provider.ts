/**
 * Tradovate Broker Provider
 * 
 * Implementation of the BrokerProvider interface for Tradovate API.
 * 
 * Tradovate API Documentation: https://api.tradovate.com
 * 
 * Key endpoints used:
 * - POST /auth/accesstokenrequest - Authenticate with API key
 * - GET /account/list - Get trading accounts
 * - GET /fill/list - Get fill/execution data
 * - GET /contract/item - Get contract details (for symbol lookup)
 */

import { BrokerType } from '@prisma/client';
import {
  BrokerProvider,
  BrokerCredentials,
  TradovateCredentials,
  BrokerAccount,
  BrokerTrade,
  AuthResult,
  BrokerAuthError,
  BrokerApiError,
  BrokerRateLimitError,
} from './types';

// ============================================================================
// TRADOVATE API TYPES
// ============================================================================

interface TradovateAuthRequest {
  name: string;      // API Key name
  password: string;  // API Secret
  appId?: string;
  appVersion?: string;
  cid?: number;
  sec?: string;
}

interface TradovateAuthResponse {
  accessToken: string;
  mdAccessToken?: string;
  expirationTime: string;
  userId: number;
  name: string;
  errorText?: string;
}

interface TradovateAccount {
  id: number;
  name: string;
  userId: number;
  accountType: string;
  active: boolean;
  clearingHouseId: number;
  riskCategoryId: number;
  autoLiqProfileId: number;
  marginAccountType: string;
  legalStatus: string;
  archived: boolean;
  timestamp: string;
}

interface TradovateFill {
  id: number;
  orderId: number;
  contractId: number;
  timestamp: string;
  tradeDate: { year: number; month: number; day: number };
  action: 'Buy' | 'Sell';
  qty: number;
  price: number;
  active: boolean;
  finallyPaired: number;
}

interface TradovateContract {
  id: number;
  name: string;
  contractMaturityId: number;
  status: string;
  providerTickSize: number;
}

interface TradovatePosition {
  id: number;
  accountId: number;
  contractId: number;
  timestamp: string;
  tradeDate: { year: number; month: number; day: number };
  netPos: number;
  netPrice: number;
  bought: number;
  boughtValue: number;
  sold: number;
  soldValue: number;
  prevPos: number;
  prevPrice: number;
}

// ============================================================================
// TRADOVATE PROVIDER
// ============================================================================

const TRADOVATE_API_BASE = {
  demo: 'https://demo.tradovateapi.com/v1',
  live: 'https://live.tradovateapi.com/v1',
};

export class TradovateProvider implements BrokerProvider {
  readonly brokerType = BrokerType.TRADOVATE;
  
  private environment: 'demo' | 'live';
  private contractCache: Map<number, TradovateContract> = new Map();
  
  constructor(environment: 'demo' | 'live' = 'live') {
    this.environment = environment;
  }
  
  private get baseUrl(): string {
    return TRADOVATE_API_BASE[this.environment];
  }
  
  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================
  
  async authenticate(credentials: BrokerCredentials): Promise<AuthResult> {
    const tradovateCredentials = credentials as TradovateCredentials;
    
    // Use the specified environment or default
    if (tradovateCredentials.environment) {
      this.environment = tradovateCredentials.environment;
    }
    
    const authPayload: TradovateAuthRequest = {
      name: credentials.apiKey,
      password: credentials.apiSecret,
      appId: 'TradingJournal',
      appVersion: '1.0.0',
    };
    
    try {
      const response = await fetch(`${this.baseUrl}/auth/accesstokenrequest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(authPayload),
      });
      
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          throw new BrokerRateLimitError(
            'Tradovate rate limit exceeded',
            retryAfter ? parseInt(retryAfter) * 1000 : 60000
          );
        }
        
        const errorText = await response.text();
        throw new BrokerAuthError(`Tradovate auth failed: ${errorText}`);
      }
      
      const data: TradovateAuthResponse = await response.json();
      
      if (data.errorText) {
        throw new BrokerAuthError(`Tradovate auth failed: ${data.errorText}`);
      }
      
      return {
        accessToken: data.accessToken,
        expiresAt: new Date(data.expirationTime),
        userId: data.userId.toString(),
      };
    } catch (error) {
      if (error instanceof BrokerAuthError || error instanceof BrokerRateLimitError) {
        throw error;
      }
      throw new BrokerAuthError(
        `Failed to authenticate with Tradovate: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  async refreshToken(accessToken: string): Promise<AuthResult | null> {
    // Tradovate tokens are typically long-lived (24h)
    // For now, we'll just re-authenticate when needed
    // A proper implementation would use the /auth/renewAccessToken endpoint
    return null;
  }
  
  // ==========================================================================
  // ACCOUNTS
  // ==========================================================================
  
  async getAccounts(accessToken: string): Promise<BrokerAccount[]> {
    const response = await this.apiRequest<TradovateAccount[]>(
      accessToken,
      '/account/list'
    );
    
    return response
      .filter(acc => acc.active && !acc.archived)
      .map(acc => ({
        id: acc.id.toString(),
        name: acc.name,
        currency: 'USD', // Tradovate uses USD
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
    // Get fills for the account
    const fills = await this.apiRequest<TradovateFill[]>(
      accessToken,
      '/fill/list'
    );
    
    // Filter fills for this account and since date
    const relevantFills = fills.filter(fill => {
      if (since) {
        const fillDate = new Date(fill.timestamp);
        if (fillDate < since) return false;
      }
      return fill.active;
    });
    
    // Group fills into trades
    // Tradovate returns individual fills, we need to pair them into complete trades
    const trades = await this.aggregateFillsToTrades(accessToken, relevantFills);
    
    return trades;
  }
  
  /**
   * Aggregates individual fills into complete trades.
   * 
   * Tradovate returns fills (individual executions), not trades.
   * We need to pair opening and closing fills to create complete trades.
   */
  private async aggregateFillsToTrades(
    accessToken: string,
    fills: TradovateFill[]
  ): Promise<BrokerTrade[]> {
    const trades: BrokerTrade[] = [];
    
    // Group fills by contract
    const fillsByContract = new Map<number, TradovateFill[]>();
    for (const fill of fills) {
      const existing = fillsByContract.get(fill.contractId) || [];
      existing.push(fill);
      fillsByContract.set(fill.contractId, existing);
    }
    
    // Process each contract's fills
    for (const [contractId, contractFills] of fillsByContract) {
      // Get contract details for symbol
      const contract = await this.getContract(accessToken, contractId);
      const symbol = contract?.name || `CONTRACT_${contractId}`;
      
      // Sort by timestamp
      contractFills.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      // Track position and match fills
      let position = 0;
      let entryFills: TradovateFill[] = [];
      
      for (const fill of contractFills) {
        const qty = fill.action === 'Buy' ? fill.qty : -fill.qty;
        const previousPosition = position;
        position += qty;
        
        // Check if this fill is opening or closing
        if (
          (previousPosition >= 0 && qty > 0) ||
          (previousPosition <= 0 && qty < 0)
        ) {
          // Opening fill
          entryFills.push(fill);
        } else {
          // Closing fill - create trade
          if (entryFills.length > 0) {
            const trade = this.createTradeFromFills(symbol, entryFills, fill);
            if (trade) {
              trades.push(trade);
            }
            
            // Clear entry fills if position is flat
            if (position === 0) {
              entryFills = [];
            }
          }
        }
      }
    }
    
    return trades;
  }
  
  private createTradeFromFills(
    symbol: string,
    entryFills: TradovateFill[],
    exitFill: TradovateFill
  ): BrokerTrade | null {
    if (entryFills.length === 0) return null;
    
    // Calculate weighted average entry price
    const totalQty = entryFills.reduce((sum, f) => sum + f.qty, 0);
    const weightedEntryPrice = entryFills.reduce(
      (sum, f) => sum + f.price * f.qty,
      0
    ) / totalQty;
    
    const direction = entryFills[0].action === 'Buy' ? 'LONG' : 'SHORT';
    const entryPrice = weightedEntryPrice;
    const exitPrice = exitFill.price;
    const quantity = Math.min(totalQty, exitFill.qty);
    
    // Calculate PnL
    const priceDiff = direction === 'LONG' 
      ? exitPrice - entryPrice 
      : entryPrice - exitPrice;
    const realizedPnl = priceDiff * quantity;
    
    const firstEntry = entryFills[0];
    
    return {
      brokerTradeId: `${firstEntry.id}-${exitFill.id}`,
      symbol,
      direction: direction as 'LONG' | 'SHORT',
      openedAt: new Date(firstEntry.timestamp),
      closedAt: new Date(exitFill.timestamp),
      entryPrice,
      exitPrice,
      quantity,
      realizedPnl,
      metadata: {
        entryFillIds: entryFills.map(f => f.id),
        exitFillId: exitFill.id,
        entryOrderId: firstEntry.orderId,
        exitOrderId: exitFill.orderId,
      },
    };
  }
  
  // ==========================================================================
  // CONTRACTS (SYMBOL LOOKUP)
  // ==========================================================================
  
  private async getContract(
    accessToken: string,
    contractId: number
  ): Promise<TradovateContract | null> {
    // Check cache first
    if (this.contractCache.has(contractId)) {
      return this.contractCache.get(contractId)!;
    }
    
    try {
      const contract = await this.apiRequest<TradovateContract>(
        accessToken,
        `/contract/item?id=${contractId}`
      );
      
      this.contractCache.set(contractId, contract);
      return contract;
    } catch {
      return null;
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
    const url = `${this.baseUrl}${endpoint}`;
    
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
      if (response.status === 401) {
        throw new BrokerAuthError('Tradovate access token expired or invalid');
      }
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new BrokerRateLimitError(
          'Tradovate rate limit exceeded',
          retryAfter ? parseInt(retryAfter) * 1000 : 60000
        );
      }
      
      const errorText = await response.text();
      throw new BrokerApiError(
        `Tradovate API error: ${errorText}`,
        response.status
      );
    }
    
    return response.json();
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createTradovateProvider(
  environment: 'demo' | 'live' = 'live'
): TradovateProvider {
  return new TradovateProvider(environment);
}

