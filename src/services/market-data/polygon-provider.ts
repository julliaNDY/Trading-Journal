/**
 * Polygon.io Market Data Provider
 * POC-2: Market Data Providers Validation
 *
 * Polygon.io (now Massive.com) provides comprehensive tick data
 * with 20+ years of historical data.
 *
 * Documentation: https://polygon.io/docs
 */

import {
  MarketDataProvider,
  MarketDataProviderType,
  AssetClass,
  PolygonConfig,
  TickDataRequest,
  TickDataResponse,
  BarDataRequest,
  BarDataResponse,
  TradeTick,
  QuoteTick,
  Bar,
  MarketDataError,
  Timeframe,
} from './types';

const POLYGON_BASE_URL = 'https://api.polygon.io';

/**
 * Polygon.io Market Data Provider Implementation
 *
 * Pricing tiers:
 * - Free: Very limited
 * - Starter ($29/mo): 15-min delayed
 * - Developer ($79/mo): Real-time aggregates
 * - Advanced ($199/mo): Real-time trades & quotes
 * - Business ($1,999/mo): Full tick history
 */
export class PolygonProvider implements MarketDataProvider {
  readonly name: MarketDataProviderType = 'polygon';
  readonly supportedAssets: AssetClass[] = ['stocks', 'etfs', 'options', 'forex', 'crypto'];

  private config: PolygonConfig;
  private rateLimitRemaining: number = 5; // Free tier: 5 req/min
  private rateLimitResetAt: Date = new Date();

  constructor(config?: PolygonConfig) {
    this.config = {
      apiKey: config?.apiKey || process.env.POLYGON_API_KEY || '',
      baseUrl: config?.baseUrl || POLYGON_BASE_URL,
      timeout: config?.timeout || 30000,
      debug: config?.debug || false,
      tier: config?.tier || 'free',
    };
  }

  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  async testConnection(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      return {
        success: false,
        latencyMs: 0,
        error: 'Polygon API key not configured',
      };
    }

    try {
      // Test with a simple ticker details request
      const response = await this.fetchWithAuth('/v3/reference/tickers/AAPL');

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          latencyMs,
          error: `HTTP ${response.status}: ${error}`,
        };
      }

      return {
        success: true,
        latencyMs,
      };
    } catch (error) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getTrades(request: TickDataRequest): Promise<TickDataResponse> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      throw new MarketDataError(
        'Polygon API key not configured',
        'polygon',
        'NOT_CONFIGURED',
        false
      );
    }

    const date = this.formatDateForTicks(request.startDate);

    const params = new URLSearchParams({
      ...(request.limit && { limit: request.limit.toString() }),
    });

    try {
      // Polygon uses date-based endpoint for tick data
      const response = await this.fetchWithAuth(
        `/v2/ticks/stocks/trades/${request.symbol}/${date}?${params.toString()}`
      );

      this.updateRateLimits(response);

      if (!response.ok) {
        await this.handleErrorResponse(response, request.symbol);
      }

      const data = await response.json();
      const trades = this.mapTrades(data.results || []);

      return {
        symbol: request.symbol,
        trades,
        provider: 'polygon',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      if (error instanceof MarketDataError) throw error;
      throw new MarketDataError(
        error instanceof Error ? error.message : 'Network error',
        'polygon',
        'NETWORK_ERROR',
        true
      );
    }
  }

  async getQuotes(request: TickDataRequest): Promise<TickDataResponse> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      throw new MarketDataError(
        'Polygon API key not configured',
        'polygon',
        'NOT_CONFIGURED',
        false
      );
    }

    const date = this.formatDateForTicks(request.startDate);

    const params = new URLSearchParams({
      ...(request.limit && { limit: request.limit.toString() }),
    });

    try {
      // NBBO (National Best Bid and Offer) quotes
      const response = await this.fetchWithAuth(
        `/v2/ticks/stocks/nbbo/${request.symbol}/${date}?${params.toString()}`
      );

      this.updateRateLimits(response);

      if (!response.ok) {
        await this.handleErrorResponse(response, request.symbol);
      }

      const data = await response.json();
      const quotes = this.mapQuotes(data.results || []);

      return {
        symbol: request.symbol,
        quotes,
        provider: 'polygon',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      if (error instanceof MarketDataError) throw error;
      throw new MarketDataError(
        error instanceof Error ? error.message : 'Network error',
        'polygon',
        'NETWORK_ERROR',
        true
      );
    }
  }

  async getBars(request: BarDataRequest): Promise<BarDataResponse> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      throw new MarketDataError(
        'Polygon API key not configured',
        'polygon',
        'NOT_CONFIGURED',
        false
      );
    }

    const { multiplier, timespan } = this.parseTimeframe(request.timeframe);
    const startDate = this.formatDateForBars(request.startDate);
    const endDate = this.formatDateForBars(request.endDate);

    const params = new URLSearchParams({
      ...(request.adjusted !== undefined && { adjusted: request.adjusted.toString() }),
      ...(request.limit && { limit: request.limit.toString() }),
      sort: 'asc',
    });

    try {
      const response = await this.fetchWithAuth(
        `/v2/aggs/ticker/${request.symbol}/range/${multiplier}/${timespan}/${startDate}/${endDate}?${params.toString()}`
      );

      this.updateRateLimits(response);

      if (!response.ok) {
        await this.handleErrorResponse(response, request.symbol);
      }

      const data = await response.json();
      const bars = this.mapBars(data.results || []);

      return {
        symbol: request.symbol,
        bars,
        timeframe: request.timeframe,
        nextPageToken: data.next_url,
        provider: 'polygon',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      if (error instanceof MarketDataError) throw error;
      throw new MarketDataError(
        error instanceof Error ? error.message : 'Network error',
        'polygon',
        'NETWORK_ERROR',
        true
      );
    }
  }

  getRateLimitStatus(): { remaining: number; resetAt: Date } {
    return {
      remaining: this.rateLimitRemaining,
      resetAt: this.rateLimitResetAt,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async fetchWithAuth(endpoint: string): Promise<Response> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const separator = endpoint.includes('?') ? '&' : '?';
    const urlWithKey = `${url}${separator}apiKey=${this.config.apiKey}`;

    if (this.config.debug) {
      console.log(`[Polygon] Request: ${url}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(urlWithKey, {
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private updateRateLimits(response: Response): void {
    // Polygon doesn't provide rate limit headers in the same way
    // We track based on tier
    const tierLimits: Record<string, number> = {
      free: 5,
      starter: 100,
      developer: 1000,
      advanced: 5000,
      business: -1, // unlimited
    };
    this.rateLimitRemaining = tierLimits[this.config.tier || 'free'] || 5;
  }

  private async handleErrorResponse(response: Response, symbol: string): Promise<never> {
    const errorBody = await response.text();
    let errorMessage = `HTTP ${response.status}`;

    try {
      const errorJson = JSON.parse(errorBody);
      errorMessage = errorJson.error || errorJson.message || errorBody;
    } catch {
      errorMessage = errorBody || `HTTP ${response.status}`;
    }

    switch (response.status) {
      case 401:
      case 403:
        throw new MarketDataError(errorMessage, 'polygon', 'UNAUTHORIZED', false);
      case 429:
        throw new MarketDataError(errorMessage, 'polygon', 'RATE_LIMITED', true);
      case 404:
        throw new MarketDataError(`Symbol not found: ${symbol}`, 'polygon', 'INVALID_SYMBOL', false);
      case 400:
        throw new MarketDataError(errorMessage, 'polygon', 'INVALID_SYMBOL', false);
      default:
        throw new MarketDataError(errorMessage, 'polygon', 'PROVIDER_ERROR', true);
    }
  }

  private formatDateForTicks(date: string | Date): string {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private formatDateForBars(date: string | Date): string {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private parseTimeframe(timeframe: Timeframe): { multiplier: number; timespan: string } {
    const mapping: Record<Timeframe, { multiplier: number; timespan: string }> = {
      '1min': { multiplier: 1, timespan: 'minute' },
      '5min': { multiplier: 5, timespan: 'minute' },
      '15min': { multiplier: 15, timespan: 'minute' },
      '30min': { multiplier: 30, timespan: 'minute' },
      '1hour': { multiplier: 1, timespan: 'hour' },
      '4hour': { multiplier: 4, timespan: 'hour' },
      '1day': { multiplier: 1, timespan: 'day' },
      '1week': { multiplier: 1, timespan: 'week' },
      '1month': { multiplier: 1, timespan: 'month' },
    };
    return mapping[timeframe] || { multiplier: 1, timespan: 'minute' };
  }

  private mapTrades(rawTrades: PolygonRawTrade[]): TradeTick[] {
    return rawTrades.map((trade) => ({
      timestamp: trade.t, // Polygon uses Unix nanoseconds, convert to ms
      datetime: new Date(trade.t / 1000000).toISOString(),
      price: trade.p,
      size: trade.s,
      exchange: this.mapExchangeId(trade.x),
      conditions: trade.c?.map((c) => c.toString()),
      tradeId: trade.i,
    }));
  }

  private mapQuotes(rawQuotes: PolygonRawQuote[]): QuoteTick[] {
    return rawQuotes.map((quote) => ({
      timestamp: quote.t, // Unix nanoseconds
      datetime: new Date(quote.t / 1000000).toISOString(),
      bidPrice: quote.p,
      bidSize: quote.s,
      askPrice: quote.P,
      askSize: quote.S,
      bidExchange: this.mapExchangeId(quote.x),
      askExchange: this.mapExchangeId(quote.X),
    }));
  }

  private mapBars(rawBars: PolygonRawBar[]): Bar[] {
    return rawBars.map((bar) => ({
      timestamp: bar.t, // Unix milliseconds
      datetime: new Date(bar.t).toISOString(),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      vwap: bar.vw,
      tradeCount: bar.n,
    }));
  }

  private mapExchangeId(id: number): string {
    // Polygon exchange ID mapping (partial)
    const exchanges: Record<number, string> = {
      1: 'NYSE',
      2: 'AMEX',
      3: 'NYSE_ARCA',
      4: 'NASDAQ',
      5: 'NASDAQ_BX',
      6: 'NASDAQ_PSX',
      7: 'EDGA',
      8: 'EDGX',
      9: 'BATS',
      10: 'BATS_Y',
      11: 'IEX',
      12: 'NYSE_NATIONAL',
    };
    return exchanges[id] || `EX_${id}`;
  }
}

// ============================================================================
// Polygon Raw Response Types
// ============================================================================

interface PolygonRawTrade {
  t: number; // timestamp (nanoseconds)
  p: number; // price
  s: number; // size
  x: number; // exchange id
  c?: number[]; // conditions
  i: string; // trade id
}

interface PolygonRawQuote {
  t: number; // timestamp (nanoseconds)
  p: number; // bid price
  s: number; // bid size
  P: number; // ask price
  S: number; // ask size
  x: number; // bid exchange
  X: number; // ask exchange
}

interface PolygonRawBar {
  t: number; // timestamp (milliseconds)
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  vw?: number; // vwap
  n?: number; // trade count
}

// Export for testing
export type { PolygonRawTrade, PolygonRawQuote, PolygonRawBar };
