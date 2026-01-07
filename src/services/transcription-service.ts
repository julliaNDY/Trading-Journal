import { getOpenAIClient, isOpenAIConfigured } from '@/lib/openai';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';

// Maximum file size for Whisper API (25MB)
const MAX_FILE_SIZE = 25 * 1024 * 1024;

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  textWithTimestamps: string;
  language: string;
  duration: number;
  segments: TranscriptionSegment[];
}

export interface TranscriptionError {
  code: 'NOT_CONFIGURED' | 'FILE_NOT_FOUND' | 'FILE_TOO_LARGE' | 'API_ERROR' | 'UNKNOWN';
  message: string;
}

/**
 * Format seconds to MM:SS string
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format transcription with timestamps every 30 seconds
 */
function formatWithTimestamps(segments: TranscriptionSegment[]): string {
  if (!segments || segments.length === 0) {
    return '';
  }
  
  let result = '';
  let lastTimestamp = -30;
  
  for (const segment of segments) {
    const currentTime = Math.floor(segment.start);
    
    // Add timestamp every 30 seconds
    if (currentTime - lastTimestamp >= 30) {
      if (result.length > 0) {
        result += '\n';
      }
      result += `[${formatTimestamp(currentTime)}] `;
      lastTimestamp = currentTime;
    }
    
    result += segment.text.trim() + ' ';
  }
  
  return result.trim();
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Transcribe an audio file using OpenAI Whisper API
 * 
 * @param filePath - Relative path to the audio file (e.g., "voice-notes/trade-id/file.webm")
 * @returns TranscriptionResult with text and metadata
 * @throws TranscriptionError if something goes wrong
 */
export async function transcribeAudio(filePath: string): Promise<TranscriptionResult> {
  // Check if OpenAI is configured
  if (!isOpenAIConfigured()) {
    throw {
      code: 'NOT_CONFIGURED',
      message: 'OpenAI API key is not configured',
    } as TranscriptionError;
  }
  
  // Build absolute path
  const absolutePath = path.join(process.cwd(), UPLOAD_DIR, filePath);
  
  // Check if file exists
  if (!fs.existsSync(absolutePath)) {
    throw {
      code: 'FILE_NOT_FOUND',
      message: `Audio file not found: ${filePath}`,
    } as TranscriptionError;
  }
  
  // Check file size
  const stats = fs.statSync(absolutePath);
  if (stats.size > MAX_FILE_SIZE) {
    throw {
      code: 'FILE_TOO_LARGE',
      message: `File size exceeds 25MB limit (${Math.round(stats.size / 1024 / 1024)}MB)`,
    } as TranscriptionError;
  }
  
  const openai = getOpenAIClient();
  
  // Retry loop with exponential backoff
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Create read stream for the file
      const fileStream = fs.createReadStream(absolutePath);
      
      // Call Whisper API
      const response = await openai.audio.transcriptions.create({
        file: fileStream,
        model: 'whisper-1',
        response_format: 'verbose_json',
        // Don't specify language - let Whisper auto-detect
      });
      
      // Parse segments from response
      // The verbose_json response includes segments with timestamps
      const segments: TranscriptionSegment[] = (response as unknown as { segments?: TranscriptionSegment[] }).segments?.map(seg => ({
        start: seg.start,
        end: seg.end,
        text: seg.text,
      })) || [];
      
      // Format with timestamps
      const textWithTimestamps = formatWithTimestamps(segments);
      
      return {
        text: response.text,
        textWithTimestamps: textWithTimestamps || response.text,
        language: (response as unknown as { language?: string }).language || 'unknown',
        duration: (response as unknown as { duration?: number }).duration || 0,
        segments,
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
          `Transcription API error (attempt ${attempt + 1}/${MAX_RETRIES}), ` +
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
    message: lastError?.message || 'Transcription failed after multiple retries',
  } as TranscriptionError;
}

/**
 * Check if transcription is available for a given configuration
 */
export function isTranscriptionAvailable(): boolean {
  return isOpenAIConfigured();
}

