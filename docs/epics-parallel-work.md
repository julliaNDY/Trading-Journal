# 📋 Epics - Plan de Travail Parallèle

> **Objectif** : Lister les epics à compléter, leurs dépendances, et les commandes pour exécution avec `@dev`

**Date** : 2026-01-18  
**Status** : 📋 Planification (Epic 3 & 4 stories créées)

---

## 🎯 Vue d'Ensemble des Epics

| Epic | Phase | Durée | Dépendances | Status | Stories Disponibles |
|------|-------|-------|-------------|--------|---------------------|
| **Epic 1** | Phase 1 | 2-3 mois | Phase 0 (POC) | 🚧 En cours | ✅ 1.1-1.9 (Complétées/Ready), 1.10 (Draft) |
| **Epic 2** | Phase 4 | 4-6 mois | Epic 1 | 📋 Backlog | ✅ 2.1 (Completed), ❌ 2.2+ À créer |
| **Epic 3** | Phase 2 | 4-6 mois | Epic 1 | 📋 Ready | ✅ 3.1-3.8 (Draft) |
| **Epic 4** | Phase 3 | 3-4 mois | Epic 3 | 📋 Ready | ✅ 4.1-4.6 (Draft) |
| **Epic 5** | Phase 5 | 3-4 mois | Epic 3 + Epic 2 | 📋 Backlog | ❌ À créer |
| **Epic 6** | Phase 6 | 3-4 mois | Epic 2 | 📋 Backlog | ❌ À créer |
| **Epic 7** | Phase 7 | 2-3 mois | Epic 4 + Epic 3 | 📋 Backlog | ❌ À créer |
| **Epic 8** | Phase 8 | 3-4 mois | Epic 4 + Epic 3 + Epic 5 | 📋 Backlog | ❌ À créer |
| **Epic 9** | Phase 9 | 2-3 mois | **Aucune** | 📋 Backlog | ❌ À créer |
| **Epic 12** | Phase 11 | 3-4 mois | Epic 3 + Epic 4 | 📋 Ready | ✅ 12.1-12.9 (Draft) |

---

## 🔄 Groupes de Travail Parallèle

### **Groupe A : Prerequisites (Séquentiel)**

Ces epics doivent être complétés AVANT les autres :

1. **Phase 0 : Foundation & Planning (POC)** - 2-3 semaines
   - ⚠️ **Prérequis absolu** : Doit être complété avant Epic 1
   - Stories : Voir `docs/specs/phase-0-poc-plan.md`

2. **Epic 1 : Infrastructure & Foundation** - 2-3 mois
   - **Dépendances** : Phase 0 complétée ✅
   - **Stories POC (Phase 0)** : 1.1, 1.2, 1.3, 1.4, 1.5 ✅ Completed
   - **Stories Production** : 1.6, 1.7, 1.8, 1.9, 1.10 📋 Draft
   - ⚠️ **Bloquant pour** : Epic 2, Epic 3

---

### **Groupe B : En Parallèle (après Epic 1)**

Ces epics peuvent être développés EN PARALLÈLE après Epic 1 :

3. **Epic 3 : Multi-Compte Illimité & Broker Sync 240+** - 4-6 mois
   - **Dépendances** : Epic 1 ✅
   - **Peut être fait en parallèle avec** : Epic 2, Epic 9
   - **Stories** : ✅ 3.1-3.8 (Créées 2026-01-18)

4. **Epic 2 : Market Replay & Backtesting Infrastructure** - 4-6 mois
   - **Dépendances** : Epic 1 ✅
   - **Peut être fait en parallèle avec** : Epic 3, Epic 9
   - **Stories** : ❌ À créer

5. **Epic 9 : Pages Publiques** - 2-3 mois
   - **Dépendances** : **Aucune** ✅
   - **Peut être fait en parallèle avec** : Epic 1, Epic 2, Epic 3, Epic 4, Epic 5, Epic 6, Epic 7, Epic 8
   - **Stories** : ❌ À créer
   - ⚠️ **Note** : Peut démarrer dès maintenant (indépendant)

---

### **Groupe C : En Parallèle (après Epic 3)**

6. **Epic 4 : AI & Intelligence** - 3-4 mois
   - **Dépendances** : Epic 3 ✅
   - **Peut être fait en parallèle avec** : Epic 2 (si complété), Epic 5 (partiellement)
   - **Stories** : ✅ 4.1-4.6 (Créées 2026-01-18)

---

### **Groupe D : En Parallèle (après Epic 2 + Epic 3)**

7. **Epic 5 : Analytics Avancées** - 3-4 mois
   - **Dépendances** : Epic 3 ✅ + Epic 2 ✅
   - **Peut être fait en parallèle avec** : Epic 6, Epic 7 (partiellement)
   - **Stories** : ❌ À créer

8. **Epic 6 : Replay & Visualisation** - 3-4 mois
   - **Dépendances** : Epic 2 ✅
   - **Peut être fait en parallèle avec** : Epic 5 (partiellement), Epic 7 (partiellement)
   - **Stories** : ❌ À créer

---

### **Groupe E : En Parallèle (après Epic 4)**

9. **Epic 7 : Journalisation & Partage** - 2-3 mois
   - **Dépendances** : Epic 4 ✅ + Epic 3 ✅
   - **Peut être fait en parallèle avec** : Epic 6 (si Epic 2 complété), Epic 8 (partiellement)
   - **Stories** : ❌ À créer

---

### **Groupe F : Final (après Epic 4 + Epic 5)**

10. **Epic 8 : Killer Features Inédites** - 3-4 mois
    - **Dépendances** : Epic 4 ✅ + Epic 3 ✅ + Epic 5 ✅
    - **Peut être fait en parallèle avec** : Epic 7 (partiellement)
    - **Stories** : ❌ À créer

---

## 🛠️ Commandes pour Exécution avec `@dev`

### ⚠️ IMPORTANT : Workflow Dev Agent

Le dev agent travaille sur des **STORIES**, pas directement sur des EPICS.

**Workflow standard** :
1. Activer l'agent : `@dev`
2. L'agent affiche `*help` automatiquement
3. Pour développer une story : `*develop-story {story-file}`

**Format des commandes** :

```bash
# Exemple pour Epic 1, Story 1.1
@dev
*develop-story docs/stories/1.1.story.md
```

---

## 📝 Commandes par Epic

### **Epic 1 : Infrastructure & Foundation**

**Stories POC (Phase 0)** - ✅ Complétées :
- `docs/stories/1.1.story.md` (TimescaleDB + Replay POC) ✅
- `docs/stories/1.2.story.md` (Redis + BullMQ POC) ✅
- `docs/stories/1.3.story.md` (Vector DB + Embeddings POC) ✅
- `docs/stories/1.4.story.md` (Observability Baseline) ✅
- `docs/stories/1.5.story.md` (AI Architecture POC - Gemini) ✅

**Stories Production** - 📋 Draft :
- `docs/stories/1.6.story.md` (TimescaleDB Production Migration)
- `docs/stories/1.7.story.md` (Redis Upstash Production)
- `docs/stories/1.8.story.md` (Vector DB Qdrant Production)
- `docs/stories/1.9.story.md` (Production Monitoring & Alerting)
- `docs/stories/1.10.story.md` (Data Migration & Backup Strategy)

**Commandes** :
```bash
# Stories Production (à développer)
@dev
*develop-story docs/stories/1.6.story.md

@dev
*develop-story docs/stories/1.7.story.md

@dev
*develop-story docs/stories/1.8.story.md

@dev
*develop-story docs/stories/1.9.story.md

@dev
*develop-story docs/stories/1.10.story.md
```

**⚠️ Prérequis** : Phase 0 complétée ✅

---

### **Epic 2 : Market Replay & Backtesting Infrastructure**

**Stories** : ❌ À créer (format `docs/stories/2.X.story.md`)

**Commande** (une fois story créée) :
```bash
@dev
*develop-story docs/stories/2.1.story.md
```

**⚠️ Prérequis** : Epic 1 complété

---

### **Epic 3 : Multi-Compte Illimité & Broker Sync 240+**

**Stories** : ✅ Créées (2026-01-18)

| Story | Description | Status |
|-------|-------------|--------|
| 3.1 | Unlimited Accounts - Data Model & Optimizations | 📋 Draft |
| 3.2 | Unlimited Accounts UI - Virtual Scrolling & Lazy Loading | 📋 Draft |
| 3.3 | Broker Sync Architecture - Multi-Provider Abstraction | 📋 Draft |
| 3.4 | Broker Sync - Integration 50+ Priority Brokers | 📋 Draft |
| 3.5 | Broker Sync - Scheduler & Auto-Sync | 📋 Draft |
| 3.6 | Broker Connections UI - Management Dashboard | 📋 Draft |
| 3.7 | Import Profiles - CSV Mapping Configurations | 📋 Draft |
| 3.8 | Broker List - 240+ Supported Brokers Database | 📋 Draft |

**Commandes** :
```bash
@dev
*develop-story docs/stories/3.1.story.md

@dev
*develop-story docs/stories/3.2.story.md

@dev
*develop-story docs/stories/3.3.story.md

@dev
*develop-story docs/stories/3.4.story.md

@dev
*develop-story docs/stories/3.5.story.md

@dev
*develop-story docs/stories/3.6.story.md

@dev
*develop-story docs/stories/3.7.story.md

@dev
*develop-story docs/stories/3.8.story.md
```

**⚠️ Prérequis** : Epic 1 complété

**💡 Peut être fait en parallèle avec** : Epic 2, Epic 9

**🔗 Blocage Phase 11** : Epic 3 est prérequis pour Phase 11 (AI Daily Bias Analysis)

---

### **Epic 4 : AI & Intelligence**

**Stories** : ✅ Créées (2026-01-18)

| Story | Description | Status |
|-------|-------------|--------|
| 4.1 | AI Feedback - Pattern Analysis & Suggestions | 📋 Draft |
| 4.2 | AI Assistant - Conversational Coaching | 📋 Draft |
| 4.3 | Tiltmeter - ML-Based Discipline Detection | 📋 Draft |
| 4.4 | Efficiency Analysis - Real vs Theoretical Exit Comparison | 📋 Draft |
| 4.5 | Emotional Journal - Pre/During/Post Trade Journaling | 📋 Draft |
| 4.6 | Future Simulators - Account Projection | 📋 Draft |

**Commandes** :
```bash
@dev
*develop-story docs/stories/4.1.story.md

@dev
*develop-story docs/stories/4.2.story.md

@dev
*develop-story docs/stories/4.3.story.md

@dev
*develop-story docs/stories/4.4.story.md

@dev
*develop-story docs/stories/4.5.story.md

@dev
*develop-story docs/stories/4.6.story.md
```

**⚠️ Prérequis** : Epic 3 complété

**🔗 Blocage Phase 11** : Epic 4 est prérequis pour Phase 11 (AI Daily Bias Analysis)

---

### **Epic 5 : Analytics Avancées**

**Stories** : ❌ À créer (format `docs/stories/5.X.story.md`)

**Commande** (une fois story créée) :
```bash
@dev
*develop-story docs/stories/5.1.story.md
```

**⚠️ Prérequis** : Epic 3 + Epic 2 complétés

---

### **Epic 6 : Replay & Visualisation**

**Stories** : ❌ À créer (format `docs/stories/6.X.story.md`)

**Commande** (une fois story créée) :
```bash
@dev
*develop-story docs/stories/6.1.story.md
```

**⚠️ Prérequis** : Epic 2 complété

---

### **Epic 7 : Journalisation & Partage**

**Stories** : ❌ À créer (format `docs/stories/7.X.story.md`)

**Commande** (une fois story créée) :
```bash
@dev
*develop-story docs/stories/7.1.story.md
```

**⚠️ Prérequis** : Epic 4 + Epic 3 complétés

---

### **Epic 8 : Killer Features Inédites**

**Stories** : ❌ À créer (format `docs/stories/8.X.story.md`)

**Commande** (une fois story créée) :
```bash
@dev
*develop-story docs/stories/8.1.story.md
```

**⚠️ Prérequis** : Epic 4 + Epic 3 + Epic 5 complétés

---

### **Epic 9 : Pages Publiques**

**Stories** : ❌ À créer (format `docs/stories/9.X.story.md`)

**Commande** (une fois story créée) :
```bash
@dev
*develop-story docs/stories/9.1.story.md
```

**⚠️ Prérequis** : **AUCUN** (peut démarrer immédiatement)

**💡 Peut être fait en parallèle avec** : Tous les autres epics

---

## 🎯 Recommandations pour Travail Parallèle

### **Scénario Optimisé (3 agents en parallèle)**

**Agent 1** : Epic 1 (après Phase 0)
- Stories : 1.1, 1.2, 1.3, 1.4

**Agent 2** : Epic 9 (immédiatement)
- Stories : 9.1, 9.2, etc. (à créer)

**Agent 3** : Préparation Epic 2 ou Epic 3
- Création des stories (format story.md)

### **Après Epic 1 Complété**

**Agent 1** : Epic 3 (Multi-Compte & Broker Sync)
- Stories : 3.1, 3.2, etc. (à créer)

**Agent 2** : Epic 2 (Market Replay)
- Stories : 2.1, 2.2, etc. (à créer)

**Agent 3** : Epic 9 (Pages Publiques) - continuer
- Stories : 9.X (à créer)

### **Après Epic 3 Complété**

**Agent 1** : Epic 4 (AI & Intelligence)
- Stories : 4.1, 4.2, etc. (à créer)

**Agent 2** : Epic 2 (Market Replay) - continuer
- Stories : 2.X (en cours)

**Agent 3** : Epic 9 (Pages Publiques) - continuer
- Stories : 9.X (en cours)

### **Après Epic 2 + Epic 3 Complétés**

**Agent 1** : Epic 5 (Analytics Avancées)
- Stories : 5.1, 5.2, etc. (à créer)

**Agent 2** : Epic 6 (Replay & Visualisation)
- Stories : 6.1, 6.2, etc. (à créer)

**Agent 3** : Epic 4 (AI & Intelligence) - continuer
- Stories : 4.X (en cours)

---

## 📋 Checklist Pré-Développement

Avant de démarrer un epic avec `@dev`, s'assurer :

- [ ] **Prérequis complétés** : Epic dépendant terminé (sauf Epic 9)
- [ ] **Stories créées** : Format `docs/stories/{epic}.{story}.story.md`
- [ ] **Story en statut "Approved"** (pas "Draft")
- [ ] **Phase 0 complétée** (pour Epic 1 uniquement)
- [ ] **Architecture documentée** : `docs/architecture-trading-path-journal.md` à jour
- [ ] **APIs identifiées** : Notification PM si API externe nécessaire

---

## 🔗 Liens Utiles

- **Roadmap complète** : `docs/roadmap-trading-path-journal.md`
- **PRD** : `docs/prd-trading-path-journal.md`
- **Architecture** : `docs/architecture-trading-path-journal.md`
- **Phase 0 POC Plan** : `docs/specs/phase-0-poc-plan.md`
- **Stories Epic 1** : `docs/stories/1.X.story.md`

---

**Document Status** : Draft - À mettre à jour quand stories créées
