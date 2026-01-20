/**
 * GET /api/daily-bias/history
 * 
 * Get user's daily bias analysis history
 * Supports filtering by instrument and pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAnalysisHistory, SUPPORTED_INSTRUMENTS } from '@/services/ai/daily-bias-service';
import { logger } from '@/lib/logger';

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } },
        { status: 401 }
      );
    }
    
    // 2. Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const instrument = searchParams.get('instrument') as any;
    const limit = parseInt(searchParams.get('limit') || '30');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Validate instrument if provided
    if (instrument && !SUPPORTED_INSTRUMENTS.includes(instrument)) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_INSTRUMENT', 
            message: `Invalid instrument. Supported: ${SUPPORTED_INSTRUMENTS.join(', ')}` 
          } 
        },
        { status: 400 }
      );
    }
    
    // Validate pagination
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_PAGINATION', 
            message: 'Limit must be between 1 and 100' 
          } 
        },
        { status: 400 }
      );
    }
    
    logger.info('Daily Bias History API Request', {
      userId: user.id,
      instrument: instrument || 'all',
      limit,
      offset
    });
    
    // 3. Fetch history
    const result = await getAnalysisHistory({
      userId: user.id,
      instrument,
      limit,
      offset
    });
    
    // 4. Return success response
    return NextResponse.json({
      success: true,
      data: {
        analyses: result.analyses,
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    logger.error('Daily Bias History API Error', {
      error: error.message,
      stack: error.stack
    });
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'An unexpected error occurred' 
        } 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS HANDLER (CORS)
// ============================================================================

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { status: 200 });
}
