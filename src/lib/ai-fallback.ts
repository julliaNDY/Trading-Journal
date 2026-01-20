/**
 * AI Fallback Strategy (PRÉ-7.3)
 * 
 * Implements robust fallback logic for AI providers with:
 * - Exponential backoff retry
 * - Circuit breaker pattern
 * - Provider health monitoring
 * - Automatic failover
 * - Detailed error tracking
 * 
 * @module ai-fallback
 */

import { generateAIResponse, AIMessage, AIResponse, AIProvider, getAvailableProviders } from './ai-provider';
import { logger } from './logger';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  resetTimeoutMs: number;
}

export interface FallbackConfig {
  retry: RetryConfig;
  circuitBreaker: CircuitBreakerConfig;
  enableCircuitBreaker: boolean;
  enableRetry: boolean;
  preferredProvider: AIProvider;
  fallbackProvider: AIProvider;
}

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit broken, failing fast
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface ProviderHealth {
  provider: AIProvider;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  averageLatencyMs: number;
}

export interface FallbackResult extends AIResponse {
  retriesAttempted: number;
  fallbackUsed: boolean;
  primaryProvider: AIProvider;
  actualProvider: AIProvider;
  healthStatus: {
    [key in AIProvider]?: ProviderHealth;
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,     // Open circuit after 5 failures
  successThreshold: 2,     // Close circuit after 2 successes in HALF_OPEN
  timeoutMs: 30000,        // 30s timeout for requests
  resetTimeoutMs: 60000,   // Try to recover after 60s
};

const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  retry: DEFAULT_RETRY_CONFIG,
  circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
  enableCircuitBreaker: true,
  enableRetry: true,
  preferredProvider: 'gemini',
  fallbackProvider: 'openai',
};

// ============================================================================
// Circuit Breaker State Management
// ============================================================================

class CircuitBreaker {
  private health: Map<AIProvider, ProviderHealth> = new Map();
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
    this.initializeHealth();
  }

  private initializeHealth(): void {
    const providers = getAvailableProviders();
    for (const provider of providers) {
      this.health.set(provider, {
        provider,
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        totalRequests: 0,
        totalFailures: 0,
        totalSuccesses: 0,
        averageLatencyMs: 0,
      });
    }
  }

  public getHealth(provider: AIProvider): ProviderHealth | undefined {
    return this.health.get(provider);
  }

  public getAllHealth(): { [key in AIProvider]?: ProviderHealth } {
    const result: { [key in AIProvider]?: ProviderHealth } = {};
    this.health.forEach((health, provider) => {
      result[provider] = health;
    });
    return result;
  }

  public canAttempt(provider: AIProvider): boolean {
    const health = this.health.get(provider);
    if (!health) return false;

    // If circuit is OPEN, check if we should transition to HALF_OPEN
    if (health.state === CircuitState.OPEN) {
      const timeSinceLastFailure = Date.now() - (health.lastFailureTime || 0);
      if (timeSinceLastFailure >= this.config.resetTimeoutMs) {
        this.transitionToHalfOpen(provider);
        return true;
      }
      return false;
    }

    return true; // CLOSED or HALF_OPEN
  }

  public recordSuccess(provider: AIProvider, latencyMs: number): void {
    const health = this.health.get(provider);
    if (!health) return;

    health.successes++;
    health.totalSuccesses++;
    health.totalRequests++;
    health.lastSuccessTime = Date.now();

    // Update average latency (exponential moving average)
    if (health.averageLatencyMs === 0) {
      health.averageLatencyMs = latencyMs;
    } else {
      health.averageLatencyMs = health.averageLatencyMs * 0.9 + latencyMs * 0.1;
    }

    // State transitions
    if (health.state === CircuitState.HALF_OPEN) {
      if (health.successes >= this.config.successThreshold) {
        this.transitionToClosed(provider);
      }
    } else if (health.state === CircuitState.CLOSED) {
      // Reset failure count on success
      health.failures = 0;
    }

    logger.debug(`Circuit breaker: ${provider} success`, {
      state: health.state,
      successes: health.successes,
      latencyMs,
    });
  }

  public recordFailure(provider: AIProvider, error: Error): void {
    const health = this.health.get(provider);
    if (!health) return;

    health.failures++;
    health.totalFailures++;
    health.totalRequests++;
    health.lastFailureTime = Date.now();

    // State transitions
    if (health.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen(provider);
    } else if (health.state === CircuitState.CLOSED) {
      if (health.failures >= this.config.failureThreshold) {
        this.transitionToOpen(provider);
      }
    }

    logger.warn(`Circuit breaker: ${provider} failure`, {
      state: health.state,
      failures: health.failures,
      error: error.message,
    });
  }

  private transitionToOpen(provider: AIProvider): void {
    const health = this.health.get(provider);
    if (!health) return;

    health.state = CircuitState.OPEN;
    health.successes = 0;

    logger.error(`Circuit breaker: ${provider} OPEN (failing fast)`, {
      totalFailures: health.totalFailures,
      totalRequests: health.totalRequests,
    });
  }

  private transitionToHalfOpen(provider: AIProvider): void {
    const health = this.health.get(provider);
    if (!health) return;

    health.state = CircuitState.HALF_OPEN;
    health.successes = 0;
    health.failures = 0;

    logger.info(`Circuit breaker: ${provider} HALF_OPEN (testing recovery)`);
  }

  private transitionToClosed(provider: AIProvider): void {
    const health = this.health.get(provider);
    if (!health) return;

    health.state = CircuitState.CLOSED;
    health.failures = 0;
    health.successes = 0;

    logger.info(`Circuit breaker: ${provider} CLOSED (recovered)`);
  }

  public reset(provider?: AIProvider): void {
    if (provider) {
      const health = this.health.get(provider);
      if (health) {
        health.state = CircuitState.CLOSED;
        health.failures = 0;
        health.successes = 0;
      }
    } else {
      this.initializeHealth();
    }
  }
}

// ============================================================================
// Global Circuit Breaker Instance
// ============================================================================

let circuitBreaker: CircuitBreaker | null = null;
let currentConfig: CircuitBreakerConfig | null = null;

function getCircuitBreaker(config?: CircuitBreakerConfig): CircuitBreaker {
  const configToUse = config || DEFAULT_CIRCUIT_BREAKER_CONFIG;
  
  // Recreate if config changed (for testing)
  if (circuitBreaker && currentConfig && 
      JSON.stringify(currentConfig) !== JSON.stringify(configToUse)) {
    circuitBreaker = null;
  }
  
  if (!circuitBreaker) {
    circuitBreaker = new CircuitBreaker(configToUse);
    currentConfig = configToUse;
  }
  return circuitBreaker;
}

// ============================================================================
// Retry Logic with Exponential Backoff
// ============================================================================

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig
): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  provider: AIProvider
): Promise<{ result: T; retriesAttempted: number }> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await fn();
      return { result, retriesAttempted: attempt };
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < config.maxRetries) {
        const delay = calculateBackoffDelay(attempt, config);
        logger.warn(`Retry attempt ${attempt + 1}/${config.maxRetries} for ${provider}`, {
          error: lastError.message,
          delayMs: delay,
        });
        await sleep(delay);
      }
    }
  }
  
  throw lastError || new Error('All retries exhausted');
}

// ============================================================================
// Main Fallback Function
// ============================================================================

/**
 * Generate AI response with robust fallback strategy
 * 
 * Features:
 * - Exponential backoff retry
 * - Circuit breaker pattern
 * - Automatic provider failover
 * - Health monitoring
 * 
 * @param messages - Chat messages
 * @param config - Fallback configuration
 * @returns AI response with fallback metadata
 */
export async function generateWithFallback(
  messages: AIMessage[],
  config: Partial<FallbackConfig> = {}
): Promise<FallbackResult> {
  const fullConfig = { ...DEFAULT_FALLBACK_CONFIG, ...config };
  const breaker = getCircuitBreaker(fullConfig.circuitBreaker);
  
  const providers = getAvailableProviders();
  if (providers.length === 0) {
    throw new Error('No AI providers configured');
  }

  // Determine provider order (preferred first, then fallback)
  const providerOrder: AIProvider[] = [];
  if (providers.includes(fullConfig.preferredProvider)) {
    providerOrder.push(fullConfig.preferredProvider);
  }
  if (providers.includes(fullConfig.fallbackProvider) && 
      fullConfig.fallbackProvider !== fullConfig.preferredProvider) {
    providerOrder.push(fullConfig.fallbackProvider);
  }

  let lastError: Error | null = null;
  let totalRetries = 0;
  let fallbackUsed = false;

  for (let i = 0; i < providerOrder.length; i++) {
    const provider = providerOrder[i];
    
    // Check circuit breaker
    if (fullConfig.enableCircuitBreaker && !breaker.canAttempt(provider)) {
      logger.warn(`Circuit breaker OPEN for ${provider}, skipping`);
      continue;
    }

    try {
      const attemptFn = async () => {
        const startTime = performance.now();
        
        // Set timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Request timeout after ${fullConfig.circuitBreaker.timeoutMs}ms`));
          }, fullConfig.circuitBreaker.timeoutMs);
        });

        const responsePromise = generateAIResponse(messages, {
          preferredProvider: provider,
          fallbackEnabled: false, // We handle fallback ourselves
        });

        const response = await Promise.race([responsePromise, timeoutPromise]);
        const latencyMs = performance.now() - startTime;

        // Record success
        if (fullConfig.enableCircuitBreaker) {
          breaker.recordSuccess(provider, latencyMs);
        }

        return response;
      };

      // Retry with exponential backoff
      const { result, retriesAttempted } = fullConfig.enableRetry
        ? await retryWithBackoff(attemptFn, fullConfig.retry, provider)
        : { result: await attemptFn(), retriesAttempted: 0 };

      totalRetries += retriesAttempted;
      fallbackUsed = i > 0; // Fallback used if not the first provider

      logger.info(`AI request successful with ${provider}`, {
        retriesAttempted,
        fallbackUsed,
        latencyMs: result.latencyMs,
      });

      return {
        ...result,
        retriesAttempted: totalRetries,
        fallbackUsed,
        primaryProvider: fullConfig.preferredProvider,
        actualProvider: provider,
        healthStatus: breaker.getAllHealth(),
      };

    } catch (error) {
      lastError = error as Error;
      
      // Record failure
      if (fullConfig.enableCircuitBreaker) {
        breaker.recordFailure(provider, lastError);
      }

      logger.error(`AI request failed with ${provider}`, {
        error: lastError.message,
        provider,
        attemptNumber: i + 1,
        totalProviders: providerOrder.length,
      });

      // If this was the last provider, throw
      if (i === providerOrder.length - 1) {
        throw new Error(
          `All AI providers failed. Last error: ${lastError.message}`
        );
      }

      // Otherwise, continue to next provider
      fallbackUsed = true;
    }
  }

  throw lastError || new Error('All AI providers failed');
}

// ============================================================================
// Health Check & Monitoring
// ============================================================================

/**
 * Get health status for all providers
 */
export function getProviderHealthStatus(): { [key in AIProvider]?: ProviderHealth } {
  if (!circuitBreaker) {
    circuitBreaker = new CircuitBreaker(DEFAULT_CIRCUIT_BREAKER_CONFIG);
  }
  return circuitBreaker.getAllHealth();
}

/**
 * Reset circuit breaker for a provider (or all)
 */
export function resetCircuitBreaker(provider?: AIProvider, forceRecreate = false): void {
  if (forceRecreate || !circuitBreaker) {
    circuitBreaker = new CircuitBreaker(DEFAULT_CIRCUIT_BREAKER_CONFIG);
  }
  if (provider) {
    circuitBreaker.reset(provider);
  } else {
    circuitBreaker.reset();
  }
  logger.info(`Circuit breaker reset for ${provider || 'all providers'}`);
}

/**
 * Check if a provider is healthy (circuit not OPEN)
 */
export function isProviderHealthy(provider: AIProvider): boolean {
  if (!circuitBreaker) {
    return true;
  }
  const health = circuitBreaker.getHealth(provider);
  return health ? health.state !== CircuitState.OPEN : true;
}

/**
 * Get provider statistics
 */
export function getProviderStats(provider: AIProvider): {
  successRate: number;
  averageLatencyMs: number;
  totalRequests: number;
  state: CircuitState;
} | null {
  if (!circuitBreaker) {
    return null;
  }

  const health = circuitBreaker.getHealth(provider);
  if (!health) {
    return null;
  }

  const successRate = health.totalRequests > 0
    ? (health.totalSuccesses / health.totalRequests) * 100
    : 0;

  return {
    successRate,
    averageLatencyMs: health.averageLatencyMs,
    totalRequests: health.totalRequests,
    state: health.state,
  };
}
