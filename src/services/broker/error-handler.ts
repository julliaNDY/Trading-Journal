/**
 * Broker Error Handler
 * Story 3.3: Broker Sync Architecture - Error Handling
 * 
 * Provides robust error handling for broker integrations:
 * - Retry logic with exponential backoff
 * - Error classification and recovery strategies
 * - Structured logging
 * - Timeout handling
 */

import { brokerLogger } from '@/lib/logger';
import { 
  BrokerError, 
  BrokerAuthError, 
  BrokerRateLimitError, 
  BrokerApiError 
} from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: Array<typeof BrokerError | typeof BrokerApiError | typeof BrokerRateLimitError | typeof BrokerAuthError>;
  timeoutMs?: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [BrokerApiError, BrokerRateLimitError] as any,
  timeoutMs: 60000, // 60 seconds default timeout
};

// Broker-specific configurations
export const BROKER_RETRY_CONFIGS: Record<string, Partial<RetryConfig>> = {
  TRADOVATE: {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
  },
  IBKR: {
    maxRetries: 5,
    initialDelayMs: 3000,
    maxDelayMs: 60000,
    timeoutMs: 120000, // IBKR Flex Query can take longer
  },
};

// ============================================================================
// RETRY LOGIC
// ============================================================================

interface RetryContext {
  attempt: number;
  totalAttempts: number;
  lastError?: Error;
  startTime: number;
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context?: { operation: string; brokerType?: string }
): Promise<T> {
  const finalConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  const retryContext: RetryContext = {
    attempt: 0,
    totalAttempts: finalConfig.maxRetries + 1,
    startTime: Date.now(),
  };

  const operation = context?.operation || 'broker operation';
  const brokerType = context?.brokerType || 'unknown';

  brokerLogger.debug(`[${brokerType}] Starting ${operation} (max ${finalConfig.maxRetries} retries)`);

  while (retryContext.attempt < retryContext.totalAttempts) {
    retryContext.attempt++;

    try {
      // Apply timeout if configured
      const result = finalConfig.timeoutMs
        ? await withTimeout(fn(), finalConfig.timeoutMs, `${operation} timed out`)
        : await fn();

      // Success - log if we had retries
      if (retryContext.attempt > 1) {
        const duration = Date.now() - retryContext.startTime;
        brokerLogger.info(
          `[${brokerType}] ${operation} succeeded after ${retryContext.attempt} attempts (${duration}ms)`,
          { attempts: retryContext.attempt, durationMs: duration }
        );
      }

      return result;
    } catch (error) {
      retryContext.lastError = error as Error;

      // Check if error is retryable
      const isRetryable = isRetryableError(error, finalConfig.retryableErrors);
      const isLastAttempt = retryContext.attempt >= retryContext.totalAttempts;

      // Log the error
      logRetryAttempt(
        brokerType,
        operation,
        retryContext,
        error as Error,
        isRetryable,
        isLastAttempt
      );

      // If not retryable or last attempt, throw
      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = calculateBackoffDelay(
        retryContext.attempt,
        finalConfig.initialDelayMs,
        finalConfig.maxDelayMs,
        finalConfig.backoffMultiplier,
        error as Error
      );

      brokerLogger.debug(
        `[${brokerType}] Retrying ${operation} in ${delay}ms (attempt ${retryContext.attempt}/${retryContext.totalAttempts})`
      );

      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw retryContext.lastError || new Error('Retry failed');
}

/**
 * Check if an error is retryable
 */
function isRetryableError(
  error: unknown,
  retryableErrors: Array<any>
): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  // Never retry auth errors - credentials are wrong
  if (error instanceof BrokerAuthError) {
    return false;
  }

  // Always retry rate limit errors (with backoff)
  if (error instanceof BrokerRateLimitError) {
    return true;
  }

  // Check if error type is in retryable list
  for (const ErrorClass of retryableErrors) {
    if (error instanceof ErrorClass) {
      return true;
    }
  }

  // Retry network errors
  if (
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ETIMEDOUT') ||
    error.message.includes('ENOTFOUND') ||
    error.message.includes('fetch failed')
  ) {
    return true;
  }

  return false;
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  multiplier: number,
  error: Error
): number {
  // If rate limit error with retry-after header, use that
  if (error instanceof BrokerRateLimitError && error.retryAfterMs) {
    return Math.min(error.retryAfterMs, maxDelayMs);
  }

  // Exponential backoff: initialDelay * (multiplier ^ (attempt - 1))
  const exponentialDelay = initialDelayMs * Math.pow(multiplier, attempt - 1);

  // Add jitter (±20%) to avoid thundering herd
  const jitter = exponentialDelay * 0.2 * (Math.random() - 0.5);
  const delayWithJitter = exponentialDelay + jitter;

  // Cap at maxDelay
  return Math.min(delayWithJitter, maxDelayMs);
}

/**
 * Log retry attempt
 */
function logRetryAttempt(
  brokerType: string,
  operation: string,
  context: RetryContext,
  error: Error,
  isRetryable: boolean,
  isLastAttempt: boolean
): void {
  const errorInfo = {
    errorType: error.constructor.name,
    errorMessage: error.message,
    attempt: context.attempt,
    totalAttempts: context.totalAttempts,
    isRetryable,
    isLastAttempt,
  };

  if (isLastAttempt) {
    brokerLogger.error(
      `[${brokerType}] ${operation} failed after ${context.attempt} attempts`,
      error,
      errorInfo
    );
  } else if (isRetryable) {
    brokerLogger.warn(
      `[${brokerType}] ${operation} failed (attempt ${context.attempt}/${context.totalAttempts}), will retry`,
      errorInfo
    );
  } else {
    brokerLogger.error(
      `[${brokerType}] ${operation} failed with non-retryable error`,
      error,
      errorInfo
    );
  }
}

// ============================================================================
// TIMEOUT HANDLING
// ============================================================================

/**
 * Wrap a promise with a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new BrokerApiError(errorMessage || `Operation timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

export interface ErrorClassification {
  type: 'auth' | 'rate_limit' | 'api' | 'network' | 'timeout' | 'unknown';
  severity: 'critical' | 'error' | 'warning';
  retryable: boolean;
  userMessage: string;
  technicalDetails: string;
}

/**
 * Classify an error for better handling and user feedback
 */
export function classifyError(error: unknown): ErrorClassification {
  if (!(error instanceof Error)) {
    return {
      type: 'unknown',
      severity: 'error',
      retryable: false,
      userMessage: 'An unknown error occurred',
      technicalDetails: String(error),
    };
  }

  // Auth errors
  if (error instanceof BrokerAuthError) {
    return {
      type: 'auth',
      severity: 'critical',
      retryable: false,
      userMessage: 'Authentication failed. Please check your API credentials.',
      technicalDetails: error.message,
    };
  }

  // Rate limit errors
  if (error instanceof BrokerRateLimitError) {
    const retryAfter = error.retryAfterMs ? Math.ceil(error.retryAfterMs / 1000) : 60;
    return {
      type: 'rate_limit',
      severity: 'warning',
      retryable: true,
      userMessage: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
      technicalDetails: error.message,
    };
  }

  // API errors
  if (error instanceof BrokerApiError) {
    return {
      type: 'api',
      severity: 'error',
      retryable: true,
      userMessage: 'Broker API error. This may be temporary.',
      technicalDetails: error.message,
    };
  }

  // Network errors
  if (
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ETIMEDOUT') ||
    error.message.includes('ENOTFOUND') ||
    error.message.includes('fetch failed')
  ) {
    return {
      type: 'network',
      severity: 'error',
      retryable: true,
      userMessage: 'Network error. Please check your connection.',
      technicalDetails: error.message,
    };
  }

  // Timeout errors
  if (error.message.includes('timed out') || error.message.includes('timeout')) {
    return {
      type: 'timeout',
      severity: 'error',
      retryable: true,
      userMessage: 'Operation timed out. Please try again.',
      technicalDetails: error.message,
    };
  }

  // Generic broker error
  if (error instanceof BrokerError) {
    return {
      type: 'api',
      severity: 'error',
      retryable: true,
      userMessage: 'Broker error occurred.',
      technicalDetails: error.message,
    };
  }

  // Unknown error
  return {
    type: 'unknown',
    severity: 'error',
    retryable: false,
    userMessage: 'An unexpected error occurred.',
    technicalDetails: error.message,
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a circuit breaker for a broker provider
 * (Advanced pattern - can be implemented later if needed)
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly threshold: number = 5,
    private readonly resetTimeMs: number = 60000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure < this.resetTimeMs) {
        throw new BrokerApiError('Circuit breaker is open');
      }
      this.state = 'half-open';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
      brokerLogger.warn(`Circuit breaker opened after ${this.failures} failures`);
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }
}
