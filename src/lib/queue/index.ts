/**
 * Queue Module
 * Story 1.7: Redis (Upstash) Production Deployment
 *
 * Centralized exports for Redis and BullMQ infrastructure.
 */

// ============================================================================
// Configuration
// ============================================================================

export {
  QUEUE_NAMES,
  QUEUE_CONFIGS,
  JOB_TYPES,
  DLQ_CONFIG,
  getDLQName,
  buildQueueOptions,
  buildWorkerOptions,
  type QueueName,
  type QueueConfig,
  type JobType,
} from './config';

// ============================================================================
// Redis
// ============================================================================

export {
  getRedisConnection,
  isRedisConfigured,
  testRedisConnection,
  createBullMQConnection,
  disconnectRedis,
  getRedisInfo,
} from './redis';

// ============================================================================
// Queues
// ============================================================================

export {
  getQueue,
  getDLQ,
  getQueueEvents,
  addJob,
  addScheduledJob,
  addRepeatingJob,
  moveToDLQ,
  getQueueStats,
  getAllQueueStats,
  pauseQueue,
  resumeQueue,
  closeAllQueues,
} from './queues';

// ============================================================================
// Workers
// ============================================================================

export {
  createWorker,
  closeAllWorkers,
  gracefulShutdown,
  registerShutdownHandlers,
  getWorkerStatus,
  hasRunningWorkers,
  getWorker,
  pauseWorker,
  resumeWorker,
  type JobResult,
  type JobProcessor,
} from './worker';

// ============================================================================
// Dashboard & Monitoring
// ============================================================================

export {
  getDashboardData,
  getQueueHealthCheck,
  exportPrometheusMetrics,
  checkQueueAlerts,
  type DashboardData,
  type QueueMetrics,
  type QueueHealthCheck,
  type QueueAlert,
} from './dashboard';

// ============================================================================
// Jobs
// ============================================================================

// Test Job (from POC)
export {
  processTestJob,
  TEST_JOB_NAME,
  type TestJobData,
  type TestJobResult,
} from './jobs/test-job';

// Broker Sync Jobs
export {
  processBrokerSyncJob,
  BROKER_SYNC_JOBS,
  type BrokerSyncJobData,
  type BrokerSyncJobResult,
} from './jobs/broker-sync-job';

// Import Jobs
export {
  processImportJob,
  IMPORT_JOBS,
  type ImportJobData,
  type ImportJobResult,
} from './jobs/import-job';

// AI Jobs
export {
  processAICoachFeedbackJob,
  processAIGenerateEmbeddingJob,
  processAITradeAnalysisJob,
  AI_JOBS,
  type AICoachFeedbackJobData,
  type AICoachFeedbackJobResult,
  type AIGenerateEmbeddingJobData,
  type AIGenerateEmbeddingJobResult,
  type AITradeAnalysisJobData,
  type AITradeAnalysisJobResult,
} from './jobs/ai-job';

// Email Jobs
export {
  processEmailJob,
  EMAIL_JOBS,
  createWelcomeEmailData,
  createSubscriptionEmailData,
  createAdminActionEmailData,
  type EmailJobData,
  type EmailJobResult,
  type WelcomeEmailData,
  type SubscriptionEmailData,
  type AdminActionEmailData,
} from './jobs/email-job';
