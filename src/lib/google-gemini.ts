import { GoogleGenerativeAI, GenerativeModel, EmbedContentResponse } from '@google/generative-ai';
import { withGeminiRateLimit, withGeminiRetry } from './gemini-rate-limiter';

// Singleton Google Gemini client
let geminiClient: GoogleGenerativeAI | null = null;
let geminiModel: GenerativeModel | null = null;
let geminiEmbeddingModel: GenerativeModel | null = null;

/**
 * Default model configurations
 */
export const GEMINI_MODELS = {
  // Main chat/generation models
  GEMINI_2_FLASH: 'gemini-2.0-flash-exp', // Latest, fastest
  GEMINI_1_5_FLASH: 'gemini-1.5-flash', // Fast, cost-effective
  GEMINI_1_5_PRO: 'gemini-1.5-pro', // Most capable
  
  // Embedding models
  TEXT_EMBEDDING_004: 'text-embedding-004', // Latest embedding model
} as const;

/**
 * Get the Google Gemini client instance
 * Throws if GOOGLE_GEMINI_API_KEY is not configured
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error(
        'GOOGLE_GEMINI_API_KEY is not configured. Please add it to your .env file.'
      );
    }
    
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  
  return geminiClient;
}

/**
 * Get the main Gemini generative model (for chat/generation)
 * Default: gemini-1.5-flash (fast + cost-effective)
 */
export function getGeminiModel(modelName?: string): GenerativeModel {
  if (!geminiModel || modelName) {
    const client = getGeminiClient();
    const model = modelName || GEMINI_MODELS.GEMINI_1_5_FLASH;
    geminiModel = client.getGenerativeModel({ model });
  }
  
  return geminiModel;
}

/**
 * Get the Gemini embedding model
 */
export function getGeminiEmbeddingModel(): GenerativeModel {
  if (!geminiEmbeddingModel) {
    const client = getGeminiClient();
    geminiEmbeddingModel = client.getGenerativeModel({ 
      model: GEMINI_MODELS.TEXT_EMBEDDING_004 
    });
  }
  
  return geminiEmbeddingModel;
}

/**
 * Check if Google Gemini is configured
 */
export function isGeminiConfigured(): boolean {
  return !!process.env.GOOGLE_GEMINI_API_KEY;
}

/**
 * Generate text using Gemini
 */
export async function generateWithGemini(
  prompt: string,
  options?: {
    model?: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    userId?: string;
    cacheKey?: string;
    skipCache?: boolean;
  }
): Promise<{
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}> {
  // Estimate tokens for rate limiting (rough estimate: 1 token ≈ 4 chars)
  const fullPrompt = options?.systemPrompt 
    ? `${options.systemPrompt}\n\n${prompt}`
    : prompt;
  const estimatedTokens = Math.ceil(fullPrompt.length / 4) + (options?.maxTokens ?? 1500);

  return withGeminiRetry(async () => {
    return withGeminiRateLimit(
      async () => {
        const model = options?.model 
          ? getGeminiClient().getGenerativeModel({ model: options.model })
          : getGeminiModel();
        
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: options?.temperature ?? 0.7,
            maxOutputTokens: options?.maxTokens ?? 1500,
          },
        });
        
        const response = result.response;
        const text = response.text();
        
        // Gemini doesn't provide exact token counts in the same way as OpenAI
        // We estimate based on response metadata when available
        const usageMetadata = response.usageMetadata;
        
        return {
          content: text,
          usage: usageMetadata ? {
            promptTokens: usageMetadata.promptTokenCount ?? 0,
            completionTokens: usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: usageMetadata.totalTokenCount ?? 0,
          } : undefined,
        };
      },
      {
        userId: options?.userId,
        cacheKey: options?.cacheKey,
        estimatedTokens,
        skipCache: options?.skipCache,
      }
    );
  });
}

/**
 * Generate chat response using Gemini with conversation history
 */
export async function chatWithGemini(
  messages: Array<{ role: 'user' | 'model' | 'system'; content: string }>,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    userId?: string;
    cacheKey?: string;
    skipCache?: boolean;
  }
): Promise<{
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}> {
  // Estimate tokens for rate limiting
  const totalContent = messages.map(m => m.content).join('\n');
  const estimatedTokens = Math.ceil(totalContent.length / 4) + (options?.maxTokens ?? 1500);

  return withGeminiRetry(async () => {
    return withGeminiRateLimit(
      async () => {
        const model = options?.model 
          ? getGeminiClient().getGenerativeModel({ model: options.model })
          : getGeminiModel();
        
        // Extract system prompt if present
        const systemMessages = messages.filter(m => m.role === 'system');
        const systemPrompt = systemMessages.map(m => m.content).join('\n\n');
        
        // Convert messages to Gemini format (system messages become part of first user message)
        const conversationMessages = messages.filter(m => m.role !== 'system');
        const geminiContents = conversationMessages.map((m, index) => {
          let content = m.content;
          
          // Add system prompt to first user message
          if (index === 0 && m.role === 'user' && systemPrompt) {
            content = `${systemPrompt}\n\n---\n\n${content}`;
          }
          
          return {
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: content }],
          };
        });
        
        const result = await model.generateContent({
          contents: geminiContents,
          generationConfig: {
            temperature: options?.temperature ?? 0.7,
            maxOutputTokens: options?.maxTokens ?? 1500,
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
        };
      },
      {
        userId: options?.userId,
        cacheKey: options?.cacheKey,
        estimatedTokens,
        skipCache: options?.skipCache,
      }
    );
  });
}

/**
 * Generate embeddings using Gemini
 */
export async function generateGeminiEmbeddings(
  text: string | string[],
  options?: {
    userId?: string;
    cacheKey?: string;
    skipCache?: boolean;
  }
): Promise<{
  embeddings: number[][];
  model: string;
}> {
  const texts = Array.isArray(text) ? text : [text];
  const totalContent = texts.join('\n');
  const estimatedTokens = Math.ceil(totalContent.length / 4);

  return withGeminiRetry(async () => {
    return withGeminiRateLimit(
      async () => {
        const model = getGeminiEmbeddingModel();
        const embeddings: number[][] = [];
        
        for (const t of texts) {
          const result: EmbedContentResponse = await model.embedContent(t);
          embeddings.push(result.embedding.values);
        }
        
        return {
          embeddings,
          model: GEMINI_MODELS.TEXT_EMBEDDING_004,
        };
      },
      {
        userId: options?.userId,
        cacheKey: options?.cacheKey,
        estimatedTokens,
        skipCache: options?.skipCache,
      }
    );
  });
}

/**
 * Get embedding dimension for Gemini's text-embedding-004 model
 * text-embedding-004 produces 768-dimensional embeddings
 */
export function getGeminiEmbeddingDimension(): number {
  return 768;
}
