# PRD: Migration Supabase - Trading Journal

**Version:** 1.0  
**Date:** 2026-01-06  
**Auteur:** PM Agent  
**Statut:** Draft → En attente validation PO

---

## 1. Résumé Exécutif

### 1.1 Objectif
Migrer l'infrastructure backend du Trading Journal depuis MySQL + authentification JWT maison vers **Supabase** (PostgreSQL + Supabase Auth), en garantissant **zéro perte de données** et une continuité de service pour les utilisateurs existants.

### 1.2 Bénéfices Attendus
- **Simplification opérationnelle** : Délégation de l'authentification et des emails transactionnels à Supabase
- **Scalabilité** : Base de données managée avec backups automatiques
- **Sécurité renforcée** : Auth conforme aux standards (OAuth, MFA possible, tokens refresh)
- **Réduction de code** : Suppression de ~500 lignes de code auth/email custom
- **Coût réduit** : Tier gratuit Supabase jusqu'à 50k MAU

### 1.3 Scope
| In Scope | Out of Scope |
|----------|--------------|
| Migration schéma MySQL → PostgreSQL | Migration vers Supabase Storage (uploads) |
| Migration données existantes (ETL) | Refonte UI complète |
| Remplacement auth JWT → Supabase Auth | Ajout de nouvelles features |
| Suppression email-service custom | OAuth providers (Google, GitHub) — Phase 2 |
| Tests de non-régression | Row Level Security avancé — Phase 2 |

---

## 2. Contexte Technique Actuel

### 2.1 Architecture Actuelle

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│                    Next.js App Router                       │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     SERVER ACTIONS                          │
│  auth.ts │ password-reset.ts │ trades.ts │ journal.ts │ ... │
└─────────────────────────────┬───────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   src/lib/      │  │   src/services/ │  │   prisma/       │
│   auth.ts       │  │   email-service │  │   schema.prisma │
│   (JWT/bcrypt)  │  │   (nodemailer)  │  │   (MySQL)       │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         │                    ▼                    ▼
         │           ┌─────────────────┐  ┌─────────────────┐
         │           │   SMTP Server   │  │   MySQL DB      │
         │           │   (external)    │  │   (OVH VPS)     │
         │           └─────────────────┘  └─────────────────┘
         │
         └──► Cookies httpOnly (trading-journal-session)
```

### 2.2 Modèle de Données Actuel

**13 tables / 289 lignes de schéma Prisma**

```prisma
// Tables principales
User              // id (cuid), email, passwordHash, isBlocked, discordUsername
PasswordReset     // tokens manuels pour reset password
Trade             // id, userId, symbol, direction, openedAt, closedAt, prices, pnl...
TradeExit         // partial exits (many-to-one avec Trade)
DayJournal        // notes quotidiennes
Tag               // tags personnalisés
TradeTag          // many-to-many Trade ↔ Tag
DayTag            // many-to-many DayJournal ↔ Tag
Screenshot        // fichiers uploadés (trades ou days)
ImportProfile     // mappings CSV sauvegardés
Playbook          // stratégies de trading
PlaybookGroup     // groupes de prerequisites
PlaybookPrerequisite // checklist items
TradePlaybook     // assignation playbook → trade
TradePlaybookPrerequisite // état checked des prerequisites
Account           // comptes de trading (brokers)
```

### 2.3 Flux d'Authentification Actuel

```
1. Register: email/password → bcrypt hash → INSERT User → JWT cookie
2. Login: email/password → verify bcrypt → JWT cookie
3. Session: JWT cookie → jose.jwtVerify → userId
4. Logout: delete cookie
5. Reset Password: generate token → INSERT PasswordReset → send email via SMTP
```

---

## 3. Architecture Cible (Supabase)

### 3.1 Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│                    Next.js App Router                       │
│              + @supabase/ssr (client-side)                  │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     SERVER ACTIONS                          │
│  auth.ts (Supabase) │ trades.ts │ journal.ts │ ...          │
└─────────────────────────────┬───────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌─────────────────────────────────┐    ┌─────────────────────┐
│         SUPABASE                │    │   prisma/           │
│  ┌─────────────────────────┐    │    │   schema.prisma     │
│  │   Supabase Auth         │    │    │   (PostgreSQL)      │
│  │   - Users (auth.users)  │    │    └──────────┬──────────┘
│  │   - Sessions            │    │               │
│  │   - Email templates     │    │               ▼
│  └─────────────────────────┘    │    ┌─────────────────────┐
│  ┌─────────────────────────┐    │    │  Supabase PostgreSQL│
│  │   Email (built-in)      │    │    │  - public schema    │
│  │   - Confirmation        │    │    │  - auth schema      │
│  │   - Magic link          │    │    └─────────────────────┘
│  │   - Password reset      │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘
```

### 3.2 Nouveau Modèle de Données

**Changements majeurs :**

| Avant (MySQL) | Après (Supabase PostgreSQL) |
|---------------|----------------------------|
| `User.id` (cuid) | `User.id` (UUID = auth.users.id) |
| `User.passwordHash` | ❌ Supprimé (géré par Supabase) |
| `User.email` | Conservé (sync avec auth.users.email) |
| `PasswordReset` table | ❌ Supprimée (géré par Supabase) |
| `@db.Decimal(18,8)` | `@db.Decimal(18,8)` ✅ (compatible) |
| `@db.LongText` | `@db.Text` |
| `cuid()` | `uuid()` ou `cuid()` (choix) |

### 3.3 Stratégie de Liaison User ↔ Supabase Auth

**Option retenue : UUID partagé**

```prisma
model User {
  id              String   @id @db.Uuid  // = auth.users.id
  email           String   @unique
  // passwordHash SUPPRIMÉ
  discordUsername String?
  isBlocked       Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  // ... relations
}
```

**Raison :** L'ID User dans notre `public.users` sera identique à l'ID dans `auth.users`. Cela simplifie les requêtes et évite une table de mapping.

---

## 4. Plan de Migration Détaillé

### 4.1 Épics

| Epic | Description | Estimation |
|------|-------------|------------|
| **E1** | Setup Supabase + Configuration projet | 2h |
| **E2** | Migration schéma Prisma (MySQL → PostgreSQL) | 4h |
| **E3** | Script ETL : Migration des données | 8h |
| **E4** | Refactoring Auth (Supabase Auth SDK) | 6h |
| **E5** | Suppression code legacy + cleanup | 2h |
| **E6** | Tests de non-régression | 4h |
| **E7** | Déploiement production + cutover | 2h |

**Total estimé : 28h**

---

### 4.2 Epic 1 : Setup Supabase

**Stories :**

#### E1-S1 : Création projet Supabase
- [ ] Créer projet sur supabase.com
- [ ] Noter : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Configurer : Site URL, Redirect URLs dans Auth settings

#### E1-S2 : Configuration emails Supabase
- [ ] Personnaliser templates email (FR/EN) :
  - Confirmation d'inscription
  - Magic link (optionnel)
  - Reset password
- [ ] Configurer SMTP custom si besoin (ou utiliser Supabase par défaut)

#### E1-S3 : Installation dépendances
```bash
npm install @supabase/supabase-js @supabase/ssr
npm uninstall bcryptjs jose  # À la fin de E4
```

#### E1-S4 : Variables d'environnement
```env
# Supprimer
DATABASE_URL=mysql://...
JWT_SECRET=...
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...

# Ajouter
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres
```

---

### 4.3 Epic 2 : Migration Schéma Prisma

**Stories :**

#### E2-S1 : Adapter schema.prisma pour PostgreSQL

**Changements requis :**

```prisma
// AVANT
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// APRÈS
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Changements de types :**

| MySQL | PostgreSQL |
|-------|------------|
| `@db.LongText` | `@db.Text` |
| `@db.Decimal(18, 8)` | `@db.Decimal(18, 8)` ✅ |
| `cuid()` | `cuid()` ou `uuid()` |
| `@db.Date` | `@db.Date` ✅ |

#### E2-S2 : Modifier modèle User

```prisma
model User {
  id              String   @id @default(uuid()) @db.Uuid
  email           String   @unique
  // SUPPRIMÉ: passwordHash String
  discordUsername String?
  isBlocked       Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  // ... relations inchangées
}
```

#### E2-S3 : Supprimer modèle PasswordReset

```prisma
// SUPPRIMER entièrement
// model PasswordReset { ... }
```

#### E2-S4 : Générer nouvelle migration
```bash
npx prisma migrate dev --name supabase_migration
```

---

### 4.4 Epic 3 : Script ETL (Migration Données)

**Criticité : HAUTE** — Zéro perte de données requise

**Stories :**

#### E3-S1 : Export MySQL complet
```bash
mysqldump -u root -p trading_journal > backup_pre_migration.sql
```

#### E3-S2 : Créer script de migration `scripts/migrate-to-supabase.ts`

**Logique ETL :**

```typescript
// Pseudocode
async function migrateData() {
  // 1. Lire tous les users MySQL
  const mysqlUsers = await prismaMySQL.user.findMany();
  
  // 2. Pour chaque user :
  for (const user of mysqlUsers) {
    // a) Créer user dans Supabase Auth
    const { data: authUser } = await supabaseAdmin.auth.admin.createUser({
      email: user.email,
      password: generateTempPassword(), // ou inviter par email
      email_confirm: true,
    });
    
    // b) Créer user dans public.users avec même UUID
    await prismaPostgres.user.create({
      data: {
        id: authUser.user.id, // UUID from Supabase Auth
        email: user.email,
        discordUsername: user.discordUsername,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
      }
    });
    
    // c) Migrer les données liées (trades, journals, etc.)
    // avec mapping oldUserId → newUserId (UUID)
  }
}
```

#### E3-S3 : Mapping des IDs

**Problème :** Les anciens `userId` sont des `cuid` (ex: `cmj...`), les nouveaux seront des `uuid`.

**Solution :**

```typescript
const idMapping = new Map<string, string>(); // oldCuid → newUuid

// Lors de la migration de chaque user
idMapping.set(oldUser.id, newAuthUser.id);

// Lors de la migration des trades
for (const trade of trades) {
  await prismaPostgres.trade.create({
    data: {
      ...trade,
      id: generateUuid(), // nouveau UUID
      userId: idMapping.get(trade.userId), // mapped UUID
    }
  });
}
```

#### E3-S4 : Migration des relations many-to-many

Tables concernées : `TradeTag`, `DayTag`, `TradePlaybook`, `TradePlaybookPrerequisite`

```typescript
// Mapper les IDs composites
const tradeIdMapping = new Map<string, string>();
const tagIdMapping = new Map<string, string>();

// Migrer TradeTags
for (const tradeTag of tradeTags) {
  await prismaPostgres.tradeTag.create({
    data: {
      tradeId: tradeIdMapping.get(tradeTag.tradeId),
      tagId: tagIdMapping.get(tradeTag.tagId),
    }
  });
}
```

#### E3-S5 : Validation post-migration

```typescript
// Compter les enregistrements
const counts = {
  users: { mysql: await prismaMySQL.user.count(), pg: await prismaPostgres.user.count() },
  trades: { mysql: await prismaMySQL.trade.count(), pg: await prismaPostgres.trade.count() },
  // ... toutes les tables
};

// Vérifier intégrité
for (const [table, { mysql, pg }] of Object.entries(counts)) {
  if (mysql !== pg) throw new Error(`Mismatch on ${table}: ${mysql} vs ${pg}`);
}
```

---

### 4.5 Epic 4 : Refactoring Auth

**Stories :**

#### E4-S1 : Créer clients Supabase

**`src/lib/supabase/server.ts`**
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

**`src/lib/supabase/client.ts`**
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

#### E4-S2 : Middleware d'authentification

**`src/middleware.ts`**
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )
  
  const { data: { user } } = await supabase.auth.getUser()
  
  // Protect dashboard routes
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // Redirect logged users from auth pages
  if (user && ['/login', '/register'].includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
```

#### E4-S3 : Refactoring `src/app/actions/auth.ts`

```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'

export async function register(formData: FormData) {
  const supabase = await createClient()
  
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const discordUsername = formData.get('discordUsername') as string | null
  
  // 1. Create Supabase Auth user
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    }
  })
  
  if (error) return { error: error.message }
  if (!data.user) return { error: 'Registration failed' }
  
  // 2. Create user in public.users
  await prisma.user.create({
    data: {
      id: data.user.id, // Same UUID as Supabase Auth
      email: data.user.email!,
      discordUsername,
    }
  })
  
  return { success: true, message: 'Check your email for confirmation' }
}

export async function login(formData: FormData) {
  const supabase = await createClient()
  
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  
  if (error) return { error: error.message }
  
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

#### E4-S4 : Refactoring `src/lib/auth.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import prisma from './prisma'

export async function getUser() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  
  if (!authUser) return null
  
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      email: true,
      createdAt: true,
      isBlocked: true,
    },
  })
  
  if (user?.isBlocked) return null
  
  return user
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) throw new Error('Unauthorized')
  return user
}
```

#### E4-S5 : Supprimer `src/app/actions/password-reset.ts`

Le reset password est maintenant géré par Supabase :
```typescript
// Dans une page forgot-password
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
})
```

#### E4-S6 : Route callback auth

**`src/app/auth/callback/route.ts`**
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }
  
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
```

---

### 4.6 Epic 5 : Cleanup

**Stories :**

#### E5-S1 : Supprimer fichiers obsolètes
- [ ] `src/services/email-service.ts`
- [ ] `src/app/actions/password-reset.ts`
- [ ] `src/app/(auth)/forgot-password/page.tsx` (refaire avec Supabase)
- [ ] `src/app/(auth)/reset-password/page.tsx` (refaire avec Supabase)

#### E5-S2 : Supprimer dépendances
```bash
npm uninstall bcryptjs jose nodemailer
npm uninstall @types/bcryptjs @types/nodemailer
```

#### E5-S3 : Nettoyer variables d'environnement
Supprimer de `.env` et `env.example` :
- `JWT_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE`

#### E5-S4 : Mettre à jour README.md

---

### 4.7 Epic 6 : Tests

**Stories :**

#### E6-S1 : Tests manuels Auth
- [ ] Register nouveau user → email confirmation reçu
- [ ] Login → accès dashboard
- [ ] Logout → redirection login
- [ ] Forgot password → email reset reçu
- [ ] Reset password → nouveau password fonctionne

#### E6-S2 : Tests manuels Data
- [ ] Trades existants visibles
- [ ] Création nouveau trade OK
- [ ] Import CSV OK
- [ ] Journal (notes, tags, screenshots) OK
- [ ] Statistiques calculées correctement
- [ ] Calendrier PnL correct

#### E6-S3 : Tests non-régression
- [ ] Tous les users existants peuvent se connecter
- [ ] Données historiques intactes
- [ ] Aucune perte de screenshots

---

### 4.8 Epic 7 : Déploiement

**Stories :**

#### E7-S1 : Préparation
- [ ] Backup complet MySQL production
- [ ] Backup dossier uploads
- [ ] Planifier créneau maintenance (30 min estimé)

#### E7-S2 : Cutover
1. Mettre app en maintenance
2. Exécuter script ETL sur données production
3. Valider migration (counts, intégrité)
4. Déployer nouveau code
5. Mettre à jour variables env production
6. Tester en production
7. Retirer maintenance

#### E7-S3 : Rollback plan
- Si échec : restaurer backup MySQL + ancien code
- Point de non-retour : après confirmation que tous les users peuvent se connecter

---

## 5. Risques et Mitigations

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Perte de données pendant ETL | Critique | Faible | Backup complet + validation counts |
| Users existants ne peuvent pas se connecter | Haute | Moyenne | Migration avec `email_confirm: true` |
| Incompatibilité types Decimal | Moyenne | Faible | Tests sur sample data avant migration |
| Downtime prolongé | Moyenne | Faible | Script ETL optimisé + répétition dry-run |
| Emails Supabase en spam | Moyenne | Moyenne | Configurer SMTP custom ou SPF/DKIM |

---

## 6. Critères d'Acceptation Globaux

- [ ] **Zéro perte de données** : Tous les trades, journals, tags, screenshots migrés
- [ ] **Continuité d'accès** : Tous les users existants peuvent se reconnecter
- [ ] **Fonctionnalités intactes** : Toutes les features existantes fonctionnent
- [ ] **Emails fonctionnels** : Confirmation, reset password envoyés et reçus
- [ ] **Performance** : Temps de réponse équivalent ou meilleur
- [ ] **Code propre** : Aucun code legacy (bcrypt, jose, nodemailer) restant

---

## 7. Dépendances Externes

- Compte Supabase créé (tier gratuit OK pour MVP)
- Accès SMTP custom si emails Supabase insuffisants
- Accès production MySQL pour export

---

## 8. Questions Résolues

1. **Stratégie mot de passe users existants :**
   - ~~Option A : Envoyer email "reset password" à tous → UX dégradée~~
   - ~~Option B : Créer users avec flag `email_confirm: true` + mot de passe temporaire → risque sécurité~~
   - ~~Option C : Forcer reset au premier login post-migration~~
   - ✅ **DÉCISION (2026-01-06) : Email préventif avant cutover**
     - Envoyer un email à tous les users existants AVANT la migration
     - Expliquer la migration et demander de définir un nouveau mot de passe via Supabase
     - Avantage : UX claire, pas de surprise, users préparés
   
2. **Conserver discordUsername ?**
   - Actuellement dans `User.discordUsername`
   - Peut aller dans `auth.users.user_metadata` ou rester en `public.users`

3. **Supprimer complètement `public.users` ?**
   - Non recommandé : on y stocke `isBlocked`, `discordUsername`, relations
   - Supabase Auth ne gère que l'authentification, pas les données métier

---

## Annexes

### A. Commandes utiles

```bash
# Générer migration Prisma
npx prisma migrate dev --name supabase_migration

# Push schema vers Supabase (sans migration)
npx prisma db push

# Générer client Prisma
npx prisma generate

# Visualiser DB
npx prisma studio
```

### B. Structure finale des fichiers auth

```
src/
├── lib/
│   ├── supabase/
│   │   ├── client.ts      # Browser client
│   │   └── server.ts      # Server client
│   ├── auth.ts            # getUser(), requireAuth() (simplifié)
│   └── prisma.ts          # Unchanged
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx  # Simplifié
│   │   └── reset-password/page.tsx   # Simplifié
│   ├── auth/
│   │   └── callback/route.ts         # NOUVEAU
│   └── actions/
│       └── auth.ts                   # Refactoré
└── middleware.ts                     # NOUVEAU
```

---

**Prochaine étape :** Validation par le PO (Product Owner) puis création du document d'architecture détaillé si nécessaire.

