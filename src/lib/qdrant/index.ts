/**
 * Qdrant Vector DB Module
 * 
 * Production-ready vector database integration for:
 * - Trade similarity search
 * - Playbook recommendations
 * - Journal context retrieval
 * - Coach conversation history
 */

// Client
export {
  QdrantClient,
  getQdrantClient,
  isQdrantConfigured,
  VECTOR_SIZE,
  type QdrantPoint,
  type QdrantSearchResult,
  type QdrantFilter,
  type QdrantCondition,
  type QdrantCollectionInfo,
} from './client';

// Collections
export {
  COLLECTIONS,
  COLLECTION_CONFIGS,
  type CollectionName,
  createCollection,
  createAllCollections,
  deleteCollection,
  recreateCollection,
  getCollectionStats,
  buildUserFilter,
  buildTradeFilter,
  buildPlaybookFilter,
  buildJournalFilter,
  buildCoachHistoryFilter,
} from './collections';
