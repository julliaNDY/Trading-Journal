/**
 * Market Data Provider Factory
 * POC-2: Market Data Providers Validation
 *
 * Factory for creating and managing market data providers with
 * automatic fallback support.
 */

import {
  MarketDataProvider,
  MarketDataProviderType,
  ProviderHealth,
  ProviderCapabilities,
  ProviderConfig,
  AlpacaConfig,
  PolygonConfig,
} from './types';
import { AlpacaProvider } from './alpaca-provider';
import { PolygonProvider } from './polygon-provider';

/**
 * Market Data Provider Factory
 *
 * Manages provider instances and provides fallback support.
 */
export class MarketDataProviderFactory {
  private providers: Map<MarketDataProviderType, MarketDataProvider> = new Map();
  private healthStatus: Map<MarketDataProviderType, ProviderHealth> = new Map();

  /**
   * Priority order for fallback
   * Primary: polygon (paid, full coverage)
   * Fallback 1: alpaca (free, IEX only)
   * Fallback 2: ibkr (user-specific, limited)
   */
  private providerPriority: MarketDataProviderType[] = ['polygon', 'alpaca', 'ibkr'];

  constructor() {
    // Initialize providers with default configs
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize Alpaca (free tier)
    this.providers.set('alpaca', new AlpacaProvider());

    // Initialize Polygon (requires API key)
    this.providers.set('polygon', new PolygonProvider());

    // IBKR would be added here when implemented
    // this.providers.set('ibkr', new IBKRProvider());
  }

  /**
   * Get a specific provider by type
   */
  getProvider(type: MarketDataProviderType): MarketDataProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * Get the best available provider based on configuration and health
   */
  async getBestProvider(): Promise<MarketDataProvider | null> {
    for (const providerType of this.providerPriority) {
      const provider = this.providers.get(providerType);
      if (!provider) continue;

      // Check if provider is configured
      if (!provider.isConfigured()) continue;

      // Check health status
      const health = await this.checkProviderHealth(providerType);
      if (health.status === 'healthy' || health.status === 'degraded') {
        return provider;
      }
    }

    return null;
  }

  /**
   * Get all configured providers
   */
  getConfiguredProviders(): MarketDataProvider[] {
    return Array.from(this.providers.values()).filter((p) => p.isConfigured());
  }

  /**
   * Check health of a specific provider
   */
  async checkProviderHealth(type: MarketDataProviderType): Promise<ProviderHealth> {
    const provider = this.providers.get(type);
    if (!provider) {
      return {
        provider: type,
        status: 'down',
        latencyMs: 0,
        lastChecked: new Date(),
        error: 'Provider not found',
      };
    }

    if (!provider.isConfigured()) {
      return {
        provider: type,
        status: 'down',
        latencyMs: 0,
        lastChecked: new Date(),
        error: 'Provider not configured',
      };
    }

    const result = await provider.testConnection();

    const health: ProviderHealth = {
      provider: type,
      status: result.success ? (result.latencyMs > 1000 ? 'degraded' : 'healthy') : 'down',
      latencyMs: result.latencyMs,
      lastChecked: new Date(),
      error: result.error,
    };

    this.healthStatus.set(type, health);
    return health;
  }

  /**
   * Check health of all configured providers
   */
  async checkAllProvidersHealth(): Promise<ProviderHealth[]> {
    const results: ProviderHealth[] = [];

    for (const [type] of this.providers) {
      const health = await this.checkProviderHealth(type);
      results.push(health);
    }

    return results;
  }

  /**
   * Configure a specific provider
   */
  configureProvider(
    type: MarketDataProviderType,
    config: ProviderConfig | AlpacaConfig | PolygonConfig
  ): void {
    switch (type) {
      case 'alpaca':
        this.providers.set('alpaca', new AlpacaProvider(config as AlpacaConfig));
        break;
      case 'polygon':
        this.providers.set('polygon', new PolygonProvider(config as PolygonConfig));
        break;
      // case 'ibkr':
      //   this.providers.set('ibkr', new IBKRProvider(config));
      //   break;
    }
  }

  /**
   * Get capabilities of all providers
   */
  getProviderCapabilities(): ProviderCapabilities[] {
    return [
      {
        provider: 'alpaca',
        assets: ['stocks', 'etfs', 'options', 'crypto'],
        tickData: true,
        quoteData: true,
        barData: true,
        websocket: true,
        historyDepthYears: 8, // Since 2016
        rateLimit: { requestsPerMinute: 200 },
        pricing: { tier: 'free', monthlyCost: 0 },
      },
      {
        provider: 'polygon',
        assets: ['stocks', 'etfs', 'options', 'forex', 'crypto'],
        tickData: true,
        quoteData: true,
        barData: true,
        websocket: true,
        historyDepthYears: 20,
        rateLimit: { requestsPerMinute: 5, requestsPerSecond: 5 },
        pricing: { tier: 'starter', monthlyCost: 29 },
      },
      {
        provider: 'ibkr',
        assets: ['stocks', 'etfs', 'options', 'futures', 'forex', 'crypto'],
        tickData: true,
        quoteData: true,
        barData: true,
        websocket: true,
        historyDepthYears: 0.5, // 6 months for ticks
        rateLimit: { requestsPerMinute: 6 },
        pricing: { tier: 'funded_account', monthlyCost: 0 },
      },
    ];
  }

  /**
   * Set provider priority for fallback
   */
  setProviderPriority(priority: MarketDataProviderType[]): void {
    this.providerPriority = priority;
  }

  /**
   * Get current provider priority
   */
  getProviderPriority(): MarketDataProviderType[] {
    return [...this.providerPriority];
  }

  /**
   * Get cached health status for a provider
   */
  getCachedHealth(type: MarketDataProviderType): ProviderHealth | undefined {
    return this.healthStatus.get(type);
  }
}

/**
 * Singleton instance of the provider factory
 */
let factoryInstance: MarketDataProviderFactory | null = null;

export function getMarketDataFactory(): MarketDataProviderFactory {
  if (!factoryInstance) {
    factoryInstance = new MarketDataProviderFactory();
  }
  return factoryInstance;
}

/**
 * Reset factory instance (for testing)
 */
export function resetMarketDataFactory(): void {
  factoryInstance = null;
}
