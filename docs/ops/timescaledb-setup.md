# Timescale Cloud Setup Guide

## Vue d'ensemble

Ce guide explique comment provisionner et configurer une instance Timescale Cloud pour le projet Trading Journal.

**Contexte** : Story 1.6 - Migration de Supabase PostgreSQL vers TimescaleDB pour bénéficier des hypertables, compression et continuous aggregates nécessaires au Market Replay (60fps).

---

## 📋 Prérequis

- Compte email professionnel (pour créer le compte Timescale Cloud)
- Accès au projet GitHub (pour récupérer les scripts de setup)
- Accès aux variables d'environnement du projet (Vercel ou `.env.local`)

---

## 🚀 Étape 1 : Créer un compte Timescale Cloud

### 1.1 Inscription

1. Aller sur [https://console.cloud.timescale.com/](https://console.cloud.timescale.com/)
2. Cliquer sur **"Sign Up"** ou **"Get Started"**
3. Créer un compte avec :
   - Email professionnel
   - Mot de passe fort
   - Organisation (ex: "Trading Journal")

### 1.2 Vérification email

- Vérifier votre email et confirmer le compte
- Vous serez redirigé vers le dashboard Timescale Cloud

---

## 💰 Étape 2 : Choisir le plan et créer l'instance

### 2.1 Plan recommandé

Pour le projet Trading Journal, nous recommandons :

| Plan | CPU | RAM | Stockage | Prix/mois | Usage |
|------|-----|-----|----------|-----------|-------|
| **Free Trial** | 0.5 | 1 GB | 10 GB | Gratuit (30 jours) | Test initial |
| **Dev** | 1 | 2 GB | 25 GB | ~$29 | Développement |
| **Pro** | 2 | 4 GB | 50 GB | ~$99 | Production (recommandé) |

**Recommandation pour production** :
- **Plan Pro** (2 CPU, 4 GB RAM, 50 GB) pour supporter :
  - 454K+ ticks existants
  - Replay 60fps
  - Continuous aggregates (1m, 5m, 15m, 1h)
  - Compression active

### 2.2 Créer l'instance

1. Dans le dashboard, cliquer sur **"Create service"** ou **"New Service"**
2. Remplir le formulaire :
   - **Service name** : `trading-journal-prod` (ou `trading-journal-dev` pour dev)
   - **Region** : Choisir la région la plus proche (ex: `eu-west-1` pour Europe)
   - **Plan** : Sélectionner le plan recommandé ci-dessus
   - **PostgreSQL version** : `15` ou `16` (recommandé)
   - **TimescaleDB version** : La plus récente disponible
3. Cliquer sur **"Create service"**
4. ⏳ Attendre 2-5 minutes que l'instance soit provisionnée

### 2.3 Note importante

- Le **Free Trial** est parfait pour tester la migration
- Vous pouvez upgrader vers un plan payant à tout moment
- Les données sont conservées lors de l'upgrade

---

## 🔑 Étape 3 : Récupérer les credentials

### 3.1 Connection String

Une fois l'instance créée :

1. Dans le dashboard, cliquer sur votre service
2. Aller dans l'onglet **"Connection info"** ou **"Overview"**
3. Vous verrez la **Connection string** au format :
   ```
   postgresql://tsdbadmin:password@xxxxx.timescaledb.io:5432/tsdb?sslmode=require
   ```

### 3.2 Informations disponibles

- **Host** : `xxxxx.timescaledb.io`
- **Port** : `5432` (par défaut)
- **Database** : `tsdb` (par défaut)
- **Username** : `tsdbadmin` (par défaut)
- **Password** : Généré automatiquement (à copier)
- **SSL Mode** : `require` (obligatoire)

### 3.3 Sauvegarder les credentials

⚠️ **Important** : Sauvegarder le mot de passe immédiatement. Il n'est affiché qu'une seule fois.

---

## ⚙️ Étape 4 : Configurer les variables d'environnement

### 4.1 Variables requises

Ajouter dans `.env.local` (développement) ou dans Vercel (production) :

```bash
# TimescaleDB Production
TIMESCALE_DATABASE_URL="postgresql://tsdbadmin:VOTRE_PASSWORD@xxxxx.timescaledb.io:5432/tsdb?sslmode=require"

# Activer TimescaleDB (false par défaut pour migration progressive)
USE_TIMESCALEDB="false"
```

### 4.2 Format de la connection string

```
postgresql://[USERNAME]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]?sslmode=require
```

**Exemple complet** :
```bash
TIMESCALE_DATABASE_URL="postgresql://tsdbadmin:MySecureP@ssw0rd123@abc123.timescaledb.io:5432/tsdb?sslmode=require"
```

### 4.3 Vérification

```bash
# Tester la connexion depuis le projet
npx tsx -e "
import { testConnection } from './src/lib/timescaledb';
testConnection().then(console.log);
"
```

---

## 🗄️ Étape 5 : Exécuter le setup SQL

### 5.1 Prérequis

- PostgreSQL client installé (`psql`) ou accès via Timescale Cloud dashboard
- Script SQL disponible : `scripts/timescaledb-production-setup.sql`

### 5.2 Méthode 1 : Via psql (recommandé)

```bash
# Depuis le répertoire du projet
psql "$TIMESCALE_DATABASE_URL" -f scripts/timescaledb-production-setup.sql
```

**Alternative** (si `psql` n'est pas dans le PATH) :
```bash
# Avec variables d'environnement
export TIMESCALE_DATABASE_URL="postgresql://..."
psql "$TIMESCALE_DATABASE_URL" -f scripts/timescaledb-production-setup.sql
```

### 5.3 Méthode 2 : Via Timescale Cloud Dashboard

1. Aller dans votre service > **"Operations"** > **"SQL Editor"**
2. Ouvrir le fichier `scripts/timescaledb-production-setup.sql`
3. Copier-coller le contenu dans l'éditeur SQL
4. Exécuter le script

### 5.4 Vérification du setup

Le script crée :
- ✅ Extension TimescaleDB
- ✅ Table `tick_data` (hypertable avec chunks de 1 jour)
- ✅ Compression policy (après 30 jours)
- ✅ Retention policy (90 jours)
- ✅ Continuous aggregates (1m, 5m, 15m, 1h candles)
- ✅ Indexes optimisés

**Vérifier** :
```sql
-- Vérifier l'extension
SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';

-- Vérifier l'hypertable
SELECT * FROM timescaledb_information.hypertables WHERE hypertable_name = 'tick_data';

-- Vérifier les continuous aggregates
SELECT * FROM timescaledb_information.continuous_aggregates;
```

---

## 🧪 Étape 6 : Tester la connexion

### 6.1 Test via script Node.js

```bash
# Tester la connexion depuis le projet
npx tsx -e "
import { testConnection } from './src/lib/timescaledb';
testConnection().then(result => {
  console.log('Connection test:', result);
  if (result.connected) {
    console.log('✅ TimescaleDB version:', result.timescaleVersion);
    console.log('✅ PostgreSQL version:', result.postgresVersion);
    console.log('✅ Latency:', result.latencyMs + 'ms');
  } else {
    console.error('❌ Connection failed:', result.error);
  }
});
"
```

### 6.2 Test via API (si serveur lancé)

```bash
# Health check endpoint
curl http://localhost:3000/api/health/db
```

**Réponse attendue** :
```json
{
  "status": "healthy",
  "timescaleVersion": "2.13.0",
  "postgresVersion": "15.4",
  "latencyMs": 45
}
```

---

## 📊 Étape 7 : Migrer les données existantes

### 7.1 Prérequis

- Instance TimescaleDB configurée (étapes 1-6)
- Accès à Supabase (source de données)
- Script de migration : `scripts/timescaledb-migration.ts`

### 7.2 Exécuter la migration

```bash
# Migration complète (dry-run par défaut)
npx tsx scripts/timescaledb-migration.ts

# Migration réelle (supprimer --dry-run)
npx tsx scripts/timescaledb-migration.ts --no-dry-run

# Migration avec vérification
npx tsx scripts/timescaledb-migration.ts --no-dry-run --verify
```

### 7.3 Données à migrer

- **Tick data** : ~454,600 ticks (~107 MB)
- **Temps estimé** : 5-15 minutes selon la connexion

### 7.4 Vérification post-migration

```bash
# Compter les ticks migrés
psql "$TIMESCALE_DATABASE_URL" -c "SELECT COUNT(*) FROM tick_data;"

# Vérifier les chunks
psql "$TIMESCALE_DATABASE_URL" -c "SELECT COUNT(*) FROM timescaledb_information.chunks WHERE hypertable_name = 'tick_data';"
```

---

## ⚡ Étape 8 : Valider les performances

### 8.1 Benchmark

```bash
# Exécuter le benchmark avec target production
npx tsx scripts/timescaledb-poc/benchmark.ts --target=production
```

### 8.2 Résultats attendus

| Métrique | Cible | Acceptable |
|----------|-------|------------|
| Query 1min | < 50ms | < 100ms |
| Query 5min | < 60ms | < 150ms |
| Query 15min | < 80ms | < 200ms |
| Query 1h | < 100ms | < 300ms |
| Replay FPS | 60 | ≥ 50 |

### 8.3 Si les performances ne sont pas atteintes

1. **Vérifier les indexes** :
   ```sql
   SELECT * FROM pg_indexes WHERE tablename = 'tick_data';
   ```

2. **Vérifier la compression** :
   ```sql
   SELECT * FROM timescaledb_information.compression_settings;
   ```

3. **Vérifier les continuous aggregates** :
   ```sql
   SELECT * FROM timescaledb_information.continuous_aggregates;
   ```

4. **Upgrader le plan** si nécessaire (plus de RAM/CPU)

---

## 🔄 Étape 9 : Activer TimescaleDB en production

### 9.1 Migration progressive

Pour éviter les risques, activer TimescaleDB progressivement :

1. **Phase 1** : `USE_TIMESCALEDB="false"` (Supabase toujours actif)
2. **Phase 2** : Tester avec un subset d'utilisateurs
3. **Phase 3** : `USE_TIMESCALEDB="true"` (TimescaleDB actif)

### 9.2 Activer

```bash
# Dans Vercel ou .env.local
USE_TIMESCALEDB="true"
```

### 9.3 Vérifier le switch

Le code utilise automatiquement TimescaleDB si `USE_TIMESCALEDB="true"` :

```typescript
// src/lib/timescaledb.ts
const USE_TIMESCALEDB = process.env.USE_TIMESCALEDB === 'true';
```

---

## 🔒 Étape 10 : Sécurité et backups

### 10.1 Backups automatiques

Timescale Cloud inclut :
- ✅ **Backups quotidiens automatiques** (7 jours de rétention)
- ✅ **Point-in-time recovery** (PITR) disponible
- ✅ **Backups manuels** via dashboard

### 10.2 Vérifier les backups

1. Dashboard > Service > **"Backups"**
2. Vérifier que les backups quotidiens sont créés
3. Tester une restauration (staging) si nécessaire

### 10.3 Sécurité

- ✅ **SSL obligatoire** (`sslmode=require`)
- ✅ **IP whitelisting** disponible (optionnel)
- ✅ **VPC peering** disponible (plans Enterprise)

---

## 📝 Checklist finale

- [ ] Compte Timescale Cloud créé
- [ ] Instance provisionnée (plan Pro recommandé)
- [ ] Connection string récupérée et sauvegardée
- [ ] Variables d'environnement configurées (`TIMESCALE_DATABASE_URL`, `USE_TIMESCALEDB`)
- [ ] Setup SQL exécuté (`scripts/timescaledb-production-setup.sql`)
- [ ] Connexion testée (script ou API)
- [ ] Données migrées depuis Supabase (si applicable)
- [ ] Performances validées (benchmark 60fps)
- [ ] Backups vérifiés
- [ ] `USE_TIMESCALEDB="true"` activé (après validation)

---

## 🆘 Dépannage

### Problème : Connexion échoue

**Solutions** :
1. Vérifier que `sslmode=require` est dans la connection string
2. Vérifier que le mot de passe est correct (pas d'espaces)
3. Vérifier que l'IP n'est pas bloquée (whitelist si nécessaire)
4. Tester avec `psql` directement :
   ```bash
   psql "$TIMESCALE_DATABASE_URL" -c "SELECT 1;"
   ```

### Problème : Extension TimescaleDB non disponible

**Solution** : Timescale Cloud inclut TimescaleDB par défaut. Si l'erreur persiste :
```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';
```

### Problème : Performances insuffisantes

**Solutions** :
1. Vérifier que les indexes sont créés
2. Vérifier que les continuous aggregates sont actifs
3. Upgrader le plan (plus de RAM/CPU)
4. Vérifier la latence réseau (région)

### Problème : Migration échoue

**Solutions** :
1. Vérifier l'accès à Supabase (`DATABASE_URL`)
2. Vérifier l'accès à TimescaleDB (`TIMESCALE_DATABASE_URL`)
3. Exécuter en mode `--dry-run` d'abord
4. Vérifier les logs du script

---

## 📚 Ressources

- [Timescale Cloud Documentation](https://docs.timescale.com/cloud/)
- [TimescaleDB Documentation](https://docs.timescale.com/)
- [Story 1.6](../stories/1.6.story.md) - TimescaleDB Production Migration
- [Architecture](../architecture-trading-path-journal.md) - Section 2.3.1

---

## 💡 Notes importantes

1. **Coûts** : Le Free Trial (30 jours) est suffisant pour tester. Pour production, prévoir ~$99/mois (plan Pro).

2. **Migration** : La migration peut être effectuée en parallèle (Supabase + TimescaleDB) pour validation avant switch.

3. **Rollback** : Si problème, `USE_TIMESCALEDB="false"` permet de revenir à Supabase immédiatement.

4. **Monitoring** : Utiliser le dashboard Timescale Cloud pour surveiller :
   - CPU/RAM usage
   - Storage usage
   - Query performance
   - Backup status

---

**Dernière mise à jour** : 2026-01-17
