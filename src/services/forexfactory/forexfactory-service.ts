/**
 * ForexFactory Economic Calendar Service
 * 
 * Fetches and parses economic calendar events from ForexFactory XML feed
 * 
 * @module services/forexfactory/forexfactory-service
 * @created 2026-01-18
 */

import { XMLParser } from 'fast-xml-parser';
import { logger } from '@/lib/logger';
import type { EconomicEvent } from '@/lib/prompts/macro-analysis-prompt';

// ============================================================================
// Constants
// ============================================================================

const FOREXFACTORY_XML_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

// ============================================================================
// Types
// ============================================================================

interface ForexFactoryXmlEvent {
  title: string;
  country: string;
  date: string;
  time: string;
  impact: 'high' | 'medium' | 'low' | 'holiday';
  forecast?: string;
  previous?: string;
  actual?: string;
  description?: string;
}

interface ForexFactoryXml {
  weeklyevents: {
    event?: ForexFactoryXmlEvent | ForexFactoryXmlEvent[];
  };
}

// ============================================================================
// Service Functions
// ============================================================================

let cachedEvents: EconomicEvent[] | null = null;
let cacheTimestamp: number = 0;

/**
 * Fetch economic events from ForexFactory XML feed
 */
export async function fetchForexFactoryEvents(): Promise<EconomicEvent[]> {
  // Check cache first
  const now = Date.now();
  if (cachedEvents && (now - cacheTimestamp) < CACHE_TTL_MS) {
    logger.debug('ForexFactory events cache hit', {
      eventCount: cachedEvents.length,
      ageMs: now - cacheTimestamp
    });
    return cachedEvents;
  }

  try {
    logger.info('Fetching ForexFactory economic calendar', {
      url: FOREXFACTORY_XML_URL
    });

    // Fetch XML
    const response = await fetch(FOREXFACTORY_XML_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradingJournal/1.0)'
      },
      next: { revalidate: 300 } // Cache for 5 minutes at Next.js level
    });

    if (!response.ok) {
      throw new Error(`ForexFactory API returned ${response.status}: ${response.statusText}`);
    }

    const xmlText = await response.text();
    
    // Parse XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      trimValues: true
    });

    const parsed = parser.parse(xmlText) as ForexFactoryXml;
    
    // Extract events
    const rawEvents = parsed.weeklyevents?.event;
    if (!rawEvents) {
      logger.warn('No events found in ForexFactory XML');
      return [];
    }

    // Normalize to array (XML parser may return single object or array)
    const eventsArray = Array.isArray(rawEvents) ? rawEvents : [rawEvents];

    // Transform to our EconomicEvent format
    const events: EconomicEvent[] = eventsArray
      .filter(event => event.impact !== 'holiday') // Filter out holidays
      .map(event => transformForexFactoryEvent(event))
      .filter(event => event !== null) as EconomicEvent[];

    // Update cache
    cachedEvents = events;
    cacheTimestamp = now;

    logger.info('ForexFactory events fetched successfully', {
      eventCount: events.length,
      highImpactCount: events.filter(e => e.impact === 'high').length
    });

    return events;
  } catch (error) {
    logger.error('Failed to fetch ForexFactory events', {
      error: error instanceof Error ? error.message : 'Unknown error',
      url: FOREXFACTORY_XML_URL
    });

    // Return cached events if available (even if stale)
    if (cachedEvents) {
      logger.warn('Returning stale cache due to fetch error');
      return cachedEvents;
    }

    // Return empty array if no cache available
    return [];
  }
}

/**
 * Filter events by date range (next 24-48 hours)
 */
export function filterEventsByDateRange(
  events: EconomicEvent[],
  startDate: Date = new Date(),
  hoursAhead: number = 48
): EconomicEvent[] {
  const endDate = new Date(startDate.getTime() + hoursAhead * 60 * 60 * 1000);

  return events.filter(event => {
    try {
      const eventDate = parseEventTime(event.time);
      return eventDate >= startDate && eventDate <= endDate;
    } catch (error) {
      logger.warn('Failed to parse event time', {
        eventTime: event.time,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  });
}

/**
 * Filter events by importance (high, medium, low)
 */
export function filterEventsByImportance(
  events: EconomicEvent[],
  minImportance: 'high' | 'medium' | 'low' = 'medium'
): EconomicEvent[] {
  const importanceOrder = { high: 3, medium: 2, low: 1 };
  const minLevel = importanceOrder[minImportance];

  return events.filter(event => {
    const eventLevel = importanceOrder[event.impact] || 0;
    return eventLevel >= minLevel;
  });
}

/**
 * Get events relevant to an instrument
 * 
 * For equity indices (NQ1, ES1, SPY): Focus on USD events
 * For forex pairs (EUR/USD): Focus on both currencies
 * For gold (XAU/USD): Focus on USD events + inflation data
 */
export function filterEventsByInstrument(
  events: EconomicEvent[],
  instrument: string
): EconomicEvent[] {
  // Extract currency/instrument type
  const upperInstrument = instrument.toUpperCase();

  // Equity indices - focus on USD events
  if (upperInstrument.includes('NQ1') || upperInstrument.includes('ES1') || 
      upperInstrument.includes('SPY') || upperInstrument.includes('QQQ') ||
      upperInstrument.includes('TQQQ') || upperInstrument.includes('SQQQ')) {
    return events.filter(e => e.country === 'USD' || e.category === 'Central Bank');
  }

  // Tech stocks - focus on USD + interest rates
  if (['TSLA', 'NVDA', 'AAPL', 'AMD', 'MSFT', 'META', 'AMZN', 'GOOGL'].includes(upperInstrument)) {
    return events.filter(e => 
      e.country === 'USD' || 
      e.category === 'Central Bank' ||
      e.category === 'Interest Rates'
    );
  }

  // Forex pairs
  if (upperInstrument.includes('EUR') && upperInstrument.includes('USD')) {
    return events.filter(e => e.country === 'USD' || e.country === 'EUR');
  }
  if (upperInstrument.includes('GBP') && upperInstrument.includes('USD')) {
    return events.filter(e => e.country === 'USD' || e.country === 'GBP');
  }

  // Gold
  if (upperInstrument.includes('XAU') || upperInstrument.includes('GOLD')) {
    return events.filter(e => 
      e.country === 'USD' || 
      e.category === 'Inflation' ||
      e.category === 'Central Bank'
    );
  }

  // Crypto - focus on USD macro events
  if (upperInstrument.includes('BTC') || upperInstrument.includes('COIN')) {
    return events.filter(e => 
      e.country === 'USD' || 
      e.category === 'Central Bank' ||
      e.category === 'Inflation'
    );
  }

  // Default: return all high-impact events
  return filterEventsByImportance(events, 'high');
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Transform ForexFactory XML event to our EconomicEvent format
 */
function transformForexFactoryEvent(xmlEvent: ForexFactoryXmlEvent): EconomicEvent | null {
  try {
    // Parse date and time
    const eventDateTime = parseForexFactoryDateTime(xmlEvent.date, xmlEvent.time);
    
    // Determine category from title
    const category = determineCategory(xmlEvent.title);
    
    // Parse numeric values (forecast, previous, actual)
    const forecast = parseNumericValue(xmlEvent.forecast);
    const previous = parseNumericValue(xmlEvent.previous);
    const actual = parseNumericValue(xmlEvent.actual);

    return {
      title: xmlEvent.title.trim(),
      country: xmlEvent.country.toUpperCase(),
      impact: xmlEvent.impact === 'high' ? 'high' : 
               xmlEvent.impact === 'medium' ? 'medium' : 'low',
      forecast: forecast !== null ? forecast : undefined,
      previous: previous !== null ? previous : undefined,
      actual: actual !== null ? actual : undefined,
      time: eventDateTime.toISOString(),
      category
    };
  } catch (error) {
    logger.warn('Failed to transform ForexFactory event', {
      title: xmlEvent.title,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

/**
 * Parse ForexFactory date and time to ISO datetime
 * Format: "2026-01-18" and "13:30" or "1:30pm"
 */
function parseForexFactoryDateTime(dateStr: string, timeStr: string): Date {
  try {
    // Parse date (YYYY-MM-DD)
    const [year, month, day] = dateStr.split('-').map(Number);
    
    // Parse time (HH:MM or HH:MMam/pm)
    let hours = 0;
    let minutes = 0;
    
    const timeLower = timeStr.toLowerCase().trim();
    const hasAmPm = timeLower.includes('am') || timeLower.includes('pm');
    
    if (hasAmPm) {
      const match = timeLower.match(/(\d+):(\d+)(am|pm)/);
      if (match) {
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2], 10);
        const period = match[3];
        
        if (period === 'pm' && hours !== 12) {
          hours += 12;
        } else if (period === 'am' && hours === 12) {
          hours = 0;
        }
      }
    } else {
      const [h, m] = timeStr.split(':').map(Number);
      hours = h || 0;
      minutes = m || 0;
    }
    
    // Create UTC date (ForexFactory times are in EST/EDT)
    // Note: We'll assume EST (UTC-5) for now, could be improved with timezone detection
    const date = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    
    // Adjust for EST (UTC-5)
    date.setHours(date.getHours() - 5);
    
    return date;
  } catch (error) {
    throw new Error(`Failed to parse date/time: ${dateStr} ${timeStr}`);
  }
}

/**
 * Parse event time string (ISO or other formats) to Date
 */
function parseEventTime(timeStr: string): Date {
  try {
    return new Date(timeStr);
  } catch (error) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }
}

/**
 * Determine event category from title
 */
function determineCategory(title: string): string {
  const titleLower = title.toLowerCase();
  
  // GDP
  if (titleLower.includes('gdp') || titleLower.includes('gross domestic product')) {
    return 'GDP';
  }
  
  // Inflation
  if (titleLower.includes('cpi') || titleLower.includes('ppi') || 
      titleLower.includes('inflation') || titleLower.includes('pce')) {
    return 'Inflation';
  }
  
  // Employment
  if (titleLower.includes('nfp') || titleLower.includes('non-farm payrolls') ||
      titleLower.includes('unemployment') || titleLower.includes('jobless claims') ||
      titleLower.includes('employment')) {
    return 'Employment';
  }
  
  // Central Bank
  if (titleLower.includes('fomc') || titleLower.includes('fed') ||
      titleLower.includes('ecb') || titleLower.includes('boe') ||
      titleLower.includes('central bank') || titleLower.includes('rate decision')) {
    return 'Central Bank';
  }
  
  // Interest Rates
  if (titleLower.includes('interest rate') || titleLower.includes('policy rate')) {
    return 'Interest Rates';
  }
  
  // Retail Sales
  if (titleLower.includes('retail sales')) {
    return 'Retail Sales';
  }
  
  // Manufacturing
  if (titleLower.includes('manufacturing') || titleLower.includes('pmi')) {
    return 'Manufacturing';
  }
  
  // Default
  return 'Other';
}

/**
 * Parse numeric value from string (handles percentages, currency, etc.)
 */
function parseNumericValue(value: string | undefined): number | null {
  if (!value || value.trim() === '' || value.toLowerCase() === 'null') {
    return null;
  }
  
  try {
    // Remove currency symbols, commas, percentage signs
    const cleaned = value
      .replace(/[$€£¥,]/g, '')
      .replace(/%/g, '')
      .trim();
    
    // Try to parse as float
    const parsed = parseFloat(cleaned);
    
    if (isNaN(parsed)) {
      return null;
    }
    
    return parsed;
  } catch (error) {
    return null;
  }
}
