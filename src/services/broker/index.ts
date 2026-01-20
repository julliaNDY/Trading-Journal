/**
 * Broker Sync Module
 * Story 3.3: Broker Sync Architecture - Multi-Provider Abstraction
 * 
 * Main exports for broker synchronization functionality.
 */

// Types
export * from './types';

// Providers
export { TradovateProvider, createTradovateProvider } from './tradovate-provider';
export { IBKRFlexQueryProvider, createIBKRFlexQueryProvider } from './ibkr-flex-query-provider';
export { AlpacaProvider, createAlpacaProvider } from './alpaca-provider';
export { BinanceProvider, createBinanceProvider } from './binance-provider';
export { TopstepXProvider, createTopstepXProvider } from './topstepx-provider';
export { TradeStationProvider, createTradeStationProvider } from './tradestation-provider';

// Provider Factory (Story 3.3)
export {
  getBrokerProvider,
  registerBrokerProvider,
  isBrokerSupported,
  getSupportedBrokers,
  getBrokerMetadata,
  getAllBrokerMetadata,
  getBrokerCapabilities,
  validateBrokerConfig,
  type ProviderMetadata,
  type ProviderOptions,
  type ProviderCapabilities,
} from './provider-factory';

// Error Handling (Story 3.3)
export {
  withRetry,
  withTimeout,
  classifyError,
  CircuitBreaker,
  type RetryConfig,
  type ErrorClassification,
  DEFAULT_RETRY_CONFIG,
  BROKER_RETRY_CONFIGS,
} from './error-handler';

// Rate Limiting (Story 3.3)
export {
  BrokerRateLimiter,
  createRateLimiter,
  withRateLimit,
  getAllRateLimitStatus,
  BROKER_RATE_LIMITS,
  type RateLimitConfig,
} from './rate-limiter';

// Main service
export {
  connectBroker,
  disconnectBroker,
  getBrokerConnections,
  syncBrokerTrades,
  encryptCredential,
  decryptCredential,
  type ConnectBrokerInput,
} from './broker-sync-service';

// Scheduler
export {
  runScheduledSync,
  getSchedulerStatus,
  type SchedulerResult,
  type SchedulerError,
} from './scheduler';

