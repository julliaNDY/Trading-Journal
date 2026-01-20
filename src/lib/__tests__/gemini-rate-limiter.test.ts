/**
 * Tests for Gemini Rate Limiter
 * PRÉ-7.2: Rate Limiting (12h) - Phase 11
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GeminiRateLimiter,
  createGeminiRateLimiter,
  withGeminiRateLimit,
  withGeminiRetry,
  getGeminiRateLimitStatus,
  GeminiRateLimitError,
  GeminiQuotaExceededError,
  GEMINI_RATE_LIMITS,
} from '../gemini-rate-limiter';

// Mock Redis
vi.mock('@/lib/queue/redis', () => ({
  getRedisConnection: vi.fn(),
  isRedisConfigured: vi.fn(() => false), // Use in-memory for tests
}));

// Mock logger
vi.mock('@/lib/observability', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock cache
vi.mock('@/lib/cache', () => ({
  cacheGet: vi.fn(() => null),
  cacheSet: vi.fn(),
}));

describe('GeminiRateLimiter', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset all rate limiters between tests
    const globalLimiter = createGeminiRateLimiter();
    await globalLimiter.reset();
  });

  describe('Global Rate Limiter', () => {
    it('should create a global rate limiter', () => {
      const limiter = createGeminiRateLimiter();
      expect(limiter).toBeInstanceOf(GeminiRateLimiter);
    });

    it('should allow requests within rate limit', async () => {
      const limiter = createGeminiRateLimiter();
      
      // Should not throw
      await expect(limiter.checkLimit(1000)).resolves.not.toThrow();
    });

    it('should enforce per-second rate limit', async () => {
      const limiter = createGeminiRateLimiter();
      const maxPerSecond = GEMINI_RATE_LIMITS.GLOBAL.maxRequestsPerSecond;

      // Make max requests
      for (let i = 0; i < maxPerSecond; i++) {
        await limiter.checkLimit(100);
      }

      // Next request should fail
      await expect(limiter.checkLimit(100)).rejects.toThrow(GeminiRateLimitError);
    });

    it('should enforce token limit per minute', async () => {
      const limiter = createGeminiRateLimiter();
      const maxTokens = GEMINI_RATE_LIMITS.GLOBAL.maxTokensPerMinute;

      // Try to consume more tokens than allowed
      await expect(limiter.checkLimit(maxTokens + 1000)).rejects.toThrow(GeminiRateLimitError);
    });

    it('should reset rate limit', async () => {
      const limiter = createGeminiRateLimiter();
      const maxPerSecond = GEMINI_RATE_LIMITS.GLOBAL.maxRequestsPerSecond;

      // Exhaust rate limit
      for (let i = 0; i < maxPerSecond; i++) {
        await limiter.checkLimit(100);
      }

      // Reset
      await limiter.reset();

      // Should allow requests again
      await expect(limiter.checkLimit(100)).resolves.not.toThrow();
    });

    it('should get rate limit status', async () => {
      const limiter = createGeminiRateLimiter();

      await limiter.checkLimit(1000);
      await limiter.checkLimit(2000);

      const status = await limiter.getStatus();

      expect(status.second.current).toBe(2);
      expect(status.second.max).toBe(GEMINI_RATE_LIMITS.GLOBAL.maxRequestsPerSecond);
      expect(status.tokens.current).toBe(3000); // 1000 + 2000
      expect(status.tokens.max).toBe(GEMINI_RATE_LIMITS.GLOBAL.maxTokensPerMinute);
    });
  });

  describe('Per-User Rate Limiter', () => {
    it('should create a per-user rate limiter', () => {
      const limiter = createGeminiRateLimiter('user-123');
      expect(limiter).toBeInstanceOf(GeminiRateLimiter);
    });

    it('should enforce per-user rate limits', async () => {
      const limiter = createGeminiRateLimiter('user-123');
      const maxPerSecond = GEMINI_RATE_LIMITS.PER_USER.maxRequestsPerSecond;

      // Make max requests
      for (let i = 0; i < maxPerSecond; i++) {
        await limiter.checkLimit(100);
      }

      // Next request should fail
      await expect(limiter.checkLimit(100)).rejects.toThrow(GeminiRateLimitError);
    });

    it('should isolate rate limits between users', async () => {
      const limiter1 = createGeminiRateLimiter('user-1');
      const limiter2 = createGeminiRateLimiter('user-2');
      const maxPerSecond = GEMINI_RATE_LIMITS.PER_USER.maxRequestsPerSecond;

      // Exhaust user-1 rate limit
      for (let i = 0; i < maxPerSecond; i++) {
        await limiter1.checkLimit(100);
      }

      // user-2 should still be able to make requests
      await expect(limiter2.checkLimit(100)).resolves.not.toThrow();
    });

    it('should enforce per-user token limits', async () => {
      const limiter = createGeminiRateLimiter('user-123');
      const maxTokens = GEMINI_RATE_LIMITS.PER_USER.maxTokensPerMinute;

      // Try to consume more tokens than allowed
      await expect(limiter.checkLimit(maxTokens + 1000)).rejects.toThrow(GeminiRateLimitError);
    });
  });

  describe('withGeminiRateLimit', () => {
    it('should execute function with rate limiting', async () => {
      const mockFn = vi.fn(async () => 'result');

      const result = await withGeminiRateLimit(mockFn, {
        userId: 'user-123',
        estimatedTokens: 1000,
      });

      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should propagate rate limit error from limiter', async () => {
      // Test that rate limit errors are properly propagated
      const mockFn = vi.fn(async () => 'result');
      
      // Try to exceed token limit (easier to test than request count)
      const maxTokens = GEMINI_RATE_LIMITS.GLOBAL.maxTokensPerMinute;

      await expect(
        withGeminiRateLimit(mockFn, {
          estimatedTokens: maxTokens + 1000, // Exceed token limit
        })
      ).rejects.toThrow(GeminiRateLimitError);

      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should use cache when available', async () => {
      const { cacheGet } = await import('@/lib/cache');
      vi.mocked(cacheGet).mockResolvedValueOnce('cached-result');

      const mockFn = vi.fn(async () => 'fresh-result');

      const result = await withGeminiRateLimit(mockFn, {
        cacheKey: 'test-key',
        estimatedTokens: 1000,
      });

      expect(result).toBe('cached-result');
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should cache result after execution', async () => {
      const { cacheSet } = await import('@/lib/cache');

      const mockFn = vi.fn(async () => 'fresh-result');

      const result = await withGeminiRateLimit(mockFn, {
        cacheKey: 'test-key',
        estimatedTokens: 1000,
      });

      expect(result).toBe('fresh-result');
      expect(cacheSet).toHaveBeenCalledWith('test-key', 'fresh-result', { ttl: 300 });
    });

    it('should skip cache when skipCache is true', async () => {
      const { cacheGet } = await import('@/lib/cache');
      vi.mocked(cacheGet).mockResolvedValueOnce('cached-result');

      const mockFn = vi.fn(async () => 'fresh-result');

      const result = await withGeminiRateLimit(mockFn, {
        cacheKey: 'test-key',
        estimatedTokens: 1000,
        skipCache: true,
      });

      expect(result).toBe('fresh-result');
      expect(mockFn).toHaveBeenCalled();
    });
  });

  describe('withGeminiRetry', () => {
    it('should execute function without retry on success', async () => {
      const mockFn = vi.fn(async () => 'result');

      const result = await withGeminiRetry(mockFn);

      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on rate limit error', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new GeminiRateLimitError('Rate limit', 100, 'global'))
        .mockResolvedValueOnce('result');

      const result = await withGeminiRetry(mockFn, {
        initialDelayMs: 10, // Fast retry for tests
      });

      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on quota exceeded error', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new GeminiQuotaExceededError('Quota exceeded'));

      await expect(withGeminiRetry(mockFn)).rejects.toThrow(GeminiQuotaExceededError);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should respect max retries', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValue(new GeminiRateLimitError('Rate limit', 100, 'global'));

      await expect(
        withGeminiRetry(mockFn, {
          maxRetries: 2,
          initialDelayMs: 10,
        })
      ).rejects.toThrow(GeminiRateLimitError);

      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should use exponential backoff', async () => {
      const delays: number[] = [];
      const mockFn = vi
        .fn()
        .mockRejectedValue(new GeminiRateLimitError('Rate limit', 0, 'global'));

      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((fn: () => void, delay: number) => {
        delays.push(delay);
        return originalSetTimeout(fn, 0);
      }) as unknown as typeof setTimeout;

      try {
        await withGeminiRetry(mockFn, {
          maxRetries: 2,
          initialDelayMs: 100,
          backoffMultiplier: 2,
        });
      } catch {
        // Expected to fail
      }

      global.setTimeout = originalSetTimeout;

      expect(delays).toEqual([100, 200]); // Exponential backoff
    });
  });

  describe('getGeminiRateLimitStatus', () => {
    it('should get global rate limit status', async () => {
      const limiter = createGeminiRateLimiter();
      await limiter.checkLimit(1000);

      const status = await getGeminiRateLimitStatus();

      expect(status.global).toBeDefined();
      expect(status.global.second.current).toBeGreaterThanOrEqual(0);
      expect(status.user).toBeUndefined();
    });

    it('should get user rate limit status', async () => {
      const limiter = createGeminiRateLimiter('user-123');
      await limiter.checkLimit(1000);

      const status = await getGeminiRateLimitStatus('user-123');

      expect(status.global).toBeDefined();
      expect(status.user).toBeDefined();
      expect(status.user?.second.current).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Rate Limit Error', () => {
    it('should include retry-after time', () => {
      const error = new GeminiRateLimitError('Rate limit exceeded', 5000, 'global');

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.retryAfterMs).toBe(5000);
      expect(error.limitType).toBe('global');
      expect(error.name).toBe('GeminiRateLimitError');
    });
  });

  describe('Quota Exceeded Error', () => {
    it('should be a distinct error type', () => {
      const error = new GeminiQuotaExceededError('Quota exceeded');

      expect(error.message).toBe('Quota exceeded');
      expect(error.name).toBe('GeminiQuotaExceededError');
    });
  });
});
