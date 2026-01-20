/**
 * Response Validator Tests
 * 
 * Tests for AI response validation and hallucination detection
 * 
 * @module services/ai/__tests__/response-validator.test.ts
 * @created 2026-01-20
 * @story 12.10 - AI Citation Enforcement
 */

import { describe, it, expect } from 'vitest';
import {
  validateAIResponse,
  validateCitations,
  extractJSON,
  generateRetryPrompt,
  shouldRetry,
  HALLUCINATION_PATTERNS
} from '../response-validator';

describe('Response Validator', () => {
  describe('validateAIResponse', () => {
    it('should pass valid response without hallucinations', () => {
      const response = JSON.stringify({
        volatilityIndex: 65,
        riskLevel: 'HIGH',
        confidence: 85,
        reasoning: 'Based on the provided data, volatility is elevated due to 24h price range of 5.2%'
      });
      
      const result = validateAIResponse(response, ['provided data', 'market data']);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.confidence).toBeGreaterThan(0.8);
    });
    
    it('should detect invented URLs', () => {
      const response = `{
        "reasoning": "According to https://fake-api.com/data, the market is volatile"
      }`;
      
      const result = validateAIResponse(response, ['provided data']);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('URLs');
    });
    
    it('should detect fake API references', () => {
      const response = `{
        "reasoning": "According to Bloomberg API, volatility is high"
      }`;
      
      const result = validateAIResponse(response, ['provided data']);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('API');
    });
    
    it('should detect unverified data claims', () => {
      const response = `{
        "reasoning": "Data from Reuters shows strong volatility"
      }`;
      
      const result = validateAIResponse(response, ['provided data']);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    it('should allow mentions of provided data', () => {
      const response = `{
        "reasoning": "Based on the data provided, volatility is 65%"
      }`;
      
      const result = validateAIResponse(response, ['provided data']);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reduce confidence for warnings', () => {
      const response = `{
        "reasoning": "Based on recent news, volatility will increase"
      }`;
      
      const result = validateAIResponse(response, ['provided data']);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThan(1.0);
    });
    
    it('should detect malformed JSON', () => {
      const response = `{"incomplete": "json"`;
      
      const result = validateAIResponse(response, ['provided data']);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('JSON'))).toBe(true);
    });
    
    it('should warn on suspiciously short responses', () => {
      const response = '{"ok": true}';
      
      const result = validateAIResponse(response, ['provided data']);
      
      expect(result.warnings.some(w => w.includes('short'))).toBe(true);
    });
  });
  
  describe('validateCitations', () => {
    it('should validate allowed citations', () => {
      const response = 'According to the provided market data, price is $100';
      const allowedSources = ['market data', 'provided data'];
      
      const result = validateCitations(response, allowedSources);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject unverified citations', () => {
      const response = 'According to Bloomberg Terminal, price is $100';
      const allowedSources = ['provided data'];
      
      const result = validateCitations(response, allowedSources);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Bloomberg');
    });
    
    it('should extract cited sources', () => {
      const response = 'According to TradingView data and based on Yahoo Finance, price is volatile';
      const allowedSources = ['TradingView', 'Yahoo Finance'];
      
      const result = validateCitations(response, allowedSources);
      
      expect(result.citedSources.length).toBeGreaterThan(0);
    });
  });
  
  describe('extractJSON', () => {
    it('should extract JSON from markdown code blocks', () => {
      const response = '```json\n{"key": "value"}\n```';
      
      const result = extractJSON(response);
      
      expect(result).toBe('{"key": "value"}');
    });
    
    it('should extract JSON from text with extra content', () => {
      const response = 'Here is the analysis: {"volatility": 65} End of analysis';
      
      const result = extractJSON(response);
      
      expect(result).toBe('{"volatility": 65}');
    });
    
    it('should handle plain JSON', () => {
      const response = '{"volatility": 65}';
      
      const result = extractJSON(response);
      
      expect(result).toBe('{"volatility": 65}');
    });
  });
  
  describe('generateRetryPrompt', () => {
    it('should generate retry prompt with error summary', () => {
      const originalPrompt = 'Analyze volatility for NQ1';
      const errors = ['AI invented URLs', 'AI cited unverified source'];
      
      const retryPrompt = generateRetryPrompt(originalPrompt, errors);
      
      expect(retryPrompt).toContain('CRITICAL');
      expect(retryPrompt).toContain('invented URLs');
      expect(retryPrompt).toContain('unverified source');
      expect(retryPrompt).toContain(originalPrompt);
    });
  });
  
  describe('shouldRetry', () => {
    it('should retry if errors exist and attempts left', () => {
      const validation = {
        valid: false,
        errors: ['AI invented URL'],
        warnings: [],
        confidence: 0.7
      };
      
      expect(shouldRetry(validation, 1, 2)).toBe(true);
    });
    
    it('should not retry if max attempts reached', () => {
      const validation = {
        valid: false,
        errors: ['AI invented URL'],
        warnings: [],
        confidence: 0.7
      };
      
      expect(shouldRetry(validation, 2, 2)).toBe(false);
    });
    
    it('should retry if confidence very low', () => {
      const validation = {
        valid: true,
        errors: [],
        warnings: ['Low quality'],
        confidence: 0.4
      };
      
      expect(shouldRetry(validation, 1, 2)).toBe(true);
    });
    
    it('should not retry if too many errors', () => {
      const validation = {
        valid: false,
        errors: ['error1', 'error2', 'error3', 'error4', 'error5'],
        warnings: [],
        confidence: 0.5
      };
      
      expect(shouldRetry(validation, 1, 2)).toBe(false);
    });
  });
  
  describe('HALLUCINATION_PATTERNS', () => {
    it('should detect all hallucination patterns', () => {
      expect(HALLUCINATION_PATTERNS.length).toBeGreaterThan(5);
      
      // Check each pattern has required fields
      for (const pattern of HALLUCINATION_PATTERNS) {
        expect(pattern.pattern).toBeInstanceOf(RegExp);
        expect(['error', 'warning']).toContain(pattern.severity);
        expect(pattern.message).toBeTruthy();
      }
    });
  });
});
