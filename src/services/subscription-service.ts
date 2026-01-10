/**
 * Subscription Service
 * Story 11.1 - Architecture Subscription Backend
 * 
 * Handles all subscription-related business logic including:
 * - Plan management
 * - Subscription lifecycle (create, cancel, renew)
 * - Invoice generation
 * - Payment recording
 */

import { prisma } from '@/lib/prisma';
import type { Prisma, SubscriptionStatus } from '@prisma/client';
import {
  type CreateSubscriptionInput,
  type CancelSubscriptionInput,
  type CreateInvoiceInput,
  type RecordPaymentInput,
  type SubscriptionWithPlan,
  type UserSubscriptionStatus,
  type Plan,
  calculatePeriodEnd,
  calculateTrialEnd,
  generateInvoiceNumber,
  isSubscriptionActive,
  calculateDaysRemaining,
  DEFAULT_CURRENCY,
} from '@/types/subscription';

// ==================== PLAN OPERATIONS ====================

/**
 * Get all active plans, ordered by price ascending
 */
export async function getPlans(): Promise<Plan[]> {
  return prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
  });
}

/**
 * Get a specific plan by ID
 */
export async function getPlanById(planId: string): Promise<Plan | null> {
  return prisma.plan.findUnique({
    where: { id: planId },
  });
}

/**
 * Get a plan by name
 */
export async function getPlanByName(name: string): Promise<Plan | null> {
  return prisma.plan.findUnique({
    where: { name },
  });
}

// ==================== SUBSCRIPTION OPERATIONS ====================

/**
 * Get user's current subscription with plan details
 */
export async function getUserSubscription(
  userId: string
): Promise<SubscriptionWithPlan | null> {
  return prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });
}

/**
 * Check if user has an active subscription
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });
  
  if (!subscription) return false;
  return isSubscriptionActive(subscription);
}

/**
 * Get detailed subscription status for a user
 */
export async function checkSubscriptionStatus(
  userId: string
): Promise<UserSubscriptionStatus> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  if (!subscription) {
    return {
      hasSubscription: false,
      status: null,
      isActive: false,
      isTrial: false,
      isExpired: false,
      daysRemaining: null,
      plan: null,
    };
  }

  const isActive = isSubscriptionActive(subscription);
  const isTrial = subscription.status === 'TRIAL';
  const isExpired = subscription.status === 'EXPIRED' || 
    (!isActive && subscription.status !== 'CANCELED');

  return {
    hasSubscription: true,
    status: subscription.status,
    isActive,
    isTrial,
    isExpired,
    daysRemaining: isActive ? calculateDaysRemaining(subscription) : 0,
    plan: subscription.plan,
  };
}

/**
 * Create a new subscription for a user
 * Throws if user already has an active subscription
 */
export async function createSubscription(
  input: CreateSubscriptionInput
): Promise<SubscriptionWithPlan> {
  const { userId, planId } = input;

  // Check if user already has a subscription
  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (existingSubscription && isSubscriptionActive(existingSubscription)) {
    throw new Error('User already has an active subscription');
  }

  // Get the plan
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error('Plan not found');
  }

  if (!plan.isActive) {
    throw new Error('Plan is not available');
  }

  const now = new Date();
  const hasTrial = plan.trialDays > 0;

  // Calculate dates
  const trialEndsAt = hasTrial ? calculateTrialEnd(now, plan.trialDays) : null;
  const periodStart = hasTrial ? trialEndsAt! : now;
  const periodEnd = calculatePeriodEnd(periodStart, plan.interval);

  // Determine initial status
  const status: SubscriptionStatus = hasTrial ? 'TRIAL' : 'ACTIVE';

  // If user had a previous subscription, update it; otherwise create new
  if (existingSubscription) {
    return prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        planId,
        status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialEndsAt,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
      include: { plan: true },
    });
  }

  return prisma.subscription.create({
    data: {
      userId,
      planId,
      status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      trialEndsAt,
    },
    include: { plan: true },
  });
}

/**
 * Cancel a subscription
 * By default, cancels at period end. If immediate=true, cancels immediately.
 */
export async function cancelSubscription(
  input: CancelSubscriptionInput
): Promise<SubscriptionWithPlan> {
  const { subscriptionId, immediate = false } = input;

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const updateData: Prisma.SubscriptionUpdateInput = {
    canceledAt: new Date(),
  };

  if (immediate) {
    updateData.status = 'CANCELED';
    updateData.currentPeriodEnd = new Date();
  } else {
    updateData.cancelAtPeriodEnd = true;
  }

  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: updateData,
    include: { plan: true },
  });
}

/**
 * Renew a subscription manually (extend the current period)
 */
export async function renewSubscription(
  subscriptionId: string
): Promise<SubscriptionWithPlan> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const now = new Date();
  const newPeriodStart = subscription.currentPeriodEnd > now 
    ? subscription.currentPeriodEnd 
    : now;
  const newPeriodEnd = calculatePeriodEnd(newPeriodStart, subscription.plan.interval);

  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'ACTIVE',
      currentPeriodStart: newPeriodStart,
      currentPeriodEnd: newPeriodEnd,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      trialEndsAt: null,
    },
    include: { plan: true },
  });
}

/**
 * Update subscription status based on current date
 * Called by cron job or on user access
 */
export async function updateSubscriptionStatusIfNeeded(
  subscriptionId: string
): Promise<SubscriptionWithPlan> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const now = new Date();
  let newStatus: SubscriptionStatus = subscription.status;

  // Check if trial has ended
  if (subscription.status === 'TRIAL' && subscription.trialEndsAt && now >= subscription.trialEndsAt) {
    // Trial ended - check if there's a paid period
    if (now < subscription.currentPeriodEnd) {
      newStatus = 'ACTIVE';
    } else {
      newStatus = 'EXPIRED';
    }
  }

  // Check if period has ended
  if (subscription.status === 'ACTIVE' && now >= subscription.currentPeriodEnd) {
    if (subscription.cancelAtPeriodEnd) {
      newStatus = 'CANCELED';
    } else {
      newStatus = 'EXPIRED'; // Will need renewal
    }
  }

  if (newStatus !== subscription.status) {
    return prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: newStatus },
      include: { plan: true },
    });
  }

  return subscription;
}

// ==================== INVOICE OPERATIONS ====================

/**
 * Create an invoice for a subscription
 */
export async function createInvoice(input: CreateInvoiceInput) {
  const { subscriptionId, amount, currency = DEFAULT_CURRENCY, dueDate } = input;

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const invoiceNumber = generateInvoiceNumber();
  const invoiceDueDate = dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  return prisma.invoice.create({
    data: {
      subscriptionId,
      invoiceNumber,
      amount,
      currency,
      dueDate: invoiceDueDate,
      status: 'PENDING',
    },
    include: { payments: true },
  });
}

/**
 * Get all invoices for a subscription
 */
export async function getSubscriptionInvoices(subscriptionId: string) {
  return prisma.invoice.findMany({
    where: { subscriptionId },
    include: { payments: true },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get all invoices for a user (via their subscription)
 */
export async function getUserInvoices(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) {
    return [];
  }

  return getSubscriptionInvoices(subscription.id);
}

/**
 * Mark an invoice as paid
 */
export async function markInvoicePaid(invoiceId: string) {
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'COMPLETED',
      paidAt: new Date(),
    },
    include: { payments: true },
  });
}

// ==================== PAYMENT OPERATIONS ====================

/**
 * Record a payment for an invoice
 */
export async function recordPayment(input: RecordPaymentInput) {
  const {
    invoiceId,
    amount,
    currency = DEFAULT_CURRENCY,
    paymentMethod,
    externalPaymentId,
    metadata,
  } = input;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Create the payment record
  const payment = await prisma.payment.create({
    data: {
      invoiceId,
      amount,
      currency,
      status: 'COMPLETED',
      paymentMethod,
      externalPaymentId,
      metadata: metadata ? (metadata as Prisma.JsonObject) : undefined,
    },
  });

  // Update invoice status
  await markInvoicePaid(invoiceId);

  // Update subscription to ACTIVE if it was PAST_DUE
  const subscription = await prisma.subscription.findFirst({
    where: { invoices: { some: { id: invoiceId } } },
  });

  if (subscription && subscription.status === 'PAST_DUE') {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'ACTIVE' },
    });
  }

  return payment;
}

/**
 * Get payments for an invoice
 */
export async function getInvoicePayments(invoiceId: string) {
  return prisma.payment.findMany({
    where: { invoiceId },
    orderBy: { createdAt: 'desc' },
  });
}

