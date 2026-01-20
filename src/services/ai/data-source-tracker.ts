/**
 * Data Source Tracker
 * 
 * Tracks all data sources accessed during AI analysis to prevent hallucination
 * and ensure citation accuracy.
 * 
 * @module services/ai/data-source-tracker
 * @created 2026-01-20
 * @story 12.10 - AI Citation Enforcement
 */

import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface DataSource {
  name: string; // e.g., "CME Group API"
  type: 'api' | 'database' | 'calculation' | 'external';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface DataSourceSummary {
  sources: string[]; // Human-readable source names
  count: number;
  types: string[];
  accessedAt: Date;
}

// ============================================================================
// DataSourceTracker Class
// ============================================================================

/**
 * Tracks all data sources accessed during an analysis step
 * 
 * Usage:
 * ```typescript
 * const tracker = new DataSourceTracker('security-analysis', 'NQ1');
 * tracker.addSource('CME Group API - Futures data');
 * tracker.addCalculation('Volatility Index - Calculated from 24h price range');
 * const sources = tracker.getSources();
 * ```
 */
export class DataSourceTracker {
  private sources: DataSource[] = [];
  private analysisStep: string;
  private instrument: string;
  private startTime: Date;
  
  constructor(analysisStep: string, instrument: string) {
    this.analysisStep = analysisStep;
    this.instrument = instrument;
    this.startTime = new Date();
    
    logger.debug('DataSourceTracker initialized', {
      analysisStep,
      instrument,
      timestamp: this.startTime.toISOString()
    });
  }
  
  /**
   * Add an API data source
   */
  addAPI(name: string, metadata?: Record<string, unknown>): void {
    this.sources.push({
      name,
      type: 'api',
      timestamp: new Date(),
      metadata
    });
    
    logger.debug('Data source added', {
      type: 'api',
      name,
      analysisStep: this.analysisStep,
      instrument: this.instrument
    });
  }
  
  /**
   * Add a database query source
   */
  addDatabase(name: string, metadata?: Record<string, unknown>): void {
    this.sources.push({
      name,
      type: 'database',
      timestamp: new Date(),
      metadata
    });
    
    logger.debug('Data source added', {
      type: 'database',
      name,
      analysisStep: this.analysisStep,
      instrument: this.instrument
    });
  }
  
  /**
   * Add a calculated/derived data source
   */
  addCalculation(name: string, metadata?: Record<string, unknown>): void {
    this.sources.push({
      name,
      type: 'calculation',
      timestamp: new Date(),
      metadata
    });
    
    logger.debug('Data source added', {
      type: 'calculation',
      name,
      analysisStep: this.analysisStep,
      instrument: this.instrument
    });
  }
  
  /**
   * Add an external data source
   */
  addExternal(name: string, metadata?: Record<string, unknown>): void {
    this.sources.push({
      name,
      type: 'external',
      timestamp: new Date(),
      metadata
    });
    
    logger.debug('Data source added', {
      type: 'external',
      name,
      analysisStep: this.analysisStep,
      instrument: this.instrument
    });
  }
  
  /**
   * Generic add source method
   */
  addSource(name: string, type: DataSource['type'] = 'external', metadata?: Record<string, unknown>): void {
    this.sources.push({
      name,
      type,
      timestamp: new Date(),
      metadata
    });
    
    logger.debug('Data source added', {
      type,
      name,
      analysisStep: this.analysisStep,
      instrument: this.instrument
    });
  }
  
  /**
   * Get all sources as string array (for AI prompt context)
   */
  getSources(): string[] {
    return this.sources.map(s => s.name);
  }
  
  /**
   * Get detailed source information
   */
  getDetailedSources(): DataSource[] {
    return [...this.sources];
  }
  
  /**
   * Get summary of data sources
   */
  getSummary(): DataSourceSummary {
    const uniqueTypes = [...new Set(this.sources.map(s => s.type))];
    
    return {
      sources: this.getSources(),
      count: this.sources.length,
      types: uniqueTypes,
      accessedAt: this.startTime
    };
  }
  
  /**
   * Check if a specific source was accessed
   */
  hasSource(name: string): boolean {
    return this.sources.some(s => s.name.includes(name));
  }
  
  /**
   * Get sources by type
   */
  getSourcesByType(type: DataSource['type']): string[] {
    return this.sources
      .filter(s => s.type === type)
      .map(s => s.name);
  }
  
  /**
   * Clear all sources (for testing)
   */
  clear(): void {
    this.sources = [];
    logger.debug('Data sources cleared', {
      analysisStep: this.analysisStep,
      instrument: this.instrument
    });
  }
  
  /**
   * Get formatted string for logging
   */
  toString(): string {
    return `DataSourceTracker [${this.analysisStep}/${this.instrument}]: ${this.sources.length} sources (${this.sources.map(s => s.type).join(', ')})`;
  }
  
  /**
   * Export for database storage
   */
  toJSON(): {
    analysisStep: string;
    instrument: string;
    sources: DataSource[];
    summary: DataSourceSummary;
  } {
    return {
      analysisStep: this.analysisStep,
      instrument: this.instrument,
      sources: this.getDetailedSources(),
      summary: this.getSummary()
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a tracker for Security Analysis
 */
export function createSecurityTracker(instrument: string): DataSourceTracker {
  return new DataSourceTracker('security-analysis', instrument);
}

/**
 * Create a tracker for Macro Analysis
 */
export function createMacroTracker(instrument: string): DataSourceTracker {
  return new DataSourceTracker('macro-analysis', instrument);
}

/**
 * Create a tracker for Institutional Flux
 */
export function createFluxTracker(instrument: string): DataSourceTracker {
  return new DataSourceTracker('institutional-flux', instrument);
}

/**
 * Create a tracker for Mag7 Analysis
 */
export function createMag7Tracker(instrument: string): DataSourceTracker {
  return new DataSourceTracker('mag7-analysis', instrument);
}

/**
 * Create a tracker for Technical Analysis
 */
export function createTechnicalTracker(instrument: string): DataSourceTracker {
  return new DataSourceTracker('technical-analysis', instrument);
}

/**
 * Validate that all sources are legitimate (not hallucinated)
 */
export function validateSources(sources: string[], allowedSources: string[]): {
  valid: boolean;
  invalidSources: string[];
  validSources: string[];
} {
  const invalidSources: string[] = [];
  const validSources: string[] = [];
  
  for (const source of sources) {
    const isValid = allowedSources.some(allowed => 
      source.toLowerCase().includes(allowed.toLowerCase())
    );
    
    if (isValid) {
      validSources.push(source);
    } else {
      invalidSources.push(source);
    }
  }
  
  return {
    valid: invalidSources.length === 0,
    invalidSources,
    validSources
  };
}
