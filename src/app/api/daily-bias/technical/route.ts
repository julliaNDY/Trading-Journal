/**
 * Technical Structure Analysis API Endpoint
 * 
 * POST /api/daily-bias/technical
 * 
 * Analyzes technical structure (support/resistance, trends, indicators) for an instrument
 * using Polygon.io chart data and AI prompts.
 * 
 * @module api/daily-bias/technical
 * @created 2026-01-18
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeTechnicalStructure, type TechnicalAnalysisParams } from '@/services/daily-bias/technical-analysis-service';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth';
import { SUPPORTED_INSTRUMENTS } from '@/services/ai/daily-bias-service';

// ============================================================================
// Request Validation Schema
// ============================================================================

const TechnicalRequestSchema = z.object({
  instrument: z.enum(SUPPORTED_INSTRUMENTS as any).describe('Trading instrument symbol'),
  timeframe: z.enum(['daily', '4h', '1h', '15m']).optional().default('daily').describe('Analysis timeframe'),
  analysisDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Analysis date (YYYY-MM-DD), defaults to today'),
  currentPrice: z.number().positive().optional().describe('Current price (optional, will be fetched if not provided)'),
  userContext: z.string().optional().describe('Additional user context for analysis'),
});

// ============================================================================
// POST Handler
// ============================================================================

/**
 * POST /api/daily-bias/technical
 * 
 * Execute technical structure analysis for an instrument
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 1. Authenticate user
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'User not authenticated' 
          } 
        },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body = await req.json();
    const validation = TechnicalRequestSchema.safeParse(body);

    if (!validation.success) {
      logger.warn('Invalid technical analysis request', {
        errors: validation.error.errors,
        body
      });

      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Invalid request body',
            details: validation.error.errors
          } 
        },
        { status: 400 }
      );
    }

    const { instrument, timeframe, analysisDate, currentPrice, userContext } = validation.data;

    logger.info('Technical analysis request', {
      userId: user.id,
      instrument,
      timeframe,
      analysisDate: analysisDate || 'today',
      hasCurrentPrice: !!currentPrice
    });

    // 3. Execute technical structure analysis
    const result = await analyzeTechnicalStructure({
      instrument,
      timeframe,
      analysisDate,
      currentPrice,
      userContext,
      useCache: true
    });

    const processingTime = Date.now() - startTime;

    logger.info('Technical structure analysis completed', {
      userId: user.id,
      instrument,
      timeframe,
      technicalScore: result.analysis.technicalScore,
      supportLevelsCount: result.analysis.supportLevels.length,
      resistanceLevelsCount: result.analysis.resistanceLevels.length,
      trend: result.analysis.trend.direction,
      cached: result.cached,
      provider: result.provider,
      latencyMs: result.latencyMs,
      processingTime
    });

    // 4. Return success response
    return NextResponse.json({
      success: true,
      data: {
        analysis: result.analysis,
        metadata: {
          cached: result.cached,
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs,
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString()
        }
      }
    }, {
      headers: {
        'X-Cached': result.cached ? 'true' : 'false',
        'X-Provider': result.provider,
        'X-Processing-Time': processingTime.toString()
      }
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;

    logger.error('Technical analysis API error', {
      error: error.message,
      stack: error.stack,
      processingTime
    });

    // Determine error code
    let errorCode = 'INTERNAL_ERROR';
    let statusCode = 500;

    if (error.message?.includes('timeout')) {
      errorCode = 'TIMEOUT';
      statusCode = 504;
    } else if (error.message?.includes('rate limit')) {
      errorCode = 'RATE_LIMIT_EXCEEDED';
      statusCode = 429;
    } else if (error.message?.includes('Polygon') || error.message?.includes('chart') || error.message?.includes('bars')) {
      errorCode = 'DATA_SOURCE_ERROR';
      statusCode = 502;
    } else if (error.message?.includes('validation') || error.message?.includes('Invalid')) {
      errorCode = 'VALIDATION_ERROR';
      statusCode = 400;
    } else if (error.message?.includes('insufficient') || error.message?.includes('bars')) {
      errorCode = 'INSUFFICIENT_DATA';
      statusCode = 422;
    }

    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: errorCode, 
          message: error.message || 'Internal server error',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        metadata: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString()
        }
      },
      { status: statusCode }
    );
  }
}

// ============================================================================
// GET Handler (Optional - for cached results)
// ============================================================================

/**
 * GET /api/daily-bias/technical?instrument=NQ1&timeframe=daily&date=2026-01-18
 * 
 * Get cached technical analysis if available
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'User not authenticated' 
          } 
        },
        { status: 401 }
      );
    }

    // 2. Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const instrument = searchParams.get('instrument');
    const timeframe = searchParams.get('timeframe') || 'daily';
    const date = searchParams.get('date');

    if (!instrument) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Missing required parameter: instrument' 
          } 
        },
        { status: 400 }
      );
    }

    // Validate instrument
    if (!SUPPORTED_INSTRUMENTS.includes(instrument as any)) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: `Unsupported instrument: ${instrument}. Supported instruments: ${SUPPORTED_INSTRUMENTS.join(', ')}` 
          } 
        },
        { status: 400 }
      );
    }

    // Validate timeframe
    if (!['daily', '4h', '1h', '15m'].includes(timeframe)) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: `Invalid timeframe: ${timeframe}. Supported timeframes: daily, 4h, 1h, 15m` 
          } 
        },
        { status: 400 }
      );
    }

    const analysisDate = date || new Date().toISOString().split('T')[0];

    // 3. Get cached analysis (try to fetch from cache only)
    // Note: This requires fetching bars, so it's better to use POST
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'NOT_SUPPORTED', 
          message: 'GET method not supported. Use POST to generate technical analysis.' 
        } 
      },
      { status: 405 }
    );

  } catch (error: any) {
    logger.error('Technical analysis GET error', {
      error: error.message,
      stack: error.stack
    });

    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error.message || 'Internal server error' 
        } 
      },
      { status: 500 }
    );
  }
}
