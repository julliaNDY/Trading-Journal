/**
 * AI Provider Health Check API (PRÉ-7.3)
 * 
 * GET /api/ai/health
 * Returns health status for all AI providers
 */

import { NextResponse } from 'next/server';
import { getProviderHealthStatus, getProviderStats, isProviderHealthy } from '@/lib/ai-fallback';
import { getAvailableProviders } from '@/lib/ai-provider';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    // Require authentication (admin-only check removed as role field doesn't exist)
    await requireAuth();

    const providers = getAvailableProviders();
    const healthStatus = getProviderHealthStatus();

    const response = {
      timestamp: new Date().toISOString(),
      providers: providers.map(provider => {
        const health = healthStatus[provider];
        const stats = getProviderStats(provider);
        const isHealthy = isProviderHealthy(provider);

        return {
          provider,
          isHealthy,
          state: health?.state || 'UNKNOWN',
          stats: stats ? {
            successRate: Math.round(stats.successRate * 100) / 100,
            averageLatencyMs: Math.round(stats.averageLatencyMs),
            totalRequests: stats.totalRequests,
          } : null,
          health: health ? {
            failures: health.failures,
            successes: health.successes,
            totalFailures: health.totalFailures,
            totalSuccesses: health.totalSuccesses,
            lastFailureTime: health.lastFailureTime,
            lastSuccessTime: health.lastSuccessTime,
          } : null,
        };
      }),
      summary: {
        totalProviders: providers.length,
        healthyProviders: providers.filter(p => isProviderHealthy(p)).length,
        configuredProviders: providers,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching AI health status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
