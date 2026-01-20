/**
 * Gemini Rate Limit Status API
 * GET /api/gemini/rate-limit
 * 
 * Returns current rate limit status for Gemini API
 * - Global rate limits
 * - Per-user rate limits (if authenticated)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGeminiRateLimitStatus } from '@/lib/gemini-rate-limiter';
import { getUser } from '@/lib/auth';
import { logger } from '@/lib/observability';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user (optional)
    const user = await getUser();

    // Get rate limit status
    const status = await getGeminiRateLimitStatus(user?.id);

    logger.info('[Gemini] Rate limit status requested', {
      userId: user?.id,
      hasUser: !!user,
    });

    return NextResponse.json({
      success: true,
      data: {
        global: {
          second: {
            current: status.global.second.current,
            max: status.global.second.max,
            remaining: status.global.second.max - status.global.second.current,
            resetAt: status.global.second.resetAt,
          },
          minute: {
            current: status.global.minute.current,
            max: status.global.minute.max,
            remaining: status.global.minute.max - status.global.minute.current,
            resetAt: status.global.minute.resetAt,
          },
          hour: {
            current: status.global.hour.current,
            max: status.global.hour.max,
            remaining: status.global.hour.max - status.global.hour.current,
            resetAt: status.global.hour.resetAt,
          },
          day: {
            current: status.global.day.current,
            max: status.global.day.max,
            remaining: status.global.day.max - status.global.day.current,
            resetAt: status.global.day.resetAt,
          },
          tokens: {
            current: status.global.tokens.current,
            max: status.global.tokens.max,
            remaining: status.global.tokens.max - status.global.tokens.current,
            resetAt: status.global.tokens.resetAt,
          },
        },
        user: status.user
          ? {
              second: {
                current: status.user.second.current,
                max: status.user.second.max,
                remaining: status.user.second.max - status.user.second.current,
                resetAt: status.user.second.resetAt,
              },
              minute: {
                current: status.user.minute.current,
                max: status.user.minute.max,
                remaining: status.user.minute.max - status.user.minute.current,
                resetAt: status.user.minute.resetAt,
              },
              hour: {
                current: status.user.hour.current,
                max: status.user.hour.max,
                remaining: status.user.hour.max - status.user.hour.current,
                resetAt: status.user.hour.resetAt,
              },
              day: {
                current: status.user.day.current,
                max: status.user.day.max,
                remaining: status.user.day.max - status.user.day.current,
                resetAt: status.user.day.resetAt,
              },
              tokens: {
                current: status.user.tokens.current,
                max: status.user.tokens.max,
                remaining: status.user.tokens.max - status.user.tokens.current,
                resetAt: status.user.tokens.resetAt,
              },
            }
          : null,
      },
    });
  } catch (error) {
    logger.error('[Gemini] Failed to get rate limit status', { error });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get rate limit status',
      },
      { status: 500 }
    );
  }
}
