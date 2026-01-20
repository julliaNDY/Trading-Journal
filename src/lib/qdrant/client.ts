/**
 * Qdrant Vector DB Client
 * 
 * Production-ready client for Qdrant vector database.
 * Supports both Qdrant Cloud and self-hosted instances.
 * 
 * Configuration:
 *   - QDRANT_URL: Qdrant server URL (required)
 *   - QDRANT_API_KEY: API key for Qdrant Cloud (optional for local)
 */

import { logger } from '@/lib/observability';

// ============================================================================
// Configuration
// ============================================================================

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

// Vector size depends on embedding model (Gemini text-embedding-004: 768)
export const VECTOR_SIZE = 768;

// ============================================================================
// Types
// ============================================================================

export interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface QdrantSearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

export interface QdrantFilter {
  must?: QdrantCondition[];
  should?: QdrantCondition[];
  must_not?: QdrantCondition[];
}

export interface QdrantCondition {
  key: string;
  match?: { value: string | number | boolean };
  range?: { gte?: number; lte?: number; gt?: number; lt?: number };
}

export interface QdrantCollectionInfo {
  status: string;
  vectors_count: number;
  points_count: number;
  config: {
    params: {
      vectors: {
        size: number;
        distance: string;
      };
    };
  };
}

interface QdrantResponse<T> {
  result: T;
  status: string;
  time: number;
}

// ============================================================================
// Qdrant Client Class
// ============================================================================

class QdrantClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(url: string = QDRANT_URL, apiKey?: string) {
    this.baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    this.apiKey = apiKey || QDRANT_API_KEY;
  }

  /**
   * Make a request to Qdrant API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: object
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['api-key'] = this.apiKey;
    }

    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const error = await response.text();
        logger.error('Qdrant API error', {
          status: response.status,
          error,
          path,
          latency,
        });
        throw new Error(`Qdrant API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as QdrantResponse<T>;
      
      logger.debug('Qdrant request', {
        method,
        path,
        latency,
        status: data.status,
      });

      return data.result;
    } catch (error) {
      const latency = Date.now() - startTime;
      let errorMessage = 'Unknown error';
      let errorDetails: string | undefined;
      
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.cause) {
          errorDetails = error.cause instanceof Error ? error.cause.message : String(error.cause);
        }
        // Check for network errors
        if (errorMessage.includes('fetch failed') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
          errorMessage = `Network error: ${errorMessage}. Check QDRANT_URL and network connectivity.`;
        }
      } else {
        errorMessage = String(error);
      }
      
      logger.error('Qdrant request failed', {
        method,
        path,
        latency,
        error: errorMessage,
        cause: errorDetails,
        url: `${this.baseUrl}${path}`,
      });
      throw new Error(`Qdrant request failed: ${errorMessage}${errorDetails ? ` (${errorDetails})` : ''}`);
    }
  }

  // ==========================================================================
  // Connection
  // ==========================================================================

  /**
   * Check if Qdrant is available
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/`, {
        headers: this.apiKey ? { 'api-key': this.apiKey } : {},
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get Qdrant version info
   */
  async getInfo(): Promise<{ version: string }> {
    const response = await fetch(`${this.baseUrl}/`, {
      headers: this.apiKey ? { 'api-key': this.apiKey } : {},
    });
    
    if (!response.ok) {
      throw new Error('Failed to get Qdrant info');
    }
    
    return response.json();
  }

  // ==========================================================================
  // Collections
  // ==========================================================================

  /**
   * List all collections
   */
  async listCollections(): Promise<string[]> {
    const result = await this.request<{ collections: { name: string }[] }>(
      'GET',
      '/collections'
    );
    return result.collections.map((c) => c.name);
  }

  /**
   * Check if collection exists
   */
  async collectionExists(name: string): Promise<boolean> {
    const collections = await this.listCollections();
    return collections.includes(name);
  }

  /**
   * Create a collection
   */
  async createCollection(
    name: string,
    vectorSize: number = VECTOR_SIZE,
    distance: 'Cosine' | 'Euclid' | 'Dot' = 'Cosine'
  ): Promise<void> {
    await this.request('PUT', `/collections/${name}`, {
      vectors: {
        size: vectorSize,
        distance,
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 1,
    });

    logger.info('Qdrant collection created', { name, vectorSize, distance });
  }

  /**
   * Delete a collection
   */
  async deleteCollection(name: string): Promise<void> {
    await this.request('DELETE', `/collections/${name}`);
    logger.info('Qdrant collection deleted', { name });
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(name: string): Promise<QdrantCollectionInfo> {
    return this.request<QdrantCollectionInfo>('GET', `/collections/${name}`);
  }

  // ==========================================================================
  // Payload Indexes
  // ==========================================================================

  /**
   * Create a payload index for filtering
   */
  async createPayloadIndex(
    collection: string,
    fieldName: string,
    fieldSchema: 'keyword' | 'integer' | 'float' | 'bool' | 'datetime' | 'text'
  ): Promise<void> {
    try {
      await this.request('PUT', `/collections/${collection}/index`, {
        field_name: fieldName,
        field_schema: fieldSchema,
      });
      logger.debug('Qdrant payload index created', { collection, fieldName, fieldSchema });
    } catch (error) {
      // Index may already exist - log but don't throw
      logger.warn('Qdrant index creation failed (may already exist)', {
        collection,
        fieldName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ==========================================================================
  // Points (Vectors)
  // ==========================================================================

  /**
   * Upsert points (vectors) into a collection
   */
  async upsertPoints(collection: string, points: QdrantPoint[]): Promise<void> {
    if (points.length === 0) return;

    await this.request('PUT', `/collections/${collection}/points?wait=true`, {
      points: points.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    });

    logger.debug('Qdrant points upserted', { collection, count: points.length });
  }

  /**
   * Delete points by IDs
   */
  async deletePoints(collection: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    await this.request('POST', `/collections/${collection}/points/delete?wait=true`, {
      points: ids,
    });

    logger.debug('Qdrant points deleted', { collection, count: ids.length });
  }

  /**
   * Delete points by filter
   */
  async deletePointsByFilter(collection: string, filter: QdrantFilter): Promise<void> {
    await this.request('POST', `/collections/${collection}/points/delete?wait=true`, {
      filter,
    });

    logger.debug('Qdrant points deleted by filter', { collection });
  }

  /**
   * Get point by ID
   */
  async getPoint(collection: string, id: string): Promise<QdrantPoint | null> {
    try {
      const result = await this.request<{ id: string; vector: number[]; payload: Record<string, unknown> }[]>(
        'POST',
        `/collections/${collection}/points`,
        { ids: [id], with_payload: true, with_vector: true }
      );
      
      if (result.length === 0) return null;
      
      return {
        id: String(result[0].id),
        vector: result[0].vector,
        payload: result[0].payload,
      };
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // Search
  // ==========================================================================

  /**
   * Search for similar vectors
   */
  async search(
    collection: string,
    vector: number[],
    options?: {
      limit?: number;
      scoreThreshold?: number;
      filter?: QdrantFilter;
      withPayload?: boolean;
      withVector?: boolean;
    }
  ): Promise<QdrantSearchResult[]> {
    const startTime = Date.now();

    const result = await this.request<
      { id: string | number; score: number; payload?: Record<string, unknown> }[]
    >('POST', `/collections/${collection}/points/search`, {
      vector,
      limit: options?.limit ?? 10,
      score_threshold: options?.scoreThreshold,
      filter: options?.filter,
      with_payload: options?.withPayload ?? true,
      with_vector: options?.withVector ?? false,
    });

    const latency = Date.now() - startTime;
    
    logger.debug('Qdrant search completed', {
      collection,
      resultCount: result.length,
      latency,
    });

    return result.map((r) => ({
      id: String(r.id),
      score: r.score,
      payload: r.payload || {},
    }));
  }

  /**
   * Search with multiple query vectors (batch search)
   */
  async batchSearch(
    collection: string,
    vectors: number[][],
    options?: {
      limit?: number;
      scoreThreshold?: number;
      filter?: QdrantFilter;
    }
  ): Promise<QdrantSearchResult[][]> {
    const searches = vectors.map((vector) => ({
      vector,
      limit: options?.limit ?? 10,
      score_threshold: options?.scoreThreshold,
      filter: options?.filter,
      with_payload: true,
    }));

    const result = await this.request<
      { id: string | number; score: number; payload?: Record<string, unknown> }[][]
    >('POST', `/collections/${collection}/points/search/batch`, {
      searches,
    });

    return result.map((batch) =>
      batch.map((r) => ({
        id: String(r.id),
        score: r.score,
        payload: r.payload || {},
      }))
    );
  }

  // ==========================================================================
  // Snapshots (Backups)
  // ==========================================================================

  /**
   * Create a collection snapshot
   */
  async createSnapshot(collection: string): Promise<{ name: string }> {
    const result = await this.request<{ name: string }>(
      'POST',
      `/collections/${collection}/snapshots`
    );
    logger.info('Qdrant snapshot created', { collection, name: result.name });
    return result;
  }

  /**
   * List snapshots for a collection
   */
  async listSnapshots(collection: string): Promise<{ name: string; creation_time: string }[]> {
    return this.request<{ name: string; creation_time: string }[]>(
      'GET',
      `/collections/${collection}/snapshots`
    );
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(collection: string, snapshotName: string): Promise<void> {
    await this.request('DELETE', `/collections/${collection}/snapshots/${snapshotName}`);
    logger.info('Qdrant snapshot deleted', { collection, snapshotName });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let qdrantClientInstance: QdrantClient | null = null;

/**
 * Get Qdrant client singleton
 */
export function getQdrantClient(): QdrantClient {
  if (!qdrantClientInstance) {
    qdrantClientInstance = new QdrantClient();
  }
  return qdrantClientInstance;
}

/**
 * Check if Qdrant is configured
 */
export function isQdrantConfigured(): boolean {
  return !!process.env.QDRANT_URL;
}

export { QdrantClient };
