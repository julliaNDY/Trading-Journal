/**
 * Vector Search API
 * 
 * POST /api/vectordb/search
 * Search for similar items across collections
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVectorSearchService } from '@/services/vector-search-service';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/observability';

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { collection, query, options } = body;

    if (!collection || !query) {
      return NextResponse.json(
        { error: 'Missing collection or query' },
        { status: 400 }
      );
    }

    const searchService = getVectorSearchService();

    // Check if available
    if (!searchService.isAvailable()) {
      return NextResponse.json(
        { error: 'Vector search not configured' },
        { status: 503 }
      );
    }

    // Route to appropriate search method
    let results;
    const startTime = Date.now();

    switch (collection) {
      case 'trades':
        results = await searchService.searchSimilarTrades(user.id, query, options);
        break;
      case 'playbooks':
        results = await searchService.searchSimilarPlaybooks(query, {
          ...options,
          userId: user.id,
          includePublic: options?.includePublic ?? true,
        });
        break;
      case 'journal_entries':
        results = await searchService.searchSimilarJournalEntries(user.id, query, options);
        break;
      case 'coach_history':
        results = await searchService.searchCoachHistory(user.id, query, options);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown collection: ${collection}` },
          { status: 400 }
        );
    }

    const latency = Date.now() - startTime;

    logger.info('Vector search completed', {
      userId: user.id,
      collection,
      resultCount: results.length,
      latency,
    });

    return NextResponse.json({
      results,
      latencyMs: latency,
    });
  } catch (error) {
    logger.error('Vector search failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
