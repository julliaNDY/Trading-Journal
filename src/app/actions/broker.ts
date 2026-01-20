'use server';

import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/auth';
import { BrokerType } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  connectBroker,
  disconnectBroker,
  getBrokerConnections,
  syncBrokerTrades,
  BrokerAuthError,
} from '@/services/broker';

// ============================================================================
// GET CONNECTIONS
// ============================================================================

export async function getUserBrokerConnections(options?: {
  page?: number;
  pageSize?: number;
}) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');
  
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;
  const skip = (page - 1) * pageSize;
  
  const [connections, totalCount] = await Promise.all([
    getBrokerConnections(user.id, { skip, take: pageSize }),
    prisma.brokerConnection.count({ where: { userId: user.id } }),
  ]);
  
  return {
    connections: connections.map(conn => ({
      id: conn.id,
      brokerType: conn.brokerType,
      status: conn.status,
      brokerAccountId: conn.brokerAccountId,
      brokerAccountName: conn.brokerAccountName,
      syncEnabled: conn.syncEnabled,
      syncIntervalMin: conn.syncIntervalMin,
      lastSyncAt: conn.lastSyncAt?.toISOString() || null,
      lastSyncError: conn.lastSyncError,
      linkedAccount: conn.account ? {
        id: conn.account.id,
        name: conn.account.name,
        color: conn.account.color,
      } : null,
      recentSyncs: conn.syncLogs.map(log => ({
        id: log.id,
        status: log.status,
        tradesImported: log.tradesImported,
        tradesSkipped: log.tradesSkipped,
        startedAt: log.startedAt.toISOString(),
        completedAt: log.completedAt?.toISOString() || null,
        durationMs: log.durationMs,
        errorMessage: log.errorMessage,
      })),
    })),
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
}

// ============================================================================
// CONNECT BROKER
// ============================================================================

export interface ConnectBrokerFormData {
  brokerType: BrokerType;
  apiKey: string;
  apiSecret: string;
  accountId?: string;
  environment?: 'demo' | 'live';
}

export async function connectBrokerAction(data: ConnectBrokerFormData) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');
  
  try {
    const result = await connectBroker({
      userId: user.id,
      brokerType: data.brokerType,
      apiKey: data.apiKey,
      apiSecret: data.apiSecret,
      accountId: data.accountId,
      environment: data.environment,
    });
    
    revalidatePath('/comptes');
    revalidatePath('/comptes/brokers');
    revalidatePath('/trades');
    revalidatePath('/dashboard');
    
    return {
      success: true,
      connectionId: result.connectionId,
      brokerAccounts: result.brokerAccounts,
    };
  } catch (error) {
    if (error instanceof BrokerAuthError) {
      return {
        success: false,
        error: 'auth_failed',
        message: error.message,
      };
    }
    
    return {
      success: false,
      error: 'unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// DISCONNECT BROKER
// ============================================================================

export async function disconnectBrokerAction(connectionId: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');
  
  try {
    await disconnectBroker(connectionId, user.id);
    
    revalidatePath('/comptes');
    revalidatePath('/comptes/brokers');
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// SYNC TRADES
// ============================================================================

export async function syncBrokerTradesAction(connectionId: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');
  
  try {
    const result = await syncBrokerTrades(connectionId, user.id, 'manual');
    
    revalidatePath('/comptes');
    revalidatePath('/comptes/brokers');
    revalidatePath('/trades');
    revalidatePath('/journal');
    revalidatePath('/dashboard');
    revalidatePath('/statistiques');
    revalidatePath('/calendrier');
    
    return {
      success: true,
      tradesImported: result.tradesImported,
      tradesSkipped: result.tradesSkipped,
      tradesUpdated: result.tradesUpdated,
      durationMs: result.durationMs,
      errors: result.errors,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// UPDATE SYNC SETTINGS
// ============================================================================

export async function updateBrokerSyncSettings(
  connectionId: string,
  settings: {
    syncEnabled?: boolean;
    syncIntervalMin?: number;
    accountId?: string | null;
  }
) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');
  
  const connection = await prisma.brokerConnection.findFirst({
    where: { id: connectionId, userId: user.id },
  });
  
  if (!connection) {
    throw new Error('Broker connection not found');
  }
  
  await prisma.brokerConnection.update({
    where: { id: connectionId },
    data: {
      syncEnabled: settings.syncEnabled,
      syncIntervalMin: settings.syncIntervalMin,
      accountId: settings.accountId,
    },
  });
  
  revalidatePath('/comptes');
  revalidatePath('/comptes/brokers');
  
  return { success: true };
}

