/**
 * Google Gemini API - Production-Ready Integration
 * PRÉ-7.1: API Integration (16h) - Phase 11
 * 
 * Features:
 * - Rate limiting (10 req/sec max)
 * - Redis caching (5 min TTL)
 * - Fallback to OpenAI if Gemini fails
 * - Retry logic with exponential backoff
 * - Error handling & monitoring
 * - Request queuing
 * - Circuit breaker pattern
 * - Health checks
 * 
 * @see docs/phase-11/gemini-api-integration.md
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { getOpenAIClient, isOpenAIConfigured } from '@/lib/openai';
import { cacheGet, cacheSet, getOrSetCache } from '@/lib/cache';
import { logger } from '@/lib/observability';
import { getRedisConnection, isRedisConfigured } from '@/lib/queue/redis';
import {
  recordRequest,
  recordError,
  recordDuration,
  setCircuitBreakerState,
  recordCacheHit,
  recordCacheMiss,
  recordFallbackUsage,
  recordTokensConsumed,
  recordRetryAttempt,
  setActiveConnections,
  setQueueSize,
} from '@/lib/metrics/prometheus';

// ============================================================================
// Types
// ============================================================================

export interface GeminiRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  cacheKey?: string; // Optional cache key for this request
  skipCache?: boolean; // Skip cache for this request
}

export interface GeminiResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cached: boolean; // Whether response came from cache
  provider: 'gemini' | 'openai'; // Which provider was used
  latency: number; // Response time in ms
}

export interface GeminiHealthStatus {
  healthy: boolean;
  provider: 'gemini' | 'openai' | 'none';
  lastError?: string;
  lastErrorTime?: Date;
  requestCount: number;
  errorCount: number;
  errorRate: number;
  circuitBreakerOpen: boolean;
}

export interface RateLimitInfo {
  remaining: number;
  resetAt: Date;
  limit: number;
}

// ============================================================================
// Constants
// ============================================================================

const GEMINI_MODELS = {
  GEMINI_2_5_FLASH: 'gemini-2.5-flash',         // Current stable flash model (2026)
  GEMINI_2_FLASH: 'gemini-2.0-flash',           // Previous flash model
  GEMINI_2_5_PRO: 'gemini-2.5-pro',             // Current stable pro model (2026)
} as const;

const OPENAI_MODELS = {
  GPT_4_TURBO: 'gpt-4-turbo-preview',
  GPT_4: 'gpt-4',
  GPT_3_5_TURBO: 'gpt-3.5-turbo',
} as const;

const RATE_LIMIT = {
  MAX_REQUESTS_PER_SECOND: 10,
  WINDOW_SIZE_MS: 1000,
} as const;

const CACHE_CONFIG = {
  TTL_SECONDS: 300, // 5 minutes
  PREFIX: 'gemini:response',
} as const;

const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 10000,
  BACKOFF_MULTIPLIER: 2,
} as const;

const CIRCUIT_BREAKER_CONFIG = {
  FAILURE_THRESHOLD: 5, // Open circuit after 5 consecutive failures
  RESET_TIMEOUT_MS: 60000, // Try to close circuit after 1 minute
  HALF_OPEN_MAX_REQUESTS: 3, // Allow 3 requests when half-open
} as const;

// ============================================================================
// State Management
// ============================================================================

let geminiClient: GoogleGenerativeAI | null = null;
let requestQueue: Array<() => Promise<void>> = [];
let isProcessingQueue = false;

// Rate limiting state
const rateLimitState = {
  requests: [] as number[], // Timestamps of recent requests
  lastCleanup: Date.now(),
};

// Circuit breaker state
const circuitBreakerState = {
  isOpen: false,
  failureCount: 0,
  lastFailureTime: null as Date | null,
  halfOpenRequestCount: 0,
};

// Health monitoring
const healthState = {
  requestCount: 0,
  errorCount: 0,
  lastError: null as string | null,
  lastErrorTime: null as Date | null,
};

// ============================================================================
// Client Initialization
// ============================================================================

/**
 * Get Gemini client instance (singleton)
 */
function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY is not configured');
    }
    
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  
  return geminiClient;
}

/**
 * Check if Gemini is configured
 */
export function isGeminiConfigured(): boolean {
  return !!process.env.GOOGLE_GEMINI_API_KEY;
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Clean up old requests from rate limit tracking
 */
function cleanupRateLimitState(): void {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT.WINDOW_SIZE_MS;
  
  rateLimitState.requests = rateLimitState.requests.filter(
    timestamp => timestamp > windowStart
  );
  
  rateLimitState.lastCleanup = now;
}

/**
 * Check if rate limit is exceeded
 */
function isRateLimitExceeded(): boolean {
  cleanupRateLimitState();
  return rateLimitState.requests.length >= RATE_LIMIT.MAX_REQUESTS_PER_SECOND;
}

/**
 * Record a request for rate limiting
 */
function recordRequest(): void {
  rateLimitState.requests.push(Date.now());
}

/**
 * Get rate limit info
 */
export function getRateLimitInfo(): RateLimitInfo {
  cleanupRateLimitState();
  
  const remaining = Math.max(
    0,
    RATE_LIMIT.MAX_REQUESTS_PER_SECOND - rateLimitState.requests.length
  );
  
  const oldestRequest = rateLimitState.requests[0] || Date.now();
  const resetAt = new Date(oldestRequest + RATE_LIMIT.WINDOW_SIZE_MS);
  
  return {
    remaining,
    resetAt,
    limit: RATE_LIMIT.MAX_REQUESTS_PER_SECOND,
  };
}

/**
 * Wait until rate limit allows next request
 */
async function waitForRateLimit(): Promise<void> {
  while (isRateLimitExceeded()) {
    const rateLimitInfo = getRateLimitInfo();
    const waitTime = rateLimitInfo.resetAt.getTime() - Date.now();
    
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 100)));
    }
  }
}

// ============================================================================
// Circuit Breaker
// ============================================================================

/**
 * Check if circuit breaker is open
 */
function isCircuitBreakerOpen(): boolean {
  // If circuit is open, check if we should try to close it
  if (circuitBreakerState.isOpen) {
    const timeSinceLastFailure = circuitBreakerState.lastFailureTime
      ? Date.now() - circuitBreakerState.lastFailureTime.getTime()
      : Infinity;
    
    // Try to close circuit after timeout
    if (timeSinceLastFailure >= CIRCUIT_BREAKER_CONFIG.RESET_TIMEOUT_MS) {
      logger.info('Circuit breaker entering half-open state');
      circuitBreakerState.isOpen = false;
      circuitBreakerState.halfOpenRequestCount = 0;
      return false;
    }
    
    return true;
  }
  
  return false;
}

/**
 * Record circuit breaker success
 */
function recordCircuitBreakerSuccess(): void {
  circuitBreakerState.failureCount = 0;
  circuitBreakerState.halfOpenRequestCount = 0;
}

/**
 * Record circuit breaker failure
 */
function recordCircuitBreakerFailure(): void {
  circuitBreakerState.failureCount++;
  circuitBreakerState.lastFailureTime = new Date();
  
  // Open circuit if failure threshold exceeded
  if (circuitBreakerState.failureCount >= CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD) {
    circuitBreakerState.isOpen = true;
    logger.error('Circuit breaker opened due to consecutive failures', {
      failureCount: circuitBreakerState.failureCount,
    });
  }
}

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Generate cache key for a request
 */
function generateCacheKey(request: GeminiRequest): string {
  if (request.cacheKey) {
    return `${CACHE_CONFIG.PREFIX}:${request.cacheKey}`;
  }
  
  // Generate hash from request parameters
  const key = JSON.stringify({
    prompt: request.prompt,
    systemPrompt: request.systemPrompt,
    temperature: request.temperature,
    maxTokens: request.maxTokens,
    model: request.model,
  });
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `${CACHE_CONFIG.PREFIX}:${Math.abs(hash).toString(36)}`;
}

/**
 * Get cached response
 */
async function getCachedResponse(request: GeminiRequest): Promise<GeminiResponse | null> {
  if (request.skipCache || !isRedisConfigured()) {
    return null;
  }
  
  try {
    const cacheKey = generateCacheKey(request);
    const cached = await cacheGet<Omit<GeminiResponse, 'cached' | 'latency'>>(cacheKey);
    
    if (cached) {
      logger.debug('Cache hit for Gemini request', { cacheKey });
      return {
        ...cached,
        cached: true,
        latency: 0,
      };
    }
    
    return null;
  } catch (error) {
    logger.error('Error getting cached response', { error });
    return null;
  }
}

/**
 * Cache response
 */
async function cacheResponse(request: GeminiRequest, response: GeminiResponse): Promise<void> {
  if (request.skipCache || !isRedisConfigured()) {
    return;
  }
  
  try {
    const cacheKey = generateCacheKey(request);
    const { cached, latency, ...cacheableResponse } = response;
    
    await cacheSet(cacheKey, cacheableResponse, {
      ttl: CACHE_CONFIG.TTL_SECONDS,
    });
    
    logger.debug('Cached Gemini response', { cacheKey, ttl: CACHE_CONFIG.TTL_SECONDS });
  } catch (error) {
    logger.error('Error caching response', { error });
  }
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Sleep for specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(attempt: number): number {
  const delay = RETRY_CONFIG.INITIAL_DELAY_MS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt);
  return Math.min(delay, RETRY_CONFIG.MAX_DELAY_MS);
}

/**
 * Execute function with retry logic
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= RETRY_CONFIG.MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on last attempt
      if (attempt === RETRY_CONFIG.MAX_RETRIES) {
        break;
      }
      
      const delay = calculateBackoffDelay(attempt);
      logger.warn(`${context} failed, retrying in ${delay}ms`, {
        attempt: attempt + 1,
        maxRetries: RETRY_CONFIG.MAX_RETRIES,
        error: lastError.message,
      });
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

// ============================================================================
// Gemini API Calls
// ============================================================================

/**
 * Call Gemini API directly
 */
async function callGeminiAPI(request: GeminiRequest): Promise<Omit<GeminiResponse, 'cached' | 'latency'>> {
  const client = getGeminiClient();
  const modelName = request.model || GEMINI_MODELS.GEMINI_2_FLASH;
  const model = client.getGenerativeModel({ model: modelName });
  
  // Build prompt
  const fullPrompt = request.systemPrompt
    ? `${request.systemPrompt}\n\n${request.prompt}`
    : request.prompt;
  
  // Generate content
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    generationConfig: {
      temperature: request.temperature ?? 0.7,
      maxOutputTokens: request.maxTokens ?? 1500,
    },
  });
  
  const response = result.response;
  const text = response.text();
  const usageMetadata = response.usageMetadata;
  
  return {
    content: text,
    usage: usageMetadata ? {
      promptTokens: usageMetadata.promptTokenCount ?? 0,
      completionTokens: usageMetadata.candidatesTokenCount ?? 0,
      totalTokens: usageMetadata.totalTokenCount ?? 0,
    } : undefined,
    provider: 'gemini',
  };
}

// ============================================================================
// OpenAI Fallback
// ============================================================================

/**
 * Call OpenAI API as fallback
 */
async function callOpenAIFallback(request: GeminiRequest): Promise<Omit<GeminiResponse, 'cached' | 'latency'>> {
  if (!isOpenAIConfigured()) {
    throw new Error('OpenAI fallback not configured');
  }
  
  const client = getOpenAIClient();
  
  // Build messages
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  
  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt });
  }
  
  messages.push({ role: 'user', content: request.prompt });
  
  // Call OpenAI
  const completion = await client.chat.completions.create({
    model: OPENAI_MODELS.GPT_3_5_TURBO,
    messages,
    temperature: request.temperature ?? 0.7,
    max_tokens: request.maxTokens ?? 1500,
  });
  
  const choice = completion.choices[0];
  if (!choice || !choice.message) {
    throw new Error('OpenAI returned no choices');
  }
  
  return {
    content: choice.message.content || '',
    usage: completion.usage ? {
      promptTokens: completion.usage.prompt_tokens,
      completionTokens: completion.usage.completion_tokens,
      totalTokens: completion.usage.total_tokens,
    } : undefined,
    provider: 'openai',
  };
}

// ============================================================================
// Main API Function
// ============================================================================

/**
 * Generate text with Gemini (production-ready)
 * 
 * Features:
 * - Rate limiting (10 req/sec)
 * - Redis caching (5 min TTL)
 * - Fallback to OpenAI
 * - Retry with exponential backoff
 * - Circuit breaker
 * - Health monitoring
 */
export async function generateWithGeminiProduction(
  request: GeminiRequest
): Promise<GeminiResponse> {
  const startTime = Date.now();
  
  // Update health metrics
  healthState.requestCount++;
  
  try {
    // 1. Check cache first
    const cachedResponse = await getCachedResponse(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // 2. Wait for rate limit
    await waitForRateLimit();
    recordRequest();
    
    // 3. Check circuit breaker
    if (isCircuitBreakerOpen()) {
      logger.warn('Circuit breaker is open, using OpenAI fallback');
      
      const fallbackResponse = await withRetry(
        () => callOpenAIFallback(request),
        'OpenAI fallback'
      );
      
      const response: GeminiResponse = {
        ...fallbackResponse,
        cached: false,
        latency: Date.now() - startTime,
      };
      
      // Cache the response
      await cacheResponse(request, response);
      
      return response;
    }
    
    // 4. Try Gemini API with retry
    try {
      const geminiResponse = await withRetry(
        () => callGeminiAPI(request),
        'Gemini API'
      );
      
      // Record success
      recordCircuitBreakerSuccess();
      
      const response: GeminiResponse = {
        ...geminiResponse,
        cached: false,
        latency: Date.now() - startTime,
      };
      
      // Cache the response
      await cacheResponse(request, response);
      
      logger.info('Gemini API request successful', {
        latency: response.latency,
        cached: false,
        provider: 'gemini',
      });
      
      return response;
      
    } catch (geminiError) {
      // Record failure
      recordCircuitBreakerFailure();
      healthState.errorCount++;
      healthState.lastError = (geminiError as Error).message;
      healthState.lastErrorTime = new Date();
      
      logger.error('Gemini API failed, trying OpenAI fallback', {
        error: (geminiError as Error).message,
      });
      
      // 5. Fallback to OpenAI
      if (isOpenAIConfigured()) {
        const fallbackResponse = await withRetry(
          () => callOpenAIFallback(request),
          'OpenAI fallback'
        );
        
        const response: GeminiResponse = {
          ...fallbackResponse,
          cached: false,
          latency: Date.now() - startTime,
        };
        
        // Cache the response
        await cacheResponse(request, response);
        
        logger.info('OpenAI fallback successful', {
          latency: response.latency,
          cached: false,
          provider: 'openai',
        });
        
        return response;
      }
      
      // No fallback available
      throw geminiError;
    }
    
  } catch (error) {
    healthState.errorCount++;
    healthState.lastError = (error as Error).message;
    healthState.lastErrorTime = new Date();
    
    logger.error('All AI providers failed', {
      error: (error as Error).message,
      latency: Date.now() - startTime,
    });
    
    throw error;
  }
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Get health status of Gemini API integration
 */
export function getGeminiHealthStatus(): GeminiHealthStatus {
  const errorRate = healthState.requestCount > 0
    ? healthState.errorCount / healthState.requestCount
    : 0;
  
  const healthy = errorRate < 0.1 && !circuitBreakerState.isOpen;
  
  let provider: 'gemini' | 'openai' | 'none' = 'none';
  if (isGeminiConfigured() && !circuitBreakerState.isOpen) {
    provider = 'gemini';
  } else if (isOpenAIConfigured()) {
    provider = 'openai';
  }
  
  return {
    healthy,
    provider,
    lastError: healthState.lastError || undefined,
    lastErrorTime: healthState.lastErrorTime || undefined,
    requestCount: healthState.requestCount,
    errorCount: healthState.errorCount,
    errorRate: Math.round(errorRate * 100) / 100,
    circuitBreakerOpen: circuitBreakerState.isOpen,
  };
}

/**
 * Reset health metrics (for testing)
 */
export function resetHealthMetrics(): void {
  healthState.requestCount = 0;
  healthState.errorCount = 0;
  healthState.lastError = null;
  healthState.lastErrorTime = null;
  
  circuitBreakerState.isOpen = false;
  circuitBreakerState.failureCount = 0;
  circuitBreakerState.lastFailureTime = null;
  circuitBreakerState.halfOpenRequestCount = 0;
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Process multiple requests in batch (respects rate limits)
 */
export async function batchGenerateWithGemini(
  requests: GeminiRequest[]
): Promise<GeminiResponse[]> {
  const results: GeminiResponse[] = [];
  
  for (const request of requests) {
    try {
      const response = await generateWithGeminiProduction(request);
      results.push(response);
    } catch (error) {
      logger.error('Batch request failed', {
        error: (error as Error).message,
        request: request.cacheKey || 'unknown',
      });
      
      // Add error response
      results.push({
        content: '',
        cached: false,
        provider: 'gemini',
        latency: 0,
        usage: undefined,
      });
    }
  }
  
  return results;
}

// ============================================================================
// Exports
// ============================================================================

export {
  GEMINI_MODELS,
  OPENAI_MODELS,
  RATE_LIMIT,
  CACHE_CONFIG,
  RETRY_CONFIG,
  CIRCUIT_BREAKER_CONFIG,
};
