#!/usr/bin/env tsx
/**
 * Test Mag7 Mock Data Generation
 */

import { fetchMag7StockData } from '../src/services/stock/stock-service';

async function testMag7Mock() {
  console.log('\n🧪 Testing Mag7 Mock Data Generation\n');
  
  console.log(`POLYGON_API_KEY configured: ${!!process.env.POLYGON_API_KEY}`);
  
  try {
    const data = await fetchMag7StockData();
    
    console.log(`\n✅ Fetched ${data.length} Mag7 stocks:\n`);
    
    if (data.length === 0) {
      console.log('❌ No data returned! This is the problem.');
      process.exit(1);
    }
    
    data.forEach(stock => {
      console.log(`  ${stock.symbol}: $${stock.currentPrice.toFixed(2)} (${stock.priceChangePercent > 0 ? '+' : ''}${stock.priceChangePercent.toFixed(2)}%)`);
    });
    
    console.log(`\n✅ Mock data generation working!\n`);
    
  } catch (error: any) {
    console.log(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

testMag7Mock();
