/**
 * Vector Search Service
 * 
 * Production service for semantic search across trades, playbooks, 
 * journal entries, and coach conversations.
 * 
 * Features:
 * - User-scoped search (multi-tenancy)
 * - Filtered search (by symbol, date, etc.)
 * - Similarity threshold filtering
 * - Batch search support
 */

import {
  getQdrantClient,
  isQdrantConfigured,
  COLLECTIONS,
  type CollectionName,
  type QdrantSearchResult,
  type QdrantFilter,
  buildTradeFilter,
  buildPlaybookFilter,
  buildJournalFilter,
  buildCoachHistoryFilter,
} from '@/lib/qdrant';
import { generateEmbedding } from '@/lib/embeddings';
import { logger } from '@/lib/observability';

// ============================================================================
// Types
// ============================================================================

export interface SearchOptions {
  limit?: number;
  scoreThreshold?: number;
}

export interface SimilarTrade {
  tradeId: string;
  score: number;
  symbol: string;
  direction: string;
  pnlPositive: boolean;
  closedAt: Date;
}

export interface SimilarPlaybook {
  playbookId: string;
  score: number;
  name: string;
  isPublic: boolean;
}

export interface SimilarJournalEntry {
  journalId: string;
  score: number;
  date: Date;
}

export interface SimilarCoachMessage {
  messageId: string;
  conversationId: string;
  score: number;
  role: string;
  createdAt: Date;
}

// ============================================================================
// Vector Search Service Class
// ============================================================================

export class VectorSearchService {
  private client = getQdrantClient();

  /**
   * Check if vector search is available
   */
  isAvailable(): boolean {
    return isQdrantConfigured();
  }

  /**
   * Check if Qdrant is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    return this.client.isHealthy();
  }

  // ==========================================================================
  // Trade Search
  // ==========================================================================

  /**
   * Search for similar trades based on text query
   */
  async searchSimilarTrades(
    userId: string,
    query: string,
    options?: SearchOptions & {
      symbol?: string;
      direction?: 'LONG' | 'SHORT';
      pnlPositive?: boolean;
      dateRange?: { start: Date; end: Date };
    }
  ): Promise<SimilarTrade[]> {
    const startTime = Date.now();

    // Generate embedding for query
    const embeddingResult = await generateEmbedding(query);

    // Build filter
    const filter = buildTradeFilter({
      userId,
      symbol: options?.symbol,
      direction: options?.direction,
      pnlPositive: options?.pnlPositive,
      dateRange: options?.dateRange,
    });

    // Search
    const results = await this.client.search(COLLECTIONS.trades, embeddingResult.embedding, {
      limit: options?.limit ?? 10,
      scoreThreshold: options?.scoreThreshold ?? 0.7,
      filter,
    });

    const latency = Date.now() - startTime;
    logger.info('Similar trades search', { userId, resultCount: results.length, latency });

    return results.map((r) => this.mapToTrade(r));
  }

  /**
   * Search for trades similar to a given trade
   */
  async searchSimilarToTrade(
    userId: string,
    tradeEmbedding: number[],
    options?: SearchOptions & {
      excludeTradeId?: string;
      symbol?: string;
    }
  ): Promise<SimilarTrade[]> {
    const filter = buildTradeFilter({
      userId,
      symbol: options?.symbol,
    });

    const results = await this.client.search(COLLECTIONS.trades, tradeEmbedding, {
      limit: (options?.limit ?? 10) + 1, // +1 to filter self
      scoreThreshold: options?.scoreThreshold ?? 0.7,
      filter,
    });

    // Filter out the source trade
    const filtered = options?.excludeTradeId
      ? results.filter((r) => r.payload.trade_id !== options.excludeTradeId)
      : results;

    return filtered.slice(0, options?.limit ?? 10).map((r) => this.mapToTrade(r));
  }

  private mapToTrade(result: QdrantSearchResult): SimilarTrade {
    return {
      tradeId: String(result.payload.trade_id),
      score: result.score,
      symbol: String(result.payload.symbol || ''),
      direction: String(result.payload.direction || ''),
      pnlPositive: Boolean(result.payload.pnl_positive),
      closedAt: new Date((result.payload.closed_at as number) * 1000),
    };
  }

  // ==========================================================================
  // Playbook Search
  // ==========================================================================

  /**
   * Search for similar playbooks
   */
  async searchSimilarPlaybooks(
    query: string,
    options?: SearchOptions & {
      userId?: string;
      includePublic?: boolean;
    }
  ): Promise<SimilarPlaybook[]> {
    const startTime = Date.now();

    // Generate embedding
    const embeddingResult = await generateEmbedding(query);

    // Build filter - either user's playbooks or public ones
    let filter: QdrantFilter | undefined;
    
    if (options?.userId && options?.includePublic) {
      // User's playbooks OR public playbooks
      filter = {
        should: [
          { key: 'user_id', match: { value: options.userId } },
          { key: 'is_public', match: { value: true } },
        ],
      };
    } else if (options?.userId) {
      filter = buildPlaybookFilter({ userId: options.userId });
    } else if (options?.includePublic) {
      filter = buildPlaybookFilter({ isPublic: true });
    }

    const results = await this.client.search(COLLECTIONS.playbooks, embeddingResult.embedding, {
      limit: options?.limit ?? 10,
      scoreThreshold: options?.scoreThreshold ?? 0.6,
      filter,
    });

    const latency = Date.now() - startTime;
    logger.info('Similar playbooks search', { resultCount: results.length, latency });

    return results.map((r) => this.mapToPlaybook(r));
  }

  private mapToPlaybook(result: QdrantSearchResult): SimilarPlaybook {
    return {
      playbookId: String(result.payload.playbook_id),
      score: result.score,
      name: String(result.payload.name || ''),
      isPublic: Boolean(result.payload.is_public),
    };
  }

  // ==========================================================================
  // Journal Search
  // ==========================================================================

  /**
   * Search for similar journal entries
   */
  async searchSimilarJournalEntries(
    userId: string,
    query: string,
    options?: SearchOptions & {
      dateRange?: { start: Date; end: Date };
    }
  ): Promise<SimilarJournalEntry[]> {
    const startTime = Date.now();

    const embeddingResult = await generateEmbedding(query);

    const filter = buildJournalFilter({
      userId,
      dateRange: options?.dateRange,
    });

    const results = await this.client.search(COLLECTIONS.journal_entries, embeddingResult.embedding, {
      limit: options?.limit ?? 10,
      scoreThreshold: options?.scoreThreshold ?? 0.6,
      filter,
    });

    const latency = Date.now() - startTime;
    logger.info('Similar journal entries search', { userId, resultCount: results.length, latency });

    return results.map((r) => this.mapToJournalEntry(r));
  }

  private mapToJournalEntry(result: QdrantSearchResult): SimilarJournalEntry {
    return {
      journalId: String(result.payload.journal_id),
      score: result.score,
      date: new Date((result.payload.date as number) * 1000),
    };
  }

  // ==========================================================================
  // Coach History Search
  // ==========================================================================

  /**
   * Search for similar coach conversation messages
   */
  async searchCoachHistory(
    userId: string,
    query: string,
    options?: SearchOptions & {
      conversationId?: string;
    }
  ): Promise<SimilarCoachMessage[]> {
    const startTime = Date.now();

    const embeddingResult = await generateEmbedding(query);

    const filter = buildCoachHistoryFilter({
      userId,
      conversationId: options?.conversationId,
    });

    const results = await this.client.search(COLLECTIONS.coach_history, embeddingResult.embedding, {
      limit: options?.limit ?? 10,
      scoreThreshold: options?.scoreThreshold ?? 0.6,
      filter,
    });

    const latency = Date.now() - startTime;
    logger.info('Coach history search', { userId, resultCount: results.length, latency });

    return results.map((r) => this.mapToCoachMessage(r));
  }

  private mapToCoachMessage(result: QdrantSearchResult): SimilarCoachMessage {
    return {
      messageId: String(result.payload.message_id),
      conversationId: String(result.payload.conversation_id),
      score: result.score,
      role: String(result.payload.role || ''),
      createdAt: new Date((result.payload.created_at as number) * 1000),
    };
  }

  // ==========================================================================
  // Raw Search (for advanced use cases)
  // ==========================================================================

  /**
   * Raw search on any collection with custom embedding
   */
  async rawSearch(
    collection: CollectionName,
    embedding: number[],
    options?: SearchOptions & {
      filter?: QdrantFilter;
    }
  ): Promise<QdrantSearchResult[]> {
    return this.client.search(collection, embedding, {
      limit: options?.limit ?? 10,
      scoreThreshold: options?.scoreThreshold,
      filter: options?.filter,
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let vectorSearchServiceInstance: VectorSearchService | null = null;

/**
 * Get Vector Search Service singleton
 */
export function getVectorSearchService(): VectorSearchService {
  if (!vectorSearchServiceInstance) {
    vectorSearchServiceInstance = new VectorSearchService();
  }
  return vectorSearchServiceInstance;
}
