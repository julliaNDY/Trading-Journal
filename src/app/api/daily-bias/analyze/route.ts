/**
 * POST /api/daily-bias/analyze
 * 
 * Execute complete 6-step daily bias analysis
 * Main endpoint for full analysis (Security → Macro → Flux → Mag7 → Technical → Synthesis)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { analyzeDailyBias, canAnalyzeToday, SUPPORTED_INSTRUMENTS, getDailyBiasAnalysis } from '@/services/ai/daily-bias-service';
import { logger } from '@/lib/logger';
import { isAdmin } from '@/app/actions/admin';

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const analyzeRequestSchema = z.object({
  instrument: z.enum(SUPPORTED_INSTRUMENTS as any),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() // YYYY-MM-DD format
});

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } },
        { status: 401 }
      );
    }
    
    // 2. Parse and validate request body
    const body = await req.json();
    const validation = analyzeRequestSchema.safeParse(body);
    
    if (!validation.success) {
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
    
    const { instrument, date } = validation.data;
    const analysisDate = date || new Date().toISOString().split('T')[0];
    
    logger.info('Daily Bias Analysis API Request', {
      userId: user.id,
      instrument,
      date: analysisDate
    });
    
    // 3. Check rate limiting (1 analysis per day for regular users)
    // Admins bypass rate limiting completely
    const userIsAdmin = await isAdmin();
    
    if (!userIsAdmin) {
      const rateLimitResult = await canAnalyzeToday(user.id, instrument);
      const { allowed, lastAnalysis, nextAvailable } = rateLimitResult;
      
      if (!allowed) {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'RATE_LIMIT_EXCEEDED', 
              message: `You have already used your daily analysis. Next analysis available tomorrow at midnight.`,
              details: {
                instrument,
                lastAnalysis: lastAnalysis?.toISOString(),
                nextAvailable: nextAvailable?.toISOString(),
                todayCount: rateLimitResult.todayCount
              }
            } 
          },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': '1',
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': nextAvailable ? Math.floor(nextAvailable.getTime() / 1000).toString() : '0'
            }
          }
        );
      }
    }
    
    // 4. Execute full 6-step analysis
    const startTime = Date.now();
    const result = await analyzeDailyBias({
      userId: user.id,
      instrument,
      date: analysisDate
    });
    const processingTime = Date.now() - startTime;
    
    // 5. Return success response
    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString(),
        rateLimit: {
          limit: userIsAdmin ? 'unlimited' : '1',
          remaining: userIsAdmin ? 'unlimited' : '0',
          reset: userIsAdmin ? null : new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
        }
      }
    }, {
      headers: {
        'X-RateLimit-Limit': userIsAdmin ? 'unlimited' : '1',
        'X-RateLimit-Remaining': userIsAdmin ? 'unlimited' : '0'
      }
    });
    
  } catch (error: any) {
    logger.error('Daily Bias Analysis API Error', {
      error: error.message,
      stack: error.stack
    });
    
    // Check for specific error types
    if (error.message.includes('AI service')) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'AI_SERVICE_ERROR', 
            message: 'AI service temporarily unavailable. Please try again later.' 
          } 
        },
        { status: 500 }
      );
    }
    
    if (error.message.includes('timeout')) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'TIMEOUT_ERROR', 
            message: 'Request timeout. Analysis takes too long. Please try again.' 
          } 
        },
        { status: 504 }
      );
    }
    
    // Generic error
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'An unexpected error occurred during analysis' 
        } 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET HANDLER (for polling/checking existing analysis)
// ============================================================================

/**
 * GET /api/daily-bias/analyze?instrument=NQ1&date=2026-01-18
 * 
 * Get existing analysis for an instrument/date (for polling)
 */
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
    const instrument = searchParams.get('instrument');
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    
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
            message: `Unsupported instrument: ${instrument}` 
          } 
        },
        { status: 400 }
      );
    }
    
    logger.debug('Daily Bias Analysis GET Request', {
      userId: user.id,
      instrument,
      date
    });
    
    // 3. Get existing analysis from database
    try {
      const analysis = await getDailyBiasAnalysis({
        userId: user.id,
        instrument,
        date
      });
      
      if (!analysis) {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'NOT_FOUND', 
              message: `No analysis found for ${instrument} on ${date}` 
            } 
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        data: analysis,
        meta: {
          timestamp: new Date().toISOString(),
          cached: true
        }
      });
      
    } catch (error: any) {
      logger.error('Failed to get daily bias analysis', {
        userId: user.id,
        instrument,
        date,
        error: error.message
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INTERNAL_ERROR', 
            message: 'Failed to retrieve analysis' 
          } 
        },
        { status: 500 }
      );
    }
    
  } catch (error: any) {
    logger.error('Daily Bias Analysis GET API Error', {
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
