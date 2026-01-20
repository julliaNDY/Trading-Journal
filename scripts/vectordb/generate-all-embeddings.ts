/**
 * Generate Embeddings for All Existing Data
 * 
 * This script generates embeddings for:
 * - All trades (all users)
 * - All playbooks
 * - All journal entries
 * - Coach messages (optional)
 * 
 * Usage:
 *   npx tsx scripts/vectordb/generate-all-embeddings.ts
 *   npx tsx scripts/vectordb/generate-all-embeddings.ts --user-id=xxx  # Only for specific user
 *   npx tsx scripts/vectordb/generate-all-embeddings.ts --force        # Re-embed everything
 */

import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

// Must import after loading env
import { getEmbeddingPipelineService } from '../../src/services/embedding-pipeline-service';
import prisma from '../../src/lib/prisma';
import { logger } from '../../src/lib/observability';

// ============================================================================
// Main
// ============================================================================

interface EmbeddingStats {
  trades: { total: number; succeeded: number; failed: number };
  playbooks: { total: number; succeeded: number; failed: number };
  journalEntries: { total: number; succeeded: number; failed: number };
}

async function embedAllTrades(userId?: string, forceReembed = false): Promise<{ total: number; succeeded: number; failed: number }> {
  const pipeline = getEmbeddingPipelineService();
  
  if (!pipeline.isAvailable()) {
    throw new Error('Embedding pipeline not available. Check QDRANT_URL and GOOGLE_API_KEY.');
  }

  const where = userId ? { userId } : {};
  const users = userId 
    ? await prisma.user.findMany({ where: { id: userId } })
    : await prisma.user.findMany();

  if (users.length === 0) {
    console.log('   ⚠️  No users found');
    return { total: 0, succeeded: 0, failed: 0 };
  }

  let totalTrades = 0;
  let totalSucceeded = 0;
  let totalFailed = 0;

  for (const user of users) {
    console.log(`\n   📊 Processing user: ${user.email} (${user.id})`);
    
    const result = await pipeline.embedUserTrades(user.id, { forceReembed });
    
    totalTrades += result.progress.total;
    totalSucceeded += result.progress.succeeded;
    totalFailed += result.progress.failed;

    console.log(`      ✅ Succeeded: ${result.progress.succeeded}`);
    console.log(`      ❌ Failed: ${result.progress.failed}`);
    console.log(`      ⏭️  Skipped: ${result.progress.skipped}`);
    
    if (result.errors.length > 0) {
      console.log(`      ⚠️  Errors: ${result.errors.length}`);
      result.errors.slice(0, 3).forEach(err => console.log(`         - ${err}`));
    }
  }

  return { total: totalTrades, succeeded: totalSucceeded, failed: totalFailed };
}

async function embedAllPlaybooks(forceReembed = false): Promise<{ total: number; succeeded: number; failed: number }> {
  const pipeline = getEmbeddingPipelineService();
  
  const playbooks = await prisma.playbook.findMany({
    include: {
      groups: {
        include: {
          prerequisites: true,
        },
      },
    },
  });

  console.log(`\n   📚 Processing ${playbooks.length} playbooks...`);

  let succeeded = 0;
  let failed = 0;

  for (const playbook of playbooks) {
    try {
      const success = await pipeline.embedPlaybook(playbook.id);
      if (success) {
        succeeded++;
        if (succeeded % 10 === 0) {
          process.stdout.write(`      ✅ ${succeeded}/${playbooks.length}\r`);
        }
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
      logger.error('Failed to embed playbook', { playbookId: playbook.id, error });
    }
  }

  console.log(`\n      ✅ Succeeded: ${succeeded}`);
  console.log(`      ❌ Failed: ${failed}`);

  return { total: playbooks.length, succeeded, failed };
}

async function embedAllJournalEntries(userId?: string, forceReembed = false): Promise<{ total: number; succeeded: number; failed: number }> {
  const pipeline = getEmbeddingPipelineService();
  
  const where = userId ? { userId } : {};
  const journalEntries = await prisma.dayJournal.findMany({
    where,
    include: {
      tags: { include: { tag: true } },
      voiceNotes: true,
    },
  });

  console.log(`\n   📔 Processing ${journalEntries.length} journal entries...`);

  let succeeded = 0;
  let failed = 0;

  for (const journal of journalEntries) {
    try {
      const success = await pipeline.embedJournalEntry(journal.id);
      if (success) {
        succeeded++;
        if (succeeded % 50 === 0) {
          process.stdout.write(`      ✅ ${succeeded}/${journalEntries.length}\r`);
        }
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
      logger.error('Failed to embed journal entry', { journalId: journal.id, error });
    }
  }

  console.log(`\n      ✅ Succeeded: ${succeeded}`);
  console.log(`      ❌ Failed: ${failed}`);

  return { total: journalEntries.length, succeeded, failed };
}

async function main() {
  console.log('='.repeat(60));
  console.log('Generate Embeddings for All Existing Data');
  console.log('='.repeat(60));

  const startTime = Date.now();
  const args = process.argv.slice(2);
  const userId = args.find(arg => arg.startsWith('--user-id='))?.split('=')[1];
  const forceReembed = args.includes('--force');

  if (userId) {
    console.log(`\n👤 Processing for user: ${userId}`);
  } else {
    console.log(`\n👥 Processing for all users`);
  }

  if (forceReembed) {
    console.log(`\n⚠️  Force re-embedding enabled (will re-embed existing data)`);
  }

  const stats: EmbeddingStats = {
    trades: { total: 0, succeeded: 0, failed: 0 },
    playbooks: { total: 0, succeeded: 0, failed: 0 },
    journalEntries: { total: 0, succeeded: 0, failed: 0 },
  };

  try {
    // 1. Embed all trades
    console.log('\n📈 Step 1/3: Embedding trades...');
    stats.trades = await embedAllTrades(userId, forceReembed);

    // 2. Embed all playbooks
    console.log('\n📚 Step 2/3: Embedding playbooks...');
    stats.playbooks = await embedAllPlaybooks(forceReembed);

    // 3. Embed all journal entries
    console.log('\n📔 Step 3/3: Embedding journal entries...');
    stats.journalEntries = await embedAllJournalEntries(userId, forceReembed);

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log('✅ Embedding Complete!');
    console.log('='.repeat(60));
    console.log(`\n⏱️  Duration: ${duration}s`);
    console.log('\n📊 Summary:');
    console.log(`   Trades:        ${stats.trades.succeeded}/${stats.trades.total} succeeded, ${stats.trades.failed} failed`);
    console.log(`   Playbooks:     ${stats.playbooks.succeeded}/${stats.playbooks.total} succeeded, ${stats.playbooks.failed} failed`);
    console.log(`   Journal:       ${stats.journalEntries.succeeded}/${stats.journalEntries.total} succeeded, ${stats.journalEntries.failed} failed`);
    
    const totalSucceeded = stats.trades.succeeded + stats.playbooks.succeeded + stats.journalEntries.succeeded;
    const totalFailed = stats.trades.failed + stats.playbooks.failed + stats.journalEntries.failed;
    const total = stats.trades.total + stats.playbooks.total + stats.journalEntries.total;
    
    console.log(`\n   Total:         ${totalSucceeded}/${total} succeeded, ${totalFailed} failed`);
    
    if (totalFailed > 0) {
      console.log(`\n⚠️  ${totalFailed} items failed. Check logs for details.`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
