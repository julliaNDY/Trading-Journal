/**
 * Tests for AI Fallback Strategy (PRÉ-7.3)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateWithFallback,
  getProviderHealthStatus,
  resetCircuitBreaker,
  isProviderHealthy,
  getProviderStats,
  CircuitState,
} from '../ai-fallback';
import type { AIMessage, AIResponse } from '../ai-provider';

// Mock the ai-provider module
vi.mock('../ai-provider', () => ({
  generateAIResponse: vi.fn(),
  getAvailableProviders: vi.fn(() => ['gemini', 'openai']),
  AIProvider: {},
}));

// Mock the logger
vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import * as aiProvider from '../ai-provider';

describe('AI Fallback Strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to default
    vi.mocked(aiProvider.getAvailableProviders).mockReturnValue(['gemini', 'openai']);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetCircuitBreaker();
  });

  const mockMessages: AIMessage[] = [
    { role: 'user', content: 'Test message' },
  ];

  const mockResponse: AIResponse = {
    content: 'Test response',
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    },
    latencyMs: 500,
  };

  describe('generateWithFallback', () => {
    it('should succeed with primary provider', async () => {
      vi.mocked(aiProvider.generateAIResponse).mockResolvedValue(mockResponse);

      const result = await generateWithFallback(mockMessages);

      expect(result.content).toBe('Test response');
      expect(result.fallbackUsed).toBe(false);
      expect(result.retriesAttempted).toBe(0);
      expect(result.primaryProvider).toBe('gemini');
      expect(result.actualProvider).toBe('gemini');
    });

    it('should fallback to secondary provider on primary failure', async () => {
      vi.mocked(aiProvider.generateAIResponse)
        .mockRejectedValueOnce(new Error('Gemini failed'))
        .mockResolvedValueOnce({
          ...mockResponse,
          provider: 'openai',
          model: 'gpt-4o-mini',
        });

      const result = await generateWithFallback(mockMessages, {
        enableRetry: false, // Disable retry for this test
      });

      expect(result.content).toBe('Test response');
      expect(result.fallbackUsed).toBe(true);
      expect(result.actualProvider).toBe('openai');
      expect(result.primaryProvider).toBe('gemini');
    });

    it('should retry with exponential backoff', async () => {
      let callCount = 0;
      vi.mocked(aiProvider.generateAIResponse).mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary failure');
        }
        return mockResponse;
      });

      const startTime = Date.now();
      const result = await generateWithFallback(mockMessages, {
        retry: {
          maxRetries: 3,
          initialDelayMs: 100,
          maxDelayMs: 1000,
          backoffMultiplier: 2,
        },
        fallbackProvider: 'gemini', // Same as preferred to test retry
      });

      const duration = Date.now() - startTime;

      expect(result.content).toBe('Test response');
      expect(result.retriesAttempted).toBe(2); // Failed 2 times, succeeded on 3rd
      expect(callCount).toBe(3);
      expect(duration).toBeGreaterThanOrEqual(300); // At least 100ms + 200ms delays
    });

    it('should throw error when all providers fail', async () => {
      vi.mocked(aiProvider.generateAIResponse).mockRejectedValue(
        new Error('All providers failed')
      );

      await expect(
        generateWithFallback(mockMessages, {
          enableRetry: false,
        })
      ).rejects.toThrow('All AI providers failed');
    });

    it('should respect timeout configuration', async () => {
      vi.mocked(aiProvider.generateAIResponse).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockResponse), 5000))
      );

      await expect(
        generateWithFallback(mockMessages, {
          circuitBreaker: {
            failureThreshold: 5,
            successThreshold: 2,
            timeoutMs: 100, // Very short timeout
            resetTimeoutMs: 60000,
          },
          enableRetry: false,
        })
      ).rejects.toThrow('timeout');
    }, 10000);
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after failure threshold', async () => {
      // Reset circuit breaker at start of test (force recreate)
      resetCircuitBreaker(undefined, true);
      
      // Mock getAvailableProviders to only return gemini (no fallback)
      vi.mocked(aiProvider.getAvailableProviders).mockReturnValue(['gemini']);
      
      vi.mocked(aiProvider.generateAIResponse).mockRejectedValue(
        new Error('Provider error')
      );

      const config = {
        circuitBreaker: {
          failureThreshold: 3,
          successThreshold: 2,
          timeoutMs: 30000,
          resetTimeoutMs: 60000,
        },
        enableRetry: false,
        enableCircuitBreaker: true,
        preferredProvider: 'gemini' as const,
        fallbackProvider: 'gemini' as const, // Same as preferred to test circuit breaker
      };

      // Fail 3 times to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await generateWithFallback(mockMessages, config);
        } catch (error) {
          // Expected
        }
      }

      const health = getProviderHealthStatus();
      // Check that failures were recorded
      expect(health.gemini?.totalFailures).toBeGreaterThanOrEqual(3);
      expect(health.gemini?.state).toBe(CircuitState.OPEN);
      expect(isProviderHealthy('gemini')).toBe(false);
      
      // Restore mock
      vi.mocked(aiProvider.getAvailableProviders).mockReturnValue(['gemini', 'openai']);
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      // Reset circuit breaker at start of test (force recreate)
      resetCircuitBreaker(undefined, true);
      
      // Mock getAvailableProviders to only return gemini (no fallback)
      vi.mocked(aiProvider.getAvailableProviders).mockReturnValue(['gemini']);
      
      vi.mocked(aiProvider.generateAIResponse).mockRejectedValue(
        new Error('Provider error')
      );

      const config = {
        circuitBreaker: {
          failureThreshold: 2,
          successThreshold: 2,
          timeoutMs: 30000,
          resetTimeoutMs: 100, // Very short reset timeout
        },
        enableRetry: false,
        preferredProvider: 'gemini' as const,
        fallbackProvider: 'gemini' as const,
      };

      // Open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await generateWithFallback(mockMessages, config);
        } catch (error) {
          // Expected
        }
      }

      expect(getProviderHealthStatus().gemini?.state).toBe(CircuitState.OPEN);

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Mock success for next attempt
      vi.mocked(aiProvider.generateAIResponse).mockResolvedValue(mockResponse);

      // Should transition to HALF_OPEN and allow attempt
      await generateWithFallback(mockMessages, config);

      const health = getProviderHealthStatus();
      expect(health.gemini?.state).toBe(CircuitState.HALF_OPEN);
      
      // Restore mock
      vi.mocked(aiProvider.getAvailableProviders).mockReturnValue(['gemini', 'openai']);
    });

    it('should close circuit after success threshold in HALF_OPEN', async () => {
      // First, open the circuit
      vi.mocked(aiProvider.generateAIResponse).mockRejectedValue(
        new Error('Provider error')
      );

      const config = {
        circuitBreaker: {
          failureThreshold: 2,
          successThreshold: 2,
          timeoutMs: 30000,
          resetTimeoutMs: 50,
        },
        enableRetry: false,
        fallbackProvider: 'gemini',
      };

      for (let i = 0; i < 2; i++) {
        try {
          await generateWithFallback(mockMessages, config);
        } catch (error) {
          // Expected
        }
      }

      // Wait for reset
      await new Promise(resolve => setTimeout(resolve, 100));

      // Now succeed to close circuit
      vi.mocked(aiProvider.generateAIResponse).mockResolvedValue(mockResponse);

      // Need 2 successes to close
      await generateWithFallback(mockMessages, config);
      await generateWithFallback(mockMessages, config);

      const health = getProviderHealthStatus();
      expect(health.gemini?.state).toBe(CircuitState.CLOSED);
      expect(isProviderHealthy('gemini')).toBe(true);
    });

    it('should reset circuit breaker manually', () => {
      // Manually set up a broken state
      vi.mocked(aiProvider.generateAIResponse).mockRejectedValue(
        new Error('Error')
      );

      resetCircuitBreaker('gemini');

      const health = getProviderHealthStatus();
      expect(health.gemini?.state).toBe(CircuitState.CLOSED);
      expect(health.gemini?.failures).toBe(0);
    });
  });

  describe('Provider Statistics', () => {
    it('should track success rate', async () => {
      vi.mocked(aiProvider.generateAIResponse)
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockResponse)
        .mockRejectedValueOnce(new Error('Failure'));

      const config = {
        enableRetry: false,
        fallbackProvider: 'gemini',
      };

      // 2 successes
      await generateWithFallback(mockMessages, config);
      await generateWithFallback(mockMessages, config);

      // 1 failure
      try {
        await generateWithFallback(mockMessages, config);
      } catch (error) {
        // Expected
      }

      const stats = getProviderStats('gemini');
      expect(stats).not.toBeNull();
      expect(stats!.totalRequests).toBe(3);
      expect(stats!.successRate).toBeCloseTo(66.67, 1); // 2/3 = 66.67%
    });

    it('should track average latency', async () => {
      vi.mocked(aiProvider.generateAIResponse)
        .mockResolvedValueOnce({ ...mockResponse, latencyMs: 100 })
        .mockResolvedValueOnce({ ...mockResponse, latencyMs: 200 })
        .mockResolvedValueOnce({ ...mockResponse, latencyMs: 300 });

      const config = {
        enableRetry: false,
        fallbackProvider: 'gemini',
      };

      await generateWithFallback(mockMessages, config);
      await generateWithFallback(mockMessages, config);
      await generateWithFallback(mockMessages, config);

      const stats = getProviderStats('gemini');
      expect(stats).not.toBeNull();
      expect(stats!.averageLatencyMs).toBeGreaterThan(0);
      expect(stats!.averageLatencyMs).toBeLessThan(400);
    });
  });

  describe('Configuration', () => {
    it('should respect custom retry configuration', async () => {
      let callCount = 0;
      vi.mocked(aiProvider.generateAIResponse).mockImplementation(async () => {
        callCount++;
        if (callCount < 5) {
          throw new Error('Temporary failure');
        }
        return mockResponse;
      });

      const result = await generateWithFallback(mockMessages, {
        retry: {
          maxRetries: 5,
          initialDelayMs: 50,
          maxDelayMs: 500,
          backoffMultiplier: 1.5,
        },
        fallbackProvider: 'gemini',
      });

      expect(result.retriesAttempted).toBe(4);
      expect(callCount).toBe(5);
    });

    it('should disable retry when configured', async () => {
      let callCount = 0;
      vi.mocked(aiProvider.generateAIResponse).mockImplementation(async () => {
        callCount++;
        throw new Error('Failure');
      });

      await expect(
        generateWithFallback(mockMessages, {
          enableRetry: false,
          enableCircuitBreaker: false, // Disable to ensure both providers are tried
        })
      ).rejects.toThrow();

      expect(callCount).toBe(2); // Primary + fallback, no retries
    });

    it('should disable circuit breaker when configured', async () => {
      vi.mocked(aiProvider.generateAIResponse).mockRejectedValue(
        new Error('Provider error')
      );

      const config = {
        enableCircuitBreaker: false,
        enableRetry: false,
        fallbackProvider: 'gemini',
      };

      // Fail many times
      for (let i = 0; i < 10; i++) {
        try {
          await generateWithFallback(mockMessages, config);
        } catch (error) {
          // Expected
        }
      }

      // Circuit should still be CLOSED (not tracking)
      const health = getProviderHealthStatus();
      expect(health.gemini?.state).toBe(CircuitState.CLOSED);
    });
  });

  describe('Health Status', () => {
    it('should return health status for all providers', () => {
      const health = getProviderHealthStatus();

      expect(health).toHaveProperty('gemini');
      expect(health).toHaveProperty('openai');
      expect(health.gemini?.provider).toBe('gemini');
      expect(health.openai?.provider).toBe('openai');
    });

    it('should update health status after requests', async () => {
      vi.mocked(aiProvider.generateAIResponse).mockResolvedValue(mockResponse);

      await generateWithFallback(mockMessages, {
        enableRetry: false,
      });

      const health = getProviderHealthStatus();
      expect(health.gemini?.totalRequests).toBeGreaterThan(0);
      expect(health.gemini?.totalSuccesses).toBeGreaterThan(0);
    });
  });
});
