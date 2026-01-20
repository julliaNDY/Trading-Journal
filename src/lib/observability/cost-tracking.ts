/**
 * Cost Tracking for External APIs
 * Story 1.9: Production Monitoring & Alerting
 *
 * Tracks usage of paid APIs to monitor costs:
 * - Google Gemini (AI)
 * - Stripe (payments)
 * - OpenAI (transcription)
 * - Google Vision (OCR)
 */

import { recordMetric } from './metrics';
import { logger } from './logger';
import { checkMetricRule, type AlertRule } from './alerts';

// ============================================================================
// Types
// ============================================================================

export interface ApiUsage {
  service: 'gemini' | 'openai' | 'stripe' | 'vision' | 'supabase';
  operation: string;
  userId?: string;
  tokens?: number;
  calls?: number;
  cost?: number;
  timestamp: Date;
}

export interface CostSummary {
  period: {
    start: Date;
    end: Date;
  };
  services: Record<
    string,
    {
      calls: number;
      tokens: number;
      estimatedCost: number;
    }
  >;
  byUser: Record<
    string,
    {
      calls: number;
      tokens: number;
      estimatedCost: number;
    }
  >;
  totalEstimatedCost: number;
}

// ============================================================================
// Cost Estimates (per unit)
// ============================================================================

export const COST_ESTIMATES = {
  gemini: {
    // Gemini 1.5 Flash pricing (per 1M tokens)
    inputTokens: 0.075 / 1_000_000,
    outputTokens: 0.3 / 1_000_000,
    // Approximate per-call cost for typical requests
    perCall: 0.001,
  },
  openai: {
    // Whisper pricing (per minute of audio)
    whisperPerMinute: 0.006,
    // GPT-4 pricing (per 1K tokens)
    gpt4InputPer1k: 0.03,
    gpt4OutputPer1k: 0.06,
  },
  stripe: {
    // Stripe API calls are free, but we track them for rate limiting awareness
    perCall: 0,
    // Transaction fees (not tracked here, just API calls)
  },
  vision: {
    // Google Vision pricing (per 1K images)
    perImage: 0.0015,
  },
  supabase: {
    // Supabase is included in plan, but track for usage patterns
    perQuery: 0,
    storagePerGB: 0.021,
  },
};

// ============================================================================
// Usage Tracking
// ============================================================================

// In-memory usage buffer (flushed to database periodically)
const usageBuffer: ApiUsage[] = [];
const BUFFER_MAX_SIZE = 100;

/**
 * Track Gemini API usage
 */
export function trackGeminiUsage(
  operation: string,
  inputTokens: number,
  outputTokens: number,
  userId?: string
): void {
  const tokens = inputTokens + outputTokens;
  const cost =
    inputTokens * COST_ESTIMATES.gemini.inputTokens +
    outputTokens * COST_ESTIMATES.gemini.outputTokens;

  recordMetric('cost.gemini.call', 1, 'count', { operation, userId: userId || 'anonymous' });
  recordMetric('cost.gemini.tokens', tokens, 'count', { operation });
  recordMetric('cost.gemini.input_tokens', inputTokens, 'count', { operation });
  recordMetric('cost.gemini.output_tokens', outputTokens, 'count', { operation });
  recordMetric('cost.gemini.estimated', cost * 100, 'count', { operation }); // cents

  addToBuffer({
    service: 'gemini',
    operation,
    userId,
    tokens,
    calls: 1,
    cost,
    timestamp: new Date(),
  });

  logger.debug('Gemini usage tracked', { operation, tokens, cost, userId });
}

/**
 * Track OpenAI usage (Whisper)
 */
export function trackOpenAIUsage(
  operation: string,
  durationSeconds: number,
  userId?: string
): void {
  const durationMinutes = durationSeconds / 60;
  const cost = durationMinutes * COST_ESTIMATES.openai.whisperPerMinute;

  recordMetric('cost.openai.call', 1, 'count', { operation, userId: userId || 'anonymous' });
  recordMetric('cost.openai.duration', durationSeconds, 'ms', { operation });
  recordMetric('cost.openai.estimated', cost * 100, 'count', { operation }); // cents

  addToBuffer({
    service: 'openai',
    operation,
    userId,
    calls: 1,
    cost,
    timestamp: new Date(),
  });

  logger.debug('OpenAI usage tracked', { operation, durationSeconds, cost, userId });
}

/**
 * Track Stripe API usage
 */
export function trackStripeUsage(operation: string, userId?: string): void {
  recordMetric('cost.stripe.call', 1, 'count', { operation, userId: userId || 'anonymous' });

  addToBuffer({
    service: 'stripe',
    operation,
    userId,
    calls: 1,
    cost: 0,
    timestamp: new Date(),
  });

  logger.debug('Stripe usage tracked', { operation, userId });
}

/**
 * Track Google Vision usage
 */
export function trackVisionUsage(operation: string, imageCount: number, userId?: string): void {
  const cost = imageCount * COST_ESTIMATES.vision.perImage;

  recordMetric('cost.vision.call', 1, 'count', { operation, userId: userId || 'anonymous' });
  recordMetric('cost.vision.images', imageCount, 'count', { operation });
  recordMetric('cost.vision.estimated', cost * 100, 'count', { operation }); // cents

  addToBuffer({
    service: 'vision',
    operation,
    userId,
    calls: imageCount,
    cost,
    timestamp: new Date(),
  });

  logger.debug('Vision usage tracked', { operation, imageCount, cost, userId });
}

/**
 * Track Supabase usage (for awareness)
 */
export function trackSupabaseUsage(operation: string, queryCount: number = 1): void {
  recordMetric('cost.supabase.call', queryCount, 'count', { operation });

  addToBuffer({
    service: 'supabase',
    operation,
    calls: queryCount,
    cost: 0,
    timestamp: new Date(),
  });
}

// ============================================================================
// Buffer Management
// ============================================================================

function addToBuffer(usage: ApiUsage): void {
  usageBuffer.push(usage);

  if (usageBuffer.length >= BUFFER_MAX_SIZE) {
    flushBuffer();
  }
}

/**
 * Flush usage buffer (could persist to database)
 */
export function flushBuffer(): ApiUsage[] {
  const entries = usageBuffer.splice(0, usageBuffer.length);

  // In production, you might want to persist this to database
  // For now, we rely on the metrics system

  if (entries.length > 0) {
    logger.debug('Cost tracking buffer flushed', { count: entries.length });
  }

  return entries;
}

// ============================================================================
// Cost Summary
// ============================================================================

/**
 * Get cost summary for a period
 * Note: This uses in-memory buffer data. In production, query from database.
 */
export function getCostSummary(since?: Date): CostSummary {
  const now = new Date();
  const start = since || new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

  const services: CostSummary['services'] = {};
  const byUser: CostSummary['byUser'] = {};
  let totalEstimatedCost = 0;

  for (const usage of usageBuffer) {
    if (usage.timestamp < start) continue;

    // Aggregate by service
    if (!services[usage.service]) {
      services[usage.service] = { calls: 0, tokens: 0, estimatedCost: 0 };
    }
    services[usage.service].calls += usage.calls || 1;
    services[usage.service].tokens += usage.tokens || 0;
    services[usage.service].estimatedCost += usage.cost || 0;

    // Aggregate by user
    const userId = usage.userId || 'anonymous';
    if (!byUser[userId]) {
      byUser[userId] = { calls: 0, tokens: 0, estimatedCost: 0 };
    }
    byUser[userId].calls += usage.calls || 1;
    byUser[userId].tokens += usage.tokens || 0;
    byUser[userId].estimatedCost += usage.cost || 0;

    totalEstimatedCost += usage.cost || 0;
  }

  return {
    period: { start, end: now },
    services,
    byUser,
    totalEstimatedCost,
  };
}

// ============================================================================
// Cost Alerts
// ============================================================================

export const COST_ALERT_RULES: AlertRule[] = [
  {
    name: 'gemini_usage_spike',
    metricName: 'cost.gemini.call',
    condition: 'gt',
    warningThreshold: 100, // 100 calls per hour
    criticalThreshold: 500, // 500 calls per hour
    channels: ['slack'],
    cooldownMinutes: 60,
    description: 'Gemini API usage spike detected',
  },
  {
    name: 'daily_cost_warning',
    metricName: 'cost.daily_total',
    condition: 'gt',
    warningThreshold: 10, // $10/day
    criticalThreshold: 50, // $50/day
    channels: ['slack', 'sentry'],
    cooldownMinutes: 240,
    description: 'Daily API cost threshold exceeded',
  },
];

/**
 * Check for unusual usage patterns
 */
export async function checkCostAlerts(): Promise<void> {
  const summary = getCostSummary();

  // Check for high-usage users
  for (const [userId, usage] of Object.entries(summary.byUser)) {
    if (usage.calls > 100 && userId !== 'anonymous') {
      logger.warn('High API usage by user', { userId, ...usage });

      // Could trigger an alert here
      await checkMetricRule(COST_ALERT_RULES[0], usage.calls);
    }
  }

  // Check total daily cost
  if (summary.totalEstimatedCost > COST_ALERT_RULES[1].warningThreshold) {
    await checkMetricRule(COST_ALERT_RULES[1], summary.totalEstimatedCost);
  }
}
