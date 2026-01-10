/**
 * IBKR Flex Query Provider
 * 
 * Implementation of the BrokerProvider interface for Interactive Brokers
 * using the Flex Query Web Service with ACTIVITY FLEX QUERY.
 * 
 * IMPORTANT: We use "Activity Flex Query" (NOT "Trade Confirmation Flex Query")
 * because Activity Query supports historical date ranges (up to 365 days),
 * while Trade Confirmation is limited to the current day only.
 * 
 * How Flex Query works:
 * 1. User creates an "Activity Flex Query" in IBKR Account Management
 * 2. User MUST select the "Trades" section and configure required fields
 * 3. User sets period to "Last 365 Calendar Days" (or preferred range)
 * 4. User gets a Query ID and configures a Flex Web Service Token
 * 5. Our app calls the Flex Web Service API to fetch trade data
 * 
 * API Flow:
 * Step 1: SendRequest - Request report generation (returns referenceCode)
 * Step 2: GetStatement - Download the XML report using referenceCode
 * 
 * XML Structure (Activity Flex Query):
 * <FlexQueryResponse>
 *   <FlexStatements>
 *     <FlexStatement accountId="...">
 *       <Trades>
 *         <Trade symbol="..." dateTime="..." buySell="..." ... />
 *       </Trades>
 *     </FlexStatement>
 *   </FlexStatements>
 * </FlexQueryResponse>
 * 
 * Required Fields in Trades section:
 * - Account ID, Symbol, Asset Class, Currency
 * - Date/Time (CRITICAL - must include time for accurate ordering)
 * - Buy/Sell, Quantity, Trade Price
 * - IB Commission, Proceeds
 * - IB Exec ID (for deduplication)
 * - Open/Close Indicator
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

/**
 * IBKR Flex Query Trade Confirmation Fields
 * 
 * These field names match EXACTLY what IBKR exports in their Flex Query XML.
 * Users must select these fields when configuring their Trade Confirmation Flex Query:
 * 
 * REQUIRED FIELDS:
 * - Account ID: Broker account identifier
 * - Symbol: Trading symbol
 * - Asset Class: STK, OPT, FUT, etc.
 * - Currency: Trade currency
 * - Date/Time: Exact timestamp of execution (preferred over Trade Date)
 * - Trade Date: Date of trade (fallback if Date/Time not available)
 * - Buy/Sell: Trade direction (BUY or SELL)
 * - Quantity: Number of units traded
 * - Price: Execution price
 * - Commission: Trading fees
 * - Proceeds: Trade value (or Net Cash as alternative)
 * - Exec ID: Unique execution identifier (CRITICAL for deduplication)
 * 
 * OPTIONAL FIELDS:
 * - Order Type, Exchange, Order ID
 * - Underlying Symbol (for derivatives)
 * - Description, Multiplier
 */
interface FlexTradeConfirmation {
  // === TRADE IDENTIFICATION (REQUIRED) ===
  execId: string;                  // "Exec ID" - CRITICAL for deduplication
  orderId?: string;                // "Order ID"
  brokerageOrderId?: string;       // "Brokerage Order ID"
  
  // === ACCOUNT INFO (REQUIRED) ===
  accountId: string;               // "Account ID"
  accountAlias?: string;           // "Account Alias"
  model?: string;                  // "Model"
  
  // === SYMBOL INFO (REQUIRED) ===
  symbol: string;                  // "Symbol"
  underlyingSymbol?: string;       // "Underlying Symbol"
  description?: string;            // "Description"
  assetClass: string;              // "Asset Class" (STK, OPT, FUT, etc.)
  subCategory?: string;            // "Sub Category"
  currency: string;                // "Currency"
  conid?: string;                  // "Conid"
  underlyingConid?: string;        // "Underlying Conid"
  listingExchange?: string;        // "Listing Exchange"
  
  // === SECURITY IDENTIFIERS ===
  securityId?: string;             // "Security ID"
  securityIdType?: string;         // "Security ID Type"
  cusip?: string;                  // "CUSIP"
  isin?: string;                   // "ISIN"
  figi?: string;                   // "FIGI"
  underlyingSecurityId?: string;   // "Underlying Security ID"
  
  // === TRADE DETAILS (REQUIRED) ===
  buySell: 'BUY' | 'SELL';         // "Buy/Sell"
  quantity: string;                // "Quantity"
  price: string;                   // "Price"
  amount?: string;                 // "Amount"
  proceeds?: string;               // "Proceeds"
  netCash?: string;                // "Net Cash"
  netCashWithBillable?: string;    // "Net Cash With Billable"
  
  // === DATES (REQUIRED - at least one) ===
  dateTime?: string;               // "Date/Time" - PREFERRED (includes time)
  tradeDate?: string;              // "Trade Date" - YYYYMMDD
  orderTime?: string;              // "Order Time"
  reportDate?: string;             // "Report Date"
  settleDate?: string;             // "Settle Date"
  
  // === FEES & COMMISSIONS (REQUIRED) ===
  commission?: string;             // "Commission" - PRIMARY commission field
  brokerExecutionCommission?: string;       // "Broker Execution Commission"
  brokerClearingCommission?: string;        // "Broker Clearing Commission"
  thirdPartyExecutionCommission?: string;   // "Third-Party Execution Commission"
  thirdPartyClearingCommission?: string;    // "Third-Party Clearing Commission"
  thirdPartyRegulatoryCommission?: string;  // "Third-Party Regulatory Commission"
  otherCommission?: string;                 // "Other Commission"
  commissionCurrency?: string;              // "Commission Currency"
  tax?: string;                    // "Tax"
  salesTax?: string;               // "Sales Tax"
  tradeCharge?: string;            // "Trade Charge"
  otherTax?: string;               // "Other Tax"
  
  // === EXECUTION INFO ===
  orderType?: string;              // "Order Type" (LMT, MKT, etc.)
  exchange?: string;               // "Exchange"
  code?: string;                   // "Code"
  levelOfDetail?: string;          // "Level of Detail"
  traderId?: string;               // "Trader ID"
  isApiOrder?: string;             // "Is API Order"
  allocatedTo?: string;            // "Allocated To"
  
  // === LEGACY FIELDS (for backward compatibility) ===
  // These are mapped from various possible field names
  tradeID?: string;                // Legacy: may appear as "tradeID" in some reports
  ibOrderID?: string;              // Legacy: "ibOrderID"
  ibExecID?: string;               // Legacy: "ibExecID"
  tradePrice?: string;             // Legacy: maps to "price"
  tradeTime?: string;              // Legacy: extracted from dateTime
  assetCategory?: string;          // Legacy: maps to "assetClass"
  ibCommission?: string;           // Legacy: maps to "commission"
  fifoPnlRealized?: string;        // P&L field
  mtmPnl?: string;                 // Mark-to-market P&L
  openCloseIndicator?: 'O' | 'C' | '';  // Open/Close
  multiplier?: string;             // Contract multiplier
  origTradePrice?: string;         // "Orig Trade Price"
  origTradeDate?: string;          // "Orig Trade Date"
  origTradeId?: string;            // "Orig Trade ID"
  extExecId?: string;              // "Ext Exec ID"
  blockId?: string;                // "Block ID"
  rfqId?: string;                  // "RFQID"
  positionActionId?: string;       // "Position Action ID"
  accruedInterest?: string;        // "Accrued Interest"
  
  // === PHYSICAL DELIVERY (Commodities) ===
  serialNumber?: string;           // "Serial Number"
  deliveryType?: string;           // "Delivery Type"
  commodityType?: string;          // "Commodity Type"
  fineness?: string;               // "Fineness"
  weight?: string;                 // "Weight"
}

/**
 * Activity Flex Query XML Structure
 * 
 * The Activity Flex Query returns trades in the <Trades> section:
 * <FlexQueryResponse>
 *   <FlexStatements count="1">
 *     <FlexStatement accountId="U1234567" fromDate="20240101" toDate="20241231">
 *       <Trades>
 *         <Trade accountId="..." symbol="..." dateTime="..." buySell="..." quantity="..." ... />
 *         <Trade ... />
 *       </Trades>
 *     </FlexStatement>
 *   </FlexStatements>
 * </FlexQueryResponse>
 */
interface FlexStatement {
  FlexStatements?: {
    FlexStatement?: {
      $?: {
        accountId?: string;
        fromDate?: string;
        toDate?: string;
      };
      // Activity Flex Query uses "Trades" section
      Trades?: {
        Trade?: FlexTradeConfirmation[] | FlexTradeConfirmation;
      };
      // Legacy: Trade Confirmation Flex Query uses "TradeConfirms" section
      TradeConfirms?: {
        TradeConfirm?: FlexTradeConfirmation[] | FlexTradeConfirmation;
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
    this.queryId = credentials.apiSecret; // Activity Flex Query ID
    
    if (!this.token || !this.queryId) {
      throw new BrokerAuthError('IBKR Activity Flex Query requires both Token and Query ID. Ensure you created an Activity Flex Query (not Trade Confirmation) with the Trades section enabled.');
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
  
  /**
   * Fetch trades from IBKR Activity Flex Query
   * 
   * The Activity Flex Query supports historical date ranges (up to 365 days),
   * making it ideal for onboarding new users with past trades.
   * 
   * The query returns trades in the <Trades> section of the XML response.
   */
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
    
    console.log(`[IBKR] Fetching trades from Activity Flex Query${since ? ` since ${since.toISOString()}` : ''}`);
    
    const statement = await this.fetchFlexStatement();
    const trades: BrokerTrade[] = [];
    
    const flexStatement = statement.FlexStatements?.FlexStatement;
    if (!flexStatement) {
      const errorMsg = '[IBKR] No FlexStatement found in response';
      console.error(errorMsg);
      throw new BrokerApiError(errorMsg);
    }
    
    // Log the date range from the query response
    if (flexStatement.$?.fromDate && flexStatement.$?.toDate) {
      console.log(`[IBKR] Query date range: ${flexStatement.$.fromDate} to ${flexStatement.$.toDate}`);
    }
    
    // Extract trades from Activity Flex Query's <Trades> section
    // Also check <TradeConfirms> for backward compatibility with Trade Confirmation queries
    const rawTrades = flexStatement.Trades?.Trade || 
                      flexStatement.TradeConfirms?.TradeConfirm;
    
    
    if (!rawTrades) {
      const warningMsg = '[IBKR] No trades found in Flex Query response. Ensure the "Trades" section is enabled in your Activity Flex Query configuration.';
      console.warn(warningMsg);
      return trades; // Return empty array if no trades (user might not have any)
    }
    
    // Ensure array
    const tradeList = Array.isArray(rawTrades) ? rawTrades : [rawTrades];
    
    console.log(`[IBKR] Found ${tradeList.length} raw trade executions`);
    
    // Group trades by symbol and aggregate to create full round-trip trades
    const aggregatedTrades = this.aggregateTradesToRoundTrips(tradeList, since);
    
    console.log(`[IBKR] Aggregated into ${aggregatedTrades.length} round-trip trades`);
    
    
    // CRITICAL: If we have raw trades but aggregated to zero, log warning but don't fail
    // (This can happen if all trades are opening positions without closes)
    if (tradeList.length > 0 && aggregatedTrades.length === 0) {
      const warningMsg = `[IBKR] Found ${tradeList.length} raw trade executions but aggregated to 0 round-trip trades. This may indicate all trades are open positions without closes, or an aggregation issue.`;
      console.warn(warningMsg);
    }
    
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
    
    const responseText = await response.text();
    
    
    return responseText;
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
  
  private parseFlexStatement(responseText: string): FlexStatement {
    // Detect if response is CSV or XML
    const trimmedResponse = responseText.trim();
    const isXML = trimmedResponse.startsWith('<');
    const isCSV = !isXML && (responseText.includes(',') || responseText.includes('\t')) && responseText.includes('\n');
    
    
    // Validate that we have the expected root element
    if (isXML && !responseText.includes('<FlexQueryResponse>') && !responseText.includes('<FlexStatement')) {
      const errorMsg = `[IBKR] Invalid XML response: missing FlexQueryResponse or FlexStatement root element. Response starts with: ${responseText.substring(0, 200)}`;
      console.error(errorMsg);
      throw new BrokerApiError(errorMsg);
    }
    
    if (isCSV) {
      console.log('[IBKR] Detected CSV format, parsing...');
      const result = this.parseCSVStatement(responseText);
      return result;
    }
    
    console.log('[IBKR] Detected XML format, parsing...');
    const result = this.parseXMLStatement(responseText);
    return result;
  }
  
  /**
   * Parse CSV response from Activity Flex Query
   * 
   * Expected CSV headers (exact names from IBKR):
   * - IB Execution ID -> execId (CRITICAL for deduplication)
   * - Date/Time -> dateTime (format: yyyy-MM-dd;HH:mm:ss or yyyy-MM-dd, HH:mm:ss)
   * - Symbol -> symbol
   * - Buy/Sell -> buySell
   * - Quantity -> quantity
   * - TradePrice -> price
   * - Proceeds -> proceeds
   * - IB Commission -> commission
   * - Currency -> currency
   * - Asset Class -> assetClass
   * - Exchange -> exchange
   */
  private parseCSVStatement(csvText: string): FlexStatement {
    const statement: FlexStatement = {
      FlexStatements: {
        FlexStatement: {
          Trades: {
            Trade: [],
          },
        },
      },
    };
    
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      console.warn('[IBKR] CSV has no data rows');
      return statement;
    }
    
    // Parse header row
    const headers = this.parseCSVRow(lines[0]);
    console.log('[IBKR] CSV Headers:', headers);
    
    // Create header index map (case-insensitive, trim whitespace)
    const headerMap = new Map<string, number>();
    headers.forEach((h, i) => {
      const normalized = h.trim().toLowerCase();
      headerMap.set(normalized, i);
    });
    
    // Map CSV column names to our field names
    // These are the EXACT names from IBKR Activity Flex Query CSV export
    const columnMapping: Record<string, string> = {
      'ib execution id': 'execId',
      'ibexecutionid': 'execId',
      'ibexecid': 'execId',
      'execution id': 'execId',
      'exec id': 'execId',
      'date/time': 'dateTime',
      'datetime': 'dateTime',
      'tradeprice': 'price',
      'trade price': 'price',
      'price': 'price',
      'ib commission': 'commission',
      'ibcommission': 'commission',
      'commission': 'commission',
      'symbol': 'symbol',
      'buy/sell': 'buySell',
      'buysell': 'buySell',
      'side': 'buySell',
      'quantity': 'quantity',
      'qty': 'quantity',
      'currency': 'currency',
      'asset class': 'assetClass',
      'assetclass': 'assetClass',
      'exchange': 'exchange',
      'proceeds': 'proceeds',
      'account id': 'accountId',
      'accountid': 'accountId',
      'underlying symbol': 'underlyingSymbol',
      'underlyingsymbol': 'underlyingSymbol',
      'multiplier': 'multiplier',
      'open/close': 'openCloseIndicator',
      'openclose': 'openCloseIndicator',
      'o/c': 'openCloseIndicator',
      'fifo p&l realized': 'fifoPnlRealized',
      'fifopnlrealized': 'fifoPnlRealized',
      'realized p&l': 'fifoPnlRealized',
      'realized pnl': 'fifoPnlRealized',
      'order id': 'orderId',
      'orderid': 'orderId',
      'order type': 'orderType',
      'ordertype': 'orderType',
    };
    
    // Find column indices for each field
    const fieldIndices: Record<string, number> = {};
    for (const [csvName, fieldName] of Object.entries(columnMapping)) {
      if (headerMap.has(csvName)) {
        fieldIndices[fieldName] = headerMap.get(csvName)!;
      }
    }
    
    
    console.log('[IBKR] Field mappings found:', Object.keys(fieldIndices));
    
    // Parse data rows
    const trades: FlexTradeConfirmation[] = [];
    const invalidRows: Array<{ row: number; reason: string; trade: Partial<FlexTradeConfirmation> }> = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = this.parseCSVRow(line);
      const trade: Partial<FlexTradeConfirmation> = {};
      
      // Map values to trade fields
      for (const [fieldName, colIndex] of Object.entries(fieldIndices)) {
        if (colIndex < values.length) {
          const rawValue = values[colIndex];
          const value = rawValue?.trim();
          if (value) {
            (trade as Record<string, string>)[fieldName] = value;
          }
          
        }
      }
      
      // Normalize buySell to uppercase
      if (trade.buySell) {
        trade.buySell = trade.buySell.toUpperCase() as 'BUY' | 'SELL';
      }
      
      // IBKR CSV contains both summary rows (empty Exchange) and detail rows (with Exchange)
      // Summary rows are aggregates of detail rows - we should skip them to avoid duplicates
      // Detail rows have valid IBExecID, summary rows have empty IBExecID
      const hasExchange = !!(trade as Record<string, string>).exchange && (trade as Record<string, string>).exchange.trim().length > 0;
      const hasValidExecId = !!(trade as Record<string, string>).execId && (trade as Record<string, string>).execId.trim().length > 0;
      
      if (!hasExchange && !hasValidExecId) {
        // Skip summary rows (no exchange, no execId) - they're duplicates of detail rows
        continue;
      }
      
      // Ensure execId is set (critical for deduplication)
      if (!trade.execId) {
        trade.execId = `${trade.symbol}-${trade.dateTime || Date.now()}-${i}`;
      }
      
      // STRICT VALIDATION: Required fields according to IBKR Activity Flex Query spec
      // Note: IBKR uses negative quantities for SELL trades, so we check != 0, not > 0
      const quantityValue = trade.quantity ? parseFloat(trade.quantity) : 0;
      const requiredFields = {
        symbol: !!trade.symbol && trade.symbol.trim().length > 0,
        buySell: !!trade.buySell && (trade.buySell === 'BUY' || trade.buySell === 'SELL'),
        quantity: !!trade.quantity && !isNaN(quantityValue) && quantityValue !== 0,
        price: !!(trade.price || trade.tradePrice),
        dateTime: !!(trade.dateTime || trade.tradeDate),
      };
      
      const missingFields = Object.entries(requiredFields)
        .filter(([_, present]) => !present)
        .map(([field]) => field);
      
      if (missingFields.length > 0) {
        const reason = `Missing required fields: ${missingFields.join(', ')}`;
        invalidRows.push({ row: i + 1, reason, trade });
        console.warn(`[IBKR] CSV row ${i + 1}: ${reason}`, { symbol: trade.symbol, quantity: trade.quantity, buySell: trade.buySell, price: trade.price || trade.tradePrice, dateTime: trade.dateTime || trade.tradeDate });
        continue;
      }
      
      trades.push(trade as FlexTradeConfirmation);
    }
    
    console.log(`[IBKR] Parsed ${trades.length} valid trades from ${lines.length - 1} CSV rows (${invalidRows.length} invalid rows skipped)`);
    
    // CRITICAL: If we have data rows but parsed zero trades, that's an error
    if (lines.length > 1 && trades.length === 0 && invalidRows.length > 0) {
      const errorMsg = `[IBKR] CSV has ${lines.length - 1} data rows but parsed 0 valid trades. Invalid rows: ${invalidRows.slice(0, 3).map(r => `Row ${r.row}: ${r.reason}`).join('; ')}`;
      console.error(errorMsg);
      throw new BrokerApiError(errorMsg);
    }
    
    if (statement.FlexStatements?.FlexStatement?.Trades) {
      statement.FlexStatements.FlexStatement.Trades.Trade = trades;
    }
    
    return statement;
  }
  
  /**
   * Parse a single CSV row, handling quoted values with commas
   */
  private parseCSVRow(row: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    
    return result;
  }
  
  /**
   * Parse XML response from Activity Flex Query
   * 
   * According to IBKR Flex Query documentation:
   * https://www.ibkrguides.com/clientportal/performanceandstatements/flex.htm
   * 
   * Structure: <FlexQueryResponse><FlexStatements><FlexStatement><Trades><Trade .../></Trades></FlexStatement></FlexStatements></FlexQueryResponse>
   */
  private parseXMLStatement(xmlText: string): FlexStatement {
    const statement: FlexStatement = {
      FlexStatements: {
        FlexStatement: {
          Trades: {
            Trade: [],
          },
        },
      },
    };
    
    
    // Validate root structure according to IBKR spec
    if (!hasFlexQueryResponse && !hasFlexStatement) {
      const errorMsg = `[IBKR] Invalid XML: missing FlexQueryResponse or FlexStatement root. Found structure: ${xmlText.substring(0, 300)}`;
      console.error(errorMsg);
      throw new BrokerApiError(errorMsg);
    }
    
    // Extract account ID and date range from FlexStatement attributes
    const accountMatch = xmlText.match(/accountId="([^"]+)"/);
    const fromDateMatch = xmlText.match(/fromDate="([^"]+)"/);
    const toDateMatch = xmlText.match(/toDate="([^"]+)"/);
    
    if (statement.FlexStatements?.FlexStatement) {
      statement.FlexStatements.FlexStatement.$ = {
        accountId: accountMatch?.[1],
        fromDate: fromDateMatch?.[1],
        toDate: toDateMatch?.[1],
      };
      
      if (accountMatch?.[1]) {
        this.accountId = accountMatch[1];
      }
    }
    
    // Log date range for debugging
    if (fromDateMatch && toDateMatch) {
      console.log(`[IBKR] Parsing Activity Flex Query: ${fromDateMatch[1]} to ${toDateMatch[1]}`);
    }
    
    // Extract trades from Activity Flex Query's <Trades> section
    // The XML structure is: <Trades><Trade .../><Trade .../></Trades>
    // According to IBKR spec, Activity Flex Query uses <Trades><Trade .../></Trades>
    // Trade Confirmation Flex Query uses <TradeConfirms><TradeConfirm .../></TradeConfirms>
    const trades: FlexTradeConfirmation[] = [];
    
    // Match Trade elements (from Activity Flex Query's Trades section)
    // Support both self-closing <Trade .../> and full <Trade ...></Trade> tags
    // Also match TradeConfirm elements for backward compatibility with Trade Confirmation queries
    const tradeRegex = /<(?:Trade|TradeConfirm)\s+([^>]+?)(?:\s*\/\s*>|>(?:.*?)<\/(?:Trade|TradeConfirm)>)/gs;
    let tradeMatch;
    let matchCount = 0;
    
    while ((tradeMatch = tradeRegex.exec(xmlText)) !== null) {
      matchCount++;
      const attributes = tradeMatch[1];
      
      
      const trade = this.parseTradeAttributes(attributes);
      
      // Strict validation: REQUIRED fields according to IBKR Activity Flex Query spec
      // Required: symbol, buySell, quantity, price/dateTime
      // Note: IBKR uses negative quantities for SELL trades, so we check != 0, not > 0
      const quantityValue = trade.quantity ? parseFloat(trade.quantity) : 0;
      const requiredFields = {
        symbol: !!trade.symbol,
        buySell: !!trade.buySell,
        quantity: !!trade.quantity && !isNaN(quantityValue) && quantityValue !== 0,
        price: !!(trade.price || trade.tradePrice),
        dateTime: !!(trade.dateTime || trade.tradeDate),
      };
      
      const missingFields = Object.entries(requiredFields)
        .filter(([_, present]) => !present)
        .map(([field]) => field);
      
      if (missingFields.length > 0) {
        console.warn(`[IBKR] Trade ${matchCount} missing required fields: ${missingFields.join(', ')}`, {
          symbol: trade.symbol,
          buySell: trade.buySell,
          quantity: trade.quantity,
          price: trade.price || trade.tradePrice,
          dateTime: trade.dateTime || trade.tradeDate,
        });
        continue; // Skip invalid trades but continue parsing
      }
      
      trades.push(trade);
    }
    
    console.log(`[IBKR] Parsed ${trades.length} valid trades from ${matchCount} trade elements in XML`);
    
    // CRITICAL: If we found trade elements but parsed zero trades, that's an error
    if (matchCount > 0 && trades.length === 0) {
      const errorMsg = `[IBKR] Found ${matchCount} trade elements but parsed 0 valid trades. This indicates a parsing or validation issue. Check required fields (symbol, buySell, quantity, price, dateTime).`;
      console.error(errorMsg);
      throw new BrokerApiError(errorMsg);
    }
    
    // If no trades found and no trade elements, warn but don't fail (user might not have trades)
    if (matchCount === 0 && !hasTrades && !hasTradeConfirms) {
      console.warn('[IBKR] No trade elements found in XML response. Ensure your Activity Flex Query has the Trades section enabled.');
    }
    
    if (statement.FlexStatements?.FlexStatement?.Trades) {
      statement.FlexStatements.FlexStatement.Trades.Trade = trades;
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
      
      // Map IBKR Flex Query field names to our interface
      // Field names match what users select in the IBKR portal
      switch (key) {
        // === TRADE IDENTIFICATION ===
        case 'execId':
        case 'execID':           // Handle case variations
          trade.execId = value;
          break;
        case 'orderId':
        case 'orderID':
          trade.orderId = value;
          break;
        case 'brokerageOrderId':
        case 'brokerageOrderID':
          trade.brokerageOrderId = value;
          break;
        case 'tradeID':          // Legacy field
          trade.tradeID = value;
          break;
        case 'ibOrderID':        // Legacy field
          trade.ibOrderID = value;
          break;
        case 'ibExecID':         // Legacy field - map to execId
          trade.ibExecID = value;
          if (!trade.execId) trade.execId = value;
          break;
        case 'extExecId':
        case 'extExecID':
          trade.extExecId = value;
          break;
        case 'origTradeId':
        case 'origTradeID':
          trade.origTradeId = value;
          break;
        case 'blockId':
        case 'blockID':
          trade.blockId = value;
          break;
          
        // === ACCOUNT INFO ===
        case 'accountId':
        case 'accountID':
          trade.accountId = value;
          break;
        case 'accountAlias':
        case 'acctAlias':        // Handle legacy name
          trade.accountAlias = value;
          break;
        case 'model':
          trade.model = value;
          break;
          
        // === SYMBOL INFO ===
        case 'symbol':
          trade.symbol = value;
          break;
        case 'underlyingSymbol':
          trade.underlyingSymbol = value;
          break;
        case 'description':
          trade.description = value;
          break;
        case 'assetClass':
          trade.assetClass = value;
          break;
        case 'assetCategory':    // Legacy name for assetClass
          trade.assetCategory = value;
          if (!trade.assetClass) trade.assetClass = value;
          break;
        case 'subCategory':
          trade.subCategory = value;
          break;
        case 'currency':
          trade.currency = value;
          break;
        case 'conid':
          trade.conid = value;
          break;
        case 'underlyingConid':
          trade.underlyingConid = value;
          break;
        case 'listingExchange':
          trade.listingExchange = value;
          break;
          
        // === SECURITY IDENTIFIERS ===
        case 'securityId':
        case 'securityID':
          trade.securityId = value;
          break;
        case 'securityIdType':
        case 'securityIDType':
          trade.securityIdType = value;
          break;
        case 'cusip':
        case 'CUSIP':
          trade.cusip = value;
          break;
        case 'isin':
        case 'ISIN':
          trade.isin = value;
          break;
        case 'figi':
        case 'FIGI':
          trade.figi = value;
          break;
        case 'underlyingSecurityId':
        case 'underlyingSecurityID':
          trade.underlyingSecurityId = value;
          break;
          
        // === TRADE DETAILS ===
        case 'buySell':
          trade.buySell = value.toUpperCase() as 'BUY' | 'SELL';
          break;
        case 'quantity':
          trade.quantity = value;
          break;
        case 'price':
          trade.price = value;
          break;
        case 'tradePrice':       // Legacy name for price
          trade.tradePrice = value;
          if (!trade.price) trade.price = value;
          break;
        case 'amount':
          trade.amount = value;
          break;
        case 'proceeds':
          trade.proceeds = value;
          break;
        case 'netCash':
          trade.netCash = value;
          break;
        case 'netCashWithBillable':
          trade.netCashWithBillable = value;
          break;
          
        // === DATES ===
        case 'dateTime':
          trade.dateTime = value;
          break;
        case 'tradeDate':
          trade.tradeDate = value;
          break;
        case 'tradeTime':        // Legacy - usually extracted from dateTime
          trade.tradeTime = value;
          break;
        case 'orderTime':
          trade.orderTime = value;
          break;
        case 'reportDate':
          trade.reportDate = value;
          break;
        case 'settleDate':
        case 'settleDateTarget':
          trade.settleDate = value;
          break;
        case 'origTradeDate':
          trade.origTradeDate = value;
          break;
        case 'origTradePrice':
          trade.origTradePrice = value;
          break;
          
        // === FEES & COMMISSIONS ===
        case 'commission':
          trade.commission = value;
          break;
        case 'ibCommission':     // Legacy name for commission
          trade.ibCommission = value;
          if (!trade.commission) trade.commission = value;
          break;
        case 'brokerExecutionCommission':
          trade.brokerExecutionCommission = value;
          break;
        case 'brokerClearingCommission':
          trade.brokerClearingCommission = value;
          break;
        case 'thirdPartyExecutionCommission':
          trade.thirdPartyExecutionCommission = value;
          break;
        case 'thirdPartyClearingCommission':
          trade.thirdPartyClearingCommission = value;
          break;
        case 'thirdPartyRegulatoryCommission':
          trade.thirdPartyRegulatoryCommission = value;
          break;
        case 'otherCommission':
          trade.otherCommission = value;
          break;
        case 'commissionCurrency':
        case 'ibCommissionCurrency':
          trade.commissionCurrency = value;
          break;
        case 'tax':
        case 'taxes':
          trade.tax = value;
          break;
        case 'salesTax':
          trade.salesTax = value;
          break;
        case 'tradeCharge':
          trade.tradeCharge = value;
          break;
        case 'otherTax':
          trade.otherTax = value;
          break;
          
        // === EXECUTION INFO ===
        case 'orderType':
          trade.orderType = value;
          break;
        case 'exchange':
          trade.exchange = value;
          break;
        case 'code':
          trade.code = value;
          break;
        case 'levelOfDetail':
          trade.levelOfDetail = value;
          break;
        case 'traderId':
        case 'traderID':
          trade.traderId = value;
          break;
        case 'isAPIOrder':
        case 'isApiOrder':
          trade.isApiOrder = value;
          break;
        case 'allocatedTo':
          trade.allocatedTo = value;
          break;
        case 'openCloseIndicator':
          trade.openCloseIndicator = value as 'O' | 'C' | '';
          break;
        case 'multiplier':
          trade.multiplier = value;
          break;
          
        // === P&L ===
        case 'fifoPnlRealized':
          trade.fifoPnlRealized = value;
          break;
        case 'mtmPnl':
          trade.mtmPnl = value;
          break;
          
        // === OTHER ===
        case 'accruedInterest':
          trade.accruedInterest = value;
          break;
        case 'rfqId':
        case 'rfqID':
        case 'RFQID':
          trade.rfqId = value;
          break;
        case 'positionActionId':
        case 'positionActionID':
          trade.positionActionId = value;
          break;
          
        // === PHYSICAL DELIVERY ===
        case 'serialNumber':
          trade.serialNumber = value;
          break;
        case 'deliveryType':
          trade.deliveryType = value;
          break;
        case 'commodityType':
          trade.commodityType = value;
          break;
        case 'fineness':
          trade.fineness = value;
          break;
        case 'weight':
          trade.weight = value;
          break;
      }
    }
    
    // Ensure we have essential fields with fallbacks
    // execId is CRITICAL for deduplication
    if (!trade.execId) {
      trade.execId = trade.ibExecID || trade.tradeID || trade.orderId || `${trade.symbol}-${trade.dateTime || trade.tradeDate}-${Date.now()}`;
    }
    
    // Ensure assetClass has a value
    if (!trade.assetClass) {
      trade.assetClass = trade.assetCategory || 'UNKNOWN';
    }
    
    // Ensure price has a value
    if (!trade.price) {
      trade.price = trade.tradePrice || '0';
    }
    
    // Ensure commission has a value
    if (!trade.commission) {
      trade.commission = trade.ibCommission || '0';
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
    let tradesWithoutSymbol = 0;
    
    for (const trade of tradeList) {
      
      const symbol = trade.underlyingSymbol || trade.symbol;
      if (!symbol) {
        tradesWithoutSymbol++;
        continue;
      }
      
      // Filter by date if specified
      if (since) {
        const tradeDate = this.parseIBKRDateTime(trade);
        if (tradeDate < since) {
          continue;
        }
      }
      
      const existing = tradesBySymbol.get(symbol) || [];
      existing.push(trade);
      tradesBySymbol.set(symbol, existing);
    }
    
    
    // Process each symbol's trades
    for (const [symbol, symbolTrades] of tradesBySymbol) {
      // Sort by date/time (prefer dateTime field for accurate ordering)
      symbolTrades.sort((a, b) => {
        const dateA = this.parseIBKRDateTime(a);
        const dateB = this.parseIBKRDateTime(b);
        return dateA.getTime() - dateB.getTime();
      });
      
      // Track position
      let position = 0;
      let entryTrades: FlexTradeConfirmation[] = [];
      
      
      for (const trade of symbolTrades) {
        // CRITICAL: IBKR CSV uses signed quantities (negative for SELL, positive for BUY)
        // So we should use the quantity as-is, not apply sign based on buySell
        const qty = parseFloat(trade.quantity || '0');
        // Use quantity directly if it's already signed, otherwise apply sign based on buySell
        // In IBKR CSV, quantities are already signed, so we use them directly
        const signedQty = qty; // IBKR CSV already has signed quantities
        
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
          } else {
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
    // Use 'price' field (primary) with fallback to 'tradePrice' (legacy)
    let totalQty = 0;
    let totalCost = 0;
    
    for (const entry of entryTrades) {
      const qty = Math.abs(parseFloat(entry.quantity || '0'));
      const price = parseFloat(entry.price || entry.tradePrice || '0');
      totalQty += qty;
      totalCost += qty * price;
    }
    
    const entryPrice = totalCost / totalQty;
    const exitPrice = parseFloat(exitTrade.price || exitTrade.tradePrice || '0');
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
    
    // Calculate total fees (commission is the primary field)
    const getCommission = (t: FlexTradeConfirmation): number => {
      return Math.abs(parseFloat(t.commission || t.ibCommission || '0'));
    };
    
    const fees = entryTrades.reduce((sum, t) => sum + getCommission(t), 0) + getCommission(exitTrade);
    
    // Use execId for unique trade identification (CRITICAL for deduplication)
    const exitExecId = exitTrade.execId || exitTrade.ibExecID || exitTrade.tradeID;
    const entryExecIds = entryTrades.map(t => t.execId || t.ibExecID || t.tradeID);
    
    return {
      brokerTradeId: exitExecId || `${symbol}-${Date.now()}`,
      symbol,
      direction,
      openedAt: this.parseIBKRDateTime(firstEntry),
      closedAt: this.parseIBKRDateTime(exitTrade),
      entryPrice,
      exitPrice,
      quantity,
      realizedPnl,
      fees,
      metadata: {
        accountId: firstEntry.accountId,
        assetClass: firstEntry.assetClass || firstEntry.assetCategory,
        currency: firstEntry.currency,
        multiplier,
        entryExecIds,
        exitExecId,
        exchange: exitTrade.exchange,
        orderType: exitTrade.orderType,
      },
    };
  }
  
  /**
   * Parse IBKR date/time from various possible field combinations
   * Prefers "Date/Time" field, falls back to "Trade Date" + time extraction
   */
  private parseIBKRDateTime(trade: FlexTradeConfirmation): Date {
    // Prefer the combined dateTime field
    if (trade.dateTime) {
      return this.parseIBKRDate(trade.dateTime);
    }
    
    // Fall back to tradeDate + tradeTime
    return this.parseIBKRDate(trade.tradeDate, trade.tradeTime);
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

