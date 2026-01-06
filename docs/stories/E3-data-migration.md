# Epic 3: Script ETL - Migration des Données

**Epic ID:** E3  
**Estimation:** 8h  
**Statut:** Ready for Dev  
**Dépendances:** E1, E2  
**Criticité:** 🔴 HAUTE - Zéro perte de données requise

---

## Stories

### E3-S1: Setup environnement migration

**Story ID:** E3-S1  
**Points:** 2  
**Priorité:** P0 (Bloquant)

#### Description
Configurer l'environnement pour exécuter le script de migration avec accès aux deux bases.

#### Critères d'acceptation
- [ ] Accès MySQL source configuré
- [ ] Accès PostgreSQL Supabase configuré
- [ ] Script exécutable avec tsx

#### Fichiers à créer

**`scripts/migrate-to-supabase.ts`** (structure initiale)
```typescript
import { PrismaClient as PrismaMySQL } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

// Configuration
const MYSQL_URL = process.env.MYSQL_DATABASE_URL!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const POSTGRES_URL = process.env.DATABASE_URL!

// Clients
const prismaMySQL = new PrismaMySQL({
  datasources: { db: { url: MYSQL_URL } }
})

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Pour PostgreSQL, on utilisera un client Prisma séparé
// ou des requêtes SQL directes via supabase

async function main() {
  console.log('🚀 Starting migration...')
  
  // Test connections
  await testConnections()
  
  // TODO: Migration logic
  
  console.log('✅ Migration complete!')
}

async function testConnections() {
  // Test MySQL
  const mysqlCount = await prismaMySQL.user.count()
  console.log(`MySQL connected: ${mysqlCount} users found`)
  
  // Test Supabase
  const { data, error } = await supabaseAdmin.auth.admin.listUsers()
  console.log(`Supabase connected: ${error ? 'ERROR' : 'OK'}`)
}

main()
  .catch(console.error)
  .finally(() => prismaMySQL.$disconnect())
```

**Variables d'environnement requises:**
```env
# Pour la migration uniquement
MYSQL_DATABASE_URL=mysql://user:pass@host:3306/trading_journal
```

#### Commande de test
```bash
npx tsx scripts/migrate-to-supabase.ts
```

---

### E3-S2: Migration des Users

**Story ID:** E3-S2  
**Points:** 5  
**Priorité:** P0 (Bloquant)

#### Description
Migrer tous les users de MySQL vers Supabase Auth + public.users.

#### Critères d'acceptation
- [ ] Tous les users créés dans auth.users (Supabase Auth)
- [ ] Tous les users créés dans public.users (avec même UUID)
- [ ] Mapping oldId → newId sauvegardé
- [ ] Count MySQL = Count Supabase

#### Logique de migration

```typescript
interface MigrationContext {
  userIdMap: Map<string, string>  // oldCuid → newUuid
  // autres maps...
}

async function migrateUsers(ctx: MigrationContext) {
  console.log('📦 Migrating users...')
  
  const users = await prismaMySQL.user.findMany()
  console.log(`Found ${users.length} users to migrate`)
  
  for (const user of users) {
    try {
      // 1. Créer dans Supabase Auth (sans mot de passe - ils devront reset)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        email_confirm: true,  // Marquer comme confirmé
        user_metadata: {
          discordUsername: user.discordUsername,
          migratedFrom: 'mysql',
          originalId: user.id,
          migratedAt: new Date().toISOString(),
        },
      })
      
      if (authError) {
        console.error(`❌ Failed to create auth user ${user.email}:`, authError.message)
        continue
      }
      
      const newUuid = authData.user.id
      ctx.userIdMap.set(user.id, newUuid)
      
      // 2. Créer dans public.users via SQL direct
      const { error: dbError } = await supabaseAdmin.from('users').insert({
        id: newUuid,
        email: user.email,
        discord_username: user.discordUsername,
        is_blocked: user.isBlocked,
        created_at: user.createdAt.toISOString(),
        updated_at: user.updatedAt.toISOString(),
      })
      
      if (dbError) {
        console.error(`❌ Failed to create public user ${user.email}:`, dbError.message)
        // Cleanup: supprimer auth user
        await supabaseAdmin.auth.admin.deleteUser(newUuid)
        ctx.userIdMap.delete(user.id)
        continue
      }
      
      console.log(`✅ User migrated: ${user.email} (${user.id} → ${newUuid})`)
      
    } catch (error) {
      console.error(`❌ Error migrating user ${user.email}:`, error)
    }
  }
  
  console.log(`📊 Users migrated: ${ctx.userIdMap.size}/${users.length}`)
}
```

#### Notes importantes
- Les users n'auront PAS de mot de passe après migration
- Ils devront utiliser "Forgot Password" pour en définir un
- L'email préventif sera envoyé AVANT le cutover (E7)

---

### E3-S3: Migration des données Level 1

**Story ID:** E3-S3  
**Points:** 3  
**Priorité:** P0 (Bloquant)

#### Description
Migrer les tables qui dépendent uniquement de User : Tags, Accounts, Playbooks, ImportProfiles, DayJournals.

#### Critères d'acceptation
- [ ] Tags migrés avec nouveau userId
- [ ] Accounts migrés avec nouveau userId
- [ ] Playbooks migrés avec nouveau userId
- [ ] ImportProfiles migrés avec nouveau userId
- [ ] DayJournals migrés avec nouveau userId
- [ ] Tous les mappings d'ID sauvegardés

#### Logique de migration

```typescript
async function migrateLevel1(ctx: MigrationContext) {
  await Promise.all([
    migrateTags(ctx),
    migrateAccounts(ctx),
    migratePlaybooks(ctx),
    migrateImportProfiles(ctx),
    migrateDayJournals(ctx),
  ])
}

async function migrateTags(ctx: MigrationContext) {
  console.log('📦 Migrating tags...')
  const tags = await prismaMySQL.tag.findMany()
  
  for (const tag of tags) {
    const newUserId = ctx.userIdMap.get(tag.userId)
    if (!newUserId) {
      console.warn(`⚠️ Skipping tag ${tag.id}: user not found`)
      continue
    }
    
    const newId = crypto.randomUUID()
    ctx.tagIdMap.set(tag.id, newId)
    
    await supabaseAdmin.from('tags').insert({
      id: newId,
      user_id: newUserId,
      name: tag.name,
      color: tag.color,
      created_at: tag.createdAt.toISOString(),
      updated_at: tag.updatedAt.toISOString(),
    })
  }
  
  console.log(`✅ Tags migrated: ${ctx.tagIdMap.size}/${tags.length}`)
}

async function migrateAccounts(ctx: MigrationContext) {
  console.log('📦 Migrating accounts...')
  const accounts = await prismaMySQL.account.findMany()
  
  for (const account of accounts) {
    const newUserId = ctx.userIdMap.get(account.userId)
    if (!newUserId) continue
    
    const newId = crypto.randomUUID()
    ctx.accountIdMap.set(account.id, newId)
    
    await supabaseAdmin.from('accounts').insert({
      id: newId,
      user_id: newUserId,
      name: account.name,
      broker: account.broker,
      description: account.description,
      color: account.color,
      initial_balance: account.initialBalance?.toString(),
      created_at: account.createdAt.toISOString(),
      updated_at: account.updatedAt.toISOString(),
    })
  }
  
  console.log(`✅ Accounts migrated: ${ctx.accountIdMap.size}/${accounts.length}`)
}

// Similar for Playbooks, ImportProfiles, DayJournals...
```

---

### E3-S4: Migration des Trades

**Story ID:** E3-S4  
**Points:** 5  
**Priorité:** P0 (Bloquant)

#### Description
Migrer tous les trades avec leurs nouvelles foreign keys.

#### Critères d'acceptation
- [ ] Tous les trades migrés
- [ ] userId remappé vers nouveau UUID
- [ ] accountId remappé (si présent)
- [ ] Champs Decimal correctement convertis
- [ ] Count vérifié

#### Logique de migration

```typescript
async function migrateTrades(ctx: MigrationContext) {
  console.log('📦 Migrating trades...')
  const trades = await prismaMySQL.trade.findMany()
  
  let migrated = 0
  let skipped = 0
  
  for (const trade of trades) {
    const newUserId = ctx.userIdMap.get(trade.userId)
    if (!newUserId) {
      console.warn(`⚠️ Skipping trade ${trade.id}: user not found`)
      skipped++
      continue
    }
    
    const newAccountId = trade.accountId 
      ? ctx.accountIdMap.get(trade.accountId) 
      : null
    
    const newId = crypto.randomUUID()
    ctx.tradeIdMap.set(trade.id, newId)
    
    await supabaseAdmin.from('trades').insert({
      id: newId,
      user_id: newUserId,
      symbol: trade.symbol,
      direction: trade.direction,
      opened_at: trade.openedAt.toISOString(),
      closed_at: trade.closedAt.toISOString(),
      entry_price: trade.entryPrice.toString(),
      exit_price: trade.exitPrice.toString(),
      quantity: trade.quantity.toString(),
      realized_pnl_usd: trade.realizedPnlUsd.toString(),
      floating_runup_usd: trade.floatingRunupUsd?.toString() || null,
      floating_drawdown_usd: trade.floatingDrawdownUsd?.toString() || null,
      stop_loss_price_initial: trade.stopLossPriceInitial?.toString() || null,
      risk_reward_ratio: trade.riskRewardRatio?.toString() || null,
      point_value: trade.pointValue.toString(),
      import_hash: trade.importHash,
      trade_signature: trade.tradeSignature,
      account_id: newAccountId,
      fees: trade.fees?.toString() || null,
      gross_pnl_usd: trade.grossPnlUsd?.toString() || null,
      note: trade.note,
      planned_r_multiple: trade.plannedRMultiple?.toString() || null,
      points: trade.points?.toString() || null,
      profit_target: trade.profitTarget?.toString() || null,
      rating: trade.rating,
      realized_r_multiple: trade.realizedRMultiple?.toString() || null,
      ticks_per_contract: trade.ticksPerContract?.toString() || null,
      youtube_url: trade.youtubeUrl,
      times_manually_set: trade.timesManuallySet,
      reviewed: trade.reviewed,
      has_partial_exits: trade.hasPartialExits,
      created_at: trade.createdAt.toISOString(),
      updated_at: trade.updatedAt.toISOString(),
    })
    
    migrated++
  }
  
  console.log(`✅ Trades migrated: ${migrated}/${trades.length} (skipped: ${skipped})`)
}
```

---

### E3-S5: Migration des données Level 2-3

**Story ID:** E3-S5  
**Points:** 3  
**Priorité:** P0 (Bloquant)

#### Description
Migrer TradeExits, PlaybookGroups, PlaybookPrerequisites, TradePlaybooks, Screenshots.

#### Critères d'acceptation
- [ ] TradeExits migrés avec nouveau tradeId
- [ ] PlaybookGroups migrés
- [ ] PlaybookPrerequisites migrés
- [ ] TradePlaybooks migrés
- [ ] Screenshots migrés (paths inchangés)

#### Notes
- Les fichiers screenshots restent sur le filesystem (pas de migration)
- Seuls les enregistrements DB sont migrés

---

### E3-S6: Migration des many-to-many

**Story ID:** E3-S6  
**Points:** 2  
**Priorité:** P0 (Bloquant)

#### Description
Migrer les tables de liaison : TradeTags, DayTags, TradePlaybookPrerequisites.

#### Critères d'acceptation
- [ ] TradeTags migrés avec nouveaux IDs
- [ ] DayTags migrés avec nouveaux IDs
- [ ] TradePlaybookPrerequisites migrés

#### Logique

```typescript
async function migrateTradeTags(ctx: MigrationContext) {
  console.log('📦 Migrating trade tags...')
  const tradeTags = await prismaMySQL.tradeTag.findMany()
  
  let migrated = 0
  
  for (const tt of tradeTags) {
    const newTradeId = ctx.tradeIdMap.get(tt.tradeId)
    const newTagId = ctx.tagIdMap.get(tt.tagId)
    
    if (!newTradeId || !newTagId) {
      continue
    }
    
    await supabaseAdmin.from('trade_tags').insert({
      trade_id: newTradeId,
      tag_id: newTagId,
    })
    
    migrated++
  }
  
  console.log(`✅ TradeTags migrated: ${migrated}/${tradeTags.length}`)
}
```

---

### E3-S7: Validation post-migration

**Story ID:** E3-S7  
**Points:** 2  
**Priorité:** P0 (Bloquant)

#### Description
Valider que toutes les données ont été migrées correctement.

#### Critères d'acceptation
- [ ] Count identique pour chaque table
- [ ] Spot-check sur quelques enregistrements
- [ ] Aucune FK orpheline

#### Script de validation

```typescript
async function validateMigration(ctx: MigrationContext) {
  console.log('🔍 Validating migration...')
  
  const tables = [
    { name: 'users', mysql: prismaMySQL.user, pg: 'users' },
    { name: 'trades', mysql: prismaMySQL.trade, pg: 'trades' },
    { name: 'trade_exits', mysql: prismaMySQL.tradeExit, pg: 'trade_exits' },
    { name: 'day_journals', mysql: prismaMySQL.dayJournal, pg: 'day_journals' },
    { name: 'tags', mysql: prismaMySQL.tag, pg: 'tags' },
    { name: 'trade_tags', mysql: prismaMySQL.tradeTag, pg: 'trade_tags' },
    { name: 'day_tags', mysql: prismaMySQL.dayTag, pg: 'day_tags' },
    { name: 'screenshots', mysql: prismaMySQL.screenshot, pg: 'screenshots' },
    { name: 'import_profiles', mysql: prismaMySQL.importProfile, pg: 'import_profiles' },
    { name: 'playbooks', mysql: prismaMySQL.playbook, pg: 'playbooks' },
    { name: 'playbook_groups', mysql: prismaMySQL.playbookGroup, pg: 'playbook_groups' },
    { name: 'playbook_prerequisites', mysql: prismaMySQL.playbookPrerequisite, pg: 'playbook_prerequisites' },
    { name: 'trade_playbooks', mysql: prismaMySQL.tradePlaybook, pg: 'trade_playbooks' },
    { name: 'trade_playbook_prerequisites', mysql: prismaMySQL.tradePlaybookPrerequisite, pg: 'trade_playbook_prerequisites' },
    { name: 'accounts', mysql: prismaMySQL.account, pg: 'accounts' },
  ]
  
  const results = []
  let allPassed = true
  
  for (const { name, mysql, pg } of tables) {
    const mysqlCount = await mysql.count()
    const { count: pgCount } = await supabaseAdmin
      .from(pg)
      .select('*', { count: 'exact', head: true })
    
    const passed = mysqlCount === pgCount
    if (!passed) allPassed = false
    
    results.push({
      table: name,
      mysql: mysqlCount,
      postgres: pgCount,
      status: passed ? '✅' : '❌',
    })
  }
  
  console.table(results)
  
  if (!allPassed) {
    throw new Error('❌ Migration validation FAILED - counts do not match!')
  }
  
  console.log('✅ All validations passed!')
}
```

---

### E3-S8: Sauvegarder mapping IDs

**Story ID:** E3-S8  
**Points:** 1  
**Priorité:** P1 (Important)

#### Description
Sauvegarder le mapping des anciens IDs vers les nouveaux pour référence future.

#### Critères d'acceptation
- [ ] Fichier JSON généré avec tous les mappings
- [ ] Fichier stocké en lieu sûr

#### Output

```typescript
async function saveMappings(ctx: MigrationContext) {
  const mappings = {
    users: Object.fromEntries(ctx.userIdMap),
    trades: Object.fromEntries(ctx.tradeIdMap),
    tags: Object.fromEntries(ctx.tagIdMap),
    accounts: Object.fromEntries(ctx.accountIdMap),
    // ...
    generatedAt: new Date().toISOString(),
  }
  
  const filename = `migration-mappings-${Date.now()}.json`
  fs.writeFileSync(filename, JSON.stringify(mappings, null, 2))
  console.log(`📄 Mappings saved to ${filename}`)
}
```

---

## Checklist Epic E3

- [ ] E3-S1: Environnement migration configuré
- [ ] E3-S2: Users migrés (auth + public)
- [ ] E3-S3: Level 1 migré (Tags, Accounts, etc.)
- [ ] E3-S4: Trades migrés
- [ ] E3-S5: Level 2-3 migrés
- [ ] E3-S6: Many-to-many migrés
- [ ] E3-S7: Validation passée
- [ ] E3-S8: Mappings sauvegardés

**Epic E3 terminé quand :** Validation 100% réussie, zéro différence de count.

