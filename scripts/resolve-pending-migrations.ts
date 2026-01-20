/**
 * Resolve Pending Migrations
 * 
 * Marks pending migrations as applied if a successful version exists.
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config({ path: '.env.local' });
config({ path: '.env' });

const prisma = new PrismaClient();

async function resolvePendingMigrations() {
  console.log('='.repeat(60));
  console.log('Resolve Pending Migrations');
  console.log('='.repeat(60));

  try {
    // Get all migrations
    const allMigrations = await prisma.$queryRaw<Array<{
      migration_name: string;
      finished_at: Date | null;
      started_at: Date;
    }>>`
      SELECT migration_name, finished_at, started_at
      FROM "_prisma_migrations"
      ORDER BY migration_name, started_at
    `;

    // Group by migration name
    const grouped = new Map<string, typeof allMigrations>();
    for (const m of allMigrations) {
      if (!grouped.has(m.migration_name)) {
        grouped.set(m.migration_name, []);
      }
      grouped.get(m.migration_name)!.push(m);
    }

    // Find migrations with both applied and pending versions
    const toResolve: string[] = [];
    
    for (const [name, migrations] of grouped.entries()) {
      const hasApplied = migrations.some(m => m.finished_at !== null);
      const hasPending = migrations.some(m => m.finished_at === null);
      
      if (hasApplied && hasPending) {
        console.log(`\n📋 Migration "${name}":`);
        console.log(`   ✅ Has applied version`);
        console.log(`   ⏳ Has ${migrations.filter(m => !m.finished_at).length} pending version(s)`);
        
        // Get pending versions
        const pending = migrations.filter(m => !m.finished_at);
        for (const p of pending) {
          toResolve.push(p.migration_name);
          console.log(`   💡 Will resolve: ${p.migration_name} (started: ${p.started_at.toISOString()})`);
        }
      }
    }

    if (toResolve.length === 0) {
      console.log('\n✅ No migrations to resolve!');
      return;
    }

    // Resolve pending migrations
    console.log(`\n🔧 Resolving ${toResolve.length} pending migrations...\n`);
    
    for (const migrationName of toResolve) {
      try {
        await prisma.$executeRaw`
          UPDATE "_prisma_migrations"
          SET finished_at = started_at
          WHERE migration_name = ${migrationName}
            AND finished_at IS NULL
        `;
        console.log(`   ✅ Resolved: ${migrationName}`);
      } catch (error) {
        console.error(`   ❌ Failed to resolve ${migrationName}:`, error);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Pending migrations resolved!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error resolving migrations:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resolvePendingMigrations().catch(console.error);
