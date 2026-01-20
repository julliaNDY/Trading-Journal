/**
 * Broker Name to BrokerType Mapping
 * Maps Broker.name (from database) to BrokerType enum (for BrokerConnection)
 * 
 * Story 3.9: Dynamic Broker Dropdown
 */

import { BrokerType } from '@prisma/client';

/**
 * Map Broker database name to BrokerType enum
 * This mapping is necessary because Broker (database model) and BrokerType (enum)
 * are separate entities that need to be connected.
 */
export function brokerNameToBrokerType(brokerName: string): BrokerType | null {
  // Normalize broker name for matching (lowercase, trim)
  const normalized = brokerName.toLowerCase().trim();
  
  // Mapping from Broker.name to BrokerType enum
  const mapping: Record<string, BrokerType> = {
    // Interactive Brokers
    'interactive brokers': 'IBKR',
    'interactive brokers (ibkr)': 'IBKR',
    'ibkr': 'IBKR',
    
    // Tradovate
    'tradovate': 'TRADOVATE',
    
    // Alpaca
    'alpaca': 'ALPACA',
    
    // OANDA
    'oanda': 'OANDA',
    'oanda corporation': 'OANDA',
    
    // TradeStation
    'tradestation': 'TRADESTATION',
    
    // TopstepX
    'topstepx': 'TOPSTEPX',
    'topstep x': 'TOPSTEPX',
    
    // Charles Schwab / TD Ameritrade
    'td ameritrade': 'TD_AMERITRADE',
    'td ameritrade / charles schwab': 'TD_AMERITRADE',
    'charles schwab': 'TD_AMERITRADE',
    
    // NinjaTrader
    'ninjatrader': 'NINJATRADER',
    
    // Apex Trader
    'apex trader': 'APEX_TRADER',
    'apex trader funding': 'APEX_TRADER',
    
    // Binance
    'binance': 'BINANCE',
    
    // AMP Futures
    'amp futures': 'AMP_FUTURES',
    
    // Other brokers that may be in database
    'thinkorswim': 'THINKORSWIM',
    'etrade': 'ETRADE',
    'robinhood': 'ROBINHOOD',
    'webull': 'WEBULL',
  };
  
  return mapping[normalized] || null;
}

/**
 * Check if a broker name can be mapped to a BrokerType
 */
export function isBrokerMappable(brokerName: string): boolean {
  return brokerNameToBrokerType(brokerName) !== null;
}

/**
 * Get all mappable BrokerType values
 */
export function getMappableBrokerTypes(): BrokerType[] {
  return [
    'IBKR',
    'TRADOVATE',
    'ALPACA',
    'OANDA',
    'TRADESTATION',
    'TOPSTEPX',
    'TD_AMERITRADE',
    'NINJATRADER',
    'APEX_TRADER',
    'BINANCE',
    'AMP_FUTURES',
    'THINKORSWIM',
    'ETRADE',
    'ROBINHOOD',
    'WEBULL',
  ];
}
