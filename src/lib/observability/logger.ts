/**
 * Enhanced Logger Service with External Sink Support
 * Story 1.9: Production Monitoring & Alerting
 *
 * Features:
 * - Structured JSON logging
 * - Request ID tracking across logs
 * - External sink support (Axiom/Logtail, Sentry)
 * - Log levels with filtering
 * - Context propagation
 * - Performance metrics
 * - Batched log shipping for efficiency
 *
 * Usage:
 *   import { logger, withRequestId } from '@/lib/observability/logger';
 *   logger.info('User logged in', { userId: '123' });
 *   logger.error('Payment failed', { error, orderId: '456' });
 *
 *   // With request ID tracking
 *   const reqLogger = withRequestId(requestId);
 *   reqLogger.info('Processing request');
 */

import { captureException, captureMessage } from './sentry';

// ============================================================================
// Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  service?: string;
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel;
  /** Service name prefix */
  service: string;
  /** Enable console output */
  console: boolean;
  /** Enable Sentry error tracking */
  sentry: boolean;
  /** Enable external log sink (Axiom/Logtail) */
  externalSink: boolean;
  /** Pretty print in development */
  pretty: boolean;
  /** Request ID for tracing */
  requestId?: string;
  /** User ID for correlation */
  userId?: string;
}

// ============================================================================
// Constants
// ============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isDev = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

const defaultConfig: LoggerConfig = {
  level: isDev ? 'debug' : 'info',
  service: 'trading-journal',
  console: !isTest,
  sentry: !isDev && !isTest,
  externalSink: !isDev && !isTest,
  pretty: isDev,
};

// ============================================================================
// Log Buffer for Batching
// ============================================================================

const LOG_BUFFER: LogEntry[] = [];
const BUFFER_FLUSH_INTERVAL = 5000; // 5 seconds
const BUFFER_MAX_SIZE = 50;

let flushTimer: NodeJS.Timeout | null = null;

function startFlushTimer() {
  if (flushTimer || isDev || isTest) return;

  flushTimer = setInterval(() => {
    flushLogBuffer();
  }, BUFFER_FLUSH_INTERVAL);
}

async function flushLogBuffer(): Promise<void> {
  if (LOG_BUFFER.length === 0) return;

  const entries = LOG_BUFFER.splice(0, LOG_BUFFER.length);
  await sendToExternalSink(entries);
}

// ============================================================================
// External Sink (Axiom/Logtail compatible)
// ============================================================================

/**
 * Send logs to external sink (Axiom, Logtail, etc.)
 * Uses the AXIOM_TOKEN and AXIOM_DATASET env vars
 * Supports batched ingestion for efficiency
 */
async function sendToExternalSink(entries: LogEntry[]): Promise<void> {
  const token = process.env.AXIOM_TOKEN || process.env.LOGTAIL_TOKEN;
  const dataset = process.env.AXIOM_DATASET || 'trading-journal';
  const ingestUrl = process.env.AXIOM_INGEST_URL || 'https://api.axiom.co/v1/datasets';

  if (!token || entries.length === 0) return;

  try {
    await fetch(`${ingestUrl}/${dataset}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(entries),
    });
  } catch {
    // Silently fail - don't break the app for logging issues
  }
}

/**
 * Queue a log entry for batched sending
 */
function queueLogEntry(entry: LogEntry): void {
  LOG_BUFFER.push(entry);

  // Flush immediately if buffer is full
  if (LOG_BUFFER.length >= BUFFER_MAX_SIZE) {
    flushLogBuffer();
  }

  // Start the flush timer if not running
  startFlushTimer();
}

// ============================================================================
// Request ID Generation
// ============================================================================

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `req_${timestamp}_${random}`;
}

// ============================================================================
// Logger Class
// ============================================================================

class Logger {
  private config: LoggerConfig;
  private contextStack: LogContext[] = [];

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  // --------------------------------------------------------------------------
  // Log Methods
  // --------------------------------------------------------------------------

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorInfo = this.extractError(error);
    this.log('error', message, { ...context, error: errorInfo });

    // Send to Sentry
    if (this.config.sentry && error instanceof Error) {
      captureException(error, { ...this.getMergedContext(), ...context });
    }
  }

  // --------------------------------------------------------------------------
  // Context Management
  // --------------------------------------------------------------------------

  /**
   * Add context that will be included in all subsequent logs
   */
  withContext(context: LogContext): Logger {
    const child = new Logger(this.config);
    child.contextStack = [...this.contextStack, context];
    return child;
  }

  /**
   * Create a child logger with a service name
   */
  child(service: string): Logger {
    const child = new Logger({
      ...this.config,
      service: `${this.config.service}:${service}`,
    });
    child.contextStack = [...this.contextStack];
    return child;
  }

  /**
   * Create a child logger with a request ID
   */
  withRequestId(requestId: string): Logger {
    const child = new Logger({
      ...this.config,
      requestId,
    });
    child.contextStack = [...this.contextStack];
    return child;
  }

  /**
   * Create a child logger with a user ID
   */
  withUserId(userId: string): Logger {
    const child = new Logger({
      ...this.config,
      userId,
    });
    child.contextStack = [...this.contextStack];
    return child;
  }

  /**
   * Get the current request ID
   */
  getRequestId(): string | undefined {
    return this.config.requestId;
  }

  // --------------------------------------------------------------------------
  // Performance Timing
  // --------------------------------------------------------------------------

  /**
   * Start a timer for measuring operation duration
   */
  startTimer(operation: string): () => void {
    const start = performance.now();
    return () => {
      const duration = Math.round(performance.now() - start);
      this.info(`${operation} completed`, { duration, operation });
    };
  }

  /**
   * Measure async operation duration
   */
  async time<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const end = this.startTimer(operation);
    try {
      const result = await fn();
      end();
      return result;
    } catch (error) {
      this.error(`${operation} failed`, error);
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private getMergedContext(): LogContext {
    return this.contextStack.reduce((acc, ctx) => ({ ...acc, ...ctx }), {});
  }

  private extractError(error: unknown): LogEntry['error'] | undefined {
    if (!error) return undefined;

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return {
      name: 'UnknownError',
      message: String(error),
    };
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.config.service,
      requestId: this.config.requestId,
      userId: this.config.userId,
      context: { ...this.getMergedContext(), ...context },
    };

    // Console output
    if (this.config.console) {
      this.outputToConsole(entry);
    }

    // External sink (batched for efficiency)
    if (this.config.externalSink) {
      queueLogEntry(entry);
    }

    // Sentry for warnings and above
    if (this.config.sentry && level === 'warn') {
      captureMessage(message, 'warning', entry.context);
    }
  }

  private outputToConsole(entry: LogEntry): void {
    const { level, message, context, service, timestamp } = entry;

    if (this.config.pretty) {
      // Pretty format for development
      const prefix = `[${service}]`;
      const time = timestamp.split('T')[1]?.slice(0, 8) || timestamp;

      switch (level) {
        case 'debug':
          console.log(`\x1b[90m${time} ${prefix} ${message}\x1b[0m`, context || '');
          break;
        case 'info':
          console.info(`\x1b[36m${time} ${prefix}\x1b[0m ${message}`, context || '');
          break;
        case 'warn':
          console.warn(`\x1b[33m${time} ${prefix}\x1b[0m ${message}`, context || '');
          break;
        case 'error':
          console.error(`\x1b[31m${time} ${prefix}\x1b[0m ${message}`, context || '');
          break;
      }
    } else {
      // JSON format for production
      console.log(JSON.stringify(entry));
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

/** Main logger instance */
export const logger = new Logger();

/** Named loggers for specific modules */
export const authLogger = logger.child('auth');
export const tradeLogger = logger.child('trade');
export const importLogger = logger.child('import');
export const brokerLogger = logger.child('broker');
export const stripeLogger = logger.child('stripe');
export const ocrLogger = logger.child('ocr');
export const voiceLogger = logger.child('voice');
export const coachLogger = logger.child('coach');
export const queueLogger = logger.child('queue');
export const apiLogger = logger.child('api');

/**
 * Create a request-scoped logger with a request ID
 * Use this in API routes and server actions
 */
export function withRequestId(requestId?: string): Logger {
  const id = requestId || generateRequestId();
  return logger.withRequestId(id);
}

/**
 * Create a request-scoped logger with user context
 */
export function withUserContext(userId: string, requestId?: string): Logger {
  const id = requestId || generateRequestId();
  return logger.withRequestId(id).withUserId(userId);
}

/**
 * Flush any pending log entries
 * Call this before process exit or in cleanup handlers
 */
export async function flushLogs(): Promise<void> {
  await flushLogBuffer();
}

/**
 * Log an API request with structured format
 */
export function logApiRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  options?: {
    requestId?: string;
    userId?: string;
    error?: Error;
  }
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: statusCode >= 400 ? 'error' : 'info',
    message: `${method} ${path} ${statusCode}`,
    service: 'trading-journal:api',
    requestId: options?.requestId,
    userId: options?.userId,
    path,
    method,
    statusCode,
    durationMs,
  };

  if (options?.error) {
    entry.error = {
      name: options.error.name,
      message: options.error.message,
      stack: options.error.stack,
    };
  }

  // Console output
  if (!isTest) {
    if (isDev) {
      const color = statusCode >= 500 ? '\x1b[31m' : statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
      console.log(`${color}${method} ${path} ${statusCode} ${durationMs}ms\x1b[0m`);
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  // Queue for external sink
  if (!isDev && !isTest) {
    queueLogEntry(entry);
  }
}

export default logger;
export { Logger };
