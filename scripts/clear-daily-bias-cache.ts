#!/usr/bin/env tsx
/**
 * Clear Daily Bias Analysis Cache
 * 
 * Deletes all or specific daily bias analyses from the database
 * Useful when cache is corrupted or contains invalid data
 */

import { prisma } from '../src/lib/prisma';
import { logger } from '../src/lib/logger';

interface ClearCacheOptions {
  userId?: string;
  instrument?: string;
  date?: string;
  all?: boolean;
}

async function clearDailyBiasCache(options: ClearCacheOptions = {}) {
  const { userId, instrument, date, all = false } = options;
  
  try {
    // Build where clause
    const where: any = {};
    
    if (!all) {
      if (userId) where.userId = userId;
      if (instrument) where.instrument = instrument;
      if (date) where.date = new Date(date);
    }
    
    // Count before deletion
    const count = await prisma.dailyBiasAnalysis.count({ where });
    
    if (count === 0) {
      console.log('✅ No analyses found matching criteria');
      return;
    }
    
    console.log(`🗑️  Found ${count} analysis(es) to delete`);
    
    if (!all && count > 10) {
      console.log('⚠️  More than 10 analyses will be deleted. Use --all flag to confirm.');
      return;
    }
    
    // Confirm deletion
    console.log('Deleting...');
    
    const result = await prisma.dailyBiasAnalysis.deleteMany({ where });
    
    console.log(`✅ Successfully deleted ${result.count} daily bias analysis(es)`);
    
    if (result.count > 0) {
      console.log('\n📝 Next steps:');
      console.log('   1. Navigate to the Daily Bias page');
      console.log('   2. Select an instrument');
      console.log('   3. Click "Analyze" to generate fresh analysis');
    }
    
  } catch (error: any) {
    console.error('❌ Error clearing cache:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Parse CLI arguments
const args = process.argv.slice(2);
const options: ClearCacheOptions = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const value = args[i + 1];
  
  if (arg === '--user-id' && value) {
    options.userId = value;
    i++;
  } else if (arg === '--instrument' && value) {
    options.instrument = value;
    i++;
  } else if (arg === '--date' && value) {
    options.date = value;
    i++;
  } else if (arg === '--all') {
    options.all = true;
  }
}

// Print usage if no options provided
if (Object.keys(options).length === 0) {
  console.log(`
📚 Clear Daily Bias Analysis Cache

Usage:
  tsx scripts/clear-daily-bias-cache.ts [options]

Options:
  --user-id <uuid>      Clear cache for specific user
  --instrument <symbol> Clear cache for specific instrument (e.g., NQ1, TSLA)
  --date <YYYY-MM-DD>   Clear cache for specific date
  --all                 Clear ALL analyses (use with caution)

Examples:
  # Clear all NQ1 analyses
  tsx scripts/clear-daily-bias-cache.ts --instrument NQ1
  
  # Clear all analyses for today
  tsx scripts/clear-daily-bias-cache.ts --date 2026-01-20
  
  # Clear specific user's analyses
  tsx scripts/clear-daily-bias-cache.ts --user-id abc-123-def
  
  # Clear ALL cache (nuclear option)
  tsx scripts/clear-daily-bias-cache.ts --all
  `);
  process.exit(0);
}

// Run the script
clearDailyBiasCache(options).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
