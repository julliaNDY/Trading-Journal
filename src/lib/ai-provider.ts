/**
 * AI Provider Abstraction Layer
 * 
 * Provides a unified interface for multiple AI providers (Google Gemini, OpenAI)
 * with automatic fallback support and consistent response format.
 */

import { getOpenAIClient, isOpenAIConfigured } from './openai';
import { 
  chatWithGemini, 
  generateGeminiEmbeddings, 
  isGeminiConfigured,
  GEMINI_MODELS 
} from './google-gemini';

// ============================================================================
// Types
// ============================================================================

export type AIProvider = 'gemini' | 'openai';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  content: string;
  provider: AIProvider;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

export interface AIEmbeddingResponse {
  embeddings: number[][];
  provider: AIProvider;
  model: string;
  dimension: number;
  latencyMs: number;
}

export interface AIProviderConfig {
  preferredProvider: AIProvider;
  fallbackEnabled: boolean;
  geminiModel?: string;
  openaiModel?: string;
  temperature?: number;
  maxTokens?: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: AIProviderConfig = {
  preferredProvider: 'gemini', // Gemini preferred as per roadmap
  fallbackEnabled: true,
  geminiModel: GEMINI_MODELS.GEMINI_1_5_FLASH,
  openaiModel: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 1500,
};

// ============================================================================
// Provider Status
// ============================================================================

export function getAvailableProviders(): AIProvider[] {
  const providers: AIProvider[] = [];
  
  if (isGeminiConfigured()) {
    providers.push('gemini');
  }
  
  if (isOpenAIConfigured()) {
    providers.push('openai');
  }
  
  return providers;
}

export function isAnyProviderConfigured(): boolean {
  return isGeminiConfigured() || isOpenAIConfigured();
}

export function getPreferredProvider(): AIProvider | null {
  // Prefer Gemini as per roadmap directive
  if (isGeminiConfigured()) return 'gemini';
  if (isOpenAIConfigured()) return 'openai';
  return null;
}

// ============================================================================
// Chat Completion
// ============================================================================

async function generateWithOpenAI(
  messages: AIMessage[],
  config: AIProviderConfig
): Promise<AIResponse> {
  const startTime = performance.now();
  
  const openai = getOpenAIClient();
  const openaiMessages = messages.map(m => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }));
  
  const response = await openai.chat.completions.create({
    model: config.openaiModel || 'gpt-4o-mini',
    messages: openaiMessages,
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 1500,
  });
  
  const latencyMs = performance.now() - startTime;
  const content = response.choices[0]?.message?.content || '';
  
  return {
    content,
    provider: 'openai',
    model: config.openaiModel || 'gpt-4o-mini',
    usage: response.usage ? {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    } : undefined,
    latencyMs,
  };
}

async function generateWithGeminiProvider(
  messages: AIMessage[],
  config: AIProviderConfig
): Promise<AIResponse> {
  const startTime = performance.now();
  
  // Convert messages for Gemini (system -> model role mapping)
  const geminiMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' as const : m.role as 'user' | 'system',
    content: m.content,
  }));
  
  const response = await chatWithGemini(geminiMessages, {
    model: config.geminiModel,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });
  
  const latencyMs = performance.now() - startTime;
  
  return {
    content: response.content,
    provider: 'gemini',
    model: config.geminiModel || GEMINI_MODELS.GEMINI_1_5_FLASH,
    usage: response.usage,
    latencyMs,
  };
}

/**
 * Generate AI chat response with automatic fallback
 */
export async function generateAIResponse(
  messages: AIMessage[],
  config: Partial<AIProviderConfig> = {}
): Promise<AIResponse> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const providers = getAvailableProviders();
  
  if (providers.length === 0) {
    throw new Error('No AI provider configured. Please set GOOGLE_GEMINI_API_KEY or OPENAI_API_KEY.');
  }
  
  // Determine order of providers to try
  const providerOrder: AIProvider[] = [];
  if (fullConfig.preferredProvider && providers.includes(fullConfig.preferredProvider)) {
    providerOrder.push(fullConfig.preferredProvider);
  }
  
  if (fullConfig.fallbackEnabled) {
    for (const p of providers) {
      if (!providerOrder.includes(p)) {
        providerOrder.push(p);
      }
    }
  }
  
  let lastError: Error | null = null;
  
  for (const provider of providerOrder) {
    try {
      if (provider === 'gemini') {
        return await generateWithGeminiProvider(messages, fullConfig);
      } else if (provider === 'openai') {
        return await generateWithOpenAI(messages, fullConfig);
      }
    } catch (error) {
      lastError = error as Error;
      console.warn(`AI provider ${provider} failed:`, error);
      
      if (!fullConfig.fallbackEnabled || providerOrder.indexOf(provider) === providerOrder.length - 1) {
        throw error;
      }
      // Continue to next provider
    }
  }
  
  throw lastError || new Error('All AI providers failed');
}

// ============================================================================
// Embeddings
// ============================================================================

async function generateOpenAIEmbeddings(
  texts: string[]
): Promise<AIEmbeddingResponse> {
  const startTime = performance.now();
  
  const openai = getOpenAIClient();
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: texts,
  });
  
  const latencyMs = performance.now() - startTime;
  
  return {
    embeddings: response.data.map(d => d.embedding),
    provider: 'openai',
    model: 'text-embedding-3-large',
    dimension: 3072, // text-embedding-3-large dimension
    latencyMs,
  };
}

async function generateGeminiEmbeddingsProvider(
  texts: string[]
): Promise<AIEmbeddingResponse> {
  const startTime = performance.now();
  
  const response = await generateGeminiEmbeddings(texts);
  
  const latencyMs = performance.now() - startTime;
  
  return {
    embeddings: response.embeddings,
    provider: 'gemini',
    model: response.model,
    dimension: 768, // text-embedding-004 dimension
    latencyMs,
  };
}

/**
 * Generate embeddings with automatic fallback
 */
export async function generateEmbeddings(
  text: string | string[],
  config: Partial<AIProviderConfig> = {}
): Promise<AIEmbeddingResponse> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const texts = Array.isArray(text) ? text : [text];
  const providers = getAvailableProviders();
  
  if (providers.length === 0) {
    throw new Error('No AI provider configured for embeddings.');
  }
  
  // Determine order of providers to try
  const providerOrder: AIProvider[] = [];
  if (fullConfig.preferredProvider && providers.includes(fullConfig.preferredProvider)) {
    providerOrder.push(fullConfig.preferredProvider);
  }
  
  if (fullConfig.fallbackEnabled) {
    for (const p of providers) {
      if (!providerOrder.includes(p)) {
        providerOrder.push(p);
      }
    }
  }
  
  let lastError: Error | null = null;
  
  for (const provider of providerOrder) {
    try {
      if (provider === 'gemini') {
        return await generateGeminiEmbeddingsProvider(texts);
      } else if (provider === 'openai') {
        return await generateOpenAIEmbeddings(texts);
      }
    } catch (error) {
      lastError = error as Error;
      console.warn(`Embedding provider ${provider} failed:`, error);
      
      if (!fullConfig.fallbackEnabled || providerOrder.indexOf(provider) === providerOrder.length - 1) {
        throw error;
      }
      // Continue to next provider
    }
  }
  
  throw lastError || new Error('All embedding providers failed');
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get embedding dimension for the preferred provider
 */
export function getEmbeddingDimension(provider?: AIProvider): number {
  const p = provider || getPreferredProvider();
  
  if (p === 'gemini') {
    return 768; // text-embedding-004
  } else if (p === 'openai') {
    return 3072; // text-embedding-3-large
  }
  
  return 768; // default to Gemini
}

/**
 * Estimate cost for a response (in USD)
 * Based on January 2026 pricing
 */
export function estimateCost(
  response: AIResponse
): { inputCost: number; outputCost: number; totalCost: number } {
  const usage = response.usage;
  if (!usage) {
    return { inputCost: 0, outputCost: 0, totalCost: 0 };
  }
  
  // Pricing per 1M tokens (January 2026)
  const PRICING = {
    gemini: {
      'gemini-1.5-flash': { input: 0.075, output: 0.30 }, // $0.075/1M input, $0.30/1M output
      'gemini-1.5-pro': { input: 1.25, output: 5.00 },
      'gemini-2.0-flash-exp': { input: 0.075, output: 0.30 }, // Same as 1.5-flash for now
    },
    openai: {
      'gpt-4o-mini': { input: 0.15, output: 0.60 }, // $0.15/1M input, $0.60/1M output
      'gpt-4o': { input: 2.50, output: 10.00 },
    },
  };
  
  let inputPricePerMillion = 0.075;
  let outputPricePerMillion = 0.30;
  
  if (response.provider === 'gemini') {
    const pricing = PRICING.gemini[response.model as keyof typeof PRICING.gemini];
    if (pricing) {
      inputPricePerMillion = pricing.input;
      outputPricePerMillion = pricing.output;
    }
  } else if (response.provider === 'openai') {
    const pricing = PRICING.openai[response.model as keyof typeof PRICING.openai];
    if (pricing) {
      inputPricePerMillion = pricing.input;
      outputPricePerMillion = pricing.output;
    }
  }
  
  const inputCost = (usage.promptTokens / 1_000_000) * inputPricePerMillion;
  const outputCost = (usage.completionTokens / 1_000_000) * outputPricePerMillion;
  
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
}
