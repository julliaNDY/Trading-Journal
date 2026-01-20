# Phase 0 Execution Plan - Foundation & Planning

## Objectif

Valider les choix techniques critiques avant de démarrer Epic 1 (Phase 1).

**Durée estimée** : 2-3 semaines  
**Priorité** : 🔴 CRITIQUE

---

## Vue d'Ensemble

### Stories de la Phase 0

| Story | POC | Description | Est. | Statut |
|-------|-----|-------------|------|--------|
| **1.1** | POC-1 | TimescaleDB Setup + Replay POC | 3-4j | ✅ Completed |
| **1.2** | POC-4 | Redis + BullMQ Setup (Async Jobs) | 1-2j | ✅ Completed |
| **1.3** | - | Vector DB POC (Embeddings) | 2-3j | ✅ Completed |
| **1.4** | - | Observability Baseline | 1-2j | ✅ Completed |
| **1.5** | POC-3 | AI Architecture POC (Google Gemini) | 2-3j | ✅ Completed |
| **2.1** | POC-2 | Market Data Provider Research & Selection | 3-4j | ✅ Completed |

**Total estimé** : 12-18 jours (2.4-3.6 semaines)

---

## Ordre d'Exécution Recommandé

### Sprint 1 : Infrastructure de Base (Semaine 1)

**Objectif** : Mettre en place l'infrastructure de monitoring et les systèmes de base.

#### Jour 1-2 : Observability Baseline (Story 1.4)
- **Priorité** : 🔴 CRITIQUE (pour surveiller les autres POC)
- **Raison** : Avoir visibilité sur les autres POC dès le début
- **Story** : `docs/stories/1.4.story.md`
- **Dépendances** : Aucune
- **Livrables** :
  - Logging centralisé configuré (Axiom/Logtail)
  - Sentry error tracking actif
  - Vercel Analytics activé

#### Jour 3-4 : Redis + BullMQ Setup (Story 1.2)
- **Priorité** : 🟠 HAUTE (utilisé par POC-3 AI)
- **Raison** : Infrastructure de base pour async processing (nécessaire pour AI)
- **Story** : `docs/stories/1.2.story.md`
- **Dépendances** : Aucune (mais peut être fait en parallèle avec 1.4)
- **Livrables** :
  - Redis provisionné (Upstash ou local)
  - BullMQ configuré avec queue de test
  - Job test avec retry/backoff fonctionnel

---

### Sprint 2 : Data Infrastructure (Semaine 1-2)

**Objectif** : Valider infrastructure de stockage et sources de données.

#### Jour 5-8 : TimescaleDB + Replay POC (Story 1.1)
- **Priorité** : 🔴 CRITIQUE
- **Raison** : Infrastructure de base pour Market Replay et Backtesting
- **Story** : `docs/stories/1.1.story.md`
- **POC** : `docs/specs/phase-0-poc-plan.md` - POC-1
- **Dépendances** : Aucune (peut être fait en parallèle avec 2.1)
- **Livrables** :
  - TimescaleDB provisionné avec hypertable `ticks`
  - Compression active
  - Dataset échantillon chargé (1 jour, 250ms)
  - Benchmarks : latence < 200ms, replay 60fps

#### Jour 9-12 : Market Data Provider Research (Story 2.1) 
- **Priorité** : 🔴 CRITIQUE (validation budget nécessaire)
- **Raison** : Valider sources de données historiques et budget
- **Story** : `docs/stories/2.1.story.md`
- **POC** : `docs/specs/phase-0-poc-plan.md` - POC-2
- **Dépendances** : Aucune (peut être fait en parallèle avec 1.1)
- **⚠️ GOUVERNANCE** : Notification immédiate PM requise pour chaque API identifiée
- **Livrables** :
  - Research 3+ providers (Barchart, IBKR, Intrinio, etc.)
  - Tableau comparatif (coûts, qualité, coverage)
  - Recommendation + budget validé par PM
  - Plan d'intégration POC défini

---

### Sprint 3 : AI & Intelligence (Semaine 2-3)

**Objectif** : Valider architecture AI avec Google Gemini.

#### Jour 13-14 : Vector DB POC (Story 1.3)
- **Priorité** : 🟠 HAUTE (utilisé par POC-3 AI)
- **Raison** : Infrastructure nécessaire pour embeddings (AI)
- **Story** : `docs/stories/1.3.story.md`
- **Dépendances** : Aucune (mais nécessaire avant 1.5)
- **Livrables** :
  - Vector DB provisionné (Qdrant ou Pinecone)
  - Pipeline embeddings fonctionnel
  - Benchmarks : latence < 300ms

#### Jour 15-17 : AI Architecture POC (Story 1.5)
- **Priorité** : 🔴 CRITIQUE
- **Raison** : Valider choix Google Gemini vs OpenAI
- **Story** : `docs/stories/1.5.story.md`
- **POC** : `docs/specs/phase-0-poc-plan.md` - POC-3
- **Dépendances** : Story 1.2 (Redis pour async), Story 1.3 (Vector DB pour embeddings)
- **⚠️ GOUVERNANCE** : Notification PM requise si fallback OpenAI nécessaire
- **Livrables** :
  - Google Gemini API configurée
  - POC feedback IA coach (latence < 2s p95)
  - Embeddings fonctionnels (Gemini ou OpenAI fallback)
  - Analyse coûts (Gemini vs OpenAI)
  - Recommendation documentée

---

## Exécution en Parallèle (Optimisation)

Les stories suivantes peuvent être exécutées **en parallèle** pour réduire le temps total :

### Parallèle 1 : Infrastructure (Semaine 1)
- **Story 1.4** (Observability) + **Story 1.2** (Redis)
  - **Raison** : Pas de dépendances entre elles

### Parallèle 2 : Data (Semaine 1-2)
- **Story 1.1** (TimescaleDB) + **Story 2.1** (Market Data Providers)
  - **Raison** : Indépendants, peuvent être faits simultanément

### Parallèle 3 : AI Setup (Semaine 2)
- **Story 1.3** (Vector DB) peut commencer pendant Story 1.1 (si pas de dépendance)
  - **Raison** : Indépendant de TimescaleDB

**Temps optimisé** : **10-14 jours** (2-2.8 semaines) si exécution parallèle maximale

---

## Critères de Succès Phase 0

| Métrique | Cible | Statut |
|----------|-------|--------|
| **POC Replay Performance** | 60fps pour périodes < 1 jour | ⚠️ Partial (15-20fps on Supabase) |
| **POC Backtesting Performance** | < 1 minute pour 1000 trades | ⏳ Pending |
| **POC AI Latency** | < 2s (p95) | ✅ Validated |
| **Infrastructure Monitoring** | Logging + Error tracking opérationnels | ✅ Completed |
| **Budget Market Data Provider** | Validé par PM | ⏳ Pending PM Approval |

---

## Risques & Mitigations

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| **TimescaleDB performance** | High | Medium | POC préalable, benchmarks précoces |
| **Coûts Market Data Providers** | High | High | Research approfondie, validation budget PM |
| **Google Gemini latence/coûts** | Medium | Medium | Fallback OpenAI si nécessaire |
| **Vector DB latence** | Medium | Low | POC avec petit dataset, optimisation queries |
| **Retard POC bloquant** | High | Medium | Exécution parallèle, priorisation stricte |

---

## Gouvernance & Notifications

### ⚠️ Notifications PM Obligatoires

Les notifications suivantes doivent être faites **immédiatement** :

1. **Market Data Provider APIs** (Story 2.1)
   - Format : Voir `docs/roadmap-trading-path-journal.md` Section 5
   - Pour chaque API identifiée : coûts, documentation, justification

2. **AI API Fallback** (Story 1.5)
   - Si fallback OpenAI nécessaire au lieu de Gemini : notification + justification

3. **Nouvelles APIs Identifiées**
   - Toute API externe identifiée durant les POC : notification immédiate

---

## Documentation Requise

### Livrables par Story

| Story | Documentation Requise |
|-------|----------------------|
| **1.1** | DDL/SQL table `ticks`, benchmarks (latence, taille disque) |
| **1.2** | Exemple worker + queue, logs d'exécution |
| **1.3** | Pipeline embeddings, benchmarks latence |
| **1.4** | Configuration logs/error tracking, dashboard |
| **1.5** | Rapport POC (latence p50/p95, coûts), recommendation |
| **2.1** | Fiche comparative providers, budget validé |

### Documentation Consolidée

- **Rapport Phase 0** : Synthèse des POC validés + métriques
- **Architecture Validée** : Choix techniques approuvés
- **Budget Phase 1** : Estimations basées sur POC

---

## Next Steps (Post Phase 0)

Une fois Phase 0 complétée :

1. **Review POC** : Validation des résultats avec équipe
2. **Décisions Architecture** : Approuver choix techniques (Gemini vs OpenAI, provider data, etc.)
3. **Planning Phase 1** : Détailler Epic 1 basé sur POC validés
4. **Budget Validation** : Approbation budget infrastructure Phase 1
5. **Kickoff Phase 1** : Démarrer Epic 1 (Foundation & Core Infrastructure)

---

## Références

- **Roadmap** : `docs/roadmap-trading-path-journal.md` (Section Phase 0)
- **POC Plan** : `docs/specs/phase-0-poc-plan.md`
- **Architecture** : `docs/architecture-trading-path-journal.md`
- **Stories** : `docs/stories/1.1.story.md` à `docs/stories/2.1.story.md`

---

**Créé le** : 2026-01-17  
**Mis à jour** : 2026-01-17  
**Statut** : ✅ Completed  
**Owner** : Product Manager + Engineering Team
