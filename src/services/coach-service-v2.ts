/**
 * AI Trading Coach Service v2
 * 
 * Updated service that uses the AI Provider abstraction layer
 * to support both Google Gemini (preferred) and OpenAI (fallback).
 * 
 * This is the POC version for Story 1.5 - AI Architecture POC.
 */

import { 
  generateAIResponse, 
  isAnyProviderConfigured, 
  getPreferredProvider,
  type AIMessage,
  type AIResponse,
  type AIProvider,
  estimateCost
} from '@/lib/ai-provider';
import type { GlobalStats } from './stats-service';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

// System prompt for AI Trading Coach (English)
const SYSTEM_PROMPT = `You are an expert and supportive trading coach. You help traders improve their performance.

You have access to the user's trading statistics and must use them to personalize your advice.

CRITICAL RULE - Statistics:
- The statistics provided in the context are PRE-CALCULATED and ACCURATE
- NEVER recalculate Win Rate, Profit Factor, or any other metrics yourself
- ALWAYS use the EXACT values provided (e.g., if Win Rate shows "47.05%", quote it as "47.05%")
- Do NOT perform any mathematical operations on these values

Important rules:
1. ALWAYS respond in the same language as the user (English or French)
2. Be constructive and encouraging, even when facing negative results
3. Base your advice on the concrete data provided - use the EXACT numbers given
4. Suggest specific and measurable actions
5. Never promise gains or results
6. Remind the importance of risk management
7. Be concise but complete (2-4 paragraphs max per response)

You can:
- Analyze performance statistics (using the provided values)
- Identify strengths and weaknesses
- Suggest strategy improvements
- Answer questions about trading
- Help understand metrics (Profit Factor, Win Rate, R:R, etc.)
- Propose journaling exercises
- Help manage emotions related to trading

You CANNOT:
- Give specific financial advice (buy/sell X)
- Predict markets
- Guarantee results
- Recommend amounts to invest
- Recalculate any statistics yourself`;

export interface CoachContext {
  stats: GlobalStats | null;
  recentTradesCount: number;
  lastTradeDate: string | null;
  accountAge: string;
  preferredSymbols: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CoachResponseV2 {
  content: string;
  provider: AIProvider;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  estimatedCost?: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
  };
}

export interface CoachError {
  code: 'NOT_CONFIGURED' | 'EMPTY_MESSAGE' | 'API_ERROR' | 'RATE_LIMIT' | 'UNKNOWN';
  message: string;
}

/**
 * Format trading context for the AI
 */
function formatContext(context: CoachContext): string {
  if (!context.stats) {
    return "The user hasn't recorded any trades yet.";
  }

  const stats = context.stats;
  
  // Note: stats.winRate is already a percentage (e.g., 47.05 for 47.05%)
  // Do NOT multiply by 100 again!
  const lines = [
    '## Current trading statistics (use these exact values, do NOT recalculate):',
    `- Total trades: ${stats.totalTrades}`,
    `- Win Rate: ${stats.winRate.toFixed(2)}%`,
    `- Profit Factor: ${stats.profitFactor.toFixed(2)}`,
    `- Total PnL: $${stats.totalPnl.toFixed(2)}`,
    `- Average win: $${stats.averageWin.toFixed(2)}`,
    `- Average loss: $${stats.averageLoss.toFixed(2)}`,
  ];

  if (stats.averageRR !== null) {
    lines.push(`- Average Risk/Reward: ${stats.averageRR.toFixed(2)}`);
  }

  if (stats.bestDay) {
    lines.push(`- Best day: ${stats.bestDay.date} ($${stats.bestDay.pnl.toFixed(2)})`);
  }

  if (stats.worstDay) {
    lines.push(`- Worst day: ${stats.worstDay.date} ($${stats.worstDay.pnl.toFixed(2)})`);
  }

  if (stats.averageDurationSeconds) {
    const minutes = Math.floor(stats.averageDurationSeconds / 60);
    lines.push(`- Average trade duration: ${minutes} min`);
  }

  if (context.preferredSymbols.length > 0) {
    lines.push(`- Traded symbols: ${context.preferredSymbols.slice(0, 5).join(', ')}`);
  }

  if (context.lastTradeDate) {
    lines.push(`- Last trade: ${context.lastTradeDate}`);
  }

  lines.push(`- Account age: ${context.accountAge}`);

  return lines.join('\n');
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a response from the AI Trading Coach (v2 - with provider abstraction)
 */
export async function generateCoachResponseV2(
  messages: ChatMessage[],
  context: CoachContext,
  options?: {
    preferredProvider?: AIProvider;
    forceProvider?: AIProvider;
  }
): Promise<CoachResponseV2> {
  // Check if any AI provider is configured
  if (!isAnyProviderConfigured()) {
    throw {
      code: 'NOT_CONFIGURED',
      message: 'No AI provider configured (GOOGLE_GEMINI_API_KEY or OPENAI_API_KEY required)',
    } as CoachError;
  }

  // Validate messages
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  if (!lastUserMessage || !lastUserMessage.content.trim()) {
    throw {
      code: 'EMPTY_MESSAGE',
      message: 'Message is empty',
    } as CoachError;
  }

  const contextString = formatContext(context);

  // Build messages array for AI
  const aiMessages: AIMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: `## User context:\n${contextString}` },
    ...messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    })),
  ];

  // Retry loop with exponential backoff
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response: AIResponse = await generateAIResponse(aiMessages, {
        preferredProvider: options?.forceProvider || options?.preferredProvider || 'gemini',
        fallbackEnabled: !options?.forceProvider,
        temperature: 0.7,
        maxTokens: 1500,
      });

      if (!response.content) {
        throw new Error('Empty response from AI provider');
      }

      // Calculate estimated cost
      const estimatedCostResult = estimateCost(response);

      return {
        content: response.content,
        provider: response.provider,
        model: response.model,
        usage: response.usage,
        latencyMs: response.latencyMs,
        estimatedCost: estimatedCostResult,
      };

    } catch (error) {
      lastError = error as Error;

      // Check if it's a rate limit error
      const isRateLimitError = (error as { status?: number }).status === 429;

      // Check if it's a server error (5xx)
      const isServerError = (error as { status?: number }).status &&
        (error as { status: number }).status >= 500;

      // Only retry on rate limit or server errors
      if (isRateLimitError || isServerError) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        console.warn(
          `Coach API error (attempt ${attempt + 1}/${MAX_RETRIES}), ` +
          `retrying in ${delay}ms...`,
          error
        );
        await sleep(delay);
        continue;
      }

      // For other errors, throw immediately
      break;
    }
  }

  // Check specific error types
  if ((lastError as { status?: number })?.status === 429) {
    throw {
      code: 'RATE_LIMIT',
      message: 'Rate limit exceeded. Please try again in a moment.',
    } as CoachError;
  }

  throw {
    code: 'API_ERROR',
    message: lastError?.message || 'Coach response failed after multiple retries',
  } as CoachError;
}

/**
 * Generate an initial greeting/analysis based on user's stats
 */
export async function generateInitialAnalysisV2(
  context: CoachContext,
  options?: {
    preferredProvider?: AIProvider;
  }
): Promise<CoachResponseV2> {
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: 'Hello! Can you analyze my trading statistics and give me a brief overview of my performance with improvement suggestions?',
    },
  ];

  return generateCoachResponseV2(messages, context, options);
}

/**
 * Check if coach service is available
 */
export function isCoachAvailableV2(): boolean {
  return isAnyProviderConfigured();
}

/**
 * Get the current preferred provider
 */
export function getCoachProvider(): AIProvider | null {
  return getPreferredProvider();
}
