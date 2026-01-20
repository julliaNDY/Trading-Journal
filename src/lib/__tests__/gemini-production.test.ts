/**
 * Tests for Gemini Production API Integration
 * PRÉ-7.1: API Integration (16h) - Phase 11
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  generateWithGeminiProduction,
  getGeminiHealthStatus,
  getRateLimitInfo,
  resetHealthMetrics,
  batchGenerateWithGemini,
  isGeminiConfigured,
  RATE_LIMIT,
  CACHE_CONFIG,
  type GeminiRequest,
} from '../gemini-production';

// Mock dependencies
vi.mock('@google/generative-ai');
vi.mock('../openai');
vi.mock('../cache');
vi.mock('../observability');
vi.mock('../queue/redis');

describe('Gemini Production API Integration', () => {
  beforeEach(() => {
    // Reset environment
    process.env.GOOGLE_GEMINI_API_KEY = 'test-gemini-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    
    // Reset health metrics
    resetHealthMetrics();
    
    // Clear mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration', () => {
    it('should detect Gemini configuration', () => {
      expect(isGeminiConfigured()).toBe(true);
    });

    it('should detect missing Gemini configuration', () => {
      delete process.env.GOOGLE_GEMINI_API_KEY;
      expect(isGeminiConfigured()).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limit info', () => {
      const rateLimitInfo = getRateLimitInfo();
      
      expect(rateLimitInfo).toHaveProperty('remaining');
      expect(rateLimitInfo).toHaveProperty('resetAt');
      expect(rateLimitInfo).toHaveProperty('limit');
      expect(rateLimitInfo.limit).toBe(RATE_LIMIT.MAX_REQUESTS_PER_SECOND);
    });

    it('should enforce rate limit of 10 req/sec', async () => {
      const request: GeminiRequest = {
        prompt: 'Test prompt',
        skipCache: true,
      };

      // Mock successful responses
      const mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => 'Test response',
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30,
          },
        },
      });

      vi.mock('@google/generative-ai', () => ({
        GoogleGenerativeAI: vi.fn(() => ({
          getGenerativeModel: () => ({
            generateContent: mockGenerateContent,
          }),
        })),
      }));

      // Make 10 requests (should succeed)
      const promises = Array(10).fill(null).map(() => 
        generateWithGeminiProduction(request)
      );

      await Promise.all(promises);

      // Rate limit info should show 0 remaining
      const rateLimitInfo = getRateLimitInfo();
      expect(rateLimitInfo.remaining).toBeLessThanOrEqual(0);
    });
  });

  describe('Caching', () => {
    it('should use cache key from request', async () => {
      const request: GeminiRequest = {
        prompt: 'Test prompt',
        cacheKey: 'test-cache-key',
      };

      const mockCacheGet = vi.fn().mockResolvedValue({
        content: 'Cached response',
        provider: 'gemini',
      });

      vi.mock('../cache', () => ({
        cacheGet: mockCacheGet,
        cacheSet: vi.fn(),
        getOrSetCache: vi.fn(),
      }));

      const response = await generateWithGeminiProduction(request);

      expect(response.cached).toBe(true);
      expect(response.content).toBe('Cached response');
    });

    it('should skip cache when skipCache is true', async () => {
      const request: GeminiRequest = {
        prompt: 'Test prompt',
        skipCache: true,
      };

      const mockCacheGet = vi.fn();

      vi.mock('../cache', () => ({
        cacheGet: mockCacheGet,
        cacheSet: vi.fn(),
      }));

      await generateWithGeminiProduction(request).catch(() => {
        // Expected to fail without proper mocks
      });

      expect(mockCacheGet).not.toHaveBeenCalled();
    });

    it('should cache responses with 5 minute TTL', async () => {
      const request: GeminiRequest = {
        prompt: 'Test prompt',
      };

      const mockCacheSet = vi.fn();

      vi.mock('../cache', () => ({
        cacheGet: vi.fn().mockResolvedValue(null),
        cacheSet: mockCacheSet,
      }));

      // Mock Gemini response
      vi.mock('@google/generative-ai', () => ({
        GoogleGenerativeAI: vi.fn(() => ({
          getGenerativeModel: () => ({
            generateContent: vi.fn().mockResolvedValue({
              response: {
                text: () => 'Test response',
                usageMetadata: {
                  promptTokenCount: 10,
                  candidatesTokenCount: 20,
                  totalTokenCount: 30,
                },
              },
            }),
          }),
        })),
      }));

      await generateWithGeminiProduction(request);

      expect(mockCacheSet).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          content: 'Test response',
          provider: 'gemini',
        }),
        expect.objectContaining({
          ttl: CACHE_CONFIG.TTL_SECONDS,
        })
      );
    });
  });

  describe('Retry Logic', () => {
    it('should retry on failure with exponential backoff', async () => {
      const request: GeminiRequest = {
        prompt: 'Test prompt',
        skipCache: true,
      };

      let attemptCount = 0;
      const mockGenerateContent = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve({
          response: {
            text: () => 'Success after retries',
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 20,
              totalTokenCount: 30,
            },
          },
        });
      });

      vi.mock('@google/generative-ai', () => ({
        GoogleGenerativeAI: vi.fn(() => ({
          getGenerativeModel: () => ({
            generateContent: mockGenerateContent,
          }),
        })),
      }));

      const response = await generateWithGeminiProduction(request);

      expect(response.content).toBe('Success after retries');
      expect(attemptCount).toBe(3);
    });

    it('should fail after max retries', async () => {
      const request: GeminiRequest = {
        prompt: 'Test prompt',
        skipCache: true,
      };

      const mockGenerateContent = vi.fn().mockRejectedValue(
        new Error('Persistent failure')
      );

      vi.mock('@google/generative-ai', () => ({
        GoogleGenerativeAI: vi.fn(() => ({
          getGenerativeModel: () => ({
            generateContent: mockGenerateContent,
          }),
        })),
      }));

      await expect(generateWithGeminiProduction(request)).rejects.toThrow();
    });
  });

  describe('OpenAI Fallback', () => {
    it('should fallback to OpenAI when Gemini fails', async () => {
      const request: GeminiRequest = {
        prompt: 'Test prompt',
        skipCache: true,
      };

      // Mock Gemini failure
      vi.mock('@google/generative-ai', () => ({
        GoogleGenerativeAI: vi.fn(() => ({
          getGenerativeModel: () => ({
            generateContent: vi.fn().mockRejectedValue(new Error('Gemini failed')),
          }),
        })),
      }));

      // Mock OpenAI success
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: 'OpenAI fallback response',
                },
              }],
              usage: {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
              },
            }),
          },
        },
      };

      vi.mock('../openai', () => ({
        getOpenAIClient: () => mockOpenAI,
        isOpenAIConfigured: () => true,
      }));

      const response = await generateWithGeminiProduction(request);

      expect(response.content).toBe('OpenAI fallback response');
      expect(response.provider).toBe('openai');
    });

    it('should throw when both Gemini and OpenAI fail', async () => {
      const request: GeminiRequest = {
        prompt: 'Test prompt',
        skipCache: true,
      };

      // Mock Gemini failure
      vi.mock('@google/generative-ai', () => ({
        GoogleGenerativeAI: vi.fn(() => ({
          getGenerativeModel: () => ({
            generateContent: vi.fn().mockRejectedValue(new Error('Gemini failed')),
          }),
        })),
      }));

      // Mock OpenAI failure
      vi.mock('../openai', () => ({
        getOpenAIClient: () => ({
          chat: {
            completions: {
              create: vi.fn().mockRejectedValue(new Error('OpenAI failed')),
            },
          },
        }),
        isOpenAIConfigured: () => true,
      }));

      await expect(generateWithGeminiProduction(request)).rejects.toThrow();
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after consecutive failures', async () => {
      const request: GeminiRequest = {
        prompt: 'Test prompt',
        skipCache: true,
      };

      // Mock Gemini failures
      vi.mock('@google/generative-ai', () => ({
        GoogleGenerativeAI: vi.fn(() => ({
          getGenerativeModel: () => ({
            generateContent: vi.fn().mockRejectedValue(new Error('Gemini failed')),
          }),
        })),
      }));

      // Mock OpenAI failures
      vi.mock('../openai', () => ({
        getOpenAIClient: () => ({
          chat: {
            completions: {
              create: vi.fn().mockRejectedValue(new Error('OpenAI failed')),
            },
          },
        }),
        isOpenAIConfigured: () => true,
      }));

      // Make 5 consecutive failing requests
      for (let i = 0; i < 5; i++) {
        await generateWithGeminiProduction(request).catch(() => {
          // Expected to fail
        });
      }

      const healthStatus = getGeminiHealthStatus();
      expect(healthStatus.circuitBreakerOpen).toBe(true);
    });

    it('should use OpenAI when circuit is open', async () => {
      const request: GeminiRequest = {
        prompt: 'Test prompt',
        skipCache: true,
      };

      // Open circuit by failing 5 times
      vi.mock('@google/generative-ai', () => ({
        GoogleGenerativeAI: vi.fn(() => ({
          getGenerativeModel: () => ({
            generateContent: vi.fn().mockRejectedValue(new Error('Gemini failed')),
          }),
        })),
      }));

      vi.mock('../openai', () => ({
        getOpenAIClient: () => ({
          chat: {
            completions: {
              create: vi.fn().mockRejectedValue(new Error('OpenAI failed')),
            },
          },
        }),
        isOpenAIConfigured: () => true,
      }));

      for (let i = 0; i < 5; i++) {
        await generateWithGeminiProduction(request).catch(() => {});
      }

      // Now mock OpenAI success
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: 'OpenAI response with open circuit',
                },
              }],
              usage: {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
              },
            }),
          },
        },
      };

      vi.mock('../openai', () => ({
        getOpenAIClient: () => mockOpenAI,
        isOpenAIConfigured: () => true,
      }));

      const response = await generateWithGeminiProduction(request);
      expect(response.provider).toBe('openai');
    });
  });

  describe('Health Monitoring', () => {
    it('should track request count', async () => {
      const request: GeminiRequest = {
        prompt: 'Test prompt',
        skipCache: true,
      };

      resetHealthMetrics();

      // Mock successful response
      vi.mock('@google/generative-ai', () => ({
        GoogleGenerativeAI: vi.fn(() => ({
          getGenerativeModel: () => ({
            generateContent: vi.fn().mockResolvedValue({
              response: {
                text: () => 'Test response',
                usageMetadata: {
                  promptTokenCount: 10,
                  candidatesTokenCount: 20,
                  totalTokenCount: 30,
                },
              },
            }),
          }),
        })),
      }));

      await generateWithGeminiProduction(request);
      await generateWithGeminiProduction(request);

      const healthStatus = getGeminiHealthStatus();
      expect(healthStatus.requestCount).toBe(2);
    });

    it('should track error count and rate', async () => {
      const request: GeminiRequest = {
        prompt: 'Test prompt',
        skipCache: true,
      };

      resetHealthMetrics();

      // Mock failures
      vi.mock('@google/generative-ai', () => ({
        GoogleGenerativeAI: vi.fn(() => ({
          getGenerativeModel: () => ({
            generateContent: vi.fn().mockRejectedValue(new Error('Failed')),
          }),
        })),
      }));

      vi.mock('../openai', () => ({
        getOpenAIClient: () => ({
          chat: {
            completions: {
              create: vi.fn().mockRejectedValue(new Error('Failed')),
            },
          },
        }),
        isOpenAIConfigured: () => true,
      }));

      // 2 failures out of 3 requests
      await generateWithGeminiProduction(request).catch(() => {});
      await generateWithGeminiProduction(request).catch(() => {});

      const healthStatus = getGeminiHealthStatus();
      expect(healthStatus.errorCount).toBe(2);
      expect(healthStatus.errorRate).toBeGreaterThan(0);
    });

    it('should report healthy status when error rate is low', async () => {
      resetHealthMetrics();

      // Mock successful response
      vi.mock('@google/generative-ai', () => ({
        GoogleGenerativeAI: vi.fn(() => ({
          getGenerativeModel: () => ({
            generateContent: vi.fn().mockResolvedValue({
              response: {
                text: () => 'Test response',
                usageMetadata: {
                  promptTokenCount: 10,
                  candidatesTokenCount: 20,
                  totalTokenCount: 30,
                },
              },
            }),
          }),
        })),
      }));

      const request: GeminiRequest = {
        prompt: 'Test prompt',
        skipCache: true,
      };

      await generateWithGeminiProduction(request);

      const healthStatus = getGeminiHealthStatus();
      expect(healthStatus.healthy).toBe(true);
      expect(healthStatus.provider).toBe('gemini');
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple requests', async () => {
      const requests: GeminiRequest[] = [
        { prompt: 'Test 1', skipCache: true },
        { prompt: 'Test 2', skipCache: true },
        { prompt: 'Test 3', skipCache: true },
      ];

      // Mock successful responses
      vi.mock('@google/generative-ai', () => ({
        GoogleGenerativeAI: vi.fn(() => ({
          getGenerativeModel: () => ({
            generateContent: vi.fn().mockResolvedValue({
              response: {
                text: () => 'Test response',
                usageMetadata: {
                  promptTokenCount: 10,
                  candidatesTokenCount: 20,
                  totalTokenCount: 30,
                },
              },
            }),
          }),
        })),
      }));

      const responses = await batchGenerateWithGemini(requests);

      expect(responses).toHaveLength(3);
      expect(responses.every(r => r.content === 'Test response')).toBe(true);
    });

    it('should handle partial failures in batch', async () => {
      const requests: GeminiRequest[] = [
        { prompt: 'Test 1', skipCache: true },
        { prompt: 'Test 2', skipCache: true },
        { prompt: 'Test 3', skipCache: true },
      ];

      let callCount = 0;
      const mockGenerateContent = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Second request failed');
        }
        return Promise.resolve({
          response: {
            text: () => 'Test response',
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 20,
              totalTokenCount: 30,
            },
          },
        });
      });

      vi.mock('@google/generative-ai', () => ({
        GoogleGenerativeAI: vi.fn(() => ({
          getGenerativeModel: () => ({
            generateContent: mockGenerateContent,
          }),
        })),
      }));

      const responses = await batchGenerateWithGemini(requests);

      expect(responses).toHaveLength(3);
      expect(responses[0].content).toBe('Test response');
      expect(responses[1].content).toBe(''); // Failed request
      expect(responses[2].content).toBe('Test response');
    });
  });

  describe('Response Format', () => {
    it('should return correct response format', async () => {
      const request: GeminiRequest = {
        prompt: 'Test prompt',
        skipCache: true,
      };

      // Mock successful response
      vi.mock('@google/generative-ai', () => ({
        GoogleGenerativeAI: vi.fn(() => ({
          getGenerativeModel: () => ({
            generateContent: vi.fn().mockResolvedValue({
              response: {
                text: () => 'Test response',
                usageMetadata: {
                  promptTokenCount: 10,
                  candidatesTokenCount: 20,
                  totalTokenCount: 30,
                },
              },
            }),
          }),
        })),
      }));

      const response = await generateWithGeminiProduction(request);

      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('usage');
      expect(response).toHaveProperty('cached');
      expect(response).toHaveProperty('provider');
      expect(response).toHaveProperty('latency');

      expect(response.usage).toHaveProperty('promptTokens');
      expect(response.usage).toHaveProperty('completionTokens');
      expect(response.usage).toHaveProperty('totalTokens');
    });

    it('should include latency in response', async () => {
      const request: GeminiRequest = {
        prompt: 'Test prompt',
        skipCache: true,
      };

      // Mock delayed response
      vi.mock('@google/generative-ai', () => ({
        GoogleGenerativeAI: vi.fn(() => ({
          getGenerativeModel: () => ({
            generateContent: vi.fn().mockImplementation(async () => {
              await new Promise(resolve => setTimeout(resolve, 100));
              return {
                response: {
                  text: () => 'Test response',
                  usageMetadata: {
                    promptTokenCount: 10,
                    candidatesTokenCount: 20,
                    totalTokenCount: 30,
                  },
                },
              };
            }),
          }),
        })),
      }));

      const response = await generateWithGeminiProduction(request);

      expect(response.latency).toBeGreaterThan(0);
    });
  });
});
