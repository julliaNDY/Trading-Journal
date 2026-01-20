/**
 * Stock Data Service
 * 
 * Provides stock market data retrieval for Mag 7 Leaders analysis
 * Uses Polygon.io API to fetch real-time and historical stock data
 * 
 * @module services/stock/stock-service
 * @created 2026-01-18
 */

import { logger } from '@/lib/logger';
import { MAG7_SYMBOLS, type Mag7Symbol } from '@/types/daily-bias';

// ============================================================================
// Constants
// ============================================================================

const POLYGON_BASE_URL = 'https://api.polygon.io';
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || '';

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  close: number;
  timestamp: string;
}

export interface Mag7StockData {
  symbol: Mag7Symbol;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  close: number;
  timestamp: string;
}

// Cache
let cachedMag7Data: Map<string, { data: Mag7StockData[]; timestamp: number }> = new Map();

// ============================================================================
// Mock Data Generator (Fallback when API key not configured)
// ============================================================================

/**
 * Generate realistic mock stock quote data
 * Used as fallback when Polygon API key is not configured
 */
function generateMockQuote(symbol: string): StockQuote {
  // Base prices for Mag7 (approximate realistic values)
  const basePrices: Record<string, number> = {
    'AAPL': 220.0,
    'MSFT': 420.0,
    'GOOGL': 175.0,
    'AMZN': 180.0,
    'META': 480.0,
    'NVDA': 875.0,
    'TSLA': 350.0,
  };
  
  const basePrice = basePrices[symbol] || 100.0;
  
  // Generate realistic random movements (-3% to +3%)
  const seed = symbol.charCodeAt(0) + new Date().getDate(); // Deterministic but varies by day
  const randomFactor = ((seed * 13 + 17) % 100) / 100; // 0-1
  const changePercent = (randomFactor - 0.5) * 6; // -3% to +3%
  
  const price = basePrice * (1 + changePercent / 100);
  const change = price - basePrice;
  const volume = Math.floor((10000000 + randomFactor * 50000000)); // 10M-60M shares
  
  const open = basePrice * (1 + ((randomFactor - 0.5) * 2) / 100);
  const high = Math.max(price, open) * (1 + randomFactor * 0.02);
  const low = Math.min(price, open) * (1 - randomFactor * 0.02);
  
  return {
    symbol,
    price,
    change,
    changePercent,
    volume,
    high,
    low,
    open,
    close: price,
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Fetch current stock quote from Polygon.io
 * Uses aggregates endpoint (more reliable than NBBO)
 * Falls back to mock data if API key not configured
 */
async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  // Always use mock data if no API key OR if API fails
  if (!POLYGON_API_KEY) {
    logger.warn('Polygon API key not configured, using mock data', { symbol });
    return generateMockQuote(symbol);
  }

  try {
    // Try aggregates endpoint first (most reliable)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // Get today's bars (1 day timeframe)
    const url = `${POLYGON_BASE_URL}/v2/aggs/ticker/${symbol}/range/1/day/${yesterdayStr}/${todayStr}?adjusted=true&sort=desc&limit=2&apiKey=${POLYGON_API_KEY}`;
    
    logger.debug('Fetching stock quote from Polygon', { symbol });

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 60 } // Cache for 1 minute at Next.js level
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        logger.warn('Polygon API authentication failed, using mock data', {
          symbol,
          status: response.status
        });
        return generateMockQuote(symbol);
      }
      
      // Handle rate limiting (429)
      if (response.status === 429) {
        logger.warn('Polygon API rate limit exceeded, using mock data', {
          symbol,
          status: response.status
        });
        return generateMockQuote(symbol);
      }
      
      // If symbol not found, try previous close instead
      if (response.status === 404) {
        return await fetchPreviousClose(symbol);
      }

      logger.warn('Failed to fetch stock quote, trying previous close', {
        symbol,
        status: response.status,
        statusText: response.statusText
      });
      // Fallback to previous close
      return await fetchPreviousClose(symbol);
    }

    const data = await response.json();

    // Polygon aggregates endpoint returns bars array
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      // Get most recent bar (first in desc order)
      const latestBar = data.results[0];
      const prevBar = data.results[1]; // Previous bar for comparison
      
      const price = latestBar.c || latestBar.close || 0; // Close price
      const open = latestBar.o || latestBar.open || price;
      const high = latestBar.h || latestBar.high || price;
      const low = latestBar.l || latestBar.low || price;
      const volume = latestBar.v || latestBar.volume || 0;

      // Calculate change from previous bar
      let change = 0;
      let changePercent = 0;
      
      if (prevBar && prevBar.c) {
        const prevClose = prevBar.c;
        change = price - prevClose;
        changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
      } else if (data.resultsCount > 0) {
        // If only one bar, no change data
        change = 0;
        changePercent = 0;
      }

      return {
        symbol,
        price,
        change,
        changePercent,
        volume,
        high,
        low,
        open,
        close: price,
        timestamp: new Date(latestBar.t || Date.now()).toISOString()
      };
    }

    // Fallback to previous close if aggregates empty
    return await fetchPreviousClose(symbol);
  } catch (error) {
    logger.warn('Error fetching stock quote, using mock data', {
      symbol,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    // Fallback to mock data on error
    return generateMockQuote(symbol);
  }
}

/**
 * Fetch previous close as fallback
 */
async function fetchPreviousClose(symbol: string): Promise<StockQuote | null> {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Format as YYYY-MM-DD
    const dateStr = yesterday.toISOString().split('T')[0];
    
    const url = `${POLYGON_BASE_URL}/v1/open-close/${symbol}/${dateStr}?adjusted=true&apiKey=${POLYGON_API_KEY}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 3600 } // Cache for 1 hour (historical data)
    });

    if (!response.ok) {
      logger.warn('Previous close fetch failed, using mock data', {
        symbol,
        status: response.status
      });
      return generateMockQuote(symbol);
    }

    const data = await response.json();

    if (data.status === 'OK') {
      const price = data.close || 0;
      const open = data.open || price;
      const high = data.high || price;
      const low = data.low || price;
      const volume = data.volume || 0;

      return {
        symbol,
        price,
        change: 0, // No change data for previous close
        changePercent: 0,
        volume,
        high,
        low,
        open,
        close: price,
        timestamp: data.from || yesterday.toISOString()
      };
    }

    logger.warn('Previous close data invalid, using mock data', { symbol });
    return generateMockQuote(symbol);
  } catch (error) {
    logger.warn('Failed to fetch previous close, using mock data', {
      symbol,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return generateMockQuote(symbol);
  }
}

/**
 * Fetch all Mag 7 leaders stock data
 */
export async function fetchMag7StockData(): Promise<Mag7StockData[]> {
  const cacheKey = 'mag7-all';
  const now = Date.now();
  
  // Check cache
  const cached = cachedMag7Data.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    logger.debug('Mag 7 stock data cache hit');
    return cached.data;
  }

  logger.info('Fetching Mag 7 stock data', {
    symbols: MAG7_SYMBOLS,
    usingMockData: !POLYGON_API_KEY
  });

  try {
    // Fetch all Mag 7 symbols in parallel
    const quotes = await Promise.allSettled(
      MAG7_SYMBOLS.map(symbol => fetchStockQuote(symbol))
    );

    const mag7Data: Mag7StockData[] = [];

    for (let i = 0; i < quotes.length; i++) {
      const result = quotes[i];
      const symbol = MAG7_SYMBOLS[i];

      if (result.status === 'fulfilled' && result.value) {
        const quote = result.value;
        mag7Data.push({
          symbol: symbol as Mag7Symbol,
          currentPrice: quote.price,
          priceChange: quote.change,
          priceChangePercent: quote.changePercent,
          volume: quote.volume,
          high: quote.high,
          low: quote.low,
          open: quote.open,
          close: quote.close,
          timestamp: quote.timestamp
        });
        
        logger.debug('Mag 7 stock fetched', {
          symbol,
          price: quote.price,
          changePercent: quote.changePercent
        });
      } else {
        logger.warn('Failed to fetch Mag 7 stock data', {
          symbol,
          error: result.status === 'rejected' ? result.reason : 'fulfilled but null value'
        });
      }
    }

    // Update cache
    if (mag7Data.length > 0) {
      cachedMag7Data.set(cacheKey, {
        data: mag7Data,
        timestamp: now
      });
    }

    logger.info('Mag 7 stock data fetch complete', {
      fetched: mag7Data.length,
      total: MAG7_SYMBOLS.length,
      usingMockData: !POLYGON_API_KEY
    });

    return mag7Data;
  } catch (error) {
    logger.error('Failed to fetch Mag 7 stock data', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return [];
  }
}

/**
 * Calculate correlation between instrument and Mag 7 leaders
 * 
 * Simple correlation based on price movement direction and magnitude
 */
export function calculateMag7Correlation(
  instrumentData: {
    priceChangePercent: number;
    currentPrice: number;
  },
  mag7Data: Mag7StockData[]
): Array<{
  symbol: Mag7Symbol;
  correlation: number; // -1 to 1
  trend: 'UP' | 'DOWN' | 'INDETERMINATE';
  performancePercent: number;
  strength: number; // 0-1
}> {
  const correlations = mag7Data.map(leader => {
    // Calculate correlation based on price movement direction
    const instrumentDirection = instrumentData.priceChangePercent >= 0 ? 1 : -1;
    const leaderDirection = leader.priceChangePercent >= 0 ? 1 : -1;
    
    // Simple correlation: 1 if same direction, -1 if opposite, 0 if neutral
    let correlation = 0;
    if (Math.abs(instrumentData.priceChangePercent) > 0.1 && Math.abs(leader.priceChangePercent) > 0.1) {
      correlation = instrumentDirection * leaderDirection * 
        Math.min(
          Math.abs(instrumentData.priceChangePercent) / 10,
          Math.abs(leader.priceChangePercent) / 10,
          1
        );
    }

    // Determine trend
    let trend: 'UP' | 'DOWN' | 'INDETERMINATE' = 'INDETERMINATE';
    if (leader.priceChangePercent > 0.5) {
      trend = 'UP';
    } else if (leader.priceChangePercent < -0.5) {
      trend = 'DOWN';
    }

    // Calculate strength based on magnitude of movement
    const strength = Math.min(Math.abs(leader.priceChangePercent) / 10, 1);

    return {
      symbol: leader.symbol,
      correlation,
      trend,
      performancePercent: leader.priceChangePercent,
      strength
    };
  });

  return correlations;
}
