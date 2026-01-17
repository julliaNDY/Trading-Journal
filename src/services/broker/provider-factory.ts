/**
 * Broker Provider Factory
 * Story 3.3: Broker Sync Architecture - Factory Pattern
 * 
 * Provides extensible factory for creating broker providers:
 * - Registry-based provider management
 * - Automatic provider discovery
 * - Provider metadata and capabilities
 * - Easy addition of new brokers
 */

import { BrokerType } from '@prisma/client';
import { BrokerProvider } from './types';
import { createTradovateProvider } from './tradovate-provider';
import { createIBKRFlexQueryProvider } from './ibkr-flex-query-provider';
import { createBinanceProvider } from './binance-provider';
import { createAlpacaProvider } from './alpaca-provider';
import { createOandaProvider } from './oanda-provider';
import { createTopstepXProvider } from './topstepx-provider';
import { brokerLogger } from '@/lib/logger';

// ============================================================================
// PROVIDER METADATA
// ============================================================================

export interface ProviderMetadata {
  brokerType: BrokerType;
  name: string;
  description: string;
  authType: 'api_key' | 'oauth' | 'flex_query';
  supportsRealtime: boolean;
  supportsHistorical: boolean;
  maxHistoricalDays: number;
  requiresEnvironment: boolean;
  documentationUrl?: string;
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerHour?: number;
  };
}

export const PROVIDER_METADATA: Record<BrokerType, ProviderMetadata> = {
  TRADOVATE: {
    brokerType: 'TRADOVATE',
    name: 'Tradovate',
    description: 'Futures trading platform with real-time API access',
    authType: 'api_key',
    supportsRealtime: true,
    supportsHistorical: true,
    maxHistoricalDays: 365,
    requiresEnvironment: true,
    documentationUrl: 'https://api.tradovate.com',
    rateLimit: {
      requestsPerMinute: 100,
      requestsPerHour: 5000,
    },
  },
  IBKR: {
    brokerType: 'IBKR',
    name: 'Interactive Brokers',
    description: 'Global broker with Flex Query API for historical data',
    authType: 'flex_query',
    supportsRealtime: false,
    supportsHistorical: true,
    maxHistoricalDays: 365,
    requiresEnvironment: false,
    documentationUrl: 'https://www.interactivebrokers.com/en/software/am/am/reports/flex_web_service_version_3.htm',
    rateLimit: {
      requestsPerMinute: 50,
    },
  },
  ALPACA: {
    brokerType: 'ALPACA',
    name: 'Alpaca',
    description: 'Commission-free stock & options trading with REST API',
    authType: 'api_key',
    supportsRealtime: true,
    supportsHistorical: true,
    maxHistoricalDays: 365,
    requiresEnvironment: true,
    documentationUrl: 'https://alpaca.markets/docs',
    rateLimit: {
      requestsPerMinute: 200,
      requestsPerHour: 5000,
    },
  },
  NINJATRADER: {
    brokerType: 'NINJATRADER',
    name: 'NinjaTrader',
    description: 'Advanced futures & forex platform',
    authType: 'api_key',
    supportsRealtime: true,
    supportsHistorical: true,
    maxHistoricalDays: 730,
    requiresEnvironment: false,
    documentationUrl: 'https://ninjatrader.com/ecosystem/api',
    rateLimit: {
      requestsPerMinute: 150,
    },
  },
  TD_AMERITRADE: {
    brokerType: 'TD_AMERITRADE',
    name: 'TD Ameritrade',
    description: 'Full-service brokerage platform with OAuth2',
    authType: 'oauth2',
    supportsRealtime: true,
    supportsHistorical: true,
    maxHistoricalDays: 365,
    requiresEnvironment: false,
    documentationUrl: 'https://developer.tdameritrade.com',
    rateLimit: {
      requestsPerMinute: 120,
    },
  },
  TRADESTATION: {
    brokerType: 'TRADESTATION',
    name: 'TradeStation',
    description: 'Professional trading tools & analysis platform',
    authType: 'oauth2',
    supportsRealtime: true,
    supportsHistorical: true,
    maxHistoricalDays: 365,
    requiresEnvironment: false,
    documentationUrl: 'https://api.tradestation.com',
    rateLimit: {
      requestsPerMinute: 120,
    },
  },
  THINKORSWIM: {
    brokerType: 'THINKORSWIM',
    name: 'thinkorswim',
    description: 'Advanced trading platform by TD Ameritrade',
    authType: 'oauth2',
    supportsRealtime: true,
    supportsHistorical: true,
    maxHistoricalDays: 365,
    requiresEnvironment: false,
    documentationUrl: 'https://developer.tdameritrade.com',
    rateLimit: {
      requestsPerMinute: 120,
    },
  },
  ETRADE: {
    brokerType: 'ETRADE',
    name: 'E*TRADE',
    description: 'Full-service online brokerage platform',
    authType: 'oauth2',
    supportsRealtime: true,
    supportsHistorical: true,
    maxHistoricalDays: 365,
    requiresEnvironment: false,
    documentationUrl: 'https://developer.etrade.com',
    rateLimit: {
      requestsPerMinute: 120,
    },
  },
  ROBINHOOD: {
    brokerType: 'ROBINHOOD',
    name: 'Robinhood',
    description: 'Commission-free trading app',
    authType: 'oauth2',
    supportsRealtime: true,
    supportsHistorical: true,
    maxHistoricalDays: 365,
    requiresEnvironment: false,
    documentationUrl: 'https://api.robinhood.com',
    rateLimit: {
      requestsPerMinute: 100,
    },
  },
  WEBULL: {
    brokerType: 'WEBULL',
    name: 'Webull',
    description: 'Mobile-first trading platform',
    authType: 'api_key',
    supportsRealtime: true,
    supportsHistorical: true,
    maxHistoricalDays: 365,
    requiresEnvironment: false,
    documentationUrl: 'https://webull.com/api',
    rateLimit: {
      requestsPerMinute: 100,
    },
  },
  AMP_FUTURES: {
    brokerType: 'AMP_FUTURES',
    name: 'AMP Futures',
    description: 'Futures broker with CSV import via CQG/Rithmic platforms',
    authType: 'api_key',
    supportsRealtime: false,
    supportsHistorical: true,
    maxHistoricalDays: 9999, // No limit on CSV export
    requiresEnvironment: false,
    documentationUrl: 'https://www.ampfutures.com',
    rateLimit: {
      requestsPerMinute: 0, // CSV import only, no API
    },
  },
  BINANCE: {
    brokerType: 'BINANCE',
    name: 'Binance',
    description: 'Largest crypto exchange with spot & futures trading',
    authType: 'api_key',
    supportsRealtime: true,
    supportsHistorical: true,
    maxHistoricalDays: 90, // API limit is 3 months
    requiresEnvironment: true, // spot or futures
    documentationUrl: 'https://binance-docs.github.io/apidocs/spot/en/',
    rateLimit: {
      requestsPerMinute: 120, // 1200 weight / 10 weight per request
      requestsPerHour: 7200,
    },
  },
  OANDA: {
    brokerType: 'OANDA',
    name: 'OANDA',
    description: 'Forex & CFD broker with v20 REST API',
    authType: 'api_key',
    supportsRealtime: true,
    supportsHistorical: true,
    maxHistoricalDays: 9999, // No documented limit
    requiresEnvironment: true, // practice or live
    documentationUrl: 'https://developer.oanda.com/rest-live-v20/introduction/',
    rateLimit: {
      requestsPerMinute: 7200, // 120 requests per second = 7200/min
    },
  },
  TOPSTEPX: {
    brokerType: 'TOPSTEPX',
    name: 'TopstepX',
    description: 'Futures prop firm with ProjectX API - First prop firm with native API',
    authType: 'api_key',
    supportsRealtime: true,
    supportsHistorical: true,
    maxHistoricalDays: 365,
    requiresEnvironment: false,
    documentationUrl: 'https://help.topstep.com/en/articles/11187768-topstepx-api-access',
    rateLimit: {
      requestsPerMinute: 30, // Conservative (unknown actual limit)
    },
  },
  APEX_TRADER: {
    brokerType: 'APEX_TRADER',
    name: 'Apex Trader Funding',
    description: 'Futures prop firm with CSV import via Rithmic',
    authType: 'api_key',
    supportsRealtime: false,
    supportsHistorical: true,
    maxHistoricalDays: 9999, // CSV import only
    requiresEnvironment: false,
    documentationUrl: 'https://apextraderfunding.com',
    rateLimit: {
      requestsPerMinute: 0, // CSV import only, no API
    },
  },
};

// ============================================================================
// PROVIDER REGISTRY
// ============================================================================

type ProviderFactory = (options?: ProviderOptions) => BrokerProvider;

export interface ProviderOptions {
  environment?: 'demo' | 'live';
  [key: string]: unknown;
}

/**
 * Registry of broker provider factories
 */
class ProviderRegistry {
  private factories: Map<BrokerType, ProviderFactory> = new Map();

  /**
   * Register a provider factory
   */
  register(brokerType: BrokerType, factory: ProviderFactory): void {
    if (this.factories.has(brokerType)) {
      brokerLogger.warn(`Provider factory for ${brokerType} already registered, overwriting`);
    }
    this.factories.set(brokerType, factory);
    brokerLogger.debug(`Registered provider factory: ${brokerType}`);
  }

  /**
   * Get a provider factory
   */
  get(brokerType: BrokerType): ProviderFactory | undefined {
    return this.factories.get(brokerType);
  }

  /**
   * Check if a provider is registered
   */
  has(brokerType: BrokerType): boolean {
    return this.factories.has(brokerType);
  }

  /**
   * Get all registered broker types
   */
  getRegisteredBrokers(): BrokerType[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Get metadata for all registered brokers
   */
  getAllMetadata(): ProviderMetadata[] {
    return this.getRegisteredBrokers()
      .map((type) => PROVIDER_METADATA[type])
      .filter(Boolean);
  }
}

// Singleton registry
const registry = new ProviderRegistry();

// ============================================================================
// REGISTER BUILT-IN PROVIDERS
// ============================================================================

// Register Tradovate
registry.register('TRADOVATE', (options) => {
  return createTradovateProvider(options?.environment || 'live');
});

// Register IBKR
registry.register('IBKR', () => {
  return createIBKRFlexQueryProvider();
});

// Register Binance
registry.register('BINANCE', (options) => {
  const accountType = (options?.accountType as 'spot' | 'futures') || 'spot';
  return createBinanceProvider(accountType);
});

// Register Alpaca
registry.register('ALPACA', (options) => {
  const environment = (options?.environment as 'paper' | 'live') || 'live';
  return createAlpacaProvider(environment);
});

// Register OANDA
registry.register('OANDA', (options) => {
  const environment = (options?.environment as 'practice' | 'live') || 'live';
  return createOandaProvider(environment);
});

// Register TopstepX
registry.register('TOPSTEPX', () => {
  return createTopstepXProvider();
});

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Get a broker provider instance
 * @throws Error if broker type is not supported
 */
export function getBrokerProvider(
  brokerType: BrokerType,
  options?: ProviderOptions
): BrokerProvider {
  const factory = registry.get(brokerType);

  if (!factory) {
    const supported = registry.getRegisteredBrokers().join(', ');
    throw new Error(
      `Unsupported broker type: ${brokerType}. Supported brokers: ${supported}`
    );
  }

  brokerLogger.debug(`Creating provider instance: ${brokerType}`, options);
  return factory(options);
}

/**
 * Register a custom broker provider
 * Allows external code to add new broker integrations
 */
export function registerBrokerProvider(
  brokerType: BrokerType,
  factory: ProviderFactory,
  metadata?: ProviderMetadata
): void {
  registry.register(brokerType, factory);

  if (metadata) {
    PROVIDER_METADATA[brokerType] = metadata;
  }

  brokerLogger.info(`Custom broker provider registered: ${brokerType}`);
}

/**
 * Check if a broker is supported
 */
export function isBrokerSupported(brokerType: BrokerType): boolean {
  return registry.has(brokerType);
}

/**
 * Get list of all supported brokers
 */
export function getSupportedBrokers(): BrokerType[] {
  return registry.getRegisteredBrokers();
}

/**
 * Get metadata for a specific broker
 */
export function getBrokerMetadata(brokerType: BrokerType): ProviderMetadata | undefined {
  return PROVIDER_METADATA[brokerType];
}

/**
 * Get metadata for all supported brokers
 */
export function getAllBrokerMetadata(): ProviderMetadata[] {
  return registry.getAllMetadata();
}

/**
 * Validate broker configuration
 */
export function validateBrokerConfig(
  brokerType: BrokerType,
  config: {
    apiKey?: string;
    apiSecret?: string;
    environment?: string;
  }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const metadata = getBrokerMetadata(brokerType);

  if (!metadata) {
    errors.push(`Unknown broker type: ${brokerType}`);
    return { valid: false, errors };
  }

  // Check required fields
  if (!config.apiKey) {
    errors.push('API key is required');
  }

  if (!config.apiSecret) {
    errors.push('API secret is required');
  }

  // Check environment for brokers that require it
  if (metadata.requiresEnvironment && !config.environment) {
    errors.push('Environment (demo/live) is required for this broker');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// PROVIDER CAPABILITIES
// ============================================================================

export interface ProviderCapabilities {
  supportsRealtime: boolean;
  supportsHistorical: boolean;
  supportsAutoSync: boolean;
  supportsWebhooks: boolean;
  maxHistoricalDays: number;
}

/**
 * Get capabilities for a broker
 */
export function getBrokerCapabilities(brokerType: BrokerType): ProviderCapabilities | undefined {
  const metadata = getBrokerMetadata(brokerType);
  if (!metadata) return undefined;

  return {
    supportsRealtime: metadata.supportsRealtime,
    supportsHistorical: metadata.supportsHistorical,
    supportsAutoSync: metadata.supportsRealtime, // Real-time implies auto-sync
    supportsWebhooks: false, // None support webhooks yet
    maxHistoricalDays: metadata.maxHistoricalDays,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { registry as providerRegistry };
