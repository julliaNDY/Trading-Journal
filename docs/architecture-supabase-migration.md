# Architecture Document: Migration Supabase

**Version:** 1.0  
**Date:** 2026-01-06  
**Auteur:** Architect Agent  
**Statut:** Draft → En attente validation PO  
**PRD associé:** `docs/prd-supabase-migration.md`

---

## Table des Matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture Actuelle](#2-architecture-actuelle)
3. [Architecture Cible](#3-architecture-cible)
4. [Stratégie de Migration des Données](#4-stratégie-de-migration-des-données)
5. [Nouveau Système d'Authentification](#5-nouveau-système-dauthentification)
6. [Modifications du Schéma Prisma](#6-modifications-du-schéma-prisma)
7. [Structure des Fichiers](#7-structure-des-fichiers)
8. [Patterns d'Intégration](#8-patterns-dintégration)
9. [Sécurité](#9-sécurité)
10. [Performance](#10-performance)
11. [Plan de Rollback](#11-plan-de-rollback)

---

## 1. Vue d'ensemble

### 1.1 Objectif Architectural

Transformer l'architecture backend d'une solution **self-hosted MySQL + Auth maison** vers une architecture **Supabase-managed** tout en préservant :
- L'intégrité des données existantes
- La compatibilité avec le code frontend existant
- Les performances actuelles ou meilleures

### 1.2 Principes Directeurs

| Principe | Application |
|----------|-------------|
| **Zéro perte de données** | Script ETL avec validation exhaustive |
| **Backward compatibility** | API interne identique (`getUser()`, `requireAuth()`) |
| **Minimal UI changes** | Seules les pages auth sont modifiées |
| **Fail-safe migration** | Rollback possible à tout moment avant cutover |

### 1.3 Décisions Architecturales Clés (ADR)

#### ADR-1: Conserver Prisma comme ORM
**Décision:** Continuer avec Prisma plutôt que le client Supabase pour les requêtes data.

**Raison:**
- Code existant entièrement basé sur Prisma
- Prisma supporte PostgreSQL nativement
- Évite réécriture massive des services
- Supabase client utilisé uniquement pour Auth

#### ADR-2: UUID partagé User ↔ Auth
**Décision:** L'ID dans `public.users` sera identique à l'ID dans `auth.users`.

**Raison:**
- Simplifie les requêtes (pas de JOIN supplémentaire)
- Un seul ID à gérer dans toute l'application
- Pattern recommandé par Supabase

#### ADR-3: Dual-write évité
**Décision:** Migration big-bang plutôt que migration progressive avec dual-write.

**Raison:**
- Application mono-user (pas de charge concurrente critique)
- Complexité dual-write non justifiée
- Downtime acceptable (< 30 min)

#### ADR-4: Middleware Next.js pour Auth
**Décision:** Utiliser le middleware Next.js pour refresh des tokens Supabase.

**Raison:**
- Pattern officiel Supabase SSR
- Gère automatiquement le refresh des sessions
- Protection des routes centralisée

---

## 2. Architecture Actuelle

### 2.1 Diagramme de Composants

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Next.js App Router                         │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │  │
│  │  │Dashboard│ │ Journal │ │Calendrier│ │  Stats  │ │Importer │  │  │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘  │  │
│  └───────┼──────────┼──────────┼──────────┼──────────┼──────────┘  │
│          └──────────┴──────────┴──────────┴──────────┘              │
│                                   │                                  │
│                    Cookie: trading-journal-session (JWT)             │
└───────────────────────────────────┼─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           SERVER (Next.js)                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      Server Actions                           │  │
│  │  ┌────────┐ ┌────────────────┐ ┌────────┐ ┌────────┐          │  │
│  │  │auth.ts │ │password-reset.ts│ │trades.ts│ │journal.ts│ ...   │  │
│  │  └───┬────┘ └───────┬────────┘ └───┬────┘ └───┬────┘          │  │
│  └──────┼──────────────┼──────────────┼─────────┼────────────────┘  │
│         │              │              │         │                    │
│         ▼              ▼              ▼         ▼                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐    │
│  │ src/lib/    │ │src/services/│ │         Prisma Client       │    │
│  │ auth.ts     │ │email-service│ │                             │    │
│  │ ┌─────────┐ │ │ ┌─────────┐ │ │  ┌─────────────────────┐    │    │
│  │ │ bcrypt  │ │ │ │nodemailer│ │ │  │ @prisma/client     │    │    │
│  │ │ jose    │ │ │ └─────────┘ │ │  └──────────┬──────────┘    │    │
│  │ └─────────┘ │ └──────┬──────┘ │             │               │    │
│  └──────┬──────┘        │        └─────────────┼───────────────┘    │
│         │               │                      │                    │
└─────────┼───────────────┼──────────────────────┼────────────────────┘
          │               │                      │
          │               ▼                      ▼
          │        ┌─────────────┐        ┌─────────────┐
          │        │ SMTP Server │        │   MySQL     │
          │        │  (external) │        │  (OVH VPS)  │
          │        └─────────────┘        └─────────────┘
          │
          └──► JWT Token (HS256, 7 jours validité)
```

### 2.2 Flux d'Authentification Actuel

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────┐
│ Browser │     │ auth.ts     │     │ lib/auth.ts │     │  MySQL  │
│         │     │ (action)    │     │             │     │         │
└────┬────┘     └──────┬──────┘     └──────┬──────┘     └────┬────┘
     │                 │                   │                  │
     │  POST /login    │                   │                  │
     │  {email, pass}  │                   │                  │
     │────────────────>│                   │                  │
     │                 │                   │                  │
     │                 │  findUser(email)  │                  │
     │                 │──────────────────>│                  │
     │                 │                   │  SELECT * FROM   │
     │                 │                   │  users WHERE...  │
     │                 │                   │─────────────────>│
     │                 │                   │<─────────────────│
     │                 │<──────────────────│                  │
     │                 │                   │                  │
     │                 │  bcrypt.compare   │                  │
     │                 │  (pass, hash)     │                  │
     │                 │──────────────────>│                  │
     │                 │<──────────────────│                  │
     │                 │                   │                  │
     │                 │  SignJWT(payload) │                  │
     │                 │──────────────────>│                  │
     │                 │<──────────────────│                  │
     │                 │                   │                  │
     │  Set-Cookie:    │                   │                  │
     │  trading-journal│                   │                  │
     │  -session=JWT   │                   │                  │
     │<────────────────│                   │                  │
     │                 │                   │                  │
```

### 2.3 Composants à Modifier/Supprimer

| Fichier | Action | Raison |
|---------|--------|--------|
| `src/lib/auth.ts` | **Refactorer** | Remplacer JWT par Supabase session |
| `src/app/actions/auth.ts` | **Refactorer** | Utiliser Supabase Auth SDK |
| `src/app/actions/password-reset.ts` | **Supprimer** | Géré par Supabase |
| `src/services/email-service.ts` | **Supprimer** | Géré par Supabase |
| `src/app/(auth)/*` | **Modifier** | Adapter UI pour Supabase |
| `prisma/schema.prisma` | **Modifier** | MySQL → PostgreSQL |

---

## 3. Architecture Cible

### 3.1 Diagramme de Composants

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Next.js App Router                         │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │  │
│  │  │Dashboard│ │ Journal │ │Calendrier│ │  Stats  │ │Importer │  │  │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘  │  │
│  └───────┼──────────┼──────────┼──────────┼──────────┼──────────┘  │
│          └──────────┴──────────┴──────────┴──────────┘              │
│                                   │                                  │
│              Supabase Cookies (sb-*-auth-token)                     │
└───────────────────────────────────┼─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           SERVER (Next.js)                          │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                       MIDDLEWARE.TS                           │  │
│  │         (Refresh Supabase session on every request)           │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                   │                                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      Server Actions                           │  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                  │  │
│  │  │auth.ts │ │trades.ts│ │journal.ts│ │import.ts│ ...           │  │
│  │  └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘                  │  │
│  └──────┼─────────┼─────────┼─────────┼──────────────────────────┘  │
│         │         │         │         │                              │
│         ▼         └─────────┴─────────┘                              │
│  ┌─────────────┐              │                                      │
│  │src/lib/     │              ▼                                      │
│  │supabase/    │       ┌─────────────────────────────┐               │
│  │ ┌─────────┐ │       │         Prisma Client       │               │
│  │ │server.ts│ │       │  ┌─────────────────────┐    │               │
│  │ │client.ts│ │       │  │ @prisma/client     │    │               │
│  │ └─────────┘ │       │  │ (PostgreSQL driver) │    │               │
│  └──────┬──────┘       │  └──────────┬──────────┘    │               │
│         │              └─────────────┼───────────────┘               │
└─────────┼────────────────────────────┼───────────────────────────────┘
          │                            │
          │                            │
          ▼                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPABASE CLOUD                              │
│                                                                     │
│  ┌─────────────────────┐     ┌─────────────────────────────────┐    │
│  │   SUPABASE AUTH     │     │      SUPABASE POSTGRESQL        │    │
│  │                     │     │                                 │    │
│  │  ┌───────────────┐  │     │  ┌───────────┐  ┌───────────┐   │    │
│  │  │  auth.users   │  │     │  │  public   │  │   auth    │   │    │
│  │  │  (managed)    │──┼─────┼─>│  .users   │  │  .users   │   │    │
│  │  └───────────────┘  │     │  │  (app)    │  │ (managed) │   │    │
│  │                     │     │  └───────────┘  └───────────┘   │    │
│  │  ┌───────────────┐  │     │                                 │    │
│  │  │ Email Service │  │     │  ┌───────────────────────────┐  │    │
│  │  │ - Confirm     │  │     │  │ Other tables:             │  │    │
│  │  │ - Reset       │  │     │  │ trades, day_journals,     │  │    │
│  │  │ - Magic Link  │  │     │  │ tags, screenshots, etc.   │  │    │
│  │  └───────────────┘  │     │  └───────────────────────────┘  │    │
│  └─────────────────────┘     └─────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Flux d'Authentification Cible

```
┌─────────┐    ┌──────────┐    ┌───────────┐    ┌──────────────────┐
│ Browser │    │Middleware│    │auth.ts    │    │  Supabase Cloud  │
│         │    │          │    │(action)   │    │                  │
└────┬────┘    └────┬─────┘    └─────┬─────┘    └────────┬─────────┘
     │              │                │                   │
     │  POST /login │                │                   │
     │  {email,pass}│                │                   │
     │─────────────>│                │                   │
     │              │                │                   │
     │              │  (pass through)│                   │
     │              │───────────────>│                   │
     │              │                │                   │
     │              │                │ signInWithPassword│
     │              │                │──────────────────>│
     │              │                │                   │
     │              │                │                   │ Verify credentials
     │              │                │                   │ in auth.users
     │              │                │                   │
     │              │                │  {session, user}  │
     │              │                │<──────────────────│
     │              │                │                   │
     │              │<───────────────│                   │
     │              │                │                   │
     │  Set-Cookie: │                │                   │
     │  sb-*-auth-  │                │                   │
     │  token=...   │                │                   │
     │<─────────────│                │                   │
     │              │                │                   │

     ─────────────── SUBSEQUENT REQUESTS ───────────────

     │  GET /dashboard              │                   │
     │─────────────>│               │                   │
     │              │               │                   │
     │              │ getUser()     │                   │
     │              │──────────────>│                   │
     │              │               │  auth.getUser()   │
     │              │               │──────────────────>│
     │              │               │<──────────────────│
     │              │               │                   │
     │              │ Refresh token │                   │
     │              │ if needed     │                   │
     │              │──────────────────────────────────>│
     │              │<──────────────────────────────────│
     │              │               │                   │
     │  Set-Cookie  │               │                   │
     │  (refreshed) │               │                   │
     │<─────────────│               │                   │
```

### 3.3 Relation User ↔ Auth

```
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE PROJECT                           │
│                                                                 │
│   ┌─────────────────────┐         ┌─────────────────────────┐   │
│   │     auth.users      │         │      public.users       │   │
│   │     (Supabase)      │         │       (Prisma)          │   │
│   │                     │   1:1   │                         │   │
│   │  id (uuid) ─────────┼─────────┼──> id (uuid) PK         │   │
│   │  email              │         │    email                │   │
│   │  encrypted_password │         │    discordUsername      │   │
│   │  email_confirmed_at │         │    isBlocked            │   │
│   │  created_at         │         │    createdAt            │   │
│   │  updated_at         │         │    updatedAt            │   │
│   │  user_metadata {}   │         │                         │   │
│   │                     │         │    ┌─────────────────┐  │   │
│   └─────────────────────┘         │    │   RELATIONS     │  │   │
│                                   │    │  - trades[]     │  │   │
│   Géré par Supabase Auth:         │    │  - dayJournals[]│  │   │
│   - Login/Logout                  │    │  - tags[]       │  │   │
│   - Email confirmation            │    │  - screenshots[]│  │   │
│   - Password reset                │    │  - accounts[]   │  │   │
│   - Session management            │    │  - playbooks[]  │  │   │
│   - Token refresh                 │    │  - importProfiles│  │   │
│                                   │    └─────────────────┘  │   │
│                                   └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Stratégie de Migration des Données

### 4.1 Vue d'Ensemble ETL

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   MySQL (OVH)   │     │  Script ETL     │     │Supabase Postgres│
│                 │     │  Node.js        │     │                 │
│  ┌───────────┐  │     │                 │     │  ┌───────────┐  │
│  │   users   │──┼────>│  Transform:     │────>│  │auth.users │  │
│  │(+password)│  │     │  - Map IDs      │     │  └───────────┘  │
│  └───────────┘  │     │  - Create Auth  │     │                 │
│                 │     │    user         │     │  ┌───────────┐  │
│  ┌───────────┐  │     │  - Create pub   │────>│  │pub.users  │  │
│  │  trades   │──┼────>│    user         │     │  └───────────┘  │
│  └───────────┘  │     │  - Remap FKs    │     │                 │
│                 │     │                 │     │  ┌───────────┐  │
│  ┌───────────┐  │     │                 │────>│  │pub.trades │  │
│  │day_journals──┼────>│                 │     │  └───────────┘  │
│  └───────────┘  │     │                 │     │                 │
│       ...       │     │                 │     │      ...        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 4.2 Ordre de Migration (Dépendances)

```
Level 0 (No FK dependencies):
├── Users → auth.users + public.users

Level 1 (Depends on Users):
├── Tags
├── Accounts
├── Playbooks
├── ImportProfiles
├── DayJournals

Level 2 (Depends on Level 1):
├── Trades (→ Users, Accounts)
├── PlaybookGroups (→ Playbooks)

Level 3 (Depends on Level 2):
├── TradeExits (→ Trades)
├── Screenshots (→ Trades, DayJournals)
├── PlaybookPrerequisites (→ PlaybookGroups)
├── TradePlaybooks (→ Trades, Playbooks)

Level 4 (Many-to-Many):
├── TradeTags (→ Trades, Tags)
├── DayTags (→ DayJournals, Tags)
├── TradePlaybookPrerequisites (→ TradePlaybooks, Prerequisites)
```

### 4.3 Algorithme de Migration

```typescript
// scripts/migrate-to-supabase.ts

interface MigrationContext {
  userIdMap: Map<string, string>;      // oldCuid → newUuid
  tradeIdMap: Map<string, string>;
  tagIdMap: Map<string, string>;
  accountIdMap: Map<string, string>;
  playbookIdMap: Map<string, string>;
  playbookGroupIdMap: Map<string, string>;
  prerequisiteIdMap: Map<string, string>;
  dayJournalIdMap: Map<string, string>;
  tradePlaybookIdMap: Map<string, string>;
}

async function migrate() {
  const ctx: MigrationContext = {
    userIdMap: new Map(),
    tradeIdMap: new Map(),
    tagIdMap: new Map(),
    accountIdMap: new Map(),
    playbookIdMap: new Map(),
    playbookGroupIdMap: new Map(),
    prerequisiteIdMap: new Map(),
    dayJournalIdMap: new Map(),
    tradePlaybookIdMap: new Map(),
  };

  // Level 0
  await migrateUsers(ctx);
  
  // Level 1 (parallel possible)
  await Promise.all([
    migrateTags(ctx),
    migrateAccounts(ctx),
    migratePlaybooks(ctx),
    migrateImportProfiles(ctx),
    migrateDayJournals(ctx),
  ]);
  
  // Level 2
  await Promise.all([
    migrateTrades(ctx),
    migratePlaybookGroups(ctx),
  ]);
  
  // Level 3
  await Promise.all([
    migrateTradeExits(ctx),
    migrateScreenshots(ctx),
    migratePlaybookPrerequisites(ctx),
    migrateTradePlaybooks(ctx),
  ]);
  
  // Level 4 (Many-to-Many)
  await Promise.all([
    migrateTradeTags(ctx),
    migrateDayTags(ctx),
    migrateTradePlaybookPrerequisites(ctx),
  ]);
  
  // Validation
  await validateMigration(ctx);
}
```

### 4.4 Migration des Users (Détail)

```typescript
async function migrateUsers(ctx: MigrationContext) {
  const mysqlUsers = await prismaMySQL.user.findMany();
  
  for (const user of mysqlUsers) {
    // 1. Create in Supabase Auth
    const { data: authUser, error } = await supabaseAdmin.auth.admin.createUser({
      email: user.email,
      email_confirm: true,  // Skip confirmation for existing users
      user_metadata: {
        discordUsername: user.discordUsername,
        migratedFrom: 'mysql',
        originalId: user.id,
      },
    });
    
    if (error) throw new Error(`Failed to create auth user: ${error.message}`);
    
    // 2. Store mapping
    ctx.userIdMap.set(user.id, authUser.user.id);
    
    // 3. Create in public.users
    await prismaPostgres.user.create({
      data: {
        id: authUser.user.id,  // Same UUID
        email: user.email,
        discordUsername: user.discordUsername,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
    
    console.log(`Migrated user: ${user.email} (${user.id} → ${authUser.user.id})`);
  }
}
```

### 4.5 Gestion des Mots de Passe

**Problème:** Les mots de passe hashés (bcrypt) ne peuvent pas être transférés vers Supabase Auth (format différent).

**Solution retenue:** Force password reset

```typescript
// Option 1: Invite par email (recommandé)
await supabaseAdmin.auth.admin.inviteUserByEmail(user.email, {
  redirectTo: `${APP_URL}/reset-password`,
});

// Option 2: Créer avec email confirmé + notifier
await supabaseAdmin.auth.admin.createUser({
  email: user.email,
  email_confirm: true,
});
// Puis envoyer email custom demandant de reset password
```

**Communication aux users:**
```
Sujet: Action requise - Migration de votre compte Trading Journal

Bonjour,

Nous avons migré notre infrastructure pour améliorer la sécurité et les performances.
Pour des raisons de sécurité, vous devez définir un nouveau mot de passe.

[Définir mon nouveau mot de passe]

Vos données (trades, notes, statistiques) sont intactes.

L'équipe Trading Journal
```

### 4.6 Validation Post-Migration

```typescript
async function validateMigration(ctx: MigrationContext) {
  const validations = [
    { table: 'users', mysql: prismaMySQL.user, pg: prismaPostgres.user },
    { table: 'trades', mysql: prismaMySQL.trade, pg: prismaPostgres.trade },
    { table: 'dayJournals', mysql: prismaMySQL.dayJournal, pg: prismaPostgres.dayJournal },
    { table: 'tags', mysql: prismaMySQL.tag, pg: prismaPostgres.tag },
    { table: 'screenshots', mysql: prismaMySQL.screenshot, pg: prismaPostgres.screenshot },
    // ... all tables
  ];
  
  const results = [];
  
  for (const { table, mysql, pg } of validations) {
    const mysqlCount = await mysql.count();
    const pgCount = await pg.count();
    
    results.push({
      table,
      mysql: mysqlCount,
      postgres: pgCount,
      match: mysqlCount === pgCount,
    });
  }
  
  console.table(results);
  
  const failures = results.filter(r => !r.match);
  if (failures.length > 0) {
    throw new Error(`Migration validation failed for: ${failures.map(f => f.table).join(', ')}`);
  }
  
  console.log('✅ Migration validated successfully!');
}
```

---

## 5. Nouveau Système d'Authentification

### 5.1 Clients Supabase

#### Server Client (`src/lib/supabase/server.ts`)

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component - ignore
          }
        },
      },
    }
  )
}

// Admin client for privileged operations
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
```

#### Browser Client (`src/lib/supabase/client.ts`)

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### 5.2 Middleware

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => 
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not run auth check on static assets
  const { data: { user } } = await supabase.auth.getUser()

  // Protected routes
  const protectedPaths = ['/dashboard', '/journal', '/calendrier', '/statistiques', '/importer', '/trades', '/comptes', '/playbooks', '/admin']
  const isProtectedRoute = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect logged users away from auth pages
  const authPaths = ['/login', '/register']
  const isAuthRoute = authPaths.includes(request.nextUrl.pathname)
  
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### 5.3 Auth Actions Refactorées

```typescript
// src/app/actions/auth.ts
'use server'

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  discordUsername: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function register(formData: FormData) {
  const supabase = await createClient()
  
  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    discordUsername: formData.get('discordUsername') || undefined,
  })
  
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }
  
  const { email, password, discordUsername } = parsed.data
  
  // 1. Create Supabase Auth user
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      data: {
        discordUsername,
      },
    },
  })
  
  if (error) {
    return { error: error.message }
  }
  
  if (!data.user) {
    return { error: 'Registration failed' }
  }
  
  // 2. Create user in public.users (triggered by Supabase or manually)
  // Note: Can also use a Supabase trigger/function for this
  try {
    await prisma.user.create({
      data: {
        id: data.user.id,
        email: data.user.email!,
        discordUsername,
      },
    })
  } catch (e) {
    // User might already exist if trigger created it
    console.log('User creation in public.users:', e)
  }
  
  return { 
    success: true, 
    message: 'Vérifiez votre email pour confirmer votre inscription' 
  }
}

export async function login(formData: FormData) {
  const supabase = await createClient()
  
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }
  
  const { email, password } = parsed.data
  
  // Check if user is blocked in public.users
  const publicUser = await prisma.user.findFirst({
    where: { email },
    select: { isBlocked: true },
  })
  
  if (publicUser?.isBlocked) {
    return { error: 'Votre compte a été bloqué. Contactez un administrateur.' }
  }
  
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) {
    return { error: error.message }
  }
  
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function requestPasswordReset(email: string) {
  const supabase = await createClient()
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  })
  
  // Always return success to prevent email enumeration
  return { success: true }
}

export async function updatePassword(newPassword: string) {
  const supabase = await createClient()
  
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })
  
  if (error) {
    return { error: error.message }
  }
  
  return { success: true }
}
```

### 5.4 Helper Auth Refactoré

```typescript
// src/lib/auth.ts
import { createClient } from '@/lib/supabase/server'
import prisma from './prisma'

export async function getUser() {
  const supabase = await createClient()
  
  const { data: { user: authUser }, error } = await supabase.auth.getUser()
  
  if (error || !authUser) {
    return null
  }
  
  // Get additional user data from public.users
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      email: true,
      createdAt: true,
      isBlocked: true,
      discordUsername: true,
    },
  })
  
  // If user is blocked, return null
  if (user?.isBlocked) {
    return null
  }
  
  return user
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

// For admin operations
export async function requireAdmin() {
  const user = await requireAuth()
  // Add admin check logic here if needed
  return user
}
```

### 5.5 Auth Callback Route

```typescript
// src/app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const type = searchParams.get('type') // 'signup', 'recovery', 'magiclink'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      // Ensure user exists in public.users (for new signups)
      const existingUser = await prisma.user.findUnique({
        where: { id: data.user.id },
      })
      
      if (!existingUser) {
        await prisma.user.create({
          data: {
            id: data.user.id,
            email: data.user.email!,
            discordUsername: data.user.user_metadata?.discordUsername,
          },
        })
      }
      
      // If password recovery, redirect to reset-password page
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }
      
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
```

---

## 6. Modifications du Schéma Prisma

### 6.1 Diff Schéma

```diff
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
-  provider = "mysql"
+  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
-  id              String          @id @default(cuid())
+  id              String          @id @db.Uuid
  email           String          @unique
-  passwordHash    String
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  discordUsername String?
  isBlocked       Boolean         @default(false)
  accounts        Account[]
  dayJournals     DayJournal[]
  importProfiles  ImportProfile[]
  playbooks       Playbook[]
  screenshots     Screenshot[]
  tags            Tag[]
  trades          Trade[]
-  passwordResets  PasswordReset[]

  @@map("users")
}

-model PasswordReset {
-  id        String   @id @default(cuid())
-  token     String   @unique
-  userId    String
-  expiresAt DateTime
-  usedAt    DateTime?
-  createdAt DateTime @default(now())
-  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
-
-  @@index([token])
-  @@index([userId])
-  @@map("password_resets")
-}

model Trade {
-  id                   String          @id @default(cuid())
+  id                   String          @id @default(uuid()) @db.Uuid
-  userId               String
+  userId               String          @db.Uuid
  symbol               String
  direction            Direction
  openedAt             DateTime
  closedAt             DateTime
  entryPrice           Decimal         @db.Decimal(18, 8)
  exitPrice            Decimal         @db.Decimal(18, 8)
  quantity             Decimal         @db.Decimal(18, 8)
  realizedPnlUsd       Decimal         @db.Decimal(18, 2)
  floatingRunupUsd     Decimal?        @db.Decimal(18, 2)
  floatingDrawdownUsd  Decimal?        @db.Decimal(18, 2)
  stopLossPriceInitial Decimal?        @db.Decimal(18, 8)
  riskRewardRatio      Decimal?        @db.Decimal(10, 4)
  pointValue           Decimal         @default(1.00000000) @db.Decimal(18, 8)
  importHash           String?         @unique
  tradeSignature       String?
  createdAt            DateTime        @default(now())
  updatedAt            DateTime        @updatedAt
-  accountId            String?
+  accountId            String?         @db.Uuid
  fees                 Decimal?        @db.Decimal(18, 2)
  grossPnlUsd          Decimal?        @db.Decimal(18, 2)
-  note                 String?         @db.Text
+  note                 String?
  plannedRMultiple     Decimal?        @db.Decimal(10, 4)
  points               Decimal?        @db.Decimal(18, 4)
  profitTarget         Decimal?        @db.Decimal(18, 8)
  rating               Int?
  realizedRMultiple    Decimal?        @db.Decimal(10, 4)
  ticksPerContract     Decimal?        @db.Decimal(18, 4)
  youtubeUrl           String?
  timesManuallySet     Boolean         @default(false)
  reviewed             Boolean         @default(false)
  hasPartialExits      Boolean         @default(false)
  // ... relations unchanged

  @@map("trades")
}

// Similar changes for all other models:
// - cuid() → uuid() @db.Uuid
// - @db.LongText → (remove, Text is default)
// - Foreign keys: add @db.Uuid
```

### 6.2 Schéma Complet Final

Voir fichier: `prisma/schema.prisma.new` (à créer lors de l'implémentation)

### 6.3 Notes de Migration Prisma

```bash
# 1. Backup current migrations (for reference)
cp -r prisma/migrations prisma/migrations.mysql-backup

# 2. Reset migrations for PostgreSQL
rm -rf prisma/migrations

# 3. Update schema.prisma with PostgreSQL changes

# 4. Create baseline migration
npx prisma migrate dev --name init_postgresql --create-only

# 5. Apply to Supabase
npx prisma migrate deploy
```

---

## 7. Structure des Fichiers

### 7.1 Fichiers à Créer

```
src/
├── lib/
│   └── supabase/
│       ├── client.ts          # Browser client
│       └── server.ts          # Server client + admin client
├── app/
│   └── auth/
│       └── callback/
│           └── route.ts       # OAuth/email callback handler
└── middleware.ts              # Auth middleware

scripts/
└── migrate-to-supabase.ts     # ETL migration script
```

### 7.2 Fichiers à Supprimer

```
src/
├── services/
│   └── email-service.ts       # ❌ Supabase handles emails
└── app/
    └── actions/
        └── password-reset.ts  # ❌ Supabase handles password reset
```

### 7.3 Fichiers à Modifier

```
src/
├── lib/
│   └── auth.ts                # Simplify: use Supabase getUser()
├── app/
│   ├── actions/
│   │   └── auth.ts            # Use Supabase Auth SDK
│   └── (auth)/
│       ├── login/page.tsx     # Update to use Supabase
│       ├── register/page.tsx  # Update to use Supabase
│       ├── forgot-password/page.tsx  # Simplify
│       └── reset-password/page.tsx   # Simplify

prisma/
└── schema.prisma              # MySQL → PostgreSQL

.env.example                   # Update variables
README.md                      # Update documentation
```

### 7.4 Arborescence Finale (Auth)

```
src/
├── lib/
│   ├── auth.ts                    # getUser(), requireAuth()
│   ├── prisma.ts                  # Unchanged
│   ├── supabase/
│   │   ├── client.ts              # createClient() for browser
│   │   └── server.ts              # createClient(), createAdminClient()
│   ├── utils.ts                   # Unchanged
│   └── validations.ts             # Unchanged
├── middleware.ts                  # Supabase session refresh
└── app/
    ├── auth/
    │   └── callback/
    │       └── route.ts           # Handle auth callbacks
    ├── (auth)/
    │   ├── layout.tsx             # Unchanged
    │   ├── login/
    │   │   └── page.tsx           # Supabase signIn
    │   ├── register/
    │   │   └── page.tsx           # Supabase signUp
    │   ├── forgot-password/
    │   │   └── page.tsx           # Supabase resetPasswordForEmail
    │   └── reset-password/
    │       └── page.tsx           # Supabase updateUser password
    └── actions/
        └── auth.ts                # register, login, logout, etc.
```

---

## 8. Patterns d'Intégration

### 8.1 Pattern: Server Action avec Auth

```typescript
// Avant
'use server'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function createTrade(data: TradeInput) {
  const user = await requireAuth()  // Vérifie JWT cookie
  
  return prisma.trade.create({
    data: {
      ...data,
      userId: user.id,
    },
  })
}

// Après (IDENTIQUE - l'interface ne change pas!)
'use server'
import { requireAuth } from '@/lib/auth'  // Utilise Supabase sous le capot
import prisma from '@/lib/prisma'

export async function createTrade(data: TradeInput) {
  const user = await requireAuth()  // Vérifie Supabase session
  
  return prisma.trade.create({
    data: {
      ...data,
      userId: user.id,  // Maintenant un UUID
    },
  })
}
```

### 8.2 Pattern: Component avec User

```typescript
// Avant & Après (IDENTIQUE)
import { getUser } from '@/lib/auth'

export default async function Dashboard() {
  const user = await getUser()
  
  if (!user) {
    redirect('/login')
  }
  
  return <div>Welcome {user.email}</div>
}
```

### 8.3 Pattern: Client Component avec Auth State

```typescript
// Nouveau pattern pour composants client qui ont besoin de l'état auth
'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const supabase = createClient()
    
    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )
    
    return () => subscription.unsubscribe()
  }, [])
  
  return { user, loading }
}
```

---

## 9. Sécurité

### 9.1 Comparaison Sécurité

| Aspect | Avant (JWT maison) | Après (Supabase) |
|--------|-------------------|------------------|
| Token storage | httpOnly cookie ✅ | httpOnly cookie ✅ |
| Token refresh | Manuel (7 jours) | Auto (1h access, refresh token) |
| Password storage | bcrypt (12 rounds) | Supabase (bcrypt) |
| Password reset | Custom tokens | Supabase managed |
| Email verification | ❌ Non implémenté | ✅ Built-in |
| Rate limiting | ❌ Non implémenté | ✅ Built-in |
| Brute force protection | ❌ Non implémenté | ✅ Built-in |
| MFA | ❌ Non disponible | ✅ Possible (Phase 2) |

### 9.2 Variables d'Environnement

```env
# ❌ À SUPPRIMER
JWT_SECRET=xxx
SMTP_HOST=xxx
SMTP_PORT=xxx
SMTP_USER=xxx
SMTP_PASS=xxx
SMTP_FROM=xxx
SMTP_SECURE=xxx

# ✅ À AJOUTER
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ✅ À MODIFIER
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
```

### 9.3 Row Level Security (Phase 2)

Pour une sécurité renforcée, RLS peut être activé sur Supabase :

```sql
-- Exemple pour la table trades (optionnel, Phase 2)
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own trades"
ON public.trades
FOR ALL
USING (user_id = auth.uid());
```

**Note:** Non requis pour Phase 1 car toutes les requêtes passent par le backend (Prisma) qui vérifie déjà le userId.

---

## 10. Performance

### 10.1 Impact Attendu

| Métrique | Avant | Après | Impact |
|----------|-------|-------|--------|
| Latence DB | ~5ms (local VPS) | ~20-50ms (Supabase) | ⚠️ +15-45ms |
| Latence Auth | ~10ms (JWT verify) | ~50ms (Supabase getUser) | ⚠️ +40ms |
| Cold start | N/A | N/A | Aucun (pas de serverless DB) |

### 10.2 Mitigations

1. **Connection pooling:** Utiliser PgBouncer (inclus Supabase)
2. **Caching session:** Le middleware refresh la session, évitant des appels répétés
3. **Région Supabase:** Choisir région proche (eu-central-1 pour EU)

### 10.3 Optimisations Prisma pour PostgreSQL

```typescript
// prisma/schema.prisma - ajouter
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["driverAdapters"]  // Pour pg pooling
}
```

---

## 11. Plan de Rollback

### 11.1 Points de Contrôle

```
┌──────────────────────────────────────────────────────────────────┐
│                      TIMELINE MIGRATION                          │
├────────┬─────────────────────────────────────────────────────────┤
│  T-1h  │ Backup MySQL + Uploads                                  │
│        │ ✅ Checkpoint: Backup complet vérifié                   │
├────────┼─────────────────────────────────────────────────────────┤
│  T-45m │ Mettre app en maintenance                               │
├────────┼─────────────────────────────────────────────────────────┤
│  T-30m │ Exécuter script ETL                                     │
│        │ ✅ Checkpoint: Validation counts passée                 │
├────────┼─────────────────────────────────────────────────────────┤
│  T-15m │ Déployer nouveau code                                   │
│        │ ✅ Checkpoint: App démarre sans erreur                  │
├────────┼─────────────────────────────────────────────────────────┤
│  T-10m │ Tests smoke (login, dashboard, create trade)            │
│        │ ✅ Checkpoint: Tests passent                            │
├────────┼─────────────────────────────────────────────────────────┤
│  T-5m  │ Tester avec 2-3 vrais users (beta)                     │
│        │ ✅ Checkpoint: Confirmation users                       │
├────────┼─────────────────────────────────────────────────────────┤
│   T0   │ Retirer maintenance                                     │
│        │ ════════════════════════════════════════════════════    │
│        │ POINT DE NON-RETOUR (users commencent à modifier data)  │
└────────┴─────────────────────────────────────────────────────────┘
```

### 11.2 Procédure de Rollback

**Avant T0 (point de non-retour):**

```bash
# 1. Remettre app en maintenance
ssh vps "touch /var/www/app/maintenance.flag"

# 2. Restaurer ancien code
git checkout main-pre-supabase
git push origin main --force

# 3. Restaurer MySQL (si besoin)
mysql -u root -p trading_journal < backup_pre_migration.sql

# 4. Redéployer
ssh vps "cd /var/www/app && git pull && npm run build && pm2 restart all"

# 5. Retirer maintenance
ssh vps "rm /var/www/app/maintenance.flag"
```

**Après T0:** Rollback non recommandé (perte de données potentielle). Corriger en avant.

### 11.3 Critères Go/No-Go

| Critère | Go | No-Go |
|---------|----|----- |
| Validation counts | 100% match | Toute différence |
| Login test user | Succès | Échec |
| Create trade test | Succès | Échec |
| Dashboard load | < 3s | > 10s ou erreur |
| Emails Supabase | Reçus | Non reçus (vérifier spam) |

---

## Annexes

### A. Commandes de Référence

```bash
# Prisma
npx prisma migrate dev --name xxx   # Dev migration
npx prisma migrate deploy           # Prod migration
npx prisma db push                  # Push without migration
npx prisma generate                 # Regenerate client
npx prisma studio                   # GUI

# Supabase CLI (optionnel)
supabase login
supabase link --project-ref xxx
supabase db diff                    # Voir différences
supabase db push                    # Push local changes

# Migration script
npx tsx scripts/migrate-to-supabase.ts
```

### B. Ressources

- [Supabase SSR Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Prisma PostgreSQL](https://www.prisma.io/docs/concepts/database-connectors/postgresql)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)

### C. Checklist Pré-Migration

- [ ] Compte Supabase créé
- [ ] Projet Supabase créé (région EU)
- [ ] Variables env récupérées
- [ ] Templates email personnalisés (FR/EN)
- [ ] Backup MySQL production
- [ ] Backup dossier uploads
- [ ] Script ETL testé sur copie des données
- [ ] Nouveau code testé en local
- [ ] Créneau maintenance communiqué aux users

---

**Document prêt pour validation PO.**

**Prochaine étape:** Validation par le Product Owner, puis création des stories pour chaque epic.

