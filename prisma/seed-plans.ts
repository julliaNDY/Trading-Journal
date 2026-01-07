/**
 * Seed Plans Script
 * Story 11.1 - Architecture Subscription Backend
 * 
 * Usage: npx tsx prisma/seed-plans.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FREE_FEATURES = {
  maxTrades: 50,
  maxAccounts: 1,
  voiceNotes: false,
  aiCoach: false,
  advancedStats: false,
  exportData: false,
  prioritySupport: false,
};

const PRO_FEATURES = {
  maxTrades: null, // unlimited
  maxAccounts: 10,
  voiceNotes: true,
  aiCoach: true,
  advancedStats: true,
  exportData: true,
  prioritySupport: true,
};

const PLANS = [
  {
    name: 'Free',
    description: 'Perfect for getting started with trade journaling',
    price: 0,
    interval: 'MONTHLY' as const,
    features: FREE_FEATURES,
    isActive: true,
    trialDays: 14,
  },
  {
    name: 'Pro Monthly',
    description: 'Full access billed monthly',
    price: 19,
    interval: 'MONTHLY' as const,
    features: PRO_FEATURES,
    isActive: true,
    trialDays: 0,
  },
  {
    name: 'Pro Quarterly',
    description: 'Full access billed every 3 months - Save 14%',
    price: 49,
    interval: 'QUARTERLY' as const,
    features: PRO_FEATURES,
    isActive: true,
    trialDays: 0,
  },
  {
    name: 'Pro Biannual',
    description: 'Full access billed every 6 months - Save 22%',
    price: 89,
    interval: 'BIANNUAL' as const,
    features: PRO_FEATURES,
    isActive: true,
    trialDays: 0,
  },
  {
    name: 'Pro Annual',
    description: 'Full access billed yearly - Save 35%',
    price: 149,
    interval: 'ANNUAL' as const,
    features: PRO_FEATURES,
    isActive: true,
    trialDays: 0,
  },
];

async function seedPlans() {
  console.log('🌱 Seeding plans...\n');

  for (const plan of PLANS) {
    const existing = await prisma.plan.findUnique({
      where: { name: plan.name },
    });

    if (existing) {
      console.log(`  ⏭️  Plan "${plan.name}" already exists, updating...`);
      await prisma.plan.update({
        where: { name: plan.name },
        data: {
          description: plan.description,
          price: plan.price,
          interval: plan.interval,
          features: plan.features,
          isActive: plan.isActive,
          trialDays: plan.trialDays,
        },
      });
    } else {
      console.log(`  ✅ Creating plan "${plan.name}"...`);
      await prisma.plan.create({
        data: {
          name: plan.name,
          description: plan.description,
          price: plan.price,
          interval: plan.interval,
          features: plan.features,
          isActive: plan.isActive,
          trialDays: plan.trialDays,
        },
      });
    }
  }

  console.log('\n✅ Plans seeded successfully!\n');

  // List all plans
  const allPlans = await prisma.plan.findMany({
    orderBy: { price: 'asc' },
  });

  console.log('📋 Current plans:');
  console.table(
    allPlans.map((p) => ({
      Name: p.name,
      Price: `${p.price}€`,
      Interval: p.interval,
      Trial: p.trialDays > 0 ? `${p.trialDays} days` : '-',
      Active: p.isActive ? '✅' : '❌',
    }))
  );
}

seedPlans()
  .catch((error) => {
    console.error('❌ Error seeding plans:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

