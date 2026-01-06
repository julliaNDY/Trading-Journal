# Epic 2: Migration Schéma Prisma (MySQL → PostgreSQL)

**Epic ID:** E2  
**Estimation:** 4h  
**Statut:** Ready for Dev  
**Dépendances:** E1 (Setup Supabase)  

---

## Stories

### E2-S1: Adapter datasource Prisma

**Story ID:** E2-S1  
**Points:** 1  
**Priorité:** P0 (Bloquant)

#### Description
Changer le provider de base de données de MySQL vers PostgreSQL.

#### Critères d'acceptation
- [ ] `datasource.provider` changé de `mysql` à `postgresql`
- [ ] Pas d'erreur de syntaxe Prisma

#### Modification

```diff
// prisma/schema.prisma

datasource db {
-  provider = "mysql"
+  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

### E2-S2: Adapter les types de données

**Story ID:** E2-S2  
**Points:** 2  
**Priorité:** P0 (Bloquant)

#### Description
Convertir les types MySQL-spécifiques vers PostgreSQL.

#### Critères d'acceptation
- [ ] `@db.LongText` → supprimé (Text est le défaut)
- [ ] Types `Decimal` vérifiés compatibles
- [ ] Types `DateTime` vérifiés compatibles

#### Modifications détaillées

```diff
// Dans model ImportProfile
model ImportProfile {
  id        String   @id @default(cuid())
  userId    String
  name      String
-  mapping   String   @db.LongText
+  mapping   String
  // ... reste inchangé
}
```

**Note:** Les types suivants sont compatibles sans modification :
- `@db.Decimal(18, 8)` ✅
- `@db.Decimal(18, 2)` ✅
- `@db.Decimal(10, 4)` ✅
- `@db.Date` ✅
- `@db.Text` ✅

---

### E2-S3: Modifier modèle User

**Story ID:** E2-S3  
**Points:** 3  
**Priorité:** P0 (Bloquant)

#### Description
Adapter le modèle User pour Supabase Auth :
- Changer ID de cuid vers UUID
- Supprimer passwordHash
- Supprimer relation PasswordReset

#### Critères d'acceptation
- [ ] `User.id` est un UUID
- [ ] `passwordHash` supprimé
- [ ] Relation `passwordResets` supprimée
- [ ] Schema valide (prisma validate)

#### Modification

```diff
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
```

**Important:** L'ID User sera fourni par Supabase Auth (auth.users.id), donc pas de `@default()`.

---

### E2-S4: Supprimer modèle PasswordReset

**Story ID:** E2-S4  
**Points:** 1  
**Priorité:** P0 (Bloquant)

#### Description
Supprimer complètement le modèle PasswordReset (géré par Supabase).

#### Critères d'acceptation
- [ ] Modèle `PasswordReset` supprimé du schema
- [ ] Table `password_resets` sera supprimée par migration

#### Modification

```diff
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
```

---

### E2-S5: Adapter les foreign keys UUID

**Story ID:** E2-S5  
**Points:** 3  
**Priorité:** P0 (Bloquant)

#### Description
Ajouter `@db.Uuid` à toutes les foreign keys qui référencent User.id.

#### Critères d'acceptation
- [ ] Toutes les FK `userId` ont `@db.Uuid`
- [ ] Relations many-to-many mises à jour si nécessaire
- [ ] Schema valide

#### Modifications

```diff
model Trade {
-  id                   String          @id @default(cuid())
+  id                   String          @id @default(uuid()) @db.Uuid
-  userId               String
+  userId               String          @db.Uuid
-  accountId            String?
+  accountId            String?         @db.Uuid
  // ... reste des champs inchangé
}

model TradeExit {
-  id           String   @id @default(cuid())
+  id           String   @id @default(uuid()) @db.Uuid
-  tradeId      String
+  tradeId      String   @db.Uuid
  // ...
}

model DayJournal {
-  id          String       @id @default(cuid())
+  id          String       @id @default(uuid()) @db.Uuid
-  userId      String
+  userId      String       @db.Uuid
  // ...
}

model Tag {
-  id          String     @id @default(cuid())
+  id          String     @id @default(uuid()) @db.Uuid
-  userId      String
+  userId      String     @db.Uuid
  // ...
}

model TradeTag {
-  tradeId String
+  tradeId String @db.Uuid
-  tagId   String
+  tagId   String @db.Uuid
  // ...
}

model DayTag {
-  dayJournalId String
+  dayJournalId String @db.Uuid
-  tagId        String
+  tagId        String @db.Uuid
  // ...
}

model Screenshot {
-  id           String      @id @default(cuid())
+  id           String      @id @default(uuid()) @db.Uuid
-  userId       String
+  userId       String      @db.Uuid
-  tradeId      String?
+  tradeId      String?     @db.Uuid
-  dayJournalId String?
+  dayJournalId String?     @db.Uuid
  // ...
}

model ImportProfile {
-  id        String   @id @default(cuid())
+  id        String   @id @default(uuid()) @db.Uuid
-  userId    String
+  userId    String   @db.Uuid
  // ...
}

model Playbook {
-  id             String          @id @default(cuid())
+  id             String          @id @default(uuid()) @db.Uuid
-  userId         String
+  userId         String          @db.Uuid
  // ...
}

model PlaybookGroup {
-  id            String                 @id @default(cuid())
+  id            String                 @id @default(uuid()) @db.Uuid
-  playbookId    String
+  playbookId    String                 @db.Uuid
  // ...
}

model PlaybookPrerequisite {
-  id                   String                      @id @default(cuid())
+  id                   String                      @id @default(uuid()) @db.Uuid
-  groupId              String
+  groupId              String                      @db.Uuid
  // ...
}

model TradePlaybook {
-  id                   String                      @id @default(cuid())
+  id                   String                      @id @default(uuid()) @db.Uuid
-  tradeId              String
+  tradeId              String                      @db.Uuid
-  playbookId           String
+  playbookId           String                      @db.Uuid
  // ...
}

model TradePlaybookPrerequisite {
-  tradePlaybookId String
+  tradePlaybookId String @db.Uuid
-  prerequisiteId  String
+  prerequisiteId  String @db.Uuid
  // ...
}

model Account {
-  id             String   @id @default(cuid())
+  id             String   @id @default(uuid()) @db.Uuid
-  userId         String
+  userId         String   @db.Uuid
  // ...
}
```

---

### E2-S6: Générer et valider migration

**Story ID:** E2-S6  
**Points:** 2  
**Priorité:** P0 (Bloquant)

#### Description
Générer la migration Prisma et la pousser vers Supabase.

#### Critères d'acceptation
- [ ] `prisma validate` passe sans erreur
- [ ] `prisma generate` réussit
- [ ] Migration créée ou schema poussé vers Supabase
- [ ] Tables créées dans Supabase (vérifier via Dashboard)

#### Commandes

```bash
# 1. Valider le schema
npx prisma validate

# 2. Générer le client
npx prisma generate

# 3. Option A: Push direct (recommandé pour setup initial)
npx prisma db push

# OU Option B: Créer migration formelle
npx prisma migrate dev --name init_supabase --create-only
npx prisma migrate deploy
```

#### Vérification
1. Aller dans Supabase Dashboard > Table Editor
2. Vérifier que toutes les tables sont créées :
   - users
   - trades
   - trade_exits
   - day_journals
   - tags
   - trade_tags
   - day_tags
   - screenshots
   - import_profiles
   - playbooks
   - playbook_groups
   - playbook_prerequisites
   - trade_playbooks
   - trade_playbook_prerequisites
   - accounts

---

## Checklist Epic E2

- [ ] E2-S1: Datasource changé vers PostgreSQL
- [ ] E2-S2: Types de données adaptés
- [ ] E2-S3: Modèle User modifié (UUID, sans passwordHash)
- [ ] E2-S4: PasswordReset supprimé
- [ ] E2-S5: Foreign keys UUID ajoutés
- [ ] E2-S6: Migration générée et appliquée

**Epic E2 terminé quand :** Tables créées dans Supabase, `prisma studio` fonctionne.

