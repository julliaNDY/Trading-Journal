/**
 * Story 3.8: Broker Database - Complete Acceptance Tests
 * 
 * Tests all 6 Acceptance Criteria:
 * AC1: Table Broker with 240+ brokers
 * AC2: Integration status (API, FILE_UPLOAD, COMING_SOON)
 * AC3: Broker metadata (logo, website, docs)
 * AC4: API endpoint /api/brokers with filters
 * AC5: Seed DB with 240+ brokers
 * AC6: Admin CRUD operations
 */

import { PrismaClient, IntegrationStatus, BrokerAssetType } from '@prisma/client';

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, message: string, details?: any) {
  results.push({ name, passed, message, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}: ${message}`);
  if (details) {
    console.log(`   Details:`, details);
  }
}

async function testAC1_BrokerTable() {
  console.log('\n📋 AC1: Table Broker with 240+ brokers');
  
  try {
    const count = await prisma.broker.count();
    const passed = count >= 240;
    logTest(
      'AC1.1',
      passed,
      `Total brokers: ${count} (minimum 240 required)`,
      { count, required: 240 }
    );

    // Check required fields exist
    const sampleBroker = await prisma.broker.findFirst();
    if (sampleBroker) {
      const hasRequiredFields = Boolean(
        sampleBroker.id &&
        sampleBroker.name &&
        sampleBroker.integrationStatus &&
        sampleBroker.supportedAssets
      );
      
      logTest(
        'AC1.2',
        hasRequiredFields,
        'Required fields present (id, name, integrationStatus, supportedAssets)',
        { fields: Object.keys(sampleBroker) }
      );
    }
  } catch (error: any) {
    logTest('AC1', false, `Error: ${error.message}`);
  }
}

async function testAC2_IntegrationStatus() {
  console.log('\n🔌 AC2: Integration status types');
  
  try {
    const apiCount = await prisma.broker.count({
      where: { integrationStatus: IntegrationStatus.API }
    });
    const fileUploadCount = await prisma.broker.count({
      where: { integrationStatus: IntegrationStatus.FILE_UPLOAD }
    });
    const comingSoonCount = await prisma.broker.count({
      where: { integrationStatus: IntegrationStatus.COMING_SOON }
    });

    const total = apiCount + fileUploadCount + comingSoonCount;
    const allBrokers = await prisma.broker.count();
    const passed = total === allBrokers;

    logTest(
      'AC2.1',
      passed,
      'All brokers have valid integration status',
      {
        API: apiCount,
        FILE_UPLOAD: fileUploadCount,
        COMING_SOON: comingSoonCount,
        total,
        expected: allBrokers
      }
    );

    // Check API brokers have documentation URL
    const apiBrokers = await prisma.broker.findMany({
      where: { integrationStatus: IntegrationStatus.API },
      select: { name: true, apiDocumentationUrl: true }
    });

    const apiWithDocs = apiBrokers.filter(b => b.apiDocumentationUrl).length;
    const apiDocsRatio = apiWithDocs / apiBrokers.length;

    logTest(
      'AC2.2',
      apiDocsRatio > 0.5,
      `API brokers with documentation: ${apiWithDocs}/${apiBrokers.length} (${(apiDocsRatio * 100).toFixed(1)}%)`,
      { apiWithDocs, total: apiBrokers.length }
    );

  } catch (error: any) {
    logTest('AC2', false, `Error: ${error.message}`);
  }
}

async function testAC3_BrokerMetadata() {
  console.log('\n📊 AC3: Broker metadata (logo, website, docs)');
  
  try {
    const brokersWithWebsite = await prisma.broker.count({
      where: { websiteUrl: { not: null } }
    });
    const total = await prisma.broker.count();
    const websiteRatio = brokersWithWebsite / total;

    logTest(
      'AC3.1',
      websiteRatio > 0.8,
      `Brokers with website URL: ${brokersWithWebsite}/${total} (${(websiteRatio * 100).toFixed(1)}%)`,
      { brokersWithWebsite, total }
    );

    // Check supportedAssets array
    const brokersWithAssets = await prisma.broker.count({
      where: { 
        supportedAssets: { isEmpty: false }
      }
    });
    const assetsRatio = brokersWithAssets / total;

    logTest(
      'AC3.2',
      assetsRatio > 0.9,
      `Brokers with supported assets: ${brokersWithAssets}/${total} (${(assetsRatio * 100).toFixed(1)}%)`,
      { brokersWithAssets, total }
    );

    // Check country/region data
    const brokersWithCountry = await prisma.broker.count({
      where: { country: { not: null } }
    });
    const countryRatio = brokersWithCountry / total;

    logTest(
      'AC3.3',
      countryRatio > 0.7,
      `Brokers with country: ${brokersWithCountry}/${total} (${(countryRatio * 100).toFixed(1)}%)`,
      { brokersWithCountry, total }
    );

  } catch (error: any) {
    logTest('AC3', false, `Error: ${error.message}`);
  }
}

async function testAC4_APIEndpoint() {
  console.log('\n🌐 AC4: API endpoint /api/brokers');
  
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Test 1: Basic pagination
    const response1 = await fetch(`${baseUrl}/api/brokers?page=1&limit=10`);
    const data1 = await response1.json();
    
    logTest(
      'AC4.1',
      response1.ok && data1.success && data1.data.length > 0,
      'Basic pagination works',
      { status: response1.status, dataLength: data1.data?.length }
    );

    // Test 2: Filter by country
    const response2 = await fetch(`${baseUrl}/api/brokers?country=US&limit=5`);
    const data2 = await response2.json();
    
    logTest(
      'AC4.2',
      response2.ok && data2.success && data2.data.every((b: any) => b.country === 'US'),
      'Country filter works',
      { filtered: data2.data?.length, total: data2.pagination?.total }
    );

    // Test 3: Filter by integration status
    const response3 = await fetch(`${baseUrl}/api/brokers?integrationStatus=API`);
    const data3 = await response3.json();
    
    logTest(
      'AC4.3',
      response3.ok && data3.success && data3.data.every((b: any) => b.integrationStatus === 'API'),
      'Integration status filter works',
      { apiCount: data3.pagination?.total }
    );

    // Test 4: Search functionality
    const response4 = await fetch(`${baseUrl}/api/brokers?search=Interactive`);
    const data4 = await response4.json();
    
    logTest(
      'AC4.4',
      response4.ok && data4.success && data4.data.length > 0,
      'Search functionality works',
      { results: data4.data?.length }
    );

    // Test 5: Pagination metadata
    const response5 = await fetch(`${baseUrl}/api/brokers?page=2&limit=20`);
    const data5 = await response5.json();
    
    const hasMetadata = data5.pagination && 
      typeof data5.pagination.page === 'number' &&
      typeof data5.pagination.total === 'number' &&
      typeof data5.pagination.totalPages === 'number';
    
    logTest(
      'AC4.5',
      hasMetadata,
      'Pagination metadata complete',
      data5.pagination
    );

  } catch (error: any) {
    logTest('AC4', false, `Error: ${error.message}`);
  }
}

async function testAC5_SeedDatabase() {
  console.log('\n🌱 AC5: Seed database with 240+ brokers');
  
  try {
    const total = await prisma.broker.count();
    
    logTest(
      'AC5.1',
      total >= 240,
      `Database seeded with ${total} brokers (minimum 240)`,
      { total, required: 240 }
    );

    // Check diversity of brokers
    const regions = await prisma.broker.groupBy({
      by: ['region'],
      _count: true
    });

    logTest(
      'AC5.2',
      regions.length >= 4,
      `Brokers from ${regions.length} regions (minimum 4)`,
      { regions: regions.map(r => ({ region: r.region, count: r._count })) }
    );

    // Check asset type diversity
    const assetTypes = [
      BrokerAssetType.FOREX,
      BrokerAssetType.FUTURES,
      BrokerAssetType.STOCKS,
      BrokerAssetType.CRYPTO,
      BrokerAssetType.MULTI_ASSET,
      BrokerAssetType.PROP_FIRM
    ];

    const assetCounts = await Promise.all(
      assetTypes.map(async (type) => ({
        type,
        count: await prisma.broker.count({
          where: { supportedAssets: { has: type } }
        })
      }))
    );

    const typesWithBrokers = assetCounts.filter(a => a.count > 0).length;

    logTest(
      'AC5.3',
      typesWithBrokers >= 5,
      `${typesWithBrokers}/6 asset types represented`,
      assetCounts
    );

  } catch (error: any) {
    logTest('AC5', false, `Error: ${error.message}`);
  }
}

async function testAC6_AdminCRUD() {
  console.log('\n⚙️  AC6: Admin CRUD operations');
  
  try {
    // Test CREATE
    const testBroker = {
      name: `Test Broker ${Date.now()}`,
      displayName: 'Test Broker Display',
      country: 'TEST',
      region: 'Test Region',
      integrationStatus: IntegrationStatus.COMING_SOON,
      supportedAssets: [BrokerAssetType.STOCKS],
      websiteUrl: 'https://test.example.com',
      description: 'Test broker for AC6',
      priority: 1,
      isActive: true
    };

    const created = await prisma.broker.create({
      data: testBroker
    });

    logTest(
      'AC6.1',
      Boolean(created.id && created.name === testBroker.name),
      'CREATE operation works',
      { id: created.id, name: created.name }
    );

    // Test READ
    const read = await prisma.broker.findUnique({
      where: { id: created.id }
    });

    logTest(
      'AC6.2',
      Boolean(read !== null && read.name === testBroker.name),
      'READ operation works',
      { found: !!read }
    );

    // Test UPDATE
    const updated = await prisma.broker.update({
      where: { id: created.id },
      data: { priority: 99, description: 'Updated description' }
    });

    logTest(
      'AC6.3',
      updated.priority === 99 && updated.description === 'Updated description',
      'UPDATE operation works',
      { priority: updated.priority }
    );

    // Test DELETE
    await prisma.broker.delete({
      where: { id: created.id }
    });

    const deleted = await prisma.broker.findUnique({
      where: { id: created.id }
    });

    logTest(
      'AC6.4',
      deleted === null,
      'DELETE operation works',
      { deleted: deleted === null }
    );

    // Test unique constraint
    try {
      await prisma.broker.create({
        data: {
          name: 'Interactive Brokers', // Duplicate name
          integrationStatus: IntegrationStatus.API,
          supportedAssets: [BrokerAssetType.STOCKS],
          priority: 1,
          isActive: true
        }
      });
      logTest('AC6.5', false, 'Unique constraint should prevent duplicate names');
    } catch (error: any) {
      logTest(
        'AC6.5',
        error.code === 'P2002',
        'Unique constraint on name works',
        { error: 'Duplicate name rejected' }
      );
    }

  } catch (error: any) {
    logTest('AC6', false, `Error: ${error.message}`);
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 STORY 3.8 - TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  const percentage = ((passed / total) * 100).toFixed(1);

  console.log(`\nTotal Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${percentage}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.message}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  
  if (failed === 0) {
    console.log('🎉 ALL ACCEPTANCE CRITERIA PASSED!');
    console.log('✅ Story 3.8 is COMPLETE and ready for review');
  } else {
    console.log('⚠️  Some tests failed. Please review and fix.');
  }
  
  console.log('='.repeat(60) + '\n');

  return failed === 0;
}

async function main() {
  console.log('🧪 Story 3.8: Broker Database - Acceptance Tests');
  console.log('Testing all 6 Acceptance Criteria...\n');

  await testAC1_BrokerTable();
  await testAC2_IntegrationStatus();
  await testAC3_BrokerMetadata();
  await testAC4_APIEndpoint();
  await testAC5_SeedDatabase();
  await testAC6_AdminCRUD();

  const allPassed = await generateReport();

  await prisma.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
