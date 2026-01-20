/**
 * Qdrant Vector Database Client
 * PRÉ-10: Vector Search + Embeddings
 * 
 * Features:
 * - Qdrant cloud integration
 * - OpenAI embeddings (text-embedding-3-small)
 * - Semantic search for trade analysis
 * - Document similarity matching
 * - Context retrieval for AI prompts
 * 
 * Use Cases:
 * - Find similar past trading patterns
 * - Retrieve relevant market analysis
 * - Context-aware AI prompt enhancement
 * - Historical trade comparison
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAI } from 'openai';
import { logger } from '@/lib/observability';

// ============================================================================
// Types
// ============================================================================

export interface VectorDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
}

export interface SearchResult {
  id: string;
  score: number;
  content: string;
  metadata: Record<string, any>;
}

export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collectionName: string;
  vectorSize: number; // 1536 for text-embedding-3-small
  distance: 'Cosine' | 'Euclid' | 'Dot';
}

// ============================================================================
// Configuration
// ============================================================================

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const DEFAULT_COLLECTION = 'trading_knowledge';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

// ============================================================================
// Client Initialization
// ============================================================================

let qdrantClient: QdrantClient | null = null;
let openaiClient: OpenAI | null = null;

/**
 * Initialize Qdrant client
 */
export function getQdrantClient(): QdrantClient {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY,
    });
    logger.info('Qdrant client initialized', { url: QDRANT_URL });
  }
  return qdrantClient;
}

/**
 * Initialize OpenAI client for embeddings
 */
export function getOpenAIEmbeddingsClient(): OpenAI {
  if (!openaiClient) {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for embeddings');
    }
    openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
    logger.info('OpenAI embeddings client initialized');
  }
  return openaiClient;
}

/**
 * Check if Qdrant is configured
 */
export function isQdrantConfigured(): boolean {
  return Boolean(QDRANT_URL && OPENAI_API_KEY);
}

// ============================================================================
// Collection Management
// ============================================================================

/**
 * Create Qdrant collection if it doesn't exist
 */
export async function ensureCollection(
  collectionName: string = DEFAULT_COLLECTION,
  vectorSize: number = EMBEDDING_DIMENSIONS,
  distance: 'Cosine' | 'Euclid' | 'Dot' = 'Cosine'
): Promise<void> {
  const client = getQdrantClient();

  try {
    // Check if collection exists
    const collections = await client.getCollections();
    const exists = collections.collections.some((c) => c.name === collectionName);

    if (exists) {
      logger.info('Qdrant collection already exists', { collectionName });
      return;
    }

    // Create collection
    await client.createCollection(collectionName, {
      vectors: {
        size: vectorSize,
        distance,
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 2,
    });

    logger.info('Qdrant collection created', { collectionName, vectorSize, distance });
  } catch (error) {
    logger.error('Failed to create Qdrant collection', { error, collectionName });
    throw error;
  }
}

/**
 * Delete collection
 */
export async function deleteCollection(collectionName: string = DEFAULT_COLLECTION): Promise<void> {
  const client = getQdrantClient();
  
  try {
    await client.deleteCollection(collectionName);
    logger.info('Qdrant collection deleted', { collectionName });
  } catch (error) {
    logger.error('Failed to delete collection', { error, collectionName });
    throw error;
  }
}

/**
 * Get collection info
 */
export async function getCollectionInfo(collectionName: string = DEFAULT_COLLECTION) {
  const client = getQdrantClient();
  
  try {
    const info = await client.getCollection(collectionName);
    return info;
  } catch (error) {
    logger.error('Failed to get collection info', { error, collectionName });
    throw error;
  }
}

// ============================================================================
// Embeddings
// ============================================================================

/**
 * Generate embedding for text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIEmbeddingsClient();

  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      encoding_format: 'float',
    });

    const embedding = response.data[0].embedding;
    
    logger.info('Embedding generated', {
      textLength: text.length,
      embeddingDim: embedding.length,
      model: EMBEDDING_MODEL,
    });

    return embedding;
  } catch (error) {
    logger.error('Failed to generate embedding', { error, textLength: text.length });
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const client = getOpenAIEmbeddingsClient();

  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      encoding_format: 'float',
    });

    const embeddings = response.data.map((d) => d.embedding);

    logger.info('Batch embeddings generated', {
      count: texts.length,
      model: EMBEDDING_MODEL,
    });

    return embeddings;
  } catch (error) {
    logger.error('Failed to generate batch embeddings', { error, count: texts.length });
    throw error;
  }
}

// ============================================================================
// Document Operations
// ============================================================================

/**
 * Index a single document
 */
export async function indexDocument(
  document: VectorDocument,
  collectionName: string = DEFAULT_COLLECTION
): Promise<void> {
  const client = getQdrantClient();

  try {
    // Generate embedding if not provided
    const embedding = document.embedding || (await generateEmbedding(document.content));

    // Upsert to Qdrant
    await client.upsert(collectionName, {
      points: [
        {
          id: document.id,
          vector: embedding,
          payload: {
            content: document.content,
            ...document.metadata,
          },
        },
      ],
    });

    logger.info('Document indexed', { id: document.id, collectionName });
  } catch (error) {
    logger.error('Failed to index document', { error, documentId: document.id });
    throw error;
  }
}

/**
 * Index multiple documents (batch)
 */
export async function indexDocuments(
  documents: VectorDocument[],
  collectionName: string = DEFAULT_COLLECTION
): Promise<void> {
  const client = getQdrantClient();

  try {
    // Generate embeddings for all documents without embeddings
    const textsToEmbed = documents
      .filter((doc) => !doc.embedding)
      .map((doc) => doc.content);

    const embeddings = textsToEmbed.length > 0 
      ? await generateEmbeddings(textsToEmbed) 
      : [];

    let embeddingIndex = 0;
    const points = documents.map((doc) => ({
      id: doc.id,
      vector: doc.embedding || embeddings[embeddingIndex++],
      payload: {
        content: doc.content,
        ...doc.metadata,
      },
    }));

    // Batch upsert
    await client.upsert(collectionName, { points });

    logger.info('Documents indexed', { count: documents.length, collectionName });
  } catch (error) {
    logger.error('Failed to index documents', { error, count: documents.length });
    throw error;
  }
}

/**
 * Delete document
 */
export async function deleteDocument(
  documentId: string,
  collectionName: string = DEFAULT_COLLECTION
): Promise<void> {
  const client = getQdrantClient();

  try {
    await client.delete(collectionName, {
      points: [documentId],
    });

    logger.info('Document deleted', { documentId, collectionName });
  } catch (error) {
    logger.error('Failed to delete document', { error, documentId });
    throw error;
  }
}

// ============================================================================
// Search Operations
// ============================================================================

/**
 * Semantic search by text query
 */
export async function searchByText(
  query: string,
  limit: number = 10,
  filter?: Record<string, any>,
  collectionName: string = DEFAULT_COLLECTION
): Promise<SearchResult[]> {
  const client = getQdrantClient();

  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Search in Qdrant
    const results = await client.search(collectionName, {
      vector: queryEmbedding,
      limit,
      filter,
      with_payload: true,
    });

    const searchResults: SearchResult[] = results.map((result) => ({
      id: result.id as string,
      score: result.score,
      content: (result.payload as any).content || '',
      metadata: result.payload as Record<string, any>,
    }));

    logger.info('Search completed', {
      query: query.substring(0, 50),
      resultsCount: searchResults.length,
      topScore: searchResults[0]?.score,
    });

    return searchResults;
  } catch (error) {
    logger.error('Search failed', { error, query: query.substring(0, 50) });
    throw error;
  }
}

/**
 * Search by embedding vector
 */
export async function searchByVector(
  vector: number[],
  limit: number = 10,
  filter?: Record<string, any>,
  collectionName: string = DEFAULT_COLLECTION
): Promise<SearchResult[]> {
  const client = getQdrantClient();

  try {
    const results = await client.search(collectionName, {
      vector,
      limit,
      filter,
      with_payload: true,
    });

    const searchResults: SearchResult[] = results.map((result) => ({
      id: result.id as string,
      score: result.score,
      content: (result.payload as any).content || '',
      metadata: result.payload as Record<string, any>,
    }));

    logger.info('Vector search completed', {
      resultsCount: searchResults.length,
      topScore: searchResults[0]?.score,
    });

    return searchResults;
  } catch (error) {
    logger.error('Vector search failed', { error });
    throw error;
  }
}

/**
 * Find similar documents to a given document ID
 */
export async function findSimilar(
  documentId: string,
  limit: number = 10,
  collectionName: string = DEFAULT_COLLECTION
): Promise<SearchResult[]> {
  const client = getQdrantClient();

  try {
    // Retrieve the document
    const points = await client.retrieve(collectionName, {
      ids: [documentId],
      with_vector: true,
    });

    if (points.length === 0) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const vector = points[0].vector as number[];

    // Search for similar documents (excluding the original)
    const results = await client.search(collectionName, {
      vector,
      limit: limit + 1,
      with_payload: true,
    });

    // Filter out the original document
    const similarResults = results
      .filter((r) => r.id !== documentId)
      .slice(0, limit);

    const searchResults: SearchResult[] = similarResults.map((result) => ({
      id: result.id as string,
      score: result.score,
      content: (result.payload as any).content || '',
      metadata: result.payload as Record<string, any>,
    }));

    logger.info('Similar documents found', {
      documentId,
      resultsCount: searchResults.length,
    });

    return searchResults;
  } catch (error) {
    logger.error('Find similar failed', { error, documentId });
    throw error;
  }
}

// ============================================================================
// Health & Stats
// ============================================================================

/**
 * Health check for Qdrant
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const client = getQdrantClient();
    await client.getCollections();
    return true;
  } catch (error) {
    logger.error('Qdrant health check failed', { error });
    return false;
  }
}

/**
 * Get collection statistics
 */
export async function getCollectionStats(collectionName: string = DEFAULT_COLLECTION) {
  const client = getQdrantClient();

  try {
    const info = await client.getCollection(collectionName);
    return {
      vectorsCount: info.indexed_vectors_count ?? info.points_count ?? 0,
      pointsCount: info.points_count ?? 0,
      segmentsCount: info.segments_count,
      status: info.status,
    };
  } catch (error) {
    logger.error('Failed to get collection stats', { error, collectionName });
    throw error;
  }
}

/**
 * Count documents matching filter
 */
export async function countDocuments(
  filter?: Record<string, any>,
  collectionName: string = DEFAULT_COLLECTION
): Promise<number> {
  const client = getQdrantClient();

  try {
    const result = await client.count(collectionName, { filter });
    return result.count;
  } catch (error) {
    logger.error('Failed to count documents', { error, collectionName });
    throw error;
  }
}
