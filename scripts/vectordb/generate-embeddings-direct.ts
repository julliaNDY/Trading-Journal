/**
 * Generate Embeddings Directly (using HTTP native)
 * 
 * Alternative implementation that bypasses fetch issues
 */

import { config } from 'dotenv';
import https from 'https';
import http from 'http';

config({ path: '.env.local' });
config({ path: '.env' });

import { generateBatchEmbeddings, tradeToEmbeddingText, type TradeEmbeddingInput } from '../../src/lib/embeddings';
import prisma from '../../src/lib/prisma';
import { logger } from '../../src/lib/observability';

const QDRANT_URL = process.env.QDRANT_URL!;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY!;
const COLLECTIONS = {
  trades: 'trades',
  playbooks: 'playbooks',
  journal_entries: 'journal_entries',
  coach_history: 'coach_history',
};

function makeRequest(url: string, options: { method: string; headers: Record<string, string>; body?: string }): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method,
      headers: options.headers,
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } catch {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function upsertPoints(collection: string, points: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }>): Promise<void> {
  if (points.length === 0) return;

  const url = `${QDRANT_URL}/collections/${collection}/points?wait=true`;
  
  await makeRequest(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'api-key': QDRANT_API_KEY,
    },
    body: JSON.stringify({
      points: points.map(p => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    }),
  });
}

async function embedUserTrades(userId: string): Promise<{ total: number; succeeded: number; failed: number }> {
  const trades = await prisma.trade.findMany({
    where: { userId },
    include: {
      tags: { include: { tag: true } },
    },
    orderBy: { closedAt: 'desc' },
  });

  console.log(`   📊 Processing ${trades.length} trades for user ${userId}...`);

  const BATCH_SIZE = 50;
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < trades.length; i += BATCH_SIZE) {
    const batch = trades.slice(i, i + BATCH_SIZE);
    
    try {
      // Generate text representations
      const texts = batch.map((trade) => {
        const input: TradeEmbeddingInput = {
          symbol: trade.symbol,
          direction: trade.direction as 'LONG' | 'SHORT',
          pnlUsd: Number(trade.realizedPnlUsd),
          riskReward: trade.riskRewardRatio ? Number(trade.riskRewardRatio) : undefined,
          notes: trade.note || undefined,
          tags: trade.tags.map((t) => t.tag.name),
        };
        return tradeToEmbeddingText(input);
      });

      // Generate embeddings
      const embeddings = await generateBatchEmbeddings(texts);

      // Create points
      const points = batch.map((trade, idx) => ({
        id: trade.id,
        vector: embeddings.embeddings[idx],
        payload: {
          user_id: userId,
          trade_id: trade.id,
          symbol: trade.symbol,
          direction: trade.direction,
          pnl_positive: Number(trade.realizedPnlUsd) > 0,
          closed_at: Math.floor(trade.closedAt.getTime() / 1000),
        },
      }));

      // Upsert to Qdrant
      await upsertPoints(COLLECTIONS.trades, points);
      succeeded += batch.length;
      
      if (succeeded % 100 === 0) {
        console.log(`      ✅ Processed ${succeeded}/${trades.length} trades...`);
      }
    } catch (error) {
      failed += batch.length;
      logger.error('Failed to embed batch', {
        userId,
        batchStart: i,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { total: trades.length, succeeded, failed };
}

async function main() {
  console.log('='.repeat(60));
  console.log('Generate Embeddings (Direct HTTP)');
  console.log('='.repeat(60));

  const args = process.argv.slice(2);
  const userId = args.find(arg => arg.startsWith('--user-id='))?.split('=')[1];

  const users = userId 
    ? await prisma.user.findMany({ where: { id: userId } })
    : await prisma.user.findMany();

  if (users.length === 0) {
    console.log('❌ No users found');
    process.exit(1);
  }

  let totalTrades = 0;
  let totalSucceeded = 0;
  let totalFailed = 0;

  for (const user of users) {
    console.log(`\n👤 Processing user: ${user.email}`);
    const result = await embedUserTrades(user.id);
    totalTrades += result.total;
    totalSucceeded += result.succeeded;
    totalFailed += result.failed;
    console.log(`   ✅ ${result.succeeded}/${result.total} succeeded, ${result.failed} failed`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Complete!');
  console.log('='.repeat(60));
  console.log(`\n📊 Total: ${totalSucceeded}/${totalTrades} succeeded, ${totalFailed} failed`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});
