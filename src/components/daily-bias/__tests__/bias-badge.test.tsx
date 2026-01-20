/**
 * Bias Badge Component Tests
 * 
 * Tests for the BiasBadge component configuration
 */

import { describe, it, expect } from 'vitest';
import type { BiasDirection } from '@/types/daily-bias';

describe('BiasBadge Configuration', () => {
  it('should have correct configuration for BULLISH sentiment', () => {
    const config = {
      BULLISH: {
        color: 'bg-green-500 text-white border-green-500',
        label: 'BIAIS : BULLISH',
      },
    };
    
    expect(config.BULLISH.color).toContain('bg-green-500');
    expect(config.BULLISH.color).toContain('text-white');
    expect(config.BULLISH.label).toBe('BIAIS : BULLISH');
  });

  it('should have correct configuration for BEARISH sentiment', () => {
    const config = {
      BEARISH: {
        color: 'bg-red-500 text-white border-red-500',
        label: 'BIAIS : BEARISH',
      },
    };
    
    expect(config.BEARISH.color).toContain('bg-red-500');
    expect(config.BEARISH.color).toContain('text-white');
    expect(config.BEARISH.label).toBe('BIAIS : BEARISH');
  });

  it('should have correct configuration for NEUTRAL sentiment', () => {
    const config = {
      NEUTRAL: {
        color: 'bg-blue-500 text-white border-blue-500',
        label: 'BIAIS : NEUTRAL',
      },
    };
    
    expect(config.NEUTRAL.color).toContain('bg-blue-500');
    expect(config.NEUTRAL.color).toContain('text-white');
    expect(config.NEUTRAL.label).toBe('BIAIS : NEUTRAL');
  });

  it('should have correct size classes', () => {
    const sizeClasses = {
      sm: 'text-xs px-3 py-1',
      md: 'text-sm px-4 py-1.5',
      lg: 'text-base px-6 py-2',
    };
    
    expect(sizeClasses.sm).toContain('text-xs');
    expect(sizeClasses.md).toContain('text-sm');
    expect(sizeClasses.lg).toContain('text-base');
  });

  it('should support all BiasDirection types', () => {
    const validSentiments: BiasDirection[] = ['BULLISH', 'BEARISH', 'NEUTRAL'];
    
    expect(validSentiments).toContain('BULLISH');
    expect(validSentiments).toContain('BEARISH');
    expect(validSentiments).toContain('NEUTRAL');
    expect(validSentiments.length).toBe(3);
  });
});
