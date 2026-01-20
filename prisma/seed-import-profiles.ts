import { PrismaClient } from '@prisma/client';
import { BROKER_PATTERNS } from '../src/services/broker-detection-service';

const prisma = new PrismaClient();

/**
 * Seed default import profiles for popular brokers
 * These are system profiles that all users can access
 * 
 * Run with: npx tsx prisma/seed-import-profiles.ts
 */
async function seedImportProfiles() {
  console.log('🌱 Seeding import profiles...');

  // Create a system user for system profiles
  // Use a fixed UUID for consistency
  const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

  // Check if system user exists, create if not
  let systemUser = await prisma.user.findUnique({
    where: { id: SYSTEM_USER_ID },
  });

  if (!systemUser) {
    console.log('Creating system user for default profiles...');
    systemUser = await prisma.user.create({
      data: {
        id: SYSTEM_USER_ID,
        email: 'system@tradingjournal.internal',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  // Create import profiles for each broker pattern
  let created = 0;
  let skipped = 0;

  for (const pattern of BROKER_PATTERNS) {
    // Skip generic pattern - users can create custom profiles
    if (pattern.brokerName === 'generic') {
      continue;
    }

    const profileName = `${pattern.displayName} (Défaut)`;

    // Check if profile already exists
    const existing = await prisma.importProfile.findUnique({
      where: {
        userId_name: {
          userId: SYSTEM_USER_ID,
          name: profileName,
        },
      },
    });

    if (existing) {
      console.log(`  ⏭️  Skipping ${profileName} - already exists`);
      skipped++;
      continue;
    }

    // Create system profile
    await prisma.importProfile.create({
      data: {
        userId: SYSTEM_USER_ID,
        name: profileName,
        brokerName: pattern.brokerName,
        mapping: JSON.stringify(pattern.mapping),
        isSystem: true,
      },
    });

    console.log(`  ✅ Created ${profileName}`);
    created++;
  }

  console.log(`\n✨ Seeding complete!`);
  console.log(`   Created: ${created} profiles`);
  console.log(`   Skipped: ${skipped} profiles`);
  console.log(`   Total: ${BROKER_PATTERNS.length - 1} broker patterns (excluding generic)`);
}

seedImportProfiles()
  .catch((error) => {
    console.error('❌ Error seeding import profiles:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
