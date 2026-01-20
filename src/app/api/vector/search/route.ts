/**
 * Vector Search API
 * GET /api/vector/search
 * 
 * Semantic search across trades, daily bias analyses, and market notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import {
  searchSimilarTrades,
  searchDailyBiasAnalyses,
  searchMarketNotes,
  getRelevantContext,
} from '@/services/vector/embedding-service';
import { logger } from '@/lib/observability';

// ============================================================================
// Request Validation
// ============================================================================

const SearchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  type: z.enum(['trades', 'daily_bias', 'notes', 'all']).default('all'),
  limit: z.number().int().min(1).max(50).default(10),
  format: z.enum(['full', 'context']).default('full'),
});

// ============================================================================
// API Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth(request);

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const type = searchParams.get('type') || 'all';
    const limit = parseInt(searchParams.get('limit') || '10');
    const format = searchParams.get('format') || 'full';

    // Validate
    const validationResult = SearchRequestSchema.safeParse({
      query,
      type,
      limit,
      format,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request parameters',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const params = validationResult.data;

    // Handle "context" format (for AI prompt enhancement)
    if (params.format === 'context') {
      const context = await getRelevantContext(
        params.query,
        user.id,
        params.type,
        params.limit
      );

      return NextResponse.json({
        query: params.query,
        context,
      });
    }

    // Handle "full" format (full search results)
    let results: any[] = [];

    if (params.type === 'trades' || params.type === 'all') {
      const tradeResults = await searchSimilarTrades(
        params.query,
        user.id,
        params.limit
      );
      results = [
        ...results,
        ...tradeResults.map((r) => ({ ...r, type: 'trade' })),
      ];
    }

    if (params.type === 'daily_bias' || params.type === 'all') {
      const biasResults = await searchDailyBiasAnalyses(
        params.query,
        user.id,
        params.limit
      );
      results = [
        ...results,
        ...biasResults.map((r) => ({ ...r, type: 'daily_bias' })),
      ];
    }

    if (params.type === 'notes' || params.type === 'all') {
      const noteResults = await searchMarketNotes(
        params.query,
        user.id,
        params.limit
      );
      results = [
        ...results,
        ...noteResults.map((r) => ({ ...r, type: 'note' })),
      ];
    }

    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);

    // Limit to requested count
    results = results.slice(0, params.limit);

    logger.info('Vector search completed', {
      userId: user.id,
      query: params.query.substring(0, 50),
      type: params.type,
      resultsCount: results.length,
    });

    return NextResponse.json({
      query: params.query,
      type: params.type,
      count: results.length,
      results,
    });
  } catch (error) {
    logger.error('Vector search failed', { error });

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
