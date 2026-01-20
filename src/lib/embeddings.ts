/**
 * Embeddings Service
 * 
 * Unified embeddings generation with support for:
 * - Google Gemini text-embedding-004 (preferred, 768 dimensions)
 * - OpenAI text-embedding-3-large (fallback, 3072 dimensions)
 * 
 * Designed for integration with Vector DB (Qdrant/Pinecone) in Story 1.3.
 */

import { 
  generateEmbeddings as generateWithProvider, 
  getEmbeddingDimension as getProviderDimension,
  getPreferredProvider,
  type AIEmbeddingResponse,
  type AIProvider
} from './ai-provider';

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingResult {
  embedding: number[];
  provider: AIProvider;
  model: string;
  dimension: number;
  latencyMs: number;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  provider: AIProvider;
  model: string;
  dimension: number;
  latencyMs: number;
  count: number;
}

export interface EmbeddingConfig {
  preferredProvider?: AIProvider;
  fallbackEnabled?: boolean;
}

// ============================================================================
// Single Embedding Generation
// ============================================================================

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(
  text: string,
  config?: EmbeddingConfig
): Promise<EmbeddingResult> {
  const response: AIEmbeddingResponse = await generateWithProvider(text, {
    preferredProvider: config?.preferredProvider || 'gemini',
    fallbackEnabled: config?.fallbackEnabled ?? true,
  });
  
  return {
    embedding: response.embeddings[0],
    provider: response.provider,
    model: response.model,
    dimension: response.dimension,
    latencyMs: response.latencyMs,
  };
}

// ============================================================================
// Batch Embedding Generation
// ============================================================================

/**
 * Generate embeddings for multiple texts
 * More efficient than calling generateEmbedding multiple times
 */
export async function generateBatchEmbeddings(
  texts: string[],
  config?: EmbeddingConfig
): Promise<BatchEmbeddingResult> {
  if (texts.length === 0) {
    throw new Error('Cannot generate embeddings for empty text array');
  }
  
  const response: AIEmbeddingResponse = await generateWithProvider(texts, {
    preferredProvider: config?.preferredProvider || 'gemini',
    fallbackEnabled: config?.fallbackEnabled ?? true,
  });
  
  return {
    embeddings: response.embeddings,
    provider: response.provider,
    model: response.model,
    dimension: response.dimension,
    latencyMs: response.latencyMs,
    count: texts.length,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the embedding dimension for the current/preferred provider
 */
export function getEmbeddingDimension(provider?: AIProvider): number {
  return getProviderDimension(provider);
}

/**
 * Get the currently preferred embedding provider
 */
export function getPreferredEmbeddingProvider(): AIProvider | null {
  return getPreferredProvider();
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimensions must match: ${a.length} vs ${b.length}`);
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculate Euclidean distance between two embeddings
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimensions must match: ${a.length} vs ${b.length}`);
  }
  
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  
  return Math.sqrt(sum);
}

/**
 * Find the most similar embedding from a list
 */
export function findMostSimilar(
  queryEmbedding: number[],
  candidateEmbeddings: number[][],
  metric: 'cosine' | 'euclidean' = 'cosine'
): { index: number; score: number } | null {
  if (candidateEmbeddings.length === 0) {
    return null;
  }
  
  let bestIndex = 0;
  let bestScore = metric === 'cosine' ? -Infinity : Infinity;
  
  for (let i = 0; i < candidateEmbeddings.length; i++) {
    const score = metric === 'cosine'
      ? cosineSimilarity(queryEmbedding, candidateEmbeddings[i])
      : euclideanDistance(queryEmbedding, candidateEmbeddings[i]);
    
    const isBetter = metric === 'cosine' ? score > bestScore : score < bestScore;
    if (isBetter) {
      bestIndex = i;
      bestScore = score;
    }
  }
  
  return { index: bestIndex, score: bestScore };
}

/**
 * Normalize an embedding to unit length (for cosine similarity optimization)
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return embedding;
  return embedding.map(val => val / norm);
}

// ============================================================================
// Trade-Specific Embeddings (for AI Coach / Similarity Search)
// ============================================================================

export interface TradeEmbeddingInput {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  pnlUsd: number;
  winRate?: number;
  riskReward?: number;
  duration?: number; // in seconds
  notes?: string;
  tags?: string[];
}

/**
 * Create a text representation of a trade for embedding
 */
export function tradeToEmbeddingText(trade: TradeEmbeddingInput): string {
  const parts: string[] = [];
  
  // Core trade info
  parts.push(`${trade.direction} trade on ${trade.symbol}`);
  
  // Result
  if (trade.pnlUsd > 0) {
    parts.push(`winning trade with profit of $${trade.pnlUsd.toFixed(2)}`);
  } else if (trade.pnlUsd < 0) {
    parts.push(`losing trade with loss of $${Math.abs(trade.pnlUsd).toFixed(2)}`);
  } else {
    parts.push('breakeven trade');
  }
  
  // Risk/Reward
  if (trade.riskReward !== undefined) {
    parts.push(`risk-reward ratio of ${trade.riskReward.toFixed(2)}`);
  }
  
  // Duration
  if (trade.duration !== undefined) {
    const minutes = Math.floor(trade.duration / 60);
    if (minutes < 60) {
      parts.push(`duration ${minutes} minutes`);
    } else {
      const hours = Math.floor(minutes / 60);
      parts.push(`duration ${hours} hours`);
    }
  }
  
  // Notes
  if (trade.notes) {
    parts.push(`notes: ${trade.notes}`);
  }
  
  // Tags
  if (trade.tags && trade.tags.length > 0) {
    parts.push(`tags: ${trade.tags.join(', ')}`);
  }
  
  return parts.join('. ');
}

/**
 * Generate embedding for a trade
 */
export async function generateTradeEmbedding(
  trade: TradeEmbeddingInput,
  config?: EmbeddingConfig
): Promise<EmbeddingResult> {
  const text = tradeToEmbeddingText(trade);
  return generateEmbedding(text, config);
}
