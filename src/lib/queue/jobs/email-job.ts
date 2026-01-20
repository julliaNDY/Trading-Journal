/**
 * Email Jobs
 * Story 1.7: Redis (Upstash) Production Deployment
 *
 * Email notification jobs using Resend/SendGrid.
 */

import type { Job } from 'bullmq';
import { logger } from '@/lib/observability';
import { JOB_TYPES } from '../config';

// ============================================================================
// Types
// ============================================================================

export interface EmailJobData {
  /** Recipient email */
  to: string;
  /** Email subject */
  subject: string;
  /** Email type */
  type: 'welcome' | 'subscription' | 'notification' | 'admin-action';
  /** Template data */
  data: Record<string, unknown>;
  /** Optional sender override */
  from?: string;
  /** Optional reply-to */
  replyTo?: string;
}

export interface EmailJobResult {
  success: boolean;
  messageId?: string;
  error?: string;
  durationMs: number;
}

// ============================================================================
// Email Templates
// ============================================================================

export interface WelcomeEmailData {
  userName: string;
  loginUrl: string;
}

export interface SubscriptionEmailData {
  userName: string;
  planName: string;
  action: 'created' | 'renewed' | 'canceled' | 'expired' | 'upgraded';
  expiresAt?: string;
  amount?: number;
  currency?: string;
}

export interface NotificationEmailData {
  userName: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}

export interface AdminActionEmailData {
  userName: string;
  action: 'blocked' | 'unblocked' | 'subscription-extended' | 'subscription-modified' | 'promoted';
  adminComment?: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Job Processor
// ============================================================================

/**
 * Process email job
 */
export async function processEmailJob(
  job: Job<EmailJobData>
): Promise<EmailJobResult> {
  const startTime = performance.now();
  const { to, subject, type, data } = job.data;

  logger.info('Processing email job', {
    jobId: job.id,
    to,
    type,
    subject,
  });

  try {
    await job.updateProgress(10);

    // TODO: Integrate with email service (Resend/SendGrid)
    // 1. Load email template
    // 2. Render with data
    // 3. Send via Resend/SendGrid API
    // 4. Return message ID

    // Check for required environment variables
    const resendApiKey = process.env.RESEND_API_KEY;
    const sendgridApiKey = process.env.SENDGRID_API_KEY;

    if (!resendApiKey && !sendgridApiKey) {
      logger.warn('No email provider configured', {
        jobId: job.id,
        to,
        type,
      });

      // In development, just log and succeed
      if (process.env.NODE_ENV === 'development') {
        await job.updateProgress(100);

        return {
          success: true,
          messageId: `dev-${job.id}`,
          durationMs: Math.round(performance.now() - startTime),
        };
      }

      throw new Error('No email provider configured (RESEND_API_KEY or SENDGRID_API_KEY)');
    }

    // Simulate sending
    await new Promise((resolve) => setTimeout(resolve, 100));
    await job.updateProgress(100);

    const result: EmailJobResult = {
      success: true,
      messageId: `msg-${job.id}`,
      durationMs: Math.round(performance.now() - startTime),
    };

    logger.info('Email job completed', {
      jobId: job.id,
      to,
      type,
      messageId: result.messageId,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Email job failed', error, {
      jobId: job.id,
      to,
      type,
    });

    return {
      success: false,
      error: errorMessage,
      durationMs: Math.round(performance.now() - startTime),
    };
  }
}

// ============================================================================
// Job Names
// ============================================================================

export const EMAIL_JOBS = {
  WELCOME: JOB_TYPES.EMAIL_WELCOME,
  SUBSCRIPTION: JOB_TYPES.EMAIL_SUBSCRIPTION,
  NOTIFICATION: JOB_TYPES.EMAIL_NOTIFICATION,
  ADMIN_ACTION: JOB_TYPES.EMAIL_ADMIN_ACTION,
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create welcome email job data
 */
export function createWelcomeEmailData(
  to: string,
  data: WelcomeEmailData
): EmailJobData {
  return {
    to,
    subject: 'Welcome to Trading Path Journal!',
    type: 'welcome',
    data: data as unknown as Record<string, unknown>,
  };
}

/**
 * Create subscription email job data
 */
export function createSubscriptionEmailData(
  to: string,
  data: SubscriptionEmailData
): EmailJobData {
  const subjects: Record<SubscriptionEmailData['action'], string> = {
    created: 'Your subscription is active!',
    renewed: 'Your subscription has been renewed',
    canceled: 'Your subscription has been canceled',
    expired: 'Your subscription has expired',
    upgraded: 'Your subscription has been upgraded!',
  };

  return {
    to,
    subject: subjects[data.action],
    type: 'subscription',
    data: data as unknown as Record<string, unknown>,
  };
}

/**
 * Create admin action email job data
 */
export function createAdminActionEmailData(
  to: string,
  data: AdminActionEmailData
): EmailJobData {
  const subjects: Record<AdminActionEmailData['action'], string> = {
    blocked: 'Account Status Update',
    unblocked: 'Account Status Update',
    'subscription-extended': 'Your subscription has been extended',
    'subscription-modified': 'Subscription Update',
    promoted: 'Account Role Update',
  };

  return {
    to,
    subject: subjects[data.action],
    type: 'admin-action',
    data: data as unknown as Record<string, unknown>,
  };
}
