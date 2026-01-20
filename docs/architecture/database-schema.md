# Database Schema Documentation

> Documentation complète du schéma de base de données PostgreSQL (Prisma).

**Version** : 1.0  
**Dernière mise à jour** : 2026-01-17  
**ORM** : Prisma 5.22  
**Database** : PostgreSQL (Supabase)

---

## Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Modèles Core](#modèles-core)
3. [Modèles Subscription](#modèles-subscription)
4. [Modèles Broker Sync](#modèles-broker-sync)
5. [Modèles AI Coach](#modèles-ai-coach)
6. [Modèles Voting](#modèles-voting)
7. [Enums](#enums)
8. [Relations](#relations)
9. [Index](#index)

---

## Vue d'Ensemble

Le schéma de base de données est organisé en plusieurs domaines fonctionnels :

| Domaine | Modèles | Description |
|---------|---------|-------------|
| **Core** | User, Trade, Account, Tag, DayJournal, Screenshot, VoiceNote, Playbook, ImportProfile | Fonctionnalités principales du journal |
| **Subscription** | Plan, Subscription, Invoice, Payment | Système d'abonnement SaaS |
| **Broker Sync** | BrokerConnection, SyncLog | Synchronisation automatique des brokers |
| **AI Coach** | CoachConversation, CoachMessage, UserFeedback | Assistant IA de coaching |
| **Voting** | VotingOption, Vote | Système de vote beta |

### Diagramme Simplifié

```
User (1) ─────< (N) Trade
  │                  │
  │                  ├──< TradeTag >──< Tag
  │                  ├──< Screenshot
  │                  ├──< VoiceNote
  │                  └──< TradePlaybook >──< Playbook
  │
  ├──< (N) Account ──< (N) Trade
  ├──< (N) DayJournal ──< DayTag, Screenshot, DayVoiceNote
  ├──< (N) Tag
  ├──< (N) Playbook
  ├──< (1) Subscription ──< Invoice ──< Payment
  ├──< (N) BrokerConnection ──< SyncLog
  ├──< (N) CoachConversation ──< CoachMessage
  └──< (N) Vote
```

---

## Modèles Core

### User

Table des utilisateurs (synchronisée avec Supabase Auth).

```prisma
model User {
  id                 String              @id @db.Uuid
  email              String              @unique
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  discordUsername    String?
  nickname           String?             // Surnom public pour playbooks
  isBlocked          Boolean             @default(false)
  stripeCustomerId   String?             @unique
  avatarUrl          String?
  preferredLocale    String?             @default("en")
  
  // Relations
  trades             Trade[]
  accounts           Account[]
  tags               Tag[]
  dayJournals        DayJournal[]
  playbooks          Playbook[]
  screenshots        Screenshot[]
  voiceNotes         VoiceNote[]
  dayVoiceNotes      DayVoiceNote[]
  importProfiles     ImportProfile[]
  subscription       Subscription?
  brokerConnections  BrokerConnection[]
  coachConversations CoachConversation[]
  feedbacks          UserFeedback[]
  votes              Vote[]
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | ID Supabase Auth (clé primaire) |
| `email` | String | Email unique |
| `discordUsername` | String? | Username Discord pour la communauté |
| `nickname` | String? | Surnom public pour le partage |
| `isBlocked` | Boolean | Compte bloqué par admin |
| `stripeCustomerId` | String? | ID client Stripe |
| `avatarUrl` | String? | URL avatar (Supabase Storage) |
| `preferredLocale` | String? | Langue préférée (en/fr) |

---

### Trade

Table principale des trades.

```prisma
model Trade {
  id                   String          @id @default(uuid()) @db.Uuid
  userId               String          @db.Uuid
  accountId            String?         @db.Uuid
  symbol               String
  direction            Direction
  openedAt             DateTime
  closedAt             DateTime
  entryPrice           Decimal         @db.Decimal(18, 8)
  exitPrice            Decimal         @db.Decimal(18, 8)
  quantity             Decimal         @db.Decimal(18, 8)
  realizedPnlUsd       Decimal         @db.Decimal(18, 2)
  fees                 Decimal?        @db.Decimal(18, 2)
  grossPnlUsd          Decimal?        @db.Decimal(18, 2)
  
  // Risk Management
  stopLossPriceInitial Decimal?        @db.Decimal(18, 8)
  profitTarget         Decimal?        @db.Decimal(18, 8)
  riskRewardRatio      Decimal?        @db.Decimal(10, 4)
  plannedRMultiple     Decimal?        @db.Decimal(10, 4)
  realizedRMultiple    Decimal?        @db.Decimal(10, 4)
  
  // Excursions
  floatingRunupUsd     Decimal?        @db.Decimal(18, 2)
  floatingDrawdownUsd  Decimal?        @db.Decimal(18, 2)
  
  // Metadata
  pointValue           Decimal         @default(1) @db.Decimal(18, 8)
  points               Decimal?        @db.Decimal(18, 4)
  ticksPerContract     Decimal?        @db.Decimal(18, 4)
  note                 String?
  rating               Int?            // 1-5 rating
  youtubeUrl           String?
  importHash           String?         @unique
  tradeSignature       String?
  timesManuallySet     Boolean         @default(false)
  reviewed             Boolean         @default(false)
  hasPartialExits      Boolean         @default(false)
  createdAt            DateTime        @default(now())
  updatedAt            DateTime        @updatedAt
  
  // Relations
  user                 User            @relation(...)
  account              Account?        @relation(...)
  tags                 TradeTag[]
  screenshots          Screenshot[]
  voiceNotes           VoiceNote[]
  tradePlaybooks       TradePlaybook[]
  partialExits         TradeExit[]
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `symbol` | String | Symbole de l'instrument (NQ, ES, AAPL) |
| `direction` | Direction | LONG, SHORT, UNKNOWN |
| `openedAt` / `closedAt` | DateTime | Timestamps d'ouverture/fermeture |
| `entryPrice` / `exitPrice` | Decimal | Prix d'entrée/sortie |
| `quantity` | Decimal | Quantité (contrats, actions) |
| `realizedPnlUsd` | Decimal | PnL réalisé net |
| `grossPnlUsd` | Decimal? | PnL brut (avant frais) |
| `fees` | Decimal? | Frais/commissions |
| `stopLossPriceInitial` | Decimal? | Stop loss initial (saisi manuellement) |
| `profitTarget` | Decimal? | Objectif de profit |
| `riskRewardRatio` | Decimal? | Ratio risque/récompense calculé |
| `floatingRunupUsd` | Decimal? | MFE (Maximum Favorable Excursion) |
| `floatingDrawdownUsd` | Decimal? | MAE (Maximum Adverse Excursion) |
| `pointValue` | Decimal | Valeur du point (défaut: 1) |
| `importHash` | String? | Hash pour déduplication à l'import |
| `tradeSignature` | String? | Signature unique du trade |
| `timesManuallySet` | Boolean | Heures modifiées manuellement |
| `reviewed` | Boolean | Trade marqué comme revu |

---

### TradeExit

Sorties partielles d'un trade.

```prisma
model TradeExit {
  id        String   @id @default(uuid()) @db.Uuid
  tradeId   String   @db.Uuid
  exitPrice Decimal  @db.Decimal(18, 8)
  quantity  Decimal  @db.Decimal(18, 8)
  exitedAt  DateTime
  pnl       Decimal  @db.Decimal(18, 2)
  createdAt DateTime @default(now())
  
  trade     Trade    @relation(...)
}
```

---

### Account

Comptes de trading.

```prisma
model Account {
  id                String             @id @default(uuid()) @db.Uuid
  userId            String             @db.Uuid
  name              String
  broker            String?
  description       String?
  color             String             @default("#6366f1")
  initialBalance    Decimal?           @db.Decimal(18, 2)
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
  
  // Relations
  user              User               @relation(...)
  trades            Trade[]
  brokerConnections BrokerConnection[]
}

@@unique([userId, name])
```

---

### Tag

Tags personnalisables pour trades et journées.

```prisma
model Tag {
  id          String     @id @default(uuid()) @db.Uuid
  userId      String     @db.Uuid
  name        String
  color       String     @default("#6366f1")
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  
  // Relations
  user        User       @relation(...)
  trades      TradeTag[]
  dayJournals DayTag[]
}

@@unique([userId, name])
```

---

### DayJournal

Journal quotidien.

```prisma
model DayJournal {
  id          String         @id @default(uuid()) @db.Uuid
  userId      String         @db.Uuid
  date        DateTime       @db.Date
  note        String?        // Contenu du journal (HTML/Markdown)
  youtubeUrl  String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  
  // Relations
  user        User           @relation(...)
  tags        DayTag[]
  screenshots Screenshot[]
  voiceNotes  DayVoiceNote[]
}

@@unique([userId, date])
```

---

### Screenshot

Captures d'écran attachées aux trades ou journées.

```prisma
model Screenshot {
  id           String      @id @default(uuid()) @db.Uuid
  userId       String      @db.Uuid
  tradeId      String?     @db.Uuid
  dayJournalId String?     @db.Uuid
  filePath     String
  originalName String
  createdAt    DateTime    @default(now())
  
  // Relations
  user         User        @relation(...)
  trade        Trade?      @relation(...)
  dayJournal   DayJournal? @relation(...)
}
```

---

### VoiceNote

Notes vocales attachées aux trades.

```prisma
model VoiceNote {
  id                String   @id @default(uuid()) @db.Uuid
  tradeId           String   @db.Uuid
  userId            String   @db.Uuid
  filePath          String
  duration          Int      // Durée en secondes
  transcription     String?  // Texte transcrit (Whisper)
  transcriptionHash String?  // Hash MD5 pour cache
  summary           String?  // Résumé IA (JSON stringifié)
  createdAt         DateTime @default(now())
  
  // Relations
  trade             Trade    @relation(...)
  user              User     @relation(...)
}
```

---

### DayVoiceNote

Notes vocales attachées aux journées.

```prisma
model DayVoiceNote {
  id                String     @id @default(uuid()) @db.Uuid
  dayJournalId      String     @db.Uuid
  userId            String     @db.Uuid
  filePath          String
  duration          Int
  transcription     String?
  transcriptionHash String?
  summary           String?
  createdAt         DateTime   @default(now())
  
  // Relations
  dayJournal        DayJournal @relation(...)
  user              User       @relation(...)
}
```

---

### Playbook

Stratégies de trading avec checklists.

```prisma
model Playbook {
  id                 String             @id @default(uuid()) @db.Uuid
  userId             String             @db.Uuid
  name               String
  description        String?
  visibility         PlaybookVisibility @default(PRIVATE)
  shareToken         String?            @unique @db.Uuid
  originalPlaybookId String?            @db.Uuid  // Si importé
  originalAuthorId   String?            @db.Uuid
  viewCount          Int                @default(0)
  importCount        Int                @default(0)
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
  
  // Relations
  user               User               @relation(...)
  groups             PlaybookGroup[]
  tradePlaybooks     TradePlaybook[]
}

@@unique([userId, name])
```

---

### PlaybookGroup & PlaybookPrerequisite

Groupes et prérequis (checklist items) d'un playbook.

```prisma
model PlaybookGroup {
  id            String                 @id @default(uuid()) @db.Uuid
  playbookId    String                 @db.Uuid
  name          String
  order         Int                    @default(0)
  
  playbook      Playbook               @relation(...)
  prerequisites PlaybookPrerequisite[]
}

model PlaybookPrerequisite {
  id                   String                      @id @default(uuid()) @db.Uuid
  groupId              String                      @db.Uuid
  text                 String
  order                Int                         @default(0)
  
  group                PlaybookGroup               @relation(...)
  checkedPrerequisites TradePlaybookPrerequisite[]
}
```

---

### ImportProfile

Profils de mapping pour l'import CSV.

```prisma
model ImportProfile {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  name      String
  mapping   String   // JSON stringifié du mapping
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  user      User     @relation(...)
}

@@unique([userId, name])
```

---

## Modèles Subscription

### Plan

Plans d'abonnement disponibles.

```prisma
model Plan {
  id            String         @id @default(uuid()) @db.Uuid
  name          String         @unique
  displayName   String?
  description   String?
  price         Decimal        @db.Decimal(10, 2)
  interval      PlanInterval   // BETA, MONTHLY, QUARTERLY, BIANNUAL, ANNUAL
  stripePriceId String?        @unique
  features      Json           @default("[]")
  isActive      Boolean        @default(true)
  trialDays     Int            @default(7)
  sortOrder     Int            @default(0)
  savings       String?        // Ex: "-33%"
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  
  subscriptions Subscription[]
}
```

---

### Subscription

Abonnements utilisateurs.

```prisma
model Subscription {
  id                   String             @id @default(uuid()) @db.Uuid
  userId               String             @unique @db.Uuid
  planId               String             @db.Uuid
  stripeSubscriptionId String?            @unique
  status               SubscriptionStatus // TRIAL, ACTIVE, BETA_ACCESS, PAST_DUE, CANCELED, EXPIRED
  currentPeriodStart   DateTime
  currentPeriodEnd     DateTime
  cancelAtPeriodEnd    Boolean            @default(false)
  canceledAt           DateTime?
  trialEndsAt          DateTime?
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt
  
  user                 User               @relation(...)
  plan                 Plan               @relation(...)
  invoices             Invoice[]
}
```

---

### Invoice & Payment

Factures et paiements.

```prisma
model Invoice {
  id              String        @id @default(uuid()) @db.Uuid
  subscriptionId  String        @db.Uuid
  stripeInvoiceId String?       @unique
  invoiceNumber   String        @unique
  amount          Decimal       @db.Decimal(10, 2)
  currency        String        @default("EUR")
  status          PaymentStatus // PENDING, COMPLETED, FAILED, REFUNDED
  dueDate         DateTime
  paidAt          DateTime?
  invoicePdfUrl   String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  
  subscription    Subscription  @relation(...)
  payments        Payment[]
}

model Payment {
  id                String        @id @default(uuid()) @db.Uuid
  invoiceId         String        @db.Uuid
  amount            Decimal       @db.Decimal(10, 2)
  currency          String        @default("EUR")
  status            PaymentStatus
  paymentMethod     String?
  externalPaymentId String?
  metadata          Json?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  
  invoice           Invoice       @relation(...)
}
```

---

## Modèles Broker Sync

### BrokerConnection

Connexions aux brokers.

```prisma
model BrokerConnection {
  id                String                 @id @default(uuid()) @db.Uuid
  userId            String                 @db.Uuid
  brokerType        BrokerType             // TRADOVATE, IBKR
  status            BrokerConnectionStatus // PENDING, CONNECTED, ERROR, DISCONNECTED
  
  // Credentials (encrypted)
  encryptedApiKey    String?
  encryptedApiSecret String?
  accessToken        String?
  tokenExpiresAt     DateTime?
  
  // Broker info
  brokerAccountId   String?
  brokerAccountName String?
  
  // Sync config
  syncEnabled       Boolean   @default(true)
  syncIntervalMin   Int       @default(15)
  lastSyncAt        DateTime?
  lastSyncError     String?
  
  // Link to local account
  accountId         String?   @db.Uuid
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  user              User      @relation(...)
  account           Account?  @relation(...)
  syncLogs          SyncLog[]
}

@@unique([userId, brokerType, brokerAccountId])
```

---

### SyncLog

Logs de synchronisation.

```prisma
model SyncLog {
  id                 String     @id @default(uuid()) @db.Uuid
  brokerConnectionId String     @db.Uuid
  status             SyncStatus // PENDING, RUNNING, SUCCESS, FAILED
  tradesImported     Int        @default(0)
  tradesSkipped      Int        @default(0)
  tradesUpdated      Int        @default(0)
  startedAt          DateTime   @default(now())
  completedAt        DateTime?
  durationMs         Int?
  errorMessage       String?
  errorDetails       Json?
  syncType           String     @default("scheduled")
  
  brokerConnection   BrokerConnection @relation(...)
}
```

---

## Modèles AI Coach

### CoachConversation & CoachMessage

```prisma
model CoachConversation {
  id        String         @id @default(uuid()) @db.Uuid
  userId    String         @db.Uuid
  title     String?
  context   Json?          // Trading context at start
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
  
  user      User           @relation(...)
  messages  CoachMessage[]
}

model CoachMessage {
  id             String            @id @default(uuid()) @db.Uuid
  conversationId String            @db.Uuid
  role           String            // "user" | "assistant"
  content        String
  feedback       FeedbackType?     // LIKE, DISLIKE
  createdAt      DateTime          @default(now())
  
  conversation   CoachConversation @relation(...)
}
```

---

### UserFeedback

Feedbacks utilisateurs.

```prisma
model UserFeedback {
  id        String           @id @default(uuid()) @db.Uuid
  userId    String           @db.Uuid
  category  FeedbackCategory // SUGGESTION, BUG_REPORT, COACH_FEEDBACK, GENERAL
  title     String?
  content   String
  metadata  Json?
  resolved  Boolean          @default(false)
  createdAt DateTime         @default(now())
  
  user      User             @relation(...)
}
```

---

## Modèles Voting

### VotingOption & Vote

```prisma
model VotingOption {
  id          String               @id @default(uuid()) @db.Uuid
  title       String
  description String?
  status      VotingOptionStatus   @default(ACTIVE)
  category    VotingOptionCategory @default(GENERAL)
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt
  
  votes       Vote[]
}

model Vote {
  id           String       @id @default(uuid()) @db.Uuid
  userId       String       @db.Uuid
  optionId     String       @db.Uuid
  createdAt    DateTime     @default(now())
  
  user         User         @relation(...)
  votingOption VotingOption @relation(...)
}

@@unique([userId, optionId])
```

---

## Enums

```prisma
enum Direction {
  LONG
  SHORT
  UNKNOWN
}

enum PlaybookVisibility {
  PRIVATE
  UNLISTED
  PUBLIC
}

enum SubscriptionStatus {
  TRIAL
  ACTIVE
  BETA_ACCESS
  PAST_DUE
  CANCELED
  EXPIRED
}

enum PlanInterval {
  BETA
  MONTHLY
  QUARTERLY
  BIANNUAL
  ANNUAL
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

enum BrokerType {
  TRADOVATE
  IBKR
}

enum BrokerConnectionStatus {
  PENDING
  CONNECTED
  ERROR
  DISCONNECTED
}

enum SyncStatus {
  PENDING
  RUNNING
  SUCCESS
  FAILED
}

enum FeedbackType {
  LIKE
  DISLIKE
}

enum FeedbackCategory {
  SUGGESTION
  BUG_REPORT
  COACH_FEEDBACK
  GENERAL
}

enum VotingOptionStatus {
  ACTIVE
  INACTIVE
}

enum VotingOptionCategory {
  ROADMAP
  GENERAL
}
```

---

## Index

### Index sur les tables principales

| Table | Index | Colonnes |
|-------|-------|----------|
| trades | idx_trades_user | userId |
| trades | idx_trades_account | accountId |
| trades | idx_trades_opened | openedAt |
| trades | idx_trades_closed | closedAt |
| trades | idx_trades_symbol | symbol |
| trades | idx_trades_signature | tradeSignature |
| tags | idx_tags_user | userId |
| day_journals | idx_day_journals_user | userId |
| screenshots | idx_screenshots_user | userId |
| screenshots | idx_screenshots_trade | tradeId |
| voice_notes | idx_voice_notes_trade | tradeId |
| subscriptions | idx_subscriptions_user | userId |
| subscriptions | idx_subscriptions_status | status |
| broker_connections | idx_broker_user | userId |
| sync_logs | idx_sync_broker | brokerConnectionId |
| votes | idx_votes_user | userId |
| votes | idx_votes_option | optionId |

---

## Migrations

Les migrations Prisma sont stockées dans `prisma/migrations/`. Pour appliquer les migrations :

```bash
# Développement : sync direct du schéma
npx prisma db push

# Production : migrations formelles
npx prisma migrate deploy
```

Pour voir l'état de la base de données :

```bash
npx prisma studio
```
