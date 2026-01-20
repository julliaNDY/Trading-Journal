/**
 * Check Prisma Migration Status
 * 
 * Checks if all migrations are applied to the database.
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });
config({ path: '.env' });

const prisma = new PrismaClient();

async function checkMigrationStatus() {
  console.log('='.repeat(60));
  console.log('Prisma Migration Status Check');
  console.log('='.repeat(60));

  try {
    // Check migration status using Prisma CLI
    console.log('\n📋 Checking migration status with Prisma CLI...\n');
    
    try {
      const output = execSync('npx prisma migrate status', {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      console.log(output);
    } catch (error: any) {
      if (error.stdout) {
        console.log(error.stdout);
      }
      if (error.stderr && !error.stderr.includes('Database schema is up to date')) {
        console.error('Error:', error.stderr);
      }
    }

    // Check applied migrations in database
    console.log('\n📊 Applied Migrations in Database:\n');
    
    const appliedMigrations = await prisma.$queryRaw<Array<{
      migration_name: string;
      finished_at: Date | null;
      started_at: Date;
    }>>`
      SELECT migration_name, finished_at, started_at
      FROM "_prisma_migrations"
      ORDER BY started_at DESC
    `;

    if (appliedMigrations.length === 0) {
      console.log('   ⚠️  No migrations found in database');
    } else {
      console.log(`   ✅ Found ${appliedMigrations.length} applied migrations:\n`);
      appliedMigrations.forEach((m, i) => {
        const status = m.finished_at ? '✅ Applied' : '⏳ Pending';
        const date = m.finished_at || m.started_at;
        console.log(`   ${i + 1}. ${m.migration_name}`);
        console.log(`      ${status} - ${date.toISOString()}`);
      });
    }

    // Count local migration files
    const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
    const migrationDirs = readdirSync(migrationsDir)
      .filter((f) => {
        const fullPath = join(migrationsDir, f);
        return statSync(fullPath).isDirectory() && f !== '.git';
      });

    console.log(`\n📁 Local Migration Files: ${migrationDirs.length}`);
    
    // Check if all local migrations are applied
    const appliedNames = new Set(appliedMigrations.map(m => m.migration_name));
    const missing = migrationDirs.filter((dir) => !appliedNames.has(dir));
    
    if (missing.length > 0) {
      console.log(`\n   ⚠️  ${missing.length} migrations not applied:`);
      missing.forEach((m) => console.log(`      - ${m}`));
      console.log('\n   💡 Run: npx prisma migrate deploy');
    } else {
      console.log('\n   ✅ All local migrations are applied!');
    }

    // Check for pending migrations
    const pending = appliedMigrations.filter(m => !m.finished_at);
    if (pending.length > 0) {
      console.log(`\n   ⚠️  ${pending.length} migrations are pending (started but not finished):`);
      pending.forEach((m) => console.log(`      - ${m.migration_name}`));
      console.log('\n   💡 Run: npx prisma migrate resolve --applied <migration_name>');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    if (missing.length === 0 && pending.length === 0) {
      console.log('✅ All migrations are applied successfully!');
    } else {
      console.log('⚠️  Some migrations need attention');
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error checking migration status:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkMigrationStatus().catch(console.error);
