/**
 * Broker Sync Service
 * 
 * Main service for managing broker connections and syncing trades.
 * Handles encryption of credentials, connection management, and sync scheduling.
 */

import prisma from '@/lib/prisma';
import { BrokerType, BrokerConnectionStatus, SyncStatus } from '@prisma/client';
import { createTradovateProvider } from './tradovate-provider';
import { createIBKRFlexQueryProvider } from './ibkr-flex-query-provider';
import { 
  BrokerProvider, 
  BrokerCredentials, 
  BrokerTrade, 
  SyncResult,
  BrokerAuthError,
  TradovateCredentials,
  IBKRFlexQueryCredentials,
} from './types';
import { calculateTradeSignature } from '@/services/trade-service';

// ============================================================================
// ENCRYPTION HELPERS
// ============================================================================

// Simple encryption using AES - in production, use Supabase Vault or proper KMS
// For now, we use a reversible encryption with env secret

function getEncryptionKey(): string {
  const key = process.env.BROKER_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('BROKER_ENCRYPTION_KEY or SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return key;
}

export function encryptCredential(value: string): string {
  // Simple XOR encryption for MVP - replace with proper encryption in production
  const key = getEncryptionKey();
  const encoded = Buffer.from(value).toString('base64');
  const keyBuffer = Buffer.from(key);
  const valueBuffer = Buffer.from(encoded);
  
  const encrypted = Buffer.alloc(valueBuffer.length);
  for (let i = 0; i < valueBuffer.length; i++) {
    encrypted[i] = valueBuffer[i] ^ keyBuffer[i % keyBuffer.length];
  }
  
  return encrypted.toString('base64');
}

export function decryptCredential(encrypted: string): string {
  const key = getEncryptionKey();
  const keyBuffer = Buffer.from(key);
  const encryptedBuffer = Buffer.from(encrypted, 'base64');
  
  const decrypted = Buffer.alloc(encryptedBuffer.length);
  for (let i = 0; i < encryptedBuffer.length; i++) {
    decrypted[i] = encryptedBuffer[i] ^ keyBuffer[i % keyBuffer.length];
  }
  
  return Buffer.from(decrypted.toString(), 'base64').toString();
}

// ============================================================================
// BROKER PROVIDER FACTORY
// ============================================================================

function getBrokerProvider(brokerType: BrokerType, options?: { environment?: 'demo' | 'live' }): BrokerProvider {
  switch (brokerType) {
    case 'TRADOVATE':
      return createTradovateProvider(options?.environment || 'live');
    case 'IBKR':
      return createIBKRFlexQueryProvider();
    default:
      throw new Error(`Unknown broker type: ${brokerType}`);
  }
}

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

export interface ConnectBrokerInput {
  userId: string;
  brokerType: BrokerType;
  apiKey: string;
  apiSecret: string;
  accountId?: string; // Local trading account to link
  environment?: 'demo' | 'live'; // For Tradovate
}

export async function connectBroker(input: ConnectBrokerInput): Promise<{
  connectionId: string;
  brokerAccounts: { id: string; name: string }[];
}> {
  const { userId, brokerType, apiKey, apiSecret, accountId, environment } = input;
  
  // Get the appropriate provider
  const provider = getBrokerProvider(brokerType, { environment });
  
  // Authenticate with the broker
  const credentials: TradovateCredentials = {
    apiKey,
    apiSecret,
    environment,
  };
  
  const authResult = await provider.authenticate(credentials);
  
  // Get list of broker accounts
  const brokerAccounts = await provider.getAccounts(authResult.accessToken);
  
  if (brokerAccounts.length === 0) {
    throw new BrokerAuthError('No trading accounts found on this broker');
  }
  
  // For now, use the first account (could let user choose later)
  const primaryBrokerAccount = brokerAccounts[0];
  
  // Check if connection already exists
  const existing = await prisma.brokerConnection.findFirst({
    where: {
      userId,
      brokerType,
      brokerAccountId: primaryBrokerAccount.id,
    },
  });
  
  if (existing) {
    // Update existing connection
    await prisma.brokerConnection.update({
      where: { id: existing.id },
      data: {
        status: 'CONNECTED',
        encryptedApiKey: encryptCredential(apiKey),
        encryptedApiSecret: encryptCredential(apiSecret),
        accessToken: authResult.accessToken,
        tokenExpiresAt: authResult.expiresAt,
        brokerAccountName: primaryBrokerAccount.name,
        lastSyncError: null,
        accountId,
      },
    });
    
    return {
      connectionId: existing.id,
      brokerAccounts: brokerAccounts.map(a => ({ id: a.id, name: a.name })),
    };
  }
  
  // Create new connection
  const connection = await prisma.brokerConnection.create({
    data: {
      userId,
      brokerType,
      status: 'CONNECTED',
      encryptedApiKey: encryptCredential(apiKey),
      encryptedApiSecret: encryptCredential(apiSecret),
      accessToken: authResult.accessToken,
      tokenExpiresAt: authResult.expiresAt,
      brokerAccountId: primaryBrokerAccount.id,
      brokerAccountName: primaryBrokerAccount.name,
      accountId,
    },
  });
  
  return {
    connectionId: connection.id,
    brokerAccounts: brokerAccounts.map(a => ({ id: a.id, name: a.name })),
  };
}

/**
 * Delete a broker connection completely (hard delete)
 * 
 * This will:
 * 1. Delete all sync logs associated with this connection
 * 2. Delete the broker connection record
 * 
 * Note: Trades that were imported from this broker are NOT deleted.
 * They remain in the database as they represent real trading history.
 */
export async function disconnectBroker(connectionId: string, userId: string): Promise<void> {
  const connection = await prisma.brokerConnection.findFirst({
    where: { id: connectionId, userId },
  });
  
  if (!connection) {
    throw new Error('Broker connection not found');
  }
  
  // Hard delete the connection
  // SyncLogs will be cascade deleted due to onDelete: Cascade in the schema
  await prisma.brokerConnection.delete({
    where: { id: connectionId },
  });
  
  console.log(`[Broker] Deleted broker connection ${connectionId} for user ${userId}`);
}

export async function getBrokerConnections(userId: string) {
  return prisma.brokerConnection.findMany({
    where: { userId },
    include: {
      account: {
        select: { id: true, name: true, color: true },
      },
      syncLogs: {
        take: 5,
        orderBy: { startedAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

export async function syncBrokerTrades(
  connectionId: string,
  userId: string,
  syncType: 'manual' | 'scheduled' = 'manual'
): Promise<SyncResult> {
  const startTime = Date.now();
  
  // Get connection
  const connection = await prisma.brokerConnection.findFirst({
    where: { id: connectionId, userId, status: 'CONNECTED' },
  });
  
  if (!connection) {
    throw new Error('Broker connection not found or not connected');
  }
  
  // Create sync log
  const syncLog = await prisma.syncLog.create({
    data: {
      brokerConnectionId: connectionId,
      status: 'RUNNING',
      syncType,
    },
  });
  
  const result: SyncResult = {
    success: false,
    tradesImported: 0,
    tradesSkipped: 0,
    tradesUpdated: 0,
    errors: [],
    durationMs: 0,
  };
  
  try {
    // Get provider and refresh token if needed
    const provider = getBrokerProvider(connection.brokerType);
    let accessToken = connection.accessToken;
    
    // Check if token is expired or about to expire
    if (!accessToken || (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date())) {
      // Re-authenticate
      if (!connection.encryptedApiKey || !connection.encryptedApiSecret) {
        throw new BrokerAuthError('Missing credentials for re-authentication');
      }
      
      const credentials: BrokerCredentials = {
        apiKey: decryptCredential(connection.encryptedApiKey),
        apiSecret: decryptCredential(connection.encryptedApiSecret),
      };
      
      const authResult = await provider.authenticate(credentials);
      accessToken = authResult.accessToken;
      
      // Update token in DB
      await prisma.brokerConnection.update({
        where: { id: connectionId },
        data: {
          accessToken: authResult.accessToken,
          tokenExpiresAt: authResult.expiresAt,
        },
      });
    }
    
    if (!accessToken) {
      throw new BrokerAuthError('No access token available');
    }
    
    // Fetch trades from broker
    // For manual syncs, don't filter by lastSyncAt - import ALL trades and rely on deduplication
    // This allows users to re-import historical data without issues
    // For scheduled syncs, use lastSyncAt to avoid re-processing old trades
    const sinceDate = syncType === 'scheduled' ? (connection.lastSyncAt || undefined) : undefined;
    
    const brokerTrades = await provider.getTrades(
      accessToken,
      connection.brokerAccountId!,
      sinceDate
    );
    
    // Process each trade
    for (const brokerTrade of brokerTrades) {
      try {
        const importResult = await importBrokerTrade(
          brokerTrade,
          userId,
          connection.accountId
        );
        
        if (importResult === 'imported') {
          result.tradesImported++;
        } else if (importResult === 'skipped') {
          result.tradesSkipped++;
        } else if (importResult === 'updated') {
          result.tradesUpdated++;
        }
      } catch (error) {
        result.errors.push({
          brokerTradeId: brokerTrade.brokerTradeId,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    result.success = true;
    result.durationMs = Date.now() - startTime;
    
    // Update connection
    await prisma.brokerConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: null,
      },
    });
    
    // Update sync log
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'SUCCESS',
        tradesImported: result.tradesImported,
        tradesSkipped: result.tradesSkipped,
        tradesUpdated: result.tradesUpdated,
        completedAt: new Date(),
        durationMs: result.durationMs,
      },
    });
    
  } catch (error) {
    result.durationMs = Date.now() - startTime;
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Update connection with error
    await prisma.brokerConnection.update({
      where: { id: connectionId },
      data: {
        status: error instanceof BrokerAuthError ? 'ERROR' : 'CONNECTED',
        lastSyncError: errorMessage,
      },
    });
    
    // Update sync log
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        durationMs: result.durationMs,
        errorMessage,
        errorDetails: error instanceof Error && error.stack ? { stack: error.stack } : undefined,
      },
    });
    
    throw error;
  }
  
  return result;
}

// ============================================================================
// TRADE IMPORT
// ============================================================================

async function importBrokerTrade(
  brokerTrade: BrokerTrade,
  userId: string,
  accountId: string | null
): Promise<'imported' | 'skipped' | 'updated'> {
  // Calculate trade signature for deduplication
  const signature = calculateTradeSignature({
    userId,
    accountId,
    symbol: brokerTrade.symbol,
    openedAt: brokerTrade.openedAt,
    closedAt: brokerTrade.closedAt,
    entryPrice: brokerTrade.entryPrice,
    exitPrice: brokerTrade.exitPrice,
    quantity: brokerTrade.quantity,
    realizedPnlUsd: brokerTrade.realizedPnl,
  });
  
  // IMPORTANT: Check by broker trade ID FIRST (unique per broker execution)
  // This prevents false positives from signature collisions on trades with identical parameters
  const existingByBrokerId = await prisma.trade.findFirst({
    where: {
      userId,
      importHash: `broker:${brokerTrade.brokerTradeId}`,
    },
  });
  
  if (existingByBrokerId) {
    return 'skipped';
  }
  
  // NOTE: We intentionally skip signature-based deduplication for broker imports.
  // The brokerTradeId (stored in importHash) is the authoritative identifier.
  // Signature-based dedup can cause false positives when multiple trades have
  // identical parameters (same symbol, time, price, quantity) but different executions.
  
  // Create new trade
  await prisma.trade.create({
    data: {
      userId,
      accountId,
      symbol: brokerTrade.symbol,
      direction: brokerTrade.direction,
      openedAt: brokerTrade.openedAt,
      closedAt: brokerTrade.closedAt,
      entryPrice: brokerTrade.entryPrice,
      exitPrice: brokerTrade.exitPrice,
      quantity: brokerTrade.quantity,
      realizedPnlUsd: brokerTrade.realizedPnl,
      fees: brokerTrade.fees || brokerTrade.commission || null,
      tradeSignature: signature,
      importHash: `broker:${brokerTrade.brokerTradeId}`,
    },
  });
  
  return 'imported';
}

// ============================================================================
// EXPORTS
// ============================================================================

export { BrokerType, BrokerConnectionStatus };

