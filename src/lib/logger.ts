/**
 * Logger Service
 * 
 * Centralise tous les logs de l'application.
 * En production, seuls les logs d'erreur sont affichés.
 * En développement, tous les logs sont affichés.
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.debug('Debug info', { data });
 *   logger.info('Info message');
 *   logger.warn('Warning message');
 *   logger.error('Error message', error);
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
  enabled: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isDev = process.env.NODE_ENV === 'development';

const defaultConfig: LoggerConfig = {
  level: isDev ? 'debug' : 'error',
  prefix: '[TradingJournal]',
  enabled: true,
};

function shouldLog(level: LogLevel, config: LoggerConfig): boolean {
  if (!config.enabled) return false;
  return LOG_LEVELS[level] >= LOG_LEVELS[config.level];
}

function formatMessage(level: LogLevel, prefix: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `${timestamp} ${prefix} [${level.toUpperCase()}] ${message}`;
}

class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Debug level - only in development
   */
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog('debug', this.config)) {
      console.log(formatMessage('debug', this.config.prefix || '', message), ...args);
    }
  }

  /**
   * Info level - general information
   */
  info(message: string, ...args: unknown[]): void {
    if (shouldLog('info', this.config)) {
      console.info(formatMessage('info', this.config.prefix || '', message), ...args);
    }
  }

  /**
   * Warn level - warnings
   */
  warn(message: string, ...args: unknown[]): void {
    if (shouldLog('warn', this.config)) {
      console.warn(formatMessage('warn', this.config.prefix || '', message), ...args);
    }
  }

  /**
   * Error level - errors (always shown)
   */
  error(message: string, error?: unknown, ...args: unknown[]): void {
    if (shouldLog('error', this.config)) {
      console.error(formatMessage('error', this.config.prefix || '', message), error, ...args);
    }
  }

  /**
   * Create a child logger with a custom prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      ...this.config,
      prefix: `${this.config.prefix}[${prefix}]`,
    });
  }
}

// Singleton instance
export const logger = new Logger();

// Named loggers for specific modules
export const authLogger = logger.child('Auth');
export const tradeLogger = logger.child('Trade');
export const importLogger = logger.child('Import');
export const brokerLogger = logger.child('Broker');
export const stripeLogger = logger.child('Stripe');
export const ocrLogger = logger.child('OCR');
export const voiceLogger = logger.child('Voice');
export const coachLogger = logger.child('Coach');

export default logger;

