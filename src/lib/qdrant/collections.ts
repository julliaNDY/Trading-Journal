/**
 * Qdrant Collection Definitions
 * 
 * Defines the 4 production collections:
 * - trades: Trade embeddings for similarity search
 * - playbooks: Playbook embeddings for recommendations
 * - journal_entries: Journal embeddings for context
 * - coach_history: Coach conversation embeddings
 */

import { getQdrantClient, VECTOR_SIZE, type QdrantFilter, type QdrantCondition } from './client';
import { logger } from '@/lib/observability';

// ============================================================================
// Collection Definitions
// ============================================================================

export const COLLECTIONS = {
  trades: 'trades',
  playbooks: 'playbooks',
  journal_entries: 'journal_entries',
  coach_history: 'coach_history',
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];

// Collection configurations
export const COLLECTION_CONFIGS: Record<CollectionName, {
  vectorSize: number;
  distance: 'Cosine' | 'Euclid' | 'Dot';
  payloadIndexes: { field: string; type: 'keyword' | 'integer' | 'float' | 'bool' | 'datetime' | 'text' }[];
}> = {
  [COLLECTIONS.trades]: {
    vectorSize: VECTOR_SIZE,
    distance: 'Cosine',
    payloadIndexes: [
      { field: 'user_id', type: 'keyword' },
      { field: 'trade_id', type: 'keyword' },
      { field: 'symbol', type: 'keyword' },
      { field: 'direction', type: 'keyword' },
      { field: 'pnl_positive', type: 'bool' },
      { field: 'closed_at', type: 'datetime' },
    ],
  },
  [COLLECTIONS.playbooks]: {
    vectorSize: VECTOR_SIZE,
    distance: 'Cosine',
    payloadIndexes: [
      { field: 'user_id', type: 'keyword' },
      { field: 'playbook_id', type: 'keyword' },
      { field: 'name', type: 'text' },
      { field: 'is_public', type: 'bool' },
    ],
  },
  [COLLECTIONS.journal_entries]: {
    vectorSize: VECTOR_SIZE,
    distance: 'Cosine',
    payloadIndexes: [
      { field: 'user_id', type: 'keyword' },
      { field: 'journal_id', type: 'keyword' },
      { field: 'date', type: 'datetime' },
    ],
  },
  [COLLECTIONS.coach_history]: {
    vectorSize: VECTOR_SIZE,
    distance: 'Cosine',
    payloadIndexes: [
      { field: 'user_id', type: 'keyword' },
      { field: 'conversation_id', type: 'keyword' },
      { field: 'message_id', type: 'keyword' },
      { field: 'role', type: 'keyword' },
      { field: 'created_at', type: 'datetime' },
    ],
  },
};

// ============================================================================
// Collection Setup
// ============================================================================

/**
 * Create a single collection with its indexes
 */
export async function createCollection(name: CollectionName): Promise<void> {
  const client = getQdrantClient();
  const config = COLLECTION_CONFIGS[name];

  // Check if collection already exists
  const exists = await client.collectionExists(name);
  if (exists) {
    logger.info('Collection already exists', { name });
    return;
  }

  // Create collection
  await client.createCollection(name, config.vectorSize, config.distance);

  // Create payload indexes
  for (const index of config.payloadIndexes) {
    await client.createPayloadIndex(name, index.field, index.type);
  }

  logger.info('Collection created with indexes', { 
    name, 
    indexes: config.payloadIndexes.map(i => i.field) 
  });
}

/**
 * Create all production collections
 */
export async function createAllCollections(): Promise<void> {
  const collectionNames = Object.values(COLLECTIONS);
  
  logger.info('Creating all Qdrant collections', { count: collectionNames.length });

  for (const name of collectionNames) {
    await createCollection(name);
  }

  logger.info('All collections created successfully');
}

/**
 * Delete a collection (use with caution!)
 */
export async function deleteCollection(name: CollectionName): Promise<void> {
  const client = getQdrantClient();
  await client.deleteCollection(name);
}

/**
 * Recreate a collection (delete and create)
 */
export async function recreateCollection(name: CollectionName): Promise<void> {
  const client = getQdrantClient();
  
  // Delete if exists
  const exists = await client.collectionExists(name);
  if (exists) {
    await client.deleteCollection(name);
  }

  // Create fresh
  await createCollection(name);
}

// ============================================================================
// Collection Stats
// ============================================================================

/**
 * Get stats for all collections
 */
export async function getCollectionStats(): Promise<Record<CollectionName, {
  exists: boolean;
  vectorsCount: number;
  pointsCount: number;
}>> {
  const client = getQdrantClient();
  const stats: Record<string, { exists: boolean; vectorsCount: number; pointsCount: number }> = {};

  for (const name of Object.values(COLLECTIONS)) {
    try {
      const exists = await client.collectionExists(name);
      if (exists) {
        const info = await client.getCollectionInfo(name);
        stats[name] = {
          exists: true,
          vectorsCount: info.vectors_count,
          pointsCount: info.points_count,
        };
      } else {
        stats[name] = { exists: false, vectorsCount: 0, pointsCount: 0 };
      }
    } catch {
      stats[name] = { exists: false, vectorsCount: 0, pointsCount: 0 };
    }
  }

  return stats as Record<CollectionName, { exists: boolean; vectorsCount: number; pointsCount: number }>;
}

// ============================================================================
// Filter Builders
// ============================================================================

/**
 * Build a filter for user-scoped queries (multi-tenancy)
 */
export function buildUserFilter(
  userId: string,
  additionalFilters?: QdrantCondition[]
): QdrantFilter {
  const must: QdrantCondition[] = [
    { key: 'user_id', match: { value: userId } },
  ];

  if (additionalFilters) {
    must.push(...additionalFilters);
  }

  return { must };
}

/**
 * Build a filter for trades with optional filters
 */
export function buildTradeFilter(options: {
  userId: string;
  symbol?: string;
  direction?: 'LONG' | 'SHORT';
  pnlPositive?: boolean;
  dateRange?: { start: Date; end: Date };
}): QdrantFilter {
  const must: QdrantCondition[] = [
    { key: 'user_id', match: { value: options.userId } },
  ];

  if (options.symbol) {
    must.push({ key: 'symbol', match: { value: options.symbol } });
  }

  if (options.direction) {
    must.push({ key: 'direction', match: { value: options.direction } });
  }

  if (options.pnlPositive !== undefined) {
    must.push({ key: 'pnl_positive', match: { value: options.pnlPositive } });
  }

  if (options.dateRange) {
    must.push({
      key: 'closed_at',
      range: {
        gte: options.dateRange.start.getTime() / 1000,
        lte: options.dateRange.end.getTime() / 1000,
      },
    });
  }

  return { must };
}

/**
 * Build a filter for playbooks
 */
export function buildPlaybookFilter(options: {
  userId?: string;
  isPublic?: boolean;
}): QdrantFilter {
  const must: QdrantCondition[] = [];

  if (options.userId) {
    must.push({ key: 'user_id', match: { value: options.userId } });
  }

  if (options.isPublic !== undefined) {
    must.push({ key: 'is_public', match: { value: options.isPublic } });
  }

  return { must };
}

/**
 * Build a filter for journal entries
 */
export function buildJournalFilter(options: {
  userId: string;
  dateRange?: { start: Date; end: Date };
}): QdrantFilter {
  const must: QdrantCondition[] = [
    { key: 'user_id', match: { value: options.userId } },
  ];

  if (options.dateRange) {
    must.push({
      key: 'date',
      range: {
        gte: options.dateRange.start.getTime() / 1000,
        lte: options.dateRange.end.getTime() / 1000,
      },
    });
  }

  return { must };
}

/**
 * Build a filter for coach history
 */
export function buildCoachHistoryFilter(options: {
  userId: string;
  conversationId?: string;
}): QdrantFilter {
  const must: QdrantCondition[] = [
    { key: 'user_id', match: { value: options.userId } },
  ];

  if (options.conversationId) {
    must.push({ key: 'conversation_id', match: { value: options.conversationId } });
  }

  return { must };
}
