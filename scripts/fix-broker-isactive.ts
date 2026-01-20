/**
 * Fix Broker isActive Status
 * Sets isActive to true only for brokers with integrationStatus: API
 */

import { PrismaClient, IntegrationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing broker isActive status...');

  // Set isActive to true only for API brokers
  const apiBrokers = await prisma.broker.updateMany({
    where: {
      integrationStatus: IntegrationStatus.API,
    },
    data: {
      isActive: true,
    },
  });

  // Set isActive to false for all other brokers
  const nonApiBrokers = await prisma.broker.updateMany({
    where: {
      integrationStatus: {
        not: IntegrationStatus.API,
      },
    },
    data: {
      isActive: false,
    },
  });

  console.log(`✅ Updated ${apiBrokers.count} API brokers to isActive: true`);
  console.log(`✅ Updated ${nonApiBrokers.count} non-API brokers to isActive: false`);

  // Show stats
  const stats = await prisma.broker.groupBy({
    by: ['integrationStatus', 'isActive'],
    _count: true,
  });

  console.log('\n📊 Brokers by Integration Status and isActive:');
  stats.forEach((stat) => {
    console.log(`  ${stat.integrationStatus} / isActive: ${stat.isActive}: ${stat._count}`);
  });

  console.log('\n✅ Done!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
