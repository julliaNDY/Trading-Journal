/**
 * Vector Indexing API
 * POST /api/vector/index
 * 
 * Index documents into vector database
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import {
  indexTrade,
  indexUserTrades,
  indexDailyBiasAnalysis,
  indexMarketNote,
  reindexAllUserTrades,
} from '@/services/vector/embedding-service';
import { logger } from '@/lib/observability';

// ============================================================================
// Request Validation
// ============================================================================

const IndexRequestSchema = z.object({
  type: z.enum(['trade', 'user_trades', 'daily_bias', 'market_note', 'reindex_all']),
  id: z.string().optional(),
  limit: z.number().int().min(1).max(10000).optional(),
});

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth();

    // Parse request body
    const body = await request.json();

    // Validate
    const validationResult = IndexRequestSchema.safeParse(body);

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

    // Handle different index types
    switch (params.type) {
      case 'trade':
        if (!params.id) {
          return NextResponse.json(
            { error: 'Trade ID is required' },
            { status: 400 }
          );
        }
        await indexTrade(params.id);
        logger.info('Trade indexed', { userId: user.id, tradeId: params.id });
        return NextResponse.json({
          success: true,
          message: 'Trade indexed successfully',
          id: params.id,
        });

      case 'user_trades':
        const limit = params.limit || 100;
        await indexUserTrades(user.id, limit);
        logger.info('User trades indexed', { userId: user.id, limit });
        return NextResponse.json({
          success: true,
          message: `User trades indexed (limit: ${limit})`,
        });

      case 'daily_bias':
        if (!params.id) {
          return NextResponse.json(
            { error: 'Analysis ID is required' },
            { status: 400 }
          );
        }
        await indexDailyBiasAnalysis(params.id);
        logger.info('Daily bias indexed', { userId: user.id, analysisId: params.id });
        return NextResponse.json({
          success: true,
          message: 'Daily bias analysis indexed successfully',
          id: params.id,
        });

      case 'market_note':
        if (!params.id) {
          return NextResponse.json(
            { error: 'Day journal ID is required' },
            { status: 400 }
          );
        }
        await indexMarketNote(params.id);
        logger.info('Market note indexed', { userId: user.id, dayJournalId: params.id });
        return NextResponse.json({
          success: true,
          message: 'Market note indexed successfully',
          id: params.id,
        });

      case 'reindex_all':
        await reindexAllUserTrades(user.id);
        logger.info('All user content reindexed', { userId: user.id });
        return NextResponse.json({
          success: true,
          message: 'All user content reindexed successfully',
        });

      default:
        return NextResponse.json(
          { error: 'Invalid index type' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Vector indexing failed', { error });

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
