import { describe, it, expect } from 'vitest';
import {
  findDateTimes,
  extractPrices,
  extractQuantity,
  extractPnL,
  extractDrawdown,
  extractRunup,
  extractDrawdownRunup,
  isHeaderLine,
  parseOcrText,
  parseOcrDateTime,
  getPriceRange,
} from '../ocr-service';

describe('ocr-service', () => {
  describe('getPriceRange', () => {
    it('returns NQ range for NQ symbol', () => {
      const range = getPriceRange('NQ');
      expect(range.min).toBe(10000);
      expect(range.max).toBe(50000);
    });

    it('returns NQ range for MNQ symbol', () => {
      const range = getPriceRange('MNQ');
      expect(range.min).toBe(10000);
      expect(range.max).toBe(50000);
    });

    it('returns ES range for ES symbol', () => {
      const range = getPriceRange('ES');
      expect(range.min).toBe(2000);
      expect(range.max).toBe(10000);
    });

    it('handles symbol with suffix', () => {
      const range = getPriceRange('MNQ MAR25');
      expect(range.min).toBe(10000);
      expect(range.max).toBe(50000);
    });

    it('returns default range for unknown symbol', () => {
      const range = getPriceRange('UNKNOWN');
      expect(range.min).toBe(0.001);
      expect(range.max).toBe(1000000);
    });

    it('returns default range for undefined', () => {
      const range = getPriceRange(undefined);
      expect(range.min).toBe(0.001);
      expect(range.max).toBe(1000000);
    });
  });

  describe('findDateTimes', () => {
    it('finds date/time with AM/PM', () => {
      const result = findDateTimes('12/30/2025 10:09:48 AM some text');
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('12/30/2025 10:09:48 AM');
    });

    it('finds date/time without AM/PM (24h)', () => {
      const result = findDateTimes('12/30/2025 14:30:15 some text');
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('12/30/2025 14:30:15');
    });

    it('finds multiple date/times in one line', () => {
      const result = findDateTimes('12/30/2025 10:09:48 AM 12/30/2025 10:12:05 AM');
      expect(result).toHaveLength(2);
    });

    it('handles date/time without space (OCR glued)', () => {
      const result = findDateTimes('12/30/202510:09:48');
      expect(result).toHaveLength(1);
    });

    it('returns empty array for no matches', () => {
      const result = findDateTimes('no dates here');
      expect(result).toHaveLength(0);
    });

    it('deduplicates identical date/times', () => {
      const result = findDateTimes('12/30/2025 10:09:48 AM 12/30/2025 10:09:48 AM');
      expect(result).toHaveLength(1);
    });
  });

  describe('extractPrices', () => {
    const nqRange = { min: 10000, max: 50000 };

    it('extracts price with decimal', () => {
      const result = extractPrices('25717.25 some text', nqRange);
      expect(result).toContain(25717.25);
    });

    it('extracts price with comma decimal (European)', () => {
      const result = extractPrices('25717,25 some text', nqRange);
      expect(result).toContain(25717.25);
    });

    it('extracts whole number price', () => {
      const result = extractPrices('25699 some text', nqRange);
      expect(result).toContain(25699);
    });

    it('handles OCR error with missing decimal (6 digits)', () => {
      // 257745 should become 25774.5
      const result = extractPrices('257745 some text', nqRange);
      expect(result).toContain(25774.5);
    });

    it('extracts multiple prices', () => {
      const result = extractPrices('25717.25 to 25773.50', nqRange);
      expect(result).toHaveLength(2);
      expect(result).toContain(25717.25);
      expect(result).toContain(25773.5);
    });

    it('filters out prices outside range', () => {
      const result = extractPrices('1234.56 25717.25 99999.99', nqRange);
      expect(result).toHaveLength(1);
      expect(result).toContain(25717.25);
    });

    it('deduplicates identical prices', () => {
      const result = extractPrices('Entry: 25717.25 Exit: 25717.25', nqRange);
      // Note: le premier 25717.25 est capturé, le deuxième aussi mais dédupliqué
      // Le "25717" pourrait être capturé séparément mais on vérifie la déduplication du décimal
      expect(result.filter(p => p === 25717.25)).toHaveLength(1);
    });
  });

  describe('extractQuantity', () => {
    it('extracts positive quantity', () => {
      expect(extractQuantity('text +2 more')).toBe(2);
    });

    it('extracts negative quantity as positive', () => {
      expect(extractQuantity('text -3 more')).toBe(3);
    });

    it('extracts quantity at end of string', () => {
      expect(extractQuantity('some text +1')).toBe(1);
    });

    it('returns 1 when no quantity found', () => {
      expect(extractQuantity('no quantity here')).toBe(1);
    });

    it('handles multi-digit quantity', () => {
      expect(extractQuantity('text +12 more')).toBe(12);
    });
  });

  describe('extractPnL', () => {
    it('extracts positive PnL with $', () => {
      expect(extractPnL('125,50 $')).toBe(125.5);
    });

    it('extracts negative PnL with $', () => {
      expect(extractPnL('-500,00 $')).toBe(-500);
    });

    it('extracts PnL with decimal point', () => {
      expect(extractPnL('125.50$')).toBe(125.5);
    });

    it('extracts PnL with € symbol', () => {
      expect(extractPnL('125,50 €')).toBe(125.5);
    });

    it('extracts whole number PnL', () => {
      expect(extractPnL('500 $')).toBe(500);
    });

    it('returns 0 when no PnL found', () => {
      expect(extractPnL('no pnl here')).toBe(0);
    });
  });

  describe('extractDrawdown', () => {
    it('extracts DD with label and dollar sign', () => {
      expect(extractDrawdown('DD: 50.00$')).toBe(50);
    });

    it('extracts DD with label and comma decimal (EU format)', () => {
      expect(extractDrawdown('Drawdown: 50,00 €')).toBe(50);
    });

    it('extracts DD from negative format with label (returns positive)', () => {
      expect(extractDrawdown('DD: -50.00')).toBe(50);
    });

    it('extracts DD from parentheses format with label', () => {
      expect(extractDrawdown('Drawdown: ($50.00)')).toBe(50);
    });

    it('extracts DD with Draw-down variant', () => {
      expect(extractDrawdown('Draw-down: 75,50 €')).toBe(75.5);
    });

    it('returns null when no DD label found', () => {
      expect(extractDrawdown('no drawdown here')).toBeNull();
    });

    it('extracts DD from line with money value', () => {
      // Simulate a line with multiple money values - DD extracts first match
      expect(extractDrawdown('125.50$')).toBe(125.5);
    });
  });

  describe('extractRunup', () => {
    it('extracts RU with label and dollar sign', () => {
      expect(extractRunup('RU: 175.00$')).toBe(175);
    });

    it('extracts RU with label and comma decimal (EU format)', () => {
      expect(extractRunup('Runup: 175,00 €')).toBe(175);
    });

    it('extracts RU with MFE label', () => {
      expect(extractRunup('MFE: 200,25')).toBe(200.25);
    });

    it('returns null when no RU label found', () => {
      expect(extractRunup('no runup here')).toBeNull();
    });

    it('extracts RU from line with money value', () => {
      expect(extractRunup('175.00$')).toBe(175);
    });
  });

  describe('extractDrawdownRunup', () => {
    it('extracts both DD and RU from typical line', () => {
      // Line format: ... PnL DD RU
      const line = '12/30/2025 10:09:48 25717.25 12/30/2025 10:12:05 25773.50 +1 125,50$ 50,00$ 175,00$';
      const result = extractDrawdownRunup(line);
      expect(result.drawdown).toBe(50);
      expect(result.runup).toBe(175);
    });

    it('returns undefined for both when only PnL present', () => {
      const line = '12/30/2025 10:09:48 25717.25 12/30/2025 10:12:05 25773.50 +1 125,50$';
      const result = extractDrawdownRunup(line);
      expect(result.drawdown).toBeUndefined();
      expect(result.runup).toBeUndefined();
    });

    it('handles US format with spaces', () => {
      const line = 'trade data 100.00 $ 25.00 $ 150.00 $';
      const result = extractDrawdownRunup(line);
      expect(result.drawdown).toBe(25);
      expect(result.runup).toBe(150);
    });
  });

  describe('isHeaderLine', () => {
    it('detects "Entry DT" header', () => {
      expect(isHeaderLine('Entry DT Entry Price Exit DT')).toBe(true);
    });

    it('detects "Profit Loss" header', () => {
      expect(isHeaderLine('Profit Loss column')).toBe(true);
    });

    it('detects "Drawdown" header', () => {
      expect(isHeaderLine('Drawdown Runup')).toBe(true);
    });

    it('detects "Run-up" header variant', () => {
      expect(isHeaderLine('Profit Loss Run-up')).toBe(true);
    });

    it('detects "MAE/MFE" header variant', () => {
      expect(isHeaderLine('P/L MAE MFE')).toBe(true);
    });

    it('returns false for data lines', () => {
      expect(isHeaderLine('12/30/2025 10:09:48 AM 25717.25')).toBe(false);
    });

    it('is case insensitive', () => {
      expect(isHeaderLine('ENTRY DT')).toBe(true);
      expect(isHeaderLine('entry dt')).toBe(true);
    });
  });

  describe('parseOcrDateTime', () => {
    it('parses date with AM', () => {
      const date = parseOcrDateTime('12/30/2025 10:09:48 AM');
      expect(date).not.toBeNull();
      expect(date?.getMonth()).toBe(11); // December = 11
      expect(date?.getDate()).toBe(30);
      expect(date?.getFullYear()).toBe(2025);
      expect(date?.getHours()).toBe(10);
      expect(date?.getMinutes()).toBe(9);
      expect(date?.getSeconds()).toBe(48);
    });

    it('parses date with PM', () => {
      const date = parseOcrDateTime('12/30/2025 2:30:00 PM');
      expect(date).not.toBeNull();
      expect(date?.getHours()).toBe(14); // 2 PM = 14
    });

    it('handles 12 PM correctly', () => {
      const date = parseOcrDateTime('12/30/2025 12:00:00 PM');
      expect(date?.getHours()).toBe(12);
    });

    it('handles 12 AM correctly (midnight)', () => {
      const date = parseOcrDateTime('12/30/2025 12:00:00 AM');
      expect(date?.getHours()).toBe(0);
    });

    it('parses 24h format', () => {
      const date = parseOcrDateTime('12/30/2025 14:30:15');
      expect(date).not.toBeNull();
      expect(date?.getHours()).toBe(14);
    });

    it('returns null for invalid format', () => {
      expect(parseOcrDateTime('invalid')).toBeNull();
      expect(parseOcrDateTime('')).toBeNull();
    });
  });

  describe('parseOcrText', () => {
    it('parses a simple trade line', () => {
      const text = `
        Entry DT Entry Price Exit DT Exit Price Profit Loss
        12/30/2025 10:09:48 AM 25717.25 12/30/2025 10:12:05 AM 25773.50 125,50 $
      `;
      const result = parseOcrText(text, 'MNQ');
      
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].entryPrice).toBe(25717.25);
      expect(result.trades[0].exitPrice).toBe(25773.5);
      expect(result.trades[0].profitLoss).toBe(125.5);
    });

    it('skips header lines', () => {
      const text = `
        Entry DT Entry Price Exit DT Exit Price Profit Loss
        Total: 5 trades
      `;
      const result = parseOcrText(text, 'MNQ');
      expect(result.trades).toHaveLength(0);
    });

    it('handles multiple trades', () => {
      const text = `
        12/30/2025 10:09:48 AM 25717.25 12/30/2025 10:12:05 AM 25773.50 125,50 $
        12/30/2025 10:30:00 AM 25800.00 12/30/2025 10:35:00 AM 25780.00 -50,00 $
      `;
      const result = parseOcrText(text, 'MNQ');
      expect(result.trades).toHaveLength(2);
    });

    it('consolidates partial exits', () => {
      const text = `
        12/30/2025 10:09:48 AM 25717.25 12/30/2025 10:12:05 AM 25750.00 +1 50,00 $
        12/30/2025 10:15:00 AM 25773.50 +1 75,50 $
      `;
      const result = parseOcrText(text, 'MNQ');
      
      // Should consolidate into 1 trade with partial exits
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].partialExits).toBeDefined();
      expect(result.trades[0].partialExits?.length).toBe(2);
      expect(result.trades[0].profitLoss).toBe(125.5); // 50 + 75.5
    });

    it('returns warnings for problematic lines', () => {
      const text = `
        12/30/2025 10:09:48 AM 12/30/2025 10:12:05 AM 125,50 $
      `;
      const result = parseOcrText(text, 'MNQ');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('sorts trades by entry time', () => {
      const text = `
        12/30/2025 14:00:00 25800.00 12/30/2025 14:05:00 25820.00 50,00 $
        12/30/2025 10:00:00 25700.00 12/30/2025 10:05:00 25720.00 50,00 $
      `;
      const result = parseOcrText(text, 'MNQ');
      
      expect(result.trades).toHaveLength(2);
      // First trade should be the one at 10:00
      expect(result.trades[0].entryPrice).toBe(25700);
    });

    it('parses trade with DD and RU columns', () => {
      const text = `
        Entry DT Entry Price Exit DT Exit Price Profit Loss Drawdown Runup
        12/30/2025 10:09:48 AM 25717.25 12/30/2025 10:12:05 AM 25773.50 125,50$ 50,00$ 175,00$
      `;
      const result = parseOcrText(text, 'MNQ');
      
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].drawdown).toBe(50);
      expect(result.trades[0].runup).toBe(175);
    });

    it('handles missing DD/RU gracefully', () => {
      const text = `
        12/30/2025 10:09:48 AM 25717.25 12/30/2025 10:12:05 AM 25773.50 125,50$
      `;
      const result = parseOcrText(text, 'MNQ');
      
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].drawdown).toBeUndefined();
      expect(result.trades[0].runup).toBeUndefined();
    });

    it('uses max DD/RU for partial exits', () => {
      const text = `
        12/30/2025 10:09:48 AM 25717.25 12/30/2025 10:12:05 AM 25750.00 +1 50,00$ 25,00$ 100,00$
        12/30/2025 10:15:00 AM 25773.50 +1 75,50$ 40,00$ 125,00$
      `;
      const result = parseOcrText(text, 'MNQ');
      
      // Should consolidate into 1 trade with max DD/RU
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].drawdown).toBe(40); // Max of 25 and 40
      expect(result.trades[0].runup).toBe(125);   // Max of 100 and 125
    });

    it('handles EU format DD/RU', () => {
      const text = `
        12/30/2025 10:09:48 25717.25 12/30/2025 10:12:05 25773.50 125,50 € 50,00 € 175,00 €
      `;
      const result = parseOcrText(text, 'MNQ');
      
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].drawdown).toBe(50);
      expect(result.trades[0].runup).toBe(175);
    });
  });
});

