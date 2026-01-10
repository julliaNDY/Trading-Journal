/**
 * Update Stripe Price IDs in Database
 * 
 * This script updates the stripePriceId for existing plans in the database.
 * Run after creating products manually in Stripe Dashboard:
 * 
 * npx tsx scripts/update-stripe-price-ids.ts
 * 
 * Required env vars:
 * - DATABASE_URL
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient, PlanInterval } from '@prisma/client';

// Load env vars
config({ path: resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

// Your Stripe Price IDs (from Stripe Dashboard)
const STRIPE_PRICE_IDS: Record<PlanInterval, string> = {
  MONTHLY: 'price_1SmntkASK0h6caZHzhIBMFg0',
  QUARTERLY: 'price_1SnPwlASK0h6caZHRG8EdLBQ',
  BIANNUAL: 'price_1SnQ0kASK0h6caZHe5idPfpw',
  ANNUAL: 'price_1SnQ1SASK0h6caZHu4GpYsHj',
};

async function main() {
  console.log('🔄 Updating Stripe plans in database...\n');

  for (const [interval, priceId] of Object.entries(STRIPE_PRICE_IDS)) {
    const planConfig = getPlanConfig(interval as PlanInterval);
    const plan = await prisma.plan.findFirst({
      where: { interval: interval as PlanInterval },
    });

    if (plan) {
      await prisma.plan.update({
        where: { id: plan.id },
        data: { 
          stripePriceId: priceId,
          price: planConfig.price,
          savings: planConfig.savings,
          displayName: planConfig.displayName,
          description: planConfig.description,
          features: planConfig.features,
        },
      });
      console.log(`✅ ${interval}: Updated (price: $${planConfig.price}, priceId: ${priceId})`);
    } else {
      // Create plan if it doesn't exist
      await prisma.plan.create({
        data: {
          name: planConfig.name,
          displayName: planConfig.displayName,
          description: planConfig.description,
          price: planConfig.price,
          interval: interval as PlanInterval,
          stripePriceId: priceId,
          trialDays: 7,
          sortOrder: planConfig.sortOrder,
          savings: planConfig.savings,
          features: planConfig.features,
          isActive: true,
        },
      });
      console.log(`✅ ${interval}: Created (price: $${planConfig.price}, priceId: ${priceId})`);
    }
  }

  console.log('\n✅ All Stripe Price IDs updated!');
}

function getPlanConfig(interval: PlanInterval) {
  const configs = {
    MONTHLY: {
      name: 'Pro Monthly',
      displayName: 'Monthly',
      description: 'Billed monthly',
      price: 15,
      sortOrder: 0,
      savings: null,
      features: [
        'Unlimited trade imports',
        'Advanced statistics',
        'AI Trading Coach',
        'Voice notes & transcription',
        'Broker sync',
        'Priority support',
      ],
    },
    QUARTERLY: {
      name: 'Pro Quarterly',
      displayName: 'Quarterly',
      description: 'Billed every 3 months',
      price: 25,
      sortOrder: 1,
      savings: '-44%',
      features: [
        'Unlimited trade imports',
        'Advanced statistics',
        'AI Trading Coach',
        'Voice notes & transcription',
        'Broker sync',
        'Priority support',
      ],
    },
    BIANNUAL: {
      name: 'Pro Biannual',
      displayName: '6 Months',
      description: 'Billed every 6 months',
      price: 40,
      sortOrder: 2,
      savings: '-56%',
      features: [
        'Unlimited trade imports',
        'Advanced statistics',
        'AI Trading Coach',
        'Voice notes & transcription',
        'Broker sync',
        'Priority support',
      ],
    },
    ANNUAL: {
      name: 'Pro Annual',
      displayName: 'Annual',
      description: 'Billed yearly',
      price: 75,
      sortOrder: 3,
      savings: '-58%',
      features: [
        'Unlimited trade imports',
        'Advanced statistics',
        'AI Trading Coach',
        'Voice notes & transcription',
        'Broker sync',
        'Priority support',
        '3 months FREE',
      ],
    },
  };
  return configs[interval];
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
