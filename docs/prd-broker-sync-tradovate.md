# 📋 PRD: Broker Sync — Tradovate Integration

> **Status**: 🚧 DRAFT (En cours de création)  
> **Epic**: 2 (Phase 2A: Connectivité & Données)  
> **Last Updated**: 2026-01-07  
> **PM**: John (BMad Agent)

---

## 📌 Workflow Progress

| Section | Status | Notes |
|---------|--------|-------|
| 1. Intro & Project Analysis | ✅ Complete | Scope validé, enhancement significatif |
| 2. Requirements | ✅ Complete | Focus Tradovate uniquement (IBKR reporté) |
| 3. UI Enhancement Goals | ⏳ Pending | Prochaine section |
| 4. Technical Constraints | ⏳ Pending | |
| 5. Epic Structure | ⏳ Pending | |
| 6. Stories | ⏳ Pending | |

---

## 1. Intro Project Analysis and Context

### 1.1 Existing Project Overview

#### Analysis Source
- IDE-based fresh analysis + `PROJECT_MEMORY.md` + `docs/roadmap.md`

#### Current Project State

Le **Trading Journal App** est une application web Next.js permettant aux traders de :
- Importer leurs trades (CSV, OCR)
- Visualiser un dashboard avec KPIs (Profit Factor, Avg Win/Loss, RR)
- Consulter un calendrier avec PnL quotidien
- Gérer des playbooks de stratégie
- Annoter trades et journées (tags, screenshots, notes)

**Stack actuelle** :

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Framework | Next.js (App Router) | 14.x |
| Language | TypeScript | 5.x |
| Database | PostgreSQL (Supabase) | - |
| ORM | Prisma | 5.x |
| Auth | Supabase Auth | - |
| UI | TailwindCSS + shadcn/ui | - |
| Charts | Recharts | - |
| i18n | next-intl | FR/EN |

### 1.2 Available Documentation Analysis

| Document | Statut |
|----------|--------|
| Tech Stack Documentation | ⚠️ Partiel |
| Source Tree/Architecture | ❌ Absent |
| Coding Standards | ⚠️ Partiel |
| API Documentation | ❌ Absent |
| Technical Debt | ✅ Présent (PROJECT_MEMORY.md) |

### 1.3 Enhancement Scope Definition

#### Enhancement Type
- [x] New Feature Addition
- [x] Integration with New Systems

#### Enhancement Description
**Broker Sync** permettra aux utilisateurs de connecter leur compte Tradovate pour synchroniser automatiquement leurs trades, éliminant le besoin d'import CSV/OCR manuel.

#### Impact Assessment
- [x] **Significant Impact** (nouvelles tables DB, nouveaux services, UI dédiée)

### 1.4 Goals and Background Context

#### Goals
- Automatiser l'import des trades via API Tradovate
- Synchroniser les trades historiques et nouveaux
- Permettre à l'utilisateur de gérer ses connexions broker
- Réduire les erreurs d'import (OCR/CSV parsing)
- Architecture extensible pour futurs brokers (IBKR, etc.)

#### Background Context
Actuellement, les utilisateurs importent manuellement leurs trades via CSV ou OCR. L'intégration API directe avec Tradovate offre des données 100% fiables et une synchronisation automatique.

---

## 2. Requirements

### Tradovate API Overview

Basé sur la [documentation API Tradovate](https://api.tradovate.com) :

| Aspect | Détail |
|--------|--------|
| **Auth** | API Key (pas OAuth) — généré dans l'app Tradovate |
| **Prérequis** | Compte avec solde > $1,000 + CME agreement + Add-on "API Access" |
| **Endpoints** | REST API + WebSocket pour real-time |
| **Sandbox** | Environnement de test disponible via "API Doc" link |
| **SDK** | Exemples officiels sur [GitHub Tradovate](https://github.com/tradovate) (JS, C#) |

### 2.1 Functional Requirements (FR)

| ID | Requirement |
|----|-------------|
| **FR1** | Le système doit permettre à l'utilisateur de saisir ses credentials Tradovate (API Key + Secret) |
| **FR2** | Le système doit valider les credentials en appelant l'endpoint d'authentification Tradovate |
| **FR3** | Le système doit récupérer la liste des comptes trading de l'utilisateur via `/account/list` |
| **FR4** | Le système doit récupérer l'historique des trades (fills) via `/fill/list` ou `/executionReport/list` |
| **FR5** | Le système doit mapper les données Tradovate vers le modèle `Trade` existant |
| **FR6** | Le système doit synchroniser automatiquement les nouveaux trades (scheduler configurable, défaut: 15min) |
| **FR7** | Le système doit détecter et éviter les doublons via `tradeSignature` existant |
| **FR8** | Le système doit permettre à l'utilisateur de déconnecter Tradovate |
| **FR9** | Le système doit afficher l'état de synchronisation (dernière sync, erreurs) |
| **FR10** | Le système doit permettre la synchronisation manuelle ("Sync Now") |

### 2.2 Non-Functional Requirements (NFR)

| ID | Requirement |
|----|-------------|
| **NFR1** | Les API Keys Tradovate doivent être stockées chiffrées (Supabase Vault ou colonne encrypted) |
| **NFR2** | Le système doit gérer les rate limits Tradovate avec retry exponential backoff |
| **NFR3** | Les tokens d'accès doivent être rafraîchis automatiquement avant expiration |
| **NFR4** | L'architecture doit permettre l'ajout futur d'autres brokers (pattern Strategy/Adapter) |
| **NFR5** | Les erreurs de sync doivent être loguées avec contexte suffisant pour debugging |

### 2.3 Compatibility Requirements (CR)

| ID | Requirement |
|----|-------------|
| **CR1** | Les trades Tradovate doivent utiliser le modèle `Trade` Prisma existant |
| **CR2** | Nouvelles tables (`BrokerConnection`, `SyncLog`) suivent conventions Prisma existantes |
| **CR3** | UI gestion connexions suit le design system (shadcn/ui, dark theme) |
| **CR4** | Déduplication via `tradeSignature` existant (avec `brokerTradeId` comme fallback) |

### 2.4 Tradovate Data Mapping

| Tradovate Field | Trade Model Field | Notes |
|-----------------|-------------------|-------|
| `contractId` → Contract name | `symbol` | Lookup via `/contract/item` |
| `action` (Buy/Sell) | `direction` | Buy=LONG, Sell=SHORT |
| `price` | `entryPrice` / `exitPrice` | Selon ordre dans fill |
| `qty` | `quantity` | Absolute value |
| `timestamp` | `openedAt` / `closedAt` | Fill timestamp |
| `netPrice` ou calcul | `realizedPnlUsd` | PnL calculé |
| `orderId` | (metadata) | Pour traçabilité |

---

## 3. UI Enhancement Goals

> ⏳ **À compléter** — Prochaine session

---

## 4. Technical Constraints and Integration Requirements

> ⏳ **À compléter**

---

## 5. Epic and Story Structure

> ⏳ **À compléter**

---

## 6. Stories

> ⏳ **À compléter**

---

## Notes & Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-07 | Focus Tradovate uniquement (pas IBKR) | Réduire scope MVP, IBKR ajouté plus tard |
| 2026-01-07 | API Key auth (pas OAuth) | C'est ce que Tradovate utilise |
| 2026-01-07 | Fill-based sync | L'API retourne des fills, pas des trades agrégés |

---

## Resume Instructions

Pour reprendre ce workflow :
```
@pm Continue PRD docs/prd-broker-sync-tradovate.md
```

Prochaine section : **3. UI Enhancement Goals**

