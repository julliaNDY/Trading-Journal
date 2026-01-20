/**
 * Alpaca Market Data Provider
 * POC-2: Market Data Providers Validation
 *
 * Alpaca provides free tier access to historical market data (IEX exchange).
 * This is the recommended fallback/development provider.
 *
 * Documentation: https://docs.alpaca.markets/docs/about-market-data-api
 */

import {
  MarketDataProvider,
  MarketDataProviderType,
  AssetClass,
  AlpacaConfig,
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

const ALPACA_DATA_URL = 'https://data.alpaca.markets';
const ALPACA_PAPER_URL = 'https://paper-api.alpaca.markets';

/**
 * Alpaca Market Data Provider Implementation
 *
 * Free tier limitations:
 * - IEX exchange only (not all US exchanges)
 * - 200 requests per minute
 * - 15-minute delay for SIP data
 */
export class AlpacaProvider implements MarketDataProvider {
  readonly name: MarketDataProviderType = 'alpaca';
  readonly supportedAssets: AssetClass[] = ['stocks', 'etfs', 'options', 'crypto'];

  private config: AlpacaConfig;
  private rateLimitRemaining: number = 200;
  private rateLimitResetAt: Date = new Date();

  constructor(config?: AlpacaConfig) {
    this.config = {
      apiKey: config?.apiKey || process.env.ALPACA_API_KEY || '',
      apiSecret: config?.apiSecret || process.env.ALPACA_API_SECRET || '',
      baseUrl: config?.baseUrl || ALPACA_DATA_URL,
      timeout: config?.timeout || 30000,
      debug: config?.debug || false,
      paper: config?.paper || false,
      feed: config?.feed || 'iex', // Free tier uses IEX
    };
  }

  isConfigured(): boolean {
    return !!(this.config.apiKey && this.config.apiSecret);
  }

  async testConnection(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      return {
        success: false,
        latencyMs: 0,
        error: 'Alpaca API keys not configured',
      };
    }

    try {
      // Test with a simple bars request for AAPL
      const response = await this.fetchWithAuth(
        `/v2/stocks/AAPL/bars/latest?feed=${this.config.feed}`
      );

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
        'Alpaca API keys not configured',
        'alpaca',
        'NOT_CONFIGURED',
        false
      );
    }

    const startDate = this.formatDate(request.startDate);
    const endDate = this.formatDate(request.endDate);

    const params = new URLSearchParams({
      start: startDate,
      end: endDate,
      feed: this.config.feed || 'iex',
      ...(request.limit && { limit: request.limit.toString() }),
    });

    try {
      const response = await this.fetchWithAuth(
        `/v2/stocks/${request.symbol}/trades?${params.toString()}`
      );

      this.updateRateLimits(response);

      if (!response.ok) {
        await this.handleErrorResponse(response, request.symbol);
      }

      const data = await response.json();
      const trades = this.mapTrades(data.trades || []);

      return {
        symbol: request.symbol,
        trades,
        nextPageToken: data.next_page_token,
        provider: 'alpaca',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      if (error instanceof MarketDataError) throw error;
      throw new MarketDataError(
        error instanceof Error ? error.message : 'Network error',
        'alpaca',
        'NETWORK_ERROR',
        true
      );
    }
  }

  async getQuotes(request: TickDataRequest): Promise<TickDataResponse> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      throw new MarketDataError(
        'Alpaca API keys not configured',
        'alpaca',
        'NOT_CONFIGURED',
        false
      );
    }

    const startDate = this.formatDate(request.startDate);
    const endDate = this.formatDate(request.endDate);

    const params = new URLSearchParams({
      start: startDate,
      end: endDate,
      feed: this.config.feed || 'iex',
      ...(request.limit && { limit: request.limit.toString() }),
    });

    try {
      const response = await this.fetchWithAuth(
        `/v2/stocks/${request.symbol}/quotes?${params.toString()}`
      );

      this.updateRateLimits(response);

      if (!response.ok) {
        await this.handleErrorResponse(response, request.symbol);
      }

      const data = await response.json();
      const quotes = this.mapQuotes(data.quotes || []);

      return {
        symbol: request.symbol,
        quotes,
        nextPageToken: data.next_page_token,
        provider: 'alpaca',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      if (error instanceof MarketDataError) throw error;
      throw new MarketDataError(
        error instanceof Error ? error.message : 'Network error',
        'alpaca',
        'NETWORK_ERROR',
        true
      );
    }
  }

  async getBars(request: BarDataRequest): Promise<BarDataResponse> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      throw new MarketDataError(
        'Alpaca API keys not configured',
        'alpaca',
        'NOT_CONFIGURED',
        false
      );
    }

    const startDate = this.formatDate(request.startDate);
    const endDate = this.formatDate(request.endDate);
    const timeframe = this.mapTimeframe(request.timeframe);

    const params = new URLSearchParams({
      start: startDate,
      end: endDate,
      timeframe,
      feed: this.config.feed || 'iex',
      ...(request.limit && { limit: request.limit.toString() }),
      ...(request.adjusted !== undefined && { adjustment: request.adjusted ? 'all' : 'raw' }),
    });

    try {
      const response = await this.fetchWithAuth(
        `/v2/stocks/${request.symbol}/bars?${params.toString()}`
      );

      this.updateRateLimits(response);

      if (!response.ok) {
        await this.handleErrorResponse(response, request.symbol);
      }

      const data = await response.json();
      const bars = this.mapBars(data.bars || []);

      return {
        symbol: request.symbol,
        bars,
        timeframe: request.timeframe,
        nextPageToken: data.next_page_token,
        provider: 'alpaca',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      if (error instanceof MarketDataError) throw error;
      throw new MarketDataError(
        error instanceof Error ? error.message : 'Network error',
        'alpaca',
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

    if (this.config.debug) {
      console.log(`[Alpaca] Request: ${url}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        headers: {
          'APCA-API-KEY-ID': this.config.apiKey!,
          'APCA-API-SECRET-KEY': this.config.apiSecret!,
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
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');

    if (remaining) {
      this.rateLimitRemaining = parseInt(remaining, 10);
    }
    if (reset) {
      this.rateLimitResetAt = new Date(parseInt(reset, 10) * 1000);
    }
  }

  private async handleErrorResponse(response: Response, symbol: string): Promise<never> {
    const errorBody = await response.text();
    let errorMessage = `HTTP ${response.status}`;

    try {
      const errorJson = JSON.parse(errorBody);
      errorMessage = errorJson.message || errorBody;
    } catch {
      errorMessage = errorBody || `HTTP ${response.status}`;
    }

    switch (response.status) {
      case 401:
      case 403:
        throw new MarketDataError(errorMessage, 'alpaca', 'UNAUTHORIZED', false);
      case 429:
        throw new MarketDataError(errorMessage, 'alpaca', 'RATE_LIMITED', true);
      case 404:
        throw new MarketDataError(`Symbol not found: ${symbol}`, 'alpaca', 'INVALID_SYMBOL', false);
      case 422:
        throw new MarketDataError(errorMessage, 'alpaca', 'INVALID_SYMBOL', false);
      default:
        throw new MarketDataError(errorMessage, 'alpaca', 'PROVIDER_ERROR', true);
    }
  }

  private formatDate(date: string | Date): string {
    if (date instanceof Date) {
      return date.toISOString();
    }
    // Assume it's already ISO format
    return new Date(date).toISOString();
  }

  private mapTimeframe(timeframe: Timeframe): string {
    const mapping: Record<Timeframe, string> = {
      '1min': '1Min',
      '5min': '5Min',
      '15min': '15Min',
      '30min': '30Min',
      '1hour': '1Hour',
      '4hour': '4Hour',
      '1day': '1Day',
      '1week': '1Week',
      '1month': '1Month',
    };
    return mapping[timeframe] || '1Min';
  }

  private mapTrades(rawTrades: AlpacaRawTrade[]): TradeTick[] {
    return rawTrades.map((trade) => ({
      timestamp: new Date(trade.t).getTime(),
      datetime: trade.t,
      price: trade.p,
      size: trade.s,
      exchange: trade.x,
      conditions: trade.c,
      tradeId: trade.i?.toString(),
    }));
  }

  private mapQuotes(rawQuotes: AlpacaRawQuote[]): QuoteTick[] {
    return rawQuotes.map((quote) => ({
      timestamp: new Date(quote.t).getTime(),
      datetime: quote.t,
      bidPrice: quote.bp,
      bidSize: quote.bs,
      askPrice: quote.ap,
      askSize: quote.as,
      bidExchange: quote.bx,
      askExchange: quote.ax,
    }));
  }

  private mapBars(rawBars: AlpacaRawBar[]): Bar[] {
    return rawBars.map((bar) => ({
      timestamp: new Date(bar.t).getTime(),
      datetime: bar.t,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      vwap: bar.vw,
      tradeCount: bar.n,
    }));
  }
}

// ============================================================================
// Alpaca Raw Response Types
// ============================================================================

interface AlpacaRawTrade {
  t: string; // timestamp
  p: number; // price
  s: number; // size
  x: string; // exchange
  c?: string[]; // conditions
  i?: number; // trade id
}

interface AlpacaRawQuote {
  t: string; // timestamp
  bp: number; // bid price
  bs: number; // bid size
  ap: number; // ask price
  as: number; // ask size
  bx: string; // bid exchange
  ax: string; // ask exchange
}

interface AlpacaRawBar {
  t: string; // timestamp
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  vw?: number; // vwap
  n?: number; // trade count
}

// Export for testing
export type { AlpacaRawTrade, AlpacaRawQuote, AlpacaRawBar };
