#!/usr/bin/env tsx
/**
 * Test Polygon API Configuration
 * 
 * Verifies that POLYGON_API_KEY is configured and working
 */

const POLYGON_API_KEY = process.env.POLYGON_API_KEY || '';
const POLYGON_BASE_URL = 'https://api.polygon.io';

async function testPolygonAPI() {
  console.log('\n🔍 Testing Polygon API Configuration\n');
  
  // 1. Check if API key is set
  if (!POLYGON_API_KEY) {
    console.log('❌ POLYGON_API_KEY is not set in environment variables');
    console.log('\n📝 To fix:');
    console.log('   1. Copy POLYGON_API_KEY from env.example to your .env file');
    console.log('   2. Or set your own Polygon.io API key from https://polygon.io\n');
    process.exit(1);
  }
  
  console.log(`✅ POLYGON_API_KEY is set: ${POLYGON_API_KEY.substring(0, 10)}...`);
  
  // 2. Test API with a simple request (fetch AAPL quote)
  console.log('\n📊 Testing API with AAPL quote...');
  
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  const url = `${POLYGON_BASE_URL}/v2/aggs/ticker/AAPL/range/1/day/${yesterdayStr}/${todayStr}?adjusted=true&sort=desc&limit=2&apiKey=${POLYGON_API_KEY}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      console.log(`❌ API request failed: ${response.status} ${response.statusText}`);
      
      if (response.status === 401 || response.status === 403) {
        console.log('\n📝 Authentication failed. Your API key may be invalid or expired.');
        console.log('   Get a new key from: https://polygon.io/dashboard/api-keys');
      } else if (response.status === 429) {
        console.log('\n📝 Rate limit exceeded. Polygon free tier has limits.');
        console.log('   Consider upgrading at: https://polygon.io/pricing');
      }
      
      process.exit(1);
    }
    
    const data = await response.json();
    
    console.log(`✅ API request successful!`);
    console.log(`   Status: ${data.status}`);
    console.log(`   Results: ${data.resultsCount || 0} bars`);
    
    if (data.results && data.results.length > 0) {
      const latest = data.results[0];
      console.log(`   AAPL Close: $${latest.c.toFixed(2)}`);
      console.log(`   Volume: ${(latest.v / 1000000).toFixed(2)}M shares`);
    }
    
    // 3. Test with all Mag7 symbols
    console.log('\n📊 Testing Mag7 symbols...');
    const mag7Symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA'];
    
    const results = await Promise.allSettled(
      mag7Symbols.map(async symbol => {
        const symbolUrl = `${POLYGON_BASE_URL}/v2/aggs/ticker/${symbol}/range/1/day/${yesterdayStr}/${todayStr}?adjusted=true&sort=desc&limit=2&apiKey=${POLYGON_API_KEY}`;
        const res = await fetch(symbolUrl, {
          headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        return { symbol, data: json };
      })
    );
    
    let successCount = 0;
    let failCount = 0;
    
    results.forEach((result, i) => {
      const symbol = mag7Symbols[i];
      if (result.status === 'fulfilled') {
        successCount++;
        const price = result.value.data.results?.[0]?.c;
        if (price) {
          console.log(`   ✅ ${symbol}: $${price.toFixed(2)}`);
        } else {
          console.log(`   ⚠️  ${symbol}: No data`);
        }
      } else {
        failCount++;
        console.log(`   ❌ ${symbol}: ${result.reason.message}`);
      }
    });
    
    console.log(`\n📈 Summary: ${successCount}/${mag7Symbols.length} symbols fetched successfully`);
    
    if (failCount > 0) {
      console.log(`⚠️  ${failCount} symbols failed - this may cause issues with Mag7 analysis`);
    } else {
      console.log(`✅ All Mag7 symbols working correctly!`);
    }
    
    console.log('\n✅ Polygon API is configured and working!\n');
    
  } catch (error: any) {
    console.log(`❌ Unexpected error: ${error.message}`);
    console.log('\n📝 Please check your network connection and try again.\n');
    process.exit(1);
  }
}

// Run the test
testPolygonAPI().catch(console.error);
