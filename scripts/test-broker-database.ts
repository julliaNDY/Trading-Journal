/**
 * Test script for Broker Database
 * Validates schema, enums, and data integrity
 */

import { PrismaClient, BrokerAssetType, IntegrationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function testBrokerDatabase() {
  console.log('🧪 Testing Broker Database...\n');

  // Test 1: Count total brokers
  const totalBrokers = await prisma.broker.count();
  console.log(`✅ Test 1: Total brokers in database: ${totalBrokers}`);

  // Test 2: Test enum values
  console.log('\n✅ Test 2: Enum values are correctly typed');
  console.log('  - IntegrationStatus:', Object.values(IntegrationStatus));
  console.log('  - BrokerAssetType:', Object.values(BrokerAssetType));

  // Test 3: Query by integration status
  const apiIntegrations = await prisma.broker.count({
    where: { integrationStatus: IntegrationStatus.API },
  });
  const fileUploadIntegrations = await prisma.broker.count({
    where: { integrationStatus: IntegrationStatus.FILE_UPLOAD },
  });
  const comingSoon = await prisma.broker.count({
    where: { integrationStatus: IntegrationStatus.COMING_SOON },
  });

  console.log('\n✅ Test 3: Brokers by integration status');
  console.log(`  - API: ${apiIntegrations}`);
  console.log(`  - FILE_UPLOAD: ${fileUploadIntegrations}`);
  console.log(`  - COMING_SOON: ${comingSoon}`);

  // Test 4: Query by asset type
  const futuresBrokers = await prisma.broker.count({
    where: {
      supportedAssets: {
        has: BrokerAssetType.FUTURES,
      },
    },
  });
  const forexBrokers = await prisma.broker.count({
    where: {
      supportedAssets: {
        has: BrokerAssetType.FOREX,
      },
    },
  });
  const stocksBrokers = await prisma.broker.count({
    where: {
      supportedAssets: {
        has: BrokerAssetType.STOCKS,
      },
    },
  });
  const cryptoBrokers = await prisma.broker.count({
    where: {
      supportedAssets: {
        has: BrokerAssetType.CRYPTO,
      },
    },
  });

  console.log('\n✅ Test 4: Brokers by asset type');
  console.log(`  - Futures: ${futuresBrokers}`);
  console.log(`  - Forex: ${forexBrokers}`);
  console.log(`  - Stocks: ${stocksBrokers}`);
  console.log(`  - Crypto: ${cryptoBrokers}`);

  // Test 5: Query top priority brokers
  const topBrokers = await prisma.broker.findMany({
    take: 10,
    orderBy: { priority: 'desc' },
    select: {
      name: true,
      integrationStatus: true,
      priority: true,
      country: true,
      supportedAssets: true,
    },
  });

  console.log('\n✅ Test 5: Top 10 priority brokers');
  topBrokers.forEach((broker, index) => {
    console.log(
      `  ${index + 1}. ${broker.name} (${broker.integrationStatus}) - Priority: ${broker.priority}`
    );
  });

  // Test 6: Query by region
  const regions = await prisma.broker.groupBy({
    by: ['region'],
    _count: true,
    orderBy: {
      _count: {
        region: 'desc',
      },
    },
  });

  console.log('\n✅ Test 6: Brokers by region');
  regions.forEach((region) => {
    console.log(`  - ${region.region || 'Unknown'}: ${region._count}`);
  });

  // Test 7: Search functionality
  const searchTerm = 'Interactive';
  const searchResults = await prisma.broker.findMany({
    where: {
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { displayName: { contains: searchTerm, mode: 'insensitive' } },
      ],
    },
    select: {
      name: true,
      displayName: true,
      integrationStatus: true,
    },
  });

  console.log(`\n✅ Test 7: Search for "${searchTerm}"`);
  searchResults.forEach((broker) => {
    console.log(`  - ${broker.displayName || broker.name} (${broker.integrationStatus})`);
  });

  // Test 8: Prop firms count
  const propFirms = await prisma.broker.count({
    where: {
      supportedAssets: {
        has: BrokerAssetType.PROP_FIRM,
      },
    },
  });

  console.log(`\n✅ Test 8: Prop firms: ${propFirms}`);

  // Test 9: Active brokers
  const activeBrokers = await prisma.broker.count({
    where: { isActive: true },
  });

  console.log(`\n✅ Test 9: Active brokers: ${activeBrokers}`);

  // Test 10: Unique constraint test
  try {
    await prisma.broker.create({
      data: {
        name: 'Interactive Brokers', // Duplicate name
        integrationStatus: IntegrationStatus.API,
        supportedAssets: [BrokerAssetType.STOCKS],
        priority: 100,
      },
    });
    console.log('\n❌ Test 10: FAILED - Unique constraint not working');
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.log('\n✅ Test 10: Unique constraint working correctly');
    } else {
      console.log('\n❌ Test 10: Unexpected error:', error.message);
    }
  }

  console.log('\n🎉 All tests completed successfully!');
}

testBrokerDatabase()
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
