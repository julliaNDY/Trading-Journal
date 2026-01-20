/**
 * POST /api/daily-bias/security
 * 
 * Execute Step 1: Security Analysis
 * Analyzes volatility, risk factors, and security profile of an instrument.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { executeSecurityAnalysis, SUPPORTED_INSTRUMENTS } from '@/services/ai/daily-bias-service';
import { logger } from '@/lib/logger';

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const securityAnalysisRequestSchema = z.object({
  instrument: z.enum(SUPPORTED_INSTRUMENTS as any),
  marketData: z.object({
    currentPrice: z.number().positive(),
    priceChange24h: z.number(),
    priceChangePercent24h: z.number(),
    volume24h: z.number().nonnegative(),
    high24h: z.number().positive(),
    low24h: z.number().positive(),
    marketCap: z.number().positive().optional(),
    sector: z.string().optional()
  })
});

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await requireAuth(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } },
        { status: 401 }
      );
    }
    
    // 2. Parse and validate request body
    const body = await req.json();
    const validation = securityAnalysisRequestSchema.safeParse(body);
    
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
    
    const { instrument, marketData } = validation.data;
    
    logger.info('Security Analysis API Request', {
      userId: user.id,
      instrument,
      currentPrice: marketData.currentPrice
    });
    
    // 3. Execute security analysis
    const startTime = Date.now();
    
    const result = await executeSecurityAnalysis({
      instrument,
      marketData
    });
    
    const processingTime = Date.now() - startTime;
    
    // 4. Return success response
    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    logger.error('Security Analysis API Error', {
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
            message: 'Request timeout. Please try again.' 
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
