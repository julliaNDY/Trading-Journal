/**
 * Market Data Provider Types
 * POC-2: Market Data Providers Validation
 *
 * This module defines the interfaces and types for market data providers
 * used in the Market Replay and Backtesting features.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Supported market data providers
 */
export type MarketDataProviderType = 'alpaca' | 'polygon' | 'ibkr';

/**
 * Asset classes supported by market data providers
 */
export type AssetClass = 'stocks' | 'etfs' | 'options' | 'futures' | 'forex' | 'crypto';

/**
 * Timeframe for aggregated data (bars)
 */
export type Timeframe =
  | '1min'
  | '5min'
  | '15min'
  | '30min'
  | '1hour'
  | '4hour'
  | '1day'
  | '1week'
  | '1month';

// ============================================================================
// Tick Data Types
// ============================================================================

/**
 * Individual trade tick
 */
export interface TradeTick {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** ISO 8601 datetime string */
  datetime: string;
  /** Trade price */
  price: number;
  /** Trade size/volume */
  size: number;
  /** Exchange identifier */
  exchange?: string;
  /** Trade conditions (e.g., 'regular', 'odd_lot') */
  conditions?: string[];
  /** Unique trade ID from provider */
  tradeId?: string;
}

/**
 * Quote tick (best bid/ask)
 */
export interface QuoteTick {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** ISO 8601 datetime string */
  datetime: string;
  /** Best bid price */
  bidPrice: number;
  /** Best bid size */
  bidSize: number;
  /** Best ask price */
  askPrice: number;
  /** Best ask size */
  askSize: number;
  /** Bid exchange */
  bidExchange?: string;
  /** Ask exchange */
  askExchange?: string;
}

/**
 * Aggregated bar/candlestick data
 */
export interface Bar {
  /** Unix timestamp in milliseconds (bar open time) */
  timestamp: number;
  /** ISO 8601 datetime string */
  datetime: string;
  /** Open price */
  open: number;
  /** High price */
  high: number;
  /** Low price */
  low: number;
  /** Close price */
  close: number;
  /** Volume */
  volume: number;
  /** Volume-weighted average price */
  vwap?: number;
  /** Number of trades in bar */
  tradeCount?: number;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Request for historical tick data
 */
export interface TickDataRequest {
  /** Stock/asset symbol (e.g., 'AAPL', 'BTC/USD') */
  symbol: string;
  /** Start datetime (ISO 8601 or Date) */
  startDate: string | Date;
  /** End datetime (ISO 8601 or Date) */
  endDate: string | Date;
  /** Type of tick data to fetch */
  tickType: 'trades' | 'quotes' | 'both';
  /** Maximum number of ticks to return */
  limit?: number;
}

/**
 * Request for historical bar data
 */
export interface BarDataRequest {
  /** Stock/asset symbol */
  symbol: string;
  /** Start datetime */
  startDate: string | Date;
  /** End datetime */
  endDate: string | Date;
  /** Bar timeframe */
  timeframe: Timeframe;
  /** Maximum number of bars to return */
  limit?: number;
  /** Adjust for splits/dividends */
  adjusted?: boolean;
}

/**
 * Response wrapper for tick data
 */
export interface TickDataResponse {
  /** Request symbol */
  symbol: string;
  /** Trade ticks (if requested) */
  trades?: TradeTick[];
  /** Quote ticks (if requested) */
  quotes?: QuoteTick[];
  /** Next page token for pagination */
  nextPageToken?: string;
  /** Provider used */
  provider: MarketDataProviderType;
  /** Response latency in ms */
  latencyMs: number;
}

/**
 * Response wrapper for bar data
 */
export interface BarDataResponse {
  /** Request symbol */
  symbol: string;
  /** Bar data */
  bars: Bar[];
  /** Timeframe */
  timeframe: Timeframe;
  /** Next page token for pagination */
  nextPageToken?: string;
  /** Provider used */
  provider: MarketDataProviderType;
  /** Response latency in ms */
  latencyMs: number;
}

// ============================================================================
// Provider Configuration
// ============================================================================

/**
 * Base configuration for any provider
 */
export interface ProviderConfig {
  /** API key (if required) */
  apiKey?: string;
  /** API secret (if required) */
  apiSecret?: string;
  /** Base URL override */
  baseUrl?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Alpaca-specific configuration
 */
export interface AlpacaConfig extends ProviderConfig {
  /** Use paper trading endpoint */
  paper?: boolean;
  /** Data feed: 'iex' (free) or 'sip' (paid) */
  feed?: 'iex' | 'sip';
}

/**
 * Polygon-specific configuration
 */
export interface PolygonConfig extends ProviderConfig {
  /** Subscription tier for rate limit handling */
  tier?: 'free' | 'starter' | 'developer' | 'advanced' | 'business';
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Market Data Provider Interface
 *
 * All market data providers must implement this interface.
 * This allows for easy swapping of providers and fallback strategies.
 */
export interface MarketDataProvider {
  /** Provider identifier */
  readonly name: MarketDataProviderType;

  /** Supported asset classes */
  readonly supportedAssets: AssetClass[];

  /** Check if provider is configured and ready */
  isConfigured(): boolean;

  /** Test connection to provider API */
  testConnection(): Promise<{ success: boolean; latencyMs: number; error?: string }>;

  /**
   * Fetch historical trade ticks
   */
  getTrades(request: TickDataRequest): Promise<TickDataResponse>;

  /**
   * Fetch historical quote ticks
   */
  getQuotes(request: TickDataRequest): Promise<TickDataResponse>;

  /**
   * Fetch historical bars (OHLCV)
   */
  getBars(request: BarDataRequest): Promise<BarDataResponse>;

  /**
   * Get rate limit status
   */
  getRateLimitStatus(): { remaining: number; resetAt: Date };
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Market data provider error
 */
export class MarketDataError extends Error {
  constructor(
    message: string,
    public readonly provider: MarketDataProviderType,
    public readonly code: MarketDataErrorCode,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'MarketDataError';
  }
}

export type MarketDataErrorCode =
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'INVALID_SYMBOL'
  | 'NO_DATA'
  | 'NETWORK_ERROR'
  | 'PROVIDER_ERROR'
  | 'TIMEOUT'
  | 'NOT_CONFIGURED';

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Provider health status
 */
export interface ProviderHealth {
  provider: MarketDataProviderType;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number;
  lastChecked: Date;
  error?: string;
}

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
  provider: MarketDataProviderType;
  assets: AssetClass[];
  tickData: boolean;
  quoteData: boolean;
  barData: boolean;
  websocket: boolean;
  historyDepthYears: number;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerSecond?: number;
  };
  pricing: {
    tier: string;
    monthlyCost: number;
  };
}
