/**
 * Embedding Service for Trading Knowledge
 * PRÉ-10: Vector Search + Embeddings
 * 
 * Manages vectorization and indexing of trading-related content:
 * - Historical trades
 * - Market analysis notes
 * - Daily bias analyses
 * - Trading patterns
 * - Educational content
 */

import {
  ensureCollection,
  indexDocument,
  indexDocuments,
  searchByText,
  findSimilar,
  deleteDocument,
  VectorDocument,
  SearchResult,
} from '@/lib/vector/qdrant-client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/observability';

// ============================================================================
// Types
// ============================================================================

export interface TradeEmbedding {
  tradeId: string;
  content: string;
  metadata: {
    symbol: string;
    direction: 'LONG' | 'SHORT';
    realizedPnlUsd: number;
    openedAt: Date;
    closedAt: Date;
    userId: string;
    tags?: string[];
  };
}

export interface DailyBiasEmbedding {
  analysisId: string;
  content: string;
  metadata: {
    instrument: string;
    finalBias: 'BEARISH' | 'NEUTRAL' | 'BULLISH';
    confidence: number;
    analyzedAt: Date;
    userId: string;
  };
}

export interface MarketNoteEmbedding {
  noteId: string;
  content: string;
  metadata: {
    date: Date;
    userId: string;
    tags?: string[];
  };
}

// ============================================================================
// Constants
// ============================================================================

const TRADES_COLLECTION = 'trading_trades';
const DAILY_BIAS_COLLECTION = 'trading_daily_bias';
const MARKET_NOTES_COLLECTION = 'trading_market_notes';
const KNOWLEDGE_BASE_COLLECTION = 'trading_knowledge_base';

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize all collections
 */
export async function initializeCollections(): Promise<void> {
  try {
    await Promise.all([
      ensureCollection(TRADES_COLLECTION),
      ensureCollection(DAILY_BIAS_COLLECTION),
      ensureCollection(MARKET_NOTES_COLLECTION),
      ensureCollection(KNOWLEDGE_BASE_COLLECTION),
    ]);

    logger.info('All vector collections initialized');
  } catch (error) {
    logger.error('Failed to initialize collections', { error });
    throw error;
  }
}

// ============================================================================
// Trade Embeddings
// ============================================================================

/**
 * Generate content representation for a trade
 */
function generateTradeContent(trade: any): string {
  const direction = trade.quantity >= 0 ? 'LONG' : 'SHORT';
  const profit = trade.realizedPnlUsd >= 0 ? 'profitable' : 'losing';
  const tags = trade.tags?.map((t: any) => t.tag.name).join(', ') || 'no tags';

  return `
Trade on ${trade.symbol} (${direction})
Opened: ${trade.openedAt.toISOString()}
Closed: ${trade.closedAt.toISOString()}
Entry: $${trade.entryPrice}
Exit: $${trade.exitPrice}
Quantity: ${Math.abs(trade.quantity)}
P&L: $${trade.realizedPnlUsd.toFixed(2)} (${profit})
Tags: ${tags}
Duration: ${Math.round((trade.closedAt - trade.openedAt) / 1000 / 60)} minutes
  `.trim();
}

/**
 * Index a single trade
 */
export async function indexTrade(tradeId: string): Promise<void> {
  try {
    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!trade) {
      throw new Error(`Trade not found: ${tradeId}`);
    }

    const content = generateTradeContent(trade);
    const direction = trade.quantity >= 0 ? 'LONG' : 'SHORT';

    const document: VectorDocument = {
      id: trade.id,
      content,
      metadata: {
        symbol: trade.symbol,
        direction,
        realizedPnlUsd: trade.realizedPnlUsd,
        openedAt: trade.openedAt.toISOString(),
        closedAt: trade.closedAt.toISOString(),
        userId: trade.userId,
        tags: trade.tags?.map((t) => t.tag.name) || [],
      },
    };

    await indexDocument(document, TRADES_COLLECTION);

    logger.info('Trade indexed', { tradeId });
  } catch (error) {
    logger.error('Failed to index trade', { error, tradeId });
    throw error;
  }
}

/**
 * Index multiple trades for a user
 */
export async function indexUserTrades(userId: string, limit: number = 100): Promise<void> {
  try {
    const trades = await prisma.trade.findMany({
      where: { userId },
      take: limit,
      orderBy: { closedAt: 'desc' },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    const documents: VectorDocument[] = trades.map((trade) => {
      const content = generateTradeContent(trade);
      const direction = trade.quantity >= 0 ? 'LONG' : 'SHORT';

      return {
        id: trade.id,
        content,
        metadata: {
          symbol: trade.symbol,
          direction,
          realizedPnlUsd: trade.realizedPnlUsd,
          openedAt: trade.openedAt.toISOString(),
          closedAt: trade.closedAt.toISOString(),
          userId: trade.userId,
          tags: trade.tags?.map((t) => t.tag.name) || [],
        },
      };
    });

    await indexDocuments(documents, TRADES_COLLECTION);

    logger.info('User trades indexed', { userId, count: documents.length });
  } catch (error) {
    logger.error('Failed to index user trades', { error, userId });
    throw error;
  }
}

/**
 * Search for similar trades
 */
export async function searchSimilarTrades(
  query: string,
  userId: string,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    const results = await searchByText(
      query,
      limit,
      {
        must: [
          {
            key: 'userId',
            match: {
              value: userId,
            },
          },
        ],
      },
      TRADES_COLLECTION
    );

    return results;
  } catch (error) {
    logger.error('Failed to search similar trades', { error, query, userId });
    throw error;
  }
}

/**
 * Find trades similar to a given trade
 */
export async function findSimilarTrades(
  tradeId: string,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    const results = await findSimilar(tradeId, limit, TRADES_COLLECTION);
    return results;
  } catch (error) {
    logger.error('Failed to find similar trades', { error, tradeId });
    throw error;
  }
}

// ============================================================================
// Daily Bias Embeddings
// ============================================================================

/**
 * Generate content for daily bias analysis
 */
function generateDailyBiasContent(analysis: any): string {
  return `
Daily Bias Analysis for ${analysis.instrument}
Date: ${analysis.analyzedAt.toISOString()}
Final Bias: ${analysis.finalBias}
Confidence: ${analysis.confidence}%

Security Analysis:
- Volatility Index: ${analysis.securityAnalysis?.volatilityIndex || 'N/A'}
- Risk Level: ${analysis.securityAnalysis?.riskLevel || 'N/A'}
- Security Score: ${analysis.securityAnalysis?.securityScore || 'N/A'}

Macro Analysis:
- Macro Score: ${analysis.macroAnalysis?.macroScore || 'N/A'}
- Sentiment: ${analysis.macroAnalysis?.sentiment || 'N/A'}

Technical Structure:
- Trend: ${analysis.technicalAnalysis?.trend || 'N/A'}
- Technical Score: ${analysis.technicalAnalysis?.technicalScore || 'N/A'}

Opening Confirmation: ${analysis.openingConfirmation || 'N/A'}
  `.trim();
}

/**
 * Index a daily bias analysis
 */
export async function indexDailyBiasAnalysis(analysisId: string): Promise<void> {
  try {
    const analysis = await prisma.dailyBiasAnalysis.findUnique({
      where: { id: analysisId },
    });

    if (!analysis) {
      throw new Error(`Daily bias analysis not found: ${analysisId}`);
    }

    const content = generateDailyBiasContent(analysis);

    const document: VectorDocument = {
      id: analysis.id,
      content,
      metadata: {
        instrument: analysis.instrument,
        finalBias: analysis.finalBias,
        confidence: analysis.confidence,
        analyzedAt: analysis.analyzedAt.toISOString(),
        userId: analysis.userId,
      },
    };

    await indexDocument(document, DAILY_BIAS_COLLECTION);

    logger.info('Daily bias analysis indexed', { analysisId });
  } catch (error) {
    logger.error('Failed to index daily bias analysis', { error, analysisId });
    throw error;
  }
}

/**
 * Search daily bias analyses
 */
export async function searchDailyBiasAnalyses(
  query: string,
  userId: string,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    const results = await searchByText(
      query,
      limit,
      {
        must: [
          {
            key: 'userId',
            match: {
              value: userId,
            },
          },
        ],
      },
      DAILY_BIAS_COLLECTION
    );

    return results;
  } catch (error) {
    logger.error('Failed to search daily bias analyses', { error, query, userId });
    throw error;
  }
}

// ============================================================================
// Market Notes Embeddings
// ============================================================================

/**
 * Index a market note (day journal)
 */
export async function indexMarketNote(dayJournalId: string): Promise<void> {
  try {
    const dayJournal = await prisma.dayJournal.findUnique({
      where: { id: dayJournalId },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!dayJournal || !dayJournal.note) {
      logger.info('No note to index for day journal', { dayJournalId });
      return;
    }

    const content = `
Market Note for ${dayJournal.date.toISOString().split('T')[0]}
${dayJournal.note}
Tags: ${dayJournal.tags?.map((t) => t.tag.name).join(', ') || 'no tags'}
    `.trim();

    const document: VectorDocument = {
      id: dayJournal.id,
      content,
      metadata: {
        date: dayJournal.date.toISOString(),
        userId: dayJournal.userId,
        tags: dayJournal.tags?.map((t) => t.tag.name) || [],
      },
    };

    await indexDocument(document, MARKET_NOTES_COLLECTION);

    logger.info('Market note indexed', { dayJournalId });
  } catch (error) {
    logger.error('Failed to index market note', { error, dayJournalId });
    throw error;
  }
}

/**
 * Search market notes
 */
export async function searchMarketNotes(
  query: string,
  userId: string,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    const results = await searchByText(
      query,
      limit,
      {
        must: [
          {
            key: 'userId',
            match: {
              value: userId,
            },
          },
        ],
      },
      MARKET_NOTES_COLLECTION
    );

    return results;
  } catch (error) {
    logger.error('Failed to search market notes', { error, query, userId });
    throw error;
  }
}

// ============================================================================
// Knowledge Base Embeddings
// ============================================================================

/**
 * Index educational content or trading strategies
 */
export async function indexKnowledgeBaseDocument(
  id: string,
  content: string,
  metadata: Record<string, any>
): Promise<void> {
  try {
    const document: VectorDocument = {
      id,
      content,
      metadata,
    };

    await indexDocument(document, KNOWLEDGE_BASE_COLLECTION);

    logger.info('Knowledge base document indexed', { id });
  } catch (error) {
    logger.error('Failed to index knowledge base document', { error, id });
    throw error;
  }
}

/**
 * Search knowledge base
 */
export async function searchKnowledgeBase(
  query: string,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    const results = await searchByText(query, limit, undefined, KNOWLEDGE_BASE_COLLECTION);
    return results;
  } catch (error) {
    logger.error('Failed to search knowledge base', { error, query });
    throw error;
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Reindex all trades for a user
 */
export async function reindexAllUserTrades(userId: string): Promise<void> {
  try {
    logger.info('Starting reindex of all user trades', { userId });

    // Delete existing user trades from collection
    // Note: Qdrant doesn't have a direct "delete by filter" in all versions
    // For production, implement pagination and batch delete

    // Index all trades
    await indexUserTrades(userId, 10000); // Adjust limit as needed

    logger.info('User trades reindexed successfully', { userId });
  } catch (error) {
    logger.error('Failed to reindex user trades', { error, userId });
    throw error;
  }
}

/**
 * Delete all embeddings for a user
 */
export async function deleteUserEmbeddings(userId: string): Promise<void> {
  try {
    // Note: This requires fetching all user document IDs and deleting them
    // In production, implement proper pagination and batch delete

    logger.info('User embeddings deletion started', { userId });
    // Implementation details depend on Qdrant version and scale
  } catch (error) {
    logger.error('Failed to delete user embeddings', { error, userId });
    throw error;
  }
}

// ============================================================================
// Context Retrieval for AI
// ============================================================================

/**
 * Get relevant context for AI prompt enhancement
 */
export async function getRelevantContext(
  query: string,
  userId: string,
  contextType: 'trades' | 'daily_bias' | 'notes' | 'all' = 'all',
  limit: number = 5
): Promise<string> {
  try {
    let results: SearchResult[] = [];

    if (contextType === 'trades' || contextType === 'all') {
      const tradeResults = await searchSimilarTrades(query, userId, limit);
      results = [...results, ...tradeResults];
    }

    if (contextType === 'daily_bias' || contextType === 'all') {
      const biasResults = await searchDailyBiasAnalyses(query, userId, limit);
      results = [...results, ...biasResults];
    }

    if (contextType === 'notes' || contextType === 'all') {
      const noteResults = await searchMarketNotes(query, userId, limit);
      results = [...results, ...noteResults];
    }

    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);

    // Take top N results
    const topResults = results.slice(0, limit);

    // Format as context string
    const context = topResults
      .map((result, index) => {
        return `[Context ${index + 1}] (Relevance: ${(result.score * 100).toFixed(1)}%)\n${result.content}`;
      })
      .join('\n\n---\n\n');

    logger.info('Context retrieved', {
      query: query.substring(0, 50),
      resultsCount: topResults.length,
      contextType,
    });

    return context;
  } catch (error) {
    logger.error('Failed to get relevant context', { error, query, userId, contextType });
    return ''; // Return empty string on error (don't block AI generation)
  }
}
