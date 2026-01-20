/**
 * Institutional Flux Analysis API Endpoint
 * 
 * POST /api/daily-bias/flux
 * 
 * Analyzes institutional flux (volume profile, order flow, smart money)
 * for a given instrument.
 * 
 * @module api/daily-bias/flux
 * @created 2026-01-17
 * @author Dev 50, Dev 51 (PRÉ-8.3)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeInstitutionalFlux, type FluxAnalysisParams } from '@/services/daily-bias/institutional-flux-service';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth';

// ============================================================================
// Request Validation Schema
// ============================================================================

const FluxRequestSchema = z.object({
  instrument: z.string().min(1).max(20).describe('Trading instrument symbol'),
  marketData: z.object({
    currentPrice: z.number().positive(),
    priceChange24h: z.number(),
    volume24h: z.number().nonnegative(),
    averageVolume20d: z.number().positive(),
    high24h: z.number().positive(),
    low24h: z.number().positive(),
  }),
  volumeData: z.array(z.object({
    timestamp: z.string(),
    volume: z.number().nonnegative(),
    price: z.number().positive(),
    buyVolume: z.number().nonnegative().optional(),
    sellVolume: z.number().nonnegative().optional(),
  })).optional(),
  orderBookData: z.object({
    bids: z.array(z.object({
      price: z.number().positive(),
      size: z.number().positive(),
    })),
    asks: z.array(z.object({
      price: z.number().positive(),
      size: z.number().positive(),
    })),
    timestamp: z.string(),
  }).optional(),
  darkPoolData: z.object({
    volume: z.number().nonnegative(),
    percentage: z.number().min(0).max(100),
    trades: z.array(z.object({
      timestamp: z.string(),
      size: z.number().positive(),
      price: z.number().positive(),
    })),
  }).optional(),
  timeframe: z.enum(['1h', '4h', '1d']).optional(),
  useCache: z.boolean().optional(),
});

type FluxRequest = z.infer<typeof FluxRequestSchema>;

// ============================================================================
// Rate Limiting
// ============================================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute per user

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || userLimit.resetAt < now) {
    // Reset or initialize
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt: now + RATE_LIMIT_WINDOW };
  }

  if (userLimit.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetAt: userLimit.resetAt };
  }

  userLimit.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - userLimit.count, resetAt: userLimit.resetAt };
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check rate limit
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      const resetIn = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: `Too many requests. Try again in ${resetIn} seconds.`,
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          },
        }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = FluxRequestSchema.parse(body);

    logger.info('Institutional flux analysis requested', {
      userId: user.id,
      instrument: validatedData.instrument,
      timeframe: validatedData.timeframe || '1d',
    });

    // Perform analysis
    const result = await analyzeInstitutionalFlux({
      instrument: validatedData.instrument,
      marketData: validatedData.marketData,
      volumeData: validatedData.volumeData,
      orderBookData: validatedData.orderBookData,
      darkPoolData: validatedData.darkPoolData,
      timeframe: validatedData.timeframe,
      useCache: validatedData.useCache ?? true,
    });

    // Return response with rate limit headers
    return NextResponse.json(
      {
        success: true,
        data: result.analysis,
        meta: {
          cached: result.cached,
          latencyMs: result.latencyMs,
          provider: result.provider,
          model: result.model,
        },
      },
      {
        status: 200,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          'Cache-Control': result.cached ? 'public, max-age=300' : 'no-cache',
        },
      }
    );
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      logger.warn('Invalid flux analysis request', { errors: error.errors });
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Handle other errors
    logger.error('Institutional flux analysis failed', { error });
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to analyze institutional flux',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET Handler (for testing/health check)
// ============================================================================

export async function GET(request: NextRequest) {
  return NextResponse.json({
    endpoint: '/api/daily-bias/flux',
    method: 'POST',
    description: 'Analyze institutional flux (volume profile, order flow, smart money)',
    version: '1.0.0',
    rateLimit: {
      maxRequests: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW,
    },
    requiredFields: [
      'instrument',
      'marketData.currentPrice',
      'marketData.priceChange24h',
      'marketData.volume24h',
      'marketData.averageVolume20d',
      'marketData.high24h',
      'marketData.low24h',
    ],
    optionalFields: [
      'volumeData',
      'orderBookData',
      'darkPoolData',
      'timeframe',
      'useCache',
    ],
    cacheSettings: {
      ttl: 300, // 5 minutes
      enabled: true,
    },
  });
}
