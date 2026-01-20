/**
 * AI POC Test Endpoint
 * 
 * Story 1.5: AI Architecture POC
 * 
 * This endpoint allows testing the AI providers (Gemini/OpenAI) with
 * sample coaching prompts to validate latency and response quality.
 * 
 * POST /api/ai-poc/test
 * 
 * Request body:
 * {
 *   "provider": "gemini" | "openai" | "auto", // optional, defaults to "auto"
 *   "prompt": "string", // optional, defaults to sample coaching prompt
 *   "testEmbeddings": boolean // optional, also test embeddings
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "chat": {
 *     "provider": "gemini",
 *     "model": "gemini-1.5-flash",
 *     "response": "...",
 *     "latencyMs": 1234,
 *     "usage": { ... },
 *     "estimatedCost": { ... }
 *   },
 *   "embeddings": { ... } // if testEmbeddings is true
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  generateAIResponse, 
  generateEmbeddings, 
  getAvailableProviders,
  estimateCost,
  type AIProvider 
} from '@/lib/ai-provider';

// Sample trading context for testing
const SAMPLE_CONTEXT = {
  totalTrades: 150,
  winRate: 58.5,
  profitFactor: 1.85,
  totalPnl: 12450.50,
  averageWin: 185.25,
  averageLoss: -95.10,
  averageRR: 2.15,
  tradedSymbols: ['ES', 'NQ', 'CL', 'GC'],
};

const DEFAULT_PROMPT = `Analyze my trading performance and suggest 3 specific improvements I should focus on.

My stats:
- Win Rate: ${SAMPLE_CONTEXT.winRate}%
- Profit Factor: ${SAMPLE_CONTEXT.profitFactor}
- Total PnL: $${SAMPLE_CONTEXT.totalPnl}
- Average Win: $${SAMPLE_CONTEXT.averageWin}
- Average Loss: $${SAMPLE_CONTEXT.averageLoss}
- Average R:R: ${SAMPLE_CONTEXT.averageRR}
- Traded Symbols: ${SAMPLE_CONTEXT.tradedSymbols.join(', ')}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { 
      provider = 'auto', 
      prompt = DEFAULT_PROMPT,
      testEmbeddings = false 
    } = body as {
      provider?: 'gemini' | 'openai' | 'auto';
      prompt?: string;
      testEmbeddings?: boolean;
    };
    
    // Check available providers
    const availableProviders = getAvailableProviders();
    if (availableProviders.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No AI providers configured',
        hint: 'Add GOOGLE_GEMINI_API_KEY or OPENAI_API_KEY to your environment',
      }, { status: 503 });
    }
    
    // Determine which provider to use
    let targetProvider: AIProvider;
    if (provider === 'auto') {
      targetProvider = availableProviders.includes('gemini') ? 'gemini' : 'openai';
    } else {
      if (!availableProviders.includes(provider)) {
        return NextResponse.json({
          success: false,
          error: `Provider '${provider}' is not configured`,
          availableProviders,
        }, { status: 400 });
      }
      targetProvider = provider;
    }
    
    // Run chat completion test
    const messages = [
      { 
        role: 'system' as const, 
        content: 'You are an expert trading coach. Provide helpful, actionable advice based on the user\'s trading statistics.' 
      },
      { role: 'user' as const, content: prompt },
    ];
    
    const chatResponse = await generateAIResponse(messages, {
      preferredProvider: targetProvider,
      fallbackEnabled: provider === 'auto',
    });
    
    const chatCost = estimateCost(chatResponse);
    
    // Result object
    const result: Record<string, unknown> = {
      success: true,
      availableProviders,
      chat: {
        provider: chatResponse.provider,
        model: chatResponse.model,
        response: chatResponse.content,
        latencyMs: Math.round(chatResponse.latencyMs),
        usage: chatResponse.usage,
        estimatedCost: {
          inputCostUSD: chatCost.inputCost.toFixed(8),
          outputCostUSD: chatCost.outputCost.toFixed(8),
          totalCostUSD: chatCost.totalCost.toFixed(8),
        },
        meetsLatencyTarget: chatResponse.latencyMs < 2000,
      },
    };
    
    // Optionally test embeddings
    if (testEmbeddings) {
      const sampleText = 'LONG trade on ES winning trade with profit of $250.00 risk-reward ratio of 2.5';
      const embeddingResponse = await generateEmbeddings(sampleText, {
        preferredProvider: targetProvider,
        fallbackEnabled: provider === 'auto',
      });
      
      result.embeddings = {
        provider: embeddingResponse.provider,
        model: embeddingResponse.model,
        dimension: embeddingResponse.dimension,
        latencyMs: Math.round(embeddingResponse.latencyMs),
        sampleVector: embeddingResponse.embeddings[0].slice(0, 5), // First 5 values only
      };
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('AI POC test error:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message,
    }, { status: 500 });
  }
}

export async function GET() {
  // Return info about available providers
  const { getAvailableProviders, getPreferredProvider } = await import('@/lib/ai-provider');
  
  const providers = getAvailableProviders();
  const preferred = getPreferredProvider();
  
  return NextResponse.json({
    status: 'AI POC Test Endpoint',
    story: '1.5 - AI Architecture POC',
    availableProviders: providers,
    preferredProvider: preferred,
    configured: {
      gemini: providers.includes('gemini'),
      openai: providers.includes('openai'),
    },
    usage: {
      method: 'POST',
      body: {
        provider: 'gemini | openai | auto (optional)',
        prompt: 'string (optional)',
        testEmbeddings: 'boolean (optional)',
      },
    },
  });
}
