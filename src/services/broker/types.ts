/**
 * Broker Sync Types
 * 
 * Common types and interfaces for broker integrations.
 * Follows the Strategy pattern to allow multiple broker implementations.
 */

import type { BrokerType, Direction } from '@prisma/client';

// ============================================================================
// BROKER CREDENTIALS
// ============================================================================

export interface BrokerCredentials {
  apiKey: string;
  apiSecret: string;
}

export interface TradovateCredentials extends BrokerCredentials {
  environment?: 'demo' | 'live';
}

export interface IBKRFlexQueryCredentials extends BrokerCredentials {
  // apiKey = Flex Web Service Token
  // apiSecret = Flex Query ID
}

// ============================================================================
// BROKER ACCOUNT
// ============================================================================

export interface BrokerAccount {
  id: string;           // Broker's account ID
  name: string;         // Display name
  balance?: number;     // Current balance (if available)
  currency?: string;    // Account currency
}

// ============================================================================
// BROKER TRADE (RAW DATA FROM BROKER)
// ============================================================================

export interface BrokerTrade {
  // Required fields
  brokerTradeId: string;   // Unique ID from broker
  symbol: string;          // Contract/instrument symbol
  direction: Direction;    // LONG or SHORT
  openedAt: Date;
  closedAt: Date;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  realizedPnl: number;     // In account currency
  
  // Optional fields
  fees?: number;
  commission?: number;
  
  // Broker-specific metadata
  metadata?: Record<string, unknown>;
}

// ============================================================================
// SYNC RESULT
// ============================================================================

export interface SyncResult {
  success: boolean;
  tradesImported: number;
  tradesSkipped: number;   // Duplicates
  tradesUpdated: number;
  errors: SyncError[];
  durationMs: number;
}

export interface SyncError {
  brokerTradeId?: string;
  message: string;
  details?: unknown;
}

// ============================================================================
// BROKER PROVIDER INTERFACE
// ============================================================================

/**
 * Abstract interface for broker integrations.
 * Each broker (Tradovate, IBKR, etc.) must implement this interface.
 */
export interface BrokerProvider {
  /**
   * Broker type identifier
   */
  readonly brokerType: BrokerType;
  
  /**
   * Validates credentials and returns access token info
   * @throws BrokerAuthError if credentials are invalid
   */
  authenticate(credentials: BrokerCredentials): Promise<AuthResult>;
  
  /**
   * Refreshes the access token (if needed)
   * @returns New access token and expiry, or null if refresh not needed
   */
  refreshToken?(accessToken: string): Promise<AuthResult | null>;
  
  /**
   * Fetches list of trading accounts
   */
  getAccounts(accessToken: string): Promise<BrokerAccount[]>;
  
  /**
   * Fetches trades/fills from the broker
   * @param accessToken Valid access token
   * @param accountId Broker account ID
   * @param since Optional: Only fetch trades after this date
   */
  getTrades(
    accessToken: string,
    accountId: string,
    since?: Date
  ): Promise<BrokerTrade[]>;
  
  /**
   * Maps broker-specific trade data to our standard format
   * (Already handled in getTrades, but can be used separately)
   */
  mapTrade?(rawTrade: unknown): BrokerTrade;
}

// ============================================================================
// AUTH RESULT
// ============================================================================

export interface AuthResult {
  accessToken: string;
  expiresAt: Date;
  userId?: string;
}

// ============================================================================
// ERRORS
// ============================================================================

export class BrokerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'BrokerError';
  }
}

export class BrokerAuthError extends BrokerError {
  constructor(message: string, details?: unknown) {
    super(message, 'AUTH_ERROR', details);
    this.name = 'BrokerAuthError';
  }
}

export class BrokerRateLimitError extends BrokerError {
  constructor(
    message: string,
    public readonly retryAfterMs?: number
  ) {
    super(message, 'RATE_LIMIT');
    this.name = 'BrokerRateLimitError';
  }
}

export class BrokerApiError extends BrokerError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    details?: unknown
  ) {
    super(message, 'API_ERROR', details);
    this.name = 'BrokerApiError';
  }
}

