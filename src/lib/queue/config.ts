/**
 * Queue Configuration
 * Story 1.7: Redis (Upstash) Production Deployment
 *
 * Production configuration for all queues with rate limiting,
 * retry strategies, and concurrency settings.
 */

import type { QueueOptions, WorkerOptions, JobsOptions } from 'bullmq';

// ============================================================================
// Queue Names
// ============================================================================

export const QUEUE_NAMES = {
  /** Broker sync jobs (fetch trades from broker APIs) */
  BROKER_SYNC: 'broker-sync',
  /** Import processing jobs (CSV parsing, trade creation) */
  IMPORT: 'import',
  /** AI processing jobs (coach feedback, embeddings) */
  AI: 'ai',
  /** Email notifications (transactional emails) */
  EMAIL: 'email',
  /** General background tasks */
  DEFAULT: 'default',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ============================================================================
// Queue Configurations
// ============================================================================

export interface QueueConfig {
  /** Worker concurrency (parallel jobs) */
  concurrency: number;
  /** Rate limiter configuration */
  limiter?: {
    /** Max jobs per duration */
    max: number;
    /** Duration in milliseconds */
    duration: number;
  };
  /** Default job options */
  defaultJobOptions: JobsOptions;
  /** Worker-specific options */
  workerOptions?: Partial<WorkerOptions>;
}

/**
 * Production queue configurations
 * Based on Story 1.7 Technical Notes
 */
export const QUEUE_CONFIGS: Record<QueueName, QueueConfig> = {
  /**
   * Broker Sync Queue
   * - High priority: broker APIs may have rate limits
   * - Low concurrency: avoid hitting broker rate limits
   * - More retries: network issues are common
   */
  [QUEUE_NAMES.BROKER_SYNC]: {
    concurrency: 2,
    limiter: {
      max: 10,
      duration: 60000, // 10 jobs per minute
    },
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000, // Start with 5 seconds
      },
      removeOnComplete: {
        count: 100,
        age: 24 * 3600, // 24 hours
      },
      removeOnFail: {
        count: 1000,
        age: 7 * 24 * 3600, // 7 days
      },
      priority: 1, // High priority
    },
  },

  /**
   * Import Queue
   * - Medium priority: user-triggered action
   * - Medium concurrency: balance between speed and resources
   * - Standard retries: file parsing errors usually don't resolve with retries
   */
  [QUEUE_NAMES.IMPORT]: {
    concurrency: 3,
    limiter: {
      max: 5,
      duration: 60000, // 5 jobs per minute
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        count: 200,
        age: 24 * 3600,
      },
      removeOnFail: {
        count: 500,
        age: 7 * 24 * 3600,
      },
      priority: 2,
    },
  },

  /**
   * AI Queue
   * - Medium priority: user-facing but async
   * - Higher concurrency: API calls are mostly I/O bound
   * - Standard retries: API errors may be transient
   */
  [QUEUE_NAMES.AI]: {
    concurrency: 5,
    limiter: {
      max: 20,
      duration: 60000, // 20 jobs per minute
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        count: 500,
        age: 12 * 3600, // 12 hours
      },
      removeOnFail: {
        count: 200,
        age: 3 * 24 * 3600, // 3 days
      },
      priority: 3,
    },
  },

  /**
   * Email Queue
   * - Lower priority: notifications can wait
   * - High concurrency: email sending is fast
   * - Fixed backoff: email services often have rate limits
   */
  [QUEUE_NAMES.EMAIL]: {
    concurrency: 10,
    limiter: {
      max: 100,
      duration: 60000, // 100 jobs per minute
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'fixed',
        delay: 5000,
      },
      removeOnComplete: {
        count: 1000,
        age: 24 * 3600,
      },
      removeOnFail: {
        count: 500,
        age: 7 * 24 * 3600,
      },
      priority: 5,
    },
  },

  /**
   * Default Queue
   * - Lowest priority: background tasks
   * - Medium concurrency: general purpose
   */
  [QUEUE_NAMES.DEFAULT]: {
    concurrency: 5,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        count: 100,
        age: 24 * 3600,
      },
      removeOnFail: {
        count: 100,
        age: 7 * 24 * 3600,
      },
      priority: 10,
    },
  },
};

// ============================================================================
// Dead Letter Queue Configuration
// ============================================================================

export const DLQ_CONFIG = {
  /** Prefix for DLQ queues */
  prefix: 'dlq',
  /** Max age for DLQ jobs (30 days) */
  maxAge: 30 * 24 * 3600,
  /** Max count of DLQ jobs per queue */
  maxCount: 10000,
};

/**
 * Get DLQ name for a queue
 */
export function getDLQName(queueName: QueueName): string {
  return `${DLQ_CONFIG.prefix}:${queueName}`;
}

// ============================================================================
// Queue Options Builder
// ============================================================================

/**
 * Build BullMQ QueueOptions from our config
 */
export function buildQueueOptions(queueName: QueueName): Partial<QueueOptions> {
  const config = QUEUE_CONFIGS[queueName];

  return {
    defaultJobOptions: config.defaultJobOptions,
  };
}

/**
 * Build BullMQ WorkerOptions from our config
 */
export function buildWorkerOptions(queueName: QueueName): Partial<WorkerOptions> {
  const config = QUEUE_CONFIGS[queueName];

  return {
    concurrency: config.concurrency,
    limiter: config.limiter,
    ...config.workerOptions,
  };
}

// ============================================================================
// Job Type Constants
// ============================================================================

export const JOB_TYPES = {
  // Broker sync jobs
  BROKER_SYNC_FETCH: 'broker-sync:fetch',
  BROKER_SYNC_SCHEDULED: 'broker-sync:scheduled',

  // Import jobs
  IMPORT_CSV: 'import:csv',
  IMPORT_VALIDATE: 'import:validate',

  // AI jobs
  AI_COACH_FEEDBACK: 'ai:coach-feedback',
  AI_TRADE_ANALYSIS: 'ai:trade-analysis',
  AI_GENERATE_EMBEDDING: 'ai:generate-embedding',
  AI_DAILY_BIAS: 'ai:daily-bias',

  // Email jobs
  EMAIL_WELCOME: 'email:welcome',
  EMAIL_SUBSCRIPTION: 'email:subscription',
  EMAIL_NOTIFICATION: 'email:notification',
  EMAIL_ADMIN_ACTION: 'email:admin-action',

  // Default jobs
  DEFAULT_CLEANUP: 'default:cleanup',
  DEFAULT_MAINTENANCE: 'default:maintenance',
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];
