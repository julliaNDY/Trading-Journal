/**
 * Subscription Check Utilities
 * 
 * Utilities for checking subscription status in server components and API routes.
 */

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { SubscriptionStatus } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface SubscriptionInfo {
  hasActiveSubscription: boolean;
  isTrialing: boolean;
  status: SubscriptionStatus | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  planName: string | null;
}

// ============================================================================
// SERVER-SIDE CHECK
// ============================================================================

/**
 * Check subscription status for the current user (server-side)
 */
export async function checkSubscription(): Promise<SubscriptionInfo> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      hasActiveSubscription: false,
      isTrialing: false,
      status: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      planName: null,
    };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
    include: { plan: true },
  });

  if (!subscription) {
    return {
      hasActiveSubscription: false,
      isTrialing: false,
      status: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      planName: null,
    };
  }

  const activeStatuses: SubscriptionStatus[] = ['ACTIVE', 'TRIAL'];
  const hasActiveSubscription = activeStatuses.includes(subscription.status);
  const isTrialing = subscription.status === 'TRIAL';

  return {
    hasActiveSubscription,
    isTrialing,
    status: subscription.status,
    trialEndsAt: subscription.trialEndsAt,
    currentPeriodEnd: subscription.currentPeriodEnd,
    planName: subscription.plan.displayName || subscription.plan.name,
  };
}

/**
 * Check if the current user has premium access
 */
export async function hasPremiumAccess(): Promise<boolean> {
  const { hasActiveSubscription } = await checkSubscription();
  return hasActiveSubscription;
}

/**
 * Require premium access - throws if no subscription
 */
export async function requirePremiumAccess(): Promise<void> {
  const { hasActiveSubscription } = await checkSubscription();
  
  if (!hasActiveSubscription) {
    throw new Error('SUBSCRIPTION_REQUIRED');
  }
}

// ============================================================================
// FEATURE FLAGS
// ============================================================================

/**
 * Premium features that require a subscription
 */
export const PREMIUM_FEATURES = {
  // AI Features
  voiceNotes: true,
  aiCoach: true,
  
  // Broker Sync
  brokerSync: true,
  
  // Advanced Analytics
  advancedStats: true,
  
  // Import/Export
  unlimitedImport: true,
  csvExport: true,
  
  // Other
  prioritySupport: true,
} as const;

export type PremiumFeature = keyof typeof PREMIUM_FEATURES;

/**
 * Check if a specific feature requires premium
 */
export function isPremiumFeature(feature: PremiumFeature): boolean {
  return PREMIUM_FEATURES[feature] === true;
}

// ============================================================================
// FREE TIER LIMITS
// ============================================================================

export const FREE_TIER_LIMITS = {
  maxTrades: 50,           // Maximum trades in free tier
  maxImportPerMonth: 3,    // Maximum CSV imports per month
  maxVoiceNotes: 0,        // Voice notes not available in free tier
  maxBrokerConnections: 0, // Broker sync not available in free tier
} as const;

/**
 * Check if user has exceeded free tier limit for trades
 */
export async function hasExceededTradeLimit(userId: string): Promise<boolean> {
  const { hasActiveSubscription } = await checkSubscription();
  
  if (hasActiveSubscription) {
    return false; // No limit for premium users
  }

  const tradeCount = await prisma.trade.count({
    where: { userId },
  });

  return tradeCount >= FREE_TIER_LIMITS.maxTrades;
}

