/**
 * Subscription Types & Constants
 * Story 11.1 - Architecture Subscription Backend
 */

import type {
  Plan,
  Subscription,
  Invoice,
  Payment,
  SubscriptionStatus,
  PlanInterval,
  PaymentStatus,
} from '@prisma/client';

// Re-export Prisma types
export type {
  Plan,
  Subscription,
  Invoice,
  Payment,
  SubscriptionStatus,
  PlanInterval,
  PaymentStatus,
};

// ==================== INPUT TYPES ====================

export interface CreateSubscriptionInput {
  userId: string;
  planId: string;
}

export interface CancelSubscriptionInput {
  subscriptionId: string;
  immediate?: boolean; // If true, cancel immediately. If false, cancel at period end.
}

export interface CreateInvoiceInput {
  subscriptionId: string;
  amount: number;
  currency?: string;
  dueDate?: Date;
}

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  externalPaymentId?: string;
  metadata?: Record<string, unknown>;
}

// ==================== OUTPUT TYPES ====================

export interface SubscriptionWithPlan extends Subscription {
  plan: Plan;
}

export interface InvoiceWithPayments extends Invoice {
  payments: Payment[];
}

export interface SubscriptionFull extends Subscription {
  plan: Plan;
  invoices: InvoiceWithPayments[];
}

export interface UserSubscriptionStatus {
  hasSubscription: boolean;
  status: SubscriptionStatus | null;
  isActive: boolean;
  isTrial: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
  plan: Plan | null;
}

// ==================== PRICING CONSTANTS ====================

export const PLAN_PRICES = {
  FREE: 0,
  PRO_MONTHLY: 19,
  PRO_QUARTERLY: 49,
  PRO_BIANNUAL: 20,
  PRO_ANNUAL: 149,
} as const;

export const PLAN_INTERVALS_MONTHS: Record<PlanInterval, number> = {
  BETA: 6,
  MONTHLY: 1,
  QUARTERLY: 3,
  BIANNUAL: 6,
  ANNUAL: 12,
};

export const DEFAULT_TRIAL_DAYS = 14;
export const DEFAULT_CURRENCY = 'EUR';

// ==================== PLAN FEATURES ====================

export interface PlanFeatures {
  maxTrades: number | null; // null = unlimited
  maxAccounts: number;
  voiceNotes: boolean;
  aiCoach: boolean;
  advancedStats: boolean;
  exportData: boolean;
  prioritySupport: boolean;
}

export const FREE_PLAN_FEATURES: PlanFeatures = {
  maxTrades: 50,
  maxAccounts: 1,
  voiceNotes: false,
  aiCoach: false,
  advancedStats: false,
  exportData: false,
  prioritySupport: false,
};

export const PRO_PLAN_FEATURES: PlanFeatures = {
  maxTrades: null, // unlimited
  maxAccounts: 10,
  voiceNotes: true,
  aiCoach: true,
  advancedStats: true,
  exportData: true,
  prioritySupport: true,
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate the end date of a subscription period based on interval
 */
export function calculatePeriodEnd(startDate: Date, interval: PlanInterval): Date {
  const end = new Date(startDate);
  const months = PLAN_INTERVALS_MONTHS[interval];
  end.setMonth(end.getMonth() + months);
  return end;
}

/**
 * Calculate the trial end date
 */
export function calculateTrialEnd(startDate: Date, trialDays: number): Date {
  const end = new Date(startDate);
  end.setDate(end.getDate() + trialDays);
  return end;
}

/**
 * Generate a unique invoice number
 * Format: INV-YYYYMMDD-XXXXX (random 5 chars)
 */
export function generateInvoiceNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `INV-${dateStr}-${random}`;
}

/**
 * Check if a subscription is currently active (ACTIVE or TRIAL within period)
 */
export function isSubscriptionActive(subscription: Subscription): boolean {
  const now = new Date();
  
  if (subscription.status === 'CANCELED' || subscription.status === 'EXPIRED') {
    return false;
  }
  
  if (subscription.status === 'TRIAL' && subscription.trialEndsAt) {
    return now < subscription.trialEndsAt;
  }
  
  if (subscription.status === 'ACTIVE' || subscription.status === 'PAST_DUE' || subscription.status === 'BETA_ACCESS') {
    return now < subscription.currentPeriodEnd;
  }
  
  return false;
}

/**
 * Calculate days remaining in current period or trial
 */
export function calculateDaysRemaining(subscription: Subscription): number {
  const now = new Date();
  let endDate: Date;
  
  if (subscription.status === 'TRIAL' && subscription.trialEndsAt) {
    endDate = subscription.trialEndsAt;
  } else {
    endDate = subscription.currentPeriodEnd;
  }
  
  const diff = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

