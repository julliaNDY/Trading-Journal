/**
 * Data Source Tracker Tests
 * 
 * Tests for data source tracking and validation
 * 
 * @module services/ai/__tests__/data-source-tracker.test.ts
 * @created 2026-01-20
 * @story 12.10 - AI Citation Enforcement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DataSourceTracker,
  createSecurityTracker,
  createMacroTracker,
  validateSources
} from '../data-source-tracker';

describe('DataSourceTracker', () => {
  let tracker: DataSourceTracker;
  
  beforeEach(() => {
    tracker = new DataSourceTracker('test-analysis', 'NQ1');
  });
  
  describe('constructor', () => {
    it('should initialize with analysis step and instrument', () => {
      expect(tracker).toBeInstanceOf(DataSourceTracker);
      expect(tracker.toString()).toContain('test-analysis');
      expect(tracker.toString()).toContain('NQ1');
    });
  });
  
  describe('addAPI', () => {
    it('should add API source', () => {
      tracker.addAPI('CME Group API - Futures data');
      
      const sources = tracker.getSources();
      expect(sources).toContain('CME Group API - Futures data');
      expect(sources.length).toBe(1);
    });
    
    it('should add API source with metadata', () => {
      tracker.addAPI('TradingView API', { endpoint: '/quote', status: 200 });
      
      const detailed = tracker.getDetailedSources();
      expect(detailed[0].name).toBe('TradingView API');
      expect(detailed[0].type).toBe('api');
      expect(detailed[0].metadata).toEqual({ endpoint: '/quote', status: 200 });
    });
  });
  
  describe('addDatabase', () => {
    it('should add database source', () => {
      tracker.addDatabase('PostgreSQL - Historical prices');
      
      const sources = tracker.getSources();
      expect(sources).toContain('PostgreSQL - Historical prices');
    });
  });
  
  describe('addCalculation', () => {
    it('should add calculation source', () => {
      tracker.addCalculation('Volatility Index - Calculated from 24h range');
      
      const sources = tracker.getSources();
      expect(sources).toContain('Volatility Index - Calculated from 24h range');
      
      const byType = tracker.getSourcesByType('calculation');
      expect(byType.length).toBe(1);
    });
  });
  
  describe('addExternal', () => {
    it('should add external source', () => {
      tracker.addExternal('ForexFactory - Economic events');
      
      const sources = tracker.getSources();
      expect(sources).toContain('ForexFactory - Economic events');
    });
  });
  
  describe('getSources', () => {
    it('should return array of source names', () => {
      tracker.addAPI('Source 1');
      tracker.addCalculation('Source 2');
      tracker.addExternal('Source 3');
      
      const sources = tracker.getSources();
      expect(sources).toEqual(['Source 1', 'Source 2', 'Source 3']);
    });
  });
  
  describe('getDetailedSources', () => {
    it('should return array of DataSource objects', () => {
      tracker.addAPI('API Source');
      
      const detailed = tracker.getDetailedSources();
      expect(detailed[0].name).toBe('API Source');
      expect(detailed[0].type).toBe('api');
      expect(detailed[0].timestamp).toBeInstanceOf(Date);
    });
  });
  
  describe('getSummary', () => {
    it('should return summary with count and types', () => {
      tracker.addAPI('API 1');
      tracker.addCalculation('Calc 1');
      tracker.addExternal('Ext 1');
      
      const summary = tracker.getSummary();
      expect(summary.count).toBe(3);
      expect(summary.types).toContain('api');
      expect(summary.types).toContain('calculation');
      expect(summary.types).toContain('external');
      expect(summary.sources.length).toBe(3);
    });
  });
  
  describe('hasSource', () => {
    it('should return true if source exists', () => {
      tracker.addAPI('CME Group API');
      
      expect(tracker.hasSource('CME')).toBe(true);
      expect(tracker.hasSource('CME Group')).toBe(true);
      expect(tracker.hasSource('Bloomberg')).toBe(false);
    });
  });
  
  describe('getSourcesByType', () => {
    it('should filter sources by type', () => {
      tracker.addAPI('API 1');
      tracker.addAPI('API 2');
      tracker.addCalculation('Calc 1');
      
      const apiSources = tracker.getSourcesByType('api');
      expect(apiSources.length).toBe(2);
      expect(apiSources).toContain('API 1');
      expect(apiSources).toContain('API 2');
      
      const calcSources = tracker.getSourcesByType('calculation');
      expect(calcSources.length).toBe(1);
    });
  });
  
  describe('clear', () => {
    it('should remove all sources', () => {
      tracker.addAPI('Source 1');
      tracker.addAPI('Source 2');
      
      expect(tracker.getSources().length).toBe(2);
      
      tracker.clear();
      
      expect(tracker.getSources().length).toBe(0);
    });
  });
  
  describe('toJSON', () => {
    it('should export tracker data', () => {
      tracker.addAPI('API Source');
      
      const json = tracker.toJSON();
      expect(json.analysisStep).toBe('test-analysis');
      expect(json.instrument).toBe('NQ1');
      expect(json.sources.length).toBe(1);
      expect(json.summary.count).toBe(1);
    });
  });
});

describe('Factory Functions', () => {
  it('should create security tracker', () => {
    const tracker = createSecurityTracker('TSLA');
    expect(tracker.toString()).toContain('security-analysis');
    expect(tracker.toString()).toContain('TSLA');
  });
  
  it('should create macro tracker', () => {
    const tracker = createMacroTracker('EUR/USD');
    expect(tracker.toString()).toContain('macro-analysis');
    expect(tracker.toString()).toContain('EUR/USD');
  });
});

describe('validateSources', () => {
  it('should validate all sources against allowed list', () => {
    const sources = [
      'TradingView - Market data',
      'Yahoo Finance - Price quotes'
    ];
    const allowed = ['TradingView', 'Yahoo Finance'];
    
    const result = validateSources(sources, allowed);
    expect(result.valid).toBe(true);
    expect(result.validSources.length).toBe(2);
    expect(result.invalidSources.length).toBe(0);
  });
  
  it('should detect invalid sources', () => {
    const sources = [
      'TradingView - Market data',
      'FakeAPI - Invented data'
    ];
    const allowed = ['TradingView'];
    
    const result = validateSources(sources, allowed);
    expect(result.valid).toBe(false);
    expect(result.validSources.length).toBe(1);
    expect(result.invalidSources.length).toBe(1);
    expect(result.invalidSources[0]).toContain('FakeAPI');
  });
  
  it('should handle case-insensitive matching', () => {
    const sources = ['tradingview - data'];
    const allowed = ['TradingView'];
    
    const result = validateSources(sources, allowed);
    expect(result.valid).toBe(true);
  });
});
