# 🗺️ ROADMAP - Trading Path Journal

> **Vision** : Plateforme de journal de trading unifiée surpassant tous les concurrents  
> **Stratégie** : Build incrementally, validate early, scale progressively  
> **Status** : 🚧 Planning Phase

---

## 📋 Table des Matières

1. [Vue d'Ensemble](#1-vue-densemble)
2. [Phases & Priorités](#2-phases--priorités)
3. [Epics Détaillés](#3-epics-détaillés)
4. [Dépendances & Ordre de Développement](#4-dépendances--ordre-de-développement)
5. [Directives pour Développeurs](#5-directives-pour-développeurs)
6. [Métriques de Succès](#6-métriques-de-succès)
7. [Risques & Mitigations](#7-risques--mitigations)

---

## 1. Vue d'Ensemble

### 1.1 Objectif de la Roadmap

Cette roadmap définit le plan de développement de **Trading Path Journal**, transformation majeure de l'application actuelle en plateforme complète intégrant 100% des fonctionnalités Premium des 5 leaders du marché.

### 1.2 Principes Directeurs

- **Incremental Development** : Développement par phases avec validation continue
- **User Value First** : Prioriser les fonctionnalités à forte valeur utilisateur
- **Technical Foundation** : Construire les fondations solides avant les features avancées
- **API-First Approach** : Identifier et valider les APIs nécessaires dès le début
- **Research-Driven** : Recherches approfondies avant implémentation pour efficacité maximale
- **Early Validation** : POC et tests précoces pour valider l'approche technique

### 1.3 Scope & Limitations

**In Scope** :
- 8 Modules fonctionnels (A-H)
- 3 Killer Features inédites
- 7 Pages Publiques
- Infrastructure complète (TimescaleDB, Redis, Vector DB)
- Support 240+ brokers
- Multi-compte illimité

**Out of Scope** (pour cette roadmap initiale) :
- Features non identifiées dans le PRD
- Refonte complète de l'UI existante (extension progressive uniquement)
- Migration de l'infrastructure existante (Supabase reste)

---

## 2. Phases & Priorités

### Phase 0 : Foundation & Planning (2-3 semaines)

**Objectif** : Valider l'approche technique et préparer les fondations

**Priorité** : 🔴 CRITIQUE

**Activités** :
- POC TimescaleDB + Replay Engine
- POC Market Data Providers (validation APIs)
- POC AI Architecture (OpenAI, embeddings)
- Architecture détaillée (approbation technique)
- Setup infrastructure (TimescaleDB, Redis, Vector DB)
- Documentation technique initiale

**Délivrables** :
- POC validés avec métriques de performance
- Architecture technique approuvée
- Infrastructure provisionnée
- Plan de migration données existantes

**Critères de Succès** :
- POC Replay : 60fps pour périodes < 1 jour
- POC Backtesting : < 1 minute pour 1000 trades
- POC AI : Latence < 2s pour feedback
- Infrastructure : Monitoring et alerting opérationnels

---

### Phase 1 : Foundation & Core Infrastructure (2-3 mois)

**Objectif** : Construire les fondations techniques solides

**Priorité** : 🔴 CRITIQUE

**Epics** :
- Epic 1 : Infrastructure & Foundation

**Dépendances** : Phase 0 complétée

**Délivrables** :
- TimescaleDB opérationnel avec compression/retention policies
- Redis (Upstash) configuré avec BullMQ
- Vector DB (Qdrant/Pinecone) configuré
- Migration scripts pour données existantes
- Monitoring et alerting complets
- Documentation technique

**Risques** :
- Complexité migration TimescaleDB
- Coûts infrastructure
- Performance queries time-series

**Mitigation** :
- POC préalable (Phase 0)
- Tests de charge précoces
- Budget infrastructure validé

---

### Phase 2 : Core Features - Data & Connectivity (4-6 mois)

**Objectif** : Permettre la collecte de données (multi-compte, broker sync)

**Priorité** : 🟠 HAUTE

**Epics** :
- Epic 3 : Multi-Compte Illimité & Broker Sync 240+

**Dépendances** : Phase 1 complétée (Foundation)

**Délivrables** :
- Support comptes illimités avec optimisations UI (virtual scrolling, lazy loading)
- Architecture broker sync (abstraction multi-broker)
- Intégration 50+ brokers prioritaires (API + File Upload)
- UI gestion des connexions broker
- Scheduler de synchronisation automatique
- Import profiles (CSV mapping configurations)

**Risques** :
- Complexité UI multi-compte
- APIs brokers instables/incomplètes
- Rate limiting par broker

**Mitigation** :
- Research approfondie sur chaque broker avant implémentation
- Architecture robuste avec retry/backoff
- Tests avec comptes réels (staging)
- Notifications API requises (voir Section 5)

**Critères de Succès** :
- Support 100+ comptes par utilisateur sans dégradation performance
- Sync automatique 50+ brokers (taux succès > 95%)
- UI fluide même avec nombreux comptes

---

### Phase 3 : AI & Intelligence (3-4 mois)

**Objectif** : Intégrer l'IA pour feedback et coaching

**Priorité** : 🟠 HAUTE

**Epics** :
- Epic 4 : AI & Intelligence

**Dépendances** : Phase 2 complétée (données collectées)

**Délivrables** :
- AI Feedback : Analyse patterns négatifs avec suggestions
- AI Assistant : Coaching conversationnel avec contexte trading
- Tiltmeter : Détection automatique perte de discipline (ML)
- Efficiency Analysis : Comparaison entrée/sortie réelle vs théorique
- Emotional Journal : Journalisation avant/pendant/après trade
- Future Simulators : Projection compte dans X mois

**Risques** :
- Coûts API OpenAI/LLM
- Latence feedback AI
- Qualité résultats AI

**Mitigation** :
- Caching agressif des résultats AI
- Batch processing pour réduire coûts
- Fine-tuning LLM si nécessaire
- Validation résultats AI par utilisateurs

**Critères de Succès** :
- Latence AI Feedback < 2s (cached)
- Taux satisfaction utilisateurs AI > 70%
- Coûts API < budget alloué

---

### Phase 4 : Market Replay & Backtesting (4-6 mois)

**Objectif** : Infrastructure complète pour replay et backtesting tick-by-tick

**Priorité** : 🟡 MOYENNE-HAUTE

**Epics** :
- Epic 2 : Market Replay & Backtesting Infrastructure

**Dépendances** : Phase 1 complétée (TimescaleDB), Phase 2 (données brokers)

**Délivrables** :
- Infrastructure Market Replay (250ms tick precision)
- Trade Replay tick-by-tick bougie par bougie
- Backtesting Engine : Simulation stratégies sur données historiques
- Intégration sources données historiques (Barchart, IBKR, Intrinio, etc.)
- Drills Mode : Simulation pour reconnaître setups sans risque
- UI Replay : Contrôles play/pause, vitesse, période
- UI Backtesting : Configuration stratégie, résultats détaillés

**⚠️ IMPORTANT - APIs Requises** :
- **Barchart Market Replay API** : Point-in-time quote and trade data
- **Interactive Brokers (IBKR) API** : `reqHistoricalTicks` pour données historiques
- **Intrinio API** : Stock Prices Tick History API
- **CQG Data API** : Données historiques multi-assets
- **LSEG Tick History API** : Données historiques globales
- **TickData TickAPI®** : Historical intraday data
- **AllTick API** : Tick data real-time et historique
- **MarketTick API** : Historical tick data
- **FirstRate Data API** : Tick data bundle

**⚠️ NOTIFICATION IMMEDIATE REQUISE** : Dès qu'une API de data provider est identifiée, notifier immédiatement le Product Manager pour validation budget et approbation.

**Risques** :
- Coûts APIs data providers (peuvent être élevés)
- Performance replay tick-by-tick
- Stockage massif tick data

**Mitigation** :
- Research approfondie sur chaque provider (coûts, qualité, coverage)
- Compression/retention policies TimescaleDB
- CDN caching pour replay fréquents
- Validation budget avant intégration

**Critères de Succès** :
- Replay 60fps pour périodes < 1 jour
- Backtesting < 1 minute pour 1000 trades
- Coverage données historiques > 80% des assets populaires

---

### Phase 5 : Analytics Avancées (3-4 mois)

**Objectif** : Analytics avancées (MFE/MAE, Exit Analysis, Risk Analysis)

**Priorité** : 🟡 MOYENNE

**Epics** :
- Epic 5 : Analytics Avancées

**Dépendances** : Phase 2 complétée (données), Phase 4 (Market Replay pour MFE/MAE)

**Délivrables** :
- MFE/MAE Analysis : Maximum Favorable/Adverse Excursion par trade
- Exit Analysis : Comparaison sorties réelles vs optimales
- Risk Analysis : R-Multiple, risque par trade, volatilité portefeuille
- Liquidity Reports : Impact liquidité (gros volumes)
- UI Analytics : Visualisations détaillées, tableaux, graphiques

**Risques** :
- Complexité calculs MFE/MAE (nécessite tick data)
- Performance queries analytiques

**Mitigation** :
- Pré-calcul métriques en background
- Continuous aggregates TimescaleDB
- Indexes optimisés

**Critères de Succès** :
- Calcul MFE/MAE < 5s par trade
- Queries analytiques < 1s (p95)
- Visualisations fluides (60fps)

---

### Phase 6 : Replay & Visualisation (3-4 mois)

**Objectif** : Replay trades et visualisation avancée

**Priorité** : 🟡 MOYENNE

**Epics** :
- Epic 6 : Replay & Visualisation

**Dépendances** : Phase 4 complétée (Market Replay Infrastructure)

**Délivrables** :
- Trade Replay : Replay tick-by-tick bougie par bougie
- TTP Score : Trading Path Score (0-100) par trade (respect plan + exécution)
- Visualisations TradingView : Overlay entrées/sorties sur charts
- Integration Lightweight Charts : Synchronisation symbole/timeframe
- UI Trade Replay : Interface fluide avec contrôles avancés

**Risques** :
- Performance rendering charts avec beaucoup de données
- Complexité calcul TTP Score

**Mitigation** :
- Web Workers pour rendering asynchrone
- Lazy loading données charts
- Algorithme TTP Score validé avec utilisateurs

**Critères de Succès** :
- Trade Replay 60fps fluide
- Calcul TTP Score < 500ms
- UI Charts responsive (< 2s load)

---

### Phase 7 : Journalisation & Partage (2-3 mois)

**Objectif** : Améliorer journalisation et permettre partage

**Priorité** : 🟢 MOYENNE-BASSE

**Epics** :
- Epic 7 : Journalisation & Partage

**Dépendances** : Phase 3 complétée (AI pour Voice Notes), Phase 2 (données)

**Délivrables** :
- Voice Notes : Enregistrement vocal pour trades/journées (transcription Whisper + synthèse IA OpenAI)
- Playbooks Sharing : Partage playbooks (liens publics, embed)
- Tags améliorés : Tags assignables aux trades ET aux journées (déjà implémenté partiellement)
- WYSIWYG Editor : Éditeur amélioré pour notes quotidiennes
- Trade History Calendar : Vue calendrier avec recherche avancée
- UI Sharing : Interface partage avec permissions

**⚠️ IMPORTANT - APIs Requises** :
- **OpenAI Whisper API** : Transcription audio (déjà intégré partiellement)
- **OpenAI GPT-4o API** : Synthèse IA notes vocales (déjà intégré partiellement)

**⚠️ NOTIFICATION IMMEDIATE REQUISE** : Si nouvelles APIs OpenAI requises (ex: TTS, Voice API), notifier immédiatement le Product Manager.

**Risques** :
- Coûts API OpenAI (Whisper + GPT-4o)
- Qualité transcription/synthèse

**Mitigation** :
- Caching résultats transcription/synthèse
- Validation qualité avec utilisateurs
- Budget OpenAI validé

**Critères de Succès** :
- Transcription < 5s pour 1 minute audio
- Synthèse IA < 3s
- Partage playbooks fonctionnel (liens publics)

---

### Phase 8 : Killer Features Inédites (3-4 mois)

**Objectif** : Différenciation unique avec 3 features inédites

**Priorité** : 🟢 BASSE (post-MVP)

**Epics** :
- Epic 8 : Killer Features Inédites

**Dépendances** : Phase 3 complétée (AI), Phase 2 (données), Phase 5 (Analytics)

**Délivrables** :
- **Path Predictor** : LLM-powered simulation de chemins alternatifs de trades
- **Collective Intelligence Dashboard** : Benchmark anonyme avec peers similaires
- **Voice-First Trading Coach** : Coaching vocal temps réel pendant trading

**⚠️ IMPORTANT - APIs Requises** :
- **OpenAI GPT-4o fine-tuned** : Path Predictor (fine-tuning requis)
- **OpenAI Voice API** : Voice-First Trading Coach (si disponible)
- **ElevenLabs TTS API** : Text-to-Speech pour coaching vocal
- **Qdrant/Pinecone API** : Vector search pour Collective Intelligence

**⚠️ NOTIFICATION IMMEDIATE REQUISE** : Dès qu'une API pour Killer Features est identifiée, notifier immédiatement le Product Manager pour validation budget et approbation (ces features sont innovantes et peuvent nécessiter des APIs coûteuses).

**Risques** :
- Coûts APIs élevés (fine-tuning LLM, Voice API, TTS)
- Complexité implémentation (fine-tuning, federated learning)
- Performance temps réel (Voice Coach)

**Mitigation** :
- POC préalable pour valider approche
- Validation budget avant développement complet
- Research approfondie sur alternatives
- Tests utilisateurs précoces

**Critères de Succès** :
- Path Predictor : Génération 5-10 scénarios < 5s
- Collective Intelligence : Matching peers similaires < 2s
- Voice Coach : Latence coaching temps réel < 500ms

---

### Phase 9 : Pages Publiques (2-3 mois)

**Objectif** : Marketing & Acquisition (Landing, Features, Pricing, etc.)

**Priorité** : 🟡 MOYENNE (peut être en parallèle d'autres phases)

**Epics** :
- Epic 9 : Pages Publiques

**Dépendances** : Aucune dépendance technique (peut être développé en parallèle)

**Délivrables** :
- Landing Page : Hero, value proposition, social proof, CTA
- Features Page : Modules détaillés, comparison table, use cases
- Pricing Page : Plans (Free, Pro, Elite), pricing tiers, feature comparison
- Backtesting System Page : Description, capabilities, examples
- Trading Path AI Page : AI features, how it works, privacy
- Supported Brokers Page : Liste complète 240+ brokers, search/filter, integration status
- Resources/Academy Page : Trading Path Academy, blog, documentation, community

**⚠️ IMPORTANT - APIs Requises** :
- Aucune API externe requise (pages statiques/dynamiques uniquement)
- Si intégration tiers (ex: newsletter, analytics), notifier Product Manager

**Risques** :
- Maintenance liste brokers (240+)
- SEO et performance pages publiques

**Mitigation** :
- CMS pour contenu (si nécessaire)
- SEO optimization
- Performance optimization (CDN, lazy loading images)

**Critères de Succès** :
- Pages publiques load < 2s
- SEO score > 90 (Lighthouse)
- Conversion Landing → Signup > 5%

---

## 3. Epics Détaillés

*(Détails complets de chaque Epic seront dans des documents séparés - format Epic avec Stories, Acceptance Criteria, etc.)*

### Epic 1 : Infrastructure & Foundation
- **Status** : 🚧 Planning
- **Phase** : Phase 1 (Foundation)
- **Durée estimée** : 2-3 mois
- **Dépendances** : Phase 0 (POC)

### Epic 2 : Market Replay & Backtesting Infrastructure
- **Status** : 📋 Backlog
- **Phase** : Phase 4 (Market Replay)
- **Durée estimée** : 4-6 mois
- **Dépendances** : Epic 1 (Foundation)

### Epic 3 : Multi-Compte Illimité & Broker Sync 240+
- **Status** : 📋 Backlog
- **Phase** : Phase 2 (Core Features)
- **Durée estimée** : 4-6 mois
- **Dépendances** : Epic 1 (Foundation)

### Epic 4 : AI & Intelligence
- **Status** : 📋 Backlog
- **Phase** : Phase 3 (AI)
- **Durée estimée** : 3-4 mois
- **Dépendances** : Epic 3 (Données collectées)

### Epic 5 : Analytics Avancées
- **Status** : 📋 Backlog
- **Phase** : Phase 5 (Analytics)
- **Durée estimée** : 3-4 mois
- **Dépendances** : Epic 3 (Données), Epic 2 (Market Replay pour MFE/MAE)

### Epic 6 : Replay & Visualisation
- **Status** : 📋 Backlog
- **Phase** : Phase 6 (Replay/Visualisation)
- **Durée estimée** : 3-4 mois
- **Dépendances** : Epic 2 (Market Replay Infrastructure)

### Epic 7 : Journalisation & Partage
- **Status** : 📋 Backlog
- **Phase** : Phase 7 (Journalisation)
- **Durée estimée** : 2-3 mois
- **Dépendances** : Epic 4 (AI), Epic 3 (Données)

### Epic 8 : Killer Features Inédites
- **Status** : 📋 Backlog
- **Phase** : Phase 8 (Killer Features)
- **Durée estimée** : 3-4 mois
- **Dépendances** : Epic 4 (AI), Epic 3 (Données), Epic 5 (Analytics)

### Epic 9 : Pages Publiques
- **Status** : 📋 Backlog
- **Phase** : Phase 9 (Pages Publiques)
- **Durée estimée** : 2-3 mois
- **Dépendances** : Aucune (peut être en parallèle)

---

## 4. Dépendances & Ordre de Développement

### 4.1 Graphique de Dépendances

```
Phase 0: Foundation & Planning (POC)
    │
    ├─→ Phase 1: Infrastructure & Foundation (Epic 1)
    │       │
    │       ├─→ Phase 2: Core Features - Data & Connectivity (Epic 3)
    │       │       │
    │       │       ├─→ Phase 3: AI & Intelligence (Epic 4)
    │       │       │       │
    │       │       │       ├─→ Phase 7: Journalisation & Partage (Epic 7)
    │       │       │       └─→ Phase 8: Killer Features (Epic 8)
    │       │       │
    │       │       └─→ Phase 5: Analytics Avancées (Epic 5)
    │       │               │
    │       │               └─→ Phase 8: Killer Features (Epic 8)
    │       │
    │       └─→ Phase 4: Market Replay & Backtesting (Epic 2)
    │               │
    │               ├─→ Phase 5: Analytics Avancées (Epic 5)
    │               └─→ Phase 6: Replay & Visualisation (Epic 6)
    │
    └─→ Phase 9: Pages Publiques (Epic 9) [Parallèle possible]
```

### 4.2 Ordre de Développement Recommandé

1. **Phase 0** : Foundation & Planning (POC) - **2-3 semaines**
2. **Phase 1** : Infrastructure & Foundation - **2-3 mois**
3. **Phase 2** : Core Features - Data & Connectivity - **4-6 mois** (en parallèle partiel avec Phase 1 fin)
4. **Phase 3** : AI & Intelligence - **3-4 mois** (en parallèle partiel avec Phase 2 fin)
5. **Phase 4** : Market Replay & Backtesting - **4-6 mois** (en parallèle avec Phase 3)
6. **Phase 5** : Analytics Avancées - **3-4 mois** (après Phase 4)
7. **Phase 6** : Replay & Visualisation - **3-4 mois** (après Phase 4)
8. **Phase 7** : Journalisation & Partage - **2-3 mois** (après Phase 3)
9. **Phase 8** : Killer Features Inédites - **3-4 mois** (après Phase 3, 5)
10. **Phase 9** : Pages Publiques - **2-3 mois** (peut être en parallèle dès Phase 2)

**Total Estimé** : 15-22 mois (avec équipe dédiée)

### 4.3 Chemin Critique

Le chemin critique (minimum pour MVP) :

1. Phase 0 (POC) → 2. Phase 1 (Foundation) → 3. Phase 2 (Core Features) → 4. Phase 3 (AI) → 5. Phase 4 (Market Replay)

**MVP Estimé** : 12-16 mois

---

## 5. Directives pour Développeurs

### 5.1 ⚠️ NOTIFICATION IMMEDIATE - APIs Externes

**RÈGLE CRITIQUE** : Dès qu'une fonction nécessite une API externe (qu'elle soit payante ou gratuite), le développeur DOIT notifier immédiatement le Product Manager AVANT toute implémentation.

**Processus** :
1. **Identifier** : Développeur identifie besoin d'API externe
2. **Documenter** : Documenter l'API (nom, provider, coûts estimés, documentation)
3. **Notifier** : Notifier immédiatement le Product Manager (email, Slack, ticket)
4. **Attendre Validation** : Attendre validation budget et approbation avant implémentation
5. **Implémenter** : Une fois validé, procéder à l'implémentation

**APIs concernées** :
- APIs de data providers (Barchart, IBKR, Intrinio, CQG, LSEG, TickData, etc.)
- APIs AI (OpenAI, Anthropic, etc.) - nouvelles APIs ou extensions
- APIs brokers (nouvelles intégrations)
- APIs tierces (TTS, Voice, etc.)

**Format de notification** :
```
API Required Notification:
- Feature: [Nom de la feature]
- Epic: [Epic concerné]
- API Provider: [Nom du provider]
- API Name: [Nom de l'API]
- Documentation: [URL documentation]
- Estimated Costs: [Coûts estimés/mois]
- Alternatives Considered: [Alternatives envisagées]
- Justification: [Pourquoi cette API est nécessaire]
```

### 5.2 🔍 Research Obligatoire - Brokers & Implémentations

**RÈGLE OBLIGATOIRE** : Avant toute implémentation de fonctionnalité liée aux brokers ou implémentations techniques, le développeur DOIT effectuer des recherches approfondies pour garantir l'efficacité maximale.

**Research Required** :

#### A. Pour chaque Broker (avant intégration) :

1. **Documentation Officielle** :
   - Documentation API complète
   - Rate limits et quotas
   - Authentification (OAuth, API keys, tokens)
   - Endpoints disponibles
   - Format données (JSON, XML, CSV)
   - Webhooks/Real-time support

2. **Communauté & Alternatives** :
   - Recherche GitHub (librairies existantes)
   - Stack Overflow (problèmes courants, solutions)
   - Forums communautaires (retours utilisateurs)
   - Libraries officielles/officieuses

3. **Limitations & Contraintes** :
   - Rate limits stricts
   - Coûts (si API payante)
   - Limitations fonctionnelles
   - Problèmes connus/bugs
   - SLA/disponibilité

4. **Alternatives** :
   - File Upload fallback (CSV, Excel)
   - Autres APIs du même broker
   - Autres brokers avec mêmes données

5. **Best Practices** :
   - Patterns d'intégration recommandés
   - Gestion erreurs
   - Retry/backoff strategies
   - Caching strategies

#### B. Pour chaque Implémentation Technique :

1. **Architecture** :
   - Design patterns recommandés
   - Libraries/frameworks existants
   - Approches alternatives
   - Trade-offs entre approches

2. **Performance** :
   - Benchmarks existants
   - Optimisations connues
   - Bottlenecks potentiels
   - Solutions de scaling

3. **Maintenance** :
   - Complexité long-terme
   - Dette technique potentielle
   - Solutions maintenables vs quick wins

**Format de Research** :

Le développeur DOIT documenter sa research dans un document ou ticket avant implémentation :

```
Research Document: [Feature/Broker Name]
- Date: [Date]
- Developer: [Nom]
- Epic: [Epic concerné]

1. Documentation Sources:
   - [Liste sources consultées]

2. Findings:
   - [Découvertes clés]
   - [Limitations identifiées]
   - [Problèmes potentiels]

3. Recommended Approach:
   - [Approche recommandée]
   - [Justification]
   - [Alternatives considérées]

4. APIs Required:
   - [Liste APIs nécessaires]
   - [Coûts estimés]

5. Risks & Mitigations:
   - [Risques identifiés]
   - [Mitigations proposées]
```

### 5.3 Checklist Pré-Implémentation

Avant de commencer une implémentation, le développeur DOIT :

- [ ] Effectuer research approfondie (Section 5.2)
- [ ] Identifier toutes les APIs externes nécessaires
- [ ] Notifier Product Manager pour APIs (Section 5.1)
- [ ] Documenter approche recommandée
- [ ] Valider approche avec équipe technique
- [ ] Créer ticket/story avec détails techniques
- [ ] Estimer temps et risques

### 5.4 Standards de Code & Documentation

- **Code Quality** : TypeScript strict, ESLint, Prettier
- **Tests** : Unit tests (Vitest) + Integration tests (Playwright)
- **Documentation** : JSDoc pour fonctions publiques
- **Commits** : Conventional commits (feat, fix, docs, etc.)
- **PRs** : Description claire avec contexte, risques, tests

---

## 6. Métriques de Succès

### 6.1 Métriques Techniques (par Phase)

| Phase | Métrique | Cible | Status |
|-------|----------|-------|--------|
| Phase 0 | POC Replay Performance | 60fps | ⏳ Pending |
| Phase 0 | POC Backtesting Performance | < 1min pour 1000 trades | ⏳ Pending |
| Phase 0 | POC AI Latency | < 2s | ⏳ Pending |
| Phase 1 | Infrastructure Uptime | 99.9% | ⏳ Pending |
| Phase 2 | Support Comptes | 100+ sans dégradation | ⏳ Pending |
| Phase 2 | Broker Sync Success Rate | > 95% | ⏳ Pending |
| Phase 3 | AI Feedback Latency | < 2s (cached) | ⏳ Pending |
| Phase 4 | Replay Performance | 60fps | ⏳ Pending |
| Phase 4 | Backtesting Performance | < 1min pour 1000 trades | ⏳ Pending |
| Phase 5 | Analytics Queries | < 1s (p95) | ⏳ Pending |
| Phase 6 | Trade Replay Performance | 60fps | ⏳ Pending |
| Phase 7 | Transcription Latency | < 5s pour 1min audio | ⏳ Pending |
| Phase 8 | Path Predictor Latency | < 5s | ⏳ Pending |
| Phase 9 | Pages Publiques Load | < 2s | ⏳ Pending |

### 6.2 Métriques Produit

- **Feature Parity** : 100% des fonctionnalités Premium des 5 concurrents intégrées
- **User Satisfaction** : NPS > 50
- **Adoption** : 80% des utilisateurs actifs utilisent au moins 3 modules
- **Retention** : Retention Day 30 > 60%

### 6.3 Métriques Business

- **Conversion** : Free → Paid conversion > 15%
- **MRR Growth** : Croissance mensuelle > 20%
- **Churn** : Churn rate < 5% mensuel
- **Competitive** : Positionnement premium avec pricing compétitif

---

## 7. Risques & Mitigations

### 7.1 Risques Techniques

| Risque | Impact | Probabilité | Mitigation | Status |
|--------|--------|-------------|------------|--------|
| Complexité TimescaleDB | High | Medium | POC préalable (Phase 0) | ⏳ Pending |
| Performance Replay | High | Medium | Compression, CDN caching | ⏳ Pending |
| Coûts APIs OpenAI | Medium | High | Caching agressif, batch processing | ⏳ Pending |
| Scalabilité 240+ brokers | Medium | Medium | Workers parallélisés, rate limiting | ⏳ Pending |
| Complexité UI multi-compte | Medium | High | Virtual scrolling, UX testing précoce | ⏳ Pending |

### 7.2 Risques Business

| Risque | Impact | Probabilité | Mitigation | Status |
|--------|--------|-------------|------------|--------|
| Coûts APIs Data Providers | High | Medium | Research approfondie, validation budget | ⏳ Pending |
| Timeline dépassée | Medium | Medium | Roadmap réaliste, buffer temps | ⏳ Pending |
| Complexité sous-estimée | High | Medium | POC précoces, validation continue | ⏳ Pending |

### 7.3 Risques Produit

| Risque | Impact | Probabilité | Mitigation | Status |
|--------|--------|-------------|------------|--------|
| UX trop complexe | Medium | Medium | Tests utilisateurs précoces, itérations | ⏳ Pending |
| Features non utilisées | Low | Medium | Analytics usage, prioritisation user value | ⏳ Pending |

---

## 8. Timeline Global

### 8.1 Vue d'Ensemble

```
Q1 2026: Phase 0 (POC) + Phase 1 (Foundation)
Q2-Q3 2026: Phase 2 (Core Features) + Phase 3 (AI) [parallèle partiel]
Q4 2026 - Q1 2027: Phase 4 (Market Replay) + Phase 5 (Analytics)
Q2 2027: Phase 6 (Replay/Visualisation) + Phase 7 (Journalisation)
Q3 2027: Phase 8 (Killer Features)
Q4 2027: Phase 9 (Pages Publiques) + Polish & Launch
```

### 8.2 Milestones Clés

| Milestone | Date Estimée | Status |
|-----------|--------------|--------|
| Phase 0 POC Validés | Q1 2026 | ⏳ Pending |
| Foundation Complete | Q1 2026 | ⏳ Pending |
| Multi-Compte & Broker Sync (50+ brokers) | Q3 2026 | ⏳ Pending |
| AI & Intelligence Complete | Q3 2026 | ⏳ Pending |
| Market Replay & Backtesting Complete | Q1 2027 | ⏳ Pending |
| Analytics Avancées Complete | Q2 2027 | ⏳ Pending |
| MVP Complete (Phases 1-4) | Q2 2027 | ⏳ Pending |
| Full Platform Complete | Q4 2027 | ⏳ Pending |

---

## 9. Prochaines Étapes

1. **Validation Roadmap** : Review avec équipe produit & technique
2. **Priorisation** : Affiner priorités selon contraintes business
3. **Budget** : Valider budget APIs externes
4. **Ressources** : Définir taille équipe, compétences nécessaires
5. **Phase 0** : Démarrer POC (TimescaleDB, Replay, AI)
6. **Epics Détaillés** : Créer documents détaillés pour chaque Epic (Stories, Acceptance Criteria)

---

**Document Status** : Draft - À valider par équipe produit & technique  
**Last Updated** : 2026-01-XX  
**Next Review** : Après validation roadmap
