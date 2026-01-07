/**
 * IBKR Flex Query Provider
 * 
 * Implementation of the BrokerProvider interface for Interactive Brokers
 * using the Flex Query Web Service.
 * 
 * How Flex Query works:
 * 1. User creates a "Trade Confirmation Flex Query" in IBKR Account Management
 * 2. User gets a Query ID and configures a Flex Web Service Token
 * 3. Our app calls the Flex Web Service API to fetch trade data
 * 
 * API Flow:
 * Step 1: SendRequest - Request report generation (returns referenceCode)
 * Step 2: GetStatement - Download the XML report using referenceCode
 * 
 * Documentation:
 * - Flex Web Service Guide: https://www.interactivebrokers.com/en/software/am/am/reports/flex_web_service_version_3.htm
 */

import { BrokerType, Direction } from '@prisma/client';
import {
  BrokerProvider,
  BrokerCredentials,
  BrokerAccount,
  BrokerTrade,
  AuthResult,
  BrokerAuthError,
  BrokerApiError,
} from './types';

// ============================================================================
// IBKR FLEX QUERY TYPES
// ============================================================================

export interface IBKRFlexQueryCredentials extends BrokerCredentials {
  // apiKey = Flex Web Service Token
  // apiSecret = Query ID
}

interface FlexQueryResponse {
  Status?: string;
  ReferenceCode?: string;
  Url?: string;
  ErrorCode?: string;
  ErrorMessage?: string;
}

interface FlexTradeConfirmation {
  // Trade identification
  tradeID: string;
  ibOrderID?: string;
  ibExecID?: string;
  
  // Account info
  accountId: string;
  acctAlias?: string;
  
  // Symbol info
  symbol: string;
  underlyingSymbol?: string;
  description?: string;
  assetCategory: string; // STK, OPT, FUT, etc.
  currency: string;
  
  // Trade details
  buySell: 'BUY' | 'SELL';
  quantity: string;
  tradePrice: string;
  tradeMoney?: string;
  proceeds?: string;
  netCash?: string;
  
  // Dates
  tradeDate: string;      // YYYYMMDD
  tradeTime?: string;     // HHMMSS
  settleDateTarget?: string;
  dateTime?: string;      // YYYYMMDD;HHMMSS or ISO format
  
  // P&L
  fifoPnlRealized?: string;
  mtmPnl?: string;
  
  // Costs
  ibCommission?: string;
  ibCommissionCurrency?: string;
  taxes?: string;
  
  // Position info
  openCloseIndicator?: 'O' | 'C' | '';  // Open, Close, or empty
  
  // Exchange
  exchange?: string;
  
  // Multiplier for options/futures
  multiplier?: string;
}

interface FlexStatement {
  FlexStatements?: {
    FlexStatement?: {
      $?: {
        accountId?: string;
        fromDate?: string;
        toDate?: string;
      };
      TradeConfirms?: {
        TradeConfirm?: FlexTradeConfirmation[] | FlexTradeConfirmation;
      };
      Trades?: {
        Trade?: FlexTradeConfirmation[] | FlexTradeConfirmation;
      };
    };
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FLEX_SERVICE_URL = 'https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService';

// Retry settings for report generation
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 2000;

// ============================================================================
// IBKR FLEX QUERY PROVIDER
// ============================================================================

export class IBKRFlexQueryProvider implements BrokerProvider {
  readonly brokerType = BrokerType.IBKR;
  
  private token: string = '';
  private queryId: string = '';
  private accountId: string = '';
  
  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================
  
  async authenticate(credentials: BrokerCredentials): Promise<AuthResult> {
    this.token = credentials.apiKey;     // Flex Web Service Token
    this.queryId = credentials.apiSecret; // Query ID
    
    if (!this.token || !this.queryId) {
      throw new BrokerAuthError('IBKR Flex Query requires both Token and Query ID');
    }
    
    // Validate by making a test request
    try {
      const referenceCode = await this.requestFlexStatement();
      
      // If we got a reference code, credentials are valid
      // We don't need to fetch the full statement for validation
      return {
        accessToken: `${this.token}:${this.queryId}`, // Combined for storage
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Flex tokens don't expire
      };
    } catch (error) {
      if (error instanceof BrokerAuthError || error instanceof BrokerApiError) {
        throw error;
      }
      throw new BrokerAuthError(
        `Failed to validate IBKR credentials: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  // ==========================================================================
  // ACCOUNTS
  // ==========================================================================
  
  async getAccounts(accessToken: string): Promise<BrokerAccount[]> {
    // Parse token and queryId from accessToken
    const [token, queryId] = accessToken.split(':');
    this.token = token;
    this.queryId = queryId;
    
    try {
      // Fetch a statement to get account info
      const statement = await this.fetchFlexStatement();
      
      const accounts: BrokerAccount[] = [];
      const flexStatement = statement.FlexStatements?.FlexStatement;
      
      if (flexStatement) {
        const accountId = flexStatement.$?.accountId || 'IBKR_ACCOUNT';
        this.accountId = accountId;
        
        accounts.push({
          id: accountId,
          name: accountId,
          currency: 'USD', // Will be determined from trades
        });
      }
      
      if (accounts.length === 0) {
        // Return a placeholder - the actual account will be determined from trades
        accounts.push({
          id: 'IBKR_FLEX_ACCOUNT',
          name: 'IBKR Account (via Flex Query)',
          currency: 'USD',
        });
      }
      
      return accounts;
    } catch (error) {
      // If we can't fetch accounts, return a placeholder
      // The actual account will be extracted from trades
      return [{
        id: 'IBKR_FLEX_ACCOUNT',
        name: 'IBKR Account (via Flex Query)',
        currency: 'USD',
      }];
    }
  }
  
  // ==========================================================================
  // TRADES
  // ==========================================================================
  
  async getTrades(
    accessToken: string,
    accountId: string,
    since?: Date
  ): Promise<BrokerTrade[]> {
    // Parse token and queryId from accessToken
    const [token, queryId] = accessToken.split(':');
    this.token = token;
    this.queryId = queryId;
    this.accountId = accountId;
    
    const statement = await this.fetchFlexStatement();
    const trades: BrokerTrade[] = [];
    
    const flexStatement = statement.FlexStatements?.FlexStatement;
    if (!flexStatement) {
      return trades;
    }
    
    // Extract trades from TradeConfirms or Trades section
    const tradeConfirms = flexStatement.TradeConfirms?.TradeConfirm || 
                          flexStatement.Trades?.Trade;
    
    if (!tradeConfirms) {
      return trades;
    }
    
    // Ensure array
    const tradeList = Array.isArray(tradeConfirms) ? tradeConfirms : [tradeConfirms];
    
    // Group trades by symbol and aggregate to create full trades
    const aggregatedTrades = this.aggregateTradesToRoundTrips(tradeList, since);
    
    return aggregatedTrades;
  }
  
  // ==========================================================================
  // FLEX QUERY API
  // ==========================================================================
  
  private async requestFlexStatement(): Promise<string> {
    const url = `${FLEX_SERVICE_URL}.SendRequest?t=${encodeURIComponent(this.token)}&q=${encodeURIComponent(this.queryId)}&v=3`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/xml',
      },
    });
    
    if (!response.ok) {
      throw new BrokerApiError(
        `IBKR Flex Query request failed: ${response.statusText}`,
        response.status
      );
    }
    
    const xmlText = await response.text();
    const parsed = this.parseSimpleXml<FlexQueryResponse>(xmlText, 'FlexStatementResponse');
    
    if (parsed.ErrorCode) {
      if (parsed.ErrorCode === '1018' || parsed.ErrorCode === '1019') {
        throw new BrokerAuthError(`Invalid IBKR credentials: ${parsed.ErrorMessage}`);
      }
      throw new BrokerApiError(`IBKR Flex Query error: ${parsed.ErrorMessage}`, undefined, parsed.ErrorCode);
    }
    
    if (!parsed.ReferenceCode) {
      throw new BrokerApiError('IBKR Flex Query did not return a reference code');
    }
    
    return parsed.ReferenceCode;
  }
  
  private async getFlexStatementResult(referenceCode: string): Promise<string> {
    const url = `${FLEX_SERVICE_URL}.GetStatement?q=${encodeURIComponent(referenceCode)}&t=${encodeURIComponent(this.token)}&v=3`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/xml',
      },
    });
    
    if (!response.ok) {
      throw new BrokerApiError(
        `IBKR Flex Query result failed: ${response.statusText}`,
        response.status
      );
    }
    
    return response.text();
  }
  
  private async fetchFlexStatement(): Promise<FlexStatement> {
    // Step 1: Request the statement
    const referenceCode = await this.requestFlexStatement();
    
    // Step 2: Poll for the result
    let attempts = 0;
    while (attempts < MAX_RETRIES) {
      await this.sleep(RETRY_DELAY_MS);
      
      const xmlText = await this.getFlexStatementResult(referenceCode);
      
      // Check if it's still processing
      if (xmlText.includes('<Status>')) {
        const statusMatch = xmlText.match(/<Status>(\w+)<\/Status>/);
        if (statusMatch && statusMatch[1] === 'Warn') {
          // Still processing
          attempts++;
          continue;
        }
      }
      
      // Check for errors
      if (xmlText.includes('<ErrorCode>')) {
        const parsed = this.parseSimpleXml<FlexQueryResponse>(xmlText, 'FlexStatementResponse');
        if (parsed.ErrorCode === '1019') {
          // Statement generation in progress
          attempts++;
          continue;
        }
        throw new BrokerApiError(`IBKR Flex Query error: ${parsed.ErrorMessage}`, undefined, parsed.ErrorCode);
      }
      
      // Parse the statement
      return this.parseFlexStatement(xmlText);
    }
    
    throw new BrokerApiError('IBKR Flex Query timed out waiting for statement');
  }
  
  // ==========================================================================
  // XML PARSING
  // ==========================================================================
  
  private parseSimpleXml<T>(xmlText: string, rootElement: string): T {
    const result: Record<string, string> = {};
    
    // Simple regex-based XML parsing for flat structures
    const regex = /<(\w+)>([^<]*)<\/\1>/g;
    let match;
    
    while ((match = regex.exec(xmlText)) !== null) {
      result[match[1]] = match[2];
    }
    
    return result as T;
  }
  
  private parseFlexStatement(xmlText: string): FlexStatement {
    const statement: FlexStatement = {
      FlexStatements: {
        FlexStatement: {
          TradeConfirms: {
            TradeConfirm: [],
          },
        },
      },
    };
    
    // Extract account ID
    const accountMatch = xmlText.match(/accountId="([^"]+)"/);
    if (accountMatch && statement.FlexStatements?.FlexStatement) {
      statement.FlexStatements.FlexStatement.$ = {
        accountId: accountMatch[1],
      };
      this.accountId = accountMatch[1];
    }
    
    // Extract trade confirmations
    const trades: FlexTradeConfirmation[] = [];
    
    // Match TradeConfirm or Trade elements
    const tradeRegex = /<(?:TradeConfirm|Trade)\s+([^>]+)\/?>(?:<\/(?:TradeConfirm|Trade)>)?/g;
    let tradeMatch;
    
    while ((tradeMatch = tradeRegex.exec(xmlText)) !== null) {
      const trade = this.parseTradeAttributes(tradeMatch[1]);
      if (trade.symbol && trade.quantity) {
        trades.push(trade);
      }
    }
    
    if (statement.FlexStatements?.FlexStatement?.TradeConfirms) {
      statement.FlexStatements.FlexStatement.TradeConfirms.TradeConfirm = trades;
    }
    
    return statement;
  }
  
  private parseTradeAttributes(attributeString: string): FlexTradeConfirmation {
    const trade: Partial<FlexTradeConfirmation> = {};
    
    // Parse attributes like key="value"
    const attrRegex = /(\w+)="([^"]*)"/g;
    let attrMatch;
    
    while ((attrMatch = attrRegex.exec(attributeString)) !== null) {
      const key = attrMatch[1];
      const value = attrMatch[2];
      
      // Map to our interface
      switch (key) {
        case 'tradeID':
          trade.tradeID = value;
          break;
        case 'ibOrderID':
          trade.ibOrderID = value;
          break;
        case 'ibExecID':
          trade.ibExecID = value;
          break;
        case 'accountId':
          trade.accountId = value;
          break;
        case 'symbol':
          trade.symbol = value;
          break;
        case 'underlyingSymbol':
          trade.underlyingSymbol = value;
          break;
        case 'description':
          trade.description = value;
          break;
        case 'assetCategory':
          trade.assetCategory = value;
          break;
        case 'currency':
          trade.currency = value;
          break;
        case 'buySell':
          trade.buySell = value as 'BUY' | 'SELL';
          break;
        case 'quantity':
          trade.quantity = value;
          break;
        case 'tradePrice':
          trade.tradePrice = value;
          break;
        case 'tradeMoney':
          trade.tradeMoney = value;
          break;
        case 'proceeds':
          trade.proceeds = value;
          break;
        case 'netCash':
          trade.netCash = value;
          break;
        case 'tradeDate':
          trade.tradeDate = value;
          break;
        case 'tradeTime':
          trade.tradeTime = value;
          break;
        case 'dateTime':
          trade.dateTime = value;
          break;
        case 'fifoPnlRealized':
          trade.fifoPnlRealized = value;
          break;
        case 'mtmPnl':
          trade.mtmPnl = value;
          break;
        case 'ibCommission':
          trade.ibCommission = value;
          break;
        case 'taxes':
          trade.taxes = value;
          break;
        case 'openCloseIndicator':
          trade.openCloseIndicator = value as 'O' | 'C' | '';
          break;
        case 'exchange':
          trade.exchange = value;
          break;
        case 'multiplier':
          trade.multiplier = value;
          break;
      }
    }
    
    return trade as FlexTradeConfirmation;
  }
  
  // ==========================================================================
  // TRADE AGGREGATION
  // ==========================================================================
  
  private aggregateTradesToRoundTrips(
    tradeList: FlexTradeConfirmation[],
    since?: Date
  ): BrokerTrade[] {
    const trades: BrokerTrade[] = [];
    
    // Group by symbol
    const tradesBySymbol = new Map<string, FlexTradeConfirmation[]>();
    
    for (const trade of tradeList) {
      const symbol = trade.underlyingSymbol || trade.symbol;
      if (!symbol) continue;
      
      // Filter by date if specified
      if (since) {
        const tradeDate = this.parseIBKRDate(trade.tradeDate, trade.tradeTime);
        if (tradeDate < since) continue;
      }
      
      const existing = tradesBySymbol.get(symbol) || [];
      existing.push(trade);
      tradesBySymbol.set(symbol, existing);
    }
    
    // Process each symbol's trades
    for (const [symbol, symbolTrades] of tradesBySymbol) {
      // Sort by date/time
      symbolTrades.sort((a, b) => {
        const dateA = this.parseIBKRDate(a.tradeDate, a.tradeTime);
        const dateB = this.parseIBKRDate(b.tradeDate, b.tradeTime);
        return dateA.getTime() - dateB.getTime();
      });
      
      // Track position
      let position = 0;
      let entryTrades: FlexTradeConfirmation[] = [];
      
      for (const trade of symbolTrades) {
        const qty = parseFloat(trade.quantity || '0');
        const signedQty = trade.buySell === 'BUY' ? qty : -qty;
        const previousPosition = position;
        position += signedQty;
        
        // Determine if opening or closing
        const isOpening = 
          trade.openCloseIndicator === 'O' ||
          (previousPosition === 0) ||
          (previousPosition > 0 && signedQty > 0) ||
          (previousPosition < 0 && signedQty < 0);
        
        const isClosing = 
          trade.openCloseIndicator === 'C' ||
          (previousPosition > 0 && signedQty < 0) ||
          (previousPosition < 0 && signedQty > 0);
        
        if (isOpening && !isClosing) {
          entryTrades.push(trade);
        } else if (isClosing && entryTrades.length > 0) {
          // Create a round-trip trade
          const brokerTrade = this.createRoundTripTrade(symbol, entryTrades, trade);
          if (brokerTrade) {
            trades.push(brokerTrade);
          }
          
          // Clear entries if position is flat
          if (Math.abs(position) < 0.0001) {
            entryTrades = [];
          }
        }
      }
    }
    
    return trades;
  }
  
  private createRoundTripTrade(
    symbol: string,
    entryTrades: FlexTradeConfirmation[],
    exitTrade: FlexTradeConfirmation
  ): BrokerTrade | null {
    if (entryTrades.length === 0) return null;
    
    const firstEntry = entryTrades[0];
    const multiplier = parseFloat(firstEntry.multiplier || '1');
    
    // Calculate weighted average entry price
    let totalQty = 0;
    let totalCost = 0;
    
    for (const entry of entryTrades) {
      const qty = Math.abs(parseFloat(entry.quantity || '0'));
      const price = parseFloat(entry.tradePrice || '0');
      totalQty += qty;
      totalCost += qty * price;
    }
    
    const entryPrice = totalCost / totalQty;
    const exitPrice = parseFloat(exitTrade.tradePrice || '0');
    const exitQty = Math.abs(parseFloat(exitTrade.quantity || '0'));
    const quantity = Math.min(totalQty, exitQty);
    
    // Determine direction
    const direction: Direction = firstEntry.buySell === 'BUY' ? 'LONG' : 'SHORT';
    
    // Calculate PnL
    let realizedPnl = 0;
    if (exitTrade.fifoPnlRealized) {
      realizedPnl = parseFloat(exitTrade.fifoPnlRealized);
    } else {
      const priceDiff = direction === 'LONG' 
        ? exitPrice - entryPrice 
        : entryPrice - exitPrice;
      realizedPnl = priceDiff * quantity * multiplier;
    }
    
    // Calculate fees
    const fees = entryTrades.reduce((sum, t) => {
      return sum + Math.abs(parseFloat(t.ibCommission || '0'));
    }, 0) + Math.abs(parseFloat(exitTrade.ibCommission || '0'));
    
    return {
      brokerTradeId: exitTrade.tradeID || `${firstEntry.tradeID}-${Date.now()}`,
      symbol,
      direction,
      openedAt: this.parseIBKRDate(firstEntry.tradeDate, firstEntry.tradeTime),
      closedAt: this.parseIBKRDate(exitTrade.tradeDate, exitTrade.tradeTime),
      entryPrice,
      exitPrice,
      quantity,
      realizedPnl,
      fees,
      metadata: {
        accountId: firstEntry.accountId,
        assetCategory: firstEntry.assetCategory,
        currency: firstEntry.currency,
        multiplier,
        entryTradeIds: entryTrades.map(t => t.tradeID),
        exitTradeId: exitTrade.tradeID,
      },
    };
  }
  
  // ==========================================================================
  // HELPERS
  // ==========================================================================
  
  private parseIBKRDate(dateStr?: string, timeStr?: string): Date {
    if (!dateStr) return new Date();
    
    // Handle YYYYMMDD format
    if (dateStr.length === 8 && !dateStr.includes('-')) {
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      
      if (timeStr && timeStr.length >= 6) {
        const hour = parseInt(timeStr.substring(0, 2));
        const minute = parseInt(timeStr.substring(2, 4));
        const second = parseInt(timeStr.substring(4, 6));
        return new Date(year, month, day, hour, minute, second);
      }
      
      return new Date(year, month, day);
    }
    
    // Handle YYYY-MM-DD format
    if (dateStr.includes('-')) {
      const combined = timeStr ? `${dateStr}T${timeStr}` : dateStr;
      return new Date(combined);
    }
    
    // Handle dateTime format "YYYYMMDD;HHMMSS"
    if (dateStr.includes(';')) {
      const [datePart, timePart] = dateStr.split(';');
      return this.parseIBKRDate(datePart, timePart);
    }
    
    return new Date(dateStr);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createIBKRFlexQueryProvider(): IBKRFlexQueryProvider {
  return new IBKRFlexQueryProvider();
}

