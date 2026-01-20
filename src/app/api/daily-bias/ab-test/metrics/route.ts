/**
 * A/B Test Metrics API
 * 
 * GET /api/daily-bias/ab-test/metrics?promptType=SECURITY_ANALYSIS&variant=A&startDate=2026-01-18&endDate=2026-01-25
 * 
 * Returns A/B test metrics for a specific prompt type and variant
 * 
 * @module api/daily-bias/ab-test/metrics
 * @created 2026-01-18
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getABTestMetrics, compareVariants, type PromptType, type PromptVariant } from '@/lib/prompts/ab-testing';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const metricsRequestSchema = z.object({
  promptType: z.enum([
    'SECURITY_ANALYSIS',
    'MACRO_ANALYSIS',
    'INSTITUTIONAL_FLUX',
    'MAG7_ANALYSIS',
    'TECHNICAL_STRUCTURE',
    'SYNTHESIS'
  ]),
  variant: z.enum(['A', 'B', 'C']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  compare: z.enum(['A', 'B', 'C']).optional(), // Compare variant with another
});

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate user (admin only for now)
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } },
        { status: 401 }
      );
    }
    
    // Check if admin (optional - can be made public later)
    const isAdmin = user.email?.endsWith('@admin.com') || false;
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      );
    }
    
    // 2. Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const promptType = searchParams.get('promptType') as PromptType;
    const variant = searchParams.get('variant') as PromptVariant | null;
    const compare = searchParams.get('compare') as PromptVariant | null;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    
    // Default dates: last 7 days
    const endDate = endDateStr ? new Date(endDateStr) : new Date();
    const startDate = startDateStr 
      ? new Date(startDateStr) 
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Validate input
    const validation = metricsRequestSchema.safeParse({
      promptType,
      variant: variant || undefined,
      compare: compare || undefined,
      startDate: startDateStr || undefined,
      endDate: endDateStr || undefined,
    });
    
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: validation.error.errors
          }
        },
        { status: 400 }
      );
    }
    
    // 3. Get metrics
    if (compare && variant) {
      // Compare two variants
      const comparison = await compareVariants(
        promptType,
        variant,
        compare,
        startDate,
        endDate
      );
      
      return NextResponse.json({
        success: true,
        data: comparison,
        meta: {
          promptType,
          variants: [variant, compare],
          period: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          }
        }
      });
    } else if (variant) {
      // Get metrics for specific variant
      const metrics = await getABTestMetrics(
        promptType,
        variant,
        startDate,
        endDate
      );
      
      if (!metrics) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `No A/B test metrics found for ${promptType} variant ${variant}`
            }
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        data: metrics,
        meta: {
          promptType,
          variant,
          period: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          }
        }
      });
    } else {
      // Get metrics for all variants
      const variants: PromptVariant[] = ['A', 'B', 'C'];
      const allMetrics = await Promise.all(
        variants.map(v => getABTestMetrics(promptType, v, startDate, endDate))
      );
      
      return NextResponse.json({
        success: true,
        data: {
          variants: allMetrics.filter(m => m !== null),
          comparison: allMetrics[0] && allMetrics[1] 
            ? await compareVariants(promptType, 'A', 'B', startDate, endDate)
            : null
        },
        meta: {
          promptType,
          period: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          }
        }
      });
    }
    
  } catch (error: any) {
    logger.error('A/B Test Metrics API Error', {
      error: error.message,
      stack: error.stack
    });
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve A/B test metrics'
        }
      },
      { status: 500 }
    );
  }
}
