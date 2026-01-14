/**
 * Update Beta Plan Stripe Price ID
 * 
 * This script updates the beta_access plan with the Stripe Price ID.
 * 
 * Usage:
 * npx tsx scripts/update-beta-price-id.ts
 * 
 * Required env vars:
 * - DATABASE_URL
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import prisma from '../src/lib/prisma';

// Load env vars
config({ path: resolve(process.cwd(), '.env') });

const BETA_STRIPE_PRICE_ID = 'price_1SpcSWASK0h6caZHNmvrveSz';

async function main() {
  console.log('🔄 Updating Beta plan with Stripe Price ID...\n');

  try {
    // First, add BETA to the enum if it doesn't exist
    console.log('📝 Adding BETA to PlanInterval enum...');
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'BETA' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'PlanInterval')
        ) THEN
          ALTER TYPE "PlanInterval" ADD VALUE 'BETA';
        END IF;
      END $$;
    `);
    console.log('✅ BETA added to enum\n');

    // Then update or create the plan
    const plan = await prisma.plan.upsert({
      where: { name: 'beta_access' },
      create: {
        name: 'beta_access',
        displayName: 'Beta Access (6 mois)',
        description: 'Abonnement Beta Access (6 mois)',
        price: 20.00, // 20$ in decimal
        interval: 'BETA' as any, // Type assertion needed until Prisma client is regenerated
        stripePriceId: BETA_STRIPE_PRICE_ID,
        trialDays: 0,
        sortOrder: 0,
        savings: '-89%',
        isActive: true,
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
        stripePriceId: BETA_STRIPE_PRICE_ID,
        isActive: true,
      },
    });

    console.log('✅ Beta plan updated successfully!');
    console.log(`\nPlan details:`);
    console.log(`- Name: ${plan.name}`);
    console.log(`- Display Name: ${plan.displayName}`);
    console.log(`- Stripe Price ID: ${plan.stripePriceId}`);
    console.log(`- Price: $${plan.price}`);
    console.log(`- Interval: ${plan.interval}`);
    console.log(`- Active: ${plan.isActive}`);
  } catch (error) {
    console.error('❌ Error updating Beta plan:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }

  process.exit(0);
}

main();
