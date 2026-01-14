# 📋 PRD: Trading Path Journal - Vision Complète

> **Status**: 🚧 DRAFT  
> **Version**: 1.0  
> **Date**: 2026-01-XX  
> **PM**: John (BMad Agent)  
> **Type**: Major Platform Evolution

---

## 📌 Résumé Exécutif

**Trading Path Journal** est une transformation majeure de l'application Trading Journal actuelle vers une plateforme unifiée qui intègre **100% des fonctionnalités Premium** des 5 leaders du marché (Edgewonk, TraderSync, TradeZella, Tradervue, Trademetria) dans une seule interface supérieure.

**Objectif** : Créer un produit qui rend tous les concurrents obsolètes en offrant toutes leurs fonctionnalités Elite dans une interface plus performante avec une UX supérieure.

---

## 1. Intro Project Analysis and Context

### 1.1 Existing Project Overview

#### Analysis Source
- IDE-based analysis + `docs/architecture-trading-path-journal.md` + `docs/roadmap.md` + `PROJECT_MEMORY.md`

#### Current Project State

Le **Trading Journal App** actuel est une application web Next.js (App Router) permettant aux traders de :

- Importer leurs trades (CSV, OCR)
- Visualiser un dashboard avec KPIs (Profit Factor, Win Rate, RR moyen, courbe d'équité)
- Consulter un calendrier avec PnL quotidien
- Gérer des playbooks de stratégie
- Annoter trades et journées (tags, screenshots, notes textuelles)
- Notes vocales avec transcription Whisper + synthèse IA OpenAI
- Broker Sync (Tradovate, IBKR)
- Social Login (Google, Apple, Discord)
- Abonnements Stripe

**Stack actuelle** :

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Framework | Next.js (App Router) | 14.x |
| Language | TypeScript | 5.x |
| Database | PostgreSQL (Supabase) | - |
| ORM | Prisma | 5.x |
| Auth | Supabase Auth | - |
| UI | TailwindCSS + shadcn/ui | - |
| Charts | Recharts + TradingView Lightweight Charts | - |
| i18n | next-intl | FR/EN |

### 1.2 Available Documentation Analysis

| Document | Statut |
|----------|--------|
| Architecture Document | ✅ Présent (`docs/architecture-trading-path-journal.md`) |
| Roadmap | ✅ Présent (`docs/roadmap.md`) |
| Project Memory | ✅ Présent (`PROJECT_MEMORY.md`) |
| Audit Report | ✅ Présent (`docs/AUDIT_REPORT.md`) |
| Tech Stack Documentation | ⚠️ Partiel (dans architecture) |
| API Documentation | ❌ À créer |

### 1.3 Enhancement Scope Definition

#### Enhancement Type
- [x] Major Feature Modification
- [x] Technology Stack Upgrade
- [x] UI/UX Overhaul
- [x] Integration with New Systems
- [x] Performance/Scalability Improvements
- [x] New Feature Addition

#### Enhancement Description

**Trading Path Journal** transforme l'application actuelle en une plateforme complète intégrant :

1. **Toutes les fonctionnalités Premium des 5 leaders** (Edgewonk, TraderSync, TradeZella, Tradervue, Trademetria)
2. **Infrastructure de backtesting tick-by-tick** avec Market Replay
3. **AI avancée** : Feedback, Coaching, Voice-First Assistant
4. **Multi-compte illimité** avec sync 240+ brokers
5. **3 Killer Features inédites** : Path Predictor, Collective Intelligence Dashboard, Voice-First Trading Coach
6. **Pages publiques complètes** : Landing, Features, Pricing, Backtesting, AI, Supported Brokers, Academy

#### Impact Assessment
- [x] **Major Impact (architectural changes required)**

**Justification** :
- Ajout de TimescaleDB pour time-series data
- Infrastructure de backtesting complète
- Architecture AI distribuée
- Support 240+ brokers
- Refonte UI majeure pour supporter toutes les fonctionnalités

### 1.4 Goals and Background Context

#### Goals

- **Objectif Principal** : Créer la plateforme de journal de trading la plus complète du marché, surpassant tous les concurrents
- **Objectif Technique** : Architecture moderne (2024/2025) capable de gérer Big Data, replay tick-by-tick, IA temps réel
- **Objectif UX** : Interface unifiée et fluide intégrant 100% des fonctionnalités Premium sans compromis
- **Objectif Business** : Positionnement premium avec feature parity ou supérieure à tous les concurrents

#### Background Context

Le marché des journaux de trading est fragmenté avec 5 leaders offrant chacun des fonctionnalités spécifiques :

- **Edgewonk** : Force dans la psychologie (Tiltmeter, Efficiency Analysis)
- **TraderSync** : Force dans l'AI (AI Feedback, Auto-Sync massif)
- **TradeZella** : Force dans le replay (Trade Replay tick-by-tick, Zella Score)
- **Tradervue** : Force dans l'analytics (MFE/MAE, Risk Analysis)
- **Trademetria** : Force dans le multi-compte (50 comptes, API, Fundamental Research)

**Problème** : Aucune plateforme n'intègre TOUTES ces fonctionnalités dans une seule interface.

**Solution** : Trading Path Journal unifie toutes ces fonctionnalités Premium dans une plateforme supérieure avec :
- Stack technique moderne (Next.js 15, React 19, TimescaleDB)
- Architecture scalable (support comptes illimités, Big Data)
- UX optimisée (interface unifiée, performance)
- Features inédites (3 Killer Features avec LLM)

---

## 2. Requirements

### 2.1 Functional Requirements

#### Module A : Psychologie & Discipline (Inspired by Edgewonk)

- **FR-A1** : Système Tiltmeter détectant automatiquement la perte de discipline basé sur patterns d'entrées/sorties
- **FR-A2** : Analyse d'efficacité comparant points d'entrée/sortie réels vs théoriques optimaux
- **FR-A3** : Journalisation émotionnelle avant/pendant/après trade
- **FR-A4** : Simulateurs de futur projetant état du compte dans X mois selon stats actuelles

#### Module B : AI & Data Intelligence (Inspired by TraderSync)

- **FR-B1** : AI Feedback analysant trades pour identifier patterns négatifs avec suggestions
- **FR-B2** : AI Assistant conversationnel avec contexte trading complet
- **FR-B3** : Simulateur de Trading pour rejouer scénarios de marché
- **FR-B4** : Détection automatique de spreads complexes

#### Module C : Replay & Visualisation (Inspired by TradeZella)

- **FR-C1** : Trade Replay tick-by-tick bougie par bougie pour analyser exécution
- **FR-C2** : TTP Score (Trading Path Score) sur 100 par trade (respect plan + exécution)
- **FR-C3** : Infrastructure Market Replay & Backtesting complète (250ms tick precision, all assets)
- **FR-C4** : Drills Mode pour s'entraîner à reconnaître setups sans risque

#### Module D : Analytics Avancées (Inspired by Tradervue)

- **FR-D1** : Analyse MFE/MAE (Maximum Favorable/Adverse Excursion) par trade
- **FR-D2** : Exit Analysis comparant sorties réelles vs optimales
- **FR-D3** : Risk Analysis : R-Multiple, risque par trade, volatilité portefeuille
- **FR-D4** : Rapports de liquidité pour gros volumes

#### Module E : Multi-Compte & Infrastructure (Inspired by Trademetria)

- **FR-E1** : Gestion illimitée de comptes trading sous un seul login (sans limite hard)
- **FR-E2** : REST API complète pour développeurs
- **FR-E3** : Fundamental Research : données financières entreprises intégrées
- **FR-E4** : Options Greeks : Delta, Gamma, Theta pour vendeurs d'options
- **FR-E5** : Prop Firm Tracking : suivi challenges FTMO, Apex, etc.

#### Module F : Connectivité Broker (All-in-One)

- **FR-F1** : Auto-Sync avec 240+ brokers supportés via API
- **FR-F2** : File Upload (CSV/Excel) comme fallback pour brokers sans API
- **FR-F3** : Real-time Sync pour brokers compatibles
- **FR-F4** : Support multi-format : CSV, Excel, JSON, XML, API REST

#### Module G : Journalisation & Partage

- **FR-G1** : Daily Journal avec WYSIWYG editor
- **FR-G2** : Trade Journal avec notes individuelles par trade
- **FR-G3** : Voice Notes : enregistrement vocal pour trades/journées (transcription Whisper + synthèse IA OpenAI)
- **FR-G4** : Playbooks : bibliothèques de stratégies (meilleurs/pires setups)
- **FR-G5** : Sharing : partage trades/analyses/playbooks (liens publics, embed)
- **FR-G6** : Tags assignables aux trades ET aux journées
- **FR-G7** : Trade History Calendar avec recherche

#### Module H : Analytics & Rapports

- **FR-H1** : Key Metrics : Profit Factor, Win Rate, RR moyen, etc.
- **FR-H2** : Distribution Analysis : par temps, condition marché, symbole
- **FR-H3** : Strategy Rankings : comparaison performances stratégies
- **FR-H4** : Instrument Rankings : meilleurs/pires instruments
- **FR-H5** : Daytrader Reports : rapports journaliers personnalisés

#### Killer Features Inédites

- **FR-K1** : Path Predictor : LLM-powered simulation de chemins alternatifs de trades
- **FR-K2** : Collective Intelligence Dashboard : Benchmark anonyme avec peers similaires
- **FR-K3** : Voice-First Trading Coach : Coaching vocal temps réel pendant trading

#### Pages Publiques

- **FR-P1** : Landing Page responsive avec visuels et value proposition
- **FR-P2** : Features Page détaillant tous les modules
- **FR-P3** : Pricing Page avec plans (Free, Pro, Elite)
- **FR-P4** : Backtesting System Page expliquant le système
- **FR-P5** : Trading Path AI Page détaillant fonctionnalités IA
- **FR-P6** : Supported Brokers Page avec liste complète 240+ brokers
- **FR-P7** : Resources/Academy Page avec Trading Path Academy

### 2.2 Non-Functional Requirements

#### Performance

- **NFR-P1** : Page load time < 2s (First Contentful Paint)
- **NFR-P2** : Replay tick-by-tick fluide (60fps) pour périodes < 1 jour
- **NFR-P3** : Backtesting : traitement < 1 minute pour 1000 trades
- **NFR-P4** : Support 100+ comptes par utilisateur sans dégradation performance
- **NFR-P5** : Queries dashboard < 500ms (p95)

#### Scalability

- **NFR-S1** : Support 10k+ utilisateurs simultanés
- **NFR-S2** : Stockage time-series : 1TB+ de tick data avec compression
- **NFR-S3** : Scalabilité horizontale pour workers de backtesting
- **NFR-S4** : Cache Redis pour réduire charge DB de 80%

#### Reliability

- **NFR-R1** : Uptime 99.9% (SLA)
- **NFR-R2** : Backup quotidien automatique (DB + storage)
- **NFR-R3** : Rollback capability pour chaque déploiement
- **NFR-R4** : Error tracking avec Sentry

#### Security

- **NFR-SEC1** : Encryption des credentials API brokers (AES-256)
- **NFR-SEC2** : Rate limiting sur toutes les APIs (100 req/min/user)
- **NFR-SEC3** : Row Level Security (RLS) sur toutes les tables Supabase
- **NFR-SEC4** : HTTPS uniquement (TLS 1.3)
- **NFR-SEC5** : RGPD compliance (anonymisation, droit à l'oubli)

#### Usability

- **NFR-U1** : Interface responsive (mobile, tablet, desktop)
- **NFR-U2** : i18n complet (FR/EN minimum)
- **NFR-U3** : Accessibilité WCAG 2.1 AA
- **NFR-U4** : Onboarding < 5 minutes
- **NFR-U5** : Tooltips et documentation inline

#### Maintainability

- **NFR-M1** : Code coverage tests > 70%
- **NFR-M2** : Documentation technique à jour
- **NFR-M3** : CI/CD pipeline automatisé
- **NFR-M4** : Monitoring et alerting (Sentry, Logtail)

### 2.3 Compatibility Requirements

- **CR1** : Compatibilité avec données existantes (trades, accounts, journal actuels) - migration sans perte de données
- **CR2** : Compatibilité API : endpoints existants restent fonctionnels (versioning si breaking changes)
- **CR3** : Compatibilité UI : design system existant (shadcn/ui) maintenu et étendu
- **CR4** : Compatibilité auth : Supabase Auth existant reste fonctionnel
- **CR5** : Compatibilité i18n : messages FR/EN existants préservés

---

## 3. User Interface Enhancement Goals

### 3.1 Integration with Existing UI

Les nouvelles fonctionnalités s'intègrent avec le design system existant (shadcn/ui + TailwindCSS) :

- **Composants réutilisables** : Extension de composants existants plutôt que création de nouveaux
- **Patterns établis** : Suivre les patterns UI existants (modals, drawers, tables, charts)
- **Thème cohérent** : Dark mode maintenu, accents vert/violet/orange conservés
- **Navigation** : Extension de la navigation existante avec nouveaux modules

### 3.2 Modified/New Screens and Views

#### Nouveaux Screens

1. **Market Replay & Backtesting**
   - Page principale replay avec contrôles (play/pause, vitesse, période)
   - Interface de backtesting avec configuration de stratégie
   - Résultats de backtesting avec métriques détaillées

2. **AI Assistant Dashboard**
   - Interface chat conversationnel avec contexte trading
   - Historique des conversations
   - Suggestions AI en temps réel

3. **Multi-Compte Management**
   - Liste de comptes avec grouping/filtering
   - Configuration de sync par compte
   - Vue agrégée tous comptes

4. **Tiltmeter & Psychology**
   - Dashboard Tiltmeter avec métriques de discipline
   - Graphiques d'efficacité
   - Journal émotionnel avec timeline

5. **Analytics Avancées**
   - Page MFE/MAE Analysis avec visualisations
   - Exit Analysis avec comparaisons
   - Risk Analysis avec métriques détaillées

6. **Pages Publiques** (7 pages : Landing, Features, Pricing, Backtesting, AI, Brokers, Academy)

#### Screens Modifiés

1. **Dashboard** : Extension avec nouvelles métriques (TTP Score, Tiltmeter, etc.)
2. **Journal** : Ajout tags journées, voice notes journées
3. **Trades List** : Ajout colonnes (TTP Score, MFE/MAE, etc.)
4. **Trade Detail** : Extension avec replay, AI feedback, etc.
5. **Settings** : Ajout configuration comptes, brokers, AI, etc.

### 3.3 UI Consistency Requirements

- **Design System** : Utilisation exclusive de shadcn/ui components
- **Spacing** : Grid system Tailwind cohérent
- **Typography** : Hiérarchie typographique maintenue
- **Colors** : Palette existante (dark theme + accents)
- **Animations** : Transitions fluides (< 300ms)
- **Responsive** : Breakpoints Tailwind standard (sm, md, lg, xl)

---

## 4. Technical Constraints and Integration Requirements

### 4.1 Existing Technology Stack

**Languages** : TypeScript 5.x

**Frameworks** :
- Next.js 14.x (App Router) → **Upgrade vers 15.x**
- React 18.x → **Upgrade vers 19.x**

**Database** :
- PostgreSQL (Supabase) → **Maintien**
- **Ajout** : TimescaleDB (extension PostgreSQL) pour time-series

**ORM** : Prisma 5.x → **Maintien**

**Auth** : Supabase Auth → **Maintien**

**UI** :
- TailwindCSS → **Maintien**
- shadcn/ui → **Maintien**

**Infrastructure** :
- Vercel (Frontend) → **Maintien**
- Supabase (Backend) → **Maintien**
- **Ajout** : Redis (Upstash) pour cache/queue
- **Ajout** : Vector DB (Qdrant/Pinecone) pour AI embeddings

**External Dependencies** :
- OpenAI API (Whisper, GPT-4o) → **Maintien + Extension**
- TradingView Lightweight Charts → **Maintien**
- Recharts → **Maintien**

### 4.2 Integration Approach

#### Database Integration Strategy

- **Migration Progressive** : Ajout de TimescaleDB en parallèle de PostgreSQL existant
- **Schéma Extension** : Extension du schéma Prisma avec nouvelles tables (TimescaleDB géré séparément)
- **Data Migration** : Scripts de migration pour données existantes (trades, accounts)
- **Backward Compatibility** : Anciennes tables restent fonctionnelles pendant transition

#### API Integration Strategy

- **Versioning** : APIs existantes v1, nouvelles APIs v2
- **tRPC** : Migration progressive vers tRPC pour type-safety end-to-end
- **Rate Limiting** : Upstash Redis pour rate limiting distribué
- **WebSockets** : Supabase Realtime pour updates temps réel

#### Frontend Integration Strategy

- **Progressive Enhancement** : Nouvelles features ajoutées sans casser l'existant
- **Code Splitting** : Lazy loading des nouveaux modules (Market Replay, Backtesting, etc.)
- **State Management** : Extension Zustand + React Query existants
- **Routing** : Nouveaux routes Next.js App Router pour nouvelles pages

#### Testing Integration Strategy

- **Unit Tests** : Extension tests existants (Vitest)
- **Integration Tests** : Tests API avec Playwright
- **E2E Tests** : Tests critiques avec Playwright
- **Coverage** : Maintenir > 70% coverage

### 4.3 Code Organization and Standards

#### File Structure Approach

- **Pattern existant** : Suivre structure `src/app`, `src/components`, `src/lib`, `src/services`
- **Nouveaux modules** : `src/services/backtesting`, `src/services/replay`, `src/services/ai`
- **Shared components** : Extension `src/components/ui` (shadcn/ui)

#### Naming Conventions

- **Components** : PascalCase (ex: `MarketReplayViewer.tsx`)
- **Services** : camelCase (ex: `backtestingService.ts`)
- **Types** : PascalCase avec suffix Type/Interface (ex: `TradeType`, `ReplayConfig`)
- **Constants** : UPPER_SNAKE_CASE (ex: `MAX_REPLAY_SPEED`)

#### Coding Standards

- **TypeScript** : Strict mode, no `any`
- **ESLint** : Configuration existante + règles spécifiques
- **Prettier** : Formatage automatique
- **Imports** : Absolute imports avec `@/` alias

#### Documentation Standards

- **Code Comments** : JSDoc pour fonctions publiques
- **README** : Mise à jour avec nouvelles features
- **Architecture Docs** : `docs/architecture-trading-path-journal.md` maintenu à jour
- **API Docs** : OpenAPI/Swagger pour nouvelles APIs

### 4.4 Deployment and Operations

#### Build Process Integration

- **Next.js Build** : Build process existant maintenu
- **Type Checking** : `tsc --noEmit` dans CI
- **Linting** : ESLint dans CI
- **Testing** : Vitest + Playwright dans CI

#### Deployment Strategy

- **Vercel** : Déploiement automatique sur push main (Frontend)
- **Supabase** : Migrations via Prisma (Backend)
- **Staging** : Environnement staging pour tests
- **Rollback** : Capability de rollback via Vercel

#### Monitoring and Logging

- **Error Tracking** : Sentry (existant) → Extension
- **Performance** : Vercel Analytics (existant) → Extension
- **Logging** : Logtail/Axiom pour logs centralisés
- **Alerting** : Alerts Sentry + monitoring custom

#### Configuration Management

- **Environment Variables** : `.env` avec validation Zod
- **Secrets** : Vercel Secrets + Supabase Secrets
- **Feature Flags** : Système de feature flags pour rollouts progressifs

### 4.5 Risk Assessment and Mitigation

#### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **TimescaleDB migration complexe** | High | Medium | POC préalable, migration progressive, rollback plan |
| **Performance replay tick-by-tick** | High | Medium | Compression, CDN caching, lazy loading, Web Workers |
| **Coûts API OpenAI/LLM** | Medium | High | Caching agressif, rate limiting, batch processing |
| **Scalabilité 240+ brokers sync** | Medium | Medium | Workers parallélisés, rate limiting par broker, queue system |
| **Complexité UI multi-compte** | Medium | High | Virtual scrolling, lazy loading, UX testing précoce |

#### Integration Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Breaking changes APIs existantes** | High | Low | Versioning API, backward compatibility |
| **Migration données existantes** | High | Medium | Scripts de migration testés, backup avant migration |
| **Incompatibilité composants UI** | Low | Low | Tests de régression, design system cohérent |

#### Deployment Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Downtime pendant migration** | High | Low | Migration progressive, feature flags, rollback |
| **Performance dégradée post-déploiement** | Medium | Medium | Monitoring pré-déploiement, load testing |
| **Bugs critiques en production** | High | Low | Staging environment, tests E2E, feature flags |

#### Mitigation Strategies

1. **POC Early** : POC TimescaleDB + Replay avant développement complet
2. **Feature Flags** : Rollout progressif avec feature flags
3. **Monitoring** : Monitoring intensif post-déploiement
4. **Testing** : Tests exhaustifs (unit, integration, E2E)
5. **Documentation** : Documentation technique complète
6. **Communication** : Communication claire avec équipe sur risques

---

## 5. Epic and Story Structure

### 5.1 Epic Approach

**Décision** : **Multi-Epic Structure** avec 8 épics principaux + 1 epic pour pages publiques

**Rationale** :
- Portée très large (transformation majeure de la plateforme)
- Modules fonctionnels distincts (A-H) + Killer Features + Pages publiques
- Permet développement parallèle par équipes différentes
- Facilite le tracking et la priorisation
- Permet MVP progressif (Epic par Epic)

**Structure proposée** :

1. **Epic 1** : Infrastructure & Foundation (TimescaleDB, Redis, Vector DB)
2. **Epic 2** : Market Replay & Backtesting Infrastructure
3. **Epic 3** : Multi-Compte Illimité & Broker Sync 240+
4. **Epic 4** : AI & Intelligence (AI Feedback, Assistant, Tiltmeter)
5. **Epic 5** : Analytics Avancées (MFE/MAE, Exit Analysis, Risk Analysis)
6. **Epic 6** : Replay & Visualisation (Trade Replay, TTP Score, Drills)
7. **Epic 7** : Journalisation & Partage (Voice Notes, Playbooks Sharing, Tags)
8. **Epic 8** : Killer Features Inédites (Path Predictor, Collective Intelligence, Voice Coach)
9. **Epic 9** : Pages Publiques (Landing, Features, Pricing, etc.)

**Ordre de développement suggéré** :

1. Epic 1 (Foundation) → Prérequis pour tous les autres
2. Epic 3 (Multi-Compte/Broker) → Permet data collection
3. Epic 4 (AI) → Améliore expérience utilisateur rapidement
4. Epic 2 (Market Replay) → Complexe, nécessite foundation
5. Epic 5 (Analytics) → Utilise données collectées
6. Epic 6 (Replay/Visualisation) → Utilise infrastructure replay
7. Epic 7 (Journalisation/Partage) → Améliore engagement
8. Epic 8 (Killer Features) → Différenciation unique
9. Epic 9 (Pages Publiques) → Marketing & Acquisition

---

## 6. Epic Details

*(Cette section sera complétée avec les détails de chaque Epic - format détaillé avec Stories, Acceptance Criteria, etc. - à définir dans des documents séparés ou dans la suite de ce PRD)*

---

## 7. Success Metrics

### 7.1 Technical Metrics

- **Performance** : Page load < 2s, Replay 60fps, Backtesting < 1min pour 1000 trades
- **Reliability** : Uptime 99.9%, Error rate < 0.1%
- **Scalability** : Support 10k+ utilisateurs simultanés
- **Code Quality** : Test coverage > 70%, 0 critical bugs en production

### 7.2 Product Metrics

- **Feature Parity** : 100% des fonctionnalités Premium des 5 concurrents intégrées
- **User Satisfaction** : NPS > 50
- **Adoption** : 80% des utilisateurs actifs utilisent au moins 3 modules
- **Retention** : Retention Day 30 > 60%

### 7.3 Business Metrics

- **Conversion** : Free → Paid conversion > 15%
- **MRR Growth** : Croissance mensuelle > 20%
- **Churn** : Churn rate < 5% mensuel
- **Competitive** : Positionnement premium avec pricing compétitif

---

## 8. Timeline & Phases

*(À définir avec l'équipe selon priorités business et ressources)*

**Estimation Grossière** :
- **Phase 1 (Foundation)** : 2-3 mois (Epic 1)
- **Phase 2 (Core Features)** : 4-6 mois (Epic 2-4)
- **Phase 3 (Advanced Features)** : 4-6 mois (Epic 5-7)
- **Phase 4 (Differentiation)** : 3-4 mois (Epic 8)
- **Phase 5 (Public Pages)** : 2-3 mois (Epic 9)

**Total Estimé** : 15-22 mois (avec équipe dédiée)

---

## 9. Open Questions & Decisions Needed

1. **Priorisation** : Quelle Epic en premier après Foundation ?
2. **Ressources** : Taille équipe, compétences nécessaires ?
3. **Timeline** : Deadlines business à respecter ?
4. **Budget** : Budget pour APIs externes (OpenAI, Data Providers) ?
5. **MVP** : Quelles fonctionnalités pour MVP initial ?
6. **Pricing** : Pricing strategy pour plans (Free, Pro, Elite) ?

---

**Document Status** : Draft - À valider par équipe produit & technique  
**Next Steps** : Validation PRD → Définition détaillée des Epics → Roadmap détaillée
