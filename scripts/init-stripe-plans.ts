/**
 * Initialize Stripe Plans
 * 
 * This script creates the Stripe products and prices, and syncs them to the database.
 * Run once after setting up your Stripe account:
 * 
 * npx tsx scripts/init-stripe-plans.ts
 * 
 * Required env vars:
 * - STRIPE_SECRET_KEY
 * - DATABASE_URL
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load env vars
config({ path: resolve(process.cwd(), '.env') });

async function main() {
  console.log('🚀 Initializing Stripe plans...\n');

  // Dynamic import to ensure env vars are loaded
  const { initializeStripePlans } = await import('../src/services/stripe-service');
  
  try {
    await initializeStripePlans();
    console.log('\n✅ Stripe plans initialized successfully!');
    console.log('\nNext steps:');
    console.log('1. Go to https://dashboard.stripe.com/webhooks');
    console.log('2. Create a webhook endpoint: YOUR_DOMAIN/api/stripe/webhook');
    console.log('3. Select events: checkout.session.completed, customer.subscription.*, invoice.*');
    console.log('4. Copy the webhook secret to STRIPE_WEBHOOK_SECRET in your .env');
  } catch (error) {
    console.error('❌ Error initializing Stripe plans:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();

