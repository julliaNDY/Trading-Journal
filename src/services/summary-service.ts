import { getOpenAIClient, isOpenAIConfigured } from '@/lib/openai';
import { createHash } from 'crypto';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

// System prompt for trading journal analysis (English)
const SYSTEM_PROMPT = `You are an assistant specialized in trading journal analysis. 
You receive the transcription of a trader's voice note after a trade.

Your role is to extract and structure key information WITHOUT EVER losing important details.

ALWAYS respond in the same language as the transcription (English or French).

Generate a JSON response with this exact structure:
{
  "keyPoints": ["Key point 1", "Key point 2", ...],
  "mistakes": ["Mistake 1", "Mistake 2", ...],
  "lessons": ["Lesson 1", "Lesson 2", ...],
  "actions": ["Action 1", "Action 2", ...],
  "rawSummary": "Complete narrative summary in 2-3 sentences"
}

Rules:
- keyPoints: Objective facts mentioned (entry price, setup, market context, result)
- mistakes: Errors the trader acknowledges making
- lessons: Learnings from this trade
- actions: Concrete actions to take for the future
- rawSummary: Concise but complete trade summary
- If a category is empty, return an empty array []
- Preserve technical context (indicator names, price levels, symbols)
- Do NOT infer information not explicitly mentioned
- Be exhaustive: capture ALL mentioned points`;

export interface Summary {
  keyPoints: string[];
  mistakes: string[];
  lessons: string[];
  actions: string[];
  rawSummary: string;
}

export interface SummaryResult {
  summary: Summary;
  transcriptionHash: string;
}

export interface SummaryError {
  code: 'NOT_CONFIGURED' | 'EMPTY_TRANSCRIPTION' | 'PARSE_ERROR' | 'API_ERROR' | 'UNKNOWN';
  message: string;
}

/**
 * Create an MD5 hash of the transcription for cache invalidation
 */
export function hashTranscription(transcription: string): string {
  return createHash('md5').update(transcription.trim()).digest('hex');
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse the JSON response from OpenAI, with fallback handling
 */
function parseSummaryResponse(content: string): Summary {
  try {
    const parsed = JSON.parse(content);
    
    // Validate and normalize the structure
    return {
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes : [],
      lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      rawSummary: typeof parsed.rawSummary === 'string' ? parsed.rawSummary : '',
    };
  } catch {
    // If JSON parsing fails, try to extract meaningful content
    throw {
      code: 'PARSE_ERROR',
      message: 'Failed to parse summary response as JSON',
    } as SummaryError;
  }
}

/**
 * Generate a structured summary from a transcription using GPT-4o-mini
 * 
 * @param transcription - The voice note transcription text
 * @returns SummaryResult with structured summary and transcription hash
 * @throws SummaryError if something goes wrong
 */
export async function generateSummary(transcription: string): Promise<SummaryResult> {
  // Check if OpenAI is configured
  if (!isOpenAIConfigured()) {
    throw {
      code: 'NOT_CONFIGURED',
      message: 'OpenAI API key is not configured',
    } as SummaryError;
  }
  
  // Validate transcription
  const trimmedTranscription = transcription.trim();
  if (!trimmedTranscription || trimmedTranscription.length < 10) {
    throw {
      code: 'EMPTY_TRANSCRIPTION',
      message: 'Transcription is too short or empty',
    } as SummaryError;
  }
  
  const openai = getOpenAIClient();
  const transcriptionHash = hashTranscription(trimmedTranscription);
  
  // Retry loop with exponential backoff
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Transcription:\n\n${trimmedTranscription}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // More deterministic
        max_tokens: 1000,
      });
      
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }
      
      const summary = parseSummaryResponse(content);
      
      return {
        summary,
        transcriptionHash,
      };
      
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a parse error (don't retry)
      if ((error as SummaryError).code === 'PARSE_ERROR') {
        throw error;
      }
      
      // Check if it's a rate limit error (429)
      const isRateLimitError = (error as { status?: number }).status === 429;
      
      // Check if it's a server error (5xx)
      const isServerError = (error as { status?: number }).status && 
        (error as { status: number }).status >= 500;
      
      // Only retry on rate limit or server errors
      if (isRateLimitError || isServerError) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        console.warn(
          `Summary API error (attempt ${attempt + 1}/${MAX_RETRIES}), ` +
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
  
  // All retries failed
  throw {
    code: 'API_ERROR',
    message: lastError?.message || 'Summary generation failed after multiple retries',
  } as SummaryError;
}

/**
 * Check if summary service is available
 */
export function isSummaryAvailable(): boolean {
  return isOpenAIConfigured();
}

/**
 * Check if a summary needs to be regenerated based on transcription hash
 */
export function needsRegeneration(
  currentTranscriptionHash: string | null,
  newTranscription: string
): boolean {
  if (!currentTranscriptionHash) return true;
  const newHash = hashTranscription(newTranscription);
  return currentTranscriptionHash !== newHash;
}
