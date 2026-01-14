# Phase 0 POC Plan - Foundation & Planning

## Objectif

Valider les choix techniques critiques avant de demarrer Epic 1.

## POC-1: TimescaleDB + Replay Storage

### Scope
- Provisionner un Postgres avec extension TimescaleDB.
- Creer une table `ticks` (time-series) et activer compression.
- Charger un echantillon de ticks (1 jour, 250ms).
- Tester lecture par fenetre temporelle (streaming).

### Succes
- 60fps pour replay < 1 jour (streaming client).
- Latence requete < 200ms sur fenetre standard.
- Compression active et stable.

### Deliverables
- DDL/SQL de la table `ticks`.
- Script de chargement echantillon.
- Benchmarks (temps de requete, taille disque).

## POC-2: Market Data Providers

### Scope
- Evaluer 2-3 providers (ex: Barchart, IBKR, Intrinio).
- Documenter auth, quotas, couts, latence, formats.

### Succes
- 1 provider valide pour ticks 250ms.
- Budget mensuel estime.

### Deliverables
- Fiche comparative par provider.
- Recommendation + fallback.
- Notification API au PM (voir roadmap).

## POC-3: AI Architecture (OpenAI + Embeddings)

### Scope
- Tester latence pour feedback IA (coach).
- Tester embeddings (text-embedding-3-large).

### Succes
- Latence < 2s pour feedback.
- Embeddings generes sans timeout.

### Deliverables
- Temps de reponse moyen (p50/p95).
- Estimation cout par requete.

## POC-4: Queue/Async Jobs (Redis + BullMQ)

### Scope
- Provisionner Redis (Upstash ou local).
- Executer un job d'import asynchrone.

### Succes
- Job stable avec retry/backoff.
- Logs exploitables.

### Deliverables
- Exemple de worker + queue.
- Logs d'execution.

## Processus Governance

### Notification API (obligatoire)
- Toute API externe identifiee doit etre notifiee au PM avant integration.
- Utiliser le template de la roadmap.

### Research Brokers (obligatoire)
- Pour chaque broker: auth, quotas, limitations, docs, libs, alternatives.
- Stocker la recherche en doc separé.

