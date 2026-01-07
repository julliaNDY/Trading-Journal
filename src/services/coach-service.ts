import { getOpenAIClient, isOpenAIConfigured } from '@/lib/openai';
import type { GlobalStats } from './stats-service';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

// System prompt for AI Trading Coach
const SYSTEM_PROMPT = `Tu es un coach de trading expert et bienveillant. Tu aides les traders à améliorer leurs performances.

Tu as accès aux statistiques de trading de l'utilisateur et tu dois les utiliser pour personnaliser tes conseils.

Règles importantes:
1. Réponds TOUJOURS dans la même langue que l'utilisateur (français ou anglais)
2. Sois constructif et encourageant, même face à des résultats négatifs
3. Base tes conseils sur les données concrètes fournies
4. Propose des actions spécifiques et mesurables
5. Ne fais pas de promesses de gains ou de résultats
6. Rappelle l'importance de la gestion du risque
7. Sois concis mais complet (2-4 paragraphes max par réponse)

Tu peux:
- Analyser les statistiques de performance
- Identifier les forces et faiblesses
- Suggérer des améliorations de stratégie
- Répondre aux questions sur le trading
- Aider à comprendre les métriques (Profit Factor, Win Rate, R:R, etc.)
- Proposer des exercices de journalisation
- Aider à gérer les émotions liées au trading

Tu ne peux PAS:
- Donner des conseils financiers spécifiques (acheter/vendre X)
- Prédire les marchés
- Garantir des résultats
- Recommander des montants à investir`;

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

export interface CoachResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
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
    return "L'utilisateur n'a pas encore de trades enregistrés.";
  }

  const stats = context.stats;
  const lines = [
    '## Statistiques de trading actuelles:',
    `- Nombre total de trades: ${stats.totalTrades}`,
    `- Win Rate: ${(stats.winRate * 100).toFixed(1)}%`,
    `- Profit Factor: ${stats.profitFactor.toFixed(2)}`,
    `- PnL Total: $${stats.totalPnl.toFixed(2)}`,
    `- Moyenne gain: $${stats.averageWin.toFixed(2)}`,
    `- Moyenne perte: $${stats.averageLoss.toFixed(2)}`,
  ];

  if (stats.averageRR !== null) {
    lines.push(`- Risk/Reward moyen: ${stats.averageRR.toFixed(2)}`);
  }

  if (stats.bestDay) {
    lines.push(`- Meilleur jour: ${stats.bestDay.date} ($${stats.bestDay.pnl.toFixed(2)})`);
  }

  if (stats.worstDay) {
    lines.push(`- Pire jour: ${stats.worstDay.date} ($${stats.worstDay.pnl.toFixed(2)})`);
  }

  if (stats.averageDurationSeconds) {
    const minutes = Math.floor(stats.averageDurationSeconds / 60);
    lines.push(`- Durée moyenne des trades: ${minutes} min`);
  }

  if (context.preferredSymbols.length > 0) {
    lines.push(`- Symboles tradés: ${context.preferredSymbols.slice(0, 5).join(', ')}`);
  }

  if (context.lastTradeDate) {
    lines.push(`- Dernier trade: ${context.lastTradeDate}`);
  }

  lines.push(`- Ancienneté du compte: ${context.accountAge}`);

  return lines.join('\n');
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a response from the AI Trading Coach
 */
export async function generateCoachResponse(
  messages: ChatMessage[],
  context: CoachContext
): Promise<CoachResponse> {
  // Check if OpenAI is configured
  if (!isOpenAIConfigured()) {
    throw {
      code: 'NOT_CONFIGURED',
      message: 'OpenAI API key is not configured',
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

  const openai = getOpenAIClient();
  const contextString = formatContext(context);

  // Build messages array for OpenAI
  const openaiMessages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'system' as const, content: `## Contexte utilisateur:\n${contextString}` },
    ...messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  // Retry loop with exponential backoff
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: openaiMessages,
        temperature: 0.7,
        max_tokens: 1500,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      return {
        content,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      };

    } catch (error) {
      lastError = error as Error;

      // Check if it's a rate limit error (429)
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
export async function generateInitialAnalysis(context: CoachContext): Promise<CoachResponse> {
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: 'Bonjour ! Peux-tu analyser mes statistiques de trading et me donner un bref aperçu de ma performance avec des suggestions d\'amélioration ?',
    },
  ];

  return generateCoachResponse(messages, context);
}

/**
 * Check if coach service is available
 */
export function isCoachAvailable(): boolean {
  return isOpenAIConfigured();
}

