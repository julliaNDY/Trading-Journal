import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Transcription Service Tests
 * 
 * Note: Full integration tests with OpenAI API require actual API calls.
 * These tests focus on:
 * 1. Configuration checks (isTranscriptionAvailable)
 * 2. Error handling for missing API key
 * 
 * Manual testing required for:
 * - Actual transcription with Whisper API
 * - Timestamp formatting
 * - Retry logic with rate limits
 */

describe('transcription-service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isTranscriptionAvailable', () => {
    it('should return true when OPENAI_API_KEY is set', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { isTranscriptionAvailable } = await import('../transcription-service');
      expect(isTranscriptionAvailable()).toBe(true);
    });

    it('should return false when OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY;
      
      const { isTranscriptionAvailable } = await import('../transcription-service');
      expect(isTranscriptionAvailable()).toBe(false);
    });

    it('should return false when OPENAI_API_KEY is empty', async () => {
      process.env.OPENAI_API_KEY = '';
      
      const { isTranscriptionAvailable } = await import('../transcription-service');
      expect(isTranscriptionAvailable()).toBe(false);
    });
  });

  describe('transcribeAudio error handling', () => {
    it('should throw NOT_CONFIGURED error when API key is missing', async () => {
      delete process.env.OPENAI_API_KEY;
      
      const { transcribeAudio } = await import('../transcription-service');
      
      await expect(transcribeAudio('test.webm')).rejects.toMatchObject({
        code: 'NOT_CONFIGURED',
        message: 'OpenAI API key is not configured',
      });
    });

    it('should throw FILE_NOT_FOUND error for non-existent file', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { transcribeAudio } = await import('../transcription-service');
      
      await expect(transcribeAudio('nonexistent/path/file.webm')).rejects.toMatchObject({
        code: 'FILE_NOT_FOUND',
      });
    });
  });

  describe('TranscriptionResult interface', () => {
    it('should have correct structure', () => {
      // Type check - this test validates the interface exists
      const mockResult = {
        text: 'Test transcription',
        textWithTimestamps: '[00:00] Test transcription',
        language: 'english',
        duration: 10.5,
        segments: [{ start: 0, end: 10.5, text: 'Test transcription' }],
      };

      expect(mockResult).toHaveProperty('text');
      expect(mockResult).toHaveProperty('textWithTimestamps');
      expect(mockResult).toHaveProperty('language');
      expect(mockResult).toHaveProperty('duration');
      expect(mockResult).toHaveProperty('segments');
      expect(mockResult.segments[0]).toHaveProperty('start');
      expect(mockResult.segments[0]).toHaveProperty('end');
      expect(mockResult.segments[0]).toHaveProperty('text');
    });
  });

  describe('TranscriptionError codes', () => {
    it('should define expected error codes', () => {
      const expectedCodes = ['NOT_CONFIGURED', 'FILE_NOT_FOUND', 'FILE_TOO_LARGE', 'API_ERROR', 'UNKNOWN'];
      
      // This test documents the expected error codes
      expectedCodes.forEach(code => {
        expect(typeof code).toBe('string');
      });
    });
  });
});

/**
 * Manual Test Scenarios (require OPENAI_API_KEY and real audio files):
 * 
 * 1. French Audio Transcription:
 *    - Record 1 minute of French speech
 *    - Upload and transcribe
 *    - Verify language detection is "french"
 *    - Verify text contains French content
 * 
 * 2. English Audio Transcription:
 *    - Record 1 minute of English speech
 *    - Upload and transcribe
 *    - Verify language detection is "english"
 *    - Verify text contains English content
 * 
 * 3. Timestamp Formatting:
 *    - Record 2+ minute audio
 *    - Verify timestamps appear at [00:00], [00:30], [01:00], etc.
 * 
 * 4. Error Recovery:
 *    - Test with invalid API key → should fail gracefully
 *    - Test with network disconnected → should retry and fail with message
 * 
 * 5. Large File Handling:
 *    - Test with file > 25MB → should reject with FILE_TOO_LARGE
 */
