import { describe, it, expect } from '@jest/globals';
import { buildExecutionLabel, buildExecutionTooltip, EXECUTION_STYLES } from '../execution-markers';
import { ExecutionMarker } from '@/lib/types/execution';

describe('execution-markers', () => {
  describe('EXECUTION_STYLES', () => {
    it('should have valid hex colors for buy', () => {
      expect(EXECUTION_STYLES.buy.arrowColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(EXECUTION_STYLES.buy.textColor).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should have valid hex colors for sell', () => {
      expect(EXECUTION_STYLES.sell.arrowColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(EXECUTION_STYLES.sell.textColor).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });

  describe('buildExecutionLabel', () => {
    it('should format label without PnL', () => {
      const marker: ExecutionMarker = {
        id: 'test-1',
        symbol: 'MES',
        time: 1706092800,
        price: 5435.25,
        side: 'buy',
      };

      const label = buildExecutionLabel(marker);
      expect(label).toBe('Entry @ 5435.25');
    });

    it('should format label with positive PnL', () => {
      const marker: ExecutionMarker = {
        id: 'test-2',
        symbol: 'MES',
        time: 1706092800,
        price: 5450.50,
        side: 'sell',
        pnlUsd: 150.50,
      };

      const label = buildExecutionLabel(marker);
      expect(label).toBe('Exit @ 5450.50 (+150.5)');
    });

    it('should format label with negative PnL', () => {
      const marker: ExecutionMarker = {
        id: 'test-3',
        symbol: 'MES',
        time: 1706092800,
        price: 5420.00,
        side: 'sell',
        pnlUsd: -75.25,
      };

      const label = buildExecutionLabel(marker);
      expect(label).toBe('Exit @ 5420.00 (-75.25)');
    });

    it('should use custom text if provided', () => {
      const marker: ExecutionMarker = {
        id: 'test-4',
        symbol: 'MES',
        time: 1706092800,
        price: 5435.25,
        side: 'buy',
        text: 'Custom Entry',
      };

      const label = buildExecutionLabel(marker);
      expect(label).toBe('Custom Entry @ 5435.25');
    });

    it('should handle zero PnL', () => {
      const marker: ExecutionMarker = {
        id: 'test-5',
        symbol: 'MES',
        time: 1706092800,
        price: 5435.25,
        side: 'sell',
        pnlUsd: 0,
      };

      const label = buildExecutionLabel(marker);
      expect(label).toBe('Exit @ 5435.25 (+0)');
    });
  });

  describe('buildExecutionTooltip', () => {
    it('should format basic tooltip', () => {
      const marker: ExecutionMarker = {
        id: 'test-1',
        symbol: 'MES',
        time: 1706092800,
        price: 5435.25,
        side: 'buy',
        qty: 1,
      };

      const tooltip = buildExecutionTooltip(marker);
      expect(tooltip).toContain('BUY: 1 @ 5435.25');
      expect(tooltip).toContain('Time:');
    });

    it('should include PnL when provided', () => {
      const marker: ExecutionMarker = {
        id: 'test-2',
        symbol: 'MES',
        time: 1706092800,
        price: 5450.50,
        side: 'sell',
        qty: 2,
        pnlUsd: 150.50,
      };

      const tooltip = buildExecutionTooltip(marker);
      expect(tooltip).toContain('SELL: 2 @ 5450.50');
      expect(tooltip).toContain('P&L: +150.50 USD');
    });

    it('should include R:R when provided', () => {
      const marker: ExecutionMarker = {
        id: 'test-3',
        symbol: 'MES',
        time: 1706092800,
        price: 5450.50,
        side: 'sell',
        qty: 1,
        pnlUsd: 150.50,
        riskRewardRatio: 2.5,
      };

      const tooltip = buildExecutionTooltip(marker);
      expect(tooltip).toContain('R:R: 2.50');
    });

    it('should handle missing qty', () => {
      const marker: ExecutionMarker = {
        id: 'test-4',
        symbol: 'MES',
        time: 1706092800,
        price: 5435.25,
        side: 'buy',
      };

      const tooltip = buildExecutionTooltip(marker);
      expect(tooltip).toContain('BUY: ? @ 5435.25');
    });

    it('should format negative PnL correctly', () => {
      const marker: ExecutionMarker = {
        id: 'test-5',
        symbol: 'MES',
        time: 1706092800,
        price: 5420.00,
        side: 'sell',
        qty: 1,
        pnlUsd: -75.25,
      };

      const tooltip = buildExecutionTooltip(marker);
      expect(tooltip).toContain('P&L: -75.25 USD');
    });

    it('should be multi-line', () => {
      const marker: ExecutionMarker = {
        id: 'test-6',
        symbol: 'MES',
        time: 1706092800,
        price: 5450.50,
        side: 'sell',
        qty: 1,
        pnlUsd: 150.50,
        riskRewardRatio: 2.5,
      };

      const tooltip = buildExecutionTooltip(marker);
      const lines = tooltip.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(4);
    });
  });
});
