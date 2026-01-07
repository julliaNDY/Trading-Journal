import OpenAI from 'openai';

// Singleton OpenAI client
let openaiClient: OpenAI | null = null;

/**
 * Get the OpenAI client instance
 * Throws if OPENAI_API_KEY is not configured
 */
export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY is not configured. Please add it to your .env file.'
      );
    }
    
    openaiClient = new OpenAI({
      apiKey,
    });
  }
  
  return openaiClient;
}

/**
 * Check if OpenAI is configured
 */
export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

