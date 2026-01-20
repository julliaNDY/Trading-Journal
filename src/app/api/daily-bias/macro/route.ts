/**
 * Macro Analysis API Endpoint
 * 
 * POST /api/daily-bias/macro
 * 
 * Analyzes macroeconomic context (economic events, central bank policy, sentiment)
 * for a given instrument using ForexFactory data and AI.
 * 
 * @module api/daily-bias/macro
 * @created 2026-01-18
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeMacroContext, type MacroAnalysisParams } from '@/services/daily-bias/macro-analysis-service';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth';
import { SUPPORTED_INSTRUMENTS } from '@/services/ai/daily-bias-service';

// ============================================================================
// Request Validation Schema
// ============================================================================

const MacroRequestSchema = z.object({
  instrument: z.enum(SUPPORTED_INSTRUMENTS as any).describe('Trading instrument symbol'),
  analysisDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Analysis date (YYYY-MM-DD), defaults to today'),
  timeframe: z.enum(['1h', '4h', '1d']).optional().default('1d').describe('Timeframe for event filtering'),
  userContext: z.string().optional().describe('Additional user context for analysis'),
});

// ============================================================================
// POST Handler
// ============================================================================

/**
 * POST /api/daily-bias/macro
 * 
 * Execute macro analysis for an instrument
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
    const validation = MacroRequestSchema.safeParse(body);

    if (!validation.success) {
      logger.warn('Invalid macro analysis request', {
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

    const { instrument, analysisDate, timeframe, userContext } = validation.data;

    logger.info('Macro analysis request', {
      userId: user.id,
      instrument,
      analysisDate: analysisDate || 'today',
      timeframe
    });

    // 3. Execute macro analysis
    const result = await analyzeMacroContext({
      instrument,
      analysisDate,
      timeframe,
      userContext,
      useCache: true
    });

    const processingTime = Date.now() - startTime;

    logger.info('Macro analysis completed', {
      userId: user.id,
      instrument,
      sentiment: result.analysis.sentiment,
      macroScore: result.analysis.macroScore,
      eventCount: result.analysis.economicEvents.length,
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

    logger.error('Macro analysis API error', {
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
    } else if (error.message?.includes('ForexFactory')) {
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
 * GET /api/daily-bias/macro?instrument=NQ1&date=2026-01-18
 * 
 * Get cached macro analysis if available
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

    // 3. Get cached analysis
    const result = await analyzeMacroContext({
      instrument,
      analysisDate,
      useCache: true
    });

    if (!result.cached) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'NOT_CACHED', 
            message: 'No cached analysis available. Use POST to generate new analysis.' 
          } 
        },
        { status: 404 }
      );
    }

    // 4. Return cached result
    return NextResponse.json({
      success: true,
      data: {
        analysis: result.analysis,
        metadata: {
          cached: true,
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs,
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error: any) {
    logger.error('Macro analysis GET error', {
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
