/**
 * Alert System
 * Story 1.9: Production Monitoring & Alerting
 *
 * Provides alerting functionality for critical metrics.
 * Supports Slack, Discord, and email notifications.
 */

import { logger } from './logger';
import { captureMessage } from './sentry';

// ============================================================================
// Types
// ============================================================================

export type AlertLevel = 'warning' | 'critical';

export type AlertChannel = 'slack' | 'discord' | 'email' | 'sentry';

export interface Alert {
  id: string;
  name: string;
  level: AlertLevel;
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged?: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

export interface AlertRule {
  name: string;
  metricName: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  warningThreshold: number;
  criticalThreshold: number;
  channels: AlertChannel[];
  cooldownMinutes: number;
  description?: string;
}

export interface AlertConfig {
  slackWebhookUrl?: string;
  discordWebhookUrl?: string;
  emailRecipients?: string[];
  enabled: boolean;
  cooldownMinutes: number;
}

// ============================================================================
// Configuration
// ============================================================================

const config: AlertConfig = {
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
  emailRecipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(',').map((e) => e.trim()),
  enabled: process.env.NODE_ENV === 'production',
  cooldownMinutes: 15,
};

// Track last alert time per rule to implement cooldown
const alertCooldowns: Map<string, Date> = new Map();

// In-memory alert history (for dashboard display)
const alertHistory: Alert[] = [];
const MAX_ALERT_HISTORY = 100;

// ============================================================================
// Default Alert Rules
// ============================================================================

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    name: 'api_latency_p95',
    metricName: 'api.response_time.p95',
    condition: 'gt',
    warningThreshold: 1000,
    criticalThreshold: 2000,
    channels: ['slack', 'sentry'],
    cooldownMinutes: 15,
    description: 'API p95 latency exceeds threshold',
  },
  {
    name: 'error_rate',
    metricName: 'api.error_rate',
    condition: 'gt',
    warningThreshold: 0.5,
    criticalThreshold: 1.0,
    channels: ['slack', 'discord', 'sentry'],
    cooldownMinutes: 10,
    description: 'API error rate exceeds threshold',
  },
  {
    name: 'queue_depth',
    metricName: 'queue.depth',
    condition: 'gt',
    warningThreshold: 50,
    criticalThreshold: 100,
    channels: ['slack'],
    cooldownMinutes: 30,
    description: 'Queue depth exceeds threshold',
  },
  {
    name: 'db_connection_pool',
    metricName: 'db.connection_pool_usage',
    condition: 'gt',
    warningThreshold: 80,
    criticalThreshold: 95,
    channels: ['slack', 'discord', 'sentry'],
    cooldownMinutes: 5,
    description: 'Database connection pool usage exceeds threshold',
  },
  {
    name: 'ai_failures_per_minute',
    metricName: 'ai.failures_per_minute',
    condition: 'gt',
    warningThreshold: 3,
    criticalThreshold: 5,
    channels: ['slack', 'sentry'],
    cooldownMinutes: 5,
    description: 'AI API failures exceed threshold',
  },
];

// ============================================================================
// Alert Functions
// ============================================================================

/**
 * Generate a unique alert ID
 */
function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Check if an alert is in cooldown
 */
function isInCooldown(ruleName: string, cooldownMinutes: number): boolean {
  const lastAlert = alertCooldowns.get(ruleName);
  if (!lastAlert) return false;

  const cooldownMs = cooldownMinutes * 60 * 1000;
  return Date.now() - lastAlert.getTime() < cooldownMs;
}

/**
 * Check a metric value against a rule and trigger alert if needed
 */
export async function checkMetricRule(
  rule: AlertRule,
  value: number
): Promise<Alert | null> {
  // Determine alert level
  let level: AlertLevel | null = null;

  switch (rule.condition) {
    case 'gt':
      if (value > rule.criticalThreshold) level = 'critical';
      else if (value > rule.warningThreshold) level = 'warning';
      break;
    case 'gte':
      if (value >= rule.criticalThreshold) level = 'critical';
      else if (value >= rule.warningThreshold) level = 'warning';
      break;
    case 'lt':
      if (value < rule.criticalThreshold) level = 'critical';
      else if (value < rule.warningThreshold) level = 'warning';
      break;
    case 'lte':
      if (value <= rule.criticalThreshold) level = 'critical';
      else if (value <= rule.warningThreshold) level = 'warning';
      break;
    case 'eq':
      if (value === rule.criticalThreshold) level = 'critical';
      else if (value === rule.warningThreshold) level = 'warning';
      break;
  }

  if (!level) return null;

  // Check cooldown
  if (isInCooldown(rule.name, rule.cooldownMinutes)) {
    logger.debug('Alert in cooldown', { rule: rule.name, level });
    return null;
  }

  // Create alert
  const threshold = level === 'critical' ? rule.criticalThreshold : rule.warningThreshold;
  const alert: Alert = {
    id: generateAlertId(),
    name: rule.name,
    level,
    message: `${rule.description || rule.name}: ${value} ${rule.condition} ${threshold}`,
    value,
    threshold,
    timestamp: new Date(),
  };

  // Update cooldown
  alertCooldowns.set(rule.name, new Date());

  // Add to history
  alertHistory.unshift(alert);
  if (alertHistory.length > MAX_ALERT_HISTORY) {
    alertHistory.pop();
  }

  // Send notifications
  await sendAlert(alert, rule.channels);

  return alert;
}

/**
 * Send alert to configured channels
 */
async function sendAlert(alert: Alert, channels: AlertChannel[]): Promise<void> {
  if (!config.enabled) {
    logger.info('Alert triggered (notifications disabled)', { alert });
    return;
  }

  const promises: Promise<void>[] = [];

  for (const channel of channels) {
    switch (channel) {
      case 'slack':
        if (config.slackWebhookUrl) {
          promises.push(sendSlackAlert(alert));
        }
        break;
      case 'discord':
        if (config.discordWebhookUrl) {
          promises.push(sendDiscordAlert(alert));
        }
        break;
      case 'sentry':
        promises.push(sendSentryAlert(alert));
        break;
      case 'email':
        // Email sending would be implemented via email queue
        logger.info('Email alert queued', { alert: alert.id, recipients: config.emailRecipients });
        break;
    }
  }

  await Promise.allSettled(promises);
}

/**
 * Send alert to Slack
 */
async function sendSlackAlert(alert: Alert): Promise<void> {
  if (!config.slackWebhookUrl) return;

  const color = alert.level === 'critical' ? '#dc2626' : '#f59e0b';
  const emoji = alert.level === 'critical' ? ':rotating_light:' : ':warning:';

  const payload = {
    attachments: [
      {
        color,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${emoji} ${alert.level.toUpperCase()}: ${alert.name}`,
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: alert.message,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Value: *${alert.value}* | Threshold: *${alert.threshold}* | Time: ${alert.timestamp.toISOString()}`,
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    await fetch(config.slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    logger.debug('Slack alert sent', { alertId: alert.id });
  } catch (error) {
    logger.error('Failed to send Slack alert', error, { alertId: alert.id });
  }
}

/**
 * Send alert to Discord
 */
async function sendDiscordAlert(alert: Alert): Promise<void> {
  if (!config.discordWebhookUrl) return;

  const color = alert.level === 'critical' ? 0xdc2626 : 0xf59e0b;

  const payload = {
    embeds: [
      {
        title: `${alert.level === 'critical' ? '🚨' : '⚠️'} ${alert.level.toUpperCase()}: ${alert.name}`,
        description: alert.message,
        color,
        fields: [
          { name: 'Value', value: String(alert.value), inline: true },
          { name: 'Threshold', value: String(alert.threshold), inline: true },
          { name: 'Time', value: alert.timestamp.toISOString(), inline: true },
        ],
        footer: {
          text: 'Trading Path Journal',
        },
      },
    ],
  };

  try {
    await fetch(config.discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    logger.debug('Discord alert sent', { alertId: alert.id });
  } catch (error) {
    logger.error('Failed to send Discord alert', error, { alertId: alert.id });
  }
}

/**
 * Send alert to Sentry
 */
async function sendSentryAlert(alert: Alert): Promise<void> {
  captureMessage(alert.message, alert.level === 'critical' ? 'error' : 'warning', {
    alert_id: alert.id,
    alert_name: alert.name,
    value: alert.value,
    threshold: alert.threshold,
  });
  logger.debug('Sentry alert sent', { alertId: alert.id });
}

// ============================================================================
// Alert Management
// ============================================================================

/**
 * Get recent alert history
 */
export function getAlertHistory(limit: number = 50): Alert[] {
  return alertHistory.slice(0, limit);
}

/**
 * Acknowledge an alert
 */
export function acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
  const alert = alertHistory.find((a) => a.id === alertId);
  if (!alert) return false;

  alert.acknowledged = true;
  alert.acknowledgedAt = new Date();
  alert.acknowledgedBy = acknowledgedBy;

  logger.info('Alert acknowledged', { alertId, acknowledgedBy });
  return true;
}

/**
 * Get active (unacknowledged) alerts
 */
export function getActiveAlerts(): Alert[] {
  return alertHistory.filter((a) => !a.acknowledged);
}

/**
 * Clear alert history (for testing)
 */
export function clearAlertHistory(): void {
  alertHistory.length = 0;
  alertCooldowns.clear();
}

/**
 * Test alert (for verifying webhook configuration)
 */
export async function sendTestAlert(channels: AlertChannel[]): Promise<void> {
  const testAlert: Alert = {
    id: generateAlertId(),
    name: 'test_alert',
    level: 'warning',
    message: 'This is a test alert to verify webhook configuration',
    value: 0,
    threshold: 0,
    timestamp: new Date(),
  };

  await sendAlert(testAlert, channels);
  logger.info('Test alert sent', { channels });
}
