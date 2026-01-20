/**
 * Synthesis & Final Bias Analysis API Endpoint
 * 
 * POST /api/daily-bias/synthesis
 * 
 * Synthesizes all 5 previous analysis steps into a final daily bias (BULLISH/BEARISH/NEUTRAL)
 * with confidence score, opening confirmation, and trading recommendations.
 * 
 * @module api/daily-bias/synthesis
 * @created 2026-01-18
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { synthesizeDailyBias, type SynthesisInput } from '@/services/daily-bias/synthesis-service';
import type { SynthesisOutput } from '@/lib/prompts/synthesis-prompt';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth';
import type {
  SecurityAnalysis,
  MacroAnalysis,
  InstitutionalFlux,
  Mag7Analysis,
  TechnicalStructure,
} from '@/types/daily-bias';

// ============================================================================
// Request Validation Schema
// ============================================================================

const SynthesisRequestSchema = z.object({
  instrument: z.string().min(1),
  analysisDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Analysis date (YYYY-MM-DD), defaults to today'),
  currentPrice: z.number().positive(),
  security: z.any().describe('Security analysis result'),
  macro: z.any().nullable().optional().describe('Macro analysis result'),
  flux: z.any().nullable().optional().describe('Institutional flux analysis result'),
  mag7: z.any().nullable().optional().describe('Mag 7 leaders analysis result'),
  technical: z.any().nullable().optional().describe('Technical structure analysis result'),
  userContext: z.string().optional().describe('Additional user context for analysis'),
});

// ============================================================================
// POST Handler
// ============================================================================

/**
 * POST /api/daily-bias/synthesis
 * 
 * Execute synthesis analysis to generate final daily bias
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 1. Authenticate user
    const user = await requireAuth(req);
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
    const validation = SynthesisRequestSchema.safeParse(body);

    if (!validation.success) {
      logger.warn('Invalid synthesis request', {
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

    const { 
      instrument, 
      analysisDate, 
      currentPrice, 
      security, 
      macro, 
      flux, 
      mag7, 
      technical,
      userContext 
    } = validation.data;

    const analysisDateStr = analysisDate || new Date().toISOString().split('T')[0];

    logger.info('Synthesis analysis request', {
      userId: user.id,
      instrument,
      analysisDate: analysisDateStr,
      currentPrice,
      hasSecurity: !!security,
      hasMacro: !!macro,
      hasFlux: !!flux,
      hasMag7: !!mag7,
      hasTechnical: !!technical
    });

    // 3. Build synthesis input
    const synthesisInput: SynthesisInput = {
      security: security as SecurityAnalysis,
      macro: (macro as MacroAnalysis) || null,
      flux: (flux as InstitutionalFlux) || null,
      mag7: (mag7 as Mag7Analysis) || null,
      technical: (technical as TechnicalStructure) || null,
      instrument,
      analysisDate: analysisDateStr,
      currentPrice,
      userContext
    };

    // 4. Execute synthesis analysis
    const result = await synthesizeDailyBias(synthesisInput, {
      useCache: true,
      validateWeights: true
    });

    const processingTime = Date.now() - startTime;

    if (!result.success || !result.data) {
      logger.error('Synthesis analysis failed', {
        userId: user.id,
        instrument,
        error: result.error,
        processingTime
      });

      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'SYNTHESIS_FAILED', 
            message: result.error || 'Synthesis analysis failed',
            details: process.env.NODE_ENV === 'development' ? result.error : undefined
          },
          metadata: {
            processingTimeMs: processingTime,
            timestamp: new Date().toISOString()
          }
        },
        { status: 500 }
      );
    }

    logger.info('Synthesis analysis completed', {
      userId: user.id,
      instrument,
      finalBias: result.data.finalBias,
      confidence: result.data.confidence,
      agreementLevel: result.data.analysis.agreementLevel,
      processingTime
    });

    // 5. Return success response
    return NextResponse.json({
      success: true,
      data: {
        synthesis: result.data,
        metadata: {
          cached: false, // Will be determined by service
          provider: result.metadata.provider,
          model: result.metadata.model,
          latencyMs: result.metadata.latencyMs,
          processingTimeMs: processingTime,
          agreementLevel: result.metadata.agreementLevel,
          confidence: result.metadata.confidence,
          timestamp: new Date().toISOString()
        }
      }
    }, {
      headers: {
        'X-Provider': result.metadata.provider,
        'X-Processing-Time': processingTime.toString()
      }
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;

    logger.error('Synthesis analysis API error', {
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
 * GET /api/daily-bias/synthesis?instrument=NQ1&date=2026-01-18
 * 
 * Get cached synthesis analysis if available
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await requireAuth(req);
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

    const analysisDate = date || new Date().toISOString().split('T')[0];

    // 3. GET method not supported (requires all 5 analysis steps)
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'NOT_SUPPORTED', 
          message: 'GET method not supported. Use POST with all 5 analysis steps to generate synthesis.' 
        } 
      },
      { status: 405 }
    );

  } catch (error: any) {
    logger.error('Synthesis analysis GET error', {
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
