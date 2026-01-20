/**
 * Broker Sync Monitoring Service
 * 
 * Tracks sync success rates, performance metrics, and alerts.
 * Story 3.4 AC6: Success rate > 95% required
 */

import prisma from '@/lib/prisma';
import { BrokerType, SyncStatus } from '@prisma/client';
import { brokerLogger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface SyncMetrics {
  brokerType: BrokerType;
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  successRate: number;
  avgDurationMs: number;
  avgTradesImported: number;
  lastSyncAt: Date | null;
  lastError: string | null;
}

export interface BrokerHealthStatus {
  brokerType: BrokerType;
  status: 'healthy' | 'degraded' | 'unhealthy';
  successRate: number;
  recentErrors: string[];
  recommendation: string;
}

export interface AlertConfig {
  successRateThreshold: number; // Default: 0.95 (95%)
  minSyncsForAlert: number; // Default: 10 (need at least 10 syncs before alerting)
  alertCooldownMs: number; // Default: 3600000 (1 hour)
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_ALERT_CONFIG: AlertConfig = {
  successRateThreshold: 0.95, // 95%
  minSyncsForAlert: 10,
  alertCooldownMs: 3600000, // 1 hour
};

// In-memory cache for alert cooldowns
const alertCooldowns = new Map<BrokerType, number>();

// ============================================================================
// METRICS CALCULATION
// ============================================================================

/**
 * Calculate sync metrics for a specific broker type
 */
export async function calculateBrokerMetrics(
  brokerType: BrokerType,
  since?: Date
): Promise<SyncMetrics> {
  const whereClause: any = {
    brokerConnection: {
      brokerType,
    },
  };
  
  if (since) {
    whereClause.startedAt = {
      gte: since,
    };
  }
  
  const syncLogs = await prisma.syncLog.findMany({
    where: whereClause,
    orderBy: { startedAt: 'desc' },
  });
  
  const totalSyncs = syncLogs.length;
  const successfulSyncs = syncLogs.filter(log => log.status === 'SUCCESS').length;
  const failedSyncs = syncLogs.filter(log => log.status === 'FAILED').length;
  const successRate = totalSyncs > 0 ? successfulSyncs / totalSyncs : 0;
  
  const completedSyncs = syncLogs.filter(log => log.durationMs !== null);
  const avgDurationMs = completedSyncs.length > 0
    ? completedSyncs.reduce((sum, log) => sum + (log.durationMs || 0), 0) / completedSyncs.length
    : 0;
  
  const avgTradesImported = successfulSyncs > 0
    ? syncLogs
        .filter(log => log.status === 'SUCCESS')
        .reduce((sum, log) => sum + log.tradesImported, 0) / successfulSyncs
    : 0;
  
  const lastSync = syncLogs[0];
  const lastSyncAt = lastSync?.startedAt || null;
  const lastError = lastSync?.status === 'FAILED' ? lastSync.errorMessage : null;
  
  return {
    brokerType,
    totalSyncs,
    successfulSyncs,
    failedSyncs,
    successRate,
    avgDurationMs,
    avgTradesImported,
    lastSyncAt,
    lastError,
  };
}

/**
 * Calculate metrics for all broker types
 */
export async function calculateAllBrokerMetrics(
  since?: Date
): Promise<SyncMetrics[]> {
  const brokerTypes = Object.values(BrokerType);
  const metrics = await Promise.all(
    brokerTypes.map(brokerType => calculateBrokerMetrics(brokerType, since))
  );
  
  return metrics.filter(m => m.totalSyncs > 0); // Only return brokers with data
}

// ============================================================================
// HEALTH STATUS
// ============================================================================

/**
 * Determine health status for a broker based on metrics
 */
export function determineBrokerHealth(
  metrics: SyncMetrics,
  config: AlertConfig = DEFAULT_ALERT_CONFIG
): BrokerHealthStatus {
  const { successRate, totalSyncs, lastError } = metrics;
  
  // Not enough data yet
  if (totalSyncs < config.minSyncsForAlert) {
    return {
      brokerType: metrics.brokerType,
      status: 'healthy',
      successRate,
      recentErrors: lastError ? [lastError] : [],
      recommendation: `Monitoring (${totalSyncs}/${config.minSyncsForAlert} syncs)`,
    };
  }
  
  // Determine status
  let status: 'healthy' | 'degraded' | 'unhealthy';
  let recommendation: string;
  
  if (successRate >= config.successRateThreshold) {
    status = 'healthy';
    recommendation = 'No action needed';
  } else if (successRate >= config.successRateThreshold - 0.1) {
    status = 'degraded';
    recommendation = 'Monitor closely, investigate recent failures';
  } else {
    status = 'unhealthy';
    recommendation = 'URGENT: Investigate and fix integration';
  }
  
  // Get recent errors
  const recentErrors: string[] = [];
  if (lastError) {
    recentErrors.push(lastError);
  }
  
  return {
    brokerType: metrics.brokerType,
    status,
    successRate,
    recentErrors,
    recommendation,
  };
}

/**
 * Get health status for all brokers
 */
export async function getAllBrokerHealthStatus(
  since?: Date,
  config?: AlertConfig
): Promise<BrokerHealthStatus[]> {
  const metrics = await calculateAllBrokerMetrics(since);
  return metrics.map(m => determineBrokerHealth(m, config));
}

// ============================================================================
// ALERTING
// ============================================================================

/**
 * Check if an alert should be sent for a broker
 */
export function shouldSendAlert(
  brokerType: BrokerType,
  health: BrokerHealthStatus,
  config: AlertConfig = DEFAULT_ALERT_CONFIG
): boolean {
  // Don't alert if healthy
  if (health.status === 'healthy') {
    return false;
  }
  
  // Check cooldown
  const lastAlertTime = alertCooldowns.get(brokerType);
  if (lastAlertTime && Date.now() - lastAlertTime < config.alertCooldownMs) {
    return false; // Still in cooldown
  }
  
  return true;
}

/**
 * Send alert for unhealthy broker
 */
export async function sendBrokerAlert(
  health: BrokerHealthStatus
): Promise<void> {
  const { brokerType, status, successRate, recentErrors, recommendation } = health;
  
  const alertMessage = `
🚨 Broker Sync Alert: ${brokerType}

Status: ${status.toUpperCase()}
Success Rate: ${(successRate * 100).toFixed(2)}%
Recommendation: ${recommendation}

Recent Errors:
${recentErrors.map(err => `- ${err}`).join('\n') || 'None'}

Action Required: ${status === 'unhealthy' ? 'URGENT' : 'Monitor'}
  `.trim();
  
  // Log alert
  brokerLogger.error(`[Broker Monitoring] ${alertMessage}`);
  
  // TODO: Send to alerting system (Sentry, email, Slack, etc.)
  // For now, just log
  
  // Update cooldown
  alertCooldowns.set(brokerType, Date.now());
}

/**
 * Check all brokers and send alerts if needed
 */
export async function checkAndAlert(
  since?: Date,
  config?: AlertConfig
): Promise<void> {
  const healthStatuses = await getAllBrokerHealthStatus(since, config);
  
  for (const health of healthStatuses) {
    if (shouldSendAlert(health.brokerType, health, config)) {
      await sendBrokerAlert(health);
    }
  }
}

// ============================================================================
// REPORTING
// ============================================================================

/**
 * Generate a summary report of all broker sync metrics
 */
export async function generateSyncReport(since?: Date): Promise<string> {
  const metrics = await calculateAllBrokerMetrics(since);
  
  if (metrics.length === 0) {
    return 'No sync data available.';
  }
  
  const lines: string[] = [
    '📊 Broker Sync Report',
    '=' .repeat(80),
    '',
  ];
  
  for (const m of metrics) {
    const health = determineBrokerHealth(m);
    const statusEmoji = health.status === 'healthy' ? '✅' : health.status === 'degraded' ? '⚠️' : '❌';
    
    lines.push(`${statusEmoji} ${m.brokerType}`);
    lines.push(`   Success Rate: ${(m.successRate * 100).toFixed(2)}% (${m.successfulSyncs}/${m.totalSyncs})`);
    lines.push(`   Avg Duration: ${(m.avgDurationMs / 1000).toFixed(2)}s`);
    lines.push(`   Avg Trades: ${m.avgTradesImported.toFixed(1)} per sync`);
    lines.push(`   Last Sync: ${m.lastSyncAt ? m.lastSyncAt.toISOString() : 'Never'}`);
    if (m.lastError) {
      lines.push(`   Last Error: ${m.lastError}`);
    }
    lines.push('');
  }
  
  // Overall stats
  const totalSyncs = metrics.reduce((sum, m) => sum + m.totalSyncs, 0);
  const totalSuccessful = metrics.reduce((sum, m) => sum + m.successfulSyncs, 0);
  const overallSuccessRate = totalSyncs > 0 ? totalSuccessful / totalSyncs : 0;
  
  lines.push('=' .repeat(80));
  lines.push(`Overall Success Rate: ${(overallSuccessRate * 100).toFixed(2)}%`);
  lines.push(`Total Syncs: ${totalSyncs}`);
  lines.push(`Total Brokers: ${metrics.length}`);
  
  return lines.join('\n');
}

/**
 * Get sync metrics for a specific connection
 */
export async function getConnectionMetrics(
  connectionId: string
): Promise<{
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  successRate: number;
  avgDurationMs: number;
  recentSyncs: Array<{
    id: string;
    status: SyncStatus;
    startedAt: Date;
    durationMs: number | null;
    tradesImported: number;
    errorMessage: string | null;
  }>;
}> {
  const syncLogs = await prisma.syncLog.findMany({
    where: { brokerConnectionId: connectionId },
    orderBy: { startedAt: 'desc' },
    take: 20, // Last 20 syncs
  });
  
  const totalSyncs = syncLogs.length;
  const successfulSyncs = syncLogs.filter(log => log.status === 'SUCCESS').length;
  const failedSyncs = syncLogs.filter(log => log.status === 'FAILED').length;
  const successRate = totalSyncs > 0 ? successfulSyncs / totalSyncs : 0;
  
  const completedSyncs = syncLogs.filter(log => log.durationMs !== null);
  const avgDurationMs = completedSyncs.length > 0
    ? completedSyncs.reduce((sum, log) => sum + (log.durationMs || 0), 0) / completedSyncs.length
    : 0;
  
  const recentSyncs = syncLogs.slice(0, 10).map(log => ({
    id: log.id,
    status: log.status,
    startedAt: log.startedAt,
    durationMs: log.durationMs,
    tradesImported: log.tradesImported,
    errorMessage: log.errorMessage,
  }));
  
  return {
    totalSyncs,
    successfulSyncs,
    failedSyncs,
    successRate,
    avgDurationMs,
    recentSyncs,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  DEFAULT_ALERT_CONFIG,
};
