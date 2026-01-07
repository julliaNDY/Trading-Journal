/**
 * Stripe Service
 * 
 * Handles all Stripe-related operations for the subscription system.
 * 
 * Features:
 * - Customer management
 * - Checkout session creation
 * - Subscription management
 * - Billing portal
 * - Webhook handling
 */

import Stripe from 'stripe';
import prisma from '@/lib/prisma';
import { SubscriptionStatus, PlanInterval } from '@prisma/client';
import { stripeLogger } from '@/lib/logger';

// ============================================================================
// STRIPE CLIENT
// ============================================================================

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
});

// ============================================================================
// PLAN CONFIGURATION
// ============================================================================

export const PLAN_CONFIG = {
  MONTHLY: {
    name: 'pro_monthly',
    displayName: 'Pro Mensuel',
    price: 1000, // 10€ in cents
    interval: 'month' as const,
    intervalCount: 1,
    trialDays: 7,
    savings: null,
    sortOrder: 1,
  },
  QUARTERLY: {
    name: 'pro_quarterly',
    displayName: 'Pro Trimestriel',
    price: 2000, // 20€ in cents
    interval: 'month' as const,
    intervalCount: 3,
    trialDays: 7,
    savings: '-33%',
    sortOrder: 2,
  },
  BIANNUAL: {
    name: 'pro_biannual',
    displayName: 'Pro Semestriel',
    price: 5000, // 50€ in cents
    interval: 'month' as const,
    intervalCount: 6,
    trialDays: 7,
    savings: '-17%',
    sortOrder: 3,
  },
  ANNUAL: {
    name: 'pro_annual',
    displayName: 'Pro Annuel',
    price: 7000, // 70€ in cents
    interval: 'year' as const,
    intervalCount: 1,
    trialDays: 7,
    savings: '-42%',
    sortOrder: 4,
  },
} as const;

// ============================================================================
// CUSTOMER MANAGEMENT
// ============================================================================

/**
 * Get or create a Stripe customer for a user
 */
export async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // If user already has a Stripe customer ID, return it
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  // Create a new Stripe customer
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: {
      userId: user.id,
    },
  });

  // Save the Stripe customer ID to the user
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

// ============================================================================
// CHECKOUT SESSION
// ============================================================================

export interface CreateCheckoutSessionInput {
  userId: string;
  planInterval: PlanInterval;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Create a Stripe checkout session for subscription
 */
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<string> {
  const { userId, planInterval, successUrl, cancelUrl } = input;

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(userId);

  // Get the plan from database
  const plan = await prisma.plan.findFirst({
    where: {
      interval: planInterval,
      isActive: true,
    },
  });

  if (!plan || !plan.stripePriceId) {
    throw new Error(`Plan not found for interval: ${planInterval}`);
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: plan.stripePriceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: plan.trialDays,
      metadata: {
        userId,
        planId: plan.id,
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    customer_update: {
      address: 'auto',
      name: 'auto',
    },
    locale: 'fr',
    metadata: {
      userId,
      planId: plan.id,
    },
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session');
  }

  return session.url;
}

// ============================================================================
// BILLING PORTAL
// ============================================================================

/**
 * Create a Stripe billing portal session
 */
export async function createBillingPortalSession(
  userId: string,
  returnUrl: string
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user?.stripeCustomerId) {
    throw new Error('User has no Stripe customer ID');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl,
  });

  return session.url;
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * Cancel a subscription at period end
 */
export async function cancelSubscription(userId: string): Promise<void> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription?.stripeSubscriptionId) {
    throw new Error('No active subscription found');
  }

  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      cancelAtPeriodEnd: true,
      canceledAt: new Date(),
    },
  });
}

/**
 * Reactivate a canceled subscription
 */
export async function reactivateSubscription(userId: string): Promise<void> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription?.stripeSubscriptionId) {
    throw new Error('No subscription found');
  }

  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      cancelAtPeriodEnd: false,
      canceledAt: null,
    },
  });
}

/**
 * Get subscription status for a user
 */
export async function getSubscriptionStatus(userId: string): Promise<{
  hasActiveSubscription: boolean;
  isTrialing: boolean;
  status: SubscriptionStatus | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  plan: {
    name: string;
    interval: PlanInterval;
    price: number;
  } | null;
}> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  if (!subscription) {
    return {
      hasActiveSubscription: false,
      isTrialing: false,
      status: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      plan: null,
    };
  }

  const hasActiveSubscription = ['ACTIVE', 'TRIAL'].includes(subscription.status);
  const isTrialing = subscription.status === 'TRIAL';

  return {
    hasActiveSubscription,
    isTrialing,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    plan: subscription.plan ? {
      name: subscription.plan.displayName || subscription.plan.name,
      interval: subscription.plan.interval,
      price: Number(subscription.plan.price),
    } : null,
  };
}

// ============================================================================
// WEBHOOK HANDLERS
// ============================================================================

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(
  event: Stripe.Event
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case 'invoice.paid':
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    default:
      stripeLogger.debug(`Unhandled event type: ${event.type}`);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;

  if (!userId || !planId) {
    stripeLogger.error('Missing userId or planId in checkout session metadata');
    return;
  }

  stripeLogger.debug(`Checkout completed for user ${userId}, plan ${planId}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    // Try to get userId from customer
    const customer = await stripe.customers.retrieve(subscription.customer as string);
    if (customer.deleted) return;
    
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customer.id },
    });
    
    if (!user) {
      stripeLogger.error('Could not find user for subscription');
      return;
    }
    
    await processSubscriptionUpdate(user.id, subscription);
  } else {
    await processSubscriptionUpdate(userId, subscription);
  }
}

async function processSubscriptionUpdate(
  userId: string,
  stripeSubscription: Stripe.Subscription
): Promise<void> {
  // Get the price/plan info
  const priceId = stripeSubscription.items.data[0]?.price.id;
  
  const plan = await prisma.plan.findFirst({
    where: { stripePriceId: priceId },
  });

  if (!plan) {
    stripeLogger.error(`Plan not found for price ID: ${priceId}`);
    return;
  }

  // Map Stripe status to our status
  const statusMap: Record<string, SubscriptionStatus> = {
    'trialing': 'TRIAL',
    'active': 'ACTIVE',
    'past_due': 'PAST_DUE',
    'canceled': 'CANCELED',
    'unpaid': 'PAST_DUE',
  };

  const status = statusMap[stripeSubscription.status] || 'EXPIRED';

  // Get period dates from subscription (using any to handle API version differences)
  const subAny = stripeSubscription as any;
  const currentPeriodStart = subAny.current_period_start 
    ? new Date(subAny.current_period_start * 1000) 
    : new Date();
  const currentPeriodEnd = subAny.current_period_end 
    ? new Date(subAny.current_period_end * 1000) 
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const trialEnd = subAny.trial_end 
    ? new Date(subAny.trial_end * 1000) 
    : null;

  // Upsert subscription
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      planId: plan.id,
      stripeSubscriptionId: stripeSubscription.id,
      status,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      trialEndsAt: trialEnd,
    },
    update: {
      planId: plan.id,
      stripeSubscriptionId: stripeSubscription.id,
      status,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      trialEndsAt: trialEnd,
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const dbSubscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (dbSubscription) {
    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
      },
    });
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  // Handle API version differences
  const invoiceAny = invoice as any;
  const subscriptionId = invoiceAny.subscription;
  
  if (!subscriptionId) return;

  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId as string },
  });

  if (!subscription) return;

  // Generate invoice number
  const invoiceCount = await prisma.invoice.count({
    where: { subscriptionId: subscription.id },
  });
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(5, '0')}`;

  // Create invoice record
  await prisma.invoice.create({
    data: {
      subscriptionId: subscription.id,
      stripeInvoiceId: invoice.id,
      invoiceNumber,
      amount: (invoiceAny.amount_paid || 0) / 100,
      currency: invoice.currency.toUpperCase(),
      status: 'COMPLETED',
      dueDate: invoiceAny.due_date ? new Date(invoiceAny.due_date * 1000) : new Date(),
      paidAt: new Date(),
      invoicePdfUrl: invoiceAny.hosted_invoice_url || null,
    },
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  // Handle API version differences
  const invoiceAny = invoice as any;
  const subscriptionId = invoiceAny.subscription;
  
  if (!subscriptionId) return;

  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId as string },
  });

  if (subscription) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'PAST_DUE' },
    });
  }
}

// ============================================================================
// STRIPE PRODUCT/PRICE SETUP
// ============================================================================

/**
 * Initialize Stripe products and prices (run once during setup)
 */
export async function initializeStripePlans(): Promise<void> {
  stripeLogger.info('Initializing Stripe plans...');

  // Create or get the product
  let product: Stripe.Product;
  
  const existingProducts = await stripe.products.list({
    limit: 1,
    active: true,
  });

  if (existingProducts.data.length > 0 && existingProducts.data[0].name === 'Trading Journal Pro') {
    product = existingProducts.data[0];
  } else {
    product = await stripe.products.create({
      name: 'Trading Journal Pro',
      description: 'Accès complet à toutes les fonctionnalités du Trading Journal',
    });
  }

  // Create prices for each plan
  for (const [intervalKey, config] of Object.entries(PLAN_CONFIG)) {
    const interval = intervalKey as keyof typeof PLAN_CONFIG;
    
    // Check if price already exists
    const existingPrices = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 100,
    });

    let price = existingPrices.data.find(
      p => p.unit_amount === config.price && 
           p.recurring?.interval === config.interval &&
           p.recurring?.interval_count === config.intervalCount
    );

    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: config.price,
        currency: 'eur',
        recurring: {
          interval: config.interval,
          interval_count: config.intervalCount,
        },
        metadata: {
          planName: config.name,
        },
      });
    }

    // Upsert plan in database
    await prisma.plan.upsert({
      where: { name: config.name },
      create: {
        name: config.name,
        displayName: config.displayName,
        description: `Abonnement ${config.displayName}`,
        price: config.price / 100,
        interval: interval as PlanInterval,
        stripePriceId: price.id,
        trialDays: config.trialDays,
        sortOrder: config.sortOrder,
        savings: config.savings,
        features: [
          'Import illimité de trades',
          'Notes vocales avec transcription IA',
          'Coach IA personnalisé',
          'Synchronisation brokers (Tradovate, IBKR)',
          'Graphiques TradingView intégrés',
          'Export des données',
          'Support prioritaire',
        ],
      },
      update: {
        displayName: config.displayName,
        price: config.price / 100,
        stripePriceId: price.id,
        sortOrder: config.sortOrder,
        savings: config.savings,
      },
    });

    stripeLogger.info(`Plan ${config.name} configured with price ${price.id}`);
  }

  stripeLogger.info('Stripe plans initialization complete!');
}

// ============================================================================
// EXPORTS
// ============================================================================

export { stripe };

