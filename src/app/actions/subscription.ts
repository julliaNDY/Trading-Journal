'use server';

/**
 * Subscription Server Actions
 * 
 * Handles subscription-related operations.
 */

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import {
  createCheckoutSession,
  createBillingPortalSession,
  cancelSubscription,
  reactivateSubscription,
  getSubscriptionStatus,
} from '@/services/stripe-service';
import { PlanInterval } from '@prisma/client';
import { logger } from '@/lib/logger';

const subscriptionLogger = logger.child('Subscription');

// ============================================================================
// TYPES
// ============================================================================

type ActionResult<T = void> = 
  | { success: true; data?: T }
  | { success: false; error: string };

// ============================================================================
// HELPERS
// ============================================================================

async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

function getAppUrl(): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Get available plans
 */
export async function getPlans() {
  const fs = await import('fs');const logEntry = JSON.stringify({location:'subscription.ts:getPlans',message:'Getting plans',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'STRIPE'})+'\n';try{fs.appendFileSync('/Users/l3j/Desktop/Trading/Useful Shit/Trading-Journal/cryptosite/.cursor/debug.log',logEntry)}catch(e){}
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  const logEntry2 = JSON.stringify({location:'subscription.ts:getPlans:result',message:'Plans loaded',data:{count:plans.length,plans:plans.map(p=>({name:p.name,interval:p.interval,hasStripeId:!!p.stripePriceId}))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'STRIPE'})+'\n';try{fs.appendFileSync('/Users/l3j/Desktop/Trading/Useful Shit/Trading-Journal/cryptosite/.cursor/debug.log',logEntry2)}catch(e){}

  return plans.map(plan => ({
    id: plan.id,
    name: plan.name,
    displayName: plan.displayName,
    description: plan.description,
    price: Number(plan.price),
    interval: plan.interval,
    trialDays: plan.trialDays,
    savings: plan.savings,
    features: plan.features as string[],
  }));
}

/**
 * Create a checkout session and return the URL
 */
export async function createCheckoutSessionAction(
  planInterval: PlanInterval
): Promise<ActionResult<{ url: string }>> {
  const fs = await import('fs');const logEntry = JSON.stringify({location:'subscription.ts:createCheckoutSessionAction',message:'Creating checkout session',data:{planInterval},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'STRIPE'})+'\n';try{fs.appendFileSync('/Users/l3j/Desktop/Trading/Useful Shit/Trading-Journal/cryptosite/.cursor/debug.log',logEntry)}catch(e){}
  try {
    const userId = await getCurrentUserId();
    const logEntry2 = JSON.stringify({location:'subscription.ts:createCheckoutSessionAction:userId',message:'User ID check',data:{hasUserId:!!userId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'STRIPE'})+'\n';try{fs.appendFileSync('/Users/l3j/Desktop/Trading/Useful Shit/Trading-Journal/cryptosite/.cursor/debug.log',logEntry2)}catch(e){}
    
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const appUrl = getAppUrl();
    const logEntry3 = JSON.stringify({location:'subscription.ts:createCheckoutSessionAction:calling',message:'Calling createCheckoutSession',data:{appUrl,planInterval},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'STRIPE'})+'\n';try{fs.appendFileSync('/Users/l3j/Desktop/Trading/Useful Shit/Trading-Journal/cryptosite/.cursor/debug.log',logEntry3)}catch(e){}
    
    const checkoutUrl = await createCheckoutSession({
      userId,
      planInterval,
      successUrl: `${appUrl}/settings?subscription=success`,
      cancelUrl: `${appUrl}/pricing?subscription=canceled`,
    });
    const logEntry4 = JSON.stringify({location:'subscription.ts:createCheckoutSessionAction:success',message:'Checkout session created',data:{hasUrl:!!checkoutUrl},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'STRIPE'})+'\n';try{fs.appendFileSync('/Users/l3j/Desktop/Trading/Useful Shit/Trading-Journal/cryptosite/.cursor/debug.log',logEntry4)}catch(e){}

    return { success: true, data: { url: checkoutUrl } };
  } catch (error) {
    const logEntry5 = JSON.stringify({location:'subscription.ts:createCheckoutSessionAction:error',message:'Checkout session error',data:{error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'STRIPE'})+'\n';try{fs.appendFileSync('/Users/l3j/Desktop/Trading/Useful Shit/Trading-Journal/cryptosite/.cursor/debug.log',logEntry5)}catch(e){}
    subscriptionLogger.error('Error creating checkout session:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create payment session' 
    };
  }
}

/**
 * Create a billing portal session and return the URL
 */
export async function createBillingPortalAction(): Promise<ActionResult<{ url: string }>> {
  try {
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const appUrl = getAppUrl();
    const portalUrl = await createBillingPortalSession(userId, `${appUrl}/settings`);

    return { success: true, data: { url: portalUrl } };
  } catch (error) {
    subscriptionLogger.error('Error creating billing portal session:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to access billing portal' 
    };
  }
}

/**
 * Cancel subscription at period end
 */
export async function cancelSubscriptionAction(): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    await cancelSubscription(userId);
    return { success: true };
  } catch (error) {
    subscriptionLogger.error('Error canceling subscription:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to cancel subscription' 
    };
  }
}

/**
 * Reactivate a canceled subscription
 */
export async function reactivateSubscriptionAction(): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    await reactivateSubscription(userId);
    return { success: true };
  } catch (error) {
    subscriptionLogger.error('Error reactivating subscription:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to reactivate subscription' 
    };
  }
}

/**
 * Get current user's subscription status
 */
export async function getSubscriptionStatusAction() {
  try {
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return {
        hasActiveSubscription: false,
        isTrialing: false,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        plan: null,
      };
    }

    return await getSubscriptionStatus(userId);
  } catch (error) {
    subscriptionLogger.error('Error getting subscription status:', error);
    return {
      hasActiveSubscription: false,
      isTrialing: false,
      status: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      plan: null,
    };
  }
}

/**
 * Get user's invoice history
 */
export async function getInvoiceHistory() {
  try {
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return [];
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
      },
    });

    if (!subscription) {
      return [];
    }

    return subscription.invoices.map(invoice => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: Number(invoice.amount),
      currency: invoice.currency,
      status: invoice.status,
      paidAt: invoice.paidAt,
      invoicePdfUrl: invoice.invoicePdfUrl,
    }));
  } catch (error) {
    subscriptionLogger.error('Error getting invoice history:', error);
    return [];
  }
}

/**
 * Check if user has access to premium features
 */
export async function checkPremiumAccess(): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return false;
    }

    const status = await getSubscriptionStatus(userId);
    return status.hasActiveSubscription;
  } catch (error) {
    subscriptionLogger.error('Error checking premium access:', error);
    return false;
  }
}
