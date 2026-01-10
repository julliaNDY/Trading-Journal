/**
 * Script de migration MySQL → Supabase PostgreSQL
 * 
 * Ce script :
 * 1. Extrait toutes les données de MySQL
 * 2. Crée les utilisateurs dans Supabase Auth
 * 3. Migre toutes les données vers PostgreSQL avec les nouveaux UUIDs
 * 
 * Usage:
 *   npx ts-node scripts/migrate-mysql-to-supabase.ts
 * 
 * Variables d'environnement requises:
 *   - MYSQL_URL: URL de connexion MySQL source
 *   - DATABASE_URL: URL PostgreSQL Supabase (déjà configuré)
 *   - SUPABASE_SERVICE_ROLE_KEY: Clé admin Supabase
 *   - NEXT_PUBLIC_SUPABASE_URL: URL du projet Supabase
 */

// Charger les variables d'environnement depuis .env.local
import { config } from 'dotenv'
config({ path: '.env.local' })

// @ts-expect-error - mysql2 is optional dependency for migration script only
import mysql from 'mysql2/promise'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

// Configuration
const MYSQL_URL = process.env.MYSQL_URL || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Clients
const prisma = new PrismaClient()
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Mapping des anciens IDs vers les nouveaux UUIDs
const idMapping: Record<string, Record<string, string>> = {
  users: {},
  trades: {},
  accounts: {},
  tags: {},
  dayJournals: {},
  screenshots: {},
  importProfiles: {},
  playbooks: {},
  playbookGroups: {},
  playbookPrerequisites: {},
  tradePlaybooks: {},
}

interface MigrationStats {
  users: { total: number; migrated: number; errors: number }
  accounts: { total: number; migrated: number; errors: number }
  trades: { total: number; migrated: number; errors: number }
  tags: { total: number; migrated: number; errors: number }
  dayJournals: { total: number; migrated: number; errors: number }
  screenshots: { total: number; migrated: number; errors: number }
  tradeTags: { total: number; migrated: number; errors: number }
  dayTags: { total: number; migrated: number; errors: number }
  importProfiles: { total: number; migrated: number; errors: number }
  playbooks: { total: number; migrated: number; errors: number }
  playbookGroups: { total: number; migrated: number; errors: number }
  playbookPrerequisites: { total: number; migrated: number; errors: number }
  tradePlaybooks: { total: number; migrated: number; errors: number }
  tradePlaybookPrerequisites: { total: number; migrated: number; errors: number }
  tradeExits: { total: number; migrated: number; errors: number }
}

const stats: MigrationStats = {
  users: { total: 0, migrated: 0, errors: 0 },
  accounts: { total: 0, migrated: 0, errors: 0 },
  trades: { total: 0, migrated: 0, errors: 0 },
  tags: { total: 0, migrated: 0, errors: 0 },
  dayJournals: { total: 0, migrated: 0, errors: 0 },
  screenshots: { total: 0, migrated: 0, errors: 0 },
  tradeTags: { total: 0, migrated: 0, errors: 0 },
  dayTags: { total: 0, migrated: 0, errors: 0 },
  importProfiles: { total: 0, migrated: 0, errors: 0 },
  playbooks: { total: 0, migrated: 0, errors: 0 },
  playbookGroups: { total: 0, migrated: 0, errors: 0 },
  playbookPrerequisites: { total: 0, migrated: 0, errors: 0 },
  tradePlaybooks: { total: 0, migrated: 0, errors: 0 },
  tradePlaybookPrerequisites: { total: 0, migrated: 0, errors: 0 },
  tradeExits: { total: 0, migrated: 0, errors: 0 },
}

// Générer un UUID pour un ancien ID
function getNewUuid(table: string, oldId: string): string {
  if (!idMapping[table][oldId]) {
    idMapping[table][oldId] = randomUUID()
  }
  return idMapping[table][oldId]
}

// Convertir les valeurs MySQL (0/1/null) en booléens PostgreSQL
function toBoolean(value: any): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'boolean') return value
  return value === 1 || value === '1' || value === true
}

// Parser l'URL MySQL
function parseMysqlUrl(url: string) {
  const regex = /mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/
  const match = url.match(regex)
  if (!match) throw new Error('Invalid MySQL URL format')
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4]),
    database: match[5].split('?')[0]
  }
}

async function migrateUsers(mysqlConn: mysql.Connection) {
  console.log('\n📦 Migration des utilisateurs...')
  
  const [rows] = await mysqlConn.query('SELECT * FROM users') as [any[], any]
  stats.users.total = rows.length
  
  for (const user of rows) {
    try {
      const newUuid = getNewUuid('users', user.id)
      
      // Créer l'utilisateur dans Supabase Auth
      // Note: On utilise un mot de passe temporaire, l'utilisateur devra faire "forgot password"
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        email_confirm: true, // Marquer comme confirmé
        user_metadata: {
          discordUsername: user.discordUsername || null,
          migratedFrom: 'mysql',
          originalId: user.id
        }
      })
      
      if (authError) {
        // Si l'utilisateur existe déjà dans Supabase Auth, récupérer son ID
        if (authError.message.includes('already been registered')) {
          const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
          const existing = existingUsers?.users.find(u => u.email === user.email)
          if (existing) {
            idMapping.users[user.id] = existing.id
            console.log(`  ⚠️ Utilisateur ${user.email} existe déjà, ID mappé: ${existing.id}`)
          } else {
            throw authError
          }
        } else {
          throw authError
        }
      } else if (authUser?.user) {
        // Utiliser l'ID généré par Supabase Auth
        idMapping.users[user.id] = authUser.user.id
      }
      
      // Créer l'entrée dans public.users
      await prisma.user.upsert({
        where: { id: idMapping.users[user.id] },
        create: {
          id: idMapping.users[user.id],
          email: user.email,
          discordUsername: user.discordUsername || null,
          isBlocked: toBoolean(user.isBlocked),
          createdAt: new Date(user.createdAt),
        },
        update: {
          discordUsername: user.discordUsername || null,
          isBlocked: toBoolean(user.isBlocked),
        }
      })
      
      stats.users.migrated++
      console.log(`  ✓ ${user.email} → ${idMapping.users[user.id]}`)
    } catch (error: any) {
      stats.users.errors++
      console.error(`  ✗ Erreur pour ${user.email}:`, error.message)
    }
  }
}

async function migrateAccounts(mysqlConn: mysql.Connection) {
  console.log('\n📦 Migration des comptes...')
  
  const [rows] = await mysqlConn.query('SELECT * FROM accounts') as [any[], any]
  stats.accounts.total = rows.length
  
  for (const account of rows) {
    try {
      const newUserId = idMapping.users[account.userId]
      if (!newUserId) {
        console.log(`  ⚠️ Skip account ${account.name} - user non migré`)
        stats.accounts.errors++
        continue
      }
      
      const newId = getNewUuid('accounts', account.id)
      
      await prisma.account.upsert({
        where: { id: newId },
        create: {
          id: newId,
          userId: newUserId,
          name: account.name,
          broker: account.broker || null,
          description: account.description || null,
          color: account.color || '#6366f1',
          initialBalance: account.initialBalance || null,
          createdAt: new Date(account.createdAt),
        },
        update: {} // Ne rien mettre à jour si existe déjà
      })
      
      stats.accounts.migrated++
      console.log(`  ✓ ${account.name}`)
    } catch (error: any) {
      stats.accounts.errors++
      console.error(`  ✗ Erreur pour account ${account.name}:`, error.message)
    }
  }
}

async function migrateTags(mysqlConn: mysql.Connection) {
  console.log('\n📦 Migration des tags...')
  
  const [rows] = await mysqlConn.query('SELECT * FROM tags') as [any[], any]
  stats.tags.total = rows.length
  
  for (const tag of rows) {
    try {
      const newUserId = idMapping.users[tag.userId]
      if (!newUserId) continue
      
      const newId = getNewUuid('tags', tag.id)
      
      await prisma.tag.create({
        data: {
          id: newId,
          userId: newUserId,
          name: tag.name,
          color: tag.color || '#6366f1',
          createdAt: new Date(tag.createdAt),
        }
      })
      
      stats.tags.migrated++
      console.log(`  ✓ ${tag.name}`)
    } catch (error: any) {
      stats.tags.errors++
      console.error(`  ✗ Erreur pour tag ${tag.name}:`, error.message)
    }
  }
}

async function migrateTrades(mysqlConn: mysql.Connection) {
  console.log('\n📦 Migration des trades...')
  
  const [rows] = await mysqlConn.query('SELECT * FROM trades') as [any[], any]
  stats.trades.total = rows.length
  
  for (const trade of rows) {
    try {
      const newUserId = idMapping.users[trade.userId]
      if (!newUserId) {
        stats.trades.errors++
        continue
      }
      
      const newId = getNewUuid('trades', trade.id)
      const newAccountId = trade.accountId ? idMapping.accounts[trade.accountId] : null
      
      // Vérifier si le compte existe (pour les trades liés à un compte)
      if (trade.accountId && !newAccountId) {
        stats.trades.errors++
        continue
      }
      
      await prisma.trade.upsert({
        where: { id: newId },
        create: {
          id: newId,
          userId: newUserId,
          accountId: newAccountId,
          symbol: trade.symbol,
          direction: trade.direction,
          openedAt: new Date(trade.openedAt),
          closedAt: new Date(trade.closedAt),
          entryPrice: trade.entryPrice,
          exitPrice: trade.exitPrice,
          quantity: trade.quantity,
          realizedPnlUsd: trade.realizedPnlUsd,
          floatingRunupUsd: trade.floatingRunupUsd || null,
          floatingDrawdownUsd: trade.floatingDrawdownUsd || null,
          stopLossPriceInitial: trade.stopLossPriceInitial || null,
          riskRewardRatio: trade.riskRewardRatio || null,
          pointValue: trade.pointValue || 1,
          importHash: trade.importHash || null,
          tradeSignature: trade.tradeSignature || null,
          fees: trade.fees || null,
          grossPnlUsd: trade.grossPnlUsd || null,
          note: trade.note || null,
          plannedRMultiple: trade.plannedRMultiple || null,
          points: trade.points || null,
          profitTarget: trade.profitTarget || null,
          rating: trade.rating || null,
          realizedRMultiple: trade.realizedRMultiple || null,
          ticksPerContract: trade.ticksPerContract || null,
          youtubeUrl: trade.youtubeUrl || null,
          timesManuallySet: toBoolean(trade.timesManuallySet),
          reviewed: toBoolean(trade.reviewed),
          hasPartialExits: toBoolean(trade.hasPartialExits),
          createdAt: new Date(trade.createdAt),
        },
        update: {} // Ne rien mettre à jour si existe déjà
      })
      
      stats.trades.migrated++
      if (stats.trades.migrated % 100 === 0) {
        console.log(`  ✓ ${stats.trades.migrated}/${stats.trades.total} trades migrés`)
      }
    } catch (error: any) {
      stats.trades.errors++
      console.error(`  ✗ Erreur pour trade ${trade.id}:`, error.message)
    }
  }
  console.log(`  ✓ ${stats.trades.migrated} trades migrés`)
}

async function migrateTradeExits(mysqlConn: mysql.Connection) {
  console.log('\n📦 Migration des sorties partielles...')
  
  try {
    const [rows] = await mysqlConn.query('SELECT * FROM trade_exits') as [any[], any]
    stats.tradeExits.total = rows.length
    
    for (const exit of rows) {
      try {
        const newTradeId = idMapping.trades[exit.tradeId]
        if (!newTradeId) continue
        
        await prisma.tradeExit.create({
          data: {
            id: randomUUID(),
            tradeId: newTradeId,
            exitPrice: exit.exitPrice,
            quantity: exit.quantity,
            exitedAt: new Date(exit.exitedAt),
            pnl: exit.pnl,
            createdAt: new Date(exit.createdAt),
          }
        })
        
        stats.tradeExits.migrated++
      } catch (error: any) {
        stats.tradeExits.errors++
      }
    }
    console.log(`  ✓ ${stats.tradeExits.migrated} sorties partielles migrées`)
  } catch (e) {
    console.log('  ℹ️ Table trade_exits non trouvée, skip')
  }
}

async function migrateDayJournals(mysqlConn: mysql.Connection) {
  console.log('\n📦 Migration des journaux quotidiens...')
  
  const [rows] = await mysqlConn.query('SELECT * FROM day_journals') as [any[], any]
  stats.dayJournals.total = rows.length
  
  for (const journal of rows) {
    try {
      const newUserId = idMapping.users[journal.userId]
      if (!newUserId) continue
      
      const newId = getNewUuid('dayJournals', journal.id)
      
      await prisma.dayJournal.create({
        data: {
          id: newId,
          userId: newUserId,
          date: new Date(journal.date),
          note: journal.note || null,
          youtubeUrl: journal.youtubeUrl || null,
          createdAt: new Date(journal.createdAt),
        }
      })
      
      stats.dayJournals.migrated++
    } catch (error: any) {
      stats.dayJournals.errors++
    }
  }
  console.log(`  ✓ ${stats.dayJournals.migrated} journaux migrés`)
}

async function migrateScreenshots(mysqlConn: mysql.Connection) {
  console.log('\n📦 Migration des screenshots...')
  
  const [rows] = await mysqlConn.query('SELECT * FROM screenshots') as [any[], any]
  stats.screenshots.total = rows.length
  
  for (const screenshot of rows) {
    try {
      const newUserId = idMapping.users[screenshot.userId]
      if (!newUserId) continue
      
      const newTradeId = screenshot.tradeId ? idMapping.trades[screenshot.tradeId] : null
      const newDayJournalId = screenshot.dayJournalId ? idMapping.dayJournals[screenshot.dayJournalId] : null
      
      await prisma.screenshot.create({
        data: {
          id: randomUUID(),
          userId: newUserId,
          tradeId: newTradeId,
          dayJournalId: newDayJournalId,
          filePath: screenshot.filePath,
          originalName: screenshot.originalName,
          createdAt: new Date(screenshot.createdAt),
        }
      })
      
      stats.screenshots.migrated++
    } catch (error: any) {
      stats.screenshots.errors++
    }
  }
  console.log(`  ✓ ${stats.screenshots.migrated} screenshots migrés`)
}

async function migrateTradeTags(mysqlConn: mysql.Connection) {
  console.log('\n📦 Migration des relations trade-tags...')
  
  const [rows] = await mysqlConn.query('SELECT * FROM trade_tags') as [any[], any]
  stats.tradeTags.total = rows.length
  
  for (const tt of rows) {
    try {
      const newTradeId = idMapping.trades[tt.tradeId]
      const newTagId = idMapping.tags[tt.tagId]
      if (!newTradeId || !newTagId) continue
      
      await prisma.tradeTag.create({
        data: {
          tradeId: newTradeId,
          tagId: newTagId,
        }
      })
      
      stats.tradeTags.migrated++
    } catch (error: any) {
      stats.tradeTags.errors++
    }
  }
  console.log(`  ✓ ${stats.tradeTags.migrated} trade-tags migrés`)
}

async function migrateDayTags(mysqlConn: mysql.Connection) {
  console.log('\n📦 Migration des relations day-tags...')
  
  const [rows] = await mysqlConn.query('SELECT * FROM day_tags') as [any[], any]
  stats.dayTags.total = rows.length
  
  for (const dt of rows) {
    try {
      const newDayJournalId = idMapping.dayJournals[dt.dayJournalId]
      const newTagId = idMapping.tags[dt.tagId]
      if (!newDayJournalId || !newTagId) continue
      
      await prisma.dayTag.create({
        data: {
          dayJournalId: newDayJournalId,
          tagId: newTagId,
        }
      })
      
      stats.dayTags.migrated++
    } catch (error: any) {
      stats.dayTags.errors++
    }
  }
  console.log(`  ✓ ${stats.dayTags.migrated} day-tags migrés`)
}

async function migrateImportProfiles(mysqlConn: mysql.Connection) {
  console.log('\n📦 Migration des profils d\'import...')
  
  const [rows] = await mysqlConn.query('SELECT * FROM import_profiles') as [any[], any]
  stats.importProfiles.total = rows.length
  
  for (const profile of rows) {
    try {
      const newUserId = idMapping.users[profile.userId]
      if (!newUserId) continue
      
      await prisma.importProfile.create({
        data: {
          id: randomUUID(),
          userId: newUserId,
          name: profile.name,
          mapping: profile.mapping,
          createdAt: new Date(profile.createdAt),
        }
      })
      
      stats.importProfiles.migrated++
    } catch (error: any) {
      stats.importProfiles.errors++
    }
  }
  console.log(`  ✓ ${stats.importProfiles.migrated} profils migrés`)
}

async function migratePlaybooks(mysqlConn: mysql.Connection) {
  console.log('\n📦 Migration des playbooks...')
  
  try {
    const [rows] = await mysqlConn.query('SELECT * FROM playbooks') as [any[], any]
    stats.playbooks.total = rows.length
    
    for (const playbook of rows) {
      try {
        const newUserId = idMapping.users[playbook.userId]
        if (!newUserId) continue
        
        const newId = getNewUuid('playbooks', playbook.id)
        
        await prisma.playbook.create({
          data: {
            id: newId,
            userId: newUserId,
            name: playbook.name,
            description: playbook.description || null,
            createdAt: new Date(playbook.createdAt),
          }
        })
        
        stats.playbooks.migrated++
      } catch (error: any) {
        stats.playbooks.errors++
      }
    }
    console.log(`  ✓ ${stats.playbooks.migrated} playbooks migrés`)
  } catch (e) {
    console.log('  ℹ️ Table playbooks non trouvée, skip')
  }
}

async function migratePlaybookGroups(mysqlConn: mysql.Connection) {
  console.log('\n📦 Migration des groupes de playbooks...')
  
  try {
    const [rows] = await mysqlConn.query('SELECT * FROM playbook_groups') as [any[], any]
    stats.playbookGroups.total = rows.length
    
    for (const group of rows) {
      try {
        const newPlaybookId = idMapping.playbooks[group.playbookId]
        if (!newPlaybookId) continue
        
        const newId = getNewUuid('playbookGroups', group.id)
        
        await prisma.playbookGroup.create({
          data: {
            id: newId,
            playbookId: newPlaybookId,
            name: group.name,
            order: group.order || 0,
            createdAt: new Date(group.createdAt),
          }
        })
        
        stats.playbookGroups.migrated++
      } catch (error: any) {
        stats.playbookGroups.errors++
      }
    }
    console.log(`  ✓ ${stats.playbookGroups.migrated} groupes migrés`)
  } catch (e) {
    console.log('  ℹ️ Table playbook_groups non trouvée, skip')
  }
}

async function migratePlaybookPrerequisites(mysqlConn: mysql.Connection) {
  console.log('\n📦 Migration des prérequis de playbooks...')
  
  try {
    const [rows] = await mysqlConn.query('SELECT * FROM playbook_prerequisites') as [any[], any]
    stats.playbookPrerequisites.total = rows.length
    
    for (const prereq of rows) {
      try {
        const newGroupId = idMapping.playbookGroups[prereq.groupId]
        if (!newGroupId) continue
        
        const newId = getNewUuid('playbookPrerequisites', prereq.id)
        
        await prisma.playbookPrerequisite.create({
          data: {
            id: newId,
            groupId: newGroupId,
            text: prereq.text,
            order: prereq.order || 0,
            createdAt: new Date(prereq.createdAt),
          }
        })
        
        stats.playbookPrerequisites.migrated++
      } catch (error: any) {
        stats.playbookPrerequisites.errors++
      }
    }
    console.log(`  ✓ ${stats.playbookPrerequisites.migrated} prérequis migrés`)
  } catch (e) {
    console.log('  ℹ️ Table playbook_prerequisites non trouvée, skip')
  }
}

async function migrateTradePlaybooks(mysqlConn: mysql.Connection) {
  console.log('\n📦 Migration des trade-playbooks...')
  
  try {
    const [rows] = await mysqlConn.query('SELECT * FROM trade_playbooks') as [any[], any]
    stats.tradePlaybooks.total = rows.length
    
    for (const tp of rows) {
      try {
        const newTradeId = idMapping.trades[tp.tradeId]
        const newPlaybookId = idMapping.playbooks[tp.playbookId]
        if (!newTradeId || !newPlaybookId) continue
        
        const newId = getNewUuid('tradePlaybooks', tp.id)
        
        await prisma.tradePlaybook.create({
          data: {
            id: newId,
            tradeId: newTradeId,
            playbookId: newPlaybookId,
            createdAt: new Date(tp.createdAt),
          }
        })
        
        stats.tradePlaybooks.migrated++
      } catch (error: any) {
        stats.tradePlaybooks.errors++
      }
    }
    console.log(`  ✓ ${stats.tradePlaybooks.migrated} trade-playbooks migrés`)
  } catch (e) {
    console.log('  ℹ️ Table trade_playbooks non trouvée, skip')
  }
}

async function migrateTradePlaybookPrerequisites(mysqlConn: mysql.Connection) {
  console.log('\n📦 Migration des trade-playbook-prerequisites...')
  
  try {
    const [rows] = await mysqlConn.query('SELECT * FROM trade_playbook_prerequisites') as [any[], any]
    stats.tradePlaybookPrerequisites.total = rows.length
    
    for (const tpp of rows) {
      try {
        const newTradePlaybookId = idMapping.tradePlaybooks[tpp.tradePlaybookId]
        const newPrerequisiteId = idMapping.playbookPrerequisites[tpp.prerequisiteId]
        if (!newTradePlaybookId || !newPrerequisiteId) continue
        
        await prisma.tradePlaybookPrerequisite.create({
          data: {
            tradePlaybookId: newTradePlaybookId,
            prerequisiteId: newPrerequisiteId,
            checked: tpp.checked || false,
          }
        })
        
        stats.tradePlaybookPrerequisites.migrated++
      } catch (error: any) {
        stats.tradePlaybookPrerequisites.errors++
      }
    }
    console.log(`  ✓ ${stats.tradePlaybookPrerequisites.migrated} trade-playbook-prerequisites migrés`)
  } catch (e) {
    console.log('  ℹ️ Table trade_playbook_prerequisites non trouvée, skip')
  }
}

function printStats() {
  console.log('\n' + '='.repeat(60))
  console.log('📊 RÉSUMÉ DE LA MIGRATION')
  console.log('='.repeat(60))
  
  const tableFormat = (name: string, s: { total: number; migrated: number; errors: number }) => {
    const success = s.errors === 0 ? '✓' : '⚠️'
    console.log(`${success} ${name.padEnd(30)} ${s.migrated}/${s.total} (${s.errors} erreurs)`)
  }
  
  tableFormat('Utilisateurs', stats.users)
  tableFormat('Comptes', stats.accounts)
  tableFormat('Tags', stats.tags)
  tableFormat('Trades', stats.trades)
  tableFormat('Sorties partielles', stats.tradeExits)
  tableFormat('Journaux quotidiens', stats.dayJournals)
  tableFormat('Screenshots', stats.screenshots)
  tableFormat('Trade-Tags', stats.tradeTags)
  tableFormat('Day-Tags', stats.dayTags)
  tableFormat('Profils d\'import', stats.importProfiles)
  tableFormat('Playbooks', stats.playbooks)
  tableFormat('Groupes Playbook', stats.playbookGroups)
  tableFormat('Prérequis Playbook', stats.playbookPrerequisites)
  tableFormat('Trade-Playbooks', stats.tradePlaybooks)
  tableFormat('Trade-Playbook-Prerequisites', stats.tradePlaybookPrerequisites)
  
  console.log('='.repeat(60))
  
  const totalErrors = Object.values(stats).reduce((sum, s) => sum + s.errors, 0)
  if (totalErrors === 0) {
    console.log('✅ Migration terminée avec succès !')
  } else {
    console.log(`⚠️ Migration terminée avec ${totalErrors} erreurs`)
  }
  
  console.log('\n📧 IMPORTANT: Les utilisateurs doivent réinitialiser leur mot de passe')
  console.log('   via "Mot de passe oublié" car les anciens hashes ne sont pas migrés.')
}

async function main() {
  console.log('🚀 Démarrage de la migration MySQL → Supabase')
  console.log('='.repeat(60))
  
  // Vérifier les variables d'environnement
  if (!MYSQL_URL) {
    console.error('❌ MYSQL_URL non défini. Ajoutez-le dans .env.local')
    console.log('\nFormat attendu:')
    console.log('MYSQL_URL=mysql://user:password@host:port/database')
    process.exit(1)
  }
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Variables Supabase manquantes')
    process.exit(1)
  }
  
  // Connexion MySQL
  console.log('\n📡 Connexion à MySQL...')
  const mysqlConfig = parseMysqlUrl(MYSQL_URL)
  const mysqlConn = await mysql.createConnection({
    host: mysqlConfig.host,
    port: mysqlConfig.port,
    user: mysqlConfig.user,
    password: mysqlConfig.password,
    database: mysqlConfig.database,
  })
  console.log('  ✓ Connecté à MySQL')
  
  // Connexion PostgreSQL (via Prisma)
  console.log('\n📡 Connexion à PostgreSQL (Supabase)...')
  await prisma.$connect()
  console.log('  ✓ Connecté à PostgreSQL')
  
  try {
    // Migration dans l'ordre des dépendances
    await migrateUsers(mysqlConn)
    await migrateAccounts(mysqlConn)
    await migrateTags(mysqlConn)
    await migrateTrades(mysqlConn)
    await migrateTradeExits(mysqlConn)
    await migrateDayJournals(mysqlConn)
    await migrateScreenshots(mysqlConn)
    await migrateTradeTags(mysqlConn)
    await migrateDayTags(mysqlConn)
    await migrateImportProfiles(mysqlConn)
    await migratePlaybooks(mysqlConn)
    await migratePlaybookGroups(mysqlConn)
    await migratePlaybookPrerequisites(mysqlConn)
    await migrateTradePlaybooks(mysqlConn)
    await migrateTradePlaybookPrerequisites(mysqlConn)
    
    printStats()
    
    // Sauvegarder le mapping des IDs
    const fs = await import('fs')
    fs.writeFileSync(
      'migration-id-mapping.json',
      JSON.stringify(idMapping, null, 2)
    )
    console.log('\n💾 Mapping des IDs sauvegardé dans migration-id-mapping.json')
    
  } finally {
    await mysqlConn.end()
    await prisma.$disconnect()
  }
}

main().catch(console.error)

