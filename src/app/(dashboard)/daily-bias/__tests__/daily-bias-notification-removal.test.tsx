/**
 * Test: Story 12.14 - Remove Analysis Complete Notification
 * 
 * Structural tests to verify:
 * 1. Success notification banner code is removed
 * 2. CheckCircle2 import is removed
 * 3. Cached/Live badges code is preserved
 * 4. Layout structure remains intact
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const COMPONENT_PATH = join(__dirname, '../daily-bias-content.tsx');

describe('Story 12.14: Notification Removal - Code Structure', () => {
  let componentCode: string;

  beforeEach(() => {
    componentCode = readFileSync(COMPONENT_PATH, 'utf-8');
  });

  it('should NOT contain "Analysis Complete!" text in component', () => {
    expect(componentCode).not.toContain('Analysis Complete!');
  });

  it('should NOT import CheckCircle2 icon', () => {
    expect(componentCode).not.toContain('CheckCircle2');
  });

  it('should NOT have green success Alert banner', () => {
    expect(componentCode).not.toContain('border-green-500/20');
    expect(componentCode).not.toContain('bg-green-500/5');
  });

  it('should preserve Alert and AlertDescription imports for error messages', () => {
    expect(componentCode).toContain("import { Alert, AlertDescription } from '@/components/ui/alert'");
  });
});

describe('Story 12.14: Preserved Elements - Code Structure', () => {
  let componentCode: string;

  beforeEach(() => {
    componentCode = readFileSync(COMPONENT_PATH, 'utf-8');
  });

  it('should preserve Cached badge rendering logic', () => {
    expect(componentCode).toContain('analysis.cacheHit');
    expect(componentCode).toContain('Cached');
  });

  it('should preserve Live connection badge', () => {
    expect(componentCode).toContain('realtime.isConnected');
    expect(componentCode).toContain('Live');
    expect(componentCode).toContain('Wifi');
  });

  it('should preserve Polling badge', () => {
    expect(componentCode).toContain('realtime.isPolling');
    expect(componentCode).toContain('Polling');
    expect(componentCode).toContain('WifiOff');
  });

  it('should preserve Last update timestamp', () => {
    expect(componentCode).toContain('realtime.lastUpdate');
    expect(componentCode).toContain('toLocaleTimeString()');
  });

  it('should have metadata section with proper alignment', () => {
    expect(componentCode).toContain('flex items-center justify-end gap-2');
  });
});

describe('Story 12.14: Layout Integrity - Code Structure', () => {
  let componentCode: string;

  beforeEach(() => {
    componentCode = readFileSync(COMPONENT_PATH, 'utf-8');
  });

  it('should maintain space-y-6 on analysis container', () => {
    expect(componentCode).toContain('space-y-6');
  });

  it('should have Analysis Metadata comment for badges section', () => {
    expect(componentCode).toContain('Analysis Metadata');
  });
});
