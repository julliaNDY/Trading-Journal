/**
 * Seed subscription plans in the database
 * 
 * Run: npx tsx prisma/seed-plans.ts
 */

import { PrismaClient, PlanInterval } from '@prisma/client';

const prisma = new PrismaClient();

const plans = [
  {
    name: 'monthly',
    displayName: 'Monthly',
    description: 'Full access to all features',
    price: 10.00,
    interval: PlanInterval.MONTHLY,
    features: [
      'Unlimited trades import',
      'Advanced analytics',
      'AI Coach & Insights',
      'Voice notes transcription',
      'Broker sync (Tradovate, IBKR)',
      'TradingView integration',
      'Playbook sharing',
      'Priority support',
    ],
    trialDays: 7,
    sortOrder: 1,
    savings: null,
  },
  {
    name: 'quarterly',
    displayName: 'Quarterly',
    description: '3 months - Save 33%',
    price: 20.00,
    interval: PlanInterval.QUARTERLY,
    features: [
      'Unlimited trades import',
      'Advanced analytics',
      'AI Coach & Insights',
      'Voice notes transcription',
      'Broker sync (Tradovate, IBKR)',
      'TradingView integration',
      'Playbook sharing',
      'Priority support',
    ],
    trialDays: 7,
    sortOrder: 2,
    savings: 'Save 33%',
  },
  {
    name: 'biannual',
    displayName: 'Semi-Annual',
    description: '6 months - Save 17%',
    price: 50.00,
    interval: PlanInterval.BIANNUAL,
    features: [
      'Unlimited trades import',
      'Advanced analytics',
      'AI Coach & Insights',
      'Voice notes transcription',
      'Broker sync (Tradovate, IBKR)',
      'TradingView integration',
      'Playbook sharing',
      'Priority support',
    ],
    trialDays: 7,
    sortOrder: 3,
    savings: 'Save 17%',
  },
  {
    name: 'annual',
    displayName: 'Annual',
    description: '12 months - Best value!',
    price: 70.00,
    interval: PlanInterval.ANNUAL,
    features: [
      'Unlimited trades import',
      'Advanced analytics',
      'AI Coach & Insights',
      'Voice notes transcription',
      'Broker sync (Tradovate, IBKR)',
      'TradingView integration',
      'Playbook sharing',
      'Priority support',
      'Early access to new features',
    ],
    trialDays: 7,
    sortOrder: 4,
    savings: 'Save 42%',
  },
];

async function main() {
  console.log('🌱 Seeding subscription plans...');

  for (const plan of plans) {
    const existingPlan = await prisma.plan.findUnique({
      where: { name: plan.name },
    });

    if (existingPlan) {
      // Update existing plan
      await prisma.plan.update({
        where: { name: plan.name },
        data: {
          displayName: plan.displayName,
          description: plan.description,
          price: plan.price,
          interval: plan.interval,
          features: plan.features,
          trialDays: plan.trialDays,
          sortOrder: plan.sortOrder,
          savings: plan.savings,
          isActive: true,
        },
      });
      console.log(`  ✅ Updated plan: ${plan.displayName}`);
    } else {
      // Create new plan
      await prisma.plan.create({
        data: {
          name: plan.name,
          displayName: plan.displayName,
          description: plan.description,
          price: plan.price,
          interval: plan.interval,
          features: plan.features,
          trialDays: plan.trialDays,
          sortOrder: plan.sortOrder,
          savings: plan.savings,
          isActive: true,
        },
      });
      console.log(`  ✅ Created plan: ${plan.displayName}`);
    }
  }

  console.log('✨ Subscription plans seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding plans:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
