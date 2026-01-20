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
- **🤖 Préférence Google Gemini** : Préférer l'API Google Gemini pour les besoins d'IA lorsque c'est possible (au lieu d'OpenAI)

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
- POC AI Architecture (Google Gemini API préféré, embeddings)
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
- Coûts API Google Gemini/LLM
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
- Voice Notes : Enregistrement vocal pour trades/journées (transcription Whisper + synthèse IA Google Gemini API préféré)
- Playbooks Sharing : Partage playbooks (liens publics, embed)
- Tags améliorés : Tags assignables aux trades ET aux journées (déjà implémenté partiellement)
- WYSIWYG Editor : Éditeur amélioré pour notes quotidiennes
- Trade History Calendar : Vue calendrier avec recherche avancée
- UI Sharing : Interface partage avec permissions

**⚠️ IMPORTANT - APIs Requises** :
- **OpenAI Whisper API** : Transcription audio (déjà intégré partiellement) - Note: Google Gemini n'a pas d'API de transcription audio, donc OpenAI Whisper reste pour la transcription
- **Google Gemini API** : Synthèse IA notes vocales (préféré à OpenAI GPT-4o) - ou OpenAI GPT-4o en fallback si Gemini n'est pas adapté

**⚠️ NOTIFICATION IMMEDIATE REQUISE** : Si nouvelles APIs AI requises (ex: TTS, Voice API), notifier immédiatement le Product Manager.

**Risques** :
- Coûts API OpenAI Whisper + Google Gemini (ou fallback OpenAI GPT-4o)
- Qualité transcription/synthèse

**Mitigation** :
- Caching résultats transcription/synthèse
- Validation qualité avec utilisateurs
- Budget APIs validé

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
- **Google Gemini API (fine-tuned si possible)** : Path Predictor (préféré à OpenAI GPT-4o fine-tuned, ou OpenAI GPT-4o fine-tuned en fallback si Gemini fine-tuning n'est pas disponible)
- **Google Gemini Voice API (si disponible)** : Voice-First Trading Coach (préféré) - ou OpenAI Voice API en fallback
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
- Landing Page : Hero, value proposition, social proof, CTA, **"Join Discord" button (emphasize "Free")**
- Features Page : Modules détaillés, comparison table, use cases
- Pricing Page : Plans (Free, Pro, Elite), pricing tiers, feature comparison
- Backtesting System Page : Description, capabilities, examples
- Trading Path AI Page : AI features, how it works, privacy
- Supported Brokers Page : Liste complète 240+ brokers, search/filter, integration status
- Resources/Academy Page : Trading Path Academy, blog, documentation, community
- **SEO Advanced Optimization** :
  - **Sitemap XML dynamique** : Génération automatique sitemap avec toutes les pages publiques
  - **Robots.txt optimisé** : Configuration correcte pour crawlers avec sitemap reference
  - **Structured Data (Schema.org)** : JSON-LD pour Organization, SoftwareApplication, WebSite, Article (blog)
  - **Meta Tags avancés** : Open Graph, Twitter Cards, meta descriptions optimisées
  - **Canonical URLs** : Gestion des URLs canoniques pour éviter contenu dupliqué
  - **URL Structure optimisée** : URLs SEO-friendly, breadcrumbs, navigation hiérarchique
  - **Content Optimization** : Headings optimisés (H1-H6), alt texts images, internal linking
  - **Performance SEO** : Core Web Vitals, lazy loading, code splitting, compression
  - **International SEO** : Hreflang tags pour FR/EN/ES/PT, sitemaps multi-langues
  - **Blog SEO** : Categories, tags, related posts, RSS feed, archive pages
  - **Local SEO** (si applicable) : Structured data LocalBusiness, Google Business Profile
  - **Support Multi-Langues Étendu** :
    - **Traduction Espagnol (ES)** : Traduction complète de l'application (messages, pages publiques, UI)
    - **Traduction Portugais (PT)** : Traduction complète de l'application (messages, pages publiques, UI)
    - **Fichiers de traduction** : Extension `messages/es.json` et `messages/pt.json`
    - **Configuration i18n** : Mise à jour `i18n.ts` et `src/i18n/config.ts` pour supporter ES/PT
    - **Language Switcher** : Ajout ES/PT dans le sélecteur de langue (UI)
    - **Middleware i18n** : Support routing multi-langues avec préfixes ES/PT
    - **SEO multi-langues** : Hreflang tags pour toutes les langues (EN/FR/ES/PT)
    - **Sitemaps multi-langues** : Génération sitemaps séparés par langue
    - **Pages publiques traduites** : Landing, Features, Pricing, etc. en ES/PT

**⚠️ IMPORTANT - APIs Requises** :
- Aucune API externe requise (pages statiques/dynamiques uniquement)
- Si intégration tiers (ex: newsletter, analytics, Google Search Console API), notifier Product Manager

**Risques** :
- Maintenance liste brokers (240+)
- SEO et performance pages publiques
- Complexité optimisation SEO avancée (structured data, sitemaps dynamiques)
- Complexité maintenance traductions (4 langues : EN/FR/ES/PT)
- Cohérence terminologie trading entre langues

**Mitigation** :
- CMS pour contenu (si nécessaire)
- SEO optimization avancée avec tests réguliers (Google Search Console, Lighthouse)
- Performance optimization (CDN, lazy loading images)
- Documentation SEO complète pour maintenance continue
- Glossaire terminologie trading unifié (toutes langues)
- Process de traduction avec validation native speakers
- Tests réguliers cohérence traductions (outils i18n linting)

**Critères de Succès** :
- Pages publiques load < 2s
- SEO score > 90 (Lighthouse)
- Conversion Landing → Signup > 5%
- **SEO Advanced Metrics** :
  - Structured Data validés (Google Rich Results Test)
  - Sitemap XML accessible et à jour
  - Core Web Vitals : LCP < 2.5s, FID < 100ms, CLS < 0.1
  - Mobile-friendly (Mobile-Friendly Test)
  - Indexation > 80% des pages publiques (Google Search Console)
  - Impressions organiques croissance > 20% après 3 mois
  - **Multi-Langues Metrics** :
    - Traduction complète 4 langues (EN/FR/ES/PT) : 100% des clés traduites
    - Pages publiques traduites : Landing, Features, Pricing en ES/PT
    - Hreflang tags fonctionnels pour toutes les langues
    - Sitemaps multi-langues générés et indexés

---

### Phase 10 : Community & Engagement (2-3 mois)

**Objectif** : Engager la communauté et permettre feedback utilisateurs

**Priorité** : 🟡 MOYENNE-HAUTE

**Epics** :
- Epic 10 : Beta & Voting System
- Epic 11 : Advanced Admin & User Management

**Dépendances** : Phase 1 (Foundation), Phase 9 (Pages Publiques - Landing)

**Délivrables** :
- Beta Voting Page : Interface utilisateur pour voter sur features (nouvelle page sidebar entre "Account" et "Settings")
- Roadmap Visualization : Affichage roadmap avec statuts (🟠 Upcoming=Orange, 🟢 Completed=Green, 🔵 In Progress=Blue)
- Admin Votes Management : CRUD options de vote, résultats, toggle status (nouvel onglet "Votes" dans Admin Dashboard)
- Admin User Management : Gestion avancée utilisateurs (extend/modify/suspend subscriptions, promotion Admin)
- **Admin User Detail Page** : Page dédiée pour chaque utilisateur accessible depuis l'admin dashboard, affichant :
  - **1. Espace de stockage utilisé** : Taille totale fichiers uploadés (screenshots, audio, etc.) par type de fichier, évolution dans le temps, limite/quota utilisateur
  - **2. Fonctionnalités utilisées + fréquence** : Analytics d'utilisation des features (dashboard, journal, calendar, statistics, import, etc.) avec fréquence d'utilisation (visites/jour, temps passé, dernières utilisations), tendances d'utilisation dans le temps
  - **3. Dépenses estimées en APIs** : Coûts estimés par API utilisée (Google Gemini/OpenAI, Whisper, market data providers, etc.), répartition des coûts par feature, coûts totaux mensuels/an, projections futures
  - **4. Informations relatives au compte** :
    - Informations profil (email, Discord, date inscription, dernière connexion)
    - Abonnement actuel (plan, statut, date début/fin, renouvellement auto)
    - Statistiques trading (nombre trades, comptes, PnL total, meilleur/pire trade)
    - Activité récente (derniers imports, dernières notes journal, derniers playbooks créés)
    - Historique actions admin (blocage/déblocage, modifications abonnement, promotions)
- Email Notifications : Notifications automatiques lors modifications admin avec commentaire personnalisé
- Landing Page Update : Ajout bouton "Join Discord" (emphasize "Free") sur landing page temporaire

**⚠️ IMPORTANT - APIs Requises** :
- **Resend/SendGrid API** : Envoi emails notifications (déjà intégré partiellement)
- **Stripe API** : `subscriptions.update` pour modifications abonnements

**⚠️ NOTIFICATION IMMEDIATE REQUISE** : Si nouvelles APIs email ou Stripe nécessaires, notifier immédiatement le Product Manager.

**Risques** :
- Complexité système de vote (spam, manipulation)
- Gestion permissions admin (sécurité)
- Performance calculs stockage/analytics pour nombreux utilisateurs
- Précision estimation coûts APIs (nécessite tracking détaillé)

**Mitigation** :
- Rate limiting sur votes (1 vote par utilisateur par option)
- Validation permissions stricte
- Audit logs pour actions admin
- Caching calculs stockage/analytics (refresh périodique)
- Tracking détaillé utilisation APIs pour estimations précises
- Indexes optimisés pour queries analytics utilisateurs

**Critères de Succès** :
- Système de vote fonctionnel (1 vote par utilisateur par option)
- Roadmap visualization < 1s load
- Admin actions < 2s (extend/modify subscriptions)
- **Admin User Detail Page Metrics** :
  - Page dédiée utilisateur accessible depuis admin dashboard
  - Calcul stockage < 1s (cached si nécessaire)
  - Analytics fonctionnalités avec données réelles
  - Estimation coûts APIs < 500ms
  - Informations compte complètes et à jour

---

### Phase 11 : AI Daily Bias Analysis (3-4 mois)

**Objectif** : Analyse de biais quotidien par instrument avec AI

**Priorité** : 🟠 HAUTE

**Epics** :
- Epic 12 : AI Daily Bias Analysis

**Dépendances** : Phase 3 (AI & Intelligence), Phase 2 (Data Collection)

**Délivrables** :
- Daily Bias Page : Interface sélection instrument + analyse
- 6-Step Analysis Engine : Security, Macro, Institutional Flux, Mag 7 Leaders, Technical Structure, Synthesis
- Real-Time Data Integration : ForexFactory, TradingView, Barchart, **FinancialJuice** (ou injection manuelle)
- FinancialJuice Verification : Vérification supplémentaire des données et analyses via consultation du site FinancialJuice
- Bias Report : Rapport structuré + Final Bias (Bullish/Bearish/Neutral) + Opening Confirmation
- Rate Limiting : 1 requête/jour par utilisateur (unlimited pour admins)
- Instrument Support : 21 instruments pré-définis (NQ1, ES1, TSLA, NVDA, SPY, TQQQ, AMD, AAPL, XAU/USD, PLTR, SOXL, AMZN, MSTR, EUR/USD, QQQ, MSFT, COIN, BTC, META, GME, SQQQ, MARA)

**⚠️ IMPORTANT - APIs Requises** :
- **Google Gemini API** : Analyse 6-step avec contexte (préféré à OpenAI GPT-4o, ou OpenAI GPT-4o en fallback si Gemini n'est pas adapté)
- **ForexFactory API** : Données macro économiques (ou scraping)
- **TradingView API** : Données techniques (ou scraping)
- **Barchart API** : Données market (ou alternative)
- **FinancialJuice** : Consultation/API pour vérification supplémentaire des données et analyses (ou scraping)
- **Alternative** : Injection manuelle données par utilisateur

**⚠️ NOTIFICATION IMMEDIATE REQUISE** : Dès qu'une API externe est identifiée (ForexFactory, TradingView, Barchart, FinancialJuice), notifier immédiatement le Product Manager pour validation budget et approbation.

**Vérification FinancialJuice** :
- **Objectif** : Ajouter une couche de vérification supplémentaire pour valider les données et analyses
- **Méthode** : Consultation du site FinancialJuice (via API si disponible, sinon scraping) pour :
  - Vérifier la cohérence des données macro économiques
  - Confirmer les flux institutionnels identifiés
  - Valider les tendances techniques détectées
  - Cross-reference avec les données de l'analyse 6-step
- **Intégration** : La vérification FinancialJuice doit être incluse dans le rapport final avec une section dédiée indiquant les confirmations/écarts identifiés

**Risques** :
- Coûts APIs données externes
- Latence analyse 6-step (peut être longue)
- Qualité données externes (scraping vs API)
- Disponibilité FinancialJuice (API ou scraping)

**Mitigation** :
- POC avec données simulées d'abord
- Caching résultats analyse (même jour = même résultat)
- Fallback injection manuelle si APIs indisponibles
- Validation budget avant intégration APIs
- Research approfondie sur FinancialJuice (API vs scraping)

**Critères de Succès** :
- Analyse 6-step complète < 30s
- Vérification FinancialJuice intégrée dans le rapport
- Rate limiting fonctionnel (1/jour utilisateur)
- Rapport structuré avec Final Bias + Opening Confirmation + Section FinancialJuice

---

### Phase 12 : Future Roadmap Features (Q3-Q4 2027)

**Objectif** : Features avancées pour différenciation et engagement

**Priorité** : 🟢 BASSE (post-MVP)

**Epics** :
- Epic 13 : Benchmarks & Peer Comparison
- Epic 14 : Video AI Analysis
- Epic 15 : Social Feed & Sharing
- Epic 16 : Mobile App Companion
- Epic 17 : Gamification & Challenges

**Dépendances** : Phase 3 (AI), Phase 5 (Analytics), Phase 8 (Killer Features)

**Délivrables** :
- **Benchmarks** : Comparaison performance avec traders anonymisés
- **Video AI** : Analyse vidéos uploadées pour conseils trading
- **Social Feed** : Partage meilleurs trades/stratégies
- **Mobile App** : Application mobile companion (iOS/Android)
- **Gamification** : Challenges trading avec récompenses

**⚠️ IMPORTANT - APIs Requises** :
- **Google Gemini Vision API** : Analyse vidéos (préféré à OpenAI Vision API, ou OpenAI Vision API en fallback si Gemini Vision n'est pas adapté)
- **Mobile Push Notifications** : Firebase/APNs
- **Social Media APIs** : Partage (Twitter, LinkedIn) - optionnel

**⚠️ NOTIFICATION IMMEDIATE REQUISE** : Dès qu'une API pour ces features est identifiée, notifier immédiatement le Product Manager.

**Risques** :
- Complexité mobile app (iOS + Android)
- Coûts APIs vidéo AI
- Maintenance social feed

**Critères de Succès** :
- Benchmarks : Matching peers similaires < 2s
- Video AI : Analyse vidéo < 1min
- Social Feed : Partage fonctionnel
- Mobile App : Performance native
- Gamification : Challenges avec rewards

---

## 3. Roadmap Visualization Structure

Pour supporter la visualisation de la roadmap (Feature 1 - Beta & Voting System), la roadmap DOIT utiliser cette structure markdown :

```markdown
### Feature Name
- **Status**: 🟠 Upcoming | 🟢 Completed | 🔵 In Progress
- **Priority**: 🔴 CRITIQUE | 🟠 HAUTE | 🟡 MOYENNE | 🟢 BASSE
- **Epic**: Epic X
- **Phase**: Phase Y
```

**Mapping Status → Color** :
- 🟠 Upcoming → Orange (affiché en orange dans l'UI)
- 🟢 Completed → Green (affiché en vert dans l'UI)
- 🔵 In Progress → Blue (affiché en bleu dans l'UI)

**Note** : Le composant de visualisation (`src/components/beta/roadmap-visualization.tsx`) parse cette structure markdown et applique les couleurs correspondantes.

---

## 4. Epics Détaillés

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

### Epic 9 : Pages Publiques & SEO Advanced Optimization
- **Status** : 📋 Backlog
- **Phase** : Phase 9 (Pages Publiques)
- **Durée estimée** : 2-3 mois
- **Dépendances** : Aucune (peut être en parallèle)
- **Note Spécifique** : Inclut optimisation SEO avancée (sitemap, structured data, meta tags, Core Web Vitals)

### Epic 10 : Beta & Voting System
- **Status** : 📋 Backlog
- **Phase** : Phase 10 (Community & Engagement)
- **Durée estimée** : 2-3 mois
- **Dépendances** : Phase 1 (Foundation), Phase 9 (Landing)

### Epic 11 : Advanced Admin & User Management
- **Status** : 📋 Backlog
- **Phase** : Phase 10 (Community & Engagement)
- **Durée estimée** : 1-2 mois
- **Dépendances** : Phase 1 (Foundation), Admin Dashboard existant
- **Note Spécifique** : Inclut page dédiée utilisateur admin avec : stockage utilisé, fonctionnalités utilisées + fréquence, dépenses APIs estimées, informations compte complètes

### Epic 12 : AI Daily Bias Analysis
- **Status** : 📋 Backlog
- **Phase** : Phase 11 (AI Daily Bias)
- **Durée estimée** : 3-4 mois
- **Dépendances** : Phase 3 (AI), Phase 2 (Data)
- **Note Spécifique** : Inclut vérification supplémentaire via FinancialJuice

### Epic 13 : Benchmarks & Peer Comparison
- **Status** : 📋 Backlog
- **Phase** : Phase 12 (Future Features)
- **Durée estimée** : 2-3 mois
- **Dépendances** : Phase 3 (AI), Phase 5 (Analytics)

### Epic 14 : Video AI Analysis
- **Status** : 📋 Backlog
- **Phase** : Phase 12 (Future Features)
- **Durée estimée** : 3-4 mois
- **Dépendances** : Phase 3 (AI)

### Epic 15 : Social Feed & Sharing
- **Status** : 📋 Backlog
- **Phase** : Phase 12 (Future Features)
- **Durée estimée** : 2-3 mois
- **Dépendances** : Phase 7 (Journalisation & Partage)

### Epic 16 : Mobile App Companion
- **Status** : 📋 Backlog
- **Phase** : Phase 12 (Future Features)
- **Durée estimée** : 4-6 mois
- **Dépendances** : Phase 2 (Core Features)

### Epic 17 : Gamification & Challenges
- **Status** : 📋 Backlog
- **Phase** : Phase 12 (Future Features)
- **Durée estimée** : 2-3 mois
- **Dépendances** : Phase 3 (AI), Phase 5 (Analytics)

---

## 5. Dépendances & Ordre de Développement

### 5.1 Graphique de Dépendances

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
            │
            └─→ Phase 10: Community & Engagement (Epic 10, Epic 11)
                    │
                    └─→ Phase 11: AI Daily Bias Analysis (Epic 12)
                            │
                            └─→ Phase 12: Future Features (Epic 13-17)
```

### 5.2 Ordre de Développement Recommandé

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
11. **Phase 10** : Community & Engagement - **2-3 mois** (après Phase 1, 9)
12. **Phase 11** : AI Daily Bias Analysis - **3-4 mois** (après Phase 3, 2)
13. **Phase 12** : Future Features - **Q3-Q4 2027** (après Phases 3, 5, 8)

**Total Estimé** : 15-22 mois (avec équipe dédiée)

### 5.3 Chemin Critique

Le chemin critique (minimum pour MVP) :

1. Phase 0 (POC) → 2. Phase 1 (Foundation) → 3. Phase 2 (Core Features) → 4. Phase 3 (AI) → 5. Phase 4 (Market Replay)

**MVP Estimé** : 12-16 mois

---

## 6. Directives pour Développeurs

### 6.1 ⚠️ NOTIFICATION IMMEDIATE - APIs Externes

**RÈGLE CRITIQUE** : Dès qu'une fonction nécessite une API externe (qu'elle soit payante ou gratuite), le développeur DOIT notifier immédiatement le Product Manager AVANT toute implémentation.

**Processus** :
1. **Identifier** : Développeur identifie besoin d'API externe
2. **Documenter** : Documenter l'API (nom, provider, coûts estimés, documentation)
3. **Notifier** : Notifier immédiatement le Product Manager (email, Slack, ticket)
4. **Attendre Validation** : Attendre validation budget et approbation avant implémentation
5. **Implémenter** : Une fois validé, procéder à l'implémentation

**APIs concernées** :
- APIs de data providers (Barchart, IBKR, Intrinio, CQG, LSEG, TickData, etc.)
- APIs AI (Google Gemini préféré, OpenAI en fallback, Anthropic, etc.) - nouvelles APIs ou extensions
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

### 6.2 🤖 Préférence Google Gemini pour APIs d'IA

**RÈGLE IMPORTANTE** : Pour tous les besoins d'IA (analyse, synthèse, génération de contenu, etc.), préférer l'API Google Gemini à OpenAI lorsque c'est techniquement possible et adapté au cas d'usage.

**Exceptions** :
- **Transcription audio** : OpenAI Whisper reste nécessaire (Gemini n'a pas d'API de transcription audio)
- **Fine-tuning spécifique** : Si le fine-tuning OpenAI est nécessaire et que Gemini ne le supporte pas, OpenAI peut être utilisé

**Fallback** : Si Google Gemini n'est pas adapté ou disponible pour un cas d'usage spécifique, OpenAI peut être utilisé en fallback après validation avec le Product Manager.

**Documentation** :
- Tous les choix d'API d'IA doivent être documentés avec justification
- Les cas où OpenAI est utilisé (au lieu de Gemini) doivent être explicitement justifiés

### 6.3 🔍 Research Obligatoire - Brokers & Implémentations

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

### 6.4 Checklist Pré-Implémentation

Avant de commencer une implémentation, le développeur DOIT :

- [ ] Effectuer research approfondie (Section 6.3)
- [ ] Identifier toutes les APIs externes nécessaires
- [ ] Vérifier si Google Gemini est adapté pour les besoins d'IA (Section 6.2)
- [ ] Notifier Product Manager pour APIs (Section 6.1)
- [ ] Documenter approche recommandée
- [ ] Valider approche avec équipe technique
- [ ] Créer ticket/story avec détails techniques
- [ ] Estimer temps et risques

### 6.5 Standards de Code & Documentation

- **Code Quality** : TypeScript strict, ESLint, Prettier
- **Tests** : Unit tests (Vitest) + Integration tests (Playwright)
- **Documentation** : JSDoc pour fonctions publiques
- **Commits** : Conventional commits (feat, fix, docs, etc.)
- **PRs** : Description claire avec contexte, risques, tests

---

## 7. Métriques de Succès

### 7.1 Métriques Techniques (par Phase)

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
| Phase 9 | SEO Score (Lighthouse) | > 90 | ⏳ Pending |
| Phase 9 | Core Web Vitals | LCP < 2.5s, FID < 100ms, CLS < 0.1 | ⏳ Pending |
| Phase 9 | Indexation Pages Publiques | > 80% (Google Search Console) | ⏳ Pending |
| Phase 9 | Traduction Complète (EN/FR/ES/PT) | 100% clés traduites | ⏳ Pending |
| Phase 9 | Pages Publiques Traduites ES/PT | Landing, Features, Pricing | ⏳ Pending |
| Phase 10 | Admin User Detail Page Load | < 2s | ⏳ Pending |
| Phase 10 | Calcul Stockage Utilisateur | < 1s (cached) | ⏳ Pending |
| Phase 10 | Estimation Coûts APIs | < 500ms | ⏳ Pending |
| Phase 11 | Analyse 6-step Latency | < 30s | ⏳ Pending |
| Phase 11 | FinancialJuice Verification | Intégrée dans rapport | ⏳ Pending |

### 7.2 Métriques Produit

- **Feature Parity** : 100% des fonctionnalités Premium des 5 concurrents intégrées
- **User Satisfaction** : NPS > 50
- **Adoption** : 80% des utilisateurs actifs utilisent au moins 3 modules
- **Retention** : Retention Day 30 > 60%

### 7.3 Métriques Business

- **Conversion** : Free → Paid conversion > 15%
- **MRR Growth** : Croissance mensuelle > 20%
- **Churn** : Churn rate < 5% mensuel
- **Competitive** : Positionnement premium avec pricing compétitif

---

## 8. Risques & Mitigations

### 8.1 Risques Techniques

| Risque | Impact | Probabilité | Mitigation | Status |
|--------|--------|-------------|------------|--------|
| Complexité TimescaleDB | High | Medium | POC préalable (Phase 0) | ⏳ Pending |
| Performance Replay | High | Medium | Compression, CDN caching | ⏳ Pending |
| Coûts APIs Google Gemini/LLM | Medium | High | Caching agressif, batch processing | ⏳ Pending |
| Scalabilité 240+ brokers | Medium | Medium | Workers parallélisés, rate limiting | ⏳ Pending |
| Complexité UI multi-compte | Medium | High | Virtual scrolling, UX testing précoce | ⏳ Pending |
| Disponibilité FinancialJuice | Medium | Medium | Fallback injection manuelle, API vs scraping | ⏳ Pending |

### 8.2 Risques Business

| Risque | Impact | Probabilité | Mitigation | Status |
|--------|--------|-------------|------------|--------|
| Coûts APIs Data Providers | High | Medium | Research approfondie, validation budget | ⏳ Pending |
| Timeline dépassée | Medium | Medium | Roadmap réaliste, buffer temps | ⏳ Pending |
| Complexité sous-estimée | High | Medium | POC précoces, validation continue | ⏳ Pending |

### 8.3 Risques Produit

| Risque | Impact | Probabilité | Mitigation | Status |
|--------|--------|-------------|------------|--------|
| UX trop complexe | Medium | Medium | Tests utilisateurs précoces, itérations | ⏳ Pending |
| Features non utilisées | Low | Medium | Analytics usage, prioritisation user value | ⏳ Pending |

---

## 9. Timeline Global

### 9.1 Vue d'Ensemble

```
Q1 2026: Phase 0 (POC) + Phase 1 (Foundation)
Q2-Q3 2026: Phase 2 (Core Features) + Phase 3 (AI) [parallèle partiel]
Q4 2026 - Q1 2027: Phase 4 (Market Replay) + Phase 5 (Analytics)
Q2 2027: Phase 6 (Replay/Visualisation) + Phase 7 (Journalisation)
Q3 2027: Phase 8 (Killer Features) + Phase 10 (Community & Engagement)
Q4 2027: Phase 9 (Pages Publiques) + Phase 11 (AI Daily Bias) + Polish & Launch
Q1-Q2 2028: Phase 12 (Future Features - Benchmarks, Video AI, Social, Mobile, Gamification)
```

### 9.2 Milestones Clés

| Milestone | Date Estimée | Status |
|-----------|--------------|--------|
| Phase 0 POC Validés | Q1 2026 | ⏳ Pending |
| Foundation Complete | Q1 2026 | ⏳ Pending |
| Multi-Compte & Broker Sync (50+ brokers) | Q3 2026 | ⏳ Pending |
| AI & Intelligence Complete | Q3 2026 | ⏳ Pending |
| Market Replay & Backtesting Complete | Q1 2027 | ⏳ Pending |
| Analytics Avancées Complete | Q2 2027 | ⏳ Pending |
| MVP Complete (Phases 1-4) | Q2 2027 | ⏳ Pending |
| AI Daily Bias Analysis Complete (Phase 11) | Q4 2027 | ⏳ Pending |
| Full Platform Complete | Q4 2027 | ⏳ Pending |

---

## 10. Prochaines Étapes

1. **Validation Roadmap** : Review avec équipe produit & technique
2. **Priorisation** : Affiner priorités selon contraintes business
3. **Budget** : Valider budget APIs externes (notamment Google Gemini vs OpenAI)
4. **Ressources** : Définir taille équipe, compétences nécessaires
5. **Phase 0** : Démarrer POC (TimescaleDB, Replay, AI avec Google Gemini)
6. **Epics Détaillés** : Créer documents détaillés pour chaque Epic (Stories, Acceptance Criteria)

---

**Document Status** : Draft - À valider par équipe produit & technique  
**Last Updated** : 2026-01-17  
**Next Review** : Après validation roadmap
