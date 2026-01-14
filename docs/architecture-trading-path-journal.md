# 🏗️ Architecture Technique - Trading Path Journal

> **Vision** : Plateforme de journal de trading unifiée surpassant tous les concurrents en intégrant 100% de leurs fonctionnalités Premium dans une seule interface supérieure.

**Version** : 1.0  
**Date** : 2026-01-XX  
**Auteur** : PM & Architecture Team  
**Statut** : Draft - Architecture de référence

---

## Introduction

This document defines the full-stack architecture for **Trading Path Journal**. It unifies backend and frontend architecture decisions into a single source of truth to guide implementation across data ingestion, analytics, AI workflows, and UI/UX. It evolves the existing Trading Journal codebase into a complete platform that integrates premium features from leading competitors while preserving compatibility, performance, and security.

**Starter Template or Existing Project**  
**Existing project (brownfield)** — This architecture extends the current **Trading Journal** Next.js + Supabase codebase. There is no starter template or greenfield scaffold. Existing constraints include App Router, Supabase Auth + Postgres, Prisma, and the current data model, which must be preserved or migrated without data loss.

**Governance Rules (Cross-Cutting)**  
- **API Notification**: Any feature that requires an external API must be flagged immediately to Product/Architecture for budget and approval before implementation.  
- **Broker Research**: Each broker integration must be preceded by documented research (docs, rate limits, auth, libraries, limitations, alternatives, best practices) to ensure the most efficient implementation.  
- **Enforcement**: These rules are enforced via architecture review + checklist gating before implementation begins.

**Source of Truth**  
- PRD: `docs/prd-trading-path-journal.md`  
- Roadmap: `docs/roadmap-trading-path-journal.md` (supersedes legacy `docs/roadmap.md` for this initiative)  
- This architecture document supersedes prior **partial** architecture notes for full‑stack scope (non‑conflicting documents like `architecture-supabase-migration.md` remain valid references).

## 📋 Table des Matières

1. [Introduction](#introduction)
2. [Synthèse et Unification des Fonctionnalités](#1-synthèse-et-unification-des-fonctionnalités)
3. [Architecture Technique (Tech Stack 2024/2025)](#2-architecture-technique-tech-stack-20242025)
4. [Database Schema (High Level)](#3-database-schema-high-level)
5. [Killer Features Inédites](#4-killer-features-inédites)

---

## 1. Synthèse et Unification des Fonctionnalités

### 1.1 Modules Identifiés

#### **Module A : Psychologie & Discipline (Inspired by Edgewonk)**
- **Tiltmeter** : Détection automatique de perte de discipline (algorithme ML)
- **Efficiency Analysis** : Comparaison entrée/sortie réelle vs théorique optimale
- **Emotional Journal** : Journalisation avant/pendant/après trade
- **Future Simulators** : Projection compte dans X mois selon stats actuelles

#### **Module B : AI & Data Intelligence (Inspired by TraderSync)**
- **AI Feedback** : Analyse IA pour identifier patterns négatifs
- **AI Assistant** : Coaching conversationnel avec contexte trading
- **Simulateur de Trading** : Replay de scénarios de marché
- **Auto-spread Detection** : Détection intelligente spreads complexes

#### **Module C : Replay & Visualisation (Inspired by TradeZella)**
- **Trade Replay** : Replay tick-by-tick bougie par bougie
- **TTP Score** : Note sur 100 par trade (respect plan + exécution) - Trading Path Score
- **Market Replay & Backtesting** : Infrastructure complète pour backtesting tick-by-tick (250ms tick precision, all assets)
- **Drills Mode** : Simulation pour reconnaître setups sans risque

#### **Module D : Analytics Avancées (Inspired by Tradervue)**
- **MFE/MAE Analysis** : Maximum Favorable/Adverse Excursion
- **Exit Analysis** : Comparaison sorties réelles vs optimales
- **Risk Analysis** : R-Multiple, risque par trade, volatilité portefeuille
- **Liquidity Reports** : Impact liquidité (gros volumes)

#### **Module E : Multi-Compte & Infrastructure (Inspired by Trademetria)**
- **Comptes Illimités** : Gestion illimitée de comptes trading sous un seul login (sans limite)
- **REST API** : Accès complet pour développeurs
- **Fundamental Research** : Données financières entreprises intégrées
- **Options Greeks** : Delta, Gamma, Theta pour vendeurs options
- **Prop Firm Tracking** : Suivi challenges FTMO, Apex, etc.

#### **Module F : Connectivité Broker (All-in-One)**
- **Auto-Sync** : 240+ brokers supportés via API
- **File Upload** : Fallback CSV/Excel pour brokers sans API
- **Real-time Sync** : Synchronisation temps réel pour brokers compatibles
- **Multi-Format Support** : CSV, Excel, JSON, XML, API REST

#### **Module G : Journalisation & Partage**
- **Daily Journal** : Notes quotidiennes avec WYSIWYG editor
- **Trade Journal** : Notes individuelles par trade
- **Voice Notes** : Enregistrement vocal pour trades et journées (transcription Whisper + synthèse IA OpenAI)
- **Playbooks** : Bibliothèques stratégies (meilleurs/pires setups)
- **Sharing** : Partage trades/analyses/playbooks (liens publics, embed)
- **Tags** : Système de tags assignables aux trades ET aux journées
- **Trade History Calendar** : Vue calendrier avec recherche

#### **Module H : Analytics & Rapports**
- **Key Metrics** : Profit Factor, Win Rate, RR moyen, etc.
- **Distribution Analysis** : Par temps, condition marché, symbole
- **Strategy Rankings** : Comparaison performances stratégies
- **Instrument Rankings** : Meilleurs/pires instruments
- **Daytrader Reports** : Rapports journaliers personnalisés

### 1.2 Conflits Potentiels et Résolutions

| Conflit | Description | Résolution |
|---------|-------------|------------|
| **MFE/MAE vs Tiltmeter** | MFE/MAE nécessite données tick-by-tick, Tiltmeter analyse patterns | Stocker données tick séparément, calculer MFE/MAE à la volée, Tiltmeter utilise agrégats |
| **Replay Tick vs Performance** | Replay 250ms nécessite stockage massif | Time-series DB (TimescaleDB) pour ticks, compression, archivage anciens |
| **Multi-Compte vs Single Dashboard** | Comptes illimités → complexité UI | Design par onglets/groupes, filtres contextuels, vue agrégée optionnelle, pagination virtuelle |
| **AI Feedback vs Manual Notes** | Conflit entre IA et journalisation manuelle | IA en suggestions, utilisateur garde contrôle, marquage "IA-suggested" |

---

## 2. Architecture Technique (Tech Stack 2024/2025)

### 2.1 Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                           │
│  Next.js 15 (App Router) + React 19 + TypeScript 5.6+          │
│  - Server Components (RSC) pour performance                    │
│  - Streaming SSR pour temps de chargement minimal              │
│  - Progressive Web App (PWA)                                   │
└───────────────────────┬─────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│                      API GATEWAY LAYER                          │
│  Next.js API Routes + tRPC (type-safe RPC)                     │
│  - Rate limiting (Upstash Redis)                               │
│  - Authentication (Supabase Auth)                              │
│  - Real-time subscriptions (WebSockets/SSE)                    │
└───────────────────────┬─────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│                    APPLICATION LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   AI Service │  │ Broker Sync  │  │ Analytics    │         │
│  │   (LLM)      │  │ Service      │  │ Engine       │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Replay      │  │ Tiltmeter    │  │ Playbook     │         │
│  │  Engine      │  │ Service      │  │ Service      │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└───────────────────────┬─────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│                      DATA LAYER                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  PostgreSQL (Supabase) - Données relationnelles      │      │
│  │  - Users, Trades, Accounts, Journal, Tags, etc.      │      │
│  └──────────────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  TimescaleDB - Données time-series (ticks, replay)   │      │
│  │  - Tick data 250ms precision                         │      │
│  │  - Compression automatique (retention policies)      │      │
│  └──────────────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Redis (Upstash) - Cache + Queue                     │      │
│  │  - Session cache, rate limiting                       │      │
│  │  - Job queue (BullMQ) pour imports asynchrones       │      │
│  └──────────────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Vector DB (Qdrant/Pinecone) - AI Embeddings         │      │
│  │  - Similarité trades, playbooks, stratégies          │      │
│  └──────────────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Object Storage (Supabase Storage/S3)                │      │
│  │  - Screenshots, exports, backups                     │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Stack Technique Détaillée

#### **Frontend**

| Composant | Technologie | Version | Raison du Choix |
|-----------|-------------|---------|-----------------|
| **Framework** | Next.js | 15.x (latest) | App Router, RSC, streaming SSR pour UX ultra-fluide |
| **UI Library** | React | 19.x | Concurrent features, meilleures performances |
| **Type Safety** | TypeScript | 5.6+ | Type safety end-to-end |
| **UI Components** | shadcn/ui + TailwindCSS | Latest | Design system moderne, customisable |
| **Charts** | TradingView Lightweight Charts + Recharts | Latest | TradingView pour replay, Recharts pour analytics |
| **State Management** | Zustand + React Query | Latest | Légèreté + cache serveur optimisé |
| **Forms** | React Hook Form + Zod | Latest | Validation type-safe, performance |
| **Real-time** | Supabase Realtime + WebSockets | Latest | Updates temps réel (sync brokers) |
| **i18n** | next-intl | Latest | Multi-langue (FR/EN+) |
| **PWA** | next-pwa | Latest | App mobile-like, offline support |

#### **Backend**

| Composant | Technologie | Version | Raison du Choix |
|-----------|-------------|---------|-----------------|
| **Runtime** | Node.js | 20.x LTS | Performance, écosystème riche |
| **API Framework** | Next.js API Routes + tRPC | Latest | Type-safe APIs, end-to-end types |
| **Auth** | Supabase Auth | Latest | OAuth, MFA, session management |
| **Job Queue** | BullMQ + Redis | Latest | Traitement asynchrone imports broker |
| **API Client** | Axios + Zod | Latest | Validation requests/responses |
| **Rate Limiting** | Upstash Redis | Latest | Rate limiting distribué |

#### **Databases**

| Type | Technologie | Version | Usage |
|------|-------------|---------|-------|
| **Relational** | PostgreSQL (Supabase) | 15+ | Données structurées (users, trades, accounts) |
| **Time-Series** | TimescaleDB (extension Postgres) | 2.x | Tick data, replay, métriques temps réel |
| **Cache/Queue** | Redis (Upstash) | 7+ | Cache, sessions, job queue |
| **Vector** | Qdrant (self-hosted) ou Pinecone | Latest | Embeddings AI, recherche sémantique |

#### **AI & Machine Learning**

| Service | Technologie | Usage |
|---------|-------------|-------|
| **LLM** | OpenAI GPT-4o / Anthropic Claude 3.5 | AI Feedback, Coaching, Résumés |
| **Embeddings** | OpenAI text-embedding-3-large | Similarité trades, playbooks |
| **ML Models** | Python (scikit-learn) + TensorFlow.js | Tiltmeter, pattern detection |
| **Vector DB** | Qdrant / Pinecone | Stockage embeddings |

#### **Infrastructure**

| Service | Technologie | Usage |
|---------|-------------|-------|
| **Hosting** | Vercel (Frontend) + Railway/Render (Backend) | Déploiement global, edge functions |
| **CDN** | Vercel Edge Network | Assets statiques, API responses |
| **Monitoring** | Sentry + Vercel Analytics | Error tracking, performance |
| **Logging** | Axiom / Logtail | Centralized logging |
| **Storage** | Supabase Storage / AWS S3 | Screenshots, exports, backups |
| **Email** | Resend / SendGrid | Transactions, notifications |

### 2.3 Décisions Architecturales Clés

#### **2.3.1 Hybrid Database Strategy**

**Problème** : Gérer à la fois données relationnelles (trades, users) et time-series massives (ticks 250ms).

**Solution** :
- **PostgreSQL (Supabase)** pour données relationnelles normales
- **TimescaleDB** (extension PostgreSQL) pour tick data avec :
  - Compression automatique (retention 90 jours full precision, puis compression)
  - Hypertables pour partitioning par temps
  - Continuous aggregates pour métriques pré-calculées

**Avantages** :
- Un seul système DB (Postgres) → simplicité opérationnelle
- TimescaleDB optimisé pour time-series → performance replay
- SQL unifié → queries cross-data types possibles

#### **2.3.2 Real-time Architecture**

**Problème** : Synchronisation temps réel avec 240+ brokers.

**Solution** :
- **WebSockets** (Supabase Realtime) pour updates UI temps réel
- **Background Workers** (BullMQ) pour polling/sync brokers
- **Event-driven** : Events → Queue → Workers → Supabase Realtime → UI

**Flux** :
```
Broker API → Background Worker → PostgreSQL/TimescaleDB → Supabase Realtime → Frontend (WebSocket)
```

#### **2.3.3 Market Replay & Backtesting Infrastructure**

**Problème** : Infrastructure complète pour backtesting tick-by-tick (250ms precision) nécessite stockage massif + sources de données historiques + performance.

**Solution** :
- **TimescaleDB** pour stockage ticks compressés
- **CDN Edge Caching** pour replay fréquents (LRU cache)
- **Streaming** : Ticks streamés au client via SSE (Server-Sent Events)
- **Lazy Loading** : Charger uniquement période demandée
- **Backtesting Engine** : Simulation de stratégies sur données historiques

**Sources de Données Historiques (Tick Data Providers)** :
- **Barchart Market Replay** : Point-in-time quote and trade data via API
- **Interactive Brokers (IBKR)** : `reqHistoricalTicks` API pour données historiques
- **Intrinio** : Stock Prices Tick History API (stocks, depuis Sept 2023)
- **CQG Data API** : Données historiques multi-assets (futures, forex, etc.)
- **LSEG Tick History** : Données historiques globales (depuis 1996)
- **TickData TickAPI®** : Historical intraday data (equities, futures, options, forex)
- **AllTick** : Tick data real-time et historique (commodities, forex, stocks, crypto)
- **MarketTick** : Historical tick data en CSV/API (Level 1 & 2 depth)
- **FirstRate Data** : Tick data bundle (5000+ stocks/ETFs depuis 2010)

**Architecture Data Pipeline** :
```
Data Provider API → ETL Worker → TimescaleDB (tick_data) → Backtesting Engine → Results
                                              ↓
                                      Replay UI (Streaming)
```

**Optimisations** :
- Compression lossless (delta encoding) pour ticks
- Pré-agrégation bougies (1m, 5m, 15m) pour navigation rapide
- Web Workers côté client pour rendering asynchrone
- Batch processing pour backtesting (traitement parallèle par période)
- Caching des résultats de backtesting

#### **2.3.4 AI Architecture**

**Problème** : Intégrer LLM pour feedback/coaching sans latence excessive.

**Solution** :
- **Async Processing** : AI feedback calculé en background, stocké en DB
- **Caching** : Cache résultats AI (même trade = même feedback)
- **Streaming Responses** : Streaming pour chat AI (SSE)
- **Vector Search** : Embeddings pour trouver trades similaires rapidement

**Architecture** :
```
User Action → Queue (BullMQ) → AI Worker (Python/Node) → LLM API → Vector DB → Cache → Response
```

#### **2.3.5 Unlimited Accounts Architecture**

**Problème** : Support d'un nombre illimité de comptes trading par utilisateur sans dégradation de performance.

**Solution** :
- **Lazy Loading** : Charger uniquement les comptes visibles/actifs dans l'UI
- **Virtual Scrolling** : Pagination virtuelle pour listes de comptes (react-window/react-virtual)
- **Grouping & Filtering** : Regrouper par broker/type pour navigation rapide
- **Caching Strategy** : Cache Redis pour données de comptes fréquemment accédés
- **Indexed Queries** : Index composé `(user_id, broker_name, account_number)` pour lookups rapides
- **Aggregate Views** : Vue agrégée optionnelle pour dashboard unifié (tous comptes)

**Optimisations UI** :
- **Tabbed Interface** : Groupes de comptes par onglets (ex: "FTMO Accounts", "IBKR Accounts")
- **Search & Filter** : Recherche instantanée avec debouncing pour trouver compte rapidement
- **Bulk Operations** : Actions groupées (sync multiple, export, etc.)
- **Progressive Loading** : Charger métriques/statistiques à la demande (lazy load on tab click)

**Scalabilité** :
- Pas de limite hard dans le schéma DB (UNIQUE constraint uniquement sur `user_id + broker_name + account_number`)
- Background sync workers parallélisés par compte pour éviter bottlenecks
- Rate limiting par compte pour respecter limites API brokers

**Avantages** :
- Support réellement illimité (scalable horizontalement)
- Performance constante même avec centaines de comptes
- UX fluide grâce au lazy loading et virtual scrolling

---

## 3. Database Schema (High Level)

### 3.1 Schéma Relationnel (PostgreSQL)

```sql
-- ============================================
-- CORE ENTITIES
-- ============================================

-- Users (managed by Supabase Auth, extended)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  username TEXT,
  avatar_url TEXT,
  preferred_language TEXT DEFAULT 'fr',
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trading Accounts (supports unlimited accounts per user - no hard limit)
CREATE TABLE trading_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  broker_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT, -- 'live', 'demo', 'prop_firm', etc.
  currency TEXT DEFAULT 'USD',
  sync_enabled BOOLEAN DEFAULT false,
  sync_method TEXT, -- 'api', 'file_upload', 'manual'
  api_credentials_encrypted JSONB, -- Encrypted API keys/tokens
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, broker_name, account_number)
);

-- Trades (core entity)
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES trading_accounts(id) ON DELETE SET NULL,
  
  -- Trade identification
  symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL, -- 'forex', 'stocks', 'futures', 'crypto', 'options', 'cfds'
  direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  
  -- Execution details
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  entry_price DECIMAL(20, 8) NOT NULL,
  exit_price DECIMAL(20, 8),
  quantity DECIMAL(20, 8) NOT NULL,
  
  -- PnL & Metrics
  realized_pnl_usd DECIMAL(20, 8),
  floating_runup_usd DECIMAL(20, 8), -- MFE (Maximum Favorable Excursion)
  floating_drawdown_usd DECIMAL(20, 8), -- MAE (Maximum Adverse Excursion)
  
  -- Risk Management
  stop_loss_price_initial DECIMAL(20, 8),
  take_profit_price DECIMAL(20, 8),
  risk_reward_ratio DECIMAL(10, 4),
  r_multiple DECIMAL(10, 4),
  
  -- Fees & Costs
  commission_usd DECIMAL(20, 8) DEFAULT 0,
  swap_usd DECIMAL(20, 8) DEFAULT 0,
  spread_cost_usd DECIMAL(20, 8) DEFAULT 0,
  total_fees_usd DECIMAL(20, 8) DEFAULT 0,
  
  -- Analysis & Scoring
  ttp_score INTEGER, -- 0-100 score (Trading Path Score - respect plan + exécution)
  efficiency_score DECIMAL(5, 2), -- Edgewonk-inspired efficiency
  
  -- Metadata
  notes TEXT,
  external_trade_id TEXT, -- ID from broker
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for performance
  INDEX idx_trades_user_opened (user_id, opened_at DESC),
  INDEX idx_trades_account (account_id),
  INDEX idx_trades_symbol (symbol),
  INDEX idx_trades_external_id (external_trade_id)
);

-- Tags (reusable tags for trades and days)
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  category TEXT, -- 'emotion', 'setup', 'mistake', 'custom'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Trade Tags (many-to-many)
CREATE TABLE trade_tags (
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (trade_id, tag_id)
);

-- Day Journal (daily notes and annotations)
CREATE TABLE day_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  note TEXT, -- WYSIWYG content (HTML/JSON)
  emotional_state TEXT, -- Pre/During/Post trading state
  tilt_score DECIMAL(5, 2), -- Tiltmeter score for the day
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Day Tags (many-to-many)
CREATE TABLE day_tags (
  day_journal_id UUID REFERENCES day_journals(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (day_journal_id, tag_id)
);

-- Playbooks (trading strategies)
CREATE TABLE playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  setup_rules JSONB, -- Structured rules for the setup
  is_public BOOLEAN DEFAULT false,
  is_template BOOLEAN DEFAULT false, -- System templates
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playbook Trades (link trades to playbooks)
CREATE TABLE playbook_trades (
  playbook_id UUID REFERENCES playbooks(id) ON DELETE CASCADE,
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  PRIMARY KEY (playbook_id, trade_id)
);

-- Screenshots (trade or day attachments)
CREATE TABLE screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
  day_journal_id UUID REFERENCES day_journals(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  original_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voice Notes (trade annotations - transcription Whisper + synthesis OpenAI)
CREATE TABLE voice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  duration INTEGER NOT NULL, -- Duration in seconds
  transcription TEXT, -- Filled by Whisper API
  summary TEXT, -- Filled by OpenAI LLM (JSON stringified)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_voice_notes_trade (trade_id),
  INDEX idx_voice_notes_user (user_id)
);

-- Day Voice Notes (daily journal annotations - transcription Whisper + synthesis OpenAI)
CREATE TABLE day_voice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_journal_id UUID NOT NULL REFERENCES day_journals(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  duration INTEGER NOT NULL, -- Duration in seconds
  transcription TEXT, -- Filled by Whisper API
  summary TEXT, -- Filled by OpenAI LLM (JSON stringified)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_day_voice_notes_journal (day_journal_id),
  INDEX idx_day_voice_notes_user (user_id)
);

-- AI Feedback (cached AI analysis per trade)
CREATE TABLE ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  feedback_text TEXT NOT NULL,
  feedback_type TEXT, -- 'pattern', 'mistake', 'improvement', 'coaching'
  confidence_score DECIMAL(5, 2),
  model_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trade_id, feedback_type) -- One feedback per type per trade
);

-- Broker Sync Logs (tracking sync operations)
CREATE TABLE broker_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES trading_accounts(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- 'full', 'incremental', 'manual'
  status TEXT NOT NULL, -- 'success', 'failed', 'partial'
  trades_imported INTEGER DEFAULT 0,
  trades_skipped INTEGER DEFAULT 0,
  errors JSONB,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

-- Import Profiles (CSV mapping configurations per user/broker)
CREATE TABLE import_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  broker_name TEXT NOT NULL,
  profile_name TEXT NOT NULL,
  column_mapping JSONB NOT NULL, -- Maps CSV columns to internal fields
  date_format TEXT,
  currency TEXT DEFAULT 'USD',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, broker_name, profile_name)
);
```

### 3.2 Schéma Time-Series (TimescaleDB)

```sql
-- ============================================
-- TIME-SERIES DATA (TimescaleDB)
-- ============================================

-- Tick Data (250ms precision for replay)
CREATE TABLE tick_data (
  time TIMESTAMPTZ NOT NULL,
  symbol TEXT NOT NULL,
  account_id UUID,
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  
  -- Price data
  bid_price DECIMAL(20, 8),
  ask_price DECIMAL(20, 8),
  last_price DECIMAL(20, 8),
  volume BIGINT,
  
  -- Metadata
  source TEXT, -- 'broker', 'market_data_provider'
  
  PRIMARY KEY (time, symbol, account_id)
);

-- Convert to hypertable (TimescaleDB)
SELECT create_hypertable('tick_data', 'time', 
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Compression policy (compress after 30 days)
SELECT add_compression_policy('tick_data', INTERVAL '30 days');

-- Continuous aggregates for candles (pre-aggregated for performance)
CREATE MATERIALIZED VIEW candle_1m
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('1 minute', time) AS bucket,
  symbol,
  account_id,
  FIRST(bid_price, time) AS open,
  MAX(bid_price) AS high,
  MIN(bid_price) AS low,
  LAST(bid_price, time) AS close,
  SUM(volume) AS volume
FROM tick_data
GROUP BY bucket, symbol, account_id;

-- Add refresh policy
SELECT add_continuous_aggregate_policy('candle_1m',
  start_offset => INTERVAL '1 hour',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute');

-- Trade Metrics Time-Series (for equity curve, etc.)
CREATE TABLE trade_metrics_ts (
  time TIMESTAMPTZ NOT NULL,
  user_id UUID NOT NULL,
  account_id UUID,
  
  -- Aggregated metrics
  cumulative_pnl DECIMAL(20, 8),
  daily_pnl DECIMAL(20, 8),
  win_rate DECIMAL(5, 2),
  profit_factor DECIMAL(10, 4),
  max_drawdown DECIMAL(20, 8),
  sharpe_ratio DECIMAL(10, 4),
  
  PRIMARY KEY (time, user_id, account_id)
);

SELECT create_hypertable('trade_metrics_ts', 'time');
```

### 3.3 Relations Clés

```
User (1) ──< (N) TradingAccounts
User (1) ──< (N) Trades
User (1) ──< (N) Tags
User (1) ──< (N) DayJournals
User (1) ──< (N) Playbooks

TradingAccount (1) ──< (N) Trades
Trade (N) >──< (N) Tags (via trade_tags)
Trade (N) >──< (N) Playbooks (via playbook_trades)
Trade (1) ──< (N) Screenshots
Trade (1) ──< (N) VoiceNotes
Trade (1) ──< (N) AIFeedback

DayJournal (N) >──< (N) Tags (via day_tags)
DayJournal (1) ──< (N) Screenshots
DayJournal (1) ──< (N) DayVoiceNotes

TickData (N) ──> (1) Trade (optional link)
```

---

## 4. Killer Features Inédites

### 4.1 Feature 1 : "Path Predictor" - LLM-Powered Trade Path Simulation

**Concept** : Utiliser un LLM fine-tuné sur l'historique de trading de l'utilisateur pour prédire les "chemins" probables qu'un trade aurait pu prendre selon différentes stratégies de sortie.

**Fonctionnalités** :
- **"What-If" Scenarios** : L'utilisateur sélectionne un trade passé, et l'IA génère 5-10 scénarios de sortie différents avec probabilités
- **Learning from History** : Le LLM analyse les patterns de l'utilisateur ("tu sors souvent trop tôt sur les winners") et suggère des ajustements
- **Visualization** : Graphique interactif montrant les chemins possibles avec leur PnL respectif

**Tech Stack** :
- Fine-tuned LLM (GPT-4o fine-tuned ou Claude 3.5 Opus) sur historique utilisateur
- Graph neural networks pour modéliser les relations entre trades
- D3.js pour visualisation interactive des chemins

**Différenciation** : Aucun concurrent n'offre de simulation de "chemins alternatifs" basée sur l'IA et l'historique personnel.

---

### 4.2 Feature 2 : "Collective Intelligence Dashboard" - Anonymous Peer Comparison

**Concept** : Dashboard anonymisé comparant les performances de l'utilisateur avec celles de traders similaires (même style, même marché, même niveau).

**Fonctionnalités** :
- **Peer Benchmarking** : "Vous tradez mieux que 78% des traders similaires sur EUR/USD"
- **Blind Spots Detection** : L'IA détecte des patterns que vous négligez mais que vos pairs utilisent efficacement
- **Anonymous Insights** : "Les traders similaires qui gagnent plus ont tendance à X" (sans révéler qui)
- **Strategy Marketplace** : Marketplace anonyme de stratégies performantes (avec preuve de performance)

**Tech Stack** :
- Federated learning pour agréger insights sans exposer données individuelles
- Differential privacy pour anonymisation garantie
- Vector similarity search (Qdrant) pour trouver "peers" similaires

**Différenciation** : Comparaison sociale anonyme avec protection vie privée totale (RGPD-compliant).

---

### 4.3 Feature 3 : "Voice-First Trading Coach" - Multimodal AI Assistant

**Concept** : Assistant vocal intelligent qui analyse votre trading en temps réel et vous guide vocalement pendant que vous tradez.

**Fonctionnalités** :
- **Real-time Coaching** : Pendant un trade ouvert, l'assistant vous parle ("Attention, tu approches de ton stop, veux-tu le déplacer en breakeven?")
- **Post-Trade Debrief** : Après chaque trade, résumé vocal automatique ("Tu as bien respecté ton plan, mais tu aurais pu prendre plus de profit à 14h32")
- **Emotional Check-ins** : L'IA détecte du stress dans ta voix et suggère une pause
- **Multimodal Input** : L'utilisateur peut répondre vocalement ou par texte

**Tech Stack** :
- Whisper (OpenAI) pour transcription temps réel
- GPT-4o avec voice capabilities pour génération réponses
- TTS (ElevenLabs) pour voix naturelle
- Web Audio API pour capture audio navigateur

**Différenciation** : Coaching vocal temps réel pendant le trading (pas juste après) avec interaction multimodale.

---

### 4.4 Bonus : "Trading DNA Profile" - Genomic-Style Analysis

**Concept** : Analyse profonde du "profil génétique" de trading de l'utilisateur (forces, faiblesses, style inné) avec recommandations personnalisées.

**Fonctionnalités** :
- **DNA Report** : Rapport visuel type "23andMe" montrant votre profil trading (ex: "Vous êtes un scalper naturel, mais vous forcez le swing trading")
- **Compatibility Matching** : Matching avec stratégies/comptes/mentors compatibles avec votre "DNA"
- **Evolution Tracking** : Suivi de l'évolution de votre profil dans le temps

**Différenciation** : Approche "génomique" du trading pour comprendre ses forces innées.

---

## 5. Pages Publiques Requises

### 5.1 Landing Page
- **Hero Section** : Visuels, value proposition claire
- **Features Preview** : Carrousel des principales fonctionnalités
- **Social Proof** : Témoignages (si disponibles)
- **CTA** : "Start Free Trial" / "View Pricing"

### 5.2 Features Page
- **Modules détaillés** : Chaque module (A-H) avec screenshots/vidéos
- **Comparison Table** : Comparaison avec concurrents (Edgewonk, TraderSync, etc.)
- **Use Cases** : Cas d'usage par type de trader

### 5.3 Pricing Page
- **Plans** : Free, Pro, Elite (avec feature gating)
- **Pricing Tiers** : Mensuel/Trimestriel/Annuel
- **Feature Comparison** : Tableau comparatif détaillé

### 5.4 Backtesting System Page
- **Description** : Explication du système de backtesting
- **Capabilities** : Ce qui est possible (assets, timeframe, etc.)
- **Examples** : Exemples de backtests

### 5.5 Trading Path AI Page
- **AI Features** : Détails des fonctionnalités IA
- **How It Works** : Explication du fonctionnement
- **Privacy** : Protection des données utilisateur

### 5.6 Supported Brokers Page
- **Liste complète** : Tous les brokers (240+) avec statut (API/File Upload)
- **Search/Filter** : Recherche par nom, pays, type
- **Integration Status** : Badges (✅ Auto-sync, 📁 File Upload, 🔄 Coming Soon)

### 5.7 Resources/Academy Page
- **Trading Path Academy** : Cours, webinaires, guides
- **Blog** : Articles de trading
- **Documentation** : Guides utilisateur, API docs
- **Community** : Liens vers Discord/Forum

---

## 6. Prochaines Étapes

1. **Validation Architecture** : Review technique avec équipe
2. **Création PRD** : Document PRD complet basé sur cette architecture
3. **Proof of Concept** : POC pour replay engine + TimescaleDB
4. **Roadmap Détaillée** : Planification par phases (MVP → Full Feature)
5. **Infrastructure Setup** : Provisioning Supabase, TimescaleDB, Redis

---

**Document Status** : Draft - À valider par équipe technique  
**Next Review** : Après validation PRD
