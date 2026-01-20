/**
 * Mag 7 Leaders Analysis API Endpoint
 * 
 * POST /api/daily-bias/mag7
 * 
 * Analyzes correlation between an instrument and the Magnificent 7 tech leaders
 * (AAPL, MSFT, GOOGL, AMZN, META, NVDA, TSLA) using Polygon.io stock data and AI.
 * 
 * @module api/daily-bias/mag7
 * @created 2026-01-18
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeMag7Leaders, type Mag7AnalysisParams } from '@/services/daily-bias/mag7-analysis-service';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth';
import { SUPPORTED_INSTRUMENTS } from '@/services/ai/daily-bias-service';

// ============================================================================
// Request Validation Schema
// ============================================================================

const Mag7RequestSchema = z.object({
  instrument: z.enum(SUPPORTED_INSTRUMENTS as any).describe('Trading instrument symbol'),
  instrumentData: z.object({
    currentPrice: z.number().positive(),
    priceChangePercent: z.number(),
    priceChange24h: z.number(),
  }),
  analysisDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Analysis date (YYYY-MM-DD), defaults to today'),
  userContext: z.string().optional().describe('Additional user context for analysis'),
});

// ============================================================================
// POST Handler
// ============================================================================

/**
 * POST /api/daily-bias/mag7
 * 
 * Execute Mag 7 leaders analysis for an instrument
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
    const validation = Mag7RequestSchema.safeParse(body);

    if (!validation.success) {
      logger.warn('Invalid Mag 7 analysis request', {
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

    const { instrument, instrumentData, analysisDate, userContext } = validation.data;

    logger.info('Mag 7 analysis request', {
      userId: user.id,
      instrument,
      analysisDate: analysisDate || 'today',
      currentPrice: instrumentData.currentPrice
    });

    // 3. Execute Mag 7 analysis
    const result = await analyzeMag7Leaders({
      instrument,
      instrumentData,
      analysisDate,
      userContext,
      useCache: true
    });

    const processingTime = Date.now() - startTime;

    logger.info('Mag 7 analysis completed', {
      userId: user.id,
      instrument,
      sentiment: result.analysis.sentiment,
      leaderScore: result.analysis.leaderScore,
      correlationCount: result.analysis.correlations.length,
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

    logger.error('Mag 7 analysis API error', {
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
    } else if (error.message?.includes('Polygon') || error.message?.includes('stock')) {
      errorCode = 'DATA_SOURCE_ERROR';
      statusCode = 502;
    } else if (error.message?.includes('validation') || error.message?.includes('Invalid')) {
      errorCode = 'VALIDATION_ERROR';
      statusCode = 400;
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
 * GET /api/daily-bias/mag7?instrument=NQ1&date=2026-01-18
 * 
 * Get cached Mag 7 analysis if available
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

    const analysisDate = date || new Date().toISOString().split('T')[0];

    // 3. Get cached analysis (requires instrumentData, so return error for GET)
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'NOT_SUPPORTED', 
          message: 'GET method not supported. Use POST with instrumentData to generate analysis.' 
        } 
      },
      { status: 405 }
    );

  } catch (error: any) {
    logger.error('Mag 7 analysis GET error', {
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
