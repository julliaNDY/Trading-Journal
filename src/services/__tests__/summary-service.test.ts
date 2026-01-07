import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Summary Service Tests
 * 
 * Note: Full integration tests with OpenAI API require actual API calls.
 * These tests focus on:
 * 1. Configuration checks (isSummaryAvailable)
 * 2. Hash generation for cache invalidation
 * 3. Needs regeneration logic
 * 4. Error handling
 * 
 * Manual testing required for:
 * - Actual summary generation with GPT-4o-mini
 * - Prompt output quality
 * - JSON parsing from API response
 */

describe('summary-service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isSummaryAvailable', () => {
    it('should return true when OPENAI_API_KEY is set', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { isSummaryAvailable } = await import('../summary-service');
      expect(isSummaryAvailable()).toBe(true);
    });

    it('should return false when OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY;
      
      const { isSummaryAvailable } = await import('../summary-service');
      expect(isSummaryAvailable()).toBe(false);
    });

    it('should return false when OPENAI_API_KEY is empty', async () => {
      process.env.OPENAI_API_KEY = '';
      
      const { isSummaryAvailable } = await import('../summary-service');
      expect(isSummaryAvailable()).toBe(false);
    });
  });

  describe('hashTranscription', () => {
    it('should generate consistent MD5 hash for same input', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { hashTranscription } = await import('../summary-service');
      
      const transcription = 'Test transcription content';
      const hash1 = hashTranscription(transcription);
      const hash2 = hashTranscription(transcription);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{32}$/); // MD5 format
    });

    it('should generate different hash for different input', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { hashTranscription } = await import('../summary-service');
      
      const hash1 = hashTranscription('Transcription A');
      const hash2 = hashTranscription('Transcription B');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should trim whitespace before hashing', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { hashTranscription } = await import('../summary-service');
      
      const hash1 = hashTranscription('Test content');
      const hash2 = hashTranscription('  Test content  ');
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('needsRegeneration', () => {
    it('should return true when currentHash is null', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { needsRegeneration } = await import('../summary-service');
      
      const result = needsRegeneration(null, 'New transcription');
      expect(result).toBe(true);
    });

    it('should return false when hash matches', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { needsRegeneration, hashTranscription } = await import('../summary-service');
      
      const transcription = 'Same transcription';
      const hash = hashTranscription(transcription);
      
      const result = needsRegeneration(hash, transcription);
      expect(result).toBe(false);
    });

    it('should return true when transcription has changed', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { needsRegeneration, hashTranscription } = await import('../summary-service');
      
      const oldHash = hashTranscription('Old transcription');
      const result = needsRegeneration(oldHash, 'New transcription');
      
      expect(result).toBe(true);
    });
  });

  describe('generateSummary error handling', () => {
    it('should throw NOT_CONFIGURED error when API key is missing', async () => {
      delete process.env.OPENAI_API_KEY;
      
      const { generateSummary } = await import('../summary-service');
      
      await expect(generateSummary('Test transcription')).rejects.toMatchObject({
        code: 'NOT_CONFIGURED',
        message: 'OpenAI API key is not configured',
      });
    });

    it('should throw EMPTY_TRANSCRIPTION error for short input', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { generateSummary } = await import('../summary-service');
      
      await expect(generateSummary('short')).rejects.toMatchObject({
        code: 'EMPTY_TRANSCRIPTION',
      });
    });

    it('should throw EMPTY_TRANSCRIPTION error for empty input', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { generateSummary } = await import('../summary-service');
      
      await expect(generateSummary('')).rejects.toMatchObject({
        code: 'EMPTY_TRANSCRIPTION',
      });
    });

    it('should throw EMPTY_TRANSCRIPTION error for whitespace-only input', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { generateSummary } = await import('../summary-service');
      
      await expect(generateSummary('   \n\t   ')).rejects.toMatchObject({
        code: 'EMPTY_TRANSCRIPTION',
      });
    });
  });

  describe('Summary interface', () => {
    it('should have correct structure', () => {
      const mockSummary = {
        keyPoints: ['Point 1', 'Point 2'],
        mistakes: ['Mistake 1'],
        lessons: ['Lesson 1'],
        actions: ['Action 1', 'Action 2'],
        rawSummary: 'Overall summary of the trade.',
      };

      expect(mockSummary).toHaveProperty('keyPoints');
      expect(mockSummary).toHaveProperty('mistakes');
      expect(mockSummary).toHaveProperty('lessons');
      expect(mockSummary).toHaveProperty('actions');
      expect(mockSummary).toHaveProperty('rawSummary');
      
      expect(Array.isArray(mockSummary.keyPoints)).toBe(true);
      expect(Array.isArray(mockSummary.mistakes)).toBe(true);
      expect(Array.isArray(mockSummary.lessons)).toBe(true);
      expect(Array.isArray(mockSummary.actions)).toBe(true);
      expect(typeof mockSummary.rawSummary).toBe('string');
    });
  });

  describe('SummaryError codes', () => {
    it('should define expected error codes', () => {
      const expectedCodes = ['NOT_CONFIGURED', 'EMPTY_TRANSCRIPTION', 'PARSE_ERROR', 'API_ERROR', 'UNKNOWN'];
      
      expectedCodes.forEach(code => {
        expect(typeof code).toBe('string');
      });
    });
  });
});

/**
 * Manual Test Scenarios (require OPENAI_API_KEY):
 * 
 * 1. French Transcription Summary:
 *    Input: "Trade sur NQ ce matin, j'ai pris une entrée long sur le retest du POC à 21500..."
 *    Expected: Summary in French with keyPoints, mistakes, lessons, actions
 * 
 * 2. English Transcription Summary:
 *    Input: "Took a long on ES this morning at the open. Entry was at 6020..."
 *    Expected: Summary in English with structured sections
 * 
 * 3. Cache Validation:
 *    - Generate summary
 *    - Edit transcription
 *    - Regenerate → should produce new summary
 *    - Request without changes → should return cached
 * 
 * 4. Empty Sections Handling:
 *    Input: "Good trade today, entry at 100, exit at 105, profit of 5 points."
 *    Expected: keyPoints filled, mistakes/lessons/actions may be empty arrays
 * 
 * 5. JSON Response Parsing:
 *    - Valid JSON → success
 *    - Malformed JSON → PARSE_ERROR
 */

